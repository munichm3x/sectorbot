# Bootstrap Refactor Design — sectorbot

**Date:** 2026-05-22
**Scope:** `src/index.ts`, `src/client.ts`, new `src/bootstrap/`, new `src/features/streamer/streamer.interactions.ts`
**Approach:** Option B — BootstrapContext DI, moderate scope. No feature changes, no behavior changes.

---

## Problem

`src/index.ts` (196 lines, ~50 imports) registers all commands, interactions, features, analytics, dashboard, and scheduled jobs in one flat file. This makes the entry point hard to read, hard to test, and risky to change.

---

## Goals

- `index.ts` reduced to ~30 lines: create context, call bootstrap functions, login
- Each bootstrap concern has its own file with a single clear responsibility
- `BootstrapContext` makes dependencies explicit (no hidden module-level imports)
- Non-critical modules cannot crash the bot
- Global process error handlers added (currently missing)
- All existing commands, interactions, features, and behavior preserved exactly

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `src/bootstrap/context.ts` | **Create** | `BootstrapContext` interface + `createBootstrapContext()` factory |
| `src/bootstrap/registerCommands.ts` | **Create** | Register all 15 slash commands |
| `src/bootstrap/registerInteractions.ts` | **Create** | Register all buttons, modals, selects, channel/role selects |
| `src/bootstrap/registerFeatures.ts` | **Create** | Start event-driven features (oldManLore, changelogDashboard, eventSync) |
| `src/bootstrap/registerScheduledJobs.ts` | **Create** | Start polling features (scumStatus, streamerChecker, ticketAutoClose) |
| `src/bootstrap/registerAnalytics.ts` | **Create** | Conditional analytics tracking + aggregator |
| `src/bootstrap/registerDashboard.ts` | **Create** | Conditional lazy dashboard start on ready |
| `src/bootstrap/registerErrorHandlers.ts` | **Create** | Global process error handlers + graceful shutdown |
| `src/features/streamer/streamer.interactions.ts` | **Create** | Encapsulate the 6 anonymous 'str' interaction handlers from index.ts |
| `src/index.ts` | **Modify** | Shrink to ~30 lines: build context, call bootstrap fns, login |
| `src/client.ts` | **Modify** | Rename log labels: `'[commands]'` and `'[interactions]'` for clarity |

**Unchanged:** all `src/commands/`, `src/features/`, `src/interactions/`, `src/analytics/`, `src/dashboard/`, `src/db/`, `src/services/`, `src/types/`

---

## Section 1: BootstrapContext

```ts
// src/bootstrap/context.ts
import type { Client, Collection } from 'discord.js';
import type {
  Command, ButtonHandler, SelectMenuHandler,
  ChannelSelectMenuHandler, RoleSelectMenuHandler,
  ModalHandler, UserSelectMenuHandler,
} from '../types';
import type { env } from '../config/env';
import type { logger } from '../utils/logger';

export interface BootstrapContext {
  client:                Client;
  commands:              Collection<string, Command>;
  buttonHandlers:        Map<string, ButtonHandler>;
  selectMenuHandlers:    Map<string, SelectMenuHandler>;
  channelSelectHandlers: Map<string, ChannelSelectMenuHandler>;
  roleSelectHandlers:    Map<string, RoleSelectMenuHandler>;
  modalHandlers:         Map<string, ModalHandler>;
  userSelectHandlers:    Map<string, UserSelectMenuHandler>;
  env:                   typeof env;
  logger:                typeof logger;
}
```

`createBootstrapContext()` assembles the context object from the exports of `client.ts` and the singletons `env` and `logger`. Called once in `index.ts`.

---

## Section 2: New `src/index.ts`

