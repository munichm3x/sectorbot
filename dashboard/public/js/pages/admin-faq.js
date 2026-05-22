// dashboard/public/js/pages/admin-faq.js
window['page-admin-faq'] = {
  state: {
    items: [],
    selectedId: null,
    filter: '',
    categoryFilter: 'all',
  },

  async render(container) {
    const self = this;
    container.innerHTML = `
      <div class="page-header">
        <h1>FAQ verwalten</h1>
        <p>Häufige Fragen erstellen und kategorisieren. Sichtbare FAQ-Einträge erscheinen im Public Dashboard unter „Support".</p>
      </div>
      <div class="crud-toolbar">
        <input id="faq-search" class="form-input" placeholder="Suche FAQ…" />
        <select id="faq-cat-filter" class="filter-select">
          <option value="all">Alle Kategorien</option>
        </select>
        <button id="faq-new" class="btn btn-primary">+ Neue Frage</button>
      </div>
      <div class="crud-layout">
        <div class="crud-list" id="faq-list"><div class="skeleton" style="height:60px;margin:0.75rem"></div></div>
        <div class="crud-editor" id="faq-editor">
          <div class="crud-editor-empty">
            <div class="empty-icon">?</div>
            <p>Wähle eine Frage zur Bearbeitung oder erstelle eine neue.</p>
          </div>
        </div>
      </div>
    `;

    document.getElementById('faq-search').addEventListener('input', (e) => {
      self.state.filter = e.target.value.toLowerCase();
      self.renderList();
    });
    document.getElementById('faq-cat-filter').addEventListener('change', (e) => {
      self.state.categoryFilter = e.target.value;
      self.renderList();
    });
    document.getElementById('faq-new').addEventListener('click', () => self.openEditor(null));

    await self.loadAll();
  },

  async loadAll() {
    try {
      const { data } = await API.adminFaq.list();
      this.state.items = data || [];
      this.populateCategoryFilter();
      this.renderList();
    } catch (err) {
      document.getElementById('faq-list').innerHTML = `<div class="crud-list-empty">Fehler: ${escapeHtml(err.message || 'Laden fehlgeschlagen')}</div>`;
    }
  },

  populateCategoryFilter() {
    const cats = Array.from(new Set(this.state.items.map(i => i.category))).sort();
    const sel = document.getElementById('faq-cat-filter');
    if (!sel) return;
    const current = sel.value;
    sel.innerHTML = '<option value="all">Alle Kategorien</option>' +
      cats.map(c => `<option value="${escapeHtml(c)}" ${current === c ? 'selected' : ''}>${escapeHtml(c)}</option>`).join('');
  },

  renderList() {
    const filtered = this.state.items.filter(f => {
      if (this.state.categoryFilter !== 'all' && f.category !== this.state.categoryFilter) return false;
      if (this.state.filter && !(f.question.toLowerCase().includes(this.state.filter) || (f.answer || '').toLowerCase().includes(this.state.filter))) return false;
      return true;
    }).sort((a, b) => {
      if (a.category !== b.category) return a.category.localeCompare(b.category);
      return a.sort_order - b.sort_order;
    });

    const listEl = document.getElementById('faq-list');
    if (filtered.length === 0) {
      listEl.innerHTML = `<div class="crud-list-empty">Keine FAQ-Einträge. Klicke „+ Neue Frage".</div>`;
      return;
    }

    let html = '';
    let currentCat = null;
    for (const f of filtered) {
      if (f.category !== currentCat) {
        html += `<div class="nav-section" style="padding:0.6rem 1rem 0.2rem">${escapeHtml(f.category)}</div>`;
        currentCat = f.category;
      }
      const isActive = this.state.selectedId === f.id;
      const sameCategory = filtered.filter(x => x.category === f.category);
      const indexInCat = sameCategory.findIndex(x => x.id === f.id);
      const canMoveUp = indexInCat > 0;
      const canMoveDown = indexInCat < sameCategory.length - 1;
      html += `
        <div class="crud-list-item ${isActive ? 'active' : ''}" data-id="${f.id}">
          <div class="crud-list-item-title">${escapeHtml(f.question)}</div>
          <div class="crud-list-item-meta">
            <span class="visibility-badge ${f.public_visible ? 'public' : 'private'}">${f.public_visible ? 'Public' : 'Versteckt'}</span>
            <button class="reorder-btn" data-act="up" data-id="${f.id}" ${canMoveUp ? '' : 'disabled'}>↑</button>
            <button class="reorder-btn" data-act="down" data-id="${f.id}" ${canMoveDown ? '' : 'disabled'}>↓</button>
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
    const editor = document.getElementById('faq-editor');
    const item = id ? this.state.items.find(f => f.id === id) : null;
    const isNew = !item;
    const existingCats = Array.from(new Set(this.state.items.map(i => i.category))).sort();

    editor.innerHTML = `
      <h2 style="font-size:1.1rem;font-weight:700">${isNew ? 'Neue FAQ' : 'FAQ #' + id + ' bearbeiten'}</h2>
      <div class="form-group">
        <label class="form-label">Kategorie</label>
        <input class="form-input" id="faq-edit-cat" value="${escapeHtml(item?.category || existingCats[0] || 'Allgemein')}" maxlength="50" list="faq-cat-list" />
        <datalist id="faq-cat-list">
          ${existingCats.map(c => `<option value="${escapeHtml(c)}"></option>`).join('')}
          <option value="Server"></option>
          <option value="Whitelist"></option>
          <option value="Regeln"></option>
          <option value="Support"></option>
          <option value="Discord"></option>
          <option value="Community"></option>
        </datalist>
        <div class="form-help">Beliebige Kategorie wählen oder neu eingeben (max. 50 Zeichen)</div>
      </div>
      <div class="form-group">
        <label class="form-label">Frage</label>
        <input class="form-input" id="faq-edit-q" value="${escapeHtml(item?.question || '')}" maxlength="300" />
      </div>
      <div class="form-group">
        <label class="form-label">Antwort</label>
        <textarea class="form-textarea" id="faq-edit-a" rows="6" maxlength="2000">${escapeHtml(item?.answer || '')}</textarea>
        <div class="form-help">Max. 2000 Zeichen</div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Sortierung</label>
          <input class="form-input" id="faq-edit-sort" type="number" value="${item?.sort_order ?? 0}" min="0" />
        </div>
        <div class="form-group">
          <label class="form-label">Sichtbarkeit</label>
          <label class="form-checkbox-row">
            <input type="checkbox" id="faq-edit-public" ${item?.public_visible !== 0 ? 'checked' : ''} />
            <span>Öffentlich sichtbar</span>
          </label>
        </div>
      </div>
      <div class="crud-actions">
        <button class="btn btn-primary" id="faq-save">${isNew ? 'Anlegen' : 'Speichern'}</button>
        ${isNew ? '' : '<button class="btn btn-danger" id="faq-delete">Löschen</button>'}
        <button class="btn btn-ghost" id="faq-cancel">Abbrechen</button>
        <span style="flex:1"></span>
        <span class="form-help" style="margin:0">Änderungen werden im Audit-Log protokolliert.</span>
      </div>
    `;

    document.getElementById('faq-save').addEventListener('click', () => this.save(id));
    document.getElementById('faq-cancel').addEventListener('click', () => {
      this.state.selectedId = null;
      this.renderList();
      document.getElementById('faq-editor').innerHTML = '<div class="crud-editor-empty"><div class="empty-icon">?</div><p>Wähle eine Frage zur Bearbeitung oder erstelle eine neue.</p></div>';
    });
    if (!isNew) document.getElementById('faq-delete').addEventListener('click', () => this.delete(id));
  },

  async save(id) {
    const body = {
      category: document.getElementById('faq-edit-cat').value.trim(),
      question: document.getElementById('faq-edit-q').value.trim(),
      answer: document.getElementById('faq-edit-a').value.trim(),
      sort_order: Number(document.getElementById('faq-edit-sort').value) || 0,
      public_visible: document.getElementById('faq-edit-public').checked ? 1 : 0,
    };
    if (!body.category || !body.question || !body.answer) {
      toast('Kategorie, Frage und Antwort sind Pflichtfelder.', 'error');
      return;
    }
    try {
      if (id) {
        await API.adminFaq.update(id, body);
        toast('FAQ aktualisiert.', 'success');
      } else {
        const res = await API.adminFaq.create(body);
        toast('FAQ angelegt.', 'success');
        this.state.selectedId = res.data?.id ?? null;
      }
      await this.loadAll();
      if (this.state.selectedId) this.openEditor(this.state.selectedId);
    } catch (err) {
      toast('Fehler: ' + (err.message || 'Speichern fehlgeschlagen'), 'error');
    }
  },

  async delete(id) {
    if (!confirm('Diese FAQ wirklich löschen?')) return;
    try {
      await API.adminFaq.delete(id);
      toast('FAQ gelöscht.', 'success');
      this.state.selectedId = null;
      await this.loadAll();
      document.getElementById('faq-editor').innerHTML = '<div class="crud-editor-empty"><div class="empty-icon">?</div><p>Wähle eine Frage zur Bearbeitung oder erstelle eine neue.</p></div>';
    } catch (err) {
      toast('Fehler: ' + (err.message || 'Löschen fehlgeschlagen'), 'error');
    }
  },

  async handleReorder(id, direction) {
    const item = this.state.items.find(f => f.id === id);
    if (!item) return;
    const sameCategory = this.state.items
      .filter(f => f.category === item.category)
      .sort((a, b) => a.sort_order - b.sort_order);
    const idx = sameCategory.findIndex(f => f.id === id);
    const newIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (newIdx < 0 || newIdx >= sameCategory.length) return;
    const reordered = [...sameCategory];
    [reordered[idx], reordered[newIdx]] = [reordered[newIdx], reordered[idx]];
    try {
      await API.adminFaq.reorder({ category: item.category, orderedIds: reordered.map(f => f.id) });
      await this.loadAll();
    } catch (err) {
      toast('Reihenfolge konnte nicht aktualisiert werden.', 'error');
    }
  },
};
