// Generates the shared JSON files (data/biomes.json, data/dinos.json, data/sprites.json)
// used by both the p5.js web game and the Processing 4 Windows port.
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const DATA_DIR = path.join(ROOT, 'data');
const PDE_DATA_DIR = path.join(ROOT, 'processing', 'EggAttack', 'data');

// ---------------------------------------------------------------------------
// 1. BIOMES & WATER ZONES
// ---------------------------------------------------------------------------
const biomes = {
  worldMin: -5400,
  worldMax: 5400,
  groundY: 216,
  zones: [
    { id: 'canyon',   name: 'Bone Canyon',     side: 'left',   x0: -5400, x1: -4200, bg: 'canyon',   sky: '#3d1c2e', ground: '#6e3528', grass: '#9c4f35', accent: '#d8ccb8', tier: 4 },
    { id: 'dunes',    name: 'Scorched Dunes',  side: 'left',   x0: -4200, x1: -3000, bg: 'dunes',    sky: '#6b3b1e', ground: '#b8843e', grass: '#dca959', accent: '#8c5a2b', tier: 3 },
    { id: 'swamp',    name: 'Misty Swamp',     side: 'left',   x0: -3000, x1: -1700, bg: 'swamp',    sky: '#24302c', ground: '#38462c', grass: '#4f6b38', accent: '#6d8c49', tier: 2 },
    { id: 'jungle',   name: 'Deep Jungle',     side: 'left',   x0: -1700, x1: -500,  bg: 'jungle',   sky: '#183834', ground: '#3e3222', grass: '#2d7a3e', accent: '#52a849', tier: 1 },
    { id: 'meadow',   name: 'Fern Meadow',     side: 'center', x0: -500,  x1: 500,   bg: 'meadow',   sky: '#3b6ea5', ground: '#5c4328', grass: '#4ca638', accent: '#78cc4c', tier: 0 },
    { id: 'river',    name: 'River Delta',     side: 'right',  x0: 500,   x1: 1700,  bg: 'river',    sky: '#3878a8', ground: '#5a4a32', grass: '#449e48', accent: '#5bc0be', tier: 1 },
    { id: 'mushroom', name: 'Mushroom Forest', side: 'right',  x0: 1700,  x1: 3000,  bg: 'mushroom', sky: '#162044', ground: '#2a2845', grass: '#26688a', accent: '#4ce8e0', tier: 2 },
    { id: 'crag',     name: 'Crag Field',      side: 'right',  x0: 3000,  x1: 4200,  bg: 'crag',     sky: '#3a2622', ground: '#38343a', grass: '#594a42', accent: '#e06830', tier: 3 },
    { id: 'coast',    name: 'Sea Coast',       side: 'right',  x0: 4200,  x1: 5400,  bg: 'coast',    sky: '#2c5d7c', ground: '#9c8a5e', grass: '#baa874', accent: '#3a9ec4', tier: 4 }
  ],
  // The last shallow entry is the sea shore and the deep entry is the open sea (sim.js relies on that).
  water: [
    { x0: -2800, x1: -2000, depth: 'shallow', col: '#2d523a', foam: '#5a8a62' },
    { x0: 700,   x1: 1400,  depth: 'shallow', col: '#2a7694', foam: '#74c8dc' },
    { x0: 4250,  x1: 4850,  depth: 'shallow', col: '#24688e', foam: '#7ed6ea' },
    { x0: 4850,  x1: 5400,  depth: 'deep',    col: '#12385c', foam: '#4fa4c8' }
  ]
};

// ---------------------------------------------------------------------------
// 2. ALL 24 CREATURES
// ---------------------------------------------------------------------------
const dinos = {
  // ---- MEAT EATERS (9) ----
  compsognathus: {
    name: 'Compsognathus', group: 'carnivore', size: 'tiny',
    hp: 16, speed: 2.05, damage: 3, reach: 12, w: 14, h: 11,
    role: 'raider', special: 'steal', minThreat: 0, pack: [3, 4],
    biomes: ['meadow', 'jungle'], habitat: 'land',
    food: { tier: 1, hunger: 16, growth: 3 }
  },
  velociraptor: {
    name: 'Velociraptor', group: 'carnivore', size: 'small',
    hp: 34, speed: 2.25, damage: 7, reach: 16, w: 22, h: 16,
    role: 'raider', special: 'pounce', minThreat: 1, pack: [2, 3],
    biomes: ['jungle', 'dunes'], habitat: 'land',
    food: { tier: 1, hunger: 22, growth: 5 }
  },
  dilophosaurus: {
    name: 'Dilophosaurus', group: 'carnivore', size: 'small',
    hp: 38, speed: 1.75, damage: 6, reach: 16, w: 24, h: 17,
    role: 'raider', special: 'spit', minThreat: 1, pack: [1, 2],
    biomes: ['jungle', 'swamp'], habitat: 'land',
    food: { tier: 2, hunger: 26, growth: 6 }
  },
  baryonyx: {
    name: 'Baryonyx', group: 'carnivore', size: 'medium',
    hp: 62, speed: 1.85, damage: 10, reach: 22, w: 32, h: 22,
    role: 'guard', special: 'aquatic_fast', minThreat: 2, pack: [1, 1],
    biomes: ['river', 'swamp'], habitat: 'land',
    food: { tier: 2, hunger: 32, growth: 8 }
  },
  carnotaurus: {
    name: 'Carnotaurus', group: 'carnivore', size: 'medium-large',
    hp: 84, speed: 2.55, damage: 13, reach: 24, w: 38, h: 27,
    role: 'raider', special: 'sprint', minThreat: 4, pack: [1, 1],
    biomes: ['dunes', 'crag'], habitat: 'land',
    food: { tier: 3, hunger: 38, growth: 11 }
  },
  allosaurus: {
    name: 'Allosaurus', group: 'carnivore', size: 'large',
    hp: 96, speed: 1.85, damage: 15, reach: 26, w: 44, h: 30,
    role: 'raider', special: 'none', minThreat: 5, pack: [2, 2],
    biomes: ['crag', 'canyon'], habitat: 'land',
    food: { tier: 3, hunger: 42, growth: 13 }
  },
  tyrannosaurus: {
    name: 'Rival T-Rex', group: 'carnivore', size: 'giant',
    hp: 155, speed: 1.55, damage: 22, reach: 30, w: 52, h: 36,
    role: 'raider', special: 'roar', minThreat: 7, pack: [1, 1],
    biomes: ['canyon', 'crag'], habitat: 'land',
    food: { tier: 4, hunger: 55, growth: 18 }
  },
  giganotosaurus: {
    name: 'Giganotosaurus', group: 'carnivore', size: 'giant',
    hp: 165, speed: 1.9, damage: 18, reach: 32, w: 56, h: 38,
    role: 'raider', special: 'bleed', minThreat: 8, pack: [1, 1],
    biomes: ['canyon'], habitat: 'land',
    food: { tier: 4, hunger: 60, growth: 20 }
  },
  spinosaurus: {
    name: 'Spinosaurus', group: 'carnivore', size: 'giant',
    hp: 160, speed: 1.75, damage: 19, reach: 31, w: 56, h: 40,
    role: 'raider', special: 'aquatic_boss', minThreat: 7, pack: [1, 1],
    biomes: ['swamp', 'river'], habitat: 'land',
    food: { tier: 4, hunger: 58, growth: 19 }
  },

  // ---- LEAF EATERS (10) ----
  dryosaurus: {
    name: 'Dryosaurus', group: 'herbivore', size: 'small',
    hp: 20, speed: 2.1, damage: 0, reach: 10, w: 20, h: 14,
    role: 'prey', special: 'bush_hide', minThreat: 0, pack: [1, 2],
    biomes: ['meadow', 'jungle'], habitat: 'land',
    food: { tier: 1, hunger: 24, growth: 5 }
  },
  gallimimus: {
    name: 'Gallimimus', group: 'herbivore', size: 'small-medium',
    hp: 28, speed: 2.75, damage: 0, reach: 12, w: 26, h: 20,
    role: 'prey', special: 'dash_flee', minThreat: 1, pack: [1, 2],
    biomes: ['dunes', 'meadow'], habitat: 'land',
    food: { tier: 2, hunger: 28, growth: 7 }
  },
  pachycephalosaurus: {
    name: 'Pachycephalosaurus', group: 'herbivore', size: 'small-medium',
    hp: 46, speed: 2.15, damage: 9, reach: 18, w: 26, h: 19,
    role: 'guard', special: 'ram_stun', minThreat: 2, pack: [1, 2],
    biomes: ['crag', 'dunes'], habitat: 'land',
    food: { tier: 2, hunger: 30, growth: 8 }
  },
  iguanodon: {
    name: 'Iguanodon', group: 'herbivore', size: 'medium',
    hp: 58, speed: 1.75, damage: 9, reach: 20, w: 32, h: 22,
    role: 'defend', special: 'thumb_spike', minThreat: 2, pack: [1, 2],
    biomes: ['jungle', 'river'], habitat: 'land',
    food: { tier: 2, hunger: 34, growth: 9 }
  },
  parasaurolophus: {
    name: 'Parasaurolophus', group: 'herbivore', size: 'medium',
    hp: 50, speed: 2.0, damage: 4, reach: 18, w: 34, h: 24,
    role: 'prey', special: 'herd_call', minThreat: 2, pack: [1, 2],
    biomes: ['river', 'meadow'], habitat: 'land',
    food: { tier: 2, hunger: 34, growth: 9 }
  },
  ankylosaurus: {
    name: 'Ankylosaurus', group: 'herbivore', size: 'medium-large',
    hp: 95, speed: 1.15, damage: 15, reach: 24, w: 38, h: 22,
    role: 'defend', special: 'armor_club', minThreat: 4, pack: [1, 1],
    biomes: ['mushroom', 'crag'], habitat: 'land',
    food: { tier: 3, hunger: 44, growth: 13 }
  },
  stegosaurus: {
    name: 'Stegosaurus', group: 'herbivore', size: 'large',
    hp: 88, speed: 1.25, damage: 14, reach: 26, w: 44, h: 28,
    role: 'defend', special: 'tail_bleed', minThreat: 3, pack: [1, 1],
    biomes: ['mushroom', 'jungle'], habitat: 'land',
    food: { tier: 3, hunger: 42, growth: 12 }
  },
  triceratops: {
    name: 'Triceratops', group: 'herbivore', size: 'large',
    hp: 105, speed: 1.85, damage: 16, reach: 26, w: 44, h: 28,
    role: 'guard', special: 'horn_charge', minThreat: 4, pack: [1, 1],
    biomes: ['dunes', 'crag'], habitat: 'land',
    food: { tier: 3, hunger: 46, growth: 14 }
  },
  diplodocus: {
    name: 'Diplodocus', group: 'herbivore', size: 'titan',
    hp: 170, speed: 0.95, damage: 14, reach: 42, w: 72, h: 38,
    role: 'defend', special: 'tail_whip', minThreat: 5, pack: [1, 1],
    biomes: ['swamp', 'river'], habitat: 'land',
    food: { tier: 4, hunger: 56, growth: 17 }
  },
  brachiosaurus: {
    name: 'Brachiosaurus', group: 'herbivore', size: 'titan',
    hp: 9999, speed: 0.65, damage: 20, reach: 30, w: 64, h: 58,
    role: 'hazard', special: 'stomp', minThreat: 5, pack: [1, 1],
    biomes: ['canyon', 'meadow'], habitat: 'land',
    food: { tier: 4, hunger: 60, growth: 18 }
  },

  // ---- FLYERS & SWIMMERS (5) ----
  microraptor: {
    name: 'Microraptor', group: 'flyer', size: 'tiny',
    hp: 18, speed: 2.35, damage: 5, reach: 14, w: 16, h: 12,
    role: 'ambush', special: 'canopy_drop', minThreat: 1, pack: [1, 2],
    biomes: ['jungle', 'mushroom'], habitat: 'air',
    food: { tier: 1, hunger: 20, growth: 4 }
  },
  pteranodon: {
    name: 'Pteranodon', group: 'flyer', size: 'medium',
    hp: 32, speed: 2.45, damage: 8, reach: 18, w: 32, h: 18,
    role: 'raider', special: 'swoop', minThreat: 3, pack: [1, 2],
    biomes: ['coast', 'river', 'meadow'], habitat: 'air',
    food: { tier: 2, hunger: 28, growth: 8 }
  },
  plesiosaurus: {
    name: 'Plesiosaurus', group: 'swimmer', size: 'medium',
    hp: 68, speed: 2.0, damage: 12, reach: 26, w: 38, h: 22,
    role: 'water_guard', special: 'water_lunge', minThreat: 4, pack: [1, 1],
    biomes: ['coast'], habitat: 'water',
    food: { tier: 3, hunger: 40, growth: 12 }
  },
  quetzalcoatlus: {
    name: 'Quetzalcoatlus', group: 'flyer', size: 'giant',
    hp: 92, speed: 2.2, damage: 15, reach: 28, w: 54, h: 34,
    role: 'raider', special: 'snatch_food', minThreat: 6, pack: [1, 1],
    biomes: ['canyon', 'coast', 'crag'], habitat: 'air',
    food: { tier: 4, hunger: 52, growth: 16 }
  },
  mosasaurus: {
    name: 'Mosasaurus', group: 'swimmer', size: 'titan',
    hp: 240, speed: 2.4, damage: 34, reach: 38, w: 70, h: 28,
    role: 'deep_boss', special: 'deep_breach', minThreat: 6, pack: [1, 1],
    biomes: ['coast'], habitat: 'deep_water',
    food: { tier: 4, hunger: 65, growth: 22 }
  }
};

