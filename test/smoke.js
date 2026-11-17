// Automated checks for Egg Attack. Runs without a browser: node test/smoke.js
require('../src/text.js');
const DINO = require('../src/sim.js');
const biomes = require('../data/biomes.json');
const dinos = require('../data/dinos.json');
const sprites = require('../data/sprites.json');
const rexes = require('../data/rexes.json');
const sim = DINO.sim;
sim.loadData(biomes, dinos, rexes);
const B = require('./bot.js')(DINO);
const G = sim.G, NONE = B.NONE;

let failed = 0;
function check(name, ok, extra) {
  console.log((ok ? 'PASS  ' : 'FAIL  ') + name + (extra ? '  (' + extra + ')' : ''));
  if (!ok) failed++;
}

// A game with no wildlife, no raids and nothing spawning, for testing one thing at a time.
function empty(players, seed) {
  const S = sim.newGame({ players: players || 2, seed: seed || 1 });
  S.dinos = [];
  S.raidCd = 1e9;
  S.zcd = S.zcd.map(() => 1e9);
  return S;
}
function put(S, kind, x, opts) {
  const d = sim.spawnDino(S, kind, x, Object.assign({ force: true }, opts || {}));
  d.cd = 0;
  return d;
}
const meat = tier => ({ tier, hunger: 30, meal: tier >= 4 ? 2 : tier >= 1 ? 1 : 0, ox: 2000 });
const median = a => a.slice().sort((x, y) => x - y)[Math.floor(a.length / 2)];

// ---------------------------------------------------------------- 1. data
{
  const kinds = Object.keys(dinos);
  let bad = '';
  for (const k of kinds) {
    const d = dinos[k], rig = sprites.rigs[k];
    if (!d.name || !d.size || !d.role || typeof d.hp !== 'number' || !Array.isArray(d.biomes) || !d.food || typeof d.food.tier !== 'number') bad = k + ' fields';
    if (!rig || !['idle', 'move', 'attack', 'hurt'].every(a => rig.anims[a] && rig.anims[a].length)) bad = k + ' animations';
    else if (rig.anims.attack.length !== 4) bad = k + ' attack must have 4 poses';
    if (!sim.WIND[d.size] || !sim.RECO[d.size]) bad = k + ' size ' + d.size;
  }
  for (const k of Object.keys(rexes)) if (!sprites.rigs['rex_' + k] || sprites.rigs['rex_' + k].anims.attack.length !== 4) bad = k + ' T-rex rig';
  for (const p of Object.values(sprites.parts)) if (!p.rows.every(r => r.length === p.rows[0].length)) bad = 'sprite rows';
  // every biome outside the meadow has at least one creature whose meat counts as a meal of that biome's tier
  for (const z of biomes.zones) {
    if (z.id === 'meadow') continue;
    if (!kinds.some(k => dinos[k].biomes.includes(z.id) && dinos[k].food.tier === z.tier && dinos[k].habitat !== 'deep_water')) bad = 'no meal creature in ' + z.id;
  }
  check('data: 24 creatures, 4 animations each, attacks have 4 poses, every biome has meals', kinds.length === 24 && !bad, bad || kinds.length + ' creatures');
}

// ---------------------------------------------------------------- 2. the game cannot win by itself
{
  const out = [];
  for (const seed of [777, 12345]) {
    const r = B.play({ seed, input: () => NONE, max: 60 * 60 * 20 });
    out.push(r.S.mode + ' at stage ' + r.S.baby.stage + ' after ' + (r.log.frames / 3600).toFixed(1) + ' min');
    if (r.S.mode === 'win' || r.S.baby.stage > 1) out.bad = true;
  }
  check('20 minutes with no input never wins and never gets past the hatchling', !out.bad, out.join('; '));
}

// ---------------------------------------------------------------- 3. raids are dangerous
{
  const S = sim.newGame({ players: 2, seed: 777 });
  let f = 0;
  while (f < 60 * 60 * 5 && S.mode === 'play') { f++; S.players[0].x = -3600; S.players[1].x = -3600; sim.step(S, [NONE, NONE]); }
  check('with nobody at the nest the baby is lost', S.mode === 'over', 'lost after ' + (f / 60).toFixed(0) + ' s');
}

