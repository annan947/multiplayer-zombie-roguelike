import { weaponPose } from '../../../shared/weaponPose';
import * as Phaser from 'phaser';
import { buildWorld } from '../systems/worldArt';
import type { Bridge } from '../systems/bridge';
import { base, WIDTH, HEIGHT, move } from '../../../shared/map';
import { weapons } from '../../../shared/simulation';
import { moveSpeed } from '../../../shared/items';
import type { Input, Player } from '../../../shared/types';
const rows = { walker: 1, runner: 2, tank: 3, spitter: 4, exploder: 5, boss: 6 };
type Actor = {
  body: Phaser.GameObjects.Sprite;
  gun: Phaser.GameObjects.Sprite;

  name?: Phaser.GameObjects.Text;
};
export class WorldScene extends Phaser.Scene {
  bridge!: Bridge;
  actors = new Map<string, Actor>();
  enemyPool: Phaser.GameObjects.Sprite[] = [];
  particles: Phaser.GameObjects.Rectangle[] = [];
  labels: Phaser.GameObjects.Text[] = [];
  decals: Phaser.GameObjects.Ellipse[] = [];
  buildSprites = new Map<number, Phaser.GameObjects.Image>();
  acidSprites: Phaser.GameObjects.Arc[] = [];
  fx!: Phaser.GameObjects.Graphics;
  mini!: Phaser.GameObjects.Graphics;
  chestArt!: Phaser.GameObjects.Graphics;
  chestPrompt!: Phaser.GameObjects.Text;
  interactHeld = false;
  aimPoint!: Phaser.GameObjects.Arc;
  cursor!: Phaser.GameObjects.Graphics;
  cameraTarget = { x: base.x, y: base.y };
  localPos = { x: base.x, y: base.y + 95 };
  keys!: Record<string, Phaser.Input.Keyboard.Key>;
  lastState = 0;
  lastEvent = 0;
  seenShots = new Set<number>();
  seq = 0;
  hudAt = 0;
  groanAt = 0;
  predictedDash = 0;
  predictedShotAt = 0;
  pendingShots = 0;
  confirmedShots = 0;
  impactAt = 0;
  lastHp = 100;
  lastReload = 0;
  lastWave = 0;
  lastElapsed = 0;
  hitStopUntil = 0;
  pi = 0;
  li = 0;
  di = 0;
  banner!: Phaser.GameObjects.Text;
  private previousRunning = false;
  constructor() {
    super('World');
  }
  create() {
    this.bridge = this.registry.get('bridge');
    buildWorld(this);
    this.cameras.main.setBounds(0, 0, WIDTH, HEIGHT).setZoom(1.05);
    this.cameras.main.fadeIn(550, 9, 17, 25);
    this.fx = this.add.graphics().setDepth(150);
    this.mini = this.add.graphics().setScrollFactor(0).setDepth(1000);
    this.chestArt = this.add.graphics().setDepth(-2);
    this.chestPrompt = this.add
      .text(0, 0, '', {
        fontFamily: 'monospace',
        fontSize: '13px',
        color: '#ffe0a0',
        backgroundColor: '#14212bee',
        padding: { x: 10, y: 7 },
      })
      .setOrigin(0.5)
      .setDepth(160);
    this.cursor = this.add.graphics().setScrollFactor(0).setDepth(1001);
    this.aimPoint = this.add.circle(base.x, base.y, 5, 0xd7e7a4, 0).setDepth(-1);
    this.banner = this.add
      .text(this.scale.width / 2, 105, '', {
        fontFamily: 'monospace',
        fontSize: '26px',
        color: '#e6e9c1',
        stroke: '#14232d',
        strokeThickness: 8,
        align: 'center',
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(1100);
    this.keys = this.input.keyboard!.addKeys(
      'W,A,S,D,R,E,SHIFT,SPACE,B,ESC,ONE,TWO,THREE,FOUR,UP,DOWN,LEFT,RIGHT',
    ) as Record<string, Phaser.Input.Keyboard.Key>;
    this.input.keyboard!.on('keydown-B', () => this.bridge.onShop());
    this.input.keyboard!.on('keydown-ESC', () => this.bridge.onSettings());
    this.input.on('pointerdown', () => void this.bridge.audio.unlock());
    this.input.mouse?.disableContextMenu();
    for (let i = 0; i < 96; i++)
      this.enemyPool.push(this.add.sprite(0, 0, 'atlas', 8).setVisible(false).setActive(false));
    for (let i = 0; i < 180; i++)
      this.particles.push(this.add.rectangle(0, 0, 3, 3, 0xa13d45).setVisible(false));
    for (let i = 0; i < 25; i++)
      this.labels.push(
        this.add
          .text(0, 0, '', {
            fontFamily: 'monospace',
            fontSize: '14px',
            color: '#ffe5a1',
            stroke: '#101c26',
            strokeThickness: 3,
          })
          .setVisible(false)
          .setDepth(200),
      );
    for (let i = 0; i < 200; i++)
      this.decals.push(
        this.add.ellipse(0, 0, 20, 10, 0x713140, 0.65).setVisible(false).setDepth(-5),
      );
    for (let i = 0; i < 32; i++)
      this.acidSprites.push(this.add.circle(0, 0, 6, 0xb9dd5f).setVisible(false).setDepth(100));
    this.bridge.onLoaded();
  }
  private particle(x: number, y: number, color: number, count = 7) {
    for (let i = 0; i < count; i++) {
      const p = this.particles[this.pi++ % this.particles.length];
      this.tweens.killTweensOf(p);
      p.setPosition(x, y).setFillStyle(color).setVisible(true).setAlpha(1).setDepth(150);
      this.tweens.add({
        targets: p,
        x: x + (Math.random() - 0.5) * 65,
        y: y + (Math.random() - 0.5) * 65,
        alpha: 0,
        duration: 250 + Math.random() * 250,
        onComplete: () => p.setVisible(false),
      });
    }
  }
  private message(text: string, boss = false) {
    this.tweens.killTweensOf(this.banner);
    this.banner
      .setText(text)
      .setAlpha(1)
      .setColor(boss ? '#ff977d' : '#e3efb0');
    this.tweens.add({ targets: this.banner, alpha: 0, delay: 2200, duration: 600 });
  }
  private getActor(p: Player) {
    let a = this.actors.get(p.id);
    if (!a) {
      a = {
        body: this.add.sprite(p.x, p.y, 'survivor-body', 'body0').setScale(0.105),
        gun: this.add.sprite(p.x, p.y, 'aim-rig', 'gun' + p.gun).setScale(0.1),

        name: this.add
          .text(p.x, p.y - 35, p.name, {
            fontFamily: 'monospace',
            fontSize: '11px',
            color: '#d7ebae',
            stroke: '#12222b',
            strokeThickness: 3,
          })
          .setOrigin(0.5),
      };
      this.actors.set(p.id, a);
    }
    return a;
  }
  update(time: number, delta: number) {
    if (!this.bridge || (this.bridge.transport.mode === 'solo' && time < this.hitStopUntil)) return;
    const b = this.bridge,
      s = b.transport.state,
      p = s.players.find((p) => p.id === b.transport.self),
      dt = Math.min(delta / 1000, 0.04),
      pointer = this.input.activePointer;
    const active =
      b.running && !b.pausedInput && !!p && !['lobby', 'won', 'lost'].includes(s.phase);
    if (b.running && (!this.previousRunning || s.elapsed < this.lastElapsed)) {
      this.localPos = { x: p?.x || base.x, y: p?.y || base.y };
      this.predictedDash = 0;
      this.pendingShots = 0;
      this.confirmedShots = p?.shots || 0;
      this.predictedShotAt = 0;
      this.lastEvent = 0;
      this.lastWave = 0;
      this.seenShots.clear();
      this.decals.forEach((d) => d.setVisible(false));
      this.cameras.main.fadeIn(450, 8, 14, 20);
    }
    this.previousRunning = b.running;
    this.lastElapsed = s.elapsed;
    let input: Input = {
      x: 0,
      y: 0,
      a: p?.input.a || 0,
      fire: false,
      reload: false,
      revive: false,
      seq: ++this.seq,
    };
    if (active && p) {
      pointer.updateWorldPoint(this.cameras.main);
      const shoulder = weaponPose(this.localPos.x, this.localPos.y, input.a, p.gun);
      const key = (v: string) => this.input.keyboard!.addKey(v).isDown;
      const k = b.settings.keys;
      input = {
        x:
          Number(key(k.right) || this.keys.RIGHT.isDown) -
          Number(key(k.left) || this.keys.LEFT.isDown),
        y: Number(key(k.down) || this.keys.DOWN.isDown) - Number(key(k.up) || this.keys.UP.isDown),
        a: Math.atan2(pointer.worldY - shoulder.shoulderY, pointer.worldX - shoulder.shoulderX),
        fire: pointer.isDown || this.keys.SPACE.isDown,
        reload: key(k.reload),
        revive: key(k.revive),
        dash: key(k.dash),
        seq: this.seq,
      };
      const pad = this.input.gamepad?.getPad(0);
      if (pad) {
        if (Math.abs(pad.leftStick.x) + Math.abs(pad.leftStick.y) > 0.2) {
          input.x = pad.leftStick.x;
          input.y = pad.leftStick.y;
        }
        if (Math.hypot(pad.rightStick.x, pad.rightStick.y) > 0.2)
          input.a = Math.atan2(pad.rightStick.y, pad.rightStick.x);
        input.fire = pad.R2 > 0.2;
        input.reload = pad.X;
        input.revive = pad.A;
        input.dash = pad.B;
      }
      ['ONE', 'TWO', 'THREE', 'FOUR'].forEach((k, i) => {
        if (Phaser.Input.Keyboard.JustDown(this.keys[k]))
          b.transport.command({ action: 'equip', gun: i });
      });
      if (input.revive && !this.interactHeld) {
        const chest = s.chests
          .filter((c) => !c.opened && Math.hypot(c.x - p.x, c.y - p.y) < 85)
          .sort((a, c) => Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(c.x - p.x, c.y - p.y))[0];
        if (chest) b.transport.command({ action: 'open', chest: chest.id });
      }
      this.interactHeld = input.revive;
      b.transport.send(input);
      if (b.transport.mode === 'solo') this.localPos = { x: p.x, y: p.y };
      else {
        this.predictedDash = Math.max(0, this.predictedDash - dt);
        if (input.dash && this.predictedDash <= 0 && p.dash <= 0) this.predictedDash = 2.5;
        if (s.time !== this.lastState) {
          const target = { x: p.x, y: p.y };
          const lead = Math.min(0.12, b.transport.latency / 2000);
          const n = Math.max(1, Math.hypot(p.input.x, p.input.y));
          const speed = moveSpeed(p) * (p.dash > 2.3 ? 3 : 1);
          move(target, (p.input.x / n) * speed * lead, (p.input.y / n) * speed * lead);
          const err = Math.hypot(target.x - this.localPos.x, target.y - this.localPos.y);
          if (err > 160 || p.hp <= 0) this.localPos = target;
          else if (err > 18 || (!input.x && !input.y)) {
            this.localPos.x += (target.x - this.localPos.x) * 0.18;
            this.localPos.y += (target.y - this.localPos.y) * 0.18;
          }
          this.lastState = s.time;
        }
        if (p.hp > 0) {
          const n = Math.max(1, Math.hypot(input.x, input.y));
          const speed = moveSpeed(p) * (this.predictedDash > 2.3 ? 3 : 1);
          move(this.localPos, (input.x / n) * speed * dt, (input.y / n) * speed * dt);
        }
      }
      if (b.transport.mode !== 'solo') {
        this.pendingShots = Math.max(
          0,
          this.pendingShots - Math.max(0, p.shots - this.confirmedShots),
        );
        this.confirmedShots = p.shots;
        if (p.reload > 0) this.pendingShots = 0;
        if (
          input.fire &&
          p.hp > 0 &&
          p.reload <= 0 &&
          p.ammo - this.pendingShots > 0 &&
          time >= this.predictedShotAt
        ) {
          this.pendingShots++;
          this.predictedShotAt =
            time + (weapons[p.gun].rate / ((p.frenzy || 0) > 0 ? 1.35 : 1)) * 1000;
          const muzzle = weaponPose(this.localPos.x, this.localPos.y, input.a, p.gun);
          b.audio.play(['pistol', 'shotgun', 'smg', 'rifle'][p.gun]);
          this.particle(muzzle.muzzleX, muzzle.muzzleY, 0xffd777, 4);
          if (b.settings.shake) this.cameras.main.shake(45, weapons[p.gun].recoil * 0.00045);
        }
      }
      if (p.reload > 0 && this.lastReload <= 0) b.audio.play('reload');
      this.lastReload = p.reload;
      if (p.hp < this.lastHp - 1 && b.settings.shake) this.cameras.main.shake(90, 0.003);
      this.lastHp = p.hp;
    }
    if (b.running && !active && b.transport.mode !== 'solo') b.transport.send(input);
    if (!b.running) {
      this.cameraTarget.x = base.x + Math.sin(time * 0.0001) * 160;
      this.cameraTarget.y = base.y + Math.cos(time * 0.00013) * 100;
    } else if (p) {
      this.cameraTarget.x = Phaser.Math.Linear(
        this.cameraTarget.x,
        this.localPos.x + Math.cos(input.a) * 70,
        0.07,
      );
      this.cameraTarget.y = Phaser.Math.Linear(
        this.cameraTarget.y,
        this.localPos.y + Math.sin(input.a) * 50,
        0.07,
      );
    }
    this.cameras.main.centerOn(this.cameraTarget.x, this.cameraTarget.y);
    pointer.updateWorldPoint(this.cameras.main);
    for (const q of s.players) {
      const a = this.getActor(q),
        isSelf = q.id === b.transport.self,
        position = isSelf
          ? this.localPos
          : b.transport.mode === 'solo'
            ? q
            : b.transport.snapshots.point('players', q.id, q),
        x = position.x,
        y = position.y;
      a.body.setPosition(x, y);
      const moving = Math.hypot(q.input.x, q.input.y) > 0.1;
      if (moving && q.hp > 0) a.body.play('unarmed-walk', true);
      else {
        a.body.stop();
        a.body.setFrame('body0');
      }
      a.body
        .setFlipX(Math.cos(isSelf ? input.a : q.input.a) < 0)
        .setDepth(a.body.y * 0.01)
        .setAlpha(q.connected ? 1 : 0.35)
        .setAngle(q.hp <= 0 ? 90 : 0);
      const aim = isSelf ? input.a : q.input.a;
      const pose = weaponPose(a.body.x, a.body.y, aim, q.gun);
      const pivots = [45, 55, 55, 45],
        widths = [270, 365, 280, 389];
      a.gun
        .setFrame('gun' + q.gun)
        .setOrigin(pivots[q.gun] / widths[q.gun], 50 / 150)
        .setPosition(pose.shoulderX, pose.shoulderY)
        .setRotation(aim)
        .setScale(0.1, pose.left ? -0.1 : 0.1)
        .setDepth(a.body.depth + 0.01)
        .setVisible(q.hp > 0)
        .setAlpha(q.connected ? 1 : 0.35);
      a.body.setTint(q.damage > 0 ? 0xff9d9d : 0xffffff);
      a.name!.setPosition(a.body.x, a.body.y - 35)
        .setText(q.hp <= 0 ? 'HOLD E · REVIVE' : q.name)
        .setDepth(90);
    }
    for (const [id, a] of this.actors)
      if (!s.players.some((p) => p.id === id)) {
        a.body.destroy();
        a.gun.destroy();

        a.name?.destroy();
        this.actors.delete(id);
      }
    this.enemyPool.forEach((sprite, i) => {
      const z = s.enemies[i];
      if (!z) {
        sprite.setVisible(false).setActive(false);
        return;
      }
      if (sprite.getData('id') !== z.id) {
        sprite.setPosition(z.x, z.y).setData('id', z.id);
      }
      sprite.setVisible(true).setActive(true);
      const position =
        b.transport.mode === 'solo' ? z : b.transport.snapshots.point('enemies', z.id, z);
      sprite.setPosition(position.x, position.y);
      const size = z.kind === 'boss' ? 112 : z.kind === 'tank' ? 76 : 56;
      sprite
        .setDisplaySize(size, size)
        .setDepth(sprite.y * 0.01)
        .setTint(
          z.poison
            ? 0xa5f178
            : z.slow
              ? 0x98d8ff
              : z.bleed
                ? 0xf2a2a2
                : z.charge > 0
                  ? 0xffb89b
                  : 0xffffff,
        )
        .setFlipX(p ? z.x > p.x : false);
      sprite.play('walk' + rows[z.kind], true);
      if (z.hit > 0) sprite.setTintFill(0xffdfcd);
    });
    for (const build of s.builds) {
      let sprite = this.buildSprites.get(build.id);
      if (!sprite) {
        sprite = this.add
          .image(build.x, build.y, 'atlas', build.kind === 'turret' ? 61 : 60)
          .setDisplaySize(58, 58)
          .setDepth(build.y * 0.01);
        this.buildSprites.set(build.id, sprite);
      }
    }
    for (const [id, sprite] of this.buildSprites)
      if (!s.builds.some((b) => b.id === id)) {
        sprite.destroy();
        this.buildSprites.delete(id);
      }
    this.acidSprites.forEach((sprite, i) => {
      const a = s.acid[i];
      sprite.setVisible(!!a);
      if (a) sprite.setPosition(a.x, a.y);
    });
    this.fx.clear();
    for (const q of s.players)
      if ((q.shield || 0) > 0 && q.hp > 0) {
        const actor = this.actors.get(q.id);
        if (actor)
          this.fx.lineStyle(2, 0x83d9ff, 0.55).strokeEllipse(actor.body.x, actor.body.y, 40, 58);
      }
    for (const h of s.hazards || []) {
      this.fx.lineStyle(2, h.warmup > 0 ? 0xffb45b : 0x91cc57, 0.85).strokeCircle(h.x, h.y, h.r);
      this.fx
        .fillStyle(h.warmup > 0 ? 0xffb45b : 0x79b344, h.warmup > 0 ? 0.12 : 0.28)
        .fillCircle(h.x, h.y, h.r);
      if (h.warmup > 0)
        this.fx.lineBetween(h.x - 12, h.y, h.x + 12, h.y).lineBetween(h.x, h.y - 12, h.x, h.y + 12);
    }
    for (const z of s.enemies) {
      if (z.ability?.phase === 'windup') {
        const a = z.ability.angle;
        this.fx
          .lineStyle(5, 0xffaa55, 0.5)
          .lineBetween(z.x, z.y, z.x + Math.cos(a) * 295, z.y + Math.sin(a) * 295);
        this.fx.lineStyle(2, 0xffd78c, 0.9).strokeCircle(z.x, z.y, 30);
      }
      if (z.fuse !== undefined)
        this.fx
          .lineStyle(3, 0xff795c, 0.5 + 0.4 * Math.sin(time / 70) ** 2)
          .strokeCircle(z.x, z.y, 115);
    }
    for (const shot of s.shots) {
      this.fx
        .lineStyle(
          shot.ricochet ? 3 : 2,
          shot.ricochet ? 0xd6a2ff : 0xffda83,
          Math.min(1, shot.t * 9),
        )
        .lineBetween(shot.x, shot.y, shot.ex, shot.ey);
      if (!this.seenShots.has(shot.id)) {
        this.seenShots.add(shot.id);
        if (b.transport.mode === 'solo' || shot.owner !== b.transport.self || shot.ricochet)
          b.audio.play(
            shot.ricochet ? 'hit' : ['pistol', 'shotgun', 'smg', 'rifle'][shot.gun],
            shot.x - (p?.x || base.x),
            Math.hypot(shot.x - (p?.x || base.x), shot.y - (p?.y || base.y)),
          );
        this.particle(shot.x, shot.y, 0xffd777, 4);
        this.particle(shot.x + 9, shot.y + 12, 0xd6aa64, 1);
        if (b.transport.mode === 'solo' && shot.owner === b.transport.self && b.settings.shake)
          this.cameras.main.shake(45, weapons[shot.gun].recoil * 0.00045);
      }
    }
    if (this.seenShots.size > 1500) this.seenShots.clear();
    for (const e of s.events)
      if (e.id > this.lastEvent) {
        this.lastEvent = e.id;
        if (e.kind === 'hit') {
          if (time > this.impactAt) {
            b.audio.play(
              'hit',
              e.x - (p?.x || 0),
              Math.hypot(e.x - (p?.x || 0), e.y - (p?.y || 0)),
            );
            this.impactAt = time + 100;
          }
          if (b.settings.shake && p && Math.hypot(e.x - p.x, e.y - p.y) < 700)
            this.hitStopUntil = time + 22;
          this.particle(e.x, e.y, 0xbe5050, 5);
          const label = this.labels[this.li++ % 25];
          this.tweens.killTweensOf(label);
          label
            .setPosition(e.x, e.y - 25)
            .setText(String(e.n))
            .setAlpha(1)
            .setVisible(true);
          this.tweens.add({
            targets: label,
            y: e.y - 65,
            alpha: 0,
            duration: 650,
            onComplete: () => label.setVisible(false),
          });
        }
        if (e.kind === 'death') {
          this.decals[this.di++ % 200]
            .setPosition(e.x, e.y + 10)
            .setSize(25 + Math.random() * 18, 14)
            .setVisible(true);
          this.particle(e.x, e.y, 0x934047, 12);
        }
        if (e.kind === 'explosion') {
          this.particle(e.x, e.y, 0xf6ad55, 24);
          b.audio.play(
            'explosion',
            e.x - (p?.x || 0),
            Math.hypot(e.x - (p?.x || 0), e.y - (p?.y || 0)),
          );
          if (b.settings.shake) this.cameras.main.shake(220, 0.008);
        }
        if (e.kind === 'wave') {
          this.message('WAVE ' + String(e.n).padStart(2, '0') + '\nSURVIVE & SCAVENGE');
          b.audio.play('wave');
        }
        if (e.kind === 'boss' && e.n)
          this.message(
            e.n === 5 ? 'THE BUTCHER\nCHARGE / ACID NOVA' : 'THE ABOMINATION\nELITE HORDE',
            true,
          );
        if (e.kind === 'revive') b.audio.play('ui');
        if (e.kind === 'loot') {
          this.particle(e.x, e.y, [0xd5dbe0, 0x8ed884, 0x75bbff, 0xd38bff, 0xffcd65][e.n], 22);
          b.audio.play(e.n === 4 ? 'wave' : 'ui');
        }
        if (e.kind === 'pulse') {
          const ring = this.add
            .circle(e.x, e.y, 12, 0x83d9ff, 0)
            .setStrokeStyle(3, 0x83d9ff, 0.8)
            .setDepth(60);
          this.tweens.add({
            targets: ring,
            scale: e.n / 12,
            alpha: 0,
            duration: 350,
            onComplete: () => ring.destroy(),
          });
          this.particle(e.x, e.y, 0x83d9ff, 10);
        }
        if (e.kind === 'poison') this.particle(e.x, e.y, 0xa2e568, 4);
      }
    this.chestArt.clear();
    let nearest: (typeof s.chests)[number] | undefined;
    for (const c of s.chests) {
      const x = c.x,
        y = c.y,
        opened = c.opened;
      this.chestArt
        .fillStyle(0x101b26, 0.55)
        .fillEllipse(x + 3, y + 20, 58, 20)
        .fillStyle(opened ? 0x3c464b : 0x835936)
        .fillRect(x - 23, y - 12, 46, 32)
        .fillStyle(opened ? 0x2c353b : 0xbf8d4e)
        .fillRect(x - 23, y - 18, 46, 12)
        .lineStyle(2, opened ? 0x677368 : 0xf0c577)
        .strokeRect(x - 23, y - 18, 46, 38);
      if (!opened)
        this.chestArt
          .fillStyle(0xf1d688)
          .fillRect(x - 16, y - 18, 5, 38)
          .fillRect(x + 11, y - 18, 5, 38)
          .fillRect(x - 5, y - 3, 10, 9);
      else this.chestArt.fillStyle(0x192732).fillRect(x - 18, y - 12, 36, 13);
      if (
        p &&
        !opened &&
        Math.hypot(p.x - x, p.y - y) < 85 &&
        (!nearest || Math.hypot(p.x - x, p.y - y) < Math.hypot(p.x - nearest.x, p.y - nearest.y))
      )
        nearest = c;
    }
    this.chestPrompt.setVisible(!!nearest && b.running && !b.pausedInput);
    if (nearest && p)
      this.chestPrompt
        .setPosition(nearest.x, nearest.y - 42)
        .setText(
          p.scrap >= nearest.cost
            ? `[E] OPEN CHEST · $${nearest.cost}`
            : `CHEST · $${nearest.cost} (need $${nearest.cost - p.scrap})`,
        )
        .setColor(p.scrap >= nearest.cost ? '#ffe0a0' : '#e49684');
    if (time > this.groanAt && s.enemies.length && p) {
      this.groanAt = time + 3800 + Math.random() * 4200;
      const z = s.enemies.reduce((a, c) =>
        Math.hypot(a.x - p.x, a.y - p.y) < Math.hypot(c.x - p.x, c.y - p.y) ? a : c,
      );
      b.audio.play('groan', z.x - p.x, Math.hypot(z.x - p.x, z.y - p.y));
    }
    this.mini.clear();
    if (b.running) {
      const x = this.scale.width - 162,
        y = 18,
        scale = 0.045;
      this.mini
        .fillStyle(0x0c1721, 0.85)
        .fillRect(x, y, 144, 112)
        .lineStyle(1, 0x849875, 0.8)
        .strokeRect(x, y, 144, 112);
      this.mini.fillStyle(0x879579, 0.65);
      for (const z of s.enemies)
        this.mini.fillStyle(0xe47768).fillRect(x + z.x * scale, y + z.y * scale, 2, 2);
      for (const q of s.players)
        this.mini
          .fillStyle(q.id === p?.id ? 0xd8ffa2 : 0x82baff)
          .fillCircle(x + q.x * scale, y + q.y * scale, 3);
      for (const c of s.chests)
        if (!c.opened)
          this.mini.fillStyle(0xe8c973).fillRect(x + c.x * scale - 2, y + c.y * scale - 2, 4, 4);
    }
    this.cursor.clear();
    if (active)
      this.cursor
        .lineStyle(1, 0xe4efb6, 0.8)
        .strokeCircle(pointer.x, pointer.y, 7)
        .lineBetween(pointer.x - 12, pointer.y, pointer.x - 5, pointer.y)
        .lineBetween(pointer.x + 5, pointer.y, pointer.x + 12, pointer.y);
    if (time - this.hudAt > 100) {
      this.hudAt = time;
      b.onHud(s);
      b.audio.update();
    }
  }
}
