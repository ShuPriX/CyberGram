import Link from "next/link";
import { Fragment } from "react";
import { leavingHref } from "@/lib/security/link-safety";
import { tokenize } from "@/lib/text";
import { cn, displayHost } from "@/lib/utils";

/** Attributes for every link that leads off-platform from member content. */
export const EXTERNAL_LINK_PROPS = { target: "_blank", rel: "nofollow ugc noopener noreferrer" } as const;

function shortUrl(url: string): string {
  const host = displayHost(url) ?? url;
  try {
    const { pathname, search } = new URL(url);
    const rest = `${pathname === "/" ? "" : pathname}${search}`;
    return rest.length > 28 ? `${host}${rest.slice(0, 26)}…` : `${host}${rest}`;
  } catch {
    return host;
  }
}

/**
 * Renders short-form member text (posts, comments, messages).
 *
 * The text is tokenised and emitted as React nodes, so nothing a member types is ever
 * interpreted as HTML. External links are routed through the /leaving interstitial.
 * `mentions` maps lower-cased handles to their profile path; unresolved handles stay plain text.
 */
export function RichText({ text, mentions, className }: { text: string; mentions?: Record<string, string>; className?: string }) {
  const tokens = tokenize(text);
  return (
    <div className={cn("whitespace-pre-wrap break-words [overflow-wrap:anywhere]", className)}>
      {tokens.map((token, index) => {
        switch (token.kind) {
          case "text":
            return <Fragment key={index}>{token.value}</Fragment>;
          case "url":
            return (
              <a key={index} href={leavingHref(token.value)} className="text-primary hover:underline" title={token.value} {...EXTERNAL_LINK_PROPS}>
                {shortUrl(token.value)}
              </a>
            );
          case "hashtag":
            return (
              <Link key={index} href={`/explore/tag/${token.value.toLowerCase()}`} className="font-medium text-primary hover:underline">
                #{token.value}
              </Link>
            );
          case "mention": {
            const href = mentions?.[token.value.toLowerCase()];
            return href ? (
              <Link key={index} href={href} className="font-medium text-primary hover:underline">
                @{token.value}
              </Link>
            ) : (
              <Fragment key={index}>@{token.value}</Fragment>
            );
          }
          case "code":
            return (
              <code key={index} className="rounded border bg-muted px-1 py-0.5 font-mono text-[0.86em]">
                {token.value}
              </code>
            );
          case "codeblock":
            return (
              <pre
                key={index}
                className="scrollbar-thin my-2 overflow-x-auto whitespace-pre rounded-lg border bg-muted p-3 font-mono text-[12.5px] leading-relaxed"
              >
                <code>{token.value}</code>
              </pre>
            );
        }
      })}
    </div>
  );
}
