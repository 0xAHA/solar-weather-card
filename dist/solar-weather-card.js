// solar-weather-card.js
// A Home Assistant Lovelace card combining clock, weather forecast, solar power bar,
// solar day progress bar, and built-in animated rain radar.
// v0.0.1

import { getPalette, getPaletteNames } from './solar-weather-card-palettes.js';

const VERSION    = '0.0.1';
const CARD_TAG   = 'solar-weather-card';
const EDITOR_TAG = 'solar-weather-card-editor';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function clamp(val, min, max) { return Math.max(min, Math.min(max, val)); }
function round1(v) { return Math.round(v * 10) / 10; }

function safeNum(v) {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : null;
}

function weatherIcon(state) {
  const map = {
    'sunny': '☀️', 'clear-night': '🌙', 'partlycloudy': '⛅',
    'cloudy': '☁️', 'fog': '🌫️', 'windy': '💨', 'windy-variant': '💨',
    'rainy': '🌧️', 'pouring': '🌧️', 'snowy': '❄️', 'snowy-rainy': '🌨️',
    'hail': '🌨️', 'lightning': '⛈️', 'lightning-rainy': '⛈️',
    'exceptional': '⚠️',
  };
  return map[state] || '🌡️';
}

function formatTime(date, use24h) {
  if (use24h) return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
  return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true });
}

function formatDate(date, fmt) {
  const d      = String(date.getDate()).padStart(2, '0');
  const m      = String(date.getMonth() + 1).padStart(2, '0');
  const y      = date.getFullYear();
  const yy     = String(y).slice(-2);
  const days   = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  const dayName = days[date.getDay()];
  const monName = months[date.getMonth()];
  switch (fmt) {
    case 'dd/MM/yyyy': return `${d}/${m}/${y}`;
    case 'MM/dd/yyyy': return `${m}/${d}/${y}`;
    case 'yyyy-MM-dd': return `${y}-${m}-${d}`;
    case 'dd-MM-yy':   return `${d}-${m}-${yy}`;
    case 'D, dd MMM':  return `${dayName}, ${d} ${monName.slice(0, 3)}`;
    default:           return `${dayName}, ${d} ${monName} ${y}`;
  }
}

function dayAbbr(date) {
  return ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][date.getDay()];
}

function parseKw(stateObj) {
  if (!stateObj) return 0;
  const v = parseFloat(stateObj.state);
  if (isNaN(v)) return 0;
  const unit = (stateObj.attributes.unit_of_measurement || '').toLowerCase();
  return unit === 'w' ? v / 1000 : v;
}

// ─── Editor ──────────────────────────────────────────────────────────────────

class SolarWeatherCardEditor extends HTMLElement {
  constructor() {
    super();
    this._config = {};
    this._hass   = null;
  }

  connectedCallback() {
    if (!this.shadowRoot) this.attachShadow({ mode: 'open' });
    this._render();
  }

  setConfig(config) {
    this._config = { ...config };
    if (this.shadowRoot) this._render();
  }

  set hass(hass) {
    this._hass = hass;
    if (this.shadowRoot) {
      this.shadowRoot.querySelectorAll('ha-selector').forEach(el => { el.hass = hass; });
    }
  }

  _fire(config) {
    this.dispatchEvent(new CustomEvent('config-changed', { detail: { config }, bubbles: true, composed: true }));
  }

