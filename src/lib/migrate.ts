import type {
  Agent,
  AppBskyFeedPost,
  ComAtprotoRepoListRecords,
} from "@atproto/api";

const postNsid = "app.bsky.feed.post";

const paginateAllRecords = async <TRecord>(
  fn: (cursor: string | undefined) => Promise<{
    cursor: string | undefined;
    records: TRecord[];
  }>,
  limit = Infinity,
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
  r: ComAtprotoRepoListRecords.Record,
): r is PushpinReplyRecord => r.value.$type === postNsid;

const isPushpinReply = (p: PushpinReplyRecord): boolean =>
  !!p.value.reply && p.value.text.trim() === "📌";

export const findPushpinReplies = async (
  agent: Agent,
  actorDid: string,
  progressUpdate: (msg: string) => void,
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
    a.value.createdAt.localeCompare(b.value.createdAt),
  );
};

export const createBookmarks = async (
  agent: Agent,
  pushpinReplies: PushpinReplyRecord[],
  progressUpdate: (msg: string) => void,
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

export const deletePushpinReplies = async (
  agent: Agent,
  pushpinReplies: PushpinReplyRecord[],
  progressUpdate: (msg: string) => void,
) => {
  for (let i = 0; i < pushpinReplies.length; i++) {
    progressUpdate(`Deleting bookmark ${i + 1}`);
    const post = pushpinReplies[i];
    await agent.deletePost(post.uri);
  }
};
