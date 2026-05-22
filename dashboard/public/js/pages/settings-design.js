// dashboard/public/js/pages/settings-design.js
window['page-settings-design'] = SettingsHelper.buildPage({
  category: 'design',
  title: 'Design & Branding',
  description: 'Logos, Banner und Embed-Farben für das Dashboard und Discord-Embeds.',
  sections: [
    {
      title: 'Dashboard-Branding',
      desc: 'Logos, Banner und Akzentfarben für die Web-Oberfläche',
      fields: [
        { key: 'logo_url', label: 'Logo URL', type: 'text', maxLength: 500, placeholder: 'https://...', help: 'Wird in Sidebar und Login-Seite verwendet' },
        { key: 'banner_url', label: 'Banner URL', type: 'text', maxLength: 500, placeholder: 'https://...', help: 'Hintergrund-Banner für Public Dashboard' },
        { key: 'favicon_url', label: 'Favicon URL', type: 'text', maxLength: 500, placeholder: 'https://...' },
        { key: 'accent_color', label: 'Akzentfarbe (Hex)', type: 'text', maxLength: 10, placeholder: '#b5162f', help: 'Standard: #b5162f (Sektor-13 Crimson)' },
      ],
    },
    {
      title: 'Bot-Embed-Branding',
      desc: 'Farben und Bilder für Discord-Embeds',
      fields: [
        { key: 'embed_color_default', label: 'Standard-Embed-Farbe (Hex)', type: 'text', maxLength: 10, placeholder: '#b5162f' },
        { key: 'embed_color_status', label: 'Status-Embed-Farbe (Hex)', type: 'text', maxLength: 10, placeholder: '#3bca6e' },
        { key: 'embed_color_ticket', label: 'Ticket-Embed-Farbe (Hex)', type: 'text', maxLength: 10, placeholder: '#4a9eff' },
        { key: 'embed_color_changelog', label: 'Changelog-Embed-Farbe (Hex)', type: 'text', maxLength: 10, placeholder: '#e8981a' },
        { key: 'embed_color_announcement', label: 'Announcement-Embed-Farbe (Hex)', type: 'text', maxLength: 10, placeholder: '#b5162f' },
        { key: 'embed_thumbnail_url', label: 'Standard-Thumbnail URL', type: 'text', maxLength: 500 },
        { key: 'embed_footer_text', label: 'Standard-Footer-Text', type: 'text', maxLength: 100, placeholder: 'SECTOR 13 — Hardcore SCUM' },
      ],
    },
    {
      title: 'Banner-URLs für Specific Embeds',
      desc: 'Spezifische Banner für SCUM-Status, Regeln, etc.',
      fields: [
        { key: 'rules_banner_url', label: 'Regelwerk-Banner URL', type: 'text', maxLength: 500 },
        { key: 'scum_status_banner_url', label: 'SCUM-Status-Banner URL', type: 'text', maxLength: 500 },
        { key: 'scum_status_logo_url', label: 'SCUM-Status-Logo URL', type: 'text', maxLength: 500 },
      ],
    },
  ],
});
