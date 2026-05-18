import { proxyToBackend } from "@/lib/backend/client";

export function GET(request: Request) {
  return proxyToBackend(
    request,
    `/api/document?${new URL(request.url).searchParams}`
  );
}

export function POST(request: Request) {
  return proxyToBackend(
    request,
    `/api/document?${new URL(request.url).searchParams}`
  );
}

export function DELETE(request: Request) {
  return proxyToBackend(
    request,
    `/api/document?${new URL(request.url).searchParams}`
  );
}
