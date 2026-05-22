# Bootstrap Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Split the 196-line `src/index.ts` god-file into focused bootstrap modules under `src/bootstrap/`, introduce a typed `BootstrapContext` for dependency injection, add global process error handlers, and document the architecture in `docs/ARCHITECTURE.md`.

**Architecture:** A `BootstrapContext` interface carries the Discord client, all seven handler maps, `env`, and `logger`. `src/index.ts` assembles this context from the existing `client.ts` exports and passes it to eight focused `registerX(ctx)` functions. Each function owns one concern; non-critical functions wrap setup calls in per-item try/catch so a single failing feature cannot crash the bot.

**Tech Stack:** TypeScript, Discord.js v14, vitest, existing project conventions (no new dependencies).

**Working directory for all tasks:** `C:\Users\Administrator\Desktop\sectorbot`

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `src/bootstrap/context.ts` | Create | `BootstrapContext` interface — the shared DI contract |
| `src/features/streamer/streamer.interactions.ts` | Create | The 6 anonymous `'str'` handlers extracted from `index.ts` |
| `src/bootstrap/registerCommands.ts` | Create | Register all 15 slash commands |
| `src/bootstrap/registerInteractions.ts` | Create | Register all buttons, modals, selects, channel/role/user selects |
| `src/bootstrap/registerFeatures.ts` | Create | Event-driven feature setup (oldManLore, changelogDashboard, eventSync) |
| `src/bootstrap/registerScheduledJobs.ts` | Create | Polling feature setup (scumStatus, streamerChecker, ticketAutoClose) |
| `src/bootstrap/registerAnalytics.ts` | Create | Conditional analytics tracking + aggregator |
| `src/bootstrap/registerDashboard.ts` | Create | Conditional lazy dashboard start on `ready` |
| `src/bootstrap/registerErrorHandlers.ts` | Create | `process.uncaughtException`, `unhandledRejection`, `SIGTERM` |
| `src/bootstrap/__tests__/registerCommands.test.ts` | Create | Verify all 15 commands are registered |
| `src/bootstrap/__tests__/registerInteractions.test.ts` | Create | Verify all interaction handler maps are populated |
| `src/client.ts` | Modify | Improve log labels in `interactionCreate` error handlers |
| `src/index.ts` | Modify | Replace 196-line god-file with ~30-line lean entry point |
| `docs/ARCHITECTURE.md` | Create | Architecture documentation |

**Unchanged:** all `src/commands/`, `src/features/` (except new streamer.interactions.ts), `src/interactions/`, `src/analytics/`, `src/dashboard/`, `src/db/`, `src/services/`, `src/types/`

---

## Task 1: Create `src/bootstrap/context.ts`

**Files:**
- Create: `src/bootstrap/context.ts`

The `BootstrapContext` interface is the shared contract all bootstrap functions accept. It carries the Discord client, all seven handler maps, a minimal env subset, and the logger. It does **not** import `env.ts` or `logger.ts` at the module level — the types are declared inline to avoid triggering dotenv side-effects in unit tests.

- [ ] **Step 1: Create `src/bootstrap/context.ts`**

```ts
// src/bootstrap/context.ts
import type { Client, Collection } from 'discord.js';
import type {
  Command,
  ButtonHandler,
  SelectMenuHandler,
  ChannelSelectMenuHandler,
  RoleSelectMenuHandler,
  ModalHandler,
  UserSelectMenuHandler,
} from '../types';

export interface BootstrapContext {
  client:                Client;
  commands:              Collection<string, Command>;
  buttonHandlers:        Map<string, ButtonHandler>;
  selectMenuHandlers:    Map<string, SelectMenuHandler>;
  channelSelectHandlers: Map<string, ChannelSelectMenuHandler>;
  roleSelectHandlers:    Map<string, RoleSelectMenuHandler>;
  modalHandlers:         Map<string, ModalHandler>;
  userSelectHandlers:    Map<string, UserSelectMenuHandler>;
  env: {
    NODE_ENV:           string;
    DATABASE_PATH:      string;
    DISCORD_TOKEN:      string;
    ANALYTICS_ENABLED:  boolean;
    DASHBOARD_ENABLED:  boolean;
  };
  logger: {
    info:  (...args: unknown[]) => void;
    warn:  (...args: unknown[]) => void;
    error: (...args: unknown[]) => void;
    debug: (...args: unknown[]) => void;
  };
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd C:\Users\Administrator\Desktop\sectorbot && npm run build
```

Expected: no TypeScript errors.

- [ ] **Step 3: Commit**

```bash
git add src/bootstrap/context.ts
git commit -m "feat(bootstrap): add BootstrapContext interface"
```

---

## Task 2: Create `src/features/streamer/streamer.interactions.ts`

**Files:**
- Create: `src/features/streamer/streamer.interactions.ts`

The six anonymous `'str'`-prefix handler objects that live inline in `index.ts` have no natural home. Moving them here gives the streamer feature complete ownership of its interaction layer.

- [ ] **Step 1: Create `src/features/streamer/streamer.interactions.ts`**

