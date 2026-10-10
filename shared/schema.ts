import { Schema, defineTypes } from '@colyseus/schema';
// Lightweight replicated lobby metadata; simulation frames use the shared World contract.
export class RoomSchema extends Schema {
  wave = 0;
  phase = 'lobby';
  count = 0;
}
defineTypes(RoomSchema, { wave: 'number', phase: 'string', count: 'number' });
