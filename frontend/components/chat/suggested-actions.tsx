"use client";

import type { UseChatHelpers } from "@ai-sdk/react";
import { memo, useMemo } from "react";
import { pickSuggestionsForChat } from "@/lib/constants";
import type { ChatMessage } from "@/lib/types";
import { Suggestion } from "../ai-elements/suggestion";

type SuggestedActionsProps = {
  chatId: string;
  sendMessage: UseChatHelpers<ChatMessage>["sendMessage"];
};

function PureSuggestedActions({ chatId, sendMessage }: SuggestedActionsProps) {
  const suggestedActions = useMemo(
    () => pickSuggestionsForChat(chatId, 4),
    [chatId]
  );

  return (
    <div
      className="flex w-full max-w-2xl mx-auto gap-3 overflow-x-auto pb-1 sm:grid sm:grid-cols-2 sm:overflow-visible"
      data-testid="suggested-actions"
      style={{
        scrollbarWidth: "none",
        WebkitOverflowScrolling: "touch",
        msOverflowStyle: "none",
      }}
    >
      {suggestedActions.map((suggestedAction) => (
        <div
          className="min-w-[200px] shrink-0 sm:min-w-0 sm:shrink flex flex-col h-full"
          key={suggestedAction}
        >
          <Suggestion
            className="h-full min-h-[80px] w-full cursor-pointer whitespace-nowrap rounded-2xl border border-border/40 bg-card/60 px-4 py-3.5 text-left text-[12px] font-medium leading-relaxed text-muted-foreground/80 transition-all duration-200 sm:whitespace-normal sm:p-4.5 sm:text-[13px] hover:scale-[1.02] hover:bg-sidebar-accent/60 hover:border-primary/30 hover:text-foreground hover:shadow-md active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
