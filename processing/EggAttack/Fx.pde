// Visual effects: dust, bite arcs, sparks, splashes, rings for roars and calls, and the two endings.
// A port of src/fx.js. Effects use Math.random(): they are only for show and never touch the game rules.

class FxPart {
  double x, y, vx, vy, grav;
  String col;
  int sz, life;
}

class FxRing {
  double x, y, r, maxR;
  String col;
  FxRing(double x, double y, double r, double maxR, String col) { this.x = x; this.y = y; this.r = r; this.maxR = maxR; this.col = col; }
}

class FxArc {
  double x, y;
  int dir, life;
  String col;
  FxArc(double x, double y, int dir, int life, String col) { this.x = x; this.y = y; this.dir = dir; this.life = life; this.col = col; }
}

ArrayList<FxPart> fxParts = new ArrayList<FxPart>();
ArrayList<FxRing> fxRings = new ArrayList<FxRing>();
ArrayList<FxArc> fxArcs = new ArrayList<FxArc>();
int fxLastSeenEv = 0;

void fxReset() {
  fxParts = new ArrayList<FxPart>(); fxRings = new ArrayList<FxRing>(); fxArcs = new ArrayList<FxArc>(); fxLastSeenEv = 0;
}

void fxBurst(double x, double y, int count, String[] cols, double vxRange, double vyMin, double vyMax, int life) {
  for (int i = 0; i < count; i++) {
    if (fxParts.size() > 260) fxParts.remove(0);
    FxPart p = new FxPart();
    p.x = x + (Math.random() - 0.5d) * 8; p.y = y + (Math.random() - 0.5d) * 6;
    p.vx = (Math.random() - 0.5d) * vxRange; p.vy = vyMin + Math.random() * (vyMax - vyMin);
    p.col = cols[(int) (Math.random() * cols.length)]; p.sz = Math.random() < 0.35d ? 3 : 2;
    p.life = life + (int) (Math.random() * 14); p.grav = 0.14d;
    fxParts.add(p);
  }
}

String[] cols(String... c) { return c; }

// Turns new game events into effects. e.v carries a direction or a tier for some events.
void fxSyncEvents(GameState S) {
  if (S == null || S.evs == null) return;
  if (S.evN < fxLastSeenEv) fxLastSeenEv = 0;
  for (int i = 0; i < S.evs.size(); i++) {
    Ev e = S.evs.get(i);
    if (e.n <= fxLastSeenEv) continue;
    fxLastSeenEv = e.n;
    double x = e.x, y = e.y != 0 ? e.y : 210;
    String s = e.s;
    int v = e.hasV && e.v != 0 ? e.v : 1;
    if (eq(s, "bite")) { fxBurst(x, y, 5, cols("#fff8c0", "#f8d040"), 2.4d, -1.6d, 0.8d, 10); fxArcs.add(new FxArc(x, y, v, 8, "#fff8c0")); }
    else if (eq(s, "slash")) fxArcs.add(new FxArc(x, y, v, 10, "#ff6a4a"));
    else if (eq(s, "sweep")) { fxRings.add(new FxRing(x, y, 6, 60, "#ff6a4a")); fxBurst(x, y + 6, 12, cols("#e0cca8", "#b89868"), 5, -1.8d, 0, 16); }
    else if (eq(s, "hit") || eq(s, "phit")) fxBurst(x, y, 9, cols("#ff5242", "#f8d040", "#ffffff"), 3.2d, -2.6d, 0.4d, 16);
    else if (eq(s, "kill")) fxBurst(x, y, 16, cols("#ff4838", "#d83028", "#f8b040"), 4.0d, -3.4d, -0.4d, 24);
    else if (eq(s, "clang")) fxBurst(x, y, 6, cols("#e0e8ff", "#a8b8d8"), 2.8d, -2.2d, 0.2d, 12);
    else if (eq(s, "interrupt")) fxBurst(x, y, 8, cols("#ffffff", "#ffe858"), 3.4d, -2.6d, -0.2d, 14);
    else if (eq(s, "feed") || eq(s, "hatch")) fxBurst(x, y, 12, cols("#68e868", "#f8e050", "#ffffff"), 3.0d, -3.2d, -0.5d, 22);
    else if (eq(s, "meal")) { fxBurst(x, y, 20, cols("#48d8f0", "#68e868", "#ffffff"), 3.6d, -3.6d, -0.6d, 28); fxRings.add(new FxRing(x, y, 4, 36, "#48d8f0")); }
    else if (eq(s, "steal")) fxBurst(x, y, 10, cols("#f4b438", "#ffffff"), 3.0d, -3.4d, -1.0d, 20);
    else if (eq(s, "splash")) fxBurst(x, y, 14, cols("#88e8ff", "#48b8e8", "#ffffff"), 3.4d, -3.6d, -0.8d, 22);
    else if (eq(s, "spit")) fxBurst(x, y, 6, cols("#68f038", "#c8ff80"), 2.0d, -1.5d, 0.5d, 14);
    else if (eq(s, "skid")) fxBurst(x, y, 18, cols("#e0cca8", "#b89868", "#8c6e46"), 5.5d, -2.0d, 0, 22);
    else if (eq(s, "stomp")) { fxBurst(x, y, 14, cols("#b89868", "#8c6e46", "#e0cca8"), 4.4d, -2.4d, -0.2d, 20); fxRings.add(new FxRing(x, y - 4, 4, 46, "#e0cca8")); }
    else if (eq(s, "roar") || eq(s, "rage")) fxRings.add(new FxRing(x, y, 6, 95, "#ff5840"));
    else if (eq(s, "call")) fxRings.add(new FxRing(x, y, 5, 75, "#58e8d8"));
    else if (eq(s, "babyhit")) fxBurst(x, y, 10, cols("#ff3838", "#ffa040"), 3.0d, -2.8d, 0.2d, 18);
    else if (eq(s, "bossdown")) { fxBurst(x, y, 40, cols("#ffe858", "#ffffff", "#68e868", "#48d8f0"), 7, -4.5d, -1, 40); fxRings.add(new FxRing(x, y, 8, 120, "#ffe858")); }
  }
}

