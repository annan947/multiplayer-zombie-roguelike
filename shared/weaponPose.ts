// Shared shoulder and barrel geometry keeps rendered weapons and authoritative shots aligned.
export const barrelLengths = [21, 30, 22, 34];
export function weaponPose(x: number, y: number, angle: number, gun: number) {
  const left = Math.cos(angle) < 0;
  const shoulderX = x + (left ? 4 : -4),
    shoulderY = y - 5;
  const length = barrelLengths[gun] ?? barrelLengths[0];
  const barrelOffset = left ? 1 : -1;
  return {
    shoulderX,
    shoulderY,
    muzzleX: shoulderX + Math.cos(angle) * length - Math.sin(angle) * barrelOffset,
    muzzleY: shoulderY + Math.sin(angle) * length + Math.cos(angle) * barrelOffset,
    left,
  };
}
