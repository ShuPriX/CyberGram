import { NextResponse, type NextRequest } from "next/server";
import type { FileKind } from "@/db/schema";
import { getSession } from "@/lib/auth/session";
import { env } from "@/lib/env";
import { rateLimit } from "@/lib/security/rate-limit";
import { storeUpload, UPLOAD_RULES, UploadError } from "@/lib/storage/upload";

export const runtime = "nodejs";

const json = (status: number, error: string) => NextResponse.json({ error }, { status });

/**
 * Authenticated file upload (multipart/form-data: `file`, `kind`).
 * Validation, scanning and image normalisation happen in `storeUpload`.
 */
export async function POST(request: NextRequest) {
  // CSRF: this endpoint is cookie-authenticated, so only accept same-origin requests.
  let originHost = "";
  try {
    originHost = new URL(request.headers.get("origin") ?? "").host;
  } catch {
    /* missing or malformed Origin */
  }
  const allowedHosts = new Set([new URL(env.APP_URL).host, request.headers.get("host") ?? ""]);
  if (!originHost || !allowedHosts.has(originHost)) return json(403, "Cross-origin uploads are not allowed.");

  const session = await getSession();
  if (!session) return json(401, "Please sign in to upload files.");

  const limit = await rateLimit("upload", session.user.id);
  if (!limit.ok) return json(429, "You are uploading too quickly. Please try again later.");

  const declaredLength = Number(request.headers.get("content-length") ?? 0);
  if (declaredLength > 55 * 1024 * 1024) return json(413, "That file is too large.");

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return json(400, "The upload could not be read.");
  }

  const kind = String(form.get("kind") ?? "") as FileKind;
  const file = form.get("file");
  if (!(kind in UPLOAD_RULES)) return json(400, "Unknown upload type.");
  if (!(file instanceof File)) return json(400, "No file was provided.");

  try {
    const stored = await storeUpload({ file, kind, ownerId: session.user.id });
    return NextResponse.json(stored, { status: 201 });
  } catch (err) {
    if (err instanceof UploadError) return json(err.status, err.message);
    console.error("[upload] failed", err);
    return json(500, "The upload failed. Please try again.");
  }
}
