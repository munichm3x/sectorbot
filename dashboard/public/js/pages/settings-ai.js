// dashboard/public/js/pages/settings-ai.js
window['page-settings-ai'] = SettingsHelper.buildPage({
  category: 'ai',
  title: 'AI-Einstellungen',
  description: 'AI-Provider, Modelle und Feature-Toggles. API-Keys werden nie im Klartext angezeigt.',
  sections: [
    {
      title: 'Provider',
      desc: 'AI-Anbieter und Authentifizierung',
      fields: [
        { key: 'ai_enabled', label: 'AI aktiv', type: 'checkbox' },
        { key: 'ai_provider', label: 'Provider', type: 'select', options: [
          { value: 'groq', label: 'Groq (empfohlen — kostenlos)' },
          { value: 'openai', label: 'OpenAI' },
          { value: 'ollama', label: 'Ollama (selbst gehostet)' },
        ] },
        { key: 'ai_model', label: 'Modell', type: 'text', maxLength: 100, placeholder: 'z.B. llama-3.3-70b-versatile oder gpt-4o-mini' },
        { key: 'ai_api_key', label: 'API-Key', type: 'secret', help: 'Wird nur beim Senden an den Provider verwendet. Niemals im Dashboard angezeigt oder geloggt.', placeholder: 'sk-... oder gsk_...' },
        { key: 'ai_base_url', label: 'Base URL (optional)', type: 'text', maxLength: 200, placeholder: 'z.B. http://localhost:11434/v1 für Ollama' },
      ],
      testKey: 'ai_api_key',
    },
    {
      title: 'Modell-Parameter',
      desc: 'Sampling und Limits',
      fields: [
        { key: 'ai_temperature', label: 'Temperature (0.0–2.0)', type: 'text', maxLength: 10, placeholder: '0.7', help: 'Niedrig = konsistenter, hoch = kreativer' },
        { key: 'ai_max_tokens', label: 'Max. Tokens pro Response', type: 'number', min: 100, max: 8000, placeholder: '1024' },
        { key: 'ai_timeout_ms', label: 'Timeout (ms)', type: 'number', min: 1000, max: 120000, placeholder: '30000' },
      ],
    },
    {
      title: 'Feature-Toggles',
      desc: 'Welche AI-Features aktiv sind',
      fields: [
        { key: 'ai_feature_ticket_summary', label: 'Ticket-Zusammenfassung', type: 'checkbox', help: 'Beim Schließen wird Ticket-Verlauf zusammengefasst' },
        { key: 'ai_feature_old_man_lore', label: 'Old Man Lore (Story-Antworten)', type: 'checkbox' },
        { key: 'ai_feature_changelog_assist', label: 'Changelog-Hilfe', type: 'checkbox', help: 'AI hilft beim Verfassen von Changelog-Einträgen' },
        { key: 'ai_feature_moderation_assist', label: 'Moderations-Hilfe', type: 'checkbox' },
        { key: 'ai_feature_faq_assist', label: 'FAQ-Hilfe', type: 'checkbox' },
      ],
    },
  ],
});
