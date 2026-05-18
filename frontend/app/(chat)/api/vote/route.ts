import { proxyToBackend } from "@/lib/backend/client";

export function GET(request: Request) {
  return proxyToBackend(
    request,
    `/api/vote?${new URL(request.url).searchParams}`
  );
}

export function PATCH(request: Request) {
  return proxyToBackend(request, "/api/vote");
}
