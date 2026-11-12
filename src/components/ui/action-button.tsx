"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import type { ActionState } from "@/server/action-utils";
import { Button, type ButtonProps } from "./button";
import { Spinner } from "./misc";
import { toast } from "./toast";

type ActionButtonProps<I> = Omit<ButtonProps, "onClick" | "asChild"> & {
  /** A server action created with `callAction`. */
  action: (input: I) => Promise<ActionState<unknown>>;
  input: I;
  /** Ask before running (destructive or hard-to-undo actions). */
  confirm?: string;
  /** Navigate here after success instead of refreshing the current page. */
  redirectTo?: string;
};

/**
 * A button that runs a server action and then re-renders the page's server components, so the
 * surrounding list or state reflects the result without any client-side bookkeeping.
 */
export function ActionButton<I>({ action, input, confirm, redirectTo, children, disabled, ...props }: ActionButtonProps<I>) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function run() {
    if (confirm && !window.confirm(confirm)) return;
    startTransition(async () => {
      const result = await action(input);
      if (!result) return;
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      if (result.message) toast.success(result.message);
      if (redirectTo) router.push(redirectTo);
      else router.refresh();
    });
  }

  return (
    <Button onClick={run} disabled={pending || disabled} aria-busy={pending || undefined} {...props}>
      {pending ? <Spinner /> : null}
      {children}
    </Button>
  );
}
