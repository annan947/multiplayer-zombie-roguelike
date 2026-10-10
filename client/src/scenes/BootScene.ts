import * as Phaser from 'phaser';
export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }
  preload() {
    const w = this.scale.width,
      h = this.scale.height;
    this.add
      .text(w / 2, h / 2 - 40, 'ESTABLISHING UPLINK', {
        fontFamily: 'monospace',
        fontSize: '20px',
        color: '#c1e589',
      })
      .setOrigin(0.5);
    const bar = this.add.graphics();
    this.load.on('progress', (p: number) => {
      bar
        .clear()
        .fillStyle(0xa6d966)
        .fillRect(w / 2 - 150, h / 2, 300 * p, 5);
    });
    this.load.image('atlas', '/assets/characters.png');
    this.load.image('survivor-body', '/assets/survivor-body.png');
    this.load.image('aim-rig', '/assets/aim-rig.png');
    this.load.image('items', '/assets/items.png');
    this.load.image('survivors', '/assets/survivors.png');
    this.load.tilemapTiledJSON('district', '/maps/district.json');
  }
  create() {
    const texture = this.textures.get('atlas'),
      img = texture.getSourceImage() as HTMLImageElement;
    // Atlas rows are hand-arranged, not an equal 8×8 grid.
    const tankTop = [450, 450, 451, 450, 452, 450, 451, 451];
    const rowBounds = (column: number) => [0, 170, 319, tankTop[column], 612, 757, 917, column === 5 ? 1083 : 1085, 1254];
    for (let y = 0; y < 8; y++)
      for (let x = 0; x < 8; x++) {
        const x0 = Math.round((x * img.width) / 8),
          y0 = rowBounds(x)[y];
        texture.add(
          y * 8 + x,
          0,
          x0,
          y0,
          Math.round(((x + 1) * img.width) / 8) - x0,
          rowBounds(x)[y + 1] - y0,
        );
      }
    for (let row = 0; row < 7; row++)
      this.anims.create({
        key: 'walk' + row,
        frames: Array.from({ length: 8 }, (_, i) => ({ key: 'atlas', frame: row * 8 + i })),
        frameRate: 9,
        repeat: -1,
      });
    const people = this.textures.get('survivors'),
      source = people.getSourceImage() as HTMLImageElement;
    for (let row = 0; row < 4; row++) {
      for (let col = 0; col < 8; col++) {
        // Shift the crop within each cell to include the rifle muzzle without importing the next character.
        const cellW = Math.round(source.width / 8),
          cellH = Math.round(source.height / 4),
          x = Math.round((col * source.width) / 8) + 14,
          y = Math.round((row * source.height) / 4);
        const cutW = Math.min(cellW, source.width - x),
          cutH = Math.min(cellH, source.height - y);
        people.add(row * 8 + col, 0, x, y, cutW, cutH)?.setTrim(cellW, cellH, 0, 0, cutW, cutH);
      }
      this.anims.create({
        key: 'survivor' + row,
        frames: Array.from({ length: 8 }, (_, i) => ({ key: 'survivors', frame: row * 8 + i })),
        frameRate: 9,
        repeat: -1,
      });
    }
    const rig = this.textures.get('aim-rig');
    const body = this.textures.get('survivor-body');
    for (let i = 0; i < 8; i++)
      body.add(
        'body' + i,
        0,
        Math.round((i * 2172) / 8),
        140,
        Math.round(((i + 1) * 2172) / 8) - Math.round((i * 2172) / 8),
        480,
      );
    const crops = [
      [20, 710, 270, 150],
      [385, 710, 365, 150],
      [785, 710, 280, 150],
      [1118, 710, 389, 150],
    ];
    crops.forEach(([x, y, w, h], i) => rig.add('gun' + i, 0, x, y, w, h));
    this.anims.create({
      key: 'unarmed-walk',
      frames: Array.from({ length: 8 }, (_, i) => ({ key: 'survivor-body', frame: 'body' + i })),
      frameRate: 9,
      repeat: -1,
    });
    const loot = this.textures.get('items'),
      lootImage = loot.getSourceImage() as HTMLImageElement;
    for (let i = 0; i < 14; i++) {
      const x = Math.round(((i % 4) * lootImage.width) / 4),
        y = Math.round((Math.floor(i / 4) * lootImage.height) / 4);
      loot.add(
        i,
        0,
        x,
        y,
        Math.round((((i % 4) + 1) * lootImage.width) / 4) - x,
        Math.round(((Math.floor(i / 4) + 1) * lootImage.height) / 4) - y,
      );
    }
    this.scene.start('World');
  }
}
