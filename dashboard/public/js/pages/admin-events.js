// dashboard/public/js/pages/admin-events.js
window['page-admin-events'] = {
  state: {
    items: [],
    selectedId: null,
    filter: '',
    statusFilter: 'all',
  },

  EVENT_TYPES: ['pvp','raid','solo','airfield','bunker','trader','meeting','wipe','community'],
  EVENT_TYPE_LABELS: {
    pvp: 'PvP Event',
    raid: 'Base Raid',
    solo: 'Solo Challenge',
    airfield: 'Airfield Control',
    bunker: 'Bunker Run',
    trader: 'Trader Event',
    meeting: 'Community Meeting',
    wipe: 'Wipe Event',
    community: 'Community',
  },

  STATUSES: ['draft','scheduled','live','ended','cancelled'],
  STATUS_LABELS: {
    draft: 'Entwurf',
    scheduled: 'Geplant',
    live: 'Live',
    ended: 'Beendet',
    cancelled: 'Abgesagt',
  },

  STATUS_ORDER: { live: 0, scheduled: 1, draft: 2, ended: 3, cancelled: 4 },

  tsToLocalInput(ts) {
    if (!ts) return '';
    const d = new Date(ts * 1000);
    const pad = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  },

  localInputToTs(s) {
    if (!s) return null;
    return Math.floor(new Date(s).getTime() / 1000);
  },

  async render(container) {
    const self = this;
    container.innerHTML = `
      <div class="page-header">
        <h1>Events verwalten</h1>
        <p>Events erstellen, bearbeiten und Status verwalten. Öffentliche Events erscheinen im Public Dashboard.</p>
      </div>
      <div class="crud-toolbar">
        <input id="e-search" class="form-input" placeholder="Suche Events…" value="${escapeHtml(self.state.filter)}" />
        <select id="e-status-filter" class="filter-select">
          <option value="all">Alle Status</option>
          ${self.STATUSES.map(s => `<option value="${s}" ${self.state.statusFilter === s ? 'selected' : ''}>${escapeHtml(self.STATUS_LABELS[s])}</option>`).join('')}
        </select>
        <button id="e-new" class="btn btn-primary">+ Neues Event</button>
      </div>
      <div class="crud-layout">
        <div class="crud-list" id="e-list"><div class="skeleton" style="height:60px;margin:0.75rem"></div></div>
        <div class="crud-editor" id="e-editor">
          <div class="crud-editor-empty">
            <div class="empty-icon">⬡</div>
            <p>Wähle ein Event zur Bearbeitung oder erstelle ein neues.</p>
          </div>
        </div>
      </div>
    `;

    document.getElementById('e-search').addEventListener('input', (e) => {
      self.state.filter = e.target.value.toLowerCase();
      self.renderList();
    });
    document.getElementById('e-status-filter').addEventListener('change', (e) => {
      self.state.statusFilter = e.target.value;
      self.renderList();
    });
    document.getElementById('e-new').addEventListener('click', () => self.openEditor(null));

    await self.loadAll();
  },

  async loadAll() {
    try {
      const { data } = await API.adminEvents.list();
      this.state.items = data || [];
      this.renderList();
    } catch (err) {
      const listEl = document.getElementById('e-list');
      if (listEl) listEl.innerHTML = `<div class="crud-list-empty">Fehler: ${escapeHtml(err.message || 'Laden fehlgeschlagen')}</div>`;
    }
  },

  renderList() {
    const listEl = document.getElementById('e-list');
    if (!listEl) return;

    const filtered = this.state.items.filter(ev => {
      if (this.state.statusFilter !== 'all' && ev.status !== this.state.statusFilter) return false;
      if (this.state.filter && !(
        (ev.title || '').toLowerCase().includes(this.state.filter) ||
        (ev.description || '').toLowerCase().includes(this.state.filter)
      )) return false;
      return true;
    }).sort((a, b) => {
      const so = (this.STATUS_ORDER[a.status] ?? 9) - (this.STATUS_ORDER[b.status] ?? 9);
      if (so !== 0) return so;
      // Within same status: upcoming first (ascending starts_at for upcoming, descending for past)
      return (b.starts_at ?? 0) - (a.starts_at ?? 0);
    });

    if (filtered.length === 0) {
      listEl.innerHTML = `<div class="crud-list-empty">Keine Events. Klicke „+ Neues Event".</div>`;
      return;
    }

    let html = '';
    let currentStatus = null;
    for (const ev of filtered) {
      if (ev.status !== currentStatus) {
        html += `<div class="nav-section" style="padding:0.6rem 1rem 0.2rem;font-size:0.72rem;font-weight:600;text-transform:uppercase;color:var(--text-muted,#888)">${escapeHtml(this.STATUS_LABELS[ev.status] || ev.status)}</div>`;
        currentStatus = ev.status;
      }
      const isActive = this.state.selectedId === ev.id;
      const typeLabel = this.EVENT_TYPE_LABELS[ev.event_type] || ev.event_type || '—';
      html += `
        <div class="crud-list-item ${isActive ? 'active' : ''}" data-id="${ev.id}">
          <div class="crud-list-item-title">${escapeHtml(ev.title)}</div>
          <div class="crud-list-item-meta">
            <span class="status-pill ${escapeHtml(ev.status || 'draft')}">${escapeHtml(this.STATUS_LABELS[ev.status] || ev.status)}</span>
            <span style="font-size:0.72rem;color:var(--text-muted,#888)">${escapeHtml(typeLabel)}</span>
            <span style="font-size:0.72rem;color:var(--text-muted,#888)">${ev.starts_at ? fmtDate(ev.starts_at) : '—'}</span>
          </div>
        </div>
      `;
    }
    listEl.innerHTML = html;

    listEl.querySelectorAll('.crud-list-item').forEach(el => {
      el.addEventListener('click', () => this.openEditor(Number(el.dataset.id)));
    });
  },

  openEditor(id) {
    this.state.selectedId = id;
    this.renderList();
    const editor = document.getElementById('e-editor');
    if (!editor) return;
    const item = id ? this.state.items.find(ev => ev.id === id) : null;
    const isNew = !item;
    editor.innerHTML = `
      <h2 style="font-size:1.1rem;font-weight:700;margin-bottom:1rem">${isNew ? 'Neues Event' : 'Event #' + escapeHtml(String(id)) + ' bearbeiten'}</h2>
      <div class="form-row">
        <div class="form-group" style="flex:2">
          <label class="form-label">Titel <span style="color:var(--offline,red)">*</span></label>
          <input class="form-input" id="e-edit-title" value="${escapeHtml(item?.title || '')}" maxlength="200" placeholder="Event-Titel" />
        </div>
        <div class="form-group">
          <label class="form-label">Typ</label>
          <select class="form-input" id="e-edit-type">
            <option value="">— kein Typ —</option>
            ${this.EVENT_TYPES.map(t => `<option value="${t}" ${item?.event_type === t ? 'selected' : ''}>${escapeHtml(this.EVENT_TYPE_LABELS[t] || t)}</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Beschreibung</label>
        <textarea class="form-textarea" id="e-edit-desc" rows="4" maxlength="4000" placeholder="Optionale Beschreibung…">${escapeHtml(item?.description || '')}</textarea>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Start <span style="color:var(--offline,red)">*</span></label>
          <input class="form-input" id="e-edit-starts" type="datetime-local" value="${escapeHtml(this.tsToLocalInput(item?.starts_at))}" />
        </div>
        <div class="form-group">
          <label class="form-label">Ende (optional)</label>
          <input class="form-input" id="e-edit-ends" type="datetime-local" value="${escapeHtml(this.tsToLocalInput(item?.ends_at))}" />
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Status</label>
          <select class="form-input" id="e-edit-status">
            ${this.STATUSES.map(s => `<option value="${s}" ${(item?.status || 'draft') === s ? 'selected' : ''}>${escapeHtml(this.STATUS_LABELS[s])}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Sichtbarkeit</label>
          <label class="form-checkbox-row">
            <input type="checkbox" id="e-edit-public" ${(item?.public_visible !== 0 && item?.public_visible !== false) || isNew ? 'checked' : ''} />
            <span>Öffentlich sichtbar</span>
          </label>
        </div>
      </div>
      <div class="form-row">
        <div class="form-group" style="flex:1">
          <label class="form-label">Discord URL (optional)</label>
          <input class="form-input" id="e-edit-discord-url" type="url" value="${escapeHtml(item?.discord_url || '')}" placeholder="https://discord.com/…" />
        </div>
        <div class="form-group" style="flex:1">
          <label class="form-label">Banner URL (optional)</label>
          <input class="form-input" id="e-edit-banner-url" type="url" value="${escapeHtml(item?.banner_url || '')}" placeholder="https://…/banner.png" />
        </div>
      </div>
      <div class="crud-actions">
        <button class="btn btn-primary" id="e-save">${isNew ? 'Anlegen' : 'Speichern'}</button>
        ${isNew ? '' : '<button class="btn btn-danger" id="e-delete">Löschen</button>'}
        <button class="btn btn-ghost" id="e-cancel">Abbrechen</button>
        <span style="flex:1"></span>
        <span class="form-help" style="margin:0">Änderungen werden im Audit-Log protokolliert.</span>
      </div>
    `;
    document.getElementById('e-save').addEventListener('click', () => this.save(id));
    document.getElementById('e-cancel').addEventListener('click', () => this.closeEditor());
    if (!isNew) document.getElementById('e-delete').addEventListener('click', () => this.delete(id));
  },

  closeEditor() {
    this.state.selectedId = null;
    this.renderList();
    const editor = document.getElementById('e-editor');
    if (editor) editor.innerHTML = '<div class="crud-editor-empty"><div class="empty-icon">⬡</div><p>Wähle ein Event zur Bearbeitung oder erstelle ein neues.</p></div>';
  },

  async save(id) {
    const title = document.getElementById('e-edit-title').value.trim();
    const startsRaw = document.getElementById('e-edit-starts').value;
    if (!title) { toast('Titel ist ein Pflichtfeld.', 'error'); return; }
    if (!startsRaw) { toast('Startdatum ist ein Pflichtfeld.', 'error'); return; }

    const endsRaw = document.getElementById('e-edit-ends').value;
    const discordUrl = document.getElementById('e-edit-discord-url').value.trim();
    const bannerUrl = document.getElementById('e-edit-banner-url').value.trim();

    const body = {
      title,
      description: document.getElementById('e-edit-desc').value.trim() || null,
      event_type: document.getElementById('e-edit-type').value || null,
      starts_at: this.localInputToTs(startsRaw),
      ends_at: this.localInputToTs(endsRaw),
      status: document.getElementById('e-edit-status').value,
      discord_url: discordUrl || null,
      banner_url: bannerUrl || null,
      public_visible: document.getElementById('e-edit-public').checked ? 1 : 0,
    };
    try {
      if (id) {
        await API.adminEvents.update(id, body);
        toast('Event aktualisiert.', 'success');
      } else {
        const res = await API.adminEvents.create(body);
        toast('Event angelegt.', 'success');
        this.state.selectedId = res.data?.id ?? null;
      }
      await this.loadAll();
      if (this.state.selectedId) this.openEditor(this.state.selectedId);
    } catch (err) {
      toast('Fehler: ' + (err.message || 'Speichern fehlgeschlagen'), 'error');
    }
  },

  async delete(id) {
    if (!confirm('Dieses Event wirklich löschen?')) return;
    try {
      await API.adminEvents.delete(id);
      toast('Event gelöscht.', 'success');
      this.state.selectedId = null;
      await this.loadAll();
      this.closeEditor();
    } catch (err) {
      toast('Fehler: ' + (err.message || 'Löschen fehlgeschlagen'), 'error');
    }
  },
};