```ts
// src/features/streamer/streamer.interactions.ts
import type { BootstrapContext } from '../../bootstrap/context';
import {
  handleWizardButton,
  handleWizardRoleSelect,
  handleWizardChannelSelect,
  handleWizardModal,
} from './streamer.wizard';
import {
  handleDashboardButton,
  handleDashboardRoleSelect,
  handleDashboardChannelSelect,
  handleDashboardStringSelect,
  handleDashboardUserSelect,
  handleDashboardModal,
} from './streamer.dashboard';

export function registerStreamerInteractions(ctx: BootstrapContext): void {
  ctx.buttonHandlers.set('str', {
    prefix: 'str',
    async execute(interaction, payload) {
      if (payload.startsWith('wizard:')) {
        return handleWizardButton(interaction, payload);
      }
      return handleDashboardButton(interaction, payload, ctx.client);
    },
  });

  ctx.selectMenuHandlers.set('str', {
    prefix: 'str',
    async execute(interaction, payload) {
      return handleDashboardStringSelect(interaction, payload);
    },
  });

  ctx.roleSelectHandlers.set('str', {
    prefix: 'str',
    async execute(interaction, payload) {
      if (payload.startsWith('wizard:role')) {
        return handleWizardRoleSelect(interaction, payload);
      }
      return handleDashboardRoleSelect(interaction, payload);
    },
  });

  ctx.channelSelectHandlers.set('str', {
    prefix: 'str',
    async execute(interaction, payload) {
      if (payload.startsWith('wizard:channel')) {
        return handleWizardChannelSelect(interaction, payload);
      }
      return handleDashboardChannelSelect(interaction, payload);
    },
  });

  ctx.modalHandlers.set('str', {
    prefix: 'str',
    async execute(interaction, payload) {
      if (payload.includes('_wizard')) {
        return handleWizardModal(interaction, payload);
      }
      return handleDashboardModal(interaction, payload, ctx.client);
    },
  });

  ctx.userSelectHandlers.set('str', {
    prefix: 'str',
    async execute(interaction, payload) {
      return handleDashboardUserSelect(interaction, payload);
    },
  });
}
```

- [ ] **Step 2: Build**

```bash
npm run build
```

Expected: no TypeScript errors.

- [ ] **Step 3: Commit**

```bash
git add src/features/streamer/streamer.interactions.ts
git commit -m "feat(streamer): extract streamer interaction handlers into streamer.interactions.ts"
```

---

## Task 3: Create `src/bootstrap/registerCommands.ts` (TDD)

**Files:**
- Create: `src/bootstrap/__tests__/registerCommands.test.ts`
- Create: `src/bootstrap/registerCommands.ts`

- [ ] **Step 1: Create the test file**

```ts
// src/bootstrap/__tests__/registerCommands.test.ts
import { describe, it, expect, vi } from 'vitest';
import { Collection } from 'discord.js';
import { registerCommands } from '../registerCommands';
import type { BootstrapContext } from '../context';

function makeCtx(): Pick<BootstrapContext, 'commands' | 'logger'> & Partial<BootstrapContext> {
  return {
    client:                {} as never,
    commands:              new Collection(),
    buttonHandlers:        new Map(),
    selectMenuHandlers:    new Map(),
    channelSelectHandlers: new Map(),
    roleSelectHandlers:    new Map(),
    modalHandlers:         new Map(),
    userSelectHandlers:    new Map(),
    env:                   {} as never,
    logger: {
      info:  vi.fn(),
      warn:  vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    },
  };
}

describe('registerCommands', () => {
  it('registers exactly 15 commands', () => {
    const ctx = makeCtx() as BootstrapContext;
    registerCommands(ctx);
    expect(ctx.commands.size).toBe(15);
  });

  it('registers the setup command', () => {
    const ctx = makeCtx() as BootstrapContext;
    registerCommands(ctx);
    expect(ctx.commands.has('setup')).toBe(true);
  });

  it('registers the wipe command', () => {
    const ctx = makeCtx() as BootstrapContext;
    registerCommands(ctx);
    expect(ctx.commands.has('wipe')).toBe(true);
  });

  it('registers the streamer command', () => {
    const ctx = makeCtx() as BootstrapContext;
    registerCommands(ctx);
    expect(ctx.commands.has('streamer')).toBe(true);
  });

  it('registers ticket-archiv command', () => {
    const ctx = makeCtx() as BootstrapContext;
    registerCommands(ctx);
    expect(ctx.commands.has('ticket-archiv')).toBe(true);
  });
});
```

- [ ] **Step 2: Run the test — verify it fails**

```bash
npm test -- src/bootstrap/__tests__/registerCommands.test.ts
```

Expected: FAIL — `Cannot find module '../registerCommands'`

- [ ] **Step 3: Create `src/bootstrap/registerCommands.ts`**

