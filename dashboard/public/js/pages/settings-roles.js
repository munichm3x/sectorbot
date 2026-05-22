// dashboard/public/js/pages/settings-roles.js
window['page-settings-roles'] = SettingsHelper.buildPage({
  category: 'role',
  title: 'Rollen & Teams',
  description: 'Team-Rollen-Zuordnung, Support- und Admin-Rollen. Hinweis: Rollen-IDs aus Discord — Rechtsklick auf Rolle → ID kopieren (Developer Mode aktiv).',
  sections: [
    {
      title: 'Team-Farben',
      desc: 'Rollen-IDs für SCUM-Team-Armbinden',
      fields: [
        { key: 'role_team_green',  label: 'Team Grün Rolle-ID',  type: 'text', maxLength: 30, placeholder: 'Discord-Rolle-ID' },
        { key: 'role_team_red',    label: 'Team Rot Rolle-ID',   type: 'text', maxLength: 30 },
        { key: 'role_team_blue',   label: 'Team Blau Rolle-ID',  type: 'text', maxLength: 30 },
        { key: 'role_team_yellow', label: 'Team Gelb Rolle-ID',  type: 'text', maxLength: 30 },
        { key: 'role_solo_orange', label: 'Orange Solo Rolle-ID', type: 'text', maxLength: 30, help: 'Für Einzelkämpfer-Verifizierung' },
      ],
    },
    {
      title: 'System-Rollen',
      desc: 'Spezielle Rollen für Bot-Funktionen',
      fields: [
        { key: 'role_verified',    label: 'Verifizierte Rolle-ID', type: 'text', maxLength: 30, help: 'Wird beim Akzeptieren der Regeln vergeben' },
        { key: 'role_whitelist',   label: 'Whitelist-Rolle-ID',    type: 'text', maxLength: 30 },
        { key: 'role_streamer',    label: 'Streamer-Rolle-ID',     type: 'text', maxLength: 30, help: 'Wird beim Twitch-Live ausgelöst' },
      ],
    },
    {
      title: 'Dashboard-Berechtigungen',
      desc: 'Wer darf das Admin-Dashboard öffnen / verwalten',
      fields: [
        { key: 'role_admin_ids',   label: 'Admin-Rollen-IDs',     type: 'textarea', rows: 2, help: 'Mehrere IDs kommagetrennt. Diese Rollen haben vollen Dashboard-Zugriff.' },
        { key: 'role_mod_ids',     label: 'Moderator-Rollen-IDs', type: 'textarea', rows: 2, help: 'Können Tickets bearbeiten, keine Einstellungen ändern' },
        { key: 'role_editor_ids',  label: 'Editor-Rollen-IDs',    type: 'textarea', rows: 2, help: 'Dürfen Inhalte (Rules/Events/Changelog/Announcements) verwalten, aber keine Settings' },
        { key: 'role_viewer_ids',  label: 'Viewer-Rollen-IDs',    type: 'textarea', rows: 2, help: 'Nur Lese-Zugriff' },
      ],
    },
    {
      title: 'Auto-Zuweisung',
      desc: 'Automatische Rollen-Vergabe',
      fields: [
        { key: 'auto_assign_verified', label: 'Verifizierte Rolle automatisch bei Regel-Akzept', type: 'checkbox', default: true },
        { key: 'auto_assign_team_on_color', label: 'Team-Rollen-Sync mit Discord-Aktivität', type: 'checkbox', help: 'Experimentell — wenn Spieler im Team-Voice ist, automatisch Team-Rolle setzen' },
      ],
    },
  ],
});
