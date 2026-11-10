import type { JsonLdObject } from "@/lib/seo";

/**
 * Embeds Schema.org structured data. `<` is escaped so member-supplied strings can never
 * terminate the script element.
 */
export function JsonLd({ data }: { data: JsonLdObject | JsonLdObject[] }) {
  const json = JSON.stringify(data).replace(/</g, "\\u003c");
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: json }} />;
}