  _render() {
    const shadow = this.shadowRoot;
    if (!shadow) return;

    const palettes = getPaletteNames().map(p => ({ label: `${p.icon} ${p.name}`, value: p.key }));

    const sections = [
      {
        id: 'clock', title: '⏰ Clock & Date', defaultOpen: true,
        fields: [
          { key: 'time_format', label: 'Time format', selector: { select: { options: [
            { label: '24-hour (13:47)', value: '24h' },
            { label: '12-hour (1:47 PM)', value: '12h' },
          ]}}},
          { key: 'date_format', label: 'Date format', selector: { select: { options: [
            { label: 'Sunday, 22 Mar 2026 (default)', value: 'D, dd MMM yyyy' },
            { label: '22/03/2026',  value: 'dd/MM/yyyy' },
            { label: '03/22/2026',  value: 'MM/dd/yyyy' },
            { label: '2026-03-22',  value: 'yyyy-MM-dd' },
            { label: '22-03-26',    value: 'dd-MM-yy' },
            { label: 'Sunday, 22 Mar', value: 'D, dd MMM' },
          ]}}},
        ],
      },
      {
        id: 'weather', title: '🌤️ Weather & Forecast', defaultOpen: true,
        fields: [
          { key: 'weather_entity',       label: 'Weather entity',              selector: { entity: { domain: 'weather' } } },
          { key: 'show_weather_section', label: 'Show weather section',         selector: { boolean: {} } },
          { key: 'show_forecast_days',   label: 'Show forecast day bars',       selector: { boolean: {} } },
          { key: 'forecast_days',        label: 'Default forecast days (1–7)',  selector: { number: { min: 1, max: 7, step: 1, mode: 'slider' } } },
        ],
      },
      {
        id: 'solar', title: '☀️ Solar', defaultOpen: true,
        fields: [
          { key: 'production_entity',       label: 'Solar production (W or kW)',  selector: { entity: {} } },
          { key: 'self_consumption_entity', label: 'Home consumption (W or kW)',  selector: { entity: {} } },
          { key: 'export_entity',           label: 'Grid export (W or kW)',       selector: { entity: {} } },
          { key: 'import_entity',           label: 'Grid import (W or kW)',       selector: { entity: {} } },
          { key: 'inverter_size',           label: 'Inverter size (kW)',          selector: { number: { min: 1, max: 100, step: 0.5, mode: 'box', unit_of_measurement: 'kW' } } },
          { key: 'show_solar_section',      label: 'Show solar bar',              selector: { boolean: {} } },
          { key: 'show_solar_arc',          label: 'Show day progress bar',       selector: { boolean: {} } },
          { key: 'show_stats',              label: 'Show stat row (Export/Import/Usage)', selector: { boolean: {} } },
          { key: 'show_bar_values',         label: 'Show kW value on bar',        selector: { boolean: {} } },
        ],
      },
      {
        id: 'radar', title: '📡 Radar', defaultOpen: false,
        fields: [
          { key: 'show_radar',           label: 'Enable radar panel',            selector: { boolean: {} } },
          { key: 'precipitation_entity', label: 'Precipitation sensor (mm/h)',   selector: { entity: {} } },
          { key: 'radar_rain_threshold', label: 'Auto-expand threshold (mm/h)', selector: { number: { min: 0, max: 50, step: 0.1, mode: 'box' } } },
          { key: 'radar_latitude',       label: 'Home latitude',                 selector: { number: { min: -90,  max: 90,  step: 0.0001, mode: 'box' } } },
          { key: 'radar_longitude',      label: 'Home longitude',                selector: { number: { min: -180, max: 180, step: 0.0001, mode: 'box' } } },
          { key: 'radar_zoom',           label: 'Zoom level (3–12)',             selector: { number: { min: 3, max: 12, step: 1, mode: 'slider' } } },
        ],
      },
      {
        id: 'display', title: '🎨 Display', defaultOpen: false,
        fields: [
          { key: 'color_palette', label: 'Colour palette', selector: { select: { options: palettes } } },
        ],
      },
    ];

    let html = `
      <style>
        :host { display: block; font-family: var(--primary-font-family, sans-serif); }
        .swce-section { border: 1px solid var(--divider-color, #e0e0e0); border-radius: 8px; margin-bottom: 8px; overflow: hidden; }
        .swce-section > summary { padding: 10px 14px; cursor: pointer; font-weight: 500; background: var(--secondary-background-color, #f5f5f5); list-style: none; display: flex; align-items: center; font-size: 14px; color: var(--primary-text-color); user-select: none; }
        .swce-section > summary::-webkit-details-marker { display: none; }
        .swce-section-body { padding: 8px 14px 12px; display: flex; flex-direction: column; gap: 2px; }
        ha-selector { display: block; }
      </style>
    `;

    for (const sec of sections) {
      const open = this._config[`__open_${sec.id}`] ?? sec.defaultOpen;
      html += `<details class="swce-section"${open ? ' open' : ''} data-section="${sec.id}">
        <summary>${sec.title}</summary>
        <div class="swce-section-body">`;
      for (const f of sec.fields) html += `<div data-slot="${f.key}"></div>`;
      html += `</div></details>`;
    }

    shadow.innerHTML = html;

    for (const sec of sections) {
      for (const field of sec.fields) {
        const slot = shadow.querySelector(`[data-slot="${field.key}"]`);
        if (!slot) continue;
        const el = document.createElement('ha-selector');
        if (this._hass) el.hass = this._hass;
        el.label    = field.label;
        el.selector = field.selector;
        const val = this._config[field.key];
        if (val !== undefined && val !== '') el.value = val;
        el.addEventListener('value-changed', e => {
          const v = e.detail.value;
          if (v === this._config[field.key]) return;
          this._config = { ...this._config, [field.key]: v };
          this._fire(this._config);
        });
        slot.appendChild(el);
      }
    }

    shadow.querySelectorAll('.swce-section').forEach(el => {
      el.addEventListener('toggle', () => {
        this._config = { ...this._config, [`__open_${el.dataset.section}`]: el.open };
        this._fire(this._config);
      });
    });
  }
}

