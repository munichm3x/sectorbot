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
  it('registers 14 button handlers (13 + str)', () => {
    const ctx = makeCtx();
    registerInteractions(ctx);
    expect(ctx.buttonHandlers.size).toBe(14);
  });

  it('registers 4 select menu handlers (3 + str)', () => {
    const ctx = makeCtx();
    registerInteractions(ctx);
    expect(ctx.selectMenuHandlers.size).toBe(4);
  });

  it('registers 9 modal handlers (8 + str)', () => {
    const ctx = makeCtx();
    registerInteractions(ctx);
    expect(ctx.modalHandlers.size).toBe(9);
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
    expect(ctx.buttonHandlers.has('changelog')).toBe(true);
  });
});
