// dashboard/public/js/pages/settings-streamer.js
window['page-settings-streamer'] = SettingsHelper.buildPage({
  category: 'streamer',
  title: 'Streamer / Twitch',
  description: 'Twitch- und YouTube-Live-Detection für Community-Streamer. Tokens werden niemals angezeigt.',
  sections: [
    {
      title: 'System',
      desc: 'Streamer-Live-System aktivieren',
      fields: [
        { key: 'streamer_enabled', label: 'Streamer-System aktiv', type: 'checkbox' },
        { key: 'streamer_check_interval', label: 'Check-Intervall (Sekunden)', type: 'number', min: 60, max: 3600, placeholder: '120', help: 'Wie oft Twitch/YouTube auf Live-Status geprüft wird' },
      ],
    },
    {
      title: 'Twitch',
      desc: 'Twitch Developer App Credentials (https://dev.twitch.tv/console)',
      fields: [
        { key: 'twitch_client_id', label: 'Twitch Client ID', type: 'secret', help: 'Aus deiner Twitch Developer Application' },
        { key: 'twitch_client_secret', label: 'Twitch Client Secret', type: 'secret' },
      ],
      testKey: 'twitch_client_id',
    },
    {
      title: 'YouTube',
      desc: 'YouTube Data API v3 Key (optional)',
      fields: [
        { key: 'youtube_api_key', label: 'YouTube API Key', type: 'secret', help: 'Aus Google Cloud Console — YouTube Data API v3 aktivieren' },
      ],
    },
    {
      title: 'Discord-Integration',
      desc: 'Wie Live-Streams angekündigt werden',
      fields: [
        { key: 'streamer_live_channel', label: 'Live-Announcement-Channel-ID', type: 'text', maxLength: 30 },
        { key: 'streamer_role_id', label: 'Streamer-Rolle-ID', type: 'text', maxLength: 30, help: 'Wird beim Live-Gehen vergeben (optional)' },
        { key: 'streamer_ping_type', label: 'Ping bei Live', type: 'select', options: [
          { value: 'none', label: 'Kein Ping' },
          { value: 'everyone', label: '@everyone' },
          { value: 'here', label: '@here' },
          { value: 'role', label: 'Streamer-Rolle pingen' },
        ] },
        { key: 'streamer_announcement_template', label: 'Announcement-Text-Template', type: 'textarea', rows: 3, maxLength: 500, placeholder: '🔴 {{name}} ist live! {{title}}\n→ {{url}}', help: 'Platzhalter: {{name}}, {{title}}, {{url}}, {{game}}' },
      ],
    },
  ],
});
