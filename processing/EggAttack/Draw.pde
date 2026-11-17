// Drawing for Egg Attack: a 480x270 pixel picture. Backdrops, the scrolling world, creatures, the T-rexes,
// the split screen for several players on one computer, the top bar, and the end screens.
// A port of src/draw.js. The web version draws on a canvas; here the same calls go to a Graphics2D on a
// 480x270 BufferedImage (frameImg), which EggAttack.pde scales to the window with nearest-neighbour.
// It needs no window, so the test and screenshot modes can run without one.

import java.awt.AlphaComposite;
import java.awt.Color;
import java.awt.Font;
import java.awt.Graphics2D;
import java.awt.RenderingHints;
import java.awt.font.FontRenderContext;
import java.awt.image.BufferedImage;
import java.awt.image.DataBufferInt;
import javax.imageio.ImageIO;

BufferedImage frameImg = null;         // the 480x270 picture
int[] framePixels = null;              // its pixels, for copying to the window
Graphics2D ctx = null;                 // where everything is drawn, like the canvas context of the web version
final ArrayList<Graphics2D> ctxStack = new ArrayList<Graphics2D>();
final HashMap<String, BufferedImage> BG = new HashMap<String, BufferedImage>();   // backdrops, already 528x284
boolean drawReady = false;

void initDraw() {
  if (drawReady) return;
  loadData();
  frameImg = new BufferedImage(W, H, BufferedImage.TYPE_INT_RGB);
  framePixels = ((DataBufferInt) frameImg.getRaster().getDataBuffer()).getData();
  initFonts();
  loadBackdrops();
  buildSprites();
  beginFrame();
  drawReady = true;
}

// Starts a new picture: a fresh drawing context without clip, shift or transparency.
void beginFrame() {
  for (Graphics2D old : ctxStack) old.dispose();
  ctxStack.clear();
  if (ctx != null) ctx.dispose();
  ctx = frameImg.createGraphics();
  ctx.setRenderingHint(RenderingHints.KEY_INTERPOLATION, RenderingHints.VALUE_INTERPOLATION_NEAREST_NEIGHBOR);
  ctx.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_OFF);
  ctx.setRenderingHint(RenderingHints.KEY_RENDERING, RenderingHints.VALUE_RENDER_SPEED);
}

void ctxSave() { ctxStack.add(ctx); ctx = (Graphics2D) ctx.create(); }
void ctxRestore() { if (ctxStack.isEmpty()) return; ctx.dispose(); ctx = ctxStack.remove(ctxStack.size() - 1); }
void setAlpha(double a) { ctx.setComposite(a >= 1 ? AlphaComposite.SrcOver : AlphaComposite.getInstance(AlphaComposite.SRC_OVER, (float) Math.max(0, a))); }

// ---------------------------------------------------------------- colours and rectangles
final HashMap<String, Integer> colCache = new HashMap<String, Integer>();
final HashMap<String, Color> awtColCache = new HashMap<String, Color>();

// "#rgb", "#rrggbb" or "rgba(r, g, b, a)" as an ARGB number
int parseCol(String col) {
  Integer cached = colCache.get(col);
  if (cached != null) return cached;
  int res = 0xFFFFFFFF;
  if (col.startsWith("#")) {
    int n = Integer.parseInt(col.substring(1), 16);
    if (col.length() == 4) res = 0xFF000000 | ((((n >> 8) & 15) * 17) << 16) | ((((n >> 4) & 15) * 17) << 8) | ((n & 15) * 17);
    else res = 0xFF000000 | (n & 0xFFFFFF);
  } else if (col.startsWith("rgba(")) {
    String[] p = col.substring(5, col.length() - 1).split(",");
    int a = (int) Math.round(Double.parseDouble(p[3].trim()) * 255.0d);
    res = (clampI(a, 0, 255) << 24) | (Integer.parseInt(p[0].trim()) << 16) | (Integer.parseInt(p[1].trim()) << 8) | Integer.parseInt(p[2].trim());
  }
  colCache.put(col, res);
  return res;
}

Color awtCol(String col) {
  Color c = awtColCache.get(col);
  if (c == null) { c = new Color(parseCol(col), true); awtColCache.put(col, c); }
  return c;
}

void R(double x, double y, double w, double h, String col) {
  ctx.setColor(awtCol(col));
  ctx.fillRect((int) Math.round(x), (int) Math.round(y), (int) Math.round(w), (int) Math.round(h));
}

void fillRgba(int x, int y, int w, int h, int r, int g, int b, double a) {
  ctx.setColor(new Color(r, g, b, clampI((int) Math.round(a * 255.0d), 0, 255)));
  ctx.fillRect(x, y, w, h);
}

// The outline of a rectangle, 2 pixels thick and centred on its edge (strokeRect with lineWidth 2 on a canvas).
void strokeRect2(int x, int y, int w, int h, String col) {
  ctx.setColor(awtCol(col));
  if (w < 2 || h < 2) { ctx.fillRect(x - 1, y - 1, w + 2, h + 2); return; }
  ctx.fillRect(x - 1, y - 1, w + 2, 2);
  ctx.fillRect(x - 1, y + h - 1, w + 2, 2);
  ctx.fillRect(x - 1, y + 1, 2, h - 2);
  ctx.fillRect(x + w - 1, y + 1, 2, h - 2);
}

