// Builds every animation frame from data/sprites.json once, with a dark outline, and draws them.
(function () {
  const DINO = window.DINO = window.DINO || {};
  const SP = DINO.sprites = { frames: {}, ready: false };
  const OUT = [12, 10, 22];
  const PAD = 9;      // room around a sprite for parts that move during an animation

  function mkCanvas(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, w);
    c.height = Math.max(1, h);
    return c;
  }

  function drawPart(ctx, partDef, dx, dy) {
    if (!partDef) return;
    const rows = partDef.rows, pal = partDef.palette;
    for (let y = 0; y < rows.length; y++) {
      const row = rows[y];
      for (let x = 0; x < row.length; x++) {
        const ch = row[x];
        if (ch === '.' || !pal[ch]) continue;
        ctx.fillStyle = pal[ch];
        ctx.fillRect(dx + x, dy + y, 1, 1);
      }
    }
  }

  function outlineCanvas(cv) {
    const ctx = cv.getContext('2d');
    const cw = cv.width, ch = cv.height;
    const id = ctx.getImageData(0, 0, cw, ch);
    const d = id.data, src = new Uint8ClampedArray(d);
    const alphaAt = (x, y) => x >= 0 && y >= 0 && x < cw && y < ch && src[(y * cw + x) * 4 + 3] > 0;
    for (let y = 0; y < ch; y++) {
      for (let x = 0; x < cw; x++) {
        if (!alphaAt(x, y) && (alphaAt(x - 1, y) || alphaAt(x + 1, y) || alphaAt(x, y - 1) || alphaAt(x, y + 1))) {
          const i = (y * cw + x) * 4;
          d[i] = OUT[0]; d[i + 1] = OUT[1]; d[i + 2] = OUT[2]; d[i + 3] = 255;
        }
      }
    }
    ctx.putImageData(id, 0, 0);
  }

  SP.build = function (spritesData) {
    SP.data = spritesData;
    const parts = spritesData.parts, rigs = spritesData.rigs;
    for (const rigId of Object.keys(rigs)) {
      const rig = rigs[rigId];
      SP.frames[rigId] = {};
      for (const animName of ['idle', 'move', 'attack', 'hurt']) {
        const list = rig.anims[animName] || rig.anims.idle;
        SP.frames[rigId][animName] = list.map(pose => {
          const cv = mkCanvas(rig.w + PAD * 2, rig.h + PAD * 2);
          const ctx = cv.getContext('2d');
          for (let i = 0; i < rig.parts.length; i++) {
            const rp = rig.parts[i];
            const off = pose[rp.id] || [0, 0];
            drawPart(ctx, parts[rp.part], PAD + rp.x + off[0], PAD + rp.y + off[1]);
          }
          outlineCanvas(cv);
          return { cv, white: null, ox: PAD + rig.ox, oy: PAD + rig.oy };
        });
      }
    }
    SP.ready = true;
  };

  // frame: which pose to show. Attacks pass it in (0 wind-up, 1 strike, 2 end of strike, 3 recovery);
  // without it the animation simply loops on the clock.
  SP.getFrame = function (rigId, anim, tick, frame) {
    const r = SP.frames[rigId];
    if (!r) return null;
    const list = r[anim] || r.idle;
    if (!list || !list.length) return null;
    if (frame !== undefined && frame >= 0) return list[Math.min(list.length - 1, frame)];
    const rate = anim === 'move' ? 6 : anim === 'attack' ? 5 : 18;
    return list[Math.floor(tick / rate) % list.length];
  };

  SP.blit = function (ctx, rigId, anim, tick, x, y, flip, flashWhite, frame) {
    const f = SP.getFrame(rigId, anim, tick, frame);
    if (!f) return;
    let img = f.cv;
    if (flashWhite) {
      if (!f.white) {                                   // the same frame in plain white, made once
        f.white = mkCanvas(f.cv.width, f.cv.height);
        const wc = f.white.getContext('2d');
        wc.drawImage(f.cv, 0, 0);
        wc.globalCompositeOperation = 'source-in';
        wc.fillStyle = '#ffffff';
        wc.fillRect(0, 0, f.white.width, f.white.height);
      }
      img = f.white;
    }
    const rx = Math.round(x), ry = Math.round(y);
    if (flip) {
      ctx.save();
      ctx.translate(rx, ry);
      ctx.scale(-1, 1);
      ctx.drawImage(img, -f.ox, -f.oy);
      ctx.restore();
    } else {
      ctx.drawImage(img, rx - f.ox, ry - f.oy);
    }
  };
})();
