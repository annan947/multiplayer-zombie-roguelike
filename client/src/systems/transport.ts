import { SnapshotBuffer } from './netMotion';
import { Client, Room } from 'colyseus.js';
import {
  createWorld,
  createPlayer,
  start,
  advance,
  applyCommand,
} from '../../../shared/simulation';
import type { World, Input, Command } from '../../../shared/types';
export class Transport {
  state: World = createWorld();
  self = '';
  code = '';
  token = '';
  mode: 'solo' | 'http' | 'colyseus' = 'solo';
  error = '';
  latency = 0;
  snapshots = new SnapshotBuffer();
  private generation = 0;
  private commandSeq = 0;
  private wsSentAt = 0;
  private taps = { fire: false, reload: false, dash: false };
  private controller?: AbortController;
  private room?: Room;
  private running = false;
  private input?: Input;
  private queue: (Command & { commandId: number })[] = [];
  private timer?: ReturnType<typeof setTimeout>;
  onChange = () => {};
  async connect(name: string, code?: string, endpoint?: string) {
    this.generation++;
    this.snapshots.clear();
    this.queue = [];
    if (endpoint) {
      const c = new Client(endpoint);
      this.room = code ? await c.joinById(code, { name }) : await c.create('survival', { name });
      this.mode = 'colyseus';
      this.self = this.room.sessionId;
      this.code = this.room.roomId;
      this.room.onMessage('world', (s: World) => {
        this.snapshots.push(s);
        this.state = s;
        this.onChange();
      });
      this.room.onLeave(async () => {
        if (!this.running) return;
        this.error = 'Reconnecting…';
        try {
          this.room = await c.reconnect(this.room!.reconnectionToken);
          this.room.onMessage('world', (s: World) => {
            this.snapshots.push(s);
            this.state = s;
            this.error = '';
            this.onChange();
          });
        } catch {
          this.error = 'Reconnect expired. Return to menu.';
        }
      });
      this.running = true;
      return;
    }
    const res = await this.request({ action: code ? 'join' : 'create', name, code });
    this.accept(res);
    this.mode = 'http';
    this.running = true;
    this.poll();
  }
  solo(name: string) {
    this.mode = 'solo';
    this.self = 'solo';
    this.state = createWorld();
    this.state.players = [createPlayer('solo', name)];
    start(this.state);
  }
  private async request(body: Record<string, unknown>, signal?: AbortSignal) {
    const r = await fetch('/api/game', {
      signal,
      cache: 'no-store',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const d = (await r.json()) as {
      state: World;
      self: string;
      code: string;
      token: string;
      error?: string;
    };
    if (!r.ok) throw new Error(d.error || 'Connection failed');
    return d;
  }
  private accept(d: { state: World; self: string; code: string; token: string }) {
    if (!this.snapshots.push(d.state)) return;
    this.state = d.state;
    this.self = d.self;
    this.code = d.code;
    this.token = d.token;
    this.error = '';
    this.onChange();
  }
  private async poll() {
    if (!this.running) return;
    const generation = this.generation,
      command = this.queue[0],
      began = performance.now();
    const taps = this.taps;
    this.taps = { fire: false, reload: false, dash: false };
    const sentInput = this.input
      ? {
          ...this.input,
          fire: this.input.fire || taps.fire,
          reload: this.input.reload || taps.reload,
          dash: this.input.dash || taps.dash,
        }
      : undefined;
    const controller = new AbortController();
    this.controller = controller;
    const timeout = setTimeout(() => controller.abort(), 5000);
    try {
      const d = await this.request(
        {
          code: this.code,
          token: this.token,
          ...(command || { action: 'poll' }),
          input: sentInput,
        },
        controller.signal,
      );
      if (!this.running || generation !== this.generation) return;
      const elapsed = performance.now() - began;
      this.latency = this.latency ? this.latency * 0.8 + elapsed * 0.2 : elapsed;
      this.accept(d);
      // A command queued during a poll must not be discarded by that poll's response.
      if (command && this.queue[0] === command) this.queue.shift();
    } catch (e) {
      if (!this.running || generation !== this.generation) return;
      this.taps = {
        fire: this.taps.fire || taps.fire,
        reload: this.taps.reload || taps.reload,
        dash: this.taps.dash || taps.dash,
      };
      this.error =
        (e as Error).name === 'AbortError'
          ? 'Connection slow. Retrying…'
          : (e as Error).message === 'busy'
            ? 'Synchronizing…'
            : (e as Error).message;
    } finally {
      clearTimeout(timeout);
    }
    if (this.running && generation === this.generation) {
      const cadence = this.state.phase === 'lobby' ? 250 : 50;
      this.timer = setTimeout(
        () => this.poll(),
        this.error ? 250 : Math.max(0, cadence - (performance.now() - began)),
      );
    }
  }
  send(input: Input) {
    this.input = input;
    if (this.mode === 'http') {
      this.taps.fire ||= input.fire;
      this.taps.reload ||= input.reload;
      this.taps.dash ||= !!input.dash;
    }
    if (this.mode === 'colyseus' && performance.now() - this.wsSentAt >= 33) {
      this.room?.send('input', input);
      this.wsSentAt = performance.now();
    }
    if (this.mode === 'solo') {
      const p = this.state.players[0];
      if (p) {
        p.input = input;
        p.seen = Date.now();
        advance(this.state, Date.now());
      }
    }
  }
  command(c: Command) {
    if (this.mode === 'solo') {
      const p = this.state.players[0];
      if (p) applyCommand(this.state, p, c);
    } else if (this.mode === 'colyseus') this.room?.send('command', c);
    else this.queue.push({ ...c, commandId: ++this.commandSeq });
  }
  leave() {
    this.running = false;
    this.generation++;
    this.controller?.abort();
    this.queue = [];
    this.input = undefined;
    this.taps = { fire: false, reload: false, dash: false };
    this.snapshots.clear();
    clearTimeout(this.timer);
    if (this.mode === 'http')
      void this.request({ code: this.code, token: this.token, action: 'leave' }).catch(() => {});
    this.room?.leave();
    this.state = createWorld();
  }
}