// ---------------------------------------------------------------- text
// Each string is drawn once to a small picture with hard edges, so it stays sharp when scaled.
//   ps: the headline font (Press Start 2P at its own size of 8 px). It is drawn 8 times larger and read
//       back at the middle of every block, as the web version does.
//   vt: the small text. A built-in 5x7 pixel font: 6 px per character, in a line 16 px high.
final int VT_H = 16, VT_TOP = 5, VT_ADV = 6;
final int PS_H = 10, PS_BASE = 9, PS_Z = 8;

// The 5x7 font, characters 32 (space) to 126 (~). 5 columns per character, 2 hex digits per column,
// the lowest bit is the top row. The letters g p q y are drawn 2 rows lower, so their tails hang under the line.
// Copied from FONT5 in src/draw.js.
final String FONT5 =
  "0000000000" + "00005F0000" + "0007000700" + "147F147F14" + "242A7F2A12" + "2313086462" + "3649552250" + "0005030000" +
  "001C224100" + "0041221C00" + "14083E0814" + "08083E0808" + "0050300000" + "0808080808" + "0060600000" + "2010080402" +
  "3E5149453E" + "00427F4000" + "4261514946" + "2141454B31" + "1814127F10" + "2745454539" + "3C4A494930" + "0171090503" +
  "3649494936" + "064949291E" + "0036360000" + "0056360000" + "0814224100" + "1414141414" + "0041221408" + "0201510906" +
  "324979413E" + "7E1111117E" + "7F49494936" + "3E41414122" + "7F4141221C" + "7F49494941" + "7F09090901" + "3E4149497A" +
  "7F0808087F" + "00417F4100" + "2040413F01" + "7F08142241" + "7F40404040" + "7F020C027F" + "7F0408107F" + "3E4141413E" +
  "7F09090906" + "3E4151215E" + "7F09192946" + "4649494931" + "01017F0101" + "3F4040403F" + "1F2040201F" + "3F4038403F" +
  "6314081463" + "0708700807" + "6151494543" + "007F414100" + "0204081020" + "0041417F00" + "0402010204" + "4040404040" +
  "0001020400" + "2054545478" + "7F48444438" + "3844444420" + "384444487F" + "3854545418" + "087E090102" + "0E5151513E" +
  "7F08040478" + "00447D4000" + "2040443D00" + "7F10284400" + "00417F4000" + "7C04180478" + "7C08040478" + "3844444438" +
  "7F1111110E" + "0E1111117F" + "7C08040408" + "4854545420" + "043F444020" + "3C4040207C" + "1C2040201C" + "3C4030403C" +
  "4428102844" + "0F5050503F" + "4464544C44" + "0008364100" + "00007F0000" + "0041360800" + "0804081008";

Font fontPsBig = null;
final FontRenderContext textFrc = new FontRenderContext(null, false, true);
HashMap<String, BufferedImage> tcache = new HashMap<String, BufferedImage>();

void initFonts() {
  if (fontPsBig != null) return;
  try {
    fontPsBig = Font.createFont(Font.TRUETYPE_FONT, new File(dataPath("PressStart2P-Regular.ttf"))).deriveFont(Font.PLAIN, 8.0f * PS_Z);
  } catch (Exception e) {
    System.err.println("Could not load the headline font from the data folder: " + e);
    fontPsBig = new Font(Font.MONOSPACED, Font.BOLD, 8 * PS_Z);
  }
}

int measure(String str, String font) {
  if (str == null || str.isEmpty()) return 0;
  if (eq(font, "vt")) return str.length() * VT_ADV;
  double w = fontPsBig.getStringBounds(str, textFrc).getWidth() / PS_Z;
  return (int) Math.ceil(w - 0.01d);
}

BufferedImage textImg(String str, String font, String col) {
  String key = font + col + str;
  BufferedImage cv = tcache.get(key);
  if (cv != null) return cv;
  if (tcache.size() > 900) tcache = new HashMap<String, BufferedImage>();
  boolean vt = eq(font, "vt");
  int fh = vt ? VT_H : PS_H, w = Math.max(1, measure(str, font) + 2);
  int[] out = new int[w * fh];
  int solid = 0xFF000000 | (parseCol(col) & 0xFFFFFF);
  if (vt) {
    for (int n = 0; n < str.length(); n++) {
      int ch = str.charAt(n);
      if (ch < 32 || ch > 126) ch = 63;
      for (int gx = 0; gx < 5; gx++) {
        int at = (ch - 32) * 10 + gx * 2;
        int bits = Integer.parseInt(FONT5.substring(at, at + 2), 16), drop = (ch == 103 || ch == 112 || ch == 113 || ch == 121) ? 2 : 0;
        for (int gy = 0; gy < 7; gy++) {
          if (((bits >> gy) & 1) == 0) continue;
          out[(VT_TOP + drop + gy) * w + 1 + n * VT_ADV + gx] = solid;
        }
      }
    }
  } else {
    int z = PS_Z, half = z >> 1;
    BufferedImage big = new BufferedImage(w * z, fh * z, BufferedImage.TYPE_INT_ARGB);
    Graphics2D b = big.createGraphics();
    b.setRenderingHint(RenderingHints.KEY_TEXT_ANTIALIASING, RenderingHints.VALUE_TEXT_ANTIALIAS_OFF);
    b.setRenderingHint(RenderingHints.KEY_FRACTIONALMETRICS, RenderingHints.VALUE_FRACTIONALMETRICS_ON);
    b.setColor(Color.WHITE);
    b.setFont(fontPsBig);
    b.drawString(str, z, PS_BASE * z);
    b.dispose();
    int bw = big.getWidth();
    int[] src = ((DataBufferInt) big.getRaster().getDataBuffer()).getData();
    for (int y = 0; y < fh; y++) {
      for (int x = 0; x < w; x++) if ((src[(y * z + half) * bw + x * z + half] >>> 24) >= 128) out[y * w + x] = solid;
    }
  }
  cv = imageOf(out, w, fh);
  tcache.put(key, cv);
  return cv;
}

