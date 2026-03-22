# Solar Weather Card

![HACS Badge](https://img.shields.io/badge/HACS-Custom-orange.svg)
![Version](https://img.shields.io/badge/Version-0.0.1-blue.svg)
[![GitHub Issues](https://img.shields.io/github/issues/0xAHA/solar-weather-card.svg)](https://github.com/0xAHA/solar-weather-card/issues)
[![GitHub Stars](https://img.shields.io/github/stars/0xAHA/solar-weather-card.svg?style=social)](https://github.com/0xAHA/solar-weather-card)

<!-- markdownlint-disable MD033 -->
<a href="https://www.buymeacoffee.com/0xAHA" target="_blank"><img src="https://cdn.buymeacoffee.com/buttons/default-orange.png" alt="Buy Me A Coffee" height="41" width="174"></a>
<!-- markdownlint-enable MD033 -->

---

A Home Assistant Lovelace custom card combining a large clock, weather forecast bars, a solar power distribution bar, a solar day progress indicator, and a built-in animated rain radar — all in a single, no-build-step card.

> Inspired by [clock-weather-card](https://github.com/pkissling/clock-weather-card) and [solar-bar-card](https://github.com/0xAHA/solar-bar-card). Radar powered by [RainViewer](https://www.rainviewer.com/) and [Leaflet](https://leafletjs.com/).

---

## Features

- **Large clock** — 12 h or 24 h, with AM/PM pill
- **Date** — 6 configurable date formats
- **Current weather** — icon, temperature, condition (right-aligned)
- **Daily forecast bars** — min/max temperature pill bars, coloured by condition; expand from 1 → 7 days
- **Solar power bar** — self-use / export / import / unused segments with optional stat tiles, legend and value labels
- **Solar forecast marker** — 2 px line on the bar from a Solcast or custom sensor
- **Solar day progress bar** — compact sunrise-to-sunset track with a moving ☀️ icon
- **Built-in animated radar** — Leaflet map with OpenStreetMap tiles, animated RainViewer overlay, and a 🏠 home marker; no extra HACS dependency needed
- **Rain alert** — auto-expands radar panel and shows a pill badge when precipitation exceeds a configurable threshold
- **6 colour palettes** — Classic Solar, Soft Meadow, Ocean Sunset, Garden Fresh, Peachy Keen, Cloudy Day
- **HA-native visual editor** — uses `ha-selector` for entity pickers, toggles, number sliders/boxes and dropdowns; collapsible sections with persisted open/close state
- **No build step** — single ES-module file, vanilla JS, Shadow DOM

---

## Requirements

| Requirement | Details |
| --- | --- |
| Home Assistant | ≥ 2023.9.0 |
| Installation | Manual or HACS (custom repository) |
| Resources | Both `.js` files must be registered as `type: module` Lovelace resources |
| Internet | Required for radar tiles (OpenStreetMap + RainViewer CDN) |

---

## Installation

### Manual

1. Copy `dist/solar-weather-card.js` and `dist/solar-weather-card-palettes.js` into `<config>/www/solar-weather-card/`.
1. In Home Assistant go to **Settings → Dashboards → Resources** and add:

```yaml
- url: /local/solar-weather-card/solar-weather-card.js
  type: module
- url: /local/solar-weather-card/solar-weather-card-palettes.js
  type: module
```

1. Hard-refresh your browser (`Ctrl+Shift+R`).

### HACS (custom repository)

1. In HACS → **Frontend** → **⋮ → Custom repositories**, add `0xAHA/solar-weather-card` with category **Lovelace**.
1. Install and follow the resource registration step above.

---

## Configuration

Add the card via the UI editor, or paste YAML manually:

```yaml
type: custom:solar-weather-card
weather_entity: weather.home
production_entity: sensor.solar_production_power
self_consumption_entity: sensor.solar_self_consumption_power
export_entity: sensor.solar_export_power
import_entity: sensor.solar_import_power
inverter_size: 10
```

### All options

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `weather_entity` | string | `weather.home` | HA weather entity (required for clock/forecast) |
| `production_entity` | string | — | Solar production sensor (W or kW) |
| `self_consumption_entity` | string | — | Home consumption sensor (W or kW) |
| `export_entity` | string | — | Grid export sensor (W or kW) |
| `import_entity` | string | — | Grid import sensor (W or kW) |
| `inverter_size` | number | `10` | Inverter peak capacity in kW (sets bar scale) |
| `forecast_days` | number | `1` | Default visible forecast days (1–7) |
| `time_format` | `12h` / `24h` | `24h` | Clock display format |
| `date_format` | string | `D, dd MMM yyyy` | Date display format (see presets below) |
| `color_palette` | string | `classic-solar` | Colour palette key |
| `show_weather_section` | boolean | `true` | Show weather icon / temperature |
| `show_forecast_days` | boolean | `true` | Show forecast bar rows |
| `show_solar_section` | boolean | `true` | Show solar power bar |
| `show_solar_arc` | boolean | `true` | Show solar day progress bar |
| `show_stats` | boolean | `true` | Show solar stat tiles (Solar / Usage / Export / Import) |
| `show_legend` | boolean | `true` | Show bar legend |
| `show_bar_values` | boolean | `true` | Show kW labels inside bar segments |
| `show_radar` | boolean | `false` | Enable radar panel |
| `precipitation_entity` | string | — | Sensor for current precipitation (mm/h); used for rain alert |
| `radar_rain_threshold` | number | `0.5` | mm/h above which the radar auto-expands |
| `radar_latitude` | number | — | Home latitude (required for radar map) |
| `radar_longitude` | number | — | Home longitude (required for radar map) |
| `radar_zoom` | number | `7` | Initial map zoom level (4–14) |
| `forecast_entity` | string | — | Explicit solar forecast sensor (overrides Solcast auto-detect) |
| `use_solcast` | boolean | `false` | Auto-detect common Solcast sensor names |

### Date format presets

| Value | Example |
| --- | --- |
| `D, dd MMM yyyy` *(default)* | Sunday, 22 Mar 2026 |
| `dd/MM/yyyy` | 22/03/2026 |
| `MM/dd/yyyy` | 03/22/2026 |
| `yyyy-MM-dd` | 2026-03-22 |
| `dd-MM-yy` | 22-03-26 |
| `D, dd MMM` | Sunday, 22 Mar |

### Colour palettes

| Key | Name |
| --- | --- |
| `classic-solar` | 🌞 Classic Solar |
| `soft-meadow` | 🌸 Soft Meadow |
| `ocean-sunset` | 🌊 Ocean Sunset |
| `garden-fresh` | 🌿 Garden Fresh |
| `peachy-keen` | 🍑 Peachy Keen |
| `cloudy-day` | ☁️ Cloudy Day |

---

## Radar

The radar panel is built-in — **no extra card or HACS dependency required**. It uses:

- **Leaflet** (loaded from `unpkg.com`) for the interactive map
- **OpenStreetMap** for base tiles
- **RainViewer** for animated radar frames (last 6 frames, ~15 min history)
- A **🏠 home icon** marker at your configured coordinates

Internet connectivity is required. The map is embedded in a sandboxed `<iframe>` and does not interfere with the HA frontend.

Set `radar_latitude` and `radar_longitude` in the card editor or YAML. The panel is collapsed by default and auto-expands when `precipitation_entity` ≥ `radar_rain_threshold`.

---

## Forecast data

This card uses the **`weather/subscribe_forecast`** WebSocket message introduced in Home Assistant 2023.9. Unlike older cards that read `attributes.forecast`, this subscription receives live daily forecast updates from HA. A fallback to `attributes.forecast` is included for older integrations.

---

## Planned features (roadmap)

- Battery sensor support (single or dual charge/discharge)
- EV charger sensor
- Daily kWh history sensors (import / export / production)
- Custom segment labels
- Tap actions per element
- `grid_power_entity` combined signed sensor support
- Header sensors (up to 2 extra sensors in the clock row)
- Multi-language support

---

## Contributing

Pull requests are welcome. Please target the `dev` branch — `main` is protected.

---

## License

[MIT](LICENSE) © 0xAHA
