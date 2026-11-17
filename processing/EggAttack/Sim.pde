// Egg Attack - the game rules (60 steps per second). No drawing code in here.
// This is a port of src/sim.js, in the same order, and it must give exactly the same results:
// the same random numbers, the same order of operations and the same rounding. Test.pde checks that
// with the fingerprint lines of tools/fingerprint.js.
// Every number that can be fractional in JavaScript is a double here, and every decimal literal ends
// in d (Processing turns a bare 0.28 into a float, which would give different results).

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.util.LinkedHashMap;

final int W = 480;
final int H = 270;
final int G = 216;
int WORLD_MIN = -5400;         // set from biomes.json in loadData
int WORLD_MAX = 5400;
int SEA_X = 4250;              // where the sea shore starts
int DEEP_X = 4850;             // where the deep sea starts
final int MAX_DINOS = 30;      // for 2 T-rexes; 3 more for every extra T-rex (see maxDinos)
// How the game grows with more T-rexes. k is the number of T-rexes above 2.
final double MEAL_K = 0.65d;   // meals per stage:      x (1 + 0.65 k)
final double BOSS_K = 0.45d;   // boss leader health:   x (1 + 0.45 k)
final int MAX_FOODS = 24;
final double METEOR_THRESHOLD = 130;   // total damage to the baby that turns the ending into the meteor
final int[] MEALS = { 0, 5, 5, 5 };    // meals the baby needs in stage 1, 2 and 3 (the egg needs none)
final int EGG_T = 3600;        // the egg is ready to hatch after 60 seconds
final int BOSS_WARN = 300;     // 5 second warning before a boss wave

// ---------------------------------------------------------------- data from the JSON files
class Zone {
  String id, name, side, bg, sky, ground, grass, accent;
  int x0, x1, tier;
}

class Water {
  int x0, x1;
  String depth, col, foam;
}

class DinoDef {
  String id, name, group, size, role, special, habitat;
  double hp, speed, damage, reach, w, h;
  String[] biomes;
  int foodTier;
}

class RexDef {
  String id, name, blurb, col;
  double hp, speed, bite, reach, carry, jump, regen, respawn;
}

final ArrayList<Zone> ZONES = new ArrayList<Zone>();
final ArrayList<Water> WATERS = new ArrayList<Water>();
// JavaScript walks the keys of an object in the order of the file. A HashMap does not, so the ids are
// kept in a list in file order, and every loop over creatures or T-rex types uses that list.
final ArrayList<String> DINO_IDS = new ArrayList<String>();
final HashMap<String, DinoDef> DINOS = new HashMap<String, DinoDef>();
final ArrayList<String> REX_IDS = new ArrayList<String>();
final HashMap<String, RexDef> REXES = new HashMap<String, RexDef>();
final HashMap<String, ArrayList<String>> ZONE_KINDS = new HashMap<String, ArrayList<String>>();
boolean dataLoaded = false;

// A small JSON reader that keeps the keys of every object in file order.
class JsonReader {
  final String s;
  int i = 0;

  JsonReader(String s) { this.s = s; }

  void ws() { while (i < s.length() && s.charAt(i) <= ' ') i++; }

  Object value() {
    ws();
    char c = s.charAt(i);
    if (c == '{') {
      LinkedHashMap<String, Object> m = new LinkedHashMap<String, Object>();
      i++; ws();
      if (s.charAt(i) == '}') { i++; return m; }
      while (true) {
        ws();
        String k = quoted();
        ws(); i++;                                   // the colon
        m.put(k, value());
        ws();
        if (s.charAt(i++) == '}') return m;          // otherwise it was a comma
      }
    }
    if (c == '[') {
      ArrayList<Object> a = new ArrayList<Object>();
      i++; ws();
      if (s.charAt(i) == ']') { i++; return a; }
      while (true) {
        a.add(value());
        ws();
        if (s.charAt(i++) == ']') return a;
      }
    }
    if (c == '"') return quoted();
    if (s.startsWith("true", i)) { i += 4; return Boolean.TRUE; }
    if (s.startsWith("false", i)) { i += 5; return Boolean.FALSE; }
    if (s.startsWith("null", i)) { i += 4; return null; }
    int j = i;
    while (j < s.length() && "+-0123456789.eE".indexOf(s.charAt(j)) >= 0) j++;
    double v = Double.parseDouble(s.substring(i, j));
    i = j;
    return Double.valueOf(v);
  }

  String quoted() {
    StringBuilder b = new StringBuilder();
    i++;                                             // the opening quote
    while (s.charAt(i) != '"') {
      char c = s.charAt(i++);
      if (c == '\\') {
        char e = s.charAt(i++);
        if (e == 'n') b.append('\n');
        else if (e == 't') b.append('\t');
        else if (e == 'r') b.append('\r');
        else if (e == 'b') b.append('\b');
        else if (e == 'f') b.append('\f');
        else if (e == 'u') { b.append((char) Integer.parseInt(s.substring(i, i + 4), 16)); i += 4; }
        else b.append(e);
      } else b.append(c);
    }
    i++;
    return b.toString();
  }
}

Object readJson(String fileName) {
  try {
    String text = new String(Files.readAllBytes(new File(dataPath(fileName)).toPath()), StandardCharsets.UTF_8);
    return new JsonReader(text).value();
  } catch (Exception e) {
    throw new RuntimeException("Could not read data/" + fileName + ": " + e);
  }
}

@SuppressWarnings("unchecked")
LinkedHashMap<String, Object> jObj(Object o) { return (LinkedHashMap<String, Object>) o; }
@SuppressWarnings("unchecked")
ArrayList<Object> jArr(Object o) { return (ArrayList<Object>) o; }
double jNum(Object o) { return ((Double) o).doubleValue(); }
int jInt(Object o) { return (int) Math.round(((Double) o).doubleValue()); }
String jStr(Object o) { return o == null ? null : (String) o; }

void loadData() {
  if (dataLoaded) return;
  LinkedHashMap<String, Object> biomes = jObj(readJson("biomes.json"));
  LinkedHashMap<String, Object> dinos = jObj(readJson("dinos.json"));
  LinkedHashMap<String, Object> rexes = jObj(readJson("rexes.json"));

  ZONES.clear(); WATERS.clear(); DINO_IDS.clear(); DINOS.clear(); REX_IDS.clear(); REXES.clear(); ZONE_KINDS.clear();
  WORLD_MIN = jInt(biomes.get("worldMin"));
  WORLD_MAX = jInt(biomes.get("worldMax"));
  for (Object zo : jArr(biomes.get("zones"))) {
    LinkedHashMap<String, Object> o = jObj(zo);
    Zone z = new Zone();
    z.id = jStr(o.get("id")); z.name = jStr(o.get("name")); z.side = jStr(o.get("side"));
    z.x0 = jInt(o.get("x0")); z.x1 = jInt(o.get("x1"));
    z.bg = jStr(o.get("bg")); z.sky = jStr(o.get("sky")); z.ground = jStr(o.get("ground"));
    z.grass = jStr(o.get("grass")); z.accent = jStr(o.get("accent")); z.tier = jInt(o.get("tier"));
    ZONES.add(z);
  }
  for (Object wo : jArr(biomes.get("water"))) {
    LinkedHashMap<String, Object> o = jObj(wo);
    Water w = new Water();
    w.x0 = jInt(o.get("x0")); w.x1 = jInt(o.get("x1"));
    w.depth = jStr(o.get("depth")); w.col = jStr(o.get("col")); w.foam = jStr(o.get("foam"));
    WATERS.add(w);
    if (eq(w.depth, "deep")) DEEP_X = w.x0; else SEA_X = w.x0;   // the last shallow entry is the shore
  }

  for (String k : dinos.keySet()) {
    LinkedHashMap<String, Object> o = jObj(dinos.get(k));
    DinoDef d = new DinoDef();
    d.id = k; d.name = jStr(o.get("name")); d.group = jStr(o.get("group")); d.size = jStr(o.get("size"));
    d.hp = jNum(o.get("hp")); d.speed = jNum(o.get("speed")); d.damage = jNum(o.get("damage"));
    d.reach = jNum(o.get("reach")); d.w = jNum(o.get("w")); d.h = jNum(o.get("h"));
    d.role = jStr(o.get("role")); d.special = jStr(o.get("special")); d.habitat = jStr(o.get("habitat"));
    ArrayList<Object> bm = jArr(o.get("biomes"));
    d.biomes = new String[bm.size()];
    for (int i = 0; i < bm.size(); i++) d.biomes[i] = jStr(bm.get(i));
    d.foodTier = jInt(jObj(o.get("food")).get("tier"));
    DINO_IDS.add(k);
    DINOS.put(k, d);
  }
  for (String k : rexes.keySet()) {
    LinkedHashMap<String, Object> o = jObj(rexes.get(k));
    RexDef r = new RexDef();
    r.id = k; r.name = jStr(o.get("name")); r.blurb = jStr(o.get("blurb")); r.col = jStr(o.get("col"));
    r.hp = jNum(o.get("hp")); r.speed = jNum(o.get("speed")); r.bite = jNum(o.get("bite")); r.reach = jNum(o.get("reach"));
    r.carry = jNum(o.get("carry")); r.jump = jNum(o.get("jump")); r.regen = jNum(o.get("regen")); r.respawn = jNum(o.get("respawn"));
    REX_IDS.add(k);
    REXES.put(k, r);
  }
  for (String k : DINO_IDS) {
    for (String z : DINOS.get(k).biomes) {
      ArrayList<String> list = ZONE_KINDS.get(z);
      if (list == null) { list = new ArrayList<String>(); ZONE_KINDS.put(z, list); }
      list.add(k);
    }
  }
  dataLoaded = true;
}

// ---------------------------------------------------------------- the game state
class Inp {
  int mx;
  boolean jump, bite, grab;
  Inp() { }
  Inp(int mx, boolean jump, boolean bite, boolean grab) { this.mx = mx; this.jump = jump; this.bite = bite; this.grab = grab; }
}

class Ev {
  int n, x, y, v;
  String s;
  boolean hasPos, hasV;
}

class Stats { int fed, meals, kills, bosses; }

class Baby {
  double hp = 100, maxHp = 100, hunger = 100, totalDamage = 0;
  int stage = 0, meals = 0, need = 0, eggT = 0, hurtT = 0, eatT = 0;
}

class Boss {
  int stage, warnT, side;
  String key;
  double max, hp;
}

