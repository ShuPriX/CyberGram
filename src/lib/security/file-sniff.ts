/**
 * Content-type detection from file bytes ("magic numbers").
 *
 * The browser-supplied MIME type and the file extension are attacker-controlled, so uploads are
 * classified exclusively by what the bytes actually are. Anything unrecognised is rejected.
 */

export type FileFamily = "image" | "video" | "document" | "text";
export type SniffedType = { ext: string; mime: string; family: FileFamily };

const TYPES = {
  png: { ext: "png", mime: "image/png", family: "image" },
  jpeg: { ext: "jpg", mime: "image/jpeg", family: "image" },
  gif: { ext: "gif", mime: "image/gif", family: "image" },
  webp: { ext: "webp", mime: "image/webp", family: "image" },
  mp4: { ext: "mp4", mime: "video/mp4", family: "video" },
  webm: { ext: "webm", mime: "video/webm", family: "video" },
  pdf: { ext: "pdf", mime: "application/pdf", family: "document" },
  docx: { ext: "docx", mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", family: "document" },
  pptx: { ext: "pptx", mime: "application/vnd.openxmlformats-officedocument.presentationml.presentation", family: "document" },
  xlsx: { ext: "xlsx", mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", family: "document" },
  txt: { ext: "txt", mime: "text/plain; charset=utf-8", family: "text" },
} as const satisfies Record<string, SniffedType>;

export type SniffedKey = keyof typeof TYPES;

const startsWith = (buf: Buffer, bytes: number[], offset = 0) =>
  buf.length >= offset + bytes.length && bytes.every((b, i) => buf[offset + i] === b);
const ascii = (buf: Buffer, start: number, end: number) => buf.subarray(start, end).toString("latin1");

// ISO-BMFF brands that are video containers we accept. HEIC/AVIF share the container but are
// images, and QuickTime is excluded because browsers do not play it reliably.
const MP4_BRANDS = new Set(["isom", "iso2", "iso4", "iso5", "iso6", "mp41", "mp42", "avc1", "dash", "M4V ", "mmp4", "msnv"]);

function sniffZipOffice(buf: Buffer): SniffedKey | null {
  // OOXML packages are ZIP archives; entry names are stored uncompressed.
  const names = buf.toString("latin1");
  if (!names.includes("[Content_Types].xml")) return null;
  if (names.includes("vbaProject.bin")) return null; // macro-enabled documents are never accepted
  if (names.includes("word/document.xml")) return "docx";
  if (names.includes("ppt/presentation.xml")) return "pptx";
  if (names.includes("xl/workbook.xml")) return "xlsx";
  return null;
}

function looksLikePlainText(buf: Buffer): boolean {
  if (buf.length === 0) return false;
  const sample = buf.subarray(0, Math.min(buf.length, 64 * 1024));
  if (sample.includes(0)) return false;
  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(sample.length === buf.length ? sample : sample.subarray(0, sample.length - 4));
  } catch {
    return false;
  }
  const head = text.slice(0, 512).trimStart().toLowerCase();
  // Text that a browser or shell could interpret is not "plain text" for our purposes.
  if (head.startsWith("#!") || head.startsWith("<?php") || /^<(!doctype|html|script|svg|\?xml|iframe)/.test(head)) return false;
  let control = 0;
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    if (code < 32 && code !== 9 && code !== 10 && code !== 13) control++;
  }
  return control / text.length < 0.01;
}

export function sniffFile(buf: Buffer): SniffedType | null {
  const key = sniffKey(buf);
  return key ? TYPES[key] : null;
}

export function sniffKey(buf: Buffer): SniffedKey | null {
  if (buf.length < 4) return null;

  if (startsWith(buf, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "png";
  if (startsWith(buf, [0xff, 0xd8, 0xff])) return "jpeg";
  if (ascii(buf, 0, 6) === "GIF87a" || ascii(buf, 0, 6) === "GIF89a") return "gif";
  if (ascii(buf, 0, 4) === "RIFF" && ascii(buf, 8, 12) === "WEBP") return "webp";
  if (ascii(buf, 0, 5) === "%PDF-") return "pdf";

  if (buf.length >= 12 && ascii(buf, 4, 8) === "ftyp") {
    return MP4_BRANDS.has(ascii(buf, 8, 12)) ? "mp4" : null;
  }
  if (startsWith(buf, [0x1a, 0x45, 0xdf, 0xa3])) {
    return ascii(buf, 0, Math.min(buf.length, 64)).includes("webm") ? "webm" : null;
  }
  if (startsWith(buf, [0x50, 0x4b, 0x03, 0x04])) return sniffZipOffice(buf);

  // Executable formats are named explicitly so the rejection is deliberate, not incidental.
  if (
    startsWith(buf, [0x4d, 0x5a]) || // PE / DOS (MZ)
    startsWith(buf, [0x7f, 0x45, 0x4c, 0x46]) || // ELF
    startsWith(buf, [0xfe, 0xed, 0xfa, 0xce]) ||
    startsWith(buf, [0xfe, 0xed, 0xfa, 0xcf]) ||
    startsWith(buf, [0xcf, 0xfa, 0xed, 0xfe]) ||
    startsWith(buf, [0xca, 0xfe, 0xba, 0xbe]) // Mach-O / Java class
  ) {
    return null;
  }

  return looksLikePlainText(buf) ? "txt" : null;
}