```ts
import { env } from './config/env';
import { initDb } from './db/index';
import { logger } from './utils/logger';
import {
  client, commands, buttonHandlers, selectMenuHandlers,
  channelSelectHandlers, roleSelectHandlers, modalHandlers, userSelectHandlers,
} from './client';
import { registerErrorHandlers } from './bootstrap/registerErrorHandlers';
import { registerCommands }      from './bootstrap/registerCommands';
import { registerInteractions }  from './bootstrap/registerInteractions';
import { registerFeatures }      from './bootstrap/registerFeatures';
import { registerScheduledJobs } from './bootstrap/registerScheduledJobs';
import { registerAnalytics }     from './bootstrap/registerAnalytics';
import { registerDashboard }     from './bootstrap/registerDashboard';

const ctx = {
  client, commands, buttonHandlers, selectMenuHandlers,
  channelSelectHandlers, roleSelectHandlers, modalHandlers,
  userSelectHandlers, env, logger,
};

registerErrorHandlers(ctx);
initDb(env.DATABASE_PATH);
registerCommands(ctx);
registerInteractions(ctx);
registerFeatures(ctx);
registerScheduledJobs(ctx);
registerAnalytics(ctx);
registerDashboard(ctx);

client.once('ready', (c) => {
  logger.info(`Bot online: ${c.user.tag} (${c.user.id})`);
  logger.info(`Commands: ${commands.size} | Buttons: ${buttonHandlers.size}`);
});

client.login(env.DISCORD_TOKEN);
```

**Execution order rationale:**
1. `registerErrorHandlers` — must be first so process errors are caught from the start
2. `initDb` — DB must exist before features try to query it
3. `registerCommands` / `registerInteractions` — populate handler maps before `client.login` triggers events
4. Feature/job/analytics/dashboard setup
5. `client.login` — connects to Discord last

---

## Section 3: `src/client.ts` changes

Only the log labels in `interactionCreate` are changed for observability:
- Inner catch (command handler): `logger.error('Interaction-Fehler', err)` → `logger.error('[commands] Interaktion fehlgeschlagen:', err)`
- Outer catch (all other handlers): `logger.error('Interaction-Fehler', err)` → `logger.error('[interactions] Unbehandelter Fehler:', err)`

No structural changes.

---

## Section 4: Bootstrap Modules

### `registerCommands(ctx)`
Calls `ctx.commands.set(cmd.data.name, cmd)` for all 15 commands. Throws on error (critical — bot is useless without commands).

Commands registered: `setup`, `config`, `doctor`, `ticket-close`, `ticket-add`, `ticket-remove`, `ticket-rename`, `ticket-claim`, `oldman-channel`, `clear`, `streamer`, `ticket-archiv`, `sync-import`, `announce`, `wipe`.

### `registerInteractions(ctx)`
Registers all interaction handler maps:
- **Buttons (11):** ticketClose, ticketConfirmClose, ticketCancelClose, ticketClaim, ticketAddPrompt, ticketRemovePrompt, acceptRules, setupButtonDispatcher, changelogButton, scumStatusSetup, ticketArchivButton
- **Select menus (2):** ticketCategory, ticketArchivSelect
- **Channel selects (2):** setupChannelSelectDispatcher, 'str' (streamer)
- **Role selects (2):** setupRoleSelectDispatcher, 'str' (streamer)
- **Modals (6):** ticketAddModal, ticketRemoveModal, setupAddCategoryModal, changelogModal, scumStatusModal, ticketArchivModal, 'str' (streamer)
- **User selects (1):** 'str' (streamer)

The 'str' handlers are imported from `streamer.interactions.ts` via `registerStreamerInteractions(ctx)`.

Throws on error (critical).

### `registerFeatures(ctx)`
Calls event-driven feature setup functions. Each wrapped individually:
```ts
try { setupOldManLore(ctx.client); }
catch (err) { ctx.logger.error('[bootstrap] setupOldManLore fehlgeschlagen:', err); }
// ... same for setupChangelogDashboard, registerEventSyncListeners
```

### `registerScheduledJobs(ctx)`
Calls polling/interval-based feature setup. Each wrapped individually:
```ts
try { setupScumStatus(ctx.client); }
catch (err) { ctx.logger.error('[bootstrap] setupScumStatus fehlgeschlagen:', err); }
// ... same for setupStreamerChecker, setupTicketAutoClose
```

### `registerAnalytics(ctx)`
```ts
if (!ctx.env.ANALYTICS_ENABLED) return;
try {
  setupAnalyticsTracking(ctx.client);
  setupAggregator();
} catch (err) {
  ctx.logger.error('[bootstrap] Analytics-Setup fehlgeschlagen:', err);
}
```

