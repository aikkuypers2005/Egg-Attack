// Checks and screenshots that run without a window (see settings() in EggAttack.pde):
//   test              prints PASS / FAIL lines and ends with exit code 1 when something failed
//   shots <folder>    saves screenshots of the menus and of game scenes as PNG files
//   sheets <folder>   saves the 9 sprite review pages and the page of the small font
// And one that does open the real window and plays by itself, to check the window, the keys and F11:
//   autoplay <folder> presses keys from a script, saves what the window shows, writes autoplay_log.txt and closes
//
// The rule checks are a selection of test/smoke.js of the web version, with the same names and the same
// details in brackets, so the lines can be compared with what Node prints.

import java.math.BigDecimal;
import java.math.RoundingMode;

int failed = 0;

void check(String name, boolean ok, String extra) {
  println((ok ? "PASS  " : "FAIL  ") + name + (extra != null && !extra.isEmpty() ? "  (" + extra + ")" : ""));
  if (!ok) failed++;
}
void check(String name, boolean ok) { check(name, ok, ""); }

boolean isHeadlessMode(String a) { return eq(a, "test") || eq(a, "shots") || eq(a, "sheets"); }

void runHeadless(String[] a) {
  int code = 0;
  try {
    initText();
    loadData();
    if (eq(a[0], "test")) { runTests(); code = failed > 0 ? 1 : 0; }
    else if (a.length < 2) { println("FAIL  " + a[0] + " needs a folder: " + a[0] + " <folder>"); code = 1; }
    else if (eq(a[0], "shots")) runShots(new File(a[1]));
    else runSheets(new File(a[1]));
  } catch (Throwable e) {
    e.printStackTrace();
    println("FAIL  stopped by an error: " + e);
    code = 1;
  }
  System.out.flush();
  System.err.flush();
  System.exit(code);
}

// ---------------------------------------------------------------- printing numbers the way JavaScript does
String fixed(double v, int digits) { return new BigDecimal(v).setScale(digits, RoundingMode.HALF_UP).toPlainString(); }
String num(double v) { return v == Math.rint(v) && Math.abs(v) < 1e15d ? String.valueOf((long) v) : String.valueOf(v); }
String joinStr(ArrayList<String> a, String sep) { StringBuilder b = new StringBuilder(); for (int i = 0; i < a.size(); i++) { if (i > 0) b.append(sep); b.append(a.get(i)); } return b.toString(); }

// ---------------------------------------------------------------- the fingerprints of tools/fingerprint.js
// These four lines are what `node tools/fingerprint.js` prints for the web version (copied from its output).
// The port has to print exactly the same. If a line differs, the mistake is in Sim.pde, not here.
final String[] FP_EXPECTED = {
  "FP humans=1 seed=13374201 steps=6000 -> mode=play tick=6000 rng=1722069893 types=brick,dash baby=100000/99920/1/0/7000 players=-54700/235000 dinos=19/7305500/1401000 foods=10 kills=8 bosses=1 boss=-1",
  "FP humans=2 seed=777 steps=6000 -> mode=play tick=6000 rng=-1323810590 types=mender,chomp baby=90000/100000/0/0/14000 players=-2500/111460 dinos=20/6251800/12277000 foods=9 kills=5 bosses=0 boss=876",
  "FP humans=5 seed=4242 steps=6000 -> mode=play tick=6000 rng=-1280426758 types=reach,mule,brick,hop,chomp baby=100000/100000/0/0/7000 players=709100/443600 dinos=28/3441400/13869000 foods=9 kills=6 bosses=0 boss=1830",
  "FP humans=8 seed=99 steps=7000 -> mode=play tick=7000 rng=1671635366 types=mender,rex,hop,mule,reach,chomp,brick,dash baby=100000/100000/0/0/0 players=3022800/735100 dinos=44/6441700/15144000 foods=9 kills=10 bosses=0 boss=1913"
};
final int[][] FP_CASES = { { 1, 13374201, 6000 }, { 2, 777, 6000 }, { 5, 4242, 6000 }, { 8, 99, 7000 } };

// The input of T-rex i at step f. Only whole-number maths, so it is the same in every language.
Inp fpInput(int f, int i) {
  int ph = f / 45 + i * 2;
  return new Inp(ph % 4 == 0 ? 1 : ph % 4 == 2 ? -1 : 0, f % 97 == i, f % 23 < 2, f % 61 == 0);
}

long thousandths(double v) { return Math.round(v * 1000.0d); }     // numbers are printed as whole thousandths

String fingerprint(int humans, int seed, int steps) {
  GameState S = newGame(humans, seed);
  S.baby.eggT = 3000;                    // the first boss wave comes after 10 seconds, so the run includes a boss fight
  for (int f = 0; f < steps; f++) {
    Inp[] in = new Inp[S.players.size()];
    for (int i = 0; i < in.length; i++) in[i] = fpInput(f, i);
    step(S, in);
  }
  long px = 0, php = 0, dx = 0, dhp = 0;
  StringBuilder types = new StringBuilder();
  for (int i = 0; i < S.players.size(); i++) {
    Player p = S.players.get(i);
    px += thousandths(p.x) * (i + 1); php += thousandths(p.hp);
    if (i > 0) types.append(',');
    types.append(p.type);
  }
  for (Dino d : S.dinos) { dx += thousandths(d.x); dhp += thousandths(d.hp); }
  Baby b = S.baby;
  return "FP humans=" + humans + " seed=" + seed + " steps=" + steps + " -> mode=" + S.mode + " tick=" + S.tick + " rng=" + S.seed +
    " types=" + types +
    " baby=" + thousandths(b.hp) + "/" + thousandths(b.hunger) + "/" + b.stage + "/" + b.meals + "/" + thousandths(b.totalDamage) +
    " players=" + px + "/" + php + " dinos=" + S.dinos.size() + "/" + dx + "/" + dhp +
    " foods=" + S.foods.size() + " kills=" + S.stats.kills + " bosses=" + S.stats.bosses + " boss=" + (S.boss != null ? num(S.boss.hp) : "-1");
}

// ---------------------------------------------------------------- helpers of test/smoke.js
final Inp NONE = new Inp();

// A game with no wildlife, no raids and nothing spawning, for testing one thing at a time.
GameState empty(int players, int seed) {
  GameState S = newGame(players, seed);
  S.dinos = new ArrayList<Dino>();
  S.raidCd = 1000000000;
  for (int i = 0; i < S.zcd.length; i++) S.zcd[i] = 1000000000;
  return S;
}
GameState empty() { return empty(2, 1); }

Dino put(GameState S, String kind, double x, Opts o) {
  if (o == null) o = new Opts();
  o.force = true;
  Dino d = spawnDino(S, kind, x, o);
  d.cd = 0;
  return d;
}
Dino put(GameState S, String kind, double x) { return put(S, kind, x, null); }

Carry meat(int tier) { return new Carry(tier, 30, tier >= 4 ? 2 : tier >= 1 ? 1 : 0, 2000); }

Inp[] none(int n) { Inp[] a = new Inp[n]; for (int i = 0; i < n; i++) a[i] = NONE; return a; }
Inp mxIn(int mx) { return new Inp(mx, false, false, false); }
Inp jumpIn(boolean j) { return new Inp(0, j, false, false); }
Inp biteIn(boolean b) { return new Inp(0, false, b, false); }
int countKind(GameState S, String kind) { int n = 0; for (Dino d : S.dinos) if (eq(d.kind, kind)) n++; return n; }

// One T-rex next to one creature, far from the nest. act gives the input for that step (null: none).
interface Act { Inp act(int i, GameState S, Player p, Dino d); }

class Duel {
  int firstHit = 0, hits = 0;
  ArrayList<String> states = new ArrayList<String>();
  GameState S;
  Player p;
  Dino d;
  int count(String s) { int n = 0; for (String x : states) if (eq(x, s)) n++; return n; }
  int indexOf(String s, int from) { for (int i = Math.max(0, from); i < states.size(); i++) if (eq(states.get(i), s)) return i; return -1; }
  boolean has(String s, int upTo) { for (int i = 0; i < Math.min(upTo, states.size()); i++) if (eq(states.get(i), s)) return true; return false; }
}

Duel duel(String kind, double gap, int steps, Act act) {
  Duel log = new Duel();
  GameState S = empty(2, 5);
  Player p = S.players.get(0);
  p.x = -3600; p.face = 1; S.players.get(1).x = 3000;
  Dino d = put(S, kind, p.x + gap);
  log.S = S; log.p = p; log.d = d;
  for (int i = 1; i <= steps; i++) {
    double hp = p.hp;
    Inp in = act != null ? act.act(i, S, p, d) : null;
    step(S, new Inp[] { in != null ? in : NONE, NONE });
    if (p.hp < hp - 1) { log.hits++; if (log.firstHit == 0) log.firstHit = i; }
    log.states.add(d.atk);
  }
  return log;
}

// ---------------------------------------------------------------- the test players of test/bot.js
// They play the way the game is meant to be played: hunt for meat that counts as a meal, carry it home,
// come back to defend the nest, and fight the boss waves. Used for full games, for 1 to 8 players.
Inp botWalk(GameState S, Player p, double toX) {
  // Something on the way that keeps attacking gets fought, otherwise the bot would run from it forever.
  if (p.carry == null) {
    for (Dino d : S.dinos) {
      if (!d.atk.isEmpty() && d.tgt == p.id && Math.abs(d.x - p.x) < 150 && !eq(DINOS.get(d.kind).role, "hazard")) return fight(S, p, d);
    }
  }
  Danger dg = danger(S, p);
  Inp inp = new Inp(Math.abs(toX - p.x) > 6 ? (toX > p.x ? 1 : -1) : 0, dg.jump && !p.prevJump, false, false);
  if (dg.mx != 0 && p.carry == null) inp.mx = dg.mx;            // with food in its mouth it just keeps running
  return inp;
}