// ---------------------------------------------------------------- 4. what counts as a meal
{
  const S = empty();
  sim.debug.setStage(S, 2);
  const drops = [];
  for (const k of ['compsognathus', 'velociraptor', 'carnotaurus', 'allosaurus', 'tyrannosaurus', 'velociraptor', 'allosaurus', 'carnotaurus']) {
    const d = put(S, k, 300, { raid: true });
    S.foods = [];
    sim.debug.hurtDino(S, d, 9999, 280);
    if (S.foods.length) drops.push(S.foods[0].meal);
  }
  const raiderOk = drops.length > 0 && drops.every(m => m === 0);
  S.dinos = []; S.foods = [];
  sim.debug.hurtDino(S, put(S, 'stegosaurus', 2300), 9999, 2280);
  const wild = S.foods[0];
  const a = sim.feedBaby(S, meat(0)), b = sim.feedBaby(S, meat(1)), c = sim.feedBaby(S, meat(2)), d4 = sim.feedBaby(S, meat(4));
  check('raider meat is a snack; too-small meat is no meal; right meat is 1 meal; far meat is 2',
    raiderOk && wild && wild.meal === 1 && wild.tier === 2 && a === 0 && b === 0 && c === 1 && d4 === 2 && S.baby.meals === 3,
    drops.length + ' raider drops all snacks, wild stegosaurus tier ' + (wild && wild.tier) + ', meals counted ' + [a, b, c, d4].join('/'));
}

// ---------------------------------------------------------------- 5. bosses gate every stage
{
  const S = empty();
  const want = [['velociraptor'], ['carnotaurus'], ['spinosaurus'], ['tyrannosaurus', 'giganotosaurus']];
  let ok = true, note = [];
  S.baby.eggT = sim.EGG_T - 1;
  for (let stage = 0; stage < 4 && ok; stage++) {
    if (stage === 0) sim.step(S, [NONE, NONE]);
    else {
      for (let i = 0; i < sim.MEALS[stage] - 1; i++) sim.feedBaby(S, meat(stage));
      if (S.boss) { ok = false; note.push('boss came early at stage ' + stage); }
      sim.feedBaby(S, meat(stage));
    }
    if (!S.boss || S.boss.key !== 'boss' + (stage + 1) || S.boss.warnT < sim.BOSS_WARN - 1) { ok = false; note.push('no warning for boss ' + (stage + 1)); break; }
    if (sim.feedBaby(S, meat(4)) !== 0) { ok = false; note.push('meal counted during a boss'); }
    for (let i = 0; i <= sim.BOSS_WARN; i++) sim.step(S, [NONE, NONE]);
    const leads = S.dinos.filter(d => d.lead).map(d => d.kind).sort().join();
    if (leads !== want[stage].slice().sort().join() || S.boss.max <= 0) { ok = false; note.push('wrong leaders: ' + leads); }
    if (S.baby.stage !== stage) { ok = false; note.push('grew before the boss was beaten'); }
    S.players[0].hp = 40; S.baby.hp = 50; S.baby.hunger = 20;
    for (const d of S.dinos) d.hp = 0;
    sim.step(S, [NONE, NONE]);
    sim.step(S, [NONE, NONE]);
    if (S.baby.stage !== stage + 1) { ok = false; note.push('did not grow after boss ' + (stage + 1)); }
    if (stage < 3 && (S.players[0].hp < S.players[0].maxHp || S.baby.hp < 65 || S.baby.hunger < 99 || S.boss)) { ok = false; note.push('no reward after boss ' + (stage + 1)); }
  }
  check('each stage waits for its boss wave; the four waves come in order; beating one heals and grows the baby', ok && S.mode === 'finale', note.join('; ') || 'ends in the ' + S.ending + ' finale');
}

