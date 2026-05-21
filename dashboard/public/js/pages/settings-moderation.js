// dashboard/public/js/pages/settings-moderation.js
window['page-settings-moderation'] = SettingsHelper.buildPage({
  category: 'moderation',
  title: 'Moderation',
  description: 'Mod-Log, Auto-Mod und Eskalations-Regeln. Persönliche Mod-Daten (Warnungen, Bans einzelner User) erscheinen nie im Public Dashboard.',
  sections: [
    {
      title: 'Allgemein',
      desc: 'Mod-Log und Auto-Mod',
      fields: [
        { key: 'mod_log_channel_id', label: 'Mod-Log-Channel-ID', type: 'text', maxLength: 30 },
        { key: 'auto_mod_enabled', label: 'Auto-Mod aktiv', type: 'checkbox' },
        { key: 'warning_system_enabled', label: 'Warnsystem aktiv', type: 'checkbox' },
      ],
    },
    {
      title: 'Spam- & Raid-Schutz',
      desc: 'Schutz vor Massen-Joins und Spam',
      fields: [
        { key: 'raid_protection_enabled', label: 'Raid-Schutz aktiv', type: 'checkbox' },
        { key: 'join_spike_threshold', label: 'Join-Spike-Schwelle (Joins pro 10s)', type: 'number', min: 3, max: 100, placeholder: '10' },
        { key: 'verify_check_on_join', label: 'Verifizierung beim Join prüfen', type: 'checkbox' },
      ],
    },
    {
      title: 'Eskalation',
      desc: 'Wann automatisch eskaliert wird',
      fields: [
        { key: 'mod_role_ids', label: 'Moderator-Rollen-IDs', type: 'textarea', rows: 2, help: 'Kommagetrennt — diese Rollen werden bei Eskalation gepingt' },
        { key: 'escalation_warn_to_timeout', label: 'Warnungen vor Timeout', type: 'number', min: 1, max: 10, placeholder: '3' },
        { key: 'escalation_timeout_minutes', label: 'Standard-Timeout-Dauer (Minuten)', type: 'number', min: 5, max: 10080, placeholder: '60' },
      ],
    },
  ],
});
