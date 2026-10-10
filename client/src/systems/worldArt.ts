import * as Phaser from 'phaser';
import { buildings, cars, base, WIDTH, HEIGHT } from '../../../shared/map';
export function buildWorld(scene: Phaser.Scene) {
  const g = scene.make.graphics({ x: 0, y: 0 });
  const cols = [0x323844, 0x3e494b, 0x46554c, 0x253138];
  cols.forEach((c, i) => {
    g.fillStyle(c).fillRect(i * 32, 0, 32, 32);
    g.fillStyle(i === 0 ? 0x3b414b : 0x4c5857)
      .fillRect(i * 32 + 3, 5, 3, 2)
      .fillRect(i * 32 + 20, 21, 4, 2);
    g.lineStyle(1, 0x24343b, 0.3).strokeRect(i * 32, 0, 31, 31);
  });
  g.generateTexture('tiles', 128, 32);
  g.destroy();
  const map = scene.make.tilemap({ key: 'district' }),
    tiles = map.addTilesetImage('ground', 'tiles', 32, 32, 0, 0)!;
  map.createLayer('Ground', tiles)!.setDepth(-100);
  const art = scene.add.graphics().setDepth(-20);
  for (let x = 760; x < WIDTH; x += 768)
    for (let y = 30; y < HEIGHT; y += 70) art.fillStyle(0xb2a36c, 0.6).fillRect(x, y, 4, 28);
  for (let y = 670; y < HEIGHT; y += 736)
    for (let x = 25; x < WIDTH; x += 74) art.fillStyle(0xa49b74, 0.6).fillRect(x, y, 30, 4);
  for (const b of buildings) {
    art.fillStyle(0x111b27, 0.6).fillRect(b.x + 14, b.y + 20, b.w, b.h);
    art.fillStyle(0x202a35).fillRect(b.x, b.y, b.w, b.h);
    art.fillStyle(b.color).fillRect(b.x + 4, b.y + 4, b.w - 8, b.h - 8);
    art.fillStyle(0x23313b).fillRect(b.x + 14, b.y + 14, b.w - 28, b.h - 40);
    art.lineStyle(3, 0x879387, 0.4).strokeRect(b.x + 19, b.y + 19, b.w - 38, b.h - 50);
    for (let x = b.x + 35; x < b.x + b.w - 20; x += 54) {
      art.fillStyle(0x182b38).fillRect(x, b.y + b.h - 25, 29, 18);
      art.fillStyle(0xe9b45d, 0.8).fillRect(x + 3, b.y + b.h - 22, 22, 10);
    }
    for (let x = b.x + 40; x < b.x + b.w - 40; x += 105) {
      art.fillStyle(0x65717a).fillRect(x, b.y + 55, 48, 48);
      art.fillStyle(0x374651).fillCircle(x + 24, b.y + 79, 16);
      art.lineStyle(2, 0x879691).strokeCircle(x + 24, b.y + 79, 13);
    }
    scene.add
      .text(b.x + b.w / 2, b.y + b.h - 49, b.label, {
        fontFamily: 'monospace',
        fontSize: '12px',
        color: '#e0cfaa',
        backgroundColor: '#1a2a32',
        padding: { x: 9, y: 5 },
      })
      .setOrigin(0.5)
      .setDepth(-10);
  }
  for (const [i, c] of cars.entries()) {
    art.fillStyle(0x121c29, 0.7).fillRoundedRect(c.x + 6, c.y + 9, c.w, c.h, 7);
    art.fillStyle([0x995a54, 0x597583, 0x918657][i % 3]).fillRoundedRect(c.x, c.y, c.w, c.h, 5);
    art.fillStyle(0x1c3444).fillRect(c.x + 7, c.y + 20, c.w - 14, c.h - 43);
    art
      .fillStyle(0xf1d58a)
      .fillRect(c.x + 3, c.y + 3, 9, 4)
      .fillRect(c.x + c.w - 12, c.y + 3, 9, 4);
  }
  for (let i = 0; i < 90; i++) {
    const x = 80 + ((i * 997) % 2900),
      y = 70 + ((i * 613) % 2130);
    if (
      buildings.some(
        (b) => x > b.x - 30 && x < b.x + b.w + 30 && y > b.y - 30 && y < b.y + b.h + 30,
      ) ||
      (Math.abs(x - base.x) < 180 && Math.abs(y - base.y) < 150)
    )
      continue;
    art.fillStyle(0x1a2b2b, 0.5).fillEllipse(x + 8, y + 12, 50, 25);
    art.fillStyle(0x364c42).fillRect(x - 14, y - 22, 28, 34);
    art.fillStyle(0x4c6650).fillRect(x - 19, y - 16, 38, 18);
    art.fillStyle(0x789063).fillRect(x - 13, y - 20, 12, 6);
  }
  const walls = scene.physics.add.staticGroup();
  for (const b of [...buildings, ...cars]) {
    const z = scene.add.zone(b.x + b.w / 2, b.y + b.h / 2, b.w, b.h);
    walls.add(z);
  }
  return walls;
}
