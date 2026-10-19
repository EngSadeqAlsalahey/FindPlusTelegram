# FindPulse — Requirements & Technical Architecture

**Document type:** Engineering analysis & architecture proposal (planning phase only — no implementation)
**Project:** FindPulse — Search engine for public Telegram content
**Status:** Draft v1.0 — **awaiting approval before implementation begins**
**Date:** 2026-10-01

---

## 0. How to read this document

This document separates three kinds of statements throughout. This distinction is deliberate and is a hard requirement from the project brief (Rule 9: "separate confirmed facts from assumptions and proposed options").

| Marker | Meaning |
| --- | --- |
| **[FACT]** | Confirmed by official Telegram documentation or by a decision already recorded in the approved decisions table. |
| **[CONSTRAINT]** | A hard technical or product limitation that cannot be worked around within the current scope. |
| **[PROPOSED]** | An architecture option or recommendation. reversible until implemented. |
| **[OPEN]** | An open question requiring a human decision before or during implementation. |

The single most important conclusion of this analysis is stated up front in §1 and proven in §4 and §6: **the Telegram Bot API contains no search capability whatsoever.** Everything else in this document is engineered around that fact.

---

## 1. Executive Summary

FindPulse is a search engine over public Telegram content, exposed through two front-ends — a web application and a Telegram bot — that must share one search engine and must not duplicate search logic.

**The central technical finding:** Telegram's Bot API (the HTTP API addressed with a Bot Token) provides **no method to search public channels, public groups, or public messages**. There is no `searchPublicChats`, no `searchMessages`, and no equivalent. Possessing a valid Bot Token (verified: `getMe` → `ok: true`) proves only that the bot identity exists and can send/receive messages. It does **not** grant any global search privilege. **[FACT][CONSTRAINT]**

Consequently the original product vision — "search all public Telegram content" — **cannot be delivered with the Bot API alone.** It requires MTProto (the full client protocol), which the project has explicitly deferred to a later phase. **[CONSTRAINT]**

**The proposed resolution:** build FindPulse Phase 1 as a **directory/catalog search engine** over a curated set of public channels and groups, with metadata enriched live via the Bot API's `getChat` / `getChatMemberCount`. The architecture is built around a `SearchProvider` interface so that an MTProto provider can be plugged in later **without touching the web interface, the bot, or the search engine's core** — unlocking true global search when the project is ready. **[PROPOSED]**

**Scope honesty table:**

| Feature | Bot API alone (Phase 1) | Requires MTProto (later) |
| --- | --- | --- |
| Search public channels by name/keyword | Only within a curated catalog | Global search |
| Search public groups by name/keyword | Only within a curated catalog | Global search |
| Search public posts/messages | **Not possible** | Yes (`help.search`, `messages.search`) |
| Live channel metadata (title, bio, members) | Yes (`getChat`, `getChatMemberCount`) | Yes |
| Bot UI: commands, inline mode, pagination | Yes | Yes |

**Architecture in one line:** a **single Node.js + TypeScript process** (Fastify) that serves the web API, the static web front-end, and the Telegram bot webhook, all importing **one shared search-engine module** that talks to Telegram through **one integration layer** with a shared rate-limit/concurrency budget. No database, no Redis, no accounts, no microservices. **[PROPOSED]**

**Immediate decisions requested (details in §18):**
1. Accept the curated-catalog scope for Phase 1 (vs. declaring global search a hard requirement, which forces MTProto into Phase 1).
2. Confirm the single-process Fastify architecture and the grammy bot library.
3. Confirm the posts/messages feature is deferred to the MTProto phase (or explicitly descope it).
4. Provide hosting + HTTPS domain details, since a webhook requires a public HTTPS endpoint.

---

## 2. Functional Requirements

### 2.1 Confirmed project decisions (from the approved decisions table)

These are **[FACT]** — recorded decisions, not to be re-litigated:

| Decision | Value |
| --- | --- |
| Project name | FindPulse |
| Interfaces | Web application + Telegram bot |
| Search scope | Public Telegram content |
| Development method | Parallel development |
| Bot technology | Telegram Bot API |
| Bot creation | Created via BotFather; Token obtained successfully |
| `getMe` connectivity test | `ok: true` |
| MTProto | Not required in Phase 1 |
| Database | Not required initially |
| Redis | Not required |
| User registration | Not required |
| Login / authentication | Not required |
| Subscription system | Not required |
| Storing customer data | Not required |

**Architectural constraint (from the brief):** do not add a database, Redis, an account system, microservices, or a distributed design unless a concrete proven need exists. The product must stay simple and incrementally scalable, not enterprise-complex. **[CONSTRAINT]**

### 2.2 Functional requirements — Web interface

| ID | Requirement | Phase 1 feasible? |
| --- | --- | --- |
| W-01 | Home page with a prominent search box | Yes |
| W-02 | Search for public channels by keyword | Yes — catalog scope |
| W-03 | Search for public groups by keyword | Yes — catalog scope |
| W-04 | Search for public posts/messages | **No — deferred (§4.4)** |
| W-05 | Display result title (channel/group name) | Yes |
| W-06 | Display @username and source link (`https://t.me/<username>`) | Yes |
| W-07 | Display channel/group description/bio | Yes |
| W-08 | Display member count | Yes |
| W-09 | Display channel profile photo | Yes |
| W-10 | Display post text + publish date | **Deferred with W-04** |
| W-11 | Loading state during search | Yes |
| W-12 | Empty-results state | Yes |
| W-13 | Error state (Telegram failures, timeouts, rate limits) | Yes |
| W-14 | Responsive layout (mobile + desktop) | Yes |
| W-15 | Pagination of results | Yes — in-memory (§6.5) |
| W-16 | Filters (category, min members, language if catalog provides) | Yes |
| W-17 | Sorting (relevance, members, name) | Yes |
| W-18 | Deep-linkable search URL (`/?q=...&type=channels`) | Yes |

### 2.3 Functional requirements — Telegram bot

| ID | Requirement | Phase 1 feasible? |
| --- | --- | --- |
| B-01 | `/start` — welcome + usage guidance | Yes |
| B-02 | `/help` — full command reference | Yes |
| B-03 | `/search <query>` — general search | Yes — catalog scope |
| B-04 | `/channels <query>` — channels only | Yes |
| B-05 | `/groups <query>` — groups only | Yes |
| B-06 | `/posts <query>` — posts search | **No — deferred (§4.4)** |
| B-07 | Free-text message search (no command) | Yes |
| B-08 | Inline mode (`@FindPulseBot <query>` in any chat) | Yes — requires enabling via @BotFather |
| B-09 | Paginated results with Previous/Next inline buttons | Yes |
| B-10 | Each result opens the source `t.me` link | Yes |
| B-11 | Handling of invalid/empty input | Yes |
| B-12 | Telegram error handling (429, timeouts, failures) | Yes |

### 2.4 Functional requirements — Shared search engine

