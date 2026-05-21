// dashboard/public/js/pages/settings-channels.js
window['page-settings-channels'] = SettingsHelper.buildPage({
  category: 'channel',
  title: 'Channel-Konfiguration',
  description: 'Discord-Channel-IDs für Bot-Funktionen. Rechtsklick auf Channel im Discord (Developer Mode) → ID kopieren.',
  sections: [
    {
      title: 'Status & Updates',
      desc: 'Channels für Live-Status und Ankündigungen',
      fields: [
        { key: 'channel_scum_status',   label: 'SCUM Status-Channel',     type: 'text', maxLength: 30, help: 'Live-Server-Status (überschneidet sich mit Server-Einstellungen)' },
        { key: 'channel_changelog',     label: 'Changelog-Channel',       type: 'text', maxLength: 30, help: 'Wird verwendet, wenn Changelog veröffentlicht wird' },
        { key: 'channel_announcements', label: 'Announcement-Channel',    type: 'text', maxLength: 30, help: 'Wichtige Server-/Community-Ankündigungen' },
        { key: 'channel_events',        label: 'Events-Channel',          type: 'text', maxLength: 30 },
        { key: 'channel_streamer_live', label: 'Streamer-Live-Channel',   type: 'text', maxLength: 30 },
      ],
    },
    {
      title: 'Regeln & Verifizierung',
      desc: 'Onboarding-Flow Channels',
      fields: [
        { key: 'channel_rules',         label: 'Regelwerk-Channel',       type: 'text', maxLength: 30, help: 'Channel, in dem die Accept-Rules-Nachricht steht' },
        { key: 'channel_whitelist',     label: 'Whitelist-Antrags-Channel', type: 'text', maxLength: 30 },
      ],
    },
    {
      title: 'Tickets',
      desc: 'Ticket-System Channels',
      fields: [
        { key: 'channel_ticket_panel',   label: 'Ticket-Panel-Channel',    type: 'text', maxLength: 30, help: 'Channel mit dem Ticket-Erstellungs-Dropdown' },
        { key: 'channel_ticket_archive', label: 'Ticket-Archiv-Channel',   type: 'text', maxLength: 30 },
        { key: 'channel_ticket_log',     label: 'Ticket-Log-Channel',      type: 'text', maxLength: 30, help: 'Audit-Log für Ticket-Aktionen' },
      ],
    },
    {
      title: 'Moderation & Logs',
      desc: 'Admin-Channels',
      fields: [
        { key: 'channel_admin_log',     label: 'Admin-Log-Channel',       type: 'text', maxLength: 30, help: 'Dashboard-Audit-Trail im Discord' },
        { key: 'channel_mod_log',       label: 'Mod-Log-Channel',         type: 'text', maxLength: 30, help: 'Warnungen, Timeouts, Bans' },
        { key: 'channel_ai_log',        label: 'AI-Log-Channel (optional)', type: 'text', maxLength: 30, help: 'AI-Requests/Fehler (nur Counts, keine Prompts)' },
      ],
    },
  ],
});
