// All on-screen text in one place. Shared global namespace window.DINO (or global.DINO in Node).
(function () {
  const root = typeof window !== 'undefined' ? window : global;
  const DINO = root.DINO = root.DINO || {};

  DINO.TEXT = {
    title: 'EGG ATTACK',
    sub: 'Guard the egg, feed the baby T-rex, beat the bosses!',
    credit: 'Based on the T-rex sketch by Aik & Job',

    m_solo: 'Play alone (the computer plays your partner)',
    m_local: 'Together on 1 computer (2 to 8 players)',
    m_host: 'Online: host a game (up to 8 players)',
    m_join: 'Online: join a game',
    m_controls: 'Controls & how to play',

    nav: 'Arrows / WASD: choose   Space / Enter: OK',
    back: 'Esc: back to menu',

    lobby_head: 'WHO IS PLAYING?',
    lobby_hint: 'Press your bite button to join. Press it again to leave.',
    lobby_pads: 'Controllers found: {n}',
    lobby_need: 'At least 2 players. Esc: back',
    lobby_go: '{n} players. Press Enter or Start to begin!',

    host_head: 'HOST AN ONLINE GAME',
    host_code: 'Give this code to the other players (up to 7):',
    host_wait: 'Waiting for players',
    host_n: 'Players joined: {n}',
    host_go: 'Press Space / Enter to start.',

    join_head: 'JOIN AN ONLINE GAME',
    join_code: 'Type the 4-letter code from the host:',
    join_go: 'Connecting...',
    join_ok: 'Connected! You are player {n}.',
    join_n: 'Players in the game: {n}. Waiting for the host to start...',

    net_err: 'Could not connect. Check the room code.',
    net_lost: 'The connection was lost.',
    net_bye: 'The host ended the game.',
    ai_took: 'A player left. The computer took over their T-rex.',

    // on a phone or tablet (touch buttons instead of keys)
    t_nav: 'Tap a line to choose',
    t_back: 'Tap here to go back',
    t_lobby_need: 'At least 2 players. Tap here to go back',
    t_lobby_go: '{n} players. Tap here to begin!',
    t_host_go: 'Tap the code to start.',
    t_join_code: 'Tap the 4 letters of the code from the host:',
    t_join: 'JOIN',
    t_dev: 'Touch buttons',
    t_retry_hint: 'Tap to return to the menu',
    c_touch: 'Touch: arrow buttons walk; JUMP, BITE, GRAB (grab also drops)',

    leave_q: 'LEAVE THE GAME?',
    keep: 'Keep playing',

    paused: 'PAUSED',
    resume: 'Resume game',
    tomenu: 'Quit to title menu',

    c_head: 'CONTROLS & GOAL',
    c_k1: 'Keys 1: Left/Right walk, Up jump, Space bite, Down grab',
    c_k2: 'Keys 2: A/D walk, W jump, F bite, S grab',
    c_k3: 'Keys 3: J/L walk, I jump, H bite, K grab',
    c_k4: 'Keys 4: Numpad 4/6 walk, 8 jump, 0 bite, 5 grab',
    c_pad: 'Controller: stick walk, A jump, X bite, B grab (grab also drops)',
    c_solo: 'Alone or online: Keys 1, Keys 2 and the first controller all work.',
    c_tip1: '1. Hunt in the biomes and carry the meat to the nest for meals.',
    c_tip2: '2. A bigger baby needs meat from further away. Raider meat: snack.',
    c_tip3: '3. Enemies show ! before they attack. Jump or step back, then bite.',
    c_tip4: '4. A boss comes when the baby is ready to grow. Bite it when tired.',
    c_tip5: '5. Every game deals everyone a different T-rex type.',

    stages: ['EGG', 'HATCHLING', 'TODDLER', 'JUVENILE', 'GROWN UP'],
    deal: 'THIS GAME\'S T-REXES',

    raid_warn: 'RAID ON THE NEST!',
    starving: 'THE BABY IS STARVING!',
    hatched: 'The egg hatched! Now it needs meals.',
    stage_up: 'The baby grew! It needs meat from further away now.',
    need_bigger: 'Too small to count as a meal. Hunt further out!',
    egg_hint: 'The egg needs no food yet. Guard it!',

    boss_in: 'BOSS INCOMING',
    boss1: 'RAPTOR PACK',
    boss2: 'HORNED AMBUSH',
    boss3: 'RIVER AND SKY SIEGE',
    boss4: 'APEX CLASH',

    gameover: 'THE NEST HAS FALLEN',
    gameover_sub: 'The baby T-rex did not survive...',
    retry_hint: 'Press Space / Enter to return to the menu',

    win_volcano: 'VOLCANO ENDING!',
    win_volcano_sub: 'You kept the baby safe. As the volcano erupts, your grown T-rex family rules the valley!',
    win_meteor: 'METEOR ENDING!',
    win_meteor_sub: 'The baby was hurt a lot, but it grew up. Just then, a giant meteor hits the planet!',
    fin_volcano: 'THE VOLCANO ERUPTS!',
    fin_meteor: 'A GIANT METEOR IS COMING!',

    stat_time: 'Time played',
    stat_fed: 'Meals delivered',
    stat_kills: 'Dinos defeated',
    stat_hurt: 'Damage to the baby'
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = DINO;
})();
