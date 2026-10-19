import { stripAt } from "@/core/telegram/urls";
import { cn } from "@/lib/cn";
import type { CatalogEntry } from "@/types";

const TYPE_STYLES: Record<CatalogEntry["type"], string> = {
  channel: "bg-sky-500/15 text-sky-300 ring-sky-500/30",
  group: "bg-emerald-500/15 text-emerald-300 ring-emerald-500/30",
};

const TYPE_LABEL: Record<CatalogEntry["type"], string> = {
  channel: "Channel",
  group: "Group",
};

const TYPE_ICON: Record<CatalogEntry["type"], string> = {
  channel: "📢",
  group: "👥",
};

export function ResultCard({ entry, index }: { entry: CatalogEntry; index: number }) {
  return (
    <article className="card-surface group animate-fade-in rounded-2xl p-5 transition duration-200 hover:border-white/20 hover:bg-white/[0.06]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span
              className={cn("chip", TYPE_STYLES[entry.type])}
              title={TYPE_LABEL[entry.type]}
            >
              <span className="mr-1" aria-hidden="true">
                {TYPE_ICON[entry.type]}
              </span>
              {TYPE_LABEL[entry.type]}
            </span>
            {entry.verified ? (
              <span
                className="inline-flex items-center text-sky-400"
                title="Verified listing"
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  className="h-4 w-4"
                  aria-label="Verified"
                >
                  <path d="M12 2 9.4 4.6 5.8 4.2 4.5 7.6 1.3 9.5 2.8 12.9 1.3 16.3 4.5 18.2 5.8 21.6 9.4 21.2 12 23.8 14.6 21.2 18.2 21.6 19.5 18.2 22.7 16.3 21.2 12.9 22.7 9.5 19.5 7.6 18.2 4.2 14.6 4.6 12 2Zm-1.2 14.4-3.6-3.6 1.4-1.4 2.2 2.2 5-5 1.4 1.4-6.4 6.4Z" />
                </svg>
              </span>
            ) : null}
          </div>
          <h3 className="mt-2 truncate text-lg font-semibold text-white">
            {entry.title}
          </h3>
          <p className="truncate text-sm text-slate-400" dir="ltr">
            @{stripAt(entry.username)}
          </p>
        </div>
        <span className="shrink-0 text-xs text-slate-600">{index}</span>
      </div>

      {entry.description ? (
        <p
          className="mt-3 line-clamp-3 text-sm leading-relaxed text-slate-300"
          dir="auto"
        >
          {entry.description}
        </p>
      ) : null}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <span className="chip bg-white/[0.06] text-slate-300 ring-white/10">
          📦 {entry.category}
        </span>
        <span className="chip bg-white/[0.06] text-slate-300 ring-white/10">
          🌐 {entry.language.toUpperCase()}
        </span>
        {entry.country ? (
          <span className="chip bg-white/[0.06] text-slate-300 ring-white/10">
            📍 {entry.country}
          </span>
        ) : null}
      </div>

      <div className="mt-5 flex">
        <a
          href={entry.publicUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 rounded-xl bg-white/5 px-4 py-2 text-sm font-medium text-sky-300 ring-1 ring-inset ring-sky-500/25 transition hover:bg-sky-500/10 hover:text-sky-200"
        >
          <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4" aria-hidden="true">
            <path d="M9.7 15.3a1 1 0 0 0 0 1.4l4.6 4.6a10 10 0 0 0 6.5-17.1 10 10 0 0 0-17 6.6l4.6 4.5Zm7.7-7.7a1.6 1.6 0 1 1-2.3 2.3 1.6 1.6 0 0 1 2.3-2.3Z" />
          </svg>
          Open in Telegram
        </a>
      </div>
    </article>
  );
}
