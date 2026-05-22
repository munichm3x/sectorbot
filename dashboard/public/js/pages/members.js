// dashboard/public/js/pages/members.js
window['page-members'] = {
  search: '',
  async render(container) {
    const self = this;
    container.innerHTML = `
      <div class="page-header"><h1>Mitglieder</h1><p>Mitgliederliste — keine Aktivitätsranglisten, nur Verwaltungsdaten.</p></div>
      <div class="filter-bar" style="margin-bottom:1rem">
        <input class="form-input" style="max-width:280px" placeholder="Nach Name suchen..." id="member-search">
      </div>
      <div class="table-card" id="member-table-wrap"><div class="skeleton tall"></div></div>
    `;

    let members = [];
    let timeout;
    document.getElementById('member-search').addEventListener('input', (e) => {
      clearTimeout(timeout);
      timeout = setTimeout(() => {
        self.search = e.target.value.toLowerCase();
        self.renderTable(members);
      }, 200);
    });

    try {
      const { data } = await API.members();
      members = data.members;
      self.renderTable(members);
    } catch (err) {
      const wrap = document.getElementById('member-table-wrap');
      wrap.innerHTML = `${errorState(err.message)}<div class="cta-row" style="justify-content:center;padding:0 1rem 1rem"><button class="btn btn-ghost" id="members-retry">Erneut laden</button></div>`;
      document.getElementById('members-retry')?.addEventListener('click', () => this.render(container));
    }
  },

  renderTable(members) {
    const filtered = this.search
      ? members.filter(m => (m.displayName ?? m.username).toLowerCase().includes(this.search))
      : members;
    const wrap = document.getElementById('member-table-wrap');
    if (!wrap) return;
    if (filtered.length === 0) { wrap.innerHTML = emptyState('Keine Mitglieder gefunden.'); return; }
    wrap.innerHTML = `
      <div class="page-info" style="padding:.75rem 1rem">${filtered.length} Mitglieder</div>
      <div class="table-wrap"><table class="responsive-table">
        <thead><tr><th>Name</th><th>Discord-ID</th><th>Beigetreten</th><th>Rollen</th><th>Tickets</th></tr></thead>
        <tbody>${filtered.slice(0, 200).map(m => `
          <tr>
            <td data-label="Name">
              <div style="display:flex;align-items:center;gap:.5rem">
                <img src="${escapeHtml(m.avatar)}" style="width:24px;height:24px;border-radius:50%;background:var(--surface-raised)" onerror="this.style.display='none'">
                <span>${escapeHtml(m.displayName ?? m.username)}</span>
              </div>
            </td>
            <td data-label="Discord-ID" class="mono dim" style="font-size:.75rem">${m.id}</td>
            <td data-label="Beigetreten" class="dim">${m.joinedAt ? fmtDate(m.joinedAt / 1000) : '—'}</td>
            <td data-label="Rollen" style="font-size:.75rem">${m.roles.slice(0,3).map(r => `<span class="badge badge-neutral" style="margin-right:.2rem">${escapeHtml(r.name)}</span>`).join('')}${m.roles.length > 3 ? `<span class="dim">+${m.roles.length-3}</span>` : ''}</td>
            <td data-label="Tickets" class="dim">${m.ticketCount}</td>
          </tr>
        `).join('')}</tbody>
      </table></div>
      ${filtered.length > 200 ? `<p class="page-info" style="padding:.5rem 1rem">Zeige 200 von ${filtered.length}. Suche verfeinern um mehr zu sehen.</p>` : ''}
    `;
  },
};