ArrayList<String> wrap(String str, String font, int maxW) {
  ArrayList<String> lines = new ArrayList<String>();
  String line = "";
  for (String w : str.split(" ")) {
    String test = line.isEmpty() ? w : line + " " + w;
    if (measure(test, font) > maxW && !line.isEmpty()) { lines.add(line); line = w; } else line = test;
  }
  if (!line.isEmpty()) lines.add(line);
  return lines;
}

// align: 0 left, 1 centre, 2 right.
int T(String str, double x, double y, String col, String font, int align, int scale, boolean shadow) {
  if (str == null || str.isEmpty()) return 0;
  BufferedImage img = textImg(str, font, col);
  int w = img.getWidth() * scale;
  int dx = (int) Math.round(align == 1 ? x - w / 2.0d : align == 2 ? x - w : x), dy = (int) Math.round(y);
  if (shadow) {
    BufferedImage sh = textImg(str, font, "#0c0a16");
    ctx.drawImage(sh, dx + scale, dy + scale, w, sh.getHeight() * scale, null);
  }
  ctx.drawImage(img, dx, dy, w, img.getHeight() * scale, null);
  return w;
}
int T(String str, double x, double y, String col, String font, int align, int scale) { return T(str, x, y, col, font, align, scale, true); }
int T(String str, double x, double y, String col, String font, int align) { return T(str, x, y, col, font, align, 1, true); }

// ---------------------------------------------------------------- backdrops
// The web version draws a 480x270 backdrop stretched to 528x284 without smoothing. The stretched pictures
// are made once here, with the same nearest-pixel rule.
void loadBackdrops() {
  String[] names = { "meadow", "jungle", "swamp", "dunes", "canyon", "river", "mushroom", "crag", "coast", "volcano" };
  for (String name : names) {
    try {
      BufferedImage src = ImageIO.read(new File(dataPath(name + ".png")));
      if (src == null) continue;
      int sw = src.getWidth(), sh = src.getHeight(), dw = 528, dh = 284;
      int[] a = src.getRGB(0, 0, sw, sh, null, 0, sw), b = new int[dw * dh];
      for (int y = 0; y < dh; y++) {
        int sy = Math.min(sh - 1, (int) ((y + 0.5d) * sh / dh));
        for (int x = 0; x < dw; x++) b[y * dw + x] = a[sy * sw + Math.min(sw - 1, (int) ((x + 0.5d) * sw / dw))];
      }
      BufferedImage img = new BufferedImage(dw, dh, BufferedImage.TYPE_INT_RGB);
      img.setRGB(0, 0, dw, dh, b, 0, dw);
      BG.put(name, img);
    } catch (Exception e) {
      System.err.println("Could not load the backdrop " + name + ".png: " + e);
    }
  }
}

// ---------------------------------------------------------------- the world
// A biome's backdrop is drawn a little larger than the screen and pans slowly as you cross the biome.
void drawBackdropImg(String bgKey, double zx0, double zx1, double camX, int vw, double alpha, String skyFallback) {
  BufferedImage img = BG.get(bgKey);
  if (img == null) {
    if (alpha >= 0.99d) R(-12, -12, vw + 24, 294, skyFallback != null ? skyFallback : "#22384c");
    return;
  }
  if (alpha < 0.99d) setAlpha(alpha);
  int drawW = 528;
  double frac = 0.5d;
  if (zx1 > zx0) frac = Math.max(0, Math.min(1, (camX - zx0) / (zx1 - zx0)));
  int dx = (int) Math.round(((vw - 480) >> 1) - frac * (drawW - Math.max(vw, 480)));
  ctx.drawImage(img, dx, -7, null);
  if (alpha < 0.99d) setAlpha(1);
}

void drawBiomeParallax(GameState S, double camX, int vw) {
  if (S != null && eq(S.mode, "finale") && eq(S.ending, "volcano")) {
    drawBackdropImg("volcano", -500, 500, camX, vw, 1, "#301010");
    return;
  }
  Zone z = biomeAt(camX);
  drawBackdropImg(z.bg, z.x0, z.x1, camX, vw, 1, z.sky);
  for (int i = 0; i < ZONES.size() - 1; i++) {                 // fade into the next biome near a border
    double dist = camX - ZONES.get(i).x1;
    if (Math.abs(dist) < 120) {
      Zone other = dist < 0 ? ZONES.get(i + 1) : ZONES.get(i);
      drawBackdropImg(other.bg, other.x0, other.x1, camX, vw, 0.5d * (1 - Math.abs(dist) / 120), other.sky);
    }
  }
}

// The web version ends with ">>> 0", which makes the number unsigned: a long here.
long hash(int n) {
  n = (n ^ 61) * (n ^ (n >>> 16));
  n = n + (n << 3);
  n = n ^ (n >>> 4);
  n = n * 0x27d4eb2d;
  return (n ^ (n >>> 15)) & 0xffffffffL;
}