boolean botTaken(ArrayList<Player> others, Player p, double x) {
  for (Player o : others) if (o.carry == null && o.downT == 0 && Math.abs(o.x - x) < Math.abs(p.x - x) - 1) return true;
  return false;
}

// others: the other hunters in the team, so two of them do not walk to the same piece of meat.
// side: -1 or 1, the side of the world this hunter prefers (0 = no preference).
Inp botHunter(GameState S, Player p, ArrayList<Player> others, int side) {
  if (p.downT > 0 || p.stunT > 0) return NONE;
  Baby b = S.baby;
  if (S.boss != null) return Math.abs(p.x) > 330 && p.carry == null ? botWalk(S, p, 0) : guard(S, p);
  if (p.carry != null) return botWalk(S, p, 0);
  boolean raidNear = false;
  for (Dino d : S.dinos) if (d.raid && Math.abs(d.x) < 320) { raidNear = true; break; }
  if (b.stage == 0 || (raidNear && Math.abs(p.x) < 500)) return guard(S, p);

  int need = b.stage;
  Food food = null;
  Dino prey = null;
  double fs = 1e9d, ps = 1e9d;
  for (Food f : S.foods) {
    if (f.meal == 0 || f.tier < need || f.x > DEEP_X - 70 || botTaken(others, p, f.x)) continue;
    double s = Math.abs(f.x - p.x) + Math.abs(f.x) * 0.5d + (side != 0 && f.x * side < 0 ? 900 : 0);
    if (s < fs) { fs = s; food = f; }
  }
  for (Dino d : S.dinos) {
    DinoDef def = DINOS.get(d.kind);
    if (d.raid || d.boss || def.foodTier < need || eq(def.role, "hazard") || eq(def.habitat, "deep_water") || botTaken(others, p, d.x)) continue;
    double s = Math.abs(d.x - p.x) + Math.abs(d.x) * 0.5d + d.hp * 3 + (!eq(def.habitat, "land") ? 300 : 0) + 80 + (side != 0 && d.x * side < 0 ? 900 : 0);
    if (s < ps) { ps = s; prey = d; }
  }
  if (food != null && fs <= ps) {
    if (Math.abs(food.x - p.x) > 16) return botWalk(S, p, food.x);
    return new Inp(0, false, false, !p.prevGrab);
  }
  if (prey != null) return Math.abs(prey.x - p.x) > 150 ? botWalk(S, p, prey.x) : fight(S, p, prey);
  return guard(S, p);
}

// Inputs for every T-rex. Alone: you hunt, the computer guards. In a group: 1 guard (2 from 4 players up), the rest hunt.
Inp[] botTeam(GameState S) {
  int n = S.players.size();
  boolean solo = false;
  for (Player p : S.players) if (p.ai) solo = true;
  int guards = solo ? 0 : n >= 4 ? 2 : 1;
  ArrayList<Player> hunters = new ArrayList<Player>();
  for (int i = 0; i < n; i++) if (!S.players.get(i).ai && i >= guards) hunters.add(S.players.get(i));
  Inp[] out = new Inp[n];
  for (int i = 0; i < n; i++) {
    Player p = S.players.get(i);
    if (p.ai) { out[i] = null; continue; }
    if (i < guards) { out[i] = guard(S, p); continue; }
    ArrayList<Player> others = new ArrayList<Player>();
    for (Player o : hunters) if (o != p) others.add(o);
    out[i] = botHunter(S, p, others, hunters.size() > 1 ? (hunters.indexOf(p) % 2 != 0 ? 1 : -1) : 0);
  }
  return out;
}

class Played {
  GameState S;
  int frames = 0;
  double[] bossStart = new double[6];
  boolean[] bossStarted = new boolean[6], bossTimed = new boolean[6];
  long[] bossSecs = new long[6];
  ArrayList<Double> mealsFrom = new ArrayList<Double>();
}

// Plays one game. noInput: nobody presses anything. Otherwise the test players play.
Played botPlay(int humans, int seed, int max, boolean noInput) {
  Played log = new Played();
  GameState S = newGame(humans, seed);
  log.S = S;
  int n = S.players.size(), f = 0, started = 0;
  boolean hadBoss = false;
  while (f < max && eq(S.mode, "play")) {
    f++;
    Carry[] carry = new Carry[n];
    for (int i = 0; i < n; i++) carry[i] = S.players.get(i).carry;
    int meals = S.stats.meals;
    step(S, noInput ? none(n) : botTeam(S));
    for (int i = 0; i < n; i++) {
      Player p = S.players.get(i);
      // where the meat of every counted meal first appeared, as a distance from the nest
      if (S.stats.meals > meals && carry[i] != null && p.carry == null) log.mealsFrom.add(Math.abs(carry[i].ox));
    }
    boolean fighting = S.boss != null && S.boss.warnT == 0;
    if (fighting && !hadBoss) {
      int k = S.boss.stage + 1;
      if (!log.bossStarted[k]) { log.bossStarted[k] = true; started++; }
      log.bossStart[k] = f;
    }
    if (!fighting && hadBoss) { log.bossSecs[started] = Math.round((f - log.bossStart[started]) / 60.0d); log.bossTimed[started] = true; }
    hadBoss = fighting;
  }
  log.frames = f;
  while (eq(S.mode, "finale")) step(S, null);
  return log;
}

