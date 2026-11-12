"use client";

import { useState } from "react";
import { Button, type ButtonProps } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { ActionForm, FormError, SubmitButton } from "@/components/ui/form";
import type { ActionState } from "@/server/action-utils";

/**
 * A button that opens a dialog containing a server-action form. The fields are passed as
 * children, so pages stay server components and only this small shell runs on the client.
 * On success the dialog closes and the page's data is refreshed.
 */
export function EntryDialog<T = unknown>({
  trigger,
  title,
  description,
  action,
  submitLabel = "Save",
  submitVariant,
  size = "md",
  children,
  ...button
}: {
  trigger: React.ReactNode;
  title: string;
  description?: string;
  action: (prev: ActionState<T>, formData: FormData) => Promise<ActionState<T>>;
  submitLabel?: string;
  submitVariant?: ButtonProps["variant"];
  size?: "sm" | "md" | "lg";
  children: React.ReactNode;
} & Pick<ButtonProps, "variant" | "className" | "aria-label"> & { buttonSize?: ButtonProps["size"] }) {
  const [open, setOpen] = useState(false);
  const { buttonSize, ...buttonProps } = button;
  return (
    <>
      <Button size={buttonSize ?? "sm"} variant={buttonProps.variant ?? "outline"} {...buttonProps} onClick={() => setOpen(true)}>
        {trigger}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent title={title} description={description} size={size}>
          {open ? (
            <ActionForm<T> action={action} refresh onSuccess={() => setOpen(false)} className="space-y-4">
              <FormError />
              {children}
              <div className="flex justify-end gap-2 border-t pt-4">
                <Button variant="ghost" onClick={() => setOpen(false)}>
                  Cancel
                </Button>
                <SubmitButton variant={submitVariant}>{submitLabel}</SubmitButton>
              </div>
            </ActionForm>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}
