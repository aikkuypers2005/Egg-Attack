// Egg Attack - Processing 4 (Java mode) version for Windows.
// The main tab: the window, the fixed 60 steps per second game loop, the menus and the screen where players join.
// A port of src/main.js of the web version, without online play. The other tabs follow the web files:
//   Sim.pde (src/sim.js, the rules)  Draw.pde (src/draw.js)  Sprites.pde (src/sprites.js)  Fx.pde (src/fx.js)
//   Input.pde (src/input.js)  Text.pde (src/text.js)  Audio.pde (src/audio.js)
//   Test.pde (checks and screenshots without a window)
// Run with the argument  test  or  shots <folder>  for the checks; see Test.pde.

final double STEP = 1000.0d / 60.0d;
final String[] MENU = { "m_solo", "m_local", "m_controls", "m_sound" };
final int MENU_Y = 70, MENU_STEP = 18;

int t = 0;                     // steps since the start, for animations
double acc = 0;
long lastMs = 0;
String app = "title";          // title, controls, lobby, play, pause
String role = "solo";          // solo, local
GameState S = null;
int sel = 0, psel = 0;
View view = new View(0, new int[] { 0 });
ArrayList<String> devs = new ArrayList<String>();    // one computer: the device of each player, in the order they joined
PImage windowImg = null;       // the 480x270 picture as a Processing image, for drawing it in the window
AutoPlay autoPlay = null;      // only with the argument  autoplay <folder>  (see Test.pde)

void settings() {
  // The checks and the screenshots need no window: they run here, before one is made, and then the program ends.
  if (args != null && args.length > 0 && isHeadlessMode(args[0])) runHeadless(args);
  size(W * 2, H * 2);
  noSmooth();
}

void setup() {
  surface.setTitle("Egg Attack");
  surface.setResizable(true);
  try {
    PImage icon = loadImage("icon.png");
    if (icon != null) surface.setIcon(icon);
  } catch (Throwable e) { /* the game works without its icon */ }
  frameRate(60);
  initText();
  initDraw();
  initControllers();
  initAudio();                 // the music starts here, with the window; a sound problem never stops the game
  windowImg = createImage(W, H, RGB);
  if (args != null && args.length > 1 && eq(args[0], "autoplay")) autoPlay = new AutoPlay(args[1]);
  lastMs = millis();
}

void draw() {
  long now = millis();
  acc += Math.min(100, Math.max(0, now - lastMs));
  lastMs = now;
  int n = 0;
  while (acc >= STEP && n < 5) { acc -= STEP; tick(); n++; }
  if (n == 5) acc = 0;
  render();

  // the 480x270 picture, as large as fits in the window, with hard pixels
  windowImg.loadPixels();
  System.arraycopy(framePixels, 0, windowImg.pixels, 0, W * H);
  windowImg.updatePixels();
  background(8, 7, 13);
  int[] r = screenRect();
  image(windowImg, r[0], r[1], r[2], r[3]);
  if (autoPlay != null) autoPlay.afterDraw();
}

// Where the picture is in the window: x, y, width, height.
int[] screenRect() {
  double s = Math.min(width / (double) W, height / (double) H);
  int dw = Math.max(1, (int) Math.floor(W * s)), dh = Math.max(1, (int) Math.floor(H * s));
  return new int[] { (width - dw) / 2, (height - dh) / 2, dw, dh };
}

// F11: the window maximised, and back.
void toggleMaximised() {
  try {
    Object nat = surface.getNative();
    if (nat instanceof processing.awt.PSurfaceAWT.SmoothCanvas) {
      final java.awt.Frame frame = ((processing.awt.PSurfaceAWT.SmoothCanvas) nat).getFrame();
      java.awt.EventQueue.invokeLater(new Runnable() {
        public void run() {
          boolean isMax = (frame.getExtendedState() & java.awt.Frame.MAXIMIZED_BOTH) == java.awt.Frame.MAXIMIZED_BOTH;
          frame.setExtendedState(isMax ? java.awt.Frame.NORMAL : java.awt.Frame.MAXIMIZED_BOTH);
        }
      });
    }
  } catch (Throwable e) {
    System.err.println("Could not change the window size: " + e);
  }
}

