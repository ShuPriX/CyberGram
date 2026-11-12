"use client";

import { Switch as Primitive } from "radix-ui";
import type * as React from "react";
import { cn } from "@/lib/utils";

/** Submits "on" under `name` when checked, like a native checkbox. */
export function Switch({ className, ...props }: React.ComponentProps<typeof Primitive.Root>) {
  return (
    <Primitive.Root
      className={cn(
        "peer inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-sm border border-transparent bg-border-strong transition-colors data-[state=checked]:bg-primary disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    >
      <Primitive.Thumb className="pointer-events-none block size-4 translate-x-0.5 rounded-sm bg-white shadow-sm transition-transform data-[state=checked]:translate-x-[18px] dark:data-[state=checked]:bg-primary-foreground" />
    </Primitive.Root>
  );
}
