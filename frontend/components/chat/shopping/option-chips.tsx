"use client";

import {
  BadgeDollarSignIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  GiftIcon,
  ListChecksIcon,
  PaletteIcon,
  SparklesIcon,
  TargetIcon,
  XIcon,
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

type Option = {
  label: string;
  value: string;
  description?: string;
  searchHint?: string;
};

const modeIcons = {
  budget: BadgeDollarSignIcon,
  feature: ListChecksIcon,
  recipient: GiftIcon,
  style: PaletteIcon,
  use_case: TargetIcon,
  default: SparklesIcon,
};

const modeAccents: Record<string, string> = {
  budget: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400",
  feature: "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400",
  recipient: "bg-pink-50 text-pink-700 dark:bg-pink-950/40 dark:text-pink-400",
  style: "bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-400",
  use_case: "bg-orange-50 text-orange-700 dark:bg-orange-950/40 dark:text-orange-400",
  default: "bg-muted text-muted-foreground",
};

export function OptionChips({
  question,
  reason,
  mode,
  options,
  onSelect,
}: {
  question: string;
  reason?: string;
  mode?: "use_case" | "budget" | "style" | "feature" | "recipient";
  options: Option[];
  onSelect?: (value: string) => void;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const Icon = modeIcons[mode ?? "use_case"] ?? TargetIcon;
  const accentClass = modeAccents[mode ?? "default"] ?? modeAccents.default;
  const visibleOptions = options.slice(0, 4);

  function handleSelect(value: string) {
    if (selected || !onSelect) return;
    setSelected(value);
    onSelect(value);
  }

  return (
    <div className="w-full max-w-[620px] overflow-hidden rounded-lg border border-border/60 bg-card shadow-[var(--shadow-card)] animate-in fade-in duration-150">
      <div className="flex items-center justify-between gap-3 border-border/50 border-b px-4 py-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <div
            className={cn(
              "flex size-7 shrink-0 items-center justify-center rounded-md",
              accentClass
            )}
          >
            <Icon className="size-4" />
          </div>
          <div className="min-w-0">
            {question ? (
              <div className="truncate font-semibold text-[14px] leading-snug">
                {question}
              </div>
            ) : null}
            {reason ? (
              <div className="mt-0.5 line-clamp-1 text-[12px] text-muted-foreground">
                {reason}
              </div>
            ) : null}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1 text-muted-foreground">
          <button
            aria-label="Previous options"
            className="flex size-7 items-center justify-center rounded-md opacity-40"
            disabled
            type="button"
          >
            <ChevronLeftIcon className="size-4" />
          </button>
          <span className="min-w-10 text-center text-[12px]">1 of 1</span>
          <button
            aria-label="Next options"
            className="flex size-7 items-center justify-center rounded-md opacity-40"
            disabled
            type="button"
          >
            <ChevronRightIcon className="size-4" />
          </button>
          <button
            aria-label="Close options"
            className="ml-1 flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            onClick={() => setSelected("__dismissed__")}
            type="button"
          >
            <XIcon className="size-4" />
          </button>
        </div>
      </div>

      {selected === "__dismissed__" ? null : (
        <div className="divide-y divide-border/50 px-2 py-2">
          {visibleOptions.map((opt, i) => {
          const isSelected = selected === opt.value;
          const isDimmed = selected !== null && !isSelected;
          return (
            <button
              className={cn(
                "group flex min-h-12 w-full items-center justify-between gap-3 rounded-md px-2 py-2.5 text-left transition-colors duration-150",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                isSelected
                  ? "bg-muted text-foreground"
                  : isDimmed
                    ? "opacity-40"
                    : "hover:bg-muted",
                !onSelect && "cursor-default"
              )}
              disabled={!onSelect || selected !== null}
              key={opt.value}
              onClick={() => handleSelect(opt.value)}
              type="button"
            >
              <span className="flex min-w-0 items-center gap-3">
                <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-muted font-semibold text-[12px] text-foreground">
                  {i + 1}
                </span>
                <span className="min-w-0">
                  <span
                    className={cn(
                      "block font-medium text-[13px] leading-tight transition-colors",
                      isSelected && "text-foreground"
                    )}
                  >
                    {opt.label}
                  </span>
                  {opt.description ? (
                    <span className="mt-1 line-clamp-2 block text-[12px] text-muted-foreground">
                      {opt.description}
                    </span>
                  ) : null}
                </span>
              </span>
              <ChevronRightIcon className={cn(
                "size-4 shrink-0 transition-all duration-150",
                isSelected
                  ? "text-foreground translate-x-0.5"
                  : "text-muted-foreground group-hover:translate-x-0.5 group-hover:text-foreground"
              )} />
            </button>
          );
          })}
        </div>
      )}

      {selected === "__dismissed__" ? null : (
        <div className="flex items-center justify-end border-border/50 border-t px-4 py-2">
          <button
            className="rounded-md border border-border/70 px-3 py-1.5 font-medium text-[12px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            onClick={() => setSelected("__dismissed__")}
            type="button"
          >
            Skip
          </button>
        </div>
      )}
    </div>
  );
}
