import type { Player, World } from './types';
import { solid, WIDTH, HEIGHT, base } from './map';
export const tiers = [
  { id: 'common', name: 'Common', chance: 58, color: '#d5dbe0' },
  { id: 'uncommon', name: 'Uncommon', chance: 27, color: '#8ed884' },
  { id: 'rare', name: 'Rare', chance: 11, color: '#75bbff' },
  { id: 'epic', name: 'Epic', chance: 3.5, color: '#d38bff' },
  { id: 'legendary', name: 'Legendary', chance: 0.5, color: '#ffcd65' },
] as const;
export type Tier = (typeof tiers)[number]['id'];
export const items = [
  {
    id: 'rounds',
    name: 'Serrated Rounds',
    tier: 'common',
    symbol: 'SR',
    description: 'Hits cause bleeding for 4 damage/s per stack for 3 seconds.',
  },
  {
    id: 'boots',
    name: 'Courier Boots',
    tier: 'common',
    symbol: 'CB',
    description:
      'Dashing grants brief invulnerability and shoves nearby enemies away. Extra stacks widen the shove.',
  },
  {
    id: 'vest',
    name: 'Reinforced Vest',
    tier: 'common',
    symbol: 'RV',
    description: '+20 maximum health per stack. Heal 20 on pickup.',
  },
  {
    id: 'trigger',
    name: 'Overdrive Trigger',
    tier: 'uncommon',
    symbol: 'HT',
    description:
      'Every 3 kills triggers +35% fire rate for 3 seconds. Extra stacks add 0.5 seconds.',
  },
  {
    id: 'loader',
    name: 'Shockloader',
    tier: 'uncommon',
    symbol: 'QL',
    description:
      'Finishing a reload releases a shockwave: 14 damage per stack and knockback to nearby enemies.',
  },
  {
    id: 'bounty',
    name: 'Bounty Token',
    tier: 'uncommon',
    symbol: 'BT',
    description: 'Every fifth kill pays a $20 bounty per stack and refills 25% of your magazine.',
  },
  {
    id: 'scope',
    name: 'Ricochet Lens',
    tier: 'rare',
    symbol: 'DL',
    description:
      'Every fourth shot bounces to another enemy for 35% damage. Extra stacks add bounces (max 2).',
  },
  {
    id: 'regen',
    name: 'Living Moss',
    tier: 'rare',
    symbol: 'LM',
    description:
      'After 3 seconds without firing or taking damage, regenerate 2 health/s per stack.',
  },
  {
    id: 'frost',
    name: 'Cryo Rounds',
    tier: 'rare',
    symbol: 'CR',
    description: 'Hits slow enemies by 30% for 2s. Extra stacks extend the slow.',
  },
  {
    id: 'leech',
    name: 'Vampire Fang',
    tier: 'epic',
    symbol: 'VF',
    description: 'Kills heal you for 2 health per stack.',
  },
  {
    id: 'blast',
    name: 'Volatile Core',
    tier: 'epic',
    symbol: 'VC',
    description: 'Kills explode for 22 damage in a 75px radius. +22 damage per stack.',
  },
  {
    id: 'ward',
    name: 'Aegis Plating',
    tier: 'epic',
    symbol: 'AP',
    description:
      'Gain 20 shields per stack. Shields absorb damage first and recharge after 7 seconds without a hit.',
  },
  {
    id: 'prism',
    name: 'Prismatic Heart',
    tier: 'legendary',
    symbol: 'PH',
    description:
      'Bullets ricochet to 2 nearby enemies at 35% damage, decaying each bounce. +1 bounce per extra stack (max 4).',
  },
  {
    id: 'plague',
    name: 'Plague Crown',
    tier: 'legendary',
    symbol: 'PC',
    description:
      'Hits inflict spreading poison: 6 damage/s for 4s. Infected deaths spread it to nearby enemies. Stacks strengthen poison.',
  },
] as const;
export type ItemId = (typeof items)[number]['id'];
export const itemById = (id: string) => items.find((i) => i.id === id)!;
export const stacks = (p: Player, id: ItemId) => Math.min(4, p.items[id] || 0);
export const maxHealth = (p: Player) => 100 + 20 * stacks(p, 'vest');
export const moveSpeed = (p: Player) => {
  void p;
  return 190;
};
export const maxShield = (p: Player) => 20 * stacks(p, 'ward');
export const reloadDuration = (p: Player, seconds: number) => {
  void p;
  return seconds;
};
export function rollItem(random: () => number = Math.random): ItemId {
  let roll = Math.min(9999, Math.floor(random() * 10000));
  let tier: Tier = 'legendary';
  for (const t of tiers) {
    if (roll < t.chance * 100) {
      tier = t.id;
      break;
    }
    roll -= t.chance * 100;
  }
  const pool = items.filter((i) => i.tier === tier);
  return pool[Math.min(pool.length - 1, Math.floor(random() * pool.length))].id;
}
export const chestPrice = (wave: number) => 75 + Math.max(0, wave - 1) * 18;
export function replenishChests(s: World) {
  const kept = s.chests.filter((c) => !c.opened);
  s.chests = kept;
  const desired = 20;
  for (let tries = 0; s.chests.length < desired && tries < 500; tries++) {
    const nearby = tries < 6;
    const x = nearby
        ? base.x + Math.cos(tries * 1.2) * (170 + tries * 75)
        : 100 + Math.random() * (WIDTH - 200),
      y = nearby
        ? base.y + Math.sin(tries * 1.2) * (170 + tries * 75)
        : 100 + Math.random() * (HEIGHT - 200);
    if (solid(x, y, 45) || s.chests.some((c) => Math.hypot(c.x - x, c.y - y) < 160)) continue;
    s.chests.push({
      id: ++s.seq,
      x: Math.round(x),
      y: Math.round(y),
      opened: false,
      cost: chestPrice(s.wave),
    });
  }
  for (const c of s.chests) c.cost = chestPrice(s.wave);
}
export function openChest(
  s: World,
  p: Player,
  random: () => number = Math.random,
  chestId?: number,
) {
  if (
    p.hp <= 0 ||
    !['combat', 'break'].includes(s.phase) ||
    s.players.some((q) => q.hp <= 0 && Math.hypot(q.x - p.x, q.y - p.y) < 75)
  )
    return false;
  const c = s.chests
    .filter(
      (c) =>
        (chestId === undefined || c.id === chestId) &&
        !c.opened &&
        Math.hypot(c.x - p.x, c.y - p.y) < 85,
    )
    .sort((a, b) => Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(b.x - p.x, b.y - p.y))[0];
  if (!c || p.scrap < c.cost) return false;
  p.scrap -= c.cost;
  c.opened = true;
  c.owner = p.id;
  const id = rollItem(random);
  p.items[id] = Math.min(4, p.items[id] || 0) + 1;
  p.chestsOpened++;
  p.lastLoot = { id, at: s.time };
  if (id === 'ward') p.shield = maxShield(p);
  if (id === 'vest') p.hp = Math.min(maxHealth(p), p.hp + 20);
  s.events.push({
    id: ++s.seq,
    kind: 'loot',
    x: c.x,
    y: c.y,
    n: tiers.findIndex((t) => t.id === itemById(id).tier),
  });
  return true;
}
