import assert from "node:assert";
import {
  AtpAgent,
  AppBskyFeedPost,
  ComAtprotoRepoListRecords,
} from "@atproto/api";

const agent = new AtpAgent({ service: "https://bsky.social/xrpc/" });

const postNsid = "app.bsky.feed.post";

const getDid = async (didOrHandle: string) => {
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

const paginateAllRecords = async <TRecord>(
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

const isPostRecord = (
  r: ComAtprotoRepoListRecords.Record
): r is PushpinReplyRecord => r.value.$type === postNsid;

const isPushpinReply = (p: PushpinReplyRecord): boolean =>
  !!p.value.reply && p.value.text.trim() === "📌";

const findPinPosts = async (actorDid: string) => {
  const postPaginator = async (cursor: string | undefined) => {
    const res = await agent.com.atproto.repo.listRecords({
      collection: postNsid,
      repo: actorDid,
      cursor,
      limit: 100,
    });
    return {
      cursor: res.data.cursor,
      records: res.data.records.filter(isPostRecord).filter(isPushpinReply),
    };
  };

  const posts = await paginateAllRecords(postPaginator);
  return posts;
};

const createBookmarks = async (pinPosts: PushpinReplyRecord[]) => {
  for (const post of pinPosts) {
    await agent.app.bsky.bookmark.createBookmark({
      cid: post.value.reply.parent.cid,
      uri: post.value.reply.parent.uri,
    });

    await agent.deletePost(post.uri);
  }
};

const main = async () => {
  const actorDidOrHandle = process.argv[2];
  assert(actorDidOrHandle, "actor did or handle is required as first param");
  const password = process.argv[3];
  assert(password, "password required as second parameter");

  const actorDid = await getDid(actorDidOrHandle);

  await agent.login({
    identifier: actorDid,
    password: password,
  });

  const pinPosts = await findPinPosts(actorDid);

  await createBookmarks(pinPosts);
};

main();