// ---------------------------------------------------------------------------
// Where each creature lives in the wild, and what its meat is worth to the baby.
// This replaces the 'biomes' and 'food' values in the table above, so the rule stays in one place:
// meat tier = how far out the creature lives (1 jungle/river, 2 swamp/mushroom, 3 dunes/crag,
// 4 canyon/coast). Tier 0 is a snack: it fills hunger but never counts as a meal.
const HOME = {
  compsognathus:      [['jungle', 'river'], 0],
  velociraptor:       [['jungle'], 1],
  dryosaurus:         [['jungle', 'river'], 1],
  iguanodon:          [['jungle', 'river'], 1],
  parasaurolophus:    [['river'], 1],
  microraptor:        [['jungle'], 0],
  dilophosaurus:      [['swamp'], 2],
  baryonyx:           [['swamp'], 2],
  diplodocus:         [['swamp'], 2],
  stegosaurus:        [['mushroom'], 2],
  ankylosaurus:       [['mushroom'], 2],
  pteranodon:         [['mushroom'], 2],
  gallimimus:         [['dunes'], 3],
  triceratops:        [['dunes', 'crag'], 3],
  carnotaurus:        [['dunes'], 3],
  pachycephalosaurus: [['crag'], 3],
  allosaurus:         [['crag'], 3],
  tyrannosaurus:      [['canyon'], 4],
  giganotosaurus:     [['canyon'], 4],
  brachiosaurus:      [['canyon'], 0],
  quetzalcoatlus:     [['canyon', 'coast'], 4],
  spinosaurus:        [['coast'], 4],
  plesiosaurus:       [['coast'], 4],
  mosasaurus:         [['coast'], 4]
};
for (const k of Object.keys(dinos)) {
  if (!HOME[k]) throw new Error('No home set for ' + k);
  dinos[k].biomes = HOME[k][0];
  dinos[k].food = { tier: HOME[k][1] };
  delete dinos[k].minThreat;     // raids are now listed per growth stage in sim.js
  delete dinos[k].pack;
}

// ---------------------------------------------------------------------------
// 3. PIXEL ART SPRITE BUILDER -> data/sprites.json
// ---------------------------------------------------------------------------
// Helper that draws clean pixel primitives onto a character grid and exports
// equal-length string rows + hex palette.
function grid(w, h, palette) {
  const g = Array.from({ length: h }, () => Array(w).fill('.'));
  const api = {
    px(x, y, c) {
      x = Math.round(x); y = Math.round(y);
      if (x >= 0 && x < w && y >= 0 && y < h) g[y][x] = c;
    },
    rect(x, y, rw, rh, c) {
      for (let yy = 0; yy < rh; yy++) for (let xx = 0; xx < rw; xx++) api.px(x + xx, y + yy, c);
    },
    oval(cx, cy, rx, ry, c) {
      for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
        for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
          const dx = (x - cx) / Math.max(0.5, rx), dy = (y - cy) / Math.max(0.5, ry);
          if (dx * dx + dy * dy <= 1.05) api.px(x, y, c);
        }
      }
    },
    line(x0, y0, x1, y1, c, thick = 1) {
      const steps = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) * 2));
      for (let i = 0; i <= steps; i++) {
        const x = x0 + (x1 - x0) * (i / steps), y = y0 + (y1 - y0) * (i / steps);
        for (let ty = 0; ty < thick; ty++) for (let tx = 0; tx < thick; tx++) api.px(x + tx, y + ty, c);
      }
    },
    tri(x0, y0, x1, y1, x2, y2, c) {
      const minX = Math.floor(Math.min(x0, x1, x2)), maxX = Math.ceil(Math.max(x0, x1, x2));
      const minY = Math.floor(Math.min(y0, y1, y2)), maxY = Math.ceil(Math.max(y0, y1, y2));
      const edge = (ax, ay, bx, by, px, py) => (px - ax) * (by - ay) - (py - ay) * (bx - ax);
      const area = edge(x0, y0, x1, y1, x2, y2);
      if (area === 0) return;
      for (let y = minY; y <= maxY; y++) {
        for (let x = minX; x <= maxX; x++) {
          const w0 = edge(x1, y1, x2, y2, x, y) * Math.sign(area);
          const w1 = edge(x2, y2, x0, y0, x, y) * Math.sign(area);
          const w2 = edge(x0, y0, x1, y1, x, y) * Math.sign(area);
          if (w0 >= -0.01 && w1 >= -0.01 && w2 >= -0.01) api.px(x, y, c);
        }
      }
    },
    done() {
      return { palette, rows: g.map(r => r.join('')) };
    }
  };
  return api;
}

const parts = {};
const rigs = {};

