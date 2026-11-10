"use client";

import { CircleAlert, CircleCheck, Info, X } from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

type ToastKind = "success" | "error" | "info";
type ToastItem = { id: number; kind: ToastKind; message: string };

const listeners = new Set<(item: ToastItem) => void>();
let nextId = 1;

function emit(kind: ToastKind, message: string) {
  const item = { id: nextId++, kind, message };
  for (const listener of listeners) listener(item);
}

/** Lightweight, dependency-free notifications. Call from any client component. */
export const toast = {
  success: (message: string) => emit("success", message),
  error: (message: string) => emit("error", message),
  info: (message: string) => emit("info", message),
};

const ICONS = { success: CircleCheck, error: CircleAlert, info: Info } as const;
const TONES = { success: "text-success", error: "text-destructive", info: "text-info" } as const;

export function Toaster() {
  const [items, setItems] = useState<ToastItem[]>([]);

  useEffect(() => {
    const timers = new Set<ReturnType<typeof setTimeout>>();
    const onToast = (item: ToastItem) => {
      setItems((current) => [...current.slice(-2), item]);
      const timer = setTimeout(
        () => {
          setItems((current) => current.filter((t) => t.id !== item.id));
          timers.delete(timer);
        },
        item.kind === "error" ? 7000 : 4500,
      );
      timers.add(timer);
    };
    listeners.add(onToast);
    return () => {
      listeners.delete(onToast);
      for (const timer of timers) clearTimeout(timer);
    };
  }, []);

  return (
    <div
      aria-live="polite"
      aria-atomic="false"
      className="pointer-events-none fixed inset-x-0 bottom-20 z-[70] flex flex-col items-center gap-2 px-4 sm:bottom-6 sm:items-end sm:px-6"
    >
      {items.map((item) => {
        const Icon = ICONS[item.kind];
        return (
          <div
            key={item.id}
            role={item.kind === "error" ? "alert" : "status"}
            className="pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-lg border bg-popover px-4 py-3 text-[13px] text-popover-foreground shadow-pop animate-slide-up"
          >
            <Icon className={cn("mt-0.5 size-4 shrink-0", TONES[item.kind])} aria-hidden="true" />
            <p className="min-w-0 flex-1 leading-snug">{item.message}</p>
            <button
              type="button"
              onClick={() => setItems((current) => current.filter((t) => t.id !== item.id))}
              className="-mr-1 rounded p-0.5 text-muted-foreground hover:text-foreground"
              aria-label="Dismiss"
            >
              <X className="size-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
