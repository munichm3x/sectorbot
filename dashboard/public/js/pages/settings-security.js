// dashboard/public/js/pages/settings-security.js
window['page-settings-security'] = SettingsHelper.buildPage({
  category: 'security',
  title: 'Security',
  description: 'Dashboard-Zugriff und Sicherheits-Konfiguration. Session Secret, API Keys und Tokens werden niemals angezeigt.',
  sections: [
    {
      title: 'Dashboard-Zugriff',
      desc: 'Wer darf das Admin-Dashboard öffnen',
      fields: [
        { key: 'admin_user_ids', label: 'Owner / Admin-User-IDs', type: 'textarea', rows: 3, help: 'Discord-User-IDs, kommagetrennt. Diese User haben vollen Owner-Zugriff.' },
        { key: 'public_dashboard_enabled', label: 'Public Dashboard aktiv', type: 'checkbox', default: true, help: 'Wenn aus, ist /public nicht erreichbar' },
        { key: 'require_login_public', label: 'Login-Pflicht für gesamtes Public Dashboard', type: 'checkbox', help: 'Wenn aktiv, müssen User sich anmelden um irgendwas zu sehen' },
      ],
    },
    {
      title: 'Session & Rate Limit',
      desc: 'Read-only — Konfiguration über .env',
      fields: [
        { key: 'session_secret_set', label: 'Session Secret konfiguriert', type: 'readonly', default: '— wird aus .env gelesen —', help: 'Bei „change-me-in-production" zeigt System-Page eine Warnung.' },
        { key: 'session_max_age_hours', label: 'Session-Dauer (Stunden)', type: 'number', min: 1, max: 168, placeholder: '24', help: 'Wie lange ein Login-Cookie gültig ist' },
        { key: 'rate_limit_per_minute', label: 'Rate-Limit (Requests pro Minute / IP)', type: 'number', min: 10, max: 1000, placeholder: '60' },
      ],
    },
    {
      title: 'Audit',
      desc: 'Wie Änderungen protokolliert werden',
      fields: [
        { key: 'audit_retention_days', label: 'Audit-Log Aufbewahrung (Tage)', type: 'number', min: 7, max: 365, placeholder: '90' },
        { key: 'audit_log_to_discord', label: 'Audit-Log zusätzlich in Discord posten', type: 'checkbox', help: 'Verwendet Admin-Log-Channel aus Channels-Settings' },
      ],
    },
  ],
});
