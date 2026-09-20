const MEDIA_TYPES: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  gif: "image/gif",
  webp: "image/webp",
  avif: "image/avif",
  svg: "image/svg+xml",
  mp4: "video/mp4",
  webm: "video/webm",
  mov: "video/quicktime",
  ogg: "video/ogg",
};

export function inferStorageContentType(key: string, upstreamContentType?: string | null) {
  const cleanKey = key.split("?")[0].toLowerCase();
  const extension = cleanKey.includes(".") ? cleanKey.slice(cleanKey.lastIndexOf(".") + 1) : "";
  const inferred = MEDIA_TYPES[extension];
  if (inferred) return inferred;
  if (upstreamContentType && upstreamContentType !== "application/octet-stream") return upstreamContentType;
  return "application/octet-stream";
}
