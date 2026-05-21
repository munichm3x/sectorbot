window['page-changelog'] = {
  activeFilter: 'all',

  async render(container) {
    container.innerHTML = pageHeader('Changelog', 'Öffentliche Updates', 'Server-, Discord-, Regel-, Event- und Botupdates für die Community.') + `
      <div class="tab-bar" id="changelog-tabs">
        ${['all','server','discord','regeln','events','bot'].map(id => `<button class="tab-btn${id === 'all' ? ' active' : ''}" data-filter="${id}">${id === 'all' ? 'Alle' : id}</button>`).join('')}
      </div>
      <div id="changelog-content"></div>
    `;
    const root = document.getElementById('changelog-content');
    try {
      const { data } = await API.changelog();
      const render = () => {
        const entries = (data.changelog ?? []).filter(item => this.activeFilter === 'all' || String(item.category).toLowerCase() === this.activeFilter);
        root.innerHTML = entries.length ? `
          <section class="timeline-card card">${entries.map(item => `
            <div class="timeline-item">
              <span class="badge badge-accent">${escapeHtml(item.category)}</span>
              <strong>${escapeHtml(item.title)}</strong>
              <small>${fmtDate(item.publishedAt)}</small>
              <p>${escapeHtml(item.description ?? '')}</p>
            </div>
          `).join('')}</section>
        ` : `
          <section class="card">
            ${emptyState('Noch keine öffentlichen Updates veröffentlicht.', 'Persistente Changelog-Einträge existieren aktuell nicht.')}
            ${data.discordUrl ? `<div class="cta-row centered"><a class="btn btn-primary" target="_blank" rel="noreferrer" href="${escapeHtml(data.discordUrl)}">Changelog im Discord öffnen</a></div>` : ''}
          </section>
        `;
      };
      document.getElementById('changelog-tabs').addEventListener('click', e => {
        const btn = e.target.closest('.tab-btn');
        if (!btn) return;
        this.activeFilter = btn.dataset.filter;
        document.querySelectorAll('#changelog-tabs .tab-btn').forEach(b => b.classList.toggle('active', b === btn));
        render();
      });
      render();
    } catch {
      root.innerHTML = errorState();
    }
  },
};