```ts
// src/bootstrap/registerCommands.ts
import type { BootstrapContext } from './context';
import { setupCommand }         from '../commands/setup';
import { configCommand }        from '../commands/config';
import { doctorCommand }        from '../commands/doctor';
import { ticketCloseCommand }   from '../commands/ticket-close';
import { ticketAddCommand }     from '../commands/ticket-add';
import { ticketRemoveCommand }  from '../commands/ticket-remove';
import { ticketRenameCommand }  from '../commands/ticket-rename';
import { ticketClaimCommand }   from '../commands/ticket-claim';
import { oldmanChannelCommand } from '../commands/oldman-channel';
import { clearCommand }         from '../commands/clear';
import { streamerCommand }      from '../commands/streamer';
import { ticketArchivCommand }  from '../commands/ticket-archiv';
import { syncImportCommand }    from '../commands/sync-import';
import { announceCommand }      from '../commands/announce';
import { wipeCommand }          from '../commands/wipe';

export function registerCommands(ctx: BootstrapContext): void {
  for (const cmd of [
    setupCommand, configCommand, doctorCommand,
    ticketCloseCommand, ticketAddCommand, ticketRemoveCommand,
    ticketRenameCommand, ticketClaimCommand, oldmanChannelCommand, clearCommand,
    streamerCommand, ticketArchivCommand, syncImportCommand,
    announceCommand, wipeCommand,
  ]) {
    ctx.commands.set(cmd.data.name, cmd);
  }
  ctx.logger.info(`[bootstrap] ${ctx.commands.size} Commands registriert.`);
}
```

- [ ] **Step 4: Run the test — verify it passes**

```bash
npm test -- src/bootstrap/__tests__/registerCommands.test.ts
```

Expected: 5 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/bootstrap/registerCommands.ts src/bootstrap/__tests__/registerCommands.test.ts
git commit -m "feat(bootstrap): add registerCommands with tests"
```

---

## Task 4: Create `src/bootstrap/registerInteractions.ts` (TDD)

**Files:**
- Create: `src/bootstrap/__tests__/registerInteractions.test.ts`
- Create: `src/bootstrap/registerInteractions.ts`

Handler count breakdown (for test assertions):
- **buttonHandlers**: 11 named + `'str'` (streamer) = **12**
- **selectMenuHandlers**: 2 named + `'str'` = **3**
- **channelSelectHandlers**: 1 named + `'str'` = **2**
- **roleSelectHandlers**: 1 named + `'str'` = **2**
- **modalHandlers**: 6 named + `'str'` = **7**
- **userSelectHandlers**: `'str'` only = **1**

- [ ] **Step 1: Create the test file**

```ts
// src/bootstrap/__tests__/registerInteractions.test.ts
import { describe, it, expect, vi } from 'vitest';
import { Collection } from 'discord.js';
import { registerInteractions } from '../registerInteractions';
import type { BootstrapContext } from '../context';

function makeCtx(): BootstrapContext {
  return {
    client:                {} as never,
    commands:              new Collection(),
    buttonHandlers:        new Map(),
    selectMenuHandlers:    new Map(),
    channelSelectHandlers: new Map(),
    roleSelectHandlers:    new Map(),
    modalHandlers:         new Map(),
    userSelectHandlers:    new Map(),
    env:                   {} as never,
    logger: {
      info:  vi.fn(),
      warn:  vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    },
  };
}

describe('registerInteractions', () => {
  it('registers 12 button handlers (11 + str)', () => {
    const ctx = makeCtx();
    registerInteractions(ctx);
    expect(ctx.buttonHandlers.size).toBe(12);
  });

  it('registers 3 select menu handlers (2 + str)', () => {
    const ctx = makeCtx();
    registerInteractions(ctx);
    expect(ctx.selectMenuHandlers.size).toBe(3);
  });

  it('registers 7 modal handlers (6 + str)', () => {
    const ctx = makeCtx();
    registerInteractions(ctx);
    expect(ctx.modalHandlers.size).toBe(7);
  });

  it('registers str prefix in all streamer interaction maps', () => {
    const ctx = makeCtx();
    registerInteractions(ctx);
    expect(ctx.buttonHandlers.has('str')).toBe(true);
    expect(ctx.selectMenuHandlers.has('str')).toBe(true);
    expect(ctx.roleSelectHandlers.has('str')).toBe(true);
    expect(ctx.channelSelectHandlers.has('str')).toBe(true);
    expect(ctx.modalHandlers.has('str')).toBe(true);
    expect(ctx.userSelectHandlers.has('str')).toBe(true);
  });

  it('registers changelog button handler', () => {
    const ctx = makeCtx();
    registerInteractions(ctx);
    // changelogButtonHandler.prefix is 'clb'
    expect(ctx.buttonHandlers.has('clb')).toBe(true);
  });
});
```

Note on the `'clb'` prefix: verify the actual prefix by reading `src/interactions/buttons/changelogButtonHandler.ts` before running the test. If it differs, update the test accordingly.

- [ ] **Step 2: Check the changelog button prefix**

```bash
cd C:\Users\Administrator\Desktop\sectorbot && grep -n "prefix" src/interactions/buttons/changelogButtonHandler.ts | head -5
```

Update `'clb'` in the test if the actual prefix is different.

- [ ] **Step 3: Run the test — verify it fails**

```bash
npm test -- src/bootstrap/__tests__/registerInteractions.test.ts
```

Expected: FAIL — `Cannot find module '../registerInteractions'`

- [ ] **Step 4: Create `src/bootstrap/registerInteractions.ts`**

```ts
// src/bootstrap/registerInteractions.ts
import type { BootstrapContext } from './context';

