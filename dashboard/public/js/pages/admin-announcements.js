// dashboard/public/js/pages/admin-announcements.js
window['page-admin-announcements'] = {
  state: {
    items: [],
    selectedId: null,
    filter: '',
    typeFilter: 'all',
  },

  TYPES: ['info', 'maintenance', 'warning', 'event', 'whitelist', 'rules'],
  TYPE_LABELS: {
    info: 'Info',
    maintenance: 'Wartung',
    warning: 'Warnung',
    event: 'Event',
    whitelist: 'Whitelist',
    rules: 'Regeländerung',
  },

  async render(container) {
    const self = this;
    container.innerHTML = `
      <div class="page-header">
        <h1>Announcements verwalten</h1>
        <p>Öffentliche Hinweise wie Wartungen, Server-Updates oder Regeländerungen erstellen. Aktive Announcements erscheinen im Public Dashboard.</p>
      </div>
      <div class="crud-toolbar">
        <input id="an-search" class="form-input" placeholder="Suche Announcements…" />
        <select id="an-type-filter" class="filter-select">
          <option value="all">Alle Typen</option>
          ${self.TYPES.map(t => `<option value="${t}">${self.TYPE_LABELS[t]}</option>`).join('')}
        </select>
        <button id="an-new" class="btn btn-primary">+ Neuer Hinweis</button>
      </div>
      <div class="crud-layout">
        <div class="crud-list" id="an-list"><div class="skeleton" style="height:60px;margin:0.75rem"></div></div>
        <div class="crud-editor" id="an-editor">
          <div class="crud-editor-empty">
            <div class="empty-icon">!</div>
            <p>Wähle einen Hinweis zur Bearbeitung oder erstelle einen neuen.</p>
          </div>
        </div>
      </div>
    `;

    document.getElementById('an-search').addEventListener('input', (e) => {
      self.state.filter = e.target.value.toLowerCase();
      self.renderList();
    });
    document.getElementById('an-type-filter').addEventListener('change', (e) => {
      self.state.typeFilter = e.target.value;
      self.renderList();
    });
    document.getElementById('an-new').addEventListener('click', () => self.openEditor(null));

    await self.loadAll();
  },

  async loadAll() {
    try {
      const { data } = await API.adminAnnouncements.list();
      this.state.items = data || [];
      this.renderList();
    } catch (err) {
      document.getElementById('an-list').innerHTML = `<div class="crud-list-empty">Fehler: ${escapeHtml(err.message || 'Laden fehlgeschlagen')}</div>`;
    }
  },

  renderList() {
    const self = this;
    const now = Math.floor(Date.now() / 1000);
    const filtered = this.state.items.filter(a => {
      if (this.state.typeFilter !== 'all' && a.announcement_type !== this.state.typeFilter) return false;
      if (this.state.filter && !(a.title.toLowerCase().includes(this.state.filter) || (a.body || '').toLowerCase().includes(this.state.filter))) return false;
      return true;
    }).sort((a, b) => {
      // Active first (highest priority), then upcoming, then expired
      const aActive = a.active === 1 && a.starts_at <= now && (a.ends_at == null || a.ends_at >= now);
      const bActive = b.active === 1 && b.starts_at <= now && (b.ends_at == null || b.ends_at >= now);
      if (aActive !== bActive) return aActive ? -1 : 1;
      if (a.priority !== b.priority) return b.priority - a.priority;
      return b.starts_at - a.starts_at;
    });

    const listEl = document.getElementById('an-list');
    if (filtered.length === 0) {
      listEl.innerHTML = `<div class="crud-list-empty">Keine Announcements. Klicke „+ Neuer Hinweis".</div>`;
      return;
    }

    let html = '';
    for (const a of filtered) {
      const isActive = self.state.selectedId === a.id;
      const isLive = a.active === 1 && a.starts_at <= now && (a.ends_at == null || a.ends_at >= now);
      const stateLabel = !a.active ? 'Inaktiv'
        : a.starts_at > now ? 'Geplant'
        : (a.ends_at != null && a.ends_at < now) ? 'Abgelaufen'
        : 'Live';
      const statePill = !a.active ? 'archived'
        : a.starts_at > now ? 'scheduled'
        : (a.ends_at != null && a.ends_at < now) ? 'ended'
        : 'live';
      html += `
        <div class="crud-list-item ${isActive ? 'active' : ''}" data-id="${a.id}">
          <div class="crud-list-item-title">${escapeHtml(a.title)}</div>
          <div class="crud-list-item-meta">
            <span class="status-pill ${statePill}">${escapeHtml(stateLabel)}</span>
            <span class="badge badge-neutral" style="font-size:0.62rem">${escapeHtml(self.TYPE_LABELS[a.announcement_type] || a.announcement_type)}</span>
            ${a.show_as_banner ? '<span class="badge badge-accent" style="font-size:0.62rem">Banner</span>' : ''}
            <span class="visibility-badge ${a.public_visible ? 'public' : 'private'}">${a.public_visible ? 'Public' : 'Versteckt'}</span>
            ${a.priority > 0 ? `<span style="color:var(--text-muted)">P${a.priority}</span>` : ''}
            <span style="color:var(--text-muted)">${fmtDate(a.starts_at)}</span>
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
    const self = this;
    this.state.selectedId = id;
    this.renderList();
    const editor = document.getElementById('an-editor');
    const item = id ? this.state.items.find(a => a.id === id) : null;
    const isNew = !item;
    const now = Math.floor(Date.now() / 1000);

    editor.innerHTML = `
      <h2 style="font-size:1.1rem;font-weight:700">${isNew ? 'Neuer Announcement' : 'Hinweis #' + id}</h2>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Typ</label>
          <select class="form-input" id="an-edit-type">
            ${self.TYPES.map(t => `<option value="${t}" ${(item?.announcement_type ?? 'info') === t ? 'selected' : ''}>${self.TYPE_LABELS[t]}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Priorität</label>
          <input class="form-input" id="an-edit-priority" type="number" value="${item?.priority ?? 0}" min="0" max="100" />
          <div class="form-help">Höhere Werte werden zuerst angezeigt</div>
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Titel</label>
        <input class="form-input" id="an-edit-title" value="${escapeHtml(item?.title || '')}" maxlength="200" />
      </div>
      <div class="form-group">
        <label class="form-label">Text</label>
        <textarea class="form-textarea" id="an-edit-body" rows="5" maxlength="2000">${escapeHtml(item?.body || '')}</textarea>
        <div class="form-help">Max. 2000 Zeichen</div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Aktiv ab</label>
          <input class="form-input" id="an-edit-starts" type="datetime-local" value="${tsToLocalInput(item?.starts_at ?? now)}" />
        </div>
        <div class="form-group">
          <label class="form-label">Aktiv bis (optional)</label>
          <input class="form-input" id="an-edit-ends" type="datetime-local" value="${tsToLocalInput(item?.ends_at)}" />
          <div class="form-help">Leer = unbefristet</div>
        </div>
      </div>
      <div class="form-group">
        <label class="form-checkbox-row">
          <input type="checkbox" id="an-edit-active" ${(item?.active ?? 1) ? 'checked' : ''} />
          <span>Aktiv (wird angezeigt im Zeitfenster)</span>
        </label>
      </div>
      <div class="form-group">
        <label class="form-checkbox-row">
          <input type="checkbox" id="an-edit-banner" ${item?.show_as_banner ? 'checked' : ''} />
          <span>Als Banner oben im Public Dashboard hervorheben</span>
        </label>
      </div>
      <div class="form-group">
        <label class="form-checkbox-row">
          <input type="checkbox" id="an-edit-public" ${item?.public_visible !== 0 ? 'checked' : ''} />
          <span>Öffentlich sichtbar</span>
        </label>
      </div>
      <div class="crud-actions">
        <button class="btn btn-primary" id="an-save">${isNew ? 'Anlegen' : 'Speichern'}</button>
        ${isNew ? '' : '<button class="btn btn-danger" id="an-delete">Löschen</button>'}
        <button class="btn btn-ghost" id="an-cancel">Abbrechen</button>
        <span style="flex:1"></span>
        <span class="form-help" style="margin:0">Änderungen werden im Audit-Log protokolliert.</span>
      </div>
    `;

    document.getElementById('an-save').addEventListener('click', () => this.save(id));
    document.getElementById('an-cancel').addEventListener('click', () => {
      this.state.selectedId = null;
      this.renderList();
      document.getElementById('an-editor').innerHTML = '<div class="crud-editor-empty"><div class="empty-icon">!</div><p>Wähle einen Hinweis zur Bearbeitung oder erstelle einen neuen.</p></div>';
    });
    if (!isNew) document.getElementById('an-delete').addEventListener('click', () => this.delete(id));
  },

  async save(id) {
    const startsAt = localInputToTs(document.getElementById('an-edit-starts').value);
    if (!startsAt) {
      toast('Startzeit ist erforderlich.', 'error');
      return;
    }
    const body = {
      announcement_type: document.getElementById('an-edit-type').value,
      title: document.getElementById('an-edit-title').value.trim(),
      body: document.getElementById('an-edit-body').value.trim(),
      priority: Number(document.getElementById('an-edit-priority').value) || 0,
      starts_at: startsAt,
      ends_at: localInputToTs(document.getElementById('an-edit-ends').value),
      active: document.getElementById('an-edit-active').checked ? 1 : 0,
      show_as_banner: document.getElementById('an-edit-banner').checked ? 1 : 0,
      public_visible: document.getElementById('an-edit-public').checked ? 1 : 0,
    };
    if (!body.title || !body.body) {
      toast('Titel und Text sind Pflichtfelder.', 'error');
      return;
    }
    try {
      if (id) {
        await API.adminAnnouncements.update(id, body);
        toast('Announcement aktualisiert.', 'success');
      } else {
        const res = await API.adminAnnouncements.create(body);
        toast('Announcement angelegt.', 'success');
        this.state.selectedId = res.data?.id ?? null;
      }
      await this.loadAll();
      if (this.state.selectedId) this.openEditor(this.state.selectedId);
    } catch (err) {
      toast('Fehler: ' + (err.message || 'Speichern fehlgeschlagen'), 'error');
    }
  },

  async delete(id) {
    if (!confirm('Diesen Hinweis wirklich löschen?')) return;
    try {
      await API.adminAnnouncements.delete(id);
      toast('Announcement gelöscht.', 'success');
      this.state.selectedId = null;
      await this.loadAll();
      document.getElementById('an-editor').innerHTML = '<div class="crud-editor-empty"><div class="empty-icon">!</div><p>Wähle einen Hinweis zur Bearbeitung oder erstelle einen neuen.</p></div>';
    } catch (err) {
      toast('Fehler: ' + (err.message || 'Löschen fehlgeschlagen'), 'error');
    }
  },
};

function tsToLocalInput(ts) {
  if (!ts) return '';
  const d = new Date(ts * 1000);
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function localInputToTs(s) {
  if (!s) return null;
  const t = new Date(s).getTime();
  return Number.isFinite(t) ? Math.floor(t / 1000) : null;
}
