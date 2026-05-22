// dashboard/public/js/pages/settings-whitelist.js
window['page-settings-whitelist'] = SettingsHelper.buildPage({
  category: 'whitelist',
  title: 'Whitelist & Verifizierung',
  description: 'Whitelist-Antragssystem konfigurieren. Hinweis: Aktuell wird Whitelist über das Regelwerk-Accept vergeben — dieser Bereich erweitert dies bei Bedarf.',
  sections: [
    {
      title: 'Aktivierung',
      desc: 'Whitelist-System ein/aus',
      fields: [
        { key: 'whitelist_enabled', label: 'Whitelist-System aktiv', type: 'checkbox', default: true },
        { key: 'whitelist_public_status', label: 'Whitelist-Status im Public Dashboard zeigen', type: 'checkbox', default: true, help: 'Eingeloggte User sehen, ob sie verifiziert sind' },
        { key: 'whitelist_applications', label: 'Antragsformular aktivieren', type: 'checkbox', help: 'Wenn aus, läuft Whitelist ausschließlich über Regel-Accept' },
      ],
    },
    {
      title: 'Workflow',
      desc: 'Wie der Whitelist-Prozess funktioniert',
      fields: [
        { key: 'whitelist_role_id', label: 'Whitelist-Rolle-ID', type: 'text', maxLength: 30, help: 'Wird bei Genehmigung vergeben' },
        { key: 'whitelist_verified_role_id', label: 'Verifizierte Rolle-ID', type: 'text', maxLength: 30, help: 'Zusätzliche „Verifiziert"-Rolle (optional)' },
        { key: 'whitelist_channel_id', label: 'Antragschannel-ID', type: 'text', maxLength: 30 },
        { key: 'whitelist_log_channel_id', label: 'Logchannel-ID', type: 'text', maxLength: 30, help: 'Wo Anträge/Genehmigungen/Ablehnungen geloggt werden' },
        { key: 'whitelist_auto_approve', label: 'Auto-Genehmigung nach Regel-Accept', type: 'checkbox', default: true, help: 'Wenn User Regeln akzeptiert, automatisch Whitelist-Rolle vergeben' },
      ],
    },
    {
      title: 'Statusmeldungen',
      desc: 'Was User bei jedem Status sehen',
      fields: [
        { key: 'whitelist_pending_message', label: 'Hinweistext „Antrag offen"', type: 'textarea', rows: 2, maxLength: 300, placeholder: 'Dein Whitelist-Antrag wird bearbeitet. Bitte habe Geduld.' },
        { key: 'whitelist_approved_message', label: 'Hinweistext „Genehmigt"', type: 'textarea', rows: 2, maxLength: 300, placeholder: 'Du bist auf der Whitelist! Viel Spaß auf dem Server.' },
        { key: 'whitelist_rejected_message', label: 'Hinweistext „Abgelehnt"', type: 'textarea', rows: 2, maxLength: 300, placeholder: 'Antrag wurde abgelehnt — bitte öffne ein Ticket für Details.' },
      ],
    },
  ],
});
