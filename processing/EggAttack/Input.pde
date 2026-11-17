// Keyboard and controller input. Every device gives the same four actions: walk, jump, bite, grab/drop.
// Up to 8 players on one computer: 4 keyboard layouts (two fit on one keyboard, the others are meant for
// a second USB keyboard) and up to 4 controllers. A port of src/input.js; the key names are the ones the
// web version uses (ArrowLeft, KeyA, Numpad4, Space, Enter, Escape, ...).
// Controllers go through Jamepad (code/jamepad.jar, SDL game controller mappings). The library is loaded
// by name at run time, so the game still starts when the jar or its native part is missing.

import java.lang.reflect.Constructor;
import java.lang.reflect.Field;
import java.lang.reflect.Method;
import java.util.HashSet;

final HashSet<String> keys = new HashSet<String>();    // keys that are held down right now
HashSet<String> taps = new HashSet<String>();          // keys pressed since the last step, so a tap shorter than one step is not lost
HashSet<String> tapNow = new HashSet<String>();
final ArrayList<float[]> clicks = new ArrayList<float[]>();
HashMap<String, Boolean> prevMenu = new HashMap<String, Boolean>();
final HashMap<String, Boolean> prevJoin = new HashMap<String, Boolean>();

boolean held(String code) { return keys.contains(code) || tapNow.contains(code); }

// The two entry points for key presses. The window's key events call them, and so do the tests.
void keyDown(String code) {
  if (!keys.contains(code)) taps.add(code);
  keys.add(code);
}
void keyUp(String code) { keys.remove(code); }

// The same key name as the web version for a key event of the window.
String keyName(processing.event.KeyEvent e) {
  int kc = e.getKeyCode();
  boolean numpad = false;
  Object nat = e.getNative();
  if (nat instanceof java.awt.event.KeyEvent) numpad = ((java.awt.event.KeyEvent) nat).getKeyLocation() == java.awt.event.KeyEvent.KEY_LOCATION_NUMPAD;
  if (kc >= 96 && kc <= 105) return "Numpad" + (kc - 96);
  if (numpad) {                                      // the number pad with Num Lock off still counts as the number pad
    if (kc == 37 || kc == 226) return "Numpad4";
    if (kc == 39 || kc == 227) return "Numpad6";
    if (kc == 38 || kc == 224) return "Numpad8";
    if (kc == 40 || kc == 225) return "Numpad2";
    if (kc == 155) return "Numpad0";
    if (kc == 12 || kc == 65368) return "Numpad5";
    if (kc == 10) return "NumpadEnter";
  }
  if (kc == 37) return "ArrowLeft";
  if (kc == 38) return "ArrowUp";
  if (kc == 39) return "ArrowRight";
  if (kc == 40) return "ArrowDown";
  if (kc == 10) return "Enter";
  if (kc == 27) return "Escape";
  if (kc == 32) return "Space";
  if (kc == 8) return "Backspace";
  if (kc == 9) return "Tab";
  if (kc >= 65 && kc <= 90) return "Key" + (char) kc;
  return "Code" + kc;
}

void keyPressed(processing.event.KeyEvent e) {
  if (key == ESC) key = 0;                           // Escape is back / pause. Without this line Processing closes the window.
  if (e.getKeyCode() == 122) {                       // F11: maximised window on and off
    if (!keys.contains("F11")) toggleMaximised();
    keys.add("F11");
    return;
  }
  keyDown(keyName(e));
}

void keyReleased(processing.event.KeyEvent e) {
  if (key == ESC) key = 0;
  if (e.getKeyCode() == 122) { keys.remove("F11"); return; }
  keyUp(keyName(e));
}

void focusLost() { keys.clear(); }

void mousePressed() {
  int[] r = screenRect();
  float gx = ((mouseX - r[0]) / (float) r[2]) * W, gy = ((mouseY - r[1]) / (float) r[3]) * H;
  if (gx >= 0 && gx <= W && gy >= 0 && gy <= H) clicks.add(new float[] { gx, gy });
}

// Keyboard layouts: left, right, jump, bite, grab
final String[] DEVICES = { "kb1", "kb2", "kb3", "kb4", "pad0", "pad1", "pad2", "pad3" };
String[] kbKeys(String dev) {
  if (eq(dev, "kb1")) return new String[] { "ArrowLeft", "ArrowRight", "ArrowUp", "Space", "ArrowDown" };
  if (eq(dev, "kb2")) return new String[] { "KeyA", "KeyD", "KeyW", "KeyF", "KeyS" };
  if (eq(dev, "kb3")) return new String[] { "KeyJ", "KeyL", "KeyI", "KeyH", "KeyK" };
  if (eq(dev, "kb4")) return new String[] { "Numpad4", "Numpad6", "Numpad8", "Numpad0", "Numpad5" };
  return null;
}
String deviceName(String dev) {
  if (eq(dev, "kb1")) return "Arrows + Space";
  if (eq(dev, "kb2")) return "WASD + F";
  if (eq(dev, "kb3")) return "IJKL + H";
  if (eq(dev, "kb4")) return "Numpad";
  if (dev != null && dev.startsWith("pad")) return "Controller " + (Integer.parseInt(dev.substring(3)) + 1);
  return "";
}

