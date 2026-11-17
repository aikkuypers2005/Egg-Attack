// Egg Attack - the p5.js sketch: setup, the 60 steps per second game loop, menus and lobbies.
(function () {
  const DINO = window.DINO, sim = DINO.sim, D = DINO.draw, SP = DINO.sprites, FX = DINO.fx, I = DINO.input, N = DINO.net, SN = DINO.snap;
  const W = sim.W, H = sim.H;
  const STEP = 1000 / 60;
  const SNAP_EVERY = 3;         // the host sends a snapshot every 3 steps: 20 per second
  const q = new URLSearchParams(location.search);
  const tx = () => DINO.TEXT;

  let ready = false, t = 0, acc = 0;
  let app = 'title';            // title, controls, lobby, host, join, play, pause
  let role = 'solo';            // solo, local, host, guest
  let S = null, sel = 0, psel = 0, joinCode = '', notice = '', noticeT = 0;
  let view = { me: 0, humans: [0] };
  let devs = [];                // one computer: the device of each player, in the order they joined
  let remote = [];              // host: the latest input of each guest, by T-rex number
  let snapPrev = null, snapCur = null, snapAge = 0;     // guest: the last two snapshots

  const MENU = ['m_solo', 'm_local', 'm_host', 'm_join', 'm_controls'];
  const AUTO = q.get('auto');   // test links: this player presses keys by itself

  N.onInput = (slot, d) => { remote[slot] = d; };
  N.onLeave = slot => {         // a guest dropped out: the computer takes over that T-rex
    if (S && S.players[slot]) { S.players[slot].ai = true; remote[slot] = null; say(tx().ai_took); }
  };
  N.onState = c => {
    snapPrev = snapCur;
    snapCur = SN.decode(c);
    snapAge = 0;
    if (app === 'join') { app = 'play'; role = 'guest'; view = { me: N.slot, humans: [N.slot] }; FX.reset(); D.resetView(); }
  };
  N.onBye = () => toTitle(tx().net_bye);

  function say(msg) { notice = msg; noticeT = 300; }

  function start(r, humans) {
    role = r;
    FX.reset();
    D.resetView();
    S = sim.newGame({ humans, seed: (Date.now() & 0x7fffffff) || 13374201 });
    app = 'play';
    const all = S.players.map((p, i) => i).filter(i => !S.players[i].ai);
    view = r === 'local' ? { me: -1, humans: all } : { me: 0, humans: [0] };
    remote = [];
    if (r === 'host') { N.begin(); N.send({ k: 's', c: SN.encode(S) }); }
  }

  function toTitle(msg) {
    if (role === 'host') N.send({ k: 'bye' });
    N.close();
    S = null; snapPrev = snapCur = null;
    app = 'title'; role = 'solo'; sel = 0;
    if (msg) say(msg);
  }

  function fit() {
    const s = Math.min(window.innerWidth / W, window.innerHeight / H);
    const el = document.getElementById('game');
    if (!el) return;
    el.style.width = Math.max(W, Math.floor(W * s)) + 'px';
    el.style.height = Math.max(H, Math.floor(H * s)) + 'px';
  }
  window.windowResized = fit;

  window.setup = function () {
    pixelDensity(1);
    const c = createCanvas(W, H);
    noSmooth();
    frameRate(60);
    c.elt.id = 'game';
    fit();
    D.init(drawingContext);

    const fontsP = document.fonts
      ? Promise.all([document.fonts.load("8px 'Press Start 2P'")]).catch(() => {})
      : Promise.resolve();
    const dataP = Promise.all(['biomes', 'dinos', 'rexes', 'sprites'].map(n => fetch('data/' + n + '.json').then(r => r.json())));

    Promise.all([fontsP, dataP, D.loadBackdrops()]).then(([, [biomesData, dinosData, rexData, spritesData]]) => {
      sim.loadData(biomesData, dinosData, rexData);
      SP.build(spritesData);
      D.clearText();
      ready = true;
      testLinks();
    });
  };

  // Links for testing and screenshots:
  //   ?autostart=solo            start a game alone        (&x=-3600 puts you somewhere)
  //   ?autostart=local&n=5       5 players on one computer (&xs=-900,0,40,1200,3000 puts them somewhere)
  //   &stage=2  &boss=1  &spawn=allosaurus (&raid=1)  &finale=meteor
  //   ?host=ABCD&n=2             host with this code and start when 2 guests have joined
  //   ?join=ABCD                 join that game            (&auto=1 walks and bites by itself)
  function testLinks() {
    if (q.get('host')) { app = 'host'; N.host(q.get('host').toUpperCase()); return; }
    if (q.get('join')) { app = 'join'; joinCode = q.get('join').toUpperCase(); N.join(joinCode); return; }
    const m = q.get('autostart');
    if (!m) return;
    const n = Math.max(2, Math.min(8, Number(q.get('n')) || 2));
    if (m === 'local') { devs = I.DEVICES.slice(0, n); start('local', n); } else start('solo', 1);
    if (q.get('x')) S.players[0].x = Number(q.get('x')) || 0;
    if (q.get('xs')) q.get('xs').split(',').forEach((v, i) => { if (S.players[i]) S.players[i].x = Number(v) || 0; });
    if (q.get('stage')) sim.debug.setStage(S, Number(q.get('stage')) || 0);
    if (q.get('boss')) sim.debug.startBoss(S);
    if (q.get('spawn') && sim.DINOS[q.get('spawn')]) sim.spawnDino(S, q.get('spawn'), S.players[0].x + 70, { raid: !!q.get('raid'), force: true });
    if (q.get('finale')) { sim.debug.finale(S, q.get('finale') === 'meteor' ? 'meteor' : 'volcano'); S.finaleT = Number(q.get('ft')) || 80; }
  }

  window.draw = function () {
    if (!ready) { D.R(0, 0, W, H, '#08070d'); return; }
    acc += Math.min(100, deltaTime);
    let n = 0;
    while (acc >= STEP && n < 5) { acc -= STEP; tick(); n++; }
    if (n === 5) acc = 0;
    render();
  };

  // ---------------------------------------------------------------- one step
  function tick() {
    t++;
    const m = I.tick();
    if (noticeT > 0) noticeT--;
    if (app === 'title') tickTitle(m);
    else if (app === 'controls') { if (m.back || m.ok || m.click) app = 'title'; }
    else if (app === 'lobby') tickLobby(m);
    else if (app === 'host') tickHost(m);
    else if (app === 'join') tickJoin(m);
    else if (app === 'pause') tickPause(m);
    else if (app === 'play') tickPlay(m);
  }

  function tickTitle(m) {
    if (m.up) sel = (sel + MENU.length - 1) % MENU.length;
    if (m.down) sel = (sel + 1) % MENU.length;
    if (m.click) {
      for (let i = 0; i < MENU.length; i++) {
        const ry = 74 + i * 20;
        if (m.click.y >= ry - 4 && m.click.y <= ry + 16 && m.click.x >= 90 && m.click.x <= 390) { sel = i; m.ok = true; break; }
      }
    }
    if (!m.ok) return;
    const k = MENU[sel];
    if (k === 'm_solo') start('solo', 1);
    else if (k === 'm_local') { app = 'lobby'; devs = []; I.joinPresses(); }
    else if (k === 'm_host') { app = 'host'; N.host(); }
    else if (k === 'm_join') { app = 'join'; joinCode = ''; N.close(); }
    else if (k === 'm_controls') app = 'controls';
  }

  // Players on one computer join by pressing their bite button. Enter or Start begins with 2 or more.
  function tickLobby(m) {
    if (m.back) { app = 'title'; return; }
    for (const dev of I.joinPresses()) {
      const i = devs.indexOf(dev);
      if (i >= 0) devs.splice(i, 1); else if (devs.length < 8) devs.push(dev);       // press again to leave
    }
    if (m.start && devs.length >= 2) start('local', devs.length);
  }

  function tickHost(m) {
    if (m.back || (m.click && m.click.y > 236)) { toTitle(); return; }
    if (N.status === 'error' || N.status === 'lost') { toTitle(tx().net_err); return; }
    const wanted = Number(q.get('n')) || 0;                           // test link: start by itself
    if (N.status === 'ready' && N.count > 0 && (m.ok || (wanted && N.count >= wanted && t > 120))) start('host', 1 + N.count);
  }

  function tickJoin(m) {
    if (m.back || (m.click && m.click.y > 236)) { toTitle(); return; }
    if (N.status === 'error' || N.status === 'lost') { toTitle(tx().net_err); return; }
    if (N.status !== '') return;                                      // connecting or connected: wait for the host
    for (const ch of m.typed) {
      if (ch === 'Backspace') joinCode = joinCode.slice(0, -1);
      else if (/^[a-zA-Z]$/.test(ch) && joinCode.length < 4) joinCode += ch.toUpperCase();
    }
    const abc = 'ABCDEFGHJKLMNPRSTUVWXYZ';
    if (!m.typed.length) {                                            // with a controller: up/down changes the last letter
      if (m.right && joinCode.length < 4) joinCode += 'A';
      if (m.left) joinCode = joinCode.slice(0, -1);
      if ((m.up || m.down) && joinCode.length) {
        const idx = (abc.indexOf(joinCode.slice(-1)) + (m.up ? 1 : -1) + abc.length) % abc.length;
        joinCode = joinCode.slice(0, -1) + abc[idx];
      }
    }
    if (m.ok && joinCode.length === 4) N.join(joinCode);
  }

  function tickPause(m) {
    if ((role === 'host' || role === 'guest') && N.status === 'lost') { toTitle(tx().net_lost); return; }
    if (m.up || m.down) psel = 1 - psel;
    if (m.pause || m.back || (m.ok && psel === 0)) {
      app = 'play';
      if (role === 'host' && S) { S.paused = false; N.send({ k: 's', c: SN.encode(S) }); }
      return;
    }
    if (m.ok && psel === 1) toTitle();
  }

  // A test player for the links with &auto=1: walks back and forth near the nest and bites.
  function autoInput() {
    const me = S && S.players[view.me >= 0 ? view.me : 0];
    const phase = Math.floor(t / 90) % 4;
    return { mx: me && Math.abs(me.x) > 160 ? (me.x > 0 ? -1 : 1) : phase === 0 ? 1 : phase === 2 ? -1 : 0, jump: t % 150 === 0, bite: t % 40 < 3, grab: false };
  }

  function tickPlay(m) {
    if (role === 'guest') {
      if (N.status === 'lost') { toTitle(tx().net_lost); return; }
      N.send(Object.assign({ k: 'i' }, AUTO ? autoInput() : I.pollAll()));
      snapAge++;
      S = SN.blend(snapPrev, snapCur, snapAge / SNAP_EVERY);
      if (snapCur) FX.tick(snapCur);
      if (m.pause) toTitle();                                         // a guest leaves; the computer takes over their T-rex
      return;
    }
    if (role === 'host' && N.status === 'lost') { toTitle(tx().net_lost); return; }
    if (m.pause && S && S.mode === 'play') {
      app = 'pause'; psel = 0;
      if (role === 'host') { S.paused = true; N.send({ k: 's', c: SN.encode(S) }); }
      return;
    }
    let inputs;
    if (role === 'local') inputs = devs.map(d => I.poll(d));
    else { inputs = remote.slice(); inputs[0] = AUTO ? autoInput() : I.pollAll(); }
    sim.step(S, inputs);
    if (role === 'host' && t % SNAP_EVERY === 0) N.send({ k: 's', c: SN.encode(S) });
    FX.tick(S);
    if ((S.mode === 'win' || S.mode === 'over') && S.finaleT > 60 && (m.ok || m.click)) toTitle();
  }

  // ---------------------------------------------------------------- drawing the menus
  function panel(x, y, w, h) { D.R(x, y, w, h, 'rgba(10, 9, 20, 0.86)'); }

  function render() {
    drawingContext.imageSmoothingEnabled = false;
    const x = tx();
    if (q.get('sheet')) { D.drawSheet(Number(q.get('sheet')) || 1); return; }   // sprite review pages

    D.menuOpen = app === 'pause';   // hides the deal panel under the pause menu
    if (app === 'play' || app === 'pause') {
      if (!S) { D.R(0, 0, W, H, '#08070d'); return; }
      D.render(S, view, t);
      if (noticeT > 0 && S.mode === 'play') { panel(50, 236, 380, 15); D.T(notice, 240, 235, '#ffb0a0', 'vt', 1); }
      if (app === 'pause' || (S.paused && role === 'guest')) {
        D.R(0, 0, W, H, 'rgba(8, 6, 16, 0.76)');
        D.T(x.paused, 240, 82, '#ffffff', 'ps', 1, 2);
        if (app === 'pause') [x.resume, x.tomenu].forEach((s, i) => D.T((psel === i ? '> ' : '') + s + (psel === i ? ' <' : ''), 240, 126 + i * 20, psel === i ? '#f8d040' : '#ffffff', 'vt', 1));
      }
      return;
    }

    D.drawMenuBackdrop(t);
    if (app === 'title') {
      D.T(x.title, 242, 22, '#744318', 'ps', 1, 2, false);
      D.T(x.title, 240, 20, '#ffe868', 'ps', 1, 2);
      D.T(x.sub, 240, 44, '#e4ecff', 'vt', 1);
      MENU.forEach((k, i) => D.T((i === sel ? '> ' : '') + x[k] + (i === sel ? ' <' : ''), 240, 74 + i * 20, i === sel ? '#f8d040' : '#ffffff', 'vt', 1));
      if (noticeT > 0) { D.R(90, 182, 300, 16, 'rgba(80, 12, 12, 0.85)'); D.T(notice, 240, 182, '#ff9898', 'vt', 1); }
      D.T(x.credit, 240, 236, '#cfd6ff', 'vt', 1);
      D.T(x.nav, 240, 252, '#a8b4d4', 'vt', 1);
    } else if (app === 'controls') {
      panel(10, 8, 460, 254);
      D.T(x.c_head, 240, 14, '#ffe868', 'ps', 1, 1);
      ['c_k1', 'c_k2', 'c_k3', 'c_k4', 'c_pad', 'c_solo'].forEach((k, i) => D.T(x[k], 20, 32 + i * 15, i < 4 ? '#f8d040' : i === 4 ? '#ff9868' : '#78e878', 'vt', 0));
      ['c_tip1', 'c_tip2', 'c_tip3', 'c_tip4', 'c_tip5'].forEach((k, i) => D.T(x[k], 20, 130 + i * 16, '#ffffff', 'vt', 0));
      D.T(x.back, 240, 242, '#a8b4d4', 'vt', 1);
    } else if (app === 'lobby') {
      panel(20, 10, 440, 250);
      D.T(x.lobby_head, 240, 16, '#ffffff', 'ps', 1, 1);
      D.T(x.lobby_hint, 240, 32, '#cfd6ff', 'vt', 1);
      for (let i = 0; i < 8; i++) {
        const cx = 34 + (i % 2) * 216, cy = 52 + (i >> 1) * 17;
        D.T('P' + (i + 1), cx, cy, devs[i] ? '#f8d040' : '#5a5878', 'vt', 0);
        D.T(devs[i] ? I.NAMES[devs[i]] : '...', cx + 26, cy, devs[i] ? '#ffffff' : '#5a5878', 'vt', 0);
      }
      ['c_k1', 'c_k2', 'c_k3', 'c_k4', 'c_pad'].forEach((k, i) => D.T(x[k], 34, 128 + i * 14, '#a8b4d4', 'vt', 0));
      D.T(x.lobby_pads.replace('{n}', I.padCount()), 34, 202, '#78e878', 'vt', 0);
      D.T(devs.length >= 2 ? x.lobby_go.replace('{n}', devs.length) : x.lobby_need, 240, 232, devs.length >= 2 ? '#68e878' : '#ffffff', 'vt', 1);
    } else if (app === 'host') {
      panel(40, 14, 400, 240);
      D.T(x.host_head, 240, 24, '#ffffff', 'ps', 1, 1);
      D.T(x.host_code, 240, 52, '#cfd6ff', 'vt', 1);
      D.T(N.status === 'opening' ? '....' : N.code, 240, 76, '#f8d040', 'ps', 1, 4);
      const waiting = x.host_wait + ['', '.', '..'][Math.floor(t / 30) % 3];
      D.T(N.count > 0 ? x.host_n.replace('{n}', N.count) : waiting, 240, 134, N.count > 0 ? '#68e878' : '#ffffff', 'vt', 1);
      if (N.count > 0) D.T(x.host_go, 240, 152, '#ffffff', 'vt', 1);
      D.drawLineup(t, 222);
      D.T(x.back, 240, 238, '#a8b4d4', 'vt', 1);
    } else if (app === 'join') {
      panel(40, 14, 400, 240);
      D.T(x.join_head, 240, 24, '#ffffff', 'ps', 1, 1);
      D.T(x.join_code, 240, 52, '#cfd6ff', 'vt', 1);
      D.T((joinCode + '____').slice(0, 4), 240, 76, '#f8d040', 'ps', 1, 4);
      if (N.status === 'opening') D.T(x.join_go, 240, 134, '#ffffff', 'vt', 1);
      else if (N.status === 'ready') {
        D.T(x.join_ok.replace('{n}', N.slot + 1), 240, 134, '#68e878', 'vt', 1);
        D.T(x.join_n.replace('{n}', N.count + 1), 240, 152, '#ffffff', 'vt', 1);
      }
      D.drawLineup(t, 222);
      D.T(x.back, 240, 238, '#a8b4d4', 'vt', 1);
    }
  }

  // If the host's tab is hidden the browser stops the game loop, so pause for everyone.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && role === 'host' && app === 'play' && S && !q.get('host')) {
      app = 'pause'; psel = 0; S.paused = true;
      N.send({ k: 's', c: SN.encode(S) });
    }
  });

  // for testing in the browser console and for the test pages
  DINO.dbg = { get S() { return S; }, get app() { return app; }, get role() { return role; }, get view() { return view; }, start, toTitle, sim, net: N };
})();
