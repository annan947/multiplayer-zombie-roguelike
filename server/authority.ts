import { advance, applyCommand, createPlayer, createWorld } from '../shared/simulation';
import type { World, Input, Command } from '../shared/types';
export type RequestBody = Command & {
  commandId?: number;
  code?: string;
  token?: string;
  name?: string;
  input?: Partial<Input>;
};
export async function tokenHash(t: string) {
  return Array.from(
    new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(t))),
  )
    .map((x) => x.toString(16).padStart(2, '0'))
    .join('');
}
export function cleanInput(i: Partial<Input>): Input {
  const n = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
  return {
    x: Math.max(-1, Math.min(1, n(i.x))),
    y: Math.max(-1, Math.min(1, n(i.y))),
    a: n(i.a),
    seq: n(i.seq),
    fire: !!i.fire,
    reload: !!i.reload,
    revive: !!i.revive,
    dash: !!i.dash,
  };
}
export { advance, applyCommand, createPlayer, createWorld };
export type { World };
