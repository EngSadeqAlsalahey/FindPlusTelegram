import { cn } from "@/lib/cn";
import type { SearchType } from "@/types";

interface TypeTabsProps {
  value: SearchType;
  onChange: (value: SearchType) => void;
}

const OPTIONS: { value: SearchType; label: string; icon: string }[] = [
  { value: "all", label: "All", icon: "✦" },
  { value: "channel", label: "Channels", icon: "📢" },
  { value: "group", label: "Groups", icon: "👥" },
];

export function TypeTabs({ value, onChange }: TypeTabsProps) {
  return (
    <div
      role="tablist"
      aria-label="Result type"
      className="inline-flex gap-1 rounded-xl border border-white/10 bg-white/[0.03] p-1"
    >
      {OPTIONS.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            role="tab"
            aria-selected={active}
            type="button"
            onClick={() => onChange(option.value)}
            className={cn(
              "rounded-lg px-3.5 py-1.5 text-sm font-medium transition sm:px-4",
              active
                ? "bg-gradient-to-r from-indigo-500/90 to-violet-500/90 text-white shadow"
                : "text-slate-400 hover:bg-white/5 hover:text-slate-200",
            )}
          >
            <span className="mr-1.5" aria-hidden="true">
              {option.icon}
            </span>
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
