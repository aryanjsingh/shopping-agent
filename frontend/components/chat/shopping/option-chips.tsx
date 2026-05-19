"use client";

import {
  BadgeDollarSignIcon,
  ChevronRightIcon,
  GiftIcon,
  ListChecksIcon,
  PaletteIcon,
  SparklesIcon,
  TargetIcon,
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

  function handleSelect(value: string) {
    if (selected || !onSelect) return;
    setSelected(value);
    onSelect(value);
  }

  return (
    <div className="w-full max-w-[520px] overflow-hidden rounded-xl border border-border/60 bg-background shadow-[var(--shadow-card)] animate-in fade-in slide-in-from-bottom-2 duration-300">
      <div className="flex gap-3 border-border/50 border-b px-3 py-3">
        <div className={cn("flex size-8 shrink-0 items-center justify-center rounded-md", accentClass)}>
          <Icon className="size-4" />
        </div>
        <div className="min-w-0">
          {question ? (
            <div className="font-semibold text-[13px] leading-snug">
              {question}
            </div>
          ) : null}
          {reason ? (
            <div className="mt-1 text-[12px] text-muted-foreground leading-relaxed">
              {reason}
            </div>
          ) : null}
        </div>
      </div>
      <div className="grid gap-1 p-1.5">
        {options.map((opt, i) => {
          const isSelected = selected === opt.value;
          const isDimmed = selected !== null && !isSelected;
          return (
            <button
              className={cn(
                "group flex min-h-12 w-full items-center justify-between gap-3 rounded-lg px-2.5 py-2 text-left transition-all duration-150",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                isSelected
                  ? "bg-primary/10 ring-1 ring-primary/30"
                  : isDimmed
                    ? "opacity-40"
                    : "hover:bg-muted",
                !onSelect && "cursor-default",
                // staggered entry animation
                `animate-in fade-in slide-in-from-left-2 duration-200`,
              )}
              style={{ animationDelay: `${i * 40}ms` }}
              disabled={!onSelect || selected !== null}
              key={opt.value}
              onClick={() => handleSelect(opt.value)}
              type="button"
            >
              <span className="min-w-0">
                <span className={cn(
                  "block font-medium text-[12px] leading-tight transition-colors",
                  isSelected && "text-primary"
                )}>
                  {opt.label}
                </span>
                {opt.description ? (
                  <span className="mt-0.5 line-clamp-2 block text-[11px] text-muted-foreground">
                    {opt.description}
                  </span>
                ) : null}
              </span>
              <ChevronRightIcon className={cn(
                "size-4 shrink-0 transition-all duration-150",
                isSelected
                  ? "text-primary translate-x-0.5"
                  : "text-muted-foreground group-hover:translate-x-0.5 group-hover:text-foreground"
              )} />
            </button>
          );
        })}
      </div>
    </div>
  );
}