// Every creature has 4 animations. 'attack' always has 4 poses that sim.js picks by attack phase:
// 0 wind-up, 1 strike, 2 end of strike, 3 recovery.
function stdAnims(kind) {
  if (kind === 'flyer') {
    return {
      idle: [
        { body: [0, 0], head: [0, 0], wing: [0, -2], tail: [0, 0] },
        { body: [0, 1], head: [0, 1], wing: [0, 3],  tail: [0, 1] }
      ],
      move: [
        { body: [0, -1], head: [1, -1], wing: [0, -4], tail: [-1, 0] },
        { body: [0, 0],  head: [1, 0],  wing: [0, 0],  tail: [0, 0] },
        { body: [0, 1],  head: [1, 1],  wing: [0, 4],  tail: [0, 1] },
        { body: [0, 0],  head: [1, 0],  wing: [0, -1], tail: [0, 0] }
      ],
      attack: [
        { body: [-1, -2], head: [-1, -3], wing: [0, -5],  tail: [0, -1] },
        { body: [2, 2],   head: [4, 3],   wing: [0, 3],   tail: [-1, 1] },
        { body: [2, 2],   head: [4, 4],   wing: [0, 1],   tail: [-1, 2] },
        { body: [0, 0],   head: [1, 1],   wing: [0, -2],  tail: [0, 1] }
      ],
      hurt: [
        { body: [-2, -1], head: [-2, -2], wing: [-1, -2], tail: [-1, 1] },
        { body: [-1, 1],  head: [-1, 0],  wing: [0, 2],   tail: [0, 2] }
      ]
    };
  }
  if (kind === 'swimmer') {
    return {
      idle: [
        { body: [0, 0], head: [0, 0], jaw: [0, 0], finF: [0, 0], finB: [0, 0], tail: [0, 0] },
        { body: [0, 1], head: [0, 1], jaw: [0, 1], finF: [0, 1], finB: [0, -1], tail: [0, -1] }
      ],
      move: [
        { body: [0, 0],  head: [1, 0],  jaw: [1, 0],  finF: [1, 1],  finB: [-1, 0], tail: [0, -2] },
        { body: [0, 1],  head: [1, 1],  jaw: [1, 1],  finF: [0, 2],  finB: [0, 1],  tail: [0, 0] },
        { body: [0, 0],  head: [1, 0],  jaw: [1, 0],  finF: [-1, 0], finB: [1, 1],  tail: [0, 2] },
        { body: [0, -1], head: [1, -1], jaw: [1, -1], finF: [0, -1], finB: [0, 0],  tail: [0, 0] }
      ],
      attack: [
        { body: [-2, 1],  head: [-3, -1], jaw: [-3, 2],  finF: [-1, 1], finB: [-1, 1], tail: [-1, 1] },
        { body: [3, -2],  head: [5, -4],  jaw: [5, -1],  finF: [2, 0],  finB: [2, 0],  tail: [1, -1] },
        { body: [3, -2],  head: [5, -3],  jaw: [5, -3],  finF: [2, 0],  finB: [2, 0],  tail: [1, -1] },
        { body: [0, 1],   head: [1, 2],   jaw: [1, 2],   finF: [0, 1],  finB: [0, 0],  tail: [0, 1] }
      ],
      hurt: [
        { body: [-2, 1], head: [-2, -1], jaw: [-2, 2], finF: [-1, 2], finB: [-1, 1], tail: [-2, 1] },
        { body: [-1, 2], head: [-1, 1],  jaw: [-1, 3], finF: [0, 2],  finB: [0, 2],  tail: [-1, 2] }
      ]
    };
  }
  if (kind === 'quad') {
    return {
      idle: [
        { body: [0, 0], head: [0, 0], tail: [0, 0], legF: [0, 0], legB: [0, 0] },
        { body: [0, 1], head: [0, 1], tail: [0, 1], legF: [0, 0], legB: [0, 0] }
      ],
      move: [
        { body: [0, 0],  head: [1, 0], tail: [0, -1], legF: [2, -1], legB: [-2, 0] },
        { body: [0, 1],  head: [1, 1], tail: [0, 0],  legF: [0, 0],  legB: [0, -1] },
        { body: [0, 0],  head: [1, 0], tail: [0, 1],  legF: [-2, 0], legB: [2, -1] },
        { body: [0, 1],  head: [1, 1], tail: [0, 0],  legF: [0, -1], legB: [0, 0] }
      ],
      attack: [
        { body: [-1, 0], head: [-2, -1], tail: [1, -5],  legF: [-1, 0], legB: [0, 0] },
        { body: [2, 0],  head: [5, 1],   tail: [-4, -1], legF: [2, 0],  legB: [-1, 0] },
        { body: [2, 0],  head: [5, 2],   tail: [-4, 1],  legF: [2, 0],  legB: [-1, 0] },
        { body: [0, 1],  head: [0, 3],   tail: [0, 2],   legF: [0, 0],  legB: [0, 0] }
      ],
      hurt: [
        { body: [-2, -1], head: [-2, -2], tail: [-2, 1], legF: [-1, 0], legB: [-1, 0] },
        { body: [-1, 1],  head: [-1, 1],  tail: [-1, 2], legF: [0, 0],  legB: [0, 0] }
      ]
    };
  }
  // Default: biped theropod / ornithopod with snapping jaw!
  return {
    idle: [
      { body: [0, 0], head: [0, 0], jaw: [0, 0], tail: [0, 0], legF: [0, 0], legB: [0, 0] },
      { body: [0, 1], head: [0, 1], jaw: [0, 1], tail: [0, 1], legF: [0, 0], legB: [0, 0] }
    ],
    move: [
      { body: [0, -1], head: [1, -1], jaw: [1, -1], tail: [-1, 0], legF: [3, -2], legB: [-2, 0] },
      { body: [0, 0],  head: [1, 0],  jaw: [1, 0],  tail: [0, 0],  legF: [1, 0],  legB: [0, -1] },
      { body: [0, -1], head: [1, -1], jaw: [1, -1], tail: [-1, 1], legF: [-2, 0], legB: [3, -2] },
      { body: [0, 0],  head: [1, 0],  jaw: [1, 0],  tail: [0, 0],  legF: [0, -1], legB: [1, 0] }
    ],
    // Parts never move more than a few pixels apart, so the head and tail stay attached to the body.
    attack: [
      { body: [-2, 0], head: [-3, -1], jaw: [-3, 3], tail: [-1, 1], legF: [-1, 0], legB: [-1, 0] },
      { body: [3, 0],  head: [7, 0],   jaw: [7, 4],  tail: [0, 0],  legF: [3, 0],  legB: [1, 0] },
      { body: [3, 1],  head: [7, 1],   jaw: [7, 1],  tail: [0, 1],  legF: [3, 0],  legB: [1, 0] },
      { body: [0, 1],  head: [1, 3],   jaw: [1, 3],  tail: [0, 1],  legF: [0, 0],  legB: [0, 0] }
    ],
    hurt: [
      { body: [-2, -1], head: [-3, -2], jaw: [-3, 1], tail: [-2, 1], legF: [-1, 0], legB: [-2, 0] },
      { body: [-1, 1],  head: [-2, 0],  jaw: [-2, 2], tail: [-1, 2], legF: [0, 0],  legB: [-1, 0] }
    ]
  };
}

// ---- The 8 T-rex types a player can be dealt. Each has its own colours and its own shape. ----
// speed, reach, carry and jump are multipliers. carry is the speed while carrying food.
// regen 1 = heals anywhere (the others only heal at the nest). respawn is a multiplier on the time knocked out.
const rexes = {
  rex:    { name: 'Rex',    blurb: 'Balanced, no weak spot',     hp: 110, speed: 1.0,  bite: 22, reach: 1.0, carry: 0.78, jump: 1.0,  regen: 0, respawn: 1 },
  brick:  { name: 'Brick',  blurb: 'Tough but slow',             hp: 160, speed: 0.85, bite: 20, reach: 1.0, carry: 0.78, jump: 1.0,  regen: 0, respawn: 1 },
  dash:   { name: 'Dash',   blurb: 'Fast but fragile',           hp: 75,  speed: 1.25, bite: 16, reach: 1.0, carry: 0.78, jump: 1.0,  regen: 0, respawn: 1 },
  chomp:  { name: 'Chomp',  blurb: 'Strongest bite',             hp: 95,  speed: 0.95, bite: 30, reach: 1.0, carry: 0.78, jump: 1.0,  regen: 0, respawn: 1 },
  mule:   { name: 'Mule',   blurb: 'Carries food at full speed', hp: 110, speed: 0.95, bite: 18, reach: 1.0, carry: 1.0,  jump: 1.0,  regen: 0, respawn: 1 },
  hop:    { name: 'Hop',    blurb: 'Jumps very high',            hp: 90,  speed: 1.05, bite: 20, reach: 1.0, carry: 0.78, jump: 1.25, regen: 0, respawn: 1 },
  reach:  { name: 'Reach',  blurb: 'Bites from further away',    hp: 90,  speed: 1.0,  bite: 18, reach: 1.6, carry: 0.78, jump: 1.0,  regen: 0, respawn: 1 },
  mender: { name: 'Mender', blurb: 'Heals anywhere, back fast',  hp: 100, speed: 1.0,  bite: 18, reach: 1.0, carry: 0.78, jump: 1.0,  regen: 1, respawn: 0.5 }
};

// How each type looks. pal: a main, l light, b dark, u belly, c accent. The rest changes the shape.
const REX_LOOK = {
  rex:    { pal: { a: '#746326', l: '#948034', b: '#4f4318', u: '#a89652', c: '#948034' } },                       // the colour of the original sketch
  brick:  { pal: { a: '#5c6e62', l: '#7a8e80', b: '#3a483e', u: '#9aaa98', c: '#2e3a32' }, bodyRx: 8, bodyRy: 7, plates: true },
  dash:   { pal: { a: '#e07a28', l: '#f49a48', b: '#9c4c14', u: '#f8c888', c: '#fff0c0' }, bodyRy: 5, legH: 10, stripe: true },
  chomp:  { pal: { a: '#b83228', l: '#d85240', b: '#7a1c18', u: '#e0a088', c: '#f8e0c0' }, headW: 22, headH: 12 },
  mule:   { pal: { a: '#e4d49c', l: '#f4e8bc', b: '#8a6c3a', u: '#fff6d8', c: '#6e4a22' }, bodyRx: 8, hump: true },
  hop:    { pal: { a: '#7a4ab0', l: '#9a6ad0', b: '#4c2a78', u: '#c8a8e8', c: '#e8d0ff' }, tailW: 20, legH: 10 },
  reach:  { pal: { a: '#2a9c94', l: '#4cc0b4', b: '#18645e', u: '#a4e4d8', c: '#d8fff4' }, neck: 4, headW: 21, headFwd: 2 },
  mender: { pal: { a: '#3a78b8', l: '#5a9cd8', b: '#224c7c', u: '#a8d0f0', c: '#58e8a0' }, crest: true }
};

