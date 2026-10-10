import * as Phaser from 'phaser';
import { BootScene } from './scenes/BootScene';
import { WorldScene } from './scenes/WorldScene';
import type { Bridge } from './systems/bridge';
export function mountGame(parent: HTMLElement, bridge: Bridge) {
  return new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    width: 1152,
    height: 720,
    backgroundColor: '#121e29',
    pixelArt: true,
    roundPixels: true,
    antialias: false,
    physics: { default: 'arcade', arcade: { debug: false } },
    input: { gamepad: true },
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    fps: { target: 60, forceSetTimeOut: false },
    scene: [BootScene, WorldScene],
    callbacks: {
      preBoot(game) {
        game.registry.set('bridge', bridge);
      },
    },
  });
}
