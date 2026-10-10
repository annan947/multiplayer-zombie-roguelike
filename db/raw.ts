import {env} from 'cloudflare:workers';
export function database(){if(!env.DB)throw new Error('Multiplayer unavailable');return env.DB}
