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
    expect(ctx.buttonHandlers.has('changelog')).toBe(true);
  });
});