// ---------------------------------------------------------------- 6. attacks: wind-up, strike, recovery
// One T-rex next to one creature, far from the nest. act(step, S, p, d) returns the input for that step.
function duel(kind, gap, steps, act) {
  const S = empty(2, 5);
  const p = S.players[0];
  p.x = -3600; p.face = 1; S.players[1].x = 3000;
  const d = put(S, kind, p.x + gap);
  const log = { firstHit: 0, hits: 0, states: [], S, p, d };
  for (let i = 1; i <= steps; i++) {
    const hp = p.hp;
    sim.step(S, [act ? act(i, S, p, d) || NONE : NONE, NONE]);
    if (p.hp < hp - 1) { log.hits++; if (!log.firstHit) log.firstHit = i; }
    log.states.push(d.atk);
  }
  return log;
}
{
  const wind = sim.WIND.large;
  const still = duel('allosaurus', 30, 110);
  const windSteps = still.states.indexOf('strike');                     // steps spent winding up
  const recoSteps = still.states.filter(s => s === 'recover').length;
  const away = duel('allosaurus', 30, 110, i => (i >= 5 ? { mx: -1, jump: false, bite: false, grab: false } : null));
  const jump = duel('allosaurus', 30, 60, i => (i === 28 ? { mx: 0, jump: true, bite: false, grab: false } : null));
  check('a big creature winds up first: no damage until the strike, then exactly one hit',
    windSteps === wind && still.firstHit === wind + 4 && still.hits === 1, 'wind-up ' + windSteps + ' steps, hit on step ' + still.firstHit + ', hits ' + still.hits);
  check('stepping away or jumping during the wind-up avoids the hit', away.hits === 0 && jump.hits === 0, 'walked away: ' + away.hits + ' hits, jumped: ' + jump.hits + ' hits');
  check('after the strike it recovers and cannot attack', recoSteps >= sim.RECO.large && still.states.indexOf('windup', windSteps + 8) >= windSteps + 8 + sim.RECO.large,
    recoSteps + ' recovery steps, next wind-up on step ' + (still.states.indexOf('windup', windSteps + 8) + 1));

  const bite = i => (i === 3 ? { mx: 0, jump: false, bite: true, grab: false } : null);
  const small = duel('baryonyx', 25, 50, bite), big = duel('allosaurus', 30, 50, bite);
  check('a bite cancels a medium creature\'s wind-up, but not a big one\'s', small.hits === 0 && small.states.includes('recover') && !small.states.includes('strike') && big.hits === 1,
    'baryonyx: ' + small.hits + ' hits, allosaurus: ' + big.hits + ' hit');
}