// ---------------------------------------------------------------- the checks
void runTests() {
  long t0 = System.currentTimeMillis();

  // -------- the port itself: rounding, the order of the JSON keys, the fingerprints
  check("rounding is JavaScript's: .5 goes up, also below zero",
    jsRound(2.5d) == 3 && jsRound(-2.5d) == -2 && jsRound(-0.5d) == 0 && jsRound(0.49999999999999994d) == 0 && r1(-0.25d) == -0.2d && r1(0.25d) == 0.3d && r3(-1.0005d) == -1.0d,
    "round(2.5)=" + num(jsRound(2.5d)) + ", round(-2.5)=" + num(jsRound(-2.5d)) + ", r1(-0.25)=" + r1(-0.25d) + ", r1(0.25)=" + r1(0.25d));
  check("creatures and T-rex types are in the order of the JSON files",
    DINO_IDS.size() == 24 && eq(DINO_IDS.get(0), "compsognathus") && eq(DINO_IDS.get(21), "plesiosaurus") && eq(DINO_IDS.get(23), "mosasaurus") && eq(joinStr(REX_IDS, ","), "rex,brick,dash,chomp,mule,hop,reach,mender"),
    joinStr(REX_IDS, ",") + "; " + DINO_IDS.get(0) + " ... " + DINO_IDS.get(23));
  for (int c = 0; c < FP_CASES.length; c++) {
    String line = fingerprint(FP_CASES[c][0], FP_CASES[c][1], FP_CASES[c][2]);
    println(line);
    check("fingerprint " + (c + 1) + " is identical to the web version's", line.equals(FP_EXPECTED[c]), line.equals(FP_EXPECTED[c]) ? "" : "the web version prints: " + FP_EXPECTED[c]);
  }

  // -------- 1. data
  {
    LinkedHashMap<String, Object> sprites = jObj(readJson("sprites.json"));
    LinkedHashMap<String, Object> rigs = jObj(sprites.get("rigs")), parts = jObj(sprites.get("parts"));
    String bad = "";
    String[] an = { "idle", "move", "attack", "hurt" };
    for (String k : DINO_IDS) {
      DinoDef d = DINOS.get(k);
      if (d.name == null || d.size == null || d.role == null || d.biomes == null) bad = k + " fields";
      Object rig = rigs.get(k);
      boolean anims = rig != null;
      if (rig != null) for (String a : an) { Object l = jObj(jObj(rig).get("anims")).get(a); if (l == null || jArr(l).isEmpty()) anims = false; }
      if (!anims) bad = k + " animations";
      else if (jArr(jObj(jObj(rig).get("anims")).get("attack")).size() != 4) bad = k + " attack must have 4 poses";
      if (windOf(d.size) == 0 || recoOf(d.size) == 0) bad = k + " size " + d.size;
    }
    for (String k : REX_IDS) {
      Object rig = rigs.get("rex_" + k);
      if (rig == null || jArr(jObj(jObj(rig).get("anims")).get("attack")).size() != 4) bad = k + " T-rex rig";
    }
    for (Object po : parts.values()) {
      ArrayList<Object> rows = jArr(jObj(po).get("rows"));
      for (Object r : rows) if (jStr(r).length() != jStr(rows.get(0)).length()) bad = "sprite rows";
    }
    // every biome outside the meadow has at least one creature whose meat counts as a meal of that biome's tier
    for (Zone z : ZONES) {
      if (eq(z.id, "meadow")) continue;
      boolean some = false;
      for (String k : DINO_IDS) {
        DinoDef d = DINOS.get(k);
        boolean inZone = false;
        for (String bz : d.biomes) if (eq(bz, z.id)) inZone = true;
        if (inZone && d.foodTier == z.tier && !eq(d.habitat, "deep_water")) some = true;
      }
      if (!some) bad = "no meal creature in " + z.id;
    }
    check("data: 24 creatures, 4 animations each, attacks have 4 poses, every biome has meals", DINO_IDS.size() == 24 && bad.isEmpty(), !bad.isEmpty() ? bad : DINO_IDS.size() + " creatures");
  }

  // -------- 2. the game cannot win by itself
  {
    ArrayList<String> out = new ArrayList<String>();
    boolean bad = false;
    for (int seed : new int[] { 777, 12345 }) {
      Played r = botPlay(1, seed, 60 * 60 * 20, true);
      out.add(r.S.mode + " at stage " + r.S.baby.stage + " after " + fixed(r.frames / 3600.0d, 1) + " min");
      if (eq(r.S.mode, "win") || r.S.baby.stage > 1) bad = true;
    }
    check("20 minutes with no input never wins and never gets past the hatchling", !bad, joinStr(out, "; "));
  }

  // -------- 3. raids are dangerous
  {
    GameState S = newGame(2, 777);
    int f = 0;
    while (f < 60 * 60 * 5 && eq(S.mode, "play")) { f++; S.players.get(0).x = -3600; S.players.get(1).x = -3600; step(S, none(2)); }
    check("with nobody at the nest the baby is lost", eq(S.mode, "over"), "lost after " + fixed(f / 60.0d, 0) + " s");
  }

  // -------- 4. what counts as a meal
  {
    GameState S = empty();
    debugSetStage(S, 2);
    ArrayList<Integer> drops = new ArrayList<Integer>();
    for (String k : new String[] { "compsognathus", "velociraptor", "carnotaurus", "allosaurus", "tyrannosaurus", "velociraptor", "allosaurus", "carnotaurus" }) {
      Dino d = put(S, k, 300, new Opts().raid());
      S.foods = new ArrayList<Food>();
      hurtDino(S, d, 9999, 280);
      if (!S.foods.isEmpty()) drops.add(S.foods.get(0).meal);
    }
    boolean raiderOk = !drops.isEmpty();
    for (int m : drops) if (m != 0) raiderOk = false;
    S.dinos = new ArrayList<Dino>(); S.foods = new ArrayList<Food>();
    hurtDino(S, put(S, "stegosaurus", 2300), 9999, 2280);
    Food wild = S.foods.isEmpty() ? null : S.foods.get(0);
    int a = feedBaby(S, meat(0)), b = feedBaby(S, meat(1)), c = feedBaby(S, meat(2)), d4 = feedBaby(S, meat(4));
    check("raider meat is a snack; too-small meat is no meal; right meat is 1 meal; far meat is 2",
      raiderOk && wild != null && wild.meal == 1 && wild.tier == 2 && a == 0 && b == 0 && c == 1 && d4 == 2 && S.baby.meals == 3,
      drops.size() + " raider drops all snacks, wild stegosaurus tier " + (wild != null ? wild.tier : -1) + ", meals counted " + a + "/" + b + "/" + c + "/" + d4);
  }

  // -------- 5. bosses gate every stage
  {
    GameState S = empty();
    String[] want = { "velociraptor", "carnotaurus", "spinosaurus", "giganotosaurus,tyrannosaurus" };   // sorted
    boolean ok = true;
    ArrayList<String> note = new ArrayList<String>();
    S.baby.eggT = EGG_T - 1;
    for (int stage = 0; stage < 4 && ok; stage++) {
      if (stage == 0) step(S, none(2));
      else {
        for (int i = 0; i < MEALS[stage] - 1; i++) feedBaby(S, meat(stage));
        if (S.boss != null) { ok = false; note.add("boss came early at stage " + stage); }
        feedBaby(S, meat(stage));
      }
      if (S.boss == null || !eq(S.boss.key, "boss" + (stage + 1)) || S.boss.warnT < BOSS_WARN - 1) { ok = false; note.add("no warning for boss " + (stage + 1)); break; }
      if (feedBaby(S, meat(4)) != 0) { ok = false; note.add("meal counted during a boss"); }
      for (int i = 0; i <= BOSS_WARN; i++) step(S, none(2));
      ArrayList<String> lk = new ArrayList<String>();
      for (Dino d : S.dinos) if (d.lead) lk.add(d.kind);
      java.util.Collections.sort(lk);
      String leads = joinStr(lk, ",");
      if (!leads.equals(want[stage]) || S.boss.max <= 0) { ok = false; note.add("wrong leaders: " + leads); }
      if (S.baby.stage != stage) { ok = false; note.add("grew before the boss was beaten"); }
      S.players.get(0).hp = 40; S.baby.hp = 50; S.baby.hunger = 20;
      for (Dino d : S.dinos) d.hp = 0;
      step(S, none(2));
      step(S, none(2));
      if (S.baby.stage != stage + 1) { ok = false; note.add("did not grow after boss " + (stage + 1)); }
      if (stage < 3 && (S.players.get(0).hp < S.players.get(0).maxHp || S.baby.hp < 65 || S.baby.hunger < 99 || S.boss != null)) { ok = false; note.add("no reward after boss " + (stage + 1)); }
    }
    check("each stage waits for its boss wave; the four waves come in order; beating one heals and grows the baby", ok && eq(S.mode, "finale"), !note.isEmpty() ? joinStr(note, "; ") : "ends in the " + S.ending + " finale");
  }

  // -------- 6. attacks: wind-up, strike, recovery
  {
    int wind = windOf("large");
    Duel still = duel("allosaurus", 30, 110, null);
    int windSteps = still.indexOf("strike", 0);                       // steps spent winding up
    int recoSteps = still.count("recover");
    Duel away = duel("allosaurus", 30, 110, (i, S, p, d) -> i >= 5 ? mxIn(-1) : null);
    Duel jump = duel("allosaurus", 30, 60, (i, S, p, d) -> i == 28 ? jumpIn(true) : null);
    check("a big creature winds up first: no damage until the strike, then exactly one hit",
      windSteps == wind && still.firstHit == wind + 4 && still.hits == 1, "wind-up " + windSteps + " steps, hit on step " + still.firstHit + ", hits " + still.hits);
    check("stepping away or jumping during the wind-up avoids the hit", away.hits == 0 && jump.hits == 0, "walked away: " + away.hits + " hits, jumped: " + jump.hits + " hits");
    int nextWind = still.indexOf("windup", windSteps + 8);
    check("after the strike it recovers and cannot attack", recoSteps >= recoOf("large") && nextWind >= windSteps + 8 + recoOf("large"),
      recoSteps + " recovery steps, next wind-up on step " + (nextWind + 1));

    Act bite = (i, S, p, d) -> i == 3 ? biteIn(true) : null;
    Duel small = duel("baryonyx", 25, 50, bite), big = duel("allosaurus", 30, 50, bite);
    check("a bite cancels a medium creature's wind-up, but not a big one's", small.hits == 0 && small.count("recover") > 0 && small.count("strike") == 0 && big.hits == 1,
      "baryonyx: " + small.hits + " hits, allosaurus: " + big.hits + " hit");
  }

  // -------- 7. boss moves
  {
    // Carnotaurus charge: jump over it and it skids into a stun; stand still and it hits and just recovers.
    Act jumper = (i, S, p, d) -> eq(d.atk, "strike") && Math.abs(d.x - p.x) < 62 && p.g ? jumpIn(true) : null;
    Duel miss = duel("carnotaurus", 150, 200, jumper), hit = duel("carnotaurus", 150, 200, null);
    int stunLen = miss.count("stun");
    check("a Carnotaurus charge that misses ends in a 1.5 second stun", miss.hits == 0 && stunLen >= 88 && hit.hits >= 1 && !hit.has("stun", 130),
      "jumped: " + miss.hits + " hits, stunned " + stunLen + " steps; stood still: " + hit.hits + " hit, no stun");

    // T-rex roar: stuns a T-rex on the ground and in range, not one in the air or far away.
    final int roarAt = MOVES.get("roar").wind + 4;
    Duel ground = duel("tyrannosaurus", 60, roarAt + 2, null);
    Duel air = duel("tyrannosaurus", 60, roarAt + 2, (i, S, p, d) -> i == roarAt - 10 ? jumpIn(true) : null);
    Duel far = duel("tyrannosaurus", 60, roarAt + 2, (i, S, p, d) -> i >= 3 ? mxIn(-1) : null);
    check("the roar stuns only a T-rex that is close and on the ground", ground.p.stunT > 0 && air.p.stunT == 0 && far.p.stunT == 0 && eq(ground.d.atkKind, "roar"),
      "on the ground: stunned " + ground.p.stunT + ", in the air: " + air.p.stunT + ", walked away: " + far.p.stunT);

    // Boss leaders: armour outside the opening, full damage inside it.
    GameState S = empty();
    Dino lead = put(S, "spinosaurus", 300, new Opts().raid().boss().lead().hpMul(10));
    double h0 = lead.hp; hurtDino(S, lead, 20, 280); double closed = h0 - lead.hp;
    lead.atk = "recover"; lead.atkT = 30; double h1 = lead.hp; hurtDino(S, lead, 20, 280); double opened = h1 - lead.hp;
    check("a boss leader takes full damage only in its opening", opened == 20 && closed == Math.round(20 * LEAD_ARMOR), "armoured " + num(closed) + ", open " + num(opened));

    // Alpha raptor calls 2 Compsognathus once, at half health.
    GameState A = empty();
    A.baby.eggT = EGG_T - 1;
    for (int i = 0; i <= BOSS_WARN + 1; i++) step(A, none(2));
    A.players.get(0).x = -3600; A.players.get(1).x = -3600;
    Dino alpha = null;
    for (Dino d : A.dinos) if (d.lead) { alpha = d; break; }
    int n0 = countKind(A, "compsognathus");
    alpha.hp = alpha.maxHp / 2 - 1; step(A, none(2));
    int n1 = countKind(A, "compsognathus");
    alpha.hp = alpha.maxHp / 4; for (int i = 0; i < 30; i++) step(A, none(2));
    int n2 = countKind(A, "compsognathus");
    check("the alpha raptor calls 2 more Compsognathus once, at half health", alpha != null && n1 == n0 + 2 && n2 == n1, n0 + " -> " + n1 + " -> " + n2);

    // Apex Clash: when one leader falls, the other speeds up.
    GameState C = empty();
    debugSetStage(C, 3);
    for (int i = 0; i < MEALS[3]; i++) feedBaby(C, meat(3));
    for (int i = 0; i <= BOSS_WARN; i++) step(C, none(2));
    ArrayList<Dino> leads = new ArrayList<Dino>();
    for (Dino d : C.dinos) if (d.lead) leads.add(d);
    boolean sides = leads.size() == 2 && leads.get(0).x * leads.get(1).x < 0;
    leads.get(0).hp = 0; step(C, none(2)); step(C, none(2));
    check("Apex Clash: two leaders from opposite sides, and the survivor speeds up", sides && leads.get(1).rage, "opposite sides: " + sides + ", rage: " + leads.get(1).rage);

    // Hunger runs at 40% during a boss fight.
    double[] drain = new double[2];
    for (int k = 0; k < 2; k++) {
      GameState Hs = empty();
      debugSetStage(Hs, 1);
      Hs.players.get(0).x = -3600; Hs.players.get(1).x = -3600;
      if (k == 1) {
        Boss B = new Boss();
        B.stage = 1; B.key = "boss2"; B.warnT = 0; B.side = 1; B.max = 1; B.hp = 1;
        Hs.boss = B;
        put(Hs, "brachiosaurus", 5000, new Opts().boss());
      }
      double h = Hs.baby.hunger;
      for (int i = 0; i < 600; i++) step(Hs, none(2));
      drain[k] = h - Hs.baby.hunger;
    }
    check("the baby gets hungry 60% slower during a boss fight", Math.abs(drain[1] / drain[0] - 0.4d) < 0.02d, fixed(drain[0], 2) + " normally, " + fixed(drain[1], 2) + " during a boss, in 10 s");
  }

  // -------- 8. the baby
  {
    GameState S = empty();
    debugSetStage(S, 1);
    S.players.get(0).x = -3600; S.players.get(1).x = -3600;
    S.baby.hunger = 0.5d;
    for (int i = 0; i < 600; i++) step(S, none(2));
    boolean starved = S.baby.hp < 100 && S.baby.hunger == 0;
    // one hit takes at most 14, and two hits in the same moment count once
    GameState T2 = empty();
    hurtBaby(T2, 40); hurtBaby(T2, 40);
    check("a starving baby loses health; one hit takes at most 14 and it cannot be hit twice at once", starved && T2.baby.hp == 86, "after starving: " + fixed(S.baby.hp, 1) + " hp, after two hits of 40: " + num(T2.baby.hp));

    GameState[] ends = new GameState[2];
    for (int k = 0; k < 2; k++) {
      GameState E = empty();
      E.baby.totalDamage = k == 0 ? 10 : METEOR_THRESHOLD + 20;
      debugSetStage(E, 3);
      for (int i = 0; i < MEALS[3]; i++) feedBaby(E, meat(3));
      for (int i = 0; i <= BOSS_WARN; i++) step(E, none(2));
      for (Dino d : E.dinos) d.hp = 0;
      for (int i = 0; i < 300; i++) step(E, none(2));
      ends[k] = E;
    }
    check("little damage to the baby gives the volcano ending, a lot gives the meteor", eq(ends[0].mode, "win") && eq(ends[0].ending, "volcano") && eq(ends[1].mode, "win") && eq(ends[1].ending, "meteor"), ends[0].ending + " / " + ends[1].ending);
  }

  // -------- 9. the computer partner
  {
    GameState S = empty(1, 1);
    S.players.get(0).x = -3600;
    put(S, "compsognathus", 150, new Opts().raid()); put(S, "compsognathus", 175, new Opts().raid());
    double far = 0;
    int f = 0;
    while (!S.dinos.isEmpty() && f++ < 900) { step(S, none(1)); far = Math.max(far, Math.abs(S.players.get(1).x)); }
    boolean small = S.dinos.isEmpty() && S.baby.hp >= 90 && far < 330;
    GameState T2 = empty(1, 1);
    T2.players.get(0).x = -3600;
    put(T2, "allosaurus", 220, new Opts().raid());
    f = 0;
    while (!T2.dinos.isEmpty() && f++ < 2400) step(T2, none(1));
    check("computer mama beats a small raid and a big raider alone, and stays at the nest", small && T2.dinos.isEmpty() && T2.baby.hp >= 70 && T2.players.get(1).downT == 0,
      "small raid: baby " + Math.round(S.baby.hp) + " hp, furthest " + Math.round(far) + " px; allosaurus beaten in " + fixed(f / 60.0d, 0) + " s, baby " + Math.round(T2.baby.hp) + " hp, mama " + Math.round(T2.players.get(1).hp) + " hp");
  }

  // -------- 10. T-rex types
  {
    HashSet<String> stats = new HashSet<String>();
    for (String k : REX_IDS) { RexDef r = REXES.get(k); stats.add(r.hp + "," + r.speed + "," + r.bite + "," + r.reach + "," + r.carry + "," + r.jump + "," + r.regen + "," + r.respawn); }
    ArrayList<String> deals = new ArrayList<String>();
    boolean noRepeats = true;
    for (int seed = 1; seed <= 6; seed++) {
      ArrayList<String> ty = new ArrayList<String>();
      for (Player p : newGame(8, seed).players) ty.add(p.type);
      if (new HashSet<String>(ty).size() != 8) noRepeats = false;
      deals.add(joinStr(ty, " "));
    }
    boolean differ = new HashSet<String>(deals).size() >= 5;
    GameState solo = newGame(1, 3), six = newGame(6, 3);
    check("8 T-rex types with different stats; a game deals them without repeats; games deal differently",
      REX_IDS.size() == 8 && stats.size() == 8 && noRepeats && differ, "first deals: " + deals.get(0) + " / " + deals.get(1));
    int soloAi = 0, sixAi = 0;
    for (Player p : solo.players) if (p.ai) soloAi++;
    for (Player p : six.players) if (p.ai) sixAi++;
    check("alone is always 2 T-rexes (1 played by the computer); 6 players is 6 T-rexes and no computer",
      solo.players.size() == 2 && soloAi == 1 && !eq(solo.players.get(0).type, solo.players.get(1).type) && six.players.size() == 6 && sixAi == 0);

    check("Brick takes more hits than Dash, and Dash walks further than Brick", hitsToDown("brick") > hitsToDown("dash") && walked("dash") > walked("brick") * 1.3d,
      "hits of 20 to knock out: Brick " + hitsToDown("brick") + ", Dash " + hitsToDown("dash") + "; px walked in 2 s: Dash " + fixed(walked("dash"), 0) + ", Brick " + fixed(walked("brick"), 0));
    check("Chomp bites hardest, Reach bites from further away, Hop jumps highest, Mule carries at full speed",
      biteDamage("chomp", 40) > biteDamage("rex", 40) && biteDamage("reach", 90) > 0 && biteDamage("rex", 90) == 0 && jumpTop("hop") > jumpTop("rex") * 1.4d && carried("mule") > carried("rex") * 1.15d,
      "bite: Chomp " + num(biteDamage("chomp", 40)) + ", Rex " + num(biteDamage("rex", 40)) + "; bite from 90 px: Reach " + num(biteDamage("reach", 90)) + ", Rex " + num(biteDamage("rex", 90)) +
      "; jump: Hop " + fixed(jumpTop("hop"), 0) + " px, Rex " + fixed(jumpTop("rex"), 0) + " px; carrying 2 s: Mule " + fixed(carried("mule"), 0) + ", Rex " + fixed(carried("rex"), 0));
    check("Mender heals away from the nest and is knocked out for half as long", healedAway("mender") > 3 && healedAway("rex") == 0 && downTime("mender") * 2 == downTime("rex"),
      "healed in 5 s: Mender " + fixed(healedAway("mender"), 1) + ", Rex " + num(healedAway("rex")) + "; knocked out for " + downTime("mender") + " vs " + downTime("rex") + " steps");
  }

  // -------- 11. bigger groups
  {
    GameState two = empty(2, 1), eight = empty(8, 1);
    debugSetStage(two, 2); debugSetStage(eight, 2);
    step(two, null); step(eight, null);
    ArrayList<Dino> w2 = wave(two), w8 = wave(eight);
    double lead2 = 0, lead8 = 0;
    for (Dino d : w2) if (d.lead) { lead2 = d.maxHp; break; }
    for (Dino d : w8) if (d.lead) { lead8 = d.maxHp; break; }
    check("more T-rexes need more meals, and face a bigger boss wave with a tougher leader",
      eight.baby.need > two.baby.need * 3 && lead8 > lead2 * 3 && w8.size() > w2.size(),
      "meals per stage: " + two.baby.need + " for 2, " + eight.baby.need + " for 8; boss 3 leader health " + num(lead2) + " vs " + num(lead8) + "; wave size " + w2.size() + " vs " + w8.size());

    // camera groups for players on one screen
    String bad = "";
    lcgSeed = 7;
    for (int k = 0; k < 400 && bad.isEmpty(); k++) {
      int n = 1 + (int) Math.floor(lcg() * 8);
      double[] xs = new double[n];
      for (int i = 0; i < n; i++) { double a = lcg() - 0.5d; xs[i] = jsRound(a * (lcg() < 0.5d ? 600 : 10000)); }
      ArrayList<CamGroup> g = cameraGroups(xs, 4), g2 = cameraGroups(xs.clone(), 4);
      ArrayList<Integer> all = new ArrayList<Integer>();
      for (CamGroup o : g) all.addAll(o.who);
      java.util.Collections.sort(all);
      boolean complete = all.size() == n;
      for (int i = 0; i < all.size() && complete; i++) if (all.get(i) != i) complete = false;
      if (g.size() > 4 || g.size() < 1) bad = "panes " + g.size();
      else if (!complete) bad = "players lost or doubled";
      else if (!groupsText(g).equals(groupsText(g2))) bad = "not the same twice";
    }
    ArrayList<CamGroup> near = cameraGroups(new double[] { 0, 100, 250, 380 }, 4), far = cameraGroups(new double[] { -3000, 0, 40, 1500, 4000, 4050 }, 4);
    ArrayList<String> farTxt = new ArrayList<String>();
    for (CamGroup g : far) { ArrayList<String> w = new ArrayList<String>(); for (int i : g.who) w.add(String.valueOf(i)); farTxt.add(joinStr(w, "+")); }
    check("the split screen never needs more than 4 panes, loses nobody, and keeps close players together", bad.isEmpty() && near.size() == 1 && far.size() == 4,
      !bad.isEmpty() ? bad : "4 close players: " + near.size() + " pane; 6 spread out: " + joinStr(farTxt, " | "));

    // the computer takes over a T-rex when its player leaves
    GameState S = newGame(3, 21);
    S.players.get(2).x = 900;
    String type = S.players.get(2).type;
    S.players.get(2).ai = true;
    for (int i = 0; i < 600; i++) step(S, none(3));
    check("when a player leaves, the computer takes over that T-rex and the game goes on", eq(S.mode, "play") && eq(S.players.get(2).type, type) && Math.abs(S.players.get(2).x) < 330 && S.players.size() == 3,
      "it walked back from 900 px to " + Math.round(S.players.get(2).x) + " px and stayed a " + type);
  }

  // -------- 12. full games, alone and in groups
  {
    int[] planHumans = { 1, 2, 4, 8 };
    int[][] planSeeds = { { 11, 12, 13, 14, 15, 16 }, { 11, 12, 13 }, { 11, 12 }, { 11, 12 } };
    boolean allWon = true, sameAsWeb = true;
    double lo = 99, hi = 0, closest = 1e9d;
    for (int pi = 0; pi < planHumans.length; pi++) {
      int humans = planHumans[pi];
      ArrayList<Played> games = new ArrayList<Played>();
      for (int seed : planSeeds[pi]) games.add(botPlay(humans, seed, 60 * 60 * 40, false));
      ArrayList<String> mins = new ArrayList<String>(), ends = new ArrayList<String>(), secs = new ArrayList<String>(), dmg = new ArrayList<String>();
      for (Played g : games) {
        double m = g.frames / 3600.0d;
        lo = Math.min(lo, m); hi = Math.max(hi, m);
        if (!eq(g.S.mode, "win")) allWon = false;
        for (double d : g.mealsFrom) closest = Math.min(closest, d);
        mins.add(fixed(m, 1));
        ends.add(eq(g.S.mode, "win") ? g.S.ending : g.S.mode);
        dmg.add(String.valueOf(Math.round(g.S.baby.totalDamage)));
      }
      for (int b = 1; b <= 4; b++) {
        ArrayList<Long> v = new ArrayList<Long>();
        for (Played g : games) if (g.bossTimed[b]) v.add(g.bossSecs[b]);
        java.util.Collections.sort(v);
        secs.add(v.isEmpty() ? "" : String.valueOf(v.get(v.size() / 2)));       // the median
      }
      String line = "      " + humans + " player" + (humans > 1 ? "s" : " ") + ": " + joinStr(mins, ", ") + " min | " + joinStr(ends, ", ") +
        " | boss fights (s) " + joinStr(secs, ", ") + " | damage to the baby " + joinStr(dmg, ", ");
      println(line);
      if (!line.equals(FULL_GAMES_EXPECTED[pi])) sameAsWeb = false;
    }
    check("the test players win a full game through all 4 bosses, alone and with 2, 4 and 8 players", allWon);
    check("every full game takes between 13 and 22 minutes for the test players, at every group size", lo >= 13 && hi <= 22, "shortest " + fixed(lo, 1) + ", longest " + fixed(hi, 1) + " min");
    check("every meal was meat from at least 500 px away from the nest", closest >= 500, "closest: " + num(closest) + " px");
    check("the 13 full games end exactly like the web version's (length, ending, boss fights, damage)", sameAsWeb, sameAsWeb ? "" : "the four lines above differ from what node test/smoke.js prints");
  }

  // -------- this version only: the small font, keys, controllers, menus
  runFontChecks();
  runInputChecks();
  runMenuChecks();

  println(failed > 0 ? "\n" + failed + " check(s) failed" : "\nAll checks passed");
  println("(" + (System.currentTimeMillis() - t0) / 1000 + " s)");
}