| ID | Requirement |
| --- | --- |
| S-01 | One search entry point used by **both** interfaces — search logic exists in exactly one place |
| S-02 | Typed request/response model shared by web, bot, and engine |
| S-03 | Category filtering (channels / groups) |
| S-04 | Pagination (offset/limit) |
| S-05 | Sorting (relevance default) |
| S-06 | Provider abstraction so the data source (catalog now, MTProto later) can be swapped without changing interfaces |
| S-07 | Normalized result objects (title, username, description, memberCount, type, photo, url, extra metadata) |
| S-08 | Input validation (query length, charset, normalization) |
| S-09 | Never stores user data or queries |

---

## 3. Non-Functional Requirements

| Category | Requirement |
| --- | --- |
| Simplicity | One process, one deployment unit, one codebase. No service-to-service network hops in Phase 1. |
| Extensibility | Adding MTProto, a database, or Redis later must not require rewriting interfaces or the engine core. |
| No-duplication | Search logic implemented exactly once; both interfaces consume it. |
| Latency | First result to UI in well under ~1.5s for cached catalog hits; Telegram enrichment calls are the main variable cost. |
| Availability | Graceful degradation: if Telegram is slow/down, the web API returns a clean error, never a hang. |
| Security | Bot Token lives only in server-side environment variables; never shipped to the front-end. |
| Privacy | Stateless. No user accounts, no query logging, no persistence of user data. |
| Maintainability | TypeScript end-to-end; schema-validated boundaries; small, focused modules. |
| Operability | Single health-check endpoint, structured logs to stdout, graceful shutdown. |
| Cost | Runs on the smallest available VPS/container; no managed DB or cache in Phase 1. |

---

## 4. Telegram Bot API Analysis

The Bot API is a simplified HTTP wrapper around Telegram's MTProto protocol, addressed as `https://api.telegram.org/bot<TOKEN>/<METHOD>`. The bot identity was verified via `getMe` → `ok: true`. **[FACT]**

### 4.1 What the bot *can* do with the Bot API

| Capability | Method(s) | Notes |
| --- | --- | --- |
| Confirm bot identity | `getMe` | Done. Returns id, username, name. **[FACT]** |
| Receive user commands/messages | `getUpdates` (long polling) or `setWebhook` + HTTPS endpoint | Mutually exclusive: a bot uses exactly one. **[FACT]** |
| Send replies, menus, media | `sendMessage`, `sendPhoto`, `sendChatAction`, … | Bots can only message users who have **already started** the conversation. **[FACT]** |
| Rich formatting | `parse_mode` = `MarkdownV2` / `HTML` | Needed for clickable `t.me` links in results. |
| Command menu registration | `setMyCommands` | Populates the Telegram command picker. |
| **Inline mode** (search inside any chat) | `answerInlineQuery` | **Must be enabled per-bot via @BotFather → Bot Settings → Inline Mode.** Up to **50 results** per answer; `offset` string passed back for pagination; `cache_time` controls server-side caching. **[FACT]** |
| Paginated menus | Inline keyboards + `answerCallbackQuery` | `callback_data` is limited to **64 bytes** — pagination payloads must be compact. **[FACT]** |
| **Public chat info by @username** | `getChat` | Works for public channels/supergroups by username without membership; returns title, username, `description`, photo, invite link, etc. **[FACT]** |
| **Public chat member count** | `getChatMemberCount` | Separate call. **[FACT]** |
| Chat admins / member status | `getChatAdministrators`, `getChatMember` | Useful for enrichment. |
| Receive new channel posts | Via updates, **only if the bot is a member** of that channel | Read §4.4 for the implication on posts search. |

### 4.2 How the bot receives commands and messages

Two transport modes; pick one per environment: **[FACT]**

- **Long polling** — `getUpdates` with a `timeout` (max 50s) and an `offset` cursor. Simplest for local dev; no public endpoint needed. Cannot run alongside a webhook.
- **Webhook** — `setWebhook` pointing at a **public HTTPS** URL (self-signed certs are acceptable to Telegram). Telegram POSTs each update. Supported ports: 443, 80, 88, 8443. Recommended for production: lower latency, no polling loop.

In both cases an Update object carries `message` (commands/text) and/or `callback_query` (button taps) and/or `inline_query` (inline search).

### 4.3 Inline keyboards and result display

- **Inline keyboards** attached to a `sendMessage` are the pagination mechanism: `[ Previous ] [ Next ]` buttons carry compact `callback_data`; tapping fires `callback_query`, answered with `answerCallbackQuery` and an edited message showing the new page.
- **Inline-mode results** use `InlineQueryResultArticle` (id, title, description, thumb_url, `url` → opens the `t.me` link). Results must have **unique ids**. The "switch to inline" / "switch inline query (current chat)" button types let users chain a search into a chat — a strong UX fit for FindPulse.
- **Message length limit: 4096 characters** per `sendMessage`. Result lists must be chunked, and long descriptions truncated. **[FACT]**

### 4.4 What the bot *cannot* do — the critical limitation

**There is no search method in the Bot API.** Specifically: **[FACT][CONSTRAINT]**

1. **No global channel/group search.** No method enumerates or searches public chats by keyword. (`contacts.search` / `help.search` exist only in MTProto.)
2. **No message-history access.** There is **no `getHistory` / `getMessages` equivalent** in the Bot API. A bot cannot list past messages of a channel — not even one it has joined. It only *receives new posts* as updates after joining.
3. **No joining public chats autonomously.** Bots cannot search-and-join; they must be added by an admin or a user. So a bot cannot self-enroll into channels to harvest content.
4. **No global post/message search** under any condition with the Bot API.

**Direct consequence:** the FindPulse feature "search public posts & messages" (W-04, W-10, B-06) is **not implementable with the Bot API alone**. It is deferred to the MTProto phase. Likewise, "search all public channels/groups" reduces to "search a set of channels the project already knows about."

### 4.5 Bot API rate limits and quotas

Telegram does not publish official numbers, but the following are well established in practice: **[FACT, empirically]**

- Roughly **30 messages/second** aggregate to *different* chats; **~1 message/second** to the *same* chat; stricter limits apply in groups.
- Non-message methods (e.g. `getChat`) are more permissive but **will** return `429 Too Many Requests` with a `retry_after` field under sustained load.
- `429` responses are authoritative: the engine must read `retry_after` and back off — not retry immediately.

Because limits are undocumented, the architecture treats them as a first-class operational concern (§11) rather than an afterthought.

### 4.6 What the `getMe` success actually proves

Only that: the token is valid, the bot exists, and the network path to `api.telegram.org` works. It grants **no** search scope, **no** access to other users' chats, and **no** content enumeration rights. Any design assuming "Bot Token ⇒ global search" is invalid. **[FACT]**

---

## 5. Telegram MTProto Analysis (future option — not for Phase 1)

Per the approved decisions, MTProto is out of scope for Phase 1. This section analyzes it as a future option so the architecture is designed to accept it. It must not be set up, keyed, or configured now. **[CONSTRAINT]**

### 5.1 Bot API vs MTProto

