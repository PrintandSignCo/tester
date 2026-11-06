export const ARTWORK_EXTENSIONS = ["pdf", "ai", "eps", "png", "jpg", "jpeg"] as const;
export const MAX_UPLOAD_BYTES = 80 * 1024 * 1024;

export function artworkExtension(filename: string): string | null {
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  return (ARTWORK_EXTENSIONS as readonly string[]).includes(ext) ? ext : null;
}

export function safeFilename(filename: string): string {
  const cleaned = filename.replace(/[^a-zA-Z0-9._-]+/g, "_").replace(/_+/g, "_");
  return cleaned.slice(0, 80) || "artwork";
}
