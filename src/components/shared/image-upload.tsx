"use client";

import { FileText, ImagePlus, Trash2, Upload } from "lucide-react";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/misc";
import { toast } from "@/components/ui/toast";
import { uploadFile, type UploadKind } from "@/lib/upload-client";
import { cn, formatBytes } from "@/lib/utils";

/**
 * Uploads an image as soon as it is chosen and carries the resulting file id in a hidden
 * field. Clearing it submits an empty value, which removes the image on save.
 */
export function ImageUpload({
  name,
  kind,
  label,
  initialFileId,
  shape = "square",
  hint,
}: {
  name: string;
  kind: Extract<UploadKind, "avatar" | "cover" | "logo">;
  label: string;
  initialFileId?: string | null;
  shape?: "circle" | "square" | "wide";
  hint?: string;
}) {
  const [fileId, setFileId] = useState(initialFileId ?? "");
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  async function pick(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    try {
      setFileId((await uploadFile(file, kind)).id);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "The upload failed.");
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[13px] font-medium">{label}</span>
      <div className={cn("flex gap-3", shape === "wide" ? "flex-col" : "items-center")}>
        <div
          className={cn(
            "flex shrink-0 items-center justify-center overflow-hidden border bg-muted text-muted-foreground",
            shape === "circle" && "size-20 rounded-full",
            shape === "square" && "size-20 rounded-lg",
            shape === "wide" && "aspect-[4/1] w-full rounded-lg",
          )}
        >
          {busy ? <Spinner /> : fileId ? <img src={`/api/files/${fileId}`} alt="" className="size-full object-cover" /> : <ImagePlus className="size-5" aria-hidden="true" />}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input type="hidden" name={name} value={fileId} />
          <input ref={input} type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" tabIndex={-1} aria-label={label} onChange={(e) => pick(e.target.files?.[0])} />
          <Button variant="outline" size="sm" disabled={busy} onClick={() => input.current?.click()}>
            <Upload /> {fileId ? "Replace" : "Upload"}
          </Button>
          {fileId ? (
            <Button variant="ghost" size="sm" disabled={busy} onClick={() => setFileId("")}>
              <Trash2 /> Remove
            </Button>
          ) : null}
          {hint ? <span className="basis-full text-xs text-muted-foreground">{hint}</span> : null}
        </div>
      </div>
    </div>
  );
}

/** Document picker for résumés: uploads immediately and submits the stored file id. */
export function DocumentUpload({ name, kind = "resume", accept = ".pdf,.docx" }: { name: string; kind?: UploadKind; accept?: string }) {
  const [file, setFile] = useState<{ id: string; name: string; size: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  async function pick(picked: File | undefined) {
    if (!picked) return;
    setBusy(true);
    try {
      const uploaded = await uploadFile(picked, kind);
      setFile({ id: uploaded.id, name: uploaded.name, size: uploaded.size });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "The upload failed.");
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border border-dashed p-3">
      <input type="hidden" name={name} value={file?.id ?? ""} />
      <input ref={input} type="file" accept={accept} className="sr-only" tabIndex={-1} aria-label="Choose a file" onChange={(e) => pick(e.target.files?.[0])} />
      <Button variant="outline" size="sm" disabled={busy} onClick={() => input.current?.click()}>
        {busy ? <Spinner /> : <Upload />} {file ? "Choose another" : "Choose file"}
      </Button>
      {file ? (
        <span className="inline-flex min-w-0 items-center gap-1.5 text-[13px]">
          <FileText className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          <span className="truncate">{file.name}</span>
          <span className="shrink-0 text-xs text-subtle">{formatBytes(file.size)}</span>
        </span>
      ) : (
        <span className="text-xs text-muted-foreground">PDF or DOCX, up to 5 MB. Files are scanned before they are stored.</span>
      )}
    </div>
  );
}
