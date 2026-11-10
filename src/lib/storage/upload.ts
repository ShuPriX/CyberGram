import "server-only";
import { createHash } from "node:crypto";
import { db } from "@/db";
import { files, type FileKind, type ScanStatus } from "@/db/schema";
import { env } from "@/lib/env";
import { newId } from "@/lib/ids";
import { audit } from "@/lib/security/audit";
import { sniffKey, type SniffedKey } from "@/lib/security/file-sniff";
import { scanBuffer } from "@/lib/security/scanner";
import { cleanInline } from "@/lib/text";
import { storage } from "./index";

const MB = 1024 * 1024;
const IMAGES: SniffedKey[] = ["png", "jpeg", "webp"];

type Rule = {
  maxBytes: number;
  types: SniffedKey[];
  visibility: "public" | "private";
  /** Images are always re-encoded; this bounds the output. */
  image?: { width: number; height: number; fit: "cover" | "inside" };
};

/**
 * What each upload slot accepts. Types are matched against the *detected* content type, so a
 * renamed executable or a polyglot file is rejected regardless of its name or declared MIME.
 * SVG is deliberately absent: it is an XSS vector when served from our origin.
 */
export const UPLOAD_RULES: Record<FileKind, Rule> = {
  avatar: { maxBytes: 5 * MB, types: IMAGES, visibility: "public", image: { width: 400, height: 400, fit: "cover" } },
  logo: { maxBytes: 5 * MB, types: IMAGES, visibility: "public", image: { width: 400, height: 400, fit: "inside" } },
  cover: { maxBytes: 8 * MB, types: IMAGES, visibility: "public", image: { width: 1600, height: 400, fit: "cover" } },
  post_media: {
    maxBytes: 50 * MB,
    types: [...IMAGES, "gif", "mp4", "webm"],
    visibility: "public",
    image: { width: 2000, height: 2000, fit: "inside" },
  },
  attachment: { maxBytes: 15 * MB, types: ["pdf", "docx", "pptx", "xlsx", "txt"], visibility: "public" },
  resume: { maxBytes: 5 * MB, types: ["pdf", "docx"], visibility: "private" },
};