function makeRex(rigId, o) {
  const pal = Object.assign({ w: '#f8f8f0', k: '#121018' }, o.pal);
  const headW = o.headW || 18, headH = o.headH || 10, rx = o.bodyRx || 7, ry = o.bodyRy || 6;
  const legH = o.legH || 8, tailW = o.tailW || 15, neck = o.neck || 0;
  const GY = 37, crestPad = o.crest ? 3 : 0, topPad = o.plates || o.hump ? 3 : 0;

  // Head: the blocky snout, eye and teeth of the original sketch, stretched to this type's head size.
  const sx = headW / 18, sy = headH / 10;
  const X = v => Math.round(v * sx), Y = v => Math.round(v * sy) + crestPad;
  const h = grid(headW, headH + crestPad, pal);
  h.rect(0, Y(0), X(7), Y(5) - Y(0), 'a');
  h.rect(X(1), Y(0), X(5), 2, 'l');
  h.rect(X(5), Y(2), headW - X(5) - 1, Y(7) - Y(2), 'a');
  h.rect(X(6), Y(2), headW - X(6) - 2, 2, 'l');
  h.rect(0, Y(5), X(7), Y(9) - Y(5), 'b');
  h.rect(2, Y(1), 3, 3, 'w');
  h.px(4, Y(1) + 1, 'k');
  h.px(headW - 3, Y(3), 'b');
  for (let tx = X(8); tx < headW - 2; tx += 3) { h.px(tx, Y(7), 'w'); h.px(tx + 1, Y(7), 'w'); h.px(tx + 1, Y(7) + 1, 'w'); }
  if (o.crest) { h.tri(0, crestPad, X(6), crestPad, X(2), 0, 'c'); h.rect(0, crestPad - 1, X(5), 1, 'c'); }
  parts[rigId + '_head'] = h.done();

  const j = grid(headW - 3, 5, pal);
  j.rect(0, 2, headW - 4, 3, 'b');
  j.rect(1, 2, headW - 6, 1, 'a');
  for (let tx = Math.round(headW * 0.35); tx < headW - 5; tx += 3) j.px(tx, 1, 'w');
  parts[rigId + '_jaw'] = j.done();

  // Body: round belly, neck and the tiny arm.
  const bw = rx * 2 + 4, bh = ry * 2 + 3 + neck + topPad, top = topPad + neck + 2, cy = top + ry;
  const b = grid(bw, bh, pal);
  if (o.plates) for (let px = 1; px <= rx + 1; px += 4) b.tri(px, top + 3, px + 2, top - 3, px + 4, top + 3, 'c');
  if (o.hump) b.oval(rx - 1, top, rx - 2, 3, 'c');
  b.oval(rx + 1, cy, rx, ry, 'a');
  b.oval(rx + 2, cy + 1, rx - 2, ry - 2, 'u');
  if (o.stripe) b.rect(2, cy - 2, rx * 2 - 2, 1, 'c');
  b.rect(rx + 1, topPad, 6, neck + 5, 'a');
  b.rect(rx + 1, topPad, 2, neck + 5, 'b');
  b.rect(bw - 5, cy - 1, 4, 2, 'a');
  b.px(bw - 2, cy + 1, 'b');
  parts[rigId + '_body'] = b.done();

  const t = grid(tailW, 8, pal);
  t.tri(0, 2, tailW - 1, 1, tailW - 1, 7, 'a');
  t.line(1, 3, tailW - 2, 6, 'b', 1);
  if (o.stripe) t.line(3, 3, tailW - 2, 3, 'c', 1);
  parts[rigId + '_tail'] = t.done();

  const lf = grid(6, legH, pal);
  lf.rect(1, 0, 4, legH - 3, 'a');
  lf.rect(1, legH - 3, 5, 3, 'b');
  lf.px(5, legH - 1, 'w');
  parts[rigId + '_legF'] = lf.done();
  const lb = grid(6, legH, pal);
  lb.rect(1, 0, 4, legH - 3, 'b');
  lb.rect(1, legH - 3, 5, 3, 'b');
  parts[rigId + '_legB'] = lb.done();

  const tailX = 1, bodyX = tailX + tailW - 5, bodyY = GY - legH - bh + 2, neckTop = bodyY + topPad;
  const headX = bodyX + rx + 1 + (o.headFwd || 0), headY = neckTop - headH + 1 - crestPad;
  rigs[rigId] = {
    w: 48, h: 38, ox: bodyX + rx + 1, oy: GY,
    parts: [
      { id: 'tail', part: rigId + '_tail', x: tailX, y: neckTop + neck + 2 },
      { id: 'legB', part: rigId + '_legB', x: bodyX + rx - 4, y: GY - legH },
      { id: 'body', part: rigId + '_body', x: bodyX, y: bodyY },
      { id: 'legF', part: rigId + '_legF', x: bodyX + rx + 1, y: GY - legH },
      { id: 'jaw',  part: rigId + '_jaw',  x: headX + 2, y: headY + crestPad + headH - 2 },
      { id: 'head', part: rigId + '_head', x: headX, y: headY }
    ],
    anims: stdAnims('biped')
  };
}

for (const id of Object.keys(rexes)) {
  makeRex('rex_' + id, REX_LOOK[id]);
  rexes[id].col = REX_LOOK[id].pal.a;       // used for this type's markers on the HUD and the map
}

// ---- Nest & 5 Baby T-Rex Growth Stages ----
{
  const n = grid(44, 13, { a: '#6e4e28', b: '#4a3218', c: '#8c6838', g: '#3d8c38', l: '#68b848' });
  n.oval(22, 8, 20, 4, 'b');
  n.oval(22, 6, 19, 4, 'a');
  for (let x = 5; x < 39; x += 4) { n.line(x, 5, x + 3, 9, 'c'); n.line(x + 2, 9, x + 5, 5, 'b'); }
  n.oval(22, 5, 14, 2, 'g');
  n.px(10, 5, 'l'); n.px(18, 4, 'l'); n.px(27, 4, 'l'); n.px(33, 5, 'l');
  parts.nest_base = n.done();
  rigs.nest = {
    w: 44, h: 13, ox: 22, oy: 11,
    parts: [{ id: 'body', part: 'nest_base', x: 0, y: 0 }],
    anims: {
      idle: [{ body: [0, 0] }, { body: [0, 0] }],
      move: [{ body: [0, 0] }],
      attack: [{ body: [0, 0] }],
      hurt: [{ body: [-1, 0] }, { body: [1, 0] }]
    }
  };

  // Stage 0: Speckled Egg
  const egg = grid(12, 14, { w: '#efe6cf', s: '#c9b892', d: '#8c734b', m: '#746326' });
  egg.oval(6, 7, 5, 6, 's');
  egg.oval(5, 6, 4, 5, 'w');
  egg.rect(3, 4, 2, 2, 'm'); egg.rect(7, 6, 2, 2, 'm'); egg.rect(4, 9, 2, 2, 'd');
  parts.baby0_body = egg.done();
  rigs.baby0 = {
    w: 14, h: 16, ox: 7, oy: 15,
    parts: [{ id: 'body', part: 'baby0_body', x: 1, y: 1 }],
    anims: {
      idle: [{ body: [0, 0] }, { body: [1, 0] }],
      move: [{ body: [-1, 0] }, { body: [1, 0] }],
      attack: [{ body: [0, -1] }, { body: [0, 0] }],
      hurt: [{ body: [-2, 0] }, { body: [2, 0] }]
    }
  };

  // Stages 1..4: Hatchling -> Toddler -> Juvenile -> Grown Up!
  const babyPal = { a: '#887830', l: '#a89844', b: '#5c501e', u: '#c4b468', w: '#ffffff', k: '#121018' };
  const stages = [
    { key: 'baby1', s: 0.50 },
    { key: 'baby2', s: 0.66 },
    { key: 'baby3', s: 0.82 },
    { key: 'baby4', s: 0.96 }
  ];
  stages.forEach(st => {
    const bw = Math.round(28 * st.s), bh = Math.round(26 * st.s);
    const g = grid(bw, bh, babyPal);
    const hw = Math.max(8, Math.round(13 * st.s)), hh = Math.max(6, Math.round(8 * st.s));
    const hx = bw - hw, hy = 1;
    // Tail & chubby body
    g.tri(0, Math.round(bh * 0.55), Math.round(bw * 0.45), Math.round(bh * 0.45), Math.round(bw * 0.45), Math.round(bh * 0.75), 'a');
    g.oval(Math.round(bw * 0.48), Math.round(bh * 0.6), Math.round(bw * 0.24), Math.round(bh * 0.24), 'a');
    g.oval(Math.round(bw * 0.52), Math.round(bh * 0.63), Math.round(bw * 0.16), Math.round(bh * 0.16), 'u');
    // Legs
    g.rect(Math.round(bw * 0.40), bh - 5, 3, 5, 'b');
    g.rect(Math.round(bw * 0.56), bh - 5, 3, 5, 'a');
    // Head + cute oversized eye + teeth
    g.rect(hx, hy, hw, hh, 'a');
    g.rect(hx + 1, hy, hw - 2, 2, 'l');
    g.rect(hx + 2, hy + 1, 3, 3, 'w');
    g.px(hx + 4, hy + 2, 'k');
    g.px(hx + Math.round(hw * 0.6), hy + hh, 'w');
    g.px(hx + Math.round(hw * 0.8), hy + hh, 'w');
    g.rect(hx + 1, hy + hh + 1, hw - 2, 2, 'b');
    parts[st.key + '_body'] = g.done();
    rigs[st.key] = {
      w: bw + 4, h: bh + 4, ox: Math.round((bw + 4) / 2), oy: bh + 3,
      parts: [{ id: 'body', part: st.key + '_body', x: 2, y: 2 }],
      anims: {
        idle: [{ body: [0, 0] }, { body: [0, 1] }],
        move: [{ body: [0, -1] }, { body: [0, 0] }, { body: [1, -1] }, { body: [0, 0] }],
        attack: [{ body: [0, -2] }, { body: [1, 0] }, { body: [0, 0] }],
        hurt: [{ body: [-2, 0] }, { body: [1, 1] }]
      }
    };
  });
}