customElements.define(EDITOR_TAG, SolarWeatherCardEditor);

// ─── Main Card ───────────────────────────────────────────────────────────────

class SolarWeatherCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._config            = {};
    this._hass              = null;
    this._tickInterval      = null;
    this._forecastExpanded  = false;
    this._radarExpanded     = false;
    this._forecastUnsub     = null;
    this._weatherForecast   = [];
    this._lastWeatherEntity = null;
    // Radar iframe — lives in a stable container that is NEVER destroyed
    // by innerHTML updates, preventing the reload-on-reattach flicker.
    this._radarIframe       = null;
    this._radarIframeKey    = null;
  }

  static getConfigElement() { return document.createElement(EDITOR_TAG); }

  static getStubConfig() {
    return {
      weather_entity:          'weather.home',
      production_entity:       '',
      self_consumption_entity: '',
      export_entity:           '',
      import_entity:           '',
      inverter_size:           10,
      forecast_days:           3,
      time_format:             '24h',
      date_format:             'D, dd MMM yyyy',
      color_palette:           'classic-solar',
      show_weather_section:    true,
      show_forecast_days:      true,
      show_solar_section:      true,
      show_solar_arc:          true,
      show_stats:              true,
      show_bar_values:         true,
      show_radar:              false,
      radar_rain_threshold:    0.5,
      radar_zoom:              7,
    };
  }

  setConfig(config) {
    const prevEntity = this._config.weather_entity;
    this._config = { ...SolarWeatherCard.getStubConfig(), ...config };
    if (this._hass && config.weather_entity !== prevEntity) this._subscribeForecast();
    this._render();
  }

  set hass(hass) {
    const firstHass     = !this._hass;
    const entityChanged = hass && (this._config.weather_entity !== this._lastWeatherEntity);
    this._hass = hass;
    if (firstHass || entityChanged) this._subscribeForecast();
    this._render();
  }

  connectedCallback() {
    this._tickInterval = setInterval(() => this._render(), 30000);
    if (this._hass) this._subscribeForecast();
  }

  disconnectedCallback() {
    clearInterval(this._tickInterval);
    this._unsubForecast();
  }

  // ── Forecast subscription ─────────────────────────────────────────────────

  async _subscribeForecast() {
    this._unsubForecast();
    const entity = this._config.weather_entity;
    if (!entity || !this._hass) return;
    this._lastWeatherEntity = entity;
    try {
      this._forecastUnsub = await this._hass.connection.subscribeMessage(
        (msg) => { this._weatherForecast = msg.forecast || []; this._render(); },
        { type: 'weather/subscribe_forecast', forecast_type: 'daily', entity_id: entity }
      );
    } catch (_) {
      const wx = this._hass.states[entity];
      this._weatherForecast = wx?.attributes?.forecast || [];
      this._render();
    }
  }

  _unsubForecast() {
    if (this._forecastUnsub) { try { this._forecastUnsub(); } catch (_) {} this._forecastUnsub = null; }
  }

  // ── Data helpers ──────────────────────────────────────────────────────────

  _getState(entity) { return entity && this._hass ? this._hass.states[entity] : null; }

  _getPrecipitation() {
    const ent = this._getState(this._config.precipitation_entity);
    if (ent) return parseFloat(ent.state) || 0;
    const fc = this._weatherForecast;
    return fc && fc[0] ? parseFloat(fc[0].precipitation || 0) : 0;
  }

  // ── Shell management ──────────────────────────────────────────────────────
  // The shadow root is split into:
  //   <style id="swc-style">   — updated via textContent (no DOM destroy)
  //   <ha-card>
  //     <div id="swc-dyn">    — updated via innerHTML (card content, no radar body)
  //     <div id="swc-radar-stable">  — radar iframe lives here; NEVER touched by innerHTML
  //
  // This ensures the sandboxed iframe is never detached from the DOM, preventing
  // the browser from reloading it on every clock tick / hass state update.

  _ensureShell() {
    if (this.shadowRoot.getElementById('swc-dyn')) return; // shell already exists
    this.shadowRoot.innerHTML = `
      <style id="swc-style"></style>
      <ha-card class="swc-card">
        <div id="swc-dyn"></div>
        <div id="swc-radar-stable" style="display:none;"></div>
      </ha-card>
    `;
  }

  // ── CSS (palette-dependent, updated via textContent) ──────────────────────

  _css(colors) {
    return `
      :host { display: block; }
      .swc-card {
        background: var(--ha-card-background, var(--card-background-color, #fff));
        border-radius: var(--ha-card-border-radius, 12px);
        border: 0.5px solid var(--divider-color, rgba(0,0,0,0.12));
        padding: 0; overflow: hidden;
        font-family: var(--primary-font-family, sans-serif);
        color: var(--primary-text-color);
      }
      .swc-inner { padding: 16px 20px 14px; }

      /* Clock */
      .swc-header { display: flex; align-items: flex-start; justify-content: space-between; }
      .swc-time { font-size: 52px; font-weight: 300; line-height: 1; letter-spacing: -2px; }
      .swc-date { font-size: 13px; color: var(--secondary-text-color); margin-top: 5px; }
      .swc-weather-col { text-align: right; }
      .swc-wx-icon { font-size: 32px; line-height: 1; }
      .swc-wx-temp { font-size: 24px; font-weight: 300; margin-top: 2px; }
      .swc-wx-desc { font-size: 11px; color: var(--secondary-text-color); margin-top: 2px; }

      /* Divider */
      .swc-divider { height: 1px; background: var(--divider-color, rgba(0,0,0,0.08)); margin: 0 16px; }

      /* Forecast */
      .swc-forecast-wrap { padding: 10px 20px 12px; }
      .swc-fc-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
      .swc-fc-title { font-size: 11px; font-weight: 500; letter-spacing: 0.06em; text-transform: uppercase; color: var(--secondary-text-color); }
      .swc-expand-btn { font-size: 11px; cursor: pointer; color: var(--accent-color, #03a9f4); }
      .swc-day-row { display: flex; align-items: center; gap: 8px; margin-bottom: 5px; }
      .swc-day-name { font-size: 12px; width: 32px; flex-shrink: 0; color: var(--secondary-text-color); }
      .swc-day-icon { width: 18px; flex-shrink: 0; font-size: 14px; text-align: center; }
      .swc-temp-lo { font-size: 11px; color: var(--secondary-text-color); width: 26px; text-align: right; flex-shrink: 0; }
      .swc-temp-hi { font-size: 12px; font-weight: 600; width: 26px; flex-shrink: 0; }
      .swc-temp-track { flex: 1; height: 8px; background: var(--secondary-background-color, rgba(0,0,0,0.06)); border-radius: 4px; position: relative; overflow: hidden; }
      .swc-temp-fill { height: 8px; border-radius: 4px; position: absolute; }

      /* Solar */
      .swc-solar-wrap { padding: 10px 20px 14px; }
      .swc-solar-header { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 8px; }
      .swc-solar-label { font-size: 11px; font-weight: 500; letter-spacing: 0.06em; text-transform: uppercase; color: var(--secondary-text-color); }
      .swc-solar-kw { font-size: 22px; font-weight: 300; }
      .swc-solar-kw-unit { font-size: 13px; color: var(--secondary-text-color); }
      .swc-standby { font-size: 12px; color: var(--secondary-text-color); padding: 4px 0 2px; }
      .swc-pwr-bar { height: 34px; border-radius: 8px; background: var(--secondary-background-color, rgba(0,0,0,0.06)); position: relative; overflow: hidden; }
      .swc-pwr-fill { position: absolute; left: 0; top: 0; bottom: 0; border-radius: 8px; display: flex; align-items: center; justify-content: flex-end; padding-right: 10px; background: ${colors.solar}; }
      .swc-pwr-val { font-size: 11px; font-weight: 600; color: rgba(0,0,0,0.65); white-space: nowrap; }
      .swc-stat-row { display: flex; gap: 16px; margin-top: 8px; font-size: 12px; }
      .swc-stat-item { display: flex; align-items: center; gap: 4px; }
      .swc-stat-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
      .swc-stat-lbl { color: var(--secondary-text-color); }
      .swc-stat-val { font-weight: 500; }

      /* Day progress bar */
      .swc-daybar-wrap { padding: 6px 20px 14px; }
      .swc-daybar-label { font-size: 11px; font-weight: 500; letter-spacing: 0.06em; text-transform: uppercase; color: var(--secondary-text-color); margin-bottom: 10px; }
      .swc-daybar-track { position: relative; height: 5px; background: var(--secondary-background-color, rgba(0,0,0,0.08)); border-radius: 3px; margin: 14px 0 16px; }
      .swc-daybar-fill { position: absolute; left: 0; top: 0; bottom: 0; border-radius: 3px; background: ${colors.solar}; opacity: 0.7; }
      .swc-daybar-sun { position: absolute; top: 50%; transform: translate(-50%,-50%); font-size: 18px; line-height: 1; pointer-events: none; }
      .swc-daybar-times { display: flex; justify-content: space-between; font-size: 11px; color: var(--secondary-text-color); }

      /* Radar header (body lives in swc-radar-stable) */
      .swc-radar-wrap { padding: 0 20px 14px; }
      .swc-radar-header { display: flex; align-items: center; justify-content: space-between; background: var(--secondary-background-color, rgba(0,0,0,0.04)); border-radius: 8px; padding: 9px 14px; cursor: pointer; user-select: none; }
      .swc-radar-title { font-size: 13px; font-weight: 500; }
      .swc-radar-badge { font-size: 11px; padding: 2px 8px; border-radius: 8px; background: var(--error-color, #f44336); color: #fff; margin-left: 8px; }
      .swc-radar-chevron { font-size: 14px; color: var(--secondary-text-color); transition: transform 0.2s; }
      .swc-radar-chevron.open { transform: rotate(90deg); }

      /* Radar stable body */
      .swc-radar-body-wrap { padding: 0 20px 14px; }
      .swc-radar-note { font-size: 11px; color: var(--secondary-text-color); padding: 14px; text-align: center; background: var(--secondary-background-color, rgba(0,0,0,0.03)); border-radius: 8px; }

      /* Rain pill */
      .swc-rain-pill { display: inline-block; background: var(--info-color, #2196f3); color: #fff; font-size: 10px; border-radius: 8px; padding: 1px 7px; margin-left: 8px; vertical-align: middle; }
    `;
  }

  // ── Render ────────────────────────────────────────────────────────────────

  _render() {
    if (!this._config || !this._hass) return;

    const palette = getPalette(this._config.color_palette);
    const colors  = palette.colors;

    // Ensure stable shell exists (created once, never destroyed)
    this._ensureShell();

    // Update palette-dependent CSS without touching the DOM structure
    const styleEl = this.shadowRoot.getElementById('swc-style');
    if (styleEl) styleEl.textContent = this._css(colors);

    // ── Computed values ───────────────────────────────────────────────────

    const now     = new Date();
    const timeStr = formatTime(now, this._config.time_format === '24h');
    const dateStr = formatDate(now, this._config.date_format);

    const wxEnt   = this._getState(this._config.weather_entity);
    const wxState = wxEnt?.state || '';
    const wxTemp  = safeNum(wxEnt?.attributes.temperature);
    const wxUnit  = wxEnt?.attributes.temperature_unit || '°C';
    const wxDesc  = wxState.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());

    const inverter  = parseFloat(this._config.inverter_size) || 10;
    const solar     = parseKw(this._getState(this._config.production_entity));
    const usage     = parseKw(this._getState(this._config.self_consumption_entity));
    const exportKw  = parseKw(this._getState(this._config.export_entity));
    const importKw  = parseKw(this._getState(this._config.import_entity));
    const isStandby = solar < 0.01;
    const solarPct  = clamp((solar / inverter) * 100, 0, 100);

    const precip    = this._getPrecipitation();
    const threshold = parseFloat(this._config.radar_rain_threshold) || 0.5;
    const rainAlert = precip >= threshold;
    if (rainAlert && this._config.show_radar) this._radarExpanded = true;

    const forecastDays  = parseInt(this._config.forecast_days) || 3;
    const fc            = this._weatherForecast || [];
    const displayDays   = this._forecastExpanded
      ? Math.min(7, fc.length)
      : Math.min(forecastDays, fc.length);
    const forecastSlice = fc.slice(0, displayDays);
    const canExpand     = !this._forecastExpanded && fc.length > displayDays && displayDays < 7;
    const canCollapse   = this._forecastExpanded && forecastDays < 7;

    const sunObj  = this._hass?.states['sun.sun'];
    const sunrise = sunObj?.attributes.next_rising  ? new Date(sunObj.attributes.next_rising)  : null;
    const sunset  = sunObj?.attributes.next_setting ? new Date(sunObj.attributes.next_setting) : null;
    let arcPct = 0.5;
    if (sunrise && sunset) arcPct = clamp((now - sunrise) / (sunset - sunrise), 0, 1);
    const srLabel = sunrise ? formatTime(sunrise, this._config.time_format === '24h') : '--:--';
    const ssLabel = sunset  ? formatTime(sunset,  this._config.time_format === '24h') : '--:--';

    const radarLat   = safeNum(this._config.radar_latitude);
    const radarLon   = safeNum(this._config.radar_longitude);
    const radarZoom  = parseInt(this._config.radar_zoom) || 7;
    const radarReady = radarLat !== null && radarLon !== null;

    // ── Dynamic HTML (everything except radar body) ───────────────────────
    const dyn = this.shadowRoot.getElementById('swc-dyn');
    if (dyn) {
      dyn.innerHTML = `
        <div class="swc-inner">
          <div class="swc-header">
            <div>
              <div class="swc-time">${timeStr}</div>
              <div class="swc-date">
                ${dateStr}${rainAlert && this._config.show_radar
                  ? `<span class="swc-rain-pill">🌧️ ${round1(precip)} mm/h</span>` : ''}
              </div>
            </div>
            ${this._config.show_weather_section ? `
            <div class="swc-weather-col">
              <div class="swc-wx-icon">${weatherIcon(wxState)}</div>
              <div class="swc-wx-temp">${wxTemp !== null ? wxTemp : '--'}${wxUnit}</div>
              <div class="swc-wx-desc">${wxDesc}</div>
            </div>` : ''}
          </div>
        </div>

        ${this._config.show_weather_section && this._config.show_forecast_days && fc.length ? `
        <div class="swc-divider"></div>
        <div class="swc-forecast-wrap">
          <div class="swc-fc-header">
            <span class="swc-fc-title">${displayDays === 1 ? 'Today' : `${displayDays}-Day Forecast`}</span>
            <span class="swc-expand-btn" id="swc-expand-btn">
              ${canExpand ? 'more ›' : canCollapse ? '▾ less' : ''}
            </span>
          </div>
          ${this._renderForecastRows(forecastSlice, colors)}
        </div>
        ` : ''}

        ${this._config.show_solar_section ? `
        <div class="swc-divider"></div>
        <div class="swc-solar-wrap">
          ${this._renderSolarBar(solar, exportKw, importKw, usage, solarPct, isStandby, colors)}
        </div>
        ` : ''}

        ${this._config.show_solar_arc ? `
        <div class="swc-divider"></div>
        ${this._renderDayBar(arcPct, srLabel, ssLabel)}
        ` : ''}

        ${this._config.show_radar ? `
        <div class="swc-divider"></div>
        <div class="swc-radar-wrap">
          <div class="swc-radar-header" id="swc-radar-toggle">
            <span class="swc-radar-title">📡 Weather Radar
              ${rainAlert ? `<span class="swc-radar-badge">${round1(precip)} mm/h</span>` : ''}
            </span>
            <span class="swc-radar-chevron ${this._radarExpanded ? 'open' : ''}">›</span>
          </div>
        </div>
        ` : ''}
      `;

      // Wire events (re-attached each render since dyn innerHTML was replaced)
      const expandBtn = dyn.querySelector('#swc-expand-btn');
      if (expandBtn) {
        expandBtn.addEventListener('click', () => {
          this._forecastExpanded = !this._forecastExpanded;
          this._render();
        });
      }

      const radarToggle = dyn.querySelector('#swc-radar-toggle');
      if (radarToggle) {
        radarToggle.addEventListener('click', () => {
          this._radarExpanded = !this._radarExpanded;
          this._render();
        });
      }
    }

    // ── Radar stable section (iframe never detached from DOM) ─────────────
    this._updateRadarStable(radarLat, radarLon, radarZoom, radarReady);
  }

  // ── Forecast rows ─────────────────────────────────────────────────────────

  _renderForecastRows(forecast, colors) {
    if (!forecast.length) return '';

    const temps = forecast.map(d => {
      const hi = safeNum(d.temperature) ?? safeNum(d.temp_high);
      const lo = safeNum(d.templow) ?? safeNum(d.temp_low) ?? (hi !== null ? hi - 8 : null);
      return { hi, lo };
    });

    const hiVals     = temps.map(t => t.hi).filter(v => v !== null);
    const loVals     = temps.map(t => t.lo).filter(v => v !== null);
    const scaleMin   = loVals.length ? Math.min(...loVals) - 2 : 0;
    const scaleMax   = hiVals.length ? Math.max(...hiVals) + 2 : 30;
    const scaleRange = scaleMax - scaleMin || 1;

    return forecast.map((day, i) => {
      const dt       = new Date(day.datetime);
      const { hi, lo } = temps[i];
      const isRain   = ['rainy','pouring','snowy-rainy','lightning-rainy'].includes(day.condition);
      const barColor = isRain ? colors.temp_rain : colors.temp_bar;
      const leftPct  = lo !== null ? ((lo - scaleMin) / scaleRange) * 100 : 0;
      const widthPct = (hi !== null && lo !== null) ? ((hi - lo) / scaleRange) * 100 : 0;

      return `
        <div class="swc-day-row">
          <span class="swc-day-name">${i === 0 ? 'Today' : dayAbbr(dt)}</span>
          <span class="swc-day-icon">${weatherIcon(day.condition)}</span>
          <span class="swc-temp-lo">${lo !== null ? `${Math.round(lo)}°` : '--'}</span>
          <div class="swc-temp-track">
            ${widthPct > 0 ? `<div class="swc-temp-fill" style="left:${leftPct.toFixed(1)}%;width:${widthPct.toFixed(1)}%;background:${barColor};"></div>` : ''}
          </div>
          <span class="swc-temp-hi">${hi !== null ? `${Math.round(hi)}°` : '--'}</span>
        </div>`;
    }).join('');
  }

  // ── Solar bar ─────────────────────────────────────────────────────────────

  _renderSolarBar(solar, exportKw, importKw, usage, solarPct, isStandby, colors) {
    const showVals  = this._config.show_bar_values;
    const showStats = this._config.show_stats;
    const barLabel  = showVals && solarPct > 12 ? `${round1(solar)} kW` : '';

    return `
      <div class="swc-solar-header">
        <span class="swc-solar-label">☀️ Solar</span>
        <span>
          <span class="swc-solar-kw" style="color:${isStandby ? 'var(--secondary-text-color)' : colors.solar}">
            ${isStandby ? '—' : round1(solar)}
          </span>
          <span class="swc-solar-kw-unit"> kW</span>
        </span>
      </div>

      ${isStandby
        ? `<div class="swc-standby">System in standby</div>`
        : `<div class="swc-pwr-bar">
             <div class="swc-pwr-fill" style="width:${solarPct.toFixed(1)}%;">
               <span class="swc-pwr-val">${barLabel}</span>
             </div>
           </div>`
      }

      ${showStats && !isStandby ? `
      <div class="swc-stat-row">
        <div class="swc-stat-item">
          <div class="swc-stat-dot" style="background:${colors.export}"></div>
          <span class="swc-stat-lbl">Export</span>
          <span class="swc-stat-val">&nbsp;${round1(exportKw)} kW</span>
        </div>
        <div class="swc-stat-item">
          <div class="swc-stat-dot" style="background:${colors.import}"></div>
          <span class="swc-stat-lbl">Import</span>
          <span class="swc-stat-val">&nbsp;${round1(importKw)} kW</span>
        </div>
        <div class="swc-stat-item">
          <div class="swc-stat-dot" style="background:${colors.self_usage}"></div>
          <span class="swc-stat-lbl">Usage</span>
          <span class="swc-stat-val">&nbsp;${round1(Math.max(0, Math.min(solar, usage)) + importKw)} kW</span>
        </div>
      </div>` : ''}
    `;
  }

  // ── Day progress bar ──────────────────────────────────────────────────────

  _renderDayBar(arcPct, srLabel, ssLabel) {
    const fillPct = (arcPct * 100).toFixed(1);
    const sunPct  = clamp(arcPct * 100, 2, 98).toFixed(1);
    const isNight = arcPct <= 0 || arcPct >= 1;
    return `
      <div class="swc-daybar-wrap">
        <div class="swc-daybar-label">Solar Day</div>
        <div class="swc-daybar-track">
          <div class="swc-daybar-fill" style="width:${fillPct}%;"></div>
          <div class="swc-daybar-sun"  style="left:${sunPct}%">${isNight ? '🌙' : '☀️'}</div>
        </div>
        <div class="swc-daybar-times">
          <span>🌅 ${srLabel}</span>
          <span>🌇 ${ssLabel}</span>
        </div>
      </div>`;
  }

  // ── Radar stable section ──────────────────────────────────────────────────
  // This container is NEVER cleared by innerHTML — only managed imperatively.
  // The iframe, once appended, stays in the DOM across all re-renders.

  _updateRadarStable(lat, lon, zoom, radarReady) {
    const stable = this.shadowRoot.getElementById('swc-radar-stable');
    if (!stable) return;

    // Hide when radar is off or collapsed
    if (!this._config.show_radar || !this._radarExpanded) {
      stable.style.display = 'none';
      return;
    }

    stable.style.cssText = 'display:block;';

    if (!radarReady) {
      // No lat/lon configured — show instruction note
      if (!stable.querySelector('.swc-radar-note')) {
        stable.innerHTML = `
          <div class="swc-radar-body-wrap">
            <div class="swc-radar-note">
              Set <strong>Home latitude</strong> and <strong>Home longitude</strong>
              in the card editor to enable the radar map.
            </div>
          </div>`;
      }
      return;
    }

    const key = `${lat}_${lon}_${zoom}`;

    // Create iframe only when config changes (not on every render)
    if (!this._radarIframe || this._radarIframeKey !== key) {
      const iframe         = document.createElement('iframe');
      iframe.srcdoc        = this._buildRadarHtml(lat, lon, zoom);
      iframe.style.cssText = 'width:100%;height:300px;border:none;display:block;';
      iframe.setAttribute('sandbox', 'allow-scripts'); // no allow-same-origin → null CSP → CDN loads freely
      iframe.title         = 'Weather Radar';
      this._radarIframe    = iframe;
      this._radarIframeKey = key;
    }

    // Only append if not already in the stable container — this is the key:
    // if the iframe is already here, we do NOTHING, so it is never reloaded.
    if (!stable.contains(this._radarIframe)) {
      stable.innerHTML = ''; // clear any note/placeholder first
      const wrap = document.createElement('div');
      wrap.className = 'swc-radar-body-wrap';
      wrap.style.cssText = 'padding:0 20px 14px;';
      wrap.appendChild(this._radarIframe);
      stable.appendChild(wrap);
    }
  }

  // ── Radar HTML ────────────────────────────────────────────────────────────

  _buildRadarHtml(lat, lon, zoom) {
    return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" crossorigin=""/>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  html, body { height:100%; background:#2a2a2a; }
  #map { height: calc(100% - 24px); }
  #bar {
    height:24px; background:rgba(0,0,0,0.8);
    display:flex; align-items:center; justify-content:center;
    font:11px/1 sans-serif; color:#aaa; letter-spacing:0.04em;
  }