| Dimension | Bot API | MTProto |
| --- | --- | --- |
| Protocol | HTTPS JSON wrapper | Full binary TLS-protected client protocol |
| Auth credential | Bot Token | API ID + API Hash (+ Bot Token or user session) |
| Coverage | Small, bot-focused subset | Essentially everything a Telegram client can do |
| Global search | **None** | `contacts.search` (chats/users), `help.search` (channels + **posts**), `messages.search` (per-chat, incl. global flag) |
| Message history | Not available | Available (readable for accessible chats) |
| Complexity | Trivial | High (encryption, sessions, reconnection, layers) |
| Rate limiting | HTTP `429` + `retry_after` | MTProto `FLOOD_WAIT_X` (seconds to wait), ban risk on abuse |
| Libraries (Node) | Any HTTP client; grammy/Telegraf wrappers | GramJS (`telegram`), tdlib bindings |

### 5.2 When MTProto becomes necessary

- Global search of public channels/groups **beyond a curated catalog**.
- Any **post/message search** at all.
- Reading message history of public channels (via a user session that joins them).
- Any metadata at scale that catalog curation cannot cover.

**Trigger rule:** MTProto becomes necessary the moment "search all of Telegram" is a hard requirement rather than a nice-to-have. **[CONSTRAINT]**

### 5.3 Can MTProto run separately from the bot?

Yes, and the proposed architecture assumes it will. **[PROPOSED]** MTProto would run as an independent process/service exposing a small internal API (or a local queue/IPC), while the bot stays on the Bot API. The two are decoupled by the `SearchProvider` interface (§7.3): the web and bot layers never know which provider answered. This isolation also contains blast radius — an MTProto session problem can never take down command handling.

### 5.4 API ID / API Hash vs Bot Token

| | Bot Token | API ID + API Hash |
| --- | --- | --- |
| Identifies | One specific bot | One **application** (obtained at `my.telegram.org`) |
| Scope | Bot API (and MTProto bot login) | Required for **any** MTProto client, user or bot |
| Sensitivity | Secret — rotate via BotFather | Secret — tied to the app account; leaks risk app-level suspension |
| Obtained from | @BotFather | `my.telegram.org` → API development tools |

A MTProto deployment needs **all three**: API ID, API Hash, and either a Bot Token or a user-session auth key.

### 5.5 User sessions

A MTProto user session authenticates as a **real person** (phone number → login code → password if 2FA). It yields the broadest reach (join public channels, read history, global search) but carries the highest risk. **[FACT]**

- The session's auth key is the equivalent of a stolen account — it must be stored encrypted at rest, with restrictive file permissions, never logged, and never committed.
- **Scraping/automated collection of public content conflicts with Telegram's Terms of Service.** Mass collection can lead to session termination or account ban. FLOOD_WAIT errors are the warning sign.
- FLOOD_WAIT handling, request pacing, and human-like cadence are mandatory, not optional.

### 5.6 MTProto security requirements (when added)

- API ID/Hash and session files in environment/secrets, never in the repo.
- Encrypt session files at rest; restrict to the service account only.
- Never log tokens, auth keys, phone numbers, or codes.
- Run MTProto in its own process with its own limited network egress policy.
- Implement FLOOD_WAIT backoff and a hard daily request ceiling.
- Legal/ToS review before scraping at scale. **[CONSTRAINT]**

---

## 6. API Capabilities & Limitations Matrix

Legend: ✅ supported · ❌ not supported · ⚠️ supported with caveats

| Capability | Bot API (Phase 1) | MTProto (future) |
| --- | --- | --- |
| Get bot identity (`getMe`) | ✅ | ✅ |
| Receive commands / text / button taps | ✅ | ✅ |
| Inline-mode (`@bot query`) results | ✅ (≤50/answer; must enable via @BotFather) | ✅ |
| Send messages to users | ✅ (only users who started the bot) | ✅ (same rule for bots) |
| Rich formatting + links | ✅ (4096-char cap) | ✅ |
| Public channel info by @username | ✅ `getChat` | ✅ |
| Public channel member count | ✅ `getChatMemberCount` | ✅ |
| Channel profile photo | ✅ (via `getFile`) | ✅ |
| **Global search: public channels** | ❌ | ✅ `contacts.search`, `help.search` |
| **Global search: public groups** | ❌ | ✅ `contacts.search`, `help.search` |
| **Global search: public posts/messages** | ❌ | ✅ `help.search`, `messages.search` |
| Read history of a public channel (not joined) | ❌ | ✅ (user session joins it) |
| Read history of a chat the bot is in | ❌ (no history method) | ✅ |
| Autonomously join public chats | ❌ (must be added) | ✅ (user session) |
| Receive new channel posts | ⚠️ only if the bot is a member | ✅ |
| Rate-limit signaling | HTTP 429 + `retry_after` | `FLOOD_WAIT_X` |
| Setup effort | Low | High |

**Reading of the matrix:** every row that FindPulse's core value depends on — global channel/group/post search — is ❌ under the Bot API. This is the definitive answer to "what can we actually build with the Bot API?" and the reason Phase 1 is scoped to a curated catalog with an MTProto-ready provider seam. **[CONSTRAINT]**

---

## 7. Final Proposed Architecture

### 7.1 Does the project need a separate backend?

**No.** Given the constraints — no database, no Redis, no accounts, no inter-service state — a **single Node.js process** is sufficient and superior: zero network hops, one deploy unit, one place to apply rate limits, and a guaranteed single implementation of search logic (imported, not re-implemented). A separate backend service is justified only when a second persistent stateful component appears — which the decisions table explicitly excludes for now. **[PROPOSED]**

### 7.2 Architecture overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                    ONE Node.js + TypeScript PROCESS                 │
│                                                                     │
│  ┌────────────────────┐         ┌────────────────────────────────┐   │
│  │  WEB INTERFACE     │         │  TELEGRAM BOT INTERFACE        │   │
│  │  (React static     │         │  (grammy)                      │   │
│  │   build + Tailwind)│         │  commands · inline · callbacks │   │
│  └────────┬───────────┘         └───────────────┬────────────────┘   │
│           │  HTTP /api/search                    │ in-process call    │
│           ▼                                     ▼                    │
│  ┌─────────────────────────────────────────────────────────────────┐ │
│  │              SHARED SEARCH ENGINE  (one implementation)         │ │
│  │   validation · category filter · ranking · pagination · sorting │ │
│  │               talks to any SearchProvider (pluggable)           │ │
│  └────────────────────────────┬────────────────────────────────────┘ │
│                               ▼                                      │
│  ┌─────────────────────────────────────────────────────────────────┐ │
│  │              TELEGRAM INTEGRATION LAYER                         │ │
│  │  Bot API client · rate limiter · concurrency queue · TTL cache  │ │
│  │  timeouts · 429 backoff · error translation                     │ │
│  └────────────────────────────┬────────────────────────────────────┘ │
└───────────────────────────────┼──────────────────────────────────────┘
                                ▼
                    https://api.telegram.org/bot<TOKEN>/
