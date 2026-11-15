"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

const DEFAULT_INTERVAL_MS = 30 * 60 * 1000;

/** True while the member is in the middle of writing something a refresh would throw away. */
function isComposing(): boolean {
  const active = document.activeElement;
  if (active instanceof HTMLTextAreaElement || (active instanceof HTMLInputElement && active.type !== "search")) return true;
  return [...document.querySelectorAll<HTMLTextAreaElement>("textarea")].some((field) => field.value.trim().length > 0);
}

/**
 * Keeps a feed current without the member doing anything. The page is always fresh when it is
 * opened (it is rendered per request); after that it is re-fetched every 30 minutes, and
 * straight away when someone comes back to a tab that has been in the background for longer
 * than that. A refresh is postponed while a post, comment or message is being written.
 */
export function FeedRefresher({ intervalMs = DEFAULT_INTERVAL_MS }: { intervalMs?: number }) {
  const router = useRouter();
  const lastRefresh = useRef(0);

  useEffect(() => {
    lastRefresh.current = Date.now();
    const refresh = () => {
      if (document.visibilityState !== "visible" || isComposing()) return;
      lastRefresh.current = Date.now();
      router.refresh();
    };
    const timer = setInterval(() => {
      if (Date.now() - lastRefresh.current >= intervalMs) refresh();
    }, 60_000);
    const onVisible = () => {
      if (document.visibilityState === "visible" && Date.now() - lastRefresh.current >= intervalMs) refresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [router, intervalMs]);

  return null;
}
