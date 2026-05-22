window['page-operations-center'] = {
  async render(container) {
    container.innerHTML = `
      <div class="page-header">
        <h1>Operations Center</h1>
        <p>Zentrale für Setup-Status, Diagnose, aktuelle Systemaktionen und schnelle Operator-Workflows.</p>
      </div>
      <div id="ops-content"><div class="skeleton" style="height:420px"></div></div>
    `;
    await this.load();
  },

  async load() {
    const root = document.getElementById('ops-content');
    if (!root) return;
    root.innerHTML = `<div class="skeleton" style="height:420px"></div>`;

    const [systemResult, configResult, doctorResult, auditResult] = await Promise.allSettled([
      API.system.get(),
      API.system.configSummary(),
      API.system.doctor(),
      API.auditLogs(),
    ]);

    if (systemResult.status !== 'fulfilled') {
      root.innerHTML = errorState(systemResult.reason?.message || 'Operations Center konnte nicht geladen werden.');
      return;
    }

    this.renderState(root, {
      system: systemResult.value.data,
      config: configResult.status === 'fulfilled' ? configResult.value.data : null,
      doctor: doctorResult.status === 'fulfilled' ? doctorResult.value.data : null,
      audit: auditResult.status === 'fulfilled' ? auditResult.value.data : [],
      errors: {
        config: configResult.status === 'rejected' ? (configResult.reason?.message || 'Setup-Status nicht verfügbar') : null,
        doctor: doctorResult.status === 'rejected' ? (doctorResult.reason?.message || 'Diagnose nicht verfügbar') : null,
        audit: auditResult.status === 'rejected' ? (auditResult.reason?.message || 'Audit-Trail nicht verfügbar') : null,
      },
    });
  },

  renderState(root, payload) {
    const system = payload.system || {};
    const config = payload.config;
    const doctor = payload.doctor;
    const audit = Array.isArray(payload.audit) ? payload.audit : [];
    const errors = payload.errors || {};

    const bot = system.bot || {};
    const warnings = system.warnings || [];
    const setup = config?.checklist || null;
    const setupTotals = setup?.totals || { completedRequired: 0, required: 0 };
    const setupPercent = setupTotals.required ? Math.round((setupTotals.completedRequired / setupTotals.required) * 100) : 0;
    const doctorSummary = doctor?.summary || { total: 0, ok: 0, warn: 0, error: 0 };
    const systemAudit = audit.filter((row) => String(row?.action || '').startsWith('system.')).slice(0, 6);

    root.innerHTML = `
      <div class="operations-hero-grid">
        <section class="card operations-panel">
          <div class="card-header"><div class="card-title">Betriebsstatus</div></div>
          <div class="operations-kpi-grid">
            ${opsKpi('Bot', bot.online ? 'Online' : 'Offline', bot.online ? 'badge-online' : 'badge-offline', bot.botUsername || 'Discord Runtime')}
            ${opsKpi('Setup', `${setupPercent}%`, config?.setupCompleted ? 'badge-online' : 'badge-warning', `${setupTotals.completedRequired}/${setupTotals.required} Pflichtfelder`)}
            ${opsKpi('Doctor', `${doctorSummary.ok}/${doctorSummary.total || 0}`, doctorSummary.error > 0 ? 'badge-warning' : 'badge-online', `${doctorSummary.warn} Warn · ${doctorSummary.error} Fehler`)}
            ${opsKpi('Warnungen', fmt(warnings.length), warnings.length ? 'badge-warning' : 'badge-online', warnings.length ? 'ENV / Konfig Hinweise' : 'Keine aktiven Hinweise')}
          </div>
          <div class="operations-actions-row">
            <button class="btn btn-primary" id="ops-refresh">Status neu laden</button>
            <button class="btn btn-ghost" data-nav-page="system">System öffnen</button>
            <button class="btn btn-ghost" data-nav-page="logs">Audit öffnen</button>
          </div>
        </section>

        <section class="card operations-panel">
          <div class="card-header"><div class="card-title">Quick Actions</div></div>
          <div class="operations-action-grid">
            <article class="operations-action-card">
              <div class="operations-card-title">Diagnose aktualisieren</div>
              <div class="operations-card-copy">Lädt Setup-, Doctor- und Runtime-Daten neu und aktualisiert die Betriebsansicht ohne Seitenwechsel.</div>
              <button class="btn btn-primary" id="ops-doctor-refresh">Doctor neu prüfen</button>
            </article>
            <article class="operations-action-card">
              <div class="operations-card-title">Discord-Inhalte importieren</div>
              <div class="operations-card-copy">Spiegelt bestehende Discord-Rules, Changelog-Einträge und Events in die Datenbank.</div>
              <button class="btn btn-danger" id="ops-sync-import">Sync-Import starten</button>
            </article>
            <article class="operations-action-card">
              <div class="operations-card-title">Discord-Cache leeren</div>
              <div class="operations-card-copy">Leert Member-Caches, damit Rollen- und Guild-Daten bei Bedarf frisch aus Discord geladen werden.</div>
              <button class="btn btn-danger" id="ops-cache-clear">Cache leeren</button>
            </article>
          </div>
        </section>
      </div>

      <div class="operations-grid-two">
        <section class="settings-section">
          <div class="settings-section-header">
            <div>
              <div class="settings-section-title">Setup & Konfiguration</div>
              <div class="settings-section-desc">Schneller Überblick über den produktionsrelevanten Setup-Zustand</div>
            </div>
            <button class="btn btn-ghost" data-nav-page="settings-tickets">Setup öffnen</button>
          </div>
          <div class="settings-section-body">
            ${config ? `
              <div class="system-checklist">
                ${(setup?.items || []).map((item) => `
                  <div class="system-check-item ${item.done ? 'is-ok' : item.optional ? 'is-warn' : 'is-error'}">
                    <div class="system-check-icon">${item.done ? '✓' : item.optional ? '○' : '✕'}</div>
                    <div>
                      <div class="system-check-title">${escapeHtml(item.label)}</div>
                      <div class="system-check-copy">${item.done ? 'Bereit' : item.optional ? 'Optional offen' : 'Aktion nötig'}</div>
                    </div>
                  </div>
                `).join('')}
              </div>
            ` : `<div class="system-inline-error">${escapeHtml(errors.config || 'Setup-Status nicht verfügbar')}</div>`}
          </div>
        </section>

        <section class="settings-section">
          <div class="settings-section-header">
            <div>
              <div class="settings-section-title">Doctor Highlights</div>
              <div class="settings-section-desc">Die kritischsten Checks aus /doctor als schnelle Operations-Sicht</div>
            </div>
            <button class="btn btn-ghost" data-nav-page="system">Volle Diagnose</button>
          </div>
          <div class="settings-section-body">
            ${doctor ? `
              <div class="system-diagnostics-grid">
                ${(doctor.checks || []).slice(0, 6).map((check) => `
                  <article class="system-diagnostic-card is-${check.status}">
                    <div class="system-diagnostic-top">
                      <div class="system-diagnostic-title">${escapeHtml(check.name)}</div>
                      <span class="status-pill ${check.status === 'ok' ? 'published' : check.status === 'warn' ? 'scheduled' : 'cancelled'}">${escapeHtml(check.status)}</span>
                    </div>
                    <p class="system-diagnostic-copy">${escapeHtml(check.detail)}</p>
                  </article>
                `).join('')}
              </div>
            ` : `<div class="system-inline-error">${escapeHtml(errors.doctor || 'Diagnose nicht verfügbar')}</div>`}
          </div>
        </section>
      </div>

      <div class="operations-grid-two">
        <section class="settings-section">
          <div class="settings-section-header">
            <div>
              <div class="settings-section-title">Letzte Systemaktionen</div>
              <div class="settings-section-desc">Aktuelle Cache-, Import- und Owner-Operationen aus dem Audit-Trail</div>
            </div>
            <button class="btn btn-ghost" data-nav-page="logs">Audit-Trail</button>
          </div>
          <div class="settings-section-body">
            ${systemAudit.length ? `
              <div class="system-ops-grid">
                ${systemAudit.map((row) => renderSystemAuditCard(row)).join('')}
              </div>
            ` : `<div class="system-inline-error">${escapeHtml(errors.audit || 'Noch keine Systemaktionen protokolliert')}</div>`}
          </div>
        </section>

        <section class="settings-section">
          <div class="settings-section-header">
            <div>
              <div class="settings-section-title">Runbooks</div>
              <div class="settings-section-desc">Empfohlene Handgriffe für häufige Betriebsfälle</div>
            </div>
          </div>
          <div class="settings-section-body">
            <div class="operations-runbook-grid">
              ${RUNBOOKS.map(renderRunbook).join('')}
            </div>
          </div>
        </section>
      </div>
    `;

    document.getElementById('ops-refresh')?.addEventListener('click', () => this.refreshButton(document.getElementById('ops-refresh'), 'Lade...', () => this.load(), 'Status aktualisiert.'));
    document.getElementById('ops-doctor-refresh')?.addEventListener('click', () => this.refreshButton(document.getElementById('ops-doctor-refresh'), 'Prüfe...', () => this.load(), 'Doctor aktualisiert.'));
    document.getElementById('ops-sync-import')?.addEventListener('click', () => this.syncImport());
    document.getElementById('ops-cache-clear')?.addEventListener('click', () => this.cacheClear());

    root.querySelectorAll('[data-nav-page]').forEach((button) => {
      button.addEventListener('click', () => {
        window.location.hash = '#/' + button.dataset.navPage;
      });
    });
  },

  async refreshButton(button, label, task, successMessage) {
    if (!button) return;
    const original = button.textContent;
    button.disabled = true;
    button.textContent = label;
    try {
      await task();
      toast(successMessage, 'success');
    } catch (err) {
      toast('Fehler: ' + (err.message || 'Aktion fehlgeschlagen'), 'error');
    } finally {
      button.disabled = false;
      button.textContent = original;
    }
  },

  async syncImport() {
    if (!confirm('Discord-Inhalte jetzt in die Datenbank importieren?')) return;
    const button = document.getElementById('ops-sync-import');
    if (!button) return;
    const original = button.textContent;
    button.disabled = true;
    button.textContent = 'Import läuft...';
    try {
      const { data } = await API.system.syncImport();
      const errorCount = Array.isArray(data?.errors) ? data.errors.length : 0;
      toast(`Rules ${data?.rules?.imported ?? 0} · Changelog ${data?.changelog?.imported ?? 0} · Events ${data?.events?.imported ?? 0}${errorCount ? ` · ${errorCount} Hinweis(e)` : ''}`, errorCount ? 'info' : 'success', 5000);
      await this.load();
    } catch (err) {
      toast('Fehler: ' + (err.message || 'Import fehlgeschlagen'), 'error');
    } finally {
      button.disabled = false;
      button.textContent = original;
    }
  },

  async cacheClear() {
    if (!confirm('Discord-Cache wirklich leeren?')) return;
    const button = document.getElementById('ops-cache-clear');
    if (!button) return;
    const original = button.textContent;
    button.disabled = true;
    button.textContent = 'Leere Cache...';
    try {
      await API.system.cacheClear();
      toast('Discord-Cache geleert.', 'success');
      await this.load();
    } catch (err) {
      toast('Fehler: ' + (err.message || 'Aktion fehlgeschlagen'), 'error');
    } finally {
      button.disabled = false;
      button.textContent = original;
    }
  },
};

