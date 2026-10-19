interface ErrorStateProps {
  message: string;
  onRetry: () => void;
}

export function ErrorState({ message, onRetry }: ErrorStateProps) {
  return (
    <div className="card-surface flex flex-col items-center rounded-2xl border-red-500/20 bg-red-500/[0.04] px-6 py-16 text-center animate-fade-in">
      <svg
        viewBox="0 0 24 24"
        fill="none"
        className="h-14 w-14 text-red-400/80"
        aria-hidden="true"
      >
        <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.6" />
        <path
          d="M12 8v5m0 3h.01"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
      </svg>
      <h3 className="mt-4 text-lg font-semibold text-slate-100">
        Search failed
      </h3>
      <p className="mt-1.5 max-w-md text-sm text-slate-400">{message}</p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-6 rounded-xl bg-gradient-to-r from-indigo-500 to-violet-500 px-4 py-2 text-sm font-semibold text-white transition hover:from-indigo-400 hover:to-violet-400"
      >
        Try again
      </button>
    </div>
  );
}
