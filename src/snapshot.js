// The compact picture of the game that the online host sends to the guests, 20 times per second.
// It holds only what is needed to draw: short arrays instead of named fields, whole pixels, no timers
// the guest does not show. decode() turns it back into the shape the drawing code expects.
(function () {
  const root = typeof window !== 'undefined' ? window : global;
  const DINO = root.DINO = root.DINO || {};
  const SN = DINO.snap = {};
  const ST = ['idle', 'move', 'attack', 'hurt'], ATK = ['', 'windup', 'strike', 'recover', 'stun'], MODES = ['play', 'finale', 'win', 'over'];
  const ENDS = ['', 'volcano', 'meteor'];
  const r = Math.round;

  SN.encode = function (S) {
    const sim = DINO.sim, kinds = Object.keys(sim.DINOS), types = sim.REX_IDS, b = S.baby, B = S.boss;
    return {
      t: S.tick, m: MODES.indexOf(S.mode), z: S.paused ? 1 : 0, e: ENDS.indexOf(S.ending), ft: S.finaleT, sh: S.shake,
      mg: S.msg || 0, rw: S.raidWarnT > 0 ? S.raidSide : 0,
      b: [r(b.hp * 10) / 10, r(b.hunger), b.stage, b.meals, b.need, b.eggT, b.hurtT, b.eatT, r(b.totalDamage)],
      B: B ? [B.stage, B.warnT, B.side, B.max, B.hp] : 0,
      st: [S.stats.meals, S.stats.kills],
      p: S.players.map(p => [r(p.x), r(p.y), p.face, r(p.hp), p.maxHp, p.downT > 0 ? 1 : 0, p.invT, p.biteT, p.carry ? p.carry.tier : -1,
        (p.slowT > 0 ? 1 : 0) | (p.bleedT > 0 ? 2 : 0) | (p.stunT > 0 ? 4 : 0) | (p.ai ? 8 : 0), types.indexOf(p.type), ST.indexOf(p.anim)]),
      d: S.dinos.map(d => [d.id, kinds.indexOf(d.kind), r(d.x), r(d.y), d.face, r(d.hp), d.maxHp, ST.indexOf(d.st), d.af,
        (d.raid ? 1 : 0) | (d.boss ? 2 : 0) | (d.lead ? 4 : 0) | (d.hidden ? 8 : 0) | (d.hurtT > 8 ? 16 : 0), ATK.indexOf(d.atk), d.atk === 'stun' ? d.atkT : 0]),
      f: S.foods.map(f => [f.id, f.x, r(f.y), f.tier]),
      j: S.projs.map(p => [r(p.x), r(p.y), p.vx > 0 ? 1 : -1]),
      ev: S.evs.map(e => [e.n, e.s, e.x === undefined ? null : e.x, e.y === undefined ? null : e.y, e.v === undefined ? null : e.v])
    };
  };

  SN.decode = function (c) {
    const sim = DINO.sim, kinds = Object.keys(sim.DINOS), types = sim.REX_IDS, b = c.b;
    const evs = c.ev.map(e => {
      const o = { n: e[0], s: e[1] };
      if (e[2] !== null) { o.x = e[2]; o.y = e[3]; }
      if (e[4] !== null) o.v = e[4];
      return o;
    });
    return {
      tick: c.t, mode: MODES[c.m], paused: !!c.z, ending: ENDS[c.e], finaleT: c.ft, shake: c.sh,
      msg: c.mg || null, raidWarnT: c.rw ? 1 : 0, raidSide: c.rw, threat: 0,
      baby: { hp: b[0], maxHp: 100, hunger: b[1], stage: b[2], meals: b[3], need: b[4], eggT: b[5], hurtT: b[6], eatT: b[7], totalDamage: b[8] },
      boss: c.B ? { stage: c.B[0], key: 'boss' + (c.B[0] + 1), warnT: c.B[1], side: c.B[2], max: c.B[3], hp: c.B[4] } : null,
      stats: { meals: c.st[0], kills: c.st[1] },
      players: c.p.map((p, i) => ({
        id: i, x: p[0], y: p[1], face: p[2], hp: p[3], maxHp: p[4], downT: p[5], invT: p[6], biteT: p[7],
        carry: p[8] >= 0 ? { tier: p[8] } : null, slowT: p[9] & 1, bleedT: p[9] & 2, stunT: p[9] & 4, ai: !!(p[9] & 8), type: types[p[10]], anim: ST[p[11]]
      })),
      dinos: c.d.map(d => ({
        id: d[0], kind: kinds[d[1]], x: d[2], y: d[3], face: d[4], hp: d[5], maxHp: d[6], st: ST[d[7]], af: d[8],
        raid: !!(d[9] & 1), boss: !!(d[9] & 2), lead: !!(d[9] & 4), hidden: !!(d[9] & 8), hurtT: d[9] & 16 ? 12 : 0, atk: ATK[d[10]], atkT: d[11]
      })),
      foods: c.f.map(f => ({ id: f[0], x: f[1], y: f[2], tier: f[3] })),
      projs: c.j.map(p => ({ x: p[0], y: p[1], vx: p[2] })),
      evs, evN: evs.length ? evs[evs.length - 1].n : 0,
      bushes: sim.BUSH_SPOTS
    };
  };

  // Smooth movement between two snapshots: a = 0 shows the older one, a = 1 the newer one.
  // Things that jumped far (a respawn) are not slid across the screen.
  SN.blend = function (prev, cur, a) {
    if (!prev || a >= 1 || prev.players.length !== cur.players.length) return cur;
    const mix = (o, n) => {
      if (Math.abs(n.x - o.x) > 60 || Math.abs(n.y - o.y) > 60) return n;
      const m = Object.assign({}, n);
      m.x = o.x + (n.x - o.x) * a;
      m.y = o.y + (n.y - o.y) * a;
      return m;
    };
    const old = new Map(prev.dinos.map(d => [d.id, d]));
    const out = Object.assign({}, cur);
    out.players = cur.players.map((p, i) => mix(prev.players[i], p));
    out.dinos = cur.dinos.map(d => (old.has(d.id) ? mix(old.get(d.id), d) : d));
    return out;
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = DINO;
})();
