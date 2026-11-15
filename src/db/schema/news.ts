import { index, pgTable, text, uniqueIndex } from "drizzle-orm/pg-core";
import { createdAt, pk, tstz } from "./_shared";

export type NewsSourceKind = "official" | "research" | "press";

/**
 * Headlines collected from a fixed list of established security sources (see
 * `lib/news/sources`). Only the headline, a short excerpt and the link are kept: the article
 * itself always lives, and is read, at its publisher.
 */
export const newsItems = pgTable(
  "news_items",
  {
    id: pk(),
    /** Key of the source in `NEWS_SOURCES`. */
    source: text("source").notNull(),
    sourceName: text("source_name").notNull(),
    sourceKind: text("source_kind").$type<NewsSourceKind>().notNull(),
    title: text("title").notNull(),
    /** Canonical article URL at the publisher. Always on one of the source's own hosts. */
    url: text("url").notNull(),
    excerpt: text("excerpt"),
    publishedAt: tstz("published_at").notNull(),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("news_items_url_uq").on(t.url), index("news_items_published_idx").on(t.publishedAt), index("news_items_source_idx").on(t.source, t.publishedAt)],
);