```

### 7.3 Communication mechanisms

| Path | Mechanism | Rationale |
| --- | --- | --- |
| Web → Search engine | Direct in-process function call from the Fastify route handler to `engine.search(request)` | Zero serialization cost; impossible to diverge from the engine contract. |
| Bot → Search engine | Direct in-process call from the grammy handler to the same `engine.search(request)` | Guarantees identical behavior to the web UI. |
| Engine → Telegram | Via the Telegram Integration Layer (one Bot API client) | A single shared concurrency/rate budget for both interfaces, one cache, one place for retries. |

The web front-end never calls Telegram directly and never sees the Bot Token. It only calls our own `/api/search`. **[CONSTRAINT — security]**

### 7.4 The provider seam (how MTProto slots in)

The engine depends on a `SearchProvider` abstraction:

```
SearchProvider {
  search(request): SearchResult[]        // channels/groups
  // posts capability declared via provider metadata
}
```

- Phase 1 ships **`CatalogProvider`** — matches the query against a curated catalog, enriches hits live via `getChat`/`getChatMemberCount` through the integration layer.
- Future: **`MTProtoProvider`** implements the same contract; the engine, web UI, and bot code do not change. The bot continues to run on the Bot API while MTProto runs as a separate process.
- The engine exposes **capability metadata** so the UI/bot can hide the "posts" tab until a provider supports it. This prevents advertising a feature the data source cannot deliver — the exact trap this analysis guards against. **[PROPOSED]**

### 7.5 Concurrency, slow requests, and rate limits

All enforced once, inside the Telegram Integration Layer:

1. **Concurrency limiter** — a fixed max-inflight cap (e.g. small N) for outbound Bot API calls, shared by both interfaces.
2. **Rate limiter** — a token-bucket per rolling window; on `429`, honor `retry_after` exactly before releasing the slot.
3. **Request dedupe** — identical concurrent `getChat(username)` calls share one promise (natural with an in-flight cache).
4. **TTL cache** — channel metadata is slow-changing; short-TTL in-memory cache drastically cuts Bot API volume (§11.3).
5. **Timeouts** — every outbound call carries an `AbortController` deadline; failures degrade to cached/last-known data or a clean error, never a hang.
6. **Error translation** — Telegram errors map to a small typed set (`RATE_LIMITED`, `TIMEOUT`, `NOT_FOUND`, `TELEGRAM_UNAVAILABLE`, `INVALID_INPUT`) shared by both UIs, so error UX is consistent.

**Stateless pagination:** page state lives in the request (`offset`/`limit`) on web, and in `callback_data` / inline `offset` on bot — no server-side session storage needed, honoring the no-Redis/no-DB decision. **[PROPOSED]**

---

## 8. Technology Stack

### 8.1 Backend runtime & language

| Option | Verdict |
| --- | --- |
| **Node.js + TypeScript** | **Recommended.** First-class Telegram library ecosystem, one language across the stack, low operational overhead. **[PROPOSED]** |
| Deno / Bun | Viable but lighter library support for bots; no decisive gain here. |

### 8.2 Web framework

| Option | Verdict |
| --- | --- |
| **Fastify** | **Recommended.** Fast, schema-based validation, small plugin ecosystem (`@fastify/static`, `@fastify/rate-limit`), ideal for embedding the web API + static front-end + bot webhook in one process. **[PROPOSED]** |
| Express | Fine but slower and less type-safe by default; no reason to prefer it. |
| Hono | Excellent if edge/serverless is later desired; Fastify is the safer default for a long-lived VPS process. |
| Next.js API routes | Couples the backend to the Next lifecycle and makes a co-located long-polling bot awkward; rejected for the single-process goal. |

### 8.3 Front-end

| Option | Verdict |
| --- | --- |
| **React + Vite + TypeScript + Tailwind CSS** | **Recommended.** Produces a static bundle served by the same Fastify process; simplest possible build/deploy; a search UI gains little from SSR. **[PROPOSED]** |
| Next.js | Choose it **only if SEO/SSR becomes a requirement** (search-result pages rarely benefit — content is dynamic). Usable via `output: export`. [OPEN] |

### 8.4 Bot library

| Option | Verdict |
| --- | --- |
| **grammy** | **Recommended.** TypeScript-first, excellent middleware model, first-class inline-mode and callback-query support, supports long polling **and** webhooks, well documented. **[PROPOSED]** |
| Telegraf | Established and capable; slightly weaker typing and heavier. Valid alternative. |
| node-telegram-bot-api | Older callback-style API; not recommended. |
| Raw fetch | Acceptable for a handful of calls, but we want update routing, so a library pays for itself. |

### 8.5 Shared validation & types

**Zod** — single schema source for search-request validation on the web API and for bot argument parsing; types infer into the engine. One validation implementation, no drift. **[PROPOSED]**

### 8.6 Testing

**Vitest** for unit/integration tests; mocking the Bot API client so tests never hit Telegram. A shared "engine contract" test suite is run against **both** interfaces to prove the search logic is not duplicated or divergent. **[PROPOSED]**

### 8.7 Explicitly excluded (per decisions)

Database, Redis/ValKey, user accounts/auth, subscriptions, MTProto (Phase 1), microservices, Turborepo/monorepo, distributed systems. **[CONSTRAINT]**

---

## 9. Folder Structure (proposed — not to be created yet)

Single repository, one package, clear layering. Each folder maps to exactly one architectural layer, which is what prevents search-logic duplication.

```
FindPulse/
├── package.json
├── tsconfig.json
├── zod schemas (shared) / vitest config
├── .env.example              # BOT_TOKEN placeholder only — never a real token
├── README.md
├── docs/
│   └── analysis/
│       ├── FINDPULSE_REQUIREMENTS_AND_ARCHITECTURE.md   ← this document
│       └── EXECUTIVE_SUMMARY.md
├── src/
│   ├── index.ts              # single entrypoint: boots web + bot in one process
│   ├── config/
│   │   └── env.ts            # typed env access (BOT_TOKEN, PORT, WEBHOOK_URL…)
│   │
│   ├── engine/               # ── SHARED SEARCH ENGINE (one implementation) ──
│   │   ├── types.ts          # SearchRequest, SearchResult, provider interface
│   │   ├── search-engine.ts  # orchestration: validate → provider → rank → paginate
│   │   ├── ranking.ts        # relevance scoring (catalog scope)
│   │   ├── providers/
│   │   │   ├── catalog-provider.ts   # Phase 1 data source
│   │   │   └── mtproto-provider.ts   # future — implements the same interface
│   │   └── catalog/
│   │       ├── catalog-loader.ts
│   │       └── catalog.json           # curated public channels/groups
│   │
│   ├── telegram/             # ── TELEGRAM INTEGRATION LAYER ──
│   │   ├── bot-api-client.ts # thin wrapper over Bot API (getChat, getChatMemberCount…)
│   │   ├── rate-limiter.ts   # token bucket + 429 retry_after handling
│   │   ├── concurrency.ts    # in-flight cap + request dedupe
│   │   ├── cache.ts          # in-memory TTL cache
│   │   └── errors.ts         # typed Telegram error set
│   │
│   ├── bot/                  # ── TELEGRAM BOT INTERFACE ──
│   │   ├── bot.ts            # grammy bootstrap (polling or webhook)
│   │   ├── inline.ts         # answerInlineQuery handling
│   │   ├── keyboards.ts      # pagination keyboards (≤64-byte callback_data)
│   │   └── commands/
│   │       ├── start.ts  help.ts  search.ts
│   │       └── channels.ts  groups.ts  (posts.ts deferred)
│   │
│   └── web/                  # ── WEB INTERFACE (server side) ──
│       ├── server.ts         # Fastify bootstrap: API + static + webhook route
│       ├── routes/
│       │   ├── search.ts     # GET/POST /api/search  → engine.search()
│       │   └── health.ts     # /health for deploy probes
│       └── public/           # built front-end bundle (gitignored)
│
├── frontend/                 # ── WEB INTERFACE (client side) ──
│   ├── index.html
│   └── src/
│       ├── App.tsx           # search box, category tabs, results, pagination
│       ├── components/        # ResultCard, Pagination, EmptyState, ErrorState, Spinner
│       └── lib/api.ts        # typed client for /api/search
│
└── tests/
    ├── engine/               # ranking, pagination, provider contract (mocked)
    ├── bot/                  # command/inline/callback handlers (mocked client)
    ├── web/                  # /api/search route (mocked engine)
    └── contract/             # shared suite: both interfaces must satisfy engine behavior
