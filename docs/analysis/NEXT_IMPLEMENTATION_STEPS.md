# FindPulse — Next Implementation Steps

**Date:** 2026-10-02 · **Basis:** Focused verification of the current codebase against `IMPLEMENTATION_REPORT.md` and the approved decisions.

This document records what was actually verified in the code, what is missing, and defines the single next phase. It is not a requirements re-analysis.

---

## 1. Current implementation status

The Phase 1 MVP is **implemented and healthy**. Re-verified live during this assessment:

| Check | Result |
| --- | --- |
| `npm run typecheck` | Clean (strict mode) |
| `npm run lint` | No warnings or errors |
| `npm test` | **65/65 passing** (5 suites) |
| `npm run check:catalog` | Valid — 16 entries, 15 enabled, 9 channels / 6 groups |

Architecture is exactly as approved: one Next.js project with a grammY bot as a second process, both importing a single shared search engine from `src/core/search`. No new layers were added.

### Scope compliance — verified

| Approved constraint | Status | Evidence |
| --- | --- | --- |
| No MTProto | Compliant | No `gramjs`/`mtproto`/`tdlib` in `package.json` or `package-lock.json` |
| No database | Compliant | No `prisma`/`pg`/`mongoose`/`sqlite`/`mysql`/`drizzle`/`typeorm` in dependencies or lockfile |
| No Redis | Compliant | No `ioredis`/`redis` anywhere in the source tree |
| No customer data persistence | Compliant | Search is stateless; no analytics, query logging, or storage modules exist |
| Bot API only | Compliant | Telegram access is exclusively grammY (Bot API); no client sessions |
| Lightweight / Windows-local | Compliant | Node scripts only; no native modules or containers required |

### Token security — verified

- The token is read from `TELEGRAM_BOT_TOKEN` via a Zod-validated env module (`src/config/index.ts:11`) — it is never hardcoded, and no JSON file contains it.
- The token variable appears in only two places in the whole codebase: the env schema and an error *message string* in `src/bot/index.ts:22` (the literal name, never the value).
- No `.env` file exists in the repo, and `.gitignore:24-26` ignores `.env`, `.env.local`, `.env.*.local` — so no secret can be committed.
- **No token leak to the browser:** only one client component exists (`src/app/page.tsx`, `"use client"`). Its full import graph (`@/core/search/normalize`, `@/components/*`, `@/types`, `@/lib/cn`, `@/core/telegram/urls`) was traced — none of these reaches `@/config` or `@/bot/*`, so the token cannot enter the client bundle.

### Shared search — verified

Both interfaces provably use one engine:

- Web: `src/app/api/search/route.ts:2` → `buildSearchResponse` (`src/core/search/web-handler.ts:21`) → `search()`.
- Bot: `src/bot/handlers/search.ts:2,37` → `buildBotSearchRequest` → the same `search()`.
- `tests/parity.test.ts` asserts the two adapters produce identical engine requests and identical result sequences.

---

## 2. Verified working features

**Web**
- Search box, All/Channels/Groups tabs, category + language filters populated from the catalog
- Result cards: title, `@username`, description, type badge, category/language/country, verified mark, **Open in Telegram**
- Loading skeleton, empty state, error state with retry, offset/limit pagination
- Responsive layout; `dir="rtl"` flips when the query is Arabic
- `GET /api/search` with Zod validation; oversize/invalid input returns HTTP 400

**Shared engine**
- Title / username / description matching; case-insensitive; Arabic + English
- Arabic normalization (diacritics, tatweel, alef/ya/ta-marbuta unification)
- Type / category / language filters, relevance ranking, deterministic tie-breaks
- Disabled entries hidden from results

**Bot**
- `/start`, `/help`, `/search <keyword>`, free-text messages, **Browse directory** menu
- Per-result **Open** URL buttons, **Previous/Next** pagination (≤64-byte `callback_data`), **Menu** button
- Empty-results message, typing indicator, HTML escaping, query-length truncation notice

**Catalog**
- Unified channel/group model with all approved fields
- Zod validation: `publicUrl`/username cross-check, unique ids, unique usernames; bad data aborts startup
- 16 clearly-labelled sample entries, bilingual, one intentionally disabled

---

## 3. Missing features

| # | Gap | Why it matters |
| --- | --- | --- |
| **M1** | **No indexed public posts search.** The approved scope lists "public channels, public groups, **and their indexed public posts**"; the engine searches channels/groups only — there is no posts record type in the catalog or engine. | Direct scope gap against the approved search scope. Since MTProto is banned and the Bot API cannot read history, posts must be stored in the local catalog as an index. |
| **M2** | **Inline mode not implemented.** `@FindPulseBot <query>` typing-anywhere search is absent, and it is not enabled via @BotFather. | Listed as a required bot capability in the approved analysis; it is the highest-value bot surface after commands. |
| **M3** | **Bot never connected to live Telegram.** `TELEGRAM_BOT_TOKEN` is not set in this environment, so `getMe`, `/start`, and a real `/search` round-trip have never run. | The only untested integration. All bot logic is verified offline, but network behaviour is unproven. |
| **M4** | Sample data only (`findpulse_sample_*` fictional handles). | Must be replaced with a verified directory before any real use. |
| **M5** | Long polling only; no webhook. | Acceptable for single-instance local dev; needs HTTPS hosting if scaled. |