import { changelogButtonHandler }       from '../interactions/buttons/changelogButtonHandler';
import { scumStatusSetupHandler }       from '../interactions/buttons/setup/scumStatusSetupHandler';
import { ticketArchivButtonHandler }    from '../interactions/buttons/ticketArchivHandler';
import { ticketCloseHandler }           from '../interactions/buttons/closeTicket';
import { ticketConfirmCloseHandler }    from '../interactions/buttons/confirmClose';
import { ticketCancelCloseHandler }     from '../interactions/buttons/cancelClose';
import { ticketClaimHandler }           from '../interactions/buttons/claimTicket';
import { ticketAddPromptHandler }       from '../interactions/buttons/addUserPrompt';
import { ticketRemovePromptHandler }    from '../interactions/buttons/removeUserPrompt';
import { acceptRulesHandler }           from '../interactions/buttons/acceptRules';
import { setupButtonDispatcher }        from '../interactions/buttons/setup/setupDispatcher';

import { ticketCategoryHandler }        from '../interactions/selectMenus/ticketCategory';
import { ticketArchivSelectHandler }    from '../interactions/selectMenus/ticketArchivSelectHandler';

import { setupChannelSelectDispatcher } from '../interactions/channelSelects/setupChannelSelectDispatcher';
import { setupRoleSelectDispatcher }    from '../interactions/roleSelects/setupRoleSelectDispatcher';

import { ticketAddModalHandler }        from '../interactions/modals/ticketAddModal';
import { ticketRemoveModalHandler }     from '../interactions/modals/ticketRemoveModal';
import { setupAddCategoryModal }        from '../interactions/modals/setupAddCategoryModal';
import { changelogModalHandler }        from '../interactions/modals/changelogModalHandler';
import { scumStatusModalHandler }       from '../interactions/modals/scumStatusModals';
import { ticketArchivModalHandler }     from '../interactions/modals/ticketArchivModalHandler';

import { registerStreamerInteractions } from '../features/streamer/streamer.interactions';

export function registerInteractions(ctx: BootstrapContext): void {
  // Buttons
  for (const handler of [
    ticketCloseHandler, ticketConfirmCloseHandler, ticketCancelCloseHandler,
    ticketClaimHandler, ticketAddPromptHandler, ticketRemovePromptHandler,
    acceptRulesHandler, setupButtonDispatcher, changelogButtonHandler,
    scumStatusSetupHandler, ticketArchivButtonHandler,
  ]) {
    ctx.buttonHandlers.set(handler.prefix, handler);
  }

  // String select menus
  ctx.selectMenuHandlers.set(ticketCategoryHandler.prefix, ticketCategoryHandler);
  ctx.selectMenuHandlers.set(ticketArchivSelectHandler.prefix, ticketArchivSelectHandler);

  // Channel + role selects
  ctx.channelSelectHandlers.set(setupChannelSelectDispatcher.prefix, setupChannelSelectDispatcher);
  ctx.roleSelectHandlers.set(setupRoleSelectDispatcher.prefix, setupRoleSelectDispatcher);

  // Modals
  for (const handler of [
    ticketAddModalHandler, ticketRemoveModalHandler, setupAddCategoryModal,
    changelogModalHandler, scumStatusModalHandler, ticketArchivModalHandler,
  ]) {
    ctx.modalHandlers.set(handler.prefix, handler);
  }

  // Streamer interactions — buttons, selects, modals, user-selects all under 'str'
  registerStreamerInteractions(ctx);

  ctx.logger.info(
    `[bootstrap] Interactions registriert — Buttons: ${ctx.buttonHandlers.size}, Modals: ${ctx.modalHandlers.size}`
  );
}
```

- [ ] **Step 5: Run the test — verify it passes**

```bash
npm test -- src/bootstrap/__tests__/registerInteractions.test.ts
```

Expected: 5 tests pass. If the changelog prefix test fails, grep the actual prefix and fix the assertion.

- [ ] **Step 6: Commit**

```bash
git add src/bootstrap/registerInteractions.ts src/bootstrap/__tests__/registerInteractions.test.ts
git commit -m "feat(bootstrap): add registerInteractions with tests"
```

---

## Task 5: Create `src/bootstrap/registerFeatures.ts`

**Files:**
- Create: `src/bootstrap/registerFeatures.ts`

Event-driven features. Each wrapped individually so one failure doesn't abort the others.

- [ ] **Step 1: Create `src/bootstrap/registerFeatures.ts`**

```ts
// src/bootstrap/registerFeatures.ts
import type { BootstrapContext } from './context';
import { setupOldManLore }            from '../features/oldManLore';
import { setupChangelogDashboard }    from '../features/changelogDashboard';
import { registerEventSyncListeners } from '../features/discordSync/eventListeners';

