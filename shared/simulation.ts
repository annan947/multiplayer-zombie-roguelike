import { enemyAbility, tickHazards } from './enemyAbilities';
import { weaponPose } from './weaponPose';
import weapons from './config/weapons.json';
import enemies from './config/enemies.json';
import waves from './config/waves.json';
import { base, move, solid, WIDTH, HEIGHT } from './map';
import { direction, eliteDirection, clearRoute } from './pathfinding';
import type { World, Player, Input, Enemy, EnemyKind, Command } from './types';
import {
  stacks,
  maxHealth,
  maxShield,
  moveSpeed,
  reloadDuration,
  openChest,
  replenishChests,
} from './items';
export { weapons, enemies, waves };
export const blankInput = (): Input => ({
  x: 0,
  y: 0,
  a: 0,
  fire: false,
  reload: false,
  revive: false,
  seq: 0,
});
export function createWorld(): World {
  return {
    v: 3,
    chests: [],
    hazards: [],
    players: [],
    enemies: [],
    shots: [],
    events: [],
    builds: [],
    acid: [],
    wave: 0,
    phase: 'lobby',
    timer: 0,
    left: 0,
    spawn: 0,
    time: Date.now(),
    seq: 0,
    elapsed: 0,
  };
}
export function createPlayer(id: string, name: string): Player {
  return {
    id,
    name: name.slice(0, 16) || 'Survivor',
    x: base.x - 50 + Math.random() * 100,
    y: base.y + 95,
    hp: 100,
    ammo: 12,
    scrap: 0,
    kills: 0,
    gun: 0,
    owned: [0],
    cool: 0,
    reload: 0,
    input: blankInput(),
    seen: Date.now(),
    ready: false,
    connected: true,
    damage: 0,
    revive: 0,
    dash: 0,
    upgrade: 0,
    shots: 0,
    items: {},
    chestsOpened: 0,
    shield: 0,
    lastHurt: 0,
    lastFire: 0,
    frenzy: 0,
    streak: 0,
  };
}
function event(s: World, kind: World['events'][number]['kind'], x: number, y: number, n = 0) {
  s.events.push({ id: ++s.seq, kind, x, y, n });
  if (s.events.length > 80) s.events.shift();
}
function addEnemy(s: World, kind: EnemyKind, x: number, y: number) {
  const hp =
    enemies[kind].hp *
    (1 + s.wave * 0.12 + Math.max(0, s.wave - 10) * 0.08) *
    (kind === 'boss' ? 1 + (s.players.length - 1) * 0.5 : 1);
  s.enemies.push({ id: ++s.seq, kind, x, y, hp, max: hp, cool: 2, hit: 0, charge: 0 });
}
function nextWave(s: World) {
  s.wave++;
  s.phase = 'combat';
  replenishChests(s);
  s.left = waves.base + s.wave * waves.perWave + s.players.length * waves.perPlayer;
  s.spawn = 1.5;
  event(s, 'wave', base.x, base.y, s.wave);
  if (s.wave % 5 === 0) {
    addEnemy(s, 'boss', base.x, base.y - 460);
    event(s, 'boss', base.x, base.y, s.wave);
  }
}
export function start(s: World) {
  const names = s.players.map((p) => ({ id: p.id, name: p.name }));
  Object.assign(s, createWorld());
  s.players = names.map((p) => createPlayer(p.id, p.name));
  nextWave(s);
}
function hurt(s: World, z: Enemy, n: number, p?: Player, a = 0, secondary = false) {
  if (z.hp <= 0 || !s.enemies.some((q) => q.id === z.id)) return;
  z.hp -= n;
  if (!secondary) z.hit = 0.13;
  if (!secondary) move(z, Math.cos(a) * 7, Math.sin(a) * 7);
  if (!secondary) event(s, 'hit', z.x, z.y, Math.round(n));
  if (z.hp <= 0) {
    s.enemies = s.enemies.filter((q) => q.id !== z.id);
    if (p) {
      p.kills++;
      if (stacks(p, 'trigger')) {
        p.streak = (p.streak || 0) + 1;
        if (p.streak >= 3) {
          p.streak = 0;
          p.frenzy = 3 + 0.5 * (stacks(p, 'trigger') - 1);
        }
      }
      if (stacks(p, 'bounty') && p.kills % 5 === 0) {
        p.scrap += 20 * stacks(p, 'bounty');
        p.ammo = Math.min(weapons[p.gun].clip, p.ammo + Math.ceil(weapons[p.gun].clip * 0.25));
      }
      p.scrap += Math.round(enemies[z.kind].reward * (1 + s.wave * 0.025));
      p.hp = Math.min(maxHealth(p), p.hp + stacks(p, 'leech') * 2);
    }
    event(s, 'death', z.x, z.y, z.kind === 'boss' ? 2 : 0);
    if (z.poison) {
      for (const q of s.enemies)
        if (Math.hypot(q.x - z.x, q.y - z.y) < 160)
          q.poison = { ...z.poison, time: 3, dps: z.poison.dps * 0.65, spread: 1 };
      event(s, 'poison', z.x, z.y, 0);
    }
    if (p && stacks(p, 'blast') && !secondary) {
      event(s, 'explosion', z.x, z.y, 0);
      for (const q of [...s.enemies])
        if (Math.hypot(q.x - z.x, q.y - z.y) < 75) hurt(s, q, 22 * stacks(p, 'blast'), p, 0, true);
    }
  }
}
function fire(s: World, p: Player) {
  const w = weapons[p.gun];
  const { muzzleX, muzzleY } = weaponPose(p.x, p.y, p.input.a, p.gun);
  p.ammo--;
  p.cool = w.rate / ((p.frenzy || 0) > 0 ? 1.35 : 1);
  p.lastFire = s.time;
  p.shots++;
  for (let k = 0; k < w.pellets; k++) {
    const a =
        p.input.a +
        (w.pellets > 1 ? (k - (w.pellets - 1) / 2) * w.spread : (Math.random() - 0.5) * w.spread),
      vx = Math.cos(a),
      vy = Math.sin(a);
    let dist = w.range,
      target: Enemy | undefined;
    for (let d = 16; d < dist; d += 12)
      if (solid(muzzleX + vx * d, muzzleY + vy * d, 2)) {
        dist = d;
        break;
      }
    for (const z of s.enemies) {
      const dx = z.x - muzzleX,
        dy = z.y - muzzleY,
        proj = dx * vx + dy * vy;
      if (
        proj > 0 &&
        proj < dist &&
        Math.abs(dx * vy - dy * vx) < (z.kind === 'boss' ? 35 : z.kind === 'tank' ? 24 : 17)
      ) {
        dist = proj;
        target = z;
      }
    }
    s.shots.push({
      id: ++s.seq,
      x: muzzleX,
      y: muzzleY,
      ex: muzzleX + vx * dist,
      ey: muzzleY + vy * dist,
      gun: p.gun,
      owner: p.id,
      t: 0.16,
    });
    if (target) {
      const damage = w.damage * (1 + p.upgrade * 0.22);
      if (stacks(p, 'rounds'))
        target.bleed = { owner: p.id, time: 3, dps: 4 * stacks(p, 'rounds') };
      if (stacks(p, 'frost')) target.slow = 2 + stacks(p, 'frost');
      if (stacks(p, 'plague'))
        target.poison = { owner: p.id, time: 4, dps: 6 * stacks(p, 'plague'), spread: 1 };
      hurt(s, target, damage, p, a);
      const bounces = stacks(p, 'prism')
        ? Math.min(4, 1 + stacks(p, 'prism'))
        : p.shots % 4 === 0
          ? Math.min(2, stacks(p, 'scope'))
          : 0;
      if (bounces) {
        let from = { x: target.x, y: target.y };
        const hit = new Set([target.id]);
        for (let bounce = 0; bounce < bounces; bounce++) {
          const next = s.enemies
            .filter((z) => !hit.has(z.id) && Math.hypot(z.x - from.x, z.y - from.y) < 260)
            .sort(
              (a, b) =>
                Math.hypot(a.x - from.x, a.y - from.y) - Math.hypot(b.x - from.x, b.y - from.y),
            )[0];
          if (!next) break;
          hit.add(next.id);
          s.shots.push({
            id: ++s.seq,
            x: from.x,
            y: from.y,
            ex: next.x,
            ey: next.y,
            gun: p.gun,
            owner: p.id,
            t: 0.23,
            ricochet: true,
          });
          if (stacks(p, 'plague'))
            next.poison = { owner: p.id, time: 4, dps: 6 * stacks(p, 'plague'), spread: 1 };
          hurt(s, next, damage * 0.35 * Math.pow(0.7, bounce), p, a);
          from = { x: next.x, y: next.y };
        }
      }
    }
  }
}
export function applyCommand(s: World, p: Player, c: Command) {
  if (c.action === 'open') openChest(s, p, Math.random, c.chest);
  if (c.action === 'ready') p.ready = !p.ready;
  if (
    c.action === 'start' &&
    p.id === s.players[0]?.id &&
    ['lobby', 'won', 'lost'].includes(s.phase) &&
    (s.phase !== 'lobby' || s.players.every((q) => q.id === p.id || q.ready || !q.connected))
  )
    start(s);
  if (c.action === 'equip' && p.owned.includes(c.gun!)) {
    p.gun = c.gun!;
    p.ammo = weapons[p.gun].clip;
    p.reload = reloadDuration(p, weapons[p.gun].reload);
  }
  if (c.action === 'buy' && s.phase === 'break') {
    const g = c.gun!;
    if (weapons[g] && !p.owned.includes(g) && p.scrap >= weapons[g].cost) {
      p.scrap -= weapons[g].cost;
      p.owned.push(g);
      p.gun = g;
      p.ammo = weapons[g].clip;
    }
  }
  if (
    c.action === 'upgrade' &&
    s.phase === 'break' &&
    p.upgrade < 4 &&
    p.scrap >= 150 * (p.upgrade + 1)
  ) {
    p.scrap -= 150 * (p.upgrade + 1);
    p.upgrade++;
  }
  if (c.action === 'heal' && p.hp > 0 && p.hp < maxHealth(p) && p.scrap >= 80) {
    p.scrap -= 80;
    p.hp = Math.min(maxHealth(p), p.hp + 60);
  }
  if (c.action === 'build' && s.phase === 'break') {
    const kind = c.kind === 'turret' ? 'turret' : 'barricade',
      cost = kind === 'turret' ? 260 : 90;
    const x = p.x + Math.cos(p.input.a) * 60,
      y = p.y + Math.sin(p.input.a) * 60;
    if (
      p.scrap >= cost &&
      !solid(x, y, 28) &&
      s.builds.length < 24 &&
      !s.builds.some((b) => Math.hypot(b.x - x, b.y - y) < 60)
    ) {
      p.scrap -= cost;
      s.builds.push({ id: ++s.seq, kind, x, y, hp: kind === 'turret' ? 250 : 450, cool: 0 });
    }
  }
  if (c.action === 'next' && s.phase === 'break' && p.id === s.players[0]?.id) s.timer = 0;
}
export function advance(s: World, now: number) {
  let dt = Math.min(0.4, Math.max(0, (now - s.time) / 1000));
  s.time = now;
  if (!['combat', 'break'].includes(s.phase)) return;
  while (dt > 0) {
    const d = Math.min(dt, 1 / 30);
    step(s, d, now);
    dt -= d;
    if (['lost', 'won'].includes(s.phase)) break;
  }
}
export function damagePlayer(s: World, p: Player, amount: number) {
  if (p.hp <= 0 || (stacks(p, 'boots') && p.dash > 2.3)) return;
  const absorbed = Math.min(p.shield || 0, amount);
  p.shield = Math.max(0, (p.shield || 0) - absorbed);
  p.hp = Math.max(0, p.hp - (amount - absorbed));
  p.lastHurt = s.time;
  p.damage = 0.2;
}
function pulse(s: World, p: Player, radius: number, damage: number) {
  event(s, 'pulse', p.x, p.y, radius);
  for (const z of [...s.enemies])
    if (Math.hypot(z.x - p.x, z.y - p.y) < radius) {
      const a = Math.atan2(z.y - p.y, z.x - p.x);
      move(z, Math.cos(a) * 30, Math.sin(a) * 30);
      z.slow = Math.max(z.slow || 0, 1.2);
      if (damage > 0) hurt(s, z, damage, p, a);
    }
}
function step(s: World, d: number, now: number) {
  s.elapsed += d;
  s.shots = s.shots.filter((b) => (b.t -= d) > 0);
  const alive = s.players.filter((p) => p.hp > 0 && p.connected);
  if (!alive.length) {
    s.phase = 'lost';
    return;
  }
  for (const p of s.players) {
    p.damage = Math.max(0, p.damage - d);
    p.connected = now - p.seen < 30000;
    if (p.hp <= 0) continue;
    const i = now - p.seen < 1200 ? p.input : blankInput(),
      len = Math.max(1, Math.hypot(i.x, i.y));
    p.dash -= d;
    p.frenzy = Math.max(0, (p.frenzy || 0) - d);
    if (now - Math.max(p.lastFire || 0, p.lastHurt || 0) > 3000)
      p.hp = Math.min(maxHealth(p), p.hp + stacks(p, 'regen') * 2 * d);
    if (now - (p.lastHurt || 0) > 7000)
      p.shield = Math.min(maxShield(p), (p.shield || 0) + maxShield(p) * 0.15 * d);
    let speed = moveSpeed(p);
    if (i.dash && p.dash <= 0) {
      p.dash = 2.5;
      if (stacks(p, 'boots')) pulse(s, p, 95 + 15 * stacks(p, 'boots'), 0);
    }
    if (p.dash > 2.3) speed *= 3;
    move(p, (i.x / len) * speed * d, (i.y / len) * speed * d);
    p.cool -= d;
    if (p.reload > 0) {
      p.reload -= d;
      if (p.reload <= 0) {
        p.ammo = weapons[p.gun].clip;
        if (stacks(p, 'loader')) pulse(s, p, 110, 14 * stacks(p, 'loader'));
      }
    }
    if ((i.reload || !p.ammo) && p.reload <= 0 && p.ammo < weapons[p.gun].clip)
      p.reload = reloadDuration(p, weapons[p.gun].reload);
    if (i.fire && p.cool <= 0 && p.reload <= 0 && p.ammo > 0) fire(s, p);
    if (i.revive) {
      for (const q of s.players)
        if (q.hp <= 0 && Math.hypot(q.x - p.x, q.y - p.y) < 75) {
          q.revive += d;
          if (q.revive > 2) {
            q.hp = 50;
            q.revive = 0;
            event(s, 'revive', q.x, q.y);
          }
        }
    }
  }
  if (s.phase === 'break') {
    s.timer -= d;
    if (s.timer <= 0) nextWave(s);
    return;
  }
  s.spawn -= d;
  if (s.left > 0 && s.spawn <= 0 && s.enemies.length < waves.maxEnemies) {
    s.spawn = Math.max(0.15, waves.spawnInterval - s.wave * 0.035);
    s.left--;
    const p = alive[Math.floor(Math.random() * alive.length)];
    let x = p.x,
      y = p.y;
    for (let i = 0; i < 16; i++) {
      const a = Math.random() * Math.PI * 2;
      x = Math.max(60, Math.min(WIDTH - 60, p.x + Math.cos(a) * (500 + Math.random() * 160)));
      y = Math.max(60, Math.min(HEIGHT - 60, p.y + Math.sin(a) * (500 + Math.random() * 160)));
      if (!solid(x, y, 24)) break;
    }
    if (!solid(x, y, 24)) {
      const r = Math.random();
      const kind: EnemyKind =
        s.wave >= 3 && r < 0.16
          ? 'exploder'
          : s.wave >= 2 && r < 0.38
            ? 'spitter'
            : s.wave >= 2 && r < 0.53
              ? 'tank'
              : r < 0.73
                ? 'runner'
                : 'walker';
      addEnemy(s, kind, x, y);
    }
  }
  for (const z of [...s.enemies]) {
    if (z.bleed) {
      z.bleed.time -= d;
      hurt(
        s,
        z,
        z.bleed.dps * d,
        s.players.find((p) => p.id === z.bleed!.owner),
        0,
        true,
      );
      if (z.hp <= 0) continue;
      if (z.bleed.time <= 0) z.bleed = undefined;
    }
    if (z.poison) {
      z.poison.time -= d;
      z.poison.spread -= d;
      const owner = s.players.find((p) => p.id === z.poison!.owner);
      hurt(s, z, z.poison.dps * d, owner, 0, true);
      if (z.hp <= 0) continue;
      if (z.poison.spread <= 0) {
        z.poison.spread = 1;
        for (const q of s.enemies)
          if (q.id !== z.id && !q.poison && Math.hypot(q.x - z.x, q.y - z.y) < 90)
            q.poison = { ...z.poison, time: 3, dps: z.poison.dps * 0.65, spread: 1 };
        event(s, 'poison', z.x, z.y, 0);
      }
      if (z.poison.time <= 0) z.poison = undefined;
    }
    z.cool -= d;
    z.hit = Math.max(0, z.hit - d);
    const p = alive.reduce((a, b) =>
      Math.hypot(a.x - z.x, a.y - z.y) < Math.hypot(b.x - z.x, b.y - z.y) ? a : b,
    );
    const target = p;
    const dist = Math.hypot(target.x - z.x, target.y - z.y);
    if (enemyAbility(s, z, p, d, (q, n) => damagePlayer(s, q, n))) continue;
    if (z.kind === 'boss' && z.cool <= 0) {
      z.charge = 1.15;
      z.cool = s.wave >= 10 ? 4.8 : 7;
      if (s.wave >= 10 && s.enemies.length < 85)
        for (let k = 0; k < 3; k++) {
          const x = z.x + Math.cos(k * 2.1) * 65,
            y = z.y + Math.sin(k * 2.1) * 65;
          if (!solid(x, y, 20)) addEnemy(s, 'runner', x, y);
        }
      event(s, 'boss', z.x, z.y, 0);
      for (let k = 0; k < 6; k++) {
        const a = (k * Math.PI) / 3;
        s.acid.push({
          id: ++s.seq,
          x: z.x,
          y: z.y,
          vx: Math.cos(a) * 170,
          vy: Math.sin(a) * 170,
          ttl: 3,
        });
      }
    }
    let speed = enemies[z.kind].speed * (1 + Math.min(0.6, s.wave * 0.02));
    if (z.slow && z.slow > 0) {
      z.slow -= d;
      speed *= 0.7;
    }
    if (z.charge > 0) {
      z.charge -= d;
      speed *= 3.6;
    }
    const dir =
      z.kind === 'boss'
        ? eliteDirection(z.x, z.y, target.x, target.y, now)
        : direction(z.x, z.y, target.x, target.y, now);
    const barrier = s.builds.find((b) => Math.hypot(b.x - z.x, b.y - z.y) < 50);
    if (barrier) {
      barrier.hp -= enemies[z.kind].damage * 3 * d;
    } else if (!(z.kind === 'spitter' && dist < 230 && clearRoute(z.x, z.y, target.x, target.y))) {
      move(z, dir.x * speed * d, dir.y * speed * d, z.kind === 'boss' ? 24 : 14);
    }
    if (dist < (z.kind === 'boss' ? 50 : 31)) {
      {
        damagePlayer(s, p, enemies[z.kind].damage * (1 + s.wave * 0.035) * d);
      }
    }
  }
  tickHazards(s, d, (p, n) => damagePlayer(s, p, n));
  for (const a of s.acid) {
    a.x += a.vx * d;
    a.y += a.vy * d;
    a.ttl -= d;
    if (solid(a.x, a.y, 3)) a.ttl = 0;
    for (const p of alive)
      if (Math.hypot(p.x - a.x, p.y - a.y) < 23) {
        damagePlayer(s, p, 16);
        a.ttl = 0;
      }
  }
  s.acid = s.acid.filter((a) => a.ttl > 0);
  s.builds = s.builds.filter((b) => b.hp > 0);
  for (const b of s.builds) {
    b.cool -= d;
    if (b.kind === 'turret' && b.cool <= 0) {
      const z = s.enemies.find((z) => Math.hypot(z.x - b.x, z.y - b.y) < 380);
      if (z) {
        b.cool = 0.24;
        hurt(s, z, 22);
        s.shots.push({
          id: ++s.seq,
          x: b.x,
          y: b.y,
          ex: z.x,
          ey: z.y,
          gun: 2,
          owner: 'turret',
          t: 0.1,
        });
      }
    }
  }
  if (!s.left && !s.enemies.length) {
    if (s.wave >= waves.total) s.phase = 'won';
    else {
      s.phase = 'break';
      s.hazards = [];
      s.acid = [];
      s.timer = waves.breakSeconds;
      for (const p of s.players) {
        p.hp = Math.min(maxHealth(p), p.hp + 35);
        p.ammo = weapons[p.gun].clip;
        p.scrap += 75;
      }
    }
  }
}
