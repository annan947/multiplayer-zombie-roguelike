import { Room, Client } from '@colyseus/core';
import { RoomSchema } from '../../shared/schema';
import { createWorld, createPlayer, advance, applyCommand } from '../../shared/simulation';
import { cleanInput } from '../authority';
import type { Input, Command } from '../../shared/types';
export class SurvivalRoom extends Room<RoomSchema> {
  world = createWorld();
  maxClients = 4;
  private frames = 0;
  onCreate() {
    this.roomId = crypto.randomUUID().slice(0, 6).toUpperCase();
    this.setState(new RoomSchema());
    this.setPatchRate(100);
    this.onMessage('input', (c: Client, input: Partial<Input>) => {
      const p = this.world.players.find((p) => p.id === c.sessionId);
      if (p) {
        p.input = cleanInput(input);
        p.seen = Date.now();
        p.connected = true;
      }
    });
    this.onMessage('command', (c: Client, command: Command) => {
      const p = this.world.players.find((p) => p.id === c.sessionId);
      if (p) applyCommand(this.world, p, command);
      if (this.world.phase === 'combat') void this.lock();
    });
    this.setSimulationInterval(() => {
      advance(this.world, Date.now());
      this.state.wave = this.world.wave;
      this.state.phase = this.world.phase;
      this.state.count = this.world.players.length;
      if (++this.frames % 2 === 0) this.broadcast('world', this.world);
    }, 1000 / 30);
  }
  onJoin(client: Client, options: { name?: string }) {
    if (this.world.phase !== 'lobby') throw new Error('Match already started');
    this.world.players.push(createPlayer(client.sessionId, String(options.name || 'Survivor')));
    client.send('world', this.world);
  }
  async onLeave(client: Client, consented: boolean) {
    const p = this.world.players.find((p) => p.id === client.sessionId);
    if (!p) return;
    p.connected = false;
    p.input = cleanInput({});
    try {
      if (consented) throw new Error('left');
      await this.allowReconnection(client, 30);
      p.connected = true;
      p.seen = Date.now();
    } catch {
      if (this.world.phase === 'lobby')
        this.world.players = this.world.players.filter((q) => q !== p);
      else p.hp = 0;
      const host = this.world.players.findIndex((q) => q.connected);
      if (host > 0) this.world.players.unshift(this.world.players.splice(host, 1)[0]);
    }
  }
}
