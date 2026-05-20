// src/analytics/analytics.aggregator.ts
// Runs every ANALYTICS_AGGREGATION_INTERVAL_MIN minutes.
// Responsibilities:
// 1. Purge raw event rows older than retention window
// 2. Close stale voice sessions (bot-restart recovery)
// 3. Purge old server_status_history rows

import { env } from '../config/env';
import { logger } from '../utils/logger';
import { purgeOldRawEvents, purgeOldStatusHistory, closeStaleVoiceSessions } from './analytics.db';

let aggregatorInterval: ReturnType<typeof setInterval> | null = null;

function runAggregation(): void {
  try {
    closeStaleVoiceSessions();
    purgeOldRawEvents(env.ANALYTICS_RETENTION_RAW_DAYS);
    purgeOldStatusHistory(env.ANALYTICS_RETENTION_AGGREGATED_DAYS);
    logger.debug('[analytics] Aggregation/Cleanup-Lauf abgeschlossen.');
  } catch (err) {
    logger.warn('[analytics] Aggregation-Fehler:', err);
  }
}

export function setupAggregator(): void {
  if (!env.ANALYTICS_ENABLED) return;

  // Run immediately at startup to recover from any missed sessions
  runAggregation();

  const intervalMs = env.ANALYTICS_AGGREGATION_INTERVAL_MIN * 60 * 1000;
  aggregatorInterval = setInterval(runAggregation, intervalMs);
  logger.info(`[analytics] Aggregator läuft alle ${env.ANALYTICS_AGGREGATION_INTERVAL_MIN} Minuten.`);
}

export function stopAggregator(): void {
  if (aggregatorInterval) {
    clearInterval(aggregatorInterval);
    aggregatorInterval = null;
  }
}