// ---- Food Tiers (1..4), Bush, Spit Projectile ----
{
  const foodDefs = [
    { id: 'food0', w: 9,  h: 7,  pal: { m: '#b85a48', l: '#d88270', d: '#7a3228', b: '#f4eedc' }, r: 2 },   // snack: hunger only
    { id: 'food1', w: 12, h: 9,  pal: { m: '#c84238', l: '#e86a58', d: '#842622', b: '#f4eedc' }, r: 3 },
    { id: 'food2', w: 15, h: 11, pal: { m: '#cc3b32', l: '#ee6854', d: '#80201c', b: '#f4eedc' }, r: 4 },
    { id: 'food3', w: 18, h: 13, pal: { m: '#d4382c', l: '#f47252', d: '#861e18', b: '#f8f2e0' }, r: 5 },
    { id: 'food4', w: 22, h: 15, pal: { m: '#dc3228', l: '#ff8858', d: '#8a1a14', b: '#fff8e4', g: '#f8d040' }, r: 6 }
  ];
  foodDefs.forEach(fd => {
    const g = grid(fd.w, fd.h, fd.pal);
    g.rect(1, Math.floor(fd.h / 2) - 1, fd.w - 2, 2, 'b'); // bone shaft
    g.px(0, Math.floor(fd.h / 2) - 2, 'b'); g.px(0, Math.floor(fd.h / 2) + 1, 'b');
    g.px(fd.w - 1, Math.floor(fd.h / 2) - 2, 'b'); g.px(fd.w - 1, Math.floor(fd.h / 2) + 1, 'b');
    g.oval(Math.floor(fd.w / 2), Math.floor(fd.h / 2), fd.r + 1, fd.r - 1, 'd');
    g.oval(Math.floor(fd.w / 2), Math.floor(fd.h / 2) - 1, fd.r, fd.r - 2, 'm');
    g.oval(Math.floor(fd.w / 2) - 1, Math.floor(fd.h / 2) - 2, Math.max(1, fd.r - 2), 1, 'l');
    if (fd.pal.g) { g.px(Math.floor(fd.w / 2), 1, 'g'); g.px(Math.floor(fd.w / 2) + 2, 2, 'g'); }
    parts[fd.id + '_p'] = g.done();
    rigs[fd.id] = {
      w: fd.w + 2, h: fd.h + 2, ox: Math.floor((fd.w + 2) / 2), oy: fd.h + 1,
      parts: [{ id: 'body', part: fd.id + '_p', x: 1, y: 1 }],
      anims: { idle: [{ body: [0, 0] }, { body: [0, 0] }], move: [{ body: [0, 0] }], attack: [{ body: [0, 0] }], hurt: [{ body: [0, 0] }] }
    };
  });

  const spit = grid(8, 6, { a: '#68e838', b: '#2ca022', w: '#d8ff98' });
  spit.oval(4, 3, 3, 2, 'b'); spit.oval(4, 3, 2, 1, 'a'); spit.px(5, 2, 'w');
  parts.spit_p = spit.done();
  rigs.spit = {
    w: 10, h: 8, ox: 5, oy: 4,
    parts: [{ id: 'body', part: 'spit_p', x: 1, y: 1 }],
    anims: { idle: [{ body: [0, 0] }, { body: [0, 1] }], move: [{ body: [0, 0] }], attack: [{ body: [0, 0] }], hurt: [{ body: [0, 0] }] }
  };

  const bush = grid(24, 14, { a: '#2e7d36', b: '#1c5224', l: '#56b448' });
  bush.oval(12, 9, 10, 4, 'b'); bush.oval(8, 7, 6, 4, 'a'); bush.oval(16, 7, 6, 4, 'a'); bush.oval(12, 5, 6, 4, 'l');
  parts.bush_p = bush.done();
  rigs.bush = {
    w: 26, h: 16, ox: 13, oy: 15,
    parts: [{ id: 'body', part: 'bush_p', x: 1, y: 1 }],
    anims: { idle: [{ body: [0, 0] }, { body: [0, 0] }], move: [{ body: [-1, 0] }, { body: [1, 0] }], attack: [{ body: [0, 0] }], hurt: [{ body: [0, 0] }] }
  };
}

// ---- Parametric Multi-Part Creature Builders for All 24 Species ----
// 1. Bipedal Carnivores & Herbivores
function makeBiped(id, cfg) {
  const { w, h, pal, crest, sail, horns, longSnout, dome, beak, feathers, thumbSpike, tinyArms } = cfg;
  const hw = Math.max(7, Math.round(w * (longSnout ? 0.42 : 0.34)));
  const hh = Math.max(5, Math.round(h * 0.30));
  const bw = Math.max(8, Math.round(w * 0.42));
  const bh = Math.max(6, Math.round(h * (sail ? 0.56 : 0.44)));
  const tw = Math.max(7, Math.round(w * 0.42));
  const th = Math.max(4, Math.round(h * 0.26));
  const lw = Math.max(3, Math.round(w * 0.14));
  const lh = Math.max(4, Math.round(h * 0.30));

  // Head
  const hd = grid(hw, hh + (crest || dome || horns ? 4 : 0), pal);
  const yo = crest || dome || horns ? 4 : 0;
  hd.rect(0, yo, Math.round(hw * 0.5), hh - 1, 'a');
  hd.rect(Math.round(hw * 0.3), yo + 1, hw - Math.round(hw * 0.3), hh - 2, 'a');
  hd.rect(1, yo, Math.round(hw * 0.6), 2, 'l');
  if (dome) { hd.oval(Math.round(hw * 0.4), yo, Math.round(hw * 0.3), 3, 'c'); }
  if (horns) { hd.tri(2, yo, 4, yo - 3, 6, yo, 'c'); }
  if (crest === 'twin') { hd.rect(2, yo - 3, Math.round(hw * 0.5), 3, 'c'); }
  if (crest === 'tube') { hd.line(0, yo - 3, Math.round(hw * 0.55), yo + 1, 'c', 2); }
  const ex = Math.max(2, Math.round(hw * 0.32));
  hd.rect(ex, yo + 1, 2, 2, 'w'); hd.px(ex + 1, yo + 1, 'k');
  if (!beak) {
    for (let tx = Math.round(hw * 0.45); tx < hw - 1; tx += 3) hd.px(tx, yo + hh - 1, 'w');
  } else {
    hd.rect(hw - 3, yo + 2, 3, Math.max(2, hh - 3), 'c');
  }
  parts[id + '_head'] = hd.done();

  // Jaw
  const jw = grid(Math.max(5, hw - 2), 4, pal);
  jw.rect(0, 1, Math.max(4, hw - 3), 2, 'b');
  if (!beak) jw.px(Math.max(2, Math.round(hw * 0.5)), 0, 'w');
  parts[id + '_jaw'] = jw.done();

  // Body
  const bd = grid(bw, bh, pal);
  const sy = sail ? Math.round(bh * 0.34) : 0;
  if (sail) {
    bd.oval(Math.round(bw * 0.48), sy + 2, Math.round(bw * 0.42), sy + 1, 'c');
    for (let sx = 2; sx < bw - 2; sx += 3) bd.line(sx, 1, sx, sy + 2, 'b');
  }
  bd.oval(Math.round(bw * 0.5), sy + Math.round((bh - sy) * 0.52), Math.round(bw * 0.45), Math.round((bh - sy) * 0.45), 'a');
  bd.oval(Math.round(bw * 0.55), sy + Math.round((bh - sy) * 0.62), Math.round(bw * 0.30), Math.round((bh - sy) * 0.28), 'u');
  bd.rect(Math.round(bw * 0.58), Math.max(0, sy - 2), Math.max(3, Math.round(bw * 0.25)), Math.round((bh - sy) * 0.45), 'a');
  // Forelimb
  const ax = Math.round(bw * 0.72), ay = sy + Math.round((bh - sy) * 0.48);
  bd.rect(ax, ay, tinyArms ? 3 : 5, 2, 'a');
  if (thumbSpike) bd.px(ax + 5, ay - 1, 'w');
  if (feathers) bd.rect(ax - 1, ay + 2, 5, 2, 'c');
  parts[id + '_body'] = bd.done();

  // Tail
  const tl = grid(tw, th, pal);
  tl.tri(0, Math.round(th * 0.3), tw - 1, 1, tw - 1, th - 1, 'a');
  if (feathers) tl.oval(2, Math.round(th * 0.35), 3, 2, 'c');
  parts[id + '_tail'] = tl.done();

  // Legs
  const lf = grid(lw, lh, pal);
  lf.rect(0, 0, Math.max(2, lw - 1), Math.max(2, lh - 2), 'a');
  lf.rect(0, lh - 2, lw, 2, 'b');
  parts[id + '_legF'] = lf.done();

  const lb = grid(lw, lh, pal);
  lb.rect(0, 0, Math.max(2, lw - 1), lh, 'b');
  parts[id + '_legB'] = lb.done();

  const bodyX = Math.round(tw * 0.72);
  const bodyY = Math.max(4, h - lh - bh + 3);
  const headX = bodyX + Math.round(bw * 0.52);
  const headY = Math.max(0, bodyY - Math.round(hh * 0.65) - (crest || dome || horns ? 3 : 0));
  rigs[id] = {
    w: w + 6, h: h + 4, ox: Math.round((w + 6) * 0.5), oy: h + 3,
    parts: [
      { id: 'tail', part: id + '_tail', x: 1, y: bodyY + Math.round(bh * 0.32) },
      { id: 'legB', part: id + '_legB', x: bodyX + Math.round(bw * 0.25), y: h - lh + 2 },
      { id: 'body', part: id + '_body', x: bodyX, y: bodyY },
      { id: 'legF', part: id + '_legF', x: bodyX + Math.round(bw * 0.55), y: h - lh + 2 },
      { id: 'jaw',  part: id + '_jaw',  x: headX + 2, y: headY + hh + (crest || dome || horns ? 2 : -1) },
      { id: 'head', part: id + '_head', x: headX, y: headY }
    ],
    anims: stdAnims('biped')
  };
}

