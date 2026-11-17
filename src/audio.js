// Sound: the music loop and the sound effects.
// The effects are not recordings. Each one is built from a few simple parts listed in data/sfx.json
// (see tools/build_data.js). A.render does the sums; Audio.pde in the Windows version does the same sums.
// Music: "Bassa Island Game Loop" by Kevin MacLeod (incompetech.com), CC BY 4.0. See assets/audio/CREDITS.txt.
(function () {
  const root = typeof window !== 'undefined' ? window : global;
  const DINO = root.DINO = root.DINO || {};
  const A = DINO.audio = { on: true };
  const MUSIC_URL = 'assets/audio/bassa-island-game-loop.mp3';
  const LOOP_SECONDS = 30.72;        // 16 bars at 125 beats a minute; the file has a short tail after that
  const SFX_VOLUME = 0.6, MUSIC_VOLUME = 0.3;

  let table = null;                  // data/sfx.json
  let ac = null, master = null, sfxGain = null, musicGain = null, musicAsked = false;
  const bufs = {}, lastPlay = {};
  let lastEv = 0, fresh = true;

  try { A.on = root.localStorage.getItem('eggattack.sound') !== 'off'; } catch (e) { /* no storage: sound stays on */ }

  A.load = function (data) { table = data; };

  // ---------------------------------------------------------------- building an effect
  // Returns the samples (-1..1) of one sound at the given rate.
  //   tone : frequency slides from f[0] to f[1] (evenly in pitch) over d seconds; loudness v * (1 - time)^2
  //   noise: white noise through a simple low-pass (lp, or sliding from lp[0] to lp[1]); loudness v * (1 - time)
  //   Every part fades in over the first 44 samples, so it does not click.
  A.render = function (parts, rate) {
    let total = 0;
    for (const p of parts) total = Math.max(total, Math.round((p.t + p.d) * rate));
    const out = new Float32Array(total + 1);
    parts.forEach((p, pi) => {
      const n = Math.max(1, Math.round(p.d * rate)), at = Math.round(p.t * rate);
      if (p.w === 'noise') {
        const lp0 = Array.isArray(p.lp) ? p.lp[0] : p.lp, lp1 = Array.isArray(p.lp) ? p.lp[1] : p.lp;
        let seed = 12345 + pi * 977, y = 0;
        for (let i = 0; i < n; i++) {
          const tt = i / n;
          seed = (Math.imul(seed, 1103515245) + 12345) & 0x7fffffff;
          const white = seed / 0x40000000 - 1;
          const cut = lp0 * Math.pow(lp1 / lp0, tt);
          y += (1 - Math.exp(-2 * Math.PI * cut / rate)) * (white - y);
          out[at + i] += y * p.v * (1 - tt) * Math.min(1, i / 44);
        }
      } else {
        let phase = 0;
        for (let i = 0; i < n; i++) {
          const tt = i / n;
          phase += p.f[0] * Math.pow(p.f[1] / p.f[0], tt) / rate;
          const ph = phase - Math.floor(phase);
          const w = p.w === 'sq' ? (ph < 0.5 ? 1 : -1) : p.w === 'saw' ? 2 * ph - 1 : p.w === 'tri' ? 1 - 4 * Math.abs(ph - 0.5) : Math.sin(2 * Math.PI * ph);
          out[at + i] += w * p.v * (1 - tt) * (1 - tt) * Math.min(1, i / 44);
        }
      }
    });
    for (let i = 0; i < out.length; i++) out[i] = Math.max(-1, Math.min(1, out[i]));
    return out;
  };

  // How loud an event is for a listener: 1 everywhere for events without a range, otherwise fading with
  // the distance to the nearest of the T-rexes shown on this screen (ears: their x positions).
  A.loudness = function (m, x, ears) {
    if (!m.range) return 1;
    let dist = Infinity;
    for (const e of ears) dist = Math.min(dist, Math.abs(x - e));
    return Math.max(m.min || 0, 1 - dist / m.range);
  };

  // ---------------------------------------------------------------- playing (browser only)
  // Browsers only allow sound after the first key press, click or tap.
  A.unlock = function () {
    if (typeof window === 'undefined') return;
    if (!ac) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      ac = new AC();
      master = ac.createGain(); master.gain.value = A.on ? 1 : 0; master.connect(ac.destination);
      sfxGain = ac.createGain(); sfxGain.gain.value = SFX_VOLUME; sfxGain.connect(master);
      musicGain = ac.createGain(); musicGain.gain.value = MUSIC_VOLUME; musicGain.connect(master);
    }
    if (ac.state === 'suspended' && !document.hidden) { const p = ac.resume(); if (p && p.catch) p.catch(() => {}); }
    startMusic();
  };

  // The music is decoded once and repeated between its first sound and 16 bars later, so the loop has no gap.
  function startMusic() {
    if (musicAsked || !ac) return;
    musicAsked = true;
    fetch(MUSIC_URL).then(r => { if (!r.ok) throw new Error('music ' + r.status); return r.arrayBuffer(); })
      .then(b => new Promise((ok, no) => ac.decodeAudioData(b, ok, no)))
      .then(buf => {
        const d = buf.getChannelData(0);
        let a = 0;
        while (a < d.length && Math.abs(d[a]) < 0.004) a++;
        const start = a < d.length ? a / buf.sampleRate : 0;
        const src = ac.createBufferSource();
        src.buffer = buf; src.loop = true; src.loopStart = start; src.loopEnd = Math.min(buf.duration, start + LOOP_SECONDS);
        src.connect(musicGain);
        src.start(0, start);
        A.music = { start, end: src.loopEnd, length: buf.duration };
      })
      .catch(() => { musicAsked = false; });      // try again at the next key press or tap
  }

  A.state = () => (ac ? ac.state : 'none');     // for the tests: none, suspended or running

  A.setOn = function (on) {
    A.on = !!on;
    try { root.localStorage.setItem('eggattack.sound', A.on ? 'on' : 'off'); } catch (e) { /* not saved */ }
    if (master) master.gain.value = A.on ? 1 : 0;
  };

  A.play = function (name, vol) {
    if (!ac || !table || ac.state !== 'running' || !A.on) return;
    const now = ac.currentTime;
    if (lastPlay[name] !== undefined && now - lastPlay[name] < 0.04) return;     // the same sound twice at once is only louder
    lastPlay[name] = now;
    let b = bufs[name];
    if (!b) {
      if (!table.sounds[name]) return;
      const data = A.render(table.sounds[name], table.rate);
      b = ac.createBuffer(1, data.length, table.rate);
      b.getChannelData(0).set(data);
      bufs[name] = b;
    }
    const s = ac.createBufferSource(), g = ac.createGain();
    s.buffer = b;
    g.gain.value = Math.max(0, Math.min(1, vol === undefined ? 1 : vol));
    s.connect(g); g.connect(sfxGain);
    s.start();
    A.played = (A.played || 0) + 1;
    A.lastSound = name;
  };

  // New game events become sounds. ears: the x of every T-rex shown on this screen.
  A.reset = function () { lastEv = 0; fresh = true; };
  A.events = function (S, ears) {
    if (!S || !S.evs || !table) return;
    if (fresh) { fresh = false; lastEv = S.tick > 30 ? S.evN : 0; }     // joined a running game: skip what already happened
    if (S.evN < lastEv) lastEv = 0;
    for (let i = 0; i < S.evs.length; i++) {
      const e = S.evs[i];
      if (e.n <= lastEv) continue;
      lastEv = e.n;
      const m = table.events[e.s];
      if (!m) continue;
      const v = A.loudness(m, e.x || 0, ears);
      if (v > 0.03) A.play(m.snd, v);
    }
  };

  if (typeof window !== 'undefined') {
    ['pointerdown', 'pointerup', 'touchend', 'click', 'keydown'].forEach(n => window.addEventListener(n, A.unlock, { passive: true }));
    // no music from a tab in the background or a phone in a pocket
    document.addEventListener('visibilitychange', () => {
      if (!ac) return;
      const p = document.hidden ? ac.suspend() : ac.resume();
      if (p && p.catch) p.catch(() => {});
    });
  }

  if (typeof module !== 'undefined' && module.exports) module.exports = DINO;
})();
