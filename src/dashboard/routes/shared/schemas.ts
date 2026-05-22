// src/dashboard/routes/shared/schemas.ts
// Reusable zod schemas for dashboard API validation.

import { z } from 'zod';
import { env } from '../../../config/env';

/** 17-20 digit Discord snowflake */
export const DiscordSnowflake = z.string().regex(/^\d{17,20}$/, 'Must be a valid Discord snowflake ID');

/** Optional nullable snowflake — accepts string, null, or undefined */
export const NullableSnowflake = DiscordSnowflake.nullable().optional();

/** Non-empty string with max length */
export const NonEmptyStr = (max: number) =>
  z.string().min(1, `Required`).max(max, `Max ${max} characters`).trim();

/** Optional string with max length (empty string treated as null) */
export const OptionalStr = (max: number) =>
  z.string().max(max, `Max ${max} characters`).trim().optional().nullable();

/** Boolean-like: accepts true/false, 0/1 */
export const BooleanLike = z.union([z.boolean(), z.literal(0), z.literal(1)]);

/** Return a 400 JSON response from a zod SafeParseError. */
export function zodError(res: import('express').Response, error: z.ZodError): void {
  const details = env.NODE_ENV !== 'production' ? error.issues : undefined;
  res.status(400).json({ success: false, error: 'Invalid input', ...(details && { details }) });
}