// 2. Quadrupeds (Stego, Trike, Anky, Sauropods)
function makeQuad(id, cfg) {
  const { w, h, pal, kind } = cfg;
  if (kind === 'sauropod_tall') {
    // Brachiosaurus: towering vertical neck + dome head!
    const bd = grid(34, 24, pal);
    bd.oval(17, 13, 15, 9, 'a'); bd.oval(18, 16, 11, 5, 'u');
    parts[id + '_body'] = bd.done();
    const hd = grid(20, 34, pal);
    hd.line(2, 32, 11, 5, 'a', 6); hd.line(4, 32, 12, 6, 'l', 2);
    hd.rect(9, 1, 10, 6, 'a'); hd.oval(12, 1, 3, 2, 'l');
    hd.px(14, 3, 'w'); hd.px(15, 3, 'k');
    parts[id + '_head'] = hd.done();
    const tl = grid(18, 12, pal);
    tl.tri(0, 8, 17, 2, 17, 10, 'a');
    parts[id + '_tail'] = tl.done();
    const lf = grid(7, 16, pal); lf.rect(1, 0, 5, 16, 'a'); lf.rect(1, 13, 6, 3, 'b'); parts[id + '_legF'] = lf.done();
    const lb = grid(7, 14, pal); lb.rect(1, 0, 5, 14, 'b'); parts[id + '_legB'] = lb.done();
    rigs[id] = {
      w: 68, h: 60, ox: 34, oy: 59,
      parts: [
        { id: 'tail', part: id + '_tail', x: 1,  y: 32 },
        { id: 'legB', part: id + '_legB', x: 18, y: 44 },
        { id: 'body', part: id + '_body', x: 15, y: 24 },
        { id: 'legF', part: id + '_legF', x: 38, y: 42 },
        { id: 'head', part: id + '_head', x: 39, y: 1 }
      ],
      anims: stdAnims('quad')
    };
    return;
  }
  if (kind === 'sauropod_long') {
    // Diplodocus: long whip tail + sweeping horizontal neck
    const bd = grid(30, 18, pal);
    bd.oval(15, 10, 13, 7, 'a'); bd.oval(15, 13, 10, 4, 'u');
    for (let x = 5; x < 25; x += 4) bd.px(x, 2, 'c');
    parts[id + '_body'] = bd.done();
    const hd = grid(24, 14, pal);
    hd.line(0, 10, 16, 3, 'a', 4); hd.rect(15, 2, 8, 4, 'a'); hd.px(19, 3, 'w'); hd.px(20, 3, 'k');
    parts[id + '_head'] = hd.done();
    const tl = grid(26, 10, pal);
    tl.tri(0, 5, 25, 2, 25, 8, 'a'); tl.line(0, 5, 10, 4, 'b', 1);
    parts[id + '_tail'] = tl.done();
    const lf = grid(6, 12, pal); lf.rect(1, 0, 4, 12, 'a'); lf.rect(1, 10, 5, 2, 'b'); parts[id + '_legF'] = lf.done();
    const lb = grid(6, 12, pal); lb.rect(1, 0, 4, 12, 'b'); parts[id + '_legB'] = lb.done();
    rigs[id] = {
      w: 76, h: 40, ox: 38, oy: 39,
      parts: [
        { id: 'tail', part: id + '_tail', x: 1,  y: 17 },
        { id: 'legB', part: id + '_legB', x: 26, y: 26 },
        { id: 'body', part: id + '_body', x: 23, y: 12 },
        { id: 'legF', part: id + '_legF', x: 44, y: 26 },
        { id: 'head', part: id + '_head', x: 49, y: 8 }
      ],
      anims: stdAnims('quad')
    };
    return;
  }

  // Armored / Plated / Horned Quadrupeds (Stego, Trike, Anky)
  const bd = grid(24, 18, pal);
  if (kind === 'stego') {
    for (let px = 3; px <= 19; px += 5) bd.tri(px, 6, px + 2, 0, px + 5, 6, 'c');
  }
  bd.oval(12, 11, 11, 6, 'a');
  if (kind === 'anky') {
    bd.oval(12, 9, 11, 5, 'c');
    for (let px = 4; px <= 19; px += 4) { bd.px(px, 6, 'w'); bd.px(px + 1, 9, 'b'); }
  } else {
    bd.oval(12, 14, 8, 3, 'u');
  }
  parts[id + '_body'] = bd.done();

  const hd = grid(14, 12, pal);
  if (kind === 'trike') {
    hd.oval(4, 5, 4, 5, 'c');                   // big shield frill!
    hd.rect(4, 4, 8, 6, 'a');
    hd.line(9, 4, 13, 1, 'w', 1);               // brow horns!
    hd.line(8, 5, 12, 2, 'w', 1);
    hd.px(12, 5, 'w');                          // nose horn!
    hd.px(7, 5, 'w'); hd.px(8, 5, 'k');
  } else {
    hd.rect(2, 4, 9, 5, 'a'); hd.rect(3, 4, 7, 2, 'l');
    hd.px(7, 5, 'w'); hd.px(8, 5, 'k');
  }
  parts[id + '_head'] = hd.done();

  const tl = grid(16, 10, pal);
  tl.tri(2, 5, 15, 2, 15, 8, 'a');
  if (kind === 'stego') { tl.line(1, 2, 4, 5, 'w'); tl.line(3, 1, 6, 5, 'w'); }
  if (kind === 'anky') { tl.oval(3, 5, 3, 3, 'c'); }
  parts[id + '_tail'] = tl.done();

  const lf = grid(5, 8, pal); lf.rect(0, 0, 4, 8, 'a'); lf.rect(0, 6, 5, 2, 'b'); parts[id + '_legF'] = lf.done();
  const lb = grid(5, 8, pal); lb.rect(0, 0, 4, 8, 'b'); parts[id + '_legB'] = lb.done();

  rigs[id] = {
    w: w + 6, h: h + 4, ox: Math.round((w + 6) / 2), oy: h + 3,
    parts: [
      { id: 'tail', part: id + '_tail', x: 1,  y: h - 15 },
      { id: 'legB', part: id + '_legB', x: 16, y: h - 7 },
      { id: 'body', part: id + '_body', x: 13, y: h - 21 },
      { id: 'legF', part: id + '_legF', x: 29, y: h - 7 },
      { id: 'head', part: id + '_head', x: 33, y: h - 17 }
    ],
    anims: stdAnims('quad')
  };
}

// 3. Flyers (Microraptor, Pteranodon, Quetzalcoatlus)
function makeFlyer(id, cfg) {
  const { w, h, pal, giant, feathered } = cfg;
  const bw = Math.max(8, Math.round(w * 0.36)), bh = Math.max(5, Math.round(h * 0.36));
  const bd = grid(bw, bh, pal);
  bd.oval(Math.round(bw / 2), Math.round(bh / 2), Math.round(bw * 0.42), Math.round(bh * 0.38), 'a');
  parts[id + '_body'] = bd.done();

  const hw = Math.max(8, Math.round(w * (giant ? 0.48 : 0.40))), hh = Math.max(5, Math.round(h * 0.34));
  const hd = grid(hw, hh, pal);
  if (!feathered) {
    hd.tri(0, 0, Math.round(hw * 0.45), 2, Math.round(hw * 0.35), hh - 1, 'c'); // cranial crest
    hd.tri(Math.round(hw * 0.3), 2, hw - 1, Math.round(hh * 0.55), Math.round(hw * 0.3), hh - 1, 'l'); // long pointed beak
  } else {
    hd.oval(Math.round(hw * 0.5), Math.round(hh * 0.5), Math.round(hw * 0.4), Math.round(hh * 0.4), 'a');
  }
  hd.px(Math.round(hw * 0.42), Math.round(hh * 0.4), 'w');
  hd.px(Math.round(hw * 0.42) + 1, Math.round(hh * 0.4), 'k');
  parts[id + '_head'] = hd.done();

  const ww = Math.max(9, Math.round(w * 0.48)), wh = Math.max(6, Math.round(h * 0.55));
  const wg = grid(ww, wh, pal);
  wg.tri(0, wh - 2, Math.round(ww * 0.4), 0, ww - 1, wh - 2, 'c');
  wg.line(Math.round(ww * 0.4), 0, ww - 1, wh - 2, 'l');
  parts[id + '_wing'] = wg.done();

  const tl = grid(Math.max(5, Math.round(w * 0.28)), 5, pal);
  tl.rect(0, 2, tl ? Math.max(4, Math.round(w * 0.25)) : 5, 2, feathered ? 'c' : 'b');
  parts[id + '_tail'] = tl.done();

  const bx = Math.round(w * 0.24), by = Math.round(h * 0.45);
  rigs[id] = {
    w: w + 6, h: h + 6, ox: Math.round((w + 6) / 2), oy: Math.round((h + 6) * 0.7),
    parts: [
      { id: 'tail', part: id + '_tail', x: 1, y: by + 1 },
      { id: 'body', part: id + '_body', x: bx, y: by },
      { id: 'wing', part: id + '_wing', x: bx - 1, y: Math.max(0, by - wh + 3) },
      { id: 'head', part: id + '_head', x: bx + bw - 2, y: Math.max(1, by - 2) }
    ],
    anims: stdAnims('flyer')
  };
}