void drawTerrainAndProps(GameState S, double camX, int vw, int tick) {
  int half = vw >> 1;
  int worldLeft = (int) Math.floor((camX - half - 32) / 16) * 16;
  int worldRight = (int) Math.ceil((camX + half + 32) / 16) * 16;

  for (int wx = worldLeft; wx <= worldRight; wx += 16) {
    int sx = (int) Math.round(wx - camX + half);
    long h = hash(wx * 7 + 101);
    // Near a border the ground tiles of the two biomes are mixed, so there is no hard line between them.
    Zone z = biomeAt(wx + 8 + (((h >>> 9) % 5) - 2) * 16);
    String wDepth = waterAt(wx + 8);

    if (eq(wDepth, "deep")) { R(sx, G + 24, 16, H - (G + 24) + 12, "#081a30"); continue; }
    int gy = eq(wDepth, "shallow") ? G + 14 : G;
    R(sx, gy, 16, H - gy + 12, z.ground);
    R(sx, gy, 16, 4, eq(wDepth, "shallow") ? "#3a4e48" : z.grass);
    R(sx, gy + 4, 16, 2, "#1c1614");
    R(sx + (h % 11), gy + 10 + ((h >>> 4) % 22), 3, 2, "#241c18");

    if (Math.abs(wx) > 48 && wDepth == null && (h % 3 == 0)) {
      int px = sx + 4;
      if (eq(z.id, "meadow") || eq(z.id, "jungle")) {
        R(px, gy - 6, 2, 6, z.grass); R(px - 3, gy - 5, 3, 2, z.accent); R(px + 2, gy - 5, 3, 2, z.accent); R(px - 2, gy - 8, 6, 2, z.accent);
      } else if (eq(z.id, "mushroom")) {
        R(px + 1, gy - 7, 2, 7, "#345888"); R(px - 2, gy - 10, 8, 3, "#2698b8"); R(px - 1, gy - 11, 6, 2, "#58fff4");
      } else if (eq(z.id, "dunes")) {
        R(px - 2, gy - 4, 6, 4, z.accent); R(px, gy - 6, 3, 2, z.grass);
      } else if (eq(z.id, "canyon")) {
        R(px, gy - 9, 2, 9, "#ded4be"); R(px + 1, gy - 11, 3, 2, "#f4ecda");
      } else if (eq(z.id, "crag")) {
        R(px - 2, gy - 8, 6, 8, "#28242c"); R(px, gy - 4, 2, 3, "#ff6a28");
      } else if (eq(z.id, "swamp") || eq(z.id, "river")) {
        R(px, gy - 9, 1, 9, z.grass); R(px + 3, gy - 7, 1, 7, z.grass); R(px, gy - 11, 2, 3, "#5c3c20");
      } else if (eq(z.id, "coast")) {
        R(px, gy - 2, 4, 2, "#f4e6d4");
      }
    }
  }

  if (S != null && S.bushes != null) {
    for (int i = 0; i < S.bushes.length; i++) {
      int sx = (int) Math.round(S.bushes[i] - camX + half);
      if (sx < -30 || sx > vw + 30) continue;
      blit("bush", "idle", tick, sx, G + 1, false, false);
    }
  }
}

void drawWaterOverlay(double camX, int vw, int tick) {
  int half = vw >> 1;
  for (int i = 0; i < WATERS.size(); i++) {
    Water w = WATERS.get(i);
    int sx0 = Math.max(-12, (int) Math.round(w.x0 - camX + half));
    int sx1 = Math.min(vw + 12, (int) Math.round(w.x1 - camX + half));
    if (sx1 <= sx0) continue;
    int topY = eq(w.depth, "deep") ? G - 3 : G - 1;
    setAlpha(eq(w.depth, "deep") ? 0.80d : 0.60d);
    R(sx0, topY, sx1 - sx0, H - topY + 12, w.col);
    setAlpha(1);
    // (a negative remainder stays negative here, as in JavaScript)
    for (int x = sx0; x < sx1 - 6; x += 14) R(x, topY + (((x + (tick / 8) * 3) % 28) < 14 ? 0 : 1), 8, 2, w.foam);
  }
}

String tagOf(Player p, int i) { return p.ai ? "AI" : "P" + (i + 1); }
String colOf(Player p) { return REXES.get(p.type).col; }

// One pane of the screen: x, y, w, h on the screen; yOff is how much of the sky is cut off.
class Pane {
  int x, y, w, h, yOff;
  Pane(int x, int y, int w, int h, int yOff) { this.x = x; this.y = y; this.w = w; this.h = h; this.yOff = yOff; }
}