// What `node test/smoke.js` prints for the 13 full games of the web version (copied from its output).
final String[] FULL_GAMES_EXPECTED = {
  "      1 player : 15.5, 14.8, 15.3, 15.4, 15.2, 13.3 min | volcano, volcano, volcano, volcano, volcano, volcano | boss fights (s) 46, 54, 67, 83 | damage to the baby 42, 80, 93, 94, 115, 58",
  "      2 players: 15.1, 14.6, 13.5 min | volcano, volcano, volcano | boss fights (s) 49, 54, 67, 71 | damage to the baby 81, 122, 52",
  "      4 players: 18.4, 17.9 min | volcano, volcano | boss fights (s) 40, 46, 54, 82 | damage to the baby 39, 26",
  "      8 players: 20.7, 19.9 min | volcano, volcano | boss fights (s) 38, 46, 55, 76 | damage to the baby 52, 34"
};

// One T-rex of a given type, alone in an empty world.
GameState one(String type) {
  GameState S = empty(2, 9);
  Player p = S.players.get(0);
  p.face = 1; p.type = type; p.hp = p.maxHp = REXES.get(type).hp; p.x = -3600; S.players.get(1).x = 3000;
  return S;
}
int hitsToDown(String type) { GameState S = one(type); int n = 0; while (S.players.get(0).downT == 0 && n < 50) { S.players.get(0).invT = 0; hurtPlayer(S, S.players.get(0), 20, 0, ""); n++; } return n; }
double walked(String type) { GameState S = one(type); for (int i = 0; i < 120; i++) step(S, new Inp[] { mxIn(1), NONE }); return S.players.get(0).x + 3600; }
double jumpTop(String type) { GameState S = one(type); double top = 0; for (int i = 0; i < 60; i++) { step(S, new Inp[] { jumpIn(i == 2), NONE }); top = Math.max(top, G - S.players.get(0).y); } return top; }
double carried(String type) { GameState S = one(type); S.players.get(0).carry = meat(1); for (int i = 0; i < 120; i++) step(S, new Inp[] { mxIn(1), NONE }); return S.players.get(0).x + 3600; }
double biteDamage(String type, double gap) {
  GameState S = one(type);
  Dino d = put(S, "diplodocus", -3600 + gap);
  d.cd = 1000000;
  double h = d.hp;
  for (int i = 0; i < 12; i++) step(S, new Inp[] { biteIn(i == 1), NONE });
  return h - d.hp;
}
double healedAway(String type) { GameState S = one(type); S.players.get(0).hp = 40; for (int i = 0; i < 300; i++) step(S, none(2)); return S.players.get(0).hp - 40; }
int downTime(String type) { GameState S = one(type); S.players.get(0).invT = 0; hurtPlayer(S, S.players.get(0), 999, 0, ""); return S.players.get(0).downT; }