class Carry {
  int tier, meal;
  double hunger, ox;
  Carry(int tier, double hunger, int meal, double ox) { this.tier = tier; this.hunger = hunger; this.meal = meal; this.ox = ox; }
}

class Player {
  int id, face, downT, invT, biteT, biteCd, slowT, bleedT, stunT, animT;
  String type, anim = "idle";
  double x, y, vx, vy, hp, maxHp;
  boolean g, prevBite, prevGrab, prevJump, ai;
  Carry carry;
}

class Dino {
  int id, face, af, t, cd, hurtT, specT, atkT, hit, tgt, combo;
  String kind, st = "idle", atk = "", atkKind = "";
  double x, y, vx, vy, hp, maxHp, homeX, tx, ty;
  boolean raid, boss, lead, alerted, hidden, rage, called;
}

class Food {
  int id, tier, meal, node, age;
  double x, y, vy, hunger, ox;
}

class Proj {
  double x, y, vx, dmg;
  int life;
}

class Node {
  double x;
  int tier, resp, cd;
}

class GameState {
  int tick = 0, seed = 13374201;
  String mode = "play";        // play, finale, win, over
  boolean paused = false;
  double threat = 0;
  int raidCd = 900, raidSide = 0, raidWarnT = 0, finaleT = 0;
  String ending = "";
  int shake = 0;
  String msg = null;
  int msgT = 0, evN = 0, nextId = 1;
  ArrayList<Ev> evs = new ArrayList<Ev>();
  Stats stats = new Stats();
  Baby baby = new Baby();
  Boss boss = null;            // stage, key, warnT, side, max, hp
  ArrayList<Player> players = new ArrayList<Player>();
  ArrayList<Dino> dinos = new ArrayList<Dino>();
  ArrayList<Food> foods = new ArrayList<Food>();
  ArrayList<Proj> projs = new ArrayList<Proj>();
  ArrayList<Node> nodes = new ArrayList<Node>();
  int[] zcd;
  int[] bushes;
}

// opts of spawnDino: raid, boss, lead, hpMul, force
class Opts {
  boolean raid, boss, lead, force;
  double hpMul = 0;
  Opts raid() { raid = true; return this; }
  Opts boss() { boss = true; return this; }
  Opts lead() { lead = true; return this; }
  Opts force() { force = true; return this; }
  Opts hpMul(double m) { hpMul = m; return this; }
}

// ---------------------------------------------------------------- small helpers
boolean eq(String a, String b) { return a == null ? b == null : a.equals(b); }

// Random numbers come from a seed in the game state, so a game can be replayed exactly.
double rnd(GameState S) {
  S.seed = S.seed * 1664525 + 1013904223;            // int arithmetic wraps like Math.imul(...) | 0
  return (double) (S.seed & 0xffffffffL) / 4294967296.0d;
}
int rndi(GameState S, int a, int b) { return a + (int) Math.floor(rnd(S) * (b - a + 1)); }
double clamp(double v, double lo, double hi) { return v < lo ? lo : v > hi ? hi : v; }
int clampI(int v, int lo, int hi) { return v < lo ? lo : v > hi ? hi : v; }
// Math.round in Java rounds .5 up towards positive infinity, also for negative numbers, like JavaScript.
double jsRound(double v) { return (double) Math.round(v); }
double r1(double v) { return jsRound(v * 10.0d) / 10.0d; }
double r3(double v) { return jsRound(v * 1000.0d) / 1000.0d; }

Zone biomeAt(double x) {
  for (int i = 0; i < ZONES.size(); i++) {
    Zone z = ZONES.get(i);
    if (x >= z.x0 && x <= z.x1) return z;
  }
  return x < 0 ? ZONES.get(0) : ZONES.get(ZONES.size() - 1);
}

String waterAt(double x) {
  for (int i = 0; i < WATERS.size(); i++) {
    Water w = WATERS.get(i);
    if (x >= w.x0 && x <= w.x1) return w.depth;
  }
  return null;
}

// Events tell the drawing code what just happened (for effects). Only the last 14 are kept.
void emit(GameState S, String s, double x, double y) { emitEv(S, s, x, y, false, 0); }
void emit(GameState S, String s, double x, double y, int v) { emitEv(S, s, x, y, true, v); }
void emitEv(GameState S, String s, double x, double y, boolean hasV, int v) {
  S.evN++;
  Ev ev = new Ev();
  ev.n = S.evN; ev.s = s;
  ev.hasPos = true; ev.x = (int) Math.round(x); ev.y = (int) Math.round(y != 0 ? y : G);
  ev.hasV = hasV; ev.v = v;
  S.evs.add(ev);
  if (S.evs.size() > 14) S.evs.remove(0);
}

void say(GameState S, String key, int ticks) { S.msg = key; S.msgT = ticks != 0 ? ticks : 180; }

// ---------------------------------------------------------------- tables
// Food spots: one per biome, plus two scraps by the nest that only fill hunger.  { x, tier, resp }
final int[][] NODE_SPOTS = {
  { -180, 0, 3600 }, { 180, 0, 3600 },
  { -1100, 1, 12000 }, { 1100, 1, 12000 },
  { -2350, 2, 12000 }, { 2350, 2, 12000 },
  { -3600, 3, 12000 }, { 3600, 3, 12000 },
  { -4800, 4, 12000 }, { 4800, 4, 12000 }
};
final int[] BUSH_SPOTS = { -1520, -1260, -980, -760, -610, 620, 930, 1560 };
final int[] HUNGER_BY_TIER = { 12, 30, 40, 50, 65 };
// How many wild creatures each biome keeps (the sea adds a Plesiosaurus and a Mosasaurus on top).
int zoneTargetBase(String id) {
  if (eq(id, "jungle") || eq(id, "river")) return 3;
  if (eq(id, "swamp") || eq(id, "mushroom") || eq(id, "dunes") || eq(id, "crag") || eq(id, "canyon")) return 2;
  if (eq(id, "coast")) return 1;
  return 0;
}

// Raids on the nest, by the baby's stage. One list is picked at random each time.
final String[][][] RAIDS = {
  { { "compsognathus", "compsognathus" } },
  { { "compsognathus", "compsognathus", "compsognathus" }, { "velociraptor", "velociraptor" }, { "dilophosaurus", "compsognathus", "compsognathus" } },
  { { "velociraptor", "velociraptor", "compsognathus" }, { "dilophosaurus", "dilophosaurus", "compsognathus" }, { "pteranodon", "pteranodon" }, { "carnotaurus", "compsognathus", "compsognathus" } },
  { { "carnotaurus", "velociraptor", "velociraptor" }, { "allosaurus", "allosaurus", "dilophosaurus" }, { "pteranodon", "pteranodon", "dilophosaurus" }, { "quetzalcoatlus", "velociraptor", "velociraptor" } }
};
final int[] RAID_GAP = { 1500, 2100, 1950, 1950 };   // steps between raids, by stage

// Boss waves. lead: creature and health multiplier. With two leaders they come from opposite sides.
// Leaders have a lot of health because they only take full damage during their opening (see hurtDino).
class BossDef {
  String key;
  String[] leadKind;
  double[] leadMul;
  String[] pack;
  BossDef(String key, String[] leadKind, double[] leadMul, String[] pack) { this.key = key; this.leadKind = leadKind; this.leadMul = leadMul; this.pack = pack; }
}
final BossDef[] BOSSES = {
  new BossDef("boss1", new String[] { "velociraptor" }, new double[] { 45 }, new String[] { "velociraptor", "velociraptor", "compsognathus", "compsognathus", "compsognathus" }),
  new BossDef("boss2", new String[] { "carnotaurus" }, new double[] { 24 }, new String[] { "dilophosaurus", "dilophosaurus" }),
  new BossDef("boss3", new String[] { "spinosaurus" }, new double[] { 12 }, new String[] { "allosaurus", "quetzalcoatlus" }),
  new BossDef("boss4", new String[] { "tyrannosaurus", "giganotosaurus" }, new double[] { 11, 11 }, new String[] { })
};
final double LEAD_ARMOR = 0.2d;        // share of a bite's damage a boss leader takes outside its opening

// Attack timing in steps. Every attack is wind-up -> strike -> recovery.
int windOf(String size) {
  if (eq(size, "tiny") || eq(size, "small")) return 24;
  if (eq(size, "small-medium")) return 28;
  if (eq(size, "medium")) return 30;
  if (eq(size, "medium-large")) return 34;
  if (eq(size, "large")) return 38;
  if (eq(size, "giant")) return 46;
  if (eq(size, "titan")) return 48;
  return 0;
}
int recoOf(String size) {
  if (eq(size, "tiny") || eq(size, "small")) return 30;
  if (eq(size, "small-medium")) return 32;
  if (eq(size, "medium")) return 34;
  if (eq(size, "medium-large")) return 38;
  if (eq(size, "large")) return 42;
  if (eq(size, "giant") || eq(size, "titan")) return 48;
  return 0;
}
// these can be interrupted
boolean isLight(String size) { return eq(size, "tiny") || eq(size, "small") || eq(size, "small-medium") || eq(size, "medium"); }

// wind/reco 0 means: use the size tables above. cd is the pause before the next attack.
class Move {
  int wind, strike, reco, cd;
  Move(int wind, int strike, int reco, int cd) { this.wind = wind; this.strike = strike; this.reco = reco; this.cd = cd; }
}
final HashMap<String, Move> MOVES = makeMoves();
HashMap<String, Move> makeMoves() {
  HashMap<String, Move> m = new HashMap<String, Move>();
  m.put("bite", new Move(0, 8, 0, 14));
  m.put("sweep", new Move(46, 8, 60, 20));
  m.put("stomp", new Move(30, 8, 40, 120));
  m.put("roar", new Move(46, 8, 30, 30));
  m.put("spit", new Move(30, 8, 30, 50));
  m.put("pounce", new Move(24, 60, 36, 40));
  m.put("charge", new Move(40, 70, 40, 50));
  m.put("dive", new Move(36, 45, 50, 60));
  m.put("lunge", new Move(40, 8, 60, 40));
  return m;
}

// ---------------------------------------------------------------- creating things
// Where T-rex number id stands at the nest when there are n of them (also where it comes back after a knock-out).
double homeX(int id, int n) { return jsRound((id - (n - 1) / 2.0d) * 24); }

