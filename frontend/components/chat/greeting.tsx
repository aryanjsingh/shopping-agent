"use client";

import { useMemo } from "react";
import { pickGreetingForChat } from "@/lib/constants";

export const Greeting = ({ chatId = "default" }: { chatId?: string }) => {
  const { title, subtitle } = useMemo(() => pickGreetingForChat(chatId), [chatId]);
  return (
    <div
      className="flex flex-col items-center px-4 animate-[fade-up_0.3s_cubic-bezier(0.22,1,0.36,1)]"
      key="overview"
    >
      <div className="text-balance text-center font-semibold text-2xl text-foreground md:text-3xl">
        {title}
      </div>
      <div className="mt-3 max-w-xl text-center text-muted-foreground/80 text-pretty text-sm">
        {subtitle}
      </div>
    </div>
  );
};
