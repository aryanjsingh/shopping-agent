"use client";

import type { UseChatHelpers } from "@ai-sdk/react";
import { memo } from "react";
import { suggestions } from "@/lib/constants";
import type { ChatMessage } from "@/lib/types";
import { Suggestion } from "../ai-elements/suggestion";

type SuggestedActionsProps = {
  chatId: string;
  sendMessage: UseChatHelpers<ChatMessage>["sendMessage"];
};

function PureSuggestedActions({ chatId, sendMessage }: SuggestedActionsProps) {
  const suggestedActions = suggestions;

  return (
    <div
      className="flex w-full gap-2.5 overflow-x-auto pb-1 sm:grid sm:grid-cols-2 sm:overflow-visible"
      data-testid="suggested-actions"
      style={{
        scrollbarWidth: "none",
        WebkitOverflowScrolling: "touch",
        msOverflowStyle: "none",
      }}
    >
      {suggestedActions.map((suggestedAction) => (
        <div
          className="min-w-[200px] shrink-0 sm:min-w-0 sm:shrink"
          key={suggestedAction}
        >
          <Suggestion
            className="h-auto w-full cursor-pointer whitespace-nowrap rounded-lg border border-border/50 bg-card px-4 py-3 text-left text-[12px] leading-relaxed text-muted-foreground transition-colors duration-150 sm:whitespace-normal sm:p-4 sm:text-[13px] hover:border-border hover:text-foreground active:scale-[0.99]"
            onClick={(suggestion) => {
              window.history.pushState(
                {},
                "",
                `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/chat/${chatId}`
              );
              sendMessage({
                role: "user",
                parts: [{ type: "text", text: suggestion }],
              });
            }}
            suggestion={suggestedAction}
          >
            {suggestedAction}
          </Suggestion>
        </div>
      ))}
    </div>
  );
}

export const SuggestedActions = memo(
  PureSuggestedActions,
  (prevProps, nextProps) => {
    if (prevProps.chatId !== nextProps.chatId) {
      return false;
    }
    return true;
  }
);
