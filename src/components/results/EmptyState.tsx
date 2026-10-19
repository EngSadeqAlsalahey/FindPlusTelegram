interface EmptyStateProps {
  query: string;
  onBrowse: () => void;
}

export function EmptyState({ query, onBrowse }: EmptyStateProps) {
  return (
    <div className="card-surface flex flex-col items-center rounded-2xl px-6 py-16 text-center animate-fade-in">
      <svg
        viewBox="0 0 24 24"
        fill="none"
        className="h-14 w-14 text-slate-600"
        aria-hidden="true"
      >
        <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="1.6" />
        <path
          d="m20 20-3.6-3.6M8.5 11h5"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
        />
      </svg>
      <h3 className="mt-4 text-lg font-semibold text-slate-100">
        No results found
      </h3>
      <p className="mt-1.5 max-w-md text-sm text-slate-400" dir="auto">
        {query ? (
          <>
            Nothing in the directory matches{" "}
            <span className="font-medium text-slate-200">“{query}”</span>. Try a
            shorter keyword, a different language, or clear your filters.
          </>
        ) : (
          "The directory has no enabled entries yet."
        )}
      </p>
      <button
        type="button"
        onClick={onBrowse}
        className="mt-6 rounded-xl border border-white/10 px-4 py-2 text-sm font-medium text-slate-200 transition hover:border-white/20 hover:bg-white/5"
      >
        Browse the whole directory
      </button>
    </div>
  );
}
