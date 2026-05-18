import { proxyToBackend } from "@/lib/backend/client";

export function GET(request: Request) {
  return proxyToBackend(
    request,
    `/api/messages?${new URL(request.url).searchParams}`
  );
}