// type: one of the 8 T-rex types in rexes.json. ai: the computer plays this one.
Player mkPlayer(int id, int n, String type, boolean ai) {
  double x = homeX(id, n), hp = REXES.get(type).hp;
  Player p = new Player();
  p.id = id; p.type = type; p.x = x; p.y = G; p.vx = 0; p.vy = 0; p.face = x < 0 ? -1 : 1; p.g = true;
  p.hp = hp; p.maxHp = hp; p.downT = 0; p.invT = 0; p.biteT = 0; p.biteCd = 0;
  p.prevBite = false; p.prevGrab = false; p.prevJump = false;
  p.carry = null; p.slowT = 0; p.bleedT = 0; p.stunT = 0; p.ai = ai; p.anim = "idle"; p.animT = 0;
  return p;
}

int extra(GameState S) { return S.players.size() - 2; }                 // T-rexes above 2
int maxDinos(GameState S) { return MAX_DINOS + 3 * extra(S); }

double airCruise(String kind) { return G - (eq(kind, "quetzalcoatlus") ? 82 : 70); }

Dino spawnDino(GameState S, String kind, double x, boolean raid) { Opts o = new Opts(); o.raid = raid; return spawnDino(S, kind, x, o); }

Dino spawnDino(GameState S, String kind, double x, Opts opts) {
  DinoDef def = DINOS.get(kind);
  if (opts == null) opts = new Opts();
  if (def == null || (!opts.force && S.dinos.size() >= maxDinos(S))) return null;
  S.nextId++;
  double y = eq(def.habitat, "air") ? airCruise(kind)
           : (eq(def.habitat, "water") || eq(def.habitat, "deep_water")) ? G + 6 : G;
  double hp = jsRound(def.hp * (opts.hpMul != 0 ? opts.hpMul : 1));
  Dino d = new Dino();
  d.id = S.nextId; d.kind = kind; d.x = r1(x); d.y = r1(y); d.vx = 0; d.vy = 0; d.face = x < 0 ? 1 : -1;
  d.hp = hp; d.maxHp = hp; d.st = "idle"; d.af = 0; d.t = 0; d.cd = rndi(S, 20, 60); d.hurtT = 0;
  d.raid = opts.raid; d.boss = opts.boss; d.lead = opts.lead;
  d.homeX = jsRound(x); d.alerted = false; d.hidden = eq(kind, "dryosaurus") && !opts.raid; d.specT = 0;
  d.atk = ""; d.atkKind = ""; d.atkT = 0; d.hit = 0; d.tgt = -2; d.tx = 0; d.ty = 0; d.combo = 0; d.rage = false; d.called = false;
  S.dinos.add(d);
  return d;
}

// meal: how many meals this meat counts as (0 = snack, hunger only).
// ox: where the meat first appeared. It is kept when the meat is carried and dropped again.
Food spawnFood(GameState S, double x, int tier, int nodeIdx) { return spawnFood(S, x, tier, nodeIdx, jsRound(x)); }

Food spawnFood(GameState S, double x, int tier, int nodeIdx, double ox) {
  if (S.foods.size() >= MAX_FOODS) return null;
  S.nextId++;
  Food f = new Food();
  f.id = S.nextId; f.x = jsRound(x); f.y = G; f.vy = -1.8d; f.tier = tier;
  f.hunger = HUNGER_BY_TIER[tier]; f.meal = tier >= 4 ? 2 : tier >= 1 ? 1 : 0;
  f.node = nodeIdx; f.age = 0; f.ox = ox;
  S.foods.add(f);
  return f;
}

// humans: 1 to 8 people. Playing alone always means 2 T-rexes: yours and one played by the computer.
GameState newGame(int humansIn, int seed) {
  loadData();
  int humans = clampI(humansIn == 0 ? 1 : humansIn, 1, 8);
  int n = humans == 1 ? 2 : humans;
  GameState S = new GameState();
  S.seed = seed;
  for (int i = 0; i < NODE_SPOTS.length; i++) {
    Node nd = new Node();
    nd.x = NODE_SPOTS[i][0]; nd.tier = NODE_SPOTS[i][1]; nd.resp = NODE_SPOTS[i][2]; nd.cd = 0;
    S.nodes.add(nd);
  }
  S.zcd = new int[ZONES.size()];
  S.bushes = BUSH_SPOTS.clone();
  // Deal the T-rex types: shuffle the 8 types with the game's seed and hand them out, so nobody gets the same one.
  String[] types = REX_IDS.toArray(new String[0]);
  for (int i = types.length - 1; i > 0; i--) {
    int j = rndi(S, 0, i);
    String tmp = types[i];
    types[i] = types[j]; types[j] = tmp;
  }
  for (int i = 0; i < n; i++) S.players.add(mkPlayer(i, n, types[i], humans == 1 && i == 1));
  for (int i = 0; i < S.nodes.size(); i++) {
    Node nd = S.nodes.get(i);
    Food f = spawnFood(S, nd.x, nd.tier, i);
    if (f != null) f.vy = 0;
  }
  // Fill every biome with wildlife so the world is alive from the first step.
  for (int pass = 0; pass < 3; pass++) {
    for (int zi = 0; zi < ZONES.size(); zi++) {
      Zone z = ZONES.get(zi);
      if (zoneCount(S, z) < zoneTarget(S, z)) spawnWild(S, z, true);
    }
  }
  spawnSea(S);
  return S;
}

// ---------------------------------------------------------------- the baby
int needOf(GameState S) {
  int st = S.baby.stage;
  return (int) Math.round((st >= 0 && st < MEALS.length ? MEALS[st] : 0) * (1 + MEAL_K * extra(S)));
}

// quiet: no effect and no shake (used for the slow damage of starving).
// A hit never takes more than 14 health, and the baby cannot be hit again for half a second,
// so even a boss at the nest leaves a few seconds to get back and save it.
void hurtBaby(GameState S, double dmg) { hurtBaby(S, dmg, false); }

void hurtBaby(GameState S, double dmg, boolean quiet) {
  if (!eq(S.mode, "play") || dmg <= 0) return;
  Baby b = S.baby;
  if (!quiet) {
    if (b.hurtT > 0) return;
    dmg = Math.min(dmg, 14);
  }
  double actual = Math.min(b.hp, dmg);
  b.hp = r3(Math.max(0, b.hp - dmg));
  b.totalDamage = r3(b.totalDamage + actual);
  if (!quiet) {
    b.hurtT = 30;
    S.shake = Math.max(S.shake, 5);
    emit(S, "babyhit", 0, G - 8);
  }
  if (b.hp <= 0) {
    b.hp = 0;
    S.mode = "over";
    S.finaleT = 0;
    emit(S, "gameover", 0, G);
  }
}

// Returns how many meals this food counted as.
int feedBaby(GameState S, Carry food) {
  Baby b = S.baby;
  b.hunger = clamp(r3(b.hunger + food.hunger), 0, 100);
  b.hp = clamp(r3(b.hp + 2), 0, b.maxHp);
  b.eatT = 30;
  S.stats.fed++;
  int counted = 0;
  if (b.stage == 0) say(S, "egg_hint", 150);
  else if (b.stage <= 3 && S.boss == null && food.meal > 0) {
    if (food.tier >= b.stage) {
      counted = food.meal;
      b.meals = Math.min(needOf(S), b.meals + food.meal);
      S.stats.meals += counted;
    } else say(S, "need_bigger", 150);
  }
  emit(S, counted != 0 ? "meal" : "feed", 0, G - 10, food.tier);
  if (counted != 0 && b.meals >= needOf(S)) startBoss(S);
  return counted;
}

void triggerFinale(GameState S) {
  S.mode = "finale";
  S.finaleT = 0;
  S.ending = S.baby.totalDamage >= METEOR_THRESHOLD ? "meteor" : "volcano";
  S.dinos = new ArrayList<Dino>();
  S.projs = new ArrayList<Proj>();
  S.boss = null;
  // Everybody gathers around the nest, half on each side, facing the baby.
  int n = S.players.size();
  for (int i = 0; i < n; i++) {
    Player p = S.players.get(i);
    boolean left = i % 2 == 0;
    p.x = (left ? -1 : 1) * (46 + (i >> 1) * 26); p.y = G; p.face = left ? 1 : -1; p.downT = 0; p.carry = null; p.vx = 0; p.vy = 0;
  }
  emit(S, eq(S.ending, "meteor") ? "meteor_start" : "volcano_start", 0, 80);
}

// ---------------------------------------------------------------- boss waves
void startBoss(GameState S) {
  if (S.boss != null || !eq(S.mode, "play")) return;
  int st = S.baby.stage;
  Boss B = new Boss();
  B.stage = st; B.key = BOSSES[st].key; B.warnT = BOSS_WARN; B.side = rnd(S) < 0.5d ? -1 : 1; B.max = 0; B.hp = 0;
  S.boss = B;
  emit(S, "bosswarn", S.boss.side * 200, G);
}

void spawnWave(GameState S, Boss B) {
  BossDef def = BOSSES[B.stage];
  int k = extra(S);
  double total = 0;
  for (int i = 0; i < def.leadKind.length; i++) {
    int side = def.leadKind.length == 2 && i == 1 ? -B.side : B.side;
    Dino d = spawnDino(S, def.leadKind[i], side * 430, new Opts().raid().boss().lead().hpMul(def.leadMul[i] * (1 + BOSS_K * k)).force());
    if (d != null) total += d.maxHp;
  }
  // With more T-rexes the pack grows: one more of its first member for every 2 extra T-rexes.
  ArrayList<String> pack = new ArrayList<String>();
  for (String s : def.pack) pack.add(s);
  for (int j = 0; j < (k >> 1); j++) pack.add(def.pack.length > 0 ? def.pack[0] : "allosaurus");
  for (int j = 0; j < pack.size(); j++) {
    Dino d = spawnDino(S, pack.get(j), B.side * (470 + j * 36), new Opts().raid().boss().force());
    if (d != null) total += d.maxHp;
  }
  B.max = total;
  B.hp = total;
  emit(S, "bossin", B.side * 200, G);
}

void bossDefeated(GameState S) {
  Baby b = S.baby;
  S.stats.bosses++;
  S.boss = null;
  b.stage++;
  b.meals = 0;
  b.hp = Math.min(b.maxHp, r3(b.hp + 15));
  b.hunger = 100;
  for (int i = 0; i < S.players.size(); i++) {
    Player p = S.players.get(i);
    p.hp = p.maxHp; p.slowT = 0; p.bleedT = 0; p.stunT = 0;
    if (p.downT > 30) p.downT = 30;
  }
  S.raidCd = RAID_GAP[Math.min(3, b.stage)];
  emit(S, "bossdown", 0, G - 20);
  if (b.stage == 1) { say(S, "hatched", 220); emit(S, "hatch", 0, G - 10); }
  else if (b.stage < 4) say(S, "stage_up", 220);
  if (b.stage >= 4) triggerFinale(S);
}

