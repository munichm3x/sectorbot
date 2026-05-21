// dashboard/public/js/pages/admin-rules.js
window['page-admin-rules'] = {
  state: {
    items: [],
    selectedId: null,
    filter: '',
    categoryFilter: 'all',
  },

  CATEGORIES: [
    'general','teams','solo','pvp','vehicles','bases','permadeath','whitelist','discord-support','events'
  ],

  CATEGORY_LABELS: {
    'general': 'Allgemeines Verhalten',
    'teams': 'Teams & Gruppierungen',
    'solo': 'Einzelkämpfer / Orange Solo',
    'pvp': 'PvP-Regeln',
    'vehicles': 'Fahrzeuge & Limits',
    'bases': 'Base-Regeln',
    'permadeath': 'Permadeath',
    'whitelist': 'Whitelist & Verifizierung',
    'discord-support': 'Discord & Support',
    'events': 'Events',
  },

  async render(container) {
    const self = this;
    container.innerHTML = `
      <div class="page-header">
        <h1>Regelwerk verwalten</h1>
        <p>Regeln erstellen, bearbeiten und Reihenfolge anpassen. Sichtbare Regeln werden im Public Dashboard angezeigt.</p>
      </div>
      <div class="crud-toolbar">
        <input id="r-search" class="form-input" placeholder="Suche Regeln…" value="${escapeHtml(self.state.filter)}" />
        <select id="r-cat-filter" class="filter-select">
          <option value="all">Alle Kategorien</option>
          ${self.CATEGORIES.map(c => `<option value="${c}" ${self.state.categoryFilter === c ? 'selected' : ''}>${escapeHtml(self.CATEGORY_LABELS[c] || c)}</option>`).join('')}
        </select>
        <button id="r-new" class="btn btn-primary">+ Neue Regel</button>
      </div>
      <div class="crud-layout">
        <div class="crud-list" id="r-list"><div class="skeleton" style="height:60px;margin:0.75rem"></div></div>
        <div class="crud-editor" id="r-editor">
          <div class="crud-editor-empty">
            <div class="empty-icon">⬡</div>
            <p>Wähle eine Regel zur Bearbeitung oder erstelle eine neue.</p>
          </div>
        </div>
      </div>
    `;

    document.getElementById('r-search').addEventListener('input', (e) => {
      self.state.filter = e.target.value.toLowerCase();
      self.renderList();
    });
    document.getElementById('r-cat-filter').addEventListener('change', (e) => {
      self.state.categoryFilter = e.target.value;
      self.renderList();
    });
    document.getElementById('r-new').addEventListener('click', () => self.openEditor(null));

    await self.loadAll();
  },

  async loadAll() {
    try {
      const { data } = await API.adminRules.list();
      this.state.items = data || [];
      this.renderList();
    } catch (err) {
      const listEl = document.getElementById('r-list');
      if (listEl) listEl.innerHTML = `<div class="crud-list-empty">Fehler: ${escapeHtml(err.message || 'Laden fehlgeschlagen')}</div>`;
    }
  },

  renderList() {
    const listEl = document.getElementById('r-list');
    if (!listEl) return;

    const filtered = this.state.items.filter(r => {
      if (this.state.categoryFilter !== 'all' && r.category !== this.state.categoryFilter) return false;
      if (this.state.filter && !(
        (r.title || '').toLowerCase().includes(this.state.filter) ||
        (r.body || '').toLowerCase().includes(this.state.filter)
      )) return false;
      return true;
    }).sort((a, b) => {
      if (a.category !== b.category) return a.category.localeCompare(b.category);
      return (a.sort_order ?? 0) - (b.sort_order ?? 0);
    });

    if (filtered.length === 0) {
      listEl.innerHTML = `<div class="crud-list-empty">Keine Regeln. Klicke „+ Neue Regel".</div>`;
      return;
    }

    let html = '';
    let currentCat = null;
    for (let i = 0; i < filtered.length; i++) {
      const r = filtered[i];
      if (r.category !== currentCat) {
        html += `<div class="nav-section" style="padding:0.6rem 1rem 0.2rem;font-size:0.72rem;font-weight:600;text-transform:uppercase;color:var(--text-muted,#888)">${escapeHtml(this.CATEGORY_LABELS[r.category] || r.category)}</div>`;
        currentCat = r.category;
      }
      const isActive = this.state.selectedId === r.id;
      const sameCategory = filtered.filter(x => x.category === r.category);
      const indexInCat = sameCategory.findIndex(x => x.id === r.id);
      const canMoveUp = indexInCat > 0;
      const canMoveDown = indexInCat < sameCategory.length - 1;
      html += `
        <div class="crud-list-item ${isActive ? 'active' : ''}" data-id="${r.id}">
          <div class="crud-list-item-title">${escapeHtml(r.title)}</div>
          <div class="crud-list-item-meta">
            <span class="visibility-badge ${r.public_visible ? 'public' : 'private'}">${r.public_visible ? 'Public' : 'Versteckt'}</span>
            <button class="reorder-btn" data-act="up" data-id="${r.id}" ${canMoveUp ? '' : 'disabled'} title="Nach oben">↑</button>
            <button class="reorder-btn" data-act="down" data-id="${r.id}" ${canMoveDown ? '' : 'disabled'} title="Nach unten">↓</button>
          </div>
        </div>
      `;
    }
    listEl.innerHTML = html;

    listEl.querySelectorAll('.crud-list-item').forEach(el => {
      el.addEventListener('click', (e) => {
        if (e.target.closest('.reorder-btn')) return;
        this.openEditor(Number(el.dataset.id));
      });
    });
    listEl.querySelectorAll('.reorder-btn').forEach(el => {
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        this.handleReorder(Number(el.dataset.id), el.dataset.act);
      });
    });
  },

  openEditor(id) {
    this.state.selectedId = id;
    this.renderList();
    const editor = document.getElementById('r-editor');
    if (!editor) return;
    const item = id ? this.state.items.find(r => r.id === id) : null;
    const isNew = !item;
    editor.innerHTML = `
      <h2 style="font-size:1.1rem;font-weight:700;margin-bottom:1rem">${isNew ? 'Neue Regel' : 'Regel #' + escapeHtml(String(id)) + ' bearbeiten'}</h2>
      <div class="form-group">
        <label class="form-label">Kategorie</label>
        <select class="form-input" id="r-edit-cat">
          ${this.CATEGORIES.map(c => `<option value="${c}" ${item?.category === c ? 'selected' : ''}>${escapeHtml(this.CATEGORY_LABELS[c] || c)}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">Titel</label>
        <input class="form-input" id="r-edit-title" value="${escapeHtml(item?.title || '')}" maxlength="200" placeholder="Kurzer Titel der Regel" />
        <div class="form-help">Kurzer Titel (max. 200 Zeichen)</div>
      </div>
      <div class="form-group">
        <label class="form-label">Regeltext</label>
        <textarea class="form-textarea" id="r-edit-body" rows="6" maxlength="4000" placeholder="Vollständiger Regeltext…">${escapeHtml(item?.body || '')}</textarea>
        <div class="form-help">Vollständiger Regeltext (max. 4000 Zeichen). Wird im Public Dashboard angezeigt.</div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Sortierung</label>
          <input class="form-input" id="r-edit-sort" type="number" value="${item?.sort_order ?? 0}" min="0" />
        </div>
        <div class="form-group">
          <label class="form-label">Sichtbarkeit</label>
          <label class="form-checkbox-row">
            <input type="checkbox" id="r-edit-public" ${(item?.public_visible !== 0 && item?.public_visible !== false) || isNew ? 'checked' : ''} />
            <span>Öffentlich sichtbar (im Public Dashboard zeigen)</span>
          </label>
        </div>
      </div>
      <div class="crud-actions">
        <button class="btn btn-primary" id="r-save">${isNew ? 'Anlegen' : 'Speichern'}</button>
        ${isNew ? '' : '<button class="btn btn-danger" id="r-delete">Löschen</button>'}
        <button class="btn btn-ghost" id="r-cancel">Abbrechen</button>
        <span style="flex:1"></span>
        <span class="form-help" style="margin:0">Änderungen werden im Audit-Log protokolliert.</span>
      </div>
    `;
    document.getElementById('r-save').addEventListener('click', () => this.save(id));
    document.getElementById('r-cancel').addEventListener('click', () => this.closeEditor());
    if (!isNew) document.getElementById('r-delete').addEventListener('click', () => this.delete(id));
  },

  closeEditor() {
    this.state.selectedId = null;
    this.renderList();
    const editor = document.getElementById('r-editor');
    if (editor) editor.innerHTML = '<div class="crud-editor-empty"><div class="empty-icon">⬡</div><p>Wähle eine Regel zur Bearbeitung oder erstelle eine neue.</p></div>';
  },

  async save(id) {
    const body = {
      category: document.getElementById('r-edit-cat').value,
      title: document.getElementById('r-edit-title').value.trim(),
      body: document.getElementById('r-edit-body').value.trim(),
      sort_order: Number(document.getElementById('r-edit-sort').value) || 0,
      public_visible: document.getElementById('r-edit-public').checked ? 1 : 0,
    };
    if (!body.title || !body.body) { toast('Titel und Regeltext sind Pflichtfelder.', 'error'); return; }
    try {
      if (id) {
        await API.adminRules.update(id, body);
        toast('Regel aktualisiert.', 'success');
      } else {
        const res = await API.adminRules.create(body);
        toast('Regel angelegt.', 'success');
        this.state.selectedId = res.data?.id ?? null;
      }
      await this.loadAll();
      if (this.state.selectedId) this.openEditor(this.state.selectedId);
    } catch (err) {
      toast('Fehler: ' + (err.message || 'Speichern fehlgeschlagen'), 'error');
    }
  },

  async delete(id) {
    if (!confirm('Diese Regel wirklich löschen?')) return;
    try {
      await API.adminRules.delete(id);
      toast('Regel gelöscht.', 'success');
      this.state.selectedId = null;
      await this.loadAll();
      this.closeEditor();
    } catch (err) {
      toast('Fehler: ' + (err.message || 'Löschen fehlgeschlagen'), 'error');
    }
  },

  async handleReorder(id, direction) {
    const item = this.state.items.find(r => r.id === id);
    if (!item) return;
    const sameCategory = this.state.items
      .filter(r => r.category === item.category)
      .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
    const idx = sameCategory.findIndex(r => r.id === id);
    const newIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (newIdx < 0 || newIdx >= sameCategory.length) return;
    const reordered = [...sameCategory];
    [reordered[idx], reordered[newIdx]] = [reordered[newIdx], reordered[idx]];
    try {
      await API.adminRules.reorder({ category: item.category, orderedIds: reordered.map(r => r.id) });
      await this.loadAll();
    } catch (err) {
      toast('Reihenfolge konnte nicht aktualisiert werden.', 'error');
    }
  },
};
