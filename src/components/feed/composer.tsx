"use client";

import { FileText, ImagePlus, Link2, Paperclip, X } from "lucide-react";
import Link from "next/link";
import { useRef, useState } from "react";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { ActionForm, FieldError, FormError, SubmitButton } from "@/components/ui/form";
import { Input, Select, Textarea } from "@/components/ui/input";
import { Spinner } from "@/components/ui/misc";
import { toast } from "@/components/ui/toast";
import { LIMITS, POST_TYPES } from "@/lib/constants";
import { postUploadKind, uploadFile, type UploadedFile } from "@/lib/upload-client";
import { cn, formatBytes } from "@/lib/utils";
import { createPostAction } from "@/server/actions/posts";
import type { FeedPost } from "@/server/queries/posts";

const ACCEPT = "image/png,image/jpeg,image/webp,image/gif,video/mp4,video/webm,application/pdf,.docx,.pptx,.xlsx,.txt";
const COMPOSER_TYPES = POST_TYPES.filter((t) => t.value !== "article");

type ComposerProps = {
  viewer: { name: string; avatarFileId: string | null };
  categories: { slug: string; name: string }[];
  defaultCategory?: string;
  /** Post into a community (always public, shows a title field). */
  community?: { id: string; name: string };
  /** Organisations the member may post on behalf of. */
  companies?: { id: string; name: string }[];
  fixedCompanyId?: string;
  onPosted?: (post: FeedPost) => void;
  placeholder?: string;
};

