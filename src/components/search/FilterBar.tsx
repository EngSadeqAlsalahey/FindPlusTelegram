import { cn } from "@/lib/cn";

interface FilterBarProps {
  categories: string[];
  languages: string[];
  category: string;
  language: string;
  onCategoryChange: (value: string) => void;
  onLanguageChange: (value: string) => void;
  onReset: () => void;
  hasFilters: boolean;
}

export function FilterBar({
  categories,
  languages,
  category,
  language,
  onCategoryChange,
  onLanguageChange,
  onReset,
  hasFilters,
}: FilterBarProps) {
  return (
    <div className="flex flex-wrap items-center gap-2.5">
      <SelectField
        label="Category"
        value={category}
        onChange={onCategoryChange}
        options={categories}
      />
      <SelectField
        label="Language"
        value={language}
        onChange={onLanguageChange}
        options={languages.map((code) => ({ value: code, label: code.toUpperCase() }))}
      />
      {hasFilters ? (
        <button
          type="button"
          onClick={onReset}
          className="rounded-lg border border-white/10 px-3 py-1.5 text-xs font-medium text-slate-400 transition hover:border-white/20 hover:text-slate-200"
        >
          Reset filters
        </button>
      ) : null}
    </div>
  );
}

interface SelectFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<string | { value: string; label: string }>;
}

function SelectField({ label, value, onChange, options }: SelectFieldProps) {
  return (
    <label
      className={cn(
        "inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs text-slate-400",
        "focus-within:border-indigo-400/50",
      )}
    >
      <span>{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="cursor-pointer bg-transparent text-sm font-medium text-slate-100 outline-none"
      >
        <option value="" className="bg-slate-900">
          Any
        </option>
        {options.map((option) => {
          const opt = typeof option === "string" ? { value: option, label: option } : option;
          return (
            <option key={opt.value} value={opt.value} className="bg-slate-900">
              {opt.label}
            </option>
          );
        })}
      </select>
    </label>
  );
}
