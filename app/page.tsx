"use client";
import Image from "next/image";
import { useState } from "react";
import {
  AtpAgent,
  AppBskyFeedPost,
  ComAtprotoRepoListRecords,
} from "@atproto/api";

import { DidResolver } from "@atproto/identity/dist/did";

const postNsid = "app.bsky.feed.post";

const getDid = async (agent: AtpAgent, didOrHandle: string) => {
  if (didOrHandle.startsWith("did:")) {
    return didOrHandle;
  }
  const {
    data: { did },
  } = await agent.com.atproto.identity.resolveHandle({
    handle: didOrHandle,
  });
  return did;
};

const getDidDoc = async (did: string) => {
  const didres = new DidResolver({});
  const doc = await didres.resolve(did);
  return doc;
};

const paginateAllRecords = async <TRecord,>(
  fn: (cursor: string | undefined) => Promise<{
    cursor: string | undefined;
    records: TRecord[];
  }>,
  limit = Infinity
) => {
  const results = [];
  let cursor;
  do {
    try {
      const res = await fn(cursor);
      results.push(...res.records);
      cursor = res.cursor;
    } catch (err) {
      console.error("Error fetching records (will retry):", err);
    }
  } while (cursor && results.length < limit);
  return results;
};

type PushpinReplyRecord = ComAtprotoRepoListRecords.Record & {
  value: AppBskyFeedPost.Record & {
    reply: AppBskyFeedPost.ReplyRef;
  };
};

const isPushpinReplyRecord = (
  r: ComAtprotoRepoListRecords.Record
): r is PushpinReplyRecord => r.value.$type === postNsid;

const isPushpinReply = (p: PushpinReplyRecord): boolean =>
  !!p.value.reply && p.value.text.trim() === "📌";

const findPushpinReplies = async (
  agent: AtpAgent,
  actorDid: string,
  progressUpdate: (msg: string) => void
) => {
  let page = 0;
  const postPaginator = async (cursor: string | undefined) => {
    page++;
    progressUpdate(`Reading batch ${page}`);

    const res = await agent.com.atproto.repo.listRecords({
      collection: postNsid,
      repo: actorDid,
      cursor,
      limit: 100,
    });
    return {
      cursor: res.data.cursor,
      records: res.data.records
        .filter(isPushpinReplyRecord)
        .filter(isPushpinReply),
    };
  };

  const posts = await paginateAllRecords(postPaginator);
  return posts.sort((a: PushpinReplyRecord, b: PushpinReplyRecord): number =>
    a.value.createdAt.localeCompare(b.value.createdAt)
  );
};

const createBookmarks = async (
  agent: AtpAgent,
  pushpinReplies: PushpinReplyRecord[],
  progressUpdate: (msg: string) => void
) => {
  for (let i = 0; i < pushpinReplies.length; i++) {
    progressUpdate(`Creating bookmark ${i + 1}`);
    const post = pushpinReplies[i];
    await agent.app.bsky.bookmark.createBookmark({
      cid: post.value.reply.parent.cid,
      uri: post.value.reply.parent.uri,
    });
  }
};

const deletePushpinReplies = async (
  agent: AtpAgent,
  pushpinReplies: PushpinReplyRecord[],
  progressUpdate: (msg: string) => void
) => {
  for (let i = 0; i < pushpinReplies.length; i++) {
    progressUpdate(`Deleting bookmark ${i + 1}`);
    const post = pushpinReplies[i];
    await agent.deletePost(post.uri);
  }
};

type StatusUpdate = {
  status: "working" | "success" | "error";
  message: string;
};

