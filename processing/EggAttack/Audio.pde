// Sound: the music loop and the sound effects. A port of src/audio.js.
// The effects are not recordings. Each one is built from a few simple parts listed in data/sfx.json
// (see tools/build_data.js). renderSfx does the same sums as A.render of the web version.
// Music: "Bassa Island Game Loop" by Kevin MacLeod (incompetech.com), CC BY 4.0. See data/MUSIC-CREDITS.txt.
//
// Only javax.sound.sampled is used, no library. One output line is opened, and a thread of its own mixes
// the music and the effects into it, so the game never waits for sound. Whatever goes wrong with sound
// (no device, a line that fails, a missing file) is caught: the game then runs silently.
// The modes without a window (test, shots, sheets) never call initAudio, so they open no audio device.

import java.util.concurrent.ConcurrentLinkedQueue;
import javax.sound.sampled.AudioFormat;
import javax.sound.sampled.AudioInputStream;
import javax.sound.sampled.AudioSystem;
import javax.sound.sampled.DataLine;
import javax.sound.sampled.SourceDataLine;

final String MUSIC_FILE = "bassa-island-game-loop.wav";   // 30.72 s: 16 bars at 125 beats a minute, cut so it repeats without a gap
final double SFX_VOLUME = 0.6d, MUSIC_VOLUME = 0.3d;

// ---------------------------------------------------------------- the table: data/sfx.json
class SfxPart {
  String w;                    // sq, saw, tri, sin or noise
  double f0, f1, lp0, lp1, d, v, t;
}

class SfxEvent {
  String snd;
  double range, min;           // range 0: heard everywhere
}

int sfxRate = 22050;
final LinkedHashMap<String, SfxPart[]> SFX_SOUNDS = new LinkedHashMap<String, SfxPart[]>();
final HashMap<String, SfxEvent> SFX_EVENTS = new HashMap<String, SfxEvent>();
boolean sfxLoaded = false;

void loadSfx() {
  if (sfxLoaded) return;
  try {
    LinkedHashMap<String, Object> data = jObj(readJson("sfx.json"));
    sfxRate = jInt(data.get("rate"));
    LinkedHashMap<String, Object> sounds = jObj(data.get("sounds")), events = jObj(data.get("events"));
    for (String name : sounds.keySet()) {
      ArrayList<Object> list = jArr(sounds.get(name));
      SfxPart[] parts = new SfxPart[list.size()];
      for (int i = 0; i < parts.length; i++) {
        LinkedHashMap<String, Object> o = jObj(list.get(i));
        SfxPart p = new SfxPart();
        p.w = jStr(o.get("w")); p.d = jNum(o.get("d")); p.v = jNum(o.get("v")); p.t = jNum(o.get("t"));
        if (o.get("f") != null) { p.f0 = jNum(jArr(o.get("f")).get(0)); p.f1 = jNum(jArr(o.get("f")).get(1)); }
        Object lp = o.get("lp");
        if (lp instanceof ArrayList) { p.lp0 = jNum(jArr(lp).get(0)); p.lp1 = jNum(jArr(lp).get(1)); }
        else if (lp != null) { p.lp0 = jNum(lp); p.lp1 = p.lp0; }
        parts[i] = p;
      }
      SFX_SOUNDS.put(name, parts);
    }
    for (String name : events.keySet()) {
      LinkedHashMap<String, Object> o = jObj(events.get(name));
      SfxEvent m = new SfxEvent();
      m.snd = jStr(o.get("snd"));
      m.range = o.get("range") != null ? jNum(o.get("range")) : 0;
      m.min = o.get("min") != null ? jNum(o.get("min")) : 0;
      SFX_EVENTS.put(name, m);
    }
    sfxLoaded = true;
  } catch (Throwable e) {
    auError = "sfx.json: " + e;
  }
}