void fxTick(GameState S) {
  fxSyncEvents(S);
  for (int i = fxParts.size() - 1; i >= 0; i--) {
    FxPart p = fxParts.get(i);
    p.x += p.vx; p.y += p.vy; p.vy += p.grav;
    if (--p.life <= 0) fxParts.remove(i);
  }
  for (int i = fxRings.size() - 1; i >= 0; i--) {
    fxRings.get(i).r += 3.2d;
    if (fxRings.get(i).r >= fxRings.get(i).maxR) fxRings.remove(i);
  }
  for (int i = fxArcs.size() - 1; i >= 0; i--) if (--fxArcs.get(i).life <= 0) fxArcs.remove(i);

  if (S != null && eq(S.mode, "finale")) {
    if (eq(S.ending, "volcano")) {
      String[] c = { "#ffec60", "#ff7820", "#e02818", "#483838" };
      for (int i = 0; i < 4; i++) {
        FxPart p = new FxPart();
        p.x = (Math.random() - 0.5d) * 60; p.y = 95 + Math.random() * 14;
        p.vx = (Math.random() - 0.5d) * 4.8d; p.vy = -3.2d - Math.random() * 3.4d;
        p.col = c[(int) (Math.random() * 4)];
        p.sz = Math.random() < 0.4d ? 4 : 2; p.life = 48; p.grav = 0.11d;
        fxParts.add(p);
      }
    } else if (eq(S.ending, "meteor") && S.finaleT >= 118 && S.finaleT <= 145) {
      String[] c = { "#ffffff", "#ffea68", "#ff6420", "#7a4430" };
      for (int i = 0; i < 10; i++) {
        FxPart p = new FxPart();
        p.x = 60 + (Math.random() - 0.5d) * 50; p.y = 165 + (Math.random() - 0.5d) * 20;
        p.vx = (Math.random() - 0.5d) * 7.5d; p.vy = -4.8d - Math.random() * 3.5d;
        p.col = c[(int) (Math.random() * 4)];
        p.sz = Math.random() < 0.5d ? 4 : 3; p.life = 55; p.grav = 0.12d;
        fxParts.add(p);
      }
    }
  }
}

