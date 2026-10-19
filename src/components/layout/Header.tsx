export function Header() {
  return (
    <header className="sticky top-0 z-30 border-b border-white/5 bg-slate-950/70 backdrop-blur-lg">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <a href="/" className="flex items-center gap-2.5" aria-label="FindPulse home">
          <PulseLogo />
          <span className="text-lg font-bold tracking-tight text-white">
            Find<span className="gradient-text">Pulse</span>
          </span>
        </a>
        <span className="hidden rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-xs text-slate-400 sm:inline">
          Telegram directory search
        </span>
      </div>
    </header>
  );
}

function PulseLogo() {
  return (
    <span className="relative flex h-9 w-9 items-center justify-center">
      <span className="absolute inline-flex h-9 w-9 animate-pulse-ring rounded-full bg-indigo-500/30" />
      <svg
        viewBox="0 0 24 24"
        fill="none"
        className="relative h-6 w-6 text-indigo-400"
        aria-hidden="true"
      >
        <path
          d="M3 12h3l2.2-6.2 3.2 12.4L14.4 12H21"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}
