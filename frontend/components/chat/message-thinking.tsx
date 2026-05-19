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
      <ThinkingTrigger toolCount={tools.length} />
      <ThinkingContent reasoning={reasoning} tools={tools} />
    </Reasoning>
  );
}

function ThinkingTrigger({ toolCount }: { toolCount: number }) {
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
            {toolCount > 0 ? `Checking ${toolCount} source${toolCount > 1 ? "s" : ""}...` : "Preparing response..."}
          </Shimmer>
        ) : duration ? (
          `How I searched (${duration}s)`
        ) : (
          "How I searched (a few seconds)"
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

function ToolRow({ tool }: { tool: ThinkingTool }) {
  const isDone = tool.state === "output-available";
  const isError = tool.state === "output-error" || tool.state === "output-denied";
  const label = toolLabels[tool.name] ?? tool.name;
  const inputSummary = summarizeInput(tool.input);

  return (
    <div className={cn(
      "flex items-start gap-1.5 text-[11px] leading-relaxed",
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
  reasoning,
  tools,
}: {
  reasoning: string;
  tools: ThinkingTool[];
}) {
  const { isOpen, isStreaming } = useReasoning();
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isStreaming && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [isStreaming, tools.length, reasoning]);

  if (!isOpen) return null;

  const hasContent = tools.length > 0 || reasoning.trim();

  return (
    <div
      className={cn(
        "mt-1 w-full overflow-y-auto rounded-md border border-border/20 bg-muted/20 px-2.5 py-2 [scrollbar-width:thin]",
        isStreaming ? "max-h-40" : "max-h-28"
      )}
      ref={scrollRef}
    >
      {tools.length > 0 && (
        <div className="grid gap-0.5">
          {tools.map((tool) => (
            <ToolRow key={tool.id} tool={tool} />
          ))}
        </div>
      )}
      {reasoning.trim() && (
        <div className={cn(
          "whitespace-pre-wrap text-muted-foreground/60 text-[11px] leading-relaxed",
          tools.length > 0 && "mt-1.5 border-t border-border/20 pt-1.5"
        )}>
          {reasoning.trim()}
        </div>
      )}
      {!hasContent && (
        <div className="text-[11px] text-muted-foreground/50">
          Preparing response…
        </div>
      )}
    </div>
  );
}
