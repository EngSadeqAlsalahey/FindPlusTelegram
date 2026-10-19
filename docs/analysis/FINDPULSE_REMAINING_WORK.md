# FindPulse — Remaining Work & Action Plan

**Document:** Prioritized Remaining Tasks & Next Implementation Roadmap  
**Project:** FindPulse  
**Date:** 2026-10-08  
**Environment:** Antigravity  

---

## 1. Prioritized Task Matrix

| Task ID | Task Name | Priority | Status | Category |
|---|---|---|---|---|
| **TASK-P0-01** | Fix TypeScript compilation errors in `scripts/smoke-handlers.ts` | **P0 — Critical** | BROKEN | Build / Tooling |
| **TASK-P0-02** | Restore successful production build (`next build`) | **P0 — Critical** | BLOCKED (by P0-01) | Build / Tooling |
| **TASK-P1-01** | Fix early return loop defect in `tests/parity.test.ts` | **P1 — High** | DEFECT | Testing |
| **TASK-P1-02** | Initialize Git repository & verify `.env` exclusion | **P1 — High** | NOT CONFIGURED | Security & DevOps |
| **TASK-P1-03** | Implement `/channels` and `/groups` commands in Telegram Bot | **P1 — High** | NOT IMPLEMENTED | Bot Feature Parity |
| **TASK-P1-04** | Populate real curated Telegram catalog | **P1 — High** | SAMPLE DATA | Product Data |
| **TASK-P2-01** | Implement Telegram Bot Inline Query Mode (`@FindPulseBot`) | **P2 — Medium** | NOT IMPLEMENTED | Bot Capability |
| **TASK-P2-02** | Introduce Public Posts data model and search indexing | **P2 — Medium** | NOT IMPLEMENTED | Scope Completeness |
| **TASK-P2-03** | Implement basic API rate limiting on `/api/search` | **P2 — Medium** | NOT IMPLEMENTED | Security & Reliability |
| **TASK-P2-04** | Add Telegram Webhook support for production deployment | **P2 — Medium** | NOT IMPLEMENTED | Infrastructure |
| **TASK-P3-01** | File and document search indexing | **P3 — Future** | NOT IMPLEMENTED | Future Scope |
| **TASK-P3-02** | MTProto integration for global live Telegram search | **P3 — Future** | NON-GOAL (Deferred)| Long-term Architecture |

---

## 2. Detailed Task Specifications

### P0 — Critical Tasks

#### TASK-P0-01: Fix TypeScript Compilation Errors in `scripts/smoke-handlers.ts`
- **Task ID:** TASK-P0-01
- **Task Name:** Fix TypeScript compilation errors in `scripts/smoke-handlers.ts`
- **Priority:** P0 — Critical
- **Current Status:** BROKEN
- **Why Needed:** In strict TypeScript mode, `makeCtx(cap)` returns `as never`, and spreading `never` into an object literal violates TS2698 (`Spread types may only be created from object types`). This causes `npm run typecheck` and `npm run build` to fail immediately.
- **Files Affected:**
  - `scripts/smoke-handlers.ts`
- **Dependencies:** None
- **Acceptance Criteria:**
  1. `makeCtx` return type properly typed as `Record<string, unknown>` or grammY `Context`-compatible object instead of `never`.
  2. `npm run typecheck` exits with code 0 and 0 errors.
- **Testing Method:**
  - Run `npm run typecheck`.

---

#### TASK-P0-02: Restore Successful Production Build (`next build`)
- **Task ID:** TASK-P0-02
- **Task Name:** Restore successful production build (`next build`)
- **Priority:** P0 — Critical
- **Current Status:** BLOCKED (by TASK-P0-01)
- **Why Needed:** Production deployment cannot be performed while `next build` fails during the TypeScript verification phase.
- **Files Affected:**
  - `tsconfig.json` (optional: exclude scripts if desired, though fixing script types is preferred)
  - `scripts/smoke-handlers.ts`
- **Dependencies:** TASK-P0-01
- **Acceptance Criteria:**
  1. `npm run build` completes successfully.
  2. Static routes, server-side API route `/api/search`, and CSS bundles are generated cleanly.
- **Testing Method:**
  - Run `npm run build`.

---

### P1 — High Priority Tasks

#### TASK-P1-01: Fix Early Return Loop Defect in `tests/parity.test.ts`
- **Task ID:** TASK-P1-01
- **Task Name:** Fix early return loop defect in `tests/parity.test.ts`
- **Priority:** P1 — High
- **Current Status:** DEFECT
- **Why Needed:** In `tests/parity.test.ts`, line 54 contains `return runBotSearch(query, ...)` inside a `for (const query of QUERIES)` loop. The test halts on the very first query (`"tech"`), leaving 5 queries untested (including Arabic `"تقنية"`, handle `"@findpulse_sample_crypto"`, and empty queries).
- **Files Affected:**
  - `tests/parity.test.ts`
