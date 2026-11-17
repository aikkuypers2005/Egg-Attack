// Touch controls for phones and tablets (web version only).
// - On-screen buttons that press the same keys as "Keys 1": walk, jump, bite, grab, and pause.
// - The game is always shown in landscape: when the phone is held upright, the whole picture is turned a
//   quarter, so you turn the phone to play. After the first touch the page also asks the browser for full
//   screen and a landscape lock (browsers that do not allow that simply keep going without it).
// - Test links: ?touch=1 shows the buttons on a computer, ?touch=0 never shows them, ?rot=1 forces the turned picture.
(function () {
  const DINO = window.DINO = window.DINO || {};
  const I = DINO.input;
  const q = new URLSearchParams(location.search);
  const TC = DINO.touch = { on: false, rotated: false, w: 0, h: 0 };
  const stage = document.getElementById('stage');

  // ---------------------------------------------------------------- the buttons
  const box = document.createElement('div');
  box.id = 'tc';
  box.style.display = 'none';
  const els = {};
  function mk(name, key, html) {
    const b = document.createElement('div');
    b.className = 'tc tc-' + name;
    b.dataset.key = key;
    b.innerHTML = html;
    b.style.display = 'none';
    box.appendChild(b);
    els[name] = b;
  }
  mk('left', 'ArrowLeft', '<i></i>');
  mk('right', 'ArrowRight', '<i></i>');
  mk('jump', 'ArrowUp', 'JUMP');
  mk('bite', 'Space', 'BITE');
  mk('grab', 'ArrowDown', 'GRAB');
  mk('pause', 'Escape', 'II');
  mk('full', '', '[ ]');
  stage.appendChild(box);

  // Which button each finger is on. A finger may slide from one game button to another without lifting.
  const fingers = new Map();
  const keyDown = {};
  const SLIDE = ['left', 'right', 'jump', 'bite', 'grab'].map(n => els[n]);

  function buttonAt(x, y) {
    const el = document.elementFromPoint(x, y);
    const b = el && el.closest ? el.closest('.tc') : null;
    return b && b.style.display !== 'none' && SLIDE.includes(b) ? b : null;
  }

  function sync() {
    const held = new Set();
    fingers.forEach(b => { if (b) held.add(b); });
    for (const name in els) {
      const b = els[name], key = b.dataset.key, down = held.has(b);
      b.classList.toggle('dn', down);
      if (key && down !== !!keyDown[key]) { keyDown[key] = down; I.press(key, down); }
    }
  }

  box.addEventListener('pointerdown', e => {
    const b = e.target.closest ? e.target.closest('.tc') : null;
    if (!b || b === els.full) return;
    e.preventDefault();
    fingers.set(e.pointerId, b);
    sync();
  });
  window.addEventListener('pointermove', e => {
    if (!fingers.has(e.pointerId)) return;
    const was = fingers.get(e.pointerId);
    if (was === els.pause) return;
    const b = buttonAt(e.clientX, e.clientY);
    if (b !== was) { fingers.set(e.pointerId, b); sync(); }
  });
  function lift(e) { if (fingers.delete(e.pointerId)) sync(); }
  window.addEventListener('pointerup', lift);
  window.addEventListener('pointercancel', lift);
  window.addEventListener('blur', () => { fingers.clear(); sync(); });
  box.addEventListener('contextmenu', e => e.preventDefault());

  // ---------------------------------------------------------------- full screen and landscape
  const root = document.documentElement;
  const canFull = () => !!(root.requestFullscreen || root.webkitRequestFullscreen);
  const isFull = () => !!(document.fullscreenElement || document.webkitFullscreenElement);
  let autoFull = true;          // ask once by itself; after that only the [ ] button asks

  function enterFull() {
    const lock = () => {
      try { if (screen.orientation && screen.orientation.lock) screen.orientation.lock('landscape').catch(() => {}); } catch (e) { /* not supported */ }
    };
    try {
      const p = root.requestFullscreen ? root.requestFullscreen({ navigationUI: 'hide' }) : root.webkitRequestFullscreen ? root.webkitRequestFullscreen() : null;
      if (p && p.then) p.then(lock).catch(() => {}); else lock();
    } catch (e) { /* not allowed: the game goes on in the normal page */ }
  }
  function fullChanged() { if (isFull()) autoFull = false; screenKind = ''; TC.layout(); }
  document.addEventListener('fullscreenchange', fullChanged);
  document.addEventListener('webkitfullscreenchange', fullChanged);
  els.full.addEventListener('click', () => { if (!isFull()) enterFull(); });
  window.addEventListener('pointerup', e => {
    if (TC.on && autoFull && e.pointerType === 'touch' && canFull() && !isFull() && q.get('full') !== '0') enterFull();
  });

  // ---------------------------------------------------------------- layout
  // The stage is the whole screen in landscape. Held upright, it is turned a quarter to the right.
  TC.layout = function () {
    const vw = window.innerWidth, vh = window.innerHeight;
    const rot = q.get('rot') === '1' || (TC.on && vh > vw);
    TC.rotated = I.rotated = rot;
    TC.w = rot ? vh : vw;
    TC.h = rot ? vw : vh;
    stage.style.width = TC.w + 'px';
    stage.style.height = TC.h + 'px';
    stage.style.transform = rot ? 'translate(' + vw + 'px, 0) rotate(90deg)' : '';
    stage.classList.toggle('rot', rot);
    // --u, the unit the buttons are sized in, is 1% of the picture's height
    stage.style.setProperty('--u', (Math.min(TC.h, TC.w * 270 / 480) / 100) + 'px');
    const s = Math.min(TC.w / 480, TC.h / 270), u = Math.min(TC.h, TC.w * 270 / 480) / 100;
    const bar = Math.max(0, (TC.h - 270 * s) / 2);                  // black bar above the picture
    stage.style.setProperty('--pt', (bar >= 13 * u ? bar - 12 * u : bar + 11 * u) + 'px');
    const c = document.getElementById('game');
    if (c) {
      c.style.width = Math.max(1, Math.floor(480 * s)) + 'px';
      c.style.height = Math.max(1, Math.floor(270 * s)) + 'px';
    }
  };
  window.addEventListener('resize', TC.layout);
  window.addEventListener('orientationchange', () => setTimeout(TC.layout, 60));
  if (window.visualViewport) window.visualViewport.addEventListener('resize', TC.layout);

  // Which buttons a screen needs: 'play' all of them, 'lobby' only BITE (to join), anything else none.
  let screenKind = '';
  TC.setScreen = function (kind) {
    if (!TC.on) return;
    const fullVis = kind !== 'play' && canFull() && !isFull();
    const k = kind + (fullVis ? '+' : '');
    if (k === screenKind) return;
    screenKind = k;
    const show = kind === 'play' ? ['left', 'right', 'jump', 'bite', 'grab', 'pause'] : kind === 'lobby' ? ['bite'] : [];
    box.classList.toggle('lobby', kind === 'lobby');     // a smaller BITE button, clear of the text
    for (const name in els) els[name].style.display = (name === 'full' ? fullVis : show.includes(name)) ? '' : 'none';
    fingers.forEach((b, id) => { if (b && b.style.display === 'none') fingers.set(id, null); });
    sync();
  };

  function turnOn() {
    if (TC.on || q.get('touch') === '0') return;
    TC.on = true;
    if (DINO.draw) DINO.draw.touch = true;
    box.style.display = '';
    TC.layout();
  }
  const phone = window.matchMedia && window.matchMedia('(hover: none) and (pointer: coarse)').matches;
  if (q.get('touch') === '1' || phone) turnOn();
  window.addEventListener('touchstart', turnOn, { passive: true });   // a touch screen that was not recognised as a phone
  TC.layout();
})();
