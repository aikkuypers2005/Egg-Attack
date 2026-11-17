// Test players for Egg Attack. They play the way the game is meant to be played: hunt for meat that
// counts as a meal, carry it home, come back to defend the nest, and fight the boss waves.
// Used by test/smoke.js to check that a full game works and how long it takes, for 1 to 8 players.
module.exports = function (DINO) {
  const sim = DINO.sim;
  const NONE = { mx: 0, jump: false, bite: false, grab: false };

  function walk(S, p, toX) {
    // Something on the way that keeps attacking gets fought, otherwise the bot would run from it forever.
    if (!p.carry) {
      for (const d of S.dinos) {
        if (d.atk && d.tgt === p.id && Math.abs(d.x - p.x) < 150 && sim.DINOS[d.kind].role !== 'hazard') return sim.ai.fight(S, p, d);
      }
    }
    const dg = sim.ai.danger(S, p);
    const inp = { mx: Math.abs(toX - p.x) > 6 ? (toX > p.x ? 1 : -1) : 0, jump: dg.jump && !p.prevJump, bite: false, grab: false };
    if (dg.mx && !p.carry) inp.mx = dg.mx;            // with food in its mouth it just keeps running
    return inp;
  }

  // others: the other hunters in the team, so two of them do not walk to the same piece of meat.
  // side: -1 or 1, the side of the world this hunter prefers (0 = no preference).
  function hunter(S, p, others, side) {
    if (p.downT > 0 || p.stunT > 0) return NONE;
    const b = S.baby, D = sim.DINOS;
    if (S.boss) return Math.abs(p.x) > 330 && !p.carry ? walk(S, p, 0) : sim.ai.guard(S, p);
    if (p.carry) return walk(S, p, 0);
    const raidNear = S.dinos.some(d => d.raid && Math.abs(d.x) < 320);
    if (b.stage === 0 || (raidNear && Math.abs(p.x) < 500)) return sim.ai.guard(S, p);

    const need = b.stage;
    const taken = x => others.some(o => !o.carry && o.downT === 0 && Math.abs(o.x - x) < Math.abs(p.x - x) - 1);
    const wrongSide = x => (side && x * side < 0 ? 900 : 0);
    let food = null, fs = 1e9, prey = null, ps = 1e9;
    for (const f of S.foods) {
      if (f.meal === 0 || f.tier < need || f.x > sim.DEEP_X - 70 || taken(f.x)) continue;
      const s = Math.abs(f.x - p.x) + Math.abs(f.x) * 0.5 + wrongSide(f.x);
      if (s < fs) { fs = s; food = f; }
    }
    for (const d of S.dinos) {
      const def = D[d.kind];
      if (d.raid || d.boss || def.food.tier < need || def.role === 'hazard' || def.habitat === 'deep_water' || taken(d.x)) continue;
      const s = Math.abs(d.x - p.x) + Math.abs(d.x) * 0.5 + d.hp * 3 + (def.habitat !== 'land' ? 300 : 0) + 80 + wrongSide(d.x);
      if (s < ps) { ps = s; prey = d; }
    }
    if (food && fs <= ps) {
      if (Math.abs(food.x - p.x) > 16) return walk(S, p, food.x);
      return { mx: 0, jump: false, bite: false, grab: !p.prevGrab };
    }
    if (prey) return Math.abs(prey.x - p.x) > 150 ? walk(S, p, prey.x) : sim.ai.fight(S, p, prey);
    return sim.ai.guard(S, p);
  }

  // Inputs for every T-rex. Alone: you hunt, the computer guards. In a group: 1 guard (2 from 4 players up), the rest hunt.
  function team(S) {
    const n = S.players.length, solo = S.players.some(p => p.ai);
    const guards = solo ? 0 : n >= 4 ? 2 : 1;
    const hunters = S.players.filter((p, i) => !p.ai && i >= guards);
    return S.players.map((p, i) => {
      if (p.ai) return null;
      if (i < guards) return sim.ai.guard(S, p);
      return hunter(S, p, hunters.filter(o => o !== p), hunters.length > 1 ? (hunters.indexOf(p) % 2 ? 1 : -1) : 0);
    });
  }
  const bot = (S, p) => hunter(S, p, [], 0);

  // Plays one game. opts: seed, humans (1 to 8), max (steps), input (function replacing the test players).
  function play(opts) {
    opts = opts || {};
    const S = sim.newGame({ humans: opts.humans || 1, seed: opts.seed || 1 });
    const n = S.players.length, max = opts.max || 60 * 60 * 40;
    const log = { stageAt: {}, bossStart: {}, bossSecs: {}, downs: S.players.map(() => 0), hits: S.players.map(() => 0), babyMin: 100, mealsFrom: [], frames: 0, types: S.players.map(p => p.type) };
    let f = 0, lastStage = 0, hadBoss = false;
    while (f < max && S.mode === 'play') {
      f++;
      const hp = S.players.map(p => p.hp), down = S.players.map(p => p.downT), carry = S.players.map(p => p.carry);
      const meals = S.stats.meals;
      sim.step(S, opts.input ? opts.input(S) : team(S));
      for (let i = 0; i < n; i++) {
        const p = S.players[i];
        if (p.hp < hp[i] - 1) log.hits[i]++;
        if (p.downT > 0 && down[i] === 0) log.downs[i]++;
        // where the meat of every counted meal first appeared, as a distance from the nest
        if (S.stats.meals > meals && carry[i] && !p.carry) log.mealsFrom.push(Math.abs(carry[i].ox));
      }
      log.babyMin = Math.min(log.babyMin, S.baby.hp);
      const fighting = !!(S.boss && S.boss.warnT === 0);
      if (fighting && !hadBoss) log.bossStart[S.boss.stage + 1] = f;
      if (!fighting && hadBoss) { const k = Object.keys(log.bossStart).length; log.bossSecs[k] = Math.round((f - log.bossStart[k]) / 60); }
      hadBoss = fighting;
      if (S.baby.stage !== lastStage) { lastStage = S.baby.stage; log.stageAt[lastStage] = Math.round(f / 60); }
    }
    log.frames = f;
    while (S.mode === 'finale') sim.step(S, []);
    return { S, log };
  }

  return { bot, team, play, NONE };
};
