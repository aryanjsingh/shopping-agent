import { proxyToBackend } from "@/lib/backend/client";

export function POST(request: Request) {
  return proxyToBackend(request, "/api/files/upload");
}
