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
        { key: 'public_section_analytics', label: 'Analytics / Statistik sichtbar', type: 'checkbox', default: true },
        { key: 'public_section_rules', label: 'Regeln sichtbar', type: 'checkbox', default: true },
        { key: 'public_section_events', label: 'Events sichtbar', type: 'checkbox', default: true },
        { key: 'public_section_changelog', label: 'Changelog sichtbar', type: 'checkbox', default: true },
        { key: 'public_section_support', label: 'Support / Meine Tickets sichtbar', type: 'checkbox', default: true },
        { key: 'public_section_faq', label: 'FAQ sichtbar', type: 'checkbox', default: true },
        { key: 'public_section_whitelist', label: 'Whitelist-Status sichtbar', type: 'checkbox', default: true },
      ],
    },
    {
      title: 'Analytics Tracking',
      desc: 'Steuert Analytics-Erfassung und Aktualisierung im Dashboard',
      fields: [
        { key: 'analytics_tracking_enabled', label: 'Tracking im Dashboard aktiv', type: 'checkbox', default: true, help: 'Schaltet Dashboard-seitige Analytics-Ansichten frei. Bot-Tracking bleibt serverseitig getrennt steuerbar.' },
        { key: 'analytics_refresh_seconds', label: 'Update-Intervall (Sekunden)', type: 'number', min: 10, max: 3600, default: 30, help: 'Steuert die empfohlene Refresh-Frequenz für Live-Daten im Admin-Hub.' },
        { key: 'analytics_default_period', label: 'Standard-Zeitraum', type: 'select', default: '7d', options: [
          { value: '24h', label: '24 Stunden' },
          { value: '7d', label: '7 Tage' },
          { value: '30d', label: '30 Tage' },
          { value: '90d', label: '90 Tage' },
          { value: 'all', label: 'Gesamt' },
        ] },
      ],
    },
    {
      title: 'Public Analytics',
      desc: 'Welche anonymisierten Statistik-Blöcke im Public Hub sichtbar sind',
      fields: [
        { key: 'analytics_public_show_engagement', label: 'Engagement-Score anzeigen', type: 'checkbox', default: true },
        { key: 'analytics_public_show_scum', label: 'SCUM-Server-Analytics anzeigen', type: 'checkbox', default: true },
        { key: 'analytics_public_show_growth', label: 'Wachstum & Trends anzeigen', type: 'checkbox', default: true },
        { key: 'analytics_public_show_channels', label: 'Top-Channels anzeigen', type: 'checkbox', default: true },
        { key: 'analytics_public_hide_channel_ids', label: 'Nur lesbare Channel-Namen/Labels anzeigen', type: 'checkbox', default: true, help: 'Verhindert rohe technische Channel-IDs in öffentlichen Analytics.' },
      ],
    },
    {
      title: 'Visualisierung',
      desc: 'Elite-UI-Darstellung für Analytics-Module',
      fields: [
        { key: 'analytics_chart_style', label: 'Chart-Stil', type: 'select', default: 'elite', options: [
          { value: 'elite', label: 'Elite / Glow' },
          { value: 'clean', label: 'Clean / Minimal' },
          { value: 'dense', label: 'Dense / Analyst' },
        ] },
        { key: 'analytics_show_tooltips', label: 'Erklärende Tooltips aktivieren', type: 'checkbox', default: true },
        { key: 'analytics_show_mini_trends', label: 'Mini-Trends in KPI-Karten', type: 'checkbox', default: true },
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
