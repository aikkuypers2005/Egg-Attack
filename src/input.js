// Keyboard and controller input. Every device gives the same four actions: walk, jump, bite, grab/drop.
// Up to 8 players on one computer: 4 keyboard layouts (two fit on one keyboard, the others are meant for
// a second USB keyboard) and up to 4 controllers.
(function () {
  const DINO = window.DINO = window.DINO || {};
  const I = DINO.input = {};
  const keys = {};                 // keys that are held down right now
  let taps = {}, tapNow = {};      // keys pressed since the last step, so a tap shorter than one step is not lost
  let typed = [], clicks = [], prevMenu = {}, prevJoin = {};
  const held = code => !!(keys[code] || tapNow[code]);

  const BLOCK = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'Enter', 'Tab', 'Backspace'];

  // The same key name on every browser and keyboard layout.
  function normCode(e) {
    if (e.code && e.code !== 'Unidentified') return e.code;
    const k = e.key || '';
    if (k === ' ') return 'Space';
    if (k.startsWith('Arrow') || k === 'Enter' || k === 'Escape' || k === 'Backspace' || k === 'Tab') return k;
    if (k.length === 1 && /^[a-zA-Z]$/.test(k)) return 'Key' + k.toUpperCase();
    return k;
  }

  window.addEventListener('keydown', e => {
    const code = normCode(e);
    if (!keys[code] && e.key && (e.key.length === 1 || e.key === 'Backspace')) typed.push(e.key);
    if (!keys[code]) taps[code] = true;
    keys[code] = true;
    if (BLOCK.includes(code) || e.key === ' ') e.preventDefault();
  });
  window.addEventListener('keyup', e => { keys[normCode(e)] = false; });
  window.addEventListener('blur', () => { for (const k in keys) keys[k] = false; });
  // A click or tap on the picture, in game pixels. Touch buttons lie over the picture and do not count.
  // I.rotated: the picture is turned a quarter to the right (a phone held upright, see touch.js).
  I.rotated = false;
  window.addEventListener('pointerdown', e => {
    const el = document.getElementById('game');
    if (!el || (e.target && e.target.closest && e.target.closest('.tc'))) return;
    const rect = el.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    const gx = I.rotated ? ((e.clientY - rect.top) / rect.height) * 480 : ((e.clientX - rect.left) / rect.width) * 480;
    const gy = I.rotated ? ((rect.right - e.clientX) / rect.width) * 270 : ((e.clientY - rect.top) / rect.height) * 270;
    if (gx >= 0 && gx <= 480 && gy >= 0 && gy <= 270) clicks.push({ x: gx, y: gy });
  });

  // A touch button presses a key by name, exactly like the keyboard does.
  I.press = function (code, down) {
    if (down && !keys[code]) taps[code] = true;
    keys[code] = !!down;
  };

  // Keyboard layouts: [left, right, jump, bite, grab]
  const KB = {
    kb1: ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'Space', 'ArrowDown'],
    kb2: ['KeyA', 'KeyD', 'KeyW', 'KeyF', 'KeyS'],
    kb3: ['KeyJ', 'KeyL', 'KeyI', 'KeyH', 'KeyK'],
    kb4: ['Numpad4', 'Numpad6', 'Numpad8', 'Numpad0', 'Numpad5']
  };
  I.DEVICES = ['kb1', 'kb2', 'kb3', 'kb4', 'pad0', 'pad1', 'pad2', 'pad3'];
  I.NAMES = { kb1: 'Arrows + Space', kb2: 'WASD + F', kb3: 'IJKL + H', kb4: 'Numpad', pad0: 'Controller 1', pad1: 'Controller 2', pad2: 'Controller 3', pad3: 'Controller 4' };

  function pads() {
    const list = navigator.getGamepads ? navigator.getGamepads() : [];
    const out = [];
    for (let i = 0; i < list.length; i++) out.push(list[i] && list[i].connected ? list[i] : null);
    return out;
  }
  function btn(g, i) { return !!(g && g.buttons[i] && g.buttons[i].pressed); }
  function padState(g) {
    if (!g) return { mx: 0, jump: false, bite: false, grab: false };
    const ax = g.axes[0] || 0;
    return {
      mx: btn(g, 14) ? -1 : btn(g, 15) ? 1 : Math.abs(ax) > 0.35 ? Math.sign(ax) : 0,
      jump: btn(g, 0) || btn(g, 12),                  // A or D-pad up
      bite: btn(g, 2) || btn(g, 5) || btn(g, 7),      // X, or a right shoulder button
      grab: btn(g, 1) || btn(g, 3) || btn(g, 13)      // B, Y or D-pad down
    };
  }
  I.padCount = () => pads().filter(Boolean).length;

  I.poll = function (dev) {
    const k = KB[dev];
    if (k) return { mx: (held(k[1]) ? 1 : 0) - (held(k[0]) ? 1 : 0), jump: held(k[2]), bite: held(k[3]), grab: held(k[4]) };
    return padState(pads()[Number(dev.slice(3))]);
  };

  // Alone or online there is one player at this computer: arrows, WASD and the first controller all work.
  I.pollAll = function () {
    const a = I.poll('kb1'), b = I.poll('kb2'), c = I.poll('pad0');
    return { mx: a.mx || b.mx || c.mx, jump: a.jump || b.jump || c.jump, bite: a.bite || b.bite || c.bite || held('Enter'), grab: a.grab || b.grab || c.grab };
  };

  // Devices whose bite button went down since the last call (used on the screen where players join).
  I.joinPresses = function () {
    const out = [];
    for (const dev of I.DEVICES) {
      const down = I.poll(dev).bite;
      if (down && !prevJoin[dev]) out.push(dev);
      prevJoin[dev] = down;
    }
    return out;
  };

  // Once per game step: menu presses (only the moment a button goes down), typed letters and clicks.
  I.tick = function () {
    const ps = pads().filter(Boolean);
    const any = f => ps.some(f);
    tapNow = taps; taps = {};
    const now = {
      up: held('ArrowUp') || held('KeyW') || any(g => btn(g, 12) || (g.axes[1] || 0) < -0.6),
      down: held('ArrowDown') || held('KeyS') || any(g => btn(g, 13) || (g.axes[1] || 0) > 0.6),
      left: held('ArrowLeft') || held('KeyA') || any(g => btn(g, 14) || (g.axes[0] || 0) < -0.6),
      right: held('ArrowRight') || held('KeyD') || any(g => btn(g, 15) || (g.axes[0] || 0) > 0.6),
      ok: held('Enter') || held('NumpadEnter') || held('Space') || any(g => btn(g, 0)),
      start: held('Enter') || held('NumpadEnter') || any(g => btn(g, 9)),     // Enter or the controller's Start button
      back: held('Escape') || any(g => btn(g, 8)),
      pause: held('Escape') || any(g => btn(g, 9))
    };
    // A tap counts as a new press even if the key was already down in the step before.
    const tapped = { up: ['ArrowUp', 'KeyW'], down: ['ArrowDown', 'KeyS'], left: ['ArrowLeft', 'KeyA'], right: ['ArrowRight', 'KeyD'],
      ok: ['Enter', 'NumpadEnter', 'Space'], start: ['Enter', 'NumpadEnter'], back: ['Escape'], pause: ['Escape'] };
    const m = {};
    for (const k in now) m[k] = now[k] && (!prevMenu[k] || tapped[k].some(c => tapNow[c]));
    prevMenu = now;
    m.typed = typed; typed = [];
    m.click = clicks.length ? clicks.shift() : null;
    return m;
  };
})();