// ---------------------------------------------------------------- controllers (Jamepad, loaded by name)
boolean padInitTried = false, padLibraryLoaded = false;
String padError = "";
Object padManager = null;
Method padUpdateMethod = null, padGetStateMethod = null;
Class<?> padStateClass = null;
Field fConnected, fLeftX, fLeftY, fRightTrig, fA, fB, fX, fY, fRb, fStart, fBack, fDpadUp, fDpadDown, fDpadLeft, fDpadRight;
final Object[] padStates = new Object[4];
Object[] injectedPadStates = null;                   // the tests put made-up controller states here

void initControllers() {
  if (padInitTried) return;
  padInitTried = true;
  try {
    Class<?> mgrClass = Class.forName("com.studiohartman.jamepad.ControllerManager");
    padStateClass = Class.forName("com.studiohartman.jamepad.ControllerState");
    fConnected = padStateClass.getField("isConnected");
    fLeftX = padStateClass.getField("leftStickX");
    fLeftY = padStateClass.getField("leftStickY");
    fRightTrig = padStateClass.getField("rightTrigger");
    fA = padStateClass.getField("a");
    fB = padStateClass.getField("b");
    fX = padStateClass.getField("x");
    fY = padStateClass.getField("y");
    fRb = padStateClass.getField("rb");
    fStart = padStateClass.getField("start");
    fBack = padStateClass.getField("back");
    fDpadUp = padStateClass.getField("dpadUp");
    fDpadDown = padStateClass.getField("dpadDown");
    fDpadLeft = padStateClass.getField("dpadLeft");
    fDpadRight = padStateClass.getField("dpadRight");
    padManager = mgrClass.getDeclaredConstructor(int.class).newInstance(4);
    padUpdateMethod = mgrClass.getMethod("update");
    padGetStateMethod = mgrClass.getMethod("getState", int.class);
    mgrClass.getMethod("initSDLGamepad").invoke(padManager);
    padLibraryLoaded = true;
  } catch (Throwable t) {
    padLibraryLoaded = false;
    padManager = null;
    Throwable c = t.getCause() != null ? t.getCause() : t;
    padError = c.toString();
  }
}

void refreshPads() {
  if (injectedPadStates != null) {
    for (int i = 0; i < padStates.length; i++) padStates[i] = i < injectedPadStates.length ? injectedPadStates[i] : null;
    return;
  }
  initControllers();
  if (!padLibraryLoaded || padManager == null) { for (int i = 0; i < padStates.length; i++) padStates[i] = null; return; }
  try {
    padUpdateMethod.invoke(padManager);
    for (int i = 0; i < padStates.length; i++) padStates[i] = padGetStateMethod.invoke(padManager, i);
  } catch (Throwable t) {
    for (int i = 0; i < padStates.length; i++) padStates[i] = null;
  }
}

boolean padConnected(Object cs) {
  if (cs == null || fConnected == null) return false;
  try { return fConnected.getBoolean(cs); } catch (Throwable t) { return false; }
}
boolean padBtn(Object cs, Field f) {
  try { return f != null && f.getBoolean(cs); } catch (Throwable t) { return false; }
}
float padAxis(Object cs, Field f) {
  try { return f == null ? 0 : f.getFloat(cs); } catch (Throwable t) { return 0; }
}

Inp padState(Object cs) {
  if (!padConnected(cs)) return new Inp();
  float ax = padAxis(cs, fLeftX);
  return new Inp(
    padBtn(cs, fDpadLeft) ? -1 : padBtn(cs, fDpadRight) ? 1 : Math.abs(ax) > 0.35f ? (ax > 0 ? 1 : -1) : 0,
    padBtn(cs, fA) || padBtn(cs, fDpadUp),                                   // A or D-pad up
    padBtn(cs, fX) || padBtn(cs, fRb) || padAxis(cs, fRightTrig) > 0.5f,     // X, or a right shoulder button
    padBtn(cs, fB) || padBtn(cs, fY) || padBtn(cs, fDpadDown));              // B, Y or D-pad down
}

int padCount() {
  int n = 0;
  for (Object cs : padStates) if (padConnected(cs)) n++;
  return n;
}