// Draws one pane of the world.
void drawPane(GameState S, double camX, Pane pane, int tick, int me) {
  int vw = pane.w, half = vw >> 1;
  int shX = S.shake > 0 ? (int) Math.round((Math.random() - 0.5d) * S.shake * 1.4d) : 0;
  int shY = S.shake > 0 ? (int) Math.round((Math.random() - 0.5d) * S.shake * 1.4d) : 0;

  ctxSave();
  ctx.clipRect(pane.x, pane.y, pane.w, pane.h);
  ctx.translate(pane.x + shX, pane.y - pane.yOff + shY);

  drawBiomeParallax(S, camX, vw);
  fxDrawFinaleSky(S, vw, H);
  drawTerrainAndProps(S, camX, vw, tick);

  // the nest and the baby, at x = 0
  int nestSX = (int) Math.round(0 - camX + half);
  if (nestSX > -60 && nestSX < vw + 60) {
    boolean bHurt = eq(S.mode, "play") && S.baby.hurtT > 0;
    blit("nest", bHurt ? "hurt" : "idle", tick, nestSX, G + 2, false, false);
    String bAnim = bHurt ? "hurt" : S.baby.eatT > 0 || eq(S.mode, "finale") ? "attack" : "idle";
    blit("baby" + Math.min(4, S.baby.stage), bAnim, tick, nestSX, G - 3, false, bHurt && (tick % 4 < 2));
  }

  for (int i = 0; i < S.foods.size(); i++) {
    Food f = S.foods.get(i);
    int sx = (int) Math.round(f.x - camX + half);
    if (sx < -24 || sx > vw + 24) continue;
    blit("food" + f.tier, "idle", tick, sx, f.y + Math.round(Math.sin((tick + f.id * 11) * 0.1d) * 1.2d), false, false);
  }

  for (int i = 0; i < S.dinos.size(); i++) {
    Dino d = S.dinos.get(i);
    int sx = (int) Math.round(d.x - camX + half);
    if (sx < -80 || sx > vw + 80) continue;
    if (d.hidden) { R(sx - 2, G - 7, 2, 2, "#f8e050"); continue; }       // eyes in a bush
    DinoDef def = DINOS.get(d.kind);
    double tall = def != null ? def.h : 20;
    boolean huge = def != null && (eq(def.size, "giant") || eq(def.size, "titan"));
    // An attack shows the pose of its phase: wind-up, strike, end of strike, recovery.
    blit(d.kind, d.st, tick + d.id * 5, sx, d.y, d.face < 0, eq(S.mode, "play") && d.hurtT > 8, eq(d.st, "attack") ? d.af : -1);

    int top = (int) Math.round(d.y - tall);
    if (eq(d.atk, "windup") && tick % 6 < 4) {                      // warning: an attack is coming
      R(sx - 2, top - 19, 5, 13, "#0c0a16");
      R(sx - 1, top - 18, 3, 7, d.lead ? "#ff5038" : "#ffe858");
      R(sx - 1, top - 9, 3, 2, d.lead ? "#ff5038" : "#ffe858");
    } else if (eq(d.atk, "stun") && d.atkT > 12) {                  // dizzy stars
      int a = (tick / 4) % 4;
      R(sx - 8 + a * 2, top - 12, 2, 2, "#ffe858");
      R(sx + 6 - a * 2, top - 14, 2, 2, "#ffffff");
      R(sx - 1, top - 16 + (a & 1), 2, 2, "#ffe858");
    }

    if (!eq(d.kind, "brachiosaurus") && (d.hp < d.maxHp || d.lead || huge)) {
      int bw = d.lead ? 36 : huge ? 30 : 18;
      int by = top - 6;
      // A boss leader's bar turns bright while it is open to bites (recovering or stunned).
      boolean isOpen = d.lead && (eq(d.atk, "recover") || eq(d.atk, "stun"));
      R(sx - (bw >> 1) - 1, by - 1, bw + 2, 5, "#0c0a16");
      R(sx - (bw >> 1), by, Math.max(1, Math.round(bw * (d.hp / d.maxHp))), 3, d.lead ? (isOpen ? "#fff27a" : "#a85a3a") : d.raid ? "#ff4438" : "#68de58");
    }
  }

  for (int i = 0; i < S.projs.size(); i++) {
    Proj pr = S.projs.get(i);
    int sx = (int) Math.round(pr.x - camX + half);
    if (sx < -16 || sx > vw + 16) continue;
    blit("spit", "idle", tick, sx, pr.y, pr.vx < 0, false);
  }

  for (int i = 0; i < S.players.size(); i++) {
    Player p = S.players.get(i);
    int sx = (int) Math.round(p.x - camX + half);
    if (sx < -50 || sx > vw + 50) continue;
    if (p.downT > 0 && (tick % 8 < 4)) setAlpha(0.55d);
    // The bite animation follows the bite itself: open jaws, snap, shut, back.
    int biteFrame = p.biteT > 0 ? (p.biteT > 11 ? 0 : p.biteT > 7 ? 1 : p.biteT > 3 ? 2 : 3) : -1;
    blit("rex_" + p.type, p.anim, tick, sx, p.y, p.face < 0, eq(S.mode, "play") && p.invT > 26 && (tick % 4 < 2), biteFrame);
    setAlpha(1);
    if (p.carry != null) blit("food" + p.carry.tier, "idle", tick, sx + p.face * 17, p.y - 18, false, false);

    double ty = p.y - 49 - (i % 2) * 9;              // every other tag sits a little higher, so tags of T-rexes standing together overlap less
    T(tagOf(p, i), sx, ty, i == me ? "#ffe868" : "#ffffff", "vt", 1);
    if (p.stunT > 0) T("STUN!", sx, ty - 10, "#ffe858", "vt", 1);
    else if (p.bleedT > 0) T("BLEED", sx, ty - 10, "#ff4848", "vt", 1);
    else if (p.slowT > 0) T("VENOM", sx, ty - 10, "#68f048", "vt", 1);
  }

  drawWaterOverlay(camX, vw, tick);
  fxDrawWorld(camX, vw);
  ctxRestore();

  // where this pane is: biome and distance from the nest
  if (eq(S.mode, "play")) {
    Zone z = biomeAt(camX);
    long far = Math.round(Math.abs(camX));
    String label = z.name + (far < 45 ? "" : "  " + far + "m");
    R(pane.x + 2, pane.y + pane.h - 15, measure(label, "vt") + 6, 13, "rgba(12,10,22,0.7)");
    T(label, pane.x + 5, pane.y + pane.h - 17, "#bcd4f0", "vt", 0);
  }
}

// ---------------------------------------------------------------- top bar
void bar(double x, double y, double w, double h, double frac, String col) {
  frac = Math.max(0, Math.min(1, frac));
  R(x, y, w, h, "#14111f");
  R(x + 1, y + 1, Math.round((w - 2) * frac), h - 2, col);
}

int mapX(double wx, int mx, int mw) { return mx + (int) Math.round(((wx - WORLD_MIN) / (WORLD_MAX - WORLD_MIN)) * (mw - 2)); }