export default function Home() {
  const [handle, setHandle] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [keepOrDelete, setKeepOrDelete] = useState<"keep" | "delete">("keep");
  const [statusUpdate, setStatusUpdate] = useState<StatusUpdate | null>(null);

  const pin2Saved = async () => {
    setIsLoading(true);

    try {
      const entrywayAgent = new AtpAgent({
        service: "https://bsky.social",
      });
      const did = await getDid(entrywayAgent, handle);
      const didDoc = await getDidDoc(did);

      if (!didDoc || !didDoc.service) {
        setStatusUpdate({
          status: "error",
          message: "Could not resolve DID",
        });
        return;
      }

      const pdsService = didDoc.service.find(
        (s) => s.type === "AtprotoPersonalDataServer"
      );
      if (!pdsService) {
        setStatusUpdate({
          status: "error",
          message: "Could not find PDS service",
        });
        return;
      }

      const pdsServiceEndpoint = pdsService.serviceEndpoint;
      if (typeof pdsServiceEndpoint !== "string") {
        setStatusUpdate({
          status: "error",
          message: "Could not obtain PDS service endpoint",
        });
        return;
      }

      const pdsAgent = new AtpAgent({
        service: pdsServiceEndpoint,
      });
      await pdsAgent.login({
        identifier: did,
        password: password,
      });

      const progressUpdate = (msg: string) => {
        setStatusUpdate({
          status: "working",
          message: msg,
        });
      };

      const pushpinReplies = await findPushpinReplies(
        pdsAgent,
        did,
        progressUpdate
      );
      await createBookmarks(pdsAgent, pushpinReplies, progressUpdate);
      if (keepOrDelete === "delete") {
        await deletePushpinReplies(pdsAgent, pushpinReplies, progressUpdate);
      }
      setStatusUpdate({
        status: "success",
        message: "Done",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="font-sans grid grid-rows-[20px_1fr_20px] items-center justify-items-center min-h-screen p-8 pb-20 gap-16 sm:p-20">
      <main className="flex flex-col gap-[32px] row-start-2 items-center sm:items-start">
        <h1>pin2saved</h1>
        <p>
          Migrate your 📌 replies in <a href="https://bsky.app">Bluesky</a> to
          saved posts.
        </p>

        <div className="flex gap-4 items-center flex-col sm:flex-row">
          <label htmlFor="handle">
            Handle
            <input
              id="handle"
              type="text"
              value={handle}
              onChange={(e) => setHandle(e.target.value)}
            />
          </label>
          <label htmlFor="password">
            Password
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
        </div>

        <div className="flex flex-col ">
          <small>
            Note: you can choose between keeping or deleting your 📌 replies as
            you migrate to saved posts. You can start with the "Keep" option,
            check the result in Bluesky, and then decide to run again with the
            "Delete" option if would like to cleanup (the saved posts won't be
            duplicated if you run multiple times).
          </small>
          <label>
            <input
              type="radio"
              name="keepOrDelete"
              checked={keepOrDelete === "keep"}
              onChange={(e) => setKeepOrDelete("keep")}
            />
            Keep your 📌 replies when migrating to saved posts.
          </label>
          <label>
            <input
              type="radio"
              name="keepOrDelete"
              value={"delete"}
              checked={keepOrDelete === "delete"}
              onChange={(e) => setKeepOrDelete("delete")}
            />
            Delete your 📌 replies when migrating to saved posts.
          </label>
          <button disabled={isLoading} onClick={pin2Saved}>
            Migrate!
          </button>
          {statusUpdate && (
            <pre>
              <code>{JSON.stringify(statusUpdate, null, 2)}</code>
            </pre>
          )}
        </div>
      </main>
      <footer className="row-start-3 flex gap-[24px] flex-wrap items-center justify-center">
        <a
          className="flex items-center gap-2 hover:underline hover:underline-offset-4"
          href="https://github.com/rafaeleyng/pin2saved"
          target="_blank"
          rel="noopener noreferrer"
        >
          <Image
            aria-hidden
            src="/file.svg"
            alt="File icon"
            width={16}
            height={16}
          />
          Source code on Github
        </a>
      </footer>
    </div>
  );
}
