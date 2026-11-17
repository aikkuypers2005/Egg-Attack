// Prints one line about the sound effects of the web version: the number of samples of all 37 sounds built by
// src/audio.js, the sum of their sizes as 16-bit numbers, and a running hash of them.
// The Processing version builds the same sounds in Audio.pde; its test prints the same line and compares it with
// SFX_SUM_WEB in Test.pde. After a change to data/sfx.json or to A.render in src/audio.js, run this
// (from the egg-attack folder:  node installer\sfx_sum.js ) and copy the line into SFX_SUM_WEB.
const path = require('path');
const root = path.join(__dirname, '..');
const A = require(path.join(root, 'src/audio.js')).audio, sfx = require(path.join(root, 'data/sfx.json'));
let total = 0, sum = 0, h = 0;
for (const parts of Object.values(sfx.sounds)) {
  const d = A.render(parts, sfx.rate);
  total += d.length;
  for (const v of d) { const s = Math.floor(v * 32767 + 0.5); sum += Math.abs(s); h = (Math.imul(h, 31) + s) | 0; }
}
console.log('SFXSUM samples=' + total + ' abs16=' + sum + ' hash=' + h);
