import { createServer } from 'node:http';
import { Server } from '@colyseus/core';
import { WebSocketTransport } from '@colyseus/ws-transport';
import { SurvivalRoom } from './SurvivalRoom';
const http = createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end('{"ok":true}');
  }
});
const server = new Server({ transport: new WebSocketTransport({ server: http }), greet: false });
server.define('survival', SurvivalRoom);
await server.listen(Number(process.env.PORT || 2567), '0.0.0.0');
console.log('DEADZONE authoritative server ready');
