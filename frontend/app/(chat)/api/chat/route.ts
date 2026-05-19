import { proxyToBackend } from "@/lib/backend/client";

export const maxDuration = 60;

export function POST(request: Request) {
  return proxyToBackend(request, "/api/chat");
}

export function DELETE(request: Request) {
  return proxyToBackend(
    request,
    `/api/chat?${new URL(request.url).searchParams}`
  );
}

export function PATCH(request: Request) {
  return proxyToBackend(
    request,
    `/api/chat?${new URL(request.url).searchParams}`
  );
}
