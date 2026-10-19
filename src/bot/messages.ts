import { escapeHtml, truncateText } from "@/core/telegram/format";
import { stripAt } from "@/core/telegram/urls";
import type { CatalogEntry, SearchResult } from "@/types";

const DESCRIPTION_LIMIT = 200;

export const START_TEXT = `
👋 <b>Welcome to FindPulse!</b>

I search a curated directory of <b>public Telegram channels and groups</b>.

Just send me a keyword, for example:
<code>python</code> · <code>tech</code> · <code>تقنية</code>

You can also use <b>/search &lt;keyword&gt;</b>.
`.trim();

export const HELP_TEXT = `
📖 <b>How to use FindPulse</b>

<b>1.</b> Send any keyword as a message, or run <b>/search &lt;keyword&gt;</b>.
<b>2.</b> Tap <b>Open</b> under a result to open its Telegram page.
<b>3.</b> Use <b>Previous / Next</b> to move between result pages.

<b>Commands</b>
/start — welcome menu
/help — this message
/search &lt;keyword&gt; — search the directory

ℹ️ I search a local curated directory, not every channel on Telegram.
`.trim();

export const NO_QUERY_TEXT = `
✏️ Send me a keyword to search, for example:
<code>python</code> · <code>design</code> · <code>تقنية</code>

Or run <b>/search &lt;keyword&gt;</b>.
`.trim();

export const MENU_TEXT = `
<b>FindPulse</b> 🔎

Send me a keyword to search the directory of public channels and groups.

<code>python</code> · <code>tech</code> · <code>تقنية</code>

Or run <b>/search &lt;keyword&gt;</b> / <b>/help</b>.
`.trim();

export function formatNoResultsMessage(query: string): string {
  return `🫥 No results in the directory for “<b>${escapeHtml(
    query,
  )}</b>”.\n\nTry a shorter keyword, or browse the whole directory with the button below.`;
}

const TYPE_LABEL: Record<CatalogEntry["type"], string> = {
  channel: "Channel",
  group: "Group",
};

const TYPE_ICON: Record<CatalogEntry["type"], string> = {
  channel: "📢",
  group: "👥",
};

export function formatSearchResultMessage(result: SearchResult): string {
  const header = result.query
    ? `🔍 <b>${escapeHtml(String(result.total))}</b> ${result.total === 1 ? "result" : "results"} for “<b>${escapeHtml(result.query)}</b>”`
    : `🗂 <b>${escapeHtml(String(result.total))}</b> entries in the directory`;

  const from = result.offset + 1;
  const to = result.offset + result.entries.length;
  const pager =
    result.total > result.limit
      ? `\nShowing ${from}–${to}`
      : "";

  const body = result.entries
    .map((entry, index) => formatEntry(entry, result.offset + index + 1))
    .join("\n\n");

  return `${header}${pager}\n\n${body}`;
}

function formatEntry(entry: CatalogEntry, index: number): string {
  const title = `<b>${index}. ${escapeHtml(entry.title)}</b>${
    entry.verified ? " ✅" : ""
  }`;
  const handle = `@${escapeHtml(stripAt(entry.username))}`;
  const description = entry.description
    ? `\n${escapeHtml(truncateText(entry.description, DESCRIPTION_LIMIT))}`
    : "";
  const meta = `\n📦 ${escapeHtml(entry.category)} · 🌐 ${escapeHtml(
    entry.language.toUpperCase(),
  )} · ${TYPE_ICON[entry.type]} ${TYPE_LABEL[entry.type]}`;

  return `${title}\n${handle}${description}${meta}`;
}
