import "server-only";
import net from "node:net";
import { env } from "@/lib/env";
import type { SniffedKey } from "./file-sniff";

export type ScanVerdict =
  | { status: "clean" }
  | { status: "skipped" }
  | { status: "infected"; signature: string }
  | { status: "error"; message: string };

// The industry-standard antivirus test string. Harmless, but every scanner must flag it —
// detecting it ourselves lets the upload pipeline be exercised without a ClamAV daemon.
// Assembled from parts so this source file is not itself flagged by endpoint protection.
export const EICAR_TEST_STRING = ["X5O!P%@AP[4\\PZX54(P^)7CC)7}$", "EICAR-STANDARD-ANTIVIRUS-TEST-FILE", "!$H+H*"].join("");
const EICAR = EICAR_TEST_STRING;

/**
 * Cheap, deterministic checks that run on every upload regardless of scanner availability.
 * These catch well-known active-content patterns; they complement, and do not replace, a real
 * antivirus engine.
 */
export function staticContentCheck(buf: Buffer, type: SniffedKey): ScanVerdict {
  const head = buf.subarray(0, Math.min(buf.length, 4096)).toString("latin1");
  if (head.includes(EICAR)) return { status: "infected", signature: "EICAR-Test-File" };

  if (type === "pdf") {
    const body = buf.toString("latin1");
    // Script execution and external program launch have no place in a résumé or write-up.
    if (/\/(JavaScript|JS)\s*[(<\/\d]/.test(body)) return { status: "infected", signature: "PDF.ActiveContent.JavaScript" };
    if (/\/Launch\b/.test(body)) return { status: "infected", signature: "PDF.ActiveContent.Launch" };
  }
  return { status: "clean" };
}

/** Streams the buffer to clamd using the INSTREAM protocol. */
function clamavScan(buf: Buffer, host: string, port: number): Promise<ScanVerdict> {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host, port });
    let response = "";
    let settled = false;
    const finish = (verdict: ScanVerdict) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      resolve(verdict);
    };

    socket.setTimeout(30_000, () => finish({ status: "error", message: "scanner timed out" }));
    socket.on("error", (err) => finish({ status: "error", message: err.message }));
    socket.on("data", (chunk) => {
      response += chunk.toString("utf8");
    });
    socket.on("close", () => {
      const reply = response.replace(/\0/g, "").trim();
      if (/\bOK$/.test(reply)) return finish({ status: "clean" });
      const found = reply.match(/^stream: (.+) FOUND$/);
      if (found) return finish({ status: "infected", signature: found[1]! });
      finish({ status: "error", message: reply || "empty scanner response" });
    });
    socket.on("connect", () => {
      socket.write("zINSTREAM\0");
      const CHUNK = 64 * 1024;
      for (let offset = 0; offset < buf.length; offset += CHUNK) {
        const part = buf.subarray(offset, offset + CHUNK);
        const size = Buffer.alloc(4);
        size.writeUInt32BE(part.length, 0);
        socket.write(size);
        socket.write(part);
      }
      socket.write(Buffer.alloc(4)); // zero-length chunk terminates the stream
    });
  });
}

export const isScannerConfigured = Boolean(env.CLAMAV_HOST);

/** Full scan: static checks first, then ClamAV when configured. */
export async function scanBuffer(buf: Buffer, type: SniffedKey): Promise<ScanVerdict> {
  const staticVerdict = staticContentCheck(buf, type);
  if (staticVerdict.status === "infected") return staticVerdict;
  if (!env.CLAMAV_HOST) return { status: "skipped" };
  return clamavScan(buf, env.CLAMAV_HOST, env.CLAMAV_PORT);
}