ArrayList<Dino> wave(GameState S) {
  for (int i = 0; i < MEALS[2] * 9 && S.boss == null; i++) feedBaby(S, meat(2));
  for (int i = 0; i <= BOSS_WARN; i++) step(S, null);
  ArrayList<Dino> out = new ArrayList<Dino>();
  for (Dino d : S.dinos) if (d.boss) out.add(d);
  return out;
}

// The little random number maker of the camera check in test/smoke.js. Its numbers go through JavaScript's
// doubles (the product is too large to be exact), so the same double arithmetic is used here.
int lcgSeed = 7;
double lcg() {
  double v = lcgSeed * 1103515245.0d + 12345.0d;
  lcgSeed = (int) ((long) v) & 0x7fffffff;
  return lcgSeed / (double) 0x7fffffff;
}

String groupsText(ArrayList<CamGroup> g) {
  StringBuilder b = new StringBuilder();
  for (CamGroup o : g) b.append(num(o.x)).append(':').append(o.who).append(' ');
  return b.toString();
}

// ---------------------------------------------------------------- the small font
String glyphOf(char c) { return FONT5.substring((c - 32) * 10, (c - 32) * 10 + 10); }

void runFontChecks() {
  boolean differ = !glyphOf('M').equals(glyphOf('N')) && !glyphOf('m').equals(glyphOf('n')) && !glyphOf('w').equals(glyphOf('v')) && !glyphOf('W').equals(glyphOf('V'));
  StringBuilder all = new StringBuilder();
  for (int ch = 32; ch < 127; ch++) all.append((char) ch);
  BufferedImage img = textImg(all.toString(), "vt", "#ffffff");
  int top = 99, bottom = -1, left = 99999, right = -1;
  for (int y = 0; y < img.getHeight(); y++) for (int x = 0; x < img.getWidth(); x++) {
    if ((img.getRGB(x, y) >>> 24) == 0) continue;
    top = Math.min(top, y); bottom = Math.max(bottom, y); left = Math.min(left, x); right = Math.max(right, x);
  }
  // a character outside the table is drawn as a question mark
  BufferedImage odd = textImg("\u00e9", "vt", "#ffffff"), q = textImg("?", "vt", "#ffffff");
  boolean same = true;
  for (int y = 0; y < 16; y++) for (int x = 0; x < 8; x++) if (odd.getRGB(x, y) != q.getRGB(x, y)) same = false;
  check("small font: 95 characters of 5x7 pixels, 6 px apart, in a line 16 px high; M/N, m/n, w/v, W/V differ",
    FONT5.length() == 950 && differ && measure("Fern Meadow", "vt") == 66 && img.getWidth() == 95 * 6 + 2 && img.getHeight() == 16 && top == 5 && bottom == 13 && left >= 1 && right <= 95 * 6 && same,
    "pixels from row " + top + " to row " + bottom + " (g p q y hang 2 rows lower), columns " + left + " to " + right + " of " + img.getWidth() + "; 'Fern Meadow' is " + measure("Fern Meadow", "vt") + " px wide");
}