const RUNBOOKS = [
  {
    title: 'Setup unvollständig',
    copy: 'Nutzen, wenn Panel, Rollen oder Regelwerk noch nicht produktionsbereit sind.',
    steps: [
      'Öffne zuerst Tickets-, Rollen- und Channel-Settings und schließe offene Pflichtfelder.',
      'Verifiziere anschließend im Doctor, dass Schreibrechte und Rollenpositionen sauber sind.',
      'Publiziere danach Panel und Regelwerk erneut, falls Nachrichten fehlen.',
    ],
  },
  {
    title: 'Discord-Sync driftet',
    copy: 'Für Fälle, in denen Rules, Events oder Changelog in Discord existieren, aber nicht in der DB sichtbar sind.',
    steps: [
      'Starte einen Sync-Import nur nach kurzer Sichtprüfung der betroffenen Inhalte.',
      'Kontrolliere danach Audit-Trail und Public Preview auf neu importierte Einträge.',
      'Bei Warnungen im Import zuerst Discord-Berechtigungen und Channel-Zugriffe prüfen.',
    ],
  },
  {
    title: 'Doctor meldet Fehler',
    copy: 'Empfohlene Reihenfolge, wenn /doctor Fehler oder Warnungen ausgibt.',
    steps: [
      'Behebe zuerst harte Fehler: fehlende Channels, Rollen oder Bot-Berechtigungen.',
      'Leere bei inkonsistenten Guild-/Member-Daten anschließend den Discord-Cache.',
      'Führe dann den Doctor erneut aus und prüfe, ob nur noch optionale Warnungen bleiben.',
    ],
  },
];