### `registerDashboard(ctx)`
```ts
if (!ctx.env.DASHBOARD_ENABLED) return;
ctx.client.once('ready', () => {
  import('../dashboard/server')
    .then(({ startDashboard }) => startDashboard(ctx.client))
    .catch(err => ctx.logger.error('[dashboard] Startfehler:', err));
});
```

### `registerErrorHandlers(ctx)`
```ts
process.on('uncaughtException', (err) => {
  ctx.logger.error('[process] uncaughtException:', err);
  process.exit(1);
});
process.on('unhandledRejection', (reason) => {
  ctx.logger.error('[process] unhandledRejection:', reason);
});
process.on('SIGTERM', () => {
  ctx.logger.info('[process] SIGTERM empfangen — graceful shutdown');
  ctx.client.destroy();
  process.exit(0);
});
```

---

## Section 5: `src/features/streamer/streamer.interactions.ts`

Encapsulates the 6 anonymous inline handler objects that were in `index.ts` under the `'str'` prefix. Exports a single function:

```ts
export function registerStreamerInteractions(ctx: BootstrapContext): void {
  ctx.buttonHandlers.set('str', { prefix: 'str', execute(interaction, payload) { ... } });
  ctx.selectMenuHandlers.set('str', { ... });
  ctx.roleSelectHandlers.set('str', { ... });
  ctx.channelSelectHandlers.set('str', { ... });
  ctx.modalHandlers.set('str', { ... });
  ctx.userSelectHandlers.set('str', { ... });
}
```

The handler logic is identical to what is currently in `index.ts` — only the location changes.

---

## Section 6: Error Handling Rules

| Module | Criticality | On error |
|--------|-------------|----------|
| `registerCommands` | Critical | throw → process exits |
| `registerInteractions` | Critical | throw → process exits |
| `registerFeatures` | Non-critical | log + continue per feature |
| `registerScheduledJobs` | Non-critical | log + continue per job |
| `registerAnalytics` | Non-critical | log + continue |
| `registerDashboard` | Non-critical | log + continue |
| `registerErrorHandlers` | Bootstrap | no try/catch needed (pure sync) |

---

## Section 7: Tests

### Existing tests
All unaffected — no feature modules are changed.

### New tests: `src/bootstrap/__tests__/registerCommands.test.ts`
```ts
import { describe, it, expect } from 'vitest';
import { Collection } from 'discord.js';
import { registerCommands } from '../registerCommands';

it('registers all 15 commands', () => {
  const ctx = { commands: new Collection(), /* ... minimal mock ... */ };
  registerCommands(ctx as never);
  expect(ctx.commands.size).toBe(15);
  expect(ctx.commands.has('setup')).toBe(true);
  expect(ctx.commands.has('wipe')).toBe(true);
});
```

### New tests: `src/bootstrap/__tests__/registerInteractions.test.ts`
Verifies that after calling `registerInteractions(ctx)`, the expected prefix keys are present in each handler map.

### TypeScript check
`npm run build` must pass with zero errors.

---

## Behavior Changes

| Area | Change |
|------|--------|
| Commands | None — identical registrations |
| Interactions | None — identical handlers |
| Features | None — same setup calls |
| Analytics | None — same conditional logic |
| Dashboard | None — same lazy import |
| Error logging | Log labels improved: `'[commands]'`, `'[interactions]'` instead of `'Interaction-Fehler'` |
| Process errors | **New:** `uncaughtException`, `unhandledRejection`, `SIGTERM` handlers added |

---

## Open Risks

1. **Import order matters:** `registerCommands`/`registerInteractions` must run before `client.login()` — this is guaranteed by the synchronous execution order in `index.ts`.
2. **Feature failures silenced:** Non-critical try/catch means a setup error (e.g., DB query fails in `setupScumStatus`) will be logged but not halt the bot. This is intentional but means monitoring the logs matters more than before.
3. **No async bootstrap:** All setup functions are synchronous. If a future feature needs async initialization, the bootstrap pattern would need to be extended to `async/await`.
