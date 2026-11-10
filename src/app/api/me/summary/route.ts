import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { getUnreadCounts } from "@/server/queries/notifications";

/** Unread badge counts, polled by the header. Read-only and scoped to the caller's session. */
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  return NextResponse.json(await getUnreadCounts(session.user.id));
}
