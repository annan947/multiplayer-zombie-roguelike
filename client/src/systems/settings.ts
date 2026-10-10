export type Settings = {
  master: number;
  music: number;
  sfx: number;
  shake: boolean;
  keys: {
    up: string;
    down: string;
    left: string;
    right: string;
    reload: string;
    revive: string;
    dash: string;
  };
};
export const defaults: Settings = {
  master: 0.7,
  music: 0.18,
  sfx: 0.8,
  shake: true,
  keys: { up: 'W', down: 'S', left: 'A', right: 'D', reload: 'R', revive: 'E', dash: 'SHIFT' },
};
export function loadSettings(): Settings {
  try {
    return { ...defaults, ...JSON.parse(localStorage.getItem('deadzone-settings') || '{}') };
  } catch {
    return defaults;
  }
}
export function saveSettings(s: Settings) {
  localStorage.setItem('deadzone-settings', JSON.stringify(s));
}
