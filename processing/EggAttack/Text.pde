// All on-screen text in one place: src/text.js without the entries for online play.

final HashMap<String, String> TEXT = new HashMap<String, String>();
final String[] STAGES = { "EGG", "HATCHLING", "TODDLER", "JUVENILE", "GROWN UP" };

void initText() {
  if (!TEXT.isEmpty()) return;
  TEXT.put("title", "EGG ATTACK");
  TEXT.put("sub", "Guard the egg, feed the baby T-rex, beat the bosses!");
  TEXT.put("credit", "Based on the T-rex sketch by Aik & Job");

  TEXT.put("m_solo", "Play alone (the computer plays your partner)");
  TEXT.put("m_local", "Together on 1 computer (2 to 8 players)");
  TEXT.put("m_controls", "Controls & how to play");

  TEXT.put("nav", "Arrows / WASD: choose   Space / Enter: OK");
  TEXT.put("back", "Esc: back to menu");

  TEXT.put("lobby_head", "WHO IS PLAYING?");
  TEXT.put("lobby_hint", "Press your bite button to join. Press it again to leave.");
  TEXT.put("lobby_pads", "Controllers found: {n}");
  TEXT.put("lobby_need", "At least 2 players. Esc: back");
  TEXT.put("lobby_go", "{n} players. Press Enter or Start to begin!");

  TEXT.put("paused", "PAUSED");
  TEXT.put("resume", "Resume game");
  TEXT.put("tomenu", "Quit to title menu");

  TEXT.put("c_head", "CONTROLS & GOAL");
  TEXT.put("c_k1", "Keys 1: Left/Right walk, Up jump, Space bite, Down grab");
  TEXT.put("c_k2", "Keys 2: A/D walk, W jump, F bite, S grab");
  TEXT.put("c_k3", "Keys 3: J/L walk, I jump, H bite, K grab");
  TEXT.put("c_k4", "Keys 4: Numpad 4/6 walk, 8 jump, 0 bite, 5 grab");
  TEXT.put("c_pad", "Controller: stick walk, A jump, X bite, B grab (grab also drops)");
  // The web text says "Alone or online". This version has no online play.
  TEXT.put("c_solo", "Alone: Keys 1, Keys 2 and the first controller all work.");
  TEXT.put("c_tip1", "1. Hunt in the biomes and carry the meat to the nest for meals.");
  TEXT.put("c_tip2", "2. A bigger baby needs meat from further away. Raider meat: snack.");
  TEXT.put("c_tip3", "3. Enemies show ! before they attack. Jump or step back, then bite.");
  TEXT.put("c_tip4", "4. A boss comes when the baby is ready to grow. Bite it when tired.");
  TEXT.put("c_tip5", "5. Every game deals everyone a different T-rex type.");

  TEXT.put("deal", "THIS GAME'S T-REXES");

  TEXT.put("raid_warn", "RAID ON THE NEST!");
  TEXT.put("starving", "THE BABY IS STARVING!");
  TEXT.put("hatched", "The egg hatched! Now it needs meals.");
  TEXT.put("stage_up", "The baby grew! It needs meat from further away now.");
  TEXT.put("need_bigger", "Too small to count as a meal. Hunt further out!");
  TEXT.put("egg_hint", "The egg needs no food yet. Guard it!");

  TEXT.put("boss_in", "BOSS INCOMING");
  TEXT.put("boss1", "RAPTOR PACK");
  TEXT.put("boss2", "HORNED AMBUSH");
  TEXT.put("boss3", "RIVER AND SKY SIEGE");
  TEXT.put("boss4", "APEX CLASH");

  TEXT.put("gameover", "THE NEST HAS FALLEN");
  TEXT.put("gameover_sub", "The baby T-rex did not survive...");
  TEXT.put("retry_hint", "Press Space / Enter to return to the menu");

  TEXT.put("win_volcano", "VOLCANO ENDING!");
  TEXT.put("win_volcano_sub", "You kept the baby safe. As the volcano erupts, your grown T-rex family rules the valley!");
  TEXT.put("win_meteor", "METEOR ENDING!");
  TEXT.put("win_meteor_sub", "The baby was hurt a lot, but it grew up. Just then, a giant meteor hits the planet!");
  TEXT.put("fin_volcano", "THE VOLCANO ERUPTS!");
  TEXT.put("fin_meteor", "A GIANT METEOR IS COMING!");

  TEXT.put("stat_time", "Time played");
  TEXT.put("stat_fed", "Meals delivered");
  TEXT.put("stat_kills", "Dinos defeated");
  TEXT.put("stat_hurt", "Damage to the baby");
}

// The text for a key, or an empty string when there is none.
String tx(String k) {
  String s = k == null ? null : TEXT.get(k);
  return s == null ? "" : s;
}
