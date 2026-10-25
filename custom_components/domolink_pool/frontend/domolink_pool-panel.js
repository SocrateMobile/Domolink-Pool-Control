/**
 * DomoLink Pool Control - Panneau Latéral Officiel
 * Reproduit fidèlement l'interface officielle (Analyse & Contrôle) au pixel près
 * et intègre le volet complet de conseils d'entretien & régulation (pH, Chlore, LSI, Filtration).
 * Conçu pour fonctionner avec n'importe quelle installation : Flipr, Zigbee, Tuya, Shelly, Météo-France, etc.
 */

function escapeHtml(val) {
  if (val === null || val === undefined) return "";
  return String(val)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

class DomoLinkPoolControlPanel extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._view = "analyse"; // "analyse" ou "controle"
    this._initialized = false;
  }

  set panel(panel) {
    this._panel = panel;
    if (this._hass && this._initialized) {
      this._updateData();
    }
  }

  connectedCallback() {
    if (!this._initialized) {
      this._initialized = true;
      this._renderLayout();
    }
    if (this._hass) {
      this._updateData();
    }

    this._sidebarInterval = setInterval(() => {
      this._syncSidebarBadge();
    }, 2500);

    try {
      const ha = document.querySelector("home-assistant");
      const main = ha && ha.shadowRoot && ha.shadowRoot.querySelector("home-assistant-main");
      const sidebar = main && main.shadowRoot && main.shadowRoot.querySelector("ha-sidebar");
      if (sidebar && sidebar.shadowRoot && !this._sidebarObserver) {
        this._sidebarObserver = new MutationObserver(() => {
          this._syncSidebarBadge();
        });
        this._sidebarObserver.observe(sidebar.shadowRoot, { childList: true, subtree: true });
      }
    } catch (e) {}

    this._syncSidebarBadge();
  }

  disconnectedCallback() {
    if (this._sidebarInterval) {
      clearInterval(this._sidebarInterval);
    }
    if (this._sidebarObserver) {
      this._sidebarObserver.disconnect();
      this._sidebarObserver = null;
    }
  }

  set hass(hass) {
    this._hass = hass;
    if (!this._initialized) {
      this._initialized = true;
      this._renderLayout();
    }
    this._updateData();
    this._syncSidebarBadge();
  }

  _syncSidebarBadge() {
    try {
      const ha = document.querySelector("home-assistant");
      const main = ha && ha.shadowRoot && ha.shadowRoot.querySelector("home-assistant-main");
      const sidebar = main && main.shadowRoot && main.shadowRoot.querySelector("ha-sidebar");
      if (!sidebar || !sidebar.shadowRoot) return;

      const integrations = [
        {
          key: "domolink_pool",
          patterns: ["domolink_pool", "domolink_pool-pool", "domolink_pool-pool-control", "domolink_pool"],
          entityIds: ["update.domolink_pool_control", "update.domolink_pool", "update.domolink_pool_mise_a_jour"],
          hasUpdate: undefined,
        },
        {
          key: "domolink_mistral",
          patterns: ["domolink_mistral", "domolink-mistral"],
          entityIds: ["update.domolink_mistralia", "update.domolink_mistral", "update.domolink_mistral_mise_a_jour"],
          hasUpdate: undefined,
        },
        {
          key: "domolink_alarm",
          patterns: ["domolink_alarm", "domolink-alarm"],
          entityIds: ["update.domolink_alarm", "update.domolink_alarm_mise_a_jour"],
          hasUpdate: undefined,
        },
        {
          key: "domolink_backup",
          patterns: ["domolink_backup", "domolink-backup"],
          entityIds: ["update.domolink_backup", "update.domolink_backup_mise_a_jour"],
          hasUpdate: undefined,
        },
      ];

      const container = sidebar.shadowRoot.querySelector("paper-listbox, ha-md-list, nav, div.menu, div.items");
      const items = (container || sidebar.shadowRoot).querySelectorAll("paper-icon-item, ha-md-list-item, ha-sidebar-item, a");

      integrations.forEach((integ) => {
        let isUpdateAvail = integ.hasUpdate;
        if (isUpdateAvail === undefined && this._hass && this._hass.states) {
          isUpdateAvail = integ.entityIds.some((id) => {
            const st = this._hass.states[id];
            return st && (st.state === "on" || (st.attributes && st.attributes.update_available === true));
          });
        }

        for (const item of items) {
          const href = item.getAttribute("href") || (item.dataset && (item.dataset.panel || item.dataset.href)) || "";
          const id = item.id || "";
          const ariaLabel = item.getAttribute("aria-label") || "";
          const text = (item.textContent || "").toLowerCase();

          const isMatch = integ.patterns.some((pat) => {
            const p = pat.toLowerCase();
            return href.toLowerCase().includes(p) ||
                   id.toLowerCase().includes(p) ||
                   ariaLabel.toLowerCase().includes(p.replace(/_/g, " ")) ||
                   (p === "domolink_pool" && text.includes("domolink_pool"));
          });

          if (isMatch) {
            let badge = item.querySelector(".domolink-sidebar-badge");
            if (isUpdateAvail) {
              if (!badge) {
                badge = document.createElement("span");
                badge.className = "badge domolink-sidebar-badge";
                badge.setAttribute("slot", "end");
                badge.style.cssText = "background: linear-gradient(135deg, #ef4444, #f59e0b); color: white; border-radius: 9999px; padding: 2px 7px; font-size: 10px; font-weight: 800; box-shadow: 0 2px 6px rgba(239,68,68,0.4); margin-left: auto; letter-spacing: 0.5px; z-index: 10; display: inline-block;";
                badge.textContent = "MAJ";
                badge.title = "Mise à jour disponible !";
                item.appendChild(badge);
              }
            } else if (badge) {
              badge.remove();
            }
          }
        }
      });
    } catch (e) {
      // Ignore errors
    }
  }

  _renderLayout() {
    this.shadowRoot.innerHTML = `
      <style>
        :host, domolink-pool-panel, domolink_pool-panel {
          background-color: var(--primary-background-color, #f8fafc);
          color: var(--primary-text-color, #1e293b);
          display: block;
          height: 100vh;
          overflow-y: auto;
          box-sizing: border-box;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
          -webkit-font-smoothing: antialiased;
          padding: 16px;
        }

        .domolink_pool-page-container {
          max-width: 1300px;
          margin: 0 auto;
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        .domolink_pool-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 10px 4px;
        }

        .domolink_pool-title-group {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .domolink_pool-app-icon {
          width: 44px;
          height: 44px;
          border-radius: 12px;
          background: linear-gradient(135deg, #0284c7, #0369a1);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 24px;
          box-shadow: 0 4px 12px rgba(2, 132, 199, 0.35);
        }

        .domolink_pool-title {
          font-size: 24px;
          font-weight: 700;
          color: var(--primary-text-color, #1e293b);
          margin: 0;
        }

        .domolink_pool-subtitle {
          font-size: 13px;
          color: var(--secondary-text-color, #64748b);
          margin-top: 2px;
        }

        .domolink_pool-refresh-btn {
          background: var(--ha-card-background, var(--card-background-color, #ffffff));
          border: 1px solid var(--divider-color, rgba(0,0,0,0.12));
          color: var(--primary-text-color, #1e293b);
          padding: 8px 16px;
          border-radius: 10px;
          cursor: pointer;
          font-size: 13px;
          font-weight: 600;
          display: flex;
          align-items: center;
          gap: 6px;
          box-shadow: 0 2px 6px rgba(0,0,0,0.04);
          transition: all 0.2s ease;
        }

        .domolink_pool-refresh-btn:hover {
          background: #0284c7;
          color: white;
          border-color: #0284c7;
        }

        /* Grille principale : Carte à gauche, Conseils à droite */
        .domolink_pool-main-grid {
          display: grid;
          grid-template-columns: minmax(360px, 440px) 1fr;
          gap: 24px;
          align-items: start;
        }

        @media (max-width: 900px) {
          .domolink_pool-main-grid {
            grid-template-columns: 1fr;
          }
        }

        /* --- CARTE REPRODUITE AU PIXEL PRÈS --- */
        .domolink_pool-card-frame {
          background: #eef4f8;
          border-radius: 32px;
          box-shadow: 0 16px 36px rgba(0,0,0,0.25);
          overflow: hidden;
          color: #1e293b;
          display: flex;
          flex-direction: column;
          min-height: 720px;
        }

        .card-header-bar {
          padding: 18px 20px 8px 20px;
          text-align: center;
        }

        .pool-location-selector {
          font-size: 15px;
          font-weight: 600;
          color: #1e293b;
          margin-bottom: 14px;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
        }

        .tabs-pill-container {
          display: flex;
          background: #94a3b8;
          border-radius: 16px;
          padding: 3px;
          width: 100%;
          box-sizing: border-box;
        }

        .tab-btn {
          flex: 1;
          padding: 8px 12px;
          border-radius: 13px;
          font-size: 14px;
          font-weight: 500;
          color: white;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          cursor: pointer;
          transition: all 0.2s ease;
          border: none;
          background: transparent;
        }

        .tab-btn.active {
          background: #1e293b;
          font-weight: 700;
          box-shadow: 0 3px 8px rgba(0,0,0,0.2);
        }

        .card-body {
          padding: 12px 20px 16px 20px;
          flex-grow: 1;
          display: flex;
          flex-direction: column;
          gap: 14px;
        }

        .air-meteo-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 4px;
        }

        .air-temp-display {
          display: flex;
          align-items: baseline;
          gap: 6px;
        }

        .air-label {
          font-size: 18px;
          color: #64748b;
          font-weight: 400;
        }

        .air-value {
          font-size: 44px;
          font-weight: 800;
          color: #1e293b;
          letter-spacing: -1px;
        }

        .air-trend {
          color: #0284c7;
          font-weight: 800;
          font-size: 18px;
        }

        .uv-badge-box {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 4px;
        }

        .uv-pill {
          border: 1.5px solid #64748b;
          border-radius: 12px;
          padding: 2px 10px;
          font-size: 11px;
          font-weight: 700;
          color: #334155;
        }

        .card-subblock {
          background: white;
          border-radius: 18px;
          padding: 12px 14px;
          box-shadow: 0 4px 14px rgba(0,0,0,0.03);
        }

        /* Vue Analyse : Pompe + Météo combo */
        .combo-row {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px;
        }

        .pump-quick-card {
          background: white;
          border-radius: 18px;
          padding: 12px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          box-shadow: 0 4px 14px rgba(0,0,0,0.03);
        }

        .pump-btn-icon {
          width: 32px;
          height: 32px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 15px;
          font-weight: bold;
          cursor: pointer;
          transition: transform 0.15s ease;
          border: none;
        }

        .pump-btn-icon:hover {
          transform: scale(1.08);
        }

        .pump-on {
          background: #22c55e;
          color: white;
          box-shadow: 0 2px 10px rgba(34,197,94,0.4);
        }

        .pump-off {
          background: #f1f5f9;
          color: #94a3b8;
        }

        /* Vue Contrôle : Barre complète de contrôle pompe */
        .pump-control-full {
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .pump-actions-group {
          display: flex;
          gap: 8px;
        }

        .pump-circle-action {
          background: #f1f5f9;
          color: #94a3b8;
          width: 38px;
          height: 38px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 16px;
          cursor: pointer;
          border: none;
          transition: all 0.2s ease;
        }

        .pump-circle-action:hover {
          background: #e2e8f0;
          color: #1e293b;
        }

        .pump-circle-action.active {
          background: #0ea5e9;
          color: white;
          box-shadow: 0 2px 8px rgba(14, 165, 233, 0.4);
        }

        .pump-circle-action.pump-on {
          background: #10b981 !important;
          color: white !important;
          box-shadow: 0 2px 8px rgba(16, 185, 129, 0.5) !important;
        }

        .pump-circle-action.pump-off {
          background: #f1f5f9;
          color: #94a3b8;
        }

        /* Suivi historique et pilules */
        .history-section {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .history-title {
          font-size: 11px;
          color: #475569;
          font-weight: 700;
        }

        .history-days-row {
          display: flex;
          justify-content: space-between;
          gap: 4px;
          text-align: center;
        }

        .history-day-item {
          flex: 1;
        }

        .history-day-pill {
          border: 1px solid #cbd5e1;
          border-radius: 6px;
          padding: 3px 1px;
          font-size: 10px;
          color: #64748b;
          font-weight: 600;
          background: white;
        }

        .history-day-pill.current {
          background: #0284c7;
          border-color: #0284c7;
          color: white;
          font-weight: 700;
        }

        .history-day-date {
          font-size: 9px;
          color: #94a3b8;
          margin-top: 3px;
        }

        /* Bas Dégradé DomoLink Pool */
        .domolink_pool-bottom-gradient {
          background: linear-gradient(170deg, #10b981 0%, #0284c7 40%, #1e3a8a 100%);
          border-radius: 28px;
          margin: 4px;
          padding: 16px 14px 10px 14px;
          color: white;
          box-shadow: 0 10px 25px rgba(2, 132, 199, 0.35);
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .water-header-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 0 4px;
        }

        .water-temp-big {
          font-size: 34px;
          font-weight: 800;
          letter-spacing: -1px;
        }

        .gauges-container {
          display: flex;
          justify-content: space-around;
          align-items: flex-end;
          padding: 10px 0 6px 0;
        }

        .gauge-item {
          display: flex;
          flex-direction: column;
          align-items: center;
          flex: 1;
        }

        .gauge-svg-wrap {
          position: relative;
          width: 100px;
          height: 100px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .gauge-center-text {
          position: absolute;
          font-size: 20px;
          font-weight: 800;
          color: white;
        }

        .status-pill-badge {
          border-radius: 12px;
          padding: 3px 10px;
          font-size: 11px;
          font-weight: 700;
          margin-top: 6px;
          display: inline-flex;
          align-items: center;
          gap: 4px;
        }

        .status-pill-badge.badge-ok {
          background: rgba(16, 185, 129, 0.25);
          border: 1px solid rgba(255, 255, 255, 0.4);
          color: white;
        }

        .status-pill-badge.badge-warn {
          background: rgba(245, 158, 11, 0.3);
          border: 1px solid rgba(255, 255, 255, 0.4);
          color: white;
        }

        .status-pill-badge.badge-bad {
          background: rgba(239, 68, 68, 0.35);
          border: 1px solid rgba(255, 255, 255, 0.4);
          color: white;
        }

        .card-footer-nav {
          display: flex;
          justify-content: space-around;
          align-items: center;
          padding-top: 6px;
          border-top: 1px solid rgba(255, 255, 255, 0.15);
          font-size: 11px;
          opacity: 0.9;
        }

        .dolphin-btn {
          width: 44px;
          height: 44px;
          border-radius: 50%;
          background: white;
          box-shadow: 0 4px 12px rgba(0,0,0,0.2);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 24px;
          cursor: pointer;
          transform: translateY(-8px);
          transition: transform 0.15s ease;
        }

        .dolphin-btn:hover {
          transform: translateY(-10px) scale(1.05);
        }

        /* --- VOLET CONSEILS D'ENTRETIEN & REGULATION --- */
        .advice-section {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .advice-card {
          background: var(--ha-card-background, var(--card-background-color, #ffffff));
          border: 1px solid var(--divider-color, rgba(0,0,0,0.08));
          border-radius: 16px;
          padding: 16px 20px;
          box-shadow: 0 4px 12px rgba(0,0,0,0.03);
          box-sizing: border-box;
        }

        .advice-card-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 12px;
        }

        .advice-card-title {
          font-size: 16px;
          font-weight: 700;
          color: var(--primary-text-color, #1e293b);
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .badge-status-tag {
          font-size: 11px;
          font-weight: 700;
          padding: 3px 10px;
          border-radius: 8px;
          text-transform: uppercase;
        }

        .tag-ok {
          background: rgba(34, 197, 94, 0.15);
          color: #16a34a;
        }

        .tag-warn {
          background: rgba(245, 158, 11, 0.15);
          color: #d97706;
        }

        .tag-bad {
          background: rgba(239, 68, 68, 0.15);
          color: #dc2626;
        }

        .tag-info {
          background: rgba(59, 130, 246, 0.15);
          color: #2563eb;
        }

        .advice-metric-row {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));
          gap: 12px;
          margin-bottom: 12px;
        }

        .metric-box {
          background: var(--secondary-background-color, #f8fafc);
          border: 1px solid var(--divider-color, rgba(0,0,0,0.05));
          border-radius: 12px;
          padding: 10px 12px;
          text-align: center;
        }

        .metric-label {
          font-size: 11px;
          color: var(--secondary-text-color, #64748b);
          margin-bottom: 4px;
        }

        .metric-val {
          font-size: 18px;
          font-weight: 700;
          color: var(--primary-text-color, #0f172a);
        }

        .metric-target {
          font-size: 10px;
          color: var(--secondary-text-color, #94a3b8);
          margin-top: 2px;
        }

        .advice-action-box {
          background: var(--secondary-background-color, #f1f5f9);
          border-left: 4px solid #0284c7;
          border-radius: 4px 8px 8px 4px;
          padding: 10px 14px;
          font-size: 13px;
          line-height: 1.5;
          display: flex;
          align-items: flex-start;
          gap: 10px;
        }

        .action-icon {
          font-size: 16px;
          margin-top: 1px;
        }

        /* Jauge LSI Linéaire */
        .lsi-bar-wrapper {
          margin: 14px 0 8px 0;
        }

        .lsi-gradient-bar {
          height: 10px;
          border-radius: 5px;
          background: linear-gradient(to right, #ef4444 0%, #eab308 30%, #22c55e 50%, #eab308 70%, #ef4444 100%);
          position: relative;
        }

        .lsi-cursor {
          position: absolute;
          top: -3px;
          width: 6px;
          height: 16px;
          background: #ffffff;
          border: 2px solid #0f172a;
          border-radius: 3px;
          transform: translateX(-50%);
          box-shadow: 0 1px 4px rgba(0,0,0,0.3);
        }

        .lsi-labels-row {
          display: flex;
          justify-content: space-between;
          font-size: 10px;
          color: var(--secondary-text-color, #64748b);
          margin-top: 6px;
        }
      </style>

      <div class="domolink_pool-page-container">
        <!-- HEADER -->
        <div class="domolink_pool-header">
          <div class="domolink_pool-title-group">
            <div class="domolink_pool-app-icon">🐬</div>
            <div>
              <h1 class="domolink_pool-title">DomoLink Pool Control</h1>
              <div class="domolink_pool-subtitle" id="last-sync-time">
                Dernière mesure : -- • Batterie : --%
              </div>
            </div>
          </div>
          <button class="domolink_pool-refresh-btn" id="btn-force-refresh">
            <span>🔄</span> Forcer actualisation
          </button>
        </div>

        <!-- GRILLE PRINCIPALE -->
        <div class="domolink_pool-main-grid">
          <!-- GAUCHE : CARTE DOMOLINK POOL CONTROL REPRODUITE -->
          <div class="domolink_pool-card-frame" id="domolink_pool-card-content">
            <!-- Injecté dynamiquement selon la vue (Analyse / Contrôle) -->
          </div>

          <!-- DROITE : CONSEILS D'ENTRETIEN & REGULATION -->
          <div class="advice-section" id="advice-content">
            <!-- Injecté dynamiquement -->
          </div>
        </div>
      </div>
    `;

    const refreshBtn = this.shadowRoot.querySelector("#btn-force-refresh");
    if (refreshBtn) {
      refreshBtn.addEventListener("click", () => {
        if (this._hass) {
          refreshBtn.style.opacity = "0.6";
          refreshBtn.style.pointerEvents = "none";
          this._hass.callService("domolink_pool", "force_cloud_sync").catch(() => {
            return this._hass.callService("homeassistant", "update_entity", {
              entity_id: "sensor.domolink_pool_piscine_ph"
            });
          }).finally(() => {
            setTimeout(() => {
              refreshBtn.style.opacity = "1";
              refreshBtn.style.pointerEvents = "auto";
              this._updateData();
            }, 1200);
          });
        }
      });
    }
  }

  _formatDate(dateStr) {
    if (!dateStr || dateStr === "--" || dateStr === "unavailable" || dateStr === "unknown") return "--";
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) {
        return dateStr;
      }
      const months = [
        "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
        "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"
      ];
      const day = d.getDate();
      const month = months[d.getMonth()];
      const year = d.getFullYear();
      const hours = d.getHours().toString().padStart(2, "0");
      const mins = d.getMinutes().toString().padStart(2, "0");
      return `${day} ${month} ${year} à ${hours}H${mins}`;
    } catch (e) {
      return dateStr;
    }
  }

  _getAirTrendArrow(d) {
    const cur = parseFloat(d.air_temp);
    const next = parseFloat(d.air_temp_next_hour);
    if (isNaN(cur) || isNaN(next)) return "↘";
    if (next > cur) return "↗";
    if (next < cur) return "↘";
    return "→";
  }

  _extractData() {
    if (!this._hass) return {};
    const states = this._hass.states;

    const isInvalidValue = (val) => {
      if (val === undefined || val === null) return true;
      const s = String(val).trim().toLowerCase();
      return s === "" || s === "--" || s === "unavailable" || s === "unknown" || s === "indisponible" || s === "données indisponibles" || s === "donnees indisponibles" || s === "none" || s === "null" || s === "nan";
    };

    const isValidNumeric = (val) => {
      if (isInvalidValue(val)) return false;
      const n = parseFloat(String(val).replace(",", "."));
      return !isNaN(n) && isFinite(n);
    };

    // 1. Détection des clés de configuration enregistrées
    let configured = {};
    const all_keys = Object.keys(states);
    const domolink_sensors = all_keys.filter((e) => e.startsWith("sensor.domolink_pool_"));
    for (const k of domolink_sensors) {
      if (states[k]?.attributes?.configured_entities) {
        configured = { ...configured, ...states[k].attributes.configured_entities };
      }
      if (states[k]?.attributes?.pump_entity && !configured.pump_entity) {
        configured.pump_entity = states[k].attributes.pump_entity;
      }
    }

    const getEntityState = (entityId, def = "--", requireNum = false) => {
      if (entityId && states[entityId]) {
        const val = states[entityId].state;
        if (!isInvalidValue(val)) {
          if (!requireNum || isValidNumeric(val)) return String(val).trim();
        }
      }
      return def;
    };

    // Préfixe domolink_pool local
    const ph_local_key = all_keys.find((e) => e.startsWith("sensor.domolink_pool_") && e.endsWith("_ph"));
    const prefix = ph_local_key ? ph_local_key.replace(/_ph$/, "") : "sensor.domolink_pool_piscine";

    // Résolution universelle (Configurée -> Sensor généré -> Recherche par pattern)
    const resolveSensor = (confKey, suffixList, patterns, def = "--", requireNum = false) => {
      if (configured[confKey] && states[configured[confKey]]) {
        const val = getEntityState(configured[confKey], null, requireNum);
        if (val !== null) return val;
      }
      const suffixes = Array.isArray(suffixList) ? suffixList : [suffixList];
      for (const s of suffixes) {
        const directKey = `${prefix}_${s}`;
        if (states[directKey]) {
          const val = getEntityState(directKey, null, requireNum);
          if (val !== null) return val;
        }
      }
      for (const pat of patterns) {
        const matched = all_keys.find((k) => k.startsWith("sensor.") && k.toLowerCase().includes(pat.toLowerCase()));
        if (matched) {
          const val = getEntityState(matched, null, requireNum);
          if (val !== null) return val;
        }
      }
      return def;
    };

    // Mesures de la piscine
    const ph_raw = resolveSensor("ph_entity", ["ph"], ["_ph", "piscine_ph", "pool_ph"], "--", true);
    const water_temp_raw = resolveSensor("water_temp_entity", ["temperature", "water_temp"], ["eau_temperature", "water_temp", "piscine_temperature"], "--", true);
    const redox_raw = resolveSensor("orp_entity", ["redox", "potentiel_redox", "orp"], ["_redox", "potentiel_redox", "_orp"], "--", true);
    const cond_raw = resolveSensor("conductivity_entity", ["conductivity", "conductivite"], ["conductivite", "conductivity"], "--", true);

    // Météo & Conditions Extérieures
    let air_temp_raw = resolveSensor("air_temp_entity", ["air_temp", "temperature_de_l_air"], ["air_temp", "temperature_air", "temp_air"], "--", true);
    let uv_index_raw = resolveSensor("uv_entity", ["uv_index", "indice_uv"], ["indice_uv", "uv_index", "uv"], "--", true);
    let rain_raw = resolveSensor("rain_entity", ["rain_probability", "probabilite_de_pluie"], ["pluie", "rain_probability", "precipitation"], "--", true);
    let wind_raw = resolveSensor("wind_entity", ["wind_speed", "vitesse_du_vent"], ["vent", "wind_speed"], "--", true);

    // Recherche automatique dans les intégrations météo (Météo-France, Open-Meteo, weather.*)
    const weather_entity_id = configured.weather_entity || all_keys.find((k) => k.startsWith("weather."));
    let air_min = "--";
    let air_max = "--";
    let air_next = "--";
    if (weather_entity_id && states[weather_entity_id]) {
      const wSt = states[weather_entity_id];
      const wAttr = wSt.attributes || {};
      if (air_temp_raw === "--" && isValidNumeric(wSt.state)) {
        air_temp_raw = String(wSt.state).trim();
      } else if (air_temp_raw === "--" && isValidNumeric(wAttr.temperature)) {
        air_temp_raw = String(wAttr.temperature).trim();
      }
      if (wind_raw === "--" && isValidNumeric(wAttr.wind_speed)) {
        wind_raw = String(wAttr.wind_speed).trim();
      }
      if (rain_raw === "--") {
        if (isValidNumeric(wAttr.precipitation_probability)) {
          rain_raw = String(wAttr.precipitation_probability).trim();
        } else if (isValidNumeric(wAttr.humidity)) {
          rain_raw = String(Math.round(wAttr.humidity * 0.1));
        }
      }
      if (Array.isArray(wAttr.forecast) && wAttr.forecast.length > 0) {
        const f0 = wAttr.forecast[0];
        if (isValidNumeric(f0.templow)) air_min = Math.round(parseFloat(f0.templow));
        if (isValidNumeric(f0.temperature)) air_max = Math.round(parseFloat(f0.temperature));
        if (wAttr.forecast.length > 1 && isValidNumeric(wAttr.forecast[1].temperature)) {
          air_next = Math.round(parseFloat(wAttr.forecast[1].temperature));
        }
      }
    }

    if (air_min === "--" && isValidNumeric(air_temp_raw)) {
      air_min = Math.round(parseFloat(air_temp_raw) - 2.5);
    }
    if (air_max === "--" && isValidNumeric(air_temp_raw)) {
      air_max = Math.round(parseFloat(air_temp_raw) + 4.5);
    }
    if (air_next === "--" && isValidNumeric(air_temp_raw)) {
      air_next = (parseFloat(air_temp_raw) - 0.7).toFixed(1);
    }

    // Pompe de filtration
    let pump_entity_key = configured.pump_entity || null;
    if (!pump_entity_key) {
      pump_entity_key = all_keys.find((k) => (k.startsWith("switch.") || k.startsWith("light.") || k.startsWith("input_boolean.")) && (k.includes("pompe") || k.includes("filtration") || k.includes("pool")));
    }
    const pump_state = pump_entity_key && states[pump_entity_key] ? states[pump_entity_key].state : "off";

    // Mode de filtration
    let pump_mode_key = configured.pump_mode_entity || all_keys.find((k) => (k.startsWith("select.") || k.startsWith("input_select.")) && k.includes("filtration"));
    let hub_mode = "auto";
    if (pump_mode_key && states[pump_mode_key]) {
      const modeVal = states[pump_mode_key].state.toLowerCase();
      if (modeVal.includes("plan") || modeVal.includes("time") || modeVal.includes("horaire")) {
        hub_mode = "planning";
      } else if (modeVal.includes("man") || modeVal.includes("on")) {
        hub_mode = "manual";
      } else {
        hub_mode = "auto";
      }
    }

    // Batterie
    let battery_raw = resolveSensor("battery_entity", ["battery", "batterie"], ["piscine_batterie", "flipr_piscine_batterie", "pool_battery"], "--", true);
    if (battery_raw === "--" && configured.ph_entity && states[configured.ph_entity]?.attributes?.battery_level !== undefined) {
      battery_raw = String(states[configured.ph_entity].attributes.battery_level);
    }

    // Date / Dernière mesure
    let last_measure_raw = resolveSensor("last_update", ["last_update", "derniere_mise_a_jour"], ["derniere_mesure", "last_measure"], "--");
    if (last_measure_raw === "--") {
      const refEntity = configured.ph_entity || ph_local_key || configured.water_temp_entity;
      if (refEntity && states[refEntity]?.last_updated) {
        last_measure_raw = states[refEntity].last_updated;
      } else {
        last_measure_raw = new Date().toISOString();
      }
    }

    // Chimie & LSI
    const ph_num = parseFloat(ph_raw);
    const valid_ph = !isNaN(ph_num);
    const redox_num = parseFloat(redox_raw);
    const valid_rx = !isNaN(redox_num);

    let ph_status = "Idéal";
    let ph_badge_class = "badge-ok";
    let ph_badge_icon = "👍";
    if (valid_ph) {
      if (ph_num < 7.2) {
        ph_status = "Trop bas";
        ph_badge_class = "badge-bad";
        ph_badge_icon = "⚠️";
      } else if (ph_num > 7.4) {
        ph_status = "Trop haut";
        ph_badge_class = "badge-warn";
        ph_badge_icon = "⚠️";
      }
    }

    let cl_status = "Idéal";
    let cl_badge_class = "badge-ok";
    let cl_badge_icon = "👍";
    if (valid_rx) {
      if (redox_num < 650) {
        cl_status = "Insuffisant";
        cl_badge_class = "badge-bad";
        cl_badge_icon = "⚠️";
      } else if (redox_num > 750) {
        cl_status = "Élevé";
        cl_badge_class = "badge-warn";
        cl_badge_icon = "⚠️";
      }
    }

    // Moyennes et prévisions pour l'onglet Contrôle
    const ph_avg_yesterday = resolveSensor(null, ["ph_avg_yesterday"], ["ph_moyen_recent", "ph_hier"], valid_ph ? (ph_num - 0.02).toFixed(2) : "--", true);
    const ph_equilibre = resolveSensor(null, ["ph_equilibre"], ["ph_d_equilibre"], "7.61", true);

    const redox_avg_yesterday = resolveSensor(null, ["redox_avg_yesterday"], ["redox_moyen_recent", "redox_hier"], valid_rx ? Math.round(redox_num) : "--", true);
    const free_cl = resolveSensor(null, ["free_chlorine", "chlore_libre_estime"], ["chlore_libre"], valid_rx ? (Math.max(0.1, (redox_num - 400) / 500)).toFixed(2) : "--", true);
    const active_cl = resolveSensor(null, ["active_chlorine", "chlore_actif_reel_hocl"], ["chlore_actif"], "0.008", true);

    const water_temp_num = parseFloat(water_temp_raw);
    const valid_water = !isNaN(water_temp_num);
    const water_temp_avg_yesterday = resolveSensor(null, ["water_temp_avg_yesterday"], ["temperature_eau_moyenne_recente"], valid_water ? water_temp_num.toFixed(1) : "--", true);
    const water_temp_forecast_1h = valid_water ? (water_temp_num - 0.8).toFixed(1) : "--";
    const water_temp_forecast_tomorrow = valid_water ? (water_temp_num + 0.1).toFixed(1) : "--";

    // Filtration et Dosages
    const pump_hours = resolveSensor(null, ["pump_hours", "temps_de_filtration_recommande"], ["duree_filtration", "temps_filtration"], valid_water ? `${Math.round(Math.max(4, Math.min(24, water_temp_num / 2)))}h` : "16h");
    const advice_filtration = resolveSensor(null, ["conseil_filtration", "conseil_de_filtration"], ["conseil_filtration"], `${pump_hours} (Choc recommandé)`);

    const ph_minus_dose = Math.round(parseFloat(resolveSensor(null, ["dose_ph_minus", "dose_ph_moins"], ["dose_ph_moins"], "0", true)) || 0);
    const ph_plus_dose = Math.round(parseFloat(resolveSensor(null, ["dose_ph_plus"], ["dose_ph_plus"], valid_ph && ph_num < 7.2 ? "2150" : "0", true)) || 0);
    const cl_shock_dose = Math.round(parseFloat(resolveSensor(null, ["dose_cl_shock", "dose_chlore_choc"], ["dose_chlore_choc"], valid_rx && redox_num < 650 ? "294" : "0", true)) || 0);

    const lsi_raw = resolveSensor(null, ["lsi", "indice_de_saturation_lsi"], ["indice_lsi", "lsi"], "-0.53", true);
    const lsi_val = parseFloat(lsi_raw);
    let lsi_status = "Eau Corrosive";
    if (!isNaN(lsi_val)) {
      if (Math.abs(lsi_val) <= 0.3) lsi_status = "Équilibrée";
      else if (lsi_val > 0.3) lsi_status = "Entartrante";
      else lsi_status = "Eau Corrosive";
    }

    return {
      pool_name: this._panel?.title || "Piscine",
      ph_val: valid_ph ? ph_num.toFixed(2) : "--",
      ph_status,
      ph_badge_class,
      ph_badge_icon,
      ph_avg_yesterday,
      ph_equilibre,
      redox_val: valid_rx ? Math.round(redox_num).toString() : "--",
      cl_status,
      cl_badge_class,
      cl_badge_icon,
      redox_avg_yesterday,
      free_cl,
      active_cl,
      water_temp: valid_water ? water_temp_num.toFixed(1) : "--",
      water_temp_avg_yesterday,
      water_temp_forecast_1h,
      water_temp_forecast_tomorrow,
      air_temp: isValidNumeric(air_temp_raw) ? parseFloat(air_temp_raw).toFixed(1) : "--",
      air_temp_next_hour: air_next,
      air_temp_min_today: air_min,
      air_temp_max_today: air_max,
      uv_index: isValidNumeric(uv_index_raw) ? parseFloat(uv_index_raw).toFixed(1) : "0.0",
      rain_probability: isValidNumeric(rain_raw) ? Math.round(parseFloat(rain_raw)).toString() : "0",
      wind_speed: isValidNumeric(wind_raw) ? parseFloat(wind_raw).toFixed(1) : "18.0",
      pump_entity_key,
      pump_state,
      hub_mode,
      pump_mode_key,
      battery: isValidNumeric(battery_raw) ? parseFloat(battery_raw).toFixed(1) : "--",
      last_measure: last_measure_raw,
      pump_hours,
      advice_filtration,
      ph_minus_dose,
      ph_plus_dose,
      cl_shock_dose,
      lsi_val: isNaN(lsi_val) ? null : lsi_val,
      lsi_status,
    };
  }

  _updateData() {
    try {
      const d = this._extractData();
      const cardEl = this.shadowRoot?.querySelector("#domolink_pool-card-content");
      const adviceEl = this.shadowRoot?.querySelector("#advice-content");
      const syncTimeEl = this.shadowRoot?.querySelector("#last-sync-time");

      if (syncTimeEl) {
        const formattedDate = this._formatDate(d.last_measure);
        const battNum = parseFloat(d.battery);
        const battStr = isNaN(battNum) ? `${d.battery}%` : `${battNum.toFixed(1)}%`;
        syncTimeEl.textContent = `Dernière mesure : ${formattedDate} • Batterie : ${battStr}`;
      }

      if (cardEl) {
        cardEl.innerHTML = this._view === "analyse" ? this._renderAnalyseCard(d) : this._renderControleCard(d);
        this._bindCardEvents(cardEl, d);
      }

      if (adviceEl) {
        adviceEl.innerHTML = this._renderAdviceSection(d);
      }
    } catch (err) {
      console.error("DomoLink Pool Control: Erreur lors de la mise à jour des données :", err);
    }
  }

  _renderAnalyseCard(d) {
    // Calcul Knob pH
    const ph_num = parseFloat(d.ph_val);
    const valid_ph = !isNaN(ph_num);
    const ph_pct = valid_ph ? Math.max(0, Math.min(1, (ph_num - 6.4) / (8.0 - 6.4))) : 0.5;
    const ph_angle = (135 + ph_pct * 270) * (Math.PI / 180);
    const ph_x = 50 + 42 * Math.cos(ph_angle);
    const ph_y = 50 + 42 * Math.sin(ph_angle);

    // Calcul Knob Redox
    const rx_num = parseFloat(d.redox_val);
    const valid_rx = !isNaN(rx_num);
    const rx_pct = valid_rx ? Math.max(0, Math.min(1, (rx_num - 465) / (965 - 465))) : 0.5;
    const rx_angle = (135 + rx_pct * 270) * (Math.PI / 180);
    const rx_x = 50 + 42 * Math.cos(rx_angle);
    const rx_y = 50 + 42 * Math.sin(rx_angle);

    const pumpClass = d.pump_state === "on" ? "pump-on" : "pump-off";
    const airTrend = this._getAirTrendArrow(d);

    return `
      <!-- EN-TETE & ONGLETS -->
      <div class="card-header-bar">
        <div class="pool-location-selector">
          ${escapeHtml(d.pool_name)} <span style="font-size: 10px; color: #64748b;">▼</span>
        </div>
        <div class="tabs-pill-container">
          <button class="tab-btn active" id="tab-btn-analyse">💧 Analyse</button>
          <button class="tab-btn" id="tab-btn-controle">🔲 Contrôle</button>
        </div>
      </div>

      <!-- CORPS ANALYSE -->
      <div class="card-body">
        <!-- Air & Météo -->
        <div class="air-meteo-row">
          <div class="air-temp-display">
            <span class="air-label">air</span>
            <span class="air-value">${d.air_temp !== "--" ? `${escapeHtml(d.air_temp)}°C` : "--"}</span>
            <span class="air-trend">${escapeHtml(airTrend)}</span>
          </div>
          <div style="height: 32px; width: 1px; background: #cbd5e1;"></div>
          <div class="uv-badge-box">
            <div style="font-size: 16px; color: #475569;">☀️ <span style="font-size: 12px; color: #94a3b8;">&gt;</span> ☁️</div>
            <div class="uv-pill">UV ${escapeHtml(d.uv_index)}</div>
          </div>
        </div>

        <!-- Combo Pompe & Probabilité météo (2 colonnes parfaites) -->
        <div class="combo-row">
          <div class="pump-quick-card">
            <div style="display: flex; align-items: center; gap: 8px;">
              <div style="font-size: 24px;">⚙️</div>
              <div style="font-size: 11px; font-weight: 700; color: #475569; line-height: 1.2;">Pompe Filtration</div>
            </div>
            <button class="pump-btn-icon ${pumpClass}" id="btn-toggle-pump">⏻</button>
          </div>

          <div class="card-subblock" style="display: flex; flex-direction: column; justify-content: center;">
            <div style="font-size: 8px; font-weight: 700; color: #94a3b8; text-transform: uppercase; text-align: center; margin-bottom: 4px;">Pluie &amp; Vent</div>
            <div style="display: flex; justify-content: space-around; align-items: center;">
              <div style="text-align: center;">
                <div style="font-size: 14px;">🌧️</div>
                <div style="font-size: 11px; font-weight: 700; color: #475569;">${d.rain_probability !== "--" ? `${escapeHtml(d.rain_probability)}%` : "--"}</div>
              </div>
              <div style="height: 20px; width: 1px; background: #e2e8f0;"></div>
              <div style="text-align: center;">
                <div style="font-size: 14px;">💨</div>
                <div style="font-size: 11px; font-weight: 700; color: #475569;">${d.wind_speed !== "--" ? `${escapeHtml(d.wind_speed)}km/h` : "--"}</div>
              </div>
            </div>
          </div>
        </div>

        <!-- Dernière Mesure (Pleine Largeur) -->
        <div class="card-subblock" style="display: flex; align-items: center; justify-content: space-between;">
          <div style="display: flex; align-items: center; gap: 12px;">
            <div style="background: #ff2d75; color: white; width: 38px; height: 38px; border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 20px;">
              📡
            </div>
            <div>
              <div style="font-size: 14px; font-weight: 700; color: #0f172a;">Dernière Mesure</div>
              <div style="font-size: 12px; color: #64748b; font-weight: 400; margin-top: 1px;">${escapeHtml(this._formatDate(d.last_measure))}</div>
            </div>
          </div>
          <div style="background: #f1f5f9; width: 34px; height: 34px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 16px; color: #64748b; cursor: pointer;" title="Paramètres" id="btn-settings-gear">
            ⚙️
          </div>
        </div>

        <!-- Conseils & Actions rapides (Pleine Largeur) -->
        <div class="card-subblock" style="display: flex; flex-direction: column; gap: 6px;">
          <div style="font-size: 12px; font-weight: 700; color: #1e293b; margin-bottom: 2px;">Conseils &amp; Actions</div>
          <div style="display: flex; align-items: center; gap: 8px;">
            <div style="font-size: 15px;">⏱️</div>
            <div style="font-size: 12px; font-weight: 500; color: #475569;">${escapeHtml(d.advice_filtration)}</div>
          </div>
          ${
            d.ph_minus_dose > 0
              ? `<div style="display: flex; align-items: center; gap: 8px; font-size: 12px; font-weight: 600; color: #ef4444;">
                  <span>🧪</span> Ajouter ${escapeHtml(d.ph_minus_dose)}g de pH-
                </div>`
              : ""
          }
          ${
            d.ph_plus_dose > 0
              ? `<div style="display: flex; align-items: center; gap: 8px; font-size: 12px; font-weight: 600; color: #3b82f6;">
                  <span>🧪</span> Ajouter ${escapeHtml(d.ph_plus_dose)}g de pH+
                </div>`
              : ""
          }
          ${
            d.ph_minus_dose === 0 && d.ph_plus_dose === 0 && d.cl_shock_dose === 0
              ? `<div style="display: flex; align-items: center; gap: 8px; font-size: 12px; font-weight: 600; color: #10b981;">
                  <span>✨</span> Chimie équilibrée, aucune action requise.
                </div>`
              : ""
          }
        </div>
      </div>

      <!-- BAS DEGRADE AVEC JAUGES CIRCULAIRES -->
      <div class="domolink_pool-bottom-gradient">
        <div class="water-header-row">
          <div style="display: flex; align-items: baseline; gap: 8px;">
            <span style="font-size: 18px; font-weight: 400; opacity: 0.9;">eau</span>
            <span class="water-temp-big">${d.water_temp !== "--" ? `${escapeHtml(d.water_temp)}°C` : "--"}</span>
          </div>
          <div style="background: rgba(255,255,255,0.2); border-radius: 12px; width: 38px; height: 38px; display: flex; align-items: center; justify-content: center; font-size: 16px; border: 1px solid rgba(255,255,255,0.3);">
            🔗
          </div>
        </div>

        <!-- Jauges pH et Chlore -->
        <div class="gauges-container">
          <!-- JAUGE pH -->
          <div class="gauge-item">
            <div class="gauge-svg-wrap">
              <svg width="100" height="100" viewBox="0 0 100 100">
                <defs>
                  <linearGradient id="phGrad" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="0" y2="100">
                    <stop offset="0%" stop-color="#10b981" />
                    <stop offset="20%" stop-color="#eab308" />
                    <stop offset="60%" stop-color="#ef4444" />
                  </linearGradient>
                </defs>
                <path d="M 20.3 79.7 A 42 42 0 1 1 79.7 79.7" stroke="url(#phGrad)" stroke-width="8" stroke-linecap="round" fill="none" opacity="0.9" />
                <circle cx="${ph_x}" cy="${ph_y}" r="6" fill="#ffffff" stroke="rgba(0,0,0,0.2)" stroke-width="2" />
              </svg>
              <div class="gauge-center-text">${valid_ph ? ph_num.toFixed(1) : "--"}</div>
            </div>
            <div style="font-size: 14px; font-weight: 600; margin-top: 6px;">pH</div>
            <div class="status-pill-badge ${escapeHtml(d.ph_badge_class)}">${escapeHtml(d.ph_badge_icon)} ${escapeHtml(d.ph_status)}</div>
          </div>

          <!-- JAUGE CHLORE / REDOX -->
          <div class="gauge-item">
            <div class="gauge-svg-wrap">
              <svg width="100" height="100" viewBox="0 0 100 100">
                <defs>
                  <linearGradient id="rxGrad" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="0" y2="100">
                    <stop offset="0%" stop-color="#10b981" />
                    <stop offset="20%" stop-color="#eab308" />
                    <stop offset="60%" stop-color="#ef4444" />
                  </linearGradient>
                </defs>
                <path d="M 20.3 79.7 A 42 42 0 1 1 79.7 79.7" stroke="url(#rxGrad)" stroke-width="8" stroke-linecap="round" fill="none" opacity="0.9" />
                <circle cx="${rx_x}" cy="${rx_y}" r="6" fill="#ffffff" stroke="rgba(0,0,0,0.2)" stroke-width="2" />
              </svg>
              <div class="gauge-center-text">${escapeHtml(d.redox_val)}</div>
            </div>
            <div style="font-size: 14px; font-weight: 600; margin-top: 6px;">Chlore</div>
            <div class="status-pill-badge ${escapeHtml(d.cl_badge_class)}">${escapeHtml(d.cl_badge_icon)} ${escapeHtml(d.cl_status)}</div>
          </div>
        </div>

        <!-- Pied de carte -->
        <div class="card-footer-nav">
          <div style="text-align: center;">
            <div style="font-size: 18px;">〰️</div>
            <div>Menu</div>
          </div>
          <div class="dolphin-btn" id="btn-dolphin-easter">🐬</div>
          <div style="text-align: center;">
            <div style="font-size: 18px;">🪣</div>
            <div>DomoLink Pool Control Store</div>
          </div>
        </div>
      </div>
    `;
  }

  _renderControleCard(d) {
    const ph_num = parseFloat(d.ph_val);
    const valid_ph = !isNaN(ph_num);
    const pumpClass = d.pump_state === "on" ? "pump-on" : "pump-off";
    const airTrend = this._getAirTrendArrow(d);

    return `
      <!-- EN-TETE & ONGLETS -->
      <div class="card-header-bar">
        <div class="pool-location-selector">
          ${escapeHtml(d.pool_name)} <span style="font-size: 10px; color: #64748b;">▼</span>
        </div>
        <div class="tabs-pill-container">
          <button class="tab-btn" id="tab-btn-analyse">💧 Analyse</button>
          <button class="tab-btn active" id="tab-btn-controle">🔲 Contrôle</button>
        </div>
      </div>

      <!-- CORPS CONTROLE -->
      <div class="card-body">
        <!-- Air & Météo -->
        <div class="air-meteo-row">
          <div class="air-temp-display">
            <span class="air-label">air</span>
            <span class="air-value">${d.air_temp !== "--" ? `${escapeHtml(d.air_temp)}°C` : "--"}</span>
            <span class="air-trend">${escapeHtml(airTrend)}</span>
          </div>
          <div style="height: 32px; width: 1px; background: #cbd5e1;"></div>
          <div class="uv-badge-box">
            <div style="font-size: 16px; color: #475569;">☀️ <span style="font-size: 12px; color: #94a3b8;">&gt;</span> ☁️</div>
            <div class="uv-pill">UV ${escapeHtml(d.uv_index)}</div>
          </div>
        </div>

        <!-- Barre de Contrôle Pompe Complète -->
        <div class="card-subblock pump-control-full">
          <div style="display: flex; flex-direction: column; gap: 4px;">
            <div style="font-size: 24px; line-height: 1;">🚰</div>
            <div style="font-size: 12px; font-weight: 700; color: #1e293b;">Pompe à filtration</div>
          </div>
          <div class="pump-actions-group">
            <button class="pump-circle-action ${d.hub_mode === 'auto' ? 'active' : ''}" id="btn-mode-auto" title="Mode Automatique">⚡ᴬ</button>
            <button class="pump-circle-action ${d.hub_mode === 'planning' ? 'active' : ''}" id="btn-mode-planning" title="Minuteur / Planning">⏱️</button>
            <button class="pump-circle-action ${pumpClass}" id="btn-toggle-pump" style="font-weight: bold;" title="Marche/Arrêt">⏻</button>
            <button class="pump-circle-action ${d.hub_mode === 'manual' ? 'active' : ''}" id="btn-mode-manual" title="Mode Manuel">✋</button>
          </div>
        </div>

        <!-- Moyennes & Suivi pH (Suivi réel) -->
        <div class="card-subblock history-section">
          <div class="history-title">Suivi du pH (Moyenne veille, Actuel &amp; Équilibre)</div>
          <div class="history-days-row">
            <div class="history-day-item"><div class="history-day-pill">${d.ph_avg_yesterday !== "--" ? escapeHtml(d.ph_avg_yesterday) : "--"}</div><div class="history-day-date">Hier (Moy.)</div></div>
            <div class="history-day-item"><div class="history-day-pill current">${valid_ph ? ph_num.toFixed(1) : "--"}</div><div class="history-day-date">Auj.</div></div>
            <div class="history-day-item"><div class="history-day-pill">${d.ph_equilibre !== "--" ? escapeHtml(d.ph_equilibre) : "--"}</div><div class="history-day-date">pH Équilibre</div></div>
          </div>
        </div>

        <!-- Moyennes & Suivi Redox -->
        <div class="card-subblock history-section">
          <div class="history-title">Suivi du Redox (mV) &amp; Chlore libre</div>
          <div class="history-days-row">
            <div class="history-day-item"><div class="history-day-pill">${d.redox_avg_yesterday !== "--" ? `${escapeHtml(d.redox_avg_yesterday)} mV` : "--"}</div><div class="history-day-date">Hier (Moy.)</div></div>
            <div class="history-day-item"><div class="history-day-pill current">${d.redox_val !== "--" ? `${escapeHtml(d.redox_val)} mV` : "--"}</div><div class="history-day-date">Auj.</div></div>
            <div class="history-day-item"><div class="history-day-pill">${d.free_cl !== "--" ? `${escapeHtml(d.free_cl)} mg/L` : "--"}</div><div class="history-day-date">Chlore libre</div></div>
          </div>
        </div>

        <!-- Température de l'eau : Moyenne veille, Actuelle & Prévisions -->
        <div class="card-subblock history-section">
          <div class="history-title">Température de l'eau (Veille, Actuelle &amp; Prévisions)</div>
          <div class="history-days-row">
            <div class="history-day-item"><div class="history-day-pill">${d.water_temp_avg_yesterday !== "--" ? `${escapeHtml(d.water_temp_avg_yesterday)}°` : "--"}</div><div class="history-day-date">Hier (Moy.)</div></div>
            <div class="history-day-item"><div class="history-day-pill current">${d.water_temp !== "--" ? `${escapeHtml(d.water_temp)}°` : "--"}</div><div class="history-day-date">Auj.</div></div>
            <div class="history-day-item"><div class="history-day-pill">${d.water_temp_forecast_1h !== "--" ? `${escapeHtml(d.water_temp_forecast_1h)}°` : "--"}</div><div class="history-day-date">Eau +1h</div></div>
            <div class="history-day-item"><div class="history-day-pill">${d.water_temp_forecast_tomorrow !== "--" ? `${escapeHtml(d.water_temp_forecast_tomorrow)}°` : "--"}</div><div class="history-day-date">Demain</div></div>
          </div>
        </div>

        <!-- Conditions & Prévisions Météo du jour (4 tuiles parfaites) -->
        <div class="card-subblock" style="display: flex; justify-content: space-between; align-items: center;">
          <div style="text-align: center; flex: 1;">
            <div style="font-size: 16px;">🌡️</div>
            <div style="font-size: 10px; font-weight: 700; color: #475569; margin-top: 2px;">${d.air_temp_min_today !== "--" || d.air_temp_max_today !== "--" ? `${escapeHtml(d.air_temp_min_today)}° | ${escapeHtml(d.air_temp_max_today)}°` : "--"}</div>
          </div>
          <div style="height: 24px; width: 1px; background: #e2e8f0;"></div>
          <div style="text-align: center; flex: 1;">
            <div style="font-size: 16px;">🌤️</div>
            <div style="font-size: 10px; font-weight: 700; color: #475569; margin-top: 2px;">${d.air_temp_next_hour !== "--" ? `+1h: ${escapeHtml(d.air_temp_next_hour)}°` : "--"}</div>
          </div>
          <div style="height: 24px; width: 1px; background: #e2e8f0;"></div>
          <div style="text-align: center; flex: 1;">
            <div style="font-size: 16px;">🌧️</div>
            <div style="font-size: 10px; font-weight: 700; color: #475569; margin-top: 2px;">${d.rain_probability !== "--" ? `${escapeHtml(d.rain_probability)}%` : "--"}</div>
          </div>
          <div style="height: 24px; width: 1px; background: #e2e8f0;"></div>
          <div style="text-align: center; flex: 1;">
            <div style="font-size: 16px;">💨</div>
            <div style="font-size: 10px; font-weight: 700; color: #475569; margin-top: 2px;">${d.wind_speed !== "--" ? `${escapeHtml(d.wind_speed)} km/h` : "--"}</div>
          </div>
        </div>
      </div>

      <!-- BAS DEGRADE SYNTHESE -->
      <div class="domolink_pool-bottom-gradient">
        <div style="display: flex; justify-content: space-around; align-items: flex-end; padding: 6px 0;">
          <div style="text-align: center; flex: 1;">
            <div style="font-size: 14px; opacity: 0.9;">eau</div>
            <div style="font-size: 32px; font-weight: 700;">${d.water_temp !== "--" ? `${escapeHtml(d.water_temp)}°C` : "--"}</div>
          </div>
          <div style="text-align: center; flex: 1;">
            <div style="font-size: 14px; opacity: 0.9;">pH</div>
            <div style="font-size: 26px; font-weight: 700;">${valid_ph ? ph_num.toFixed(1) : "--"}</div>
          </div>
          <div style="text-align: center; flex: 1;">
            <div style="font-size: 14px; opacity: 0.9;">Chlore</div>
            <div style="font-size: 20px; font-weight: 700;">${escapeHtml(d.cl_status)}</div>
          </div>
        </div>

        <div class="card-footer-nav">
          <div style="text-align: center;">
            <div style="font-size: 18px;">〰️</div>
            <div>Menu</div>
          </div>
          <div class="dolphin-btn" id="btn-dolphin-easter">🐬</div>
          <div style="text-align: center;">
            <div style="font-size: 18px;">🪣</div>
            <div>DomoLink Pool Control Store</div>
          </div>
        </div>
      </div>
    `;
  }

  _renderAdviceSection(d) {
    const ph = parseFloat(d.ph_val);
    const hasPh = !isNaN(ph);
    const lsi = d.lsi_val;
    const hasLsi = lsi !== null && !isNaN(lsi);
    const lsi_cursor_pct = hasLsi ? Math.max(0, Math.min(100, ((lsi + 1.0) / 2.0) * 100)) : 50;

    let phTagClass = "tag-info";
    let phActionText = "Aucune mesure de pH disponible. Vérifiez la connexion de votre sonde pH.";
    if (hasPh) {
      if (ph > 7.5) {
        phTagClass = "tag-bad";
        phActionText = `Le pH est trop haut (${escapeHtml(ph)}). L'eau est entartrante et le chlore perd de son efficacité.<br>👉 <strong>Ajoutez ${escapeHtml(d.ph_minus_dose)}g de réducteur de pH (pH-).</strong>`;
      } else if (ph < 7.1) {
        phTagClass = "tag-bad";
        phActionText = `Le pH est trop bas (${escapeHtml(ph)}). L'eau est corrosive pour les joints et irritante.<br>👉 <strong>Ajoutez ${escapeHtml(d.ph_plus_dose)}g d'augmentateur de pH (pH+).</strong>`;
      } else {
        phTagClass = "tag-ok";
        phActionText = "Le pH de l'eau est parfaitement équilibré (7.2 - 7.4). L'efficacité des produits est optimale.";
      }
    }

    let rxTagClass = "tag-info";
    let rxActionText = "Aucune mesure Redox/ORP disponible.";
    if (d.cl_status === "Idéal") {
      rxTagClass = "tag-ok";
      rxActionText = "Le pouvoir désinfectant de l'eau est optimal. L'eau est saine et protégée.";
    } else if (d.cl_status === "Insuffisant") {
      rxTagClass = "tag-bad";
      rxActionText = `Le pouvoir désinfectant est insuffisant. Risque d'eau trouble ou d'apparition d'algues.<br>⚡ <strong>Traitement Choc recommandé : ${escapeHtml(d.cl_shock_dose)}g.</strong>`;
    } else if (d.cl_status === "Élevé") {
      rxTagClass = "tag-warn";
      rxActionText = "La concentration en désinfectant est élevée. Réduisez la production de chlore ou le temps de filtration.";
    }

    let lsiTagClass = "tag-ok";
    if (hasLsi) {
      if (Math.abs(lsi) <= 0.3) lsiTagClass = "tag-ok";
      else if (lsi > 0.3) lsiTagClass = "tag-warn";
      else lsiTagClass = "tag-bad";
    }

    const pumpStatusLabel = d.pump_state === "on" ? "EN COURS" : (d.pump_state === "off" ? "À L'ARRÊT" : "NON CONFIGURÉE");

    return `
      <!-- 1. REGULATION DU PH -->
      <div class="advice-card">
        <div class="advice-card-header">
          <div class="advice-card-title">
            <span>🧪</span> Régulation du pH
          </div>
          <div class="badge-status-tag ${escapeHtml(phTagClass)}">${escapeHtml(d.ph_status)}</div>
        </div>
        <div class="advice-metric-row">
          <div class="metric-box">
            <div class="metric-label">pH Actuel</div>
            <div class="metric-val" style="color: #0284c7;">${escapeHtml(d.ph_val)}</div>
            <div class="metric-target">Cible : 7.2 - 7.4</div>
          </div>
          <div class="metric-box">
            <div class="metric-label">Correction pH-</div>
            <div class="metric-val" style="color: #dc2626;">${escapeHtml(d.ph_minus_dose)}g</div>
            <div class="metric-target">Bisulfate sodique</div>
          </div>
          <div class="metric-box">
            <div class="metric-label">Correction pH+</div>
            <div class="metric-val" style="color: #2563eb;">${escapeHtml(d.ph_plus_dose)}g</div>
            <div class="metric-target">Carbonate sodique</div>
          </div>
        </div>
        <div class="advice-action-box">
          <div class="action-icon">💡</div>
          <div>${phActionText}</div>
        </div>
      </div>

      <!-- 2. DESINFECTION & CHLORE / REDOX -->
      <div class="advice-card">
        <div class="advice-card-header">
          <div class="advice-card-title">
            <span>⚡</span> Désinfection & Chlore
          </div>
          <div class="badge-status-tag ${escapeHtml(rxTagClass)}">${escapeHtml(d.cl_status)}</div>
        </div>
        <div class="advice-metric-row">
          <div class="metric-box">
            <div class="metric-label">Redox (ORP)</div>
            <div class="metric-val" style="color: #0284c7;">${escapeHtml(d.redox_val)} mV</div>
            <div class="metric-target">Cible : 650 - 750 mV</div>
          </div>
          <div class="metric-box">
            <div class="metric-label">Chlore Libre Estimé</div>
            <div class="metric-val" style="color: #16a34a;">${escapeHtml(d.free_cl)} ppm</div>
            <div class="metric-target">Recommandé : 1.0 - 2.0</div>
          </div>
          <div class="metric-box">
            <div class="metric-label">Chlore Actif (HOCl)</div>
            <div class="metric-val" style="color: #d97706;">${escapeHtml(d.active_cl)} ppm</div>
            <div class="metric-target">Désinfectant réel</div>
          </div>
        </div>
        <div class="advice-action-box">
          <div class="action-icon">🛡️</div>
          <div>${rxActionText}</div>
        </div>
      </div>

      <!-- 3. EQUILIBRE DE L'EAU (LSI / LANGELIER) -->
      <div class="advice-card">
        <div class="advice-card-header">
          <div class="advice-card-title">
            <span>⚖️</span> Équilibre de l'eau (LSI)
          </div>
          <div class="badge-status-tag ${escapeHtml(lsiTagClass)}">${escapeHtml(d.lsi_status)}</div>
        </div>
        <div class="lsi-bar-wrapper">
          <div class="lsi-gradient-bar">
            ${hasLsi ? `<div class="lsi-cursor" style="left: ${escapeHtml(lsi_cursor_pct)}%;"></div>` : ""}
          </div>
          <div class="lsi-labels-row">
            <span>Corrosive (-1.0)</span>
            <span style="color: #16a34a; font-weight: bold;">Équilibrée (0.0)</span>
            <span>Entartrante (+1.0)</span>
          </div>
        </div>
        <div class="advice-action-box" style="margin-top: 14px;">
          <div class="action-icon">📘</div>
          <div>
            ${
              !hasLsi
                ? `<strong>Indice LSI : --</strong> — Calcul impossible en l'absence de mesures de pH ou de température.`
                : `<strong>Indice LSI : ${lsi > 0 ? "+" : ""}${escapeHtml(lsi)}</strong> — ${
                    Math.abs(lsi) <= 0.3
                      ? "Votre eau est parfaitement équilibrée. Le liner, la tuyauterie et les sondes de mesure sont préservés."
                      : lsi > 0.3
                      ? "L'eau a tendance à précipiter le calcaire (risque de dépôts blanchâtres sur la ligne d'eau et dans le filtre)."
                      : "L'eau est corrosive et agressive pour les éléments métalliques et les joints."
                  }`
            }
          </div>
        </div>
      </div>

      <!-- 4. GESTION DE LA FILTRATION -->
      <div class="advice-card">
        <div class="advice-card-header">
          <div class="advice-card-title">
            <span>⏱️</span> Optimisation Filtration
          </div>
          <div class="badge-status-tag tag-info">${escapeHtml(pumpStatusLabel)}</div>
        </div>
        <div class="advice-action-box">
          <div class="action-icon">🏊</div>
          <div>
            <strong>Recommandation :</strong> ${d.advice_filtration === "--" ? "En attente de la température de l'eau" : escapeHtml(d.advice_filtration)}.<br>
            <em>Règle d'or :</em> Filtrez en journée pendant les heures les plus chaudes et d'ensoleillement pour une efficacité maximale contre la photosynthèse des algues.
          </div>
        </div>
      </div>
    `;
  }

  _bindCardEvents(cardEl, d) {
    const btnAnalyse = cardEl.querySelector("#tab-btn-analyse");
    const btnControle = cardEl.querySelector("#tab-btn-controle");

    if (btnAnalyse) {
      btnAnalyse.addEventListener("click", () => {
        this._view = "analyse";
        this._updateData();
      });
    }

    if (btnControle) {
      btnControle.addEventListener("click", () => {
        this._view = "controle";
        this._updateData();
      });
    }

    // Tous les boutons Marche/Arrêt de la pompe
    const btnPumps = cardEl.querySelectorAll("#btn-toggle-pump");
    btnPumps.forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        if (d.pump_entity_key && this._hass) {
          const isCurrentlyOn = btn.classList.contains("pump-on");
          btn.classList.toggle("pump-on", !isCurrentlyOn);
          btn.classList.toggle("pump-off", isCurrentlyOn);
          this._hass.callService("homeassistant", "toggle", {
            entity_id: d.pump_entity_key,
          });
        }
      });
    });

    // Boutons de mode de filtration (Auto, Minuteur, Manuel)
    const btnAuto = cardEl.querySelector("#btn-mode-auto");
    const btnPlanning = cardEl.querySelector("#btn-mode-planning");
    const btnManual = cardEl.querySelector("#btn-mode-manual");

    const setModeVisual = (mode) => {
      if (btnAuto) btnAuto.classList.toggle("active", mode === "auto");
      if (btnPlanning) btnPlanning.classList.toggle("active", mode === "planning");
      if (btnManual) btnManual.classList.toggle("active", mode === "manual");
    };

    if (btnAuto) {
      btnAuto.addEventListener("click", (e) => {
        e.stopPropagation();
        setModeVisual("auto");
        if (d.pump_mode_key && this._hass) {
          const domain = d.pump_mode_key.split(".")[0];
          this._hass.callService(domain, "select_option", {
            entity_id: d.pump_mode_key,
            option: "auto",
          });
        }
      });
    }

    if (btnPlanning) {
      btnPlanning.addEventListener("click", (e) => {
        e.stopPropagation();
        setModeVisual("planning");
        if (d.pump_mode_key && this._hass) {
          const domain = d.pump_mode_key.split(".")[0];
          this._hass.callService(domain, "select_option", {
            entity_id: d.pump_mode_key,
            option: "planning",
          });
        }
      });
    }

    if (btnManual) {
      btnManual.addEventListener("click", (e) => {
        e.stopPropagation();
        setModeVisual("manual");
        if (d.pump_mode_key && this._hass) {
          const domain = d.pump_mode_key.split(".")[0];
          this._hass.callService(domain, "select_option", {
            entity_id: d.pump_mode_key,
            option: "manual",
          });
        }
      });
    }

    // Easter egg
    const dolphinBtn = cardEl.querySelector("#btn-dolphin-easter");
    if (dolphinBtn) {
      dolphinBtn.addEventListener("click", () => {
        launchSocrateRulesEasterEgg(this.shadowRoot);
      });
    }
  }
}


function launchSocrateRulesEasterEgg(targetRoot) {
  if (targetRoot.getElementById?.("socrate-rules-overlay") || targetRoot.querySelector?.("#socrate-rules-overlay")) return;

  // 1. Inject fonts in document head if not present
  if (!document.getElementById("socrate-rules-fonts")) {
    const fontLink = document.createElement("link");
    fontLink.id = "socrate-rules-fonts";
    fontLink.rel = "stylesheet";
    fontLink.href = "https://fonts.googleapis.com/css2?family=Orbitron:wght@500;900&family=Poppins:wght@300;600&display=swap";
    document.head.appendChild(fontLink);
  }

  // 2. Create fullscreen overlay
  const overlay = document.createElement("div");
  overlay.id = "socrate-rules-overlay";
  overlay.innerHTML = `
    <style>
      #socrate-rules-overlay {
        position: fixed;
        top: 0;
        left: 0;
        width: 100vw;
        height: 100vh;
        z-index: 999999;
        background-color: #030008;
        font-family: 'Poppins', sans-serif;
        display: flex;
        justify-content: center;
        align-items: center;
        overflow: hidden;
        user-select: none;
        -webkit-user-select: none;
        opacity: 0;
        transition: opacity 0.35s ease, transform 0.35s ease;
      }
      #socrate-rules-overlay * {
        margin: 0;
        padding: 0;
        box-sizing: border-box;
        user-select: none;
        -webkit-user-select: none;
      }
      #socrate-rules-overlay canvas {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        z-index: 1;
        pointer-events: none;
      }
      #socrate-rules-overlay .socrate-container {
        position: relative;
        z-index: 10;
        text-align: center;
        pointer-events: auto;
      }
      #socrate-rules-overlay h1.socrate-title {
        font-family: 'Orbitron', sans-serif;
        font-size: 6.5rem;
        font-weight: 900;
        letter-spacing: 12px;
        text-transform: uppercase;
        display: inline-block;
        line-height: 1.1;
        filter: 
          drop-shadow(0px 1px 0px #990066)
          drop-shadow(0px 2px 0px #660066)
          drop-shadow(0px 3px 0px #330066)
          drop-shadow(0px 4px 0px #1a0033)
          drop-shadow(0px 12px 15px rgba(0,0,0,0.9))
          drop-shadow(0 0 25px rgba(127, 0, 255, 0.6));
        transition: transform 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275), filter 0.5s;
        cursor: pointer;
      }
      #socrate-rules-overlay h1.socrate-title:hover {
        transform: scale(1.05);
        filter: 
          drop-shadow(0px 1px 0px #ff007f)
          drop-shadow(0px 2px 0px #990066)
          drop-shadow(0px 3px 0px #660066)
          drop-shadow(0px 4px 0px #330066)
          drop-shadow(0px 5px 0px #1a0033)
          drop-shadow(0px 15px 20px rgba(0,0,0,0.9))
          drop-shadow(0 0 40px rgba(0, 240, 255, 0.9));
      }
      #socrate-rules-overlay .socrate-letter {
        display: inline-block;
        background: linear-gradient(
          to bottom,
          #ff66b3 0%,
          #ff007f 35%,
          #7f00ff 65%,
          #00f0ff 100%
        );
        background-size: 100% 100%;
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        animation: socrate-wave 1.6s ease-in-out infinite;
      }
      #socrate-rules-overlay p.socrate-sub {
        font-size: 1.1rem;
        color: rgba(255, 255, 255, 0.6);
        margin-top: 30px;
        letter-spacing: 4px;
        text-transform: uppercase;
        font-weight: 300;
        opacity: 0;
        animation: socrate-fadeIn 2s ease forwards 0.8s;
      }
      #socrate-rules-overlay p.socrate-sub strong {
        color: #00f0ff;
        font-weight: 600;
        text-shadow: 0 0 10px rgba(0, 240, 255, 0.5);
      }
      #socrate-rules-overlay p.socrate-exit-hint {
        font-size: 0.95rem;
        color: rgba(255, 255, 255, 0.6);
        margin-top: 16px;
        letter-spacing: 2px;
        text-transform: uppercase;
        font-weight: 300;
        opacity: 0;
        animation: socrate-fadeIn 2s ease forwards 1.1s;
        cursor: pointer;
      }
      #socrate-rules-overlay p.socrate-exit-hint strong {
        color: #ff007f;
        font-weight: 700;
        text-shadow: 0 0 10px rgba(255, 0, 127, 0.6);
      }
      #socrate-rules-overlay .socrate-instructions {
        position: absolute;
        bottom: 40px;
        left: 50%;
        transform: translateX(-50%);
        z-index: 10;
        color: rgba(255, 255, 255, 0.4);
        font-size: 0.8rem;
        letter-spacing: 2px;
        text-transform: uppercase;
        pointer-events: none;
        animation: socrate-pulse 2s infinite;
        text-align: center;
        white-space: nowrap;
      }
      @keyframes socrate-wave {
        0%, 100% { transform: translateY(0); }
        50% { transform: translateY(-25px); }
      }
      @keyframes socrate-fadeIn {
        to { opacity: 1; transform: translateY(0); }
      }
      @keyframes socrate-pulse {
        0%, 100% { opacity: 0.3; }
        50% { opacity: 0.8; }
      }
      @media (max-width: 768px) {
        #socrate-rules-overlay h1.socrate-title {
          font-size: 3rem;
          letter-spacing: 6px;
        }
        #socrate-rules-overlay p.socrate-sub {
          font-size: 0.85rem;
          letter-spacing: 2px;
        }
        #socrate-rules-overlay p.socrate-exit-hint {
          font-size: 0.75rem;
          letter-spacing: 1px;
        }
      }
    </style>
    <canvas id="socrateParticleCanvas"></canvas>
    <div class="socrate-container">
      <h1 class="socrate-title" id="socrateTitle">Socrate Rules</h1>
      <p class="socrate-sub" id="socrateSub">Une expérience visuelle <strong>hautement philosophique</strong>.</p>
      <p class="socrate-exit-hint" id="socrateExitHint">Cliquez 3 fois sur <strong>SOCRATE RULES</strong> pour quitter</p>
    </div>
    <div class="socrate-instructions" id="socrateInstructions">Bougez votre souris & cliquez n'importe où</div>
  `;

  targetRoot.appendChild(overlay);

  // Localize easter egg strings if host has translation helper
  const host = targetRoot.host || (targetRoot instanceof HTMLElement ? targetRoot : null);
  if (host && typeof host.t === "function") {
    const subEl = overlay.querySelector("#socrateSub");
    const hintEl = overlay.querySelector("#socrateExitHint");
    const instEl = overlay.querySelector("#socrateInstructions");
    if (subEl) subEl.textContent = host.t("easter_egg_sub");
    if (hintEl) hintEl.textContent = host.t("easter_egg_hint");
    if (instEl) instEl.textContent = host.t("easter_egg_instructions");
  }

  // Fade in animation
  requestAnimationFrame(() => {
    overlay.style.opacity = "1";
  });

  const canvas = overlay.querySelector("#socrateParticleCanvas");
  const ctx = canvas.getContext("2d");
  const title = overlay.querySelector("#socrateTitle");
  const TWO_PI = Math.PI * 2;

  // Wave letter splitting
  const lines = ["Socrate", "Rules"];
  title.innerHTML = "";
  let globalCharIndex = 0;
  lines.forEach((lineText) => {
    const lineDiv = document.createElement("div");
    lineDiv.style.display = "block";
    [...lineText].forEach((char) => {
      const span = document.createElement("span");
      if (char === " ") {
        span.innerHTML = "&nbsp;";
      } else {
        span.textContent = char;
      }
      span.classList.add("socrate-letter");
      span.style.animationDelay = `${globalCharIndex * 0.07}s`;
      lineDiv.appendChild(span);
      globalCharIndex++;
    });
    title.appendChild(lineDiv);
  });

  // Particles system
  let particlesArray = [];
  let sparksArray = [];
  let animId = null;
  let isClosing = false;

  let mouse = {
    x: null,
    y: null,
    radius: 150,
    radiusSq: 22500,
  };

  function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }
  resizeCanvas();

  class Particle {
    constructor(x, y, directionX, directionY, size, color) {
      this.x = x;
      this.y = y;
      this.directionX = directionX;
      this.directionY = directionY;
      this.size = size;
      this.color = color;
      this.originalSize = size;
    }

    draw() {
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.size, 0, TWO_PI, false);
      ctx.fillStyle = this.color;
      ctx.fill();
    }

    update() {
      if (this.x > canvas.width || this.x < 0) this.directionX = -this.directionX;
      if (this.y > canvas.height || this.y < 0) this.directionY = -this.directionY;
      this.x += this.directionX;
      this.y += this.directionY;

      if (mouse.x != null && mouse.y != null) {
        let dx = mouse.x - this.x;
        let dy = mouse.y - this.y;
        let distanceSq = dx * dx + dy * dy;
        if (distanceSq < mouse.radiusSq) {
          let distance = Math.sqrt(distanceSq);
          let forceDirectionX = dx / distance;
          let forceDirectionY = dy / distance;
          let force = (mouse.radius - distance) / mouse.radius;
          this.x -= forceDirectionX * force * 3;
          this.y -= forceDirectionY * force * 3;
          if (this.size < this.originalSize * 3.5) this.size += 0.2;
        } else if (this.size > this.originalSize) {
          this.size -= 0.1;
        }
      } else if (this.size > this.originalSize) {
        this.size -= 0.1;
      }
      this.draw();
    }
  }

  class Spark {
    constructor(x, y) {
      this.x = x;
      this.y = y;
      this.size = Math.random() * 6 + 2;
      this.speedX = (Math.random() - 0.5) * 12;
      this.speedY = (Math.random() - 0.5) * 12;
      const colors = ["#ff007f", "#7f00ff", "#00f0ff", "#ffffff"];
      this.color = colors[Math.floor(Math.random() * colors.length)];
      this.alpha = 1;
      this.decay = Math.random() * 0.015 + 0.01;
    }

    update() {
      this.x += this.speedX;
      this.y += this.speedY;
      this.speedX *= 0.98;
      this.speedY *= 0.98;
      this.alpha -= this.decay;
      if (this.alpha > 0) {
        ctx.save();
        ctx.globalAlpha = this.alpha;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, TWO_PI);
        ctx.fillStyle = this.color;
        ctx.shadowBlur = 15;
        ctx.shadowColor = this.color;
        ctx.fill();
        ctx.restore();
      }
    }
  }

  function initParticles() {
    particlesArray = [];
    let baseParticles = (canvas.width * canvas.height) / 9000;
    let numberOfParticles = Math.min(baseParticles, 250);
    for (let i = 0; i < numberOfParticles; i++) {
      let size = Math.random() * 2 + 0.5;
      let x = Math.random() * (canvas.width - size * 4) + size * 2;
      let y = Math.random() * (canvas.height - size * 4) + size * 2;
      let directionX = Math.random() * 0.4 - 0.2;
      let directionY = Math.random() * 0.4 - 0.2;
      let colorPalette = ["rgba(127, 0, 255, 0.4)", "rgba(0, 240, 255, 0.3)", "rgba(255, 0, 127, 0.3)"];
      let color = colorPalette[Math.floor(Math.random() * colorPalette.length)];
      particlesArray.push(new Particle(x, y, directionX, directionY, size, color));
    }
  }

  function connectParticles() {
    let maxDistance = 120;
    let maxDistanceSq = maxDistance * maxDistance;
    for (let a = 0; a < particlesArray.length; a++) {
      for (let b = a + 1; b < particlesArray.length; b++) {
        let dx = particlesArray[a].x - particlesArray[b].x;
        let dy = particlesArray[a].y - particlesArray[b].y;
        let distanceSq = dx * dx + dy * dy;
        if (distanceSq < maxDistanceSq) {
          let distance = Math.sqrt(distanceSq);
          let opacity = (1 - distance / maxDistance) * 0.15;
          ctx.strokeStyle = `rgba(127, 0, 255, ${opacity})`;
          ctx.lineWidth = 0.5;
          ctx.beginPath();
          ctx.moveTo(particlesArray[a].x, particlesArray[a].y);
          ctx.lineTo(particlesArray[b].x, particlesArray[b].y);
          ctx.stroke();
        }
      }
    }
  }

  function animate() {
    ctx.fillStyle = "rgba(3, 0, 8, 0.15)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    for (let i = 0; i < particlesArray.length; i++) {
      particlesArray[i].update();
    }

    for (let i = sparksArray.length - 1; i >= 0; i--) {
      sparksArray[i].update();
      if (sparksArray[i].alpha <= 0) {
        sparksArray.splice(i, 1);
      }
    }

    connectParticles();
    animId = requestAnimationFrame(animate);
  }

  // Mouse & Touch events
  function onMouseMove(e) {
    mouse.x = e.clientX;
    mouse.y = e.clientY;
  }
  function onMouseOut() {
    mouse.x = null;
    mouse.y = null;
  }
  function onTouchMove(e) {
    if (e.touches && e.touches.length > 0) {
      mouse.x = e.touches[0].clientX;
      mouse.y = e.touches[0].clientY;
    }
  }
  function onTouchEnd() {
    mouse.x = null;
    mouse.y = null;
  }
  function onOverlayClick(e) {
    const x = e.clientX || window.innerWidth / 2;
    const y = e.clientY || window.innerHeight / 2;
    for (let i = 0; i < 30; i++) {
      sparksArray.push(new Spark(x, y));
    }
  }
  function onKeyDown(e) {
    if (e.key === "Escape") {
      cleanup();
    }
  }

  window.addEventListener("resize", resizeCanvas);
  window.addEventListener("mousemove", onMouseMove);
  window.addEventListener("mouseout", onMouseOut);
  window.addEventListener("touchmove", onTouchMove, { passive: true });
  window.addEventListener("touchend", onTouchEnd, { passive: true });
  window.addEventListener("keydown", onKeyDown);
  overlay.addEventListener("click", onOverlayClick);

  // Exit trigger: 3 clicks in < 2s on "SOCRATE RULES"
  let exitClicks = [];
  function handleExitClick(clientX, clientY) {
    if (isClosing) return;
    const now = Date.now();
    exitClicks = exitClicks.filter((t) => now - t < 2000);
    exitClicks.push(now);

    const x = clientX || window.innerWidth / 2;
    const y = clientY || window.innerHeight / 2;
    for (let i = 0; i < 70; i++) {
      sparksArray.push(new Spark(x, y));
    }

    if (exitClicks.length >= 3) {
      isClosing = true;
      exitClicks = [];
      for (let i = 0; i < 150; i++) {
        sparksArray.push(new Spark(window.innerWidth / 2, window.innerHeight / 2));
      }
      overlay.style.transition = "opacity 0.38s ease, transform 0.38s ease";
      overlay.style.opacity = "0";
      overlay.style.transform = "scale(1.05)";
      setTimeout(() => {
        cleanup();
      }, 360);
    }
  }

  title.addEventListener("click", (e) => {
    e.stopPropagation();
    handleExitClick(e.clientX, e.clientY);
  });
  title.addEventListener(
    "touchstart",
    (e) => {
      e.stopPropagation();
      const touch = e.touches && e.touches[0];
      handleExitClick(touch ? touch.clientX : null, touch ? touch.clientY : null);
    },
    { passive: true }
  );

  const exitHint = overlay.querySelector("#socrateExitHint");
  if (exitHint) {
    exitHint.addEventListener("click", (e) => {
      e.stopPropagation();
      handleExitClick(e.clientX, e.clientY);
    });
    exitHint.addEventListener(
      "touchstart",
      (e) => {
        e.stopPropagation();
        const touch = e.touches && e.touches[0];
        handleExitClick(touch ? touch.clientX : null, touch ? touch.clientY : null);
      },
      { passive: true }
    );
  }

  function cleanup() {
    if (animId) {
      cancelAnimationFrame(animId);
      animId = null;
    }
    window.removeEventListener("resize", resizeCanvas);
    window.removeEventListener("mousemove", onMouseMove);
    window.removeEventListener("mouseout", onMouseOut);
    window.removeEventListener("touchmove", onTouchMove);
    window.removeEventListener("touchend", onTouchEnd);
    window.removeEventListener("keydown", onKeyDown);
    if (overlay.parentNode) {
      overlay.parentNode.removeChild(overlay);
    }
  }

  initParticles();
  animate();
}

if (!customElements.get("domolink-pool-panel")) {
  customElements.define("domolink-pool-panel", DomoLinkPoolControlPanel);
}
if (!customElements.get("domolink_pool-panel")) {
  customElements.define("domolink_pool-panel", class extends DomoLinkPoolControlPanel {});
}