```

**Layering rules that enforce the constraints:**

- `engine/` may import `telegram/` and `config/` only — never `web/` or `bot/`.
- `web/` and `bot/` may import `engine/` and `config/` only — never each other.
- `telegram/` imports nothing from `engine/`, `web/`, or `bot/`.
- Search logic exists only in `engine/`. If a change is needed in two places, the layering is broken.

**[PROPOSED]**

---

## 10. Web Application Requirements

### 10.1 Pages & layout

- **Home / search page** (single primary page): large search input, category tabs (All / Channels / Groups), optional filter row, results region, pagination control. `?q=&type=&sort=&page=` fully deep-linkable (W-18).
- **Header** with the FindPulse name and a concise scope note stating what is searchable (honest expectation setting).
- **Responsive:** mobile-first, results stack to one column; desktop shows a comfortable multi-column list. Tailwind breakpoints; no horizontal scrolling.
- **Footer** with a link to the Telegram bot (cross-promotion).

### 10.2 Search flow

1. User enters a query → debounced request to `GET /api/search?q=…&type=…&offset=…&limit=…&sort=…`.
2. Loading state: skeleton/spinner in the results region (W-11); no full-page blocking.
3. On success: result cards (W-05…W-09) + pagination (W-15).
4. On zero results: empty state with suggested phrasing / browse-popular-channels hint (W-12).
5. On error: friendly error state with retry; the typed error set from §7.5 maps to human messages (W-13).

### 10.3 Result card content

| Field | Source | Always present? |
| --- | --- | --- |
| Title (channel/group name) | `getChat.title` | Yes |
| @username + `t.me` link | `getChat.username` | Yes |
| Type badge (Channel / Group) | catalog/engine | Yes |
| Description / bio | `getChat.description` | When available |
| Member count | `getChatMemberCount` | When available/cached |
| Profile photo | `getChat.photo` → `getFile` | When available (thumbnail) |
| Extra metadata | invite link, is-forum, slow-mode, verified/emoji status flags | When available |

Post-specific fields (text, publish date) are **not rendered in Phase 1**; the "Posts" tab is hidden via provider capability metadata (§7.4).

### 10.4 Pagination, filters, sorting — feasibility

| Feature | Feasible? | Mechanism / caveat |
| --- | --- | --- |
| **Pagination** | ✅ | In-memory `offset`/`limit` over engine results; cheap because the corpus is local. Must not expose unbounded offsets (cap e.g. ≤ 200) to avoid pathological scans. |
| **Filters** | ✅ | Category (channel/group), minimum member count (needs cached counts), language if the catalog records it. Filters unsupported by a future MTProto provider degrade to no-ops — must be surfaced as provider capability. |
| **Search categories** | ✅ | Tabs map to the engine's category field. |
| **Sorting** | ✅ | Relevance (default), member count, title A–Z. Server-side and instant. |
| **Infinite scroll** | ⚠️ | Possible but explicit pagination buttons are simpler and more predictable; recommended. |

**Guardrail:** no UI control may be shipped for a capability the current provider cannot satisfy (capability-driven rendering). **[CONSTRAINT from §7.4]**

---

## 11. Telegram Bot Requirements

### 11.1 Command surface (Phase 1)

| Command | Behavior | Notes |
| --- | --- | --- |
| `/start` | Welcome + 2–3 line usage guide + link to the web app | Also serves as the implicit consent trigger so the bot may reply. |
| `/help` | Full command list, inline-mode hint, scope note | Static text; keep < 4096 chars. |
| `/search <query>` | Search all categories | Aliased by free-text message. |
| `/channels <query>` | Channels only | category filter |
| `/groups <query>` | Groups only | category filter |
| `/posts <query>` | **Deferred** — replies with a short "available later" note | Do not advertise as functional. |
| *(free text)* | Treated as `/search <text>` | Lowest-friction path. |
| `@FindPulseBot <q>` (inline) | Inline results in any chat | Requires enabling Inline Mode via @BotFather — **[OPEN] action item.** |

### 11.2 Interaction design

1. **Query intake** — command args or free text; empty query → usage hint (B-11); over-long query → truncation notice.
2. **Type selection** — for `/search`, default to All; category-specific commands preset the filter. A follow-up inline keyboard ("Channels / Groups") can be offered on All results.
3. **Feedback during slow search** — `sendChatAction("typing")` refreshed every ~5s while the engine works (B-12).
4. **Results rendering** — one message per page: header (query, page N/M), then result blocks (title, @username, description excerpt, member count, `t.me` link) formatted with HTML `parse_mode`. Must respect the **4096-char** limit: chunk results across multiple messages if needed.
5. **Pagination** — inline keyboard `[◀ Previous] [Next ▶]` under the page; `callback_data` encodes query+type+offset compactly (**64-byte cap**). `answerCallbackQuery` acknowledges each tap and edits the message in place (B-09).
6. **Opening the source** — every result includes an inline "Open" button whose URL is `https://t.me/<username>` (B-10). Telegram clients open it natively.
7. **Inline mode** — `InlineQueryResultArticle` per hit (title, description, thumbnail, `url`), ≤ 50 per answer, `offset` for "more", sensible `cache_time` to cut Bot API load.
8. **Errors** — typed messages: rate-limited ("Telegram asked us to slow down — retry in Xs"), no results, invalid input, Telegram unavailable. Never leak raw stack traces or the token.

### 11.3 Transport choice

- **Development:** long polling (`getUpdates`) — no public endpoint needed.
- **Production:** webhook over HTTPS with the `secret_token` header verified on every request (§12.5). Lower latency and no polling loop. **[PROPOSED]**

### 11.4 Bot setup checklist (BotFather)

