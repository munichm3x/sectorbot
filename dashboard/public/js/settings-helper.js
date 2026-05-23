// dashboard/public/js/settings-helper.js
// Generic settings page renderer. Each settings page provides a category and a list of field
// definitions; this helper handles loading, rendering, save, and secret-input flow.
//
// Usage in a settings page:
//   window['page-settings-general'] = SettingsHelper.buildPage({
//     category: 'general',
//     title: 'Allgemeine Einstellungen',
//     description: 'Bot-Name, Sprache, Zeitzone und globale Toggles',
//     sections: [
//       {
//         title: 'Identität', desc: '...',
//         fields: [
//           { key: 'bot_name', label: 'Bot-Name', type: 'text', maxLength: 100, help: 'Wird in Embeds verwendet' },
//           { key: 'timezone', label: 'Zeitzone', type: 'text', placeholder: 'Europe/Berlin' },
//           { key: 'language', label: 'Sprache', type: 'select', options: [{ value: 'de', label: 'Deutsch' }, { value: 'en', label: 'English' }] },
//           { key: 'debug_mode', label: 'Debug-Modus', type: 'checkbox' },
//           { key: 'discord_token', label: 'Discord Token', type: 'secret', help: 'Wird nie im Klartext angezeigt' },
//         ],
//       },
//     ],
//   });

