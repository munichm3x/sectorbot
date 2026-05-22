// dashboard/public/js/pages/system.js
window['page-system'] = {
  async render(container) {
    container.innerHTML = `
      <div class="page-header">
        <h1>System</h1>
        <p>Bot-Status, Diagnose, Setup-Fortschritt und Betriebsaktionen.</p>
      </div>
      <div id="sys-content"><div class="skeleton" style="height:400px"></div></div>
    `;
    await this.load();
  },

  async load() {
    const [systemResult, configResult, doctorResult, auditResult] = await Promise.allSettled([
      API.system.get(),
      API.system.configSummary(),
      API.system.doctor(),
      API.auditLogs(),
    ]);

    if (systemResult.status !== 'fulfilled') {
      document.getElementById('sys-content').innerHTML = errorState(systemResult.reason?.message || 'Laden fehlgeschlagen');
      return;
    }

    this.renderInfo({
      system: systemResult.value.data,
      configSummary: configResult.status === 'fulfilled' ? configResult.value.data : null,
      doctor: doctorResult.status === 'fulfilled' ? doctorResult.value.data : null,
      audit: auditResult.status === 'fulfilled' ? auditResult.value.data : null,
      errors: {
        configSummary: configResult.status === 'rejected' ? (configResult.reason?.message || 'Konfiguration nicht verfügbar') : null,
        doctor: doctorResult.status === 'rejected' ? (doctorResult.reason?.message || 'Diagnose nicht verfügbar') : null,
        audit: auditResult.status === 'rejected' ? (auditResult.reason?.message || 'Audit-Trail nicht verfügbar') : null,
      },
    });
  },

  renderInfo(payload) {
    const el = document.getElementById('sys-content');
    const d = payload.system || {};
    const configSummary = payload.configSummary;
    const doctor = payload.doctor;
    const audit = Array.isArray(payload.audit) ? payload.audit : [];
    const errors = payload.errors || {};
    const bot = d.bot || {};
    const db = d.database || {};
    const env = d.env || {};
    const warnings = d.warnings || [];

    const fmtBytes = (b) => {
      if (b == null) return '—';
      if (b < 1024) return b + ' B';
      if (b < 1024*1024) return (b/1024).toFixed(1) + ' KB';
      return (b/1024/1024).toFixed(1) + ' MB';
    };
    const fmtUptime = (s) => {
      if (!s) return '—';
      const d = Math.floor(s / 86400);
      const h = Math.floor((s % 86400) / 3600);
      const m = Math.floor((s % 3600) / 60);
      if (d > 0) return `${d}d ${h}h`;
      if (h > 0) return `${h}h ${m}m`;
      return `${m}m`;
    };
    const fmtConfigRef = (item, fallback = 'Nicht gesetzt') => {
      if (!item?.id) return fallback;
      if (!item.exists) return `${item.id} · nicht gefunden`;
      return item.name ? `${item.name} · ${item.id}` : item.id;
    };
    const setup = configSummary?.checklist;
    const setupTotals = setup?.totals || { completedRequired: 0, required: 0, completedAll: 0, all: 0 };
    const setupPercent = setupTotals.required ? Math.round((setupTotals.completedRequired / setupTotals.required) * 100) : 0;
    const doctorSummary = doctor?.summary || { total: 0, ok: 0, warn: 0, error: 0 };
    const systemAudit = audit.filter((row) => String(row?.action || '').startsWith('system.'));
    const visibleAudit = (systemAudit.length ? systemAudit : audit).slice(0, 8);
    const auditSummary = visibleAudit.reduce((acc, row) => {
      acc.total += 1;
      if (row?.success) acc.success += 1;
      else acc.failed += 1;
      return acc;
    }, { total: 0, success: 0, failed: 0 });
    const parseAuditValue = (value) => {
      if (!value || typeof value !== 'string') return null;
      try {
        return JSON.parse(value);
      } catch {
        return null;
      }
    };
    const formatAuditAction = (action) => {
      const map = {
        'system.cache-clear': 'Discord-Cache geleert',
        'system.sync-import': 'Discord-Inhalte importiert',
        'system.resync-commands': 'Slash-Commands resynchronisiert',
      };
      if (map[action]) return map[action];
      return String(action || 'Aktion')
        .replace(/^system\./, '')
        .replace(/\./g, ' · ')
        .replace(/-/g, ' ')
        .replace(/\b\w/g, (char) => char.toUpperCase());
    };
    const formatAuditMeta = (row) => {
      const parsed = parseAuditValue(row?.new_value);
      if (row?.action === 'system.sync-import' && parsed) {
        return `Rules ${parsed.rules ?? 0} · Changelog ${parsed.changelog ?? 0} · Events ${parsed.events ?? 0}`;
      }
      if (row?.ip_address) {
        return `IP ${row.ip_address}`;
      }
      return row?.target_type ? `Ziel ${row.target_type}` : 'Dashboard-Aktion';
    };
    const shortAdminId = (value) => {
      const text = String(value || '');
      return text ? `${text.slice(0, 8)}…` : '—';
    };

    el.innerHTML = `
      <!-- Warnings -->
      ${warnings.length > 0 ? `
        <div class="settings-section" style="border-left:3px solid var(--warning)">
          <div class="settings-section-header">
            <div>
              <div class="settings-section-title" style="color:var(--warning)">⚠ Konfigurations-Warnungen</div>
              <div class="settings-section-desc">${warnings.length} Hinweis(e) gefunden</div>
            </div>
          </div>
          <div class="settings-section-body">
            <ul style="margin:0;padding-left:1.25rem;font-size:0.85rem;color:var(--text-secondary);line-height:1.7">
              ${warnings.map(w => `<li>${escapeHtml(w)}</li>`).join('')}
            </ul>
          </div>
        </div>
      ` : ''}

      <div class="analytics-grid-two analytics-grid-align-start">
        <div class="settings-section system-highlight-panel">
          <div class="settings-section-header">
            <div>
              <div class="settings-section-title">Setup-Fortschritt</div>
              <div class="settings-section-desc">Dashboard-Spiegel von Setup- und Config-Status</div>
            </div>
            <span class="badge ${configSummary?.setupCompleted ? 'badge-online' : 'badge-warning'}">${configSummary?.setupCompleted ? 'Fertig' : 'Unvollständig'}</span>
          </div>
          <div class="settings-section-body">
            ${configSummary ? `
              <div class="stat-grid system-stat-grid-compact">
                <div class="stat-card"><div class="stat-label">Pflichtfelder</div><div class="stat-value">${escapeHtml(String(setupTotals.completedRequired))}/${escapeHtml(String(setupTotals.required))}</div></div>
                <div class="stat-card"><div class="stat-label">Fortschritt</div><div class="stat-value mono">${escapeHtml(String(setupPercent))}%</div></div>
                <div class="stat-card"><div class="stat-label">Support-Rollen</div><div class="stat-value">${escapeHtml(String(configSummary.roles?.support?.length || 0))}</div></div>
                <div class="stat-card"><div class="stat-label">Kategorien</div><div class="stat-value">${escapeHtml(String(configSummary.categories?.enabled || 0))}</div><div class="stat-sub">aktiv</div></div>
              </div>
              <div class="system-checklist">
                ${(setup?.items || []).map(item => `
                  <div class="system-check-item ${item.done ? 'is-ok' : item.optional ? 'is-warn' : 'is-error'}">
                    <div class="system-check-icon">${item.done ? '✓' : item.optional ? '○' : '✕'}</div>
                    <div>
                      <div class="system-check-title">${escapeHtml(item.label)}</div>
                      <div class="system-check-copy">${item.done ? 'Vorhanden' : item.optional ? 'Optional offen' : 'Erforderlich offen'}</div>
                    </div>
                  </div>
                `).join('')}
              </div>
              <div class="system-config-grid">
                <div class="analytics-mini-card">
                  <div class="analytics-mini-label">Ticket-Panel</div>
                  <div class="analytics-mini-value system-mini-value">${escapeHtml(fmtConfigRef(configSummary.channels?.ticketPanel))}</div>
                  <div class="analytics-mini-sub">${configSummary.publication?.ticketPanelPublished ? 'Panel veröffentlicht' : 'Panel noch nicht veröffentlicht'}</div>
                </div>
                <div class="analytics-mini-card">
                  <div class="analytics-mini-label">Regelwerk</div>
                  <div class="analytics-mini-value system-mini-value">${escapeHtml(fmtConfigRef(configSummary.channels?.rules))}</div>
                  <div class="analytics-mini-sub">${configSummary.publication?.rulesPublished ? 'Regelwerk veröffentlicht' : 'Regelwerk noch nicht veröffentlicht'}</div>
                </div>
                <div class="analytics-mini-card">
                  <div class="analytics-mini-label">Whitelist</div>
                  <div class="analytics-mini-value system-mini-value">${escapeHtml(fmtConfigRef(configSummary.roles?.whitelist, 'Nicht gesetzt'))}</div>
                  <div class="analytics-mini-sub">${escapeHtml(String(configSummary.categories?.total || 0))} Kategorien insgesamt</div>
                </div>
                <div class="analytics-mini-card">
                  <div class="analytics-mini-label">Log / Kategorie</div>
                  <div class="analytics-mini-value system-mini-value">${escapeHtml(fmtConfigRef(configSummary.channels?.ticketLog, 'Kein Log-Channel'))}</div>
                  <div class="analytics-mini-sub">${escapeHtml(fmtConfigRef(configSummary.channels?.ticketCategory, 'Keine Discord-Kategorie'))}</div>
                </div>
              </div>
              <div class="analytics-kpi-inline">
                <button class="btn btn-secondary" data-nav-page="settings-channels">Channels öffnen</button>
                <button class="btn btn-secondary" data-nav-page="settings-tickets">Ticket-Setup</button>
                <button class="btn btn-secondary" data-nav-page="settings-roles">Rollen prüfen</button>
              </div>
            ` : `<div class="system-inline-error">${escapeHtml(errors.configSummary || 'Konfiguration nicht verfügbar')}</div>`}
          </div>
        </div>

        <div class="settings-section system-highlight-panel">
          <div class="settings-section-header">
            <div>
              <div class="settings-section-title">Diagnose</div>
              <div class="settings-section-desc">Web-Pendant zum Discord-Befehl /doctor</div>
            </div>
            <button class="btn btn-secondary" id="sys-refresh">Neu prüfen</button>
          </div>
          <div class="settings-section-body">
            ${doctor ? `
              <div class="stat-grid system-stat-grid-compact">
                <div class="stat-card"><div class="stat-label">Checks</div><div class="stat-value">${escapeHtml(String(doctorSummary.total))}</div></div>
                <div class="stat-card"><div class="stat-label">OK</div><div class="stat-value mono">${escapeHtml(String(doctorSummary.ok))}</div></div>
                <div class="stat-card"><div class="stat-label">Warnungen</div><div class="stat-value mono">${escapeHtml(String(doctorSummary.warn))}</div></div>
                <div class="stat-card"><div class="stat-label">Fehler</div><div class="stat-value mono">${escapeHtml(String(doctorSummary.error))}</div></div>
              </div>
              <div class="system-diagnostics-grid">
                ${(doctor.checks || []).map(check => `
                  <article class="system-diagnostic-card is-${check.status}">
                    <div class="system-diagnostic-top">
                      <div class="system-diagnostic-title">${escapeHtml(check.name)}</div>
                      <span class="status-pill ${check.status === 'ok' ? 'published' : check.status === 'warn' ? 'scheduled' : 'cancelled'}">${check.status}</span>
                    </div>
                    <p class="system-diagnostic-copy">${escapeHtml(check.detail)}</p>
                  </article>
                `).join('')}
              </div>
            ` : `<div class="system-inline-error">${escapeHtml(errors.doctor || 'Diagnose nicht verfügbar')}</div>`}
          </div>
        </div>
      </div>

      <div class="settings-section">
        <div class="settings-section-header">
          <div>
            <div class="settings-section-title">Operationen & Audit</div>
            <div class="settings-section-desc">Letzte Systemaktionen, Owner-Eingriffe und Importläufe</div>
          </div>
          <button class="btn btn-secondary" data-nav-page="logs">Vollen Audit-Trail öffnen</button>
        </div>
        <div class="settings-section-body">
          ${visibleAudit.length ? `
            <div class="stat-grid system-stat-grid-compact">
              <div class="stat-card"><div class="stat-label">Einträge</div><div class="stat-value">${escapeHtml(String(auditSummary.total))}</div></div>
              <div class="stat-card"><div class="stat-label">Erfolgreich</div><div class="stat-value mono">${escapeHtml(String(auditSummary.success))}</div></div>
              <div class="stat-card"><div class="stat-label">Fehlgeschlagen</div><div class="stat-value mono">${escapeHtml(String(auditSummary.failed))}</div></div>
              <div class="stat-card"><div class="stat-label">Quelle</div><div class="stat-value">${systemAudit.length ? 'System' : 'Audit'}</div><div class="stat-sub">aktuelle Ansicht</div></div>
            </div>
            <div class="system-ops-grid">
              ${visibleAudit.map((row) => `
                <article class="system-op-card ${row?.success ? 'is-ok' : 'is-error'}">
                  <div class="system-op-top">
                    <div>
                      <div class="system-op-title">${escapeHtml(formatAuditAction(row?.action))}</div>
                      <div class="system-op-meta">${escapeHtml(fmtDate(row?.created_at))} · Admin ${escapeHtml(shortAdminId(row?.admin_user_id))}</div>
                    </div>
                    <span class="badge ${row?.success ? 'badge-online' : 'badge-offline'}">${row?.success ? 'OK' : 'Fehler'}</span>
                  </div>
                  <div class="system-op-copy">${escapeHtml(formatAuditMeta(row))}</div>
                  <div class="system-op-tags">
                    <span class="status-pill ${String(row?.action || '').startsWith('system.') ? 'published' : 'draft'}">${escapeHtml(String(row?.action || 'audit'))}</span>
                  </div>
                </article>
              `).join('')}
            </div>
          ` : `<div class="system-inline-error">${escapeHtml(errors.audit || 'Noch keine Audit-Einträge vorhanden')}</div>`}
        </div>
      </div>

      <!-- Bot Info -->
      <div class="settings-section">
        <div class="settings-section-header">
          <div>
            <div class="settings-section-title">Bot-Status</div>
            <div class="settings-section-desc">Laufzeit-Informationen</div>
          </div>
          <span class="badge ${bot.online ? 'badge-online' : 'badge-offline'}">${bot.online ? 'Online' : 'Offline'}</span>
        </div>
        <div class="settings-section-body">
          <div class="stat-grid">
            <div class="stat-card"><div class="stat-label">Uptime</div><div class="stat-value">${escapeHtml(fmtUptime(bot.uptimeSec))}</div></div>
            <div class="stat-card"><div class="stat-label">Latenz</div><div class="stat-value mono">${escapeHtml(String(bot.latencyMs ?? '—'))}<small style="font-size:0.85rem">ms</small></div></div>
            <div class="stat-card"><div class="stat-label">RAM</div><div class="stat-value mono">${escapeHtml(String(bot.memoryMb ?? '—'))}<small style="font-size:0.85rem"> MB</small></div></div>
            <div class="stat-card"><div class="stat-label">Guilds</div><div class="stat-value">${escapeHtml(String(bot.guildCount ?? '—'))}</div></div>
            <div class="stat-card"><div class="stat-label">Node.js</div><div class="stat-value mono" style="font-size:1rem">${escapeHtml(bot.nodeVersion || '—')}</div></div>
            <div class="stat-card"><div class="stat-label">Bot User</div><div class="stat-value" style="font-size:0.95rem">${escapeHtml(bot.botUsername || '—')}</div><div class="stat-sub mono">${escapeHtml(bot.botUserId || '')}</div></div>
          </div>
        </div>
      </div>

      <!-- Database -->
      <div class="settings-section">
        <div class="settings-section-header">
          <div>
            <div class="settings-section-title">Datenbank</div>
          </div>
        </div>
        <div class="settings-section-body">
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Pfad</label>
              <input class="form-input mono" value="${escapeHtml(db.path || '—')}" disabled />
            </div>
            <div class="form-group">
              <label class="form-label">Größe</label>
              <input class="form-input mono" value="${escapeHtml(fmtBytes(db.sizeBytes))}" disabled />
            </div>
          </div>
        </div>
      </div>

      <!-- ENV Presence -->
      <div class="settings-section">
        <div class="settings-section-header">
          <div>
            <div class="settings-section-title">ENV-Konfiguration</div>
            <div class="settings-section-desc">Nur Schlüssel-Existenz — niemals Werte</div>
          </div>
        </div>
        <div class="settings-section-body">
          <div class="table-wrap">
            <table class="responsive-table">
              <thead><tr><th>Schlüssel</th><th>Status</th></tr></thead>
              <tbody>
                ${Object.entries(env).map(([key, present]) => `
                  <tr>
                    <td data-label="Schlüssel" class="mono">${escapeHtml(key)}</td>
                    <td data-label="Status"><span class="badge ${present ? 'badge-online' : 'badge-warning'}">${present ? '✓ gesetzt' : '○ fehlt'}</span></td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <!-- Danger Zone -->
      <div class="danger-zone">
        <div class="danger-zone-title">⚠ Gefährliche Aktionen</div>
        <div class="danger-zone-desc">
          Diese Aktionen können den Bot-Betrieb stören. Nur Owner kann sie ausführen. Alle Aktionen werden im Audit-Log protokolliert.
        </div>
        <div style="display:flex;gap:0.5rem;flex-wrap:wrap">
          <button class="btn btn-danger" id="sys-cache-clear">Discord-Cache leeren</button>
          <button class="btn btn-danger" id="sys-sync-import">Discord-Inhalte importieren</button>
          <button class="btn btn-danger" id="sys-resync" disabled title="Nur über CLI (npm run deploy) verfügbar">Slash-Commands neu synchronisieren</button>
        </div>
        <div class="form-help" style="margin-top:0.75rem">Der Import übernimmt bestehende Rules-, Changelog- und Event-Inhalte aus Discord in die Datenbank.</div>
      </div>
    `;

    document.getElementById('sys-cache-clear').addEventListener('click', () => this.cacheClear());
    document.getElementById('sys-sync-import').addEventListener('click', () => this.syncImport());
    const refreshBtn = document.getElementById('sys-refresh');
    if (refreshBtn) refreshBtn.addEventListener('click', () => this.refreshDoctor(refreshBtn));
    el.querySelectorAll('[data-nav-page]').forEach((button) => {
      button.addEventListener('click', () => {
        window.location.hash = '#/' + button.dataset.navPage;
      });
    });
  },

  async refreshDoctor(btn) {
    if (!btn) return;
    btn.disabled = true;
    btn.textContent = '⏳ Prüfe...';
    try {
      await this.load();
      toast('Diagnose aktualisiert.', 'success');
    } catch (err) {
      toast('Fehler: ' + (err.message || 'Diagnose fehlgeschlagen'), 'error');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Neu prüfen';
    }
  },

  async cacheClear() {
    if (!confirm('Discord-Cache wirklich leeren? Members werden bei Bedarf neu geladen — kann Performance kurzzeitig beeinflussen.')) return;
    const btn = document.getElementById('sys-cache-clear');
    btn.disabled = true;
    btn.textContent = '⏳ Leere Cache...';
    try {
      await API.system.cacheClear();
      toast('Discord-Cache geleert.', 'success');
      await this.load();
    } catch (err) {
      toast('Fehler: ' + (err.message || 'Aktion fehlgeschlagen'), 'error');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Discord-Cache leeren';
    }
  },

  async syncImport() {
    if (!confirm('Vorhandene Discord-Inhalte jetzt in die Datenbank importieren? Bereits importierte Inhalte bleiben unverändert, neue Einträge werden ergänzt.')) return;
    const btn = document.getElementById('sys-sync-import');
    btn.disabled = true;
    btn.textContent = '⏳ Import läuft...';
    try {
      const { data } = await API.system.syncImport();
      const imported = [
        `Rules: ${data?.rules?.imported ?? 0}`,
        `Changelog: ${data?.changelog?.imported ?? 0}`,
        `Events: ${data?.events?.imported ?? 0}`,
      ].join(' · ');
      const errorCount = Array.isArray(data?.errors) ? data.errors.length : 0;
      toast(errorCount > 0 ? `${imported} · ${errorCount} Hinweis(e)` : imported, errorCount > 0 ? 'info' : 'success', 5000);
      await this.load();
    } catch (err) {
      toast('Fehler: ' + (err.message || 'Import fehlgeschlagen'), 'error');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Discord-Inhalte importieren';
    }
  },
};
