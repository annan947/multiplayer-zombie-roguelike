'use client';
/* eslint-disable react-hooks/refs -- Phaser is an imperative external engine; ref access occurs only in lifecycle callbacks and event handlers. */
import { ItemIcon } from './ItemIcon';
import { useEffect, useRef, useState } from 'react';
import type Phaser from 'phaser';
import { Transport } from './systems/transport';
import { AudioSystem } from './systems/audio';
import { loadSettings, saveSettings, defaults, Settings } from './systems/settings';
import type { Bridge } from './systems/bridge';
import { createWorld, weapons, waves } from '../../shared/simulation';
import type { World } from '../../shared/types';
import { items, itemById, tiers, maxHealth, maxShield } from '../../shared/items';
const clone = (s: World) => ({ ...s, players: s.players.map((p) => ({ ...p })) });
function WeaponArt({ gun }: { gun: number }) {
  return <span className={'weapon-art gun-' + gun} aria-hidden="true" />;
}
export default function GameShell() {
  const host = useRef<HTMLDivElement>(null),
    bridge = useRef<Bridge | null>(null);
  const [world, setWorld] = useState<World>(createWorld()),
    [settings, setSettings] = useState<Settings>(defaults),
    [mode, setMode] = useState<'menu' | 'solo' | 'online'>('menu'),
    [loaded, setLoaded] = useState(false),
    [name, setName] = useState(''),
    [room, setRoom] = useState(''),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [panel, setPanel] = useState<'shop' | 'settings' | 'tutorial' | 'items' | null>(null),
    [tab, setTab] = useState('weapons'),
    [self, setSelf] = useState(''),
    [roomCode, setRoomCode] = useState(''),
    [copied, setCopied] = useState(false);
  useEffect(() => {
    let game: Phaser.Game | undefined,
      cancelled = false;
    const prefs = loadSettings(),
      transport = new Transport(),
      audio = new AudioSystem(prefs);
    const b: Bridge = {
      transport,
      audio,
      settings: prefs,
      running: false,
      tutorial: false,
      pausedInput: false,
      onHud: (s) => {
        setWorld(clone(s));
        if (transport.error) setError(transport.error);
        else setError('');
      },
      onShop: () => {
        audio.play('ui');
        setPanel((p) => (p === 'shop' ? null : 'shop'));
      },
      onSettings: () => setPanel((p) => (p === 'settings' ? null : 'settings')),
      onLoaded: () => setLoaded(true),
    };
    bridge.current = b;
    import('./game')
      .then(({ mountGame }) => {
        setSettings(prefs);
        if (!cancelled && host.current) game = mountGame(host.current, b);
      })
      .catch((e) => setError('Could not load game: ' + e.message));
    return () => {
      cancelled = true;
      game?.destroy(true);
      transport.leave();
      audio.destroy();
    };
  }, []);
  useEffect(() => {
    if (bridge.current) {
      bridge.current.settings = settings;
      bridge.current.audio.settings = settings;
      bridge.current.pausedInput = panel !== null;
      saveSettings(settings);
    }
  }, [settings, panel]);
  async function begin(kind: 'solo' | 'create' | 'join') {
    const b = bridge.current;
    if (!b) return;
    setBusy(true);
    setError('');
    try {
      await b.audio.unlock();
      b.audio.play('ui');
      if (kind === 'solo') b.transport.solo(name || 'Survivor');
      else
        await b.transport.connect(
          name || 'Survivor',
          kind === 'join' ? room : undefined,
          process.env.NEXT_PUBLIC_COLYSEUS_URL,
        );
      b.running = true;
      setSelf(b.transport.self);
      setRoomCode(b.transport.code);
      setMode(kind === 'solo' ? 'solo' : 'online');
      setWorld(clone(b.transport.state));
      if (!localStorage.getItem('deadzone-loot-tutorial')) setPanel('tutorial');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  function command(action: string, extra: Record<string, unknown> = {}) {
    bridge.current?.audio.play('ui');
    bridge.current?.transport.command({ action, ...extra });
  }
  function leave() {
    if (bridge.current) {
      bridge.current.running = false;
      bridge.current.transport.leave();
    }
    setMode('menu');
    setPanel(null);
    setWorld(createWorld());
    setError('');
  }
  const p = world.players.find((p) => p.id === self),
    lobby = mode !== 'menu' && world.phase === 'lobby',
    ended = mode !== 'menu' && ['won', 'lost'].includes(world.phase),
    hostPlayer = world.players[0]?.id === self,
    playing = mode !== 'menu' && !lobby && !ended;
  return (
    <main className="game-app">
      <header className="topbar">
        <button onClick={leave} className="wordmark">
          DEAD<span>ZONE</span>
          <small>AFTER DARK</small>
        </button>
        <div className="top-meta">
          <span>SECTOR 07 / THE LOST DISTRICT</span>
          <button onClick={() => setPanel('settings')} aria-label="Open settings">
            ⚙ SETTINGS
          </button>
        </div>
      </header>
      <div className="game-stage">
        <div className="phaser-host" ref={host} />
        {!loaded && (
          <div className="loading">
            <span>DEADZONE</span>
            <p>Loading the district…</p>
          </div>
        )}
        {mode === 'menu' && loaded && (
          <div className="title-screen">
            <div className="title-content">
              <div className="overline">
                <i /> TRANSMISSION 007 · 23:41
              </div>
              <h1>
                DEAD<span>ZONE</span>
              </h1>
              <h2>AFTER DARK</h2>
              <p>
                The city is gone.
                <br />
                Scavenge. Stack items. Survive.
              </p>
              <div className="menu-controls">
                <label htmlFor="callsign">CALLSIGN</label>
                <input
                  id="callsign"
                  maxLength={16}
                  value={name}
                  placeholder="Enter your name"
                  onChange={(e) => setName(e.target.value)}
                />
                <button
                  className="primary"
                  disabled={!loaded || busy}
                  onClick={() => begin('solo')}
                >
                  SURVIVE SOLO <span>01</span>
                </button>
                <button disabled={!loaded || busy} onClick={() => begin('create')}>
                  HOST CO-OP GAME <span>GET A CODE</span>
                </button>
                <div className="join-row">
                  <input
                    value={room}
                    onChange={(e) => setRoom(e.target.value.toUpperCase())}
                    maxLength={9}
                    placeholder="Enter host’s room code"
                    aria-label="Room code"
                  />
                  <button disabled={busy || room.length < 6} onClick={() => begin('join')}>
                    JOIN
                  </button>
                </div>
              </div>
              <div className="menu-foot">
                <span>30 WAVES</span>
                <span>6 ENEMY TYPES</span>
                <span>LEGENDARY LOOT</span>
              </div>
            </div>
            <div className="title-character" aria-hidden="true" />
            <div className="version">CO-OP SURVIVAL / V6</div>
          </div>
        )}
        {playing && p && (
          <>
            <div className="hud-top">
              <div className="wave-display">
                <label>WAVE</label>
                <b>
                  {String(world.wave).padStart(2, '0')}
                  <small> / {waves.total}</small>
                </b>
                <span>
                  {world.phase === 'break'
                    ? 'RESUPPLY'
                    : `${world.left + world.enemies.length} HOSTILES`}
                </span>
              </div>
              <button className="inventory-summary" onClick={() => setPanel('items')}>
                <span>PASSIVE ITEMS</span>
                <b>{Object.values(p.items).reduce((a, b) => a + b, 0)}</b>
                <small>VIEW YOUR BUILD</small>
              </button>
            </div>
            {(p.items.trigger || 0) > 0 && (
              <div className={'frenzy-status ' + ((p.frenzy || 0) > 0 ? 'active' : '')}>
                {(p.frenzy || 0) > 0
                  ? `OVERDRIVE · ${Math.ceil(p.frenzy!)}s · +35% FIRE RATE`
                  : `OVERDRIVE · ${p.streak || 0}/3 KILLS`}
              </div>
            )}
            <div className="item-strip" aria-label="Acquired passive items">
              {items
                .filter((item) => (p.items[item.id] || 0) > 0)
                .map((item) => (
                  <button
                    key={item.id}
                    onClick={() => setPanel('items')}
                    title={`${item.name} ×${p.items[item.id]} — ${item.description}`}
                    style={{ borderColor: tiers.find((tier) => tier.id === item.tier)!.color }}
                  >
                    <ItemIcon id={item.id} />
                    <small>×{p.items[item.id]}</small>
                  </button>
                ))}
            </div>
            <div className="hud-bottom">
              <div className="vitals">
                <label>{p.name}</label>
                <div className="vital-number">
                  <b>{Math.ceil(p.hp)}</b>
                  <span> / {maxHealth(p)} HP</span>
                </div>
                <div className="meter">
                  <i style={{ width: (p.hp / maxHealth(p)) * 100 + '%' }} />
                </div>
                {maxShield(p) > 0 && (
                  <>
                    <div className="meter shield-meter">
                      <i style={{ width: `${((p.shield || 0) / maxShield(p)) * 100}%` }} />
                    </div>
                    <small className="shield-label">
                      {Math.ceil(p.shield || 0)} / {maxShield(p)} SHIELD
                    </small>
                  </>
                )}
                <small>SHIFT · DASH</small>
              </div>
              <div className="weapon-hud">
                <WeaponArt gun={p.gun} />
                <div>
                  <label>{weapons[p.gun].name}</label>
                  <b>
                    {p.reload > 0 ? 'RELOADING' : String(p.ammo).padStart(2, '0')}
                    <small> / {weapons[p.gun].clip}</small>
                  </b>
                  <span>R RELOAD · 1–4 SWITCH</span>
                </div>
              </div>
              <button className="scrap-button" onClick={() => setPanel('shop')}>
                <label>MONEY</label>
                <b>${p.scrap}</b>
                <small>B · SUPPLY SHOP</small>
              </button>
            </div>
            <div className="teammates">
              {world.players
                .filter((q) => q.id !== self)
                .map((q, i) => (
                  <div key={q.id}>
                    <i style={{ background: ['#80bfdf', '#df95bc', '#e7bb72'][i] }} />
                    <span>{q.name}</span>
                    <b>{!q.connected ? 'OFFLINE' : q.hp <= 0 ? 'DOWN' : Math.ceil(q.hp) + ' HP'}</b>
                  </div>
                ))}
            </div>
            {world.phase === 'break' && (
              <div className="resupply">
                <b>WAVE CLEARED</b>
                <span>Next wave in {Math.ceil(world.timer)}s</span>
                <button onClick={() => setPanel('shop')}>OPEN SHOP · B</button>
                {hostPlayer && <button onClick={() => command('next')}>READY FOR NEXT WAVE</button>}
              </div>
            )}
            {p.hp <= 0 && (
              <div className="down-prompt">
                YOU’RE DOWN <small>Teammates: hold E nearby for 2 seconds to revive</small>
              </div>
            )}
          </>
        )}
        {lobby && (
          <div className="overlay">
            <div className="dialog lobby">
              <div className="overline">
                {hostPlayer ? 'YOU ARE HOSTING' : 'CO-OP LOBBY'} · {world.players.length}/4 PLAYERS
              </div>
              <h2>
                ROOM CODE: <em>{roomCode || '______'}</em>
              </h2>
              <p>
                {hostPlayer
                  ? 'Your room is open. Send your friends this game’s link and the room code below.'
                  : 'You joined the room. Click READY UP so the host can start.'}
              </p>
              <button
                className="copy-room"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(
                      `Join my DEADZONE game: ${window.location.origin} — ROOM CODE: ${roomCode}`,
                    );
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2500);
                  } catch {
                    setCopied(false);
                  }
                }}
              >
                {copied ? 'INVITE COPIED' : 'COPY ROOM INVITE'}
              </button>
              <ol className="coop-steps">
                <li>Friends open the game link.</li>
                <li>
                  Enter <strong>{roomCode}</strong> on the main menu and click <strong>JOIN</strong>
                  .
                </li>
                <li>
                  Everyone clicks <strong>READY UP</strong>, then the host clicks{' '}
                  <strong>START SURVIVAL</strong>.
                </li>
              </ol>
              <div className="lobby-slots">
                {Array.from({ length: 4 }, (_, i) => {
                  const q = world.players[i];
                  return (
                    <div key={i}>
                      <span>0{i + 1}</span>
                      <b>{q?.name || 'Waiting for survivor…'}</b>
                      <small>
                        {!q ? 'EMPTY' : i === 0 ? 'HOST' : q.ready ? 'READY' : 'NOT READY'}
                      </small>
                    </div>
                  );
                })}
              </div>
              {hostPlayer ? (
                <button
                  className="primary"
                  disabled={world.players.some((q) => q.id !== self && !q.ready && q.connected)}
                  onClick={() => command('start')}
                >
                  START SURVIVAL
                </button>
              ) : (
                <button className="primary" onClick={() => command('ready')}>
                  {p?.ready ? 'NOT READY' : 'READY UP'}
                </button>
              )}
              <button onClick={leave}>LEAVE ROOM</button>
            </div>
          </div>
        )}
        {ended && (
          <div className="overlay">
            <div className="dialog results">
              <div className="overline">
                {world.phase === 'won' ? 'SIGNAL RECEIVED' : 'TRANSMISSION ENDED'}
              </div>
              <h2>{world.phase === 'won' ? 'EXTRACTED.' : 'SQUAD LOST.'}</h2>
              <p>Every run leaves a story. Your items reset when you start a new run.</p>
              <div className="result-grid">
                <div>
                  <b>{world.wave}</b>
                  <label>WAVES REACHED</label>
                </div>
                <div>
                  <b>{world.players.reduce((n, p) => n + p.kills, 0)}</b>
                  <label>ELIMINATIONS</label>
                </div>
                <div>
                  <b>
                    {Math.floor(world.elapsed / 60)}:
                    {String(Math.floor(world.elapsed % 60)).padStart(2, '0')}
                  </b>
                  <label>TIME SURVIVED</label>
                </div>
              </div>
              {world.players.map((p) => (
                <div className="result-player" key={p.id}>
                  <span>{p.name}</span>
                  <b>{p.kills} kills</b>
                  <span>{p.shots} shots</span>
                </div>
              ))}
              {hostPlayer && (
                <button className="primary" onClick={() => command('start')}>
                  RUN IT BACK
                </button>
              )}
              <button onClick={leave}>MAIN MENU</button>
            </div>
          </div>
        )}
        {playing &&
          p?.lastLoot &&
          world.time - p.lastLoot.at < 2000 &&
          (() => {
            const item = itemById(p.lastLoot!.id),
              tier = tiers.find((t) => t.id === item.tier)!;
            return (
              <div className="loot-toast" style={{ borderColor: tier.color }}>
                <ItemIcon id={item.id} />
                <span style={{ color: tier.color }}>{tier.name.toUpperCase()} ITEM ACQUIRED</span>
                <h3>
                  {item.name} <small>×{p.items[item.id]}</small>
                </h3>
                <p>{item.description}</p>
              </div>
            );
          })()}
        {panel === 'items' && (
          <div className="overlay">
            <div className="dialog inventory">
              <div className="dialog-top">
                <div>
                  <div className="overline">PASSIVE INVENTORY</div>
                  <h2>YOUR BUILD</h2>
                </div>
                <button onClick={() => setPanel(null)}>✕</button>
              </div>
              <p>
                Items stack up to 4 effective copies and last until the run ends. Buy chests with
                money earned from kills. Unopened chests are yellow on the minimap.
              </p>
              <div className="rarity-odds">
                {tiers.map((t) => (
                  <span key={t.id} style={{ color: t.color }}>
                    {t.name} {t.chance}%
                  </span>
                ))}
              </div>
              <div className="inventory-grid">
                {items
                  .filter((i) => (p?.items[i.id] || 0) > 0)
                  .map((i) => {
                    const tier = tiers.find((t) => t.id === i.tier)!;
                    return (
                      <div key={i.id} className="passive-card" style={{ borderColor: tier.color }}>
                        <div>
                          <ItemIcon id={i.id} />
                          <span>
                            {i.name}
                            <small style={{ color: tier.color }}>
                              {tier.name} · ×{p?.items[i.id]}
                            </small>
                          </span>
                        </div>
                        <p>{i.description}</p>
                      </div>
                    );
                  })}
              </div>
              {!Object.keys(p?.items || {}).length && (
                <p className="empty-items">
                  No items yet. Find a chest, earn $75, and press E beside it to start your build.
                </p>
              )}
              <button className="primary" onClick={() => setPanel(null)}>
                RETURN TO RUN
              </button>
            </div>
          </div>
        )}
        {panel === 'shop' && (
          <div className="overlay">
            <div className="dialog shop">
              <div className="dialog-top">
                <div>
                  <div className="overline">FIELD SUPPLIES</div>
                  <h2>MAKE IT COUNT.</h2>
                </div>
                <button onClick={() => setPanel(null)} aria-label="Close shop">
                  ✕
                </button>
              </div>
              <p className="shop-note">
                {world.phase === 'break'
                  ? `${Math.ceil(world.timer)}s until next wave · ${p?.scrap || 0} cash available`
                  : 'Weapons and defenses unlock between waves. Medkits are always available.'}
              </p>
              <div className="tabs">
                {['weapons', 'defenses', 'upgrades'].map((t) => (
                  <button className={tab === t ? 'selected' : ''} key={t} onClick={() => setTab(t)}>
                    {t.toUpperCase()}
                  </button>
                ))}
              </div>
              <div className="shop-grid">
                {tab === 'weapons' &&
                  weapons.map((w, i) => (
                    <div className="item" key={w.name}>
                      <WeaponArt gun={i} />
                      <label>{w.label}</label>
                      <h3>{w.name}</h3>
                      <p>
                        {w.damage} DMG × {w.pellets} · {w.clip} ROUNDS
                        <br />
                        {w.reload}s RELOAD
                      </p>
                      <button
                        disabled={
                          !p ||
                          (!p.owned.includes(i) && (world.phase !== 'break' || p.scrap < w.cost))
                        }
                        onClick={() => command(p?.owned.includes(i) ? 'equip' : 'buy', { gun: i })}
                      >
                        {p?.gun === i
                          ? 'EQUIPPED'
                          : p?.owned.includes(i)
                            ? 'EQUIP'
                            : `BUY · ${w.cost} CASH`}
                      </button>
                    </div>
                  ))}
                {tab === 'defenses' &&
                  [
                    {
                      name: 'BARRICADE',
                      kind: 'barricade',
                      cost: 90,
                      desc: '450 HP. Zombies must break through. Place in front of you.',
                    },
                    {
                      name: 'SENTRY TURRET',
                      kind: 'turret',
                      cost: 260,
                      desc: 'Automatic fire within 380px. Cover a street or protect your team.',
                    },
                  ].map((item) => (
                    <div className="item" key={item.kind}>
                      <h3>{item.name}</h3>
                      <p>{item.desc}</p>
                      <button
                        disabled={!p || world.phase !== 'break' || p.scrap < item.cost}
                        onClick={() => command('build', { kind: item.kind })}
                      >
                        PLACE · {item.cost} CASH
                      </button>
                    </div>
                  ))}
                {tab === 'upgrades' && (
                  <>
                    <div className="item">
                      <h3>STOPPING POWER</h3>
                      <p>
                        +22% weapon damage per level.
                        <br />
                        Level {p?.upgrade || 0} / 4
                      </p>
                      <button
                        disabled={
                          !p ||
                          p.upgrade >= 4 ||
                          world.phase !== 'break' ||
                          p.scrap < 150 * (p.upgrade + 1)
                        }
                        onClick={() => command('upgrade')}
                      >
                        UPGRADE · {150 * ((p?.upgrade || 0) + 1)}
                      </button>
                    </div>
                    <div className="item">
                      <h3>FIELD MEDKIT</h3>
                      <p>
                        Restore 60 HP.
                        <br />
                        Usable during combat.
                      </p>
                      <button
                        disabled={!p || p.hp <= 0 || p.hp >= maxHealth(p) || p.scrap < 80}
                        onClick={() => command('heal')}
                      >
                        HEAL · 80 CASH
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        )}
        {panel === 'settings' && (
          <div className="overlay">
            <div className="dialog settings">
              <div className="dialog-top">
                <h2>SETTINGS</h2>
                <button onClick={() => setPanel(null)}>✕</button>
              </div>
              <p>
                Recorded weapon sounds · Dark ambient soundtrack
                <br />
                <a href="/audio/CREDITS.txt" target="_blank" rel="noreferrer">
                  Audio credits &amp; licenses
                </a>
              </p>
              {(['master', 'music', 'sfx'] as const).map((k) => (
                <label className="slider" key={k}>
                  <span>{k.toUpperCase()} VOLUME</span>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step=".05"
                    value={settings[k]}
                    onChange={(e) => setSettings({ ...settings, [k]: Number(e.target.value) })}
                  />
                  <b>{Math.round(settings[k] * 100)}%</b>
                </label>
              ))}
              <label className="check">
                <input
                  type="checkbox"
                  checked={settings.shake}
                  onChange={(e) => setSettings({ ...settings, shake: e.target.checked })}
                />{' '}
                SCREEN SHAKE
              </label>
              <div className="keybinds">
                {Object.entries(settings.keys).map(([action, key]) => (
                  <label key={action}>
                    <span>{action.toUpperCase()}</span>
                    <input
                      aria-label={action + ' key'}
                      value={key}
                      readOnly
                      onKeyDown={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setSettings({
                          ...settings,
                          keys: {
                            ...settings.keys,
                            [action]:
                              (
                                {
                                  ' ': 'SPACE',
                                  ArrowUp: 'UP',
                                  ArrowDown: 'DOWN',
                                  ArrowLeft: 'LEFT',
                                  ArrowRight: 'RIGHT',
                                  Control: 'CTRL',
                                  Escape: 'ESC',
                                } as Record<string, string>
                              )[e.key] || e.key.toUpperCase(),
                          },
                        });
                      }}
                    />
                  </label>
                ))}
              </div>
              <p>
                Click a key field, then press a replacement key.
                <br />
                Gamepad: left stick move · right stick aim · RT shoot · X reload · A revive · B dash
              </p>
              <button
                className="primary"
                onClick={() => {
                  void bridge.current?.audio.unlock();
                  setPanel(null);
                }}
              >
                SAVE & RETURN
              </button>
              {mode !== 'menu' && <button onClick={leave}>LEAVE MATCH</button>}
            </div>
          </div>
        )}
        {panel === 'tutorial' && (
          <div className="overlay">
            <div className="dialog tutorial">
              <div className="overline">SURVIVOR FIELD MANUAL</div>
              <h2>SCAVENGE. STACK. SURVIVE.</h2>
              <div className="tutorial-grid">
                <p>
                  <b>01 / MOVE & FIGHT</b>WASD to move. Mouse to aim and fire. R reloads. Shift
                  dashes.
                </p>
                <p>
                  <b>02 / LOOT THE DISTRICT</b>Kill zombies for money. Press E near a chest to buy a
                  random passive item. Yellow minimap squares mark unopened chests.
                </p>
                <p>
                  <b>03 / BUILD YOUR RUN</b>Items stack and last the whole run. Chests refill each
                  wave. B opens the weapon shop; 1–4 switch guns. Survive 30 escalating waves.
                </p>
                <p>
                  <b>04 / STAY TOGETHER</b>Hold E near a downed teammate for two seconds. Bosses
                  arrive every five waves.
                </p>
              </div>
              <button
                className="primary"
                onClick={() => {
                  localStorage.setItem('deadzone-loot-tutorial', '1');
                  setPanel(null);
                }}
              >
                I’M READY
              </button>
            </div>
          </div>
        )}
        {error && (
          <div className="connection-error" role="alert">
            {error}
          </div>
        )}
      </div>
      <footer>
        <span>
          WASD MOVE <b>·</b> MOUSE AIM / FIRE <b>·</b> R RELOAD <b>·</b> E OPEN / REVIVE <b>·</b>{' '}
          SHIFT DASH
        </span>
        <button onClick={() => setPanel('tutorial')}>HOW TO PLAY</button>
        <span>{mode === 'online' ? `ROOM ${roomCode}` : '1–4 PLAYER SURVIVAL'}</span>
      </footer>
    </main>
  );
}
