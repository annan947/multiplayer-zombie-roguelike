import { Howl, Howler } from 'howler';
import type { Settings } from './settings';

const sources: Record<string, string[]> = {
  pistol: ['pistol'],
  shotgun: ['shotgun'],
  smg: ['smg'],
  rifle: ['rifle'],
  groan: ['zombie-1', 'zombie-3', 'zombie-5'],
  hit: ['zombie-24'],
  reload: ['reload'],
  ui: ['ui'],
  explosion: ['explosion'],
  wave: ['reload'],
};
const levels: Record<string, number> = {
  pistol: 0.8,
  shotgun: 0.95,
  smg: 0.55,
  rifle: 0.85,
  groan: 0.32,
  hit: 0.25,
  reload: 0.55,
  ui: 0.18,
  explosion: 0.65,
  wave: 0.3,
};
export class AudioSystem {
  private ambient: Howl;
  private fx = new Map<string, Howl[]>();
  private lastPlay = new Map<string, number>();
  private started = false;
  private destroyed = false;
  settings: Settings;
  constructor(settings: Settings) {
    this.settings = settings;
    this.ambient = new Howl({ src: ['/audio/empty-city.ogg'], loop: true, volume: 0 });
    for (const [key, files] of Object.entries(sources)) {
      this.fx.set(
        key,
        files.map((file) => new Howl({ src: [`/audio/${file}.ogg`], volume: 0, pool: 12 })),
      );
    }
  }
  async unlock() {
    if (this.destroyed) return;
    await Howler.ctx?.resume();
    if (this.started || this.destroyed) return;
    this.started = true;
    this.update();
    this.ambient.play();
  }
  update() {
    Howler.volume(this.settings.master);
    // A restrained ambient bed: no repetitive arpeggio and no extra layers each wave.
    this.ambient.volume(this.settings.music * 0.4);
  }
  play(key: string, dx = 0, distance = 0) {
    if (!this.started || this.destroyed || distance > 850) return;
    const now = performance.now(),
      last = this.lastPlay.get(key) ?? -Infinity;
    const gap = key === 'hit' ? 140 : key === 'groan' ? 2200 : key === 'ui' ? 60 : 25;
    if (now - last < gap) return;
    const choices = this.fx.get(key);
    if (!choices) return;
    const h = choices[Math.floor(Math.random() * choices.length)];
    if (h.state() !== 'loaded') return;
    this.lastPlay.set(key, now);
    const id = h.play();
    h.volume(this.settings.sfx * (levels[key] ?? 0.5) * Math.max(0, 1 - distance / 850), id);
    h.stereo(Math.max(-0.8, Math.min(0.8, dx / 600)), id);
    h.rate(key === 'groan' ? 0.92 + Math.random() * 0.14 : 0.98 + Math.random() * 0.04, id);
  }
  destroy() {
    this.destroyed = true;
    this.ambient.unload();
    this.fx.forEach((variants) => variants.forEach((sound) => sound.unload()));
  }
}