void stepBoss(GameState S) {
  Boss B = S.boss;
  if (B == null) return;
  if (B.warnT > 0) {
    B.warnT--;
    if (B.warnT % 60 == 0) S.shake = Math.max(S.shake, 3);
    if (B.warnT == 0) spawnWave(S, B);
    return;
  }
  double hp = 0;
  int alive = 0, leads = 0;
  Dino lead = null;
  for (int i = 0; i < S.dinos.size(); i++) {
    Dino d = S.dinos.get(i);
    if (!d.boss) continue;
    hp += Math.max(0, d.hp); alive++;
    if (d.lead) { lead = d; leads++; }
  }
  // The alpha raptor calls two more Compsognathus, once, at half health.
  if (lead != null && eq(lead.kind, "velociraptor") && !lead.called && lead.hp < lead.maxHp / 2) {
    lead.called = true;
    emit(S, "call", lead.x, lead.y - 18);
    for (int j = 0; j < 2; j++) {
      Dino d = spawnDino(S, "compsognathus", B.side * (400 + j * 30), new Opts().raid().boss().force());
      if (d != null) { B.max += d.maxHp; hp += d.maxHp; alive++; }
    }
  }
  // Apex Clash: when one of the two falls, the other gets faster.
  if (B.stage == 3 && leads == 1 && !lead.rage) {
    lead.rage = true;
    emit(S, "rage", lead.x, lead.y - 30);
  }
  B.hp = jsRound(hp);
  if (alive == 0) bossDefeated(S);
}

// ---------------------------------------------------------------- getting hurt
boolean hurtPlayer(GameState S, Player p, double dmg, int kbDir, String status) {
  if (p.downT > 0 || p.invT > 0 || !eq(S.mode, "play")) return false;
  p.hp = r1(Math.max(0, p.hp - dmg));
  p.invT = 36;
  if (kbDir != 0) { p.vx = kbDir * 3.2d; if (p.g) { p.vy = -2.4d; p.g = false; } }
  if (eq(status, "slow")) p.slowT = Math.max(p.slowT, 180);
  if (eq(status, "bleed")) p.bleedT = Math.max(p.bleedT, 210);
  if (eq(status, "stun")) p.stunT = Math.max(p.stunT, 60);
  if (eq(status, "drop") && p.carry != null) { spawnFood(S, p.x, p.carry.tier, -1, p.carry.ox); p.carry = null; }
  emit(S, "phit", p.x, p.y - 14);
  if (p.hp <= 0) {
    p.downT = (int) Math.round(210 * REXES.get(p.type).respawn);
    if (p.carry != null) { spawnFood(S, p.x, p.carry.tier, -1, p.carry.ox); p.carry = null; }
    emit(S, "pdown", p.x, p.y);
  }
  return true;
}

void hurtDino(GameState S, Dino d, double dmg, double attackerX) {
  DinoDef def = DINOS.get(d.kind);
  if (def == null || d.hp <= 0) return;      // already beaten in this step (two T-rexes biting at once): no second kill, no second meat
  if (eq(d.kind, "brachiosaurus")) { emit(S, "clang", d.x, d.y - 24); return; }
  double actual = dmg;
  if (eq(def.special, "armor_club")) {               // Ankylosaurus: only the front is soft
    boolean fromFront = (attackerX - d.x) * d.face > 0;
    if (!fromFront) { actual = Math.max(3, jsRound(dmg * 0.25d)); emit(S, "clang", d.x, d.y - 12); }
  }
  // A boss leader shrugs off most of a bite, except in its opening: while it recovers or is stunned.
  if (d.lead && !eq(d.atk, "recover") && !eq(d.atk, "stun")) {
    actual = Math.max(1, jsRound(actual * LEAD_ARMOR));
    emit(S, "clang", d.x, d.y - 12);
  }
  d.hp = r1(d.hp - actual);
  d.hurtT = 14;
  d.hidden = false;
  d.alerted = true;
  emit(S, "hit", d.x, d.y - 12);
  // Small and medium creatures flinch: a bite during the wind-up cancels their attack.
  if (isLight(def.size) && !d.lead && d.hp > 0) {
    if (eq(d.atk, "windup")) { d.atk = "recover"; d.atkT = 24; d.af = 3; emit(S, "interrupt", d.x, d.y - def.h); }
    else if (d.atk.isEmpty()) { d.atk = "stun"; d.atkKind = ""; d.atkT = 10; d.vx = (d.x < attackerX ? -1 : 1) * 1.8d; }
  }
  if (d.hp <= 0) {
    S.stats.kills++;
    emit(S, "kill", d.x, d.y - 12);
    double dropX = clamp(d.x, WORLD_MIN + 40, DEEP_X - 30);
    // Raiders and bosses come to the nest, so their meat is only a snack. Real meals are out in the wild.
    if (d.raid || d.boss) { if (rnd(S) < 0.5d) spawnFood(S, dropX, 0, -1); }
    else spawnFood(S, dropX, def.foodTier, -1);
  }
}

// ---------------------------------------------------------------- enemy attacks
String statusOf(DinoDef def) {
  String k = def.special;
  return eq(k, "bleed") || eq(k, "tail_bleed") ? "bleed" : eq(k, "ram_stun") ? "stun" : eq(k, "armor_club") ? "slow"
       : eq(k, "snatch_food") || eq(k, "canopy_drop") ? "drop" : "";
}

// tgt: -2 nobody in particular, -1 the nest, 0 and up a player.
void beginAtk(GameState S, Dino d, DinoDef def, String kind, int face, int tgt) {
  d.atk = "windup";
  d.atkKind = kind;
  int wind = MOVES.get(kind).wind;
  if (wind == 0) wind = windOf(def.size);
  if (wind == 0) wind = 30;
  d.atkT = wind;
  d.hit = 0;
  d.tgt = tgt;
  if (face != 0) d.face = face;
  d.vx = 0;
  d.st = "attack";
  d.af = 0;
  emit(S, "tele", d.x, d.y - def.h - 6);
}

// Hits every T-rex in front of the creature (or on both sides). The baby is only hit when the attack
// was aimed at the nest, so a T-rex that draws the attack protects the baby even when standing next to it.
void meleeHit(GameState S, Dino d, DinoDef def, double reach, boolean both) {
  double tolY = Math.max(24, def.h * 0.8d);
  for (int i = 0; i < S.players.size(); i++) {
    Player p = S.players.get(i);
    if (p.downT > 0) continue;
    double rel = (p.x - d.x) * d.face;
    boolean inX = both ? Math.abs(p.x - d.x) <= reach : (rel >= -8 && rel <= reach);
    if (inX && Math.abs(p.y - d.y) <= tolY) hurtPlayer(S, p, def.damage, p.x >= d.x ? 1 : -1, statusOf(def));
  }
  if (d.raid && d.tgt == -1) {
    double rel = (0 - d.x) * d.face;
    if (both ? Math.abs(d.x) <= reach : (rel >= -8 && rel <= reach)) {
      hurtBaby(S, def.damage);
      if (eq(def.special, "steal")) S.baby.hunger = r3(Math.max(0, S.baby.hunger - 3));
    }
  }
}

// How far a creature's bite reaches, measured from its middle. It is close to how far a T-rex can
// bite, so you cannot bite a big creature without standing inside its reach.
double hitRange(DinoDef def) { return def.reach + jsRound(def.w * 0.3d) + 8; }

void strikeStart(GameState S, Dino d, DinoDef def, String k) {
  if (eq(k, "bite")) d.vx = d.face * (isLight(def.size) ? 1.4d : 3);     // big creatures lunge further
  else if (eq(k, "pounce")) { d.vx = d.face * 3.6d; d.vy = -4.3d; }
  else if (eq(k, "charge")) d.vx = d.face * 4.4d;
  else if (eq(k, "dive")) {
    // The dive goes to where the target is right now. Keep moving and it misses.
    Player p = d.tgt >= 0 ? S.players.get(d.tgt) : null;
    d.tx = p != null ? p.x : 0;
    d.ty = p != null ? p.y - 12 : G - 12;
    d.face = d.tx >= d.x ? 1 : -1;
  } else if (eq(k, "lunge")) { d.vy = -3.2d; emit(S, "splash", d.x, G); }
}

