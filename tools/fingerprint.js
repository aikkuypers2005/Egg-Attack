// Prints fingerprints of scripted games. The Processing port (Test.pde) must print exactly the same
// lines: that is how we know the Windows version follows the same rules as the web version.
// Run with: node tools/fingerprint.js
require('../src/text.js');
const DINO = require('../src/sim.js');
const sim = DINO.sim;

// The input of T-rex i at step f. Only whole-number maths, so it is the same in every language.
function input(f, i) {
  const ph = Math.floor(f / 45) + i * 2;
  return { mx: ph % 4 === 0 ? 1 : ph % 4 === 2 ? -1 : 0, jump: f % 97 === i, bite: f % 23 < 2, grab: f % 61 === 0 };
}

const R = v => Math.round(v * 1000);     // numbers are printed as whole thousandths

function fingerprint(humans, seed, steps) {
  const S = sim.newGame({ humans, seed });
  S.baby.eggT = 3000;                    // the first boss wave comes after 10 seconds, so the run includes a boss fight
  for (let f = 0; f < steps; f++) sim.step(S, S.players.map((p, i) => input(f, i)));
  let px = 0, php = 0, dx = 0, dhp = 0;
  S.players.forEach((p, i) => { px += R(p.x) * (i + 1); php += R(p.hp); });
  S.dinos.forEach(d => { dx += R(d.x); dhp += R(d.hp); });
  const b = S.baby;
  return 'FP humans=' + humans + ' seed=' + seed + ' steps=' + steps + ' -> mode=' + S.mode + ' tick=' + S.tick + ' rng=' + S.seed +
    ' types=' + S.players.map(p => p.type).join(',') +
    ' baby=' + [R(b.hp), R(b.hunger), b.stage, b.meals, R(b.totalDamage)].join('/') +
    ' players=' + px + '/' + php + ' dinos=' + S.dinos.length + '/' + dx + '/' + dhp +
    ' foods=' + S.foods.length + ' kills=' + S.stats.kills + ' bosses=' + S.stats.bosses + ' boss=' + (S.boss ? S.boss.hp : -1);
}

const CASES = [[1, 13374201, 6000], [2, 777, 6000], [5, 4242, 6000], [8, 99, 7000]];
for (const c of CASES) console.log(fingerprint(c[0], c[1], c[2]));