// ---------------------------------------------------------------- keys and controllers
// Makes a controller state as Jamepad would give it. No real controller is needed for this.
Object fakePad(float lx, float ly, float rt, String buttons) throws Exception {
  Constructor<?> ctor = padStateClass.getDeclaredConstructor();
  ctor.setAccessible(true);
  Object cs = ctor.newInstance();
  Field[] all = { fConnected, fLeftX, fLeftY, fRightTrig, fA, fB, fX, fY, fRb, fStart, fBack, fDpadUp, fDpadDown, fDpadLeft, fDpadRight };
  for (Field f : all) f.setAccessible(true);
  fConnected.setBoolean(cs, true);
  fLeftX.setFloat(cs, lx); fLeftY.setFloat(cs, ly); fRightTrig.setFloat(cs, rt);
  String b = " " + buttons + " ";
  fA.setBoolean(cs, b.contains(" a ")); fB.setBoolean(cs, b.contains(" b ")); fX.setBoolean(cs, b.contains(" x ")); fY.setBoolean(cs, b.contains(" y "));
  fRb.setBoolean(cs, b.contains(" rb ")); fStart.setBoolean(cs, b.contains(" start ")); fBack.setBoolean(cs, b.contains(" back "));
  fDpadUp.setBoolean(cs, b.contains(" up ")); fDpadDown.setBoolean(cs, b.contains(" down ")); fDpadLeft.setBoolean(cs, b.contains(" left ")); fDpadRight.setBoolean(cs, b.contains(" right "));
  return cs;
}

String inpText(Inp i) { return i.mx + (i.jump ? " jump" : "") + (i.bite ? " bite" : "") + (i.grab ? " grab" : ""); }
boolean inpIs(Inp i, int mx, boolean jump, boolean bite, boolean grab) { return i.mx == mx && i.jump == jump && i.bite == bite && i.grab == grab; }

void runInputChecks() {
  // the four keyboard layouts
  inputReset();
  String[][] lay = { { "kb1", "ArrowLeft", "ArrowRight", "ArrowUp", "Space", "ArrowDown" }, { "kb2", "KeyA", "KeyD", "KeyW", "KeyF", "KeyS" },
    { "kb3", "KeyJ", "KeyL", "KeyI", "KeyH", "KeyK" }, { "kb4", "Numpad4", "Numpad6", "Numpad8", "Numpad0", "Numpad5" } };
  String bad = "";
  for (String[] l : lay) {
    inputReset();
    keyDown(l[1]); if (!inpIs(poll(l[0]), -1, false, false, false)) bad += l[0] + " left; ";
    keyUp(l[1]); keyDown(l[2]); if (!inpIs(poll(l[0]), 1, false, false, false)) bad += l[0] + " right; ";
    keyDown(l[3]); keyDown(l[4]); if (!inpIs(poll(l[0]), 1, true, true, false)) bad += l[0] + " jump+bite; ";
    keyUp(l[2]); keyUp(l[3]); keyUp(l[4]); keyDown(l[5]); if (!inpIs(poll(l[0]), 0, false, false, true)) bad += l[0] + " grab; ";
    for (String[] o : lay) if (o != l && !inpIs(poll(o[0]), 0, false, false, false)) bad += l[0] + " also moves " + o[0] + "; ";
  }
  inputReset();
  check("keys: the four keyboard layouts each steer only their own T-rex", bad.isEmpty(), bad.isEmpty() ? "kb1 arrows+Space+Down, kb2 A/D W F S, kb3 J/L I H K, kb4 numpad 4/6 8 0 5" : bad);

  // a key pressed and let go between two steps still counts, once
  inputReset();
  inputTick();
  keyDown("Space"); keyUp("Space");
  MenuInput m1 = inputTick();
  boolean biteSeen = poll("kb1").bite;
  MenuInput m2 = inputTick();
  boolean biteGone = !poll("kb1").bite;
  keyDown("Escape");
  MenuInput m3 = inputTick();
  MenuInput m4 = inputTick();                        // still held: no second press
  keyUp("Escape");
  check("keys: a tap shorter than one step still counts once; Escape is back and pause, and a held key is one press",
    m1.ok && biteSeen && !m2.ok && biteGone && m3.back && m3.pause && !m4.back && !m4.pause,
    "tap: ok=" + m1.ok + " bite=" + biteSeen + ", next step ok=" + m2.ok + "; Escape: back=" + m3.back + " pause=" + m3.pause + ", held: " + m4.back);
  inputReset();

  // controllers: the library, and the mapping with made-up controller states
  initControllers();
  check("controllers: the Jamepad library and its native part load", padLibraryLoaded && padManager != null, padLibraryLoaded ? "loaded; controllers connected now: " + countRealPads() : "not loaded: " + padError);
  if (padStateClass == null) {
    check("controllers: stick or D-pad walk, A jump, X or right shoulder bite, B/Y grab", false, "the Jamepad classes are missing, so no made-up controller could be tested");
    return;
  }
  try {
    injectedPadStates = new Object[] { fakePad(-0.8f, 0, 0, ""), fakePad(0, 0, 0, "right a x"), fakePad(0.2f, 0, 0, "b"), fakePad(0.6f, 0, 0.9f, "y left") };
    refreshPads();
    Inp p0 = poll("pad0"), p1 = poll("pad1"), p2 = poll("pad2"), p3 = poll("pad3");
    injectedPadStates = new Object[] { fakePad(0, 0, 0, "rb up"), fakePad(0, 0, 0, "down"), null, fakePad(0, 0, 0, "") };
    refreshPads();
    Inp q0 = poll("pad0"), q1 = poll("pad1"), q2 = poll("pad2");
    int cnt = padCount();
    check("controllers: stick or D-pad walk, A jump, X or right shoulder bite, B/Y grab",
      inpIs(p0, -1, false, false, false) && inpIs(p1, 1, true, true, false) && inpIs(p2, 0, false, false, true) && inpIs(p3, -1, false, true, true)
      && inpIs(q0, 0, true, true, false) && inpIs(q1, 0, false, false, true) && inpIs(q2, 0, false, false, false) && cnt == 3,
      "stick left: " + inpText(p0) + "; D-pad right + A + X: " + inpText(p1) + "; B (stick 0.2 is ignored): " + inpText(p2) + "; D-pad left beats stick, trigger + Y: " + inpText(p3)
      + "; RB + D-pad up: " + inpText(q0) + "; D-pad down: " + inpText(q1) + "; 3 of 4 connected: " + cnt);

    // menus with a controller: stick up, A = OK, Start = begin and pause, Back = back
    inputReset();
    injectedPadStates = new Object[] { null, fakePad(0, 0.85f, 0, "a") };
    MenuInput a = inputTick();
    injectedPadStates = new Object[] { null, fakePad(0, -0.85f, 0, "start") };
    MenuInput b = inputTick();
    injectedPadStates = new Object[] { null, fakePad(0, -0.85f, 0, "start") };
    MenuInput c = inputTick();                       // nothing changed: no new presses
    injectedPadStates = new Object[] { null, fakePad(0.9f, 0, 0, "back") };
    MenuInput d = inputTick();
    check("controllers in the menus: stick or D-pad choose, A is OK, Start begins and pauses, Back goes back",
      a.up && a.ok && !a.start && !a.down && b.down && b.start && b.pause && !b.ok && !c.down && !c.start && d.back && d.right && !d.pause,
      "stick up + A: up=" + a.up + " ok=" + a.ok + "; stick down + Start: down=" + b.down + " start=" + b.start + " pause=" + b.pause + "; held: start=" + c.start + "; Back + stick right: back=" + d.back + " right=" + d.right);

    // a controller is the only device at the computer: alone it steers the T-rex together with the keys
    inputReset();
    injectedPadStates = new Object[] { fakePad(0.9f, 0, 0, "x") };
    refreshPads();
    Inp all = pollAll();
    check("controllers: playing alone, the first controller works next to the keys", inpIs(all, 1, false, true, false), inpText(all));
  } catch (Throwable e) {
    check("controllers: made-up controller states", false, e.toString());
  }
  injectedPadStates = null;
  refreshPads();
  inputReset();
}

int countRealPads() {
  Object[] keep = injectedPadStates;
  injectedPadStates = null;
  refreshPads();
  int n = padCount();
  injectedPadStates = keep;
  return n;
}

// ---------------------------------------------------------------- the menus, driven with made-up key presses
void tap(String code) { keyDown(code); tick(); keyUp(code); tick(); }

