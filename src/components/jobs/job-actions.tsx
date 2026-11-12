"use client";

import { Bookmark, Send } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button, type ButtonProps } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { ActionForm, FormError, SelectField, SubmitButton, TextareaField } from "@/components/ui/form";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import { applyToJobAction, toggleSaveJobAction } from "@/server/actions/jobs";

export function SaveJobButton({ jobId, saved: initial, signedIn, withLabel = false, ...props }: { jobId: string; saved: boolean; signedIn: boolean; withLabel?: boolean } & Pick<ButtonProps, "variant" | "size" | "className">) {
  const [saved, setSaved] = useState(initial);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function toggle() {
    if (!signedIn) return router.push("/login?next=/jobs");
    const next = !saved;
    setSaved(next);
    startTransition(async () => {
      const result = await toggleSaveJobAction({ jobId });
      if (!result?.ok) {
        setSaved(!next);
        toast.error(result?.error ?? "Could not update saved jobs.");
      }
    });
  }

  return (
    <Button
      variant={props.variant ?? "ghost"}
      size={props.size ?? (withLabel ? "default" : "icon-sm")}
      className={cn(saved && "text-primary", props.className)}
      onClick={toggle}
      disabled={pending}
      aria-pressed={saved}
      aria-label={withLabel ? undefined : saved ? "Remove from saved jobs" : "Save job"}
      title={saved ? "Saved" : "Save job"}
    >
      <Bookmark className={cn(saved && "fill-current")} />
      {withLabel ? (saved ? "Saved" : "Save") : null}
    </Button>
  );
}

/** Apply on the platform: choose a résumé, add an optional note, submit once. */
export function ApplyDialog({ jobId, jobTitle, companyName, resumes }: { jobId: string; jobTitle: string; companyName: string; resumes: { id: string; label: string; isDefault: boolean }[] }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const defaultResume = resumes.find((r) => r.isDefault) ?? resumes[0];
  return (
    <>
      <Button size="lg" className="w-full" onClick={() => setOpen(true)}>
        <Send /> Apply now
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent title={`Apply: ${jobTitle}`} description={`Your application goes to the hiring team at ${companyName}. They see your profile, the résumé you choose and your note.`}>
          <ActionForm
            action={applyToJobAction}
            onSuccess={() => {
              setOpen(false);
              router.refresh();
            }}
            className="space-y-4"
          >
            <FormError />
            <input type="hidden" name="jobId" value={jobId} />
            {resumes.length > 0 ? (
              <SelectField
                label="Résumé"
                name="resumeId"
                options={resumes.map((r) => ({ value: r.id, label: r.label }))}
                defaultValue={defaultResume?.id}
                placeholder="Apply without a résumé"
                hint="Only this employer's hiring team can open the file you attach."
              />
            ) : (
              <p className="rounded-lg border border-dashed px-3 py-2.5 text-[13px] text-muted-foreground">
                You have no résumé saved.{" "}
                <Link href="/jobs/resumes" className="font-medium text-primary hover:underline">
                  Upload one
                </Link>{" "}
                first, or apply with your profile only.
              </p>
            )}
            <TextareaField label="Note to the hiring team" name="coverNote" optional rows={6} maxLength={3000} placeholder="Why this role, and the most relevant work you have done." />
            <div className="flex justify-end">
              <SubmitButton>Submit application</SubmitButton>
            </div>
          </ActionForm>
        </DialogContent>
      </Dialog>
    </>
  );
}