// ---------------------------------------------------------------- 7. boss moves
{
  // Carnotaurus charge: jump over it and it skids into a stun; stand still and it hits and just recovers.
  const jumper = (i, S, p, d) => (d.atk === 'strike' && Math.abs(d.x - p.x) < 62 && p.g ? { mx: 0, jump: true, bite: false, grab: false } : null);
  const miss = duel('carnotaurus', 150, 200, jumper), hit = duel('carnotaurus', 150, 200);
  const stunLen = miss.states.filter(s => s === 'stun').length;
  check('a Carnotaurus charge that misses ends in a 1.5 second stun', miss.hits === 0 && stunLen >= 88 && hit.hits >= 1 && !hit.states.slice(0, 130).includes('stun'),
    'jumped: ' + miss.hits + ' hits, stunned ' + stunLen + ' steps; stood still: ' + hit.hits + ' hit, no stun');

  // T-rex roar: stuns a T-rex on the ground and in range, not one in the air or far away.
  const roarAt = sim.MOVES.roar.wind + 4;
  const ground = duel('tyrannosaurus', 60, roarAt + 2), air = duel('tyrannosaurus', 60, roarAt + 2, i => (i === roarAt - 10 ? { mx: 0, jump: true, bite: false, grab: false } : null));
  const far = duel('tyrannosaurus', 60, roarAt + 2, i => (i >= 3 ? { mx: -1, jump: false, bite: false, grab: false } : null));
  check('the roar stuns only a T-rex that is close and on the ground', ground.p.stunT > 0 && air.p.stunT === 0 && far.p.stunT === 0 && ground.d.atkKind === 'roar',
    'on the ground: stunned ' + ground.p.stunT + ', in the air: ' + air.p.stunT + ', walked away: ' + far.p.stunT);

  // Boss leaders: armour outside the opening, full damage inside it.
  const S = empty();
  const lead = put(S, 'spinosaurus', 300, { raid: true, boss: true, lead: true, hpMul: 10 });
  const h0 = lead.hp; sim.debug.hurtDino(S, lead, 20, 280); const closed = h0 - lead.hp;
  lead.atk = 'recover'; lead.atkT = 30; const h1 = lead.hp; sim.debug.hurtDino(S, lead, 20, 280); const open = h1 - lead.hp;
  check('a boss leader takes full damage only in its opening', open === 20 && closed === Math.round(20 * sim.LEAD_ARMOR), 'armoured ' + closed + ', open ' + open);

  // Alpha raptor calls 2 Compsognathus once, at half health.
  const A = empty();
  A.baby.eggT = sim.EGG_T - 1;
  for (let i = 0; i <= sim.BOSS_WARN + 1; i++) sim.step(A, [NONE, NONE]);
  A.players[0].x = -3600; A.players[1].x = -3600;
  const alpha = A.dinos.find(d => d.lead), n0 = A.dinos.filter(d => d.kind === 'compsognathus').length;
  alpha.hp = alpha.maxHp / 2 - 1; sim.step(A, [NONE, NONE]);
  const n1 = A.dinos.filter(d => d.kind === 'compsognathus').length;
  alpha.hp = alpha.maxHp / 4; for (let i = 0; i < 30; i++) sim.step(A, [NONE, NONE]);
  const n2 = A.dinos.filter(d => d.kind === 'compsognathus').length;
  check('the alpha raptor calls 2 more Compsognathus once, at half health', alpha && n1 === n0 + 2 && n2 === n1, n0 + ' -> ' + n1 + ' -> ' + n2);

  // Apex Clash: when one leader falls, the other speeds up.
  const C = empty();
  sim.debug.setStage(C, 3);
  for (let i = 0; i < sim.MEALS[3]; i++) sim.feedBaby(C, meat(3));
  for (let i = 0; i <= sim.BOSS_WARN; i++) sim.step(C, [NONE, NONE]);
  const leads = C.dinos.filter(d => d.lead);
  const sides = leads.length === 2 && leads[0].x * leads[1].x < 0;
  leads[0].hp = 0; sim.step(C, [NONE, NONE]); sim.step(C, [NONE, NONE]);
  check('Apex Clash: two leaders from opposite sides, and the survivor speeds up', sides && leads[1].rage === true, 'opposite sides: ' + sides + ', rage: ' + leads[1].rage);

  // Hunger runs at 40% during a boss fight.
  const drain = boss => {
    const H = empty();
    sim.debug.setStage(H, 1);
    H.players[0].x = -3600; H.players[1].x = -3600;
    if (boss) { H.boss = { stage: 1, key: 'boss2', warnT: 0, side: 1, max: 1, hp: 1 }; put(H, 'brachiosaurus', 5000, { boss: true }); }
    const h = H.baby.hunger;
    for (let i = 0; i < 600; i++) sim.step(H, [NONE, NONE]);
    return h - H.baby.hunger;
  };
  const normal = drain(false), fight = drain(true);
  check('the baby gets hungry 60% slower during a boss fight', Math.abs(fight / normal - 0.4) < 0.02, normal.toFixed(2) + ' normally, ' + fight.toFixed(2) + ' during a boss, in 10 s');
}

