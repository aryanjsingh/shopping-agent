"use server";

import { cookies } from "next/headers";
import { auth } from "@/app/(auth)/auth";
import type { VisibilityType } from "@/components/chat/visibility-selector";
import { backendFetch } from "@/lib/backend/client";

export async function saveChatModelAsCookie(model: string) {
  const cookieStore = await cookies();
  cookieStore.set("chat-model", model);
}

export async function deleteTrailingMessages({ id }: { id: string }) {
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error("Unauthorized");
  }

  const response = await backendFetch("/actions/delete-trailing-messages", {
    method: "POST",
    body: JSON.stringify({ id }),
    headers: { "Content-Type": "application/json" },
  });
  if (!response.ok) {
    throw new Error(await response.text());
  }
}

export async function updateChatVisibility({
  chatId,
  visibility,
}: {
  chatId: string;
  visibility: VisibilityType;
}) {
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error("Unauthorized");
  }

  const response = await backendFetch("/actions/update-chat-visibility", {
    method: "POST",
    body: JSON.stringify({ chatId, visibility }),
    headers: { "Content-Type": "application/json" },
  });
  if (!response.ok) {
    throw new Error(await response.text());
  }
}