- **Dependencies:** None
- **Acceptance Criteria:**
  1. The test uses `async/await` to iterate through all 6 queries.
  2. All 6 queries assert equality between Web API response and Bot response.
  3. `npm test` passes with 65/65 tests.
- **Testing Method:**
  - Run `npm test`.

---

#### TASK-P1-02: Initialize Git Repository & Verify `.env` Exclusion
- **Task ID:** TASK-P1-02
- **Task Name:** Initialize Git repository & verify `.env` exclusion
- **Priority:** P1 — High
- **Current Status:** NOT CONFIGURED
- **Why Needed:** Currently, `D:\sadeq\FindPulse` is not a Git repository. Without active Git tracking, code changes are vulnerable to loss, and the real `TELEGRAM_BOT_TOKEN` in `.env` risks accidental exposure if Git is initialized improperly.
- **Files Affected:**
  - `.git/` (new)
  - `.gitignore`
- **Dependencies:** None
- **Acceptance Criteria:**
  1. `git init` executed.
  2. `git status` verifies `.env` is untracked and excluded by `.gitignore`.
  3. Clean initial commit created containing only tracked files.
- **Testing Method:**
  - Run `git status` and ensure `.env` does not appear under untracked files.

---

#### TASK-P1-03: Implement `/channels` and `/groups` Commands in Telegram Bot
- **Task ID:** TASK-P1-03
- **Task Name:** Implement `/channels` and `/groups` commands in Telegram Bot
- **Priority:** P1 — High
- **Current Status:** NOT IMPLEMENTED
- **Why Needed:** The approved scope and architecture requirements (B-04 and B-05) state the bot must provide dedicated commands to search channels only and groups only, mirroring the web interface's "Channels" and "Groups" tabs. Currently, the bot hardcodes `type: "all"`.
- **Files Affected:**
  - `src/bot/commands.ts`
  - `src/bot/index.ts`
  - `src/bot/handlers/search.ts`
  - `src/bot/messages.ts`
- **Dependencies:** TASK-P0-01
- **Acceptance Criteria:**
  1. `/channels <query>` searches only catalog entries where `type === "channel"`.
  2. `/groups <query>` searches only catalog entries where `type === "group"`.
  3. Commands are published to Telegram menu via `bot.api.setMyCommands`.
  4. Unit tests added to `tests/bot.test.ts`.
- **Testing Method:**
  - Run unit tests and run `scripts/smoke-handlers.ts`.

---

#### TASK-P1-04: Populate Real Curated Telegram Catalog
- **Task ID:** TASK-P1-04
- **Task Name:** Populate real curated Telegram catalog
- **Priority:** P1 — High
- **Current Status:** SAMPLE DATA
- **Why Needed:** `data/catalog.json` currently contains only 16 fictional entries (`findpulse_sample_*`). For FindPulse to be functional, a verified directory of real public channels and groups must be curated.
- **Files Affected:**
  - `data/catalog.json`
- **Dependencies:** None
- **Acceptance Criteria:**
  1. Replace `findpulse_sample_*` handles with active public Telegram channels and groups across Arabic and English.
  2. Run `npm run check:catalog` to ensure all entries pass strict Zod validation and canonical URL rules (`https://t.me/<username>`).
- **Testing Method:**
  - Run `npm run check:catalog`.

---

### P2 — Medium Priority Tasks

#### TASK-P2-01: Implement Telegram Bot Inline Query Mode (`@FindPulseBot`)
- **Task ID:** TASK-P2-01
- **Task Name:** Implement Telegram Bot Inline Query Mode (`@FindPulseBot`)
- **Priority:** P2 — Medium
- **Current Status:** NOT IMPLEMENTED
- **Why Needed:** Allows users to query FindPulse directly within any Telegram chat by typing `@FindPulse_Search_Bot <keyword>`, displaying instant results via `answerInlineQuery`.
- **Files Affected:**
  - `src/bot/index.ts`
  - `src/bot/handlers/inline.ts` (new)
- **Dependencies:** Enable Inline Mode via `@BotFather` (`/setinline`)
- **Acceptance Criteria:**
  1. `bot.inlineQuery` handler returns up to 20 `InlineQueryResultArticle` items.
  2. Clicking a result shares the channel/group title, handle, description, and link.
- **Testing Method:**
  - Manual test in Telegram client and unit tests with mocked context.

---