void runMenuChecks() {
  initDraw();
  inputReset();
  injectedPadStates = new Object[0];                 // no controllers in this check, also when one is plugged in
  app = "title"; sel = 0; S = null;
  tick();
  ArrayList<String> trail = new ArrayList<String>();
  tap("ArrowDown"); tap("ArrowDown"); trail.add("sel " + sel);
  tap("Enter"); trail.add(app);                      // the third entry: controls
  render();
  tap("Escape"); trail.add(app);
  tap("ArrowUp"); tap("Space"); trail.add(app);      // the second entry: the join screen
  boolean controlsOk = eq(trail.get(0), "sel 2") && eq(trail.get(1), "controls") && eq(trail.get(2), "title") && eq(app, "lobby") && devs.isEmpty();
  check("menu: 3 entries; controls opens and Escape goes back; the second entry opens the join screen with nobody joined", controlsOk, joinStr(trail, " -> "));

  // joining: bite button joins, again leaves, Enter needs 2 players
  tap("Space"); tap("KeyF"); tap("KeyH");
  String joined3 = joinStr(devs, ",");
  tap("KeyF");
  String afterLeave = joinStr(devs, ",");
  tap("KeyF"); tap("Numpad0");
  String joined4 = joinStr(devs, ",");
  render();
  // a controller joins with X and begins with Start
  try {
    if (padStateClass != null) {
      injectedPadStates = new Object[] { null, fakePad(0, 0, 0, "x") }; tick();
      injectedPadStates = new Object[] { null, fakePad(0, 0, 0, "") }; tick();
    }
  } catch (Throwable e) { /* reported by the controller checks */ }
  String joined5 = joinStr(devs, ",");
  boolean padJoined = padStateClass == null || eq(joined5, "kb1,kb3,kb2,kb4,pad1");
  tap("Enter");
  boolean started = eq(app, "play") && eq(role, "local") && S != null && S.players.size() == devs.size() && view.me == -1;
  int nPlayers = S != null ? S.players.size() : 0;
  check("join screen: bite joins, bite again leaves, Enter begins with everyone who joined",
    eq(joined3, "kb1,kb2,kb3") && eq(afterLeave, "kb1,kb3") && eq(joined4, "kb1,kb3,kb2,kb4") && padJoined && started,
    joined3 + " -> " + afterLeave + " -> " + joined4 + " -> " + joined5 + " -> a game with " + nPlayers + " T-rexes");
  injectedPadStates = new Object[0];

  // in the game: each device moves its own T-rex; Escape pauses and does not end the program
  if (started) {
    double x0 = S.players.get(0).x, x2 = S.players.get(2).x;
    keyDown("ArrowRight"); keyDown("KeyA");
    for (int i = 0; i < 30; i++) tick();
    keyUp("ArrowRight"); keyUp("KeyA");
    boolean moved = S.players.get(0).x > x0 + 40 && S.players.get(2).x < x2 - 40;
    render();
    int tickAtPause = S.tick;
    tap("Escape");
    boolean paused = eq(app, "pause");
    for (int i = 0; i < 10; i++) tick();
    boolean frozen = S != null && S.tick == tickAtPause;
    render();
    tap("Escape");
    boolean resumed = eq(app, "play");
    tap("Escape"); tap("ArrowDown"); tap("Enter");
    check("in the game: every player steers their own T-rex; Escape pauses, Escape again resumes, quitting goes to the title",
      moved && paused && frozen && resumed && eq(app, "title") && S == null,
      "moved: " + moved + ", paused: " + paused + ", time stood still: " + frozen + ", resumed: " + resumed + ", then: " + app);
  } else check("in the game: every player steers their own T-rex; Escape pauses, Escape again resumes, quitting goes to the title", false, "the game did not start");

  // alone: 2 T-rexes, yours and the computer's, and the end screen goes back to the title
  inputReset();
  app = "title"; sel = 0;
  tick(); tap("Enter");
  boolean solo = eq(app, "play") && eq(role, "solo") && S != null && S.players.size() == 2 && S.players.get(1).ai && view.me == 0;
  // the panel with the T-rex types (its yellow top line) hides under the pause menu and is back after resuming
  int gold = 0xf8d040, at = 60 * W + 100;
  render(); boolean panelBefore = (framePixels[at] & 0xffffff) == gold;
  tap("Escape"); render();
  boolean wasPaused = eq(app, "pause");
  // paused, the picture must be the same as one without the panel (made by pretending the first 5.5 seconds are over)
  int[] pausedPic = framePixels.clone();
  int realTick = S.tick; S.tick = 400; render(); S.tick = realTick;
  boolean panelPaused = false;
  for (int y = 58; y < 116; y++) for (int x = 78; x < 402; x++) if (pausedPic[y * W + x] != framePixels[y * W + x]) panelPaused = true;
  tap("Escape"); render(); boolean panelAfter = (framePixels[at] & 0xffffff) == gold;
  check("the panel with the T-rex types hides under the pause menu and is back after resuming", solo && panelBefore && wasPaused && !panelPaused && panelAfter,
    "before: " + panelBefore + ", paused: " + panelPaused + ", resumed: " + panelAfter);
  if (S != null) {
    S.baby.hp = 0.01d; debugSetStage(S, 1); S.baby.hunger = 0;      // the baby starves in a moment
    for (int i = 0; i < 200; i++) tick();
    render();
  }
  boolean over = S != null && eq(S.mode, "over");
  tap("Space");
  check("playing alone starts 2 T-rexes (1 for the computer); after the end screen Space goes back to the title", solo && over && eq(app, "title"),
    "alone: " + solo + ", game over reached: " + over + ", then: " + app);
  injectedPadStates = null;
  inputReset();
}

// ---------------------------------------------------------------- screenshots without a window
void shot(File dir, String name) {
  File f = new File(dir, name);
  savePicture(f);
  println("saved " + f.getAbsolutePath());
}

// Plays a scene for some steps with the effects running, the test players pressing the buttons.
void play(GameState S, int steps, boolean bots) {
  for (int i = 0; i < steps; i++) { step(S, bots ? botTeam(S) : none(S.players.size())); fxTick(S); }
}

void sceneView(GameState S, boolean together) {
  fxReset(); resetView();
  if (together) { int[] all = new int[S.players.size()]; for (int i = 0; i < all.length; i++) all[i] = i; view = new View(-1, all); }
  else view = new View(0, new int[] { 0 });
}

// The web canvas is never wiped: every frame is drawn over the one before. A screenshot starts from a dark
// picture and draws the frame a few times, so it shows what the screen looks like after a moment.
void drawScene(GameState S, int tick) {
  for (int i = 0; i < 6; i++) { beginFrame(); if (i == 0) R(0, 0, W, H, "#08070d"); renderGame(S, view, tick); }
}

void runShots(File dir) {
  initDraw();
  inputReset();
  injectedPadStates = new Object[0];
  dir.mkdirs();

  // menus
  app = "title"; sel = 0; t = 40; render(); shot(dir, "01_title.png");
  app = "controls"; render(); shot(dir, "02_controls.png");
  app = "lobby"; devs = new ArrayList<String>(); devs.add("kb1"); devs.add("kb2"); devs.add("pad0"); render(); shot(dir, "03_join_3_players.png");
  devs = new ArrayList<String>(); for (String d : DEVICES) devs.add(d); render(); shot(dir, "04_join_8_players.png");

  // alone, near the nest: the first moment (who got which type), and a little later with a raid going on
  GameState S = newGame(1, 13374201);
  sceneView(S, false);
  play(S, 30, false);
  drawScene(S, 30); shot(dir, "05_solo_start.png");
  S.raidCd = 200;
  play(S, 330, false);
  S.players.get(0).x = -60; S.players.get(0).face = -1;
  S.players.get(0).carry = new Carry(2, 40, 1, -2350);
  drawScene(S, 366); shot(dir, "06_solo_near_nest_raid.png");

  // 5 players spread out: the 2 by 2 split
  S = newGame(5, 4242);
  sceneView(S, true);
  double[] xs = { -3600, -30, 30, 1200, 3600 };
  for (int i = 0; i < 5; i++) S.players.get(i).x = xs[i];
  drawScene(S, 10); shot(dir, "07_five_players_start.png");
  play(S, 340, false);
  for (int i = 0; i < 5; i++) S.players.get(i).x = xs[i];
  S.players.get(3).slowT = 100; S.players.get(4).stunT = 30;
  drawScene(S, 350); shot(dir, "08_five_players_2x2.png");
  // one of them walks out of the pane he shares: the arrow at the edge
  S.players.get(2).x = 260;
  drawScene(S, 351); shot(dir, "09_five_players_arrow.png");

  // 2 players far apart: two halves.  8 players at the nest: one pane, 8 chips in the top bar
  S = newGame(2, 777);
  sceneView(S, true);
  play(S, 340, false);
  S.players.get(0).x = -1100; S.players.get(1).x = 4300;
  drawScene(S, 350); shot(dir, "10_two_players_halves.png");
  S = newGame(8, 99);
  sceneView(S, true);
  play(S, 20, false);
  drawScene(S, 20); shot(dir, "11_eight_players_start.png");

  // a boss fight: the warning, then the fight (alone, the computer partner and a test player fighting)
  S = newGame(1, 31);
  sceneView(S, false);
  play(S, 340, false);
  startBoss(S);
  play(S, 100, true);
  drawScene(S, 440 + (20 - 440 % 20) % 20); shot(dir, "12_boss_warning.png");
  int guardT = 0;
  play(S, 200, true);
  while (guardT++ < 900) {                           // until the leader is winding up next to the nest
    play(S, 1, true);
    Dino lead = null;
    for (Dino d : S.dinos) if (d.lead) lead = d;
    if (lead != null && eq(lead.atk, "windup") && Math.abs(lead.x) < 150) break;
  }
  drawScene(S, 600); shot(dir, "13_boss_fight.png");
  // a later boss: stage 3 with 4 players, the leader stunned or recovering if it comes to that
  S = newGame(4, 5);
  sceneView(S, true);
  debugSetStage(S, 2);
  play(S, 340, false);
  startBoss(S);
  play(S, 300 + 260, true);
  drawScene(S, 904); shot(dir, "14_boss_fight_4_players.png");

  // both endings: the scene, and the screen with the result
  for (String kind : new String[] { "meteor", "volcano" }) {
    S = newGame(1, 8);
    sceneView(S, false);
    play(S, 60, false);
    S.tick = 54321; S.stats.meals = 17; S.stats.kills = 41;
    debugFinale(S, kind);
    play(S, 80, false);
    drawScene(S, 80); shot(dir, (eq(kind, "meteor") ? "15" : "18") + "_ending_" + kind + ".png");
    play(S, 52, false);
    drawScene(S, 132); shot(dir, (eq(kind, "meteor") ? "16" : "19") + "_ending_" + kind + "_hit.png");
    play(S, 240, false);
    drawScene(S, 372 + 4); shot(dir, (eq(kind, "meteor") ? "17" : "20") + "_ending_" + kind + "_result.png");
  }

  // the nest has fallen, and the pause screen
  S = newGame(1, 8);
  sceneView(S, false);
  play(S, 400, false);
  hurtBaby(S, 0.5d, true); S.baby.hp = 0.001d; hurtBaby(S, 5, true);
  play(S, 70, false);
  drawScene(S, 480); shot(dir, "21_game_over.png");
  S = newGame(1, 8);
  sceneView(S, false);
  play(S, 400, false);
  GameState keep = this.S;
  this.S = S; app = "pause"; psel = 0; t = 400; render(); shot(dir, "22_pause.png");
  this.S = keep; app = "title";

  // far from home: the sea with its creatures, and the swamp water
  S = newGame(1, 13374201);
  sceneView(S, false);
  play(S, 340, false);
  S.players.get(0).x = 4500;
  play(S, 40, false);
  S.players.get(0).x = 4500;
  drawScene(S, 380); shot(dir, "23_sea_coast.png");
  S.players.get(0).x = -2300; S.players.get(0).y = G;
  play(S, 5, false);
  drawScene(S, 385); shot(dir, "24_swamp_water.png");

  // the marks above creatures: the wind-up !, dizzy stars, health bars (a leader's bar is bright while it
  // is open), eyes in a bush, venom spit; and the meal pips in the top bar (3 of 5)
  S = empty(1, 3);
  sceneView(S, false);
  debugSetStage(S, 2);
  play(S, 340, false);
  S.baby.meals = 3;
  S.players.get(0).x = -1100;
  Dino m1 = put(S, "carnotaurus", -1010, new Opts().raid().boss().lead().hpMul(3));
  m1.atk = "windup"; m1.atkKind = "charge"; m1.atkT = 30; m1.st = "attack"; m1.af = 0; m1.hp = m1.maxHp * 0.7d;
  Dino m2 = put(S, "spinosaurus", -1200, new Opts().raid().boss().lead().hpMul(3));
  m2.atk = "stun"; m2.atkT = 60; m2.st = "hurt"; m2.hp = m2.maxHp * 0.4d; m2.face = 1;
  Dino m3 = put(S, "velociraptor", -1060, new Opts().raid());
  m3.atk = "windup"; m3.atkKind = "pounce"; m3.atkT = 20; m3.st = "attack"; m3.af = 0; m3.hp = m3.maxHp * 0.5d;
  put(S, "dryosaurus", -980);
  Dino m5 = put(S, "iguanodon", -1290);
  m5.hp = m5.maxHp * 0.6d; m5.face = 1;
  Proj spit = new Proj();
  spit.x = -1130; spit.y = G - 12; spit.vx = -3.4d; spit.dmg = 6; spit.life = 40;
  S.projs.add(spit);
  S.boss = new Boss();
  S.boss.stage = 2; S.boss.key = "boss3"; S.boss.side = -1; S.boss.max = m1.maxHp + m2.maxHp; S.boss.hp = m1.hp + m2.hp;
  drawScene(S, 600); shot(dir, "25_marks.png");

  // a pause in the first seconds of a game: the panel with the T-rex types is hidden under the pause menu
  // and is back after resuming
  keep = this.S;
  S = newGame(1, 8);
  sceneView(S, false);
  play(S, 90, false);
  this.S = S; t = 90;
  app = "play"; for (int i = 0; i < 6; i++) render(); shot(dir, "26_early_game_before_pause.png");
  app = "pause"; psel = 0; for (int i = 0; i < 6; i++) render(); shot(dir, "27_early_pause.png");
  app = "play"; for (int i = 0; i < 6; i++) render(); shot(dir, "28_early_game_resumed.png");
  this.S = keep; app = "title";

  // an ending that starts right after both T-rexes and the baby were hit: nobody may blink white through it
  S = newGame(1, 8);
  sceneView(S, false);
  play(S, 60, false);
  hurtPlayer(S, S.players.get(0), 5, 1, ""); hurtPlayer(S, S.players.get(1), 5, -1, "");
  hurtBaby(S, 5);
  int inv0 = S.players.get(0).invT, inv1 = S.players.get(1).invT;
  drawScene(S, 60); shot(dir, "29_hit_in_play.png");
  S.tick = 54321; S.stats.meals = 17; S.stats.kills = 41;
  debugFinale(S, "volcano");
  play(S, 80, false);
  drawScene(S, 80); shot(dir, "30_ending_after_hit.png");
  play(S, 292, false);
  drawScene(S, 376); shot(dir, "31_result_after_hit.png");
  println("hit before the ending: invT was " + inv0 + " and " + inv1 + ", and is " + S.players.get(0).invT + " and " + S.players.get(1).invT + " on the result screen; the baby's hurtT is " + S.baby.hurtT);

  injectedPadStates = null;
  println("Saved 31 screenshots to " + dir.getAbsolutePath());
}

