// dashboard/public/js/pages/settings-tickets.js
window['page-settings-tickets'] = SettingsHelper.buildPage({
  category: 'ticket',
  title: 'Ticket-Einstellungen',
  description: 'Ticket-System verwalten: Kategorien, Auto-Close, AI-Zusammenfassung, Public-Ticket-Optionen.',
  sections: [
    {
      title: 'Allgemein',
      desc: 'Ticket-System aktivieren / deaktivieren',
      fields: [
        { key: 'tickets_enabled', label: 'Ticket-System aktiv', type: 'checkbox', default: true },
        { key: 'max_open_per_user', label: 'Max. offene Tickets pro User', type: 'number', min: 1, max: 20, placeholder: '3' },
      ],
    },
    {
      title: 'Auto-Close',
      desc: 'Inaktive Tickets automatisch schließen',
      fields: [
        { key: 'auto_close_enabled', label: 'Auto-Close aktiv', type: 'checkbox' },
        { key: 'auto_close_hours', label: 'Auto-Close nach (Stunden Inaktivität)', type: 'number', min: 1, max: 720, placeholder: '72' },
      ],
    },
    {
      title: 'AI-Zusammenfassung',
      desc: 'Automatische Ticket-Zusammenfassung beim Schließen',
      fields: [
        { key: 'ai_summary_enabled', label: 'AI-Zusammenfassung aktiv', type: 'checkbox', help: 'Benötigt konfigurierten AI-Provider (siehe AI-Settings)' },
        { key: 'ai_summary_visible_to_user', label: 'Zusammenfassung im Public Dashboard anzeigen', type: 'checkbox', help: 'User sieht die AI-Zusammenfassung seines eigenen Tickets' },
      ],
    },
    {
      title: 'Transkript & Archiv',
      desc: 'Was beim Schließen gespeichert wird',
      fields: [
        { key: 'transcript_enabled', label: 'Transkript erstellen', type: 'checkbox', default: true },
        { key: 'archive_enabled', label: 'Tickets archivieren', type: 'checkbox', default: true, help: 'Geschlossene Tickets in Archiv-Channel verschieben' },
      ],
    },
    {
      title: 'Public Ticket-System',
      desc: 'Was User im Public Dashboard sehen',
      fields: [
        { key: 'public_show_my_tickets', label: 'Meine Tickets im Public Dashboard anzeigen', type: 'checkbox', default: true },
        { key: 'public_create_tickets', label: 'Ticket-Erstellung aus Public Dashboard erlauben', type: 'checkbox', help: 'Wenn aus, müssen User über Discord-Panel ein Ticket öffnen' },
        { key: 'public_faq_hint', label: 'FAQ-Hinweis vor Ticketerstellung', type: 'checkbox', default: true, help: 'Zeigt FAQ-Link vor dem „Ticket erstellen"-Button' },
      ],
    },
  ],
});