void drawHud(GameState S, int me, int tick) {
  Baby b = S.baby;
  R(0, 0, W, 33, "rgba(10, 9, 18, 0.84)");
  R(0, 33, W, 1, "#2c2640");

  // one chip per T-rex: its number and health, in its type's colour. 4 on the left, 4 on the right.
  for (int i = 0; i < S.players.size(); i++) {
    Player p = S.players.get(i);
    int x = (i < 4 ? 4 : 356) + (i % 2) * 62, y = 3 + ((i % 4) >> 1) * 15;
    T(tagOf(p, i), x, y - 3, i == me ? "#ffe868" : "#ffffff", "vt", 0);
    bar(x + 15, y + 2, 42, 6, p.hp / p.maxHp, p.downT > 0 ? "#686878" : colOf(p));
  }
  if (me >= 0 && S.players.size() <= 4) {                           // alone: your type on the right
    RexDef mine = REXES.get(S.players.get(me).type);
    R(464, 4, 10, 10, mine.col);
    T(mine.name.toUpperCase(), 460, 1, "#ffffff", "vt", 2);
  }

  // the baby: stage, health, hunger, growth
  T("BABY: " + STAGES[Math.min(4, b.stage)], 240, 0, "#ffe868", "vt", 1);
  T("HP", 132, 12, "#ffd0d0", "vt", 0);
  bar(148, 16, 44, 6, b.hp / b.maxHp, b.hp < 35 && (tick % 16 < 8) ? "#ff2020" : "#ff5448");
  T("FD", 198, 12, "#fff0c0", "vt", 0);
  bar(214, 16, 44, 6, b.hunger / 100, b.hunger < 25 && (tick % 16 < 8) ? "#ff8820" : "#f4b438");
  // Growth: the egg shows a timer, later stages show one pip per meal.
  if (b.stage == 0) {
    T("EG", 264, 12, "#c8f8ff", "vt", 0);
    bar(280, 16, 46, 6, b.eggT / (double) EGG_T, "#48d8f0");
  } else {
    T("ML", 264, 12, "#c8f8ff", "vt", 0);
    int need = b.stage >= 4 ? 1 : Math.max(1, b.need), have = b.stage >= 4 ? 1 : b.meals;
    if (need <= 9) {
      int pw = 46 / need;
      for (int i = 0; i < need; i++) {
        R(280 + i * pw, 16, pw - 1, 6, "#0c0a16");
        R(281 + i * pw, 17, pw - 3, 4, i < have ? "#48d8f0" : "#3c3a5c");     // filled or still empty
      }
    } else bar(280, 16, 46, 6, have / (double) need, "#48d8f0");
  }

  // small map of the whole world: nest in the middle, T-rexes in their colours, raiders in red
  int mx = 148, my = 25, mw = 178;
  R(mx, my, mw, 5, "#1d192b");
  R(mx + (mw >> 1) - 1, my, 3, 5, "#ffe868");
  for (int i = 0; i < S.dinos.size(); i++) if (S.dinos.get(i).raid) R(mapX(S.dinos.get(i).x, mx, mw), my + 1, 2, 3, "#ff3030");
  for (int i = 0; i < S.players.size(); i++) R(mapX(S.players.get(i).x, mx, mw), my + 1, 3, 3, i == me ? "#ffffff" : colOf(S.players.get(i)));

  Boss B = S.boss;
  if (B != null && B.warnT > 0) {                                   // a boss wave is on its way
    if (tick % 20 < 14) {
      String name = tx("boss_in") + ": " + tx(B.key);
      R(110, 36, 260, 15, "rgba(150, 20, 16, 0.9)");
      T(B.side < 0 ? "<< " + name : name + " >>", 240, 35, "#ffe868", "vt", 1);
    }
  } else if (B != null) {                                           // boss health: the whole wave together
    R(110, 36, 260, 15, "rgba(12, 10, 22, 0.86)");
    T(tx(B.key), 116, 35, "#ff8a5a", "vt", 0);
    R(246, 40, 118, 7, "#14111f");
    R(247, 41, Math.round(116 * Math.max(0, Math.min(1, B.max != 0 ? B.hp / B.max : 0))), 5, "#ff4a38");
  } else if (S.raidWarnT > 0 && (tick % 24 < 16)) {
    String arrow = S.raidSide < 0 ? "<< " + tx("raid_warn") : tx("raid_warn") + " >>";
    R(145, 36, 190, 15, "rgba(140, 18, 18, 0.85)");
    T(arrow, 240, 35, "#ffe868", "vt", 1);
  }
  if (S.msg != null && TEXT.containsKey(S.msg) && !(B != null && B.warnT > 0)) {
    int my2 = B != null || S.raidWarnT > 0 ? 53 : 36;
    R(70, my2, 340, 15, "rgba(12, 10, 22, 0.82)");
    T(tx(S.msg), 240, my2 - 1, "#ffffff", "vt", 1);
  }
}

