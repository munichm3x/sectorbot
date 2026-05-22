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
