"use server";

import { backendFetch } from "@/lib/backend/client";
import type { Suggestion } from "@/lib/db/schema";

export async function getSuggestions({ documentId }: { documentId: string }) {
  const response = await backendFetch(
    `/api/suggestions?documentId=${encodeURIComponent(documentId)}`
  );
  if (!response.ok) {
    return [];
  }
  return (await response.json()) as Suggestion[];
}