// 4. Swimmers (Plesiosaurus, Mosasaurus)
function makeSwimmer(id, cfg) {
  const { w, h, pal, longNeck } = cfg;
  if (longNeck) {
    // Plesiosaurus
    const bd = grid(20, 12, pal); bd.oval(10, 6, 9, 5, 'a'); bd.oval(10, 8, 7, 3, 'u'); parts[id + '_body'] = bd.done();
    const hd = grid(16, 15, pal); hd.line(0, 13, 9, 3, 'a', 3); hd.rect(8, 1, 7, 4, 'a'); hd.px(12, 2, 'w'); hd.px(13, 2, 'k'); parts[id + '_head'] = hd.done();
    const jw = grid(7, 3, pal); jw.rect(0, 1, 6, 2, 'b'); parts[id + '_jaw'] = jw.done();
    const ff = grid(8, 6, pal); ff.tri(2, 0, 7, 5, 0, 4, 'b'); parts[id + '_finF'] = ff.done();
    const fb = grid(7, 5, pal); fb.tri(2, 0, 6, 4, 0, 3, 'b'); parts[id + '_finB'] = fb.done();
    const tl = grid(9, 6, pal); tl.tri(0, 3, 8, 1, 8, 5, 'a'); parts[id + '_tail'] = tl.done();
    rigs[id] = {
      w: 44, h: 26, ox: 22, oy: 22,
      parts: [
        { id: 'tail', part: id + '_tail', x: 1,  y: 12 },
        { id: 'finB', part: id + '_finB', x: 10, y: 18 },
        { id: 'body', part: id + '_body', x: 8,  y: 10 },
        { id: 'finF', part: id + '_finF', x: 20, y: 18 },
        { id: 'jaw',  part: id + '_jaw',  x: 33, y: 6 },
        { id: 'head', part: id + '_head', x: 25, y: 1 }
      ],
      anims: stdAnims('swimmer')
    };
  } else {
    // Mosasaurus: colossal deep-sea apex jaws & fluke tail!
    const bd = grid(30, 16, pal); bd.oval(15, 8, 14, 7, 'a'); bd.oval(15, 11, 11, 4, 'u');
    for (let x = 4; x < 26; x += 4) bd.px(x, 1, 'c');
    parts[id + '_body'] = bd.done();
    const hd = grid(22, 10, pal);
    hd.tri(0, 1, 21, 4, 0, 8, 'a'); hd.line(2, 2, 18, 4, 'l');
    hd.rect(5, 2, 3, 2, 'w'); hd.px(7, 2, 'k');
    for (let x = 7; x < 20; x += 3) hd.px(x, 8, 'w');
    parts[id + '_head'] = hd.done();
    const jw = grid(19, 6, pal);
    jw.tri(0, 1, 18, 2, 0, 5, 'b');
    for (let x = 5; x < 17; x += 3) jw.px(x, 0, 'w');
    parts[id + '_jaw'] = jw.done();
    const ff = grid(10, 7, pal); ff.tri(2, 0, 9, 6, 0, 5, 'b'); parts[id + '_finF'] = ff.done();
    const fb = grid(8, 6, pal);  fb.tri(2, 0, 7, 5, 0, 4, 'b'); parts[id + '_finB'] = fb.done();
    const tl = grid(22, 14, pal); tl.tri(0, 2, 21, 5, 10, 7, 'c'); tl.tri(0, 12, 21, 9, 10, 7, 'a'); parts[id + '_tail'] = tl.done();
    rigs[id] = {
      w: 74, h: 30, ox: 37, oy: 24,
      parts: [
        { id: 'tail', part: id + '_tail', x: 1,  y: 7 },
        { id: 'finB', part: id + '_finB', x: 22, y: 19 },
        { id: 'body', part: id + '_body', x: 20, y: 7 },
        { id: 'finF', part: id + '_finF', x: 39, y: 19 },
        { id: 'jaw',  part: id + '_jaw',  x: 50, y: 14 },
        { id: 'head', part: id + '_head', x: 48, y: 6 }
      ],
      anims: stdAnims('swimmer')
    };
  }
}

// Instantiate all 24 creatures with distinct silhouettes & palettes!
makeBiped('compsognathus', { w: 14, h: 11, pal: { a: '#589c3c', l: '#82c858', b: '#366824', u: '#b8dc82', w: '#ffffff', k: '#111118' }, tinyArms: false });
makeBiped('velociraptor',  { w: 22, h: 16, pal: { a: '#b8682c', l: '#dc8c46', b: '#7a3e18', u: '#e2ba82', c: '#5c2814', w: '#ffffff', k: '#111118' }, feathers: true });
makeBiped('dilophosaurus', { w: 24, h: 17, pal: { a: '#388c6e', l: '#5cc098', b: '#205844', u: '#a2dec0', c: '#e8523c', w: '#ffffff', k: '#111118' }, crest: 'twin' });
makeBiped('baryonyx',      { w: 32, h: 22, pal: { a: '#3c6e78', l: '#5e9aa6', b: '#24464e', u: '#9ec4c8', w: '#ffffff', k: '#111118' }, longSnout: true });
makeBiped('carnotaurus',   { w: 38, h: 27, pal: { a: '#a8382c', l: '#d25844', b: '#6c1e18', u: '#d89c82', c: '#e8d8b8', w: '#ffffff', k: '#111118' }, horns: true, tinyArms: true });
makeBiped('allosaurus',    { w: 44, h: 30, pal: { a: '#5c6474', l: '#828ea2', b: '#383e4a', u: '#b2bac6', c: '#d44838', w: '#ffffff', k: '#111118' }, horns: true });
makeBiped('tyrannosaurus', { w: 52, h: 36, pal: { a: '#4a2828', l: '#743c38', b: '#2c1618', u: '#98685c', c: '#d8382c', w: '#ffffff', k: '#111118' }, horns: true, tinyArms: true });
makeBiped('giganotosaurus',{ w: 56, h: 38, pal: { a: '#3e5438', l: '#628056', b: '#263622', u: '#9cb088', c: '#c86828', w: '#ffffff', k: '#111118' }, crest: 'twin', tinyArms: true });
makeBiped('spinosaurus',   { w: 56, h: 40, pal: { a: '#7a5838', l: '#a2784e', b: '#4e3620', u: '#ccb28c', c: '#d44c32', w: '#ffffff', k: '#111118' }, sail: true, longSnout: true });

makeBiped('dryosaurus',         { w: 20, h: 14, pal: { a: '#68a446', l: '#8ecc62', b: '#426e2a', u: '#cce49c', c: '#426e2a', w: '#ffffff', k: '#111118' }, beak: true });
makeBiped('gallimimus',         { w: 26, h: 20, pal: { a: '#d4963c', l: '#f0b858', b: '#946222', u: '#f4dca2', c: '#946222', w: '#ffffff', k: '#111118' }, beak: true, tinyArms: false });
makeBiped('pachycephalosaurus', { w: 26, h: 19, pal: { a: '#7c6452', l: '#a28670', b: '#524034', u: '#ccb8a4', c: '#e4cfb4', w: '#ffffff', k: '#111118' }, dome: true, beak: true });
makeBiped('iguanodon',          { w: 32, h: 22, pal: { a: '#54845c', l: '#78ae80', b: '#34583c', u: '#b2d4b4', c: '#34583c', w: '#ffffff', k: '#111118' }, beak: true, thumbSpike: true });
makeBiped('parasaurolophus',    { w: 34, h: 24, pal: { a: '#468c84', l: '#6cb8ae', b: '#2a5c56', u: '#aee0d6', c: '#e89038', w: '#ffffff', k: '#111118' }, crest: 'tube', beak: true });

makeQuad('ankylosaurus',   { w: 46, h: 24, pal: { a: '#6e6456', l: '#928674', b: '#463e34', u: '#b4a894', c: '#8c5c38', w: '#e8dec8', k: '#111118' }, kind: 'anky' });
makeQuad('stegosaurus',    { w: 46, h: 28, pal: { a: '#527c44', l: '#76a462', b: '#34522a', u: '#aec898', c: '#d86432', w: '#f4eedc', k: '#111118' }, kind: 'stego' });
makeQuad('triceratops',    { w: 46, h: 28, pal: { a: '#8c6840', l: '#b48a58', b: '#5c4226', u: '#d4b88c', c: '#a84c32', w: '#f8f4e4', k: '#111118' }, kind: 'trike' });
makeQuad('diplodocus',     { w: 72, h: 38, pal: { a: '#5c7868', l: '#7ea08c', b: '#3c5044', u: '#b4cab8', c: '#c89648', w: '#ffffff', k: '#111118' }, kind: 'sauropod_long' });
makeQuad('brachiosaurus',  { w: 64, h: 58, pal: { a: '#6c7c54', l: '#90a472', b: '#465236', u: '#c0cca4', c: '#90a472', w: '#ffffff', k: '#111118' }, kind: 'sauropod_tall' });