</style>
</head>
<body>
<div id="map"></div>
<div id="bar">Loading radar…</div>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js" crossorigin=""></script>
<script>
(function () {
  var LAT = ${lat}, LON = ${lon}, ZOOM = ${zoom}, MAX_FRAMES = 6;

  var map = L.map('map', {
    zoomControl: true,
    attributionControl: false,
    scrollWheelZoom: true
  }).setView([LAT, LON], ZOOM);

  L.tileLayer(
    'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png',
    { subdomains: ['a','b','c','d'], maxZoom: 19 }
  ).addTo(map);

  var homeIcon = L.divIcon({
    html: '<div style="font-size:20px;line-height:1;filter:drop-shadow(0 1px 3px rgba(0,0,0,0.6))">🏠</div>',
    iconSize: [20, 20], iconAnchor: [10, 17], className: ''
  });
  L.marker([LAT, LON], { icon: homeIcon }).addTo(map);

  var layers = [], frameTimestamps = [], cur = 0;

  function showFrame(i) {
    layers.forEach(function (l, j) { l.setOpacity(j === i ? 0.65 : 0); });
    var d = new Date(frameTimestamps[i] * 1000);
    document.getElementById('bar').textContent =
      'Radar \u2014 ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    cur = i;
  }

  async function loadRadar() {
    try {
      var res  = await fetch('https://api.rainviewer.com/public/weather-maps.json');
      var data = await res.json();
      var frames = (data.radar.past || []).slice(-MAX_FRAMES);
      if (!frames.length) { document.getElementById('bar').textContent = 'No radar data'; return; }

      frameTimestamps = frames.map(function (f) { return f.time; });
      layers = frames.map(function (f) {
        return L.tileLayer(
          'https://tilecache.rainviewer.com' + f.path + '/256/{z}/{x}/{y}/4/1_1.png',
          { opacity: 0, zIndex: 10, tileSize: 256 }
        );
      });
      layers.forEach(function (l) { l.addTo(map); });

      showFrame(frames.length - 1);
      setInterval(function () { showFrame((cur + 1) % frames.length); }, 900);
    } catch (e) {
      document.getElementById('bar').textContent = 'Radar unavailable';
    }
  }

  loadRadar();
})();
</script>
</body>
</html>`;
  }

  getCardSize() { return 5; }
}

customElements.define(CARD_TAG, SolarWeatherCard);

window.customCards = window.customCards || [];
window.customCards.push({
  type:        CARD_TAG,
  name:        'Solar Weather Card',
  description: 'Clock, weather forecast, solar power bar, solar day progress and built-in animated rain radar.',
  preview:     false,
  version:     VERSION,
});

console.info(
  `%c SOLAR-WEATHER-CARD %c v${VERSION} `,
  'color:#fff;background:#f57c00;font-weight:700;padding:2px 4px;border-radius:4px 0 0 4px;',
  'color:#f57c00;background:#fff3e0;font-weight:700;padding:2px 4px;border-radius:0 4px 4px 0;'
);
