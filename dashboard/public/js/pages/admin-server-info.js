// dashboard/public/js/pages/admin-server-info.js
window['page-admin-server-info'] = {
  async render(container) {
    container.innerHTML = `
      <div class="page-header">
        <h1>Server-Info</h1>
        <p>Öffentliche Server-Informationen: Spielmodus, Teamgröße, Regeln. Diese Daten erscheinen auf der Public Server-Seite.</p>
      </div>
      <div id="srv-info-content"><div class="skeleton" style="height:400px"></div></div>
    `;
    await this.load();
  },

  async load() {
    try {
      const { data } = await API.adminServerInfo.get();
      this.renderForm(data || {});
    } catch (err) {
      document.getElementById('srv-info-content').innerHTML = errorState(err.message || 'Laden fehlgeschlagen');
    }
  },

  renderForm(info) {
    const el = document.getElementById('srv-info-content');
    const isBool = v => v === 1 || v === true;
    el.innerHTML = `
      <div class="settings-section">
        <div class="settings-section-header">
          <div>
            <div class="settings-section-title">Server-Identität</div>
            <div class="settings-section-desc">Was Spieler über deinen Server wissen sollten</div>
          </div>
        </div>
        <div class="settings-section-body">
          <div class="form-group">
            <label class="form-label">Servername</label>
            <input class="form-input" id="si-name" value="${escapeHtml(info.server_name || '')}" maxlength="100" placeholder="z.B. SECTOR 13 — Hardcore PvP" />
          </div>
          <div class="form-group">
            <label class="form-label">Beschreibung</label>
            <textarea class="form-textarea" id="si-desc" rows="3" maxlength="500">${escapeHtml(info.description || '')}</textarea>
            <div class="form-help">Kurze Server-Beschreibung für die Public Server-Seite</div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Map / Region</label>
              <input class="form-input" id="si-map" value="${escapeHtml(info.map_region || '')}" maxlength="80" placeholder="z.B. Z3 Island - Europa" />
            </div>
            <div class="form-group">
              <label class="form-label">Spielmodus</label>
              <select class="form-input" id="si-mode">
                <option value="">— wählen —</option>
                <option value="PvP" ${info.game_mode === 'PvP' ? 'selected' : ''}>PvP</option>
                <option value="PvE" ${info.game_mode === 'PvE' ? 'selected' : ''}>PvE</option>
                <option value="Mixed" ${info.game_mode === 'Mixed' ? 'selected' : ''}>Mixed</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      <div class="settings-section">
        <div class="settings-section-header">
          <div>
            <div class="settings-section-title">Spielregeln</div>
            <div class="settings-section-desc">Server-Limits und Spielmechaniken</div>
          </div>
        </div>
        <div class="settings-section-body">
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Max. Teamgröße</label>
              <input class="form-input" id="si-team" type="number" value="${info.max_team_size ?? ''}" min="1" max="100" placeholder="4" />
            </div>
            <div class="form-group">
              <label class="form-label">Solo-Farbe</label>
              <input class="form-input" id="si-solo" value="${escapeHtml(info.solo_color || '')}" maxlength="40" placeholder="z.B. Orange" />
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Loot Rate</label>
              <input class="form-input" id="si-loot" value="${escapeHtml(info.loot_rate || '')}" maxlength="50" placeholder="z.B. 1.5x" />
            </div>
            <div class="form-group">
              <label class="form-label">Restart-Zeiten</label>
              <input class="form-input" id="si-restart" value="${escapeHtml(info.restart_times || '')}" maxlength="100" placeholder="z.B. täglich 06:00 + 18:00" />
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Fahrzeug-Limit</label>
              <input class="form-input" id="si-vehicles" value="${escapeHtml(info.vehicle_limit || '')}" maxlength="100" placeholder="z.B. 1 Auto + 1 Motorrad pro Spieler" />
            </div>
            <div class="form-group">
              <label class="form-label">Base-Limit</label>
              <input class="form-input" id="si-bases" value="${escapeHtml(info.base_limit || '')}" maxlength="100" placeholder="z.B. 1 Hauptbase + 1 Flagge pro Team" />
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label class="form-checkbox-row">
                <input type="checkbox" id="si-safe" ${isBool(info.safezones) ? 'checked' : ''} />
                <span>Safezones aktiv</span>
              </label>
            </div>
            <div class="form-group">
              <label class="form-checkbox-row">
                <input type="checkbox" id="si-perma" ${isBool(info.permadeath) ? 'checked' : ''} />
                <span>Permadeath aktiv</span>
              </label>
            </div>
          </div>
        </div>
      </div>

      <div class="settings-section">
        <div class="settings-section-header">
          <div>
            <div class="settings-section-title">Join-Information</div>
            <div class="settings-section-desc">Wie Spieler den Server finden</div>
          </div>
        </div>
        <div class="settings-section-body">
          <div class="form-group">
            <label class="form-label">Join-Hinweis</label>
            <textarea class="form-textarea" id="si-join" rows="2" maxlength="500">${escapeHtml(info.join_hint || '')}</textarea>
            <div class="form-help">z.B. „IP wird im Discord-Channel #server-info geteilt" — KEINE direkte IP eingeben außer du willst sie öffentlich zeigen</div>
          </div>
          <div class="form-group">
            <label class="form-checkbox-row">
              <input type="checkbox" id="si-show-host" ${isBool(info.show_host_in_public) ? 'checked' : ''} />
              <span>Server-Host/IP im Public Dashboard anzeigen (sonst maskiert)</span>
            </label>
            <div class="form-help" style="color:var(--warning)">⚠ Wenn aktiviert, sehen alle Public-Besucher die Server-Adresse</div>
          </div>
        </div>
      </div>

      <div class="settings-save-bar">
        <span class="audit-hint">Änderungen werden im Audit-Log protokolliert.</span>
        <button class="btn btn-ghost" id="si-cancel">Zurücksetzen</button>
        <button class="btn btn-primary" id="si-save">Speichern</button>
      </div>
    `;

    document.getElementById('si-save').addEventListener('click', () => this.save());
    document.getElementById('si-cancel').addEventListener('click', () => this.load());
  },

  async save() {
    const body = {
      serverName: document.getElementById('si-name').value.trim() || null,
      description: document.getElementById('si-desc').value.trim() || null,
      gameMode: document.getElementById('si-mode').value || null,
      maxTeamSize: Number(document.getElementById('si-team').value) || null,
      soloColor: document.getElementById('si-solo').value.trim() || null,
      lootRate: document.getElementById('si-loot').value.trim() || null,
      safezones: document.getElementById('si-safe').checked ? 1 : 0,
      permadeath: document.getElementById('si-perma').checked ? 1 : 0,
      vehicleLimit: document.getElementById('si-vehicles').value.trim() || null,
      baseLimit: document.getElementById('si-bases').value.trim() || null,
      restartTimes: document.getElementById('si-restart').value.trim() || null,
      mapRegion: document.getElementById('si-map').value.trim() || null,
      joinHint: document.getElementById('si-join').value.trim() || null,
      showHostInPublic: document.getElementById('si-show-host').checked ? 1 : 0,
    };
    try {
      await API.adminServerInfo.upsert(body);
      toast('Server-Info gespeichert.', 'success');
      await this.load();
    } catch (err) {
      toast('Fehler: ' + (err.message || 'Speichern fehlgeschlagen'), 'error');
    }
  },
};