makeFlyer('microraptor',    { w: 18, h: 14, pal: { a: '#2c4868', l: '#4c78a4', b: '#1a2c42', c: '#3898b8', w: '#ffffff', k: '#111118' }, feathered: true });
makeFlyer('pteranodon',     { w: 32, h: 18, pal: { a: '#8c4c3e', l: '#e0a858', b: '#5c2e24', c: '#c45e42', w: '#ffffff', k: '#111118' }, feathered: false });
makeFlyer('quetzalcoatlus', { w: 54, h: 34, pal: { a: '#5a4468', l: '#e29848', b: '#382844', c: '#b84848', w: '#ffffff', k: '#111118' }, giant: true, feathered: false });

makeSwimmer('plesiosaurus', { w: 38, h: 22, pal: { a: '#2e788c', l: '#54a4b8', b: '#1c4e5c', u: '#a4dce4', c: '#54a4b8', w: '#ffffff', k: '#111118' }, longNeck: true });
makeSwimmer('mosasaurus',   { w: 70, h: 28, pal: { a: '#224464', l: '#3c6c94', b: '#142a40', u: '#8cb4cc', c: '#4c88b0', w: '#f8f8f0', k: '#111118' }, longNeck: false });

// Validate equal row lengths on every part
for (const [pid, p] of Object.entries(parts)) {
  const len = p.rows[0].length;
  for (const r of p.rows) {
    if (r.length !== len) throw new Error(`Part ${pid} has unequal row lengths`);
  }
}

const sprites = { parts, rigs };

// ---------------------------------------------------------------- sound effects
// Every effect is a few simple parts that are added together. Both versions build the sound from this
// table with the same sums (src/audio.js and Audio.pde), so they sound alike.
//   tone part : w = sq | saw | tri | sin, f = [from, to] in Hz, d = seconds, v = volume, t = start in seconds
//   noise part: w = noise, lp = low-pass in Hz or [from, to], d, v, t
const tone = (w, f0, f1, d, v, t) => ({ w, f: [f0, f1], d, v, t: t || 0 });
const noise = (d, v, lp, t) => ({ w: 'noise', lp, d, v, t: t || 0 });
const sounds = {
  ui_move: [tone('sq', 520, 520, 0.04, 0.18)],
  ui_ok: [tone('sq', 660, 660, 0.05, 0.2), tone('sq', 990, 990, 0.08, 0.2, 0.05)],
  ui_back: [tone('sq', 440, 300, 0.08, 0.2)],

  jump: [tone('sq', 240, 500, 0.12, 0.2)],
  bite: [tone('sq', 190, 70, 0.08, 0.28), noise(0.06, 0.28, 2600, 0.02)],
  pickup: [tone('sq', 660, 660, 0.05, 0.2), tone('sq', 880, 880, 0.08, 0.2, 0.05)],
  drop: [tone('tri', 420, 220, 0.1, 0.25)],
  phit: [tone('saw', 320, 70, 0.22, 0.32), noise(0.14, 0.25, 1400)],
  pdown: [tone('sq', 300, 45, 0.55, 0.3)],
  respawn: [tone('tri', 330, 660, 0.18, 0.25), tone('tri', 660, 990, 0.14, 0.2, 0.12)],

  hit: [noise(0.1, 0.4, 1000), tone('sq', 130, 60, 0.09, 0.25)],
  clang: [tone('tri', 900, 700, 0.07, 0.3), tone('sq', 1500, 1300, 0.04, 0.12)],
  interrupt: [tone('sq', 500, 900, 0.07, 0.22), noise(0.05, 0.2, 3000)],
  kill: [tone('sq', 220, 50, 0.28, 0.3), noise(0.2, 0.3, 800, 0.03)],

  tele: [tone('sq', 880, 980, 0.07, 0.14)],
  slash: [noise(0.12, 0.32, [4000, 900]), tone('saw', 300, 140, 0.1, 0.18)],
  sweep: [noise(0.28, 0.35, [2500, 400])],
  stomp: [tone('sin', 110, 38, 0.3, 0.55), noise(0.18, 0.3, 400)],
  roar: [tone('saw', 150, 55, 0.85, 0.36), tone('sq', 110, 45, 0.85, 0.18), noise(0.75, 0.3, 600)],
  rage: [tone('saw', 110, 190, 0.5, 0.34), noise(0.5, 0.28, 900), tone('saw', 190, 60, 0.5, 0.3, 0.45)],
  spit: [tone('sin', 620, 200, 0.12, 0.3)],
  splash: [noise(0.22, 0.3, [2400, 700])],
  skid: [noise(0.35, 0.3, [1800, 500])],
  call: [tone('saw', 700, 420, 0.12, 0.26), tone('saw', 660, 360, 0.12, 0.26, 0.14)],
  rustle: [noise(0.12, 0.16, 5000)],
  steal: [tone('sq', 520, 260, 0.1, 0.25), tone('sq', 390, 200, 0.14, 0.25, 0.1)],

  babyhit: [tone('sq', 880, 440, 0.12, 0.3), tone('sq', 880, 440, 0.12, 0.3, 0.15)],
  feed: [tone('sq', 520, 520, 0.06, 0.2), tone('sq', 620, 620, 0.08, 0.2, 0.06)],
  meal: [tone('sq', 523, 523, 0.08, 0.24), tone('sq', 659, 659, 0.08, 0.24, 0.08), tone('sq', 784, 784, 0.14, 0.24, 0.16)],
  hatch: [noise(0.1, 0.35, 3000), tone('tri', 500, 1000, 0.3, 0.3, 0.08), tone('tri', 750, 1500, 0.3, 0.22, 0.2)],

  raid: [tone('sq', 660, 520, 0.14, 0.28), tone('sq', 660, 520, 0.14, 0.28, 0.17), tone('sq', 660, 520, 0.14, 0.28, 0.34)],
  bosswarn: [tone('saw', 80, 60, 0.7, 0.34), tone('sq', 220, 165, 0.3, 0.22), tone('sq', 220, 165, 0.3, 0.22, 0.35)],
  bossin: [tone('saw', 140, 50, 0.9, 0.4), tone('sq', 98, 49, 0.9, 0.2), noise(0.8, 0.32, 500)],
  bossdown: [tone('sq', 392, 392, 0.1, 0.24), tone('sq', 523, 523, 0.1, 0.24, 0.1), tone('sq', 659, 659, 0.1, 0.24, 0.2), tone('sq', 784, 784, 0.34, 0.26, 0.3),
    tone('tri', 196, 196, 0.3, 0.2), tone('tri', 392, 392, 0.34, 0.2, 0.3)],
  gameover: [tone('sq', 392, 370, 0.25, 0.26), tone('sq', 330, 311, 0.25, 0.26, 0.25), tone('sq', 262, 247, 0.25, 0.26, 0.5), tone('sq', 196, 98, 0.6, 0.28, 0.75)],
  rumble: [noise(1.2, 0.4, 300), tone('sin', 60, 40, 1.2, 0.4)],
  boom: [noise(1.4, 0.5, [1800, 150]), tone('sin', 90, 28, 1.2, 0.45), tone('saw', 120, 30, 0.8, 0.22)]
};
// Which sound a game event plays. range: how far away (in px) it can be heard; without a range it is heard
// everywhere. min: the least volume, for things at the nest that matter wherever you are.
const near = (snd, range, min) => ({ snd, range: range || 520, min: min || 0 });
const events = {
  jump: near('jump', 360), bite: near('bite'), pickup: near('pickup', 360), drop: near('drop', 360),
  phit: near('phit'), pdown: near('pdown', 700), respawn: near('respawn', 700),
  hit: near('hit'), clang: near('clang'), interrupt: near('interrupt'), kill: near('kill', 600),
  tele: near('tele', 300), slash: near('slash'), sweep: near('sweep'), stomp: near('stomp', 700), roar: near('roar', 900), rage: near('rage', 900),
  spit: near('spit'), splash: near('splash'), skid: near('skid'), call: near('call', 700), rustle: near('rustle', 300),
  steal: near('steal', 520, 0.3), babyhit: near('babyhit', 520, 0.45), feed: near('feed', 520, 0.25), meal: near('meal', 520, 0.4),
  hatch: { snd: 'hatch' }, raid: { snd: 'raid' }, bosswarn: { snd: 'bosswarn' }, bossin: { snd: 'bossin' }, bossdown: { snd: 'bossdown' },
  gameover: { snd: 'gameover' }, volcano_start: { snd: 'rumble' }, meteor_start: { snd: 'rumble' }, volcano_boom: { snd: 'boom' }, meteor_hit: { snd: 'boom' }
};
const sfx = { rate: 22050, sounds, events };

// The Processing port is updated in a later step. Until then its data folder is left alone, so the old
// Windows version keeps working with the data it was built for.
const WRITE_TO_PROCESSING = true;
for (const dir of WRITE_TO_PROCESSING ? [DATA_DIR, PDE_DATA_DIR] : [DATA_DIR]) {
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'biomes.json'), JSON.stringify(biomes, null, 2));
  fs.writeFileSync(path.join(dir, 'dinos.json'), JSON.stringify(dinos, null, 2));
  fs.writeFileSync(path.join(dir, 'rexes.json'), JSON.stringify(rexes, null, 2));
  fs.writeFileSync(path.join(dir, 'sprites.json'), JSON.stringify(sprites));
  fs.writeFileSync(path.join(dir, 'sfx.json'), JSON.stringify(sfx));
}

console.log(`Generated ${Object.keys(biomes.zones).length} biomes, ${Object.keys(dinos).length} creatures, ${Object.keys(parts).length} sprite parts, ${Object.keys(rigs).length} rigs.`);
