window['page-events'] = {
  async render(container) {
    container.innerHTML = pageHeader('Events', 'Community Events', 'Geplante, laufende und vergangene Events ohne private Teilnehmerlisten.') + '<div id="events-content"></div>';
    const root = document.getElementById('events-content');
    try {
      const { data } = await API.events();
      const events = data.events ?? [];
      root.innerHTML = events.length ? `
        <div class="timeline-card card">${events.map(event => `
          <div class="timeline-item">
            <span class="badge badge-accent">${escapeHtml(event.type ?? 'Event')}</span>
            <strong>${escapeHtml(event.title)}</strong>
            <small>${fmtDate(event.startsAt)}</small>
            <p>${escapeHtml(event.description ?? '')}</p>
          </div>
        `).join('')}</div>
      ` : `
        <section class="card">
          ${emptyState('Aktuell sind keine Events geplant.', 'Sobald Events gepflegt werden, erscheinen Datum, Typ, Status und Beschreibung hier.')}
        </section>
      `;
    } catch {
      root.innerHTML = errorState();
    }
  },
};