void startGame(String r, int humans) {
  role = r;
  fxReset();
  auReset();
  resetView();
  int seed = (int) (System.currentTimeMillis() & 0x7fffffffL);
  S = newGame(humans, seed != 0 ? seed : 13374201);
  app = "play";
  if (eq(r, "local")) {
    int[] all = new int[S.players.size()];
    for (int i = 0; i < all.length; i++) all[i] = i;
    view = new View(-1, all);
  } else view = new View(0, new int[] { 0 });
}

void toTitle() {
  S = null;
  app = "title"; role = "solo"; sel = 0;
}

// ---------------------------------------------------------------- one step
void tick() {
  t++;
  if (autoPlay != null) autoPlay.beforeTick();
  MenuInput m = inputTick();
  if (!eq(app, "play")) {                                           // menu sounds
    if (m.up || m.down || m.left || m.right) auPlay("ui_move");
    if (m.back) auPlay("ui_back"); else if (m.ok || m.start || m.hasClick) auPlay("ui_ok");
  }
  if (eq(app, "title")) tickTitle(m);
  else if (eq(app, "controls")) { if (m.back || m.ok || m.hasClick) app = "title"; }
  else if (eq(app, "lobby")) tickLobby(m);
  else if (eq(app, "pause")) tickPause(m);
  else if (eq(app, "play")) tickPlay(m);
}

void tickTitle(MenuInput m) {
  if (m.up) sel = (sel + MENU.length - 1) % MENU.length;
  if (m.down) sel = (sel + 1) % MENU.length;
  if (m.hasClick) {
    for (int i = 0; i < MENU.length; i++) {
      int ry = MENU_Y + i * MENU_STEP;
      if (m.cy >= ry - 2 && m.cy < ry + MENU_STEP - 2 && m.cx >= 90 && m.cx <= 390) { sel = i; m.ok = true; break; }
    }
  }
  if (!m.ok) return;
  String k = MENU[sel];
  if (eq(k, "m_solo")) startGame("solo", 1);
  else if (eq(k, "m_local")) { app = "lobby"; devs = new ArrayList<String>(); joinPresses(); }
  else if (eq(k, "m_controls")) app = "controls";
  else if (eq(k, "m_sound")) { auSetOn(!auOn); auPlay("ui_ok"); }
}

// Players on one computer join by pressing their bite button. Enter or Start begins with 2 or more.
void tickLobby(MenuInput m) {
  if (m.back) { app = "title"; return; }
  for (String dev : joinPresses()) {
    int i = devs.indexOf(dev);
    if (i >= 0) devs.remove(i); else if (devs.size() < 8) devs.add(dev);       // press again to leave
  }
  if (m.start && devs.size() >= 2) startGame("local", devs.size());
}

// The pause menu: resume, sound on or off, quit.
void tickPause(MenuInput m) {
  if (m.up) psel = (psel + 2) % 3;
  if (m.down) psel = (psel + 1) % 3;
  if (m.hasClick && m.cy >= 120 && m.cy < 183) { psel = (int) Math.floor((m.cy - 120) / 21); m.ok = true; }   // click a line
  if (m.pause || m.back || (m.ok && psel == 0)) { app = "play"; return; }
  if (m.ok && psel == 1) { auSetOn(!auOn); auPlay("ui_ok"); return; }
  if (m.ok && psel == 2) toTitle();
}

// Where this screen listens from: the x of every T-rex it shows.
double[] ears() {
  if (S == null) return new double[] { 0 };
  int[] who = view.me >= 0 ? new int[] { view.me } : view.humans;
  double[] xs = new double[who.length];
  for (int i = 0; i < who.length; i++) xs[i] = who[i] < S.players.size() ? S.players.get(who[i]).x : 0;
  return xs;
}

void tickPlay(MenuInput m) {
  if (m.pause && S != null && eq(S.mode, "play")) { app = "pause"; psel = 0; return; }
  Inp[] inputs;
  if (eq(role, "local")) {
    inputs = new Inp[devs.size()];
    for (int i = 0; i < inputs.length; i++) inputs[i] = poll(devs.get(i));
  } else inputs = new Inp[] { pollAll() };
  step(S, inputs);
  fxTick(S);
  auEvents(S, ears());
  if ((eq(S.mode, "win") || eq(S.mode, "over")) && S.finaleT > 60 && (m.ok || m.hasClick)) toTitle();
}