// ---------------------------------------------------------------- 8. the baby
{
  const S = empty();
  sim.debug.setStage(S, 1);
  S.players[0].x = -3600; S.players[1].x = -3600;
  S.baby.hunger = 0.5;
  for (let i = 0; i < 600; i++) sim.step(S, [NONE, NONE]);
  const starved = S.baby.hp < 100 && S.baby.hunger === 0;
  // one hit takes at most 14, and two hits in the same moment count once
  const T = empty();
  sim.debug.hurtBaby(T, 40); sim.debug.hurtBaby(T, 40);
  check('a starving baby loses health; one hit takes at most 14 and it cannot be hit twice at once', starved && T.baby.hp === 86, 'after starving: ' + S.baby.hp.toFixed(1) + ' hp, after two hits of 40: ' + T.baby.hp);

  const end = dmg => { const E = empty(); E.baby.totalDamage = dmg; sim.debug.setStage(E, 3); for (let i = 0; i < sim.MEALS[3]; i++) sim.feedBaby(E, meat(3));
    for (let i = 0; i <= sim.BOSS_WARN; i++) sim.step(E, [NONE, NONE]); for (const d of E.dinos) d.hp = 0; for (let i = 0; i < 300; i++) sim.step(E, [NONE, NONE]); return E; };
  const low = end(10), high = end(sim.METEOR_THRESHOLD + 20);
  check('little damage to the baby gives the volcano ending, a lot gives the meteor', low.mode === 'win' && low.ending === 'volcano' && high.mode === 'win' && high.ending === 'meteor', low.ending + ' / ' + high.ending);
}

// ---------------------------------------------------------------- 9. the computer partner
{
  const S = empty(1);
  S.players[0].x = -3600;
  put(S, 'compsognathus', 150, { raid: true }); put(S, 'compsognathus', 175, { raid: true });
  let far = 0, f = 0;
  while (S.dinos.length && f++ < 900) { sim.step(S, [NONE]); far = Math.max(far, Math.abs(S.players[1].x)); }
  const small = S.dinos.length === 0 && S.baby.hp >= 90 && far < 330;
  const T = empty(1);
  T.players[0].x = -3600;
  put(T, 'allosaurus', 220, { raid: true });
  f = 0;
  while (T.dinos.length && f++ < 2400) sim.step(T, [NONE]);
  check('computer mama beats a small raid and a big raider alone, and stays at the nest', small && T.dinos.length === 0 && T.baby.hp >= 70 && T.players[1].downT === 0,
    'small raid: baby ' + Math.round(S.baby.hp) + ' hp, furthest ' + Math.round(far) + ' px; allosaurus beaten in ' + (f / 60).toFixed(0) + ' s, baby ' + Math.round(T.baby.hp) + ' hp, mama ' + Math.round(T.players[1].hp) + ' hp');
}

