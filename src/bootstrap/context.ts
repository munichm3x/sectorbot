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
