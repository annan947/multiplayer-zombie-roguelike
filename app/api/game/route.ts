import { database } from '../../../db/raw';
import {
  tokenHash,
  cleanInput,
  advance,
  applyCommand,
  createPlayer,
  createWorld,
  World,
  RequestBody,
} from '../../../server/authority';
export async function POST(req: Request) {
  try {
    const b = (await req.json()) as RequestBody,
      db = database();
    if (b.action === 'create') {
      const code = crypto.randomUUID().slice(0, 6).toUpperCase(),
        token = crypto.randomUUID(),
        self = await tokenHash(token),
        s = createWorld();
      s.players.push(createPlayer(self, String(b.name || 'Survivor')));
      await db
        .prepare('INSERT INTO rooms (code,state,version,updated) VALUES (?,?,0,?)')
        .bind(code, JSON.stringify(s), Date.now())
        .run();
      return Response.json({ code, token, self, state: s });
    }
    const code = String(b.code || '').toUpperCase();
    if (!/^[A-Z0-9]{6}$/.test(code))
      return Response.json({ error: 'Enter a six-character room code.' }, { status: 400 });
    for (let attempt = 0; attempt < 6; attempt++) {
      const row = await db
        .prepare('SELECT state,version FROM rooms WHERE code=?')
        .bind(code)
        .first<{ state: string; version: number }>();
      if (!row) return Response.json({ error: 'Room not found.' }, { status: 404 });
      const s: World = JSON.parse(row.state);
      if (s.v !== 3)
        return Response.json(
          { error: 'This room is from an older version. Create a new room.' },
          { status: 410 },
        );
      let token = b.token || '',
        self = await tokenHash(token),
        p = s.players.find((p) => p.id === self);
      if (b.action === 'join') {
        if (s.phase !== 'lobby')
          return Response.json(
            { error: 'Match underway. Reconnect from your original tab.' },
            { status: 409 },
          );
        s.players = s.players.filter((p) => Date.now() - p.seen < 30000);
        if (s.players.length >= 4) return Response.json({ error: 'Room full.' }, { status: 409 });
        token = crypto.randomUUID();
        self = await tokenHash(token);
        p = createPlayer(self, String(b.name || 'Survivor'));
        s.players.push(p);
      }
      if (!p)
        return Response.json(
          { error: 'Session expired. Please create or join a room.' },
          { status: 403 },
        );
      p.seen = Date.now();
      p.connected = true;
      if (b.input && (b.input.seq || 0) > p.input.seq) p.input = cleanInput(b.input);
      advance(s, Date.now());
      if (b.action === 'leave') {
        p.connected = false;
        p.seen = 0;
        p.input = cleanInput({});
      } else if (b.action === 'poll' || b.action === 'join') {
        // Heartbeats carry input without replaying a gameplay command.
      } else if (!b.commandId || b.commandId > (p.lastCommand || 0)) {
        applyCommand(s, p, b);
        // Starting a run replaces Player objects, so acknowledge on the current instance.
        const current = s.players.find((q) => q.id === self);
        if (current && b.commandId) current.lastCommand = b.commandId;
      }
      if (s.players[0] && !s.players[0].connected) {
        const active = s.players.findIndex((q) => q.connected);
        if (active > 0) s.players.unshift(s.players.splice(active, 1)[0]);
      }
      const r = await db
        .prepare('UPDATE rooms SET state=?,version=version+1,updated=? WHERE code=? AND version=?')
        .bind(JSON.stringify(s), Date.now(), code, row.version)
        .run();
      if (r.meta.changes) return Response.json({ code, token, self, state: s });
    }
    return Response.json({ error: 'busy' }, { status: 409 });
  } catch (e) {
    console.error(e);
    return Response.json({ error: 'Connection interrupted. Retrying…' }, { status: 503 });
  }
}
