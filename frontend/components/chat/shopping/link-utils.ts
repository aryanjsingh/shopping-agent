"use client";

export function isExternalHttpUrl(value?: string | null): value is string {
  if (!value) {
    return false;
  }

  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

export function getExternalHref(...values: Array<string | null | undefined>) {
  return values.find(isExternalHttpUrl) ?? "";
}
