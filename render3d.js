// Real WebGL scene. Gameplay coordinates remain owned by LaneCore.
(function () {
  'use strict';
  window.createLane3D = function (canvas) {
    const T = window.THREE;
    if (!T) return null;
    let renderer;
    try { renderer = new T.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' }); }
    catch (_) { return null; }
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.5));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = T.PCFSoftShadowMap;
    renderer.outputColorSpace = T.SRGBColorSpace;
    renderer.toneMapping = T.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.3;
    const scene = new T.Scene();
    scene.background = new T.Color('#b7dfed');
    scene.fog = new T.Fog('#b7dfed', 65, 180);
    const camera = new T.PerspectiveCamera(48, 420 / 760, 0.1, 240);
    camera.position.set(0, 25, 32); camera.lookAt(0, 0, -22);
    const hemi = new T.HemisphereLight('#e9f7ff', '#86785d', 2.0); scene.add(hemi);
    const sun = new T.DirectionalLight('#fff2d6', 3.3);
    sun.position.set(-18, 32, 8); sun.target.position.set(0, 0, -15);
    sun.castShadow = true; sun.shadow.mapSize.set(1024, 1024);
    Object.assign(sun.shadow.camera, { left: -19, right: 19, top: 35, bottom: -24, near: 1, far: 85 });
    sun.shadow.bias = -0.001; sun.shadow.normalBias = 0.04; scene.add(sun, sun.target);
    const mats = new Map();
    function mat(color, metal = 0) {
      const key = color + ':' + metal;
      if (!mats.has(key)) mats.set(key, new T.MeshStandardMaterial({ color, roughness: metal ? 0.38 : 0.85, metalness: metal }));
      return mats.get(key);
    }
    const box = new T.BoxGeometry(1, 1, 1);
    const sphere = new T.SphereGeometry(1, 10, 8);
    const cone = new T.ConeGeometry(1, 1, 6);
    function mesh(geo, material, x, y, z, sx, sy, sz, parent = scene) {
      const m = new T.Mesh(geo, material); m.position.set(x, y, z); m.scale.set(sx, sy, sz);
      m.castShadow = true; m.receiveShadow = true; parent.add(m); return m;
    }
    function cube(color, x, y, z, sx, sy, sz, parent) { return mesh(box, mat(color), x, y, z, sx, sy, sz, parent); }
    const sea = cube('#2eabb9', 0, -1.5, -50, 240, 0.3, 240); sea.castShadow = false;
    cube('#ac9777', 0, -0.8, -55, 20.5, 1.4, 130);
    for (let i = -1; i <= 1; i++) cube(['#a9cbd2', '#d6c4a5', '#d8c798'][i + 1], i * 6, -0.06, -55, 5.94, 0.2, 130);
    for (const x of [-3, 3]) cube('#f4e8cf', x, 0.04, -55, 0.09, 0.08, 130);
    const paving = new T.Group(); scene.add(paving);
    for (let i = 0; i < 48; i++) cube('#b3a78f', 0, 0.048, -i * 2.5, 18, 0.015, 0.035, paving);
    const battlements = new T.Group(); scene.add(battlements);
    for (const side of [-1, 1]) {
      cube('#d9c7a7', side * 9.75, 0.32, -55, 1.45, 0.85, 130);
      cube('#f2e3c6', side * 9.75, 0.78, -55, 1.6, 0.16, 130);
      for (let i = 0; i < 48; i++) cube('#e4d4b5', side * 9.75, 1.15, -i * 2.5, 1.35, 0.65, 0.9, battlements);
      for (let i = 0; i < 7; i++) {
        const z = -i * 16 - 8;
        cube('#6a594a', side * 10.2, 2.5, z, 0.13, 4, 0.13);
        cube(side < 0 ? '#327bbb' : '#b77c32', side * 10.2 - side * 0.6, 3.35, z, 1.2, 1.35, 0.1);
        cube('#f6da91', side * 10.2 - side * 0.6, 3.35, z + 0.06, 0.1, 0.9, 0.05);
      }
    }
    // Low-poly islands, pines and the fortress beyond the bridge.
    const islandGeometry = new T.DodecahedronGeometry(1, 0);
    for (let i = 0; i < 20; i++) {
      const side = i % 2 ? -1 : 1, x = side * (20 + (i * 7 % 30)), z = -12 - i * 5;
      mesh(islandGeometry, mat('#718f7c'), x, -0.6, z, 6, 2.5, 7);
      for (let j = 0; j < 3; j++) {
        cube('#695544', x + j * 1.4, 1.4, z, 0.25, 2, 0.25);
        mesh(cone, mat('#477b6d'), x + j * 1.4, 3.0, z, 1.2, 3.7, 1.2);
      }
    }
    cube('#bfbaa6', 0, 3, -98, 27, 6, 6);
    for (const x of [-13, -6, 6, 13]) {
      mesh(new T.CylinderGeometry(2.2, 2.8, 11, 8), mat('#d1cab3'), x, 5, -97, 1, 1, 1);
      mesh(cone, mat('#497a99'), x, 12, -97, 3.1, 5, 3.1);
    }
    cube('#777c73', 0, 2.2, -94.8, 4, 4.4, 0.3);
    for (let i = 0; i < 16; i++) cube('#dbd3bc', -13 + i * 1.7, 6.4, -95, 0.85, 1.2, 1.1);
    const waves = [];
    for (let i = 0; i < 45; i++) {
      const m = cube('#83d2d4', (i % 2 ? -1 : 1) * (14 + i * 13 % 38), -1.27, -i * 2.8, 1 + i % 4, 0.015, 0.09);
      m.castShadow = false; waves.push(m);
    }
    // Each body part is instanced: a large army has a bounded number of draw calls.
    const dummy = new T.Object3D(), tint = new T.Color();
    // Batch the static scenery too; retain independently animated water strips.
    function batch(parent) {
      const groups = new Map();
      for (const m of parent.children.slice()) {
        if (!m.isMesh || waves.includes(m)) continue;
        const key = m.geometry.uuid + ':' + m.material.uuid;
        if (!groups.has(key)) groups.set(key, []); groups.get(key).push(m);
      }
      for (const list of groups.values()) {
        if (list.length < 2) continue;
        const merged = new T.InstancedMesh(list[0].geometry, list[0].material, list.length);
        merged.castShadow = list[0].castShadow; merged.receiveShadow = true;
        list.forEach((m, i) => { m.updateMatrix(); merged.setMatrixAt(i, m.matrix); parent.remove(m); });
        merged.computeBoundingSphere(); parent.add(merged);
      }
    }
    batch(scene); batch(paving); batch(battlements);
    const parts = [
      [box, [0, .68, 0], [.48, .55, .32], 'armor'],
      [sphere, [0, 1.12, 0], [.23, .23, .23], 'skin'],
      [sphere, [0, 1.25, 0], [.27, .18, .27], 'steel'],
      [box, [0, 1.41, 0], [.09, .25, .25], 'armor'],
      [box, [-.32, .91, 0], [.23, .16, .38], 'steel'],
      [box, [.32, .91, 0], [.23, .16, .38], 'steel'],
      [box, [-.16, .24, 0], [.17, .46, .19], 'boots'],
      [box, [.16, .24, 0], [.17, .46, .19], 'boots'],
      [box, [0, .67, .20], [.48, .60, .06], 'cape'],
      [box, [.4, .75, -.13], [.07, .9, .07], 'weapon'],
      [box, [0, .50, -.19], [.48, .07, .07], 'gold'],
      [box, [0, 1.15, -.23], [.31, .06, .045], 'eyes']
    ].map(([geo, pos, scale, color]) => {
      const m = new T.InstancedMesh(geo, mat('#ffffff', color === 'steel' ? .5 : 0), 1600);
      m.instanceMatrix.setUsage(T.DynamicDrawUsage); m.castShadow = true; m.frustumCulled = false; scene.add(m);
      return { m, pos, scale, color };
    });
    const palettes = {
      soldier: { armor:'#287fcd', skin:'#e6bd94', steel:'#c9e2ed', boots:'#294860', cape:'#165696', weapon:'#d9b26f', gold:'#f4d273', eyes:'#476678' },
      grunt: { armor:'#b54a40', skin:'#b99874', steel:'#756766', boots:'#493b3b', cape:'#813637', weapon:'#c7d0d0', gold:'#d3aa6a', eyes:'#ffe4ac' },
      brute: { armor:'#904333', skin:'#967c60', steel:'#535c69', boots:'#302d37', cape:'#693338', weapon:'#bdac90', gold:'#d6a952', eyes:'#ffd556' },
      boss: { armor:'#a83d30', skin:'#a98065', steel:'#394e61', boots:'#293341', cape:'#5e2631', weapon:'#f1cf8a', gold:'#ffdb6f', eyes:'#ffef75' }
    };
    let count = 0;
    let bowCount = 0;
    const bows = new T.InstancedMesh(new T.TorusGeometry(.4, .04, 4, 10, Math.PI), mat('#9e794e'), 120);
    bows.frustumCulled = false; scene.add(bows);
    function actor(type, x, z, scale, phase, flash) {
      if (count >= 1600 || z > 70) return;
      const enemy = type !== 'soldier', yaw = enemy ? 0 : Math.PI;
      const bob = Math.sin(phase * 2) * .035;
      for (let p = 0; p < parts.length; p++) {
        const { m, pos, scale: s, color } = parts[p];
        const dz = p === 6 ? Math.sin(phase) * .12 : p === 7 ? -Math.sin(phase) * .12 : 0;
        dummy.position.set(x * 9 + pos[0] * scale * (enemy ? 1 : -1), (pos[1] + bob) * scale, -z * .65 + (pos[2] + dz) * scale * (enemy ? 1 : -1));
        dummy.rotation.set((p === 6 || p === 7) ? Math.sin(phase + (p === 7 ? Math.PI : 0)) * .35 : 0, yaw, 0);
        dummy.scale.set(s[0] * scale, s[1] * scale, s[2] * scale);
        if (!enemy && p === 9) dummy.scale.set(0, 0, 0);
        dummy.updateMatrix(); m.setMatrixAt(count, dummy.matrix);
        tint.set(flash > .5 ? '#ffffff' : palettes[type][color]); m.setColorAt(count, tint);
      }
      if (!enemy && bowCount < 120) {
        dummy.position.set(x * 9 - .43 * scale, .77 * scale, -z * .65 - .2 * scale);
        dummy.rotation.set(0, 0, -Math.PI / 2); dummy.scale.setScalar(scale); dummy.updateMatrix(); bows.setMatrixAt(bowCount++, dummy.matrix);
      }
      count++;
    }
    const objects = new Map();
    function pooled(obj, factory) { if (!objects.has(obj)) { const m = factory(); scene.add(m); objects.set(obj, m); } return objects.get(obj); }
    function disposeObject(m) { scene.remove(m); m.traverse(n => { if (n.geometry && n.geometry.userData.dynamic) n.geometry.dispose(); if (n.material && n.material.userData.dynamic) { if (n.material.map) n.material.map.dispose(); n.material.dispose(); } }); }
    function textSprite(text, color) {
      const c = document.createElement('canvas'); c.width = 256; c.height = 128;
      const g = c.getContext('2d'); g.fillStyle = '#102b40'; g.fillRect(0, 0, 256, 128);
      g.strokeStyle = color; g.lineWidth = 10; g.strokeRect(5, 5, 246, 118);
      g.font = 'bold 66px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#ffffff'; g.fillText(text, 128, 68);
      const map = new T.CanvasTexture(c); map.colorSpace = T.SRGBColorSpace;
      const material = new T.SpriteMaterial({ map, depthTest: true }); material.userData.dynamic = true;
      const s = new T.Sprite(material); s.scale.set(4.6, 2.3, 1); return s;
    }
    const arrowMesh = new T.InstancedMesh(box, mat('#ffe8ac', .3), 1500); arrowMesh.frustumCulled = false; scene.add(arrowMesh);
    const shield = mesh(new T.SphereGeometry(1, 20, 12), new T.MeshBasicMaterial({color:'#70cde9', transparent:true, opacity:.17, depthWrite:false, wireframe:true}), 0, .3, 0, 3, 2, 2);
    shield.castShadow = false;
    const v = new T.Vector3();
    return {
      resize() { const r = canvas.getBoundingClientRect(); renderer.setSize(r.width, r.height, false); camera.aspect = r.width / r.height; camera.updateProjectionMatrix(); },
      project(x, z, y = 0) { v.set(x * 9, y, -z * .65).project(camera); return { x: (v.x + 1) * 210, y: (1 - v.y) * 380 }; },
      render(run, clock) {
        const scroll = run ? run.scroll : clock * 4;
        paving.position.z = scroll * .65 % 2.5; battlements.position.z = scroll * .65 % 2.5;
        waves.forEach((m, i) => { m.position.y = -1.27 + Math.sin(clock * 1.4 + i) * .03; });
        count = 0; bowCount = 0;
        const troops = run ? run.troops : 24, sx = run ? run.sx : Math.sin(clock * .4) * .2;
        const n = Math.min(troops, 120), radius = window.LaneCore.squadRadius(troops);
        for (let i = 0; i < n; i++) {
          const a = i * 2.39996, r = Math.sqrt((i + .5) / Math.max(n, 1)) * radius;
          actor('soldier', sx + Math.cos(a) * r, Math.sin(a) * r * 3, .85, clock * 10 + i, 0);
        }
        const live = new Set();
        if (run) {
          for (const e of run.enemies) actor(e.type, e.x, e.z, e.type === 'boss' ? 3.8 : e.type === 'brute' ? 1.6 : .82, e.walk, e.flash);
          for (const b of run.blocks) {
            if (b.used) continue; live.add(b);
            const label = b.kind === 'mul' ? '×' + b.v : (b.v >= 0 ? '+' : '') + b.v;
            if (objects.has(b) && objects.get(b).userData.label !== label) { disposeObject(objects.get(b)); objects.delete(b); }
            const m = pooled(b, () => {
              const g = new T.Group(), color = b.v < 0 ? '#bc5149' : '#39a3cf';
              cube(color, -2.65, 1.3, 0, .25, 2.6, .4, g); cube(color, 2.65, 1.3, 0, .25, 2.6, .4, g);
              cube(color, 0, 2.65, 0, 5.55, .25, .4, g);
              const s = textSprite(label, color); s.position.y = 1.55; g.add(s); g.userData.label = label; return g;
            }); m.position.set(-6, 0, -b.z * .65);
          }
          for (const c of run.crates) {
            live.add(c); const m = pooled(c, () => {
              const g = new T.Group(); cube('#98693d', 0, .85, 0, 2.6, 1.7, 1.7, g);
              for (const x of [-.9, .9]) cube('#e6bc61', x, .85, .88, .16, 1.8, .08, g);
              const s = textSprite(window.LaneCore.ABILITIES[c.ability].icon, '#e6bc61'); s.scale.set(1.5, .75, 1); s.position.set(0, 1, 1); g.add(s); return g;
            }); m.position.set(6, 0, -c.z * .65); m.scale.setScalar(1 + c.flash * .06);
          }
          for (const it of run.items) {
            live.add(it); const m = pooled(it, () => { const g = new T.OctahedronGeometry(.7); g.userData.dynamic = true; return mesh(g, mat(window.LaneCore.ABILITIES[it.ability].color, .5), 0, 0, 0, 1, 1, 1); });
            m.position.set(it.x * 9, 1.1 + Math.sin(it.t * 4) * .25, -it.z * .65); m.rotation.y = it.t * 2;
          }
        }
        for (const [o, m] of objects) if (!live.has(o)) { disposeObject(m); objects.delete(o); }
        for (const {m} of parts) { m.count = count; m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true; }
        bows.count = bowCount; bows.instanceMatrix.needsUpdate = true;
        const arrows = run ? run.arrows.slice(0, 1500) : []; arrowMesh.count = arrows.length;
        arrows.forEach((a, i) => {
          dummy.position.set(a.x * 9, .85, -a.z * .65); dummy.rotation.set(0, -Math.atan(a.vx * 9 / .65), 0); dummy.scale.set(.045, .045, .6); dummy.updateMatrix(); arrowMesh.setMatrixAt(i, dummy.matrix);
          tint.set(a.kind === 'fire' ? '#ff812b' : a.kind === 'pierce' ? '#c493ff' : '#ffe8ac'); arrowMesh.setColorAt(i, tint);
        }); arrowMesh.instanceMatrix.needsUpdate = true; if (arrowMesh.instanceColor) arrowMesh.instanceColor.needsUpdate = true;
        shield.visible = !!(run && run.abilities.shield > 0); shield.position.x = sx * 9;
        shield.rotation.y = clock * .3;
        camera.position.x = run && run.shake > 0 ? Math.sin(clock * 65) * run.shake * .35 : 0;
        renderer.render(scene, camera);
      },
      get info() { return renderer.info; }
    };
  };
})();
