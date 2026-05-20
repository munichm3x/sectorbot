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
      <div class="toolbar" style="display:flex;gap:.75rem;flex-wrap:wrap;margin-bottom:1rem;align-items:center">
        <select id="ticket-status-filter" class="select" style="width:auto">
          <option value="all">Alle</option>
          <option value="open">Offen</option>
          <option value="closed">Geschlossen</option>
        </select>
        <input id="ticket-search" type="text" class="input" placeholder="Suche…" style="flex:1;min-width:160px;max-width:280px" value="">
      </div>
      <div id="ticket-table-wrap"></div>
      <div id="ticket-pagination" style="margin-top:.75rem;display:flex;gap:.5rem;flex-wrap:wrap"></div>

      <!-- Modal -->
      <div id="ticket-modal" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:100;align-items:center;justify-content:center">
        <div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--radius-lg);padding:2rem;max-width:640px;width:90%;max-height:80vh;overflow-y:auto;position:relative">
          <button id="modal-close" style="position:absolute;top:.75rem;right:.75rem;background:none;border:none;color:var(--text-muted);font-size:1.25rem;cursor:pointer">✕</button>
          <div id="modal-body"></div>
        </div>
      </div>
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

    document.getElementById('modal-close').addEventListener('click', () => {
      document.getElementById('ticket-modal').style.display = 'none';
    });
    document.getElementById('ticket-modal').addEventListener('click', (e) => {
      if (e.target === document.getElementById('ticket-modal')) {
        document.getElementById('ticket-modal').style.display = 'none';
      }
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
        <table class="data-table">
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
                <td><span class="status-badge ${t.status === 'open' ? 'online' : 'offline'}">${t.status === 'open' ? 'Offen' : 'Geschlossen'}</span></td>
                <td>${fmtDate(t.created_at)}</td>
                <td>${fmtDate(t.closed_at)}</td>
                <td style="max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHtml(t.summary ? t.summary.slice(0, 120) + (t.summary.length > 120 ? '…' : '') : '—')}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `;

      wrap.querySelectorAll('.clickable-row').forEach(row => {
        row.addEventListener('click', () => self.showDetail(row.dataset.id));
      });

      // Pagination
      pag.innerHTML = '';
      for (let p = 1; p <= pages; p++) {
        const btn = document.createElement('button');
        btn.className = `period-btn${p === self.page ? ' active' : ''}`;
        btn.textContent = String(p);
        btn.addEventListener('click', () => { self.page = p; self.load(); });
        pag.appendChild(btn);
      }
    } catch (err) {
      wrap.innerHTML = errorState(err.message);
    }
  },

  async showDetail(id) {
    const modal    = document.getElementById('ticket-modal');
    const modalBody = document.getElementById('modal-body');
    modal.style.display = 'flex';
    modalBody.innerHTML = '<div class="skeleton" style="height:120px"></div>';

    try {
      const { data: t } = await API.myTicket(id);
      modalBody.innerHTML = `
        <h2 style="margin-top:0;margin-bottom:.5rem">${escapeHtml(t.category ?? 'Ticket')} #${escapeHtml(String(t.id))}</h2>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:.5rem 1.5rem;margin-bottom:1rem;font-size:.85rem;color:var(--text-muted)">
          <div>Status: <strong style="color:var(--text)">${t.status === 'open' ? 'Offen' : 'Geschlossen'}</strong></div>
          <div>Erstellt: <strong style="color:var(--text)">${fmtDate(t.created_at)}</strong></div>
          ${t.closed_at ? `<div>Geschlossen: <strong style="color:var(--text)">${fmtDate(t.closed_at)}</strong></div>` : ''}
          ${t.closed_by_username_snapshot ? `<div>Geschlossen von: <strong style="color:var(--text)">${escapeHtml(t.closed_by_username_snapshot)}</strong></div>` : ''}
        </div>
        ${t.summary ? `<div style="background:var(--bg);border:1px solid var(--border);border-radius:var(--radius);padding:1rem;font-size:.9rem;line-height:1.6;white-space:pre-wrap">${escapeHtml(t.summary)}</div>` : emptyState('Keine Zusammenfassung vorhanden.')}
      `;
    } catch (err) {
      modalBody.innerHTML = errorState(err.message);
    }
  },
};