// ---------------------------------------------------------------- 10. T-rex types
{
  const ids = Object.keys(rexes);
  const stats = ids.map(k => JSON.stringify([rexes[k].hp, rexes[k].speed, rexes[k].bite, rexes[k].reach, rexes[k].carry, rexes[k].jump, rexes[k].regen, rexes[k].respawn]));
  const deals = [1, 2, 3, 4, 5, 6].map(seed => sim.newGame({ humans: 8, seed }).players.map(p => p.type));
  const noRepeats = deals.every(d => new Set(d).size === 8);
  const differ = new Set(deals.map(d => d.join())).size >= 5;
  const solo = sim.newGame({ humans: 1, seed: 3 }), six = sim.newGame({ humans: 6, seed: 3 });
  check('8 T-rex types with different stats; a game deals them without repeats; games deal differently',
    ids.length === 8 && new Set(stats).size === 8 && noRepeats && differ, 'first deals: ' + deals[0].join(' ') + ' / ' + deals[1].join(' '));
  check('alone is always 2 T-rexes (1 played by the computer); 6 players is 6 T-rexes and no computer',
    solo.players.length === 2 && solo.players.filter(p => p.ai).length === 1 && solo.players[0].type !== solo.players[1].type && six.players.length === 6 && !six.players.some(p => p.ai));

  // One T-rex of a given type, alone in an empty world.
  const one = type => { const S = empty(2, 9); S.players[0].face = 1; S.players[0].type = type; S.players[0].hp = S.players[0].maxHp = rexes[type].hp; S.players[0].x = -3600; S.players[1].x = 3000; return S; };
  const run = (S, n, inp) => { for (let i = 0; i < n; i++) sim.step(S, [typeof inp === 'function' ? inp(i) : inp, NONE]); };
  const hitsToDown = type => { const S = one(type); let n = 0; while (S.players[0].downT === 0 && n < 50) { S.players[0].invT = 0; sim.debug.hurtPlayer(S, S.players[0], 20, 0, ''); n++; } return n; };
  const walked = type => { const S = one(type); run(S, 120, { mx: 1, jump: false, bite: false, grab: false }); return S.players[0].x + 3600; };
  const jumpTop = type => { const S = one(type); let top = 0; run(S, 60, i => ({ mx: 0, jump: i === 2, bite: false, grab: false })); for (let i = 0; i < 1; i++) top = 0;
    const T = one(type); for (let i = 0; i < 60; i++) { sim.step(T, [{ mx: 0, jump: i === 2, bite: false, grab: false }, NONE]); top = Math.max(top, G - T.players[0].y); } return top; };
  const carried = type => { const S = one(type); S.players[0].carry = meat(1); run(S, 120, { mx: 1, jump: false, bite: false, grab: false }); return S.players[0].x + 3600; };
  const biteDamage = (type, gap) => { const S = one(type); const d = put(S, 'diplodocus', -3600 + gap); d.cd = 1e6; const h = d.hp; run(S, 12, i => ({ mx: 0, jump: false, bite: i === 1, grab: false })); return h - d.hp; };
  const healedAway = type => { const S = one(type); S.players[0].hp = 40; run(S, 300, NONE); return S.players[0].hp - 40; };
  const downTime = type => { const S = one(type); S.players[0].invT = 0; sim.debug.hurtPlayer(S, S.players[0], 999, 0, ''); return S.players[0].downT; };
  const f = v => v.toFixed(0);
  check('Brick takes more hits than Dash, and Dash walks further than Brick', hitsToDown('brick') > hitsToDown('dash') && walked('dash') > walked('brick') * 1.3,
    'hits of 20 to knock out: Brick ' + hitsToDown('brick') + ', Dash ' + hitsToDown('dash') + '; px walked in 2 s: Dash ' + f(walked('dash')) + ', Brick ' + f(walked('brick')));
  check('Chomp bites hardest, Reach bites from further away, Hop jumps highest, Mule carries at full speed',
    biteDamage('chomp', 40) > biteDamage('rex', 40) && biteDamage('reach', 90) > 0 && biteDamage('rex', 90) === 0 && jumpTop('hop') > jumpTop('rex') * 1.4 && carried('mule') > carried('rex') * 1.15,
    'bite: Chomp ' + biteDamage('chomp', 40) + ', Rex ' + biteDamage('rex', 40) + '; bite from 90 px: Reach ' + biteDamage('reach', 90) + ', Rex ' + biteDamage('rex', 90) +
    '; jump: Hop ' + f(jumpTop('hop')) + ' px, Rex ' + f(jumpTop('rex')) + ' px; carrying 2 s: Mule ' + f(carried('mule')) + ', Rex ' + f(carried('rex')));
  check('Mender heals away from the nest and is knocked out for half as long', healedAway('mender') > 3 && healedAway('rex') === 0 && downTime('mender') * 2 === downTime('rex'),
    'healed in 5 s: Mender ' + healedAway('mender').toFixed(1) + ', Rex ' + healedAway('rex') + '; knocked out for ' + downTime('mender') + ' vs ' + downTime('rex') + ' steps');
}

