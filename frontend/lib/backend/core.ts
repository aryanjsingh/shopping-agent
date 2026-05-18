export const BACKEND_URL =
  process.env.BACKEND_URL ??
  process.env.NEXT_PUBLIC_BACKEND_URL ??
  "http://localhost:4000";

export function backendUrl(path: string) {
  return new URL(path, BACKEND_URL).toString();
}

export function applyInternalHeaders(headers = new Headers()) {
  if (process.env.BACKEND_INTERNAL_SECRET) {
    headers.set("x-internal-token", process.env.BACKEND_INTERNAL_SECRET);
  }
  return headers;
}