function opsKpi(label, value, badgeClass, sub) {
  return `
    <div class="operations-summary-card">
      <div class="analytics-mini-label">${escapeHtml(label)}</div>
      <div class="operations-summary-stack">
        <div class="analytics-mini-value">${escapeHtml(String(value ?? '—'))}</div>
        <span class="badge ${escapeHtml(badgeClass || 'badge-neutral')}">${escapeHtml(sub || '—')}</span>
      </div>
    </div>
  `;
}

function renderRunbook(book) {
  return `
    <article class="operations-runbook-card">
      <div class="operations-runbook-title">${escapeHtml(book.title)}</div>
      <p class="operations-runbook-copy">${escapeHtml(book.copy)}</p>
      <ol class="operations-runbook-list">
        ${book.steps.map((step) => `<li>${escapeHtml(step)}</li>`).join('')}
      </ol>
    </article>
  `;
}

function renderSystemAuditCard(row) {
  const parsed = parseAuditValue(row?.new_value);
  const meta = row?.action === 'system.sync-import' && parsed
    ? `Rules ${parsed.rules ?? 0} · Changelog ${parsed.changelog ?? 0} · Events ${parsed.events ?? 0}`
    : row?.ip_address
      ? `IP ${row.ip_address}`
      : 'Dashboard-Aktion';

  return `
    <article class="system-op-card ${row?.success ? 'is-ok' : 'is-error'}">
      <div class="system-op-top">
        <div>
          <div class="system-op-title">${escapeHtml(formatSystemAction(row?.action))}</div>
          <div class="system-op-meta">${escapeHtml(fmtDate(row?.created_at))} · Admin ${escapeHtml(shortAdminId(row?.admin_user_id))}</div>
        </div>
        <span class="badge ${row?.success ? 'badge-online' : 'badge-offline'}">${row?.success ? 'OK' : 'Fehler'}</span>
      </div>
      <div class="system-op-copy">${escapeHtml(meta)}</div>
      <div class="system-op-tags">
        <span class="status-pill published">${escapeHtml(String(row?.action || 'system'))}</span>
      </div>
    </article>
  `;
}

function parseAuditValue(value) {
  if (!value || typeof value !== 'string') return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function formatSystemAction(action) {
  const map = {
    'system.cache-clear': 'Discord-Cache geleert',
    'system.sync-import': 'Discord-Inhalte importiert',
    'system.resync-commands': 'Slash-Commands resynchronisiert',
  };
  if (map[action]) return map[action];
  return String(action || 'Systemaktion')
    .replace(/^system\./, '')
    .replace(/\./g, ' · ')
    .replace(/-/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function shortAdminId(value) {
  const text = String(value || '');
  return text ? `${text.slice(0, 8)}…` : '—';
}
