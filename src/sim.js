// Egg Attack - the game rules (60 steps per second). No drawing code in here, so Node can test it
// and the online host can run it.
(function () {
  const root = typeof window !== 'undefined' ? window : global;
  const DINO = root.DINO = root.DINO || {};
  const sim = DINO.sim = {};

  sim.W = 480;
  sim.H = 270;
  sim.G = 216;
  sim.WORLD_MIN = -5400;       // set from biomes.json in loadData
  sim.WORLD_MAX = 5400;
  sim.SEA_X = 4250;            // where the sea shore starts
  sim.DEEP_X = 4850;           // where the deep sea starts
  sim.MAX_DINOS = 30;          // for 2 T-rexes; 3 more for every extra T-rex (see maxDinos)
  // How the game grows with more T-rexes. k is the number of T-rexes above 2.
  sim.MEAL_K = 0.65;           // meals per stage:      x (1 + 0.65 k)
  sim.BOSS_K = 0.45;           // boss leader health:   x (1 + 0.45 k)
  sim.MAX_FOODS = 24;
  sim.METEOR_THRESHOLD = 130;  // total damage to the baby that turns the ending into the meteor
  sim.MEALS = [0, 5, 5, 5];    // meals the baby needs in stage 1, 2 and 3 (the egg needs none)
  sim.EGG_T = 3600;            // the egg is ready to hatch after 60 seconds
  sim.BOSS_WARN = 300;         // 5 second warning before a boss wave
  const G = sim.G;

  let BIOMES = null, DINOS = null, REXES = null, ZONE_KINDS = {};

  sim.loadData = function (biomesData, dinosData, rexData) {
    BIOMES = biomesData;
    DINOS = dinosData;
    REXES = rexData;
    sim.BIOMES = BIOMES;
    sim.DINOS = DINOS;
    sim.REXES = REXES;
    sim.REX_IDS = Object.keys(REXES);
    sim.WORLD_MIN = BIOMES.worldMin;
    sim.WORLD_MAX = BIOMES.worldMax;
    for (let i = 0; i < BIOMES.water.length; i++) {
      const w = BIOMES.water[i];
      if (w.depth === 'deep') sim.DEEP_X = w.x0; else sim.SEA_X = w.x0;   // the last shallow entry is the shore
    }
    ZONE_KINDS = {};
    for (const k of Object.keys(DINOS)) {
      for (const z of DINOS[k].biomes) (ZONE_KINDS[z] = ZONE_KINDS[z] || []).push(k);
    }
  };

  if (typeof module !== 'undefined' && module.exports && typeof require === 'function') {
    try { sim.loadData(require('../data/biomes.json'), require('../data/dinos.json'), require('../data/rexes.json')); } catch (e) { /* loaded later */ }
  }

  // ---------------------------------------------------------------- small helpers
  // Random numbers come from a seed in the game state, so a game can be replayed exactly.
  function rnd(S) {
    S.seed = (Math.imul(S.seed, 1664525) + 1013904223) | 0;
    return (S.seed >>> 0) / 4294967296;
  }
  function rndi(S, a, b) { return a + Math.floor(rnd(S) * (b - a + 1)); }
  function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
  function r1(v) { return Math.round(v * 10) / 10; }
  function r3(v) { return Math.round(v * 1000) / 1000; }

  sim.biomeAt = function (x) {
    if (!BIOMES) return { id: 'meadow', name: 'Fern Meadow', tier: 0 };
    for (let i = 0; i < BIOMES.zones.length; i++) {
      const z = BIOMES.zones[i];
      if (x >= z.x0 && x <= z.x1) return z;
    }
    return x < 0 ? BIOMES.zones[0] : BIOMES.zones[BIOMES.zones.length - 1];
  };

  sim.waterAt = function (x) {
    if (!BIOMES) return null;
    for (let i = 0; i < BIOMES.water.length; i++) {
      const w = BIOMES.water[i];
      if (x >= w.x0 && x <= w.x1) return w.depth;
    }
    return null;
  };

  // Events tell the drawing code what just happened (for effects). Only the last 14 are kept.
  function emit(S, s, x, y, v) {
    S.evN++;
    const ev = { n: S.evN, s };
    if (typeof x === 'number') { ev.x = Math.round(x); ev.y = Math.round(y || G); }
    if (v !== undefined) ev.v = v;
    S.evs.push(ev);
    if (S.evs.length > 14) S.evs.shift();
  }

  function say(S, key, ticks) { S.msg = key; S.msgT = ticks || 180; }

  // ---------------------------------------------------------------- tables
  // Food spots: one per biome, plus two scraps by the nest that only fill hunger.
  const NODE_SPOTS = [
    { x: -180,  tier: 0, resp: 3600 }, { x: 180,  tier: 0, resp: 3600 },
    { x: -1100, tier: 1, resp: 12000 }, { x: 1100, tier: 1, resp: 12000 },
    { x: -2350, tier: 2, resp: 12000 }, { x: 2350, tier: 2, resp: 12000 },
    { x: -3600, tier: 3, resp: 12000 }, { x: 3600, tier: 3, resp: 12000 },
    { x: -4800, tier: 4, resp: 12000 }, { x: 4800, tier: 4, resp: 12000 }
  ];
  const BUSH_SPOTS = [-1520, -1260, -980, -760, -610, 620, 930, 1560];
  const HUNGER_BY_TIER = [12, 30, 40, 50, 65];
  // How many wild creatures each biome keeps (the sea adds a Plesiosaurus and a Mosasaurus on top).
  const ZONE_TARGET = { jungle: 3, river: 3, swamp: 2, mushroom: 2, dunes: 2, crag: 2, canyon: 2, coast: 1 };

  // Raids on the nest, by the baby's stage. One list is picked at random each time.
  const RAIDS = [
    [['compsognathus', 'compsognathus']],
    [['compsognathus', 'compsognathus', 'compsognathus'], ['velociraptor', 'velociraptor'], ['dilophosaurus', 'compsognathus', 'compsognathus']],
    [['velociraptor', 'velociraptor', 'compsognathus'], ['dilophosaurus', 'dilophosaurus', 'compsognathus'], ['pteranodon', 'pteranodon'], ['carnotaurus', 'compsognathus', 'compsognathus']],
    [['carnotaurus', 'velociraptor', 'velociraptor'], ['allosaurus', 'allosaurus', 'dilophosaurus'], ['pteranodon', 'pteranodon', 'dilophosaurus'], ['quetzalcoatlus', 'velociraptor', 'velociraptor']]
  ];
  const RAID_GAP = [1500, 2100, 1950, 1950];   // steps between raids, by stage

  // Boss waves. lead: [creature, health multiplier]. With two leaders they come from opposite sides.
  // Leaders have a lot of health because they only take full damage during their opening (see hurtDino).
  const BOSSES = [
    { key: 'boss1', lead: [['velociraptor', 45]], pack: ['velociraptor', 'velociraptor', 'compsognathus', 'compsognathus', 'compsognathus'] },
    { key: 'boss2', lead: [['carnotaurus', 24]], pack: ['dilophosaurus', 'dilophosaurus'] },
    { key: 'boss3', lead: [['spinosaurus', 12]], pack: ['allosaurus', 'quetzalcoatlus'] },
    { key: 'boss4', lead: [['tyrannosaurus', 11], ['giganotosaurus', 11]], pack: [] }
  ];
  sim.BOSSES = BOSSES;
  sim.LEAD_ARMOR = 0.2;        // share of a bite's damage a boss leader takes outside its opening

  // Attack timing in steps. Every attack is wind-up -> strike -> recovery.
  const WIND = { tiny: 24, small: 24, 'small-medium': 28, medium: 30, 'medium-large': 34, large: 38, giant: 46, titan: 48 };
  const RECO = { tiny: 30, small: 30, 'small-medium': 32, medium: 34, 'medium-large': 38, large: 42, giant: 48, titan: 48 };
  const LIGHT = { tiny: true, small: true, 'small-medium': true, medium: true };   // these can be interrupted
  // wind/reco 0 means: use the size tables above. cd is the pause before the next attack.
  const MOVES = {
    bite:   { wind: 0,  strike: 8,  reco: 0,  cd: 14 },
    sweep:  { wind: 46, strike: 8,  reco: 60, cd: 20 },
    stomp:  { wind: 30, strike: 8,  reco: 40, cd: 120 },
    roar:   { wind: 46, strike: 8,  reco: 30, cd: 30 },
    spit:   { wind: 30, strike: 8,  reco: 30, cd: 50 },
    pounce: { wind: 24, strike: 60, reco: 36, cd: 40 },
    charge: { wind: 40, strike: 70, reco: 40, cd: 50 },
    dive:   { wind: 36, strike: 45, reco: 50, cd: 60 },
    lunge:  { wind: 40, strike: 8,  reco: 60, cd: 40 }
  };
  sim.MOVES = MOVES; sim.WIND = WIND; sim.RECO = RECO; sim.LIGHT = LIGHT;

  // ---------------------------------------------------------------- creating things
  // Where T-rex number id stands at the nest when there are n of them (also where it comes back after a knock-out).
  function homeX(id, n) { return Math.round((id - (n - 1) / 2) * 24); }

  // type: one of the 8 T-rex types in rexes.json. ai: the computer plays this one.
  function mkPlayer(id, n, type, ai) {
    const x = homeX(id, n), hp = REXES[type].hp;
    return {
      id, type, x, y: G, vx: 0, vy: 0, face: x < 0 ? -1 : 1, g: true,
      hp, maxHp: hp, downT: 0, invT: 0, biteT: 0, biteCd: 0,
      prevBite: false, prevGrab: false, prevJump: false,
      carry: null, slowT: 0, bleedT: 0, stunT: 0, ai: !!ai, anim: 'idle', animT: 0
    };
  }

  function extra(S) { return S.players.length - 2; }                      // T-rexes above 2
  function maxDinos(S) { return sim.MAX_DINOS + 3 * extra(S); }
  sim.maxDinos = maxDinos;

  function airCruise(kind) { return G - (kind === 'quetzalcoatlus' ? 82 : 70); }

  // opts: { raid, boss, lead, hpMul, force }  (a plain true/false is read as raid)
  sim.spawnDino = function (S, kind, x, opts) {
    const def = DINOS[kind];
    if (typeof opts === 'boolean') opts = { raid: opts };
    opts = opts || {};
    if (!def || (!opts.force && S.dinos.length >= maxDinos(S))) return null;
    S.nextId++;
    const y = def.habitat === 'air' ? airCruise(kind)
            : (def.habitat === 'water' || def.habitat === 'deep_water') ? G + 6 : G;
    const hp = Math.round(def.hp * (opts.hpMul || 1));
    const d = {
      id: S.nextId, kind, x: r1(x), y: r1(y), vx: 0, vy: 0, face: x < 0 ? 1 : -1,
      hp, maxHp: hp, st: 'idle', af: 0, t: 0, cd: rndi(S, 20, 60), hurtT: 0,
      raid: !!opts.raid, boss: !!opts.boss, lead: !!opts.lead,
      homeX: Math.round(x), alerted: false, hidden: kind === 'dryosaurus' && !opts.raid, specT: 0,
      atk: '', atkKind: '', atkT: 0, hit: 0, tgt: -2, tx: 0, ty: 0, combo: 0, rage: false, called: false
    };
    S.dinos.push(d);
    return d;
  };

  // meal: how many meals this meat counts as (0 = snack, hunger only).
  // ox: where the meat first appeared. It is kept when the meat is carried and dropped again.
  function spawnFood(S, x, tier, nodeIdx, ox) {
    if (S.foods.length >= sim.MAX_FOODS) return null;
    S.nextId++;
    const f = {
      id: S.nextId, x: Math.round(x), y: G, vy: -1.8, tier,
      hunger: HUNGER_BY_TIER[tier], meal: tier >= 4 ? 2 : tier >= 1 ? 1 : 0,
      node: nodeIdx !== undefined ? nodeIdx : -1, age: 0, ox: ox !== undefined ? ox : Math.round(x)
    };
    S.foods.push(f);
    return f;
  }

  sim.newGame = function (opts) {
    opts = opts || {};
    // humans: 1 to 8 people. Playing alone always means 2 T-rexes: yours and one played by the computer.
    const humans = clamp(Math.round(opts.humans || opts.players || 1), 1, 8);
    const n = humans === 1 ? 2 : humans;
    const S = {
      tick: 0, seed: (opts.seed !== undefined ? opts.seed : 13374201) | 0,
      mode: 'play',            // play, finale, win, over
      paused: false, threat: 0,
      raidCd: 900, raidSide: 0, raidWarnT: 0, finaleT: 0, ending: '',
      shake: 0, msg: null, msgT: 0, evN: 0, evs: [], nextId: 1,
      stats: { fed: 0, meals: 0, kills: 0, bosses: 0 },
      baby: { hp: 100, maxHp: 100, hunger: 100, stage: 0, meals: 0, need: 0, eggT: 0, totalDamage: 0, hurtT: 0, eatT: 0 },
      boss: null,              // { stage, key, warnT, side, max, hp }
      players: [],
      dinos: [], foods: [], projs: [],
      nodes: NODE_SPOTS.map(n => ({ x: n.x, tier: n.tier, resp: n.resp, cd: 0 })),
      zcd: BIOMES.zones.map(() => 0),
      bushes: BUSH_SPOTS.slice()
    };
    // Deal the T-rex types: shuffle the 8 types with the game's seed and hand them out, so nobody gets the same one.
    const types = sim.REX_IDS.slice();
    for (let i = types.length - 1; i > 0; i--) {
      const j = rndi(S, 0, i), tmp = types[i];
      types[i] = types[j]; types[j] = tmp;
    }
    for (let i = 0; i < n; i++) S.players.push(mkPlayer(i, n, types[i], humans === 1 && i === 1));
    S.nodes.forEach((n, i) => { const f = spawnFood(S, n.x, n.tier, i); if (f) f.vy = 0; });
    // Fill every biome with wildlife so the world is alive from the first step.
    for (let pass = 0; pass < 3; pass++) {
      for (let zi = 0; zi < BIOMES.zones.length; zi++) {
        const z = BIOMES.zones[zi];
        if (zoneCount(S, z) < zoneTarget(S, z)) spawnWild(S, z, true);
      }
    }
    spawnSea(S);
    return S;
  };

  // ---------------------------------------------------------------- the baby
  function needOf(S) { return Math.round((sim.MEALS[S.baby.stage] || 0) * (1 + sim.MEAL_K * extra(S))); }

  // quiet: no effect and no shake (used for the slow damage of starving).
  // A hit never takes more than 14 health, and the baby cannot be hit again for half a second,
  // so even a boss at the nest leaves a few seconds to get back and save it.
  function hurtBaby(S, dmg, quiet) {
    if (S.mode !== 'play' || dmg <= 0) return;
    const b = S.baby;
    if (!quiet) {
      if (b.hurtT > 0) return;
      dmg = Math.min(dmg, 14);
    }
    const actual = Math.min(b.hp, dmg);
    b.hp = r3(Math.max(0, b.hp - dmg));
    b.totalDamage = r3(b.totalDamage + actual);
    if (!quiet) {
      b.hurtT = 30;
      S.shake = Math.max(S.shake, 5);
      emit(S, 'babyhit', 0, G - 8);
    }
    if (b.hp <= 0) {
      b.hp = 0;
      S.mode = 'over';
      S.finaleT = 0;
      emit(S, 'gameover', 0, G);
    }
  }

  // Returns how many meals this food counted as.
  sim.feedBaby = function (S, food) {
    const b = S.baby;
    b.hunger = clamp(r3(b.hunger + food.hunger), 0, 100);
    b.hp = clamp(r3(b.hp + 2), 0, b.maxHp);
    b.eatT = 30;
    S.stats.fed++;
    let counted = 0;
    if (b.stage === 0) say(S, 'egg_hint', 150);
    else if (b.stage <= 3 && !S.boss && food.meal > 0) {
      if (food.tier >= b.stage) {
        counted = food.meal;
        b.meals = Math.min(needOf(S), b.meals + food.meal);
        S.stats.meals += counted;
      } else say(S, 'need_bigger', 150);
    }
    emit(S, counted ? 'meal' : 'feed', 0, G - 10, food.tier);
    if (counted && b.meals >= needOf(S)) startBoss(S);
    return counted;
  };

  function triggerFinale(S) {
    S.mode = 'finale';
    S.finaleT = 0;
    S.ending = S.baby.totalDamage >= sim.METEOR_THRESHOLD ? 'meteor' : 'volcano';
    S.dinos = [];
    S.projs = [];
    S.boss = null;
    // Everybody gathers around the nest, half on each side, facing the baby.
    const n = S.players.length;
    for (let i = 0; i < n; i++) {
      const p = S.players[i], left = i % 2 === 0;
      p.x = (left ? -1 : 1) * (46 + (i >> 1) * 26); p.y = G; p.face = left ? 1 : -1; p.downT = 0; p.carry = null; p.vx = 0; p.vy = 0;
    }
    emit(S, S.ending === 'meteor' ? 'meteor_start' : 'volcano_start', 0, 80);
  }

  // ---------------------------------------------------------------- boss waves
  function startBoss(S) {
    if (S.boss || S.mode !== 'play') return;
    const st = S.baby.stage;
    S.boss = { stage: st, key: BOSSES[st].key, warnT: sim.BOSS_WARN, side: rnd(S) < 0.5 ? -1 : 1, max: 0, hp: 0 };
    emit(S, 'bosswarn', S.boss.side * 200, G);
  }

  function spawnWave(S, B) {
    const def = BOSSES[B.stage], k = extra(S);
    let total = 0;
    def.lead.forEach((l, i) => {
      const side = def.lead.length === 2 && i === 1 ? -B.side : B.side;
      const d = sim.spawnDino(S, l[0], side * 430, { raid: true, boss: true, lead: true, hpMul: l[1] * (1 + sim.BOSS_K * k), force: true });
      if (d) total += d.maxHp;
    });
    // With more T-rexes the pack grows: one more of its first member for every 2 extra T-rexes.
    const pack = def.pack.slice();
    for (let j = 0; j < (k >> 1); j++) pack.push(def.pack.length ? def.pack[0] : 'allosaurus');
    pack.forEach((kind, j) => {
      const d = sim.spawnDino(S, kind, B.side * (470 + j * 36), { raid: true, boss: true, force: true });
      if (d) total += d.maxHp;
    });
    B.max = total;
    B.hp = total;
    emit(S, 'bossin', B.side * 200, G);
  }

  function bossDefeated(S) {
    const b = S.baby;
    S.stats.bosses++;
    S.boss = null;
    b.stage++;
    b.meals = 0;
    b.hp = Math.min(b.maxHp, r3(b.hp + 15));
    b.hunger = 100;
    for (let i = 0; i < S.players.length; i++) {
      const p = S.players[i];
      p.hp = p.maxHp; p.slowT = 0; p.bleedT = 0; p.stunT = 0;
      if (p.downT > 30) p.downT = 30;
    }
    S.raidCd = RAID_GAP[Math.min(3, b.stage)];
    emit(S, 'bossdown', 0, G - 20);
    if (b.stage === 1) { say(S, 'hatched', 220); emit(S, 'hatch', 0, G - 10); }
    else if (b.stage < 4) say(S, 'stage_up', 220);
    if (b.stage >= 4) triggerFinale(S);
  }

  function stepBoss(S) {
    const B = S.boss;
    if (!B) return;
    if (B.warnT > 0) {
      B.warnT--;
      if (B.warnT % 60 === 0) S.shake = Math.max(S.shake, 3);
      if (B.warnT === 0) spawnWave(S, B);
      return;
    }
    let hp = 0, alive = 0, lead = null, leads = 0;
    for (let i = 0; i < S.dinos.length; i++) {
      const d = S.dinos[i];
      if (!d.boss) continue;
      hp += Math.max(0, d.hp); alive++;
      if (d.lead) { lead = d; leads++; }
    }
    // The alpha raptor calls two more Compsognathus, once, at half health.
    if (lead && lead.kind === 'velociraptor' && !lead.called && lead.hp < lead.maxHp / 2) {
      lead.called = true;
      emit(S, 'call', lead.x, lead.y - 18);
      for (let j = 0; j < 2; j++) {
        const d = sim.spawnDino(S, 'compsognathus', B.side * (400 + j * 30), { raid: true, boss: true, force: true });
        if (d) { B.max += d.maxHp; hp += d.maxHp; alive++; }
      }
    }
    // Apex Clash: when one of the two falls, the other gets faster.
    if (B.stage === 3 && leads === 1 && !lead.rage) {
      lead.rage = true;
      emit(S, 'rage', lead.x, lead.y - 30);
    }
    B.hp = Math.round(hp);
    if (alive === 0) bossDefeated(S);
  }

  // ---------------------------------------------------------------- getting hurt
  function hurtPlayer(S, p, dmg, kbDir, status) {
    if (p.downT > 0 || p.invT > 0 || S.mode !== 'play') return false;
    p.hp = r1(Math.max(0, p.hp - dmg));
    p.invT = 36;
    if (kbDir) { p.vx = kbDir * 3.2; if (p.g) { p.vy = -2.4; p.g = false; } }
    if (status === 'slow') p.slowT = Math.max(p.slowT, 180);
    if (status === 'bleed') p.bleedT = Math.max(p.bleedT, 210);
    if (status === 'stun') p.stunT = Math.max(p.stunT, 60);
    if (status === 'drop' && p.carry) { spawnFood(S, p.x, p.carry.tier, -1, p.carry.ox); p.carry = null; }
    emit(S, 'phit', p.x, p.y - 14);
    if (p.hp <= 0) {
      p.downT = Math.round(210 * REXES[p.type].respawn);
      if (p.carry) { spawnFood(S, p.x, p.carry.tier, -1, p.carry.ox); p.carry = null; }
      emit(S, 'pdown', p.x, p.y);
    }
    return true;
  }

  function hurtDino(S, d, dmg, attackerX) {
    const def = DINOS[d.kind];
    if (!def || d.hp <= 0) return;          // already beaten in this step (two T-rexes biting at once): no second kill, no second meat
    if (d.kind === 'brachiosaurus') { emit(S, 'clang', d.x, d.y - 24); return; }
    let actual = dmg;
    if (def.special === 'armor_club') {            // Ankylosaurus: only the front is soft
      const fromFront = (attackerX - d.x) * d.face > 0;
      if (!fromFront) { actual = Math.max(3, Math.round(dmg * 0.25)); emit(S, 'clang', d.x, d.y - 12); }
    }
    // A boss leader shrugs off most of a bite, except in its opening: while it recovers or is stunned.
    if (d.lead && d.atk !== 'recover' && d.atk !== 'stun') {
      actual = Math.max(1, Math.round(actual * sim.LEAD_ARMOR));
      emit(S, 'clang', d.x, d.y - 12);
    }
    d.hp = r1(d.hp - actual);
    d.hurtT = 14;
    d.hidden = false;
    d.alerted = true;
    emit(S, 'hit', d.x, d.y - 12);
    // Small and medium creatures flinch: a bite during the wind-up cancels their attack.
    if (LIGHT[def.size] && !d.lead && d.hp > 0) {
      if (d.atk === 'windup') { d.atk = 'recover'; d.atkT = 24; d.af = 3; emit(S, 'interrupt', d.x, d.y - def.h); }
      else if (!d.atk) { d.atk = 'stun'; d.atkKind = ''; d.atkT = 10; d.vx = (d.x < attackerX ? -1 : 1) * 1.8; }
    }
    if (d.hp <= 0) {
      S.stats.kills++;
      emit(S, 'kill', d.x, d.y - 12);
      const dropX = clamp(d.x, sim.WORLD_MIN + 40, sim.DEEP_X - 30);
      // Raiders and bosses come to the nest, so their meat is only a snack. Real meals are out in the wild.
      if (d.raid || d.boss) { if (rnd(S) < 0.5) spawnFood(S, dropX, 0, -1); }
      else spawnFood(S, dropX, def.food.tier, -1);
    }
  }

  // ---------------------------------------------------------------- enemy attacks
  function statusOf(def) {
    const k = def.special;
    return k === 'bleed' || k === 'tail_bleed' ? 'bleed' : k === 'ram_stun' ? 'stun' : k === 'armor_club' ? 'slow'
         : k === 'snatch_food' || k === 'canopy_drop' ? 'drop' : '';
  }

  // tgt: -2 nobody in particular, -1 the nest, 0 and up a player.
  function beginAtk(S, d, def, kind, face, tgt) {
    d.atk = 'windup';
    d.atkKind = kind;
    d.atkT = MOVES[kind].wind || WIND[def.size] || 30;
    d.hit = 0;
    d.tgt = tgt === undefined ? -2 : tgt;
    if (face) d.face = face;
    d.vx = 0;
    d.st = 'attack';
    d.af = 0;
    emit(S, 'tele', d.x, d.y - def.h - 6);
  }

  // Hits every T-rex in front of the creature (or on both sides). The baby is only hit when the attack
  // was aimed at the nest, so a T-rex that draws the attack protects the baby even when standing next to it.
  function meleeHit(S, d, def, reach, both) {
    const tolY = Math.max(24, def.h * 0.8);
    for (let i = 0; i < S.players.length; i++) {
      const p = S.players[i];
      if (p.downT > 0) continue;
      const rel = (p.x - d.x) * d.face;
      const inX = both ? Math.abs(p.x - d.x) <= reach : (rel >= -8 && rel <= reach);
      if (inX && Math.abs(p.y - d.y) <= tolY) hurtPlayer(S, p, def.damage, p.x >= d.x ? 1 : -1, statusOf(def));
    }
    if (d.raid && d.tgt === -1) {
      const rel = (0 - d.x) * d.face;
      if (both ? Math.abs(d.x) <= reach : (rel >= -8 && rel <= reach)) {
        hurtBaby(S, def.damage);
        if (def.special === 'steal') S.baby.hunger = r3(Math.max(0, S.baby.hunger - 3));
      }
    }
  }

  // How far a creature's bite reaches, measured from its middle. It is close to how far a T-rex can
  // bite, so you cannot bite a big creature without standing inside its reach.
  function hitRange(def) { return def.reach + Math.round(def.w * 0.3) + 8; }
  sim.hitRange = hitRange;

  function strikeStart(S, d, def, k) {
    if (k === 'bite') d.vx = d.face * (LIGHT[def.size] ? 1.4 : 3);     // big creatures lunge further
    else if (k === 'pounce') { d.vx = d.face * 3.6; d.vy = -4.3; }
    else if (k === 'charge') d.vx = d.face * 4.4;
    else if (k === 'dive') {
      // The dive goes to where the target is right now. Keep moving and it misses.
      const p = d.tgt >= 0 ? S.players[d.tgt] : null;
      d.tx = p ? p.x : 0;
      d.ty = p ? p.y - 12 : G - 12;
      d.face = d.tx >= d.x ? 1 : -1;
    } else if (k === 'lunge') { d.vy = -3.2; emit(S, 'splash', d.x, G); }
  }

  function strikeTick(S, d, def, k) {
    const players = S.players;
    if (MOVES[k].strike <= 8) {
      d.af = d.atkT > 3 ? 1 : 2;
      if (d.atkT <= 4 && k === 'bite') d.vx = 0;
      if (d.atkT !== 5) return;                       // the hit lands 3 steps after the strike starts
      if (k === 'bite') {
        meleeHit(S, d, def, hitRange(def), false);
        emit(S, 'slash', d.x + d.face * (def.reach * 0.7 + 6), d.y - def.h * 0.5, d.face);
      } else if (k === 'sweep') {
        meleeHit(S, d, def, hitRange(def) + 10, true);
        S.shake = Math.max(S.shake, 4);
        emit(S, 'sweep', d.x, d.y - 8);
      } else if (k === 'stomp') {
        S.shake = Math.max(S.shake, 6);
        emit(S, 'stomp', d.x, G);
        for (let i = 0; i < players.length; i++) {
          const p = players[i];
          if (p.g && Math.abs(p.x - d.x) < 46) hurtPlayer(S, p, def.damage, p.x < d.x ? -1 : 1, '');
        }
      } else if (k === 'roar') {
        S.shake = Math.max(S.shake, 7);
        emit(S, 'roar', d.x, d.y - 24);
        d.specT = 420;
        for (let i = 0; i < players.length; i++) {
          const p = players[i];
          if (p.g && Math.abs(p.x - d.x) < 95) hurtPlayer(S, p, 4, p.x < d.x ? -1 : 1, 'stun');
        }
      } else if (k === 'spit') {
        S.projs.push({ x: r1(d.x + d.face * 12), y: d.y - 12, vx: d.face * 3.4, dmg: def.damage, life: 80 });
        emit(S, 'spit', d.x, d.y - 12);
      } else if (k === 'lunge') {
        S.shake = Math.max(S.shake, def.habitat === 'deep_water' ? 7 : 3);
        for (let i = 0; i < players.length; i++) {
          const p = players[i];
          if (p.downT === 0 && Math.abs(p.x - d.x) <= def.reach + 6 && p.y >= G - 34) hurtPlayer(S, p, def.damage, -1, '');
        }
      }
      return;
    }
    d.af = 1;
    if (k === 'pounce') {
      for (let i = 0; i < players.length; i++) {
        const p = players[i], bit = 1 << i;
        if (!(d.hit & bit) && p.downT === 0 && Math.abs(p.x - d.x) < 16 && Math.abs(p.y - d.y) < 20) {
          hurtPlayer(S, p, def.damage, d.face, statusOf(def));
          d.hit |= bit;
        }
      }
      if (d.raid && d.tgt === -1 && !(d.hit & 256) && Math.abs(d.x) < 16 && d.y > G - 22) { hurtBaby(S, def.damage); d.hit |= 256; }
      if (d.y >= G && d.atkT < MOVES.pounce.strike - 4) d.atkT = 0;      // landed
    } else if (k === 'charge') {
      d.vx = d.face * 4.4;
      const tolY = Math.max(24, def.h * 0.8);
      for (let i = 0; i < players.length; i++) {
        const p = players[i], bit = 1 << i;
        if (!(d.hit & bit) && p.downT === 0 && Math.abs(p.x - d.x) < 22 && Math.abs(p.y - d.y) <= tolY) {
          if (hurtPlayer(S, p, def.damage + 4, d.face, '')) d.hit |= bit;
        }
      }
      // A charge only hurts the baby when it was aimed at the nest (no T-rex was there to take it on).
      if (d.raid && d.tgt === -1 && !(d.hit & 256) && Math.abs(d.x) < 20) { hurtBaby(S, def.damage); d.hit |= 256; d.atkT = 0; }
      if (d.x <= sim.WORLD_MIN + 26 || d.x >= sim.DEEP_X - 42) d.atkT = 0;
    } else if (k === 'dive') {
      const ddx = d.tx - d.x, ddy = d.ty - d.y, dist = Math.sqrt(ddx * ddx + ddy * ddy);
      if (dist <= 6 || d.atkT <= 0) {
        d.vx = 0; d.vy = 0;
        let got = false;
        for (let i = 0; i < players.length; i++) {
          const p = players[i];
          if (p.downT === 0 && Math.abs(p.x - d.x) < 22 && Math.abs((p.y - 12) - d.y) < 24) {
            if (hurtPlayer(S, p, def.damage, d.face, statusOf(def))) got = true;
          }
        }
        if (!got && d.raid && d.tgt === -1 && Math.abs(d.x) < 26) {
          if (def.special === 'snatch_food') {       // Quetzalcoatlus steals the baby's food
            S.baby.hunger = r3(Math.max(0, S.baby.hunger - 15));
            hurtBaby(S, r1(def.damage * 0.5));
            emit(S, 'steal', 0, G - 14);
          } else hurtBaby(S, def.damage);
        }
        d.atkT = 0;
      } else {
        d.vx = r3(ddx / dist * 4.2);
        d.vy = r3(ddy / dist * 4.2);
      }
    }
  }

  function endStrike(S, d, def, k) {
    // A charge that hit nobody ends in a skid: the creature is stunned and wide open.
    if (k === 'charge' && !d.hit) { d.atk = 'stun'; d.atkT = 90; emit(S, 'skid', d.x, G); return; }
    d.atk = 'recover';
    d.atkT = MOVES[k].reco || RECO[def.size] || 34;
    if (def.habitat !== 'air') d.vx = 0;
  }

  // Runs the attack a creature is in the middle of. Returns true while it is busy.
  function stepAtk(S, d, def) {
    if (!d.atk) return false;
    const k = d.atkKind, air = def.habitat === 'air';
    d.atkT--;
    if (d.atk === 'stun') {
      d.st = 'hurt';
      d.vx = r3(d.vx * 0.8);
      if (air) d.vy = 0;
      if (d.atkT <= 0) { d.atk = ''; d.vx = 0; }
      return true;
    }
    d.st = 'attack';
    if (d.atk === 'windup') {
      d.af = 0;
      d.vx = 0;
      if (air) d.vy = 0;
      if (d.atkT <= 0) { d.atk = 'strike'; d.atkT = MOVES[k].strike; d.af = 1; strikeStart(S, d, def, k); }
      return true;
    }
    if (d.atk === 'strike') {
      strikeTick(S, d, def, k);
      if (d.atk === 'strike' && d.atkT <= 0) endStrike(S, d, def, k);
      return true;
    }
    d.af = 3;                                          // recovering: standing still, safe to bite
    if (air) { d.vx = d.face * 1.2; d.vy = d.y > airCruise(d.kind) ? -1.8 : 0; } else d.vx = 0;
    if (d.atkT <= 0) { d.atk = ''; d.cd = MOVES[k] ? MOVES[k].cd : 14; }
    return true;
  }

  // ---------------------------------------------------------------- creature behaviour
  function nearestPlayer(S, x, maxDist) {
    let best = null, bd = maxDist;
    for (let i = 0; i < S.players.length; i++) {
      const p = S.players[i];
      if (p.downT > 0) continue;
      const d = Math.abs(p.x - x);
      if (d < bd) { bd = d; best = p; }
    }
    return best;
  }

  function wander(S, d, spd, range, period) {
    if (d.t % period === 0) d.face = rnd(S) < 0.5 ? -1 : 1;
    if (Math.abs(d.x - d.homeX) > range) d.face = d.homeX > d.x ? 1 : -1;
    d.vx = (d.t % period < period / 2) ? d.face * spd * 0.45 : 0;
    d.st = Math.abs(d.vx) > 0.1 ? 'move' : 'idle';
  }

  function thinkLand(S, d, def, spd) {
    const nearP = nearestPlayer(S, d.x, 240);

    if (def.role === 'hazard') {                      // Brachiosaurus: peaceful, but do not stand under it
      if (d.cd <= 0 && nearP && nearP.g && Math.abs(nearP.x - d.x) < 60) { beginAtk(S, d, def, 'stomp', 0, -2); return; }
      if (Math.abs(d.x - d.homeX) > 220) d.face = d.homeX > d.x ? 1 : -1;
      d.vx = d.face * spd;
      d.st = 'move';
      return;
    }

    if (def.role === 'prey') {
      if (d.hidden) {
        d.vx = 0; d.st = 'idle';
        if (nearP && Math.abs(nearP.x - d.x) < 56) { d.hidden = false; d.alerted = true; emit(S, 'rustle', d.x, G); }
      } else if (nearP && (Math.abs(nearP.x - d.x) < 135 || d.alerted)) {
        if (def.special === 'herd_call' && d.specT <= 0) {          // Parasaurolophus warns the herd
          d.specT = 300;
          emit(S, 'call', d.x, G - 18);
          for (let i = 0; i < S.dinos.length; i++) {
            const o = S.dinos[i];
            if (DINOS[o.kind].group === 'herbivore' && DINOS[o.kind].role === 'prey' && Math.abs(o.x - d.x) < 240) { o.alerted = true; o.hidden = false; }
          }
        }
        d.face = d.x >= nearP.x ? 1 : -1;
        if (d.x < sim.WORLD_MIN + 70) d.face = 1;
        if (d.x > sim.DEEP_X - 90) d.face = -1;
        // Prey stays in its own biome: it turns back when it is far from home, and it never runs into
        // the meadow around the nest (so it cannot be herded home and become a free meal).
        if (Math.abs(d.x - d.homeX) > 450) d.face = d.homeX > d.x ? 1 : -1;
        if (Math.abs(d.x) < 560) d.face = d.x >= 0 ? 1 : -1;
        const tired = def.special === 'dash_flee' && (d.t % 120 > 80);   // Gallimimus has to catch its breath
        d.vx = tired ? 0 : d.face * spd;
        d.st = tired ? 'idle' : 'move';
      } else {
        d.alerted = false;
        wander(S, d, spd, 160, 90);
      }
      return;
    }

    if (def.role === 'defend') {                      // peaceful until bitten
      if (d.alerted && nearP && Math.abs(d.x - d.homeX) < 420 && Math.abs(nearP.x) > 520) {
        const dx = nearP.x - d.x, dir = dx >= 0 ? 1 : -1;
        if (Math.abs(dx) <= hitRange(def) - 12) {
          d.face = dir; d.vx = 0; d.st = 'idle';
          if (d.cd <= 0) beginAtk(S, d, def, 'bite', dir, nearP.id);
        } else { d.face = dir; d.vx = dir * spd; d.st = 'move'; }
      } else {
        if (!nearP) d.alerted = false;
        wander(S, d, spd, 140, 110);
      }
      return;
    }

    // Hunters: they guard their territory in the wild, and go for the nest when they raid.
    // A raider goes for a T-rex that is close enough instead of the baby, so a defender at the nest
    // draws its attacks. Boss leaders look for a fight; their pack mostly ignores you and goes for the baby.
    let range = d.lead ? 240 : d.raid ? (d.boss ? 46 : 120) : 185;
    if (def.special === 'sprint' && range < 260) range = 260;       // a Carnotaurus charges whoever it sees
    // A raider never follows a T-rex far from the nest: lead it away and it turns back for the baby.
    // A wild hunter gives up when its prey is far from its home or back in the meadow around the nest.
    const aggro = nearP && Math.abs(nearP.x - d.x) < range && (d.raid ? Math.abs(nearP.x) < 320 : Math.abs(nearP.x - d.homeX) < 420 && Math.abs(nearP.x) > 520) ? nearP : null;
    const goalX = aggro ? aggro.x : (d.raid ? 0 : d.homeX);
    const dx = goalX - d.x, adx = Math.abs(dx), dir = dx >= 0 ? 1 : -1;
    const k = def.special, tgt = aggro ? aggro.id : -1;
    const trig = hitRange(def) - 12;                  // it starts an attack when its target is this close
    const atNest = d.raid && !aggro && Math.abs(d.x) <= trig;

    if (d.cd <= 0) {
      if (k === 'roar' && d.specT <= 0 && aggro && adx < 90) { beginAtk(S, d, def, 'roar', dir, tgt); return; }
      if (k === 'spit' && adx > 55 && adx < 170 && (aggro || d.raid)) { beginAtk(S, d, def, 'spit', dir, tgt); return; }
      if (k === 'pounce') {
        if (aggro && adx > 40 && adx < 105) { beginAtk(S, d, def, 'pounce', dir, tgt); return; }
        if (d.raid && !aggro && adx > 92 && adx < 118) { beginAtk(S, d, def, 'pounce', dir, -1); return; }
      }
      if (k === 'sprint' && adx > 70 && adx < 260 && (aggro || d.raid)) { beginAtk(S, d, def, 'charge', dir, tgt); return; }
      if (aggro && adx <= trig) {
        d.combo++;
        // Spinosaurus: every third attack is a tail sweep that hits both sides.
        beginAtk(S, d, def, k === 'aquatic_boss' && d.combo % 3 === 0 ? 'sweep' : 'bite', dir, tgt);
        return;
      }
      if (atNest) { beginAtk(S, d, def, 'bite', d.x <= 0 ? 1 : -1, -1); return; }
    }
    if ((aggro && adx <= trig) || atNest) { d.face = atNest ? (d.x <= 0 ? 1 : -1) : dir; d.vx = 0; d.st = 'idle'; }
    else if (d.raid || aggro || adx > 30) { d.face = dir; d.vx = dir * spd; d.st = 'move'; }
    else wander(S, d, spd, 120, 100);
  }

  function thinkAir(S, d, def, spd) {
    if (d.cd <= 0) {
      let best = -2, bd = 1e9;
      const range = d.kind === 'microraptor' ? 150 : 120;
      for (let i = 0; i < S.players.length; i++) {
        const p = S.players[i];
        if (p.downT > 0) continue;
        const dist = Math.abs(p.x - d.x);
        if (dist >= range || (d.kind === 'microraptor' && !p.carry && dist >= 75)) continue;
        const score = dist - (p.carry ? 60 : 0);          // they prefer a T-rex that is carrying food
        if (score < bd) { bd = score; best = i; }
      }
      if (best === -2 && d.raid && Math.abs(d.x) < 110) best = -1;
      if (best !== -2) {
        const tx = best >= 0 ? S.players[best].x : 0;
        beginAtk(S, d, def, 'dive', tx >= d.x ? 1 : -1, best);
        d.vy = 0;
        return;
      }
    }
    const mid = d.raid ? 0 : d.homeX, span = d.raid ? 100 : 120;
    if (d.x > mid + span) d.face = -1; else if (d.x < mid - span) d.face = 1;
    d.vx = d.face * spd * (Math.abs(d.x - mid) > span ? 1 : 0.55);
    d.vy = r3((airCruise(d.kind) - d.y) * 0.08);
    d.st = 'move';
  }

  function seaRange(def) {
    return def.habitat === 'deep_water' ? sim.DEEP_X - 20 : sim.SEA_X + 20;
  }

  function thinkWater(S, d, def, spd) {
    const deep = def.habitat === 'deep_water';
    const minX = seaRange(def), maxX = sim.WORLD_MAX - 30;
    const wader = nearestPlayer(S, d.x, deep ? 260 : 180);
    if (wader && wader.x >= minX - 45) {
      const dx = wader.x - d.x;
      d.face = dx >= 0 ? 1 : -1;
      if (Math.abs(dx) > def.reach) { d.vx = d.face * spd; d.st = 'move'; }
      else { d.vx = 0; d.st = 'idle'; if (d.cd <= 0) beginAtk(S, d, def, 'lunge', d.face, wader.id); }
    } else {
      if (d.x <= minX + 15) d.face = 1;
      if (d.x >= maxX - 15) d.face = -1;
      d.vx = d.face * spd * 0.55;
      d.st = 'move';
    }
  }

  function stepDino(S, d) {
    const def = DINOS[d.kind];
    if (!def) return;
    d.t++;
    if (d.cd > 0) d.cd--;
    if (d.hurtT > 0) d.hurtT--;
    if (d.specT > 0) d.specT--;
    const air = def.habitat === 'air', wet = def.habitat === 'water' || def.habitat === 'deep_water';

    let spd = def.speed * (d.rage ? 1.2 : 1);
    if (!air && !wet) {
      const water = sim.waterAt(d.x);
      if (water && (def.special === 'aquatic_fast' || def.special === 'aquatic_boss')) spd *= 1.35;
      else if (water === 'shallow') spd *= 0.8;
    }

    if (!stepAtk(S, d, def)) {
      if (air) thinkAir(S, d, def, spd);
      else if (wet) thinkWater(S, d, def, spd);
      else thinkLand(S, d, def, spd);
    }

    if (air) {
      d.x = r1(clamp(d.x + d.vx, sim.WORLD_MIN + 30, sim.WORLD_MAX - 30));
      d.y = r1(clamp(d.y + d.vy, 28, G - 8));
    } else if (wet) {
      const baseY = G + (def.habitat === 'deep_water' ? 9 : 5);
      d.x = r1(clamp(d.x + d.vx, seaRange(def), sim.WORLD_MAX - 30));
      d.vy += 0.22;
      d.y = r1(d.y + d.vy);
      if (d.y > baseY) { d.y = baseY; d.vy = 0; }
    } else {
      d.x = r1(clamp(d.x + d.vx, sim.WORLD_MIN + 24, sim.DEEP_X - 40));
      d.vy += 0.28;
      d.y = r1(d.y + d.vy);
      if (d.y >= G) { d.y = G; d.vy = 0; }
    }
    if (d.hurtT > 0 && !d.atk) d.st = 'hurt';
  }

  // ---------------------------------------------------------------- computer-controlled T-rex
  // Looks at every attack that is being wound up or is in flight, and says how to stay out of it.
  function danger(S, p) {
    const out = { mx: 0, jump: false, bite: false, face: 0 };
    for (let i = 0; i < S.dinos.length; i++) {
      const d = S.dinos[i];
      if (d.atk !== 'windup' && d.atk !== 'strike') continue;
      const def = DINOS[d.kind], k = d.atkKind;
      const off = p.x - d.x, adx = Math.abs(off), away = off >= 0 ? 1 : -1, front = off * d.face >= -12;
      if (k === 'bite' || k === 'sweep') {
        const reach = hitRange(def) + (k === 'sweep' ? 10 : 0) + (LIGHT[def.size] ? 6 : 12);
        if ((front || k === 'sweep') && adx <= reach) {
          const toHit = d.atk === 'windup' ? d.atkT + 3 : d.atkT - 5;     // steps until the bite lands
          if (toHit < 0 || !p.g) continue;
          if (toHit <= 18 && toHit >= 9) out.jump = true;                 // jump over it and keep the position
          else if (toHit < 9) out.mx = away;                              // too late to jump: step out
        }
      }
      else if (k === 'stomp') { if (adx <= 66) out.mx = away; }
      else if (k === 'lunge') { if (adx <= def.reach + 30) out.mx = away; }
      else if (k === 'roar') {
        if (adx <= 112) { out.mx = away; if (d.atk === 'windup' && d.atkT <= 8 && p.g) out.jump = true; }
      } else if (k === 'charge') {
        if (front && adx < 330) {
          if (d.atk === 'strike') { if (adx < 62 && p.g) out.jump = true; } else out.mx = away;
        }
      } else if (k === 'pounce') {
        // Only run from a pounce that is aimed at me. One aimed at the nest lands in bite range instead.
        if (d.tgt === p.id && front && adx < 140) out.mx = away;
      } else if (k === 'dive') {
        if (d.tgt !== p.id) continue;
        if (d.atk === 'strike') { if (Math.abs(d.tx - p.x) < 40) out.mx = p.x >= d.tx ? 1 : -1; }
        else out.mx = away;
      }
    }
    for (let i = 0; i < S.projs.length; i++) {
      const pr = S.projs[i];
      if ((p.x - pr.x) * pr.vx <= 0 || Math.abs(p.x - pr.x) >= 48 || Math.abs((p.y - 14) - pr.y) >= 18) continue;
      if (p.biteCd <= 0 && !p.carry) { out.bite = true; out.face = pr.x >= p.x ? 1 : -1; }   // snap the spit out of the air
      else if (p.g) out.jump = true;
    }
    return out;
  }

  function biteAt(inp, p, dir) {
    if (p.face !== dir) inp.mx = dir;                 // turn first
    else if (p.biteCd <= 0) inp.bite = !p.prevBite;
  }

  // Input for fighting one creature: stay out of its attacks, bite when it is safe.
  function fight(S, p, t) {
    const inp = { mx: 0, jump: false, bite: false, grab: false };
    const def = DINOS[t.kind];
    const dx = t.x - p.x, adx = Math.abs(dx), dir = dx >= 0 ? 1 : -1;
    const range = 42 * REXES[p.type].reach - 8 + def.w * 0.38;      // a little inside how far this T-rex can bite
    const high = t.y < G - 40;
    // A small creature that is winding up can be stopped with a bite.
    if (LIGHT[def.size] && !t.lead && t.atk === 'windup' && adx <= range && !high && p.biteCd <= 0) { biteAt(inp, p, dir); return inp; }
    const dg = danger(S, p);
    if (dg.mx || dg.jump) { inp.mx = dg.mx; inp.jump = dg.jump && !p.prevJump; return inp; }
    if (dg.bite) { biteAt(inp, p, dg.face); return inp; }
    if (high) {                                       // a flyer: get under it, jump, bite at the top
      if (adx > 16) inp.mx = dir;
      if (adx < 40) {
        if (p.g) inp.jump = !p.prevJump;
        else if (p.y < G - 26) biteAt(inp, p, dir);
      }
      return inp;
    }
    if (adx > range) { inp.mx = dir; return inp; }
    biteAt(inp, p, dir);
    return inp;
  }

  // The computer partner: stays near the nest, fights whatever comes for the baby, fetches food lying close by.
  function guard(S, m) {
    const inp = { mx: 0, jump: false, bite: false, grab: false };
    if (m.downT > 0 || m.stunT > 0) return inp;
    if (m.carry) {
      const dg = danger(S, m);
      if (Math.abs(m.x) > 20) inp.mx = m.x > 0 ? -1 : 1;
      inp.jump = dg.jump && !m.prevJump;
      return inp;
    }
    if (Math.abs(m.x) > 320) {                        // never wander off: the baby comes first
      const dg = danger(S, m);
      inp.mx = m.x > 0 ? -1 : 1;
      inp.jump = dg.jump && !m.prevJump;
      return inp;
    }
    let t = null, best = 1e9;
    for (let i = 0; i < S.dinos.length; i++) {
      const d = S.dinos[i], def = DINOS[d.kind];
      if (def.role === 'hazard' || Math.abs(d.x) > 400) continue;
      const hostile = d.raid || d.boss || (d.alerted && def.role !== 'prey') || (d.atk && Math.abs(d.x - m.x) < 120);
      if (!hostile) continue;
      const score = Math.abs(d.x) + Math.abs(d.x - m.x) * 0.3 + (d.lead ? 60 : 0);   // closest to the baby first
      if (score < best) { best = score; t = d; }
    }
    if (t) return fight(S, m, t);
    const dg = danger(S, m);
    if (dg.mx || dg.jump) { inp.mx = dg.mx; inp.jump = dg.jump && !m.prevJump; return inp; }
    if (dg.bite) { biteAt(inp, m, dg.face); return inp; }
    if (!S.boss) {
      let f = null, bf = 1e9;
      for (let i = 0; i < S.foods.length; i++) {
        const o = S.foods[i];
        if (Math.abs(o.x) <= 30 || Math.abs(o.x) >= 210) continue;
        if (o.meal === 0 && S.baby.hunger > 85) continue;         // do not waste snacks on a full baby
        const dd = Math.abs(o.x - m.x);
        if (dd < bf) { bf = dd; f = o; }
      }
      if (f) {
        if (Math.abs(f.x - m.x) > 14) inp.mx = f.x > m.x ? 1 : -1; else inp.grab = !m.prevGrab;
        return inp;
      }
    }
    // Wait next to the nest, on the side the next raid or boss is coming from.
    const side = S.boss ? S.boss.side : S.raidWarnT > 0 ? S.raidSide : (m.id % 2 ? 1 : -1);
    const home = side * (30 + (m.id >> 1) * 16);
    if (Math.abs(m.x - home) > 18) inp.mx = m.x > home ? -1 : 1;
    return inp;
  }
  sim.ai = { danger, fight, guard };

  // ---------------------------------------------------------------- the T-rexes
  function stepPlayer(S, p, raw) {
    const inp = p.ai ? guard(S, p) : (raw || { mx: 0, jump: false, bite: false, grab: false });
    const T = REXES[p.type];                           // this T-rex's type: health, speed, bite, reach, ...

    if (p.invT > 0) p.invT--;
    if (p.biteCd > 0) p.biteCd--;
    if (p.slowT > 0) p.slowT--;
    if (p.stunT > 0) p.stunT--;
    if (p.bleedT > 0) { p.bleedT--; p.hp = r3(Math.max(1, p.hp - 0.06)); }

    if (p.downT > 0) {
      p.downT--;
      p.anim = 'hurt';
      if (p.downT === 0) {
        p.x = homeX(p.id, S.players.length); p.y = G; p.vx = 0; p.vy = 0; p.g = true;
        p.hp = p.maxHp; p.invT = 90; p.slowT = 0; p.bleedT = 0; p.stunT = 0;
        emit(S, 'respawn', p.x, p.y);
      }
      p.prevBite = !!inp.bite; p.prevGrab = !!inp.grab; p.prevJump = !!inp.jump;
      return;
    }

    // Everyone heals at the nest. A Mender also heals out in the wild, more slowly.
    if (p.hp < p.maxHp && p.bleedT === 0) {
      if (Math.abs(p.x) < 80) p.hp = r3(Math.min(p.maxHp, p.hp + 0.04));
      else if (T.regen) p.hp = r3(Math.min(p.maxHp, p.hp + 0.02));
    }

    const water = sim.waterAt(p.x);
    const groundY = water === 'deep' ? G + 7 : G;
    let spd = 2.45 * T.speed;
    if (p.carry) spd *= T.carry;
    if (p.slowT > 0) spd *= 0.58;
    if (water === 'shallow') spd *= 0.75; else if (water === 'deep') spd *= 0.56;

    const mx = p.stunT > 0 ? 0 : clamp(Math.round(inp.mx || 0), -1, 1);
    if (mx !== 0) p.face = mx;
    if (Math.abs(p.vx) > spd) p.vx *= 0.86; else p.vx = mx * spd;

    const jumpEdge = !!inp.jump && !p.prevJump, biteEdge = !!inp.bite && !p.prevBite, grabEdge = !!inp.grab && !p.prevGrab;
    p.prevJump = !!inp.jump; p.prevBite = !!inp.bite; p.prevGrab = !!inp.grab;

    if (jumpEdge && p.g && p.stunT <= 0) {
      p.vy = (water === 'deep' ? -3.4 : -5.2) * T.jump;
      p.g = false;
      emit(S, 'jump', p.x, p.y);
    }

    if (grabEdge && p.stunT <= 0) {
      if (p.carry) {
        if (Math.abs(p.x) <= 36) { sim.feedBaby(S, p.carry); p.carry = null; }
        else { spawnFood(S, p.x + p.face * 10, p.carry.tier, -1, p.carry.ox); p.carry = null; emit(S, 'drop', p.x, p.y); }
      } else {
        let bestIdx = -1, bestDist = 28;
        for (let i = 0; i < S.foods.length; i++) {
          const d = Math.abs(S.foods[i].x - p.x);
          if (d < bestDist) { bestDist = d; bestIdx = i; }
        }
        if (bestIdx >= 0) {
          const f = S.foods.splice(bestIdx, 1)[0];
          if (f.node >= 0 && S.nodes[f.node]) S.nodes[f.node].cd = S.nodes[f.node].resp;
          p.carry = { tier: f.tier, hunger: f.hunger, meal: f.meal, ox: f.ox };
          emit(S, 'pickup', p.x, p.y);
        }
      }
    }

    // Walking onto the nest with food feeds the baby.
    if (p.carry && Math.abs(p.x) <= 28 && S.mode === 'play') { sim.feedBaby(S, p.carry); p.carry = null; }

    if (biteEdge && !p.carry && p.biteCd <= 0 && p.stunT <= 0) {
      p.biteT = 15;
      p.biteCd = 22;
      p.vx = p.face * 1.9;
      emit(S, 'bite', p.x + p.face * 16, p.y - 14, p.face);      // the last value is the direction, for the bite arc
    }
    if (p.biteT > 0) {
      p.biteT--;
      if (p.biteT === 11) {
        const bx = p.x + p.face * 20 * T.reach;
        for (let i = S.dinos.length - 1; i >= 0; i--) {
          const d = S.dinos[i], def = DINOS[d.kind];
          if (Math.abs(d.x - bx) <= 22 * T.reach + def.w * 0.38 && Math.abs((d.y - 10) - (p.y - 14)) <= 34) hurtDino(S, d, T.bite, p.x);
        }
        for (let i = S.projs.length - 1; i >= 0; i--) {
          if (Math.abs(S.projs[i].x - bx) < 22) S.projs.splice(i, 1);
        }
      }
    }

    p.x = r1(clamp(p.x + p.vx, sim.WORLD_MIN + 20, sim.WORLD_MAX - 20));
    p.vy += 0.28;
    p.y = r1(p.y + p.vy);
    if (p.y >= groundY) { p.y = groundY; p.vy = 0; p.g = true; }

    p.animT++;
    p.anim = p.biteT > 0 ? 'attack' : p.stunT > 0 ? 'hurt' : Math.abs(p.vx) > 0.2 ? 'move' : 'idle';
  }

  // ---------------------------------------------------------------- wildlife and raids
  function isWild(d) { return !d.raid && !d.boss; }

  // More T-rexes need more prey: one more creature per biome for every 2 extra T-rexes.
  function zoneTarget(S, z) { const t = ZONE_TARGET[z.id] || 0; return t ? t + (extra(S) >> 1) : 0; }

  function zoneCount(S, z) {
    let n = 0;
    for (let i = 0; i < S.dinos.length; i++) {
      const d = S.dinos[i], hab = DINOS[d.kind].habitat;
      if (isWild(d) && (hab === 'land' || hab === 'air') && d.homeX >= z.x0 && d.homeX <= z.x1) n++;
    }
    return n;
  }

  function spawnWild(S, z, initial) {
    const all = (ZONE_KINDS[z.id] || []).filter(k => DINOS[k].habitat === 'land' || DINOS[k].habitat === 'air');
    if (!all.length) return false;
    const here = S.dinos.filter(d => isWild(d) && d.homeX >= z.x0 && d.homeX <= z.x1);
    let pool = all.filter(k => !here.some(d => d.kind === k));       // variety first
    if (!pool.length) pool = all;
    // Every biome always has something that counts as a meal.
    if (!here.some(d => DINOS[d.kind].food.tier > 0)) {
      const meals = pool.filter(k => DINOS[k].food.tier > 0);
      if (meals.length) pool = meals;
    }
    const kind = pool[rndi(S, 0, pool.length - 1)];
    let x = rndi(S, z.x0 + 90, z.x1 - 90);
    if (DINOS[kind].habitat === 'land' && x > sim.DEEP_X - 90) x = sim.DEEP_X - 90 - rndi(S, 0, 200);
    if (kind === 'dryosaurus') {                       // it hides in a bush
      const bushes = S.bushes.filter(b => b >= z.x0 && b <= z.x1);
      if (bushes.length) x = bushes[rndi(S, 0, bushes.length - 1)];
    }
    if (!initial) {
      for (let i = 0; i < S.players.length; i++) if (Math.abs(S.players[i].x - x) < 380) return false;   // never pop up on screen
    }
    return !!sim.spawnDino(S, kind, x, {});
  }

  function spawnSea(S) {
    if (!S.dinos.some(d => d.kind === 'plesiosaurus')) sim.spawnDino(S, 'plesiosaurus', sim.SEA_X + 300, { force: true });
    if (!S.dinos.some(d => d.kind === 'mosasaurus')) sim.spawnDino(S, 'mosasaurus', sim.DEEP_X + 280, { force: true });
  }

  function stepSpawners(S) {
    for (let i = 0; i < S.nodes.length; i++) {
      const n = S.nodes[i];
      if (n.cd > 0 && --n.cd === 0) spawnFood(S, n.x, n.tier, i);
    }

    // Wildlife grows back slowly: at most one creature per biome every 15 seconds.
    for (let i = 0; i < S.zcd.length; i++) if (S.zcd[i] > 0) S.zcd[i]--;
    if (S.tick % 150 === 0) {
      for (let zi = 0; zi < BIOMES.zones.length; zi++) {
        const z = BIOMES.zones[zi];
        if (S.zcd[zi] > 0 || zoneCount(S, z) >= zoneTarget(S, z)) continue;
        if (spawnWild(S, z, false)) { S.zcd[zi] = Math.round(900 / (1 + 0.4 * extra(S))); break; }
      }
    }
    if (S.tick % 1800 === 0) spawnSea(S);

    // Raids. They pause while a boss wave is on its way or alive.
    if (S.raidWarnT > 0) S.raidWarnT--;
    if (S.boss) return;
    if (--S.raidCd > 0) return;
    let raiders = 0;
    for (let i = 0; i < S.dinos.length; i++) if (S.dinos[i].raid) raiders++;
    if (raiders >= 4 + extra(S) || S.dinos.length >= maxDinos(S) - 3) { S.raidCd = 300; return; }   // the last raid is not over yet
    const st = Math.min(3, S.baby.stage);
    const list = RAIDS[st][rndi(S, 0, RAIDS[st].length - 1)].slice();
    for (let j = 0; j < (extra(S) >> 1); j++) list.push(list[0]);      // bigger raids for bigger groups
    const side = rnd(S) < 0.5 ? -1 : 1;
    for (let i = 0; i < list.length; i++) sim.spawnDino(S, list[i], side * (520 + i * 34), { raid: true });
    S.raidSide = side;
    S.raidWarnT = 180;
    S.raidCd = RAID_GAP[st];
    emit(S, 'raid', side * 200, G);
  }

  // ---------------------------------------------------------------- one step of the whole game
  sim.step = function (S, inputs) {
    if (!S || S.paused) return;
    inputs = inputs || [];

    if (S.shake > 0) S.shake--;
    if (S.msgT > 0 && --S.msgT === 0) S.msg = null;

    if (S.mode === 'finale') {
      S.finaleT++;
      if (S.finaleT % 20 === 0) S.shake = S.ending === 'meteor' && S.finaleT > 110 ? 10 : 5;
      if (S.finaleT === 120) emit(S, S.ending === 'meteor' ? 'meteor_hit' : 'volcano_boom', 0, G);
      if (S.finaleT >= 270) S.mode = 'win';
      return;
    }
    if (S.mode === 'win' || S.mode === 'over') { S.finaleT++; return; }

    S.tick++;
    const b = S.baby;
    if (b.hurtT > 0) b.hurtT--;
    if (b.eatT > 0) b.eatT--;
    b.need = needOf(S);

    if (b.stage === 0) {
      // The egg only needs time. When it is ready to hatch, the first boss wave smells it.
      if (!S.boss && ++b.eggT >= sim.EGG_T) startBoss(S);
    } else {
      const fighting = S.boss && S.boss.warnT === 0;
      b.hunger = r3(Math.max(0, b.hunger - (fighting ? 0.004 : 0.01)));      // 60% slower during a boss fight
      if (b.hunger <= 0) {
        if (S.tick % 90 === 0) { say(S, 'starving', 85); emit(S, 'babyhit', 0, G - 8); }
        hurtBaby(S, 0.02, true);
        if (S.mode !== 'play') return;
      } else if (b.hunger > 40 && b.hp < b.maxHp) b.hp = r3(Math.min(b.maxHp, b.hp + 0.004));   // a fed baby heals slowly
    }
    S.threat = r1(Math.min(10, b.stage * 2.5 + (b.stage === 0 ? b.eggT / sim.EGG_T : b.need ? b.meals / b.need : 0) * 2));

    for (let i = 0; i < S.players.length; i++) stepPlayer(S, S.players[i], inputs[i]);

    for (let i = S.dinos.length - 1; i >= 0; i--) {
      const d = S.dinos[i];
      if (d.hp <= 0) { S.dinos.splice(i, 1); continue; }
      stepDino(S, d);
      if (d.hp <= 0) S.dinos.splice(i, 1);
    }
    if (S.mode !== 'play') return;

    // Venom spit flies in a straight line. It can be jumped over or bitten out of the air.
    for (let i = S.projs.length - 1; i >= 0; i--) {
      const pr = S.projs[i];
      pr.x = r1(pr.x + pr.vx);
      pr.life--;
      let hit = false;
      for (let j = 0; j < S.players.length; j++) {
        const p = S.players[j];
        if (p.downT === 0 && Math.abs(p.x - pr.x) < 14 && Math.abs((p.y - 14) - pr.y) < 16) {
          hurtPlayer(S, p, pr.dmg, pr.vx >= 0 ? 1 : -1, 'slow');
          hit = true;
          break;
        }
      }
      if (!hit && Math.abs(pr.x) < 18 && Math.abs((G - 10) - pr.y) < 18) { hurtBaby(S, pr.dmg); hit = true; }
      if (hit || pr.life <= 0) S.projs.splice(i, 1);
    }
    if (S.mode !== 'play') return;

    for (let i = S.foods.length - 1; i >= 0; i--) {
      const f = S.foods[i];
      if (f.y < G || f.vy !== 0) {
        f.vy += 0.25;
        f.y = r1(Math.min(G, f.y + f.vy));
        if (f.y >= G) f.vy = 0;
      }
      if (f.node < 0 && ++f.age > 5400) S.foods.splice(i, 1);       // dropped meat rots after 90 seconds
    }

    stepBoss(S);
    if (S.mode !== 'play') return;
    stepSpawners(S);
  };

  // ---------------------------------------------------------------- camera for several players on one screen
  // Splits T-rex positions into groups that each fit in one pane, at most maxPanes of them.
  // Returns groups from left to right: { x: where the camera looks, who: [player numbers] }.
  sim.cameraGroups = function (xs, maxPanes) {
    const order = xs.map((x, i) => i).sort((a, b) => xs[a] - xs[b] || a - b);
    if (!order.length) return [];
    const span = xs[order[order.length - 1]] - xs[order[0]];
    let groups = [];
    if (span <= 400) groups.push({ lo: xs[order[0]], hi: xs[order[order.length - 1]], who: order.slice() });   // everyone fits on one screen
    else {
      for (const i of order) {
        const g = groups[groups.length - 1];
        if (g && xs[i] - g.lo <= 200) { g.hi = xs[i]; g.who.push(i); }
        else groups.push({ lo: xs[i], hi: xs[i], who: [i] });
      }
    }
    // Too many groups: join the two neighbours that make the narrowest group together, until they fit.
    while (groups.length > maxPanes) {
      let best = 0, gap = Infinity;
      for (let g = 0; g < groups.length - 1; g++) {
        const d = groups[g + 1].hi - groups[g].lo;
        if (d < gap) { gap = d; best = g; }
      }
      const a = groups[best], b = groups[best + 1];
      groups.splice(best, 2, { lo: a.lo, hi: b.hi, who: a.who.concat(b.who) });
    }
    return groups.map(g => ({ x: Math.round((g.lo + g.hi) / 2), who: g.who }));
  };

  sim.BUSH_SPOTS = BUSH_SPOTS;
  sim.homeX = homeX;

  // ---------------------------------------------------------------- shortcuts for tests and test links
  sim.debug = {
    startBoss,
    // Puts the baby at the start of a stage (1 to 3), as if the bosses before it were beaten.
    setStage(S, stage) { S.baby.stage = clamp(stage, 0, 3); S.baby.meals = 0; S.baby.eggT = 0; S.boss = null; },
    // Jumps to the ending. kind: 'volcano' or 'meteor'.
    finale(S, kind) { S.baby.stage = 4; S.baby.totalDamage = kind === 'meteor' ? sim.METEOR_THRESHOLD + 5 : 5; triggerFinale(S); },
    hurtBaby, hurtDino, hurtPlayer, spawnFood
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = DINO;
})();
