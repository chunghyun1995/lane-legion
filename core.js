// Lane Legion — game logic (no DOM). Works in browser (window.LaneCore) and Node (module.exports).
(function (root) {
  'use strict';

  const ZFAR = 56;          // spawn distance
  const SPEED = 5;          // world scroll speed (units/s)
  const ARROW_SPEED = 32;
  const ARROW_RANGE = 42;
  const MAX_TROOPS = 999;

  function rand(a, b) { return a + Math.random() * (b - a); }
  function randi(a, b) { return Math.floor(rand(a, b + 1)); }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }

  // ---------- persistent meta progress ----------
  function defaultSave() {
    return { gold: 0, level: 1, best: 1, up: { dmg: 0, rate: 0, troops: 0 } };
  }

  const UPGRADES = {
    dmg:    { name: '화력',      desc: '화살 피해 +20%',   base: 40, growth: 1.55 },
    rate:   { name: '연사',      desc: '발사 속도 +12%',   base: 50, growth: 1.6 },
    troops: { name: '시작 병력', desc: '출발 병사 +3',      base: 30, growth: 1.5 },
  };
  function upgradeCost(key, lvl) {
    const u = UPGRADES[key];
    return Math.round(u.base * Math.pow(u.growth, lvl));
  }

  function stats(save) {
    return {
      dmg: 1 * Math.pow(1.2, save.up.dmg),
      rate: 1.4 * Math.pow(1.12, save.up.rate),     // shots per soldier per second
      startTroops: 8 + save.up.troops * 3,
    };
  }

  // ---------- level generation ----------
  function hpScale(L) { return Math.pow(1.2, L - 1); }

  function buildLevel(L) {
    const events = [];
    let t = 1.5;
    const segments = Math.min(5 + Math.floor(L / 2), 11);
    for (let i = 0; i < segments; i++) {
      // gates first so the squad can grow before the first pack
      events.push({ t, type: 'gates', pair: makeGatePair(L, i) });
      t += 3.2;
      const big = i >= 2 && i % 3 === 2;
      events.push({ t, type: 'pack', pack: makePack(L, i, big) });
      t += big ? 4.6 : 3.6;
    }
    t += 2;
    events.push({ t, type: 'boss' });
    return { L, events, duration: t };
  }

  function makeGatePair(L, i) {
    const good = () => {
      if (i > 0 && Math.random() < 0.12) return { kind: 'mul', v: 2 };
      return { kind: 'add', v: randi(4, 8 + L * 2 + i * 2) };
    };
    const bad = () => {
      if (Math.random() < 0.25) return { kind: 'add', v: randi(1, 3) };          // weak positive
      return { kind: 'add', v: -randi(3 + L, 8 + L * 2 + i) };
    };
    let a = good(), b = Math.random() < 0.65 ? bad() : good();
    if (Math.random() < 0.5) { const tmp = a; a = b; b = tmp; }
    return [a, b];
  }

  function makePack(L, i, big) {
    const cols = clamp(4 + Math.floor(L / 3) + (big ? 2 : 0), 4, 10);
    const rows = clamp(2 + i + Math.floor(L / 3) + (big ? 2 : 0), 2, 16);
    const brutes = L >= 3 ? Math.min(Math.floor((L - 1) / 2) + (big ? 1 : 0), 6) : (big && L >= 2 ? 1 : 0);
    return { cols, rows, brutes };
  }

  // ---------- run state ----------
  function createRun(save) {
    const st = stats(save);
    const L = save.level;
    return {
      L, st,
      level: buildLevel(L),
      time: 0,
      nextEvent: 0,
      troops: st.startTroops,
      sx: 0,                  // squad x (world, -1..1)
      targetX: 0,
      fireAcc: 0,
      scroll: 0,
      arrows: [],
      enemies: [],
      gates: [],
      fx: [],                 // floating texts / particles (consumed by renderer)
      boss: null,
      bossSpawned: false,
      goldEarned: 0,
      kills: 0,
      drainAcc: 0,
      state: 'play',          // play | win | lose
      shake: 0,
      peakTroops: st.startTroops,
    };
  }

  function squadRadius(n) { return clamp(0.07 * Math.sqrt(Math.max(n, 1)), 0.08, 0.62); }

  function spawnEvent(run, ev) {
    const hs = hpScale(run.L);
    if (ev.type === 'gates') {
      const [a, b] = ev.pair;
      const id = Math.random();
      run.gates.push({ side: -1, z: ZFAR, ...a, prog: 0, pair: id, used: false, flash: 0 });
      run.gates.push({ side: 1, z: ZFAR, ...b, prog: 0, pair: id, used: false, flash: 0 });
    } else if (ev.type === 'pack') {
      const { cols, rows, brutes } = ev.pack;
      const cx = rand(-0.45, 0.45);
      const spacing = 0.15;
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const x = clamp(cx + (c - (cols - 1) / 2) * spacing + rand(-0.02, 0.02), -0.92, 0.92);
          run.enemies.push(makeEnemy('grunt', x, ZFAR + r * 0.32, hs));
        }
      }
      for (let k = 0; k < brutes; k++) {
        const x = clamp(cx + (k - (brutes - 1) / 2) * 0.35, -0.8, 0.8);
        run.enemies.push(makeEnemy('brute', x, ZFAR + rows * 0.32 + 0.6, hs));
      }
    } else if (ev.type === 'boss') {
      const hp = 260 * hs * (1 + (run.L - 1) * 0.35);
      run.boss = { type: 'boss', x: 0, z: ZFAR, r: 0.34, hp, maxHp: hp, power: 0, flash: 0, alive: true, walk: 0 };
      run.enemies.push(run.boss);
      run.bossSpawned = true;
    }
  }

  function makeEnemy(type, x, z, hs) {
    if (type === 'brute') {
      const hp = 14 * hs;
      return { type, x, z, r: 0.12, hp, maxHp: hp, power: 6, flash: 0, alive: true, walk: Math.random() * 6 };
    }
    const hp = 1.6 * hs;
    return { type, x, z, r: 0.05, hp, maxHp: hp, power: 1, flash: 0, alive: true, walk: Math.random() * 6 };
  }

  function addFx(run, fx) { if (run.fx.length < 300) run.fx.push(fx); }

  function killEnemy(run, e) {
    e.alive = false;
    run.kills++;
    const g = e.type === 'boss' ? 60 + run.L * 15 : e.type === 'brute' ? 4 : 1;
    run.goldEarned += g;
    addFx(run, { kind: 'burst', x: e.x, z: e.z, t: 0, life: 0.45, big: e.type !== 'grunt', color: e.type === 'boss' ? '#ffcf3a' : '#ff5a4f' });
    if (e.type !== 'grunt') addFx(run, { kind: 'text', x: e.x, z: e.z, t: 0, life: 0.9, text: '+' + g, color: '#ffd84a' });
    if (e.type === 'boss') run.shake = 0.6;
  }

  function changeTroops(run, delta, x, z) {
    const before = run.troops;
    run.troops = clamp(Math.round(run.troops + delta), 0, MAX_TROOPS);
    run.peakTroops = Math.max(run.peakTroops, run.troops);
    return run.troops - before;
  }

  // ---------- main update ----------
  function update(run, dt) {
    if (run.state !== 'play') { updateFx(run, dt); return; }
    run.time += dt;
    run.scroll += SPEED * dt;
    run.shake = Math.max(0, run.shake - dt);

    // events
    const evs = run.level.events;
    while (run.nextEvent < evs.length && evs[run.nextEvent].t <= run.time) {
      spawnEvent(run, evs[run.nextEvent]);
      run.nextEvent++;
    }

    // squad movement (smoothed)
    const r = squadRadius(run.troops);
    run.targetX = clamp(run.targetX, -1 + r, 1 - r);
    run.sx += (run.targetX - run.sx) * Math.min(1, dt * 14);
    run.sx = clamp(run.sx, -1 + r, 1 - r);

    // firing
    const n = run.troops;
    if (n > 0) {
      const totalShots = n * run.st.rate;                 // shots/s if every soldier fired
      const arrowsPerSec = clamp(totalShots, 3, 70);
      const dmgPer = (totalShots * run.st.dmg) / arrowsPerSec;
      run.fireAcc += arrowsPerSec * dt;
      while (run.fireAcc >= 1) {
        run.fireAcc -= 1;
        const a = Math.random() * Math.PI * 2, d = Math.sqrt(Math.random()) * r;
        run.arrows.push({ x: run.sx + Math.cos(a) * d, z: Math.sin(a) * d * 0.6 + 0.1, dmg: dmgPer, dist: 0 });
      }
    }

    // move gates
    for (const g of run.gates) {
      g.z -= SPEED * dt;
      g.flash = Math.max(0, g.flash - dt * 4);
    }

    // move enemies
    for (const e of run.enemies) {
      if (!e.alive) continue;
      e.flash = Math.max(0, e.flash - dt * 6);
      e.walk += dt * 10;
      if (e.type === 'boss') {
        const stopZ = 0.25 + r * 0.6 + e.r;
        e.z = Math.max(stopZ, e.z - SPEED * 0.75 * dt);
        e.x += (run.sx - e.x) * Math.min(1, dt * 0.8);
        e.x = clamp(e.x, -1 + e.r, 1 - e.r);
      } else {
        e.z -= SPEED * dt;
        if (e.z < 22) {
          const homing = e.type === 'brute' ? 0.35 : 0.55;
          const dx = run.sx - e.x;
          e.x += clamp(dx, -homing * dt, homing * dt);
        }
      }
    }

    // arrows: movement + collision
    const front = [];
    for (const e of run.enemies) if (e.alive && e.z < ARROW_RANGE + 1) front.push(e);
    for (const a of run.arrows) {
      const z0 = a.z;
      const step = ARROW_SPEED * dt;
      a.z += step; a.dist += step;
      if (a.dist > ARROW_RANGE) { a.dead = true; continue; }
      // gates block arrows and grow
      for (const g of run.gates) {
        if (g.used) continue;
        if (g.z >= z0 && g.z <= a.z && Math.sign(a.x || 1e-6) === g.side && Math.abs(a.x) > 0.03) {
          hitGate(run, g, a.dmg);
          a.dead = true; break;
        }
      }
      if (a.dead) continue;
      for (const e of front) {
        if (!e.alive) continue;
        if (e.z + e.r < z0 || e.z - e.r > a.z) continue;
        if (Math.abs(a.x - e.x) > e.r + 0.03) continue;
        e.hp -= a.dmg; e.flash = 1;
        if (e.type === 'boss') addFxDmg(run, e, a.dmg);
        if (e.hp <= 0) killEnemy(run, e);
        a.dead = true; break;
      }
    }
    run.arrows = run.arrows.filter(a => !a.dead);

    // gates passing the squad
    for (const g of run.gates) {
      if (g.used || g.z > 0.15) continue;
      const pairGates = run.gates.filter(o => o.pair === g.pair);
      const side = run.sx < 0 ? -1 : 1;
      const chosen = pairGates.find(o => o.side === side);
      for (const o of pairGates) o.used = true;
      if (chosen) applyGate(run, chosen);
    }
    run.gates = run.gates.filter(g => g.z > -3);

    // enemy contact
    const front2 = 0.18 + r * 0.6;
    for (const e of run.enemies) {
      if (!e.alive) continue;
      if (e.type === 'boss') {
        if (e.z <= 0.25 + r * 0.6 + e.r + 0.01) {
          run.drainAcc += (5 + run.L * 1.2) * dt;
          if (run.drainAcc >= 1) {
            const k = Math.floor(run.drainAcc);
            run.drainAcc -= k;
            changeTroops(run, -k);
            run.shake = Math.max(run.shake, 0.15);
            addFx(run, { kind: 'text', x: run.sx + rand(-0.2, 0.2), z: 0.4, t: 0, life: 0.7, text: '-' + k, color: '#ff6b5b' });
          }
        }
        continue;
      }
      if (e.z <= front2 && e.z > -1.5 && Math.abs(e.x - run.sx) < r + e.r) {
        e.alive = false;
        const lost = -changeTroops(run, -e.power);
        if (lost > 0) addFx(run, { kind: 'text', x: e.x, z: 0.5, t: 0, life: 0.6, text: '-' + lost, color: '#ff6b5b' });
        addFx(run, { kind: 'burst', x: e.x, z: e.z, t: 0, life: 0.35, big: false, color: '#ff8a7a' });
        run.shake = Math.max(run.shake, e.type === 'brute' ? 0.25 : 0.06);
      } else if (e.z < -1.5) {
        e.alive = false; // slipped past (only possible on screen edge)
      }
    }
    run.enemies = run.enemies.filter(e => e.alive);

    if (run.troops <= 0) { run.state = 'lose'; }
    else if (run.bossSpawned && run.boss && !run.boss.alive && run.enemies.length === 0) {
      run.state = 'win';
      run.goldEarned += 25 + run.L * 10;
    }
    updateFx(run, dt);
  }

  function addFxDmg(run, e, dmg) {
    run._dmgAcc = (run._dmgAcc || 0) + dmg;
    run._dmgT = (run._dmgT || 0);
    if (run.time - run._dmgT > 0.18) {
      addFx(run, { kind: 'text', x: e.x + rand(-0.25, 0.25), z: e.z + 0.3, t: 0, life: 0.7, text: fmt(run._dmgAcc), color: '#ffffff', small: true });
      run._dmgAcc = 0; run._dmgT = run.time;
    }
  }

  function hitGate(run, g, dmg) {
    const hs = hpScale(run.L);
    g.prog += dmg;
    g.flash = 1;
    for (let guard = 0; guard < 50; guard++) {
      // each +1 costs more the bigger the gate already is (keeps gate-farming from snowballing)
      const cost = g.kind === 'mul'
        ? 90 * hs * g.v * g.v
        : 3 * hs * (1 + Math.max(g.v, 0) * 0.45) * (g.v < 0 ? 0.6 : 1);
      if (g.prog < cost) break;
      if (g.kind === 'mul' && g.v >= 3) { g.prog = 0; break; }
      g.prog -= cost;
      g.v += 1;
    }
  }

  function applyGate(run, g) {
    let delta;
    if (g.kind === 'mul') delta = run.troops * (g.v - 1);
    else delta = g.v;
    const d = changeTroops(run, delta);
    g.flash = 1;
    addFx(run, { kind: 'text', x: run.sx, z: 0.6, t: 0, life: 1.0, text: (d >= 0 ? '+' : '') + d, color: d >= 0 ? '#7fd3ff' : '#ff6b5b', big: true });
    if (d > 0) addFx(run, { kind: 'ring', x: run.sx, z: 0.1, t: 0, life: 0.5, color: '#7fd3ff' });
  }

  function updateFx(run, dt) {
    for (const f of run.fx) f.t += dt;
    run.fx = run.fx.filter(f => f.t < f.life);
  }

  function progress(run) {
    return clamp(run.time / run.level.duration, 0, 1);
  }

  function fmt(n) {
    n = Math.round(n);
    if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
    if (n >= 1e4) return (n / 1e3).toFixed(1) + 'K';
    return String(n);
  }

  const api = {
    ZFAR, SPEED, UPGRADES, defaultSave, upgradeCost, stats, createRun, update, squadRadius, progress, fmt, buildLevel,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.LaneCore = api;
})(typeof window !== 'undefined' ? window : globalThis);
