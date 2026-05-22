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