// which: up, down, left, right, ok, start, back, pause. Jamepad's stick goes up with a positive Y.
boolean padMenu(String which) {
  for (Object cs : padStates) {
    if (!padConnected(cs)) continue;
    if (eq(which, "up") && (padBtn(cs, fDpadUp) || padAxis(cs, fLeftY) > 0.6f)) return true;
    if (eq(which, "down") && (padBtn(cs, fDpadDown) || padAxis(cs, fLeftY) < -0.6f)) return true;
    if (eq(which, "left") && (padBtn(cs, fDpadLeft) || padAxis(cs, fLeftX) < -0.6f)) return true;
    if (eq(which, "right") && (padBtn(cs, fDpadRight) || padAxis(cs, fLeftX) > 0.6f)) return true;
    if (eq(which, "ok") && padBtn(cs, fA)) return true;
    if ((eq(which, "start") || eq(which, "pause")) && padBtn(cs, fStart)) return true;
    if (eq(which, "back") && padBtn(cs, fBack)) return true;
  }
  return false;
}

// ---------------------------------------------------------------- reading the devices
Inp poll(String dev) {
  String[] k = kbKeys(dev);
  if (k != null) return new Inp((held(k[1]) ? 1 : 0) - (held(k[0]) ? 1 : 0), held(k[2]), held(k[3]), held(k[4]));
  int idx = Integer.parseInt(dev.substring(3));
  return padState(idx >= 0 && idx < padStates.length ? padStates[idx] : null);
}

// Alone there is one player at this computer: arrows, WASD and the first controller all work.
Inp pollAll() {
  Inp a = poll("kb1"), b = poll("kb2"), c = poll("pad0");
  return new Inp(a.mx != 0 ? a.mx : b.mx != 0 ? b.mx : c.mx, a.jump || b.jump || c.jump, a.bite || b.bite || c.bite || held("Enter"), a.grab || b.grab || c.grab);
}

// Devices whose bite button went down since the last call (used on the screen where players join).
ArrayList<String> joinPresses() {
  ArrayList<String> out = new ArrayList<String>();
  for (String dev : DEVICES) {
    boolean down = poll(dev).bite;
    if (down && !Boolean.TRUE.equals(prevJoin.get(dev))) out.add(dev);
    prevJoin.put(dev, down);
  }
  return out;
}

class MenuInput {
  boolean up, down, left, right, ok, start, back, pause, hasClick;
  float cx, cy;
}

boolean anyTap(String... codes) {
  for (String c : codes) if (tapNow.contains(c)) return true;
  return false;
}
boolean menuEdge(HashMap<String, Boolean> now, String k, boolean isDown, boolean tapped) {
  now.put(k, isDown);
  return isDown && (!Boolean.TRUE.equals(prevMenu.get(k)) || tapped);
}

// Once per game step: menu presses (only the moment a button goes down) and clicks.
MenuInput inputTick() {
  refreshPads();
  tapNow = taps; taps = new HashSet<String>();
  HashMap<String, Boolean> now = new HashMap<String, Boolean>();
  MenuInput m = new MenuInput();
  // A tap counts as a new press even if the key was already down in the step before.
  m.up = menuEdge(now, "up", held("ArrowUp") || held("KeyW") || padMenu("up"), anyTap("ArrowUp", "KeyW"));
  m.down = menuEdge(now, "down", held("ArrowDown") || held("KeyS") || padMenu("down"), anyTap("ArrowDown", "KeyS"));
  m.left = menuEdge(now, "left", held("ArrowLeft") || held("KeyA") || padMenu("left"), anyTap("ArrowLeft", "KeyA"));
  m.right = menuEdge(now, "right", held("ArrowRight") || held("KeyD") || padMenu("right"), anyTap("ArrowRight", "KeyD"));
  m.ok = menuEdge(now, "ok", held("Enter") || held("NumpadEnter") || held("Space") || padMenu("ok"), anyTap("Enter", "NumpadEnter", "Space"));
  m.start = menuEdge(now, "start", held("Enter") || held("NumpadEnter") || padMenu("start"), anyTap("Enter", "NumpadEnter"));     // Enter or the controller's Start button
  m.back = menuEdge(now, "back", held("Escape") || padMenu("back"), anyTap("Escape"));
  m.pause = menuEdge(now, "pause", held("Escape") || padMenu("pause"), anyTap("Escape"));
  prevMenu = now;
  if (!clicks.isEmpty()) { float[] c = clicks.remove(0); m.hasClick = true; m.cx = c[0]; m.cy = c[1]; }
  return m;
}

// Forgets everything that is pressed (used by the tests between two checks).
void inputReset() {
  keys.clear(); taps.clear(); tapNow.clear(); clicks.clear(); prevMenu.clear(); prevJoin.clear();
}
