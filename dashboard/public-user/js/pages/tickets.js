// dashboard/public-user/js/pages/tickets.js
// Shows the logged-in user's own tickets with status filter, search, and detail modal.

window['page-tickets'] = {
  status: 'all',
  page:   1,
  search: '',
  _searchTimeout: null,

  async render(container) {
    const self = this;
    container.innerHTML = `
      <div class="page-header"><h1>Meine Tickets</h1><p>Alle Support-Tickets die du erstellt hast.</p></div>
      <div class="filter-bar">
        <select id="ticket-status-filter" class="filter-select">
          <option value="all">Alle</option>
          <option value="open">Offen</option>
          <option value="closed">Geschlossen</option>
        </select>
        <input id="ticket-search" type="text" class="form-input" placeholder="Suche…" style="flex:1;min-width:160px;max-width:280px" value="">
      </div>
      <div id="ticket-table-wrap"></div>
      <div id="ticket-pagination" class="pagination"></div>
    `;

    document.getElementById('ticket-status-filter').value = self.status;
    document.getElementById('ticket-search').value = self.search;

    document.getElementById('ticket-status-filter').addEventListener('change', (e) => {
      self.status = e.target.value;
      self.page   = 1;
      self.load();
    });

    document.getElementById('ticket-search').addEventListener('input', (e) => {
      clearTimeout(self._searchTimeout);
      self._searchTimeout = setTimeout(() => {
        self.search = e.target.value.trim();
        self.page   = 1;
        self.load();
      }, 350);
    });

    await self.load();
  },

  async load() {
    const self = this;
    const wrap = document.getElementById('ticket-table-wrap');
    const pag  = document.getElementById('ticket-pagination');
    if (!wrap) return;
    wrap.innerHTML = '<div class="skeleton" style="height:120px"></div>';

    try {
      const q = { status: self.status, page: self.page };
      if (self.search) q.search = self.search;
      const { data } = await API.myTickets(q);
      const { tickets, total, pages } = data;

      if (tickets.length === 0) {
        wrap.innerHTML = emptyState('Keine Tickets gefunden.');
        pag.innerHTML = '';
        return;
      }

      wrap.innerHTML = `
        <div class="table-card">
          <table>
            <thead><tr>
              <th>Kategorie</th>
              <th>Status</th>
              <th>Erstellt</th>
              <th>Geschlossen</th>
              <th>Zusammenfassung</th>
            </tr></thead>
            <tbody>
              ${tickets.map(t => `
                <tr class="clickable-row" data-id="${escapeHtml(String(t.id))}" style="cursor:pointer">
                  <td>${escapeHtml(t.category ?? '—')}</td>
                  <td><span class="badge ${t.status === 'open' ? 'badge-warning' : 'badge-neutral'}">${t.status === 'open' ? 'Offen' : 'Geschlossen'}</span></td>
                  <td>${fmtDate(t.created_at)}</td>
                  <td>${fmtDate(t.closed_at)}</td>
                  <td style="max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHtml(t.summary ? t.summary.slice(0, 120) + (t.summary.length > 120 ? '…' : '') : '—')}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `;

      wrap.querySelectorAll('.clickable-row').forEach(row => {
        row.addEventListener('click', () => self.showDetail(row.dataset.id));
      });

      // Pagination
      pag.innerHTML = '';
      for (let p = 1; p <= pages; p++) {
        const btn = document.createElement('button');
        btn.className = `page-btn${p === self.page ? ' active' : ''}`;
        btn.textContent = String(p);
        btn.addEventListener('click', () => { self.page = p; self.load(); });
        pag.appendChild(btn);
      }
    } catch (err) {
      wrap.innerHTML = errorState(err.message);
    }
  },

  async showDetail(id) {
    const existing = document.getElementById('ticket-modal-overlay');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.id = 'ticket-modal-overlay';
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <div class="modal">
        <div class="modal-header">
          <div class="modal-title">Ticket #${escapeHtml(String(id))}</div>
          <button class="modal-close" id="modal-close-btn">✕</button>
        </div>
        <div id="modal-body"><div class="skeleton" style="height:120px"></div></div>
      </div>
    `;
    document.body.appendChild(overlay);

    overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
    document.getElementById('modal-close-btn').addEventListener('click', () => overlay.remove());

    // Find modal-body for content
    const modalBody = document.getElementById('modal-body');

    try {
      const { data: t } = await API.myTicket(id);
      modalBody.innerHTML = `
        <div class="modal-field">
          <div class="modal-field-label">Kategorie</div>
          <div class="modal-field-value">${escapeHtml(t.category ?? '—')}</div>
        </div>
        <div class="modal-field">
          <div class="modal-field-label">Status</div>
          <div class="modal-field-value"><span class="badge ${t.status === 'open' ? 'badge-warning' : 'badge-neutral'}">${t.status === 'open' ? 'Offen' : 'Geschlossen'}</span></div>
        </div>
        <div class="modal-field">
          <div class="modal-field-label">Erstellt</div>
          <div class="modal-field-value">${fmtDate(t.created_at)}</div>
        </div>
        ${t.closed_at ? `<div class="modal-field"><div class="modal-field-label">Geschlossen</div><div class="modal-field-value">${fmtDate(t.closed_at)}</div></div>` : ''}
        ${t.closed_by_username_snapshot ? `<div class="modal-field"><div class="modal-field-label">Geschlossen von</div><div class="modal-field-value">${escapeHtml(t.closed_by_username_snapshot)}</div></div>` : ''}
        ${t.summary ? `<div class="modal-field"><div class="modal-field-label">Zusammenfassung</div><div class="modal-field-value" style="white-space:pre-wrap;line-height:1.6">${escapeHtml(t.summary)}</div></div>` : ''}
      `;
    } catch (err) {
      modalBody.innerHTML = errorState(err.message);
    }
  },
};