export function Composer({ viewer, categories, defaultCategory, community, companies = [], fixedCompanyId, onPosted, placeholder }: ComposerProps) {
  const [open, setOpen] = useState(false);
  const [body, setBody] = useState("");
  const [attachments, setAttachments] = useState<UploadedFile[]>([]);
  const [uploading, setUploading] = useState(0);
  const [showLink, setShowLink] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  async function addFiles(list: FileList | null) {
    if (!list) return;
    const room = LIMITS.attachmentsPerPost - attachments.length;
    const picked = [...list].slice(0, room);
    if (list.length > room) toast.info(`You can attach up to ${LIMITS.attachmentsPerPost} files.`);
    setUploading((n) => n + picked.length);
    await Promise.all(
      picked.map(async (file) => {
        try {
          const uploaded = await uploadFile(file, postUploadKind(file));
          setAttachments((current) => [...current, uploaded]);
        } catch (err) {
          toast.error(`${file.name}: ${err instanceof Error ? err.message : "upload failed"}`);
        } finally {
          setUploading((n) => n - 1);
        }
      }),
    );
    if (fileInput.current) fileInput.current.value = "";
  }

  function reset() {
    setBody("");
    setAttachments([]);
    setShowLink(false);
    setOpen(false);
  }

  if (!open) {
    return (
      <div className="flex items-center gap-3 rounded-xl border bg-card p-3 sm:p-4">
        <Avatar name={viewer.name} fileId={viewer.avatarFileId} />
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="h-10 flex-1 rounded-sm border bg-background px-4 text-left text-[13px] text-muted-foreground transition-colors hover:border-border-strong hover:bg-accent"
        >
          {placeholder ?? "Share research, a write-up or a question…"}
        </button>
        {!community ? (
          <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
            <Link href="/articles/new">
              <FileText /> Write article
            </Link>
          </Button>
        ) : null}
      </div>
    );
  }

  return (
    <ActionForm<FeedPost | null>
      action={createPostAction}
      onSuccess={(post) => {
        reset();
        if (post) onPosted?.(post);
      }}
      className="rounded-xl border bg-card p-4 sm:p-5"
    >
      <div className="flex gap-3">
        <Avatar name={viewer.name} fileId={viewer.avatarFileId} className="hidden sm:inline-flex" />
        <div className="min-w-0 flex-1 space-y-3">
          <FormError />
          {community ? (
            <>
              <input type="hidden" name="communityId" value={community.id} />
              <Input name="title" placeholder="Discussion title (optional)" maxLength={160} aria-label="Discussion title" />
            </>
          ) : null}
          {fixedCompanyId ? <input type="hidden" name="companyId" value={fixedCompanyId} /> : null}
          <div>
            <Textarea
              name="body"
              value={body}
              onChange={(event) => setBody(event.target.value)}
              rows={5}
              required
              autoFocus
              maxLength={LIMITS.postBody}
              placeholder={placeholder ?? "Share research, a write-up or a question…  Use #hashtags, @mentions and ``` for code."}
              aria-label="Post text"
              className="min-h-32 border-0 bg-transparent px-0 py-0 text-[15px] shadow-none hover:border-0 focus-visible:outline-none"
            />
            <FieldError name="body" />
          </div>

          {showLink ? (
            <div>
              <Input name="linkUrl" type="url" placeholder="https://github.com/you/project" aria-label="Link" maxLength={2048} />
              <FieldError name="linkUrl" className="mt-1" />
            </div>
          ) : null}

          {attachments.length > 0 || uploading > 0 ? (
            <ul className="flex flex-wrap gap-2">
              {attachments.map((file) => (
                <li key={file.id} className="relative">
                  <input type="hidden" name="attachments[]" value={file.id} />
                  {file.mime.startsWith("image/") ? (
                    <img src={file.url} alt="" className="size-20 rounded-lg border object-cover" />
                  ) : (
                    <span className="flex h-20 w-44 flex-col justify-center gap-0.5 rounded-lg border bg-muted px-3">
                      <span className="truncate text-xs font-medium">{file.name}</span>
                      <span className="text-[11px] text-muted-foreground">{formatBytes(file.size)}</span>
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => setAttachments((current) => current.filter((f) => f.id !== file.id))}
                    className="absolute -right-1.5 -top-1.5 flex size-5 items-center justify-center rounded-sm border bg-popover text-muted-foreground hover:text-destructive"
                    aria-label={`Remove ${file.name}`}
                  >
                    <X className="size-3" />
                  </button>
                </li>
              ))}
              {uploading > 0 ? (
                <li className="flex size-20 items-center justify-center rounded-lg border border-dashed text-muted-foreground">
                  <Spinner />
                </li>
              ) : null}
            </ul>
          ) : null}

          <div className="grid gap-2 sm:grid-cols-3">
            <div>
              <Select name="category" defaultValue={defaultCategory ?? ""} required aria-label="Category">
                <option value="" disabled>
                  Category
                </option>
                {categories.map((c) => (
                  <option key={c.slug} value={c.slug}>
                    {c.name}
                  </option>
                ))}
              </Select>
              <FieldError name="category" className="mt-1" />
            </div>
            <Select name="type" defaultValue="post" aria-label="Post type">
              {COMPOSER_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </Select>
            {community ? null : (
              <Select name="visibility" defaultValue="public" aria-label="Who can see this">
                <option value="public">Anyone</option>
                <option value="connections">Connections only</option>
              </Select>
            )}
          </div>

          {!fixedCompanyId && !community && companies.length > 0 ? (
            <Select name="companyId" defaultValue="" aria-label="Post as">
              <option value="">Post as yourself</option>
              {companies.map((c) => (
                <option key={c.id} value={c.id}>
                  Post as {c.name}
                </option>
              ))}
            </Select>
          ) : null}

          <div className="flex items-center gap-1 border-t pt-3">
            <input ref={fileInput} type="file" multiple accept={ACCEPT} className="sr-only" tabIndex={-1} onChange={(e) => addFiles(e.target.files)} aria-label="Attach files" />
            <Button variant="ghost" size="icon-sm" onClick={() => fileInput.current?.click()} aria-label="Add images or video" title="Images, video, PDF or documents">
              <ImagePlus />
            </Button>
            <Button variant="ghost" size="icon-sm" onClick={() => fileInput.current?.click()} aria-label="Attach a document">
              <Paperclip />
            </Button>
            <Button variant="ghost" size="icon-sm" onClick={() => setShowLink((v) => !v)} aria-label="Add a link" aria-pressed={showLink}>
              <Link2 />
            </Button>
            <span className={cn("ml-auto text-xs tabular-nums text-subtle", body.length > LIMITS.postBody * 0.95 && "text-warning")}>
              {body.length > LIMITS.postBody * 0.8 ? `${body.length}/${LIMITS.postBody}` : null}
            </span>
            <Button variant="ghost" size="sm" onClick={reset}>
              Cancel
            </Button>
            <SubmitButton size="sm" disabled={uploading > 0 || body.trim().length === 0}>
              Post
            </SubmitButton>
          </div>
        </div>
      </div>
    </ActionForm>
  );
}
