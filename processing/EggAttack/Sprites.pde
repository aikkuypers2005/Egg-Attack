// Builds every animation frame from data/sprites.json once, with a dark outline, and draws them.
// A port of src/sprites.js. Frames are small ARGB images; drawing goes through the canvas in Draw.pde.

final int OUT_ARGB = 0xFF0C0A16;       // outline colour: 12, 10, 22
final int SPRITE_PAD = 9;              // room around a sprite for parts that move during an animation

class Frame {
  BufferedImage cv, flipped, white, whiteFlipped;
  int ox, oy;
}

final HashMap<String, HashMap<String, Frame[]>> FRAMES = new HashMap<String, HashMap<String, Frame[]>>();
boolean spritesReady = false;

void drawPart(int[] px, int cw, int ch, LinkedHashMap<String, Object> partDef, int dx, int dy) {
  if (partDef == null) return;
  ArrayList<Object> rows = jArr(partDef.get("rows"));
  LinkedHashMap<String, Object> pal = jObj(partDef.get("palette"));
  for (int y = 0; y < rows.size(); y++) {
    String row = jStr(rows.get(y));
    for (int x = 0; x < row.length(); x++) {
      char c = row.charAt(x);
      if (c == '.') continue;
      Object col = pal.get(String.valueOf(c));
      if (col == null) continue;
      int qx = dx + x, qy = dy + y;
      if (qx >= 0 && qy >= 0 && qx < cw && qy < ch) px[qy * cw + qx] = parseCol(jStr(col)) | 0xFF000000;
    }
  }
}

void outlinePixels(int[] px, int cw, int ch) {
  int[] src = px.clone();
  for (int y = 0; y < ch; y++) {
    for (int x = 0; x < cw; x++) {
      if ((src[y * cw + x] >>> 24) != 0) continue;
      boolean near = (x > 0 && (src[y * cw + x - 1] >>> 24) != 0) || (x + 1 < cw && (src[y * cw + x + 1] >>> 24) != 0)
                  || (y > 0 && (src[(y - 1) * cw + x] >>> 24) != 0) || (y + 1 < ch && (src[(y + 1) * cw + x] >>> 24) != 0);
      if (near) px[y * cw + x] = OUT_ARGB;
    }
  }
}

BufferedImage imageOf(int[] px, int w, int h) {
  BufferedImage img = new BufferedImage(w, h, BufferedImage.TYPE_INT_ARGB);
  img.setRGB(0, 0, w, h, px, 0, w);
  return img;
}

BufferedImage mirrored(BufferedImage src) {
  int w = src.getWidth(), h = src.getHeight();
  int[] a = src.getRGB(0, 0, w, h, null, 0, w), b = new int[w * h];
  for (int y = 0; y < h; y++) for (int x = 0; x < w; x++) b[y * w + (w - 1 - x)] = a[y * w + x];
  return imageOf(b, w, h);
}

// the same frame in plain white, made once
BufferedImage whitened(BufferedImage src) {
  int w = src.getWidth(), h = src.getHeight();
  int[] a = src.getRGB(0, 0, w, h, null, 0, w);
  for (int i = 0; i < a.length; i++) a[i] = (a[i] & 0xFF000000) | 0xFFFFFF;
  return imageOf(a, w, h);
}

void buildSprites() {
  if (spritesReady) return;
  LinkedHashMap<String, Object> data = jObj(readJson("sprites.json"));
  LinkedHashMap<String, Object> parts = jObj(data.get("parts")), rigs = jObj(data.get("rigs"));
  String[] animNames = { "idle", "move", "attack", "hurt" };
  for (String rigId : rigs.keySet()) {
    LinkedHashMap<String, Object> rig = jObj(rigs.get(rigId));
    LinkedHashMap<String, Object> anims = jObj(rig.get("anims"));
    ArrayList<Object> rigParts = jArr(rig.get("parts"));
    int rw = jInt(rig.get("w")), rh = jInt(rig.get("h"));
    HashMap<String, Frame[]> byAnim = new HashMap<String, Frame[]>();
    for (String animName : animNames) {
      Object lo = anims.get(animName);
      ArrayList<Object> list = jArr(lo != null ? lo : anims.get("idle"));
      Frame[] frames = new Frame[list.size()];
      for (int fi = 0; fi < list.size(); fi++) {
        LinkedHashMap<String, Object> pose = jObj(list.get(fi));
        int cw = Math.max(1, rw + SPRITE_PAD * 2), ch = Math.max(1, rh + SPRITE_PAD * 2);
        int[] px = new int[cw * ch];
        for (int i = 0; i < rigParts.size(); i++) {
          LinkedHashMap<String, Object> rp = jObj(rigParts.get(i));
          Object off = pose.get(jStr(rp.get("id")));
          int offX = off != null ? jInt(jArr(off).get(0)) : 0, offY = off != null ? jInt(jArr(off).get(1)) : 0;
          drawPart(px, cw, ch, jObj(parts.get(jStr(rp.get("part")))), SPRITE_PAD + jInt(rp.get("x")) + offX, SPRITE_PAD + jInt(rp.get("y")) + offY);
        }
        outlinePixels(px, cw, ch);
        Frame f = new Frame();
        f.cv = imageOf(px, cw, ch);
        f.ox = SPRITE_PAD + jInt(rig.get("ox")); f.oy = SPRITE_PAD + jInt(rig.get("oy"));
        frames[fi] = f;
      }
      byAnim.put(animName, frames);
    }
    FRAMES.put(rigId, byAnim);
  }
  spritesReady = true;
}

// frame: which pose to show. Attacks pass it in (0 wind-up, 1 strike, 2 end of strike, 3 recovery);
// with -1 the animation simply loops on the clock.
Frame getFrame(String rigId, String anim, int tick, int frame) {
  HashMap<String, Frame[]> r = FRAMES.get(rigId);
  if (r == null) return null;
  Frame[] list = r.get(anim);
  if (list == null) list = r.get("idle");
  if (list == null || list.length == 0) return null;
  if (frame >= 0) return list[Math.min(list.length - 1, frame)];
  int rate = eq(anim, "move") ? 6 : eq(anim, "attack") ? 5 : 18;
  if (tick < 0) return null;
  return list[(tick / rate) % list.length];
}

void blit(String rigId, String anim, int tick, double x, double y, boolean flip, boolean flashWhite) {
  blit(rigId, anim, tick, x, y, flip, flashWhite, -1);
}

void blit(String rigId, String anim, int tick, double x, double y, boolean flip, boolean flashWhite, int frame) {
  Frame f = getFrame(rigId, anim, tick, frame);
  if (f == null) return;
  if (flashWhite && f.white == null) f.white = whitened(f.cv);
  BufferedImage img = flashWhite ? f.white : f.cv;
  int rx = (int) Math.round(x), ry = (int) Math.round(y);
  if (flip) {
    // the web version mirrors around x: the picture ends up with its right edge at rx + ox
    if (flashWhite) { if (f.whiteFlipped == null) f.whiteFlipped = mirrored(f.white); img = f.whiteFlipped; }
    else { if (f.flipped == null) f.flipped = mirrored(f.cv); img = f.flipped; }
    ctx.drawImage(img, rx + f.ox - img.getWidth(), ry - f.oy, null);
  } else {
    ctx.drawImage(img, rx - f.ox, ry - f.oy, null);
  }
}