void fxDrawWorld(double camX, int vw) {
  int half = vw >> 1;
  for (int i = 0; i < fxRings.size(); i++) {
    FxRing r = fxRings.get(i);
    int sx = (int) Math.round(r.x - camX + half), sy = (int) Math.round(r.y);
    if (sx < -130 || sx > vw + 130) continue;
    strokeRect2((int) Math.round(sx - r.r), (int) Math.round(sy - r.r * 0.45d), (int) Math.round(r.r * 2), (int) Math.round(r.r * 0.9d), r.col);
  }
  // Bite arcs: a small pixel crescent that opens towards the bite direction.
  for (int i = 0; i < fxArcs.size(); i++) {
    FxArc a = fxArcs.get(i);
    int sx = (int) Math.round(a.x - camX + half), sy = (int) Math.round(a.y);
    if (sx < -20 || sx > vw + 20) continue;
    int grow = 10 - a.life, d = a.dir != 0 ? a.dir : 1;
    ctx.setColor(awtCol(a.col));
    for (int k = -3; k <= 3; k++) {
      int bend = 4 - Math.abs(k);
      ctx.fillRect(sx + d * (bend + grow), sy + k * 3, 2, 3);
    }
  }
  for (int i = 0; i < fxParts.size(); i++) {
    FxPart p = fxParts.get(i);
    int sx = (int) Math.round(p.x - camX + half), sy = (int) Math.round(p.y);
    if (sx < -8 || sx > vw + 8) continue;
    ctx.setColor(awtCol(p.col));
    ctx.fillRect(sx, sy, p.sz, p.sz);
  }
}

// Things drawn on the sky during the endings: the meteor and its flash, or the glow of the volcano.
void fxDrawFinaleSky(GameState S, int vw, int vh) {
  if (S == null || !eq(S.mode, "finale")) return;
  int t = S.finaleT;
  if (eq(S.ending, "meteor")) {
    fillRgba(0, 0, vw, vh, 36, 8, 24, Math.min(0.55d, t * 0.005d));
    if (t < 122) {
      double p = t / 120.0d;
      int mx = (int) Math.round(430 - p * 175), my = (int) Math.round(-24 + p * 192);
      for (int k = 8; k >= 1; k--) {
        ctx.setColor(awtCol(k > 5 ? "#7c2020" : k > 2 ? "#ff6a18" : "#ffe858"));
        int sz = Math.max(4, 24 - k * 2);
        ctx.fillRect(mx + k * 9 - (sz >> 1), my - k * 9 - (sz >> 1), sz, sz);
      }
      ctx.setColor(awtCol("#4a2820")); ctx.fillRect(mx - 13, my - 13, 26, 26);
      ctx.setColor(awtCol("#ff7820")); ctx.fillRect(mx - 10, my - 10, 20, 20);
      ctx.setColor(awtCol("#fff6b0")); ctx.fillRect(mx - 6, my - 6, 12, 12);
    } else {
      double r = Math.min(340, (t - 120) * 5);
      // the shock wave: a low dome of fire spreading along the ground from where the meteor hit
      for (int k = 0; k < 5; k++) {
        double half = r * (1 - k * 0.19d), hh = Math.max(2, r * 0.07d);
        fillRgba((int) Math.round(255 - half), (int) Math.round(216 - (k + 1) * hh), (int) Math.round(half * 2), (int) Math.ceil(hh), 255, 120 + k * 26, 32, fixed2(0.30d + k * 0.08d));
      }
      if (t < 146) fillRgba(0, 0, vw, vh, 255, 248, 220, fixed2(Math.max(0, 1 - (t - 120) / 26.0d)));
    }
  } else if (eq(S.ending, "volcano")) {
    fillRgba(0, 0, vw, vh, 255, 84, 16, fixed2(0.12d + 0.08d * Math.sin(t * 0.2d)));
    if (t >= 118 && t < 138) fillRgba(0, 0, vw, vh, 255, 220, 140, fixed2(Math.max(0, 0.75d - (t - 118) / 25.0d)));
  }
}

// like toFixed(2) in the web version: the alpha is rounded to two decimals
double fixed2(double a) { return Math.round(a * 100.0d) / 100.0d; }