1. `/setinline` — enable inline mode (prompt placeholder, e.g. "Search channels and groups…").
2. `/setcommands` (or `setMyCommands`) — publish the command list.
3. Optionally `/setdescription`, `/setabouttext` — clarify FindPulse scope for users.
4. Do **not** enable anything requiring payments or group-add prompts.

**[OPEN: items 1–3 must be performed on the live bot before inline mode works.]**

---

## 12. Security Requirements

### 12.1 Secret management

- `BOT_TOKEN` **only** in server-side environment variables (or the deployment platform's secret store). **[CONSTRAINT]**
- `.env` files are gitignored; `.env.example` ships placeholders only. No real token ever appears in docs, logs, or code. **[CONSTRAINT]**
- A leaked token is rotated via @BotFather (`/revoke`), never "secured" by obscurity.

### 12.2 Token isolation from the front-end

- The static front-end talks **only** to our own `/api/search`. No `api.telegram.org` URL, no token, no Telegram credential ever reaches the browser bundle. **[CONSTRAINT]**
- CSP headers should disallow outbound connections to anything but our own origin.

### 12.3 Protecting the public API from abuse

- **Rate limiting** on `/api/search` — in-memory fixed/rolling-window limiter (`@fastify/rate-limit`), per-IP, conservative Phase 1 thresholds (no Redis needed; see §14 for the multi-instance caveat).
- **Input validation** — Zod schema: non-empty query, max length cap (e.g. 128 chars), charset/normalization rules, bounded `offset`/`limit`, allow-listed `type`/`sort` values. Reject anything else with 400.
- **Query sanitization** — treat all user text as data only; never interpolate into Telegram API paths or URLs; HTML-escape before rendering in bot messages.
- **No CORS wildcard** — same-origin only; the front-end is served by the same process.

### 12.4 Webhook protection (when used)

- Verify the `X-Telegram-Bot-Api-Secret-Token` header against the value registered in `setWebhook` on **every** request; reject mismatches with 401. **[CONSTRAINT]**
- Optionally restrict the route to Telegram's official webhook IP ranges as defense in depth.
- Reject non-POST and unexpected content types early.
- Do not echo update contents into logs (may contain user text/PII).

### 12.5 Future MTProto session handling

- API ID/Hash and session auth keys in the secret store, **encrypted at rest**, minimal file permissions, never logged, never committed. **[CONSTRAINT]**
- Run the MTProto process in isolation with minimal network egress.
- Prefer a **bot-mode** MTProto session over a user session where the capability delta allows, to avoid holding "real user" credentials.
- If a user session is unavoidable: treat its key as a top-level secret, rotate the session periodically, and respect FLOOD_WAIT pacing to avoid account bans (§5.5).

### 12.6 Data minimization

- Stateless by design: no user accounts, no query storage, no analytics, no profiles. Page state is carried in the request/callback payload, not server-side sessions. **[CONSTRAINT — per approved decisions]**

---

## 13. Performance Considerations

### 13.1 Traffic & concurrency profile

Phase 1 is low-volume: the dominant cost is **per-search Telegram enrichment** (`getChat` + `getChatMemberCount` per hit), not raw request volume. A single page of 10 results can mean 10–20 Bot API calls without caching — the primary performance design target. **[FACT]**

### 13.2 Handling Telegram limits

- **429 / `retry_after`:** read the value, wait exactly that long, retry once; surface a friendly "slow down" message if it persists. Never retry in a tight loop.
- **Concurrency cap:** bounded in-flight Bot API calls; queued callers receive a bounded-wait promise rather than thundering.
- **FloodWait (MTProto future):** same pattern via `FLOOD_WAIT_X`, plus a daily request ceiling.

### 13.3 Caching — only where justified

- **In-memory TTL cache** for `getChat` results (short TTL, e.g. minutes-to-hours) and `getChatMemberCount` (shorter TTL, since counts move faster). Channel identity/description is slow-changing; member counts are not — different TTLs.
- **In-flight dedupe** collapses simultaneous identical calls into one.
- **Inline-mode `cache_time`** lets Telegram itself cache answers — big savings.
- **No Redis in Phase 1.** In-process memory is sufficient at this scale. **[CONSTRAINT]**

### 13.4 Preventing duplicate work

- Shared in-flight + TTL cache across web and bot (same process) — a web search and a bot search for the same term reuse one Telegram call set.
- Idempotent, offset-based pagination avoids re-fetching pages already shown.

### 13.5 Timeouts & error handling

- Every outbound Telegram call carries an `AbortController` deadline (Phase 1 default a few seconds).
- Timeouts degrade gracefully: cached metadata if available, else a typed `TIMEOUT` error shown to the user.
- The engine never retries unbounded: bounded retries only for transient failures, never for 4xx.

### 13.6 Pagination performance

- In-memory slicing over a bounded result window (cap maximum offset) — O(page), predictable, no full-corpus scans per request.

### 13.7 When Redis or a database *becomes* necessary

| Trigger | What becomes necessary |
| --- | --- |
| Multiple process replicas for HA/scaling | Redis (shared rate-limit + cache coordination) |
| Persistent catalog/index across restarts at scale | Database |
| Full-text search over a large post corpus (MTProto era) | Database + search index |
| Per-user features: history, favorites, saved searches | Database (+ accounts, which is currently out of scope) |
| Analytics / query insights beyond ephemeral logs | Database |

None of these apply to Phase 1. They are triggers to revisit, not baseline requirements. **[PROPOSED]**

---

## 14. Implementation Roadmap

Eight phases. Dependencies are called out explicitly to support the project's **parallel development** approach. Phases 4 and 5 are the parallel track.

---

### Phase 0 — Requirements & Architecture *(serial — this document)*

- **Goal:** agree scope, architecture, and stack before code.
- **Tasks:** Telegram API capability analysis; architecture design; stack selection; risk register; open-questions list.
- **Files:** `docs/analysis/FINDPULSE_REQUIREMENTS_AND_ARCHITECTURE.md`, `docs/analysis/EXECUTIVE_SUMMARY.md`.
- **Dependencies:** none.
- **Tests:** n/a (reviewable artifacts).
- **Acceptance criteria:** stakeholder approves the honest Phase-1 scope (catalog search, posts deferred), the single-process architecture, and the stack; all `[OPEN]` items answered.

---

### Phase 1 — Project Initialization *(serial — foundation for everything)*

- **Goal:** one building, type-checking, lint-clean repository with the layering skeleton and a stubbed engine contract.
- **Tasks:** `package.json`, TS config, ESLint/Prettier, Vitest; `config/env.ts`; Zod schemas for `SearchRequest`/`SearchResult`; `engine/types.ts` including the `SearchProvider` interface and capability metadata; a **mock provider** so both interfaces can develop against the contract immediately; CI running typecheck + lint + tests.
- **Files:** root configs, `src/config/*`, `src/engine/types.ts`, `tests/`.
- **Dependencies:** Phase 0 approved.
- **Tests:** typecheck; lint; schema unit tests.
- **Acceptance criteria:** `npm run typecheck && npm run lint && npm run test` pass; the engine contract is frozen (changes after this point require a change record, since Phases 4 and 5 depend on it).

---

### Phase 2 — Telegram Bot Integration *(serial, then unblocks parallel work)*

- **Goal:** a live bot that responds to `/start`, `/help`, and echoes a mocked search — proving the transport before features.
- **Tasks:** grammy bootstrap; env-driven polling-or-webhook switch; `setMyCommands`; typed error set; rate limiter + concurrency queue + timeouts + TTL cache in the integration layer; `getChat`/`getChatMemberCount` client wrapper with dedupe; webhook secret-token verification.
- **Files:** `src/telegram/*`, `src/bot/bot.ts`, `src/bot/commands/{start,help}.ts`, `src/web/routes/health.ts`.
- **Dependencies:** Phase 1.
- **Tests:** mocked-client unit tests for the limiter/cache/error mapping; live smoke test against the real bot (`getMe`, `/start` round-trip).
- **Acceptance criteria:** `/start` and `/help` work on the real bot; 429 handling verified with a forced limit; webhook (if enabled) rejects bad/missing secret tokens.

---

### Phase 3 — Shared Search Engine *(serial — the heart)*

- **Goal:** the one true implementation of search, usable identically from web and bot.
- **Tasks:** `search-engine.ts` orchestration; `CatalogProvider` (load catalog, keyword match, rank); live enrichment via the integration layer; category filter, sorting, bounded pagination; capability metadata ("posts: not supported").
- **Files:** `src/engine/*` (except `types.ts`), `src/engine/catalog/*`.
- **Dependencies:** Phase 2 (needs the integration layer).
- **Tests:** ranking/pagination/filter unit tests; provider contract tests with a mocked Telegram client; a "both interfaces behave identically" contract suite scaffolded.
- **Acceptance criteria:** engine passes all tests with the real Bot API in a smoke run; pagination caps enforced; enrichment cache hit-rate observable in logs.

---

### Phase 4 — Web Search Interface *(PARALLEL — with Phase 5)*

- **Goal:** a complete, responsive search UI powered by the shared engine.
- **Tasks:** Fastify server exposing `/api/search` + static serving; React+Vite+Tailwind front-end: search box, category tabs, filter row, result cards, pagination, loading/empty/error states; deep-linkable URLs; rate limiting on the API; `AbortController`-based request cancellation.
- **Files:** `src/web/*`, `frontend/*`.
- **Dependencies:** **Phase 1** (contract) — development starts immediately against the mock provider; integrates with the real engine once Phase 3 lands.
- **Tests:** route tests with a mocked engine; component tests for loading/empty/error states; responsive checks at mobile/desktop widths.
- **Acceptance criteria:** every W-01…W-03, W-05…W-09, W-11…W-18 item demonstrated; no token reaches the browser; API rate limiter verified.

---

### Phase 5 — Bot Search Interface *(PARALLEL — with Phase 4)*

- **Goal:** full bot search UX using the same engine.
- **Tasks:** `/search`, `/channels`, `/groups`, free-text handler; pagination inline keyboards with ≤64-byte payloads; HTML-formatted result pages respecting 4096 chars; `sendChatAction` progress; inline mode (`answerInlineQuery`, ≤50 results, `offset`, `cache_time`); `/posts` graceful "not yet available" reply.
- **Files:** `src/bot/commands/*`, `src/bot/inline.ts`, `src/bot/keyboards.ts`.
- **Dependencies:** **Phase 1** (contract) — starts against the mock provider; integrates with the real engine once Phase 3 lands. Also requires the **@BotFather inline-mode enablement** [OPEN].
- **Tests:** handler tests with mocked engine + mocked Telegram; 4096-char chunking verified; callback payload encoding round-trip tests.
- **Acceptance criteria:** every B-01…B-05, B-07…B-12 item demonstrated on the real bot; `/posts` does not imply the feature exists.

---

### Phase 6 — Integration & Testing *(serial)*

- **Goal:** prove both interfaces run on one shared engine, identically.
- **Tasks:** run the shared engine-contract suite against **both** interfaces; end-to-end flows on the real bot and real web app; error-path verification (force 429/timeout/empty); verify no search-logic duplication (static check that `web/` and `bot/` don't implement matching/ranking).
- **Dependencies:** Phases 3, 4, 5 complete.
- **Tests:** full suite + manual Telegram/web acceptance pass.
- **Acceptance criteria:** identical query → identical normalized results on web and bot; zero duplicated search logic; all acceptance criteria from Phases 4–5 hold against the real engine.

---

### Phase 7 — Deployment *(serial)*

- **Goal:** one process in production, observable and healthy.
- **Tasks:** container/VPS packaging; env/secret injection; HTTPS termination (Caddy/nginx or platform TLS); `setWebhook` with `secret_token`; `/health` probe; structured logging to stdout; graceful shutdown on SIGTERM; runbook (rotate token, scale triggers per §13.7).
- **Dependencies:** Phase 6 passed.
- **Tests:** deploy-to-staging smoke test: webhook delivery, `/health`, rate-limit behavior, secret-token rejection.
- **Acceptance criteria:** bot reachable via webhook, web UI live on the domain, health green, logs structured, graceful restart without dropped updates.

---

### Parallelization map

| Track | Phase 1 | Phase 2 | Phase 3 | Phase 4 | Phase 5 | Phase 6 | Phase 7 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Shared/serial | ● | ● | ● | | | ● | ● |
| Web track | (contract) | — | — | ● (vs mock → real) | — | merge | merge |
| Bot track | (contract) | ● | — | — | ● (vs mock → real) | merge | merge |

**Key enabler:** freezing the engine contract in Phase 1 lets Web and Bot proceed **fully in parallel** against a mock provider; only Phase 3 (real engine) is serial, and it is a small, well-isolated module.

---

## 15. Testing Strategy

| Level | Scope | Approach |
| --- | --- | --- |
| Unit | ranking, pagination, filters, schemas, keyboards/callback payloads, cache TTL, rate limiter | Vitest, pure functions, no network |
| Integration | engine + mocked integration layer; web route + mocked engine; bot handlers + mocked engine/client | Inject fakes; assert typed error mapping (429/timeout/not-found) |
| **Contract (anti-duplication)** | identical query → identical results via **both** interfaces | One shared suite executed against the web route and the bot handler |
| End-to-end (manual) | real bot: `/start`, `/search`, inline mode, pagination; real web UI flows | Live token in a sandbox test bot; recorded observations |
| Non-functional | 4096-char chunking, 64-byte callback cap, bounded offsets, token isolation (grep the built bundle for `api.telegram.org`) | Automated assertions |
| Performance | cache hit-rate, worst-case page latency, limiter backoff under synthetic load | Local harness; no external load tooling needed |

**Rule:** no test may make a real Telegram call except the explicitly marked live smoke tests, so CI is deterministic and rate-limit-safe. **[PROPOSED]**

---

## 16. Deployment Strategy

### 16.1 Target shape

**Single process, single deployment unit.** A Node.js runtime (container or VPS) serving: the static front-end, `/api/search`, `/health`, and the Telegram webhook route — all in one Fastify instance. **[PROPOSED]**

### 16.2 Platform options

| Option | Fit |
| --- | --- |
| **VPS (2 CPU / 512MB class) + Caddy/nginx + systemd or PM2** | **Recommended for Phase 1.** Cheapest, full control of a long-lived process + webhook, no serverless cold-start issues. |
| Single Docker container on Railway/Render/Fly | Excellent DX, one click, TLS included. |
| Serverless functions | **Poor fit** — webhook + long-polling + in-memory cache all fight the serverless model. Revisit only with Redis + a DB. |

### 16.3 Requirements

- **HTTPS endpoint** (mandatory for a webhook) on port 443/80/88/8443, with a registered domain. **[OPEN: domain/SSL details needed.]**
- **Secrets injected at runtime**; nothing baked into the image or repo.
- **Health probe** `/health` returning dependency status (self + Telegram reachability).
- **Graceful shutdown** — drain in-flight requests, finish webhook handling, close the HTTP server on SIGTERM.
- **Observability** — structured JSON logs to stdout (request ids, no tokens, no user text beyond debug builds).
- **Update delivery** — blue/green or quick container swap; webhook URL stays stable so `setWebhook` is a one-time setup.

### 16.4 Scaling triggers (revisit, not now)

Multiple replicas ⇒ needs Redis for shared rate-limit/cache ⇒ then a database for durable state. Deliberately out of scope for Phase 1 (§13.7).

---

## 17. Risks & Technical Limitations

| # | Risk / limitation | Severity | Mitigation |
| --- | --- | --- | --- |
| R1 | **No global search in the Bot API** — the core product promise ("search public Telegram") cannot be met with Bot API alone. | **Critical** | Phase 1 scoped to a curated catalog; provider seam makes MTProto a drop-in upgrade; UI copy must state the actual scope. |
| R2 | **Posts/messages search impossible via Bot API** (no history methods). | **Critical** | Deferred explicitly; `/posts` replies "coming soon"; UI tab hidden via capability metadata. |
| R3 | **Catalog coverage** — search quality is bounded by how good the curated list is. | High | Curation workflow + ranking; treat catalog as a first-class data asset; plan MTProto to escape the ceiling. |
| R4 | **Undocumented Telegram rate limits** — limits can change without notice and 429 mid-search degrades UX. | High | Shared limiter honoring `retry_after`, TTL cache, inline `cache_time`, bounded page sizes, friendly backoff UX. |
| R5 | **Bot can only message users who started it** — cannot proactively notify. | Medium | By design; all interactions are user-initiated. |
| R6 | **Inline mode not yet enabled on the bot** — B-08 silently fails until @BotFather config is done. | Medium | [OPEN] action item in §11.4; verified in Phase 5 acceptance. |
| R7 | **Payload limits** — 4096 chars/message, 64 bytes `callback_data`, ≤50 inline results/page. | Medium | Chunking, compact cursor encoding, capped page sizes — all designed in from the start. |
| R8 | **Stale metadata** — cached member counts/Descriptions drift from reality. | Low | Tiered TTLs; member counts shorter than profile data; refresh on cache miss. |
| R9 | **Single process = single point of failure.** | Medium | Acceptable per the simplicity constraint; `/health` + fast restart; scaling path documented in §13.7/§16.4. |
| R10 | **Webhook security** — a public endpoint receiving Telegram updates. | Medium | `secret_token` verification on every request (+ optional IP allow-list). |
| R11 | **Future MTProto account/ban risk** if scraping is added without restraint. | High (future) | Pacing, FLOOD_WAIT compliance, daily ceilings, ToS/ legal review before scale — all pre-committed in §5.6. |
| R12 | **Scope creep toward "search everything"** reintroduces MTProto complexity mid-phase. | Medium | This document's scope table is the contract; MTProto enters only as a new provider behind the seam. |

---

## 18. Open Questions & Decisions Required

Answers to these are needed before implementation (Phase 1) or at the noted phase.

| # | Question | Why it matters | Needed by |
| --- | --- | --- | --- |
| Q1 | **Is the curated-catalog scope acceptable for Phase 1?** | Determines whether FindPulse ships a working directory-search product now, or whether MTProto must be pulled into Phase 1 (contradicting the approved decision to defer it). This is the single biggest decision. | Phase 0 approval |
| Q2 | **Confirm the single-process Fastify + grammy + React/Vite stack** (vs. Next.js). | Locks the stack; Next.js is only worth it if SEO/SSR is a real requirement. | Phase 0 approval |
| Q3 | **Is the "Posts & Messages" feature formally deferred (or descoped)?** | It is technically impossible with the Bot API; the roadmap defers it, but the product must say so explicitly to set expectations. | Phase 0 approval |
| Q4 | **Where does the seed catalog come from, and who maintains it?** | Catalog quality *is* Phase-1 search quality (R3). Needs a source (manual list, import, future MTProto harvest) and an owner. | Phase 3 |
| Q5 | **Hosting target + domain + TLS details** (VPS vs. container, domain name for the webhook). | A webhook needs a public HTTPS endpoint; deployment cannot be finalized without this. | Phase 7 |
| Q6 | **Webhook vs. long polling in production?** | Affects infra (public HTTPS endpoint) and the bot bootstrap mode. Recommendation: webhook. | Phase 7 |
| Q7 | **Has Inline Mode been enabled via @BotFather** (`/setinline`), plus `setMyCommands`? | B-08 (inline search) silently fails otherwise. | Phase 5 |
| Q8 | **What are the Phase-1 rate-limit thresholds for `/api/search`?** | Anti-abuse defaults must be chosen deliberately (per-IP window/limit). | Phase 4 |
| Q9 | **Language/localization scope?** | Catalog language filters and UI language (Arabic/English) affect catalog fields and copy. | Phase 3–4 |

---

## Appendix A — Confirmed vs. assumed, in one place

**Confirmed facts:** Bot exists, token valid (`getMe` → `ok: true`); Bot API has no search/history methods; `getChat`/`getChatMemberCount` work on public chats by @username; payload/rate-limit behaviors as cited; MTProto is deferred; no DB/Redis/accounts per the decisions table.

**Assumptions made explicit:** `getChat` access to public channels remains available without membership (currently true; would be revisited if Telegram tightens it); rate limits sit near the empirically observed values; Phase-1 volume is low enough for in-memory state.

**Everything else in this document is a [PROPOSED] option**, reversible until implemented.

## Appendix B — Where to verify every API claim

- Bot API method reference & payload limits: `https://core.telegram.org/bots/api`
- Inline mode & inline query results: `https://core.telegram.org/bots/api#inline-mode` / `#answerinlinequery`
- Webhook setup & `secret_token`: `https://core.telegram.org/bots/api#setwebhook`
- MTProto methods referenced (`contacts.search`, `help.search`, `messages.search`): `https://core.telegram.org/methods`
- API ID / API Hash: `https://my.telegram.org`
- Bot setup (inline mode, commands, token revoke): `@BotFather`

---

**END OF ANALYSIS — awaiting approval of scope, architecture, and roadmap before any implementation begins.**
