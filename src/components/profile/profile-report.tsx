"use client";

import { Flag } from "lucide-react";
import { useState } from "react";
import { ReportDialog } from "@/components/shared/report-dialog";
import { Button } from "@/components/ui/button";
import type { ReportTargetType } from "@/lib/constants";

/** Icon button that opens the report dialog for a member, job or organisation. */
export function ReportButton({ targetType, targetId, label = "Report" }: { targetType: ReportTargetType; targetId: string; label?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="ghost" size="icon-sm" onClick={() => setOpen(true)} aria-label={label} title={label} className="text-muted-foreground">
        <Flag />
      </Button>
      <ReportDialog open={open} onOpenChange={setOpen} targetType={targetType} targetId={targetId} />
    </>
  );
}

export function ProfileReport({ userId }: { userId: string }) {
  return <ReportButton targetType="user" targetId={userId} label="Report this member" />;
}
