// dashboard/public/js/pages/public-preview.js
window['page-public-preview'] = {
  async render(container) {
    container.innerHTML = `
      <div class="page-header">
        <h1>Public Preview</h1>
        <p>Was Spieler im Public Dashboard sehen — Status jeder öffentlichen Section.</p>
      </div>
      <div id="pp-content"><div class="skeleton" style="height:400px"></div></div>
    `;
    await this.load();
  },

  async load() {
    try {
      const { data } = await API.publicPreview();
      this.renderStatus(data);
    } catch (err) {
      document.getElementById('pp-content').innerHTML = errorState(err.message || 'Laden fehlgeschlagen');
    }
  },

  renderStatus(d) {
    const sections = d.sections || {};
    const publicUrl = d.publicUrl || '/public';
    const el = document.getElementById('pp-content');

    // Build section status cards
    const sectionDefs = [
      { key: 'server', title: 'Serverstatus', icon: '●', adminLink: '#/settings-server', adminLabel: 'Server-Einstellungen' },
      { key: 'community', title: 'Community', icon: '◎', adminLink: '#/members', adminLabel: 'Mitglieder' },
      { key: 'rules', title: 'Regelwerk', icon: '⊙', adminLink: '#/admin-rules', adminLabel: 'Regeln verwalten' },
      { key: 'events', title: 'Events', icon: '▲', adminLink: '#/admin-events', adminLabel: 'Events verwalten' },
      { key: 'changelog', title: 'Changelog', icon: '≡', adminLink: '#/admin-changelog', adminLabel: 'Changelog verwalten' },
      { key: 'announcements', title: 'Announcements', icon: '!', adminLink: '#/admin-announcements', adminLabel: 'Hinweise verwalten' },
      { key: 'faq', title: 'FAQ', icon: '?', adminLink: '#/admin-faq', adminLabel: 'FAQ verwalten' },
      { key: 'serverInfo', title: 'Server-Info', icon: '⊡', adminLink: '#/admin-server-info', adminLabel: 'Server-Info bearbeiten' },
      { key: 'wipe', title: 'Wipe-Info', icon: '◈', adminLink: '#/admin-wipe', adminLabel: 'Wipe-Info bearbeiten' },
      { key: 'rulesChannel', title: 'Regelwerk-Discord-Link', icon: '#', adminLink: '#/settings-channels', adminLabel: 'Channels konfigurieren' },
    ];

    el.innerHTML = `
      <!-- Top toolbar -->
      <div class="cta-bar" style="display:flex;gap:0.75rem;align-items:center;background:var(--surface);border:1px solid var(--border);border-radius:var(--radius-lg);padding:1rem 1.25rem;margin-bottom:1.5rem;flex-wrap:wrap">
        <div style="flex:1;min-width:200px">
          <div style="font-size:0.9rem;font-weight:700">Public Dashboard</div>
          <div style="font-size:0.78rem;color:var(--text-muted)">${escapeHtml(window.location.origin)}${escapeHtml(publicUrl)}</div>
        </div>
        <a href="${escapeHtml(publicUrl)}" target="_blank" rel="noopener" class="btn btn-primary">Public Dashboard öffnen ↗</a>
        <button class="btn btn-ghost" id="pp-reload">Neu laden</button>
      </div>

      <!-- Section status grid -->
      <div class="section-header"><div class="section-title">Section-Status</div></div>
      <div class="stat-grid">
        ${sectionDefs.map(def => {
          const s = sections[def.key] || {};
          const hasWarning = !!s.warning;
          const ok = !hasWarning;
          const counters = [];
          if (typeof s.total === 'number') counters.push(`${s.total} gesamt`);
          if (typeof s.publicCount === 'number') counters.push(`${s.publicCount} public`);
          if (typeof s.publishedCount === 'number') counters.push(`${s.publishedCount} veröffentlicht`);
          if (typeof s.activeCount === 'number') counters.push(`${s.activeCount} aktiv`);
          if (typeof s.memberCount === 'number') counters.push(`${fmt(s.memberCount)} Mitglieder`);
          if (s.statusOnline) counters.push('Online');
          if (s.configured != null) counters.push(s.configured ? 'Konfiguriert' : 'Nicht konfiguriert');
          if (s.hasData != null && counters.length === 0) counters.push(s.hasData ? 'Daten vorhanden' : 'Keine Daten');

          return `
            <div class="stat-card ${ok ? 'online' : 'warning'}">
              <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:0.4rem">
                <div style="font-size:0.7rem;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:var(--text-muted)">
                  <span style="margin-right:0.3em">${escapeHtml(def.icon)}</span>${escapeHtml(def.title)}
                </div>
                <span class="badge ${ok ? 'badge-online' : 'badge-warning'}" style="font-size:0.6rem">${ok ? '✓' : '⚠'}</span>
              </div>
              <div style="font-size:0.82rem;color:var(--text-secondary);margin-bottom:0.4rem;min-height:1.2em">
                ${counters.length > 0 ? counters.map(c => escapeHtml(c)).join(' · ') : '—'}
              </div>
              ${hasWarning ? `<div style="font-size:0.72rem;color:var(--warning);margin-bottom:0.5rem">${escapeHtml(s.warning)}</div>` : ''}
              <a href="${escapeHtml(def.adminLink)}" style="font-size:0.72rem;color:var(--accent)">→ ${escapeHtml(def.adminLabel)}</a>
            </div>
          `;
        }).join('')}
      </div>

      <!-- Iframe preview -->
      <div class="section-header" style="margin-top:1.5rem">
        <div class="section-title">Live-Vorschau</div>
        <a href="${escapeHtml(publicUrl)}" target="_blank" rel="noopener" style="font-size:0.78rem;color:var(--accent)">In neuem Tab öffnen ↗</a>
      </div>
      <div class="preview-frame">
        <iframe src="${escapeHtml(publicUrl)}" title="Public Dashboard Vorschau" sandbox="allow-same-origin allow-scripts allow-popups allow-forms"></iframe>
      </div>
    `;

    document.getElementById('pp-reload').addEventListener('click', () => this.load());
  },
};
