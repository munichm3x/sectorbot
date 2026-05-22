# Public Community Dashboard Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a safe public SECTOR 13 community hub with public read pages and authenticated personal support sections.

**Architecture:** Keep the existing Express + vanilla JS dashboard. Split public API routes into unauthenticated read endpoints and authenticated `/me`/ticket endpoints. Use existing aggregate data sources and render empty states where persistent content systems do not exist.

**Tech Stack:** TypeScript, Express, better-sqlite3, discord.js, vanilla JavaScript, Chart.js, CSS.

---

## File Structure

- Modify `src/dashboard/routes/public-api/index.ts`: route auth boundary and route registration.
- Modify `src/dashboard/routes/public-api/overview.ts`: richer safe overview DTO.
- Modify `src/dashboard/routes/public-api/analytics.ts`: remove public AI exposure and keep aggregate analytics only.
- Modify `src/dashboard/routes/public-api/tickets.ts`: keep own-ticket auth behavior and support-safe summaries.
- Create `src/dashboard/routes/public-api/public-data.ts`: public DTO helpers for server, community, rules, support, empty content sections, and whitelist status.
- Create `src/dashboard/routes/public-api/public-data.test.ts`: tests for public DTO privacy and real rules extraction.
- Modify `dashboard/public-user/index.html`: public navigation and topbar state.
- Modify `dashboard/public-user/js/api.js`: no redirect for public endpoints, auth-aware helpers for personal endpoints.
- Modify `dashboard/public-user/js/app.js`: page registry, helpers, anonymous state support, safe error rendering.
- Modify `dashboard/public-user/js/pages/overview.js`: premium overview hub.
- Create `dashboard/public-user/js/pages/server.js`: server status and configuration page.
- Create `dashboard/public-user/js/pages/community.js`: aggregate community page.
- Create `dashboard/public-user/js/pages/rules.js`: rules accordion/search page.
- Create `dashboard/public-user/js/pages/events.js`: events empty-state page.
- Create `dashboard/public-user/js/pages/changelog.js`: changelog empty-state and Discord CTA page.
- Modify `dashboard/public-user/js/pages/tickets.js`: convert to support page with own-ticket cards.
- Modify `dashboard/public-user/css/dashboard.css`: public-specific design system and responsive components.

## Tasks

### Task 1: Public API Boundary

- [ ] **Step 1: Add route-level tests**

Create tests in `src/dashboard/routes/public-api/public-data.test.ts` for:
- `buildRulesPayload()` returns categorized real rules.
- `buildEmptyContentPayload()` returns empty arrays for events, announcements, changelog, and FAQ.
- `sanitizeStatusHistory()` does not include `error`.
- `buildWhitelistStatus()` returns `loginRequired` when no user is provided.

- [ ] **Step 2: Run tests to verify RED**

Run: `npx vitest run src/dashboard/routes/public-api/public-data.test.ts`

Expected: fail because `public-data.ts` does not exist.

- [ ] **Step 3: Implement public DTO helpers**

Create `src/dashboard/routes/public-api/public-data.ts` with pure helper functions. Use only safe fields and no admin logs, AI logs, audit logs, secrets, stack traces, or per-user analytics.

- [ ] **Step 4: Run targeted tests**

Run: `npx vitest run src/dashboard/routes/public-api/public-data.test.ts`

Expected: pass.

### Task 2: Public API Routes

- [ ] **Step 1: Wire unauthenticated public routes**

Update `src/dashboard/routes/public-api/index.ts` so public read routes do not use `requirePublicAuth`, while `/me` and `/tickets` do.

- [ ] **Step 2: Extend route payloads**

Update `overview.ts` and add route handlers for `/server`, `/community`, `/rules`, `/events`, `/changelog`, `/announcements`, `/faq`, `/support`, and `/me/whitelist-status` using `public-data.ts`.

- [ ] **Step 3: Remove public AI exposure**

Remove or stop registering public `/analytics/ai`. Keep aggregate messages, voice, growth, tickets, and server-status only.

- [ ] **Step 4: Build**

Run: `npm run build`

Expected: pass.

### Task 3: Public App Shell

- [ ] **Step 1: Update navigation**

Update `dashboard/public-user/index.html` to show Overview, Server, Community, Rules, Events, Changelog, and Support. Remove emoji navigation.

- [ ] **Step 2: Update frontend API behavior**

Update `api.js` so public GETs do not redirect on 401. Add `getPublic`, `getPrivate`, and helpers for new endpoints.

- [ ] **Step 3: Update app router**

Update `app.js` to support new pages, anonymous users, protected area login prompts, safe error messages, date/number helpers, and reusable card helpers.

### Task 4: Public Pages

- [ ] **Step 1: Rebuild overview**

Update `overview.js` with server hero, community snapshot, 24h activity, announcements, events, and changelog sections.

- [ ] **Step 2: Add server page**

Create `server.js` with current status, status history charts, season/wipe empty state, safe server config, and CTAs.

- [ ] **Step 3: Add community page**

Create `community.js` with aggregate member growth, activity summaries, channel aggregate charts, and team distribution empty state.

- [ ] **Step 4: Add rules page**

Create `rules.js` with search and accordion categories from real rules data.

- [ ] **Step 5: Add events and changelog pages**

Create `events.js` and `changelog.js` with empty states and safe CTAs.

- [ ] **Step 6: Rework support page**

Modify `tickets.js` into support page with general support info, categories, login prompt, and own-ticket cards for authenticated users.

### Task 5: Public Design System

- [ ] **Step 1: Update CSS**

Update `dashboard/public-user/css/dashboard.css` for premium dark tactical layout, public hero cards, card grids, accordions, timelines, empty states, responsive ticket cards, and mobile navigation.

- [ ] **Step 2: Manual static scan**

Run: `rg -n "AI|Logs|Audit|Top User|Leaderboard|Stacktrace|token|secret" dashboard/public-user src/dashboard/routes/public-api`

Expected: no public UI/API exposure of banned concepts, except deny-list text in comments/tests if present.

### Task 6: Verification

- [ ] **Step 1: Build**

Run: `npm run build`

Expected: pass.

- [ ] **Step 2: Targeted tests**

Run: `npx vitest run src/dashboard/routes/public-api/public-data.test.ts`

Expected: pass.

- [ ] **Step 3: Full tests**

Run: `npm test`

Expected: existing env-dependent suites may fail with missing `DISCORD_TOKEN`; report exact outcome.

- [ ] **Step 4: Route and UI smoke review**

Review all public pages for safe empty states, no fake data, and no public admin internals.
