# DEADZONE: After Dark

A top-down zombie survival game for **1–4 players**, built with TypeScript, Phaser 3, and React. Survive 30 escalating waves, earn money, open loot chests, and combine passive items while fighting across a large ruined city district.

**[Play the live game](https://annan947-deadzone.annan-sharif2245.chatgpt.site)**
<img width="1677" height="923" alt="image" src="https://github.com/user-attachments/assets/cf60fd5f-d109-4083-aea4-d43faeb81de9" />

<img width="1780" height="927" alt="image" src="https://github.com/user-attachments/assets/d7855f4a-0c50-48d5-ac7e-5a8ac25ead40" />



## Features

- **Solo and online co-op:** room codes, ready-up, host controls, teammate revives, and end-of-run stats.
- **30 waves:** walkers, runners, charging tanks, ranged spitters, self-destructing exploders, and bosses every fifth wave.
- **Four weapons:** pistol, shotgun, SMG, and rifle, with distinct sprites, firing patterns, reloads, and recorded gun sounds.
- **Loot and builds:** 20 paid chests across the map, 14 stackable passive items, and five rarity tiers.
- **Varied item effects:** bleed, ricochets, poison spread, rechargeable shields, reload shockwaves, conditional healing, and three-kill fire-rate bursts.
- **Between-wave purchases:** weapons, upgrades, barricades, and turrets.
- **Atmosphere and feedback:** ambient music, zombie vocals, muzzle flashes, shell casings, hit flashes, blood decals, damage numbers, and screen shake.
- **Desktop controls:** keyboard/mouse and gamepad, adjustable audio, remappable action keys, minimap, and responsive canvas scaling.

## Technology

| Area | Implementation |
| --- | --- |
| Game client | Phaser 3.90, TypeScript |
| Menus and HUD | React 19, CSS |
| Standalone frontend | Vite |
| Dedicated multiplayer | Colyseus, Node.js, WebSockets |
| Hosted version | Vinext / Cloudflare Worker, authoritative HTTP API, D1 |
| Shared gameplay | TypeScript simulation, types, schemas, JSON balance configuration |
| Navigation | Shared reverse-BFS flow fields and collision checks |
| Audio | Howler.js with locally included audio files |

## Run locally

Use **Node.js 22.13 or newer** and **pnpm 11.25.0**. Run commands from the repository root.

```bash
npm install -g pnpm@11.25.0
pnpm install --frozen-lockfile
```

Copy `.env.example` to `.env`. The example already sets the standalone client's server URL to `ws://localhost:2567`.

**Windows PowerShell:**

```powershell
Copy-Item .env.example .env
```

**macOS / Linux:**

```bash
cp .env.example .env
```

Start the multiplayer server:

```bash
pnpm server:dev
```

In a second terminal, start the client:

```bash
pnpm client:dev
```

Open **http://localhost:5173**. Solo runs locally; co-op uses the dedicated server on port **2567**. The server health endpoint is `http://localhost:2567/health`.

### Host a co-op game

1. Enter your player name and select **HOST CO-OP GAME**.
2. Share the **ROOM CODE** and game address with your friends.
3. Friends enter the code and select **JOIN**.
4. Players ready up; the host starts the match.

For local testing, use separate browser tabs. Friends on other computers need a reachable server address; `localhost` refers to their own computer. For online play, use the live game or deploy the server and client as described below.

## Controls

| Action | Keyboard / mouse |
| --- | --- |
| Move | WASD |
| Aim | Mouse |
| Fire | Left mouse button / Space |
| Reload | R |
| Dash | Shift |
| Open nearby chest / revive | E; hold to revive |
| Shop | B |
| Equip weapon | 1–4 |
| Settings | Escape |

**Gamepad:** left stick moves, right stick aims, RT fires, X reloads, A interacts, and B dashes. Audio starts after a menu interaction. Volume, keybinds, and screen-shake preferences are saved on the device.

## Loot and progression

Kills and wave clears award money. Chests cost **$75 + $18 per completed wave** and replenish each wave. A chest can be opened once for the squad; the opener receives its item. Items last for the current run, with up to four effective stacks.

| Rarity | Drop chance |
| --- | ---: |
| Common | 58% |
| Uncommon | 27% |
| Rare | 11% |
| Epic | 3.5% |
| Legendary | 0.5% |

Legendary items include **Prismatic Heart**, which chains shots between enemies, and **Plague Crown**, which spreads poison. Later waves increase enemy counts, health, damage, and the proportion of special enemies.

## Project structure

| Path | Purpose |
| --- | --- |
| `client/src/scenes/` | Asset loading and gameplay scenes |
| `client/src/systems/` | Networking, interpolation, audio, settings, world rendering |
| `client/src/GameShell.tsx` | Menu, lobby, HUD, inventory, shop, settings |
| `shared/simulation.ts` | Shared authoritative game simulation |
| `shared/enemyAbilities.ts` | Charges, explosions, ranged abilities |
| `shared/items.ts` | Item definitions and rarity |
| `shared/config/` | Enemy, weapon, wave, and ability balance |
| `shared/map.ts` | World geometry and collision |
| `server/src/` | Dedicated Colyseus server and room lifecycle |
| `server/authority.ts` | Input validation and commands |
| `app/api/game/` | Hosted HTTP multiplayer backend |
| `public/assets/` | Character, weapon, and item artwork |
| `public/audio/` | Sound effects, music, and credits |
| `public/maps/` | Tiled-compatible district map |

The map JSON is Tiled-compatible, but runtime collision geometry is defined in `shared/map.ts`; update both when changing the level layout.

## Multiplayer architecture

Both networking paths use the shared authoritative simulation. Servers control enemy behavior, spawns, purchases, damage, and game state. The client predicts local movement and dashes, corrects its position against snapshots, and interpolates remote actors. Local firing effects play immediately; the server decides hits and damage.

**Dedicated Colyseus:** runs a 30 Hz simulation with 15 Hz snapshots, caps client input messages at 30 Hz, and allows a 30-second reconnection window. Rooms live in memory on one server process.

**Live hosted version:** currently uses HTTP requests and D1 optimistic updates. It targets a 50 ms request cadence while keeping one request in flight. Snapshot buffering, bounded extrapolation, retained short button taps, stale-response rejection, and deduplicated commands improve responsiveness. Request round trips and database contention can still add latency.

## Build and checks

```bash
pnpm typecheck
pnpm lint:game
pnpm format:check
pnpm client:build
```

`format:check` reports formatting differences; `pnpm format` applies formatting. The standalone production client is written to `client/dist`. The root `pnpm build` is for the original Sites/Worker hosting integration, not a static GitHub Pages build.

TypeScript, targeted lint, production builds, simulation checks, and mocked transport checks were used during development. Live multi-client latency and consistent 60 FPS across devices have not been established. The development-only ad hoc test scripts are not included as a maintained test suite.

## Deployment

### Dedicated multiplayer server

The included `server/Dockerfile` starts the Colyseus server. It listens on `PORT`, defaulting to `2567`. Deploy it to a Node/container host with WebSocket support, such as Fly.io or Colyseus Cloud.

For Fly.io, use the repository root as the build context, change the application name in `server/fly.toml` to your own unique name, and deploy with that configuration. For a Node service, install dependencies and use `pnpm server:start` as the start command.

Keep one server instance running. Multiple replicas require additional shared presence, matchmaking, and room routing; these are not configured in this version. Restarting the server loses in-memory matches.

### Standalone frontend

For a static host such as Netlify or Vercel, use:

| Setting | Value |
| --- | --- |
| Project root | Repository root |
| Build command | `pnpm client:build` |
| Output directory | `client/dist` |
| Build-time environment variable | `VITE_COLYSEUS_URL=wss://YOUR-SERVER-HOST` |

Use a secure WebSocket endpoint with an HTTPS frontend. Rebuild after changing the URL. A static frontend without a reachable dedicated backend can play solo but cannot host co-op rooms.

**Uploading this repository to GitHub does not deploy the multiplayer server.** GitHub Pages can serve a built client, but it cannot run the Node server or the hosted HTTP/D1 backend. A Pages project subpath also requires adapting Vite's base and the game's absolute asset URLs.

The original Sites deployment can opt into a dedicated server through `NEXT_PUBLIC_COLYSEUS_URL`; otherwise it uses its built-in HTTP backend. The included hosting integration is retained for completeness, but its existing infrastructure is not recreated by cloning this repository.

## Assets and credits

Character and item artwork was AI-generated and assembled for this project. It is pixel-style artwork, rather than a strict 16×16, fixed-palette sprite set. Some animation and hit/death feedback are applied in-engine.

Audio includes recorded firearm sounds, zombie vocals, reload and interface effects, an explosion, and the **EmptyCity** ambient track. Source credits, CC0 license information, and processing notes are in **[public/audio/CREDITS.txt](public/audio/CREDITS.txt)**. The old synthesized soundtrack is no longer used.

Development was assisted by OpenAI Codex. Third-party packages and bundled vendor files retain their own licenses. No blanket open-source license has been assigned to this project's code; add a license deliberately if you want to grant reuse rights.

## Current limitations

- Desktop browsers are the primary target; there is no complete mobile touch-control scheme.
- Refreshing the page starts a new session rather than restoring the previous match.
- The city is fixed, not procedurally generated.
- Remote latency still depends on the chosen hosting and transport.
- The optional dedicated WebSocket deployment requires a separate server host.

## V7 fixes

Zombie navigation uses clearance-aware flow fields with collision-checked steering around corners. Bosses use their own collision radius without sharing mutable waypoints. Spitters continue moving when walls block the player. Sprite crops follow the actual atlas rows, fixing clipped tank heads and neighboring-row pixels. Navigation passed 71 building/car route checks for standard and boss collision sizes. Live browser visual verification remains outstanding.