window.SettingsHelper = {
  buildPage(config) {
    const category = config.category;

    return {
      _values: {},        // current form state
      _loaded: {},        // values as loaded from server
      _meta: {},          // { key: { isSecret, updatedAt } }

      _isDirty() {
        for (const section of config.sections || []) {
          for (const f of section.fields || []) {
            if (f.type === 'readonly') continue;
            const cur  = this._values[f.key];
            const orig = this._loaded[f.key];
            if (f.type === 'secret' && cur === '***' && orig === '***') continue;
            if (String(cur ?? '') !== String(orig ?? '')) return true;
          }
        }
        return false;
      },

      _updateDirtyBanner() {
        const banner = document.getElementById('s-dirty-banner');
        if (!banner) return;
        banner.classList.toggle('visible', this._isDirty());
      },

      async render(container) {
        container.innerHTML = `
          <div class="page-header">
            <h1>${escapeHtml(config.title)}</h1>
            <p>${escapeHtml(config.description || '')}</p>
          </div>
          <div id="settings-content"><div class="skeleton" style="height:400px"></div></div>
        `;
        await this.load();
      },

      async load() {
        try {
          const { data } = await API.botSettings.list(category);
          this._loaded = {};
          this._meta = {};
          for (const [key, info] of Object.entries(data || {})) {
            this._loaded[key] = info.value;
            this._meta[key] = { isSecret: info.isSecret, updatedAt: info.updatedAt };
          }
          this._values = { ...this._loaded };
          this.renderForm();
        } catch (err) {
          document.getElementById('settings-content').innerHTML = errorState(err.message || 'Laden fehlgeschlagen');
        }
      },

      renderForm() {
        const self = this;
        const el = document.getElementById('settings-content');
        let html = `
          <div class="dirty-banner" id="s-dirty-banner">
            <span class="dirty-dot"></span>
            Ungespeicherte Änderungen — nicht vergessen zu speichern.
          </div>
        `;
        for (const section of config.sections || []) {
          html += `
            <div class="settings-section">
              <div class="settings-section-header">
                <div>
                  <div class="settings-section-title">${escapeHtml(section.title)}</div>
                  ${section.desc ? `<div class="settings-section-desc">${escapeHtml(section.desc)}</div>` : ''}
                </div>
                ${section.testKey ? `<button class="btn btn-ghost" data-test-key="${escapeHtml(section.testKey)}">▶ Testen</button>` : ''}
              </div>
              <div class="settings-section-body">
                ${(section.fields || []).map(f => this.renderField(f)).join('')}
              </div>
            </div>
          `;
        }
        if (config.dangerZone) {
          html += `
            <div class="danger-zone">
              <div class="danger-zone-title">⚠ ${escapeHtml(config.dangerZone.title)}</div>
              <div class="danger-zone-desc">${escapeHtml(config.dangerZone.desc)}</div>
              ${(config.dangerZone.actions || []).map(a => `
                <button class="btn btn-danger" data-danger-key="${escapeHtml(a.key)}">${escapeHtml(a.label)}</button>
              `).join(' ')}
            </div>
          `;
        }
        html += `
          <div class="settings-save-bar">
            <span class="audit-hint">Änderungen werden im Audit-Log protokolliert. Secrets werden niemals angezeigt oder geloggt.</span>
            <button class="btn btn-ghost" id="s-cancel">Zurücksetzen</button>
            <button class="btn btn-primary" id="s-save">Speichern</button>
          </div>
        `;
        el.innerHTML = html;
        this.attachEvents();
      },

      renderField(f) {
        const value = this._values[f.key] ?? f.default ?? '';
        const meta = this._meta[f.key] || {};

        if (f.type === 'checkbox') {
          const checked = value === true || value === 'true' || value === 1 || value === '1';
          return `
            <div class="form-group">
              <label class="form-checkbox-row">
                <input type="checkbox" data-key="${escapeHtml(f.key)}" ${checked ? 'checked' : ''} />
                <span>${escapeHtml(f.label)}</span>
              </label>
              ${f.help ? `<div class="form-help">${escapeHtml(f.help)}</div>` : ''}
            </div>
          `;
        }

        if (f.type === 'select') {
          return `
            <div class="form-group">
              <label class="form-label">${escapeHtml(f.label)}</label>
              <select class="form-input" data-key="${escapeHtml(f.key)}">
                ${(f.options || []).map(o => `<option value="${escapeHtml(o.value)}" ${String(value) === String(o.value) ? 'selected' : ''}>${escapeHtml(o.label)}</option>`).join('')}
              </select>
              ${f.help ? `<div class="form-help">${escapeHtml(f.help)}</div>` : ''}
            </div>
          `;
        }

        if (f.type === 'textarea') {
          return `
            <div class="form-group">
              <label class="form-label">${escapeHtml(f.label)}</label>
              <textarea class="form-textarea" data-key="${escapeHtml(f.key)}" rows="${f.rows || 4}" maxlength="${f.maxLength || 4000}">${escapeHtml(value)}</textarea>
              ${f.help ? `<div class="form-help">${escapeHtml(f.help)}</div>` : ''}
            </div>
          `;
        }

        if (f.type === 'secret') {
          const isMasked = value === '***';
          return `
            <div class="form-group">
              <label class="form-label">${escapeHtml(f.label)}</label>
              <div class="secret-input">
                ${isMasked
                  ? `<input class="form-input masked" value="••••••••••••" disabled />
                     <button class="btn btn-ghost" type="button" data-secret-replace="${escapeHtml(f.key)}">Ersetzen</button>`
                  : `<input class="form-input" type="password" data-key="${escapeHtml(f.key)}" data-secret="1" value="${escapeHtml(value || '')}" placeholder="${escapeHtml(f.placeholder || 'Neuen Wert eingeben…')}" />`}
              </div>
              ${f.help ? `<div class="form-help">${escapeHtml(f.help)}</div>` : ''}
              ${meta.updatedAt ? `<div class="form-help">Zuletzt aktualisiert: ${fmtDate(meta.updatedAt)}</div>` : ''}
            </div>
          `;
        }

        if (f.type === 'number') {
          return `
            <div class="form-group">
              <label class="form-label">${escapeHtml(f.label)}</label>
              <input class="form-input" type="number" data-key="${escapeHtml(f.key)}" value="${escapeHtml(value)}" ${f.min != null ? `min="${f.min}"` : ''} ${f.max != null ? `max="${f.max}"` : ''} placeholder="${escapeHtml(f.placeholder || '')}" />
              ${f.help ? `<div class="form-help">${escapeHtml(f.help)}</div>` : ''}
            </div>
          `;
        }

        if (f.type === 'readonly') {
          return `
            <div class="form-group">
              <label class="form-label">${escapeHtml(f.label)}</label>
              <input class="form-input" value="${escapeHtml(value)}" disabled />
              ${f.help ? `<div class="form-help">${escapeHtml(f.help)}</div>` : ''}
            </div>
          `;
        }

        // text (default)
        return `
          <div class="form-group">
            <label class="form-label">${escapeHtml(f.label)}</label>
            <input class="form-input" type="text" data-key="${escapeHtml(f.key)}" value="${escapeHtml(value)}" maxlength="${f.maxLength || 200}" placeholder="${escapeHtml(f.placeholder || '')}" />
            ${f.help ? `<div class="form-help">${escapeHtml(f.help)}</div>` : ''}
          </div>
        `;
      },

      attachEvents() {
        const self = this;
        document.querySelectorAll('[data-key]').forEach(el => {
          el.addEventListener('change', () => {
            const key = el.dataset.key;
            if (el.type === 'checkbox') {
              self._values[key] = el.checked ? 1 : 0;
            } else {
              self._values[key] = el.value;
            }
            self._updateDirtyBanner();
          });
          el.addEventListener('input', () => {
            const key = el.dataset.key;
            if (el.type === 'checkbox') return;
            self._values[key] = el.value;
            self._updateDirtyBanner();
          });
        });
        document.querySelectorAll('[data-secret-replace]').forEach(btn => {
          btn.addEventListener('click', () => {
            const key = btn.dataset.secretReplace;
            self._values[key] = '';
            self.renderForm();
            const input = document.querySelector(`[data-key="${key}"]`);
            input?.focus();
          });
        });
        document.querySelectorAll('[data-test-key]').forEach(btn => {
          btn.addEventListener('click', async () => {
            const key = btn.dataset.testKey;
            btn.disabled = true;
            try {
              const res = await API.botSettings.test(category, key, {});
              toast(res.data?.message || 'Test erfolgreich', 'success');
            } catch (err) {
              toast('Test fehlgeschlagen: ' + (err.message || ''), 'error');
            } finally {
              btn.disabled = false;
            }
          });
        });
        document.querySelectorAll('[data-danger-key]').forEach(btn => {
          btn.addEventListener('click', async () => {
            const action = config.dangerZone?.actions?.find(a => a.key === btn.dataset.dangerKey);
            if (!action) return;
            if (!confirm(action.confirm || 'Diese Aktion wirklich ausführen?')) return;
            btn.disabled = true;
            try {
              await action.handler();
              toast(action.successMsg || 'Aktion erfolgreich', 'success');
              if (action.reload !== false) await self.load();
            } catch (err) {
              toast('Fehler: ' + (err.message || 'Aktion fehlgeschlagen'), 'error');
            } finally {
              btn.disabled = false;
            }
          });
        });
        document.getElementById('s-save')?.addEventListener('click', () => self.save());
        document.getElementById('s-cancel')?.addEventListener('click', () => self.load());
      },

      async save() {
        const settings = [];
        for (const section of config.sections || []) {
          for (const f of section.fields || []) {
            if (f.type === 'readonly') continue;
            const value = this._values[f.key];
            // Skip unchanged secret values (still masked or empty after replace-click without entry)
            if (f.type === 'secret' && (value === '***' || value == null || value === '')) {
              if (this._loaded[f.key] === '***' || this._loaded[f.key] == null) continue;
            }
            settings.push({
              key: f.key,
              value: value ?? null,
              isSecret: f.type === 'secret',
            });
          }
        }
        try {
          await API.botSettings.update({ category, settings });
          toast('Einstellungen gespeichert.', 'success');
          await this.load();
        } catch (err) {
          toast('Fehler: ' + (err.message || 'Speichern fehlgeschlagen'), 'error');
        }
      },
    };
  },
};
