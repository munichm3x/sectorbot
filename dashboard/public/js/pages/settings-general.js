// dashboard/public/js/pages/settings-general.js
window['page-settings-general'] = SettingsHelper.buildPage({
  category: 'general',
  title: 'Allgemeine Einstellungen',
  description: 'Bot-Identität, Sprache, Zeitzone und globale Toggles.',
  sections: [
    {
      title: 'Bot-Identität',
      desc: 'Wie der Bot in Embeds und Nachrichten erscheint',
      fields: [
        { key: 'bot_display_name', label: 'Anzeigename', type: 'text', maxLength: 50, placeholder: 'SECTOR 13', help: 'Wird in Embeds verwendet (z.B. Footer-Text)' },
        { key: 'timezone', label: 'Zeitzone', type: 'text', maxLength: 50, placeholder: 'Europe/Berlin', help: 'IANA-Zeitzonen-ID. Wird für Timestamps in Embeds verwendet.' },
        { key: 'language', label: 'Sprache', type: 'select', options: [
          { value: 'de', label: 'Deutsch' },
          { value: 'en', label: 'English' },
        ], help: 'Bot-Antwortsprache' },
      ],
    },
    {
      title: 'Betriebsmodi',
      desc: 'Globale Bot-Verhaltens-Flags',
      fields: [
        { key: 'maintenance_mode', label: 'Wartungsmodus aktiv', type: 'checkbox', help: 'Bei aktivem Wartungsmodus zeigt das Public Dashboard einen Hinweis-Banner.' },
        { key: 'debug_mode', label: 'Debug-Modus', type: 'checkbox', help: 'Erweiterte Logs in Konsole und Dashboard.' },
        { key: 'logging_level', label: 'Logging-Level', type: 'select', options: [
          { value: 'error', label: 'error (nur Fehler)' },
          { value: 'warn', label: 'warn (Warnungen + Fehler)' },
          { value: 'info', label: 'info (Standard)' },
          { value: 'debug', label: 'debug (alles)' },
        ] },
      ],
    },
  ],
});
