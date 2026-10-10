export const WIDTH = 3072,
  HEIGHT = 2304,
  TILE = 32;
export const base = { x: 1536, y: 1152 };
export const buildings = [
  { x: 256, y: 256, w: 416, h: 288, label: 'ST. AGNES CLINIC', color: 0x576773 },
  { x: 928, y: 192, w: 416, h: 352, label: 'NORTH RESIDENCES', color: 0x59536d },
  { x: 1792, y: 224, w: 384, h: 288, label: 'NOODLE HOUSE', color: 0x80504d },
  { x: 2400, y: 256, w: 416, h: 352, label: 'POLICE PRECINCT', color: 0x455e70 },
  { x: 192, y: 832, w: 416, h: 352, label: 'AUTO REPAIR', color: 0x696247 },
  { x: 864, y: 832, w: 256, h: 256, label: 'POWER SUBSTATION', color: 0x4a6462 },
  { x: 1952, y: 832, w: 256, h: 256, label: 'WAREHOUSE', color: 0x636d57 },
  { x: 2464, y: 896, w: 384, h: 352, label: 'CORNER STORE', color: 0x725d57 },
  { x: 288, y: 1600, w: 448, h: 352, label: 'WEST TERMINAL', color: 0x4d656d },
  { x: 1024, y: 1696, w: 352, h: 320, label: 'APARTMENTS', color: 0x666278 },
  { x: 1728, y: 1664, w: 416, h: 320, label: 'OLD FACTORY', color: 0x725857 },
  { x: 2400, y: 1696, w: 384, h: 352, label: 'FREIGHT DEPOT', color: 0x526c5a },
];
export const cars = [
  { x: 760, y: 580, w: 48, h: 94 },
  { x: 2270, y: 470, w: 50, h: 98 },
  { x: 620, y: 1430, w: 94, h: 48 },
  { x: 1690, y: 640, w: 48, h: 96 },
  { x: 2260, y: 1420, w: 92, h: 48 },
  { x: 1430, y: 2060, w: 48, h: 92 },
];
export const walls = [...buildings, ...cars];
export function solid(x: number, y: number, r = 13) {
  return (
    x < 24 + r ||
    y < 24 + r ||
    x > WIDTH - 24 - r ||
    y > HEIGHT - 24 - r ||
    walls.some((b) => x + r > b.x && x - r < b.x + b.w && y + r > b.y && y - r < b.y + b.h)
  );
}
export function move(p: { x: number; y: number }, dx: number, dy: number, r = 13) {
  if (!solid(p.x + dx, p.y, r)) p.x += dx;
  if (!solid(p.x, p.y + dy, r)) p.y += dy;
}
export function ground(x: number, y: number) {
  if (x < 2 || y < 2 || x > 93 || y > 69) return 3;
  const road =
    (x >= 22 && x <= 27) ||
    (x >= 44 && x <= 51) ||
    (x >= 69 && x <= 74) ||
    (y >= 18 && y <= 23) ||
    (y >= 41 && y <= 47);
  return road ? 0 : (x * 13 + y * 7) % 17 === 0 ? 2 : 1;
}
