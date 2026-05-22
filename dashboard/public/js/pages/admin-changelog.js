// dashboard/public/js/pages/admin-changelog.js
window['page-admin-changelog'] = {
  state: {
    items: [],
    selectedId: null,
    filter: '',
    statusFilter: 'all',
    categoryFilter: 'all',
  },

  CATEGORIES: ['server', 'discord', 'rules', 'events', 'bot'],
  CATEGORY_LABELS: {
    server: 'Server',
    discord: 'Discord',
    rules: 'Regeln',
    events: 'Events',
    bot: 'Bot',
  },
  STATUSES: ['draft', 'published', 'archived'],
  STATUS_LABELS: { draft: 'Entwurf', published: 'Veröffentlicht', archived: 'Archiviert' },

  async render(container) {
    const self = this;
    container.innerHTML = `
      <div class="page-header">
        <h1>Changelog verwalten</h1>
        <p>Updates erstellen, als Entwurf speichern und veröffentlichen. Veröffentlichte Einträge erscheinen im Public Dashboard.</p>
      </div>
      <div class="crud-toolbar">
        <input id="cl-search" class="form-input" placeholder="Suche Changelog-Einträge…" />
        <select id="cl-status-filter" class="filter-select">
          <option value="all">Alle Status</option>
          <option value="draft">Entwurf</option>
          <option value="published">Veröffentlicht</option>
          <option value="archived">Archiviert</option>
        </select>
        <select id="cl-cat-filter" class="filter-select">
          <option value="all">Alle Kategorien</option>
          ${self.CATEGORIES.map(c => `<option value="${c}">${self.CATEGORY_LABELS[c]}</option>`).join('')}
        </select>
        <button id="cl-new" class="btn btn-primary">+ Neuer Eintrag</button>
      </div>
      <div class="crud-layout">
        <div class="crud-list" id="cl-list"><div class="skeleton" style="height:60px;margin:0.75rem"></div></div>
        <div class="crud-editor" id="cl-editor">
          <div class="crud-editor-empty">
            <div class="empty-icon">≡</div>
            <p>Wähle einen Eintrag zur Bearbeitung oder erstelle einen neuen.</p>
          </div>
        </div>
      </div>
    `;

    document.getElementById('cl-search').addEventListener('input', (e) => {
      self.state.filter = e.target.value.toLowerCase();
      self.renderList();
    });
    document.getElementById('cl-status-filter').addEventListener('change', (e) => {
      self.state.statusFilter = e.target.value;
      self.renderList();
    });
    document.getElementById('cl-cat-filter').addEventListener('change', (e) => {
      self.state.categoryFilter = e.target.value;
      self.renderList();
    });
    document.getElementById('cl-new').addEventListener('click', () => self.openEditor(null));

    await self.loadAll();
  },

  async loadAll() {
    try {
      const { data } = await API.adminChangelog.list();
      this.state.items = data || [];
      this.renderList();
    } catch (err) {
      document.getElementById('cl-list').innerHTML = `<div class="crud-list-empty">Fehler: ${escapeHtml(err.message || 'Laden fehlgeschlagen')}</div>`;
    }
  },

  renderList() {
    const self = this;
    const filtered = this.state.items.filter(e => {
      if (this.state.statusFilter !== 'all' && e.status !== this.state.statusFilter) return false;
      if (this.state.categoryFilter !== 'all' && e.category !== this.state.categoryFilter) return false;
      if (this.state.filter && !(e.title.toLowerCase().includes(this.state.filter) || (e.body || '').toLowerCase().includes(this.state.filter))) return false;
      return true;
    }).sort((a, b) => {
      // Order: published (newest first) → draft (recent first) → archived (newest first)
      const statusOrder = { published: 0, draft: 1, archived: 2 };
      const aS = statusOrder[a.status] ?? 3;
      const bS = statusOrder[b.status] ?? 3;
      if (aS !== bS) return aS - bS;
      const aTs = a.status === 'published' ? (a.published_at || a.created_at) : (a.updated_at || a.created_at);
      const bTs = b.status === 'published' ? (b.published_at || b.created_at) : (b.updated_at || b.created_at);
      return (bTs || 0) - (aTs || 0);
    });

    const listEl = document.getElementById('cl-list');
    if (filtered.length === 0) {
      listEl.innerHTML = `<div class="crud-list-empty">Keine Changelog-Einträge. Klicke „+ Neuer Eintrag".</div>`;
      return;
    }

    let html = '';
    for (const e of filtered) {
      const isActive = this.state.selectedId === e.id;
      const dateText = e.status === 'published' && e.published_at
        ? fmtDate(e.published_at)
        : `Entwurf seit ${fmtDate(e.updated_at || e.created_at)}`;
      const versionTag = e.version ? `<span class="badge badge-neutral" style="font-size:0.62rem;padding:0.1em 0.45em">v${escapeHtml(e.version)}</span>` : '';
      html += `
        <div class="crud-list-item ${isActive ? 'active' : ''}" data-id="${e.id}">
          <div class="crud-list-item-title">${escapeHtml(e.title)} ${versionTag}</div>
          <div class="crud-list-item-meta">
            <span class="status-pill ${e.status}">${escapeHtml(self.STATUS_LABELS[e.status] || e.status)}</span>
            <span class="visibility-badge ${e.public_visible ? 'public' : 'private'}">${e.public_visible ? 'Public' : 'Versteckt'}</span>
            <span>${escapeHtml(self.CATEGORY_LABELS[e.category] || e.category)}</span>
            <span style="color:var(--text-muted)">· ${escapeHtml(dateText)}</span>
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
    const editor = document.getElementById('cl-editor');
    const item = id ? this.state.items.find(e => e.id === id) : null;
    const isNew = !item;
    const isDraft = item?.status === 'draft';

    editor.innerHTML = `
      <h2 style="font-size:1.1rem;font-weight:700">${isNew ? 'Neuer Changelog-Eintrag' : 'Eintrag #' + id + ' bearbeiten'}</h2>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Kategorie</label>
          <select class="form-input" id="cl-edit-cat">
            ${self.CATEGORIES.map(c => `<option value="${c}" ${item?.category === c ? 'selected' : ''}>${self.CATEGORY_LABELS[c]}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Status</label>
          <select class="form-input" id="cl-edit-status">
            ${self.STATUSES.map(s => `<option value="${s}" ${(item?.status ?? 'draft') === s ? 'selected' : ''}>${self.STATUS_LABELS[s]}</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Titel</label>
        <input class="form-input" id="cl-edit-title" value="${escapeHtml(item?.title || '')}" maxlength="200" />
        <div class="form-help">Kurzer prägnanter Titel (max. 200 Zeichen)</div>
      </div>
      <div class="form-group">
        <label class="form-label">Version (optional)</label>
        <input class="form-input" id="cl-edit-version" value="${escapeHtml(item?.version || '')}" maxlength="50" placeholder="z.B. 1.2.3 oder Wipe-Update" />
      </div>
      <div class="form-group">
        <label class="form-label">Inhalt</label>
        <textarea class="form-textarea" id="cl-edit-body" rows="10" maxlength="8000">${escapeHtml(item?.body || '')}</textarea>
        <div class="form-help">Vollständiger Changelog-Text (max. 8000 Zeichen). Markdown wird im Public Dashboard nicht gerendert — nur Plain Text.</div>
      </div>
      <div class="form-group">
        <label class="form-checkbox-row">
          <input type="checkbox" id="cl-edit-public" ${item?.public_visible !== 0 ? 'checked' : ''} />
          <span>Öffentlich sichtbar (im Public Dashboard zeigen)</span>
        </label>
      </div>
      <div class="crud-actions">
        <button class="btn btn-primary" id="cl-save">${isNew ? 'Anlegen' : 'Speichern'}</button>
        <button class="btn btn-ghost" id="cl-preview">Vorschau</button>
        ${isDraft ? '<button class="btn btn-primary" id="cl-publish" style="background:var(--online);border-color:var(--online)">Veröffentlichen</button>' : ''}
        ${isNew ? '' : '<button class="btn btn-danger" id="cl-delete">Löschen</button>'}
        <button class="btn btn-ghost" id="cl-cancel">Abbrechen</button>
        <span style="flex:1"></span>
        <span class="form-help" style="margin:0">Änderungen werden im Audit-Log protokolliert.</span>
      </div>
    `;

    document.getElementById('cl-save').addEventListener('click', () => this.save(id));
    document.getElementById('cl-preview').addEventListener('click', () => this.preview());
    document.getElementById('cl-cancel').addEventListener('click', () => {
      this.state.selectedId = null;
      this.renderList();
      document.getElementById('cl-editor').innerHTML = '<div class="crud-editor-empty"><div class="empty-icon">≡</div><p>Wähle einen Eintrag zur Bearbeitung oder erstelle einen neuen.</p></div>';
    });
    if (!isNew) document.getElementById('cl-delete').addEventListener('click', () => this.delete(id));
    if (isDraft) document.getElementById('cl-publish').addEventListener('click', () => this.publish(id));
  },

  async save(id) {
    const body = {
      category: document.getElementById('cl-edit-cat').value,
      status: document.getElementById('cl-edit-status').value,
      title: document.getElementById('cl-edit-title').value.trim(),
      version: document.getElementById('cl-edit-version').value.trim() || null,
      body: document.getElementById('cl-edit-body').value.trim(),
      public_visible: document.getElementById('cl-edit-public').checked ? 1 : 0,
    };
    if (!body.title || !body.body) {
      toast('Titel und Inhalt sind Pflichtfelder.', 'error');
      return;
    }
    try {
      if (id) {
        await API.adminChangelog.update(id, body);
        toast('Eintrag aktualisiert.', 'success');
      } else {
        const res = await API.adminChangelog.create(body);
        toast('Eintrag angelegt.', 'success');
        this.state.selectedId = res.data?.id ?? null;
      }
      await this.loadAll();
      if (this.state.selectedId) this.openEditor(this.state.selectedId);
    } catch (err) {
      toast('Fehler: ' + (err.message || 'Speichern fehlgeschlagen'), 'error');
    }
  },

  async publish(id) {
    if (!confirm('Diesen Entwurf jetzt veröffentlichen? Er erscheint anschließend im Public Dashboard.')) return;
    try {
      await API.adminChangelog.publish(id, {});
      toast('Eintrag veröffentlicht.', 'success');
      await this.loadAll();
      this.openEditor(id);
    } catch (err) {
      toast('Fehler: ' + (err.message || 'Veröffentlichen fehlgeschlagen'), 'error');
    }
  },

  async delete(id) {
    if (!confirm('Diesen Changelog-Eintrag wirklich löschen?')) return;
    try {
      await API.adminChangelog.delete(id);
      toast('Eintrag gelöscht.', 'success');
      this.state.selectedId = null;
      await this.loadAll();
      document.getElementById('cl-editor').innerHTML = '<div class="crud-editor-empty"><div class="empty-icon">≡</div><p>Wähle einen Eintrag zur Bearbeitung oder erstelle einen neuen.</p></div>';
    } catch (err) {
      toast('Fehler: ' + (err.message || 'Löschen fehlgeschlagen'), 'error');
    }
  },

  preview() {
    const existing = document.getElementById('admin-changelog-preview');
    if (existing) existing.remove();

    const title = document.getElementById('cl-edit-title')?.value?.trim() || 'Ohne Titel';
    const category = document.getElementById('cl-edit-cat')?.value || 'server';
    const version = document.getElementById('cl-edit-version')?.value?.trim();
    const body = document.getElementById('cl-edit-body')?.value?.trim() || '';

    const overlay = document.createElement('div');
    overlay.id = 'admin-changelog-preview';
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <div class="modal">
        <div class="modal-header">
          <div>
            <div class="kicker">${escapeHtml(this.CATEGORY_LABELS[category] || category)}</div>
            <div class="modal-title">${escapeHtml(title)}</div>
          </div>
          <button class="modal-close" type="button" data-close-modal>✕</button>
        </div>
        <div class="cta-row" style="margin-top:0;margin-bottom:1rem">
          ${version ? `<span class="badge badge-neutral">v${escapeHtml(version)}</span>` : ''}
          <span class="badge badge-accent">Vorschau</span>
        </div>
        <div class="modal-field-value">${formatChangelogPreview(body)}</div>
      </div>
    `;

    document.body.appendChild(overlay);
    overlay.addEventListener('click', event => {
      if (event.target === overlay || event.target.closest('[data-close-modal]')) overlay.remove();
    });
  },
};

function formatChangelogPreview(text) {
  const source = String(text ?? '').trim();
  if (!source) return '<p>Kein Inhalt hinterlegt.</p>';

  return source
    .split(/\n\s*\n/)
    .map(block => block.trim())
    .filter(Boolean)
    .map(block => {
      const lines = block.split(/\n+/).map(line => line.trim()).filter(Boolean);
      if (!lines.length) return '';
      const bulletLines = lines.filter(line => /^([-•*]|\d+[.)])\s+/.test(line));
      if (bulletLines.length === lines.length) {
        const ordered = /^\d+[.)]\s+/.test(lines[0]);
        const tag = ordered ? 'ol' : 'ul';
        return `<${tag}>${lines.map(line => `<li>${escapeHtml(line.replace(/^([-•*]|\d+[.)])\s+/, ''))}</li>`).join('')}</${tag}>`;
      }
      return `<p>${lines.map(line => escapeHtml(line)).join('<br>')}</p>`;
    })
    .join('');
}