export function registerFeatures(ctx: BootstrapContext): void {
  try {
    setupOldManLore(ctx.client);
  } catch (err) {
    ctx.logger.error('[bootstrap] setupOldManLore fehlgeschlagen:', err);
  }

  try {
    setupChangelogDashboard(ctx.client);
  } catch (err) {
    ctx.logger.error('[bootstrap] setupChangelogDashboard fehlgeschlagen:', err);
  }

  try {
    registerEventSyncListeners(ctx.client);
  } catch (err) {
    ctx.logger.error('[bootstrap] registerEventSyncListeners fehlgeschlagen:', err);
  }
}
```

- [ ] **Step 2: Build**

```bash
npm run build
```

Expected: no TypeScript errors.

- [ ] **Step 3: Commit**

```bash
git add src/bootstrap/registerFeatures.ts
git commit -m "feat(bootstrap): add registerFeatures"
```

---

## Task 6: Create `src/bootstrap/registerScheduledJobs.ts`

**Files:**
- Create: `src/bootstrap/registerScheduledJobs.ts`

Polling/interval-based jobs. Each wrapped individually.

- [ ] **Step 1: Create `src/bootstrap/registerScheduledJobs.ts`**

```ts
// src/bootstrap/registerScheduledJobs.ts
import type { BootstrapContext } from './context';
import { setupScumStatus }      from '../features/scumStatus/scumStatus.updater';
import { setupStreamerChecker }  from '../features/streamer/streamer.checker';
import { setupTicketAutoClose } from '../features/ticketAutoClose';

export function registerScheduledJobs(ctx: BootstrapContext): void {
  try {
    setupScumStatus(ctx.client);
  } catch (err) {
    ctx.logger.error('[bootstrap] setupScumStatus fehlgeschlagen:', err);
  }

  try {
    setupStreamerChecker(ctx.client);
  } catch (err) {
    ctx.logger.error('[bootstrap] setupStreamerChecker fehlgeschlagen:', err);
  }

  try {
    setupTicketAutoClose(ctx.client);
  } catch (err) {
    ctx.logger.error('[bootstrap] setupTicketAutoClose fehlgeschlagen:', err);
  }
}
```

- [ ] **Step 2: Build**

```bash
npm run build
```

Expected: no TypeScript errors.

- [ ] **Step 3: Commit**

```bash
git add src/bootstrap/registerScheduledJobs.ts
git commit -m "feat(bootstrap): add registerScheduledJobs"
```

---

## Task 7: Create `src/bootstrap/registerAnalytics.ts`

**Files:**
- Create: `src/bootstrap/registerAnalytics.ts`

- [ ] **Step 1: Create `src/bootstrap/registerAnalytics.ts`**

```ts
// src/bootstrap/registerAnalytics.ts
import type { BootstrapContext } from './context';
import { setupAnalyticsTracking, setupAggregator } from '../analytics/index';

export function registerAnalytics(ctx: BootstrapContext): void {
  if (!ctx.env.ANALYTICS_ENABLED) return;
  try {
    setupAnalyticsTracking(ctx.client);
    setupAggregator();
    ctx.logger.info('[bootstrap] Analytics gestartet.');
  } catch (err) {
    ctx.logger.error('[bootstrap] Analytics-Setup fehlgeschlagen:', err);
  }
}
```

- [ ] **Step 2: Build**

```bash
npm run build
```

- [ ] **Step 3: Commit**

```bash
git add src/bootstrap/registerAnalytics.ts
git commit -m "feat(bootstrap): add registerAnalytics"
```

---

## Task 8: Create `src/bootstrap/registerDashboard.ts`

**Files:**
- Create: `src/bootstrap/registerDashboard.ts`

- [ ] **Step 1: Create `src/bootstrap/registerDashboard.ts`**

```ts
// src/bootstrap/registerDashboard.ts
import type { Client } from 'discord.js';
import type { BootstrapContext } from './context';

export function registerDashboard(ctx: BootstrapContext): void {
  if (!ctx.env.DASHBOARD_ENABLED) return;
  ctx.client.once('ready', () => {
    import('../dashboard/server')
      .then(({ startDashboard }: { startDashboard: (c: Client) => void }) => {
        startDashboard(ctx.client);
      })
      .catch((err: unknown) => ctx.logger.error('[dashboard] Startfehler:', err));
  });
}
```

- [ ] **Step 2: Build**

```bash
npm run build
```

- [ ] **Step 3: Commit**

```bash
git add src/bootstrap/registerDashboard.ts
git commit -m "feat(bootstrap): add registerDashboard"
```

---

## Task 9: Create `src/bootstrap/registerErrorHandlers.ts`

**Files:**
- Create: `src/bootstrap/registerErrorHandlers.ts`

Adds the three global process error handlers that are currently missing from the codebase.

- [ ] **Step 1: Create `src/bootstrap/registerErrorHandlers.ts`**

```ts
// src/bootstrap/registerErrorHandlers.ts
import type { BootstrapContext } from './context';