const TYPE_INFO: Record<SniffedKey, { ext: string; mime: string }> = {
  png: { ext: "png", mime: "image/png" },
  jpeg: { ext: "jpg", mime: "image/jpeg" },
  gif: { ext: "gif", mime: "image/gif" },
  webp: { ext: "webp", mime: "image/webp" },
  mp4: { ext: "mp4", mime: "video/mp4" },
  webm: { ext: "webm", mime: "video/webm" },
  pdf: { ext: "pdf", mime: "application/pdf" },
  docx: { ext: "docx", mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" },
  pptx: { ext: "pptx", mime: "application/vnd.openxmlformats-officedocument.presentationml.presentation" },
  xlsx: { ext: "xlsx", mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" },
  txt: { ext: "txt", mime: "text/plain; charset=utf-8" },
};

const TYPE_LABELS: Record<SniffedKey, string> = {
  png: "PNG", jpeg: "JPEG", gif: "GIF", webp: "WebP", mp4: "MP4", webm: "WebM",
  pdf: "PDF", docx: "DOCX", pptx: "PPTX", xlsx: "XLSX", txt: "plain text",
};

export class UploadError extends Error {
  constructor(
    message: string,
    readonly status = 400,
  ) {
    super(message);
    this.name = "UploadError";
  }
}

export type StoredFile = {
  id: string;
  url: string;
  name: string;
  mime: string;
  size: number;
  width: number | null;
  height: number | null;
};

export const fileUrl = (id: string) => `/api/files/${id}`;

/** A safe display name: no path components, control characters, or surprising extensions. */
function sanitizeFilename(name: string, ext: string): string {
  const base = cleanInline(name.split(/[\\/]/).pop() ?? "file")
    .replace(/\.[^.]*$/, "")
    .replace(/[^\p{L}\p{N} ._()-]/gu, "")
    .trim()
    .slice(0, 80);
  return `${base || "file"}.${ext}`;
}

/**
 * Validates, scans, normalises and stores an upload.
 *
 * Pipeline: size limit → content-type detection from bytes → per-slot allow-list → static
 * active-content checks and antivirus scan → image re-encoding (strips EXIF/GPS metadata and
 * neutralises anything hidden in the original container) → storage under a random key.
 */
export async function storeUpload(input: { file: File; kind: FileKind; ownerId: string }): Promise<StoredFile> {
  const rule = UPLOAD_RULES[input.kind];
  if (!rule) throw new UploadError("Unsupported upload type.");

  if (input.file.size === 0) throw new UploadError("That file is empty.");
  if (input.file.size > rule.maxBytes) {
    throw new UploadError(`That file is too large. The limit is ${Math.round(rule.maxBytes / MB)} MB.`, 413);
  }

  let buffer: Buffer = Buffer.from(await input.file.arrayBuffer());
  if (buffer.length > rule.maxBytes) throw new UploadError("That file is too large.", 413);

  let type = sniffKey(buffer);
  if (!type || !rule.types.includes(type)) {
    await audit("upload.rejected", {
      actorId: input.ownerId,
      metadata: { kind: input.kind, reason: "type", detected: type, declared: input.file.type.slice(0, 80) },
    });
    const allowed = rule.types.map((t) => TYPE_LABELS[t]).join(", ");
    throw new UploadError(`That file type is not accepted here. Allowed: ${allowed}.`, 415);
  }

  const verdict = await scanBuffer(buffer, type);
  if (verdict.status === "infected") {
    await audit("upload.blocked_malware", {
      actorId: input.ownerId,
      metadata: { kind: input.kind, signature: verdict.signature },
    });
    throw new UploadError("That file was blocked by our security scan and was not uploaded.", 422);
  }
  if (env.UPLOAD_REQUIRE_SCAN && verdict.status !== "clean") {
    console.error("[upload] scanner unavailable and UPLOAD_REQUIRE_SCAN is set", verdict);
    throw new UploadError("Uploads are temporarily unavailable. Please try again shortly.", 503);
  }
  const scanStatus: ScanStatus = verdict.status;

  let width: number | null = null;
  let height: number | null = null;

  if (rule.image && ["png", "jpeg", "webp", "gif"].includes(type)) {
    try {
      const sharp = (await import("sharp")).default;
      const processed = await sharp(buffer, { animated: type === "gif", limitInputPixels: 50_000_000, failOn: "error" })
        .rotate() // apply EXIF orientation before the metadata is dropped
        .resize({ width: rule.image.width, height: rule.image.height, fit: rule.image.fit, withoutEnlargement: true })
        .webp({ quality: 84 })
        .toBuffer({ resolveWithObject: true });
      buffer = processed.data;
      width = processed.info.width;
      height = processed.info.pageHeight ?? processed.info.height;
      type = "webp";
    } catch {
      throw new UploadError("That image could not be processed. Try exporting it again as PNG or JPEG.", 422);
    }
  }

  const info = TYPE_INFO[type];
  const id = newId();
  const now = new Date();
  const storageKey = `${input.kind}/${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, "0")}/${id}.${info.ext}`;

  await storage().put(storageKey, buffer, info.mime);

  const name = sanitizeFilename(input.file.name, info.ext);
  await db.insert(files).values({
    id,
    ownerId: input.ownerId,
    kind: input.kind,
    storageKey,
    originalName: name,
    mime: info.mime,
    size: buffer.length,
    sha256: createHash("sha256").update(buffer).digest("hex"),
    width,
    height,
    scanStatus,
    visibility: rule.visibility,
  });

  return { id, url: fileUrl(id), name, mime: info.mime, size: buffer.length, width, height };
}
