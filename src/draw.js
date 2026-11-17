// Drawing for Egg Attack: 480x270 pixel canvas. Backdrops, the scrolling world, creatures, the T-rexes,
// the split screen for several players on one computer, the top bar, and the end screens.
(function () {
  const DINO = window.DINO = window.DINO || {};
  const D = DINO.draw = {};

  let ctx = null;
  const BG = {};

  function mkCanvas(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, w);
    c.height = Math.max(1, h);
    return c;
  }

  function R(x, y, w, h, c) {
    ctx.fillStyle = c;
    ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
  }
  D.R = R;

  // ---------------------------------------------------------------- text
  // Each string is drawn once to a small canvas with hard edges, so it stays sharp when scaled.
  //   ps: the headline font (Press Start 2P at its own size of 8 px).
  //   vt: the small text. A built-in 5x7 pixel font: 6 px per character, in a line 16 px high.
  const FONTS = {
    ps: { css: "8px 'Press Start 2P'", h: 10, base: 9, big: "64px 'Press Start 2P'" },
    vt: { h: 16, top: 5, adv: 6 }
  };
  // The 5x7 font, characters 32 (space) to 126 (~). 5 columns per character, 2 hex digits per column,
  // the lowest bit is the top row. The letters g p q y are drawn 2 rows lower, so their tails hang under the line.
  const FONT5 =
    '0000000000' + '00005F0000' + '0007000700' + '147F147F14' + '242A7F2A12' + '2313086462' + '3649552250' + '0005030000' +
    '001C224100' + '0041221C00' + '14083E0814' + '08083E0808' + '0050300000' + '0808080808' + '0060600000' + '2010080402' +
    '3E5149453E' + '00427F4000' + '4261514946' + '2141454B31' + '1814127F10' + '2745454539' + '3C4A494930' + '0171090503' +
    '3649494936' + '064949291E' + '0036360000' + '0056360000' + '0814224100' + '1414141414' + '0041221408' + '0201510906' +
    '324979413E' + '7E1111117E' + '7F49494936' + '3E41414122' + '7F4141221C' + '7F49494941' + '7F09090901' + '3E4149497A' +
    '7F0808087F' + '00417F4100' + '2040413F01' + '7F08142241' + '7F40404040' + '7F020C027F' + '7F0408107F' + '3E4141413E' +
    '7F09090906' + '3E4151215E' + '7F09192946' + '4649494931' + '01017F0101' + '3F4040403F' + '1F2040201F' + '3F4038403F' +
    '6314081463' + '0708700807' + '6151494543' + '007F414100' + '0204081020' + '0041417F00' + '0402010204' + '4040404040' +
    '0001020400' + '2054545478' + '7F48444438' + '3844444420' + '384444487F' + '3854545418' + '087E090102' + '0E5151513E' +
    '7F08040478' + '00447D4000' + '2040443D00' + '7F10284400' + '00417F4000' + '7C04180478' + '7C08040478' + '3844444438' +
    '7F1111110E' + '0E1111117F' + '7C08040408' + '4854545420' + '043F444020' + '3C4040207C' + '1C2040201C' + '3C4030403C' +
    '4428102844' + '0F5050503F' + '4464544C44' + '0008364100' + '00007F0000' + '0041360800' + '0804081008';
  D.FONT5 = FONT5;
  const mcv = mkCanvas(4, 4), mctx = mcv.getContext('2d');
  let tcache = new Map();

  function rgb(col) {
    const n = parseInt(col.slice(1), 16);
    return col.length === 4 ? [((n >> 8) & 15) * 17, ((n >> 4) & 15) * 17, (n & 15) * 17] : [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  function measure(str, font) {
    if (font === 'vt') return String(str).length * FONTS.vt.adv;
    mctx.font = FONTS[font].css;
    return Math.ceil(mctx.measureText(str).width);
  }

  function textImg(str, font, col) {
    const key = font + col + str;
    let cv = tcache.get(key);
    if (cv) return cv;
    if (tcache.size > 900) tcache = new Map();
    const f = FONTS[font], w = measure(str, font) + 2;
    cv = mkCanvas(Math.max(1, w), f.h);
    const c = cv.getContext('2d'), k = rgb(col);
    const id = c.createImageData(cv.width, cv.height), d = id.data;
    if (font === 'vt') {
      for (let n = 0; n < str.length; n++) {
        let ch = str.charCodeAt(n);
        if (ch < 32 || ch > 126) ch = 63;
        for (let gx = 0; gx < 5; gx++) {
          const bits = parseInt(FONT5.substr((ch - 32) * 10 + gx * 2, 2), 16), drop = (ch === 103 || ch === 112 || ch === 113 || ch === 121) ? 2 : 0;
          for (let gy = 0; gy < 7; gy++) {
            if (!((bits >> gy) & 1)) continue;
            const i = ((f.top + drop + gy) * cv.width + 1 + n * f.adv + gx) * 4;
            d[i] = k[0]; d[i + 1] = k[1]; d[i + 2] = k[2]; d[i + 3] = 255;
          }
        }
      }
      c.putImageData(id, 0, 0);
      tcache.set(key, cv);
      return cv;
    }
    const z = f.big ? 8 : 1, bc = mkCanvas(cv.width * z, cv.height * z), b = bc.getContext('2d');
    b.font = f.big || f.css;
    b.textBaseline = 'alphabetic';
    b.fillStyle = '#fff';
    b.fillText(str, z, f.base * z);
    const src = b.getImageData(0, 0, bc.width, bc.height).data, half = z >> 1;
    for (let y = 0; y < cv.height; y++) {
      for (let x = 0; x < cv.width; x++) {
        if (src[((y * z + half) * bc.width + x * z + half) * 4 + 3] >= 128) {
          const i = (y * cv.width + x) * 4;
          d[i] = k[0]; d[i + 1] = k[1]; d[i + 2] = k[2]; d[i + 3] = 255;
        }
      }
    }
    c.putImageData(id, 0, 0);
    tcache.set(key, cv);
    return cv;
  }
  D.clearText = function () { tcache = new Map(); };

  function wrap(str, font, maxW) {
    const words = String(str).split(' '), lines = [];
    let line = '';
    for (const w of words) {
      const test = line ? line + ' ' + w : w;
      if (measure(test, font) > maxW && line) { lines.push(line); line = w; } else line = test;
    }
    if (line) lines.push(line);
    return lines;
  }

  // align: 0 left, 1 centre, 2 right.
  function T(str, x, y, col, font, align, scale, shadow) {
    if (!str) return 0;
    font = font || 'vt';
    scale = scale || 1;
    const img = textImg(String(str), font, col || '#ffffff');
    const w = img.width * scale;
    const dx = Math.round(align === 1 ? x - w / 2 : align === 2 ? x - w : x);
    if (shadow !== false) {
      const sh = textImg(String(str), font, '#0c0a16');
      ctx.drawImage(sh, dx + scale, Math.round(y) + scale, w, sh.height * scale);
    }
    ctx.drawImage(img, dx, Math.round(y), w, img.height * scale);
    return w;
  }
  D.T = T;

  D.init = function (drawingCtx) {
    ctx = drawingCtx;
    ctx.imageSmoothingEnabled = false;
  };

  D.loadBackdrops = function () {
    const names = ['meadow', 'jungle', 'swamp', 'dunes', 'canyon', 'river', 'mushroom', 'crag', 'coast', 'volcano'];
    return Promise.all(names.map(name => new Promise(resolve => {
      const img = new Image();
      img.onload = () => {
        const cv = mkCanvas(480, 270);
        const c = cv.getContext('2d');
        c.imageSmoothingEnabled = false;
        c.drawImage(img, 0, 0, 480, 270);
        BG[name] = cv;
        resolve();
      };
      img.onerror = () => resolve();
      img.src = 'assets/bg/' + name + '.png';
    })));
  };

  // ---------------------------------------------------------------- the world
  // A biome's backdrop is drawn a little larger than the screen and pans slowly as you cross the biome.
  function drawBackdropImg(bgKey, zone, camX, vw, alpha, skyFallback) {
    const img = BG[bgKey];
    if (!img) {
      if (alpha >= 0.99) R(-12, -12, vw + 24, 294, skyFallback || '#22384c');
      return;
    }
    if (alpha < 0.99) ctx.globalAlpha = alpha;
    const drawW = 528, drawH = 284;
    let frac = 0.5;
    if (zone && zone.x1 > zone.x0) frac = Math.max(0, Math.min(1, (camX - zone.x0) / (zone.x1 - zone.x0)));
    const dx = Math.round(((vw - 480) >> 1) - frac * (drawW - Math.max(vw, 480)));
    ctx.drawImage(img, dx, -7, drawW, drawH);
    if (alpha < 0.99) ctx.globalAlpha = 1;
  }

  function drawBiomeParallax(S, camX, vw) {
    const sim = DINO.sim;
    if (S && S.mode === 'finale' && S.ending === 'volcano') {
      drawBackdropImg('volcano', { x0: -500, x1: 500 }, camX, vw, 1, '#301010');
      return;
    }
    const z = sim.biomeAt(camX);
    drawBackdropImg(z.bg, z, camX, vw, 1, z.sky);
    const zones = sim.BIOMES.zones;                       // fade into the next biome near a border
    for (let i = 0; i < zones.length - 1; i++) {
      const dist = camX - zones[i].x1;
      if (Math.abs(dist) < 120) {
        const other = dist < 0 ? zones[i + 1] : zones[i];
        drawBackdropImg(other.bg, other, camX, vw, 0.5 * (1 - Math.abs(dist) / 120), other.sky);
      }
    }
  }

  function hash(n) {
    n = Math.imul(n ^ 61, n ^ (n >>> 16));
    n = n + (n << 3);
    n = n ^ (n >>> 4);
    n = Math.imul(n, 0x27d4eb2d);
    return (n ^ (n >>> 15)) >>> 0;
  }

  function drawTerrainAndProps(S, camX, vw, tick) {
    const sim = DINO.sim, G = sim.G, H = sim.H;
    const half = vw >> 1;
    const worldLeft = Math.floor((camX - half - 32) / 16) * 16;
    const worldRight = Math.ceil((camX + half + 32) / 16) * 16;

    for (let wx = worldLeft; wx <= worldRight; wx += 16) {
      const sx = Math.round(wx - camX + half);
      const h = hash(wx * 7 + 101);
      // Near a border the ground tiles of the two biomes are mixed, so there is no hard line between them.
      const z = sim.biomeAt(wx + 8 + (((h >>> 9) % 5) - 2) * 16);
      const wDepth = sim.waterAt(wx + 8);

      if (wDepth === 'deep') { R(sx, G + 24, 16, H - (G + 24) + 12, '#081a30'); continue; }
      const gy = wDepth === 'shallow' ? G + 14 : G;
      R(sx, gy, 16, H - gy + 12, z.ground);
      R(sx, gy, 16, 4, wDepth === 'shallow' ? '#3a4e48' : z.grass);
      R(sx, gy + 4, 16, 2, '#1c1614');
      R(sx + (h % 11), gy + 10 + ((h >>> 4) % 22), 3, 2, '#241c18');

      if (Math.abs(wx) > 48 && !wDepth && (h % 3 === 0)) {
        const px = sx + 4;
        if (z.id === 'meadow' || z.id === 'jungle') {
          R(px, gy - 6, 2, 6, z.grass); R(px - 3, gy - 5, 3, 2, z.accent); R(px + 2, gy - 5, 3, 2, z.accent); R(px - 2, gy - 8, 6, 2, z.accent);
        } else if (z.id === 'mushroom') {
          R(px + 1, gy - 7, 2, 7, '#345888'); R(px - 2, gy - 10, 8, 3, '#2698b8'); R(px - 1, gy - 11, 6, 2, '#58fff4');
        } else if (z.id === 'dunes') {
          R(px - 2, gy - 4, 6, 4, z.accent); R(px, gy - 6, 3, 2, z.grass);
        } else if (z.id === 'canyon') {
          R(px, gy - 9, 2, 9, '#ded4be'); R(px + 1, gy - 11, 3, 2, '#f4ecda');
        } else if (z.id === 'crag') {
          R(px - 2, gy - 8, 6, 8, '#28242c'); R(px, gy - 4, 2, 3, '#ff6a28');
        } else if (z.id === 'swamp' || z.id === 'river') {
          R(px, gy - 9, 1, 9, z.grass); R(px + 3, gy - 7, 1, 7, z.grass); R(px, gy - 11, 2, 3, '#5c3c20');
        } else if (z.id === 'coast') {
          R(px, gy - 2, 4, 2, '#f4e6d4');
        }
      }
    }

    if (S && S.bushes) {
      for (let i = 0; i < S.bushes.length; i++) {
        const sx = Math.round(S.bushes[i] - camX + half);
        if (sx < -30 || sx > vw + 30) continue;
        DINO.sprites.blit(ctx, 'bush', 'idle', tick, sx, G + 1, false, false);
      }
    }
  }

  function drawWaterOverlay(camX, vw, tick) {
    const sim = DINO.sim, G = sim.G, H = sim.H;
    const half = vw >> 1;
    const waters = sim.BIOMES.water;
    for (let i = 0; i < waters.length; i++) {
      const w = waters[i];
      const sx0 = Math.max(-12, Math.round(w.x0 - camX + half));
      const sx1 = Math.min(vw + 12, Math.round(w.x1 - camX + half));
      if (sx1 <= sx0) continue;
      const topY = w.depth === 'deep' ? G - 3 : G - 1;
      ctx.globalAlpha = w.depth === 'deep' ? 0.80 : 0.60;
      R(sx0, topY, sx1 - sx0, H - topY + 12, w.col);
      ctx.globalAlpha = 1;
      for (let x = sx0; x < sx1 - 6; x += 14) R(x, topY + (((x + Math.floor(tick / 8) * 3) % 28) < 14 ? 0 : 1), 8, 2, w.foam);
    }
  }

  const tagOf = (p, i) => (p.ai ? 'AI' : 'P' + (i + 1));
  const colOf = p => DINO.sim.REXES[p.type].col;

  // Draws one pane of the world. pane: { x, y, w, h, yOff } on the screen; yOff is how much of the sky is cut off.
  function drawPane(S, camX, pane, tick, me) {
    const sim = DINO.sim, SP = DINO.sprites, G = sim.G, H = sim.H;
    const vw = pane.w, half = vw >> 1;
    const shX = S.shake > 0 ? Math.round((Math.random() - 0.5) * S.shake * 1.4) : 0;
    const shY = S.shake > 0 ? Math.round((Math.random() - 0.5) * S.shake * 1.4) : 0;

    ctx.save();
    ctx.beginPath();
    ctx.rect(pane.x, pane.y, pane.w, pane.h);
    ctx.clip();
    ctx.translate(pane.x + shX, pane.y - pane.yOff + shY);

    drawBiomeParallax(S, camX, vw);
    if (DINO.fx) DINO.fx.drawFinaleSky(ctx, S, vw, H);
    drawTerrainAndProps(S, camX, vw, tick);

    // the nest and the baby, at x = 0
    const nestSX = Math.round(0 - camX + half);
    if (nestSX > -60 && nestSX < vw + 60) {
      const bHurt = S.mode === 'play' && S.baby.hurtT > 0;
      SP.blit(ctx, 'nest', bHurt ? 'hurt' : 'idle', tick, nestSX, G + 2, false, false);
      const bAnim = bHurt ? 'hurt' : S.baby.eatT > 0 || S.mode === 'finale' ? 'attack' : 'idle';
      SP.blit(ctx, 'baby' + Math.min(4, S.baby.stage), bAnim, tick, nestSX, G - 3, false, bHurt && (tick % 4 < 2));
    }

    for (let i = 0; i < S.foods.length; i++) {
      const f = S.foods[i];
      const sx = Math.round(f.x - camX + half);
      if (sx < -24 || sx > vw + 24) continue;
      SP.blit(ctx, 'food' + f.tier, 'idle', tick, sx, f.y + Math.round(Math.sin((tick + f.id * 11) * 0.1) * 1.2), false, false);
    }

    for (let i = 0; i < S.dinos.length; i++) {
      const d = S.dinos[i];
      const sx = Math.round(d.x - camX + half);
      if (sx < -80 || sx > vw + 80) continue;
      if (d.hidden) { R(sx - 2, G - 7, 2, 2, '#f8e050'); continue; }       // eyes in a bush
      const def = sim.DINOS[d.kind];
      const tall = def ? def.h : 20;
      // An attack shows the pose of its phase: wind-up, strike, end of strike, recovery.
      SP.blit(ctx, d.kind, d.st, tick + d.id * 5, sx, d.y, d.face < 0, S.mode === 'play' && d.hurtT > 8, d.st === 'attack' ? d.af : -1);

      const top = Math.round(d.y - tall);
      if (d.atk === 'windup' && tick % 6 < 4) {                      // warning: an attack is coming
        R(sx - 2, top - 19, 5, 13, '#0c0a16');
        R(sx - 1, top - 18, 3, 7, d.lead ? '#ff5038' : '#ffe858');
        R(sx - 1, top - 9, 3, 2, d.lead ? '#ff5038' : '#ffe858');
      } else if (d.atk === 'stun' && d.atkT > 12) {                  // dizzy stars
        const a = Math.floor(tick / 4) % 4;
        R(sx - 8 + a * 2, top - 12, 2, 2, '#ffe858');
        R(sx + 6 - a * 2, top - 14, 2, 2, '#ffffff');
        R(sx - 1, top - 16 + (a & 1), 2, 2, '#ffe858');
      }

      if (d.kind !== 'brachiosaurus' && (d.hp < d.maxHp || d.lead || (def && (def.size === 'giant' || def.size === 'titan')))) {
        const bw = d.lead ? 36 : def && (def.size === 'giant' || def.size === 'titan') ? 30 : 18;
        const by = top - 6;
        // A boss leader's bar turns bright while it is open to bites (recovering or stunned).
        const open = d.lead && (d.atk === 'recover' || d.atk === 'stun');
        R(sx - (bw >> 1) - 1, by - 1, bw + 2, 5, '#0c0a16');
        R(sx - (bw >> 1), by, Math.max(1, Math.round(bw * (d.hp / d.maxHp))), 3, d.lead ? (open ? '#fff27a' : '#a85a3a') : d.raid ? '#ff4438' : '#68de58');
      }
    }

    for (let i = 0; i < S.projs.length; i++) {
      const pr = S.projs[i];
      const sx = Math.round(pr.x - camX + half);
      if (sx < -16 || sx > vw + 16) continue;
      SP.blit(ctx, 'spit', 'idle', tick, sx, pr.y, pr.vx < 0, false);
    }

    for (let i = 0; i < S.players.length; i++) {
      const p = S.players[i];
      const sx = Math.round(p.x - camX + half);
      if (sx < -50 || sx > vw + 50) continue;
      if (p.downT > 0 && (tick % 8 < 4)) ctx.globalAlpha = 0.55;
      // The bite animation follows the bite itself: open jaws, snap, shut, back.
      const biteFrame = p.biteT > 0 ? (p.biteT > 11 ? 0 : p.biteT > 7 ? 1 : p.biteT > 3 ? 2 : 3) : -1;
      SP.blit(ctx, 'rex_' + p.type, p.anim, tick, sx, p.y, p.face < 0, S.mode === 'play' && p.invT > 26 && (tick % 4 < 2), biteFrame);
      ctx.globalAlpha = 1;
      if (p.carry) SP.blit(ctx, 'food' + p.carry.tier, 'idle', tick, sx + p.face * 17, p.y - 18, false, false);

      const ty = p.y - 49 - (i % 2) * 9;               // every other tag sits a little higher, so tags of T-rexes standing together overlap less
      T(tagOf(p, i), sx, ty, i === me ? '#ffe868' : '#ffffff', 'vt', 1);
      if (p.stunT > 0) T('STUN!', sx, ty - 10, '#ffe858', 'vt', 1);
      else if (p.bleedT > 0) T('BLEED', sx, ty - 10, '#ff4848', 'vt', 1);
      else if (p.slowT > 0) T('VENOM', sx, ty - 10, '#68f048', 'vt', 1);
    }

    drawWaterOverlay(camX, vw, tick);
    if (DINO.fx) DINO.fx.drawWorld(ctx, camX, vw);
    ctx.restore();

    // where this pane is: biome and distance from the nest
    if (S.mode === 'play') {
      const z = sim.biomeAt(camX), far = Math.round(Math.abs(camX));
      const label = z.name + (far < 45 ? '' : '  ' + far + 'm');
      R(pane.x + 2, pane.y + pane.h - 15, measure(label, 'vt') + 6, 13, 'rgba(12,10,22,0.7)');
      T(label, pane.x + 5, pane.y + pane.h - 17, '#bcd4f0', 'vt', 0);
    }
  }

  // ---------------------------------------------------------------- top bar
  function bar(x, y, w, h, frac, col) {
    frac = Math.max(0, Math.min(1, frac));
    R(x, y, w, h, '#14111f');
    R(x + 1, y + 1, Math.round((w - 2) * frac), h - 2, col);
  }

  function drawHud(S, me, tick) {
    const sim = DINO.sim, tx = DINO.TEXT, W = sim.W;
    const b = S.baby;
    R(0, 0, W, 33, 'rgba(10, 9, 18, 0.84)');
    R(0, 33, W, 1, '#2c2640');

    // one chip per T-rex: its number and health, in its type's colour. 4 on the left, 4 on the right.
    for (let i = 0; i < S.players.length; i++) {
      const p = S.players[i];
      const x = (i < 4 ? 4 : 356) + (i % 2) * 62, y = 3 + ((i % 4) >> 1) * 15;
      T(tagOf(p, i), x, y - 3, i === me ? '#ffe868' : '#ffffff', 'vt', 0);
      bar(x + 15, y + 2, 42, 6, p.hp / p.maxHp, p.downT > 0 ? '#686878' : colOf(p));
    }
    if (me >= 0 && S.players.length <= 4) {                           // alone or online: your type on the right
      const mine = sim.REXES[S.players[me].type];
      R(464, 4, 10, 10, mine.col);
      T(mine.name.toUpperCase(), 460, 1, '#ffffff', 'vt', 2);
    }

    // the baby: stage, health, hunger, growth
    T('BABY: ' + tx.stages[Math.min(4, b.stage)], 240, 0, '#ffe868', 'vt', 1);
    T('HP', 132, 12, '#ffd0d0', 'vt', 0);
    bar(148, 16, 44, 6, b.hp / b.maxHp, b.hp < 35 && (tick % 16 < 8) ? '#ff2020' : '#ff5448');
    T('FD', 198, 12, '#fff0c0', 'vt', 0);
    bar(214, 16, 44, 6, b.hunger / 100, b.hunger < 25 && (tick % 16 < 8) ? '#ff8820' : '#f4b438');
    // Growth: the egg shows a timer, later stages show one pip per meal.
    if (b.stage === 0) {
      T('EG', 264, 12, '#c8f8ff', 'vt', 0);
      bar(280, 16, 46, 6, b.eggT / sim.EGG_T, '#48d8f0');
    } else {
      T('ML', 264, 12, '#c8f8ff', 'vt', 0);
      const need = b.stage >= 4 ? 1 : Math.max(1, b.need), have = b.stage >= 4 ? 1 : b.meals;
      if (need <= 9) {
        const pw = Math.floor(46 / need);
        for (let i = 0; i < need; i++) {
          R(280 + i * pw, 16, pw - 1, 6, '#0c0a16');
          R(281 + i * pw, 17, pw - 3, 4, i < have ? '#48d8f0' : '#3c3a5c');     // filled or still empty
        }
      } else bar(280, 16, 46, 6, have / need, '#48d8f0');
    }

    // small map of the whole world: nest in the middle, T-rexes in their colours, raiders in red
    const mx = 148, my = 25, mw = 178;
    R(mx, my, mw, 5, '#1d192b');
    R(mx + (mw >> 1) - 1, my, 3, 5, '#ffe868');
    const mapX = wx => mx + Math.round(((wx - sim.WORLD_MIN) / (sim.WORLD_MAX - sim.WORLD_MIN)) * (mw - 2));
    for (let i = 0; i < S.dinos.length; i++) if (S.dinos[i].raid) R(mapX(S.dinos[i].x), my + 1, 2, 3, '#ff3030');
    for (let i = 0; i < S.players.length; i++) R(mapX(S.players[i].x), my + 1, 3, 3, i === me ? '#ffffff' : colOf(S.players[i]));

    const B = S.boss;
    if (B && B.warnT > 0) {                                           // a boss wave is on its way
      if (tick % 20 < 14) {
        const name = tx.boss_in + ': ' + tx[B.key];
        R(110, 36, 260, 15, 'rgba(150, 20, 16, 0.9)');
        T(B.side < 0 ? '<< ' + name : name + ' >>', 240, 35, '#ffe868', 'vt', 1);
      }
    } else if (B) {                                                   // boss health: the whole wave together
      R(110, 36, 260, 15, 'rgba(12, 10, 22, 0.86)');
      T(tx[B.key], 116, 35, '#ff8a5a', 'vt', 0);
      R(246, 40, 118, 7, '#14111f');
      R(247, 41, Math.round(116 * Math.max(0, Math.min(1, B.max ? B.hp / B.max : 0))), 5, '#ff4a38');
    } else if (S.raidWarnT > 0 && (tick % 24 < 16)) {
      const arrow = S.raidSide < 0 ? '<< ' + tx.raid_warn : tx.raid_warn + ' >>';
      R(145, 36, 190, 15, 'rgba(140, 18, 18, 0.85)');
      T(arrow, 240, 35, '#ffe868', 'vt', 1);
    }
    if (S.msg && tx[S.msg] && !(B && B.warnT > 0)) {
      const my2 = B || S.raidWarnT > 0 ? 53 : 36;
      R(70, my2, 340, 15, 'rgba(12, 10, 22, 0.82)');
      T(tx[S.msg], 240, my2 - 1, '#ffffff', 'vt', 1);
    }
  }

  // At the start of a game: who got which T-rex type.
  function drawDeal(S, me, tick) {
    if (S.mode !== 'play' || S.tick > 330 || S.paused || D.menuOpen) return;
    const sim = DINO.sim, tx = DINO.TEXT;
    // one line per T-rex: colour, number, type name, what it is good at
    const list = S.players.map((p, i) => ({ p, i })).filter(o => me < 0 || o.i === me || o.p.ai);
    const h = 24 + list.length * 14;
    R(80, 60, 320, h, 'rgba(10, 9, 20, 0.88)');
    R(80, 60, 320, 2, '#f8d040');
    T(tx.deal, 240, 63, '#ffe868', 'vt', 1);
    list.forEach((o, k) => {
      const r = sim.REXES[o.p.type], y = 79 + k * 14;
      R(90, y + 4, 8, 8, r.col);
      T(tagOf(o.p, o.i), 104, y, o.i === me ? '#ffe868' : '#ffffff', 'vt', 0);
      T(r.name.toUpperCase(), 126, y, '#ffffff', 'vt', 0);
      T(r.blurb, 186, y, '#bcd4f0', 'vt', 0);
    });
  }

  function drawEndOverlay(S, tick) {
    const tx = DINO.TEXT, W = DINO.sim.W, H = DINO.sim.H;
    R(0, 0, W, H, 'rgba(8, 6, 16, 0.80)');
    if (S.mode === 'over') {
      T(tx.gameover, 240, 38, '#ff4840', 'ps', 1, 2);
      T(tx.gameover_sub, 240, 68, '#ffd0d0', 'vt', 1);
    } else {
      const isMet = S.ending === 'meteor';
      T(isMet ? tx.win_meteor : tx.win_volcano, 240, 40, isMet ? '#ff9448' : '#ffe058', 'ps', 1, 1);
      wrap(isMet ? tx.win_meteor_sub : tx.win_volcano_sub, 'vt', 420).forEach((ln, idx) => T(ln, 240, 58 + idx * 16, '#e4ecff', 'vt', 1));
    }
    R(120, 98, 240, 92, 'rgba(20, 18, 36, 0.92)');
    R(120, 98, 240, 2, '#f8d040');
    const secs = Math.floor(S.tick / 60);
    const rows = [
      [tx.stat_time, Math.floor(secs / 60) + ':' + String(secs % 60).padStart(2, '0')],
      [tx.stat_fed, String(S.stats.meals)],
      [tx.stat_kills, String(S.stats.kills)],
      [tx.stat_hurt, String(Math.round(S.baby.totalDamage))]
    ];
    rows.forEach((r, i) => {
      T(r[0], 136, 108 + i * 18, '#bcd4f0', 'vt', 0);
      T(r[1], 344, 108 + i * 18, '#f8d040', 'vt', 2);
    });
    if (S.finaleT > 60 && (tick % 40 < 28)) T(tx.retry_hint, 240, 214, '#68e878', 'vt', 1);
  }

  // ---------------------------------------------------------------- cameras
  // For several players on one screen. The layout only changes after the new grouping has held for
  // a moment, so it does not flicker when two players walk in and out of range.
  let layout = null, pending = '', pendingT = 0;
  D.resetView = function () { layout = null; pending = ''; pendingT = 0; };

  function clampCam(cx, vw) {
    const sim = DINO.sim, half = vw >> 1;
    return Math.max(sim.WORLD_MIN + half, Math.min(sim.WORLD_MAX - half, cx));
  }

  const FULL = { x: 0, y: 0, w: 480, h: 270, yOff: 0 };
  const HALVES = [{ x: 0, y: 0, w: 239, h: 270, yOff: 0 }, { x: 241, y: 0, w: 239, h: 270, yOff: 0 }];
  const QUARTERS = [
    { x: 0, y: 34, w: 239, h: 117, yOff: 119 }, { x: 241, y: 34, w: 239, h: 117, yOff: 119 },
    { x: 0, y: 153, w: 239, h: 117, yOff: 119 }, { x: 241, y: 153, w: 239, h: 117, yOff: 119 }
  ];

  // view: { me: your T-rex (alone or online), or -1 for several players on this screen;
  //         humans: the T-rexes played on this screen }
  D.render = function (S, view, tick) {
    const sim = DINO.sim;
    const me = view.me;
    if (S.mode !== 'play' || me >= 0) {
      const camX = S.mode === 'play' ? S.players[Math.min(me, S.players.length - 1)].x : 0;
      drawPane(S, clampCam(camX, 480), FULL, tick, me);
      if (S.mode === 'finale') { T(S.ending === 'meteor' ? DINO.TEXT.fin_meteor : DINO.TEXT.fin_volcano, 240, 16, '#ffe868', 'ps', 1, 1); return; }
      drawHud(S, me, tick);
      drawDeal(S, me, tick);
      if (S.mode === 'win' || S.mode === 'over') drawEndOverlay(S, tick);
      return;
    }

    // several players on one screen: group them, at most 4 panes
    const who = view.humans, xs = who.map(i => S.players[i].x);
    const groups = sim.cameraGroups(xs, 4).map(g => g.who.map(k => who[k]));
    const sig = groups.map(g => g.join(',')).join('|');
    if (!layout) layout = groups;
    else if (sig !== layout.map(g => g.join(',')).join('|')) {
      if (sig === pending) { if (++pendingT > 24) { layout = groups; pendingT = 0; } } else { pending = sig; pendingT = 0; }
    } else pendingT = 0;

    const panes = layout.length === 1 ? [FULL] : layout.length === 2 ? HALVES : QUARTERS;
    const cams = [];
    panes.forEach((pane, k) => {
      const g = layout[k];
      let camX = 0;                                                  // a spare pane shows the nest
      if (g) { const gx = g.map(i => S.players[i].x); camX = (Math.min(...gx) + Math.max(...gx)) / 2; }
      camX = clampCam(camX, pane.w);
      cams.push(camX);
      drawPane(S, camX, pane, tick, -1);
      // a player who walked out of their pane gets an arrow at its edge
      if (g) for (const i of g) {
        const off = S.players[i].x - camX;
        if (Math.abs(off) <= pane.w / 2 - 4) continue;
        const ax = off < 0 ? pane.x + 2 : pane.x + pane.w - 16, ay = pane.y + pane.h - 40;
        R(ax, ay, 14, 13, colOf(S.players[i]));
        T((off < 0 ? '<' : '') + (i + 1) + (off < 0 ? '' : '>'), ax + 7, ay - 2, '#ffffff', 'vt', 1);
      }
    });
    if (panes.length === 2) R(239, 34, 2, 236, '#f8d040');
    if (panes.length === 4) { R(239, 34, 2, 236, '#f8d040'); R(0, 151, 480, 2, '#f8d040'); }
    drawHud(S, -1, tick);
    drawDeal(S, -1, tick);
  };

  // ---------------------------------------------------------------- menus and review pages
  // Review sheet, 4 rows per page: idle pose and the 4 attack poses.
  // ?sheet=1 to 6: the 24 creatures. 7 and 8: the 8 T-rex types. 9: the baby.
  D.drawSheet = function (page) {
    const SP = DINO.sprites, sim = DINO.sim, kinds = Object.keys(sim.DINOS), rex = sim.REX_IDS.map(k => 'rex_' + k);
    R(0, 0, 480, 270, '#2a3550');
    if (page === 10) {   // the small font: every character, then real sentences
      let all = '';
      for (let ch = 32; ch < 127; ch++) all += String.fromCharCode(ch);
      for (let i = 0; i < 4; i++) T(all.substr(i * 24, 24).split('').join(' '), 8, 2 + i * 14, '#ffffff', 'vt', 0);
      const tx = DINO.TEXT;
      ['MULE MENDER CHOMP HOP REACH BRICK DASH REX', 'Fern Meadow  Mushroom Forest  Meals  NM mn wv WV', tx.c_k1, tx.c_pad, tx.c_tip2, tx.c_tip3,
        tx.win_meteor_sub.slice(0, 68), tx.fin_meteor, 'Jumps very high  Bites from further away  0123456789']
        .forEach((s, i) => T(s, 8, 62 + i * 14, i < 2 ? '#ffe868' : '#bcd4f0', 'vt', 0));
      T('MMNN mmnn', 8, 196, '#ffffff', 'vt', 0, 3);
      return;
    }
    const list = page <= 6 ? kinds.slice((page - 1) * 4, page * 4) : page <= 8 ? rex.slice((page - 7) * 4, (page - 6) * 4) : ['baby1', 'baby2', 'baby3', 'baby4'];
    ['idle', 'wind-up', 'strike', 'strike end', 'recovery'].forEach((s, i) => T(s, 120 + i * 76, 2, '#ffe868', 'vt', 1));
    list.forEach((k, r) => {
      const gy = 76 + r * 62;
      R(0, gy, 480, 1, '#1a2238');
      const info = k.indexOf('rex_') === 0 ? sim.REXES[k.slice(4)] : null;
      T(info ? info.name + ': ' + info.blurb : k, 4, gy - 58, '#ffffff', 'vt', 0);
      SP.blit(ctx, k, 'idle', 0, 120, gy, false, false, 0);
      for (let f = 0; f < 4; f++) SP.blit(ctx, k, 'attack', 0, 196 + f * 76, gy, false, false, f);
    });
  };

  D.drawMenuBackdrop = function (tick) {
    drawBackdropImg('meadow', { x0: -500, x1: 500 }, Math.sin(tick * 0.008) * 240, 480, 1, '#3b6ea5');
    R(0, 0, 480, 270, 'rgba(10, 8, 20, 0.42)');
    if (DINO.sprites.ready) {
      DINO.sprites.blit(ctx, 'nest', 'idle', tick, 240, 232, false, false);
      DINO.sprites.blit(ctx, 'baby0', 'idle', tick, 240, 227, false, false);
      DINO.sprites.blit(ctx, 'rex_rex', 'idle', tick, 178, 232, false, false);
      DINO.sprites.blit(ctx, 'rex_chomp', 'idle', tick + 12, 302, 232, true, false);
    }
  };

  // All 8 types in a row, for the screen where players join.
  D.drawLineup = function (tick, y) {
    const sim = DINO.sim;
    sim.REX_IDS.forEach((k, i) => DINO.sprites.blit(ctx, 'rex_' + k, 'idle', tick + i * 7, 44 + i * 56, y, false, false));
  };
})();
