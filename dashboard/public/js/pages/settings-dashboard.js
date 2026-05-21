// dashboard/public/js/pages/settings-dashboard.js
window['page-settings-dashboard'] = SettingsHelper.buildPage({
  category: 'dashboard',
  title: 'Dashboard-Einstellungen',
  description: 'Public Dashboard Sichtbarkeit, Branding und Layout-Optionen.',
  sections: [
    {
      title: 'Branding',
      desc: 'Wie das Dashboard für Spieler wirkt',
      fields: [
        { key: 'public_dashboard_title', label: 'Public Dashboard Titel', type: 'text', maxLength: 100, placeholder: 'SECTOR 13 Community' },
        { key: 'admin_dashboard_title', label: 'Admin Dashboard Titel', type: 'text', maxLength: 100, placeholder: 'SECTOR 13 Control' },
        { key: 'community_name', label: 'Community-Name', type: 'text', maxLength: 100, placeholder: 'Sektor-13' },
        { key: 'footer_text', label: 'Footer-Text', type: 'text', maxLength: 200, placeholder: 'Sektor-13 — Hardcore SCUM Server' },
      ],
    },
    {
      title: 'Public Sichtbarkeit',
      desc: 'Welche Public Sections aktiviert sind',
      fields: [
        { key: 'public_section_server', label: 'Server-Status sichtbar', type: 'checkbox', default: true },
        { key: 'public_section_community', label: 'Community-Stats sichtbar', type: 'checkbox', default: true },
        { key: 'public_section_rules', label: 'Regeln sichtbar', type: 'checkbox', default: true },
        { key: 'public_section_events', label: 'Events sichtbar', type: 'checkbox', default: true },
        { key: 'public_section_changelog', label: 'Changelog sichtbar', type: 'checkbox', default: true },
        { key: 'public_section_support', label: 'Support / Meine Tickets sichtbar', type: 'checkbox', default: true },
        { key: 'public_section_faq', label: 'FAQ sichtbar', type: 'checkbox', default: true },
        { key: 'public_section_whitelist', label: 'Whitelist-Status sichtbar', type: 'checkbox', default: true },
      ],
    },
    {
      title: 'Public Login-Pflicht',
      desc: 'Welche Bereiche erfordern Discord-Login',
      fields: [
        { key: 'require_login_support', label: 'Support / Meine Tickets erfordert Login', type: 'checkbox', default: true, help: 'Eigene Tickets nur sichtbar nach Login (empfohlen)' },
        { key: 'require_login_whitelist', label: 'Whitelist-Status erfordert Login', type: 'checkbox', default: true },
      ],
    },
  ],
});