void strikeTick(GameState S, Dino d, DinoDef def, String k) {
  ArrayList<Player> players = S.players;
  if (MOVES.get(k).strike <= 8) {
    d.af = d.atkT > 3 ? 1 : 2;
    if (d.atkT <= 4 && eq(k, "bite")) d.vx = 0;
    if (d.atkT != 5) return;                         // the hit lands 3 steps after the strike starts
    if (eq(k, "bite")) {
      meleeHit(S, d, def, hitRange(def), false);
      emit(S, "slash", d.x + d.face * (def.reach * 0.7d + 6), d.y - def.h * 0.5d, d.face);
    } else if (eq(k, "sweep")) {
      meleeHit(S, d, def, hitRange(def) + 10, true);
      S.shake = Math.max(S.shake, 4);
      emit(S, "sweep", d.x, d.y - 8);
    } else if (eq(k, "stomp")) {
      S.shake = Math.max(S.shake, 6);
      emit(S, "stomp", d.x, G);
      for (int i = 0; i < players.size(); i++) {
        Player p = players.get(i);
        if (p.g && Math.abs(p.x - d.x) < 46) hurtPlayer(S, p, def.damage, p.x < d.x ? -1 : 1, "");
      }
    } else if (eq(k, "roar")) {
      S.shake = Math.max(S.shake, 7);
      emit(S, "roar", d.x, d.y - 24);
      d.specT = 420;
      for (int i = 0; i < players.size(); i++) {
        Player p = players.get(i);
        if (p.g && Math.abs(p.x - d.x) < 95) hurtPlayer(S, p, 4, p.x < d.x ? -1 : 1, "stun");
      }
    } else if (eq(k, "spit")) {
      Proj pr = new Proj();
      pr.x = r1(d.x + d.face * 12); pr.y = d.y - 12; pr.vx = d.face * 3.4d; pr.dmg = def.damage; pr.life = 80;
      S.projs.add(pr);
      emit(S, "spit", d.x, d.y - 12);
    } else if (eq(k, "lunge")) {
      S.shake = Math.max(S.shake, eq(def.habitat, "deep_water") ? 7 : 3);
      for (int i = 0; i < players.size(); i++) {
        Player p = players.get(i);
        if (p.downT == 0 && Math.abs(p.x - d.x) <= def.reach + 6 && p.y >= G - 34) hurtPlayer(S, p, def.damage, -1, "");
      }
    }
    return;
  }
  d.af = 1;
  if (eq(k, "pounce")) {
    for (int i = 0; i < players.size(); i++) {
      Player p = players.get(i);
      int bit = 1 << i;
      if ((d.hit & bit) == 0 && p.downT == 0 && Math.abs(p.x - d.x) < 16 && Math.abs(p.y - d.y) < 20) {
        hurtPlayer(S, p, def.damage, d.face, statusOf(def));
        d.hit |= bit;
      }
    }
    if (d.raid && d.tgt == -1 && (d.hit & 256) == 0 && Math.abs(d.x) < 16 && d.y > G - 22) { hurtBaby(S, def.damage); d.hit |= 256; }
    if (d.y >= G && d.atkT < MOVES.get("pounce").strike - 4) d.atkT = 0;      // landed
  } else if (eq(k, "charge")) {
    d.vx = d.face * 4.4d;
    double tolY = Math.max(24, def.h * 0.8d);
    for (int i = 0; i < players.size(); i++) {
      Player p = players.get(i);
      int bit = 1 << i;
      if ((d.hit & bit) == 0 && p.downT == 0 && Math.abs(p.x - d.x) < 22 && Math.abs(p.y - d.y) <= tolY) {
        if (hurtPlayer(S, p, def.damage + 4, d.face, "")) d.hit |= bit;
      }
    }
    // A charge only hurts the baby when it was aimed at the nest (no T-rex was there to take it on).
    if (d.raid && d.tgt == -1 && (d.hit & 256) == 0 && Math.abs(d.x) < 20) { hurtBaby(S, def.damage); d.hit |= 256; d.atkT = 0; }
    if (d.x <= WORLD_MIN + 26 || d.x >= DEEP_X - 42) d.atkT = 0;
  } else if (eq(k, "dive")) {
    double ddx = d.tx - d.x, ddy = d.ty - d.y, dist = Math.sqrt(ddx * ddx + ddy * ddy);
    if (dist <= 6 || d.atkT <= 0) {
      d.vx = 0; d.vy = 0;
      boolean got = false;
      for (int i = 0; i < players.size(); i++) {
        Player p = players.get(i);
        if (p.downT == 0 && Math.abs(p.x - d.x) < 22 && Math.abs((p.y - 12) - d.y) < 24) {
          if (hurtPlayer(S, p, def.damage, d.face, statusOf(def))) got = true;
        }
      }
      if (!got && d.raid && d.tgt == -1 && Math.abs(d.x) < 26) {
        if (eq(def.special, "snatch_food")) {        // Quetzalcoatlus steals the baby's food
          S.baby.hunger = r3(Math.max(0, S.baby.hunger - 15));
          hurtBaby(S, r1(def.damage * 0.5d));
          emit(S, "steal", 0, G - 14);
        } else hurtBaby(S, def.damage);
      }
      d.atkT = 0;
    } else {
      d.vx = r3(ddx / dist * 4.2d);
      d.vy = r3(ddy / dist * 4.2d);
    }
  }
}

void endStrike(GameState S, Dino d, DinoDef def, String k) {
  // A charge that hit nobody ends in a skid: the creature is stunned and wide open.
  if (eq(k, "charge") && d.hit == 0) { d.atk = "stun"; d.atkT = 90; emit(S, "skid", d.x, G); return; }
  d.atk = "recover";
  int reco = MOVES.get(k).reco;
  if (reco == 0) reco = recoOf(def.size);
  if (reco == 0) reco = 34;
  d.atkT = reco;
  if (!eq(def.habitat, "air")) d.vx = 0;
}

// Runs the attack a creature is in the middle of. Returns true while it is busy.
boolean stepAtk(GameState S, Dino d, DinoDef def) {
  if (d.atk.isEmpty()) return false;
  String k = d.atkKind;
  boolean air = eq(def.habitat, "air");
  d.atkT--;
  if (eq(d.atk, "stun")) {
    d.st = "hurt";
    d.vx = r3(d.vx * 0.8d);
    if (air) d.vy = 0;
    if (d.atkT <= 0) { d.atk = ""; d.vx = 0; }
    return true;
  }
  d.st = "attack";
  if (eq(d.atk, "windup")) {
    d.af = 0;
    d.vx = 0;
    if (air) d.vy = 0;
    if (d.atkT <= 0) { d.atk = "strike"; d.atkT = MOVES.get(k).strike; d.af = 1; strikeStart(S, d, def, k); }
    return true;
  }
  if (eq(d.atk, "strike")) {
    strikeTick(S, d, def, k);
    if (eq(d.atk, "strike") && d.atkT <= 0) endStrike(S, d, def, k);
    return true;
  }
  d.af = 3;                                          // recovering: standing still, safe to bite
  if (air) { d.vx = d.face * 1.2d; d.vy = d.y > airCruise(d.kind) ? -1.8d : 0; } else d.vx = 0;
  if (d.atkT <= 0) { d.atk = ""; d.cd = MOVES.get(k) != null ? MOVES.get(k).cd : 14; }
  return true;
}

// ---------------------------------------------------------------- creature behaviour
Player nearestPlayer(GameState S, double x, double maxDist) {
  Player best = null;
  double bd = maxDist;
  for (int i = 0; i < S.players.size(); i++) {
    Player p = S.players.get(i);
    if (p.downT > 0) continue;
    double d = Math.abs(p.x - x);
    if (d < bd) { bd = d; best = p; }
  }
  return best;
}

void wander(GameState S, Dino d, double spd, double range, int period) {
  if (d.t % period == 0) d.face = rnd(S) < 0.5d ? -1 : 1;
  if (Math.abs(d.x - d.homeX) > range) d.face = d.homeX > d.x ? 1 : -1;
  d.vx = (d.t % period < period / 2.0d) ? d.face * spd * 0.45d : 0;
  d.st = Math.abs(d.vx) > 0.1d ? "move" : "idle";
}

void thinkLand(GameState S, Dino d, DinoDef def, double spd) {
  Player nearP = nearestPlayer(S, d.x, 240);

  if (eq(def.role, "hazard")) {                      // Brachiosaurus: peaceful, but do not stand under it
    if (d.cd <= 0 && nearP != null && nearP.g && Math.abs(nearP.x - d.x) < 60) { beginAtk(S, d, def, "stomp", 0, -2); return; }
    if (Math.abs(d.x - d.homeX) > 220) d.face = d.homeX > d.x ? 1 : -1;
    d.vx = d.face * spd;
    d.st = "move";
    return;
  }

  if (eq(def.role, "prey")) {
    if (d.hidden) {
      d.vx = 0; d.st = "idle";
      if (nearP != null && Math.abs(nearP.x - d.x) < 56) { d.hidden = false; d.alerted = true; emit(S, "rustle", d.x, G); }
    } else if (nearP != null && (Math.abs(nearP.x - d.x) < 135 || d.alerted)) {
      if (eq(def.special, "herd_call") && d.specT <= 0) {          // Parasaurolophus warns the herd
        d.specT = 300;
        emit(S, "call", d.x, G - 18);
        for (int i = 0; i < S.dinos.size(); i++) {
          Dino o = S.dinos.get(i);
          DinoDef od = DINOS.get(o.kind);
          if (eq(od.group, "herbivore") && eq(od.role, "prey") && Math.abs(o.x - d.x) < 240) { o.alerted = true; o.hidden = false; }
        }
      }
      d.face = d.x >= nearP.x ? 1 : -1;
      if (d.x < WORLD_MIN + 70) d.face = 1;
      if (d.x > DEEP_X - 90) d.face = -1;
      // Prey stays in its own biome: it turns back when it is far from home, and it never runs into
      // the meadow around the nest (so it cannot be herded home and become a free meal).
      if (Math.abs(d.x - d.homeX) > 450) d.face = d.homeX > d.x ? 1 : -1;
      if (Math.abs(d.x) < 560) d.face = d.x >= 0 ? 1 : -1;
      boolean tired = eq(def.special, "dash_flee") && (d.t % 120 > 80);   // Gallimimus has to catch its breath
      d.vx = tired ? 0 : d.face * spd;
      d.st = tired ? "idle" : "move";
    } else {
      d.alerted = false;
      wander(S, d, spd, 160, 90);
    }
    return;
  }

  if (eq(def.role, "defend")) {                      // peaceful until bitten
    if (d.alerted && nearP != null && Math.abs(d.x - d.homeX) < 420 && Math.abs(nearP.x) > 520) {
      double dx = nearP.x - d.x;
      int dir = dx >= 0 ? 1 : -1;
      if (Math.abs(dx) <= hitRange(def) - 12) {
        d.face = dir; d.vx = 0; d.st = "idle";
        if (d.cd <= 0) beginAtk(S, d, def, "bite", dir, nearP.id);
      } else { d.face = dir; d.vx = dir * spd; d.st = "move"; }
    } else {
      if (nearP == null) d.alerted = false;
      wander(S, d, spd, 140, 110);
    }
    return;
  }

  // Hunters: they guard their territory in the wild, and go for the nest when they raid.
  // A raider goes for a T-rex that is close enough instead of the baby, so a defender at the nest
  // draws its attacks. Boss leaders look for a fight; their pack mostly ignores you and goes for the baby.
  double range = d.lead ? 240 : d.raid ? (d.boss ? 46 : 120) : 185;
  if (eq(def.special, "sprint") && range < 260) range = 260;       // a Carnotaurus charges whoever it sees
  // A raider never follows a T-rex far from the nest: lead it away and it turns back for the baby.
  // A wild hunter gives up when its prey is far from its home or back in the meadow around the nest.
  Player aggro = nearP != null && Math.abs(nearP.x - d.x) < range
    && (d.raid ? Math.abs(nearP.x) < 320 : (Math.abs(nearP.x - d.homeX) < 420 && Math.abs(nearP.x) > 520)) ? nearP : null;
  double goalX = aggro != null ? aggro.x : (d.raid ? 0 : d.homeX);
  double dx = goalX - d.x, adx = Math.abs(dx);
  int dir = dx >= 0 ? 1 : -1;
  String k = def.special;
  int tgt = aggro != null ? aggro.id : -1;
  double trig = hitRange(def) - 12;                  // it starts an attack when its target is this close
  boolean atNest = d.raid && aggro == null && Math.abs(d.x) <= trig;

  if (d.cd <= 0) {
    if (eq(k, "roar") && d.specT <= 0 && aggro != null && adx < 90) { beginAtk(S, d, def, "roar", dir, tgt); return; }
    if (eq(k, "spit") && adx > 55 && adx < 170 && (aggro != null || d.raid)) { beginAtk(S, d, def, "spit", dir, tgt); return; }
    if (eq(k, "pounce")) {
      if (aggro != null && adx > 40 && adx < 105) { beginAtk(S, d, def, "pounce", dir, tgt); return; }
      if (d.raid && aggro == null && adx > 92 && adx < 118) { beginAtk(S, d, def, "pounce", dir, -1); return; }
    }
    if (eq(k, "sprint") && adx > 70 && adx < 260 && (aggro != null || d.raid)) { beginAtk(S, d, def, "charge", dir, tgt); return; }
    if (aggro != null && adx <= trig) {
      d.combo++;
      // Spinosaurus: every third attack is a tail sweep that hits both sides.
      beginAtk(S, d, def, eq(k, "aquatic_boss") && d.combo % 3 == 0 ? "sweep" : "bite", dir, tgt);
      return;
    }
    if (atNest) { beginAtk(S, d, def, "bite", d.x <= 0 ? 1 : -1, -1); return; }
  }
  if ((aggro != null && adx <= trig) || atNest) { d.face = atNest ? (d.x <= 0 ? 1 : -1) : dir; d.vx = 0; d.st = "idle"; }
  else if (d.raid || aggro != null || adx > 30) { d.face = dir; d.vx = dir * spd; d.st = "move"; }
  else wander(S, d, spd, 120, 100);
}

