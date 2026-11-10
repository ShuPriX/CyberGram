export type UploadedFile = {
  id: string;
  url: string;
  name: string;
  mime: string;
  size: number;
  width: number | null;
  height: number | null;
};

export type UploadKind = "avatar" | "cover" | "logo" | "post_media" | "attachment" | "resume";

/** Browser-side upload helper. The server re-validates everything; this only reports errors. */
export async function uploadFile(file: File, kind: UploadKind): Promise<UploadedFile> {
  const body = new FormData();
  body.set("kind", kind);
  body.set("file", file);
  let res: Response;
  try {
    res = await fetch("/api/upload", { method: "POST", body, credentials: "same-origin" });
  } catch {
    throw new Error("The upload failed. Check your connection and try again.");
  }
  const data = (await res.json().catch(() => null)) as (UploadedFile & { error?: string }) | null;
  if (!res.ok || !data || data.error) throw new Error(data?.error ?? "The upload failed. Please try again.");
  return data;
}

/** Which upload slot a file picked in the post composer belongs to. */
export function postUploadKind(file: File): UploadKind {
  return file.type.startsWith("image/") || file.type.startsWith("video/") ? "post_media" : "attachment";
}