export function registerErrorHandlers(ctx: BootstrapContext): void {
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
}
```

- [ ] **Step 2: Build**

```bash
npm run build
```

- [ ] **Step 3: Commit**

```bash
git add src/bootstrap/registerErrorHandlers.ts
git commit -m "feat(bootstrap): add registerErrorHandlers (uncaughtException, unhandledRejection, SIGTERM)"
```

---

## Task 10: Modify `src/client.ts` — improve log labels

**Files:**
- Modify: `src/client.ts:42-49` and `src/client.ts:115-123`

Currently both error handlers emit `logger.error('Interaction-Fehler', err)`, making it impossible to tell from a log line whether the failure was in a command or an interaction handler.

- [ ] **Step 1: Read current `src/client.ts` lines 40–50 and 113–124**

Find the two `logger.error('Interaction-Fehler', err)` calls and their surrounding context.

- [ ] **Step 2: Update the inner error log (command handler, around line 43)**

Change:
```ts
        logger.error('Interaction-Fehler', err);
```
To:
```ts
        logger.error('[commands] Interaktion fehlgeschlagen:', err);
```

- [ ] **Step 3: Update the outer error log (safety-net catch, around line 116)**

Change:
```ts
    logger.error('Interaction-Fehler', err);
```
To:
```ts
    logger.error('[interactions] Unbehandelter Fehler:', err);
```

- [ ] **Step 4: Build**

```bash
npm run build
```

Expected: no TypeScript errors.

- [ ] **Step 5: Commit**

```bash
git add src/client.ts
git commit -m "fix(client): improve error log labels in interactionCreate handler"
```

---

## Task 11: Replace `src/index.ts`

**Files:**
- Modify: `src/index.ts`

This is the key step. The entire file is replaced. Read the current file first to confirm the existing content before overwriting.

- [ ] **Step 1: Read current `src/index.ts`**

Confirm the file starts with the imports from the design spec (196 lines). If the file has been modified since this plan was written, reconcile any differences.

- [ ] **Step 2: Replace `src/index.ts` with the lean version**

```ts
// src/index.ts
import { env }      from './config/env';
import { initDb }   from './db/index';
import { logger }   from './utils/logger';
import {
  client,
  commands,
  buttonHandlers,
  selectMenuHandlers,
  channelSelectHandlers,
  roleSelectHandlers,
  modalHandlers,
  userSelectHandlers,
} from './client';
import { registerErrorHandlers } from './bootstrap/registerErrorHandlers';
import { registerCommands }      from './bootstrap/registerCommands';
import { registerInteractions }  from './bootstrap/registerInteractions';
import { registerFeatures }      from './bootstrap/registerFeatures';
import { registerScheduledJobs } from './bootstrap/registerScheduledJobs';
import { registerAnalytics }     from './bootstrap/registerAnalytics';
import { registerDashboard }     from './bootstrap/registerDashboard';

