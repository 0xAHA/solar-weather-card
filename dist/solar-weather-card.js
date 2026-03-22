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
// Uses HA-native ha-selector elements for a first-class visual editing experience.

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
    // Propagate hass to existing selectors without full re-render
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
          { key: 'weather_entity',      label: 'Weather entity',           selector: { entity: { domain: 'weather' } } },
          { key: 'show_weather_section', label: 'Show weather section',     selector: { boolean: {} } },
          { key: 'show_forecast_days',   label: 'Show forecast day bars',   selector: { boolean: {} } },
          { key: 'forecast_days',        label: 'Forecast days (1–7)',      selector: { number: { min: 1, max: 7, step: 1, mode: 'slider' } } },
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
          { key: 'forecast_entity',         label: 'Solar forecast sensor',       selector: { entity: {} } },
          { key: 'use_solcast',             label: 'Auto-detect Solcast sensor',  selector: { boolean: {} } },
        ],
      },
      {
        id: 'radar', title: '📡 Radar', defaultOpen: false,
        fields: [
          { key: 'show_radar',           label: 'Enable radar panel',       selector: { boolean: {} } },
          { key: 'precipitation_entity', label: 'Precipitation sensor',     selector: { entity: {} } },
          { key: 'radar_rain_threshold', label: 'Auto-expand threshold (mm/h)', selector: { number: { min: 0, max: 50, step: 0.1, mode: 'box' } } },
          { key: 'radar_latitude',       label: 'Home latitude',            selector: { number: { min: -90,  max: 90,  step: 0.0001, mode: 'box' } } },
          { key: 'radar_longitude',      label: 'Home longitude',           selector: { number: { min: -180, max: 180, step: 0.0001, mode: 'box' } } },
          { key: 'radar_zoom',           label: 'Zoom level (4–14)',        selector: { number: { min: 4, max: 14, step: 1, mode: 'slider' } } },
        ],
      },
      {
        id: 'display', title: '🎨 Display', defaultOpen: false,
        fields: [
          { key: 'color_palette',   label: 'Colour palette',           selector: { select: { options: palettes } } },
          { key: 'show_stats',      label: 'Show solar stat tiles',    selector: { boolean: {} } },
          { key: 'show_legend',     label: 'Show legend',              selector: { boolean: {} } },
          { key: 'show_bar_values', label: 'Show values on solar bar', selector: { boolean: {} } },
        ],
      },
    ];

    // Build HTML scaffold with slot placeholders
    let html = `
      <style>
        :host { display: block; font-family: var(--primary-font-family, sans-serif); }
        .swce-section {
          border: 1px solid var(--divider-color, #e0e0e0);
          border-radius: 8px; margin-bottom: 8px; overflow: hidden;
        }
        .swce-section > summary {
          padding: 10px 14px; cursor: pointer; font-weight: 500;
          background: var(--secondary-background-color, #f5f5f5);
          list-style: none; display: flex; align-items: center;
          font-size: 14px; color: var(--primary-text-color);
          user-select: none;
        }
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
      for (const field of sec.fields) {
        html += `<div data-slot="${field.key}"></div>`;
      }
      html += `</div></details>`;
    }

    shadow.innerHTML = html;

    // Inject ha-selector elements into their slots
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

    // Persist section open/close state to config
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
    this._config             = {};
    this._hass               = null;
    this._tickInterval       = null;
    this._forecastExpanded   = false;
    this._radarExpanded      = false;
    // Forecast subscription (modern HA weather entities use WS subscriptions)
    this._forecastUnsub      = null;
    this._weatherForecast    = [];
    this._lastWeatherEntity  = null;
    // Radar iframe caching (preserve map state across re-renders)
    this._radarIframe        = null;
    this._radarIframeKey     = null;
    this._radarBlobUrl       = null;
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
      forecast_days:           1,
      time_format:             '24h',
      date_format:             'D, dd MMM yyyy',
      color_palette:           'classic-solar',
      show_weather_section:    true,
      show_forecast_days:      true,
      show_solar_section:      true,
      show_solar_arc:          true,
      show_stats:              true,
      show_legend:             true,
      show_bar_values:         true,
      show_radar:              false,
      radar_rain_threshold:    0.5,
      radar_zoom:              7,
      use_solcast:             false,
    };
  }

  setConfig(config) {
    const prevEntity = this._config.weather_entity;
    this._config = { ...SolarWeatherCard.getStubConfig(), ...config };
    if (this._hass && config.weather_entity !== prevEntity) {
      this._subscribeForecast();
    }
    this._render();
  }

  set hass(hass) {
    const firstHass       = !this._hass;
    const entityChanged   = hass && (this._config.weather_entity !== this._lastWeatherEntity);
    this._hass = hass;

    if (firstHass || entityChanged) {
      this._subscribeForecast();
    }
    this._render();
  }

  connectedCallback() {
    this._tickInterval = setInterval(() => this._render(), 30000);
    if (this._hass) this._subscribeForecast();
  }

  disconnectedCallback() {
    clearInterval(this._tickInterval);
    this._unsubForecast();
    if (this._radarBlobUrl) {
      URL.revokeObjectURL(this._radarBlobUrl);
      this._radarBlobUrl = null;
    }
  }

  // ── Forecast subscription ──────────────────────────────────────────────────
  // Modern HA (2023.9+) does not expose forecast in weather attributes;
  // we must subscribe via the weather/subscribe_forecast websocket message.

  async _subscribeForecast() {
    this._unsubForecast();

    const entity = this._config.weather_entity;
    if (!entity || !this._hass) return;

    this._lastWeatherEntity = entity;

    try {
      this._forecastUnsub = await this._hass.connection.subscribeMessage(
        (event) => {
          this._weatherForecast = event.forecast || [];
          this._render();
        },
        {
          type:          'weather/subscribe_forecast',
          forecast_type: 'daily',
          entity_id:     entity,
        }
      );
    } catch (err) {
      // Fallback: try legacy attributes.forecast (older HA / local calendar integrations)
      console.warn(`[solar-weather-card] Forecast subscription failed for ${entity}:`, err);
      const wx = this._hass.states[entity];
      this._weatherForecast = wx?.attributes?.forecast || [];
      this._render();
    }
  }

  _unsubForecast() {
    if (this._forecastUnsub) {
      try { this._forecastUnsub(); } catch (_) {}
      this._forecastUnsub = null;
    }
  }

  // ── Data helpers ───────────────────────────────────────────────────────────

  _getState(entity) {
    return entity && this._hass ? this._hass.states[entity] : null;
  }

  _getSolarForecastEntity() {
    if (this._config.forecast_entity) return this._getState(this._config.forecast_entity);
    if (this._config.use_solcast) {
      for (const c of ['sensor.solcast_pv_forecast_power_now', 'sensor.solcast_forecast_power_now', 'sensor.solcast_power_now']) {
        if (this._hass?.states[c]) return this._hass.states[c];
      }
    }
    return null;
  }

  _getPrecipitation() {
    const ent = this._getState(this._config.precipitation_entity);
    if (ent) return parseFloat(ent.state) || 0;
    // Fallback: first forecast entry from subscription cache
    const fc = this._weatherForecast;
    if (fc && fc[0]) return parseFloat(fc[0].precipitation || 0);
    return 0;
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  _render() {
    if (!this._config || !this._hass) return;

    const palette  = getPalette(this._config.color_palette);
    const colors   = palette.colors;

    // Clock
    const now      = new Date();
    const timeStr  = formatTime(now, this._config.time_format === '24h');
    const dateStr  = formatDate(now, this._config.date_format);
    const ampm     = now.getHours() < 12 ? 'AM' : 'PM';
    const show24   = this._config.time_format === '24h';

    // Weather
    const wxEnt    = this._getState(this._config.weather_entity);
    const wxState  = wxEnt?.state || '';
    const wxIcon   = weatherIcon(wxState);
    const wxTemp   = wxEnt?.attributes.temperature ?? '--';
    const wxUnit   = wxEnt?.attributes.temperature_unit || '°C';
    const wxDesc   = wxState.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());

    // Solar
    const inverter = parseFloat(this._config.inverter_size) || 10;
    const solar    = parseKw(this._getState(this._config.production_entity));
    const usage    = parseKw(this._getState(this._config.self_consumption_entity));
    const exportKw = parseKw(this._getState(this._config.export_entity));
    const importKw = parseKw(this._getState(this._config.import_entity));
    const selfUse  = Math.max(0, Math.min(solar, usage));
    const unused   = Math.max(0, inverter - solar - importKw);
    const isStandby = solar < 0.01;

    const fcastEnt = this._getSolarForecastEntity();
    const fcastKw  = fcastEnt ? parseKw(fcastEnt) : null;

    const pct       = v => clamp((v / inverter) * 100, 0, 100);
    const selfPct   = pct(selfUse);
    const expPct    = pct(exportKw);
    const impPct    = pct(importKw);
    const unusedPct = pct(unused);
    const fcastPct  = fcastKw !== null ? pct(fcastKw) : null;

    // Precipitation / radar auto-expand
    const precip    = this._getPrecipitation();
    const threshold = parseFloat(this._config.radar_rain_threshold) || 0.5;
    const rainAlert = precip >= threshold;
    if (rainAlert && this._config.show_radar) this._radarExpanded = true;

    // Forecast days
    const forecastDays = parseInt(this._config.forecast_days) || 1;
    const displayDays  = this._forecastExpanded ? Math.min(7, this._weatherForecast.length) : 1;
    const forecast     = (this._weatherForecast || []).slice(0, displayDays);

    // Sun arc progress
    const sunObj   = this._hass?.states['sun.sun'];
    const sunrise  = sunObj?.attributes.next_rising  ? new Date(sunObj.attributes.next_rising)  : null;
    const sunset   = sunObj?.attributes.next_setting ? new Date(sunObj.attributes.next_setting) : null;
    let arcPct = 0.5;
    if (sunrise && sunset) {
      arcPct = clamp((now - sunrise) / (sunset - sunrise), 0, 1);
    }
    const srLabel = sunrise ? formatTime(sunrise, show24) : '--:--';
    const ssLabel = sunset  ? formatTime(sunset,  show24) : '--:--';

    // Radar
    const radarLat   = parseFloat(this._config.radar_latitude);
    const radarLon   = parseFloat(this._config.radar_longitude);
    const radarZoom  = parseInt(this._config.radar_zoom) || 7;
    const radarReady = !isNaN(radarLat) && !isNaN(radarLon) && radarLat !== 0 && radarLon !== 0;

    // ── HTML ─────────────────────────────────────────────────────────────────
    this.shadowRoot.innerHTML = `
      <style>
        :host { display: block; }
        .swc-card {
          background: var(--ha-card-background, var(--card-background-color, #fff));
          border-radius: var(--ha-card-border-radius, 12px);
          border: 0.5px solid var(--divider-color, rgba(0,0,0,0.12));
          padding: 0; overflow: hidden;
          font-family: var(--primary-font-family, sans-serif);
          color: var(--primary-text-color);
        }
        .swc-inner { padding: 16px 20px; }

        /* Clock */
        .swc-header { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 12px; }
        .swc-time { font-size: 52px; font-weight: 300; line-height: 1; letter-spacing: -1px; }
        .swc-ampm { display: inline-block; font-size: 13px; font-weight: 400; color: var(--secondary-text-color); background: var(--secondary-background-color, rgba(0,0,0,0.06)); border-radius: 8px; padding: 2px 7px; margin-left: 6px; vertical-align: middle; position: relative; top: -6px; }
        .swc-date { font-size: 13px; color: var(--secondary-text-color); margin-top: 4px; }
        .swc-weather-col { text-align: center; min-width: 80px; }
        .swc-wx-icon { font-size: 34px; line-height: 1; }
        .swc-wx-temp { font-size: 26px; font-weight: 300; margin-top: 2px; }
        .swc-wx-desc { font-size: 11px; color: var(--secondary-text-color); margin-top: 2px; }

        /* Divider */
        .swc-divider { height: 0.5px; background: var(--divider-color, rgba(0,0,0,0.12)); margin: 0 20px; }

        /* Forecast */
        .swc-forecast-wrap { padding: 12px 20px; }
        .swc-section-label { font-size: 10px; font-weight: 500; letter-spacing: 0.06em; color: var(--secondary-text-color); text-transform: uppercase; margin-bottom: 8px; display: flex; justify-content: space-between; }
        .swc-expand-btn { font-size: 11px; cursor: pointer; color: var(--accent-color, #03a9f4); letter-spacing: 0; text-transform: none; }
        .swc-day-row { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; }
        .swc-day-name { font-size: 12px; width: 28px; flex-shrink: 0; color: var(--secondary-text-color); }
        .swc-day-icon { width: 20px; flex-shrink: 0; font-size: 14px; }
        .swc-temp-track { flex: 1; height: 10px; background: var(--secondary-background-color, rgba(0,0,0,0.06)); border-radius: 5px; position: relative; }
        .swc-temp-fill  { height: 10px; border-radius: 5px; position: absolute; }
        .swc-temp-lo { font-size: 11px; color: var(--secondary-text-color); width: 28px; text-align: right; flex-shrink: 0; }
        .swc-temp-hi { font-size: 11px; font-weight: 500; width: 28px; flex-shrink: 0; }

        /* Solar */
        .swc-solar-wrap { padding: 12px 20px; }
        .swc-solar-title-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
        .swc-solar-title { font-size: 13px; font-weight: 500; }
        .swc-solar-subtitle { font-size: 11px; color: var(--secondary-text-color); }
        .swc-standby { font-size: 12px; color: var(--secondary-text-color); text-align: center; padding: 8px 0; }
        .swc-stats { display: grid; grid-template-columns: repeat(4, minmax(0,1fr)); gap: 6px; margin-bottom: 10px; }
        .swc-stat { background: var(--secondary-background-color, rgba(0,0,0,0.04)); border-radius: 8px; padding: 6px 10px; }
        .swc-stat-label { font-size: 10px; color: var(--secondary-text-color); }
        .swc-stat-value { font-size: 13px; font-weight: 500; }
        .swc-bar-label { font-size: 10px; color: var(--secondary-text-color); margin-bottom: 4px; text-transform: uppercase; letter-spacing: 0.05em; }
        .swc-bar { height: 28px; border-radius: 7px; background: var(--secondary-background-color, rgba(0,0,0,0.06)); position: relative; overflow: hidden; display: flex; }
        .swc-bar-seg { height: 100%; display: flex; align-items: center; justify-content: center; font-size: 10px; font-weight: 500; overflow: hidden; white-space: nowrap; }
        .swc-bar-seg-self   { background: ${colors.self_usage}; color: rgba(0,0,0,0.75); }
        .swc-bar-seg-export { background: ${colors.export}; color: rgba(0,0,0,0.75); }
        .swc-bar-seg-import { background: ${colors.import}; color: rgba(0,0,0,0.75); }
        .swc-bar-seg-unused { background: ${colors.unused}; }
        .swc-bar-forecast { position: absolute; top: 0; bottom: 0; width: 2px; background: ${colors.forecast}; opacity: 0.85; pointer-events: none; }
        .swc-legend { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 8px; }
        .swc-legend-item { display: flex; align-items: center; gap: 4px; font-size: 11px; color: var(--secondary-text-color); }
        .swc-legend-dot { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; }

        /* Day progress bar */
        .swc-daybar-wrap { padding: 8px 20px 16px; }
        .swc-daybar-label { font-size: 10px; font-weight: 500; letter-spacing: 0.06em; color: var(--secondary-text-color); text-transform: uppercase; margin-bottom: 10px; }
        .swc-daybar-track { position: relative; height: 6px; background: var(--secondary-background-color, rgba(0,0,0,0.08)); border-radius: 3px; margin: 14px 0 18px; }
        .swc-daybar-fill  { position: absolute; left: 0; top: 0; bottom: 0; border-radius: 3px; }
        .swc-daybar-sun   { position: absolute; top: 50%; transform: translate(-50%, -50%); font-size: 20px; line-height: 1; pointer-events: none; }
        .swc-daybar-times { display: flex; justify-content: space-between; font-size: 11px; color: var(--secondary-text-color); }

        /* Radar */
        .swc-radar-wrap { padding: 0 20px 14px; }
        .swc-radar-header { display: flex; align-items: center; justify-content: space-between; background: var(--secondary-background-color, rgba(0,0,0,0.04)); border-radius: 8px; padding: 9px 14px; cursor: pointer; user-select: none; }
        .swc-radar-title { font-size: 13px; font-weight: 500; }
        .swc-radar-badge { font-size: 11px; padding: 2px 8px; border-radius: 8px; background: var(--error-color, #f44336); color: #fff; margin-left: 8px; }
        .swc-radar-chevron { font-size: 12px; color: var(--secondary-text-color); transition: transform 0.2s; }
        .swc-radar-chevron.open { transform: rotate(90deg); }
        .swc-radar-note { font-size: 11px; color: var(--secondary-text-color); padding: 12px; text-align: center; }

        /* Rain pill on date row */
        .swc-rain-pill { display: inline-block; background: var(--info-color, #2196f3); color: #fff; font-size: 10px; border-radius: 8px; padding: 1px 7px; margin-left: 8px; vertical-align: middle; }
      </style>

      <ha-card class="swc-card">
        <div class="swc-inner">

          <!-- Clock / Weather Header -->
          <div class="swc-header">
            <div class="swc-clock-col">
              <div class="swc-time">
                ${timeStr.replace(/\s?(AM|PM)$/, '')}${show24 ? '' : `<span class="swc-ampm">${ampm}</span>`}
              </div>
              <div class="swc-date">
                ${dateStr}${rainAlert && this._config.show_radar ? `<span class="swc-rain-pill">🌧️ ${round1(precip)} mm/h</span>` : ''}
              </div>
            </div>
            <div class="swc-weather-col">
              <div class="swc-wx-icon">${wxIcon}</div>
              <div class="swc-wx-temp">${wxTemp}${wxUnit}</div>
              <div class="swc-wx-desc">${wxDesc}</div>
            </div>
          </div>

        </div>

        <!-- Forecast -->
        ${this._config.show_weather_section && this._config.show_forecast_days ? `
        <div class="swc-divider"></div>
        <div class="swc-forecast-wrap">
          <div class="swc-section-label">
            <span>${forecastDays === 1 ? 'Today' : `${forecastDays}-day forecast`}</span>
            <span class="swc-expand-btn" id="swc-expand-btn">
              ${this._forecastExpanded ? '▾ collapse' : forecastDays < 7 ? 'expand ›' : ''}
            </span>
          </div>
          ${this._renderForecastRows(forecast, colors)}
        </div>
        ` : ''}

        <!-- Solar bar -->
        ${this._config.show_solar_section ? `
        <div class="swc-divider"></div>
        <div class="swc-solar-wrap">
          <div class="swc-solar-title-row">
            <span class="swc-solar-title">Solar Power</span>
            <span class="swc-solar-subtitle">${isStandby ? 'System standby' : `☀️ ${round1(solar)} kW`}</span>
          </div>
          ${isStandby
            ? `<div class="swc-standby">Solar system in standby mode</div>`
            : this._renderSolarBar(selfUse, exportKw, importKw, unused, selfPct, expPct, impPct, unusedPct, fcastPct, colors)
          }
        </div>
        ` : ''}

        <!-- Day progress bar -->
        ${this._config.show_solar_arc ? `
        <div class="swc-divider"></div>
        ${this._renderDayBar(arcPct, srLabel, ssLabel, colors)}
        ` : ''}

        <!-- Radar -->
        ${this._config.show_radar ? `
        <div class="swc-divider"></div>
        <div class="swc-radar-wrap">
          <div class="swc-radar-header" id="swc-radar-toggle">
            <span class="swc-radar-title">📡 Weather Radar${rainAlert ? `<span class="swc-radar-badge">${round1(precip)} mm/h</span>` : ''}</span>
            <span class="swc-radar-chevron ${this._radarExpanded ? 'open' : ''}">›</span>
          </div>
          ${this._radarExpanded ? `<div id="swc-radar-mount"></div>` : ''}
        </div>
        ` : ''}

      </ha-card>
    `;

    // Wire events
    const expandBtn = this.shadowRoot.getElementById('swc-expand-btn');
    if (expandBtn) {
      expandBtn.addEventListener('click', () => {
        this._forecastExpanded = !this._forecastExpanded;
        this._render();
      });
    }

    const radarToggle = this.shadowRoot.getElementById('swc-radar-toggle');
    if (radarToggle) {
      radarToggle.addEventListener('click', () => {
        this._radarExpanded = !this._radarExpanded;
        this._render();
      });
    }

    // Mount radar (cached iframe so map state survives re-renders)
    const radarMount = this.shadowRoot.getElementById('swc-radar-mount');
    if (radarMount) {
      radarMount.appendChild(this._getRadarContent(radarLat, radarLon, radarZoom, radarReady));
    }
  }

  // ── Forecast rows ─────────────────────────────────────────────────────────

  _renderForecastRows(forecast, colors) {
    if (!forecast || !forecast.length) {
      return `<div style="font-size:12px;color:var(--secondary-text-color)">No forecast data — check weather entity and ensure it supports daily forecasts.</div>`;
    }

    const allLo     = forecast.map(d => d.templow ?? (d.temperature - 8));
    const allHi     = forecast.map(d => d.temperature ?? 30);
    const scaleMin  = Math.min(...allLo) - 2;
    const scaleMax  = Math.max(...allHi) + 2;
    const scaleRange = scaleMax - scaleMin || 1;

    return forecast.map((day, i) => {
      const dt       = new Date(day.datetime);
      const lo       = day.templow ?? Math.round(day.temperature - 8);
      const hi       = day.temperature ?? '--';
      const icon     = weatherIcon(day.condition);
      const isRain   = ['rainy','pouring','snowy-rainy','lightning-rainy'].includes(day.condition);
      const barColor = isRain ? colors.temp_rain : colors.temp_bar;
      const leftPct  = ((lo - scaleMin) / scaleRange) * 100;
      const widthPct = ((hi - lo) / scaleRange) * 100;
      return `
        <div class="swc-day-row">
          <span class="swc-day-name">${i === 0 ? 'Today' : dayAbbr(dt)}</span>
          <span class="swc-day-icon">${icon}</span>
          <span class="swc-temp-lo">${Math.round(lo)}°</span>
          <div class="swc-temp-track">
            <div class="swc-temp-fill" style="left:${leftPct.toFixed(1)}%;width:${widthPct.toFixed(1)}%;background:${barColor};"></div>
          </div>
          <span class="swc-temp-hi">${Math.round(hi)}°</span>
        </div>`;
    }).join('');
  }

  // ── Solar bar ─────────────────────────────────────────────────────────────

  _renderSolarBar(selfUse, exportKw, importKw, unused, selfPct, expPct, impPct, unusedPct, fcastPct, colors) {
    const showVals    = this._config.show_bar_values;
    const minLabelPct = 9;

    const seg = (cls, p, label) => p < 0.5 ? '' : `
      <div class="swc-bar-seg ${cls}" style="width:${p.toFixed(2)}%">
        ${showVals && p >= minLabelPct ? label : ''}
      </div>`;

    return `
      ${this._config.show_stats ? `
      <div class="swc-stats">
        <div class="swc-stat">
          <div class="swc-stat-label">Solar</div>
          <div class="swc-stat-value" style="color:${colors.solar}">${round1(selfUse + exportKw)} kW</div>
        </div>
        <div class="swc-stat">
          <div class="swc-stat-label">Usage</div>
          <div class="swc-stat-value">${round1(selfUse + importKw)} kW</div>
        </div>
        <div class="swc-stat">
          <div class="swc-stat-label">Export</div>
          <div class="swc-stat-value" style="color:${colors.export}">${round1(exportKw)} kW</div>
        </div>
        <div class="swc-stat">
          <div class="swc-stat-label">Import</div>
          <div class="swc-stat-value" style="color:${exportKw > 0.05 ? 'var(--secondary-text-color)' : colors.import}">${round1(importKw)} kW</div>
        </div>
      </div>` : ''}

      <div class="swc-bar-label">Power distribution</div>
      <div class="swc-bar">
        ${seg('swc-bar-seg-self',   selfPct,   `Self ${round1(selfUse)}kW`)}
        ${seg('swc-bar-seg-export', expPct,    `Export ${round1(exportKw)}kW`)}
        ${seg('swc-bar-seg-import', impPct,    `Import ${round1(importKw)}kW`)}
        ${seg('swc-bar-seg-unused', unusedPct, '')}
        ${fcastPct !== null ? `<div class="swc-bar-forecast" style="left:${fcastPct.toFixed(2)}%"></div>` : ''}
      </div>

      ${this._config.show_legend ? `
      <div class="swc-legend">
        <div class="swc-legend-item"><div class="swc-legend-dot" style="background:${colors.self_usage}"></div>Self-use</div>
        <div class="swc-legend-item"><div class="swc-legend-dot" style="background:${colors.export}"></div>Export</div>
        <div class="swc-legend-item"><div class="swc-legend-dot" style="background:${colors.import}"></div>Import</div>
        ${fcastPct !== null ? `<div class="swc-legend-item"><div class="swc-legend-dot" style="background:${colors.forecast};border-radius:2px;height:3px;width:14px;"></div>Forecast</div>` : ''}
      </div>` : ''}
    `;
  }

  // ── Day progress bar (replaces the oversized SVG arc) ─────────────────────

  _renderDayBar(arcPct, srLabel, ssLabel, colors) {
    const fillPct = (arcPct * 100).toFixed(1);
    const sunPct  = clamp(arcPct * 100, 2, 98).toFixed(1);
    const isNight = arcPct <= 0 || arcPct >= 1;
    return `
      <div class="swc-daybar-wrap">
        <div class="swc-daybar-label">Solar Day Progress</div>
        <div class="swc-daybar-track">
          <div class="swc-daybar-fill" style="width:${fillPct}%;background:${colors.solar};"></div>
          <div class="swc-daybar-sun"  style="left:${sunPct}%">${isNight ? '🌙' : '☀️'}</div>
        </div>
        <div class="swc-daybar-times">
          <span>🌅 ${srLabel}</span>
          <span>🌇 ${ssLabel}</span>
        </div>
      </div>`;
  }

  // ── Radar (built-in Leaflet map in a cached iframe) ───────────────────────

  _getRadarContent(lat, lon, zoom, radarReady) {
    const wrapper = document.createElement('div');
    wrapper.style.cssText = 'margin-top:8px;border-radius:8px;overflow:hidden;border:0.5px solid var(--divider-color,rgba(0,0,0,0.12));';

    if (!radarReady) {
      wrapper.innerHTML = `<div class="swc-radar-note">Set <strong>Home latitude</strong> and <strong>Home longitude</strong> in the card editor to enable the radar map.</div>`;
      return wrapper;
    }

    // Cache iframe by config key so the map isn't recreated on every 30s tick
    const key = `${lat}_${lon}_${zoom}`;
    if (!this._radarIframe || this._radarIframeKey !== key) {
      if (this._radarBlobUrl) URL.revokeObjectURL(this._radarBlobUrl);
      const html = this._buildRadarHtml(lat, lon, zoom);
      this._radarBlobUrl   = URL.createObjectURL(new Blob([html], { type: 'text/html' }));
      const iframe         = document.createElement('iframe');
      iframe.src           = this._radarBlobUrl;
      iframe.style.cssText = 'width:100%;height:300px;border:none;display:block;';
      iframe.setAttribute('sandbox', 'allow-scripts allow-same-origin');
      iframe.title         = 'Weather Radar';
      this._radarIframe    = iframe;
      this._radarIframeKey = key;
    }

    wrapper.appendChild(this._radarIframe);
    return wrapper;
  }

  _buildRadarHtml(lat, lon, zoom) {
    // Self-contained HTML page: OSM tiles + RainViewer animated radar + home marker
    // Requires internet access (Leaflet CDN + RainViewer API + OSM tiles).
    return `<!DOCTYPE html>
<html><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" crossorigin=""/>
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  html,body{height:100%}
  #map{height:100vh}
  #ts{
    position:absolute;bottom:8px;left:50%;transform:translateX(-50%);
    z-index:1000;background:rgba(0,0,0,0.65);color:#fff;
    font-size:11px;padding:3px 10px;border-radius:12px;
    font-family:sans-serif;white-space:nowrap;pointer-events:none;
  }
</style>
</head>
<body>
<div id="map"></div>
<div id="ts">Loading radar…</div>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js" crossorigin=""></script>
<script>
(function(){
  const LAT=${lat}, LON=${lon}, ZOOM=${zoom}, FRAMES=6;

  const map = L.map('map', { zoomControl:true, attributionControl:false })
               .setView([LAT, LON], ZOOM);

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom:18, subdomains:['a','b','c']
  }).addTo(map);

  // Home marker
  const homeIcon = L.divIcon({
    html: '<div style="font-size:22px;line-height:1;filter:drop-shadow(0 1px 3px rgba(0,0,0,0.7))">🏠</div>',
    iconSize:[22,22], iconAnchor:[11,18], className:''
  });
  L.marker([LAT, LON], { icon: homeIcon }).addTo(map).bindPopup('Home');

  // RainViewer animated radar overlay
  let layers=[], cur=0, frames=[];

  async function loadRadar() {
    try {
      const res  = await fetch('https://api.rainviewer.com/public/weather-maps.json');
      const data = await res.json();
      frames = data.radar.past.slice(-FRAMES);

      layers = frames.map(f =>
        L.tileLayer(
          'https://tilecache.rainviewer.com' + f.path + '/256/{z}/{x}/{y}/2/1_1.png',
          { opacity:0, zIndex:10 }
        )
      );
      layers.forEach(l => l.addTo(map));

      function show(i) {
        layers.forEach((l,j) => l.setOpacity(j===i ? 0.65 : 0));
        const d = new Date(frames[i].time * 1000);
        document.getElementById('ts').textContent =
          d.toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' });
        cur = i;
      }

      show(frames.length - 1);
      setInterval(() => show((cur + 1) % frames.length), 900);

    } catch(e) {
      document.getElementById('ts').textContent = 'Radar unavailable';
    }
  }

  loadRadar();
})();
</script>
</body></html>`;
  }

  // ── HA boilerplate ────────────────────────────────────────────────────────

  getCardSize() { return 5; }
}

customElements.define(CARD_TAG, SolarWeatherCard);

window.customCards = window.customCards || [];
window.customCards.push({
  type:        CARD_TAG,
  name:        'Solar Weather Card',
  description: 'Clock, weather forecast, solar power bar, solar day progress bar and built-in animated rain radar — all in one card.',
  preview:     false,
  version:     VERSION,
});

console.info(
  `%c SOLAR-WEATHER-CARD %c v${VERSION} `,
  'color:#fff;background:#f57c00;font-weight:700;padding:2px 4px;border-radius:4px 0 0 4px;',
  'color:#f57c00;background:#fff3e0;font-weight:700;padding:2px 4px;border-radius:0 4px 4px 0;'
);