void thinkAir(GameState S, Dino d, DinoDef def, double spd) {
  if (d.cd <= 0) {
    int best = -2;
    double bd = 1e9d;
    double range = eq(d.kind, "microraptor") ? 150 : 120;
    for (int i = 0; i < S.players.size(); i++) {
      Player p = S.players.get(i);
      if (p.downT > 0) continue;
      double dist = Math.abs(p.x - d.x);
      if (dist >= range || (eq(d.kind, "microraptor") && p.carry == null && dist >= 75)) continue;
      double score = dist - (p.carry != null ? 60 : 0);          // they prefer a T-rex that is carrying food
      if (score < bd) { bd = score; best = i; }
    }
    if (best == -2 && d.raid && Math.abs(d.x) < 110) best = -1;
    if (best != -2) {
      double tx = best >= 0 ? S.players.get(best).x : 0;
      beginAtk(S, d, def, "dive", tx >= d.x ? 1 : -1, best);
      d.vy = 0;
      return;
    }
  }
  double mid = d.raid ? 0 : d.homeX, span = d.raid ? 100 : 120;
  if (d.x > mid + span) d.face = -1; else if (d.x < mid - span) d.face = 1;
  d.vx = d.face * spd * (Math.abs(d.x - mid) > span ? 1 : 0.55d);
  d.vy = r3((airCruise(d.kind) - d.y) * 0.08d);
  d.st = "move";
}

double seaRange(DinoDef def) {
  return eq(def.habitat, "deep_water") ? DEEP_X - 20 : SEA_X + 20;
}

void thinkWater(GameState S, Dino d, DinoDef def, double spd) {
  boolean deep = eq(def.habitat, "deep_water");
  double minX = seaRange(def), maxX = WORLD_MAX - 30;
  Player wader = nearestPlayer(S, d.x, deep ? 260 : 180);
  if (wader != null && wader.x >= minX - 45) {
    double dx = wader.x - d.x;
    d.face = dx >= 0 ? 1 : -1;
    if (Math.abs(dx) > def.reach) { d.vx = d.face * spd; d.st = "move"; }
    else { d.vx = 0; d.st = "idle"; if (d.cd <= 0) beginAtk(S, d, def, "lunge", d.face, wader.id); }
  } else {
    if (d.x <= minX + 15) d.face = 1;
    if (d.x >= maxX - 15) d.face = -1;
    d.vx = d.face * spd * 0.55d;
    d.st = "move";
  }
}

void stepDino(GameState S, Dino d) {
  DinoDef def = DINOS.get(d.kind);
  if (def == null) return;
  d.t++;
  if (d.cd > 0) d.cd--;
  if (d.hurtT > 0) d.hurtT--;
  if (d.specT > 0) d.specT--;
  boolean air = eq(def.habitat, "air"), wet = eq(def.habitat, "water") || eq(def.habitat, "deep_water");

  double spd = def.speed * (d.rage ? 1.2d : 1);
  if (!air && !wet) {
    String water = waterAt(d.x);
    if (water != null && (eq(def.special, "aquatic_fast") || eq(def.special, "aquatic_boss"))) spd *= 1.35d;
    else if (eq(water, "shallow")) spd *= 0.8d;
  }

  if (!stepAtk(S, d, def)) {
    if (air) thinkAir(S, d, def, spd);
    else if (wet) thinkWater(S, d, def, spd);
    else thinkLand(S, d, def, spd);
  }

  if (air) {
    d.x = r1(clamp(d.x + d.vx, WORLD_MIN + 30, WORLD_MAX - 30));
    d.y = r1(clamp(d.y + d.vy, 28, G - 8));
  } else if (wet) {
    double baseY = G + (eq(def.habitat, "deep_water") ? 9 : 5);
    d.x = r1(clamp(d.x + d.vx, seaRange(def), WORLD_MAX - 30));
    d.vy += 0.22d;
    d.y = r1(d.y + d.vy);
    if (d.y > baseY) { d.y = baseY; d.vy = 0; }
  } else {
    d.x = r1(clamp(d.x + d.vx, WORLD_MIN + 24, DEEP_X - 40));
    d.vy += 0.28d;
    d.y = r1(d.y + d.vy);
    if (d.y >= G) { d.y = G; d.vy = 0; }
  }
  if (d.hurtT > 0 && d.atk.isEmpty()) d.st = "hurt";
}

// ---------------------------------------------------------------- computer-controlled T-rex
class Danger {
  int mx = 0, face = 0;
  boolean jump = false, bite = false;
}

// Looks at every attack that is being wound up or is in flight, and says how to stay out of it.
Danger danger(GameState S, Player p) {
  Danger out = new Danger();
  for (int i = 0; i < S.dinos.size(); i++) {
    Dino d = S.dinos.get(i);
    if (!eq(d.atk, "windup") && !eq(d.atk, "strike")) continue;
    DinoDef def = DINOS.get(d.kind);
    String k = d.atkKind;
    double off = p.x - d.x, adx = Math.abs(off);
    int away = off >= 0 ? 1 : -1;
    boolean front = off * d.face >= -12;
    if (eq(k, "bite") || eq(k, "sweep")) {
      double reach = hitRange(def) + (eq(k, "sweep") ? 10 : 0) + (isLight(def.size) ? 6 : 12);
      if ((front || eq(k, "sweep")) && adx <= reach) {
        int toHit = eq(d.atk, "windup") ? d.atkT + 3 : d.atkT - 5;     // steps until the bite lands
        if (toHit < 0 || !p.g) continue;
        if (toHit <= 18 && toHit >= 9) out.jump = true;                 // jump over it and keep the position
        else if (toHit < 9) out.mx = away;                              // too late to jump: step out
      }
    }
    else if (eq(k, "stomp")) { if (adx <= 66) out.mx = away; }
    else if (eq(k, "lunge")) { if (adx <= def.reach + 30) out.mx = away; }
    else if (eq(k, "roar")) {
      if (adx <= 112) { out.mx = away; if (eq(d.atk, "windup") && d.atkT <= 8 && p.g) out.jump = true; }
    } else if (eq(k, "charge")) {
      if (front && adx < 330) {
        if (eq(d.atk, "strike")) { if (adx < 62 && p.g) out.jump = true; } else out.mx = away;
      }
    } else if (eq(k, "pounce")) {
      // Only run from a pounce that is aimed at me. One aimed at the nest lands in bite range instead.
      if (d.tgt == p.id && front && adx < 140) out.mx = away;
    } else if (eq(k, "dive")) {
      if (d.tgt != p.id) continue;
      if (eq(d.atk, "strike")) { if (Math.abs(d.tx - p.x) < 40) out.mx = p.x >= d.tx ? 1 : -1; }
      else out.mx = away;
    }
  }
  for (int i = 0; i < S.projs.size(); i++) {
    Proj pr = S.projs.get(i);
    if ((p.x - pr.x) * pr.vx <= 0 || Math.abs(p.x - pr.x) >= 48 || Math.abs((p.y - 14) - pr.y) >= 18) continue;
    if (p.biteCd <= 0 && p.carry == null) { out.bite = true; out.face = pr.x >= p.x ? 1 : -1; }   // snap the spit out of the air
    else if (p.g) out.jump = true;
  }
  return out;
}

void biteAt(Inp inp, Player p, int dir) {
  if (p.face != dir) inp.mx = dir;                   // turn first
  else if (p.biteCd <= 0) inp.bite = !p.prevBite;
}

