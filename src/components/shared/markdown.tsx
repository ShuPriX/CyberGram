import Link from "next/link";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { leavingHref, parseHttpUrl } from "@/lib/security/link-safety";
import { cn } from "@/lib/utils";
import { EXTERNAL_LINK_PROPS } from "./rich-text";

/**
 * Renders long-form Markdown (articles, job descriptions, company pages).
 *
 * Raw HTML in the source is dropped, URLs are restricted to safe protocols, external links go
 * through the /leaving interstitial, and only images uploaded to this platform are embedded —
 * remote images would leak readers' IP addresses to third parties and are blocked by our CSP.
 */
export function Markdown({ children, className }: { children: string; className?: string }) {
  return (
    <div className={cn("prose", className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        skipHtml
        components={{
          a({ href, children: content }) {
            if (!href) return <>{content}</>;
            if (href.startsWith("/") && !href.startsWith("//")) return <Link href={href}>{content}</Link>;
            if (href.startsWith("#")) return <a href={href}>{content}</a>;
            if (href.startsWith("mailto:")) return <a href={href}>{content}</a>;
            if (!parseHttpUrl(href)) return <>{content}</>;
            return (
              <a href={leavingHref(href)} {...EXTERNAL_LINK_PROPS}>
                {content}
              </a>
            );
          },
          img({ src, alt }) {
            if (typeof src === "string" && /^\/api\/files\/[a-z0-9]+$/.test(src)) {
              return <img src={src} alt={alt ?? ""} loading="lazy" decoding="async" />;
            }
            return alt ? <em>[image: {alt}]</em> : null;
          },
          // Headings inside member content start at h2 so the page keeps a single h1.
          h1: ({ children: content }) => <h2>{content}</h2>,
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
