"use client";

import { Reasoning, useReasoning } from "@/components/ai-elements/reasoning";
import { cn } from "@/lib/utils";
import { ChevronRightIcon } from "lucide-react";
import { useEffect, useRef } from "react";
import { Shimmer } from "../ai-elements/shimmer";

type ThinkingTool = {
  id: string;
  name: string;
  state?: string;
  input?: unknown;
  errorText?: string;
};

type MessageThinkingProps = {
  durationSeconds?: number;
  isStreaming: boolean;
  tools: ThinkingTool[];
  reasoning: string;
};

const toolLabels: Record<string, string> = {
  buyProduct: "Preparing checkout",
  clarifyIntent: "Clarifying request",
  compareProducts: "Comparing products",
  compareSellers: "Checking sellers",
  createDocument: "Creating document",
  getProduct: "Inspecting product",
  getWeather: "Checking weather",
  requestSuggestions: "Requesting suggestions",
  searchProducts: "Searching products",
  updateDocument: "Updating document",
};

function getToolName(type: string) {
  return type.startsWith("tool-") ? type.slice(5) : type;
}

export function toThinkingTool(part: {
  type: string;
  toolCallId?: string;
  state?: string;
  input?: unknown;
  errorText?: string;
}): ThinkingTool {
  const name = getToolName(part.type);
  return {
    errorText: part.errorText,
    id: part.toolCallId ?? `${part.type}-${name}`,
    input: part.input,
    name,
    state: part.state,
  };
}

function statusLabel(state?: string) {
  if (state === "output-available") {
    return "Done";
  }
  if (state === "output-error" || state === "output-denied") {
    return "Issue";
  }
  if (state === "approval-requested") {
    return "Needs approval";
  }
  return "Running";
}

function summarizeInput(input: unknown) {
  if (!input || typeof input !== "object") {
    return null;
  }
  const record = input as Record<string, unknown>;
  const query = record.query;
  if (typeof query === "string" && query.trim()) {
    return query;
  }
  const productId = record.productId;
  if (typeof productId === "string" && productId.trim()) {
    return productId;
  }
  return null;
}

export function MessageThinking({
  durationSeconds,
  isStreaming,
  tools,
  reasoning,
}: MessageThinkingProps) {
  const hasReasoning = reasoning.trim().length > 0;

  if (!(hasReasoning || tools.length > 0 || isStreaming)) {
    return null;
  }

  return (
    <Reasoning
      className="w-full"
      defaultOpen={isStreaming}
      duration={durationSeconds}
      isStreaming={isStreaming}
    >
      <ThinkingTrigger />
      <ThinkingContent reasoning={reasoning} tools={tools} />
    </Reasoning>
  );
}

function ThinkingTrigger() {
  const { duration, isOpen, isStreaming, setIsOpen } = useReasoning();

  return (
    <button
      className="flex w-fit cursor-pointer items-center gap-1 text-muted-foreground text-[12px] leading-[1.65] transition-colors hover:text-foreground"
      type="button"
      onClick={() => setIsOpen(!isOpen)}
    >
      <span>
        {isStreaming ? (
          <Shimmer className="font-medium" duration={1}>
            Thinking...
          </Shimmer>
        ) : duration ? (
          `Thought for ${duration}s`
        ) : (
          "Thought"
        )}
      </span>
      <ChevronRightIcon
        className={cn(
          "size-3.5 transition-transform",
          isOpen ? "rotate-90" : "rotate-0"
        )}
      />
    </button>
  );
}

function ThinkingContent({
  reasoning,
  tools,
}: {
  reasoning: string;
  tools: ThinkingTool[];
}) {
  const { isOpen, isStreaming } = useReasoning();
  const scrollRef = useRef<HTMLDivElement>(null);

  const toolTrace =
    tools.length > 0
      ? tools
          .map((tool) => {
            const input = summarizeInput(tool.input);
            return [
              `${toolLabels[tool.name] ?? tool.name}: ${statusLabel(tool.state)}`,
              input ? ` (${input})` : "",
              tool.errorText ? ` - ${tool.errorText}` : "",
            ].join("");
          })
          .join("\n")
      : "";
  const text = [reasoning.trim(), toolTrace].filter(Boolean).join("\n");

  useEffect(() => {
    if (isStreaming && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [isStreaming, text]);

  if (!isOpen) {
    return null;
  }

  return (
    <div
      className={cn(
        "mt-1 max-h-24 w-full overflow-y-auto whitespace-pre-wrap text-muted-foreground/70 text-[11px] leading-relaxed [scrollbar-width:none]",
        isStreaming && "max-h-32"
      )}
      ref={scrollRef}
    >
      {text || "Preparing response"}
    </div>
  );
}
