import "server-only";
import { and, asc, desc, eq, gt, ilike, inArray, isNull, lt, or, sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import {
  bookmarks,
  comments,
  commentLikes,
  communities,
  companies,
  companyFollows,
  connections,
  files,
  follows,
  hashtags,
  postAttachments,
  postHashtags,
  postLikes,
  postMentions,
  posts,
  profiles,
  users,
} from "@/db/schema";
import { can } from "@/lib/auth/permissions";
import { memo } from "@/lib/cache";
import { LIMITS, type PostType, type PostVisibility, type Role } from "@/lib/constants";
import { likePattern } from "./jobs";

export type PostAttachment = { id: string; name: string; mime: string; size: number; width: number | null; height: number | null };

export type FeedPost = {
  id: string;
  type: PostType;
  category: string;
  title: string | null;
  slug: string | null;
  body: string;
  excerpt: string | null;
  linkUrl: string | null;
  visibility: PostVisibility;
  createdAt: Date;
  editedAt: Date | null;
  author: { id: string; username: string; name: string; headline: string | null; avatarFileId: string | null };
  company: { slug: string; name: string; logoFileId: string | null; verified: boolean } | null;
  community: { slug: string; name: string } | null;
  attachments: PostAttachment[];
  likeCount: number;
  commentCount: number;
  repostCount: number;
  viewer: { liked: boolean; bookmarked: boolean; reposted: boolean; isAuthor: boolean; canModerate: boolean };
  /** Lower-cased handle → profile or company path, for resolved @mentions. */
  mentions: Record<string, string>;
  /** The original when this is a repost. `null` content means it is no longer available. */
  repostOf: FeedPost | null;
  isRepost: boolean;
};

export type FeedMode = "for-you" | "latest" | "following" | "trending";

export type FeedOptions = {
  viewer: { id: string; role: Role } | null;
  mode?: FeedMode;
  category?: string;
  type?: PostType;
  /** Restrict to long-form types (articles, write-ups, research). */
  longForm?: boolean;
  authorId?: string;
  companyId?: string;
  communityId?: string;
  hashtag?: string;
  bookmarkedBy?: string;
  q?: string;
  interests?: string[];
  cursor?: string | null;
  limit?: number;
};

export type FeedPage = { posts: FeedPost[]; nextCursor: string | null };

const connectedIds = (viewerId: string) => sql`(
  select case when ${connections.requesterId} = ${viewerId} then ${connections.addresseeId} else ${connections.requesterId} end
  from ${connections}
  where ${connections.status} = 'accepted' and (${connections.requesterId} = ${viewerId} or ${connections.addresseeId} = ${viewerId})
)`;
const followingIds = (viewerId: string) => sql`(select ${follows.followingId} from ${follows} where ${follows.followerId} = ${viewerId})`;
const followedCompanyIds = (viewerId: string) =>
  sql`(select ${companyFollows.companyId} from ${companyFollows} where ${companyFollows.userId} = ${viewerId})`;

/**
 * Which posts a viewer may see. Applied to every post query: published content from active
 * members that is public, their own, or connections-only from someone they are connected to.
 */
export function visiblePostCondition(viewerId: string | null): SQL {
  const audience = viewerId
    ? or(
        eq(posts.visibility, "public"),
        eq(posts.authorId, viewerId),
        and(eq(posts.visibility, "connections"), sql`${posts.authorId} in ${connectedIds(viewerId)}`),
      )
    : eq(posts.visibility, "public");
  return and(eq(posts.status, "published"), eq(users.status, "active"), audience)!;
}

const postColumns = {
  id: posts.id,
  type: posts.type,
  category: posts.category,
  title: posts.title,
  slug: posts.slug,
  body: posts.body,
  excerpt: posts.excerpt,
  linkUrl: posts.linkUrl,
  visibility: posts.visibility,
  createdAt: posts.createdAt,
  editedAt: posts.editedAt,
  repostOfId: posts.repostOfId,
  likeCount: posts.likeCount,
  commentCount: posts.commentCount,
  repostCount: posts.repostCount,
  authorId: users.id,
  authorUsername: users.username,
  authorName: users.name,
  authorHeadline: profiles.headline,
  authorAvatar: profiles.avatarFileId,
  companySlug: companies.slug,
  companyName: companies.name,
  companyLogo: companies.logoFileId,
  companyVerification: companies.verificationStatus,
  communitySlug: communities.slug,
  communityName: communities.name,
};

const basePostQuery = () =>
  db
    .select(postColumns)
    .from(posts)
    .innerJoin(users, eq(posts.authorId, users.id))
    .leftJoin(profiles, eq(profiles.userId, users.id))
    .leftJoin(companies, eq(posts.companyId, companies.id))
    .leftJoin(communities, eq(posts.communityId, communities.id))
    .$dynamic();

type PostRow = Awaited<ReturnType<typeof basePostQuery>>[number];

/** Long-form previews in lists do not need the whole document. */
const LIST_BODY_LIMIT = 1600;

/** Attaches media, mentions, repost originals and the viewer's state in a fixed number of queries. */
async function hydrate(rows: PostRow[], viewer: FeedOptions["viewer"], options: { full?: boolean } = {}): Promise<FeedPost[]> {
  if (rows.length === 0) return [];

  const originalIds = [...new Set(rows.map((r) => r.repostOfId).filter((id): id is string => Boolean(id)))];
  const originalRows =
    originalIds.length > 0
      ? await basePostQuery().where(and(inArray(posts.id, originalIds), visiblePostCondition(viewer?.id ?? null)))
      : [];
  const all = [...rows, ...originalRows];
  const ids = [...new Set(all.map((r) => r.id))];

  const [attachmentRows, mentionRows, liked, bookmarked, reposted] = await Promise.all([
    db
      .select({
        postId: postAttachments.postId,
        id: files.id,
        name: files.originalName,
        mime: files.mime,
        size: files.size,
        width: files.width,
        height: files.height,
      })
      .from(postAttachments)
      .innerJoin(files, eq(files.id, postAttachments.fileId))
      .where(and(inArray(postAttachments.postId, ids), sql`${files.scanStatus} <> 'infected'`))
      .orderBy(asc(postAttachments.position)),
    db
      .select({ postId: postMentions.postId, handle: postMentions.handle, userId: postMentions.userId, companyId: postMentions.companyId })
      .from(postMentions)
      .where(inArray(postMentions.postId, ids)),
    viewer ? db.select({ postId: postLikes.postId }).from(postLikes).where(and(eq(postLikes.userId, viewer.id), inArray(postLikes.postId, ids))) : [],
    viewer ? db.select({ postId: bookmarks.postId }).from(bookmarks).where(and(eq(bookmarks.userId, viewer.id), inArray(bookmarks.postId, ids))) : [],
    viewer
      ? db
          .select({ postId: posts.repostOfId })
          .from(posts)
          .where(and(eq(posts.authorId, viewer.id), inArray(posts.repostOfId, ids), eq(posts.status, "published")))
      : [],
  ]);

  const attachmentsByPost = new Map<string, PostAttachment[]>();
  for (const { postId, ...attachment } of attachmentRows) {
    attachmentsByPost.set(postId, [...(attachmentsByPost.get(postId) ?? []), attachment]);
  }
  const mentionsByPost = new Map<string, Record<string, string>>();
  for (const m of mentionRows) {
    const map = mentionsByPost.get(m.postId) ?? {};
    map[m.handle] = m.userId ? `/u/${m.handle}` : `/companies/${m.handle}`;
    mentionsByPost.set(m.postId, map);
  }
  const likedSet = new Set(liked.map((r) => r.postId));
  const bookmarkedSet = new Set(bookmarked.map((r) => r.postId));
  const repostedSet = new Set(reposted.map((r) => r.postId));
  const canModerate = can(viewer?.role, "moderate:content");

  const build = (row: PostRow, original: FeedPost | null): FeedPost => {
    const isLong = row.type === "article" || row.body.length > LIST_BODY_LIMIT;
    return {
      id: row.id,
      type: row.type,
      category: row.category,
      title: row.title,
      slug: row.slug,
      body: !options.full && isLong ? row.body.slice(0, LIST_BODY_LIMIT) : row.body,
      excerpt: row.excerpt,
      linkUrl: row.linkUrl,
      visibility: row.visibility,
      createdAt: row.createdAt,
      editedAt: row.editedAt,
      author: { id: row.authorId, username: row.authorUsername, name: row.authorName, headline: row.authorHeadline, avatarFileId: row.authorAvatar },
      company: row.companySlug
        ? { slug: row.companySlug, name: row.companyName!, logoFileId: row.companyLogo, verified: row.companyVerification === "verified" }
        : null,
      community: row.communitySlug ? { slug: row.communitySlug, name: row.communityName! } : null,
      attachments: attachmentsByPost.get(row.id) ?? [],
      likeCount: row.likeCount,
      commentCount: row.commentCount,
      repostCount: row.repostCount,
      viewer: {
        liked: likedSet.has(row.id),
        bookmarked: bookmarkedSet.has(row.id),
        reposted: repostedSet.has(row.id),
        isAuthor: viewer?.id === row.authorId,
        canModerate,
      },
      mentions: mentionsByPost.get(row.id) ?? {},
      repostOf: original,
      isRepost: Boolean(row.repostOfId),
    };
  };

  const originals = new Map(originalRows.map((row) => [row.id, build(row, null)]));
  return rows.map((row) => build(row, row.repostOfId ? (originals.get(row.repostOfId) ?? null) : null));
}

const engagement = sql`(1 + ${posts.likeCount} + 2 * ${posts.commentCount} + 3 * ${posts.repostCount})`;
const ageHours = sql`(extract(epoch from (now() - ${posts.createdAt})) / 3600.0)`;

export async function getFeed(options: FeedOptions): Promise<FeedPage> {
  const viewerId = options.viewer?.id ?? null;
  const mode = options.mode ?? "latest";
  const limit = Math.min(options.limit ?? LIMITS.feedPageSize, 30);
  const where: SQL[] = [visiblePostCondition(viewerId)];

  if (options.category) where.push(eq(posts.category, options.category));
  if (options.type) where.push(eq(posts.type, options.type));
  if (options.longForm) where.push(inArray(posts.type, ["article", "ctf_writeup", "research", "disclosure"]), sql`${posts.title} is not null`);
  if (options.authorId) where.push(eq(posts.authorId, options.authorId));
  if (options.companyId) where.push(eq(posts.companyId, options.companyId));
  if (options.communityId) where.push(eq(posts.communityId, options.communityId));
  if (options.hashtag) {
    where.push(
      sql`${posts.id} in (select ${postHashtags.postId} from ${postHashtags} inner join ${hashtags} on ${hashtags.id} = ${postHashtags.hashtagId} where ${hashtags.tag} = ${options.hashtag.toLowerCase()})`,
    );
  }
  if (options.bookmarkedBy) {
    where.push(sql`${posts.id} in (select ${bookmarks.postId} from ${bookmarks} where ${bookmarks.userId} = ${options.bookmarkedBy})`);
  }
  const q = options.q?.trim().slice(0, 100);
  if (q) {
    where.push(
      or(
        sql`to_tsvector('english', coalesce(${posts.title}, '') || ' ' || ${posts.body}) @@ websearch_to_tsquery('english', ${q})`,
        ilike(posts.title, likePattern(q)),
      )!,
    );
  }
  if (mode === "following" && viewerId) {
    where.push(
      or(
        sql`${posts.authorId} in ${followingIds(viewerId)}`,
        sql`${posts.authorId} in ${connectedIds(viewerId)}`,
        sql`${posts.companyId} in ${followedCompanyIds(viewerId)}`,
        eq(posts.authorId, viewerId),
      )!,
    );
  }

  // Ranked feeds page by offset over a bounded window; chronological feeds use a keyset cursor.
  const ranked = mode === "for-you" || mode === "trending";
  if (ranked) {
    const offset = Math.max(0, Number(options.cursor?.replace(/^o:/, "") ?? 0) || 0);
    where.push(gt(posts.createdAt, new Date(Date.now() - (mode === "trending" ? 14 : 45) * 24 * 60 * 60 * 1000)));

    let score = sql`${engagement} / power(${ageHours} + 2, ${mode === "trending" ? 1.1 : 1.4})`;
    if (mode === "for-you" && viewerId) {
      const interests = options.interests?.length ? options.interests : null;
      score = sql`${score} * (1
        + case when ${posts.authorId} in ${followingIds(viewerId)} or ${posts.authorId} in ${connectedIds(viewerId)} then 2.5 else 0 end
        + case when ${posts.companyId} in ${followedCompanyIds(viewerId)} then 1.5 else 0 end
        + ${interests ? sql`case when ${posts.category} in ${interests} then 1.2 else 0 end` : sql`0`})`;
    }
    const rows = await basePostQuery()
      .where(and(...where))
      .orderBy(desc(score), desc(posts.createdAt))
      .limit(limit + 1)
      .offset(offset);
    const page = rows.slice(0, limit);
    return {
      posts: await hydrate(page, options.viewer),
      nextCursor: rows.length > limit && offset + limit < 300 ? `o:${offset + limit}` : null,
    };
  }

  const cursor = options.cursor?.match(/^t:(\d+)\|([a-z0-9]+)$/);
  if (cursor) {
    const at = new Date(Number(cursor[1]));
    where.push(or(lt(posts.createdAt, at), and(eq(posts.createdAt, at), lt(posts.id, cursor[2]!)))!);
  }
  const rows = await basePostQuery()
    .where(and(...where))
    .orderBy(desc(posts.createdAt), desc(posts.id))
    .limit(limit + 1);
  const page = rows.slice(0, limit);
  const last = page.at(-1);
  return {
    posts: await hydrate(page, options.viewer),
    nextCursor: rows.length > limit && last ? `t:${last.createdAt.getTime()}|${last.id}` : null,
  };
}

export async function getPost(id: string, viewer: FeedOptions["viewer"]): Promise<FeedPost | null> {
  if (!/^[a-z0-9]{8,40}$/.test(id)) return null;
  const rows = await basePostQuery().where(and(eq(posts.id, id), visiblePostCondition(viewer?.id ?? null))).limit(1);
  return (await hydrate(rows, viewer, { full: true }))[0] ?? null;
}

export async function getArticleBySlug(slug: string, viewer: FeedOptions["viewer"]): Promise<FeedPost | null> {
  if (!/^[a-z0-9-]{3,200}$/.test(slug)) return null;
  const rows = await basePostQuery().where(and(eq(posts.slug, slug), visiblePostCondition(viewer?.id ?? null))).limit(1);
  return (await hydrate(rows, viewer, { full: true }))[0] ?? null;
}

export type CommentItem = {
  id: string;
  body: string;
  createdAt: Date;
  editedAt: Date | null;
  likeCount: number;
  parentId: string | null;
  author: { id: string; username: string; name: string; headline: string | null; avatarFileId: string | null };
  viewer: { liked: boolean; canDelete: boolean };
  replies: CommentItem[];
};

/** Comments for a post as a two-level tree (top-level comments with their replies). */
export async function getComments(postId: string, viewer: FeedOptions["viewer"]): Promise<CommentItem[]> {
  const rows = await db
    .select({
      id: comments.id,
      body: comments.body,
      createdAt: comments.createdAt,
      editedAt: comments.editedAt,
      likeCount: comments.likeCount,
      parentId: comments.parentId,
      authorId: users.id,
      authorUsername: users.username,
      authorName: users.name,
      authorHeadline: profiles.headline,
      authorAvatar: profiles.avatarFileId,
    })
    .from(comments)
    .innerJoin(users, eq(comments.authorId, users.id))
    .leftJoin(profiles, eq(profiles.userId, users.id))
    .where(and(eq(comments.postId, postId), eq(comments.status, "published"), eq(users.status, "active")))
    .orderBy(asc(comments.createdAt))
    .limit(500);

  const likedIds =
    viewer && rows.length > 0
      ? new Set(
          (
            await db
              .select({ id: commentLikes.commentId })
              .from(commentLikes)
              .where(and(eq(commentLikes.userId, viewer.id), inArray(commentLikes.commentId, rows.map((r) => r.id))))
          ).map((r) => r.id),
        )
      : new Set<string>();
  const canModerate = can(viewer?.role, "moderate:content");

  const items = new Map<string, CommentItem>();
  const roots: CommentItem[] = [];
  for (const row of rows) {
    const item: CommentItem = {
      id: row.id,
      body: row.body,
      createdAt: row.createdAt,
      editedAt: row.editedAt,
      likeCount: row.likeCount,
      parentId: row.parentId,
      author: { id: row.authorId, username: row.authorUsername, name: row.authorName, headline: row.authorHeadline, avatarFileId: row.authorAvatar },
      viewer: { liked: likedIds.has(row.id), canDelete: viewer?.id === row.authorId || canModerate },
      replies: [],
    };
    items.set(item.id, item);
    const parent = row.parentId ? items.get(row.parentId) : undefined;
    if (parent) parent.replies.push(item);
    else if (!row.parentId) roots.push(item);
  }
  return roots;
}

export type TrendingTag = { tag: string; posts: number };

/** Most used hashtags over the last two weeks. Public and identical for everyone, so cached. */
export function getTrendingTags(limit = 8): Promise<TrendingTag[]> {
  return memo(`feed:trending-tags:${limit}`, 5 * 60_000, async () => {
    const usage = sql<number>`count(*)::int`;
    return db
      .select({ tag: hashtags.tag, posts: usage })
      .from(postHashtags)
      .innerJoin(hashtags, eq(hashtags.id, postHashtags.hashtagId))
      .innerJoin(posts, eq(posts.id, postHashtags.postId))
      .where(and(gt(postHashtags.createdAt, new Date(Date.now() - 14 * 24 * 60 * 60 * 1000)), eq(posts.status, "published"), eq(posts.visibility, "public")))
      .groupBy(hashtags.tag)
      .orderBy(desc(usage))
      .limit(limit);
  });
}

/** Published public post counts per category, for the Explore page. */
export function getCategoryPostCounts(): Promise<Record<string, number>> {
  return memo("feed:category-counts", 5 * 60_000, async () => {
    const rows = await db
      .select({ category: posts.category, value: sql<number>`count(*)::int` })
      .from(posts)
      .where(and(eq(posts.status, "published"), eq(posts.visibility, "public"), isNull(posts.repostOfId)))
      .groupBy(posts.category);
    return Object.fromEntries(rows.map((r) => [r.category, r.value]));
  });
}
