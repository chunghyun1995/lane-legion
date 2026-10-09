// Lane Legion — rendering, input and UI
(function () {
  'use strict';
  const C = window.LaneCore;
  const W = 420, H = 760;
  const HOR = 60, BASE = 640, RW = 176, D = 11, CX = W / 2;

  const canvas = document.getElementById('c');
  const ctx = canvas.getContext('2d');
  let dpr = 1;
  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    const rect = canvas.getBoundingClientRect();
    canvas.width = Math.round(rect.width * dpr);
    canvas.height = Math.round(rect.height * dpr);
  }
  window.addEventListener('resize', resize);

  // ---------- save ----------
  const KEY = 'laneLegionSave.v1';
  function load() {
    try {
      const s = JSON.parse(localStorage.getItem(KEY));
      if (s && s.up) { const d = C.defaultSave(); return Object.assign(d, s, { up: Object.assign(d.up, s.up) }); }
    } catch (e) {}
    return C.defaultSave();
  }
  function persist() { try { localStorage.setItem(KEY, JSON.stringify(save)); } catch (e) {} }
  let save = load();

  // ---------- projection ----------
  function sc(z) { return D / (D + z); }
  function px(x, z) { return CX + x * RW * sc(z); }
  function py(z) { return HOR + (BASE - HOR) * sc(z); }

  // ---------- state ----------
  let run = null;
  let mode = 'menu'; // menu | play | pause | result
  let last = performance.now();

  // ---------- input ----------
  const keys = {};
  let drag = null;
  canvas.addEventListener('pointerdown', e => {
    if (mode !== 'play') return;
    drag = { x: e.clientX, id: e.pointerId };
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener('pointermove', e => {
    if (!drag || drag.id !== e.pointerId || !run) return;
    const rect = canvas.getBoundingClientRect();
    const dxWorld = (e.clientX - drag.x) * (W / rect.width) / RW * 1.15;
    run.targetX += dxWorld;
    drag.x = e.clientX;
  });
  const endDrag = e => { if (drag && drag.id === e.pointerId) drag = null; };
  canvas.addEventListener('pointerup', endDrag);
  canvas.addEventListener('pointercancel', endDrag);
  window.addEventListener('keydown', e => {
    keys[e.key.toLowerCase()] = true;
    if ((e.key === 'Escape' || e.key === 'p') && (mode === 'play' || mode === 'pause')) togglePause();
    if (e.key === 'Enter' || e.key === ' ') {
      if (mode === 'menu') startRun();
      else if (mode === 'result') document.getElementById('nextBtn').click();
    }
  });
  window.addEventListener('keyup', e => { keys[e.key.toLowerCase()] = false; });
  document.addEventListener('visibilitychange', () => { if (document.hidden && mode === 'play') togglePause(); });

  // ---------- UI ----------
  const $ = id => document.getElementById(id);
  const ICONS = { dmg: '🏹', rate: '⚡', troops: '🛡️', skill: '✨' };
  function renderUps() {
    document.querySelectorAll('[data-ups]').forEach(box => {
      let html = `<div class="ups-head"><span>업그레이드</span><span class="gold">● ${C.fmt(save.gold)}</span></div>`;
      for (const k of Object.keys(C.UPGRADES)) {
        const u = C.UPGRADES[k], lv = save.up[k], cost = C.upgradeCost(k, lv);
        html += `<div class="up"><div class="ic">${ICONS[k]}</div><div class="tx"><b>${u.name} Lv.${lv + 1}</b><small>${u.desc}</small></div>
          <button data-buy="${k}" ${save.gold < cost ? 'disabled' : ''}>● ${C.fmt(cost)}</button></div>`;
      }
      box.innerHTML = html;
    });
  }
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-buy]');
    if (!b) return;
    const k = b.dataset.buy, cost = C.upgradeCost(k, save.up[k]);
    if (save.gold >= cost) { save.gold -= cost; save.up[k]++; persist(); renderUps(); }
  });
  function showOverlay(id) {
    ['menu', 'result', 'pause'].forEach(o => $(o).classList.toggle('show', o === id));
    $('pauseBtn').style.display = id ? 'none' : 'block';
  }
  function refreshMenu() {
    $('startBtn').textContent = save.level > 1 ? `스테이지 ${save.level} 출격` : '출격';
    renderUps();
  }
  function startRun() {
    run = C.createRun(save);
    mode = 'play';
    showOverlay(null);
  }
  function endRun() {
    const won = run.state === 'win';
    save.gold += run.goldEarned;
    if (won) { save.level++; save.best = Math.max(save.best, save.level); }
    persist();
    $('resTitle').textContent = won ? '승리!' : '패배…';
    $('resTitle').className = 'big-result ' + (won ? 'win' : 'lose');
    $('resSub').textContent = won ? `스테이지 ${run.L} 클리어` : `스테이지 ${run.L} · 업그레이드 후 다시 도전하세요`;
    $('resGold').textContent = '+' + C.fmt(run.goldEarned);
    $('resKills').textContent = C.fmt(run.kills);
    $('resPeak').textContent = C.fmt(run.peakTroops);
    $('nextBtn').textContent = won ? `스테이지 ${save.level} 출격` : '다시 도전';
    renderUps();
    mode = 'result';
    showOverlay('result');
  }
  function togglePause() {
    if (mode === 'play') { mode = 'pause'; showOverlay('pause'); }
    else if (mode === 'pause') { mode = 'play'; showOverlay(null); last = performance.now(); }
  }
  $('startBtn').onclick = startRun;
  $('nextBtn').onclick = startRun;
  $('homeBtn').onclick = () => { mode = 'menu'; run = null; refreshMenu(); showOverlay('menu'); };
  $('pauseBtn').onclick = togglePause;
  $('resumeBtn').onclick = togglePause;
  $('quitBtn').onclick = () => { run.state = 'lose'; endRun(); };

  // ---------- drawing helpers ----------
  function shadow(x, z, r) {
    const s = sc(z);
    ctx.fillStyle = 'rgba(40,30,20,.22)';
    ctx.beginPath();
    ctx.ellipse(px(x, z), py(z), r * RW * s * 1.1, r * RW * s * 0.45, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawUnit(x, z, r, body, dark, helm, bob, flash) {
    const s = sc(z);
    const R = r * RW * s;
    if (R < 0.6) return;
    const X = px(x, z), Y = py(z) - R * 1.1 - bob * R * 0.25;
    // body
    ctx.fillStyle = flash ? '#fff' : body;
    ctx.beginPath(); ctx.ellipse(X, Y, R, R * 1.05, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = flash ? '#fff' : dark;
    ctx.beginPath(); ctx.ellipse(X, Y + R * 0.35, R * 0.95, R * 0.6, 0, 0, Math.PI); ctx.fill();
    // head/helmet
    ctx.fillStyle = flash ? '#fff' : helm;
    ctx.beginPath(); ctx.arc(X, Y - R * 0.95, R * 0.62, 0, Math.PI * 2); ctx.fill();
    if (R > 3) {
      ctx.fillStyle = 'rgba(255,255,255,.35)';
      ctx.beginPath(); ctx.arc(X - R * 0.2, Y - R * 1.15, R * 0.2, 0, Math.PI * 2); ctx.fill();
    }
  }

  // ---------- scene ----------
  function drawWorld() {
    // water / sky
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#7cc6ff'); g.addColorStop(0.12, '#3d93e8'); g.addColorStop(1, '#1f67c4');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    // water sparkle
    ctx.fillStyle = 'rgba(255,255,255,.18)';
    const t = performance.now() / 1000;
    for (let i = 0; i < 28; i++) {
      const zz = ((i * 7.3 + (run ? run.scroll : t * 3)) % 60);
      const z = 60 - zz;
      const side = i % 2 ? 1 : -1;
      const x = side * (1.6 + (i * 0.37 % 1.8));
      const s = sc(z);
      ctx.fillRect(px(x, z), py(z), 14 * s, 2 * s + 0.5);
    }

    const zN = -2.5, zF = C.ZFAR + 4;
    // walls (outer stone ledges)
    for (const side of [-1, 1]) {
      ctx.fillStyle = '#c9b89a';
      quad(side * 1.0, side * 1.3, zN, zF);
      ctx.fillStyle = '#e8dcc4';
      quad(side * 1.05, side * 1.22, zN, zF);
    }
    // road
    const rg = ctx.createLinearGradient(0, py(zF), 0, H);
    rg.addColorStop(0, '#cdbd9f'); rg.addColorStop(1, '#e9dcc3');
    ctx.fillStyle = rg; quad(-1, 1, zN, zF);

    // tiles
    const off = run ? run.scroll % 1.6 : (t * 3) % 1.6;
    ctx.strokeStyle = 'rgba(120,100,70,.28)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let z = -off - 1.6; z < zF; z += 1.6) {
      if (z < zN) continue;
      ctx.moveTo(px(-1, z), py(z)); ctx.lineTo(px(1, z), py(z));
    }
    for (const x of [-0.83, -0.5, -0.17, 0.17, 0.5, 0.83]) {
      ctx.moveTo(px(x, zN), py(zN)); ctx.lineTo(px(x, zF), py(zF));
    }
    ctx.stroke();
    // lane tints: troops (blue) | monsters (red) | abilities (gold)
    const E = C.LANE_EDGE;
    ctx.fillStyle = 'rgba(70,150,255,.20)'; quad(-1, -E, zN, zF);
    ctx.fillStyle = 'rgba(224,57,47,.07)'; quad(-E, E, zN, zF);
    ctx.fillStyle = 'rgba(255,190,40,.12)'; quad(E, 1, zN, zF);
    // lane dividers: low stone curbs
    for (const x of [-E, E]) {
      ctx.fillStyle = '#b9a684'; quad(x - 0.025, x + 0.025, zN, zF);
      ctx.fillStyle = '#f3ead7'; quad(x - 0.012, x + 0.012, zN, zF);
    }
    // lane signs near the squad line
    if (!run || run.time < 4) {
      const a = run ? Math.max(0, 1 - run.time / 4) : 1;
      ctx.globalAlpha = a * 0.9;
      ctx.font = "15px 'Black Han Sans', sans-serif"; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      [['병력', -C.LANE_W, '#1a4fa6'], ['몬스터', 0, '#9e1d17'], ['특수능력', C.LANE_W, '#9a6a00']].forEach(([t, x, c]) => {
        ctx.fillStyle = c; ctx.fillText(t, px(x, 3), py(3));
      });
      ctx.globalAlpha = 1;
    }

    // banners on walls
    const boff = run ? run.scroll % 6 : (t * 3) % 6;
    for (let z = zF - boff; z > zN; z -= 6) {
      for (const side of [-1, 1]) {
        const s = sc(z);
        const X = px(side * 1.14, z), Y = py(z);
        ctx.fillStyle = '#7a6a52';
        ctx.fillRect(X - 1.2 * s, Y - 60 * s, 2.4 * s + 0.4, 60 * s);
        ctx.fillStyle = '#2d7ff0';
        ctx.beginPath();
        ctx.moveTo(X, Y - 60 * s); ctx.lineTo(X - side * 26 * s, Y - 54 * s); ctx.lineTo(X, Y - 42 * s);
        ctx.fill();
      }
    }
  }
  function quad(x0, x1, z0, z1) {
    ctx.beginPath();
    ctx.moveTo(px(x0, z0), py(z0)); ctx.lineTo(px(x1, z0), py(z0));
    ctx.lineTo(px(x1, z1), py(z1)); ctx.lineTo(px(x0, z1), py(z1));
    ctx.closePath(); ctx.fill();
  }

  function drawBlock(b) {
    if (b.z < -2.5 || b.z > C.ZFAR + 2) return;
    const s = sc(b.z);
    const Y = py(b.z), h = 0.5 * RW * s;
    const L = px(-0.96, b.z), Rr = px(-0.38, b.z);
    const positive = b.kind === 'mul' || b.v > 0;
    const col = b.kind === 'mul' ? [255, 196, 40] : positive ? [45, 140, 255] : [230, 60, 50];
    const a = b.used ? 0.22 : 0.88;
    // block body with a lighter top face
    const top = 10 * s;
    ctx.fillStyle = `rgba(${col[0] * 0.55 | 0},${col[1] * 0.55 | 0},${col[2] * 0.55 | 0},${a})`;
    ctx.fillRect(L, Y - h, Rr - L, h);
    ctx.fillStyle = `rgba(${col[0]},${col[1]},${col[2]},${a})`;
    ctx.fillRect(L, Y - h - top * 0.2, Rr - L, h - top * 0.6);
    if (b.flash > 0) { ctx.fillStyle = `rgba(255,255,255,${b.flash * 0.35})`; ctx.fillRect(L, Y - h, Rr - L, h); }
    ctx.strokeStyle = `rgba(255,255,255,${b.used ? 0.25 : 0.9})`;
    ctx.lineWidth = Math.max(1, 2.5 * s);
    ctx.strokeRect(L, Y - h - top * 0.2, Rr - L, h - top * 0.6);
    const txt = b.kind === 'mul' ? '×' + b.v : (b.v > 0 ? '+' : '') + b.v;
    label(txt, (L + Rr) / 2, Y - h * 0.55, Math.max(8, 54 * s * (1 + b.flash * 0.12)));
  }

  function drawCrate(c) {
    if (c.z > C.ZFAR + 2) return;
    const s = sc(c.z);
    const ab = C.ABILITIES[c.ability];
    const X = px(C.LANE_W, c.z), Y = py(c.z);
    const w = 0.5 * RW * s, h = 0.48 * RW * s;
    const shake = c.flash > 0 ? (Math.random() - 0.5) * 3 * s : 0;
    // wooden crate
    ctx.fillStyle = '#8a5a2b'; ctx.fillRect(X - w / 2 + shake, Y - h, w, h);
    ctx.fillStyle = '#b07a3f'; ctx.fillRect(X - w / 2 + 3 * s + shake, Y - h + 3 * s, w - 6 * s, h - 6 * s);
    ctx.strokeStyle = '#6b4320'; ctx.lineWidth = Math.max(1, 3 * s);
    ctx.beginPath();
    ctx.moveTo(X - w / 2 + shake, Y - h); ctx.lineTo(X + w / 2 + shake, Y);
    ctx.moveTo(X + w / 2 + shake, Y - h); ctx.lineTo(X - w / 2 + shake, Y);
    ctx.stroke();
    // ability badge
    const br = Math.max(4, 15 * s);
    ctx.fillStyle = ab.color;
    ctx.beginPath(); ctx.arc(X + shake, Y - h * 0.55, br, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#fff'; ctx.lineWidth = Math.max(1, 2 * s); ctx.stroke();
    ctx.font = `${br * 1.15}px sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = '#fff'; ctx.fillText(ab.icon, X + shake, Y - h * 0.55 + br * 0.05);
    // hp bar + name
    const bw = w * 1.05;
    ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.fillRect(X - bw / 2, Y - h - 12 * s, bw, Math.max(2, 6 * s));
    ctx.fillStyle = ab.color; ctx.fillRect(X - bw / 2, Y - h - 12 * s, bw * Math.max(0, c.hp / c.maxHp), Math.max(2, 6 * s));
    if (s > 0.35) label(ab.name, X, Y - h - 24 * s, 15 * s * 1.3);
  }

  function label(txt, x, y, fs) {
    ctx.font = `${fs}px 'Black Han Sans', sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.lineWidth = Math.max(2, fs * 0.14);
    ctx.strokeStyle = 'rgba(10,20,40,.75)';
    ctx.strokeText(txt, x, y);
    ctx.fillStyle = '#fff';
    ctx.fillText(txt, x, y);
  }

  function drawEnemy(e) {
    if (e.z > C.ZFAR + 6) return;
    shadow(e.x, e.z, e.r);
    const bob = Math.abs(Math.sin(e.walk));
    if (e.type === 'grunt') drawUnit(e.x, e.z, e.r, '#e3392e', '#a51f18', '#b8231b', bob, e.flash > 0.5);
    else if (e.type === 'brute') {
      drawUnit(e.x, e.z, e.r, '#c42a22', '#7d1510', '#8a1a14', bob * 0.6, e.flash > 0.5);
      hpBar(e);
    } else {
      // boss
      const s = sc(e.z), R = e.r * RW * s;
      const X = px(e.x, e.z), Y = py(e.z) - R * 1.2 - bob * 3 * s;
      ctx.fillStyle = e.flash > 0.5 ? '#fff' : '#9e1d17';
      ctx.beginPath(); ctx.ellipse(X, Y, R * 1.05, R, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = e.flash > 0.5 ? '#fff' : '#d8382d';
      ctx.beginPath(); ctx.ellipse(X, Y + R * 0.15, R * 0.75, R * 0.7, 0, 0, Math.PI * 2); ctx.fill();
      // shoulders
      ctx.fillStyle = '#5d0f0b';
      ctx.beginPath(); ctx.arc(X - R * 0.95, Y - R * 0.45, R * 0.38, 0, Math.PI * 2); ctx.arc(X + R * 0.95, Y - R * 0.45, R * 0.38, 0, Math.PI * 2); ctx.fill();
      // head with horns
      ctx.fillStyle = '#7a1510';
      ctx.beginPath(); ctx.arc(X, Y - R * 1.05, R * 0.45, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#f2e6c8';
      ctx.beginPath();
      ctx.moveTo(X - R * 0.35, Y - R * 1.3); ctx.lineTo(X - R * 0.7, Y - R * 1.85); ctx.lineTo(X - R * 0.15, Y - R * 1.45);
      ctx.moveTo(X + R * 0.35, Y - R * 1.3); ctx.lineTo(X + R * 0.7, Y - R * 1.85); ctx.lineTo(X + R * 0.15, Y - R * 1.45);
      ctx.fill();
      ctx.fillStyle = '#ffd84a';
      ctx.fillRect(X - R * 0.22, Y - R * 1.1, R * 0.12, R * 0.08);
      ctx.fillRect(X + R * 0.1, Y - R * 1.1, R * 0.12, R * 0.08);
    }
  }
  function hpBar(e) {
    if (e.hp >= e.maxHp) return;
    const s = sc(e.z), R = e.r * RW * s;
    const X = px(e.x, e.z), Y = py(e.z) - R * 3.1;
    ctx.fillStyle = 'rgba(0,0,0,.5)'; ctx.fillRect(X - R, Y, R * 2, Math.max(2, 3 * s));
    ctx.fillStyle = '#ff5a4f'; ctx.fillRect(X - R, Y, R * 2 * Math.max(0, e.hp / e.maxHp), Math.max(2, 3 * s));
  }

  // squad formation (sunflower) cached
  const FORM = [];
  for (let i = 0; i < 220; i++) { const a = i * 2.39996, d = Math.sqrt(i + 0.5); FORM.push([Math.cos(a) * d, Math.sin(a) * d]); }

  function drawSquad() {
    const n = Math.min(run.troops, 180);
    if (n <= 0) return;
    const r = C.squadRadius(run.troops);
    const k = r / Math.sqrt(n + 0.5);
    const t = performance.now() / 120;
    const pts = [];
    for (let i = 0; i < n; i++) pts.push({ x: run.sx + FORM[i][0] * k, z: 0.15 + FORM[i][1] * k * 0.6, i });
    pts.sort((a, b) => b.z - a.z);
    for (const p of pts) shadow(p.x, p.z, 0.052);
    for (const p of pts) drawUnit(p.x, p.z, 0.052, '#2f86f6', '#1b56b8', '#7ab8ff', Math.abs(Math.sin(t + p.i)), false);
    // count bubble
    const X = px(run.sx, 0), Y = py(0) + 38;
    const txt = C.fmt(run.troops);
    ctx.font = "26px 'Black Han Sans', sans-serif";
    const w = ctx.measureText(txt).width + 22;
    ctx.fillStyle = 'rgba(16,40,90,.82)';
    roundRect(X - w / 2, Y - 17, w, 34, 17); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(txt, X, Y + 1);
  }
  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }

  function drawArrows() {
    ctx.lineCap = 'round';
    for (const a of run.arrows) {
      const z0 = a.z, z1 = a.z + 0.7;
      const s = sc(z0);
      const y0 = py(z0) - 14 * s, y1 = py(z1) - 14 * sc(z1);
      ctx.strokeStyle = a.kind === 'fire' ? 'rgba(255,120,30,.75)' : a.kind === 'pierce' ? 'rgba(185,140,255,.7)' : 'rgba(120,200,255,.6)';
      ctx.lineWidth = Math.max(1.5, (a.kind === 'fire' ? 8 : 6) * s);
      const x1 = a.x + a.vx * 0.7;
      ctx.beginPath(); ctx.moveTo(px(a.x, z0), y0); ctx.lineTo(px(x1, z1), y1); ctx.stroke();
      ctx.strokeStyle = '#ffffff'; ctx.lineWidth = Math.max(1, 2.2 * s);
      ctx.beginPath(); ctx.moveTo(px(a.x, z0), y0); ctx.lineTo(px(x1, z1), y1); ctx.stroke();
    }
  }

  function drawFx() {
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (const f of run.fx) {
      const p = f.t / f.life;
      const s = sc(f.z);
      const X = px(f.x, f.z), Y = py(f.z);
      if (f.kind === 'text') {
        const fs = (f.big ? 40 : f.small ? 16 : 22) * Math.max(0.5, Math.min(1.3, s * 1.2));
        ctx.globalAlpha = 1 - p * p;
        ctx.font = `${fs}px 'Black Han Sans', sans-serif`;
        ctx.lineWidth = fs * 0.16; ctx.strokeStyle = 'rgba(10,20,40,.8)';
        const yy = Y - 40 * s - p * 50;
        ctx.strokeText(f.text, X, yy); ctx.fillStyle = f.color; ctx.fillText(f.text, X, yy);
        ctx.globalAlpha = 1;
      } else if (f.kind === 'burst') {
        ctx.globalAlpha = 1 - p;
        ctx.fillStyle = f.color;
        const n = f.big ? 10 : 5, R = (f.big ? 60 : 22) * s * (0.3 + p);
        for (let i = 0; i < n; i++) {
          const a = i / n * Math.PI * 2;
          ctx.beginPath(); ctx.arc(X + Math.cos(a) * R, Y - 8 * s + Math.sin(a) * R * 0.5, Math.max(1, (f.big ? 6 : 3) * s * (1 - p)), 0, Math.PI * 2); ctx.fill();
        }
        ctx.globalAlpha = 1;
      } else if (f.kind === 'bolt') {
        ctx.globalAlpha = 1 - p;
        ctx.strokeStyle = '#d9f6ff'; ctx.lineWidth = 3;
        ctx.beginPath();
        let yy = 70, xx = X + (Math.random() - 0.5) * 30;
        ctx.moveTo(xx, yy);
        const steps = 6;
        for (let i = 1; i <= steps; i++) {
          const ty = yy + (Y - 14 * s - yy) * i / steps;
          ctx.lineTo(X + (i < steps ? (Math.random() - 0.5) * 24 : 0), ty);
        }
        ctx.stroke();
        ctx.fillStyle = 'rgba(200,240,255,.6)';
        ctx.beginPath(); ctx.arc(X, Y - 10 * s, 18 * s + 4, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = 1;
      } else if (f.kind === 'banner') {
        const a = p < 0.15 ? p / 0.15 : p > 0.75 ? (1 - p) / 0.25 : 1;
        ctx.globalAlpha = a;
        ctx.fillStyle = 'rgba(10,20,45,.7)';
        roundRect(W / 2 - 120, 150, 240, 50, 16); ctx.fill();
        ctx.font = "26px 'Black Han Sans', sans-serif";
        ctx.fillStyle = f.color; ctx.fillText(f.text, W / 2, 176);
        ctx.globalAlpha = 1;
      } else if (f.kind === 'ring') {
        ctx.globalAlpha = 1 - p;
        ctx.strokeStyle = f.color; ctx.lineWidth = 4;
        ctx.beginPath(); ctx.ellipse(X, Y, 30 + p * 90, (30 + p * 90) * 0.4, 0, 0, Math.PI * 2); ctx.stroke();
        ctx.globalAlpha = 1;
      }
    }
  }

  function drawHud() {
    // top bar
    ctx.fillStyle = 'rgba(10,25,55,.55)';
    roundRect(10, 10, 150, 36, 12); ctx.fill();
    ctx.font = "20px 'Black Han Sans', sans-serif"; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillStyle = '#fff'; ctx.fillText('STAGE ' + run.L, 22, 29);
    const gold = C.fmt(save.gold + (mode === 'play' || mode === 'ending' || mode === 'pause' ? run.goldEarned : 0));
    ctx.fillStyle = 'rgba(10,25,55,.55)';
    const gw = ctx.measureText(gold).width + 46;
    roundRect(168, 10, gw, 36, 12); ctx.fill();
    ctx.fillStyle = '#ffcc2e'; ctx.beginPath(); ctx.arc(186, 28, 8, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#a86c00'; ctx.beginPath(); ctx.arc(186, 28, 4, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.fillText(gold, 200, 29);

    // progress or boss bar
    const bx = 20, bw = W - 40, by = 56;
    if (run.boss && run.boss.alive) {
      const b = run.boss;
      ctx.fillStyle = 'rgba(10,10,20,.6)'; roundRect(bx, by, bw, 18, 9); ctx.fill();
      ctx.fillStyle = '#e0392f'; roundRect(bx + 2, by + 2, Math.max(0, (bw - 4) * b.hp / b.maxHp), 14, 7); ctx.fill();
      ctx.font = "13px 'Noto Sans KR', sans-serif"; ctx.fillStyle = '#fff'; ctx.textAlign = 'center';
      ctx.fillText('적장  ' + C.fmt(Math.max(0, b.hp)), W / 2, by + 10);
    } else {
      ctx.fillStyle = 'rgba(10,25,55,.5)'; roundRect(bx, by, bw, 10, 5); ctx.fill();
      ctx.fillStyle = '#ffcc2e'; roundRect(bx + 1, by + 1, Math.max(8, (bw - 2) * C.progress(run)), 8, 4); ctx.fill();
    }
    // active special abilities
    let ax = 20;
    for (const k in run.abilities) {
      const left = run.abilities[k];
      if (left <= 0) continue;
      const ab = C.ABILITIES[k];
      ctx.fillStyle = 'rgba(10,25,55,.7)'; roundRect(ax, 84, 64, 30, 10); ctx.fill();
      ctx.fillStyle = ab.color; roundRect(ax, 110, 64 * Math.min(1, left / run.st.skillTime), 4, 2); ctx.fill();
      ctx.font = '16px sans-serif'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
      ctx.fillStyle = '#fff'; ctx.fillText(ab.icon, ax + 6, 99);
      ctx.font = "15px 'Black Han Sans', sans-serif";
      ctx.fillText(Math.ceil(left) + 's', ax + 30, 100);
      ax += 70;
    }
  }

  function render() {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const k = canvas.width / W;
    ctx.setTransform(k, 0, 0, k, 0, 0);
    if (run && run.shake > 0) {
      const m = run.shake * 10;
      ctx.translate((Math.random() - 0.5) * m, (Math.random() - 0.5) * m);
    }
    drawWorld();
    if (!run) return;
    // painter's order: far → near
    const items = [];
    for (const b of run.blocks) items.push({ z: b.z + 0.001, f: () => drawBlock(b) });
    for (const c of run.crates) items.push({ z: c.z + 0.002, f: () => drawCrate(c) });
    for (const e of run.enemies) items.push({ z: e.z, f: () => drawEnemy(e) });
    items.sort((a, b) => b.z - a.z);
    for (const it of items) if (it.z > 0.6) it.f();
    drawArrows();
    drawSquad();
    for (const it of items) if (it.z <= 0.6) it.f();
    drawFx();
    ctx.setTransform(k, 0, 0, k, 0, 0);
    drawHud();
  }

  // ---------- loop ----------
  function frame(now) {
    const dt = Math.min(1 / 30, (now - last) / 1000);
    last = now;
    if (mode === 'play' && run) {
      const kv = (keys['arrowleft'] || keys['a'] ? -1 : 0) + (keys['arrowright'] || keys['d'] ? 1 : 0);
      if (kv) run.targetX += kv * 2.4 * dt;
      C.update(run, dt);
      if (run.state !== 'play') {
        mode = 'ending';
        setTimeout(endRun, run.state === 'win' ? 900 : 600);
      }
    } else if (mode === 'ending' && run) {
      C.update(run, dt);
    }
    render();
    requestAnimationFrame(frame);
  }

  resize();
  refreshMenu();
  requestAnimationFrame(t => { last = t; frame(t); });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(resize);
})();
