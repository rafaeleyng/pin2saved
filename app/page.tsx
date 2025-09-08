"use client";
import Image from "next/image";
import { useState } from "react";
import {
  AtpAgent,
  AppBskyFeedPost,
  ComAtprotoRepoListRecords,
} from "@atproto/api";

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

const findPushpinReplies = async (agent: AtpAgent, actorDid: string) => {
  const postPaginator = async (cursor: string | undefined) => {
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
  return posts;
};

const createBookmarks = async (
  agent: AtpAgent,
  pushpinReplies: PushpinReplyRecord[]
) => {
  for (const post of pushpinReplies) {
    await agent.app.bsky.bookmark.createBookmark({
      cid: post.value.reply.parent.cid,
      uri: post.value.reply.parent.uri,
    });
  }
};

const deletePushpinReplies = async (
  agent: AtpAgent,
  pushpinReplies: PushpinReplyRecord[]
) => {
  for (const post of pushpinReplies) {
    await agent.deletePost(post.uri);
  }
};

export default function Home() {
  const [handle, setHandle] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [keepOrDelete, setKeepOrDelete] = useState<"keep" | "delete">("keep");

  const migrate = async () => {
    setIsLoading(true);

    try {
      const agent = new AtpAgent({ service: "https://bsky.social/xrpc/" });
      const actorDid = await getDid(agent, handle);
      await agent.login({
        identifier: actorDid,
        password: password,
      });

      const pushpinReplies = await findPushpinReplies(agent, actorDid);

      await createBookmarks(agent, pushpinReplies);
      if (keepOrDelete === "delete") {
        await deletePushpinReplies(agent, pushpinReplies);
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="font-sans grid grid-rows-[20px_1fr_20px] items-center justify-items-center min-h-screen p-8 pb-20 gap-16 sm:p-20">
      <main className="flex flex-col gap-[32px] row-start-2 items-center sm:items-start">
        <h1>pin2saved</h1>
        <p>
          Convert your 📌 replies in <a href="https://bsky.app">Bluesky</a> to
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
            Note: start by keeping your 📌 replies, then check your saved posts
            on Bluesky. If you like the result, change to delete the 📌 replies
            and run it again (the saved posts won't be duplicated if you run
            multiple times).
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
              value="delete"
              checked={keepOrDelete === "delete"}
              onChange={(e) => setKeepOrDelete("delete")}
            />
            Delete your 📌 replies when migrating to saved posts.
          </label>
          <button disabled={isLoading} onClick={migrate}>
            Migrate your 📌 replies to saved posts
          </button>
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
