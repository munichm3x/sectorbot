import {
  getGuildConfig, upsertGuildConfig,
  getGuildSupportRoles, setGuildSupportRoles,
  getTicketCategoryConfigs, getAllTicketCategoryConfigs,
  upsertTicketCategoryConfig, deleteTicketCategoryConfig,
} from '../db/index';
import type { GuildConfig, TicketCategoryConfig } from '../types';

const DEFAULT_CATEGORIES: Omit<TicketCategoryConfig, 'id' | 'guild_id'>[] = [
  { key: 'allgemein', label: 'Allgemeiner Support',      description: 'Allgemeine Fragen zum Server',                      emoji: '🔧', sort_order: 0, enabled: 1 },
  { key: 'technisch', label: 'Technisches Problem',      description: 'Bugs, Verbindungsprobleme oder Fehler',             emoji: '💻', sort_order: 1, enabled: 1 },
  { key: 'report',    label: 'Spieler melden',           description: 'Regelbruch, Cheating oder toxisches Verhalten',     emoji: '🚨', sort_order: 2, enabled: 1 },
  { key: 'whitelist', label: 'Whitelist / Freischaltung',description: 'Whitelist, Rollen oder Serverzugriff',              emoji: '📋', sort_order: 3, enabled: 1 },
  { key: 'bewerbung', label: 'Bewerbung',                description: 'Bewerbungen im Team oder Fraktion',                 emoji: '📝', sort_order: 4, enabled: 1 },
  { key: 'sonstiges', label: 'Sonstiges',                description: 'Alles, was in keine andere Kategorie passt',        emoji: '❓', sort_order: 5, enabled: 1 },
];

export function getConfig(guildId: string): GuildConfig | undefined {
  return getGuildConfig(guildId);
}

export function upsertConfig(
  guildId: string,
  data: Partial<Omit<GuildConfig, 'guild_id' | 'created_at' | 'updated_at'>>
): GuildConfig {
  return upsertGuildConfig(guildId, data);
}

export function getSupportRoles(guildId: string): string[] {
  return getGuildSupportRoles(guildId);
}

export function setSupportRoles(guildId: string, roleIds: string[]): void {
  setGuildSupportRoles(guildId, roleIds);
}

export function getTicketCategories(guildId: string): TicketCategoryConfig[] {
  return getTicketCategoryConfigs(guildId);
}

export function getAllCategories(guildId: string): TicketCategoryConfig[] {
  return getAllTicketCategoryConfigs(guildId);
}

export function upsertCategory(guildId: string, data: Omit<TicketCategoryConfig, 'id'>): void {
  upsertTicketCategoryConfig(data);
}

export function deleteCategory(guildId: string, key: string): void {
  deleteTicketCategoryConfig(guildId, key);
}

export function seedDefaultCategories(guildId: string): void {
  const existing = getAllTicketCategoryConfigs(guildId);
  if (existing.length > 0) return;
  for (const cat of DEFAULT_CATEGORIES) {
    upsertTicketCategoryConfig({ ...cat, guild_id: guildId });
  }
}