// ---------------------------------------------------------------- building an effect
// Returns the samples (-1..1) of one sound at the given rate.
//   tone : frequency slides from f0 to f1 (evenly in pitch) over d seconds; loudness v * (1 - time)^2
//   noise: white noise through a simple low-pass (lp, or sliding from lp0 to lp1); loudness v * (1 - time)
//   Every part fades in over the first 44 samples, so it does not click.
// The web version adds the parts up in 32-bit floats; so does this (out is a float array).
float[] renderSfx(SfxPart[] parts, int rate) {
  int total = 0;
  for (SfxPart p : parts) total = Math.max(total, (int) Math.round((p.t + p.d) * rate));
  float[] out = new float[total + 1];
  for (int pi = 0; pi < parts.length; pi++) {
    SfxPart p = parts[pi];
    int n = Math.max(1, (int) Math.round(p.d * rate)), at = (int) Math.round(p.t * rate);
    if (eq(p.w, "noise")) {
      int seed = 12345 + pi * 977;
      double y = 0;
      for (int i = 0; i < n; i++) {
        double tt = i / (double) n;
        seed = (seed * 1103515245 + 12345) & 0x7fffffff;
        double white = seed / 1073741824.0d - 1;
        double cut = p.lp0 * StrictMath.pow(p.lp1 / p.lp0, tt);
        y += (1 - StrictMath.exp(-2 * Math.PI * cut / rate)) * (white - y);
        if (at + i < out.length) out[at + i] += y * p.v * (1 - tt) * Math.min(1, i / 44.0d);
      }
    } else {
      double phase = 0;
      for (int i = 0; i < n; i++) {
        double tt = i / (double) n;
        phase += p.f0 * StrictMath.pow(p.f1 / p.f0, tt) / rate;
        double ph = phase - Math.floor(phase);
        double w = eq(p.w, "sq") ? (ph < 0.5d ? 1 : -1) : eq(p.w, "saw") ? 2 * ph - 1 : eq(p.w, "tri") ? 1 - 4 * Math.abs(ph - 0.5d) : StrictMath.sin(2 * Math.PI * ph);
        if (at + i < out.length) out[at + i] += w * p.v * (1 - tt) * (1 - tt) * Math.min(1, i / 44.0d);
      }
    }
  }
  for (int i = 0; i < out.length; i++) out[i] = Math.max(-1, Math.min(1, out[i]));
  return out;
}

// How loud an event is for a listener: 1 everywhere for events without a range, otherwise fading with
// the distance to the nearest of the T-rexes shown on this screen (ears: their x positions).
double loudness(SfxEvent m, double x, double[] ears) {
  if (m.range == 0) return 1;
  double dist = Double.POSITIVE_INFINITY;
  for (double e : ears) dist = Math.min(dist, Math.abs(x - e));
  return Math.max(m.min, 1 - dist / m.range);
}

// ---------------------------------------------------------------- playing
volatile boolean auOn = true;                        // Sound: on / off (not remembered after the game is closed)
int auStarted = 0;                                   // effects started so far (counted also when there is no audio device)
String auLastSound = "";
final HashMap<String, Integer> auCounts = new HashMap<String, Integer>();     // how often each sound was started
final HashMap<String, Integer> auLastPlay = new HashMap<String, Integer>();   // the step in which each sound was last started
final HashMap<String, float[]> auBufs = new HashMap<String, float[]>();
int auLastEv = 0;
boolean auFresh = true;
String auError = "";                                 // the last thing that went wrong with sound, for the log

void auSetOn(boolean on) {
  auOn = on;
  if (audioOut != null) audioOut.switched = true;    // off: what is still waiting in the line is thrown away, so it is silent at once
}

String soundLine() { return auOn ? tx("sound_on") : tx("sound_off"); }

void auPlay(String name) { auPlay(name, 1); }

void auPlay(String name, double vol) {
  try {
    if (!sfxLoaded || !auOn) return;
    // The same sound twice at once is only louder: not again within 40 ms. Time is counted in game steps (60 a second).
    Integer last = auLastPlay.get(name);
    if (last != null && t >= last && (t - last) * STEP < 40) return;
    SfxPart[] parts = SFX_SOUNDS.get(name);
    if (parts == null) return;
    auLastPlay.put(name, t);
    auStarted++;
    auLastSound = name;
    Integer c = auCounts.get(name);
    auCounts.put(name, c == null ? 1 : c + 1);
    if (audioOut == null || !audioOut.deviceOk) return;        // no audio device: counted, but nothing to hear
    float[] data = auBufs.get(name);
    if (data == null) { data = renderSfx(parts, sfxRate); auBufs.put(name, data); }
    audioOut.add(data, Math.max(0, Math.min(1, vol)) * SFX_VOLUME);
  } catch (Throwable e) {
    auError = "effect " + name + ": " + e;
  }
}

// New game events become sounds. ears: the x of every T-rex shown on this screen.
void auReset() { auLastEv = 0; auFresh = true; }

