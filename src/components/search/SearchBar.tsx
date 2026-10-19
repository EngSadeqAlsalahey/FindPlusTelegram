import { cn } from "@/lib/cn";

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  isRtl: boolean;
}

export function SearchBar({ value, onChange, onSubmit, isRtl }: SearchBarProps) {
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
      role="search"
    >
      <div className="relative">
        <SearchIcon
          className={cn(
            "pointer-events-none absolute top-1/2 h-5 w-5 -translate-y-1/2 text-slate-500",
            isRtl ? "right-4" : "left-4",
          )}
        />
        <input
          dir={isRtl ? "rtl" : "ltr"}
          type="search"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          maxLength={100}
          aria-label="Search query"
          placeholder={isRtl ? "ابحث عن قناة أو مجموعة…" : "Search channels and groups…"}
          className={cn(
            "w-full rounded-2xl border border-white/10 bg-white/5 py-4 text-base text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-indigo-400/60 focus:bg-white/[0.07] focus:ring-2 focus:ring-indigo-500/30",
            isRtl ? "pr-12 pl-28" : "pl-12 pr-28",
          )}
        />
        <button
          type="submit"
          className={cn(
            "absolute top-1/2 -translate-y-1/2 rounded-xl bg-gradient-to-r from-indigo-500 to-violet-500 px-5 py-2 text-sm font-semibold text-white shadow-lg shadow-indigo-500/25 transition hover:from-indigo-400 hover:to-violet-400",
            isRtl ? "left-2" : "right-2",
          )}
        >
          Search
        </button>
      </div>
    </form>
  );
}

function SearchIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
      <path
        d="m20 20-3.5-3.5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}
