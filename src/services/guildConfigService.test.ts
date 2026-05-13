import { describe, it, expect, beforeEach } from 'vitest';
import { initDb } from '../db/index';
import {
  getConfig, upsertConfig,
  getSupportRoles, setSupportRoles,
  getTicketCategories, getAllCategories,
  upsertCategory, deleteCategory,
  seedDefaultCategories,
} from './guildConfigService';

beforeEach(() => {
  initDb(':memory:');
});

describe('getConfig / upsertConfig', () => {
  it('returns undefined when no config exists', () => {
    expect(getConfig('g1')).toBeUndefined();
  });

  it('creates a config record', () => {
    const config = upsertConfig('g1', {});
    expect(config.guild_id).toBe('g1');
    expect(config.setup_completed).toBe(0);
    expect(config.ticket_panel_channel_id).toBeNull();
  });

  it('updates specific fields without clearing others', () => {
    upsertConfig('g1', { ticket_panel_channel_id: 'ch1' });
    upsertConfig('g1', { ticket_category_id: 'cat1' });
    const config = getConfig('g1')!;
    expect(config.ticket_panel_channel_id).toBe('ch1');
    expect(config.ticket_category_id).toBe('cat1');
  });

  it('sets setup_completed to 1', () => {
    upsertConfig('g1', {});
    upsertConfig('g1', { setup_completed: 1 });
    expect(getConfig('g1')!.setup_completed).toBe(1);
  });
});

describe('getSupportRoles / setSupportRoles', () => {
  it('returns empty array when none set', () => {
    expect(getSupportRoles('g1')).toEqual([]);
  });

  it('sets and retrieves support roles', () => {
    setSupportRoles('g1', ['r1', 'r2']);
    expect(getSupportRoles('g1')).toEqual(expect.arrayContaining(['r1', 'r2']));
  });

  it('replaces roles on second call', () => {
    setSupportRoles('g1', ['r1', 'r2']);
    setSupportRoles('g1', ['r3']);
    const roles = getSupportRoles('g1');
    expect(roles).toEqual(['r3']);
  });
});

describe('getTicketCategories / upsertCategory / deleteCategory', () => {
  it('returns empty array when none exist', () => {
    expect(getTicketCategories('g1')).toEqual([]);
  });

  it('creates a category', () => {
    upsertCategory('g1', {
      guild_id: 'g1', key: 'test', label: 'Test', description: 'Desc',
      emoji: '🔧', sort_order: 0, enabled: 1,
    });
    const cats = getTicketCategories('g1');
    expect(cats).toHaveLength(1);
    expect(cats[0].key).toBe('test');
  });

  it('updates existing category on upsert', () => {
    upsertCategory('g1', { guild_id: 'g1', key: 'test', label: 'Old', description: 'D', emoji: '🔧', sort_order: 0, enabled: 1 });
    upsertCategory('g1', { guild_id: 'g1', key: 'test', label: 'New', description: 'D', emoji: '🔧', sort_order: 0, enabled: 1 });
    const cats = getTicketCategories('g1');
    expect(cats[0].label).toBe('New');
  });

  it('deletes a category', () => {
    upsertCategory('g1', { guild_id: 'g1', key: 'test', label: 'Test', description: 'D', emoji: '🔧', sort_order: 0, enabled: 1 });
    deleteCategory('g1', 'test');
    expect(getTicketCategories('g1')).toHaveLength(0);
  });

  it('does not return disabled categories', () => {
    upsertCategory('g1', { guild_id: 'g1', key: 'test', label: 'Test', description: 'D', emoji: '🔧', sort_order: 0, enabled: 0 });
    expect(getTicketCategories('g1')).toHaveLength(0);
    expect(getAllCategories('g1')).toHaveLength(1);
  });
});

describe('seedDefaultCategories', () => {
  it('creates 6 default categories', () => {
    seedDefaultCategories('g1');
    expect(getAllCategories('g1')).toHaveLength(6);
  });

  it('is idempotent — second call does not add duplicates', () => {
    seedDefaultCategories('g1');
    seedDefaultCategories('g1');
    expect(getAllCategories('g1')).toHaveLength(6);
  });

  it('does not seed if categories already exist', () => {
    upsertCategory('g1', { guild_id: 'g1', key: 'custom', label: 'Custom', description: 'D', emoji: '❓', sort_order: 0, enabled: 1 });
    seedDefaultCategories('g1');
    expect(getAllCategories('g1')).toHaveLength(1);
  });
});
