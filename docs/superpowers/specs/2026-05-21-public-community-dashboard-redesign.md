# Public Community Dashboard Redesign Design

## Goal

Transform the existing public user dashboard from a small authenticated analytics view into a safe, public SECTOR 13 community hub for SCUM players. Public pages must feel like a premium tactical server status center, while private user data remains protected.

## Current State

- Admin dashboard lives in `dashboard/public` and uses `/api/*` with admin auth.
- Public dashboard lives in `dashboard/public-user` and uses `/public-api/*`.
- Public API currently requires `requirePublicAuth` for all routes.
- Existing public navigation only includes overview, analytics, and tickets.
- Existing data sources:
  - SCUM status history in `server_status_history`.
  - Aggregated Discord message, voice, stream, and member event analytics.
  - Own-ticket lookup guarded by `opener_user_id`.
  - Guild config for rules channel/message, whitelist role, ticket panel, SCUM status config, and changelog channel.
  - Ticket category config.
  - Hardcoded but real rule text in `createRulesEmbed()`.
- Missing persistent public data sources:
  - Events.
  - Announcements.
  - FAQ.
  - Public changelog entries.
  - Season/wipe metadata.
  - Server gameplay settings beyond what is present in rules/config.

## Architecture

Use the existing Express and vanilla JS dashboard architecture. Split `/public-api/*` into public read endpoints and authenticated personal endpoints.

Public read endpoints:
- `GET /public-api/overview`
- `GET /public-api/server`
- `GET /public-api/community`
- `GET /public-api/rules`
- `GET /public-api/events`
- `GET /public-api/changelog`
- `GET /public-api/announcements`
- `GET /public-api/faq`
- `GET /public-api/support`

Authenticated endpoints:
- `GET /public-api/me`
- `GET /public-api/tickets/mine`
- `GET /public-api/tickets/mine/:id`
- `GET /public-api/me/whitelist-status`

Do not add large migrations for content systems in this pass. Missing content sources return empty arrays or null sections with stable response shapes.

## Public Pages

### Overview

The overview is the player entry point. It shows:
- Server hero status from latest status history.
- Discord community snapshot from guild cache and member event aggregates.
- 24h activity summary from aggregate message, voice, stream, and active-channel data.
- Public announcements section with empty state when no source exists.
- Next events section with empty state when no source exists.
- Latest updates section with empty state or Discord changelog CTA when only a public changelog channel exists.

### Server

Shows:
- Current SCUM server status.
- Uptime and history charts when status history exists.
- Season/wipe section as an empty state until a real source exists.
- Public server configuration cards using only safe, existing data from rules/config.
- CTAs for rules, support, Discord/changelog channel when safely available.

### Community

Shows only aggregated data:
- Member count and growth totals.
- Activity summaries and channel aggregates.
- Team distribution section as an empty state unless a safe role-count implementation is present.

It must never show user rankings or individual activity.

### Rules

Render structured public rules using the existing real rules content from `createRulesEmbed()`, transformed into public categories. Include search and accordion behavior. Include a Discord rules link if `rules_channel_id` and `rules_message_id` exist.

### Events

Return an empty events list until a real event source exists. The UI shows a high-quality empty state, not fake events.

### Changelog

Return an empty public changelog list until persistent published entries exist. If `changelog_config.public_channel_id` exists, show a Discord CTA. Do not expose drafts or internal notes.

### Support

Show general support guidance, ticket categories, login CTA for anonymous users, and own tickets for authenticated users. Own-ticket responses remain DB-filtered by `guild_id` and `opener_user_id`.

### FAQ And Whitelist

FAQ uses an empty state until a real data source exists. Whitelist status is user-specific and authenticated; if only `whitelist_role_id` exists, the endpoint may report whether the logged-in member has that role.

## UI Direction

The public dashboard gets its own visual language while staying compatible with the existing CSS tokens:
- Very dark background.
- Dark panels.
- Subtle borders.
- Deep red accent.
- Off-white typography.
- Muted secondary text.
- Technical numeric styling.
- Responsive grids.
- No cheap neon, no emoji navigation, no fake gaming clutter.

Navigation:
- Overview
- Server
- Community
- Rules
- Events
- Changelog
- Support

## Security Rules

Public responses must not include:
- Admin logs.
- Audit logs.
- AI usage/logs.
- Secrets, tokens, API keys, database paths.
- Stack traces or internal errors.
- Ticket data for other users.
- Admin ticket actions.
- Private notes.
- Per-user analytics, rankings, or profiles.

Errors must return generic public messages. Admin dashboard routes must remain unchanged and protected by existing admin auth.

## Testing

Add backend tests for public DTO builders and route auth behavior where practical. Verify:
- Public read endpoints work without `publicUser`.
- Personal endpoints return 401 without `publicUser`.
- Ticket endpoints still filter by authenticated user.
- Public analytics responses contain only aggregate fields.

Run:
- `npm run build`
- `npm test`

Manual checks:
- Public overview, server, rules, events, changelog, support load.
- Anonymous users see public content and login prompts for personal areas.
- Admin dashboard still loads from existing routes.
