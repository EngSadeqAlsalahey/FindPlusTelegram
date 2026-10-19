# FindPulse

Search engine over a **curated directory of public Telegram channels and groups**, exposed through a web app and a Telegram bot that share **one search engine**.

> Scope note: FindPulse searches the **local catalog** (`data/catalog.json`) only. It does not search Telegram posts/messages and does not crawl Telegram. That capability requires MTProto, which is explicitly out of scope for this phase (see `docs/analysis/FINDPULSE_REQUIREMENTS_AND_ARCHITECTURE.md`).

## Stack

- **Next.js 14** (App Router) + React 18 + TypeScript — web UI and API route
- **Tailwind CSS** — styling
- **grammY** — Telegram bot
- **Zod** — schema validation (catalog + search input)
- **Vitest** — tests

Both interfaces import the same engine from `src/core/search`, so search logic exists in exactly one place.

## Getting started

```bash
npm install
cp .env.example .env     # then paste a fresh token from @BotFather
npm run check:catalog    # validate data/catalog.json
npm run check:bot        # verify the token against Telegram (getMe)
```

### Run the web app

```bash
npm run dev              # http://localhost:3000
```

API: `GET /api/search?q=tech&type=all|channel|group&category=&language=&limit=&offset=`

### Run the bot

```bash
npm run bot              # long polling; needs TELEGRAM_BOT_TOKEN
```

Bot usage: send any keyword, or `/search <keyword>`, `/start`, `/help`. Inline buttons open each channel and paginate results.

## Scripts

| Script | Purpose |
| --- | --- |
| `npm run dev` / `npm run build` / `npm run start` | Web app (dev, build, production) |
| `npm run bot` / `npm run bot:dev` | Bot (long polling, watch mode) |
| `npm run check:bot` | Telegram connectivity check via `getMe` |
| `npm run check:catalog` | Validate the catalog file |
| `npm run test` / `npm run test:watch` | Vitest suite |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | `next lint` |

## Project layout

```
src/
  app/                    # Next.js app router (page + /api/search route)
  components/             # UI (layout, search controls, results)
  bot/                    # grammY bot (handlers, keyboards, messages)
  core/
    catalog/              # Zod schema + JSON loader (the data source)
    search/               # SHARED engine: normalize, score, rank, paginate
    telegram/             # URL/format helpers + 64-byte callback payloads
    validation/           # search request schema
  config/  types/  lib/
data/catalog.json         # the directory (sample data)
scripts/                  # catalog + bot checks
tests/                    # catalog, search, parity, telegram, bot
```

## Catalog format

```json
{
  "id": "unique-id",
  "type": "channel | group",
  "title": "Display name",
  "username": "@handle",
  "description": "Short description",
  "category": "Technology",
  "language": "en",
  "country": "US",
  "publicUrl": "https://t.me/handle",
  "verified": true,
  "enabled": true
}
```

`publicUrl` must equal `https://t.me/<username>` and ids/usernames must be unique; the loader rejects anything else at startup. Entries with `"enabled": false` are hidden from search.
