window['page-rules'] = {
  async render(container) {
    container.innerHTML = pageHeader('Regelwerk', 'Serverregeln', 'Strukturiertes Regelwerk für SECTOR 13 Spieler.') + `
      <div class="filter-bar rules-tools">
        <input id="rules-search" class="form-input" placeholder="Regeln durchsuchen..." type="search">
        <a id="rules-discord-link" class="btn btn-ghost hidden" target="_blank" rel="noreferrer">Im Discord öffnen</a>
      </div>
      <div id="rules-content"></div>
    `;
    const root = document.getElementById('rules-content');
    try {
      const { data } = await API.rules();
      const link = document.getElementById('rules-discord-link');
      if (data.discordUrl) {
        link.href = data.discordUrl;
        link.classList.remove('hidden');
      }
      const render = (query = '') => {
        const q = query.toLowerCase();
        const categories = (data.categories ?? []).map(cat => ({
          ...cat,
          rules: cat.rules.filter(rule => !q || `${cat.title} ${rule}`.toLowerCase().includes(q)),
        })).filter(cat => cat.rules.length);
        root.innerHTML = categories.length ? categories.map(renderRuleCategory).join('') : emptyState('Keine passenden Regeln gefunden.');
        root.querySelectorAll('.accordion-head').forEach(btn => {
          btn.addEventListener('click', () => btn.parentElement.classList.toggle('open'));
        });
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
    <section class="accordion-card open">
      <button class="accordion-head"><span>${escapeHtml(category.title)}</span><strong>${category.rules.length}</strong></button>
      <div class="accordion-body">
        ${category.rules.map(rule => `<p>${escapeHtml(rule)}</p>`).join('')}
      </div>
    </section>
  `;
}