// ---------------------------------------------------------------- drawing the menus
void panel(int x, int y, int w, int h) { R(x, y, w, h, "rgba(10, 9, 20, 0.86)"); }

void render() {
  beginFrame();
  if (eq(app, "play") || eq(app, "pause")) {
    if (S == null) { R(0, 0, W, H, "#08070d"); return; }
    renderGame(S, view, t);
    if (eq(app, "pause")) {
      R(0, 0, W, H, "rgba(8, 6, 16, 0.76)");
      T(tx("paused"), 240, 82, "#ffffff", "ps", 1, 2);
      String[] items = { tx("resume"), soundLine(), tx("tomenu") };
      for (int i = 0; i < items.length; i++) T((psel == i ? "> " : "") + items[i] + (psel == i ? " <" : ""), 240, 126 + i * 20, psel == i ? "#f8d040" : "#ffffff", "vt", 1);
    }
    return;
  }

  drawMenuBackdrop(t);
  if (eq(app, "title")) {
    T(tx("title"), 242, 22, "#744318", "ps", 1, 2, false);
    T(tx("title"), 240, 20, "#ffe868", "ps", 1, 2);
    T(tx("sub"), 240, 44, "#e4ecff", "vt", 1);
    for (int i = 0; i < MENU.length; i++) T((i == sel ? "> " : "") + (eq(MENU[i], "m_sound") ? soundLine() : tx(MENU[i])) + (i == sel ? " <" : ""), 240, MENU_Y + i * MENU_STEP, i == sel ? "#f8d040" : "#ffffff", "vt", 1);
    T(tx("credit"), 240, 236, "#cfd6ff", "vt", 1);
    T(tx("nav"), 240, 252, "#a8b4d4", "vt", 1);
  } else if (eq(app, "controls")) {
    panel(10, 8, 460, 254);
    T(tx("c_head"), 240, 14, "#ffe868", "ps", 1, 1);
    String[] ck = { "c_k1", "c_k2", "c_k3", "c_k4", "c_pad", "c_solo" };
    for (int i = 0; i < ck.length; i++) T(tx(ck[i]), 20, 32 + i * 15, i < 4 ? "#f8d040" : i == 4 ? "#ff9868" : "#78e878", "vt", 0);
    String[] tips = { "c_tip1", "c_tip2", "c_tip3", "c_tip4", "c_tip5" };
    for (int i = 0; i < tips.length; i++) T(tx(tips[i]), 20, 130 + i * 16, "#ffffff", "vt", 0);
    T(tx("credit_music1"), 240, 211, "#8c98b8", "vt", 1);
    T(tx("credit_music2"), 240, 223, "#8c98b8", "vt", 1);
    T(tx("back"), 240, 242, "#a8b4d4", "vt", 1);
  } else if (eq(app, "lobby")) {
    panel(20, 10, 440, 250);
    T(tx("lobby_head"), 240, 16, "#ffffff", "ps", 1, 1);
    T(tx("lobby_hint"), 240, 32, "#cfd6ff", "vt", 1);
    for (int i = 0; i < 8; i++) {
      int cx = 34 + (i % 2) * 216, cy = 52 + (i >> 1) * 17;
      boolean on = i < devs.size();
      T("P" + (i + 1), cx, cy, on ? "#f8d040" : "#5a5878", "vt", 0);
      T(on ? deviceName(devs.get(i)) : "...", cx + 26, cy, on ? "#ffffff" : "#5a5878", "vt", 0);
    }
    String[] ck = { "c_k1", "c_k2", "c_k3", "c_k4", "c_pad" };
    for (int i = 0; i < ck.length; i++) T(tx(ck[i]), 34, 128 + i * 14, "#a8b4d4", "vt", 0);
    T(tx("lobby_pads").replace("{n}", String.valueOf(padCount())), 34, 202, "#78e878", "vt", 0);
    T(devs.size() >= 2 ? tx("lobby_go").replace("{n}", String.valueOf(devs.size())) : tx("lobby_need"), 240, 232, devs.size() >= 2 ? "#68e878" : "#ffffff", "vt", 1);
  }
}
