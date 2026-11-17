// Online co-op for up to 8 players. One browser hosts and runs the game; up to 7 others join with a
// 4-letter room code. PeerJS connects every guest directly to the host (WebRTC).
//
// Messages:  host -> guest  { k: 'hello', slot }   which T-rex is yours
//            host -> guests { k: 'lobby', n }      how many guests have joined
//            guest -> host  { k: 'i', mx, jump, bite, grab }   input, every step
//            host -> guests { k: 's', c }          compact snapshot (snapshot.js), 20 per second
//            host -> guests { k: 'bye' }           the host left
(function () {
  const DINO = window.DINO = window.DINO || {};
  const N = DINO.net = {
    status: '',        // '', opening, wait (host, nobody yet), ready, lost, error
    code: '', slot: 0, count: 0, started: false,
    onInput: null,     // host: (slot, input)
    onLeave: null,     // host: (slot) a guest dropped out during the game
    onState: null,     // guest: (compact snapshot)
    onBye: null        // guest: the host left
  };
  const PREFIX = 'eggattack-room-';
  const MAX_GUESTS = 7;
  let peer = null, conn = null;       // conn: the guest's connection to the host
  let guests = [];                    // host: [{ c, slot }]

  function newCode() {
    const abc = 'ABCDEFGHJKLMNPRSTUVWXYZ';
    let s = '';
    for (let i = 0; i < 4; i++) s += abc[(Math.random() * abc.length) | 0];
    return s;
  }
  function tell(c, obj) { try { if (c && c.open) c.send(obj); } catch (e) { /* closing */ } }
  function lobby() { N.count = guests.length; for (const g of guests) tell(g.c, { k: 'lobby', n: N.count }); }

  // code: only for test links; normally a random code is made.
  N.host = function (code) {
    N.close();
    if (typeof Peer === 'undefined') { N.status = 'error'; return; }
    N.code = code || newCode();
    N.status = 'opening';
    peer = new Peer(PREFIX + N.code);
    peer.on('open', () => { N.status = guests.length ? 'ready' : 'wait'; });
    peer.on('connection', c => {
      c.on('open', () => {
        if (N.started || guests.length >= MAX_GUESTS) { c.close(); return; }       // full, or the game is running
        const g = { c, slot: guests.length + 1 };
        guests.push(g);
        tell(c, { k: 'hello', slot: g.slot });
        N.status = 'ready';
        lobby();
      });
      c.on('data', d => {
        const g = guests.find(o => o.c === c);
        if (g && d && d.k === 'i' && N.onInput) N.onInput(g.slot, d);
      });
      const gone = () => {
        const i = guests.findIndex(o => o.c === c);
        if (i < 0) return;
        const g = guests.splice(i, 1)[0];
        if (N.started) { if (N.onLeave) N.onLeave(g.slot); return; }
        // still in the lobby: close the gap so the T-rex numbers stay 1, 2, 3, ...
        guests.forEach((o, k) => { o.slot = k + 1; tell(o.c, { k: 'hello', slot: o.slot }); });
        if (!guests.length && N.status === 'ready') N.status = 'wait';
        lobby();
      };
      c.on('close', gone);
      c.on('error', gone);
    });
    peer.on('error', e => {
      if (e && e.type === 'unavailable-id' && !code) N.host();        // code already in use: pick another
      else if (N.status !== 'ready' && N.status !== 'wait') N.status = 'error';
    });
  };

  // The host calls this when the game starts: from now on nobody new can join.
  N.begin = function () { N.started = true; };

  N.join = function (code) {
    N.close();
    if (typeof Peer === 'undefined') { N.status = 'error'; return; }
    N.code = code;
    N.status = 'opening';
    peer = new Peer();
    peer.on('open', () => {
      conn = peer.connect(PREFIX + code, { serialization: 'json', reliable: true });
      conn.on('open', () => { N.status = 'ready'; });
      conn.on('data', d => {
        if (!d) return;
        if (d.k === 'hello') N.slot = d.slot;
        else if (d.k === 'lobby') N.count = d.n;
        else if (d.k === 's') { if (N.onState) N.onState(d.c); }
        else if (d.k === 'bye') { if (N.onBye) N.onBye(); }
      });
      conn.on('close', () => { if (N.status !== '') N.status = 'lost'; });
      conn.on('error', () => { N.status = 'lost'; });
    });
    peer.on('error', () => { if (N.status !== 'ready') N.status = 'error'; });
  };

  // Host: to every guest. Guest: to the host.
  N.send = function (obj) {
    if (conn) tell(conn, obj);
    else for (const g of guests) tell(g.c, obj);
  };

  N.close = function () {
    N.status = ''; N.slot = 0; N.count = 0; N.started = false;
    try { if (conn) conn.close(); } catch (e) { /* already closed */ }
    for (const g of guests) { try { g.c.close(); } catch (e) { /* already closed */ } }
    try { if (peer) peer.destroy(); } catch (e) { /* already closed */ }
    conn = null; peer = null; guests = [];
  };
})();