void auEvents(GameState S, double[] ears) {
  if (S == null || S.evs == null || !sfxLoaded) return;
  if (auFresh) { auFresh = false; auLastEv = S.tick > 30 ? S.evN : 0; }     // a game that is already running: skip what already happened
  if (S.evN < auLastEv) auLastEv = 0;
  for (int i = 0; i < S.evs.size(); i++) {
    Ev e = S.evs.get(i);
    if (e.n <= auLastEv) continue;
    auLastEv = e.n;
    SfxEvent m = SFX_EVENTS.get(e.s);
    if (m == null) continue;
    double v = loudness(m, e.x, ears);
    if (v > 0.03d) auPlay(m.snd, v);
  }
}

// ---------------------------------------------------------------- the audio device (window mode only)
class Voice {
  float[] data;
  double pos = 0, step, gain;
}

// Opens one output line and keeps it filled: the music loop plus every effect that is sounding.
class AudioOut implements Runnable {
  volatile boolean running = true, deviceOk = false, musicOk = false, switched = false;
  volatile long framesWritten = 0, lastEmptyAt = -1;     // lastEmptyAt: how many frames had been written when the line last ran empty
  volatile int voicesAdded = 0, linesOpened = 0, ranEmpty = 0;       // ranEmpty: how often the line had nothing left to play (a gap you can hear)
  volatile String device = "", error = "", musicInfo = "";
  SourceDataLine line = null;
  float rate = 44100;
  short[] music = null;                              // left, right, left, right, ...
  int musicPos = 0;
  final ConcurrentLinkedQueue<Voice> waiting = new ConcurrentLinkedQueue<Voice>();
  final ArrayList<Voice> voices = new ArrayList<Voice>();

  void add(float[] data, double gain) {
    if (waiting.size() > 64) return;                 // the mixing thread is stuck (a device that went away): do not pile up
    Voice v = new Voice();
    v.data = data; v.gain = gain; v.step = sfxRate / (double) rate;
    waiting.add(v);
    voicesAdded++;
  }

  void loadMusic() {
    try {
      File f = new File(dataPath(MUSIC_FILE));
      AudioInputStream in = AudioSystem.getAudioInputStream(f);
      AudioFormat src = in.getFormat();
      AudioFormat want = new AudioFormat(AudioFormat.Encoding.PCM_SIGNED, src.getSampleRate(), 16, 2, 4, src.getSampleRate(), false);
      if (!src.matches(want)) in = AudioSystem.getAudioInputStream(want, in);
      byte[] raw = in.readAllBytes();
      in.close();
      short[] m = new short[raw.length / 2];
      for (int i = 0; i < m.length; i++) m[i] = (short) ((raw[i * 2] & 255) | (raw[i * 2 + 1] << 8));
      if (m.length >= 2) {
        music = m;
        rate = src.getSampleRate();
        musicOk = true;
        musicInfo = (m.length / 2) + " frames at " + (int) rate + " Hz = " + (m.length / 2) / rate + " s";
      }
    } catch (Throwable e) {
      error = "music: " + e;
    }
  }

  public void run() {
    try {
      loadMusic();
      AudioFormat fmt = new AudioFormat(rate, 16, 2, true, false);
      DataLine.Info info = new DataLine.Info(SourceDataLine.class, fmt);
      line = (SourceDataLine) AudioSystem.getLine(info);
      int chunk = 512, bufFrames = Math.max(chunk * 4, (int) (rate * 0.085f));      // about 85 ms: short enough for effects, long enough not to run empty
      LineOpener.openLine(line, fmt, bufFrames * 4);           // line.open(...), see LineOpener.java
      linesOpened++;
      line.start();
      device = line.getLineInfo() + ", buffer " + line.getBufferSize() / 4 + " frames";
      deviceOk = true;
      byte[] out = new byte[chunk * 4];
      double gain = auOn ? 1 : 0, gainStep = 1.0d / (rate * 0.01d);
      boolean flushed = false;                         // the line was just emptied on purpose (sound switched off)
      while (running) {
        if (switched) {
          switched = false;
          if (!auOn) { line.flush(); voices.clear(); waiting.clear(); gain = 0; flushed = true; }
        }
        Voice nv;
        while ((nv = waiting.poll()) != null) voices.add(nv);
        for (int i = 0; i < chunk; i++) {
          double target = auOn ? 1 : 0;
          if (gain < target) gain = Math.min(target, gain + gainStep); else if (gain > target) gain = Math.max(target, gain - gainStep);
          double l = 0, r = 0;
          if (music != null) {
            l = music[musicPos] / 32768.0d * MUSIC_VOLUME; r = music[musicPos + 1] / 32768.0d * MUSIC_VOLUME;
            musicPos += 2;
            if (musicPos + 1 >= music.length) musicPos = 0;             // the loop: straight back to the first sample
          }
          double fx = 0;
          for (int k = voices.size() - 1; k >= 0; k--) {
            Voice v = voices.get(k);
            int p0 = (int) v.pos;
            if (p0 >= v.data.length - 1) { voices.remove(k); continue; }
            double fr = v.pos - p0;
            fx += (v.data[p0] * (1 - fr) + v.data[p0 + 1] * fr) * v.gain;
            v.pos += v.step;
          }
          int li = (int) Math.round(Math.max(-1, Math.min(1, (l + fx) * gain)) * 32767), ri = (int) Math.round(Math.max(-1, Math.min(1, (r + fx) * gain)) * 32767);
          out[i * 4] = (byte) li; out[i * 4 + 1] = (byte) (li >> 8); out[i * 4 + 2] = (byte) ri; out[i * 4 + 3] = (byte) (ri >> 8);
        }
        if (framesWritten > 0 && !flushed && line.available() >= line.getBufferSize()) { ranEmpty++; lastEmptyAt = framesWritten; }
        flushed = false;
        line.write(out, 0, out.length);
        framesWritten += chunk;
      }
    } catch (Throwable e) {
      error = (error.isEmpty() ? "" : error + "; ") + "output: " + e;
    } finally {
      deviceOk = false;
      try { if (line != null) { line.stop(); line.close(); } } catch (Throwable e) { /* nothing to do */ }
    }
  }
}