// ---------------------------------------------------------------- 11. bigger groups
{
  const two = empty(2), eight = empty(8);
  sim.debug.setStage(two, 2); sim.debug.setStage(eight, 2);
  sim.step(two, []); sim.step(eight, []);
  const wave = S => { for (let i = 0; i < sim.MEALS[2] * 9 && !S.boss; i++) sim.feedBaby(S, meat(2)); for (let i = 0; i <= sim.BOSS_WARN; i++) sim.step(S, []); return S.dinos.filter(d => d.boss); };
  const w2 = wave(two), w8 = wave(eight);
  const lead2 = w2.find(d => d.lead).maxHp, lead8 = w8.find(d => d.lead).maxHp;
  check('more T-rexes need more meals, and face a bigger boss wave with a tougher leader',
    eight.baby.need > two.baby.need * 3 && lead8 > lead2 * 3 && w8.length > w2.length,
    'meals per stage: ' + two.baby.need + ' for 2, ' + eight.baby.need + ' for 8; boss 3 leader health ' + lead2 + ' vs ' + lead8 + '; wave size ' + w2.length + ' vs ' + w8.length);

  // camera groups for players on one screen
  let bad = '', seed = 7;
  const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
  for (let k = 0; k < 400 && !bad; k++) {
    const n = 1 + Math.floor(rnd() * 8), xs = [];
    for (let i = 0; i < n; i++) xs.push(Math.round((rnd() - 0.5) * (rnd() < 0.5 ? 600 : 10000)));
    const g = sim.cameraGroups(xs, 4), g2 = sim.cameraGroups(xs.slice(), 4);
    const all = g.reduce((a, o) => a.concat(o.who), []).sort((a, b) => a - b);
    if (g.length > 4 || g.length < 1) bad = 'panes ' + g.length;
    else if (all.join() !== xs.map((x, i) => i).join()) bad = 'players lost or doubled';
    else if (JSON.stringify(g) !== JSON.stringify(g2)) bad = 'not the same twice';
  }
  const near = sim.cameraGroups([0, 100, 250, 380], 4), far = sim.cameraGroups([-3000, 0, 40, 1500, 4000, 4050], 4);
  check('the split screen never needs more than 4 panes, loses nobody, and keeps close players together', !bad && near.length === 1 && far.length === 4,
    bad || '4 close players: ' + near.length + ' pane; 6 spread out: ' + far.map(g => g.who.join('+')).join(' | '));

  // the computer takes over a T-rex when its player leaves
  const S = sim.newGame({ humans: 3, seed: 21 });
  S.players[2].x = 900;
  const type = S.players[2].type;
  S.players[2].ai = true;
  for (let i = 0; i < 600; i++) sim.step(S, [NONE, NONE, NONE]);
  check('when a player leaves, the computer takes over that T-rex and the game goes on', S.mode === 'play' && S.players[2].type === type && Math.abs(S.players[2].x) < 330 && S.players.length === 3,
    'it walked back from 900 px to ' + Math.round(S.players[2].x) + ' px and stayed a ' + type);
}

// ---------------------------------------------------------------- 12. full games, alone and in groups
{
  const plan = [[1, [11, 12, 13, 14, 15, 16]], [2, [11, 12, 13]], [4, [11, 12]], [8, [11, 12]]];
  let allWon = true, lo = 99, hi = 0, closest = 1e9;
  for (const [humans, seeds] of plan) {
    const games = seeds.map(seed => B.play({ seed, humans }));
    const mins = games.map(g => g.log.frames / 3600);
    lo = Math.min(lo, ...mins); hi = Math.max(hi, ...mins);
    if (games.some(g => g.S.mode !== 'win')) allWon = false;
    for (const g of games) for (const d of g.log.mealsFrom) closest = Math.min(closest, d);
    console.log('      ' + humans + ' player' + (humans > 1 ? 's' : ' ') + ': ' + mins.map(m => m.toFixed(1)).join(', ') + ' min | ' + games.map(g => (g.S.mode === 'win' ? g.S.ending : g.S.mode)).join(', ') +
      ' | boss fights (s) ' + [1, 2, 3, 4].map(b => median(games.map(g => g.log.bossSecs[b]).filter(x => x !== undefined))).join(', ') +
      ' | damage to the baby ' + games.map(g => Math.round(g.S.baby.totalDamage)).join(', '));
  }
  check('the test players win a full game through all 4 bosses, alone and with 2, 4 and 8 players', allWon);
  check('every full game takes between 13 and 22 minutes for the test players, at every group size', lo >= 13 && hi <= 22, 'shortest ' + lo.toFixed(1) + ', longest ' + hi.toFixed(1) + ' min');
  check('every meal was meat from at least 500 px away from the nest', closest >= 500, 'closest: ' + closest + ' px');
}

