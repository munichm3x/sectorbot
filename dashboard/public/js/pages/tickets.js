// dashboard/public/js/pages/tickets.js
window['page-tickets'] = {
  state: { status: 'all', page: 1, search: '', priority: '', category: '' },

  async render(container) {
    const self = this;
    container.innerHTML = `
      <div class="page-header"><h1>Ticket-Verwaltung</h1><p>Alle Tickets durchsuchen, filtern und Details anzeigen.</p></div>
      <div class="filter-bar" style="flex-wrap:wrap;gap:8px">
        <div class="period-bar">
          ${['open','closed','all'].map(s => `<button class="period-btn${s===self.state.status?' active':''}" data-status="${s}">${s==='open'?'Offen':s==='closed'?'Geschlossen':'Alle'}</button>`).join('')}
        </div>
        <select class="form-input" style="max-width:140px" id="filter-priority">
          <option value="">Alle Prioritäten</option>
          <option value="low">🟢 Niedrig</option>
          <option value="medium">🟡 Mittel</option>
          <option value="high">🔴 Hoch</option>
          <option value="urgent">🚨 Dringend</option>
        </select>
        <input class="form-input" style="max-width:160px" placeholder="Kategorie..." id="filter-category" value="">
        <input class="form-input" style="max-width:240px" placeholder="Suche nach Kategorie, User..." id="ticket-search" value="${escapeHtml(self.state.search)}">
      </div>
      <div class="table-card" id="ticket-table-wrap"><div class="skeleton tall"></div></div>
      <div id="ticket-pagination" class="pagination"></div>
    `;

    container.querySelectorAll('[data-status]').forEach(btn => {
      btn.addEventListener('click', () => {
        self.state.status = btn.dataset.status;
        self.state.page = 1;
        container.querySelectorAll('[data-status]').forEach(b => b.classList.toggle('active', b.dataset.status === self.state.status));
        self.load();
      });
    });

    document.getElementById('filter-priority').value = self.state.priority;
    document.getElementById('filter-priority').addEventListener('change', (e) => {
      self.state.priority = e.target.value;
      self.state.page = 1;
      self.load();
    });

    let catTimeout;
    document.getElementById('filter-category').addEventListener('input', (e) => {
      clearTimeout(catTimeout);
      catTimeout = setTimeout(() => { self.state.category = e.target.value; self.state.page = 1; self.load(); }, 400);
    });

    let searchTimeout;
    document.getElementById('ticket-search').addEventListener('input', (e) => {
      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(() => { self.state.search = e.target.value; self.state.page = 1; self.load(); }, 400);
    });

    await self.load();
  },

  priorityBadge(priority) {
    const map = { low: ['🟢', 'Niedrig', 'badge-success'], medium: ['🟡', 'Mittel', 'badge-neutral'], high: ['🔴', 'Hoch', 'badge-warning'], urgent: ['🚨', 'Dringend', 'badge-error'] };
    const [emoji, label, cls] = map[priority] ?? ['🟡', priority, 'badge-neutral'];
    return `<span class="badge ${cls}">${emoji} ${label}</span>`;
  },

  async load() {
    const wrap = document.getElementById('ticket-table-wrap');
    if (!wrap) return;
    wrap.innerHTML = '<div class="skeleton tall"></div>';
    try {
      const q = { status: this.state.status, page: this.state.page, search: this.state.search };
      if (this.state.priority) q.priority = this.state.priority;
      if (this.state.category) q.category = this.state.category;
      const { data } = await API.tickets(q);
      const { tickets, total, pages } = data;

      if (tickets.length === 0) { wrap.innerHTML = emptyState('Keine Tickets gefunden.'); return; }

      wrap.innerHTML = `
        <div class="table-wrap"><table class="responsive-table">
          <thead><tr><th>#</th><th>Kategorie</th><th>Priorität</th><th>Status</th><th>Erstellt</th><th>Geschlossen</th><th>Bearbeiter</th></tr></thead>
          <tbody>${tickets.map(t => `
            <tr class="clickable-row" onclick="window['page-tickets'].showDetail(${t.id})">
              <td data-label="#" class="mono dim">${t.id}</td>
              <td data-label="Kategorie">${escapeHtml(t.category)}</td>
              <td data-label="Priorität">${this.priorityBadge(t.priority ?? 'medium')}</td>
              <td data-label="Status"><span class="badge ${t.status==='open'?'badge-warning':'badge-neutral'}">${t.status}</span></td>
              <td data-label="Erstellt" class="dim">${fmtDate(t.created_at)}</td>
              <td data-label="Geschlossen" class="dim">${t.closed_at ? fmtDate(t.closed_at) : '—'}</td>
              <td data-label="Bearbeiter" class="dim">${escapeHtml(t.closed_by_username_snapshot ?? '—')}</td>
            </tr>
          `).join('')}</tbody>
        </table></div>
        <div class="page-info">${total} Tickets gesamt</div>
      `;

      const pgEl = document.getElementById('ticket-pagination');
      pgEl.innerHTML = '';
      if (pages > 1) {
        for (let i = 1; i <= Math.min(pages, 10); i++) {
          const btn = document.createElement('button');
          btn.className = `page-btn${i === this.state.page ? ' active' : ''}`;
          btn.textContent = i;
          btn.addEventListener('click', () => { this.state.page = i; this.load(); });
          pgEl.appendChild(btn);
        }
      }
    } catch (err) {
      wrap.innerHTML = `${errorState(err.message)}<div class="cta-row" style="justify-content:center;padding:0 1rem 1rem"><button class="btn btn-ghost" id="tickets-retry">Erneut laden</button></div>`;
      document.getElementById('tickets-retry')?.addEventListener('click', () => this.load());
    }
  },

  showDetail(id) {
    const existing = document.getElementById('ticket-modal');
    if (existing) existing.remove();
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.id = 'ticket-modal';
    overlay.innerHTML = `<div class="modal"><div class="modal-header"><div class="modal-title">Ticket #${id}</div><button class="modal-close" id="modal-close-btn">✕</button></div><div id="modal-body"><div class="skeleton" style="height:200px"></div></div></div>`;
    document.body.appendChild(overlay);
    overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
    document.getElementById('modal-close-btn').addEventListener('click', () => overlay.remove());

    API.ticket(id).then(({ data: t }) => {
      const notesHtml = (t.notes ?? []).length === 0
        ? '<p style="color:var(--text-muted);font-size:.82rem">Keine internen Notizen.</p>'
        : (t.notes ?? []).map(n => `
            <div style="background:var(--surface-raised);border-radius:6px;padding:10px;margin-bottom:6px">
              <div style="font-size:.78rem;color:var(--text-muted);margin-bottom:4px">${escapeHtml(n.authorTag)} · ${fmtDate(n.createdAt)}</div>
              <div style="font-size:.85rem">${escapeHtml(n.content)}</div>
            </div>`).join('');

      document.getElementById('modal-body').innerHTML = `
        <div class="modal-field"><div class="modal-field-label">Kategorie</div><div class="modal-field-value">${escapeHtml(t.category)}</div></div>
        <div class="modal-field"><div class="modal-field-label">Priorität</div><div class="modal-field-value">${this.priorityBadge(t.priority ?? 'medium')}</div></div>
        <div class="modal-field"><div class="modal-field-label">Status</div><div class="modal-field-value"><span class="badge ${t.status==='open'?'badge-warning':'badge-neutral'}">${t.status}</span></div></div>
        ${t.close_reason ? `<div class="modal-field"><div class="modal-field-label">Schließgrund</div><div class="modal-field-value">${escapeHtml(t.close_reason)}</div></div>` : ''}
        <div class="modal-field"><div class="modal-field-label">Erstellt</div><div class="modal-field-value">${fmtDate(t.created_at)}</div></div>
        <div class="modal-field"><div class="modal-field-label">Geschlossen</div><div class="modal-field-value">${t.closed_at ? fmtDate(t.closed_at) : '—'}</div></div>
        <div class="modal-field"><div class="modal-field-label">Nachrichten</div><div class="modal-field-value">${t.message_count ?? '—'}</div></div>
        <div class="modal-field"><div class="modal-field-label">Bearbeiter</div><div class="modal-field-value">${escapeHtml(t.closed_by_username_snapshot ?? '—')}</div></div>
        ${t.summary ? `<div class="modal-field"><div class="modal-field-label">Zusammenfassung</div><div class="modal-field-value" style="background:var(--surface-raised);border-radius:6px;padding:1rem;font-size:.82rem;line-height:1.6;color:var(--text-secondary)">${escapeHtml(t.summary)}</div></div>` : ''}
        ${t.has_transcript ? `<div class="modal-field"><button class="btn btn-ghost" onclick="window.open('${API.ticketTranscriptUrl(t.id)}', '_blank')">📄 Transcript öffnen</button></div>` : ''}
        <div class="modal-field" style="margin-top:12px"><div class="modal-field-label">Interne Notizen</div><div>${notesHtml}</div></div>
      `;
    }).catch(err => { toast('Ticket konnte nicht geladen werden: ' + err.message, 'error'); overlay.remove(); });
  },
};