#### TASK-P2-02: Introduce Public Posts Data Model and Search Indexing
- **Task ID:** TASK-P2-02
- **Task Name:** Introduce Public Posts data model and search indexing
- **Priority:** P2 — Medium
- **Current Status:** NOT IMPLEMENTED
- **Why Needed:** The approved scope specifies searching "public channels, public groups, and public posts". Since the Bot API cannot crawl message history, posts must be represented as indexed items in the local catalog.
- **Files Affected:**
  - `src/types/index.ts`
  - `src/core/catalog/schema.ts`
  - `src/core/search/score.ts`
  - `src/core/search/engine.ts`
  - `src/components/search/TypeTabs.tsx`
  - `src/components/results/ResultCard.tsx`
  - `data/catalog.json`
- **Dependencies:** TASK-P0-01, TASK-P1-01
- **Acceptance Criteria:**
  1. `CatalogPost` schema added with fields: `id`, `type: "post"`, `sourceId`, `text`, `date`, `publicUrl` (`https://t.me/<channel>/<msgId>`), `enabled`.
  2. Search engine allows `type: "post"`.
  3. Web UI adds "Posts" tab.
- **Testing Method:**
  - Vitest unit tests for post scoring and filtering.

---

#### TASK-P2-03: Implement Basic API Rate Limiting on `/api/search`
- **Task ID:** TASK-P2-03
- **Task Name:** Implement basic API rate limiting on `/api/search`
- **Priority:** P2 — Medium
- **Current Status:** NOT IMPLEMENTED
- **Why Needed:** Prevents abusive scraping or denial-of-service from automated clients.
- **Files Affected:**
  - `src/app/api/search/route.ts`
  - `src/core/security/rate-limiter.ts` (new in-memory token bucket)
- **Dependencies:** None
- **Acceptance Criteria:**
  - Limit IP addresses to 60 requests per minute.
  - Return HTTP 429 (`Too Many Requests`) with `Retry-After` header when exceeded.
- **Testing Method:**
  - Rapid sequence test script.

---

#### TASK-P2-04: Add Telegram Webhook Support for Production Deployment
- **Task ID:** TASK-P2-04
- **Task Name:** Add Telegram Webhook support for production deployment
- **Priority:** P2 — Medium
- **Current Status:** NOT IMPLEMENTED
- **Why Needed:** Long polling is appropriate for local development, but production deployments on serverless or HTTPS hosts require webhooks for reliability and resource conservation.
- **Files Affected:**
  - `src/app/api/telegram/webhook/route.ts` (new)
  - `src/bot/index.ts`
- **Dependencies:** Public HTTPS domain
- **Acceptance Criteria:**
  1. Next.js route receives Telegram POST updates and passes to grammY `webhookCallback`.
  2. Secret token validated via `X-Telegram-Bot-Api-Secret-Token`.
- **Testing Method:**
  - Telegram webhook delivery test.

---

### P3 — Future Tasks

#### TASK-P3-01: File and Document Search Indexing
- **Task ID:** TASK-P3-01
- **Task Name:** File and document search indexing
- **Priority:** P3 — Future
- **Current Status:** NOT IMPLEMENTED
- **Why Needed:** Search specifically for shared files (PDFs, APKs, books, templates) within public channels.
- **Files Affected:**
  - Catalog schema, search engine, web result card.

---

#### TASK-P3-02: MTProto Integration for Global Live Telegram Search
- **Task ID:** TASK-P3-02
- **Task Name:** MTProto integration for global live Telegram search
- **Priority:** P3 — Future
- **Current Status:** NON-GOAL (Deferred to Phase 2/3)
- **Why Needed:** Telegram Bot API cannot search arbitrary public channels or uncurated messages across Telegram. Unlocking global search requires client MTProto protocols (GramJS / TDLib).
- **Files Affected:**
  - New MTProto provider implementing `SearchProvider` interface.

---

## 3. Next Implementation Phase Plan

### **NEXT PHASE: PHASE 8.1 — Stabilization & Build Fixes**

#### **Objective:**
Eliminate all current TypeScript and build defects, restore 100% test assertion coverage on the parity suite, and initialize Git version control with verified secret exclusion. **No new features are introduced in this phase.**

#### **Tasks:**
1. **[TASK-P0-01]** Fix TypeScript compilation errors in `scripts/smoke-handlers.ts` by correcting context mock typing.
2. **[TASK-P0-02]** Verify that `npm run build` compiles and creates Next.js production output without errors.
3. **[TASK-P1-01]** Fix the loop in `tests/parity.test.ts` so all 6 queries (including Arabic and handle searches) are asserted via `async/await`.
4. **[TASK-P1-02]** Initialize Git repository, verify `.env` is ignored by `.gitignore`, and create the initial baseline commit.

#### **DONE WHEN:**
- [ ] `npm run typecheck` exits with 0 errors.
- [ ] `npm run build` generates production build with exit code 0.
- [ ] `npm test` runs all 65 tests, with `tests/parity.test.ts` asserting all 6 queries.
- [ ] `npm run lint` remains clean.
- [ ] `git status` verifies `.env` is untracked and the baseline repo is clean.
