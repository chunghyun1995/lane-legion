// Lane Legion — game logic (no DOM). Works in browser (window.LaneCore) and Node (module.exports).
// The road is split into three lanes:
//   left  (LANE -1): troop blocks   — pass through to gain soldiers, shoot them to raise the number
//   mid   (LANE  0): monsters       — packs march down; near the line they charge the squad
//   right (LANE  1): ability crates — break them with arrows to unlock a timed special weapon
(function (root) {
  'use strict';

  const ZFAR = 56;
  const ARROW_SPEED = 34;
  const ARROW_RANGE = 44;
  const MAX_TROOPS = 999;
  const LANE_W = 2 / 3;           // road is x ∈ [-1, 1]
  const LANE_EDGE = 1 / 3;        // lane borders at ±1/3

  function rand(a, b) { return a + Math.random() * (b - a); }
  function randi(a, b) { return Math.floor(rand(a, b + 1)); }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function laneOf(x) { return x < -LANE_EDGE ? -1 : x > LANE_EDGE ? 1 : 0; }
  function laneCenter(l) { return l * LANE_W; }

  // ---------- meta progress ----------
  function defaultSave() {
    return { gold: 0, level: 1, best: 1, up: { dmg: 0, rate: 0, troops: 0, skill: 0 } };
  }
  const UPGRADES = {
    dmg:    { name: '화력',      desc: '화살 피해 +20%',        base: 40, growth: 1.55 },
    rate:   { name: '연사',      desc: '발사 속도 +12%',        base: 50, growth: 1.6 },
    troops: { name: '시작 병력', desc: '출발 병사 +3',           base: 30, growth: 1.5 },
    skill:  { name: '특수 숙련', desc: '특수 능력 지속 +1.5초',  base: 60, growth: 1.7 },
  };
  function upgradeCost(key, lvl) {
    const u = UPGRADES[key];
    return Math.round(u.base * Math.pow(u.growth, lvl || 0));
  }
  function stats(save) {
    const up = Object.assign({ dmg: 0, rate: 0, troops: 0, skill: 0 }, save.up);
    return {
      dmg: Math.pow(1.2, up.dmg),
      rate: 1.4 * Math.pow(1.12, up.rate),
      startTroops: 8 + up.troops * 3,
      skillTime: 9 + up.skill * 1.5,
    };
  }

  // ---------- special abilities ----------
  const ABILITIES = {
    fire:      { name: '화염 화살', icon: '🔥', color: '#ff7a1a' },  // damage ×2
    spread:    { name: '삼연 사격', icon: '🔱', color: '#43d1ff' },  // 3-way arrows
    pierce:    { name: '관통 화살', icon: '➶',  color: '#b98cff' },  // arrows pass through enemies
    rapid:     { name: '속사',      icon: '⚡', color: '#ffe14a' },  // fire rate ×1.8
    shield:    { name: '방패진',    icon: '🛡',  color: '#7fe08a' },  // losses halved
    lightning: { name: '낙뢰',      icon: '🌩', color: '#9fe8ff' },  // periodic strikes
  };
  const ABILITY_KEYS = Object.keys(ABILITIES);

  // ---------- difficulty curve ----------
  function hpScale(L) { return Math.pow(1.27, L - 1); }
  function levelSpeed(L) { return Math.min(5.8 * (1 + 0.045 * (L - 1)), 10.5); }

  function buildLevel(L) {
    const speed = levelSpeed(L);
    const duration = Math.min(38 + L * 3, 72);
    const events = [];
    // left lane: troop blocks
    for (let t = 1.0, i = 0; t < duration; t += rand(2.6, 3.4), i++) {
      let blk;
      const r = Math.random();
      if (i > 3 && r < 0.06) blk = { kind: 'mul', v: 2 };
      else if (i > 1 && r < 0.32) blk = { kind: 'add', v: -randi(3 + L, 6 + L * 2) };
      else blk = { kind: 'add', v: randi(1, 3 + Math.floor(L / 2) + Math.floor(i / 4)) };
      events.push({ t, type: 'block', blk });
    }
    // middle lane: monster packs
    let i = 0;
    for (let t = 3.0; t < duration; i++) {
      const big = i >= 2 && i % 3 === 2;
      events.push({ t, type: 'pack', pack: makePack(L, i, big) });
      t += (big ? 4.4 : 3.3) * clamp(1.15 - L * 0.012, 0.8, 1.15);
    }
    // right lane: ability crates
    for (let t = 4.5, k = 0; t < duration - 3; t += rand(6.0, 8.0), k++) {
      events.push({ t, type: 'crate', ability: ABILITY_KEYS[randi(0, ABILITY_KEYS.length - 1)], k });
    }
    events.push({ t: duration + 2, type: 'boss' });
    events.sort((a, b) => a.t - b.t);
    return { L, events, duration: duration + 2, speed };
  }

  function makePack(L, i, big) {
    const cols = clamp(3 + Math.floor(L / 4) + (big ? 1 : 0), 3, 5);
    const rows = clamp(3 + Math.floor(i * 0.8) + Math.floor(L / 2) + (big ? 3 : 0), 3, 24);
    const brutes = L >= 3 ? Math.min(Math.floor((L - 1) / 2) + (big ? 1 : 0), 6) : (big && L >= 2 ? 1 : 0);
    return { cols, rows, brutes };
  }

  // ---------- run ----------
  function createRun(save) {
    const st = stats(save);
    const L = save.level;
    const level = buildLevel(L);
    return {
      L, st, level, speed: level.speed,
      time: 0, nextEvent: 0,
      troops: st.startTroops,
      sx: 0, targetX: 0,
      fireAcc: 0, scroll: 0,
      arrows: [], enemies: [], blocks: [], crates: [], items: [], fx: [],
      abilities: {},          // key -> seconds left
      boltT: 0,
      boss: null, bossSpawned: false,
      goldEarned: 0, kills: 0, drainAcc: 0,
      state: 'play', shake: 0,
      peakTroops: st.startTroops,
    };
  }

  function squadRadius(n) { return clamp(0.06 * Math.sqrt(Math.max(n, 1)), 0.07, 0.3); }
  function has(run, k) { return (run.abilities[k] || 0) > 0; }

  function spawnEvent(run, ev) {
    const hs = hpScale(run.L);
    if (ev.type === 'block') {
      run.blocks.push({ z: ZFAR, kind: ev.blk.kind, v: ev.blk.v, prog: 0, flash: 0, used: false });
    } else if (ev.type === 'pack') {
      const { cols, rows, brutes } = ev.pack;
      const spacing = 0.14;
      for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
        const x = (c - (cols - 1) / 2) * spacing + rand(-0.02, 0.02);
        run.enemies.push(makeEnemy('grunt', x, ZFAR + r * 0.3, hs, run.L));
      }
      for (let k = 0; k < brutes; k++) {
        const x = (k - (brutes - 1) / 2) * 0.18;
        run.enemies.push(makeEnemy('brute', clamp(x, -0.22, 0.22), ZFAR + rows * 0.3 + 0.6 + k * 0.4, hs, run.L));
      }
    } else if (ev.type === 'crate') {
      const hp = 26 * hs * (1 + ev.k * 0.15);
      run.crates.push({ z: ZFAR, ability: ev.ability, hp, maxHp: hp, flash: 0, alive: true });
    } else if (ev.type === 'boss') {
      const hp = 300 * hs * (1 + (run.L - 1) * 0.35);
      run.boss = { type: 'boss', x: 0, z: ZFAR, r: 0.3, hp, maxHp: hp, power: 0, flash: 0, alive: true, walk: 0 };
      run.enemies.push(run.boss);
      run.bossSpawned = true;
    }
  }

  function makeEnemy(type, x, z, hs, L) {
    if (type === 'brute') {
      const hp = 14 * hs;
      return { type, x, z, r: 0.11, hp, maxHp: hp, power: 6, flash: 0, alive: true, walk: Math.random() * 6 };
    }
    const hp = 1.6 * hs;
    return { type, x, z, r: 0.05, hp, maxHp: hp, power: 1, flash: 0, alive: true, walk: Math.random() * 6 };
  }

  function addFx(run, fx) { if (run.fx.length < 320) { fx.seed = Math.random() * 1000; run.fx.push(fx); } }

  function damageEnemy(run, e, dmg) {
    e.hp -= dmg; e.flash = 1;
    if (e.type === 'boss') addFxDmg(run, e, dmg);
    if (e.hp <= 0 && e.alive) killEnemy(run, e);
  }

  function killEnemy(run, e) {
    e.alive = false;
    run.kills++;
    const g = e.type === 'boss' ? 60 + run.L * 15 : e.type === 'brute' ? 4 : 1;
    run.goldEarned += g;
    addFx(run, { kind: 'burst', x: e.x, z: e.z, t: 0, life: 0.45, big: e.type !== 'grunt', color: e.type === 'boss' ? '#ffcf3a' : '#ff5a4f' });
    if (e.type !== 'grunt') addFx(run, { kind: 'text', x: e.x, z: e.z, t: 0, life: 0.9, text: '+' + g, color: '#ffd84a' });
    if (e.type === 'boss') run.shake = 0.6;
  }

  function changeTroops(run, delta) {
    const before = run.troops;
    run.troops = clamp(Math.round(run.troops + delta), 0, MAX_TROOPS);
    run.peakTroops = Math.max(run.peakTroops, run.troops);
    return run.troops - before;
  }

  function totalDps(run) {
    const rate = run.st.rate * (has(run, 'rapid') ? 1.8 : 1);
    const dmg = run.st.dmg * (has(run, 'fire') ? 2 : 1);
    return { shots: run.troops * rate, dmg };
  }

  // ---------- update ----------
  function update(run, dt) {
    if (run.state !== 'play') { updateFx(run, dt); return; }
    const SPEED = run.speed;
    run.time += dt;
    run.scroll += SPEED * dt;
    run.shake = Math.max(0, run.shake - dt);
    for (const k in run.abilities) run.abilities[k] = Math.max(0, run.abilities[k] - dt);

    const evs = run.level.events;
    while (run.nextEvent < evs.length && evs[run.nextEvent].t <= run.time) spawnEvent(run, evs[run.nextEvent++]);

    // squad movement
    const r = squadRadius(run.troops);
    run.targetX = clamp(run.targetX, -1 + r, 1 - r);
    run.sx += (run.targetX - run.sx) * Math.min(1, dt * 14);
    run.sx = clamp(run.sx, -1 + r, 1 - r);

    // firing
    if (run.troops > 0) {
      const { shots, dmg } = totalDps(run);
      const perSec = clamp(shots, 3, 70);
      const dmgPer = shots * dmg / perSec;
      const spread = has(run, 'spread');
      const pierce = has(run, 'pierce');
      const kind = has(run, 'fire') ? 'fire' : pierce ? 'pierce' : 'normal';
      run.fireAcc += perSec * dt;
      while (run.fireAcc >= 1) {
        run.fireAcc -= 1;
        const a = Math.random() * Math.PI * 2, d = Math.sqrt(Math.random()) * r;
        const x = run.sx + Math.cos(a) * d, z = Math.sin(a) * d * 0.6 + 0.1;
        const base = { x, z, dmg: dmgPer, dist: 0, vx: 0, pierce: pierce ? 3 : 0, kind };
        run.arrows.push(base);
        if (spread) {
          run.arrows.push({ ...base, vx: -0.028 });
          run.arrows.push({ ...base, vx: 0.028 });
        }
      }
    }

    // lightning: strikes the closest enemies periodically
    if (has(run, 'lightning')) {
      run.boltT -= dt;
      if (run.boltT <= 0) {
        run.boltT = 0.55;
        const { shots, dmg } = totalDps(run);
        const strike = Math.max(4, shots * dmg * 0.4);
        const targets = run.enemies.filter(e => e.alive && e.z < 30).sort((a, b) => a.z - b.z).slice(0, 4);
        for (const e of targets) {
          damageEnemy(run, e, strike);
          addFx(run, { kind: 'bolt', x: e.x, z: e.z, t: 0, life: 0.25 });
        }
      }
    }

    // scroll blocks / crates
    for (const b of run.blocks) { b.z -= SPEED * dt; b.flash = Math.max(0, b.flash - dt * 4); }
    for (const c of run.crates) { c.z -= SPEED * dt; c.flash = Math.max(0, c.flash - dt * 6); }
    for (const it of run.items) {
      it.z -= SPEED * dt; it.t += dt;
      if (!it.alive) continue;
      if (it.z <= 0.35 + r * 0.6 && it.z > -0.6 && Math.abs(it.x - run.sx) < r + 0.2) pickItem(run, it);
      else if (it.z <= -0.6) {
        it.alive = false;
        addFx(run, { kind: 'text', x: it.x, z: 0.4, t: 0, life: 0.8, text: '놓침', color: '#c9c9c9' });
      }
    }
    run.items = run.items.filter(it => it.alive);

    // enemies
    for (const e of run.enemies) {
      if (!e.alive) continue;
      e.flash = Math.max(0, e.flash - dt * 6);
      e.walk += dt * 10;
      if (e.type === 'boss') {
        const stopZ = 0.25 + r * 0.6 + e.r;
        e.z = Math.max(stopZ, e.z - SPEED * 0.7 * dt);
        if (e.z < 8) e.x += (run.sx - e.x) * Math.min(1, dt * 0.9);
        e.x = clamp(e.x, -1 + e.r, 1 - e.r);
      } else {
        e.z -= SPEED * dt;
        if (e.z < 5) {
          // reached the line: break out of the lane and charge the squad
          const homing = e.type === 'brute' ? 1.6 : 2.4;
          const dx = run.sx - e.x;
          e.x += clamp(dx, -homing * dt, homing * dt);
        }
      }
    }

    // arrows
    const live = run.enemies.filter(e => e.alive && e.z < ARROW_RANGE + 1);
    for (const a of run.arrows) {
      const z0 = a.z, step = ARROW_SPEED * dt;
      a.z += step; a.dist += step; a.x += a.vx * step;
      if (a.dist > ARROW_RANGE || Math.abs(a.x) > 1.05) { a.dead = true; continue; }
      const lane = laneOf(a.x);
      if (lane === -1) {
        for (const b of run.blocks) {
          if (b.used || b.z < z0 || b.z > a.z) continue;
          hitBlock(run, b, a.dmg); a.dead = true; break;
        }
      } else if (lane === 1) {
        for (const c of run.crates) {
          if (!c.alive || c.z < z0 - 0.3 || c.z > a.z) continue;
          hitCrate(run, c, a.dmg); a.dead = true; break;
        }
      }
      if (a.dead) continue;
      for (const e of live) {
        if (!e.alive) continue;
        if (e.z + e.r < z0 || e.z - e.r > a.z) continue;
        if (Math.abs(a.x - e.x) > e.r + 0.03) continue;
        if (a.hitSet && a.hitSet.has(e)) continue;
        damageEnemy(run, e, a.dmg);
        if (a.pierce > 0 && e.type !== 'boss') {
          a.pierce--; (a.hitSet || (a.hitSet = new Set())).add(e);
        } else { a.dead = true; break; }
      }
    }
    run.arrows = run.arrows.filter(a => !a.dead);

    // troop blocks reaching the squad line
    for (const b of run.blocks) {
      if (b.used || b.z > 0.15) continue;
      b.used = true;
      if (run.sx - r * 0.5 < -LANE_EDGE) applyBlock(run, b);
    }
    run.blocks = run.blocks.filter(b => b.z > -3);
    run.crates = run.crates.filter(c => c.alive && c.z > -1.5);

    // contact with enemies
    const front = 0.18 + r * 0.6;
    const loss = has(run, 'shield') ? 0.5 : 1;
    for (const e of run.enemies) {
      if (!e.alive) continue;
      if (e.type === 'boss') {
        if (e.z <= 0.25 + r * 0.6 + e.r + 0.01) {
          run.drainAcc += (5 + run.L * 1.3) * dt * loss;
          if (run.drainAcc >= 1) {
            const k = Math.floor(run.drainAcc);
            run.drainAcc -= k;
            changeTroops(run, -k);
            run.shake = Math.max(run.shake, 0.15);
            addFx(run, { kind: 'text', x: run.sx + rand(-0.15, 0.15), z: 0.4, t: 0, life: 0.7, text: '-' + k, color: '#ff6b5b' });
          }
        }
        continue;
      }
      if (e.z <= front && Math.abs(e.x - run.sx) < r + e.r + 0.04) {
        e.alive = false;
        run.drainAcc += e.power * loss;
        const k = Math.floor(run.drainAcc); run.drainAcc -= k;
        const lost = -changeTroops(run, -k);
        if (lost > 0) addFx(run, { kind: 'text', x: e.x, z: 0.5, t: 0, life: 0.6, text: '-' + lost, color: '#ff6b5b' });
        addFx(run, { kind: 'burst', x: e.x, z: e.z, t: 0, life: 0.35, big: false, color: '#ff8a7a' });
        run.shake = Math.max(run.shake, e.type === 'brute' ? 0.25 : 0.06);
      } else if (e.z < -1.2) {
        // slipped past the squad — still costs troops (the line was breached)
        e.alive = false;
        run.drainAcc += e.power * loss;
        const k = Math.floor(run.drainAcc); run.drainAcc -= k;
        if (k) { changeTroops(run, -k); addFx(run, { kind: 'text', x: run.sx, z: 0.3, t: 0, life: 0.6, text: '-' + k, color: '#ff6b5b' }); }
      }
    }
    run.enemies = run.enemies.filter(e => e.alive);

    if (run.troops <= 0) run.state = 'lose';
    else if (run.bossSpawned && run.boss && !run.boss.alive && run.enemies.length === 0) {
      run.state = 'win';
      run.goldEarned += 25 + run.L * 10;
    }
    updateFx(run, dt);
  }

  function addFxDmg(run, e, dmg) {
    run._dmgAcc = (run._dmgAcc || 0) + dmg;
    if (run.time - (run._dmgT || 0) > 0.18) {
      addFx(run, { kind: 'text', x: e.x + rand(-0.25, 0.25), z: e.z + 0.3, t: 0, life: 0.7, text: fmt(run._dmgAcc), color: '#ffffff', small: true });
      run._dmgAcc = 0; run._dmgT = run.time;
    }
  }

  function hitBlock(run, b, dmg) {
    const hs = hpScale(run.L);
    b.prog += dmg; b.flash = 1;
    for (let guard = 0; guard < 50; guard++) {
      const cost = b.kind === 'mul' ? 120 * hs * b.v * b.v : 5 * hs * (1 + Math.max(b.v, 0) * 0.7) * (b.v < 0 ? 0.6 : 1);
      if (b.prog < cost) break;
      if (b.kind === 'mul' && b.v >= 3) { b.prog = 0; break; }
      b.prog -= cost; b.v += 1;
    }
  }

  function applyBlock(run, b) {
    const delta = b.kind === 'mul' ? run.troops * (b.v - 1) : b.v;
    const d = changeTroops(run, delta);
    b.flash = 1;
    addFx(run, { kind: 'text', x: run.sx, z: 0.6, t: 0, life: 1.0, text: (d >= 0 ? '+' : '') + d, color: d >= 0 ? '#7fd3ff' : '#ff6b5b', big: true });
    if (d > 0) addFx(run, { kind: 'ring', x: run.sx, z: 0.1, t: 0, life: 0.5, color: '#7fd3ff' });
  }

  function hitCrate(run, c, dmg) {
    c.hp -= dmg; c.flash = 1;
    if (c.hp <= 0 && c.alive) {
      c.alive = false;
      const ab = ABILITIES[c.ability];
      // the crate breaks open and drops an item the squad has to run over
      run.items.push({ x: laneCenter(1), z: Math.max(c.z, 1.5), ability: c.ability, t: 0, alive: true });
      addFx(run, { kind: 'debris', x: laneCenter(1), z: c.z, t: 0, life: 0.8 });
      addFx(run, { kind: 'burst', x: laneCenter(1), z: c.z, t: 0, life: 0.5, big: true, color: ab.color });
    }
  }

  function pickItem(run, it) {
    it.alive = false;
    const ab = ABILITIES[it.ability];
    run.abilities[it.ability] = (run.abilities[it.ability] || 0) + run.st.skillTime;
    addFx(run, { kind: 'ring', x: run.sx, z: 0.1, t: 0, life: 0.6, color: ab.color });
    addFx(run, { kind: 'banner', t: 0, life: 1.6, text: ab.icon + ' ' + ab.name, color: ab.color });
  }

  function updateFx(run, dt) {
    for (const f of run.fx) f.t += dt;
    run.fx = run.fx.filter(f => f.t < f.life);
  }

  function progress(run) { return clamp(run.time / run.level.duration, 0, 1); }

  function fmt(n) {
    n = Math.round(n);
    if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
    if (n >= 1e4) return (n / 1e3).toFixed(1) + 'K';
    return String(n);
  }

  const api = {
    ZFAR, LANE_EDGE, LANE_W, UPGRADES, ABILITIES, defaultSave, upgradeCost, stats, createRun, update,
    squadRadius, progress, fmt, buildLevel, levelSpeed, laneOf, laneCenter,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.LaneCore = api;
})(typeof window !== 'undefined' ? window : globalThis);
