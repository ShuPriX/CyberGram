import { eq } from "drizzle-orm";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { ImageResponse } from "next/og";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { outboundPosts, type CardPayload } from "@/db/schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * The picture published to Instagram for one ledger entry. Instagram fetches this URL from its
 * own servers, so it is public — but it can only render what the platform itself queued: the id
 * is an unguessable ledger key and the text comes from the stored row, never from the request.
 */

const BLACK = "#050505";
const PANEL = "#111111";
const LINE = "#2a2a2a";
const WHITE = "#eef1f3";
const MUTED = "#9aa0a6";
const ORANGE = "#ff6a00";

const fontDir = path.join(process.cwd(), "src", "assets", "fonts");
const fontFiles = [
  { name: "Chakra", file: "chakra-petch-latin-700-normal.woff", weight: 700 as const },
  { name: "Chakra", file: "chakra-petch-latin-600-normal.woff", weight: 400 as const },
  { name: "Mono", file: "jetbrains-mono-latin-500-normal.woff", weight: 500 as const },
];
let fontCache: Promise<{ name: string; data: Buffer; weight: 400 | 500 | 700; style: "normal" }[]> | null = null;
const loadFonts = () =>
  (fontCache ??= Promise.all(fontFiles.map(async (f) => ({ name: f.name, data: await readFile(path.join(fontDir, f.file)), weight: f.weight, style: "normal" as const })))).catch((err) => {
    fontCache = null;
    throw err;
  });

/** The bundled fonts cover Latin text; anything else would render as an empty box, so it is dropped. */
const printable = (text: string) =>
  text
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[^ -~ -ÿ–—•…€]/g, "")
    .replace(/\s+/g, " ")
    .trim();

const clip = (text: string, max: number) => (text.length <= max ? text : `${text.slice(0, max - 1).replace(/\s+\S*$/, "")}…`);

function Frame({ label, children, left, right }: { label: string; children: React.ReactNode; left: string; right: string }) {
  return (
    <div style={{ width: 1080, height: 1350, display: "flex", flexDirection: "column", background: BLACK, color: WHITE, fontFamily: "Chakra", padding: 64, border: `2px solid ${LINE}` }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ width: 22, height: 22, background: ORANGE }} />
          <div style={{ fontSize: 34, fontWeight: 700, letterSpacing: 6 }}>CYBERGRAM</div>
        </div>
        <div style={{ fontFamily: "Mono", fontSize: 24, color: ORANGE, letterSpacing: 3, textTransform: "uppercase" }}>{label}</div>
      </div>
      <div style={{ height: 2, background: LINE, marginTop: 36 }} />
      <div style={{ display: "flex", flexDirection: "column", flex: 1, justifyContent: "center" }}>{children}</div>
      <div style={{ height: 2, background: LINE, marginBottom: 32 }} />
      <div style={{ display: "flex", width: "100%", justifyContent: "space-between", alignItems: "center", fontFamily: "Mono", fontSize: 24, color: MUTED }}>
        <div style={{ display: "flex" }}>{left}</div>
        <div style={{ display: "flex", color: ORANGE }}>{right}</div>
      </div>
    </div>
  );
}

function NewsCard({ payload, label }: { payload: Extract<CardPayload, { kind: "news" }>; label: string }) {
  const title = clip(printable(payload.title), 170);
  const size = title.length > 130 ? 64 : title.length > 90 ? 76 : title.length > 55 ? 90 : 108;
  return (
    <Frame
      label={label}
      left={`SOURCE · ${clip(printable(payload.source).toUpperCase(), 30)}`}
      right="DAILY CYBER NEWS"
    >
      <div style={{ display: "flex", fontFamily: "Mono", fontSize: 24, color: MUTED, letterSpacing: 3, marginBottom: 28 }}>
        {payload.sourceKind === "official" ? "OFFICIAL ADVISORY" : payload.sourceKind === "research" ? "SECURITY RESEARCH" : "SECURITY NEWS"}
      </div>
      <div style={{ display: "flex", fontSize: size, fontWeight: 700, lineHeight: 1.08, textTransform: "uppercase" }}>{title}</div>
      <div style={{ display: "flex", width: 140, height: 8, background: ORANGE, marginTop: 44 }} />
    </Frame>
  );
}

function JobsCard({ payload }: { payload: Extract<CardPayload, { kind: "jobs" }> }) {
  return (
    <Frame
      label="Open roles"
      left="UPDATED THROUGH THE DAY"
      right="LINK IN BIO"
    >
      <div style={{ display: "flex", alignItems: "flex-end", gap: 24 }}>
        <div style={{ display: "flex", fontSize: 168, fontWeight: 700, lineHeight: 1, color: ORANGE }}>{payload.total.toLocaleString("en-US")}</div>
        <div style={{ display: "flex", fontSize: 44, fontWeight: 700, lineHeight: 1.1, paddingBottom: 18, textTransform: "uppercase" }}>cyber roles open</div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", marginTop: 44, border: `2px solid ${LINE}`, background: PANEL }}>
        {payload.roles.slice(0, 5).map((role, index) => (
          <div key={index} style={{ display: "flex", flexDirection: "column", padding: "20px 28px", borderTop: index === 0 ? "none" : `2px solid ${LINE}` }}>
            <div style={{ display: "flex", fontSize: 34, fontWeight: 700 }}>{clip(printable(role.title), 46)}</div>
            <div style={{ display: "flex", fontFamily: "Mono", fontSize: 22, color: MUTED, marginTop: 6 }}>
              {clip(printable(role.company), 28)}
              {role.place ? ` · ${clip(printable(role.place), 24)}` : ""}
            </div>
          </div>
        ))}
      </div>
    </Frame>
  );
}

const LABELS: Record<string, string> = {
  "ai-security": "AI security",
  "malware-analysis": "Malware",
  devsecops: "Supply chain",
  "cloud-security": "Cloud",
  vapt: "Vulnerabilities",
  "application-security": "AppSec",
  "threat-intelligence": "Threat intel",
  "digital-forensics": "DFIR",
  grc: "GRC",
  soc: "SOC",
  "bug-bounty": "Bug bounty",
  networking: "Network",
  general: "Cyber news",
};

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[a-z0-9]{20}$/.test(id)) return new NextResponse("Not found", { status: 404 });

  const [row] = await db.select({ payload: outboundPosts.payload }).from(outboundPosts).where(eq(outboundPosts.id, id)).limit(1);
  if (!row) return new NextResponse("Not found", { status: 404 });

  const fonts = await loadFonts();
  const payload = row.payload;
  return new ImageResponse(payload.kind === "news" ? <NewsCard payload={payload} label={LABELS[payload.domain] ?? "Cyber news"} /> : <JobsCard payload={payload} />, {
    width: 1080,
    height: 1350,
    fonts,
    headers: { "Cache-Control": "public, max-age=86400, immutable" },
  });
}