// At the start of a game: who got which T-rex type.
void drawDeal(GameState S, int me, int tick) {
  if (!eq(S.mode, "play") || S.tick > 330 || S.paused || eq(app, "pause")) return;
  ArrayList<Integer> list = new ArrayList<Integer>();
  for (int i = 0; i < S.players.size(); i++) if (me < 0 || i == me || S.players.get(i).ai) list.add(i);
  // one line per T-rex: colour, number, type name, what it is good at
  int h = 24 + list.size() * 14;
  R(80, 60, 320, h, "rgba(10, 9, 20, 0.88)");
  R(80, 60, 320, 2, "#f8d040");
  T(tx("deal"), 240, 63, "#ffe868", "vt", 1);
  for (int k = 0; k < list.size(); k++) {
    int i = list.get(k);
    Player p = S.players.get(i);
    RexDef r = REXES.get(p.type);
    int y = 79 + k * 14;
    R(90, y + 4, 8, 8, r.col);
    T(tagOf(p, i), 104, y, i == me ? "#ffe868" : "#ffffff", "vt", 0);
    T(r.name.toUpperCase(), 126, y, "#ffffff", "vt", 0);
    T(r.blurb, 186, y, "#bcd4f0", "vt", 0);
  }
}

String pad2(int v) { return v < 10 ? "0" + v : "" + v; }

void drawEndOverlay(GameState S, int tick) {
  R(0, 0, W, H, "rgba(8, 6, 16, 0.80)");
  if (eq(S.mode, "over")) {
    T(tx("gameover"), 240, 38, "#ff4840", "ps", 1, 2);
    T(tx("gameover_sub"), 240, 68, "#ffd0d0", "vt", 1);
  } else {
    boolean isMet = eq(S.ending, "meteor");
    T(isMet ? tx("win_meteor") : tx("win_volcano"), 240, 40, isMet ? "#ff9448" : "#ffe058", "ps", 1, 1);
    ArrayList<String> lines = wrap(isMet ? tx("win_meteor_sub") : tx("win_volcano_sub"), "vt", 420);
    for (int idx = 0; idx < lines.size(); idx++) T(lines.get(idx), 240, 58 + idx * 16, "#e4ecff", "vt", 1);
  }
  R(120, 98, 240, 92, "rgba(20, 18, 36, 0.92)");
  R(120, 98, 240, 2, "#f8d040");
  int secs = S.tick / 60;
  String[][] rows = {
    { tx("stat_time"), (secs / 60) + ":" + pad2(secs % 60) },
    { tx("stat_fed"), String.valueOf(S.stats.meals) },
    { tx("stat_kills"), String.valueOf(S.stats.kills) },
    { tx("stat_hurt"), String.valueOf(Math.round(S.baby.totalDamage)) }
  };
  for (int i = 0; i < rows.length; i++) {
    T(rows[i][0], 136, 108 + i * 18, "#bcd4f0", "vt", 0);
    T(rows[i][1], 344, 108 + i * 18, "#f8d040", "vt", 2);
  }
  if (S.finaleT > 60 && (tick % 40 < 28)) T(tx("retry_hint"), 240, 214, "#68e878", "vt", 1);
}

// ---------------------------------------------------------------- cameras
// For several players on one screen. The layout only changes after the new grouping has held for
// a moment, so it does not flicker when two players walk in and out of range.
ArrayList<int[]> layout = null;
String pending = "";
int pendingT = 0;
void resetView() { layout = null; pending = ""; pendingT = 0; }

double clampCam(double cx, int vw) {
  int half = vw >> 1;
  return Math.max(WORLD_MIN + half, Math.min(WORLD_MAX - half, cx));
}

final Pane FULL = new Pane(0, 0, 480, 270, 0);
final Pane[] HALVES = { new Pane(0, 0, 239, 270, 0), new Pane(241, 0, 239, 270, 0) };
final Pane[] QUARTERS = {
  new Pane(0, 34, 239, 117, 119), new Pane(241, 34, 239, 117, 119),
  new Pane(0, 153, 239, 117, 119), new Pane(241, 153, 239, 117, 119)
};

// me: your T-rex (alone), or -1 for several players on this screen. humans: the T-rexes played on this screen.
class View {
  int me;
  int[] humans;
  View(int me, int[] humans) { this.me = me; this.humans = humans; }
}

String layoutSig(ArrayList<int[]> groups) {
  StringBuilder sb = new StringBuilder();
  for (int g = 0; g < groups.size(); g++) {
    if (g > 0) sb.append('|');
    for (int k = 0; k < groups.get(g).length; k++) { if (k > 0) sb.append(','); sb.append(groups.get(g)[k]); }
  }
  return sb.toString();
}

