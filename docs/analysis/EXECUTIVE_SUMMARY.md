# FindPulse — Executive Summary

**Document type:** Executive summary of `FINDPULSE_REQUIREMENTS_AND_ARCHITECTURE.md`
**Status:** Draft v1.0 — **awaiting approval before implementation**
**Date:** 2026-10-01

---

## 1. What FindPulse is

A search engine over **public Telegram content** (channels, groups, and posts) with two front-ends that must share **one** search engine and never duplicate search logic:

- a **web application**, and
- a **Telegram bot** (created via BotFather; token verified with `getMe` → `ok: true`).

Per the approved decisions: **no database, no Redis, no user accounts/login, no subscriptions, no MTProto in Phase 1.**

---

## 2. The one finding that shapes everything

**The Telegram Bot API has no search capability at all.** There is no method to search public channels, public groups, or public messages — and no method to read a channel's message history.

A valid Bot Token proves the bot exists and can send/receive messages. It does **not** grant any global search privilege. **Therefore: the original vision — "search all public Telegram content" — cannot be delivered with the Bot API alone.** It requires MTProto, which the project has explicitly deferred.

**What is actually buildable with the Bot API in Phase 1:**

| Feature | Bot API (Phase 1) | MTProto (later) |
| --- | --- | --- |
| Search public channels / groups by keyword | **Only within a curated catalog** | Global search |
| Search public posts / messages | **Not possible** | Yes |
| Live channel metadata (title, bio, member count, photo) | Yes (`getChat`, `getChatMemberCount`) | Yes |
| Bot UX: commands, inline mode, pagination, links | Yes | Yes |

---

## 3. Recommended Phase-1 scope

Build FindPulse as a **directory/catalog search engine** over a curated set of public channels and groups, with live metadata enrichment via the Bot API. The architecture is built around a **provider interface** so an MTProto provider slots in later **without touching the web UI, the bot, or the engine core** — unlocking true global search and post search when the project is ready.

The product communicates this honestly: search a curated directory now, all of Telegram later.

---

## 4. Recommended architecture — as simple as possible

**One Node.js + TypeScript process** (Fastify) that serves:

- the **web API** (`/api/search`) + the static React/Vite front-end,
- the **Telegram bot** (grammy, webhook in production, polling in dev),
- and imports **one shared search-engine module** that talks to Telegram through **one integration layer** holding a single rate-limit/concurrency/cache budget.

No separate backend, no network hops, no duplicated logic. Pagination is stateless (offset in the URL / callback payload), so no server-side session storage is needed — honoring the no-Redis/no-DB decision.

**Stack:** Node.js + TypeScript, Fastify, grammy, Zod (shared validation), React + Vite + Tailwind CSS, Vitest. Next.js only if SEO later becomes a requirement.

---

## 5. Roadmap (8 phases, parallel-ready)

| Phase | Goal | Track |
| --- | --- | --- |
| 0 — Requirements & Architecture | Approve scope, architecture, stack (this document) | Serial |
| 1 — Project Initialization | Repo, configs, **frozen engine contract** + mock provider | Serial |
| 2 — Telegram Bot Integration | Live bot responds; integration layer (limiter, cache, errors, webhook secret) | Serial |
| 3 — Shared Search Engine | The single implementation of search + catalog provider | Serial |
| 4 — Web Search Interface | Full responsive UI | **Parallel** with 5 |
| 5 — Bot Search Interface | Commands, inline mode, pagination | **Parallel** with 4 |
| 6 — Integration & Testing | Prove both interfaces behave identically; zero duplicated logic | Serial |
| 7 — Deployment | One process, HTTPS, webhook, health, graceful shutdown | Serial |

**Parallel enabler:** freezing the engine contract in Phase 1 lets Web and Bot develop fully in parallel against a mock provider; only the small, isolated engine module is serial.

---

## 6. Key risks

- **R1 (critical):** no global search via Bot API — mitigated by catalog scope + the MTProto provider seam.
- **R2 (critical):** posts/messages search is impossible with the Bot API — explicitly deferred; the UI hides the tab and `/posts` replies "coming soon."
- **R3:** search quality is bounded by catalog quality — curation is a first-class asset.
- **R4:** undocumented Telegram rate limits — handled via a shared limiter honoring `429 retry_after`, TTL caching, and inline `cache_time`.
- **R7:** Telegram payload limits (4096 chars/message, 64-byte buttons, ≤50 inline results) — designed for from day one.

---

## 7. Decisions required before implementation

1. **Accept the curated-catalog scope for Phase 1** (or pull MTProto into Phase 1, contradicting the approved deferral). *This is the biggest decision.*
2. **Confirm the stack:** single-process Fastify + grammy + React/Vite + Tailwind.
3. **Formally defer (or descope) the posts/messages feature.**
4. **Hosting + HTTPS domain** — a webhook requires a public HTTPS endpoint.
5. **Enable Inline Mode via @BotFather** (`/setinline`) and publish commands — otherwise inline search silently fails.
6. **Seed-catalog source and owner** — catalog quality is Phase-1 search quality.

---

## 8. Bottom line

With the Bot API alone, FindPulse can be a **fast, clean, honest directory search for curated public Telegram channels and groups** — shared engine, two interfaces, one process, no database, no Redis. **True "search all of Telegram" — including posts — is a Phase-2 capability that arrives by plugging an MTProto provider into the same seam**, not by rewriting the product.

Full analysis, capability matrix, folder structure, security/performance design, per-phase acceptance criteria, and the complete risk register are in:

`docs/analysis/FINDPULSE_REQUIREMENTS_AND_ARCHITECTURE.md`

**Analysis complete — awaiting approval of scope, architecture, and roadmap before any implementation begins.**
