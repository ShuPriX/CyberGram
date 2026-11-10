import { and, eq } from "drizzle-orm";
import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/db";
import { companyMembers, files, jobApplications, jobs } from "@/db/schema";
import { getSession } from "@/lib/auth/session";
import { audit } from "@/lib/security/audit";
import { storage } from "@/lib/storage";

export const runtime = "nodejs";

const INLINE_TYPES = new Set(["image/webp", "image/png", "image/jpeg", "image/gif", "video/mp4", "video/webm"]);

/** A recruiter may read a résumé only if it was submitted to a job at a company they belong to. */
async function recruiterMayRead(fileId: string, userId: string): Promise<boolean> {
  const [row] = await db
    .select({ id: jobApplications.id })
    .from(jobApplications)
    .innerJoin(jobs, eq(jobs.id, jobApplications.jobId))
    .innerJoin(companyMembers, and(eq(companyMembers.companyId, jobs.companyId), eq(companyMembers.userId, userId)))
    .where(eq(jobApplications.resumeFileId, fileId))
    .limit(1);
  return Boolean(row);
}

function parseRange(header: string | null, size: number): { start: number; end: number } | null {
  const match = header?.match(/^bytes=(\d*)-(\d*)$/);
  if (!match || (!match[1] && !match[2])) return null;
  const start = match[1] ? Number(match[1]) : Math.max(0, size - Number(match[2]));
  const end = match[1] && match[2] ? Math.min(Number(match[2]), size - 1) : size - 1;
  if (start > end || start >= size) return null;
  return { start, end };
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[a-z0-9]{8,40}$/.test(id)) return new NextResponse("Not found", { status: 404 });

  const [file] = await db.select().from(files).where(eq(files.id, id)).limit(1);
  // Missing, quarantined and unauthorised files are indistinguishable to the caller.
  if (!file || file.scanStatus === "infected") return new NextResponse("Not found", { status: 404 });

  if (file.visibility === "private") {
    const session = await getSession();
    if (!session) return new NextResponse("Not found", { status: 404 });
    const isOwner = file.ownerId === session.user.id;
    if (!isOwner) {
      if (!(await recruiterMayRead(file.id, session.user.id))) return new NextResponse("Not found", { status: 404 });
      await audit("resume.viewed", { actorId: session.user.id, targetType: "file", targetId: file.id });
    }
  }

  const range = parseRange(request.headers.get("range"), file.size);
  const object = await storage().get(file.storageKey, range ?? undefined);
  if (!object) return new NextResponse("Not found", { status: 404 });

  const inline = INLINE_TYPES.has(file.mime);
  const filename = encodeURIComponent(file.originalName).replace(/['()]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
  const headers = new Headers({
    "Content-Type": file.mime,
    "Content-Length": String(object.contentLength),
    "Accept-Ranges": "bytes",
    // Documents always download; nothing a member uploads is ever rendered as a page on our origin.
    "Content-Disposition": `${inline ? "inline" : "attachment"}; filename*=UTF-8''${filename}`,
    "X-Content-Type-Options": "nosniff",
    "Content-Security-Policy": "default-src 'none'; sandbox",
    "Cross-Origin-Resource-Policy": "same-origin",
    "Cache-Control": file.visibility === "public" ? "public, max-age=31536000, immutable" : "private, no-store",
  });
  if (object.range) headers.set("Content-Range", `bytes ${object.range.start}-${object.range.end}/${object.totalSize}`);

  return new NextResponse(object.body, { status: object.range ? 206 : 200, headers });
}
