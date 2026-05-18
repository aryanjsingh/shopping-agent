"use client";

export function OptionChips({
  question,
  options,
  onSelect,
}: {
  question: string;
  options: { label: string; value: string }[];
  onSelect?: (value: string) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      {question ? (
        <div className="text-[13px] text-muted-foreground">{question}</div>
      ) : null}
      <div className="flex flex-wrap gap-2">
        {options.map((opt) => (
          <button
            className="rounded-full border border-border/60 bg-background px-3 py-1.5 text-[12px] transition hover:bg-muted disabled:opacity-50"
            disabled={!onSelect}
            key={opt.value}
            onClick={() => onSelect?.(opt.value)}
            type="button"
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}