**Deliberately out of scope (per decisions):** posts *crawled* from Telegram, user accounts, subscriptions, dashboard, caching layer.

---

## 4. Existing errors

No runtime or compile-time errors exist — typecheck, lint, tests, and catalog validation are all clean. One **latent test defect** was found:

- **`tests/parity.test.ts:42-62` returns inside the `for` loop.** The test asserts web↔bot equality for six queries, but `return runBotSearch(...)` on line 54 exits after the **first** query (`"tech"`). The other five queries — including the Arabic `تقنية`, the `@username` form, and the no-match case — are silently never asserted. The implementation is correct, but the parity guarantee is under-tested on exactly the cases that matter most.

This is the only defect identified. It is test-only and does not affect product behaviour.

---

## 5. Exact next implementation phase

### Phase 2 — Posts index + inline mode

**Goal:** close the two scope gaps M1 and M2 while keeping one shared engine, then complete the live connectivity test (M3).

**Scope discipline:** no new services, no database, no Redis. Posts are stored as a second record type inside the existing JSON catalog. The engine gains a posts search mode; both interfaces expose it. Inline mode is added to the existing bot process.

#### Work items

1. **Fix the parity test loop** (`tests/parity.test.ts`) so all six queries are asserted (replace the early `return` with `await` + accumulation).
2. **Catalog posts model** — add a `post` entry type in `src/core/catalog/schema.ts` with fields `id`, `type: "post"`, `sourceId` (the channel/group id), `text`, `date`, `publicUrl` (canonical `t.me/<channel>/<messageId>`), `language`, `enabled`; keep the existing cross-field URL rule and uniqueness checks. Add sample posts under existing channels.
3. **Engine posts mode** — extend `src/core/search/engine.ts` and `score.ts` with post scoring (text match, recency tie-break). Extend `SearchType` to `all | channel | group | post`. Keep channel/group behaviour byte-for-byte identical.
4. **Web surface** — add a **Posts** tab; a post card renders text snippet, source channel link, and date.
5. **Inline mode** — register `bot.inlineQuery(...)` in `src/bot/index.ts`, a handler in `src/bot/handlers/inline.ts` using `answerInlineQuery` with `InlineQueryResultArticle` (title = source, description = snippet, url = post link), paginated by `offset`. Reuse the same engine.
6. **Live connectivity** — paste the new token into `.env`, run `npm run check:bot`, then a real `/start`, `/search`, and inline round-trip.
7. **Docs** — update `README.md` and `IMPLEMENTATION_REPORT.md`.

#### Files that need modification

| File | Change |
| --- | --- |
| `tests/parity.test.ts` | Fix the early `return`; assert all queries (and add post queries) |
| `src/core/catalog/schema.ts` | Add `post` entry type + URL cross-field rule |
| `data/catalog.json` | Add sample posts linked to existing channels |
| `src/types/index.ts` | Extend `EntryType`/`SearchType` with `post`; add `CatalogPost` |
| `src/core/search/score.ts` | Post scoring (text match + recency) |
| `src/core/search/engine.ts` | Include posts when `type` allows; keep existing ranking stable |
| `src/core/search/web-handler.ts` | Pass post results through unchanged shape |
| `src/app/page.tsx` + `src/components/search/TypeTabs.tsx` | **Posts** tab |
| `src/components/results/ResultCard.tsx` | Post card variant (snippet, source link, date) |
| `src/bot/index.ts` | Register `bot.inlineQuery` |
| `src/bot/handlers/inline.ts` | **New** — `answerInlineQuery` handler reusing the engine |
| `src/bot/messages.ts` | Post formatting for inline/article results |
| `src/core/validation/search.ts` | Extend `type` enum to include `post` |
| `README.md`, `IMPLEMENTATION_REPORT.md` | Document posts + inline mode |

**Not modified:** catalog loader internals, URL/format helpers, keyboards, config, lint/build setup.

---

## 6. Acceptance criteria for Phase 2

1. `npm test` passes with **≥ 75 tests**, including new suites for post search and inline-result building, and the fixed parity test asserting **all** listed queries (verified by asserting no early return).
2. `npm run typecheck` and `npm run lint` remain clean.
3. `npm run build` succeeds and `GET /api/search?q=python&type=post` returns only post records with correct source links.
4. Searching for a channel/group returns **identical results before and after Phase 2** (regression guard on existing behaviour).
5. Every post's `publicUrl` validates as `https://t.me/<channel>/<messageId>` and its `sourceId` resolves to an existing catalog entry.
6. Inline query returns up to 20 `InlineQueryResultArticle` items per call, each with a working `url`, and pagination via `offset` does not repeat items.
7. `npm run check:bot` prints `✓ Telegram reachable`, and a live `/start`, `/search <keyword>`, and `@FindPulseBot <keyword>` round-trip all succeed against the real bot.
8. No database, Redis, or MTProto dependency is introduced — re-verified by inspecting `package.json` and `package-lock.json` at the end of the phase.
9. Sample data remains clearly marked as SAMPLE DATA with fictional handles.

---

## 7. Prerequisite before Phase 2 coding

A **fresh `TELEGRAM_BOT_TOKEN`** must be created via @BotFather (the previously shown token is revoked and must not be reused). Without it, criterion 7 cannot be met and the bot remains unverified against the live API.
