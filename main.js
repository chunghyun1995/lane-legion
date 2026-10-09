// Lane Legion — rendering, input and UI
(function () {
  'use strict';
  const C = window.LaneCore;
  const W = 420, H = 760;
  const HOR = 92, BASE = 640, RW = 176, D = 11, CX = W / 2;
  const TAU = Math.PI * 2;

  const canvas = document.getElementById('c');
  const ctx = canvas.getContext('2d');
  const sceneCanvas = document.getElementById('scene3d');
  const view3d = window.createLane3D ? window.createLane3D(sceneCanvas) : null;
  if (!view3d) {
    sceneCanvas.hidden = true;
    document.getElementById('graphicsMode').textContent = '호환 모드';
  }
  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const rect = canvas.getBoundingClientRect();
    canvas.width = Math.max(1, Math.round(rect.width * dpr));
    canvas.height = Math.max(1, Math.round(rect.height * dpr));
    if (view3d) view3d.resize();
  }
  window.addEventListener('resize', resize);

  // =====================================================================
  // save
  // =====================================================================
  const KEY = 'laneLegionSave.v1';
  function load() {
    try {
      const s = JSON.parse(localStorage.getItem(KEY));
      if (s && s.up) { const d = C.defaultSave(); return Object.assign(d, s, { up: Object.assign(d.up, s.up) }); }
    } catch (e) {}
    return C.defaultSave();
  }
  function persist() { try { localStorage.setItem(KEY, JSON.stringify(save)); } catch (e) {} }
  function hasProgress(s) {
    return s.level > 1 || s.gold > 0 || Object.values(s.up).some(v => v > 0);
  }
  let save = load();

  // =====================================================================
  // projection
  // =====================================================================
  const sc = z => D / (D + z);
  const px = (x, z) => view3d ? view3d.project(x, z).x : CX + x * RW * sc(z);
  const py = z => view3d ? view3d.project(0, z).y : HOR + (BASE - HOR) * sc(z);
  const fade = z => Math.max(0, Math.min(1, (C.ZFAR + 6 - z) / 9));
  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;

  // seeded random for deterministic particles
  function srand(seed) { let s = seed * 9301 + 49297; return () => ((s = (s * 9301 + 49297) % 233280) / 233280); }

  // =====================================================================
  // sprites (drawn once to offscreen canvases)
  // =====================================================================
  function sprite(w, h, draw) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const g = c.getContext('2d');
    g.lineJoin = 'round'; g.lineCap = 'round';
    draw(g, w, h);
    return c;
  }
  function lg(g, x0, y0, x1, y1, stops) {
    const gr = g.createLinearGradient(x0, y0, x1, y1);
    stops.forEach(([o, c]) => gr.addColorStop(o, c));
    return gr;
  }
  function rr(g, x, y, w, h, r) {
    g.beginPath();
    g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
  }
  const OUT = 'rgba(12,18,40,.55)';

  // blue archer, seen from behind
  function soldier(frame) {
    return sprite(72, 100, (g) => {
      const lift = frame ? 5 : 0;
      g.fillStyle = '#1b2f63';
      rr(g, 25, 66 - lift, 9, 26, 4); g.fill();
      rr(g, 38, 66 - (5 - lift), 9, 26, 4); g.fill();
      g.fillStyle = '#3b2a1e';
      rr(g, 24, 86 - lift, 11, 8, 3); g.fill();
      rr(g, 37, 86 - (5 - lift), 11, 8, 3); g.fill();
      // cape
      g.fillStyle = lg(g, 0, 36, 0, 76, [[0, '#4d9bff'], [1, '#1c58c8']]);
      g.strokeStyle = OUT; g.lineWidth = 2.5;
      g.beginPath();
      g.moveTo(18, 44); g.quadraticCurveTo(36, 34, 54, 44);
      g.lineTo(58, 74); g.quadraticCurveTo(36, 80, 14, 74); g.closePath();
      g.fill(); g.stroke();
      g.strokeStyle = 'rgba(255,255,255,.18)'; g.lineWidth = 2;
      g.beginPath(); g.moveTo(30, 46); g.lineTo(27, 74); g.moveTo(43, 46); g.lineTo(46, 74); g.stroke();
      // quiver
      g.save(); g.translate(46, 44); g.rotate(0.35);
      g.fillStyle = '#7b4a24'; rr(g, -5, -16, 10, 26, 3); g.fill();
      g.fillStyle = '#f4efe2';
      [-3, 0, 3].forEach(dx => { g.beginPath(); g.moveTo(dx, -16); g.lineTo(dx - 2, -24); g.lineTo(dx + 2, -24); g.closePath(); g.fill(); });
      g.restore();
      // bow
      g.strokeStyle = '#6b3d1a'; g.lineWidth = 3.5;
      g.beginPath(); g.arc(12, 52, 18, -1.15, 1.15); g.stroke();
      g.strokeStyle = 'rgba(255,255,255,.7)'; g.lineWidth = 1;
      g.beginPath(); g.moveTo(12 + Math.cos(-1.15) * 18, 52 + Math.sin(-1.15) * 18); g.lineTo(12 + Math.cos(1.15) * 18, 52 + Math.sin(1.15) * 18); g.stroke();
      // shoulder pads
      g.fillStyle = lg(g, 0, 36, 0, 50, [[0, '#d7e8ff'], [1, '#7ea6de']]);
      g.strokeStyle = OUT; g.lineWidth = 2;
      g.beginPath(); g.ellipse(19, 44, 9, 7, -0.3, 0, TAU); g.fill(); g.stroke();
      g.beginPath(); g.ellipse(53, 44, 9, 7, 0.3, 0, TAU); g.fill(); g.stroke();
      // helmet
      g.fillStyle = lg(g, 20, 10, 50, 40, [[0, '#f3f8ff'], [0.5, '#b9cfee'], [1, '#6f8fc0']]);
      g.beginPath(); g.arc(36, 27, 16, 0, TAU); g.fill(); g.stroke();
      g.fillStyle = '#5c7bb0'; rr(g, 20, 30, 32, 6, 3); g.fill();
      g.fillStyle = lg(g, 0, 2, 0, 20, [[0, '#7fc0ff'], [1, '#2a6fe0']]);
      g.beginPath(); g.ellipse(36, 12, 5, 9, 0, 0, TAU); g.fill();
      g.fillStyle = 'rgba(255,255,255,.65)';
      g.beginPath(); g.ellipse(30, 21, 4, 3, -0.6, 0, TAU); g.fill();
    });
  }

  // red raider, facing the camera
  function grunt(frame) {
    return sprite(72, 100, (g) => {
      const lift = frame ? 5 : 0;
      g.fillStyle = '#4a1410';
      rr(g, 25, 66 - lift, 9, 26, 4); g.fill();
      rr(g, 38, 66 - (5 - lift), 9, 26, 4); g.fill();
      g.fillStyle = '#26100c';
      rr(g, 24, 86 - lift, 11, 8, 3); g.fill();
      rr(g, 37, 86 - (5 - lift), 11, 8, 3); g.fill();
      // sword
      g.save(); g.translate(58, 58); g.rotate(-0.5);
      g.fillStyle = '#d9dde6'; rr(g, -2.5, -34, 5, 32, 2); g.fill();
      g.fillStyle = '#6b3d1a'; rr(g, -6, -3, 12, 4, 2); g.fill(); rr(g, -2, 0, 4, 9, 2); g.fill();
      g.restore();
      // body
      g.fillStyle = lg(g, 0, 38, 0, 76, [[0, '#ff6a55'], [1, '#b3221a']]);
      g.strokeStyle = OUT; g.lineWidth = 2.5;
      g.beginPath();
      g.moveTo(18, 44); g.quadraticCurveTo(36, 36, 54, 44);
      g.lineTo(56, 74); g.quadraticCurveTo(36, 80, 16, 74); g.closePath();
      g.fill(); g.stroke();
      g.fillStyle = '#3a120e'; rr(g, 17, 62, 38, 6, 3); g.fill();
      g.fillStyle = '#e8b34a'; rr(g, 32, 61, 8, 8, 2); g.fill();
      g.fillStyle = '#c62f24';
      g.beginPath(); g.ellipse(16, 52, 6, 10, 0.3, 0, TAU); g.fill(); g.stroke();
      g.beginPath(); g.ellipse(56, 52, 6, 10, -0.3, 0, TAU); g.fill(); g.stroke();
      // face
      g.fillStyle = '#f0b48c';
      g.beginPath(); g.arc(36, 28, 13, 0, TAU); g.fill(); g.stroke();
      // horned helmet
      g.fillStyle = lg(g, 0, 10, 0, 30, [[0, '#8a2a20'], [1, '#4d1410']]);
      g.beginPath(); g.arc(36, 26, 15, Math.PI * 1.02, Math.PI * 1.98); g.lineTo(51, 26); g.lineTo(21, 26); g.closePath(); g.fill(); g.stroke();
      g.fillStyle = '#f2e6c8'; g.strokeStyle = OUT; g.lineWidth = 1.5;
      g.beginPath(); g.moveTo(22, 20); g.quadraticCurveTo(12, 14, 12, 4); g.quadraticCurveTo(20, 12, 27, 15); g.closePath(); g.fill(); g.stroke();
      g.beginPath(); g.moveTo(50, 20); g.quadraticCurveTo(60, 14, 60, 4); g.quadraticCurveTo(52, 12, 45, 15); g.closePath(); g.fill(); g.stroke();
      // angry eyes
      g.fillStyle = '#fff';
      g.beginPath(); g.ellipse(31, 31, 3.6, 3, 0, 0, TAU); g.ellipse(41, 31, 3.6, 3, 0, 0, TAU); g.fill();
      g.fillStyle = '#1a0a08';
      g.beginPath(); g.arc(31.5, 31.5, 1.8, 0, TAU); g.arc(40.5, 31.5, 1.8, 0, TAU); g.fill();
      g.strokeStyle = '#3a120e'; g.lineWidth = 2.4;
      g.beginPath(); g.moveTo(26, 26); g.lineTo(34, 28.5); g.moveTo(46, 26); g.lineTo(38, 28.5); g.stroke();
    });
  }

  // heavy brute with a spiked club
  function brute(frame) {
    return sprite(110, 120, (g) => {
      const lift = frame ? 6 : 0;
      g.fillStyle = '#35100c';
      rr(g, 36, 82 - lift, 15, 32, 6); g.fill();
      rr(g, 59, 82 - (6 - lift), 15, 32, 6); g.fill();
      g.save(); g.translate(92, 72); g.rotate(-0.6);
      g.fillStyle = '#7a4a22'; rr(g, -5, -46, 10, 50, 4); g.fill();
      g.fillStyle = '#8f5a2c'; g.beginPath(); g.ellipse(0, -50, 11, 16, 0, 0, TAU); g.fill();
      g.fillStyle = '#cfd3db';
      [[-8, -56], [8, -50], [-6, -42], [6, -62]].forEach(([x, y]) => { g.beginPath(); g.moveTo(x, y); g.lineTo(x + (x < 0 ? -6 : 6), y - 3); g.lineTo(x, y + 4); g.fill(); });
      g.restore();
      g.fillStyle = lg(g, 0, 36, 0, 96, [[0, '#d1392c'], [1, '#7c1912']]);
      g.strokeStyle = OUT; g.lineWidth = 3;
      g.beginPath();
      g.moveTo(18, 52); g.quadraticCurveTo(55, 30, 92, 52);
      g.lineTo(88, 92); g.quadraticCurveTo(55, 102, 22, 92); g.closePath();
      g.fill(); g.stroke();
      g.fillStyle = lg(g, 0, 50, 0, 86, [[0, '#9aa2b3'], [1, '#596173']]);
      rr(g, 38, 52, 34, 30, 8); g.fill(); g.stroke();
      g.fillStyle = 'rgba(255,255,255,.35)'; rr(g, 42, 55, 12, 5, 2); g.fill();
      g.fillStyle = '#4a4f5e';
      g.beginPath(); g.ellipse(20, 52, 14, 11, 0, 0, TAU); g.ellipse(90, 52, 14, 11, 0, 0, TAU); g.fill(); g.stroke();
      g.fillStyle = '#d6dae2';
      [[12, 44], [22, 40], [88, 40], [98, 44]].forEach(([x, y]) => { g.beginPath(); g.moveTo(x - 4, y + 4); g.lineTo(x, y - 8); g.lineTo(x + 4, y + 4); g.fill(); });
      g.fillStyle = '#b8574a';
      g.beginPath(); g.arc(55, 32, 15, 0, TAU); g.fill(); g.stroke();
      g.fillStyle = '#2d0d09';
      rr(g, 40, 18, 30, 12, 5); g.fill();
      g.fillStyle = '#ffd84a';
      g.beginPath(); g.ellipse(49, 34, 3.5, 2.2, 0.2, 0, TAU); g.ellipse(61, 34, 3.5, 2.2, -0.2, 0, TAU); g.fill();
      g.fillStyle = '#f2e6c8';
      g.beginPath(); g.moveTo(49, 41); g.lineTo(51, 46); g.lineTo(53, 41); g.moveTo(57, 41); g.lineTo(59, 46); g.lineTo(61, 41); g.fill();
    });
  }

  // the warlord boss
  function warlord(frame) {
    return sprite(260, 300, (g) => {
      g.translate(0, frame ? 4 : 0);
      g.save(); g.translate(214, 170); g.rotate(-0.35);
      g.fillStyle = '#6b3d1a'; rr(g, -7, -150, 14, 190, 6); g.fill();
      g.fillStyle = lg(g, -60, -150, 0, -90, [[0, '#f2f4f8'], [1, '#8b93a5']]);
      g.strokeStyle = OUT; g.lineWidth = 4;
      g.beginPath(); g.moveTo(0, -150); g.quadraticCurveTo(-70, -150, -64, -88); g.quadraticCurveTo(-30, -100, 0, -96); g.closePath(); g.fill(); g.stroke();
      g.beginPath(); g.moveTo(0, -150); g.quadraticCurveTo(52, -146, 48, -102); g.quadraticCurveTo(26, -108, 0, -104); g.closePath(); g.fill(); g.stroke();
      g.restore();
      g.fillStyle = '#2a0b08';
      rr(g, 88, 220, 30, 70, 10); g.fill(); rr(g, 142, 220, 30, 70, 10); g.fill();
      g.fillStyle = lg(g, 0, 90, 0, 280, [[0, '#5d0f0b'], [1, '#2a0606']]);
      g.beginPath(); g.moveTo(52, 110); g.lineTo(208, 110); g.lineTo(226, 270); g.quadraticCurveTo(130, 250, 34, 270); g.closePath(); g.fill();
      g.fillStyle = lg(g, 0, 80, 0, 240, [[0, '#e04434'], [1, '#8a1a12']]);
      g.strokeStyle = OUT; g.lineWidth = 5;
      g.beginPath(); g.moveTo(58, 120); g.quadraticCurveTo(130, 70, 202, 120); g.lineTo(194, 228); g.quadraticCurveTo(130, 250, 66, 228); g.closePath(); g.fill(); g.stroke();
      g.fillStyle = lg(g, 0, 110, 0, 210, [[0, '#4e5466'], [1, '#262a35']]);
      rr(g, 90, 120, 80, 80, 18); g.fill(); g.stroke();
      g.fillStyle = '#ffcf3a';
      g.beginPath(); g.arc(130, 160, 14, 0, TAU); g.fill();
      g.fillStyle = '#b3261c'; g.beginPath(); g.arc(130, 160, 7, 0, TAU); g.fill();
      g.fillStyle = '#2b1a10'; rr(g, 64, 206, 132, 16, 6); g.fill();
      g.fillStyle = '#ffcf3a'; rr(g, 120, 204, 20, 20, 4); g.fill();
      g.fillStyle = lg(g, 0, 90, 0, 140, [[0, '#6a7186'], [1, '#30343f']]);
      g.beginPath(); g.ellipse(58, 118, 34, 26, -0.2, 0, TAU); g.fill(); g.stroke();
      g.beginPath(); g.ellipse(202, 118, 34, 26, 0.2, 0, TAU); g.fill(); g.stroke();
      g.fillStyle = '#e4e8ef';
      [[36, 100], [58, 92], [80, 100], [180, 100], [202, 92], [224, 100]].forEach(([x, y]) => { g.beginPath(); g.moveTo(x - 7, y + 6); g.lineTo(x, y - 18); g.lineTo(x + 7, y + 6); g.fill(); });
      g.fillStyle = '#b8574a';
      g.beginPath(); g.ellipse(46, 168, 16, 32, 0.2, 0, TAU); g.fill(); g.stroke();
      g.beginPath(); g.ellipse(212, 160, 16, 32, -0.4, 0, TAU); g.fill(); g.stroke();
      g.fillStyle = '#a84a3e';
      g.beginPath(); g.arc(130, 78, 34, 0, TAU); g.fill(); g.stroke();
      g.fillStyle = lg(g, 0, 40, 0, 80, [[0, '#3d4252'], [1, '#1b1e27']]);
      g.beginPath(); g.arc(130, 74, 36, Math.PI * 1.05, Math.PI * 1.95); g.lineTo(164, 80); g.lineTo(96, 80); g.closePath(); g.fill(); g.stroke();
      g.fillStyle = lg(g, 0, 0, 0, 60, [[0, '#fff8e6'], [1, '#c9b48a']]);
      g.lineWidth = 3;
      g.beginPath(); g.moveTo(100, 56); g.quadraticCurveTo(64, 40, 70, 4); g.quadraticCurveTo(84, 36, 110, 46); g.closePath(); g.fill(); g.stroke();
      g.beginPath(); g.moveTo(160, 56); g.quadraticCurveTo(196, 40, 190, 4); g.quadraticCurveTo(176, 36, 150, 46); g.closePath(); g.fill(); g.stroke();
      g.shadowColor = '#ffd84a'; g.shadowBlur = 12;
      g.fillStyle = '#ffe46a';
      g.beginPath(); g.ellipse(116, 86, 8, 4, 0.25, 0, TAU); g.ellipse(144, 86, 8, 4, -0.25, 0, TAU); g.fill();
      g.shadowBlur = 0;
      g.fillStyle = '#f2e6c8';
      g.beginPath(); g.moveTo(112, 100); g.lineTo(116, 112); g.lineTo(120, 100); g.moveTo(140, 100); g.lineTo(144, 112); g.lineTo(148, 100); g.fill();
    });
  }

  const SPR = {
    soldier: [soldier(0), soldier(1)],
    grunt: [grunt(0), grunt(1)],
    brute: [brute(0), brute(1)],
    boss: [warlord(0), warlord(1)],
  };

  // distant islands + a castle at the end of the road
  const BG = sprite(W * 2, 200, (g) => {
    g.scale(2, 2);
    const ridge = (base, amp, color, seed) => {
      const r = srand(seed);
      g.fillStyle = color; g.beginPath(); g.moveTo(0, 100);
      for (let x = 0; x <= W; x += 14) g.lineTo(x, base - Math.abs(Math.sin(x * 0.018 + seed)) * amp - r() * amp * 0.35);
      g.lineTo(W, 100); g.closePath(); g.fill();
    };
    ridge(92, 26, 'rgba(110,160,210,.55)', 3);
    ridge(95, 14, 'rgba(86,138,196,.75)', 9);
    g.fillStyle = 'rgba(78,118,170,.85)';
    const cx = W / 2;
    g.fillRect(cx - 34, 70, 68, 30);
    g.fillRect(cx - 44, 58, 16, 42); g.fillRect(cx + 28, 58, 16, 42); g.fillRect(cx - 9, 50, 18, 50);
    for (let i = 0; i < 4; i++) { g.fillRect(cx - 44 + i * 5, 54, 3, 4); g.fillRect(cx + 28 + i * 5, 54, 3, 4); }
    g.beginPath(); g.moveTo(cx - 11, 50); g.lineTo(cx, 36); g.lineTo(cx + 11, 50); g.fill();
  });
  let VIG = null;
  function vignette() {
    if (VIG) return VIG;
    VIG = sprite(W, H, (g) => {
      const gr = g.createRadialGradient(W / 2, H * 0.55, H * 0.35, W / 2, H * 0.55, H * 0.8);
      gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,10,30,.38)');
      g.fillStyle = gr; g.fillRect(0, 0, W, H);
    });
    return VIG;
  }

  // =====================================================================
  // state + input
  // =====================================================================
  let run = null;
  let mode = 'menu';
  let last = performance.now();
  let clock = 0;

  const keys = {};
  let drag = null;
  canvas.addEventListener('pointerdown', e => {
    if (mode !== 'play') return;
    drag = { x: e.clientX, id: e.pointerId };
    try { canvas.setPointerCapture(e.pointerId); } catch (err) {}
  });
  canvas.addEventListener('pointermove', e => {
    if (mode !== 'play' || !drag || drag.id !== e.pointerId || !run) return;
    const rect = canvas.getBoundingClientRect();
    run.targetX += (e.clientX - drag.x) * (W / rect.width) / RW * 1.15;
    drag.x = e.clientX;
  });
  const endDrag = e => { if (drag && drag.id === e.pointerId) drag = null; };
  canvas.addEventListener('pointerup', endDrag);
  canvas.addEventListener('pointercancel', endDrag);
  window.addEventListener('keydown', e => {
    keys[e.key.toLowerCase()] = true;
    if ((e.key === 'Escape' || e.key.toLowerCase() === 'p') && (mode === 'play' || mode === 'pause')) togglePause();
  });
  window.addEventListener('keyup', e => { keys[e.key.toLowerCase()] = false; });
  window.addEventListener('blur', () => { for (const k in keys) keys[k] = false; });
  document.addEventListener('visibilitychange', () => { if (document.hidden && mode === 'play') togglePause(); });

  // =====================================================================
  // UI
  // =====================================================================
  const $ = id => document.getElementById(id);
  const ICONS = { dmg: '🏹', rate: '⚡', troops: '🛡️', skill: '✨' };
  function renderUps() {
    document.querySelectorAll('[data-ups]').forEach(box => {
      let html = `<div class="ups-head"><span>업그레이드</span><span class="coin">${C.fmt(save.gold)}</span></div><div class="up-grid">`;
      for (const k of Object.keys(C.UPGRADES)) {
        const u = C.UPGRADES[k], lv = save.up[k] || 0, cost = C.upgradeCost(k, lv);
        html += `<div class="up"><div class="top"><div class="ic">${ICONS[k]}</div><div class="tx"><b>${u.name} Lv.${lv + 1}</b><small>${u.desc}</small></div></div>
          <button data-buy="${k}" ${save.gold < cost ? 'disabled' : ''}>${C.fmt(cost)}</button></div>`;
      }
      box.innerHTML = html + '</div>';
    });
  }
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-buy]');
    if (!b) return;
    const k = b.dataset.buy, cost = C.upgradeCost(k, save.up[k] || 0);
    if (save.gold >= cost) { save.gold -= cost; save.up[k] = (save.up[k] || 0) + 1; persist(); refreshMenu(); }
  });
  function showOverlay(id) {
    ['menu', 'result', 'pause', 'confirm'].forEach(o => { $(o).classList.toggle('show', o === id); $(o).inert = o !== id; });
    $('pauseBtn').classList.toggle('show', !id && mode === 'play');
  }
  function refreshMenu() {
    const prog = hasProgress(save);
    $('saveCard').hidden = !prog;
    $('continueBtn').hidden = !prog;
    $('newBtn').hidden = !prog;
    $('startBtn').hidden = prog;
    $('menuUps').hidden = !prog;
    $('scStage').textContent = save.level;
    $('scBest').textContent = Math.max(save.best || 1, save.level);
    $('scGold').textContent = C.fmt(save.gold);
    $('continueSub').textContent = `스테이지 ${save.level}부터`;
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
    if (won) { save.level++; save.best = Math.max(save.best || 1, save.level); }
    persist();
    $('resTitle').textContent = won ? '승리!' : '패배';
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
  function goMenu() { mode = 'menu'; run = null; refreshMenu(); showOverlay('menu'); }
  function togglePause() {
    if (mode === 'play') { mode = 'pause'; showOverlay('pause'); }
    else if (mode === 'pause') { mode = 'play'; showOverlay(null); last = performance.now(); }
  }
  $('startBtn').onclick = startRun;
  $('continueBtn').onclick = startRun;
  $('newBtn').onclick = () => showOverlay('confirm');
  $('cfNo').onclick = () => showOverlay('menu');
  $('cfYes').onclick = () => {
    save = C.defaultSave();
    try { localStorage.removeItem(KEY); } catch (e) {}
    refreshMenu();
    startRun();
  };
  $('nextBtn').onclick = startRun;
  $('homeBtn').onclick = goMenu;
  $('pauseBtn').onclick = togglePause;
  $('resumeBtn').onclick = togglePause;
  $('quitBtn').onclick = () => { run.state = 'lose'; endRun(); };

  // =====================================================================
  // world
  // =====================================================================
  function quad(x0, x1, z0, z1) {
    ctx.beginPath();
    ctx.moveTo(px(x0, z0), py(z0)); ctx.lineTo(px(x1, z0), py(z0));
    ctx.lineTo(px(x1, z1), py(z1)); ctx.lineTo(px(x0, z1), py(z1));
    ctx.closePath(); ctx.fill();
  }
  function rrect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }
  function scrollPos() { return run ? run.scroll : clock * 4; }

  function drawWorld() {
    const scroll = scrollPos();
    // sky
    let g = ctx.createLinearGradient(0, 0, 0, HOR);
    g.addColorStop(0, '#6fb9f5'); g.addColorStop(1, '#d7efff');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, HOR + 1);
    ctx.fillStyle = 'rgba(255,255,255,.75)';
    for (let i = 0; i < 4; i++) {
      const x = ((i * 137 + clock * (6 + i * 2)) % (W + 160)) - 80, y = 22 + i * 15;
      ctx.beginPath();
      ctx.ellipse(x, y, 34, 9, 0, 0, TAU); ctx.ellipse(x + 22, y - 5, 20, 9, 0, 0, TAU); ctx.ellipse(x - 20, y - 2, 18, 7, 0, 0, TAU);
      ctx.fill();
    }
    ctx.drawImage(BG, 0, HOR - 100, W, 100);
    // sea
    g = ctx.createLinearGradient(0, HOR, 0, H);
    g.addColorStop(0, '#8cc8f2'); g.addColorStop(0.08, '#4b9fe8'); g.addColorStop(1, '#155bb8');
    ctx.fillStyle = g; ctx.fillRect(0, HOR, W, H - HOR);
    ctx.strokeStyle = 'rgba(255,255,255,.28)'; ctx.lineWidth = 1.2;
    ctx.beginPath();
    for (let i = 0; i < 40; i++) {
      const z = 60 - ((i * 5.7 + scroll) % 60);
      const side = i % 2 ? 1 : -1;
      const x = side * (1.55 + ((i * 0.613) % 1.7));
      const s = sc(z), X = px(x, z), Y = py(z) + 4 * s;
      const w = 18 * s + 2;
      ctx.moveTo(X - w, Y); ctx.quadraticCurveTo(X - w / 2, Y - 3 * s, X, Y); ctx.quadraticCurveTo(X + w / 2, Y + 3 * s, X + w, Y);
    }
    ctx.stroke();

    const zN = -2.6, zF = 220;
    // wall outer faces
    for (const side of [-1, 1]) {
      const zs = [zN, 2, 6, 14, 30, 60, zF];
      ctx.fillStyle = '#a89070';
      ctx.beginPath();
      zs.forEach((z, i) => { const X = px(side * 1.3, z), Y = py(z); i ? ctx.lineTo(X, Y) : ctx.moveTo(X, Y); });
      for (let i = zs.length - 1; i >= 0; i--) { const z = zs[i]; ctx.lineTo(px(side * 1.3, z), py(z) + 0.5 * RW * sc(z)); }
      ctx.closePath(); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,.5)'; ctx.lineWidth = 2;
      ctx.beginPath();
      zs.forEach((z, i) => { const X = px(side * 1.3, z), Y = py(z) + 0.5 * RW * sc(z); i ? ctx.lineTo(X, Y) : ctx.moveTo(X, Y); });
      ctx.stroke();
      ctx.fillStyle = '#e7d9bb'; quad(side * 1.0, side * 1.3, zN, zF);
      ctx.fillStyle = '#d3c19c'; quad(side * 1.0, side * 1.04, zN, zF);
    }
    // road
    g = ctx.createLinearGradient(0, py(60), 0, H);
    g.addColorStop(0, '#d9c8a6'); g.addColorStop(1, '#efe3c8');
    ctx.fillStyle = g; quad(-1, 1, zN, zF);
    const T = 1.6, off = scroll % (T * 2);
    const cols = [-1, -2 / 3, -1 / 3, 0, 1 / 3, 2 / 3, 1];
    ctx.fillStyle = 'rgba(120,96,60,.08)';
    for (let z = -off - T * 2, row = 0; z < 60; z += T, row++) {
      if (z + T < zN) continue;
      for (let c = 0; c < 6; c++) if ((c + row) % 2 === 0) quad(cols[c], cols[c + 1], Math.max(z, zN), z + T);
    }
    ctx.strokeStyle = 'rgba(110,88,56,.22)'; ctx.lineWidth = 1;
    ctx.beginPath();
    for (let z = -off - T * 2; z < 60; z += T) { if (z < zN) continue; ctx.moveTo(px(-1, z), py(z)); ctx.lineTo(px(1, z), py(z)); }
    for (const x of [-5 / 6, -1 / 2, -1 / 6, 1 / 6, 1 / 2, 5 / 6]) { ctx.moveTo(px(x, zN), py(zN)); ctx.lineTo(px(x, 60), py(60)); }
    ctx.stroke();
    const E = C.LANE_EDGE;
    ctx.fillStyle = 'rgba(60,140,255,.17)'; quad(-1, -E, zN, zF);
    ctx.fillStyle = 'rgba(230,60,45,.07)'; quad(-E, E, zN, zF);
    ctx.fillStyle = 'rgba(255,186,30,.16)'; quad(E, 1, zN, zF);
    for (const x of [-E, E]) {
      ctx.fillStyle = '#b49e78'; quad(x - 0.03, x + 0.03, zN, zF);
      ctx.fillStyle = '#f8f0dd'; quad(x - 0.018, x + 0.012, zN, zF);
    }
    // haze toward the horizon
    g = ctx.createLinearGradient(0, HOR, 0, py(26));
    g.addColorStop(0, 'rgba(215,236,255,.95)'); g.addColorStop(1, 'rgba(215,236,255,0)');
    ctx.fillStyle = g; ctx.fillRect(0, HOR, W, py(26) - HOR);

    // crenellations
    const M = 1.5, moff = scroll % M;
    for (let z = 64 - moff; z > zN; z -= M) {
      const s = sc(z), a = fade(z);
      if (a <= 0) continue;
      ctx.globalAlpha = a;
      for (const side of [-1, 1]) {
        const x0 = side * 1.17, x1 = side * 1.3, h = 0.12 * RW * s;
        const L = Math.min(px(x0, z), px(x1, z)), R = Math.max(px(x0, z), px(x1, z));
        ctx.fillStyle = '#c4ad86'; ctx.fillRect(L, py(z) - h, R - L, h);
        ctx.fillStyle = '#f1e6cc'; ctx.fillRect(L, py(z) - h, R - L, Math.max(1, h * 0.25));
      }
    }
    // banners
    const B = 6, boff = scroll % B;
    for (let z = 64 - boff; z > zN; z -= B) {
      const s = sc(z), a = fade(z);
      if (a <= 0) continue;
      ctx.globalAlpha = a;
      for (const side of [-1, 1]) {
        const X = px(side * 1.12, z), Y = py(z);
        ctx.fillStyle = '#6b5a42'; ctx.fillRect(X - 1.5 * s, Y - 74 * s, 3 * s + 0.5, 74 * s);
        ctx.fillStyle = '#ffcf3a'; ctx.beginPath(); ctx.arc(X, Y - 75 * s, 3 * s + 0.5, 0, TAU); ctx.fill();
        const wv = Math.sin(clock * 5 + z) * 4 * s;
        ctx.fillStyle = side < 0 ? '#2d7ff0' : '#f0a610';
        ctx.beginPath();
        ctx.moveTo(X, Y - 72 * s);
        ctx.quadraticCurveTo(X - side * 16 * s, Y - 70 * s + wv, X - side * 30 * s, Y - 66 * s + wv);
        ctx.lineTo(X - side * 24 * s, Y - 58 * s + wv);
        ctx.lineTo(X - side * 30 * s, Y - 50 * s + wv);
        ctx.quadraticCurveTo(X - side * 16 * s, Y - 54 * s + wv, X, Y - 50 * s);
        ctx.closePath(); ctx.fill();
      }
    }
    ctx.globalAlpha = 1;

    // lane labels at the start of a stage
    const tl = run ? run.time : 99;
    if (run && tl < 4.5) {
      ctx.globalAlpha = clamp(1 - (tl - 3) / 1.5, 0, 1);
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      [['병력', -C.LANE_W, '#1a4fa6'], ['몬스터', 0, '#a3241b'], ['특수능력', C.LANE_W, '#996300']].forEach(([t, x, c]) => {
        const X = px(x, 4.5), Y = py(4.5);
        ctx.font = "16px 'Black Han Sans', sans-serif";
        const w = ctx.measureText(t).width + 18;
        ctx.fillStyle = 'rgba(255,255,255,.8)'; rrect(X - w / 2, Y - 13, w, 26, 13); ctx.fill();
        ctx.fillStyle = c; ctx.fillText(t, X, Y + 1);
      });
      ctx.globalAlpha = 1;
    }
  }

  function shadow(x, z, r) {
    const s = sc(z);
    ctx.fillStyle = 'rgba(60,40,20,.25)';
    ctx.beginPath(); ctx.ellipse(px(x, z), py(z), r * RW * s * 1.15, r * RW * s * 0.42, 0, 0, TAU); ctx.fill();
  }

  function drawSprite(img, x, z, worldH, flash) {
    const s = sc(z), h = worldH * RW * s;
    if (h < 1.5) return;
    const w = h * img.width / img.height;
    const X = px(x, z), Y = py(z);
    ctx.drawImage(img, X - w / 2, Y - h, w, h);
    if (flash) {
      const a = ctx.globalAlpha;
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = a * 0.55;
      ctx.drawImage(img, X - w / 2, Y - h, w, h);
      ctx.globalAlpha = a;
      ctx.globalCompositeOperation = 'source-over';
    }
  }

  // 3D box: x0..x1, front face at z, depth dz, height hw (world units)
  function box(x0, x1, z, dz, hw, front, top, side) {
    const s0 = sc(z), s1 = sc(z + dz);
    const fl = px(x0, z), fr = px(x1, z), fy = py(z), fh = hw * RW * s0;
    const bl = px(x0, z + dz), br = px(x1, z + dz), by = py(z + dz), bh = hw * RW * s1;
    if (side) {
      const sx0 = x0 > 0 ? fl : fr, sx1 = x0 > 0 ? bl : br;
      ctx.fillStyle = side;
      ctx.beginPath(); ctx.moveTo(sx0, fy); ctx.lineTo(sx0, fy - fh); ctx.lineTo(sx1, by - bh); ctx.lineTo(sx1, by); ctx.closePath(); ctx.fill();
    }
    ctx.fillStyle = top;
    ctx.beginPath(); ctx.moveTo(fl, fy - fh); ctx.lineTo(fr, fy - fh); ctx.lineTo(br, by - bh); ctx.lineTo(bl, by - bh); ctx.closePath(); ctx.fill();
    ctx.fillStyle = front; ctx.fillRect(fl, fy - fh, fr - fl, fh);
    return { L: fl, R: fr, T: fy - fh, B: fy, s: s0 };
  }

  function label(txt, x, y, fs, color) {
    ctx.font = `${fs}px 'Black Han Sans', sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.lineWidth = Math.max(2, fs * 0.16);
    ctx.strokeStyle = 'rgba(8,16,36,.8)';
    ctx.strokeText(txt, x, y);
    ctx.fillStyle = color || '#fff';
    ctx.fillText(txt, x, y);
  }

  // =====================================================================
  // entities
  // =====================================================================
  function drawBlock(b) {
    if (b.z > C.ZFAR + 4 || (b.used && b.z < 0.1)) return;
    ctx.globalAlpha = fade(b.z) * (b.used ? 0.35 : 1);
    const pos = b.kind === 'mul' || b.v > 0;
    const pal = b.kind === 'mul' ? ['#ffd34a', '#ffe78f', '#c98a00', '#f5b316'] : pos ? ['#3b8cff', '#8cc2ff', '#174fae', '#2a6fe0'] : ['#f0473a', '#ff9a8f', '#9a1d15', '#d03228'];
    const fg = ctx.createLinearGradient(0, py(b.z) - 0.42 * RW * sc(b.z), 0, py(b.z));
    fg.addColorStop(0, pal[0]); fg.addColorStop(1, pal[3]);
    const r = box(-0.95, -0.4, b.z, 0.24, 0.42, fg, pal[1], pal[2]);
    ctx.strokeStyle = 'rgba(255,255,255,.9)'; ctx.lineWidth = Math.max(1, 2.5 * r.s);
    ctx.strokeRect(r.L + 1, r.T + 1, r.R - r.L - 2, r.B - r.T - 2);
    ctx.fillStyle = 'rgba(255,255,255,.18)';
    ctx.fillRect(r.L + 3 * r.s, r.T + 3 * r.s, (r.R - r.L) - 6 * r.s, (r.B - r.T) * 0.28);
    if (b.flash > 0) { ctx.fillStyle = `rgba(255,255,255,${b.flash * 0.45})`; ctx.fillRect(r.L, r.T, r.R - r.L, r.B - r.T); }
    const txt = b.kind === 'mul' ? '×' + b.v : (b.v > 0 ? '+' : '') + b.v;
    label(txt, (r.L + r.R) / 2, (r.T + r.B) / 2 + 2 * r.s, Math.max(7, 50 * r.s * (1 + b.flash * 0.15)));
    ctx.globalAlpha = 1;
  }

  function drawCrate(c) {
    if (c.z > C.ZFAR + 4) return;
    ctx.globalAlpha = fade(c.z);
    const ab = C.ABILITIES[c.ability];
    const jig = c.flash > 0 ? (Math.random() - 0.5) * 0.02 : 0;
    const r = box(0.43 + jig, 0.9 + jig, c.z, 0.34, 0.44, '#a86f37', '#d39b5c', '#7a4a20');
    const s = r.s, w = r.R - r.L, h = r.B - r.T;
    ctx.strokeStyle = '#6b4320'; ctx.lineWidth = Math.max(1, 3 * s);
    ctx.strokeRect(r.L + 2 * s, r.T + 2 * s, w - 4 * s, h - 4 * s);
    ctx.beginPath();
    ctx.moveTo(r.L + 4 * s, r.T + 4 * s); ctx.lineTo(r.R - 4 * s, r.B - 4 * s);
    ctx.moveTo(r.R - 4 * s, r.T + 4 * s); ctx.lineTo(r.L + 4 * s, r.B - 4 * s);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(60,35,15,.35)'; ctx.lineWidth = Math.max(0.5, 1.2 * s);
    ctx.beginPath(); for (let i = 1; i < 4; i++) { const y = r.T + h * i / 4; ctx.moveTo(r.L, y); ctx.lineTo(r.R, y); } ctx.stroke();
    ctx.fillStyle = '#d9c38f';
    [[r.L + 5 * s, r.T + 5 * s], [r.R - 5 * s, r.T + 5 * s], [r.L + 5 * s, r.B - 5 * s], [r.R - 5 * s, r.B - 5 * s]].forEach(([x, y]) => { ctx.beginPath(); ctx.arc(x, y, Math.max(0.8, 2.4 * s), 0, TAU); ctx.fill(); });
    if (c.flash > 0) { ctx.fillStyle = `rgba(255,255,255,${c.flash * 0.35})`; ctx.fillRect(r.L, r.T, w, h); }
    // badge showing what's inside
    const bx = (r.L + r.R) / 2, by = r.T - 18 * s - Math.sin(clock * 3 + c.z) * 2 * s, br = Math.max(4, 15 * s);
    const glow = ctx.createRadialGradient(bx, by, 0, bx, by, br * 2.2);
    glow.addColorStop(0, ab.color + 'aa'); glow.addColorStop(1, ab.color + '00');
    ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(bx, by, br * 2.2, 0, TAU); ctx.fill();
    ctx.fillStyle = 'rgba(10,20,45,.85)'; ctx.beginPath(); ctx.arc(bx, by, br, 0, TAU); ctx.fill();
    ctx.strokeStyle = ab.color; ctx.lineWidth = Math.max(1, 2.5 * s); ctx.stroke();
    ctx.font = `${br * 1.2}px sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = '#fff'; ctx.fillText(ab.icon, bx, by + br * 0.06);
    const bw = w * 0.9, bh = Math.max(2.5, 6 * s), hy = r.T - 4 * s - bh;
    ctx.fillStyle = 'rgba(0,0,0,.55)'; rrect(bx - bw / 2, hy, bw, bh, bh / 2); ctx.fill();
    if (c.hp > 0) { ctx.fillStyle = ab.color; rrect(bx - bw / 2, hy, bw * Math.max(0.04, c.hp / c.maxHp), bh, bh / 2); ctx.fill(); }
    ctx.globalAlpha = 1;
  }

  function drawItem(it) {
    const ab = C.ABILITIES[it.ability];
    const s = sc(it.z), X = px(it.x, it.z), Y = py(it.z);
    const lift = (0.3 + Math.sin(it.t * 5) * 0.05) * RW * s;
    const R = 0.12 * RW * s;
    const bg = ctx.createLinearGradient(0, Y - 150 * s, 0, Y);
    bg.addColorStop(0, ab.color + '00'); bg.addColorStop(1, ab.color + '66');
    ctx.fillStyle = bg; ctx.fillRect(X - R * 0.8, Y - 150 * s, R * 1.6, 150 * s);
    ctx.strokeStyle = ab.color; ctx.lineWidth = Math.max(1, 3 * s);
    ctx.globalAlpha = 0.7;
    ctx.beginPath(); ctx.ellipse(X, Y, R * (1.3 + 0.2 * Math.sin(it.t * 6)), R * 0.45, 0, 0, TAU); ctx.stroke();
    ctx.globalAlpha = 1;
    const gl = ctx.createRadialGradient(X, Y - lift, 0, X, Y - lift, R * 2.4);
    gl.addColorStop(0, ab.color + 'cc'); gl.addColorStop(1, ab.color + '00');
    ctx.fillStyle = gl; ctx.beginPath(); ctx.arc(X, Y - lift, R * 2.4, 0, TAU); ctx.fill();
    const og = ctx.createRadialGradient(X - R * 0.35, Y - lift - R * 0.35, R * 0.1, X, Y - lift, R);
    og.addColorStop(0, '#ffffff'); og.addColorStop(0.35, ab.color); og.addColorStop(1, 'rgba(10,20,45,.9)');
    ctx.fillStyle = og; ctx.beginPath(); ctx.arc(X, Y - lift, R, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#fff'; ctx.lineWidth = Math.max(1, 2 * s); ctx.stroke();
    ctx.font = `${R * 1.1}px sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = '#fff'; ctx.fillText(ab.icon, X, Y - lift + R * 0.05);
    for (let i = 0; i < 3; i++) {
      const a = it.t * 3 + i * TAU / 3;
      ctx.beginPath(); ctx.arc(X + Math.cos(a) * R * 1.6, Y - lift + Math.sin(a) * R * 0.6, Math.max(1, 2 * s), 0, TAU); ctx.fill();
    }
    if (s > 0.45) label(ab.name, X, Y - lift - R * 1.9, 13 * s * 1.6, ab.color);
  }

  function drawEnemy(e) {
    if (e.z > C.ZFAR + 6) return;
    ctx.globalAlpha = fade(e.z);
    shadow(e.x, e.z, e.r);
    const f = Math.sin(e.walk) > 0 ? 1 : 0;
    if (e.type === 'grunt') drawSprite(SPR.grunt[f], e.x, e.z, e.r * 3.3, e.flash > 0.5);
    else if (e.type === 'brute') {
      drawSprite(SPR.brute[f], e.x, e.z, e.r * 3.1, e.flash > 0.5);
      if (e.hp < e.maxHp) {
        const s = sc(e.z), X = px(e.x, e.z), Y = py(e.z) - e.r * 3.3 * RW * s - 6 * s, w = e.r * RW * s * 2;
        ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.fillRect(X - w / 2, Y, w, Math.max(2, 4 * s));
        ctx.fillStyle = '#ff5a4f'; ctx.fillRect(X - w / 2, Y, w * Math.max(0, e.hp / e.maxHp), Math.max(2, 4 * s));
      }
    } else {
      const s = sc(e.z), X = px(e.x, e.z), Y = py(e.z), R = e.r * RW * s;
      const au = ctx.createRadialGradient(X, Y - R, 0, X, Y - R, R * 3);
      au.addColorStop(0, 'rgba(255,60,40,.35)'); au.addColorStop(1, 'rgba(255,60,40,0)');
      ctx.fillStyle = au; ctx.beginPath(); ctx.arc(X, Y - R, R * 3, 0, TAU); ctx.fill();
      drawSprite(SPR.boss[Math.sin(e.walk * 0.4) > 0 ? 1 : 0], e.x, e.z, e.r * 3.4, e.flash > 0.5);
    }
    ctx.globalAlpha = 1;
  }

  const FORM = [];
  for (let i = 0; i < 220; i++) { const a = i * 2.39996, d = Math.sqrt(i + 0.5); FORM.push([Math.cos(a) * d, Math.sin(a) * d]); }

  function drawSquadAt(sx, troops, walkT) {
    const n = Math.min(troops, 160);
    if (n <= 0) return;
    const r = C.squadRadius(troops);
    const k = r / Math.sqrt(n + 0.5);
    const pts = [];
    for (let i = 0; i < n; i++) pts.push({ x: sx + FORM[i][0] * k, z: 0.15 + FORM[i][1] * k * 0.6, i });
    pts.sort((a, b) => b.z - a.z);
    for (const p of pts) shadow(p.x, p.z, 0.05);
    for (const p of pts) drawSprite(SPR.soldier[Math.sin(walkT + p.i * 1.7) > 0 ? 1 : 0], p.x, p.z, 0.17, false);
  }

  function drawTroopBadge() {
    const X = px(run.sx, 0), Y = py(0) + 34;
    const txt = C.fmt(run.troops);
    ctx.font = "24px 'Black Han Sans', sans-serif";
    const w = Math.max(60, ctx.measureText(txt).width + 44);
    const g = ctx.createLinearGradient(0, Y - 17, 0, Y + 17);
    g.addColorStop(0, '#2f6fd6'); g.addColorStop(1, '#173f8c');
    ctx.fillStyle = 'rgba(0,0,0,.25)'; rrect(X - w / 2, Y - 15, w, 34, 17); ctx.fill();
    ctx.fillStyle = g; rrect(X - w / 2, Y - 17, w, 34, 17); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,.55)'; ctx.lineWidth = 1.5; ctx.stroke();
    const ix = X - w / 2 + 17, iy = Y;
    ctx.fillStyle = '#ffcc2e';
    ctx.beginPath(); ctx.moveTo(ix, iy - 8); ctx.lineTo(ix + 7, iy - 5); ctx.lineTo(ix + 6, iy + 3); ctx.lineTo(ix, iy + 8); ctx.lineTo(ix - 6, iy + 3); ctx.lineTo(ix - 7, iy - 5); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(txt, X + 9, Y + 1);
  }

  function drawArrows() {
    ctx.lineCap = 'round';
    for (const a of run.arrows) {
      const z0 = a.z, z1 = a.z + 0.75, x1 = a.x + a.vx * 0.75;
      const s0 = sc(z0), s1 = sc(z1);
      const X0 = px(a.x, z0), Y0 = py(z0) - 0.14 * RW * s0, X1 = px(x1, z1), Y1 = py(z1) - 0.14 * RW * s1;
      if (a.kind !== 'normal') {
        ctx.strokeStyle = a.kind === 'fire' ? 'rgba(255,110,20,.55)' : 'rgba(170,120,255,.5)';
        ctx.lineWidth = Math.max(2, 9 * s0);
        ctx.beginPath(); ctx.moveTo(X0, Y0); ctx.lineTo(X1, Y1); ctx.stroke();
      }
      ctx.strokeStyle = '#8a5a2b'; ctx.lineWidth = Math.max(0.8, 2.2 * s0);
      ctx.beginPath(); ctx.moveTo(X0, Y0); ctx.lineTo(X1, Y1); ctx.stroke();
      ctx.fillStyle = a.kind === 'fire' ? '#ffd27a' : '#f2f5fa';
      ctx.beginPath(); ctx.arc(X1, Y1, Math.max(0.8, 2.4 * s1), 0, TAU); ctx.fill();
      ctx.strokeStyle = '#ffffff'; ctx.lineWidth = Math.max(0.8, 2.6 * s0);
      ctx.beginPath(); ctx.moveTo(X0 - 2.5 * s0, Y0 + 1); ctx.lineTo(X0 + 2.5 * s0, Y0 + 1); ctx.stroke();
    }
  }

  function drawFx() {
    for (const f of run.fx) {
      if (f.kind === 'banner') continue;
      const p = f.t / f.life;
      const s = sc(f.z), X = px(f.x, f.z), Y = py(f.z);
      if (f.kind === 'text') {
        const fs = (f.big ? 38 : f.small ? 15 : 22) * clamp(s * 1.2, 0.55, 1.3);
        ctx.globalAlpha = 1 - p * p;
        const pop = p < 0.12 ? 0.6 + p / 0.12 * 0.4 : 1;
        label(f.text, X, Y - 40 * s - p * 46, fs * pop, f.color);
        ctx.globalAlpha = 1;
      } else if (f.kind === 'burst') {
        const rnd = srand(Math.floor(f.seed || 1));
        const n = f.big ? 16 : 7;
        ctx.fillStyle = f.color;
        ctx.globalAlpha = 1 - p;
        for (let i = 0; i < n; i++) {
          const a = rnd() * TAU, v = (f.big ? 90 : 45) * (0.5 + rnd()) * s, t = f.t;
          const x = X + Math.cos(a) * v * t * 1.6, y = Y - 10 * s + Math.sin(a) * v * t * 0.8 - 60 * s * t + 140 * s * t * t;
          ctx.beginPath(); ctx.arc(x, y, Math.max(0.8, (f.big ? 5 : 3) * s * (1 - p * 0.7)), 0, TAU); ctx.fill();
        }
        if (p < 0.3) {
          ctx.globalAlpha = (0.3 - p) / 0.3 * 0.8;
          ctx.fillStyle = '#fff';
          ctx.beginPath(); ctx.arc(X, Y - 10 * s, (f.big ? 26 : 12) * s * (0.6 + p * 2), 0, TAU); ctx.fill();
        }
        ctx.globalAlpha = 1;
      } else if (f.kind === 'debris') {
        const rnd = srand(Math.floor(f.seed || 1));
        ctx.globalAlpha = 1 - p * p;
        for (let i = 0; i < 10; i++) {
          const a = -Math.PI * (0.1 + rnd() * 0.8), v = (60 + rnd() * 80) * s, t = f.t, spin = 6 + rnd() * 8;
          const x = X + Math.cos(a) * v * t, y = Y - 30 * s + Math.sin(a) * v * t + 260 * s * t * t;
          ctx.save(); ctx.translate(x, y); ctx.rotate(t * spin);
          ctx.fillStyle = i % 3 ? '#b07a3f' : '#7a4a20';
          ctx.fillRect(-6 * s, -2.5 * s, 12 * s, 5 * s);
          ctx.restore();
        }
        ctx.globalAlpha = 1;
      } else if (f.kind === 'bolt') {
        ctx.globalAlpha = 1 - p;
        const rnd = srand(Math.floor(f.seed || 1));
        ctx.strokeStyle = '#e9fbff'; ctx.lineWidth = 3; ctx.shadowColor = '#7fdcff'; ctx.shadowBlur = 12;
        ctx.beginPath();
        ctx.moveTo(X + (rnd() - 0.5) * 40, HOR);
        for (let i = 1; i <= 7; i++) ctx.lineTo(X + (i < 7 ? (rnd() - 0.5) * 26 : 0), HOR + (Y - 12 * s - HOR) * i / 7);
        ctx.stroke();
        ctx.shadowBlur = 0;
        ctx.fillStyle = 'rgba(200,240,255,.7)';
        ctx.beginPath(); ctx.ellipse(X, Y, 22 * s + 4, (22 * s + 4) * 0.45, 0, 0, TAU); ctx.fill();
        ctx.globalAlpha = 1;
      } else if (f.kind === 'ring') {
        ctx.globalAlpha = 1 - p;
        ctx.strokeStyle = f.color; ctx.lineWidth = 4 * (1 - p) + 1;
        ctx.beginPath(); ctx.ellipse(X, Y, 28 + p * 90, (28 + p * 90) * 0.4, 0, 0, TAU); ctx.stroke();
        ctx.globalAlpha = 1;
      }
    }
  }

  function drawBanners() {
    for (const f of run.fx) {
      if (f.kind !== 'banner') continue;
      const p = f.t / f.life;
      const a = p < 0.12 ? p / 0.12 : p > 0.75 ? (1 - p) / 0.25 : 1;
      const sl = p < 0.12 ? (1 - p / 0.12) * 30 : 0;
      ctx.globalAlpha = a;
      const y = 196;
      ctx.fillStyle = 'rgba(8,18,40,.82)'; rrect(W / 2 - 130 + sl, y - 26, 260, 52, 18); ctx.fill();
      ctx.strokeStyle = f.color; ctx.lineWidth = 2; ctx.stroke();
      ctx.font = "13px 'Noto Sans KR', sans-serif"; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillStyle = 'rgba(255,255,255,.7)'; ctx.fillText('특수능력 획득', W / 2 + sl, y - 11);
      label(f.text, W / 2 + sl, y + 9, 24, f.color);
      ctx.globalAlpha = 1;
    }
  }

  function drawHud() {
    // stage pill
    ctx.fillStyle = 'rgba(8,20,44,.62)'; rrect(12, 12, 120, 38, 13); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,.14)'; ctx.lineWidth = 1; ctx.stroke();
    ctx.fillStyle = '#ffcc2e';
    ctx.fillRect(24, 21, 2, 20);
    ctx.beginPath(); ctx.moveTo(26, 22); ctx.lineTo(37, 26); ctx.lineTo(26, 30); ctx.fill();
    ctx.font = "19px 'Black Han Sans', sans-serif"; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillStyle = '#fff'; ctx.fillText('STAGE ' + run.L, 43, 32);
    // gold
    const gold = C.fmt(save.gold + (mode === 'play' || mode === 'ending' || mode === 'pause' ? run.goldEarned : 0));
    const gw = ctx.measureText(gold).width + 44;
    ctx.fillStyle = 'rgba(8,20,44,.62)'; rrect(140, 12, gw, 38, 13); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,.14)'; ctx.stroke();
    const cg = ctx.createRadialGradient(156, 28, 1, 159, 31, 9);
    cg.addColorStop(0, '#fff3b0'); cg.addColorStop(0.5, '#ffcc2e'); cg.addColorStop(1, '#c98a00');
    ctx.fillStyle = cg; ctx.beginPath(); ctx.arc(159, 31, 8.5, 0, TAU); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.fillText(gold, 174, 32);

    // progress / boss bar
    const bx = 16, bw = W - 32, by = 60;
    if (run.boss && run.boss.alive) {
      const b = run.boss;
      ctx.fillStyle = 'rgba(8,10,20,.7)'; rrect(bx, by, bw, 22, 11); ctx.fill();
      const g = ctx.createLinearGradient(0, by, 0, by + 22);
      g.addColorStop(0, '#ff6a55'); g.addColorStop(1, '#b3221a');
      ctx.fillStyle = g; rrect(bx + 3, by + 3, Math.max(10, (bw - 6) * b.hp / b.maxHp), 16, 8); ctx.fill();
      label('적장  ' + C.fmt(Math.max(0, b.hp)), W / 2, by + 11.5, 14);
    } else {
      ctx.fillStyle = 'rgba(8,20,44,.55)'; rrect(bx, by + 4, bw, 12, 6); ctx.fill();
      const g = ctx.createLinearGradient(bx, 0, bx + bw, 0);
      g.addColorStop(0, '#ffe27a'); g.addColorStop(1, '#f0a210');
      ctx.fillStyle = g; rrect(bx + 2, by + 6, Math.max(8, (bw - 4) * C.progress(run)), 8, 4); ctx.fill();
      // boss marker (skull)
      const mx = bx + bw - 4, my = by + 10;
      ctx.fillStyle = '#b3221a'; ctx.beginPath(); ctx.arc(mx, my, 10, 0, TAU); ctx.fill();
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke();
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(mx, my - 1.5, 4.5, 0, TAU); ctx.fill();
      ctx.fillRect(mx - 3, my + 1, 6, 4);
      ctx.fillStyle = '#b3221a'; ctx.fillRect(mx - 3, my - 2.5, 2, 2); ctx.fillRect(mx + 1, my - 2.5, 2, 2);
    }
    // active abilities
    let ax = 16;
    for (const k in run.abilities) {
      const left = run.abilities[k];
      if (left <= 0) continue;
      const ab = C.ABILITIES[k];
      ctx.fillStyle = 'rgba(8,20,44,.7)'; rrect(ax, 90, 66, 32, 11); ctx.fill();
      ctx.strokeStyle = ab.color; ctx.lineWidth = 1.5; ctx.stroke();
      ctx.save(); rrect(ax, 90, 66, 32, 11); ctx.clip();
      ctx.globalAlpha = 0.25; ctx.fillStyle = ab.color;
      ctx.fillRect(ax, 90, 66 * Math.min(1, left / run.st.skillTime), 32);
      ctx.restore(); ctx.globalAlpha = 1;
      ctx.font = '16px sans-serif'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
      ctx.fillStyle = '#fff'; ctx.fillText(ab.icon, ax + 7, 107);
      ctx.font = "16px 'Black Han Sans', sans-serif";
      ctx.fillText(Math.ceil(left) + 's', ax + 32, 107);
      ax += 72;
    }
  }

  // =====================================================================
  // render + loop
  // =====================================================================
  function render() {
    const k = canvas.width / W;
    ctx.setTransform(k, 0, 0, k, 0, 0);
    if (view3d) {
      ctx.clearRect(0, 0, W, H);
      view3d.render(run, clock);
      if (run) {
        drawFx();
        if (run.troops > 0) drawTroopBadge();
        drawBanners(); drawHud();
        ctx.font = "11px 'Noto Sans KR', sans-serif"; ctx.textAlign = 'center';
        ctx.fillStyle = 'rgba(15,35,48,.72)';
        ctx.fillText('병력 증강', 72, H - 23); ctx.fillText('적 군단', 210, H - 23); ctx.fillText('특수 무기', 348, H - 23);
      }
      return;
    }
    if (run && run.shake > 0) {
      const m = run.shake * 10;
      ctx.translate((Math.random() - 0.5) * m, (Math.random() - 0.5) * m);
    }
    drawWorld();
    if (!run) {
      drawSquadAt(Math.sin(clock * 0.7) * 0.25, 24, clock * 9);
      ctx.setTransform(k, 0, 0, k, 0, 0);
      ctx.drawImage(vignette(), 0, 0, W, H);
      return;
    }
    const list = [];
    for (const b of run.blocks) list.push({ z: b.z + 0.24, f: () => drawBlock(b) });
    for (const c of run.crates) list.push({ z: c.z + 0.3, f: () => drawCrate(c) });
    for (const it of run.items) list.push({ z: it.z, f: () => drawItem(it) });
    for (const e of run.enemies) list.push({ z: e.z, f: () => drawEnemy(e) });
    list.sort((a, b) => b.z - a.z);
    const cut = 0.15 + C.squadRadius(run.troops) * 0.6;
    for (const it of list) if (it.z > cut) it.f();
    drawArrows();
    drawSquadAt(run.sx, run.troops, clock * 12);
    for (const it of list) if (it.z <= cut) it.f();
    drawFx();
    ctx.setTransform(k, 0, 0, k, 0, 0);
    ctx.drawImage(vignette(), 0, 0, W, H);
    if (run.troops > 0) drawTroopBadge();
    drawBanners();
    drawHud();
  }

  function frame(now) {
    const dt = Math.min(1 / 30, (now - last) / 1000);
    last = now;
    clock += dt;
    if (mode === 'play' && run) {
      const kv = (keys['arrowleft'] || keys['a'] ? -1 : 0) + (keys['arrowright'] || keys['d'] ? 1 : 0);
      if (kv) run.targetX += kv * 2.6 * dt;
      C.update(run, dt);
      if (run.state !== 'play') {
        mode = 'ending';
        $('pauseBtn').classList.remove('show');
        setTimeout(endRun, run.state === 'win' ? 1000 : 700);
      }
    } else if (mode === 'ending' && run) {
      C.update(run, dt);
    }
    render();
    requestAnimationFrame(frame);
  }

  // read-only hook for automated testing
  window.__lane = { get run() { return run; }, get mode() { return mode; }, get graphics() { return view3d ? '3d' : '2d'; }, get renderInfo() { return view3d && view3d.info; } };

  resize();
  refreshMenu();
  showOverlay('menu');
  requestAnimationFrame(t => { last = t; frame(t); });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(resize);
})();

