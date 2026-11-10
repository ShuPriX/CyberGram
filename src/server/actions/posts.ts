"use server";

import { and, eq, gt, inArray, isNull, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import {
  bookmarks,
  commentLikes,
  comments,
  communities,
  communityMembers,
  companies,
  companyFollows,
  companyMembers,
  files,
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
import { getSession, type SessionUser } from "@/lib/auth/session";
import { invalidate } from "@/lib/cache";
import { LIMITS, POST_TYPE_VALUES, type PostType } from "@/lib/constants";
import { newId, shortId } from "@/lib/ids";
import { audit } from "@/lib/security/audit";
import { worstLinkLevel } from "@/lib/security/link-safety";
import { excerptOf, extractHashtags, extractMentions, extractUrls } from "@/lib/text";
import { slugify } from "@/lib/utils";
import { zId, zOneOf, zOptionalId, zOptionalInline, zOptionalUrl, zStringList, zText, zInline } from "@/lib/validation";
import { ActionError, callAction, fail, formAction, ok } from "@/server/action-utils";
import { getComments, getFeed, getPost, type CommentItem, type FeedMode, type FeedPage, type FeedPost } from "@/server/queries/posts";
import { isValidCategory } from "@/server/queries/taxonomy";
import { notify } from "@/server/services/notify";

const DAY = 24 * 60 * 60 * 1000;

/** Hashtags, @mentions (with notifications) and link screening for a new or edited post. */
async function indexPost(postId: string, author: { id: string; name: string }, text: string, options: { notifyMentions: boolean; href: string }) {
  await db.delete(postHashtags).where(eq(postHashtags.postId, postId));
  await db.delete(postMentions).where(eq(postMentions.postId, postId));

  const tags = extractHashtags(text);
  if (tags.length > 0) {
    await db.insert(hashtags).values(tags.map((tag) => ({ tag }))).onConflictDoNothing({ target: hashtags.tag });
    const rows = await db.select({ id: hashtags.id }).from(hashtags).where(inArray(hashtags.tag, tags));
    await db.insert(postHashtags).values(rows.map((row) => ({ postId, hashtagId: row.id }))).onConflictDoNothing();
    invalidate("feed:trending-tags");
  }

  const handles = extractMentions(text);
  if (handles.length > 0) {
    const [mentionedUsers, mentionedCompanies] = await Promise.all([
      db.select({ id: users.id, username: users.username }).from(users).where(and(inArray(users.username, handles), eq(users.status, "active"))),
      db.select({ id: companies.id, slug: companies.slug }).from(companies).where(inArray(companies.slug, handles)),
    ]);
    const userHandles = new Set(mentionedUsers.map((u) => u.username));
    const values = [
      ...mentionedUsers.map((u) => ({ postId, handle: u.username, userId: u.id })),
      ...mentionedCompanies.filter((c) => !userHandles.has(c.slug)).map((c) => ({ postId, handle: c.slug, companyId: c.id })),
    ];
    if (values.length > 0) await db.insert(postMentions).values(values);
    if (options.notifyMentions) {
      for (const mentioned of mentionedUsers) {
        await notify({
          userId: mentioned.id,
          actorId: author.id,
          type: "mention",
          entityType: "post",
          entityId: postId,
          data: { title: `${author.name} mentioned you`, preview: excerptOf(text, 140), href: options.href },
        });
      }
    }
  }
}

/** Members in their first day may not post link-heavy content — the commonest spam pattern. */
async function assertNotSpam(userId: string, body: string) {
  const [recentDuplicate] = await db
    .select({ id: posts.id })
    .from(posts)
    .where(and(eq(posts.authorId, userId), eq(posts.body, body), gt(posts.createdAt, new Date(Date.now() - 10 * 60 * 1000))))
    .limit(1);
  if (recentDuplicate) throw new ActionError("You already posted this a moment ago.");

  const urls = extractUrls(body);
  if (urls.length > 2) {
    const [account] = await db.select({ createdAt: users.createdAt }).from(users).where(eq(users.id, userId)).limit(1);
    if (account && Date.now() - account.createdAt.getTime() < DAY) {
      throw new ActionError("New accounts can include up to two links per post during their first day.");
    }
  }
  if (urls.length > 10) throw new ActionError("Please include at most ten links in a post.");
}

function flagReason(text: string, linkUrl?: string | null): string | null {
  const { flagged } = worstLinkLevel([...extractUrls(text), ...(linkUrl ? [linkUrl] : [])]);
  const dangerous = flagged.filter((f) => f.level === "danger");
  return dangerous.length > 0 ? `Suspicious link: ${dangerous[0]!.host} — ${dangerous[0]!.reasons[0]}` : null;
}

// ── Create ───────────────────────────────────────────────────────────────────

const createPostSchema = z.object({
  body: zText(LIMITS.postBody),
  title: zOptionalInline(160),
  category: zInline(60),
  type: zOneOf(POST_TYPE_VALUES.filter((t) => t !== "article") as [PostType, ...PostType[]]).default("post"),
  visibility: zOneOf(["public", "connections"] as const).default("public"),
  linkUrl: zOptionalUrl,
  attachments: zStringList(LIMITS.attachmentsPerPost, 40),
  communityId: zOptionalId,
  companyId: zOptionalId,
});

export const createPostAction = formAction({ schema: createPostSchema, rateLimit: "post" }, async (input, { user }) => {
  if (!(await isValidCategory(input.category))) return fail("Please choose a category.", { category: "Choose a category." });
  await assertNotSpam(user.id, input.body);

  if (input.companyId) {
    const [member] = await db
      .select({ role: companyMembers.role })
      .from(companyMembers)
      .where(and(eq(companyMembers.companyId, input.companyId), eq(companyMembers.userId, user.id)))
      .limit(1);
    if (!member) return fail("You can only post on behalf of organisations you belong to.");
  }
  if (input.communityId) {
    const [member] = await db
      .select({ role: communityMembers.role })
      .from(communityMembers)
      .where(and(eq(communityMembers.communityId, input.communityId), eq(communityMembers.userId, user.id)))
      .limit(1);
    if (!member) return fail("Join the community before starting a discussion in it.");
  }

  // Attachments must be the caller's own, unused uploads of a kind meant for posts.
  let attachmentIds: string[] = [];
  if (input.attachments.length > 0) {
    const owned = await db
      .select({ id: files.id })
      .from(files)
      .leftJoin(postAttachments, eq(postAttachments.fileId, files.id))
      .where(
        and(
          inArray(files.id, input.attachments),
          eq(files.ownerId, user.id),
          inArray(files.kind, ["post_media", "attachment"]),
          isNull(postAttachments.postId),
        ),
      );
    const valid = new Set(owned.map((f) => f.id));
    attachmentIds = input.attachments.filter((id) => valid.has(id));
    if (attachmentIds.length !== input.attachments.length) return fail("One of the attachments could not be used. Please upload it again.");
  }

  const id = newId();
  await db.transaction(async (tx) => {
    await tx.insert(posts).values({
      id,
      authorId: user.id,
      companyId: input.companyId,
      communityId: input.communityId,
      type: input.type,
      category: input.category,
      title: input.title,
      body: input.body,
      excerpt: excerptOf(input.body, 220),
      linkUrl: input.linkUrl,
      // Community threads are always public: the community is the audience.
      visibility: input.communityId ? "public" : input.visibility,
      flaggedReason: flagReason(input.body, input.linkUrl),
    });
    if (attachmentIds.length > 0) {
      await tx.insert(postAttachments).values(attachmentIds.map((fileId, position) => ({ postId: id, fileId, position })));
    }
    if (input.communityId) {
      await tx.update(communities).set({ postCount: sql`${communities.postCount} + 1` }).where(eq(communities.id, input.communityId));
    }
  });

  await indexPost(id, user, `${input.title ?? ""}\n${input.body}`, { notifyMentions: true, href: `/posts/${id}` });

  if (input.companyId) {
    const [company] = await db.select({ name: companies.name }).from(companies).where(eq(companies.id, input.companyId)).limit(1);
    const followers = await db.select({ userId: companyFollows.userId }).from(companyFollows).where(eq(companyFollows.companyId, input.companyId)).limit(500);
    for (const follower of followers) {
      await notify({
        userId: follower.userId,
        actorId: user.id,
        type: "company_post",
        entityType: "post",
        entityId: id,
        data: { title: `${company?.name ?? "A company you follow"} posted an update`, preview: excerptOf(input.body, 140), href: `/posts/${id}` },
      });
    }
  }

  invalidate("feed:category-counts");
  revalidatePath("/feed");
  const session = await getSession();
  const post = await getPost(id, session ? { id: session.user.id, role: session.user.role } : null);
  return ok<FeedPost | null>("Posted.", post);
});

// ── Edit / delete ────────────────────────────────────────────────────────────

const updatePostSchema = z.object({ id: zId, body: zText(LIMITS.postBody), category: zInline(60) });

export const updatePostAction = formAction({ schema: updatePostSchema, rateLimit: "post" }, async (input, { user }) => {
  if (!(await isValidCategory(input.category))) return fail("Please choose a category.", { category: "Choose a category." });
  const [updated] = await db
    .update(posts)
    .set({
      body: input.body,
      category: input.category,
      excerpt: excerptOf(input.body, 220),
      flaggedReason: flagReason(input.body),
      editedAt: new Date(),
    })
    // Ownership is enforced in the WHERE clause: nobody can edit another member's post.
    .where(and(eq(posts.id, input.id), eq(posts.authorId, user.id), eq(posts.status, "published"), isNull(posts.slug)))
    .returning({ id: posts.id });
  if (!updated) return fail("That post could not be edited.");
  await indexPost(updated.id, user, input.body, { notifyMentions: false, href: `/posts/${updated.id}` });
  revalidatePath(`/posts/${updated.id}`);
  return ok<FeedPost | null>("Post updated.", await getPost(updated.id, { id: user.id, role: user.role }));
});

export const deletePostAction = callAction({ schema: z.object({ id: zId }) }, async ({ id }, { user }) => {
  const [post] = await db
    .select({ id: posts.id, authorId: posts.authorId, repostOfId: posts.repostOfId, communityId: posts.communityId, status: posts.status })
    .from(posts)
    .where(eq(posts.id, id))
    .limit(1);
  if (!post || post.status === "removed") return fail("That post no longer exists.");

  const isAuthor = post.authorId === user.id;
  if (!isAuthor && !can(user.role, "moderate:content")) return fail("You do not have permission to remove that post.");

  await db.transaction(async (tx) => {
    await tx.update(posts).set({ status: "removed" }).where(eq(posts.id, id));
    if (post.repostOfId) {
      await tx.update(posts).set({ repostCount: sql`greatest(${posts.repostCount} - 1, 0)` }).where(eq(posts.id, post.repostOfId));
    }
    if (post.communityId) {
      await tx.update(communities).set({ postCount: sql`greatest(${communities.postCount} - 1, 0)` }).where(eq(communities.id, post.communityId));
    }
  });
  if (!isAuthor) {
    await audit("moderation.post_removed", { actorId: user.id, targetType: "post", targetId: id });
    await notify({
      userId: post.authorId,
      type: "system",
      entityType: "post",
      entityId: id,
      data: { title: "One of your posts was removed by a moderator", preview: "It did not meet the community guidelines.", href: "/terms" },
    });
  }
  invalidate("feed:");
  revalidatePath("/feed");
  return ok("Post removed.");
});

// ── Reactions ────────────────────────────────────────────────────────────────

function visiblePost(id: string, user: SessionUser) {
  return getPost(id, { id: user.id, role: user.role });
}

export const toggleLikeAction = callAction({ schema: z.object({ id: zId }), rateLimit: "reaction" }, async ({ id }, { user }) => {
  const post = await visiblePost(id, user);
  if (!post) return fail("That post is not available.");

  const removed = await db.delete(postLikes).where(and(eq(postLikes.userId, user.id), eq(postLikes.postId, id))).returning({ postId: postLikes.postId });
  if (removed.length > 0) {
    await db.update(posts).set({ likeCount: sql`greatest(${posts.likeCount} - 1, 0)` }).where(eq(posts.id, id));
    return ok(undefined, { liked: false });
  }
  const inserted = await db.insert(postLikes).values({ userId: user.id, postId: id }).onConflictDoNothing().returning({ postId: postLikes.postId });
  if (inserted.length > 0) {
    await db.update(posts).set({ likeCount: sql`${posts.likeCount} + 1` }).where(eq(posts.id, id));
    await notify({
      userId: post.author.id,
      actorId: user.id,
      type: "like",
      entityType: "post",
      entityId: id,
      data: { preview: post.title ?? excerptOf(post.body, 100), href: post.slug ? `/articles/${post.slug}` : `/posts/${id}` },
    });
  }
  return ok(undefined, { liked: true });
});

export const toggleBookmarkAction = callAction({ schema: z.object({ id: zId }), rateLimit: "reaction" }, async ({ id }, { user }) => {
  if (!(await visiblePost(id, user))) return fail("That post is not available.");
  const removed = await db.delete(bookmarks).where(and(eq(bookmarks.userId, user.id), eq(bookmarks.postId, id))).returning({ postId: bookmarks.postId });
  if (removed.length > 0) return ok("Removed from bookmarks.", { bookmarked: false });
  await db.insert(bookmarks).values({ userId: user.id, postId: id }).onConflictDoNothing();
  return ok("Saved to bookmarks.", { bookmarked: true });
});

const repostSchema = z.object({ id: zId, body: z.preprocess((v) => (typeof v === "string" && v.trim() ? v : undefined), zText(1000).optional()) });

/** Reposts (optionally with commentary). Calling it again on a plain repost undoes it. */
export const repostAction = callAction({ schema: repostSchema, rateLimit: "post" }, async ({ id, body }, { user }) => {
  const original = await visiblePost(id, user);
  if (!original) return fail("That post is not available.");
  // Reposting a repost shares the original, so attribution never gets buried.
  const targetId = original.isRepost && original.repostOf ? original.repostOf.id : original.id;
  const target = targetId === original.id ? original : original.repostOf!;
  if (target.visibility !== "public") return fail("Posts shared with connections only cannot be reposted.");

  const [existing] = await db
    .select({ id: posts.id, body: posts.body })
    .from(posts)
    .where(and(eq(posts.authorId, user.id), eq(posts.repostOfId, targetId), eq(posts.status, "published")))
    .limit(1);

  if (existing && !body) {
    await db.transaction(async (tx) => {
      await tx.update(posts).set({ status: "removed" }).where(eq(posts.id, existing.id));
      await tx.update(posts).set({ repostCount: sql`greatest(${posts.repostCount} - 1, 0)` }).where(eq(posts.id, targetId));
    });
    revalidatePath("/feed");
    return ok("Repost removed.", { reposted: false });
  }
  if (existing) return fail("You have already reposted this.");

  const newPostId = newId();
  await db.transaction(async (tx) => {
    await tx.insert(posts).values({
      id: newPostId,
      authorId: user.id,
      repostOfId: targetId,
      type: "post",
      category: target.category,
      body: body ?? "",
      excerpt: body ? excerptOf(body, 220) : null,
    });
    await tx.update(posts).set({ repostCount: sql`${posts.repostCount} + 1` }).where(eq(posts.id, targetId));
  });
  if (body) await indexPost(newPostId, user, body, { notifyMentions: true, href: `/posts/${newPostId}` });
  await notify({
    userId: target.author.id,
    actorId: user.id,
    type: "repost",
    entityType: "post",
    entityId: targetId,
    data: { preview: target.title ?? excerptOf(target.body, 100), href: `/posts/${newPostId}` },
  });
  revalidatePath("/feed");
  return ok("Reposted.", { reposted: true });
});

// ── Comments ─────────────────────────────────────────────────────────────────

const commentSchema = z.object({ postId: zId, parentId: zOptionalId, body: zText(LIMITS.commentBody) });

export const addCommentAction = formAction({ schema: commentSchema, rateLimit: "comment" }, async (input, { user }) => {
  const post = await visiblePost(input.postId, user);
  if (!post) return fail("That post is not available.");

  let parent: { id: string; authorId: string; parentId: string | null } | undefined;
  if (input.parentId) {
    [parent] = await db
      .select({ id: comments.id, authorId: comments.authorId, parentId: comments.parentId })
      .from(comments)
      .where(and(eq(comments.id, input.parentId), eq(comments.postId, input.postId), eq(comments.status, "published")))
      .limit(1);
    if (!parent) return fail("The comment you are replying to is no longer available.");
  }
  // Replies are one level deep: replying to a reply attaches to the same thread.
  const parentId = parent ? (parent.parentId ?? parent.id) : null;

  const id = newId();
  await db.transaction(async (tx) => {
    await tx.insert(comments).values({ id, postId: input.postId, authorId: user.id, parentId, body: input.body });
    await tx.update(posts).set({ commentCount: sql`${posts.commentCount} + 1` }).where(eq(posts.id, input.postId));
  });

  const href = `${post.slug ? `/articles/${post.slug}` : `/posts/${post.id}`}#comment-${id}`;
  const preview = excerptOf(input.body, 140);
  if (parent && parent.authorId !== post.author.id) {
    await notify({ userId: parent.authorId, actorId: user.id, type: "reply", entityType: "comment", entityId: id, data: { preview, href } });
  }
  await notify({
    userId: post.author.id,
    actorId: user.id,
    type: parent && parent.authorId === post.author.id ? "reply" : "comment",
    entityType: "comment",
    entityId: id,
    data: { preview, href },
  });
  for (const handle of extractMentions(input.body)) {
    const [mentioned] = await db.select({ id: users.id }).from(users).where(and(eq(users.username, handle), eq(users.status, "active"))).limit(1);
    if (mentioned && mentioned.id !== post.author.id && mentioned.id !== parent?.authorId) {
      await notify({ userId: mentioned.id, actorId: user.id, type: "mention", entityType: "comment", entityId: id, data: { title: `${user.name} mentioned you in a comment`, preview, href } });
    }
  }

  const [profile] = await db.select({ headline: profiles.headline, avatarFileId: profiles.avatarFileId }).from(profiles).where(eq(profiles.userId, user.id)).limit(1);
  const comment: CommentItem = {
    id,
    body: input.body,
    createdAt: new Date(),
    editedAt: null,
    likeCount: 0,
    parentId,
    author: { id: user.id, username: user.username, name: user.name, headline: profile?.headline ?? null, avatarFileId: profile?.avatarFileId ?? null },
    viewer: { liked: false, canDelete: true },
    replies: [],
  };
  return ok<CommentItem>(undefined, comment);
});

export const deleteCommentAction = callAction({ schema: z.object({ id: zId }) }, async ({ id }, { user }) => {
  const [comment] = await db
    .select({ id: comments.id, authorId: comments.authorId, postId: comments.postId, parentId: comments.parentId })
    .from(comments)
    .where(and(eq(comments.id, id), eq(comments.status, "published")))
    .limit(1);
  if (!comment) return fail("That comment no longer exists.");
  const isAuthor = comment.authorId === user.id;
  if (!isAuthor && !can(user.role, "moderate:content")) return fail("You do not have permission to remove that comment.");

  const removed = await db
    .update(comments)
    .set({ status: "removed" })
    .where(and(eq(comments.status, "published"), comment.parentId ? eq(comments.id, id) : sql`(${comments.id} = ${id} or ${comments.parentId} = ${id})`))
    .returning({ id: comments.id });
  await db.update(posts).set({ commentCount: sql`greatest(${posts.commentCount} - ${removed.length}, 0)` }).where(eq(posts.id, comment.postId));
  if (!isAuthor) await audit("moderation.comment_removed", { actorId: user.id, targetType: "comment", targetId: id });
  return ok("Comment removed.");
});

export const toggleCommentLikeAction = callAction({ schema: z.object({ id: zId }), rateLimit: "reaction" }, async ({ id }, { user }) => {
  const [comment] = await db.select({ id: comments.id, postId: comments.postId }).from(comments).where(and(eq(comments.id, id), eq(comments.status, "published"))).limit(1);
  if (!comment || !(await visiblePost(comment.postId, user))) return fail("That comment is not available.");
  const removed = await db.delete(commentLikes).where(and(eq(commentLikes.userId, user.id), eq(commentLikes.commentId, id))).returning({ id: commentLikes.commentId });
  if (removed.length > 0) {
    await db.update(comments).set({ likeCount: sql`greatest(${comments.likeCount} - 1, 0)` }).where(eq(comments.id, id));
    return ok(undefined, { liked: false });
  }
  const inserted = await db.insert(commentLikes).values({ userId: user.id, commentId: id }).onConflictDoNothing().returning({ id: commentLikes.commentId });
  if (inserted.length > 0) await db.update(comments).set({ likeCount: sql`${comments.likeCount} + 1` }).where(eq(comments.id, id));
  return ok(undefined, { liked: true });
});

// ── Read helpers for client-driven lists ─────────────────────────────────────

const feedRequestSchema = z.object({
  mode: zOneOf(["for-you", "latest", "following", "trending"] as const).default("latest"),
  category: z.string().max(60).optional(),
  type: zOneOf(POST_TYPE_VALUES).optional(),
  longForm: z.boolean().optional(),
  authorId: zOptionalId,
  companyId: zOptionalId,
  communityId: zOptionalId,
  hashtag: z.string().max(50).optional(),
  bookmarks: z.boolean().optional(),
  q: z.string().max(100).optional(),
  cursor: z.string().max(80).nullish(),
});
export type FeedRequest = z.input<typeof feedRequestSchema>;

/** Next page of any feed. Public: visibility rules are applied for whoever is asking. */
export async function loadFeedAction(request: FeedRequest): Promise<FeedPage> {
  const parsed = feedRequestSchema.safeParse(request);
  if (!parsed.success) return { posts: [], nextCursor: null };
  const session = await getSession();
  const viewer = session ? { id: session.user.id, role: session.user.role } : null;
  const { bookmarks: onlyBookmarks, mode, ...rest } = parsed.data;
  if (onlyBookmarks && !viewer) return { posts: [], nextCursor: null };

  let interests: string[] | undefined;
  if (mode === "for-you" && viewer) {
    const [profile] = await db.select({ domains: profiles.domains }).from(profiles).where(eq(profiles.userId, viewer.id)).limit(1);
    interests = profile?.domains;
  }
  return getFeed({
    ...rest,
    mode: (mode === "following" || mode === "for-you") && !viewer ? "trending" : (mode as FeedMode),
    viewer,
    interests,
    bookmarkedBy: onlyBookmarks ? viewer!.id : undefined,
  });
}

export async function loadCommentsAction(postId: string): Promise<CommentItem[]> {
  if (!zId.safeParse(postId).success) return [];
  const session = await getSession();
  const viewer = session ? { id: session.user.id, role: session.user.role } : null;
  if (!(await getPost(postId, viewer))) return [];
  return getComments(postId, viewer);
}

// ── Articles ─────────────────────────────────────────────────────────────────

const articleSchema = z.object({
  id: zOptionalId,
  title: zInline(160, 8),
  body: zText(LIMITS.articleBody, 200),
  category: zInline(60),
  type: zOneOf(["article", "ctf_writeup", "research", "disclosure"] as const).default("article"),
  coverFileId: zOptionalId,
});

export const saveArticleAction = formAction({ schema: articleSchema, rateLimit: "post" }, async (input, { user }) => {
  if (!(await isValidCategory(input.category))) return fail("Please choose a category.", { category: "Choose a category." });

  if (input.coverFileId) {
    const [cover] = await db.select({ id: files.id }).from(files).where(and(eq(files.id, input.coverFileId), eq(files.ownerId, user.id), eq(files.kind, "cover"))).limit(1);
    if (!cover) return fail("The cover image could not be used. Please upload it again.");
  }
  const values = {
    title: input.title,
    body: input.body,
    category: input.category,
    type: input.type,
    excerpt: excerptOf(input.body, 260),
    coverFileId: input.coverFileId ?? null,
    flaggedReason: flagReason(input.body),
  };

  if (input.id) {
    const [updated] = await db
      .update(posts)
      .set({ ...values, editedAt: new Date() })
      .where(and(eq(posts.id, input.id), eq(posts.authorId, user.id), eq(posts.status, "published"), sql`${posts.slug} is not null`))
      .returning({ id: posts.id, slug: posts.slug });
    if (!updated) return fail("That article could not be edited.");
    await indexPost(updated.id, user, `${input.title}\n${input.body}`, { notifyMentions: false, href: `/articles/${updated.slug}` });
    revalidatePath(`/articles/${updated.slug}`);
    return ok("Article updated.", { slug: updated.slug! });
  }

  const id = newId();
  const slug = `${slugify(input.title, 80) || "article"}-${shortId(6)}`;
  await db.insert(posts).values({ id, authorId: user.id, slug, ...values });
  await indexPost(id, user, `${input.title}\n${input.body}`, { notifyMentions: true, href: `/articles/${slug}` });
  invalidate("feed:category-counts");
  revalidatePath("/articles");
  return ok("Article published.", { slug });
});
