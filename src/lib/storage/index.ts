import "server-only";
import { createReadStream } from "node:fs";
import { mkdir, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { env } from "@/lib/env";

export type StoredObject = {
  body: ReadableStream<Uint8Array>;
  /** Bytes in this response (the range length when a range was requested). */
  contentLength: number;
  /** Total object size. */
  totalSize: number;
  range?: { start: number; end: number };
};

export interface StorageDriver {
  put(key: string, data: Buffer, contentType: string): Promise<void>;
  /** `range` is inclusive, as in the HTTP Range header. Returns null when the object is missing. */
  get(key: string, range?: { start: number; end?: number }): Promise<StoredObject | null>;
  delete(key: string): Promise<void>;
}

// Keys are generated server-side, but are validated anyway so no code path can traverse out of
// the storage root.
const KEY_PATTERN = /^[a-z0-9_]+(\/[a-z0-9_.-]+)+$/;
function assertKey(key: string) {
  if (!KEY_PATTERN.test(key) || key.includes("..")) throw new Error(`Invalid storage key: ${key}`);
}

class LocalStorage implements StorageDriver {
  private readonly root = path.resolve(process.cwd(), ".data/uploads");

  private resolve(key: string): string {
    assertKey(key);
    const full = path.resolve(this.root, key);
    if (!full.startsWith(this.root + path.sep)) throw new Error("Storage path escapes root");
    return full;
  }

  async put(key: string, data: Buffer): Promise<void> {
    const file = this.resolve(key);
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, data, { mode: 0o600 });
  }

  async get(key: string, range?: { start: number; end?: number }): Promise<StoredObject | null> {
    const file = this.resolve(key);
    let totalSize: number;
    try {
      totalSize = (await stat(file)).size;
    } catch {
      return null;
    }
    if (range) {
      const start = Math.min(range.start, Math.max(0, totalSize - 1));
      const end = Math.min(range.end ?? totalSize - 1, totalSize - 1);
      const stream = createReadStream(file, { start, end });
      return {
        body: Readable.toWeb(stream) as ReadableStream<Uint8Array>,
        contentLength: end - start + 1,
        totalSize,
        range: { start, end },
      };
    }
    return { body: Readable.toWeb(createReadStream(file)) as ReadableStream<Uint8Array>, contentLength: totalSize, totalSize };
  }

  async delete(key: string): Promise<void> {
    await rm(this.resolve(key), { force: true });
  }
}

/** Any S3-compatible object store (AWS S3, Cloudflare R2, MinIO, Backblaze B2, …). */
class S3Storage implements StorageDriver {
  private client: Promise<import("aws4fetch").AwsClient> | undefined;

  private getClient() {
    this.client ??= import("aws4fetch").then(
      ({ AwsClient }) =>
        new AwsClient({
          accessKeyId: env.S3_ACCESS_KEY_ID!,
          secretAccessKey: env.S3_SECRET_ACCESS_KEY!,
          region: env.S3_REGION,
          service: "s3",
        }),
    );
    return this.client;
  }

  private url(key: string): string {
    assertKey(key);
    // Path-style addressing works across every S3-compatible provider.
    return `${env.S3_ENDPOINT!.replace(/\/+$/, "")}/${env.S3_BUCKET}/${key}`;
  }

  async put(key: string, data: Buffer, contentType: string): Promise<void> {
    const res = await (await this.getClient()).fetch(this.url(key), {
      method: "PUT",
      body: new Uint8Array(data),
      headers: { "Content-Type": contentType, "Content-Length": String(data.length) },
    });
    if (!res.ok) throw new Error(`Object storage PUT failed with ${res.status}`);
  }

  async get(key: string, range?: { start: number; end?: number }): Promise<StoredObject | null> {
    const res = await (await this.getClient()).fetch(this.url(key), {
      headers: range ? { Range: `bytes=${range.start}-${range.end ?? ""}` } : {},
    });
    if (res.status === 404) return null;
    if (!res.ok || !res.body) throw new Error(`Object storage GET failed with ${res.status}`);
    const contentLength = Number(res.headers.get("content-length") ?? 0);
    const contentRange = res.headers.get("content-range")?.match(/bytes (\d+)-(\d+)\/(\d+)/);
    if (res.status === 206 && contentRange) {
      return {
        body: res.body,
        contentLength,
        totalSize: Number(contentRange[3]),
        range: { start: Number(contentRange[1]), end: Number(contentRange[2]) },
      };
    }
    return { body: res.body, contentLength, totalSize: contentLength };
  }

  async delete(key: string): Promise<void> {
    const res = await (await this.getClient()).fetch(this.url(key), { method: "DELETE" });
    if (!res.ok && res.status !== 404) throw new Error(`Object storage DELETE failed with ${res.status}`);
  }
}

let driver: StorageDriver | undefined;
export function storage(): StorageDriver {
  driver ??= env.STORAGE_DRIVER === "s3" ? new S3Storage() : new LocalStorage();
  return driver;
}
