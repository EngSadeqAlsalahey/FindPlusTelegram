export function LoadingSkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-2" aria-busy="true" aria-live="polite">
      {Array.from({ length: 6 }).map((_, index) => (
        <div
          key={index}
          className="card-surface animate-pulse rounded-2xl p-5"
        >
          <div className="flex gap-3">
            <div className="h-6 w-20 rounded-full bg-white/10" />
            <div className="h-6 w-6 rounded-full bg-white/10" />
          </div>
          <div className="mt-4 h-5 w-2/3 rounded bg-white/10" />
          <div className="mt-2 h-4 w-1/3 rounded bg-white/10" />
          <div className="mt-4 h-3 w-full rounded bg-white/[0.07]" />
          <div className="mt-2 h-3 w-4/5 rounded bg-white/[0.07]" />
          <div className="mt-5 h-9 w-36 rounded-xl bg-white/[0.07]" />
        </div>
      ))}
      <span className="sr-only">Loading results…</span>
    </div>
  );
}
