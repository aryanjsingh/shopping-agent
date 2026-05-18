import { proxyToBackend } from "@/lib/backend/client";

export function GET(request: Request) {
  return proxyToBackend(
    request,
    `/api/history?${new URL(request.url).searchParams}`
  );
}

export function DELETE(request: Request) {
  return proxyToBackend(request, "/api/history");
}
