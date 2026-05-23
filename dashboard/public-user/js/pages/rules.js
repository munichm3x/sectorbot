window['page-rules'] = {
  _categories: [],
  _query: '',
  _collapsed: {},

  async render(container) {
    container.innerHTML =
      pageHeader('Regelwerk', 'SECTOR 13 Regelwerk', 'Alle gültigen Regeln. Bei Fragen öffne ein Support-Ticket.') +
      `<div style="margin-bottom:1.25rem">
        <input class="form-input" type="search" id="rules-q" placeholder="Regeln durchsuchen…"
          style="max-width:380px;background:var(--surface);border:1px solid var(--border);
                 border-radius:var(--radius);padding:0.55rem 0.9rem;color:var(--text);width:100%;" />
      </div>
      <div id="rules-content">${loadingState()}</div>`;

    document.getElementById('rules-q').addEventListener('input', (e) => {
      this._query = e.target.value.trim().toLowerCase();
      this.renderList();
    });

    await this.load();
  },

  async load() {
    const root = document.getElementById('rules-content');
    try {
      const { data } = await API.rules();
      this._categories = Array.isArray(data?.categories) ? data.categories
        : Array.isArray(data) ? data : [];
      this.renderList();
    } catch {
      root.innerHTML = errorState('Regelwerk konnte nicht geladen werden.');
    }
  },

  renderList() {
    const root = document.getElementById('rules-content');
    if (!root) return;
    const q = this._query;

    if (!this._categories.length) {
      root.innerHTML = emptyState('Noch keine Regeln veröffentlicht.');
      return;
    }

    if (q) {
      const matches = [];
      for (const cat of this._categories) {
        for (const rule of (cat.rules || [])) {
          const hay = [rule.title, rule.name, rule.body, rule.content, rule.description]
            .filter(Boolean).join(' ').toLowerCase();
          if (hay.includes(q)) {
            matches.push({ ...rule, _catEmoji: cat.emoji || '', _catName: cat.name || cat.label || '' });
          }
        }
      }
      if (!matches.length) {
        root.innerHTML = emptyState('Keine Regeln gefunden.', `Keine Treffer für „${q}".`);
        return;
      }
      root.innerHTML = matches.map((r, i) => this.renderRuleItem(r, i + 1, true)).join('');
      return;
    }

    root.innerHTML = this._categories.map(cat => this.renderCategory(cat)).join('');

    root.querySelectorAll('.rule-category-header').forEach(hdr => {
      hdr.addEventListener('click', () => {
        const key = hdr.dataset.catKey;
        this._collapsed[key] = !this._collapsed[key];
        hdr.classList.toggle('collapsed', !!this._collapsed[key]);
        const body = hdr.nextElementSibling;
        if (body) body.classList.toggle('collapsed', !!this._collapsed[key]);
      });
    });
  },

  renderCategory(cat) {
    const key = String(cat.key || cat.id || cat.name || Math.random());
    const collapsed = !!this._collapsed[key];
    const rules = cat.rules || [];
    return `
      <div class="rule-category">
        <div class="rule-category-header${collapsed ? ' collapsed' : ''}" data-cat-key="${escapeHtml(key)}">
          <div class="rule-category-icon">${escapeHtml(cat.emoji || '📋')}</div>
          <div class="rule-category-info">
            <div class="rule-category-name">${escapeHtml(cat.name || cat.label || key)}</div>
            <div class="rule-category-count">${rules.length} Regel${rules.length !== 1 ? 'n' : ''}</div>
          </div>
          <div class="rule-category-chevron">▼</div>
        </div>
        <div class="rule-category-body${collapsed ? ' collapsed' : ''}">
          ${rules.length
            ? rules.map((r, i) => this.renderRuleItem(r, i + 1, false)).join('')
            : `<div class="card" style="padding:0.75rem 1rem;color:var(--text-muted);font-size:0.82rem">Keine Regeln in dieser Kategorie.</div>`}
        </div>
      </div>
    `;
  },

  renderRuleItem(rule, num, showCat) {
    const title  = rule.title || rule.name || '';
    const body   = rule.body || rule.content || rule.description || '';
    const catTag = showCat && rule._catName
      ? `<span style="font-size:0.62rem;background:var(--surface-raised);border:1px solid var(--border);border-radius:3px;padding:0.12em 0.45em;color:var(--text-muted);margin-left:0.4rem">${escapeHtml(rule._catEmoji)} ${escapeHtml(rule._catName)}</span>`
      : '';
    return `
      <div class="rule-item">
        <div class="rule-item-header">
          <span class="rule-number">#${num}</span>
          <span class="rule-title">${escapeHtml(title)}${catTag}</span>
        </div>
        ${body ? `<div class="rule-body">${this.formatBody(body)}</div>` : ''}
      </div>
    `;
  },

  formatBody(text) {
    const esc   = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const lines = esc.split('\n').filter(l => l.trim() !== '');
    const html  = [];
    let listType = null;

    for (const line of lines) {
      const isBullet  = /^[-*•]\s/.test(line);
      const isNumered = /^\d+\.\s/.test(line);
      const type      = isBullet ? 'ul' : isNumered ? 'ol' : null;

      if (type) {
        if (listType !== type) {
          if (listType) html.push(`</${listType}>`);
          html.push(`<${type}>`);
          listType = type;
        }
        html.push(`<li>${line.replace(/^[-*•]\s|^\d+\.\s/, '')}</li>`);
      } else {
        if (listType) { html.push(`</${listType}>`); listType = null; }
        html.push(`<p>${line}</p>`);
      }
    }
    if (listType) html.push(`</${listType}>`);
    return html.join('');
  },
};