// Input for fighting one creature: stay out of its attacks, bite when it is safe.
Inp fight(GameState S, Player p, Dino t) {
  Inp inp = new Inp();
  DinoDef def = DINOS.get(t.kind);
  double dx = t.x - p.x, adx = Math.abs(dx);
  int dir = dx >= 0 ? 1 : -1;
  double range = 42 * REXES.get(p.type).reach - 8 + def.w * 0.38d;      // a little inside how far this T-rex can bite
  boolean high = t.y < G - 40;
  // A small creature that is winding up can be stopped with a bite.
  if (isLight(def.size) && !t.lead && eq(t.atk, "windup") && adx <= range && !high && p.biteCd <= 0) { biteAt(inp, p, dir); return inp; }
  Danger dg = danger(S, p);
  if (dg.mx != 0 || dg.jump) { inp.mx = dg.mx; inp.jump = dg.jump && !p.prevJump; return inp; }
  if (dg.bite) { biteAt(inp, p, dg.face); return inp; }
  if (high) {                                        // a flyer: get under it, jump, bite at the top
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
Inp guard(GameState S, Player m) {
  Inp inp = new Inp();
  if (m.downT > 0 || m.stunT > 0) return inp;
  if (m.carry != null) {
    Danger dg = danger(S, m);
    if (Math.abs(m.x) > 20) inp.mx = m.x > 0 ? -1 : 1;
    inp.jump = dg.jump && !m.prevJump;
    return inp;
  }
  if (Math.abs(m.x) > 320) {                         // never wander off: the baby comes first
    Danger dg = danger(S, m);
    inp.mx = m.x > 0 ? -1 : 1;
    inp.jump = dg.jump && !m.prevJump;
    return inp;
  }
  Dino t = null;
  double best = 1e9d;
  for (int i = 0; i < S.dinos.size(); i++) {
    Dino d = S.dinos.get(i);
    DinoDef def = DINOS.get(d.kind);
    if (eq(def.role, "hazard") || Math.abs(d.x) > 400) continue;
    boolean hostile = d.raid || d.boss || (d.alerted && !eq(def.role, "prey")) || (!d.atk.isEmpty() && Math.abs(d.x - m.x) < 120);
    if (!hostile) continue;
    double score = Math.abs(d.x) + Math.abs(d.x - m.x) * 0.3d + (d.lead ? 60 : 0);   // closest to the baby first
    if (score < best) { best = score; t = d; }
  }
  if (t != null) return fight(S, m, t);
  Danger dg = danger(S, m);
  if (dg.mx != 0 || dg.jump) { inp.mx = dg.mx; inp.jump = dg.jump && !m.prevJump; return inp; }
  if (dg.bite) { biteAt(inp, m, dg.face); return inp; }
  if (S.boss == null) {
    Food f = null;
    double bf = 1e9d;
    for (int i = 0; i < S.foods.size(); i++) {
      Food o = S.foods.get(i);
      if (Math.abs(o.x) <= 30 || Math.abs(o.x) >= 210) continue;
      if (o.meal == 0 && S.baby.hunger > 85) continue;           // do not waste snacks on a full baby
      double dd = Math.abs(o.x - m.x);
      if (dd < bf) { bf = dd; f = o; }
    }
    if (f != null) {
      if (Math.abs(f.x - m.x) > 14) inp.mx = f.x > m.x ? 1 : -1; else inp.grab = !m.prevGrab;
      return inp;
    }
  }
  // Wait next to the nest, on the side the next raid or boss is coming from.
  int side = S.boss != null ? S.boss.side : S.raidWarnT > 0 ? S.raidSide : (m.id % 2 != 0 ? 1 : -1);
  int home = side * (30 + (m.id >> 1) * 16);
  if (Math.abs(m.x - home) > 18) inp.mx = m.x > home ? -1 : 1;
  return inp;
}

// ---------------------------------------------------------------- the T-rexes
final Inp NO_INPUT = new Inp();

void stepPlayer(GameState S, Player p, Inp raw) {
  Inp inp = p.ai ? guard(S, p) : (raw != null ? raw : NO_INPUT);
  RexDef T = REXES.get(p.type);                      // this T-rex's type: health, speed, bite, reach, ...

  if (p.invT > 0) p.invT--;
  if (p.biteCd > 0) p.biteCd--;
  if (p.slowT > 0) p.slowT--;
  if (p.stunT > 0) p.stunT--;
  if (p.bleedT > 0) { p.bleedT--; p.hp = r3(Math.max(1, p.hp - 0.06d)); }

  if (p.downT > 0) {
    p.downT--;
    p.anim = "hurt";
    if (p.downT == 0) {
      p.x = homeX(p.id, S.players.size()); p.y = G; p.vx = 0; p.vy = 0; p.g = true;
      p.hp = p.maxHp; p.invT = 90; p.slowT = 0; p.bleedT = 0; p.stunT = 0;
      emit(S, "respawn", p.x, p.y);
    }
    p.prevBite = inp.bite; p.prevGrab = inp.grab; p.prevJump = inp.jump;
    return;
  }

  // Everyone heals at the nest. A Mender also heals out in the wild, more slowly.
  if (p.hp < p.maxHp && p.bleedT == 0) {
    if (Math.abs(p.x) < 80) p.hp = r3(Math.min(p.maxHp, p.hp + 0.04d));
    else if (T.regen != 0) p.hp = r3(Math.min(p.maxHp, p.hp + 0.02d));
  }

  String water = waterAt(p.x);
  double groundY = eq(water, "deep") ? G + 7 : G;
  double spd = 2.45d * T.speed;
  if (p.carry != null) spd *= T.carry;
  if (p.slowT > 0) spd *= 0.58d;
  if (eq(water, "shallow")) spd *= 0.75d; else if (eq(water, "deep")) spd *= 0.56d;

  int mx = p.stunT > 0 ? 0 : clampI(inp.mx, -1, 1);
  if (mx != 0) p.face = mx;
  if (Math.abs(p.vx) > spd) p.vx *= 0.86d; else p.vx = mx * spd;

  boolean jumpEdge = inp.jump && !p.prevJump, biteEdge = inp.bite && !p.prevBite, grabEdge = inp.grab && !p.prevGrab;
  p.prevJump = inp.jump; p.prevBite = inp.bite; p.prevGrab = inp.grab;

  if (jumpEdge && p.g && p.stunT <= 0) {
    p.vy = (eq(water, "deep") ? -3.4d : -5.2d) * T.jump;
    p.g = false;
    emit(S, "jump", p.x, p.y);
  }

  if (grabEdge && p.stunT <= 0) {
    if (p.carry != null) {
      if (Math.abs(p.x) <= 36) { feedBaby(S, p.carry); p.carry = null; }
      else { spawnFood(S, p.x + p.face * 10, p.carry.tier, -1, p.carry.ox); p.carry = null; emit(S, "drop", p.x, p.y); }
    } else {
      int bestIdx = -1;
      double bestDist = 28;
      for (int i = 0; i < S.foods.size(); i++) {
        double d = Math.abs(S.foods.get(i).x - p.x);
        if (d < bestDist) { bestDist = d; bestIdx = i; }
      }
      if (bestIdx >= 0) {
        Food f = S.foods.remove(bestIdx);
        if (f.node >= 0 && f.node < S.nodes.size()) S.nodes.get(f.node).cd = S.nodes.get(f.node).resp;
        p.carry = new Carry(f.tier, f.hunger, f.meal, f.ox);
        emit(S, "pickup", p.x, p.y);
      }
    }
  }

  // Walking onto the nest with food feeds the baby.
  if (p.carry != null && Math.abs(p.x) <= 28 && eq(S.mode, "play")) { feedBaby(S, p.carry); p.carry = null; }

  if (biteEdge && p.carry == null && p.biteCd <= 0 && p.stunT <= 0) {
    p.biteT = 15;
    p.biteCd = 22;
    p.vx = p.face * 1.9d;
    emit(S, "bite", p.x + p.face * 16, p.y - 14, p.face);
  }
  if (p.biteT > 0) {
    p.biteT--;
    if (p.biteT == 11) {
      double bx = p.x + p.face * 20 * T.reach;
      for (int i = S.dinos.size() - 1; i >= 0; i--) {
        Dino d = S.dinos.get(i);
        DinoDef def = DINOS.get(d.kind);
        if (Math.abs(d.x - bx) <= 22 * T.reach + def.w * 0.38d && Math.abs((d.y - 10) - (p.y - 14)) <= 34) hurtDino(S, d, T.bite, p.x);
      }
      for (int i = S.projs.size() - 1; i >= 0; i--) {
        if (Math.abs(S.projs.get(i).x - bx) < 22) S.projs.remove(i);
      }
    }
  }

  p.x = r1(clamp(p.x + p.vx, WORLD_MIN + 20, WORLD_MAX - 20));
  p.vy += 0.28d;
  p.y = r1(p.y + p.vy);
  if (p.y >= groundY) { p.y = groundY; p.vy = 0; p.g = true; }

  p.animT++;
  p.anim = p.biteT > 0 ? "attack" : p.stunT > 0 ? "hurt" : Math.abs(p.vx) > 0.2d ? "move" : "idle";
}

// ---------------------------------------------------------------- wildlife and raids
boolean isWild(Dino d) { return !d.raid && !d.boss; }

// More T-rexes need more prey: one more creature per biome for every 2 extra T-rexes.
int zoneTarget(GameState S, Zone z) { int t = zoneTargetBase(z.id); return t != 0 ? t + (extra(S) >> 1) : 0; }

int zoneCount(GameState S, Zone z) {
  int n = 0;
  for (int i = 0; i < S.dinos.size(); i++) {
    Dino d = S.dinos.get(i);
    String hab = DINOS.get(d.kind).habitat;
    if (isWild(d) && (eq(hab, "land") || eq(hab, "air")) && d.homeX >= z.x0 && d.homeX <= z.x1) n++;
  }
  return n;
}

boolean spawnWild(GameState S, Zone z, boolean initial) {
  ArrayList<String> all = new ArrayList<String>();
  ArrayList<String> zk = ZONE_KINDS.get(z.id);
  if (zk != null) for (String k : zk) { String hab = DINOS.get(k).habitat; if (eq(hab, "land") || eq(hab, "air")) all.add(k); }
  if (all.isEmpty()) return false;
  ArrayList<Dino> here = new ArrayList<Dino>();
  for (Dino d : S.dinos) if (isWild(d) && d.homeX >= z.x0 && d.homeX <= z.x1) here.add(d);
  ArrayList<String> pool = new ArrayList<String>();          // variety first
  for (String k : all) {
    boolean has = false;
    for (Dino d : here) if (eq(d.kind, k)) { has = true; break; }
    if (!has) pool.add(k);
  }
  if (pool.isEmpty()) pool = all;
  // Every biome always has something that counts as a meal.
  boolean hasMeal = false;
  for (Dino d : here) if (DINOS.get(d.kind).foodTier > 0) { hasMeal = true; break; }
  if (!hasMeal) {
    ArrayList<String> meals = new ArrayList<String>();
    for (String k : pool) if (DINOS.get(k).foodTier > 0) meals.add(k);
    if (!meals.isEmpty()) pool = meals;
  }
  String kind = pool.get(rndi(S, 0, pool.size() - 1));
  int x = rndi(S, z.x0 + 90, z.x1 - 90);
  if (eq(DINOS.get(kind).habitat, "land") && x > DEEP_X - 90) x = DEEP_X - 90 - rndi(S, 0, 200);
  if (eq(kind, "dryosaurus")) {                      // it hides in a bush
    ArrayList<Integer> bushes = new ArrayList<Integer>();
    for (int b : S.bushes) if (b >= z.x0 && b <= z.x1) bushes.add(b);
    if (!bushes.isEmpty()) x = bushes.get(rndi(S, 0, bushes.size() - 1));
  }
  if (!initial) {
    for (int i = 0; i < S.players.size(); i++) if (Math.abs(S.players.get(i).x - x) < 380) return false;   // never pop up on screen
  }
  return spawnDino(S, kind, x, new Opts()) != null;
}

void spawnSea(GameState S) {
  boolean ples = false, mosa = false;
  for (Dino d : S.dinos) if (eq(d.kind, "plesiosaurus")) { ples = true; break; }
  if (!ples) spawnDino(S, "plesiosaurus", SEA_X + 300, new Opts().force());
  for (Dino d : S.dinos) if (eq(d.kind, "mosasaurus")) { mosa = true; break; }
  if (!mosa) spawnDino(S, "mosasaurus", DEEP_X + 280, new Opts().force());
}

void stepSpawners(GameState S) {
  for (int i = 0; i < S.nodes.size(); i++) {
    Node n = S.nodes.get(i);
    if (n.cd > 0 && --n.cd == 0) spawnFood(S, n.x, n.tier, i);
  }

  // Wildlife grows back slowly: at most one creature per biome every 15 seconds.
  for (int i = 0; i < S.zcd.length; i++) if (S.zcd[i] > 0) S.zcd[i]--;
  if (S.tick % 150 == 0) {
    for (int zi = 0; zi < ZONES.size(); zi++) {
      Zone z = ZONES.get(zi);
      if (S.zcd[zi] > 0 || zoneCount(S, z) >= zoneTarget(S, z)) continue;
      if (spawnWild(S, z, false)) { S.zcd[zi] = (int) Math.round(900 / (1 + 0.4d * extra(S))); break; }
    }
  }
  if (S.tick % 1800 == 0) spawnSea(S);

  // Raids. They pause while a boss wave is on its way or alive.
  if (S.raidWarnT > 0) S.raidWarnT--;
  if (S.boss != null) return;
  if (--S.raidCd > 0) return;
  int raiders = 0;
  for (int i = 0; i < S.dinos.size(); i++) if (S.dinos.get(i).raid) raiders++;
  if (raiders >= 4 + extra(S) || S.dinos.size() >= maxDinos(S) - 3) { S.raidCd = 300; return; }   // the last raid is not over yet
  int st = Math.min(3, S.baby.stage);
  String[] pick = RAIDS[st][rndi(S, 0, RAIDS[st].length - 1)];
  ArrayList<String> list = new ArrayList<String>();
  for (String s : pick) list.add(s);
  for (int j = 0; j < (extra(S) >> 1); j++) list.add(list.get(0));      // bigger raids for bigger groups
  int side = rnd(S) < 0.5d ? -1 : 1;
  for (int i = 0; i < list.size(); i++) spawnDino(S, list.get(i), side * (520 + i * 34), new Opts().raid());
  S.raidSide = side;
  S.raidWarnT = 180;
  S.raidCd = RAID_GAP[st];
  emit(S, "raid", side * 200, G);
}

// ---------------------------------------------------------------- one step of the whole game
void step(GameState S, Inp[] inputs) {
  if (S == null || S.paused) return;

  if (S.shake > 0) S.shake--;
  if (S.msgT > 0 && --S.msgT == 0) S.msg = null;

  if (eq(S.mode, "finale")) {
    S.finaleT++;
    if (S.finaleT % 20 == 0) S.shake = eq(S.ending, "meteor") && S.finaleT > 110 ? 10 : 5;
    if (S.finaleT == 120) emit(S, eq(S.ending, "meteor") ? "meteor_hit" : "volcano_boom", 0, G);
    if (S.finaleT >= 270) S.mode = "win";
    return;
  }
  if (eq(S.mode, "win") || eq(S.mode, "over")) { S.finaleT++; return; }

  S.tick++;
  Baby b = S.baby;
  if (b.hurtT > 0) b.hurtT--;
  if (b.eatT > 0) b.eatT--;
  b.need = needOf(S);

  if (b.stage == 0) {
    // The egg only needs time. When it is ready to hatch, the first boss wave smells it.
    if (S.boss == null && ++b.eggT >= EGG_T) startBoss(S);
  } else {
    boolean fighting = S.boss != null && S.boss.warnT == 0;
    b.hunger = r3(Math.max(0, b.hunger - (fighting ? 0.004d : 0.01d)));      // 60% slower during a boss fight
    if (b.hunger <= 0) {
      if (S.tick % 90 == 0) { say(S, "starving", 85); emit(S, "babyhit", 0, G - 8); }
      hurtBaby(S, 0.02d, true);
      if (!eq(S.mode, "play")) return;
    } else if (b.hunger > 40 && b.hp < b.maxHp) b.hp = r3(Math.min(b.maxHp, b.hp + 0.004d));   // a fed baby heals slowly
  }
  S.threat = r1(Math.min(10, b.stage * 2.5d + (b.stage == 0 ? b.eggT / (double) EGG_T : b.need != 0 ? b.meals / (double) b.need : 0) * 2));

  for (int i = 0; i < S.players.size(); i++) stepPlayer(S, S.players.get(i), inputs != null && i < inputs.length ? inputs[i] : null);

  for (int i = S.dinos.size() - 1; i >= 0; i--) {
    Dino d = S.dinos.get(i);
    if (d.hp <= 0) { S.dinos.remove(i); continue; }
    stepDino(S, d);
    if (d.hp <= 0) S.dinos.remove(i);
  }
  if (!eq(S.mode, "play")) return;

  // Venom spit flies in a straight line. It can be jumped over or bitten out of the air.
  for (int i = S.projs.size() - 1; i >= 0; i--) {
    Proj pr = S.projs.get(i);
    pr.x = r1(pr.x + pr.vx);
    pr.life--;
    boolean hit = false;
    for (int j = 0; j < S.players.size(); j++) {
      Player p = S.players.get(j);
      if (p.downT == 0 && Math.abs(p.x - pr.x) < 14 && Math.abs((p.y - 14) - pr.y) < 16) {
        hurtPlayer(S, p, pr.dmg, pr.vx >= 0 ? 1 : -1, "slow");
        hit = true;
        break;
      }
    }
    if (!hit && Math.abs(pr.x) < 18 && Math.abs((G - 10) - pr.y) < 18) { hurtBaby(S, pr.dmg); hit = true; }
    if (hit || pr.life <= 0) S.projs.remove(i);
  }
  if (!eq(S.mode, "play")) return;

  for (int i = S.foods.size() - 1; i >= 0; i--) {
    Food f = S.foods.get(i);
    if (f.y < G || f.vy != 0) {
      f.vy += 0.25d;
      f.y = r1(Math.min(G, f.y + f.vy));
      if (f.y >= G) f.vy = 0;
    }
    if (f.node < 0 && ++f.age > 5400) S.foods.remove(i);       // dropped meat rots after 90 seconds
  }

  stepBoss(S);
  if (!eq(S.mode, "play")) return;
  stepSpawners(S);
}

// ---------------------------------------------------------------- camera for several players on one screen
class CamGroup {
  double x, lo, hi;                                  // x: where the camera looks
  ArrayList<Integer> who = new ArrayList<Integer>(); // player numbers
}

// Splits T-rex positions into groups that each fit in one pane, at most maxPanes of them.
// Returns groups from left to right.
ArrayList<CamGroup> cameraGroups(double[] xs, int maxPanes) {
  ArrayList<CamGroup> groups = new ArrayList<CamGroup>();
  int n = xs.length;
  if (n == 0) return groups;
  int[] order = new int[n];
  for (int i = 0; i < n; i++) order[i] = i;
  for (int i = 1; i < n; i++) {                      // sort by position, then by number
    int v = order[i], j = i - 1;
    while (j >= 0 && (xs[order[j]] > xs[v] || (xs[order[j]] == xs[v] && order[j] > v))) { order[j + 1] = order[j]; j--; }
    order[j + 1] = v;
  }
  double span = xs[order[n - 1]] - xs[order[0]];
  if (span <= 400) {                                 // everyone fits on one screen
    CamGroup g = new CamGroup();
    g.lo = xs[order[0]]; g.hi = xs[order[n - 1]];
    for (int i : order) g.who.add(i);
    groups.add(g);
  } else {
    for (int i : order) {
      CamGroup g = groups.isEmpty() ? null : groups.get(groups.size() - 1);
      if (g != null && xs[i] - g.lo <= 200) { g.hi = xs[i]; g.who.add(i); }
      else { CamGroup ng = new CamGroup(); ng.lo = xs[i]; ng.hi = xs[i]; ng.who.add(i); groups.add(ng); }
    }
  }
  // Too many groups: join the two neighbours that make the narrowest group together, until they fit.
  while (groups.size() > maxPanes) {
    int best = 0;
    double gap = Double.POSITIVE_INFINITY;
    for (int g = 0; g < groups.size() - 1; g++) {
      double d = groups.get(g + 1).hi - groups.get(g).lo;
      if (d < gap) { gap = d; best = g; }
    }
    CamGroup a = groups.get(best), b = groups.get(best + 1);
    CamGroup m = new CamGroup();
    m.lo = a.lo; m.hi = b.hi;
    m.who.addAll(a.who); m.who.addAll(b.who);
    groups.remove(best + 1);
    groups.set(best, m);
  }
  for (CamGroup g : groups) g.x = jsRound((g.lo + g.hi) / 2);
  return groups;
}

// ---------------------------------------------------------------- shortcuts for tests and screenshots
// (sim.debug in the web version; startBoss, hurtBaby, hurtDino, hurtPlayer and spawnFood are called directly.)
// Puts the baby at the start of a stage (1 to 3), as if the bosses before it were beaten.
void debugSetStage(GameState S, int stage) { S.baby.stage = clampI(stage, 0, 3); S.baby.meals = 0; S.baby.eggT = 0; S.boss = null; }
// Jumps to the ending. kind: "volcano" or "meteor".
void debugFinale(GameState S, String kind) { S.baby.stage = 4; S.baby.totalDamage = eq(kind, "meteor") ? METEOR_THRESHOLD + 5 : 5; triggerFinale(S); }
