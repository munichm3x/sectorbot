// dashboard/public/js/pages/admin-wipe.js
window['page-admin-wipe'] = {
  WIPE_TYPES: ['full', 'partial', 'economy', 'character'],
  WIPE_TYPE_LABELS: { full: 'Full Wipe', partial: 'Partial Wipe', economy: 'Economy Wipe', character: 'Character Wipe' },

  async render(container) {
    container.innerHTML = `
      <div class="page-header">
        <h1>Wipe-Info</h1>
        <p>Aktuelle Season und Wipe-Informationen. Diese Daten erscheinen auf der Public Server-Seite.</p>
      </div>
      <div id="wipe-content"><div class="skeleton" style="height:300px"></div></div>
    `;
    await this.load();
  },

  async load() {
    try {
      const { data } = await API.adminWipe.get();
      this.renderForm(data || {});
    } catch (err) {
      document.getElementById('wipe-content').innerHTML = errorState(err.message || 'Laden fehlgeschlagen');
    }
  },

  renderForm(w) {
    const self = this;
    const el = document.getElementById('wipe-content');
    el.innerHTML = `
      <div class="settings-section">
        <div class="settings-section-header">
          <div>
            <div class="settings-section-title">Aktuelle Season</div>
            <div class="settings-section-desc">Was läuft gerade</div>
          </div>
        </div>
        <div class="settings-section-body">
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Season-Nummer</label>
              <input class="form-input" id="w-season" type="number" value="${w.current_season ?? ''}" min="1" placeholder="z.B. 1" />
            </div>
            <div class="form-group">
              <label class="form-label">Season-Name</label>
              <input class="form-input" id="w-season-name" value="${escapeHtml(w.season_name || '')}" maxlength="100" placeholder="z.B. „Hardcore Survival"" />
            </div>
          </div>
        </div>
      </div>

      <div class="settings-section">
        <div class="settings-section-header">
          <div>
            <div class="settings-section-title">Letzter Wipe</div>
            <div class="settings-section-desc">Wann und was zuletzt gewiped wurde</div>
          </div>
        </div>
        <div class="settings-section-body">
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Datum</label>
              <input class="form-input" id="w-last-at" type="datetime-local" value="${tsToLocalInput(w.last_wipe_at)}" />
            </div>
            <div class="form-group">
              <label class="form-label">Typ</label>
              <select class="form-input" id="w-last-type">
                <option value="">— wählen —</option>
                ${self.WIPE_TYPES.map(t => `<option value="${t}" ${w.last_wipe_type === t ? 'selected' : ''}>${self.WIPE_TYPE_LABELS[t]}</option>`).join('')}
              </select>
            </div>
          </div>
        </div>
      </div>

      <div class="settings-section">
        <div class="settings-section-header">
          <div>
            <div class="settings-section-title">Nächster Wipe (geplant)</div>
            <div class="settings-section-desc">Optional — wenn bereits bekannt</div>
          </div>
        </div>
        <div class="settings-section-body">
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Datum</label>
              <input class="form-input" id="w-next-at" type="datetime-local" value="${tsToLocalInput(w.next_wipe_at)}" />
            </div>
            <div class="form-group">
              <label class="form-label">Typ</label>
              <select class="form-input" id="w-next-type">
                <option value="">— wählen —</option>
                ${self.WIPE_TYPES.map(t => `<option value="${t}" ${w.next_wipe_type === t ? 'selected' : ''}>${self.WIPE_TYPE_LABELS[t]}</option>`).join('')}
              </select>
            </div>
          </div>
        </div>
      </div>

      <div class="settings-section">
        <div class="settings-section-header">
          <div>
            <div class="settings-section-title">Notizen</div>
          </div>
        </div>
        <div class="settings-section-body">
          <div class="form-group">
            <label class="form-label">Notizen (öffentlich)</label>
            <textarea class="form-textarea" id="w-notes" rows="4" maxlength="2000">${escapeHtml(w.notes || '')}</textarea>
            <div class="form-help">Zusätzliche Infos zum Wipe (z.B. „Char & Inventar wird zurückgesetzt, Basen bleiben")</div>
          </div>
          <div class="form-group">
            <label class="form-checkbox-row">
              <input type="checkbox" id="w-public" ${w.public_visible !== 0 ? 'checked' : ''} />
              <span>Wipe-Informationen öffentlich anzeigen</span>
            </label>
          </div>
        </div>
      </div>

      <div class="settings-save-bar">
        <span class="audit-hint">Änderungen werden im Audit-Log protokolliert.</span>
        <button class="btn btn-ghost" id="w-cancel">Zurücksetzen</button>
        <button class="btn btn-primary" id="w-save">Speichern</button>
      </div>
    `;

    document.getElementById('w-save').addEventListener('click', () => this.save());
    document.getElementById('w-cancel').addEventListener('click', () => this.load());
  },

  async save() {
    const body = {
      currentSeason: Number(document.getElementById('w-season').value) || null,
      seasonName: document.getElementById('w-season-name').value.trim() || null,
      lastWipeAt: localInputToTs(document.getElementById('w-last-at').value),
      lastWipeType: document.getElementById('w-last-type').value || null,
      nextWipeAt: localInputToTs(document.getElementById('w-next-at').value),
      nextWipeType: document.getElementById('w-next-type').value || null,
      notes: document.getElementById('w-notes').value.trim() || null,
      publicVisible: document.getElementById('w-public').checked ? 1 : 0,
    };
    try {
      await API.adminWipe.upsert(body);
      toast('Wipe-Info gespeichert.', 'success');
      await this.load();
    } catch (err) {
      toast('Fehler: ' + (err.message || 'Speichern fehlgeschlagen'), 'error');
    }
  },
};

function tsToLocalInput(ts) {
  if (!ts) return '';
  const d = new Date(ts * 1000);
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function localInputToTs(s) {
  if (!s) return null;
  const t = new Date(s).getTime();
  return Number.isFinite(t) ? Math.floor(t / 1000) : null;
}
