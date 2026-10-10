import type { World } from '../../../shared/types';
import type { Transport } from './transport';
import type { Settings } from './settings';
import type { AudioSystem } from './audio';
export type Bridge = {
  transport: Transport;
  settings: Settings;
  audio: AudioSystem;
  running: boolean;
  pausedInput: boolean;
  tutorial: boolean;
  onHud: (s: World) => void;
  onShop: () => void;
  onSettings: () => void;
  onLoaded: () => void;
};
