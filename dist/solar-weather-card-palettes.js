// solar-weather-card-palettes.js
// Colour palette definitions for solar-weather-card v0.0.1
// Same pattern as solar-bar-card-palettes.js

export const COLOR_PALETTES = {
  'classic-solar': {
    name: 'Classic Solar',
    icon: '🌞',
    description: 'Bright, traditional solar colours',
    colors: {
      solar:      '#FFD600',
      export:     '#66BB6A',
      import:     '#EF5350',
      self_usage: '#42A5F5',
      ev_charge:  '#FFA726',
      unused:     'rgba(120,120,120,0.15)',
      forecast:   '#FFD600',
      temp_bar:   '#FAC775',
      temp_rain:  '#85B7EB',
    }
  },
  'soft-meadow': {
    name: 'Soft Meadow',
    icon: '🌸',
    description: 'Gentle pastels with spring vibes',
    colors: {
      solar:      '#FFF176',
      export:     '#A5D6A7',
      import:     '#FFAB91',
      self_usage: '#90CAF9',
      ev_charge:  '#FFCC80',
      unused:     'rgba(150,150,150,0.12)',
      forecast:   '#FFF176',
      temp_bar:   '#FFCC80',
      temp_rain:  '#90CAF9',
    }
  },
  'ocean-sunset': {
    name: 'Ocean Sunset',
    icon: '🌊',
    description: 'Warm sunset meets cool ocean',
    colors: {
      solar:      '#FFB74D',
      export:     '#4DB6AC',
      import:     '#F06292',
      self_usage: '#4FC3F7',
      ev_charge:  '#FF8A65',
      unused:     'rgba(100,100,120,0.15)',
      forecast:   '#FFB74D',
      temp_bar:   '#FF8A65',
      temp_rain:  '#4FC3F7',
    }
  },
  'garden-fresh': {
    name: 'Garden Fresh',
    icon: '🌿',
    description: 'Natural greens and soft tones',
    colors: {
      solar:      '#DCE775',
      export:     '#81C784',
      import:     '#FF8A65',
      self_usage: '#80DEEA',
      ev_charge:  '#AED581',
      unused:     'rgba(100,120,100,0.15)',
      forecast:   '#DCE775',
      temp_bar:   '#AED581',
      temp_rain:  '#80DEEA',
    }
  },
  'peachy-keen': {
    name: 'Peachy Keen',
    icon: '🍑',
    description: 'Warm peach and lavender blend',
    colors: {
      solar:      '#FFCC80',
      export:     '#CE93D8',
      import:     '#EF9A9A',
      self_usage: '#80CBC4',
      ev_charge:  '#FFAB91',
      unused:     'rgba(120,100,120,0.15)',
      forecast:   '#FFCC80',
      temp_bar:   '#FFAB91',
      temp_rain:  '#80CBC4',
    }
  },
  'cloudy-day': {
    name: 'Cloudy Day',
    icon: '☁️',
    description: 'Soft, muted sky palette',
    colors: {
      solar:      '#E0E0E0',
      export:     '#B0BEC5',
      import:     '#BCAAA4',
      self_usage: '#B0BEC5',
      ev_charge:  '#CFD8DC',
      unused:     'rgba(100,100,100,0.12)',
      forecast:   '#E0E0E0',
      temp_bar:   '#CFD8DC',
      temp_rain:  '#90A4AE',
    }
  },
};

export function getPalette(name) {
  return COLOR_PALETTES[name] || COLOR_PALETTES['classic-solar'];
}

export function getPaletteNames() {
  return Object.entries(COLOR_PALETTES).map(([key, val]) => ({
    key,
    name: val.name,
    icon: val.icon,
  }));
}
