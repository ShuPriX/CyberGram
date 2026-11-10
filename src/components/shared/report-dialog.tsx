"use client";

import { Dialog, DialogContent } from "@/components/ui/dialog";
import { ActionForm, FormError, SelectField, SubmitButton, TextareaField } from "@/components/ui/form";
import { REPORT_REASONS, type ReportTargetType } from "@/lib/constants";
import { reportAction } from "@/server/actions/reports";

const NOUNS: Record<ReportTargetType, string> = {
  post: "post",
  comment: "comment",
  user: "member",
  job: "job listing",
  company: "company",
  message: "message",
};

/** Controlled report dialog shared by posts, comments, profiles, jobs and companies. */
export function ReportDialog({
  open,
  onOpenChange,
  targetType,
  targetId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  targetType: ReportTargetType;
  targetId: string;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title={`Report this ${NOUNS[targetType]}`}
        description="Reports are confidential. The person you report is not told who reported them."
      >
        <ActionForm action={reportAction} onSuccess={() => onOpenChange(false)} className="space-y-4">
          <FormError />
          <input type="hidden" name="targetType" value={targetType} />
          <input type="hidden" name="targetId" value={targetId} />
          <SelectField label="What is wrong?" name="reason" options={REPORT_REASONS} required defaultValue={targetType === "job" ? "scam" : "spam"} />
          <TextareaField label="Details" name="details" optional rows={3} maxLength={1000} placeholder="Anything that will help a moderator understand the problem" />
          <div className="flex justify-end">
            <SubmitButton variant="destructive">Submit report</SubmitButton>
          </div>
        </ActionForm>
      </DialogContent>
    </Dialog>
  );
}