const ctx = {
  client,
  commands,
  buttonHandlers,
  selectMenuHandlers,
  channelSelectHandlers,
  roleSelectHandlers,
  modalHandlers,
  userSelectHandlers,
  env,
  logger,
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

- [ ] **Step 3: Build**

```bash
npm run build
```

Expected: zero TypeScript errors. If errors appear, check that the `env` object satisfies the `BootstrapContext['env']` shape (it needs `NODE_ENV`, `DATABASE_PATH`, `DISCORD_TOKEN`, `ANALYTICS_ENABLED`, `DASHBOARD_ENABLED` — all present in `src/config/env.ts`).

- [ ] **Step 4: Run all tests**

```bash
npm test
```

Expected: same results as before this refactor. The 4 pre-existing `scumStatus` test failures (embed color + server query mock) are acceptable and unrelated. All other tests including the new bootstrap tests must pass.

- [ ] **Step 5: Commit**

```bash
git add src/index.ts
git commit -m "refactor(index): replace 196-line god-file with lean bootstrap-driven entry point"
```

---

## Task 12: Write `docs/ARCHITECTURE.md`

**Files:**
- Create: `docs/ARCHITECTURE.md`

- [ ] **Step 1: Create `docs/ARCHITECTURE.md`**

```markdown
# sectorbot — Architecture

## Overview

sectorbot is a Discord.js v14 bot with an optional Express-based admin dashboard. It is written in TypeScript and uses SQLite (via `better-sqlite3`) as its database.

---

## Startup Process

```
src/index.ts
│
├── registerErrorHandlers(ctx)   ← global process error handlers first
├── initDb(env.DATABASE_PATH)    ← SQLite opened/migrated before any feature runs
├── registerCommands(ctx)        ← populate commands Collection
├── registerInteractions(ctx)    ← populate all interaction handler Maps
├── registerFeatures(ctx)        ← event-driven features (listeners registered)
├── registerScheduledJobs(ctx)   ← polling features (intervals started)
├── registerAnalytics(ctx)       ← optional: tracking + aggregator
├── registerDashboard(ctx)       ← optional: dashboard starts on 'ready'
│
├── client.once('ready', ...)    ← log bot tag + handler counts
└── client.login(token)          ← connect to Discord Gateway
```

All registration happens synchronously before `client.login()`. Non-critical modules (`registerFeatures`, `registerScheduledJobs`, `registerAnalytics`) wrap each setup call individually — a failure in one does not abort the others.

---

## Bootstrap Modules (`src/bootstrap/`)

| File | Responsibility |
|------|---------------|
| `context.ts` | `BootstrapContext` interface — shared DI contract |
| `registerCommands.ts` | Register all 15 slash commands into `ctx.commands` |
| `registerInteractions.ts` | Register all button/modal/select handlers into their Maps |
| `registerFeatures.ts` | Start event-driven features |
| `registerScheduledJobs.ts` | Start polling/interval features |
| `registerAnalytics.ts` | Start analytics if `ANALYTICS_ENABLED=true` |
| `registerDashboard.ts` | Schedule dashboard start if `DASHBOARD_ENABLED=true` |
| `registerErrorHandlers.ts` | Register `uncaughtException`, `unhandledRejection`, `SIGTERM` |

### BootstrapContext

```ts
interface BootstrapContext {
  client:                Client;               // Discord.js Client
  commands:              Collection<string, Command>;
  buttonHandlers:        Map<string, ButtonHandler>;
  selectMenuHandlers:    Map<string, SelectMenuHandler>;
  channelSelectHandlers: Map<string, ChannelSelectMenuHandler>;
  roleSelectHandlers:    Map<string, RoleSelectMenuHandler>;
  modalHandlers:         Map<string, ModalHandler>;
  userSelectHandlers:    Map<string, UserSelectMenuHandler>;
  env:                   { ANALYTICS_ENABLED: boolean; DASHBOARD_ENABLED: boolean; ... };
  logger:                { info, warn, error, debug };
}
```

The context object is assembled once in `src/index.ts` from the exports of `src/client.ts`, `src/config/env.ts`, and `src/utils/logger.ts`. Bootstrap functions never import from `client.ts` directly — they operate on what they're given.

---

## Interaction Dispatch (`src/client.ts`)

`src/client.ts` creates the Discord client, exports all handler `Collection`/`Map` objects, and wires up the `interactionCreate` event listener. The listener:

1. Identifies the interaction type
2. Extracts `prefix` and `payload` from `customId` using `parseId()` from `src/utils/ids.ts`
3. Looks up the handler in the appropriate Map
4. Calls `handler.execute(interaction, payload)`

Command interactions have an inner try/catch for per-command error handling and analytics tracking. All other interaction types are caught by an outer try/catch safety net.

---

## Feature Modules (`src/features/`)

| Feature | Files | What it does |
|---------|-------|-------------|
| **Old Man Lore** | `oldManLore.ts` | AI-powered responses to messages matching a lore trigger, via `client.on('messageCreate')` |
| **Changelog Dashboard** | `changelogDashboard.ts` | Posts a changelog embed to a configured channel and keeps it up to date |
| **SCUM Status** | `scumStatus/` | Polls a game server via UDP, builds a status embed, updates a Discord message on an interval |
| **Streamer** | `streamer/` | Tracks Twitch/YouTube streamers, posts announcements; includes a setup wizard and dashboard UI |
| **Ticket Auto-Close** | `ticketAutoClose.ts` | Periodically checks for inactive tickets and closes them |
| **Discord Sync** | `discordSync/eventListeners.ts` | Syncs Discord scheduled events to the `public_events` DB table |

---

## Dashboard (`src/dashboard/`)

An Express 4 server started optionally when `DASHBOARD_ENABLED=true`. It is lazy-loaded on the `ready` event so the bot is fully connected before the HTTP server starts.

Key subsystems:

- **Auth**: Discord OAuth2, express-session with SQLite store, role-based permissions (`PermLevel` enum)
- **CSRF**: double-submit cookie pattern via `csrf-csrf`; token endpoint at `GET /api/csrf-token`
- **API routes** (`/api/*`): requires auth + CSRF on mutations; rate-limited 100 req/min
- **Public API** (`/public-api/*`): read-only, no auth required, returns only `public_visible=1` data
- **Admin routes**: settings, rules, events, changelog, announcements, FAQ, wipe info, server info, bot settings, ticket archive
- **Audit logs**: all mutations logged to `dashboard_audit_logs`; viewed at `GET /api/logs/audit`

---

## Database (`src/db/`)

SQLite database via `better-sqlite3`. Initialized with `initDb(path)` — supports `:memory:` for tests.

Schema is defined in `src/db/schema.ts` (bot tables) and `src/analytics/analytics.schema.ts` (analytics tables). Migrations are applied automatically on `initDb`.

Key tables:

| Table | Purpose |
|-------|---------|
| `guilds` | Per-guild bot configuration |
| `tickets` | Ticket records |
| `ticket_categories` | Configurable ticket category definitions |
| `panels` | Discord message panel references |
| `rules` | Public-facing rule entries |
| `public_events` | Events visible on the public dashboard |
| `changelog_entries` | Changelog entries with publish state |
| `public_announcements` | Announcements with display scheduling |
| `faq_items` | FAQ entries |
| `dashboard_audit_logs` | Admin action audit trail |
| `scum_status_config` | SCUM server polling configuration per guild |
| `streamer_configs` | Streamer notification configurations |

---

## Analytics (`src/analytics/`)

Optional module enabled via `ANALYTICS_ENABLED=true`.

- **`analytics.tracker.ts`**: listens to `messageCreate`, `voiceStateUpdate`, `guildScheduledEventCreate` to track activity metrics
- **`analytics.aggregator.ts`**: runs on an interval to roll up raw events into time-bucketed aggregates
- **`analytics.db.ts`**: write functions (`trackInteractionEvent`, `trackAiEvent`, `insertServerStatusHistory`, `insertAuditLog`) and `maskSecretKeys` for redacting sensitive fields before storage

---

## AI (`src/services/ai/`)

Multi-provider AI integration used by Old Man Lore and the ticket summary feature.

| Provider | Config key | Notes |
|----------|------------|-------|
| Gemini | `AI_PROVIDER=gemini`, `GEMINI_API_KEY` | Default primary |
| Groq | `AI_PROVIDER=groq`, `GROQ_API_KEY` | Fallback |
| OpenRouter | `AI_PROVIDER=openrouter`, `OPENROUTER_API_KEY` | Optional |
| Ollama | Local `OLLAMA_URL` | Local fallback for Old Man Lore |

The provider is selected at startup based on `AI_PROVIDER`. If the primary provider fails, `AI_FALLBACK_PROVIDER` is tried.

---

## Scheduled Jobs

All jobs are started in `registerScheduledJobs`:

| Job | Setup function | What it does |
|-----|---------------|-------------|
| SCUM Status | `setupScumStatus(client)` | Polls game server every `update_interval_secs`, updates embed |
| Streamer Checker | `setupStreamerChecker(client)` | Polls Twitch/YouTube APIs periodically |
| Ticket Auto-Close | `setupTicketAutoClose(client)` | Checks for stale open tickets on an interval |

Plus in `registerAnalytics`: `setupAggregator()` runs the analytics roll-up on a fixed interval.

All jobs handle their own errors internally. A crash inside a job's interval callback is caught and logged without stopping the interval.

---

## Logger (`src/utils/logger.ts`)

A lightweight custom logger with four levels (`info`, `warn`, `error`, `debug`). Writes formatted lines to stdout/stderr and maintains an in-memory ring buffer of the last 500 entries. The dashboard reads this buffer for its log stream endpoint.

---

## Environment Variables (key subset)

| Variable | Required | Purpose |
|----------|----------|---------|
| `DISCORD_TOKEN` | Yes | Bot login token |
| `CLIENT_ID` | Yes | Bot application ID (for slash command deploy) |
| `DATABASE_PATH` | No | SQLite file path (default: `./data/bot.db`) |
| `DASHBOARD_ENABLED` | No | Set to `true` to start the web dashboard |
| `DASHBOARD_SESSION_SECRET` | If dashboard | Must be changed in production |
| `DISCORD_CLIENT_SECRET` | If dashboard | For OAuth login |
| `ANALYTICS_ENABLED` | No | Set to `true` to enable activity tracking |
| `AI_PROVIDER` | No | `gemini` (default), `groq`, or `openrouter` |

See `docs/SECURITY.md` for the full production environment checklist.
```

- [ ] **Step 2: Build and run all tests one final time**

```bash
npm run build && npm test
```

Expected: zero build errors. Test results identical to pre-refactor (4 pre-existing scumStatus failures acceptable, all other tests including the 10 security tests and 2 new bootstrap tests pass).

- [ ] **Step 3: Commit**

```bash
git add docs/ARCHITECTURE.md
git commit -m "docs: add ARCHITECTURE.md covering bootstrap, features, dashboard, DB, analytics, AI, scheduled jobs"
```

---

## Self-Review

**Spec coverage:**

| Spec requirement | Covered by task |
|---|---|
| `src/bootstrap/context.ts` — BootstrapContext interface | Task 1 ✅ |
| `src/features/streamer/streamer.interactions.ts` | Task 2 ✅ |
| `src/bootstrap/registerCommands.ts` | Task 3 ✅ |
| `src/bootstrap/registerInteractions.ts` | Task 4 ✅ |
| `src/bootstrap/registerFeatures.ts` | Task 5 ✅ |
| `src/bootstrap/registerScheduledJobs.ts` | Task 6 ✅ |
| `src/bootstrap/registerAnalytics.ts` | Task 7 ✅ |
| `src/bootstrap/registerDashboard.ts` | Task 8 ✅ |
| `src/bootstrap/registerErrorHandlers.ts` | Task 9 ✅ |
| `src/client.ts` log labels | Task 10 ✅ |
| `src/index.ts` lean replacement | Task 11 ✅ |
| `docs/ARCHITECTURE.md` (all 8 sections) | Task 12 ✅ |
| Tests for registerCommands + registerInteractions | Tasks 3 + 4 ✅ |
| Non-critical per-item try/catch | Tasks 5, 6, 7 ✅ |
| Global process error handlers | Task 9 ✅ |

**Placeholder scan:** No TBDs. All code blocks are complete. One conditional note in Task 4 Step 2 (verify changelog button prefix) — this is intentional guidance, not a placeholder.

**Type consistency:** `BootstrapContext` defined in Task 1. All subsequent tasks import it from `'./context'` (Tasks 3–9) or `'../../bootstrap/context'` (Task 2). The `ctx.commands`, `ctx.buttonHandlers`, etc. field names are consistent throughout. `registerStreamerInteractions(ctx)` is defined in Task 2 and called in Task 4 — consistent signature.
