// dashboard/public/js/pages/tickets.js
window['page-tickets'] = {
  state: { status: 'closed', page: 1, search: '' },
  async render(container) {
    const self = this;
    container.innerHTML = `
      <div class="page-header"><h1>Ticket-Verwaltung</h1><p>Alle Tickets durchsuchen, filtern und Details anzeigen.</p></div>
      <div style="display:flex;gap:.75rem;margin-bottom:1rem;flex-wrap:wrap">
        <div class="period-bar">
          ${['open','closed','all'].map(s => `<button class="period-btn${s===self.state.status?' active':''}" data-status="${s}">${s==='open'?'Offen':s==='closed'?'Geschlossen':'Alle'}</button>`).join('')}
        </div>
        <input class="form-input" style="max-width:240px" placeholder="Suche..." id="ticket-search" value="${self.state.search}">
      </div>
      <div class="card" id="ticket-table-wrap"><div class="skeleton tall"></div></div>
      <div id="ticket-pagination" style="margin-top:.75rem;display:flex;gap:.5rem"></div>
    `;

    container.querySelectorAll('[data-status]').forEach(btn => {
      btn.addEventListener('click', () => {
        self.state.status = btn.dataset.status; self.state.page = 1;
        container.querySelectorAll('[data-status]').forEach(b => b.classList.toggle('active', b.dataset.status === self.state.status));
        self.load();
      });
    });

    let searchTimeout;
    document.getElementById('ticket-search').addEventListener('input', (e) => {
      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(() => { self.state.search = e.target.value; self.state.page = 1; self.load(); }, 400);
    });

    await self.load();
  },

  async load() {
    const wrap = document.getElementById('ticket-table-wrap');
    if (!wrap) return;
    wrap.innerHTML = '<div class="skeleton tall"></div>';
    try {
      const { data } = await API.tickets({ status: this.state.status, page: this.state.page, search: this.state.search });
      const { tickets, total, pages } = data;

      if (tickets.length === 0) { wrap.innerHTML = emptyState('Keine Tickets gefunden.'); return; }

      wrap.innerHTML = `
        <div class="table-wrap"><table>
          <thead><tr><th>#</th><th>Kategorie</th><th>Status</th><th>Erstellt</th><th>Geschlossen</th><th>Bearbeiter</th><th>Zusammenfassung</th></tr></thead>
          <tbody>${tickets.map(t => `
            <tr style="cursor:pointer" onclick="window['page-tickets'].showDetail(${t.id})">
              <td class="mono dim">${t.id}</td>
              <td>${escapeHtml(t.category)}</td>
              <td><span class="badge ${t.status==='open'?'badge-warning':'badge-neutral'}">${t.status}</span></td>
              <td class="dim">${fmtDate(t.created_at)}</td>
              <td class="dim">${t.closed_at ? fmtDate(t.closed_at) : '—'}</td>
              <td class="dim">${escapeHtml(t.closed_by_username_snapshot ?? '—')}</td>
              <td style="max-width:300px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:.78rem;color:var(--text-muted)">${escapeHtml(t.summary ? t.summary.slice(0,120)+'…' : '—')}</td>
            </tr>
          `).join('')}</tbody>
        </table></div>
        <div style="padding:.75rem 0;font-size:.78rem;color:var(--text-muted)">${total} Tickets gesamt</div>
      `;

      // Pagination
      const pgEl = document.getElementById('ticket-pagination');
      pgEl.innerHTML = '';
      if (pages > 1) {
        for (let i = 1; i <= Math.min(pages, 10); i++) {
          const btn = document.createElement('button');
          btn.className = `period-btn${i === this.state.page ? ' active' : ''}`;
          btn.textContent = i;
          btn.addEventListener('click', () => { this.state.page = i; this.load(); });
          pgEl.appendChild(btn);
        }
      }
    } catch (err) { wrap.innerHTML = errorState(err.message); }
  },

  async showDetail(id) {
    try {
      const { data: t } = await API.ticket(id);
      const modal = document.createElement('div');
      modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.8);z-index:999;display:flex;align-items:center;justify-content:center;padding:1rem';
      modal.innerHTML = `
        <div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--radius-lg);padding:1.5rem;max-width:600px;width:100%;max-height:80vh;overflow-y:auto">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1rem">
            <h2 style="font-size:1rem;margin:0">Ticket #${t.id} — ${escapeHtml(t.category)}</h2>
            <button onclick="this.closest('[style]').remove()" class="btn btn-ghost" style="padding:.2rem .5rem">✕</button>
          </div>
          <table style="width:100%;font-size:.82rem;margin-bottom:1rem">
            <tr><td style="color:var(--text-muted);padding:.3rem 0;width:40%">Status</td><td><span class="badge ${t.status==='open'?'badge-warning':'badge-neutral'}">${t.status}</span></td></tr>
            <tr><td style="color:var(--text-muted);padding:.3rem 0">Erstellt</td><td>${fmtDate(t.created_at)}</td></tr>
            <tr><td style="color:var(--text-muted);padding:.3rem 0">Geschlossen</td><td>${t.closed_at ? fmtDate(t.closed_at) : '—'}</td></tr>
            <tr><td style="color:var(--text-muted);padding:.3rem 0">Nachrichten</td><td>${t.message_count ?? '—'}</td></tr>
            <tr><td style="color:var(--text-muted);padding:.3rem 0">Bearbeiter</td><td>${escapeHtml(t.closed_by_username_snapshot ?? '—')}</td></tr>
          </table>
          ${t.summary ? `<div style="background:var(--surface-raised);border-radius:6px;padding:1rem;font-size:.82rem;line-height:1.6;color:var(--text-secondary)">${escapeHtml(t.summary)}</div>` : '<p style="color:var(--text-muted);font-size:.82rem">Keine Zusammenfassung verfügbar.</p>'}
        </div>
      `;
      modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });
      document.body.appendChild(modal);
    } catch (err) { toast('Ticket konnte nicht geladen werden: ' + err.message, 'error'); }
  },
};
