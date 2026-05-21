window['page-tickets'] = {
  status: 'all',
  page: 1,
  search: '',
  _searchTimeout: null,

  async render(container) {
    container.innerHTML = pageHeader('Support', 'Support & Meine Tickets', 'Supportinformationen, Kategorien und deine eigenen Tickets.') + `
      <div id="support-content"></div>
      <div id="my-ticket-content"></div>
    `;
    await this.loadSupport();
    await this.loadTickets();
  },

  async loadSupport() {
    const root = document.getElementById('support-content');
    try {
      const [{ data: support }, whitelist] = await Promise.all([API.support(), API.whitelistStatus()]);
      root.innerHTML = `
        <div class="content-grid">
          <section class="card">
            <div class="card-header"><div class="card-title">Supportstatus</div><span class="badge badge-online">Online</span></div>
            <p class="muted-copy">Bitte lies zuerst das Regelwerk. Für persönliche Anliegen kannst du ein Ticket im Discord erstellen und hier den Status deiner eigenen Tickets verfolgen.</p>
            <div class="cta-row">
              <button class="btn btn-primary" onclick="navigateTo('rules')">Regeln lesen</button>
              <a class="btn btn-ghost" href="/auth/public/login">Discord Login</a>
            </div>
          </section>
          <section class="card">
            <div class="card-header"><div class="card-title">Whitelist</div></div>
            ${renderWhitelist(whitelist)}
          </section>
        </div>
        <section class="card">
          <div class="card-header"><div class="card-title">Ticket-Kategorien</div></div>
          ${(support.categories ?? []).length ? `<div class="info-grid">${support.categories.map(cat => `<div class="info-card"><span>${escapeHtml(cat.label)}</span><p>${escapeHtml(cat.description)}</p></div>`).join('')}</div>` : emptyState('Noch keine Ticket-Kategorien konfiguriert.')}
        </section>
      `;
    } catch {
      root.innerHTML = errorState();
    }
  },

  async loadTickets() {
    const root = document.getElementById('my-ticket-content');
    if (!window.AppState.authenticated) {
      root.innerHTML = loginPrompt('Melde dich an, um deine eigenen offenen und geschlossenen Tickets zu sehen.');
      return;
    }
    root.innerHTML = `
      <section class="card">
        <div class="card-header"><div class="card-title">Meine Tickets</div></div>
        <div class="filter-bar">
          <select id="ticket-status-filter" class="filter-select">
            <option value="all">Alle</option>
            <option value="open">Offen</option>
            <option value="closed">Geschlossen</option>
          </select>
          <input id="ticket-search" type="text" class="form-input" placeholder="Suche..." value="${escapeHtml(this.search)}">
        </div>
        <div id="ticket-list-wrap"></div>
        <div id="ticket-pagination" class="pagination"></div>
      </section>
    `;
    document.getElementById('ticket-status-filter').value = this.status;
    document.getElementById('ticket-status-filter').addEventListener('change', e => {
      this.status = e.target.value;
      this.page = 1;
      this.loadTicketList();
    });
    document.getElementById('ticket-search').addEventListener('input', e => {
      clearTimeout(this._searchTimeout);
      this._searchTimeout = setTimeout(() => {
        this.search = e.target.value.trim();
        this.page = 1;
        this.loadTicketList();
      }, 300);
    });
    await this.loadTicketList();
  },

  async loadTicketList() {
    const wrap = document.getElementById('ticket-list-wrap');
    const pag = document.getElementById('ticket-pagination');
    if (!wrap) return;
    wrap.innerHTML = '<div class="skeleton" style="height:120px"></div>';

    const q = { status: this.status, page: this.page };
    if (this.search) q.search = this.search;
    const result = await API.myTickets(q);
    if (result.unauthenticated) {
      wrap.innerHTML = loginPrompt();
      return;
    }
    const { tickets, pages } = result.data;
    if (!tickets.length) {
      wrap.innerHTML = emptyState('Du hast aktuell keine passenden Tickets.');
      pag.innerHTML = '';
      return;
    }
    wrap.innerHTML = `<div class="ticket-card-grid">${tickets.map(renderTicketCard).join('')}</div>`;
    wrap.querySelectorAll('.ticket-card').forEach(card => card.addEventListener('click', () => this.showDetail(card.dataset.id)));

    pag.innerHTML = '';
    for (let p = 1; p <= pages; p++) {
      const btn = document.createElement('button');
      btn.className = `page-btn${p === this.page ? ' active' : ''}`;
      btn.textContent = String(p);
      btn.addEventListener('click', () => { this.page = p; this.loadTicketList(); });
      pag.appendChild(btn);
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
          <div class="modal-title">Ticket #${escapeHtml(id)}</div>
          <button class="modal-close" id="modal-close-btn">x</button>
        </div>
        <div id="modal-body"><div class="skeleton" style="height:120px"></div></div>
      </div>
    `;
    document.body.appendChild(overlay);
    overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
    document.getElementById('modal-close-btn').addEventListener('click', () => overlay.remove());

    const result = await API.myTicket(id);
    const modalBody = document.getElementById('modal-body');
    if (result.unauthenticated) {
      modalBody.innerHTML = loginPrompt();
      return;
    }
    const t = result.data;
    modalBody.innerHTML = `
      <div class="modal-field"><div class="modal-field-label">Kategorie</div><div class="modal-field-value">${escapeHtml(t.category ?? '-')}</div></div>
      <div class="modal-field"><div class="modal-field-label">Status</div><div class="modal-field-value"><span class="badge ${t.status === 'open' ? 'badge-warning' : 'badge-neutral'}">${t.status === 'open' ? 'Offen' : 'Geschlossen'}</span></div></div>
      <div class="modal-field"><div class="modal-field-label">Erstellt</div><div class="modal-field-value">${fmtDate(t.created_at)}</div></div>
      ${t.closed_at ? `<div class="modal-field"><div class="modal-field-label">Geschlossen</div><div class="modal-field-value">${fmtDate(t.closed_at)}</div></div>` : ''}
    `;
  },
};

function renderWhitelist(result) {
  if (result.unauthenticated) return loginPrompt('Melde dich an, um deinen Whitelist-Status zu sehen.');
  const data = result.data;
  return `
    <div class="whitelist-state">
      <span class="badge ${data.approved ? 'badge-online' : 'badge-neutral'}">${data.approved ? 'Freigeschaltet' : data.configured ? 'Nicht freigeschaltet' : 'Nicht konfiguriert'}</span>
      <p>${escapeHtml(data.nextStep)}</p>
    </div>
  `;
}

function renderTicketCard(t) {
  return `
    <article class="ticket-card" data-id="${escapeHtml(String(t.id))}">
      <div class="ticket-card-head">
        <strong>#${escapeHtml(String(t.id))}</strong>
        <span class="badge ${t.status === 'open' ? 'badge-warning' : 'badge-neutral'}">${t.status === 'open' ? 'Offen' : 'Geschlossen'}</span>
      </div>
      <div class="ticket-category">${escapeHtml(t.category ?? '-')}</div>
      <div class="ticket-meta">Erstellt ${fmtDate(t.created_at)}${t.closed_at ? ` · Geschlossen ${fmtDate(t.closed_at)}` : ''}</div>
    </article>
  `;
}
