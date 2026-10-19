interface PaginationProps {
  offset: number;
  limit: number;
  total: number;
  onPageChange: (offset: number) => void;
}

export function Pagination({ offset, limit, total, onPageChange }: PaginationProps) {
  const currentPage = Math.floor(offset / limit) + 1;
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const hasPrev = offset > 0;
  const hasNext = offset + limit < total;

  if (total === 0) return null;

  return (
    <nav
      className="mt-8 flex items-center justify-center gap-3"
      aria-label="Pagination"
    >
      <button
        type="button"
        onClick={() => onPageChange(Math.max(0, offset - limit))}
        disabled={!hasPrev}
        className="rounded-xl border border-white/10 px-4 py-2 text-sm font-medium text-slate-200 transition enabled:hover:border-white/20 enabled:hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-40"
      >
        ← Previous
      </button>
      <span className="text-sm text-slate-400" aria-live="polite">
        Page <span className="font-semibold text-slate-100">{currentPage}</span> of{" "}
        <span className="font-semibold text-slate-100">{totalPages}</span>
      </span>
      <button
        type="button"
        onClick={() => onPageChange(offset + limit)}
        disabled={!hasNext}
        className="rounded-xl border border-white/10 px-4 py-2 text-sm font-medium text-slate-200 transition enabled:hover:border-white/20 enabled:hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-40"
      >
        Next →
      </button>
    </nav>
  );
}