AudioOut audioOut = null;

// Called once, when the window opens. Starts the music. Never in the modes without a window.
void initAudio() {
  if (audioOut != null) return;
  try {
    loadSfx();
    final AudioOut ao = new AudioOut();
    audioOut = ao;
    Thread th = new Thread(ao, "EggAttack audio");
    th.setDaemon(true);
    th.start();
    Runtime.getRuntime().addShutdownHook(new Thread(new Runnable() { public void run() { ao.running = false; } }));
  } catch (Throwable e) {
    auError = "audio: " + e;
  }
}

// What can be said about sound without listening, for the log of the autoplay mode.
String audioFacts() {
  StringBuilder b = new StringBuilder();
  AudioOut ao = audioOut;
  if (ao == null) b.append("no audio output was started");
  else {
    b.append("output line opened: ").append(ao.deviceOk ? "yes" : "no");
    if (ao.deviceOk) {
      boolean isOpen = false, active = false;
      long pos = -1;
      try { isOpen = ao.line.isOpen(); active = ao.line.isActive(); pos = ao.line.getLongFramePosition(); } catch (Throwable e) { /* stays false */ }
      b.append(" (").append(ao.device).append("), line open ").append(isOpen).append(", playing ").append(active)
        .append(", frames written ").append(ao.framesWritten).append(", frames played ").append(pos).append(", ran empty ").append(ao.ranEmpty).append(" times").append(ao.ranEmpty > 0 ? " (last after " + ao.lastEmptyAt + " frames written)" : "");
    }
    b.append("; music: ").append(ao.musicOk ? ao.musicInfo + ", at " + fixed(ao.musicPos / 2 / (double) ao.rate, 1) + " s" : "not loaded");
    b.append("; effects handed to the line: ").append(ao.voicesAdded);
    if (!ao.error.isEmpty()) b.append("; error: ").append(ao.error);
  }
  b.append("; sound ").append(auOn ? "on" : "off").append("; effects started: ").append(auStarted);
  if (!auError.isEmpty()) b.append("; error: ").append(auError);
  return b.toString();
}

// The names of the threads that exist only when sound is in use: this game's mixing thread and Java's own.
String audioThreads() {
  ArrayList<String> names = new ArrayList<String>();
  for (Thread th : Thread.getAllStackTraces().keySet()) {
    String n = th.getName();
    if (n.startsWith("EggAttack audio") || n.startsWith("Java Sound") || n.startsWith("Direct Clip") || n.startsWith("Headspace")) names.add(n);
  }
  java.util.Collections.sort(names);
  StringBuilder b = new StringBuilder();
  for (String n : names) b.append(b.length() > 0 ? ", " : "").append(n);
  return b.toString();
}

String audioCounts() {
  ArrayList<String> names = new ArrayList<String>(auCounts.keySet());
  java.util.Collections.sort(names);
  StringBuilder b = new StringBuilder();
  for (String n : names) b.append(b.length() > 0 ? ", " : "").append(n).append(" ").append(auCounts.get(n));
  return b.length() > 0 ? b.toString() : "none";
}
