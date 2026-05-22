window['page-rules'] = {
  async render(container) {
    container.innerHTML = pageHeader('Regelwerk', 'Serverregeln', 'Strukturiertes Regelwerk für SECTOR 13 Spieler.') + `
      <div class="filter-bar rules-tools">
        <input id="rules-search" class="form-input" placeholder="Regeln durchsuchen..." type="search">
        <div class="rules-tools-meta">
          <div id="rules-last-updated" class="rules-meta-chip hidden"></div>
          <a id="rules-discord-link" class="btn btn-ghost hidden" target="_blank" rel="noreferrer">Im Discord öffnen</a>
        </div>
      </div>
      <div id="rules-content"></div>
    `;
    const root = document.getElementById('rules-content');
    try {
      const { data } = await API.rules();
      const link = document.getElementById('rules-discord-link');
      const updated = document.getElementById('rules-last-updated');
      if (data.discordUrl) {
        link.href = data.discordUrl;
        link.classList.remove('hidden');
      }
      if (data.lastUpdated) {
        updated.textContent = `Letzte Pflege: ${fmtDate(data.lastUpdated)}`;
        updated.classList.remove('hidden');
      }
      const render = (query = '') => {
        const q = query.toLowerCase();
        const categories = (data.categories ?? []).map(cat => ({
          ...cat,
          rules: cat.rules.filter(rule => !q || `${cat.title} ${rule}`.toLowerCase().includes(q)),
        })).filter(cat => cat.rules.length);
        root.innerHTML = categories.length ? `<div class="rules-layout">${categories.map(renderRuleCategory).join('')}</div>` : emptyState('Keine passenden Regeln gefunden.');
      };
      document.getElementById('rules-search').addEventListener('input', e => render(e.target.value));
      render();
    } catch {
      root.innerHTML = errorState();
    }
  },
};

function renderRuleCategory(category) {
  return `
    <section class="rule-category-card">
      <div class="rule-category-head">
        <div>
          <div class="kicker">Kategorie</div>
          <h3>${escapeHtml(category.title)}</h3>
        </div>
        <strong>${category.rules.length} Regeln</strong>
      </div>
      <div class="rule-list">
        ${category.rules.map((rule, index) => `
          <article class="rule-item">
            <div class="rule-item-index">${String(index + 1).padStart(2, '0')}</div>
            <div class="rule-copy">${formatRuleCopy(rule)}</div>
          </article>
        `).join('')}
      </div>
    </section>
  `;
}

function formatRuleCopy(text) {
  const source = String(text ?? '').trim();
  if (!source) return '<p>—</p>';

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