void renderGame(GameState S, View view, int tick) {
  int me = view.me;
  if (!eq(S.mode, "play") || me >= 0) {
    double camX = eq(S.mode, "play") ? S.players.get(Math.min(me, S.players.size() - 1)).x : 0;
    drawPane(S, clampCam(camX, 480), FULL, tick, me);
    if (eq(S.mode, "finale")) { T(eq(S.ending, "meteor") ? tx("fin_meteor") : tx("fin_volcano"), 240, 16, "#ffe868", "ps", 1, 1); return; }
    drawHud(S, me, tick);
    drawDeal(S, me, tick);
    if (eq(S.mode, "win") || eq(S.mode, "over")) drawEndOverlay(S, tick);
    return;
  }

  // several players on one screen: group them, at most 4 panes
  int[] who = view.humans;
  double[] xs = new double[who.length];
  for (int k = 0; k < who.length; k++) xs[k] = S.players.get(who[k]).x;
  ArrayList<int[]> groups = new ArrayList<int[]>();
  for (CamGroup cg : cameraGroups(xs, 4)) {
    int[] g = new int[cg.who.size()];
    for (int k = 0; k < g.length; k++) g[k] = who[cg.who.get(k)];
    groups.add(g);
  }
  String sig = layoutSig(groups);
  if (layout == null) layout = groups;
  else if (!sig.equals(layoutSig(layout))) {
    if (sig.equals(pending)) { if (++pendingT > 24) { layout = groups; pendingT = 0; } } else { pending = sig; pendingT = 0; }
  } else pendingT = 0;

  Pane[] panes = layout.size() == 1 ? new Pane[] { FULL } : layout.size() == 2 ? HALVES : QUARTERS;
  for (int k = 0; k < panes.length; k++) {
    Pane pane = panes[k];
    int[] g = k < layout.size() ? layout.get(k) : null;
    double camX = 0;                                               // a spare pane shows the nest
    if (g != null) {
      double lo = Double.POSITIVE_INFINITY, hi = Double.NEGATIVE_INFINITY;
      for (int i : g) { lo = Math.min(lo, S.players.get(i).x); hi = Math.max(hi, S.players.get(i).x); }
      camX = (lo + hi) / 2;
    }
    camX = clampCam(camX, pane.w);
    drawPane(S, camX, pane, tick, -1);
    // a player who walked out of their pane gets an arrow at its edge
    if (g != null) for (int i : g) {
      double off = S.players.get(i).x - camX;
      if (Math.abs(off) <= pane.w / 2.0d - 4) continue;
      int ax = off < 0 ? pane.x + 2 : pane.x + pane.w - 16, ay = pane.y + pane.h - 40;
      R(ax, ay, 14, 13, colOf(S.players.get(i)));
      T((off < 0 ? "<" : "") + (i + 1) + (off < 0 ? "" : ">"), ax + 7, ay - 2, "#ffffff", "vt", 1);
    }
  }
  if (panes.length == 2) R(239, 34, 2, 236, "#f8d040");
  if (panes.length == 4) { R(239, 34, 2, 236, "#f8d040"); R(0, 151, 480, 2, "#f8d040"); }
  drawHud(S, -1, tick);
  drawDeal(S, -1, tick);
}

// ---------------------------------------------------------------- menus and review pages
// Review sheet, 4 rows per page: idle pose and the 4 attack poses.
// Pages 1 to 6: the 24 creatures. 7 and 8: the 8 T-rex types. 9: the baby. 10: the small font.
void drawSheet(int page) {
  R(0, 0, 480, 270, "#2a3550");
  if (page == 10) {   // the small font: every character, then real sentences
    StringBuilder all = new StringBuilder();
    for (int ch = 32; ch < 127; ch++) all.append((char) ch);
    for (int i = 0; i < 4; i++) {
      String part = all.substring(i * 24, Math.min(all.length(), i * 24 + 24));
      StringBuilder spaced = new StringBuilder();
      for (int k = 0; k < part.length(); k++) { if (k > 0) spaced.append(' '); spaced.append(part.charAt(k)); }
      T(spaced.toString(), 8, 2 + i * 14, "#ffffff", "vt", 0);
    }
    String sub = tx("win_meteor_sub");
    String[] lines = { "MULE MENDER CHOMP HOP REACH BRICK DASH REX", "Fern Meadow  Mushroom Forest  Meals  NM mn wv WV", tx("c_k1"), tx("c_pad"), tx("c_tip2"), tx("c_tip3"),
      sub.substring(0, Math.min(68, sub.length())), tx("fin_meteor"), "Jumps very high  Bites from further away  0123456789" };
    for (int i = 0; i < lines.length; i++) T(lines[i], 8, 62 + i * 14, i < 2 ? "#ffe868" : "#bcd4f0", "vt", 0);
    T("MMNN mmnn", 8, 196, "#ffffff", "vt", 0, 3);
    return;
  }
  ArrayList<String> list = new ArrayList<String>();
  if (page <= 6) { for (int i = (page - 1) * 4; i < page * 4 && i < DINO_IDS.size(); i++) list.add(DINO_IDS.get(i)); }
  else if (page <= 8) { for (int i = (page - 7) * 4; i < (page - 6) * 4 && i < REX_IDS.size(); i++) list.add("rex_" + REX_IDS.get(i)); }
  else { list.add("baby1"); list.add("baby2"); list.add("baby3"); list.add("baby4"); }
  String[] heads = { "idle", "wind-up", "strike", "strike end", "recovery" };
  for (int i = 0; i < heads.length; i++) T(heads[i], 120 + i * 76, 2, "#ffe868", "vt", 1);
  for (int r = 0; r < list.size(); r++) {
    String k = list.get(r);
    int gy = 76 + r * 62;
    R(0, gy, 480, 1, "#1a2238");
    RexDef info = k.startsWith("rex_") ? REXES.get(k.substring(4)) : null;
    T(info != null ? info.name + ": " + info.blurb : k, 4, gy - 58, "#ffffff", "vt", 0);
    blit(k, "idle", 0, 120, gy, false, false, 0);
    for (int f = 0; f < 4; f++) blit(k, "attack", 0, 196 + f * 76, gy, false, false, f);
  }
}

void drawMenuBackdrop(int tick) {
  drawBackdropImg("meadow", -500, 500, Math.sin(tick * 0.008d) * 240, 480, 1, "#3b6ea5");
  R(0, 0, 480, 270, "rgba(10, 8, 20, 0.42)");
  if (spritesReady) {
    blit("nest", "idle", tick, 240, 232, false, false);
    blit("baby0", "idle", tick, 240, 227, false, false);
    blit("rex_rex", "idle", tick, 178, 232, false, false);
    blit("rex_chomp", "idle", tick + 12, 302, 232, true, false);
  }
}

void savePicture(File file) {
  try {
    file.getParentFile().mkdirs();
    ImageIO.write(frameImg, "png", file);
  } catch (Exception e) {
    throw new RuntimeException("Could not save " + file + ": " + e);
  }
}
