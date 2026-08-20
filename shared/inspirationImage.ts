export function isValidInspirationImageReference(value: string): boolean {
  if (value.startsWith("/manus-storage/")) {
    return !value.includes("..") && !value.includes("\\");
  }

  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}