// ---------------------------------------------------------------- 13. online: the snapshot and replaying a game exactly
{
  require('../src/snapshot.js');
  const SN = DINO.snap;
  const S = sim.newGame({ humans: 8, seed: 99 });
  S.baby.eggT = sim.EGG_T - 1;
  const r = f => ({ mx: [-1, 0, 1][(f * 7) % 3], jump: f % 19 === 0, bite: f % 11 === 0, grab: f % 23 === 0 });
  const ins = f => S.players.map((p, i) => r(f + i * 5));
  for (let f = 0; f < 500; f++) sim.step(S, ins(f));
  const kinds = Object.keys(dinos);
  while (S.dinos.length < sim.maxDinos(S)) put(S, kinds[S.dinos.length % kinds.length], -2000 + S.dinos.length * 80);     // a full world
  const raw = JSON.stringify(S), copy = JSON.parse(raw);
  let same = true, maxFull = raw.length, maxSnap = 0;
  for (let f = 500; f < 1100 && same; f++) {
    sim.step(S, ins(f)); sim.step(copy, ins(f));
    if (f % 50 === 0) {
      const a = JSON.stringify(S);
      if (a !== JSON.stringify(copy)) same = false;
      maxFull = Math.max(maxFull, a.length);
      maxSnap = Math.max(maxSnap, JSON.stringify(SN.encode(S)).length);
    }
  }
  check('a copy of the game state made from JSON plays on exactly the same', same && !/NaN|Infinity/.test(JSON.stringify(S)));

  const c = SN.encode(S), back = SN.decode(JSON.parse(JSON.stringify(c)));
  let bad = '';
  if (back.players.length !== 8 || back.dinos.length !== S.dinos.length || back.foods.length !== S.foods.length) bad = 'counts';
  S.players.forEach((p, i) => { const b = back.players[i]; if (b.type !== p.type || b.x !== Math.round(p.x) || b.face !== p.face || b.ai !== p.ai || (b.downT > 0) !== (p.downT > 0) || !!b.carry !== !!p.carry || b.anim !== p.anim) bad = 'player ' + i; });
  S.dinos.forEach((d, i) => { const b = back.dinos[i]; if (b.kind !== d.kind || b.x !== Math.round(d.x) || b.atk !== d.atk || b.st !== d.st || b.af !== d.af || b.lead !== d.lead || b.raid !== d.raid || b.hidden !== d.hidden || b.maxHp !== d.maxHp) bad = 'creature ' + i; });
  if (back.baby.stage !== S.baby.stage || back.baby.meals !== S.baby.meals || back.mode !== S.mode || !!back.boss !== !!S.boss || (S.boss && back.boss.key !== S.boss.key)) bad = 'baby or boss';
  if (back.evs.length !== S.evs.length || back.evN !== S.evN) bad = 'events';
  const perSec = maxSnap * 20 * 7;
  check('the snapshot for 8 players and a full world is small and decodes to the same picture', !bad && maxSnap < 6000,
    bad || 'snapshot ' + maxSnap + ' bytes (the full state is ' + maxFull + '); to 7 guests 20 times a second: ' + (perSec * 8 / 1e6).toFixed(1) + ' Mbit/s');

  const a = SN.decode(SN.encode(S));
  for (let f = 0; f < 3; f++) sim.step(S, ins(2000 + f));
  const b2 = SN.decode(SN.encode(S)), mid = SN.blend(a, b2, 0.5);
  const i0 = S.players.findIndex((p, i) => a.players[i].x !== b2.players[i].x);
  check('guests see movement smoothed between two snapshots', i0 >= 0 && Math.abs(mid.players[i0].x - (a.players[i0].x + b2.players[i0].x) / 2) < 0.01 && SN.blend(a, b2, 1) === b2,
    i0 >= 0 ? 'player ' + (i0 + 1) + ': ' + a.players[i0].x + ' -> ' + mid.players[i0].x + ' -> ' + b2.players[i0].x : 'nobody moved');
}

console.log(failed ? '\n' + failed + ' check(s) failed' : '\nAll checks passed');
process.exit(failed ? 1 : 0);
