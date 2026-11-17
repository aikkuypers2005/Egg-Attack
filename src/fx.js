// Visual effects: dust, bite arcs, sparks, splashes, rings for roars and calls, and the two endings.
(function () {
  const DINO = window.DINO = window.DINO || {};
  const FX = DINO.fx = {};

  let parts = [], rings = [], arcs = [], lastSeenEv = 0;

  FX.reset = function () { parts = []; rings = []; arcs = []; lastSeenEv = 0; };

  function burst(x, y, count, cols, vxRange, vyMin, vyMax, life) {
    for (let i = 0; i < count; i++) {
      if (parts.length > 260) parts.shift();
      parts.push({
        x: x + (Math.random() - 0.5) * 8, y: y + (Math.random() - 0.5) * 6,
        vx: (Math.random() - 0.5) * vxRange, vy: vyMin + Math.random() * (vyMax - vyMin),
        col: cols[(Math.random() * cols.length) | 0], sz: Math.random() < 0.35 ? 3 : 2,
        life: life + ((Math.random() * 14) | 0), grav: 0.14
      });
    }
  }

  // Turns new game events into effects. e.v carries a direction or a tier for some events.
  FX.syncEvents = function (S) {
    if (!S || !S.evs) return;
    if (S.evN < lastSeenEv) lastSeenEv = 0;
    for (let i = 0; i < S.evs.length; i++) {
      const e = S.evs[i];
      if (e.n <= lastSeenEv) continue;
      lastSeenEv = e.n;
      const x = e.x || 0, y = e.y || 210, s = e.s;
      if (s === 'bite') { burst(x, y, 5, ['#fff8c0', '#f8d040'], 2.4, -1.6, 0.8, 10); arcs.push({ x, y, dir: e.v || 1, life: 8, col: '#fff8c0' }); }
      else if (s === 'slash') arcs.push({ x, y, dir: e.v || 1, life: 10, col: '#ff6a4a' });
      else if (s === 'sweep') { rings.push({ x, y, r: 6, maxR: 60, col: '#ff6a4a' }); burst(x, y + 6, 12, ['#e0cca8', '#b89868'], 5, -1.8, 0, 16); }
      else if (s === 'hit' || s === 'phit') burst(x, y, 9, ['#ff5242', '#f8d040', '#ffffff'], 3.2, -2.6, 0.4, 16);
      else if (s === 'kill') burst(x, y, 16, ['#ff4838', '#d83028', '#f8b040'], 4.0, -3.4, -0.4, 24);
      else if (s === 'clang') burst(x, y, 6, ['#e0e8ff', '#a8b8d8'], 2.8, -2.2, 0.2, 12);
      else if (s === 'interrupt') burst(x, y, 8, ['#ffffff', '#ffe858'], 3.4, -2.6, -0.2, 14);
      else if (s === 'feed' || s === 'hatch') burst(x, y, 12, ['#68e868', '#f8e050', '#ffffff'], 3.0, -3.2, -0.5, 22);
      else if (s === 'meal') { burst(x, y, 20, ['#48d8f0', '#68e868', '#ffffff'], 3.6, -3.6, -0.6, 28); rings.push({ x, y, r: 4, maxR: 36, col: '#48d8f0' }); }
      else if (s === 'steal') burst(x, y, 10, ['#f4b438', '#ffffff'], 3.0, -3.4, -1.0, 20);
      else if (s === 'splash') burst(x, y, 14, ['#88e8ff', '#48b8e8', '#ffffff'], 3.4, -3.6, -0.8, 22);
      else if (s === 'spit') burst(x, y, 6, ['#68f038', '#c8ff80'], 2.0, -1.5, 0.5, 14);
      else if (s === 'skid') burst(x, y, 18, ['#e0cca8', '#b89868', '#8c6e46'], 5.5, -2.0, 0, 22);
      else if (s === 'stomp') { burst(x, y, 14, ['#b89868', '#8c6e46', '#e0cca8'], 4.4, -2.4, -0.2, 20); rings.push({ x, y: y - 4, r: 4, maxR: 46, col: '#e0cca8' }); }
      else if (s === 'roar' || s === 'rage') rings.push({ x, y, r: 6, maxR: 95, col: '#ff5840' });
      else if (s === 'call') rings.push({ x, y, r: 5, maxR: 75, col: '#58e8d8' });
      else if (s === 'babyhit') burst(x, y, 10, ['#ff3838', '#ffa040'], 3.0, -2.8, 0.2, 18);
      else if (s === 'bossdown') { burst(x, y, 40, ['#ffe858', '#ffffff', '#68e868', '#48d8f0'], 7, -4.5, -1, 40); rings.push({ x, y, r: 8, maxR: 120, col: '#ffe858' }); }
    }
  };

  FX.tick = function (S) {
    FX.syncEvents(S);
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i];
      p.x += p.vx; p.y += p.vy; p.vy += p.grav;
      if (--p.life <= 0) parts.splice(i, 1);
    }
    for (let i = rings.length - 1; i >= 0; i--) {
      rings[i].r += 3.2;
      if (rings[i].r >= rings[i].maxR) rings.splice(i, 1);
    }
    for (let i = arcs.length - 1; i >= 0; i--) if (--arcs[i].life <= 0) arcs.splice(i, 1);

    if (S && S.mode === 'finale') {
      if (S.ending === 'volcano') {
        for (let i = 0; i < 4; i++) {
          parts.push({
            x: (Math.random() - 0.5) * 60, y: 95 + Math.random() * 14,
            vx: (Math.random() - 0.5) * 4.8, vy: -3.2 - Math.random() * 3.4,
            col: ['#ffec60', '#ff7820', '#e02818', '#483838'][(Math.random() * 4) | 0],
            sz: Math.random() < 0.4 ? 4 : 2, life: 48, grav: 0.11
          });
        }
      } else if (S.ending === 'meteor' && S.finaleT >= 118 && S.finaleT <= 145) {
        for (let i = 0; i < 10; i++) {
          parts.push({
            x: 60 + (Math.random() - 0.5) * 50, y: 165 + (Math.random() - 0.5) * 20,
            vx: (Math.random() - 0.5) * 7.5, vy: -4.8 - Math.random() * 3.5,
            col: ['#ffffff', '#ffea68', '#ff6420', '#7a4430'][(Math.random() * 4) | 0],
            sz: Math.random() < 0.5 ? 4 : 3, life: 55, grav: 0.12
          });
        }
      }
    }
  };

  FX.drawWorld = function (ctx, camX, vw) {
    const half = vw >> 1;
    for (let i = 0; i < rings.length; i++) {
      const r = rings[i];
      const sx = Math.round(r.x - camX + half), sy = Math.round(r.y);
      if (sx < -130 || sx > vw + 130) continue;
      ctx.strokeStyle = r.col;
      ctx.lineWidth = 2;
      ctx.strokeRect(Math.round(sx - r.r), Math.round(sy - r.r * 0.45), Math.round(r.r * 2), Math.round(r.r * 0.9));
    }
    // Bite arcs: a small pixel crescent that opens towards the bite direction.
    for (let i = 0; i < arcs.length; i++) {
      const a = arcs[i];
      const sx = Math.round(a.x - camX + half), sy = Math.round(a.y);
      if (sx < -20 || sx > vw + 20) continue;
      const grow = 10 - a.life, d = a.dir || 1;
      ctx.fillStyle = a.col;
      for (let k = -3; k <= 3; k++) {
        const bend = 4 - Math.abs(k);
        ctx.fillRect(sx + d * (bend + grow), sy + k * 3, 2, 3);
      }
    }
    for (let i = 0; i < parts.length; i++) {
      const p = parts[i];
      const sx = Math.round(p.x - camX + half), sy = Math.round(p.y);
      if (sx < -8 || sx > vw + 8) continue;
      ctx.fillStyle = p.col;
      ctx.fillRect(sx, sy, p.sz, p.sz);
    }
  };

  // Things drawn on the sky during the endings: the meteor and its flash, or the glow of the volcano.
  FX.drawFinaleSky = function (ctx, S, W, H) {
    if (!S || S.mode !== 'finale') return;
    const t = S.finaleT;
    if (S.ending === 'meteor') {
      ctx.fillStyle = 'rgba(36, 8, 24, ' + Math.min(0.55, t * 0.005) + ')';
      ctx.fillRect(0, 0, W, H);
      if (t < 122) {
        const p = t / 120;
        const mx = Math.round(430 - p * 175), my = Math.round(-24 + p * 192);
        for (let k = 8; k >= 1; k--) {
          ctx.fillStyle = k > 5 ? '#7c2020' : k > 2 ? '#ff6a18' : '#ffe858';
          const sz = Math.max(4, 24 - k * 2);
          ctx.fillRect(mx + k * 9 - (sz >> 1), my - k * 9 - (sz >> 1), sz, sz);
        }
        ctx.fillStyle = '#4a2820'; ctx.fillRect(mx - 13, my - 13, 26, 26);
        ctx.fillStyle = '#ff7820'; ctx.fillRect(mx - 10, my - 10, 20, 20);
        ctx.fillStyle = '#fff6b0'; ctx.fillRect(mx - 6, my - 6, 12, 12);
      } else {
        // the shock wave: a low dome of fire spreading along the ground from where the meteor hit
        const r = Math.min(340, (t - 120) * 5);
        for (let k = 0; k < 5; k++) {
          const half = r * (1 - k * 0.19), hh = Math.max(2, r * 0.07);
          ctx.fillStyle = 'rgba(255, ' + (120 + k * 26) + ', 32, ' + (0.30 + k * 0.08).toFixed(2) + ')';
          ctx.fillRect(Math.round(255 - half), Math.round(216 - (k + 1) * hh), Math.round(half * 2), Math.ceil(hh));
        }
        if (t < 146) {
          ctx.fillStyle = 'rgba(255, 248, 220, ' + Math.max(0, 1 - (t - 120) / 26).toFixed(2) + ')';
          ctx.fillRect(0, 0, W, H);
        }
      }
    } else if (S.ending === 'volcano') {
      ctx.fillStyle = 'rgba(255, 84, 16, ' + (0.12 + 0.08 * Math.sin(t * 0.2)).toFixed(2) + ')';
      ctx.fillRect(0, 0, W, H);
      if (t >= 118 && t < 138) {
        ctx.fillStyle = 'rgba(255, 220, 140, ' + Math.max(0, 0.75 - (t - 118) / 25).toFixed(2) + ')';
        ctx.fillRect(0, 0, W, H);
      }
    }
  };
})();
