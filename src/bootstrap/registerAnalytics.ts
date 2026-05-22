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
