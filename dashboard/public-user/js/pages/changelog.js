window['page-changelog'] = {
  activeFilter: 'all',
  entries: [],

  async render(container) {
    container.innerHTML = pageHeader('Changelog', 'Öffentliche Updates', 'Server-, Discord-, Regel-, Event- und Botupdates für die Community.') + `
      <div class="tab-bar" id="changelog-tabs">
        ${['all','server','discord','regeln','events','bot'].map(id => `<button class="tab-btn${id === 'all' ? ' active' : ''}" data-filter="${id}">${id === 'all' ? 'Alle' : id}</button>`).join('')}
      </div>
      <div id="changelog-content"></div>
    `;
    const root = document.getElementById('changelog-content');
    try {
      const { data } = await API.changelog();
      this.entries = [...(data.changelog ?? [])].sort((a, b) => (b.publishedAt ?? 0) - (a.publishedAt ?? 0));
      const render = () => {
        const entries = this.entries.filter(item => this.activeFilter === 'all' || normalizeCategory(item.category) === this.activeFilter);
        root.innerHTML = entries.length ? `
          <section class="timeline-card changelog-feed">${entries.map(item => renderChangelogItem(item)).join('')}</section>
        ` : `
          <section class="card">
            ${emptyState('Noch keine öffentlichen Updates veröffentlicht.', 'Persistente Changelog-Einträge existieren aktuell nicht.')}
            ${data.discordUrl ? `<div class="cta-row centered"><a class="btn btn-primary" target="_blank" rel="noreferrer" href="${escapeHtml(data.discordUrl)}">Changelog im Discord öffnen</a></div>` : ''}
          </section>
        `;

        root.querySelectorAll('[data-changelog-open]').forEach(button => {
          button.addEventListener('click', () => {
            const entry = this.entries.find(item => item.id === Number(button.dataset.changelogOpen));
            if (entry) openChangelogModal(entry, data.discordUrl);
          });
        });
      };
      document.getElementById('changelog-tabs').addEventListener('click', e => {
        const btn = e.target.closest('.tab-btn');
        if (!btn) return;
        this.activeFilter = btn.dataset.filter;
        document.querySelectorAll('#changelog-tabs .tab-btn').forEach(b => b.classList.toggle('active', b === btn));
        render();
      });
      render();
    } catch {
      root.innerHTML = errorState();
    }
  },
};

function renderChangelogItem(item) {
  const category = normalizeCategory(item.category);
  return `
    <article class="timeline-item timeline-item-interactive" role="button" tabindex="0" data-changelog-open="${item.id}">
      <div class="timeline-item-top">
        <span class="badge badge-accent">${escapeHtml(categoryLabel(category))}</span>
        ${item.version ? `<span class="rules-meta-chip">v${escapeHtml(item.version)}</span>` : ''}
      </div>
      <strong>${escapeHtml(item.title)}</strong>
      <small>${fmtDate(item.publishedAt)}</small>
      <p>${escapeHtml(summarizeText(item.body))}</p>
      <div class="cta-row"><button class="btn btn-ghost" type="button" data-changelog-open="${item.id}">Mehr lesen</button></div>
    </article>
  `;
}

function openChangelogModal(item, discordUrl) {
  const existing = document.getElementById('public-changelog-modal');
  if (existing) existing.remove();

  const overlay = document.createElement('div');
  overlay.id = 'public-changelog-modal';
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal changelog-modal">
      <div class="modal-header">
        <div>
          <div class="kicker">${escapeHtml(categoryLabel(normalizeCategory(item.category)))}</div>
          <div class="modal-title">${escapeHtml(item.title)}</div>
        </div>
        <button class="modal-close" type="button" data-close-modal>✕</button>
      </div>
      <div class="changelog-modal-meta">
        <span class="rules-meta-chip">${escapeHtml(fmtDate(item.publishedAt))}</span>
        ${item.version ? `<span class="rules-meta-chip">Version ${escapeHtml(item.version)}</span>` : ''}
        ${discordUrl ? `<a class="btn btn-ghost" target="_blank" rel="noreferrer" href="${escapeHtml(discordUrl)}">Im Discord öffnen</a>` : ''}
      </div>
      <div class="rule-copy changelog-detail-copy">${formatChangelogBody(item.body)}</div>
    </div>
  `;

  document.body.appendChild(overlay);
  overlay.addEventListener('click', event => {
    if (event.target === overlay || event.target.closest('[data-close-modal]')) overlay.remove();
  });
}

function normalizeCategory(category) {
  const value = String(category ?? '').toLowerCase();
  return value === 'rules' ? 'regeln' : value;
}

function categoryLabel(category) {
  return category === 'regeln' ? 'Regeln' : category.charAt(0).toUpperCase() + category.slice(1);
}

function summarizeText(text) {
  const value = String(text ?? '').replace(/\s+/g, ' ').trim();
  if (!value) return 'Kein Detailtext hinterlegt.';
  return value.length > 180 ? value.slice(0, 177) + '…' : value;
}

function formatChangelogBody(text) {
  const source = String(text ?? '').trim();
  if (!source) return '<p>Kein Detailtext hinterlegt.</p>';

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
