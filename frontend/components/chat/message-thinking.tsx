"use client";

import { Reasoning, useReasoning } from "@/components/ai-elements/reasoning";
import { cn } from "@/lib/utils";
import { ChevronRightIcon } from "lucide-react";
import { useEffect, useRef } from "react";
import { Shimmer } from "../ai-elements/shimmer";

export type ThinkingTool = {
  id: string;
  name: string;
  state?: string;
  input?: unknown;
  errorText?: string;
};

export type ThinkingStep =
  | { type: "reasoning"; text: string; id: string }
  | { type: "tool"; tool: ThinkingTool; id: string };

type MessageThinkingProps = {
  durationSeconds?: number;
  isStreaming: boolean;
  steps: ThinkingStep[];
};

const toolLabels: Record<string, string> = {
  buyProduct: "Preparing checkout",
  clarifyIntent: "Clarifying request",
  compareProducts: "Comparing products",
  compareSellers: "Checking sellers",
  createDocument: "Creating document",
  displayProducts: "Preparing product cards",
  getProduct: "Inspecting product",
  getWeather: "Checking weather",
  refineSearch: "Refining catalog",
  requestSuggestions: "Requesting suggestions",
  searchProducts: "Searching catalog",
  showMore: "Finding more options",
  updateDocument: "Updating document",
  webFetch: "Reading page",
  webSearch: "Searching web",
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

function summarizeInput(input: unknown): string | null {
  if (!input || typeof input !== "object") return null;
  const record = input as Record<string, unknown>;
  if (typeof record.query === "string" && record.query.trim()) return record.query;
  if (typeof record.url === "string" && record.url.trim()) {
    try { return new URL(record.url).hostname; } catch { return record.url; }
  }
  if (typeof record.productId === "string" && record.productId.trim()) return record.productId;
  if (Array.isArray(record.productIds) && record.productIds.length > 0) return `${record.productIds.length} products`;
  if (typeof record.question === "string" && record.question.trim()) return record.question;
  return null;
}

function preserveChatScroll() {
  window.dispatchEvent(new Event("chat-preserve-scroll"));
}

export function MessageThinking({
  durationSeconds,
  isStreaming,
  steps,
}: MessageThinkingProps) {
  const hasContent = steps.length > 0;

  if (!(hasContent || isStreaming)) {
    return null;
  }

  return (
    <Reasoning
      className="block w-full [overflow-anchor:none]"
      defaultOpen={isStreaming}
      duration={durationSeconds}
      isStreaming={isStreaming}
    >
      <ThinkingTrigger hasDetails={steps.length > 0} />
      <ThinkingContent steps={steps} />
    </Reasoning>
  );
}

function ThinkingTrigger({ hasDetails }: { hasDetails: boolean }) {
  const { duration, isOpen, isStreaming, setIsOpen } = useReasoning();

  return (
    <button
      className={cn(
        "flex w-fit items-center gap-1 text-muted-foreground text-[14px] leading-[1.65] transition-colors",
        hasDetails ? "cursor-pointer hover:text-foreground" : "cursor-default"
      )}
      type="button"
      onClick={() => {
        if (hasDetails) {
          preserveChatScroll();
          setIsOpen(!isOpen);
        }
      }}
    >
      <span>
        {isStreaming ? (
          <Shimmer className="font-medium" duration={1}>
            Thinking
          </Shimmer>
        ) : duration ? (
          `Thought for ${duration}s`
        ) : (
          "Thought for a few seconds"
        )}
      </span>
      {hasDetails ? (
        <ChevronRightIcon
          className={cn(
            "size-3.5 transition-transform",
            isOpen ? "rotate-90" : "rotate-0"
          )}
        />
      ) : null}
    </button>
  );
}

function ToolRow({ tool }: { tool: ThinkingTool }) {
  const isDone = tool.state === "output-available";
  const isError = tool.state === "output-error" || tool.state === "output-denied";
  const label = toolLabels[tool.name] ?? tool.name;
  const inputSummary = summarizeInput(tool.input);

  return (
    <div className={cn(
      "flex items-start gap-1.5 text-[13px] leading-relaxed",
      isDone && "text-muted-foreground/70",
      isError && "text-red-500/80",
      !isDone && !isError && "text-foreground/80",
    )}>
      <span className="shrink-0 select-none">
        {isDone ? "✓" : isError ? "✗" : "·"}
      </span>
      <span>
        <span className={cn("font-medium", !isDone && !isError && "font-semibold")}>{label}</span>
        {inputSummary && (
          <span className="ml-1 text-muted-foreground/50">({inputSummary})</span>
        )}
        {isError && tool.errorText && (
          <span className="ml-1 text-red-400">— {tool.errorText}</span>
        )}
      </span>
    </div>
  );
}

function ThinkingContent({
  steps,
}: {
  steps: ThinkingStep[];
}) {
  const { isOpen, isStreaming } = useReasoning();
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isStreaming && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [isStreaming, steps.length]);

  if (!isOpen) return null;

  const hasContent = steps.length > 0;
  if (!hasContent) return null;

  return (
    <div
      className={cn(
        "mt-1 block w-full overflow-y-auto py-1.5 [overflow-anchor:none] [scrollbar-width:thin]",
        isStreaming ? "max-h-40" : "max-h-28"
      )}
      ref={scrollRef}
    >
      <div className="flex flex-col gap-1.5">
        {steps.map((step) => {
          if (step.type === "tool") {
            return <ToolRow key={step.id} tool={step.tool} />;
          } else {
            return (
              <div
                key={step.id}
                className="whitespace-pre-wrap text-muted-foreground/60 text-[13px] leading-relaxed"
              >
                {step.text.trim()}
              </div>
            );
          }
        })}
      </div>
    </div>
  );
}