void runSheets(File dir) {
  initDraw();
  dir.mkdirs();
  for (int page = 1; page <= 10; page++) { beginFrame(); drawSheet(page); shot(dir, "sheet_" + page + ".png"); }
}

// ---------------------------------------------------------------- the real window, playing by itself
// Presses keys from a script (through keyDown / keyUp, not through Windows), saves what the window shows
// at a few moments, and writes what happened to autoplay_log.txt. Then it closes the window.
class AutoPlay {
  File dir;
  ArrayList<String> log = new ArrayList<String>();
  String pendingShot = null;
  int shots = 0, w0 = 0, h0 = 0;
  boolean done = false;

  AutoPlay(String folder) {
    dir = new File(folder);
    dir.mkdirs();
    note("window opened: " + width + " x " + height + ", renderer " + g.getClass().getSimpleName());
  }

  void note(String s) { log.add("step " + t + ": " + s); println("AUTOPLAY " + s); }
  void tapKey(int at, String code) { if (t == at) keyDown(code); if (t == at + 3) keyUp(code); }
  void holdKey(int first, int last, String code) { if (t == first) keyDown(code); if (t == last) keyUp(code); }
  void shotAt(int at, String name) { if (t == at) pendingShot = name; }

  void beforeTick() {
    if (done) return;
    if (t == 20) note("title menu, entry " + sel + ", app=" + app);
    shotAt(25, "window_1_title.png");
    tapKey(30, "ArrowDown");
    tapKey(50, "Enter");
    if (t == 70) note("after Down + Enter: app=" + app);
    tapKey(80, "Space"); tapKey(100, "KeyF"); tapKey(120, "KeyH");
    if (t == 140) note("joined: " + joinStr(devs, ","));
    shotAt(145, "window_2_join.png");
    tapKey(160, "Enter");
    if (t == 180) note("after Enter: app=" + app + ", T-rexes " + (S != null ? S.players.size() : 0));
    holdKey(190, 760, "ArrowRight"); holdKey(190, 760, "KeyA");
    tapKey(300, "ArrowUp"); tapKey(330, "Space"); tapKey(360, "KeyW");
    shotAt(420, "window_3_game.png");
    if (t == 770 && S != null) note("after walking 9.5 s: P1 x=" + S.players.get(0).x + ", P2 x=" + S.players.get(1).x + ", P3 x=" + S.players.get(2).x + ", groups " + (layout != null ? layout.size() : 0) + ", frame rate " + Math.round(frameRate));
    shotAt(775, "window_4_split.png");
    if (t == 790) { w0 = width; h0 = height; toggleMaximised(); }
    if (t == 880) note("F11: window was " + w0 + " x " + h0 + ", is now " + width + " x " + height + ", frame rate " + Math.round(frameRate));
    shotAt(885, "window_5_maximised.png");
    if (t == 900) toggleMaximised();
    if (t == 980) note("F11 again: window is " + width + " x " + height);
    tapKey(990, "Escape");
    if (t == 1010) note("after Escape: app=" + app + " (the window is still open)");
    shotAt(1015, "window_6_pause.png");
    tapKey(1030, "ArrowDown"); tapKey(1050, "Enter");
    if (t == 1070) note("after Down + Enter in the pause menu: app=" + app);
    // From here the script sets scenes up directly (like the test links of the web version) and shows
    // them in the real window: 5 players spread out, a boss fight, an ending and its result screen.
    if (t == 1090) {
      devs = new ArrayList<String>();
      for (int i = 0; i < 5; i++) devs.add(DEVICES[i]);
      startGame("local", 5);
      spread();
      note("scene: 5 players at -3600, -30, 30, 1200, 3600");
    }
    shotAt(1110, "window_7_five_players_start.png");
    if (t == 1120 && S != null) { S.tick = 400; spread(); }
    if (t == 1150 && S != null) note("5 players: groups " + (layout != null ? layout.size() : 0) + ", frame rate " + Math.round(frameRate));
    shotAt(1155, "window_8_five_players_split.png");
    if (t == 1170) {
      startGame("solo", 1);
      S.tick = 400;
      startBoss(S);
      S.boss.warnT = 30;
      note("scene: alone, boss wave 1 on its way");
    }
    if (t == 1420 && S != null) note("boss fight: " + (S.boss != null ? S.boss.key + " " + num(S.boss.hp) + " of " + num(S.boss.max) : "over") + ", creatures " + S.dinos.size() + ", baby " + num(S.baby.hp));
    shotAt(1425, "window_9_boss_fight.png");
    if (t == 1440 && S != null) {
      // both T-rexes and the baby are hit in the very step before the ending starts: nobody may stay white
      for (Player p : S.players) { p.invT = 0; p.downT = 0; hurtPlayer(S, p, 3, 0, ""); }
      S.baby.hurtT = 0; hurtBaby(S, 3);
      String hitNote = "hit just before the ending: invT " + S.players.get(0).invT + " and " + S.players.get(1).invT + ", baby hurtT " + S.baby.hurtT;
      S.stats.meals = 15; debugFinale(S, "volcano");
      note("scene: the volcano ending (" + hitNote + ")");
    }
    shotAt(1560, "window_10_ending.png");
    if (t == 1790 && S != null) note("after the ending: mode=" + S.mode + ", ending=" + S.ending);
    shotAt(1800, "window_11_win_screen.png");
    tapKey(1810, "Space");
    if (t == 1830) note("after Space on the result screen: app=" + app);
    if (t == 1840) {
      note("frame rate " + Math.round(frameRate) + ", screenshots " + shots + ", done");
      saveStrings(new File(dir, "autoplay_log.txt").getAbsolutePath(), log.toArray(new String[0]));
      done = true;
      exit();
    }
  }

  void spread() {
    double[] xs = { -3600, -30, 30, 1200, 3600 };
    for (int i = 0; i < xs.length && i < S.players.size(); i++) S.players.get(i).x = xs[i];
  }

  // called after the picture is in the window: this saves exactly what the window shows
  void afterDraw() {
    if (pendingShot == null) return;
    save(new File(dir, pendingShot).getAbsolutePath());
    shots++;
    pendingShot = null;
  }
}
