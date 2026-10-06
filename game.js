// =====================================================================
// 🎮 Battle City — Стальные коты
// Step 9.1: редактор из меню + размер карты + без врагов
// =====================================================================

// ---------------------------------------------------------------------
// CONFIG
// ---------------------------------------------------------------------
const CONFIG = {
  TILE: 28,
  GRID: 17,                // 🆕 изменяемое
  MIN_GRID: 11,
  MAX_GRID: 21,

  FPS: 60,
  STEP_MS: 1000 / 60,
  GRID_ALPHA: 0.025,

  PLAYER: {
    SPEED_BASE: 90,
    SPEED_PER_LEVEL: 15,
    SNAP_SPEED: 200,
    BULLET_SPEED: 280,
    BULLET_SIZE: 6,
    RELOAD_BASE: 380,
    RELOAD_PER_LEVEL: 80,
    RELOAD_MIN: 140,
    INVULN_MS: 3000,
    INVULN_HIT_MS: 900,
    RESPAWN_MS: 1500,
  },

  ENEMY: {
    BULLET_SPEED: 200,
    BULLET_SIZE: 6,
    SNAP_SPEED: 200,
  },

  SPAWN_INTERVAL_START: 2600,
  SPAWN_INTERVAL_PER_LEVEL: 150,
  SPAWN_INTERVAL_MIN: 1000,
  MAX_CONCURRENT_START: 3,
  MAX_CONCURRENT_PER_2_LEVELS: 1,

  LS_BEST: 'battleCityBest',
  LS_CUSTOM_LEVELS: 'battleCityCustomLevels',

  PALETTE: {
    bg:         '#0a0612',
    brick:      '#b8543a',
    brickLight: '#d96a4a',
    brickDark:  '#6e2c1c',
    steel:      '#c8c8d2',
    steelLight: '#f0f0f5',
    steelDark:  '#6e6e7a',
    water:      '#1e4f9e',
    waterLight: '#5c94e8',
    waterDeep:  '#0d2c5e',
    trees:      '#2d7a3a',
    treesLight: '#4aa85a',
    treesDark:  '#123a1c',
    base:       '#ffd24a',
    baseLight:  '#fff0a8',
    baseDark:   '#7a5210',
    baseBg:     '#2a1a05',
    playerTrack:      '#5a2a4a',
    playerTrackLight: '#a04a7a',
    playerBody:       '#ff8fc8',
    playerBodyLight:  '#ffb7e0',
    playerTurret:     '#c66ba0',
    playerBarrel:     '#ffffff',
    bullet:     '#ffd24a',
    bulletGlow: '#ff8fc8',
  },
};

// 🆕 W и SPAWN_POINTS теперь динамические
let W = CONFIG.TILE * CONFIG.GRID;

function updateW() {
  W = CONFIG.TILE * CONFIG.GRID;
  canvas.width = W;
  canvas.height = W;
}

function getSpawnPoints() {
  const g = CONFIG.GRID;
  const mid = Math.floor(g / 2);
  return [
    { x: 0,     y: 0 },
    { x: mid,   y: 0 },
    { x: g - 1, y: 0 },
  ];
}

// ---------------------------------------------------------------------
// UPGRADES
// ---------------------------------------------------------------------
const UPGRADES = [
  { key: 'speed',  icon: '⚡', name: 'Скорость', max: 4,
    levelText: (l) => `Ур. ${l} → ${l + 1}`,
    desc: (l) => `${CONFIG.PLAYER.SPEED_BASE + (l - 1) * CONFIG.PLAYER.SPEED_PER_LEVEL} → ${CONFIG.PLAYER.SPEED_BASE + l * CONFIG.PLAYER.SPEED_PER_LEVEL} px/с` },
  { key: 'armor',  icon: '🛡', name: 'Броня', max: 4,
    levelText: (l) => `Ур. ${l} → ${l + 1}`,
    desc: (l) => `Держит ${l} → ${l + 1} попадание(я)` },
  { key: 'reload', icon: '🔥', name: 'Скорострельность', max: 4,
    levelText: (l) => `Ур. ${l} → ${l + 1}`,
    desc: (l) => {
      const from = CONFIG.PLAYER.RELOAD_BASE - (l - 1) * CONFIG.PLAYER.RELOAD_PER_LEVEL;
      const to   = Math.max(CONFIG.PLAYER.RELOAD_MIN, CONFIG.PLAYER.RELOAD_BASE - l * CONFIG.PLAYER.RELOAD_PER_LEVEL);
      return `${from} → ${to} мс`;
    } },
  { key: 'damage', icon: '💥', name: 'Урон', max: 3,
    levelText: (l) => `Ур. ${l} → ${l + 1}`,
    desc: (l) => l === 0 ? 'Пробивает 1 врага' : (l === 1 ? 'Пробивает 2 врагов' : 'Пробивает 3 + сталь') },
  { key: 'doubleShot', icon: '🎯', name: 'Двойной выстрел', max: 1,
    levelText: () => 'Спец-умение',
    desc: () => 'Стреляет двумя пулями сразу' },
];

// ---------------------------------------------------------------------
// ENEMY TYPES + PROGRESSION
// ---------------------------------------------------------------------
const ENEMY_TYPES = {
  basic: { hp: 1, speed: 45,  fireRate: 1.6, score: 100,  color: '#b0b0b0', colorDark: '#5a5a5a' },
  fast:  { hp: 1, speed: 100, fireRate: 1.6, score: 200,  color: '#ffffff', colorDark: '#a0a0a0' },
  power: { hp: 1, speed: 45,  fireRate: 0.6, score: 300,  color: '#ff5f5f', colorDark: '#a03030' },
  armor: { hp: 4, speed: 35,  fireRate: 1.2, score: 400,  color: '#4aa85a', colorDark: '#2a6030' },
  heavy: { hp: 2, speed: 100, fireRate: 0.6, score: 500,  color: '#ffd24a', colorDark: '#a08030' },
  boss:  { hp: 8, speed: 50,  fireRate: 0.5, score: 1000, color: '#b87cff', colorDark: '#5a3a9a' },
};

const PROGRESSION = [
  { basic: 8 },
  { basic: 7, fast: 4 },
  { basic: 6, fast: 4, power: 3 },
  { basic: 5, fast: 4, power: 3, armor: 3 },
  { basic: 4, fast: 4, power: 3, armor: 3, heavy: 2 },
  { basic: 3, fast: 4, power: 4, armor: 3, heavy: 3, boss: 1 },
  { basic: 3, fast: 4, power: 4, armor: 4, heavy: 3, boss: 1 },
  { basic: 2, fast: 4, power: 5, armor: 4, heavy: 4, boss: 2 },
];

// ---------------------------------------------------------------------
// DOM
// ---------------------------------------------------------------------
const canvas      = document.getElementById('game');
const ctx         = canvas.getContext('2d');
const boardWrapper = document.getElementById('board-wrapper');

const hudLevel    = document.getElementById('hud-level');
const hudScore    = document.getElementById('hud-score');
const hudLives    = document.getElementById('hud-lives');
const hudEnemies  = document.getElementById('hud-enemies');

const buildSpeed  = document.getElementById('build-speed');
const buildArmor  = document.getElementById('build-armor');
const buildReload = document.getElementById('build-reload');
const buildDamage = document.getElementById('build-damage');
const buildDouble = document.getElementById('build-double');

const overlay     = document.getElementById('overlay');
const overlayTitle = document.getElementById('overlay-title');
const overlayText  = document.getElementById('overlay-text');
const startBtn     = document.getElementById('start-btn');

const menuExtras   = document.getElementById('menu-extras');
const menuEditorBtn = document.getElementById('menu-editor-btn');
const menuLevelsBtn = document.getElementById('menu-levels-btn');

const pauseExtras     = document.getElementById('pause-extras');
const openEditorBtn   = document.getElementById('open-editor-btn');
const openLevelsBtn   = document.getElementById('open-levels-btn');

const editorOverlay   = document.getElementById('editor-overlay');
const editorCanvas    = document.getElementById('editor-canvas');
const editorClearBtn  = document.getElementById('editor-clear');
const editorCloseBtn  = document.getElementById('editor-close');
const editorSaveBtn   = document.getElementById('editor-save');
const editorApplyBtn  = document.getElementById('editor-apply');
const paletteBtns     = document.querySelectorAll('.palette-btn');

const sizeMinusBtn = document.getElementById('size-minus');
const sizePlusBtn  = document.getElementById('size-plus');
const sizeValueEl  = document.getElementById('size-value');
const noEnemiesChk = document.getElementById('editor-no-enemies');

const levelsOverlay   = document.getElementById('levels-overlay');
const levelsList      = document.getElementById('levels-list');
const levelsCloseBtn  = document.getElementById('levels-close');

const upgradeOverlay  = document.getElementById('upgrade-overlay');
const upgradeLevelNum = document.getElementById('upgrade-level-num');
const upgradeCards    = document.getElementById('upgrade-cards');

// ---------------------------------------------------------------------
// STATE
// ---------------------------------------------------------------------
const state = {
  isRunning: false,
  isPaused: false,
  animId: null,
  lastTime: 0,
  accumulator: 0,

  level: 1,
  score: 0,
  best: +(localStorage.getItem(CONFIG.LS_BEST) || 0),
  lives: 3,

  enemiesTotal: 0,
  enemiesKilled: 0,
  maxConcurrent: CONFIG.MAX_CONCURRENT_START,
  spawnIntervalMs: CONFIG.SPAWN_INTERVAL_START,
  spawnTimerMs: 0,

  // 🆕 без врагов
  noEnemies: false,

  build: { speed: 1, armor: 1, reload: 1, damage: 1, doubleShot: 0 },

  map: null,
  base: null,

  player: null,
  enemies: [],
  bullets: [],
  spawnQueue: [],

  pendingRespawn: false,
  respawnTimerMs: 0,
  invulnTimerMs: 0,

  lastResult: null,
  awaitingUpgrade: false,

  mobileInput: { moveX: 0, moveY: 0, fire: false },

  editor: {
    active: false,
    selectedTile: 'empty',
    map: null,
    base: null,
    painting: false,
    eraseMode: false,
    gridSize: CONFIG.GRID,        // 🆕
    noEnemies: false,             // 🆕
  },
};

// ---------------------------------------------------------------------
// PLAYER STATS
// ---------------------------------------------------------------------
function getPlayerSpeed() {
  return CONFIG.PLAYER.SPEED_BASE + (state.build.speed - 1) * CONFIG.PLAYER.SPEED_PER_LEVEL;
}

function getPlayerReload() {
  return Math.max(
    CONFIG.PLAYER.RELOAD_MIN,
    CONFIG.PLAYER.RELOAD_BASE - (state.build.reload - 1) * CONFIG.PLAYER.RELOAD_PER_LEVEL
  );
}

function getPlayerMaxHp() { return state.build.armor; }
function getPlayerDamageLevel() { return state.build.damage; }

// ---------------------------------------------------------------------
// MAP — генерация
// ---------------------------------------------------------------------
function generateRandomMap() {
  const G = CONFIG.GRID;
  const map = [];
  for (let y = 0; y < G; y++) map.push(new Array(G).fill(null));

  const baseX = Math.floor((G - 2) / 2);
  const baseY = G - 2;

  for (let x = baseX - 1; x <= baseX + 2; x++) {
    if (x >= 0 && x < G) map[baseY - 1][x] = { type: 'brick', sub: [1, 1, 1, 1] };
  }
  for (let y = baseY; y <= baseY + 1; y++) {
    if (baseX - 1 >= 0) map[y][baseX - 1] = { type: 'brick', sub: [1, 1, 1, 1] };
    if (baseX + 2 < G)  map[y][baseX + 2] = { type: 'brick', sub: [1, 1, 1, 1] };
  }

  for (let dy = 0; dy < 2; dy++)
    for (let dx = 0; dx < 2; dx++)
      map[baseY + dy][baseX + dx] = null;

  const midX = Math.floor(G / 2);
  const horizontalCorridors = [1, baseY - 1];
  const verticalCorridors = [midX];

  function isCorridor(x, y) {
    if (horizontalCorridors.includes(y)) return true;
    if (verticalCorridors.includes(x) && y < baseY - 1) return true;
    return false;
  }

  const clusterCount = Math.floor(G * 0.6) + Math.floor(Math.random() * 4);
  for (let i = 0; i < clusterCount; i++) {
    const r = Math.random();
    let tileType = 'brick';
    if (r < 0.12) tileType = 'steel';
    else if (r < 0.24) tileType = 'water';
    else if (r < 0.44) tileType = 'trees';

    const w = 1 + Math.floor(Math.random() * 3);
    const h = 1 + Math.floor(Math.random() * 2);
    const startX = 1 + Math.floor(Math.random() * Math.max(1, G - 2 - w));
    const startY = 2 + Math.floor(Math.random() * Math.max(1, baseY - 3));

    for (let dy = 0; dy < h; dy++) {
      for (let dx = 0; dx < w; dx++) {
        const px = startX + dx;
        const py = startY + dy;
        if (px < 0 || px >= G || py < 0 || py >= G) continue;
        if (py >= baseY - 1) continue;
        if (isCorridor(px, py)) continue;
        if (map[py][px]) continue;

        if (tileType === 'brick') map[py][px] = { type: 'brick', sub: [1, 1, 1, 1] };
        else map[py][px] = { type: tileType };
      }
    }
  }

  const singles = Math.floor(G * 0.6) + Math.floor(Math.random() * 6);
  for (let i = 0; i < singles; i++) {
    const px = 1 + Math.floor(Math.random() * (G - 2));
    const py = 2 + Math.floor(Math.random() * Math.max(1, baseY - 3));
    if (py >= baseY - 1) continue;
    if (isCorridor(px, py)) continue;
    if (map[py][px]) continue;

    const r = Math.random();
    let tile;
    if (r < 0.65) tile = { type: 'brick', sub: [1, 1, 1, 1] };
    else if (r < 0.75) tile = { type: 'steel' };
    else if (r < 0.85) tile = { type: 'water' };
    else tile = { type: 'trees' };

    map[py][px] = tile;
  }

  for (const sp of getSpawnPoints()) {
    if (sp.x >= 0 && sp.x < G && sp.y >= 0 && sp.y < G) map[sp.y][sp.x] = null;
  }

  // Расчистить зону игрока
  for (let y = baseY; y <= baseY + 1; y++) {
    for (let x = 0; x <= baseX - 2; x++) {
      if (y >= 0 && y < G && x >= 0 && x < G) map[y][x] = null;
    }
  }

  return { base: { x: baseX, y: baseY }, map };
}

function loadLevel(levelIndex) {
  const generated = generateRandomMap();

  state.base = { x: generated.base.x, y: generated.base.y, alive: true };
  state.map = generated.map;

  state.spawnQueue = state.noEnemies ? [] : buildSpawnQueue(levelIndex + 1);
  state.enemiesTotal = state.spawnQueue.length;
  state.enemiesKilled = 0;
  state.enemies = [];
  state.bullets = [];

  const lvl = levelIndex + 1;
  state.spawnIntervalMs = Math.max(
    CONFIG.SPAWN_INTERVAL_MIN,
    CONFIG.SPAWN_INTERVAL_START - (lvl - 1) * CONFIG.SPAWN_INTERVAL_PER_LEVEL
  );
  state.maxConcurrent = Math.min(
    6,
    CONFIG.MAX_CONCURRENT_START + Math.floor((lvl - 1) / 2) * CONFIG.MAX_CONCURRENT_PER_2_LEVELS
  );
  state.spawnTimerMs = 0;
}

function buildSpawnQueue(level) {
  const idx = Math.min(level - 1, PROGRESSION.length - 1);
  const tpl = PROGRESSION[idx];
  const queue = [];
  const order = ['basic', 'fast', 'power', 'armor', 'heavy', 'boss'];
  for (const type of order) {
    const count = tpl[type] || 0;
    for (let i = 0; i < count; i++) queue.push(type);
  }
  if (level > PROGRESSION.length) {
    const extra = level - PROGRESSION.length;
    for (let i = 0; i < extra; i++) {
      queue.push('heavy', 'boss', 'armor');
    }
  }
  return queue;
}

// ---------------------------------------------------------------------
// PHYSICS
// ---------------------------------------------------------------------
function aabb(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x &&
         a.y < b.y + b.h && a.y + a.h > b.y;
}

function tankCollidesMap(x, y, w, h) {
  const { TILE, GRID } = CONFIG;
  const x0 = Math.floor(x / TILE);
  const y0 = Math.floor(y / TILE);
  const x1 = Math.floor((x + w - 1) / TILE);
  const y1 = Math.floor((y + h - 1) / TILE);

  if (x0 < 0 || y0 < 0 || x1 >= GRID || y1 >= GRID) return true;

  for (let cy = y0; cy <= y1; cy++) {
    for (let cx = x0; cx <= x1; cx++) {
      const t = state.map[cy] && state.map[cy][cx];
      if (!t) continue;
      if (t.type === 'brick' || t.type === 'steel' || t.type === 'water') return true;
    }
  }
  return false;
}

function canMove(tank, nx, ny) {
  if (tankCollidesMap(nx, ny, tank.w, tank.h)) return false;
  const rect = { x: nx, y: ny, w: tank.w, h: tank.h };
  const { TILE } = CONFIG;
  if (state.base && state.base.alive) {
    const bx = state.base.x * TILE;
    const by = state.base.y * TILE;
    const bs = TILE * 2;
    if (aabb(rect, { x: bx, y: by, w: bs, h: bs })) return false;
  }
  if (state.player && state.player.alive && tank !== state.player) {
    if (aabb(rect, state.player)) return false;
  }
  for (const e of state.enemies) {
    if (e === tank || !e.alive) continue;
    if (aabb(rect, e)) return false;
  }
  return true;
}

// ---------------------------------------------------------------------
// PLAYER
// ---------------------------------------------------------------------
function spawnPlayer() {
  const { TILE } = CONFIG;
  const maxHp = getPlayerMaxHp();
  const baseY = state.base ? state.base.y : CONFIG.GRID - 2;
  const baseX = state.base ? state.base.x : Math.floor((CONFIG.GRID - 2) / 2);
  const spawnX = Math.max(0, baseX - 3);

  state.player = {
    x: spawnX * TILE,
    y: baseY * TILE,
    w: TILE, h: TILE,
    dir: 'up',
    moving: false,
    alive: true,
    speed: getPlayerSpeed(),
    reloadMs: getPlayerReload(),
    lastShot: 0,
    hp: maxHp,
    maxHp: maxHp,
  };
  state.invulnTimerMs = CONFIG.PLAYER.INVULN_MS;
}

function updatePlayer(dt) {
  const p = state.player;
  if (!p || !p.alive) return;

  let ndir = null;
  if (keysDown.has('ArrowLeft') || keysDown.has('KeyA')) ndir = 'left';
  else if (keysDown.has('ArrowRight') || keysDown.has('KeyD')) ndir = 'right';
  else if (keysDown.has('ArrowUp') || keysDown.has('KeyW')) ndir = 'up';
  else if (keysDown.has('ArrowDown') || keysDown.has('KeyS')) ndir = 'down';

  if (!ndir) {
    const mi = state.mobileInput;
    if (Math.abs(mi.moveX) > Math.abs(mi.moveY)) {
      if (mi.moveX < -0.3) ndir = 'left';
      else if (mi.moveX > 0.3) ndir = 'right';
    } else {
      if (mi.moveY < -0.3) ndir = 'up';
      else if (mi.moveY > 0.3) ndir = 'down';
    }
  }

  if (!ndir) { p.moving = false; return; }
  p.moving = true;
  p.dir = ndir;

  const { TILE } = CONFIG;

  if (p.dir === 'left' || p.dir === 'right') {
    const target = Math.round(p.y / TILE) * TILE;
    const diff = target - p.y;
    if (Math.abs(diff) > 0.5) {
      const step = Math.sign(diff) * Math.min(CONFIG.PLAYER.SNAP_SPEED * dt, Math.abs(diff));
      if (canMove(p, p.x, p.y + step)) p.y += step;
      return;
    }
    p.y = target;
  } else {
    const target = Math.round(p.x / TILE) * TILE;
    const diff = target - p.x;
    if (Math.abs(diff) > 0.5) {
      const step = Math.sign(diff) * Math.min(CONFIG.PLAYER.SNAP_SPEED * dt, Math.abs(diff));
      if (canMove(p, p.x + step, p.y)) p.x += step;
      return;
    }
    p.x = target;
  }

  let dx = 0, dy = 0;
  if (p.dir === 'left') dx = -1;
  else if (p.dir === 'right') dx = 1;
  else if (p.dir === 'up') dy = -1;
  else if (p.dir === 'down') dy = 1;

  const nx = p.x + dx * p.speed * dt;
  const ny = p.y + dy * p.speed * dt;

  if (dx !== 0 && canMove(p, nx, p.y)) p.x = nx;
  if (dy !== 0 && canMove(p, p.x, ny)) p.y = ny;
}

function damagePlayer() {
  if (state.invulnTimerMs > 0) return;
  const p = state.player;
  if (!p) return;

  p.hp -= 1;

  if (p.hp <= 0) {
    state.lives--;
    if (state.lives <= 0) {
      p.alive = false;
      updateHUD();
      gameOver('Жизни закончились');
      return;
    }
    p.alive = false;
    state.pendingRespawn = true;
    state.respawnTimerMs = CONFIG.PLAYER.RESPAWN_MS;
  } else {
    state.invulnTimerMs = CONFIG.PLAYER.INVULN_HIT_MS;
  }
  updateHUD();
}

function updateRespawn(dtMs) {
  if (state.pendingRespawn) {
    state.respawnTimerMs -= dtMs;
    if (state.respawnTimerMs <= 0) {
      state.pendingRespawn = false;
      spawnPlayer();
      updateHUD();
    }
  }
  if (state.invulnTimerMs > 0) {
    state.invulnTimerMs = Math.max(0, state.invulnTimerMs - dtMs);
  }
}

// ---------------------------------------------------------------------
// BULLETS
// ---------------------------------------------------------------------
function createBullet(owner, x, y, dx, dy, opts = {}) {
  const isPlayer = owner === 'player';
  const size = isPlayer ? CONFIG.PLAYER.BULLET_SIZE : CONFIG.ENEMY.BULLET_SIZE;
  const speed = isPlayer ? CONFIG.PLAYER.BULLET_SPEED : CONFIG.ENEMY.BULLET_SPEED;
  return {
    x, y, w: size, h: size, dx, dy, speed, owner,
    enemyRef: opts.enemyRef || null,
    pierceLeft: opts.pierceLeft || 0,
    canBreakSteel: !!opts.canBreakSteel,
  };
}

function shootPlayer() {
  const p = state.player;
  if (!p || !p.alive) return;

  const hasBullet = state.bullets.some(b => b.owner === 'player');
  if (hasBullet) return;

  const now = performance.now();
  if (now - p.lastShot < p.reloadMs) return;
  p.lastShot = now;

  const size = CONFIG.PLAYER.BULLET_SIZE;
  const half = size / 2;
  const cx = p.x + p.w / 2;
  const cy = p.y + p.h / 2;
  const damageLevel = getPlayerDamageLevel();
  const pierceLeft = damageLevel - 1;
  const canBreakSteel = damageLevel >= 3;

  const isDouble = state.build.doubleShot > 0;
  const perp = isDouble ? [-6, 6] : [0];

  for (const off of perp) {
    let bx, by, dx = 0, dy = 0;
    switch (p.dir) {
      case 'left':  dx = -1; bx = p.x - half;          by = cy - half + off; break;
      case 'right': dx = 1;  bx = p.x + p.w - half;    by = cy - half + off; break;
      case 'up':    dy = -1; bx = cx - half + off;     by = p.y - half; break;
      case 'down':  dy = 1;  bx = cx - half + off;     by = p.y + p.h - half; break;
    }
    state.bullets.push(createBullet('player', bx, by, dx, dy, { pierceLeft, canBreakSteel }));
  }
}

function enemyShoot(e) {
  const hasBullet = state.bullets.some(b => b.enemyRef === e);
  if (hasBullet) return;

  const size = CONFIG.ENEMY.BULLET_SIZE;
  const half = size / 2;
  const cx = e.x + e.w / 2;
  const cy = e.y + e.h / 2;

  let bx, by, dx = 0, dy = 0;
  switch (e.dir) {
    case 'left':  dx = -1; bx = e.x - half;         by = cy - half; break;
    case 'right': dx = 1;  bx = e.x + e.w - half;   by = cy - half; break;
    case 'up':    dy = -1; bx = cx - half;          by = e.y - half; break;
    case 'down':  dy = 1;  bx = cx - half;          by = e.y + e.h - half; break;
  }
  state.bullets.push(createBullet('enemy', bx, by, dx, dy, { enemyRef: e }));
}

function hitBrick(cx, cy, bullet) {
  const tile = state.map[cy][cx];
  if (!tile || tile.type !== 'brick') return;

  let near = [], far = [];
  if (bullet.dy < 0)      { near = [2, 3]; far = [0, 1]; }
  else if (bullet.dy > 0) { near = [0, 1]; far = [2, 3]; }
  else if (bullet.dx < 0) { near = [1, 3]; far = [0, 2]; }
  else if (bullet.dx > 0) { near = [0, 2]; far = [1, 3]; }

  const nearAlive = near.some(i => tile.sub[i]);
  const toBreak = nearAlive ? near : far;
  for (const i of toBreak) tile.sub[i] = 0;
  if (tile.sub.every(s => s === 0)) state.map[cy][cx] = null;
}

function bulletHitWorld(bullet) {
  const { TILE, GRID } = CONFIG;
  if (bullet.x < 0 || bullet.y < 0 ||
      bullet.x + bullet.w > W || bullet.y + bullet.h > W) return true;

  if (state.base && state.base.alive) {
    const bx = state.base.x * TILE;
    const by = state.base.y * TILE;
    const bs = TILE * 2;
    if (aabb(bullet, { x: bx, y: by, w: bs, h: bs })) {
      if (bullet.owner === 'enemy') {
        state.base.alive = false;
        gameOver('База уничтожена');
      }
      return true;
    }
  }

  const x0 = Math.floor(bullet.x / TILE);
  const y0 = Math.floor(bullet.y / TILE);
  const x1 = Math.floor((bullet.x + bullet.w - 1) / TILE);
  const y1 = Math.floor((bullet.y + bullet.h - 1) / TILE);

  for (let cy = y0; cy <= y1; cy++) {
    for (let cx = x0; cx <= x1; cx++) {
      if (cx < 0 || cx >= GRID || cy < 0 || cy >= GRID) return true;
      const t = state.map[cy][cx];
      if (!t) continue;
      if (t.type === 'brick') { hitBrick(cx, cy, bullet); return true; }
      if (t.type === 'steel') {
        if (bullet.canBreakSteel) state.map[cy][cx] = null;
        return true;
      }
    }
  }
  return false;
}

function bulletHitTanks(bullet) {
  if (bullet.owner === 'player') {
    for (const e of state.enemies) {
      if (!e.alive) continue;
      if (aabb(bullet, e)) {
        e.hp -= 1;
        if (e.hp <= 0) killEnemy(e);
        if (bullet.pierceLeft > 0) { bullet.pierceLeft--; return false; }
        return true;
      }
    }
  } else if (bullet.owner === 'enemy') {
    if (state.player && state.player.alive && state.invulnTimerMs <= 0) {
      if (aabb(bullet, state.player)) { damagePlayer(); return true; }
    }
  }
  return false;
}

function bulletsCollide(a, b) {
  if (a.owner === b.owner) return false;
  return aabb(a, b);
}

function updateBullets(dt) {
  for (const b of state.bullets) {
    b.x += b.dx * b.speed * dt;
    b.y += b.dy * b.speed * dt;
  }

  const destroyed = new Set();
  for (let i = 0; i < state.bullets.length; i++) {
    const a = state.bullets[i];
    if (destroyed.has(a)) continue;
    for (let j = i + 1; j < state.bullets.length; j++) {
      const b = state.bullets[j];
      if (destroyed.has(b)) continue;
      if (bulletsCollide(a, b)) {
        destroyed.add(a); destroyed.add(b);
        break;
      }
    }
  }

  const alive = [];
  for (const b of state.bullets) {
    if (destroyed.has(b)) continue;
    if (bulletHitTanks(b)) { destroyed.add(b); continue; }
    if (bulletHitWorld(b)) { destroyed.add(b); continue; }
    alive.push(b);
  }
  state.bullets = alive;
}

// ---------------------------------------------------------------------
// ENEMIES
// ---------------------------------------------------------------------
function trySpawnEnemy() {
  if (state.noEnemies) return;
  if (state.spawnQueue.length === 0) return;
  if (state.enemies.filter(e => e.alive).length >= state.maxConcurrent) return;

  const { TILE } = CONFIG;
  const spawnPoints = getSpawnPoints();

  const free = spawnPoints.filter(sp => {
    const rect = { x: sp.x * TILE, y: sp.y * TILE, w: TILE, h: TILE };
    if (state.player && state.player.alive && aabb(rect, state.player)) return false;
    for (const e of state.enemies) {
      if (!e.alive) continue;
      if (aabb(rect, e)) return false;
    }
    if (tankCollidesMap(rect.x, rect.y, TILE, TILE)) return false;
    return true;
  });

  if (free.length === 0) return;

  const point = free[Math.floor(Math.random() * free.length)];
  const typeName = state.spawnQueue.shift();
  const type = ENEMY_TYPES[typeName];

  state.enemies.push({
    x: point.x * TILE, y: point.y * TILE,
    w: TILE, h: TILE,
    dir: 'down', alive: true, type: typeName,
    hp: type.hp, maxHp: type.hp,
    speed: type.speed, fireRate: type.fireRate, score: type.score,
    color: type.color, colorDark: type.colorDark,
    lastShot: 0, moveTimer: 0.3 + Math.random() * 0.8, spawnFlash: 0.5,
  });
  updateHUD();
}

function changeEnemyDir(e) {
  e.moveTimer = 0.6 + Math.random() * 1.6;
  if (Math.random() < 0.65) e.dir = 'down';
  else {
    const dirs = ['up', 'down', 'left', 'right'];
    e.dir = dirs[Math.floor(Math.random() * 4)];
  }
}

function isAlignedWithTarget(e) {
  const { TILE } = CONFIG;
  const eCx = e.x + e.w / 2, eCy = e.y + e.h / 2;

  if (state.base && state.base.alive) {
    const bCx = (state.base.x + 1) * TILE;
    const bCy = (state.base.y + 1) * TILE;
    if (Math.abs(eCx - bCx) < TILE && e.dir === 'down' && bCy > eCy) return true;
    if (Math.abs(eCy - bCy) < TILE) {
      if (e.dir === 'right' && bCx > eCx) return true;
      if (e.dir === 'left' && bCx < eCx) return true;
    }
  }
  if (state.player && state.player.alive) {
    const pCx = state.player.x + state.player.w / 2;
    const pCy = state.player.y + state.player.h / 2;
    if (Math.abs(eCx - pCx) < TILE) {
      if (e.dir === 'down' && pCy > eCy) return true;
      if (e.dir === 'up' && pCy < eCy) return true;
    }
    if (Math.abs(eCy - pCy) < TILE) {
      if (e.dir === 'right' && pCx > eCx) return true;
      if (e.dir === 'left' && pCx < eCx) return true;
    }
  }
  return false;
}

function updateEnemy(e, dt, nowSec) {
  if (!e.alive) return;
  if (e.spawnFlash > 0) e.spawnFlash = Math.max(0, e.spawnFlash - dt);

  const { TILE } = CONFIG;
  e.moveTimer -= dt;

  if (e.dir === 'left' || e.dir === 'right') {
    const target = Math.round(e.y / TILE) * TILE;
    const diff = target - e.y;
    if (Math.abs(diff) > 0.5) {
      const step = Math.sign(diff) * Math.min(CONFIG.ENEMY.SNAP_SPEED * dt, Math.abs(diff));
      if (canMove(e, e.x, e.y + step)) e.y += step;
      else e.moveTimer = 0;
      if (e.moveTimer <= 0) changeEnemyDir(e);
      tryEnemyShoot(e, nowSec);
      return;
    }
    e.y = target;
  } else {
    const target = Math.round(e.x / TILE) * TILE;
    const diff = target - e.x;
    if (Math.abs(diff) > 0.5) {
      const step = Math.sign(diff) * Math.min(CONFIG.ENEMY.SNAP_SPEED * dt, Math.abs(diff));
      if (canMove(e, e.x + step, e.y)) e.x += step;
      else e.moveTimer = 0;
      if (e.moveTimer <= 0) changeEnemyDir(e);
      tryEnemyShoot(e, nowSec);
      return;
    }
    e.x = target;
  }

  if (e.moveTimer <= 0) changeEnemyDir(e);

  let dx = 0, dy = 0;
  if (e.dir === 'left') dx = -1;
  else if (e.dir === 'right') dx = 1;
  else if (e.dir === 'up') dy = -1;
  else if (e.dir === 'down') dy = 1;

  const nx = e.x + dx * e.speed * dt;
  const ny = e.y + dy * e.speed * dt;

  if (dx !== 0) {
    if (canMove(e, nx, e.y)) e.x = nx;
    else { e.moveTimer = 0; changeEnemyDir(e); }
  }
  if (dy !== 0) {
    if (canMove(e, e.x, ny)) e.y = ny;
    else { e.moveTimer = 0; changeEnemyDir(e); }
  }
  tryEnemyShoot(e, nowSec);
}

function tryEnemyShoot(e, nowSec) {
  if (e.spawnFlash > 0) return;
  if (nowSec - e.lastShot < e.fireRate) return;
  if (isAlignedWithTarget(e) || Math.random() < 0.15) {
    enemyShoot(e);
    e.lastShot = nowSec;
  }
}

function killEnemy(e) {
  e.alive = false;
  state.score += e.score;
  state.enemiesKilled++;
  if (state.score > state.best) {
    state.best = state.score;
    localStorage.setItem(CONFIG.LS_BEST, state.best);
  }
  updateHUD();
  checkLevelComplete();
}

function checkLevelComplete() {
  if (state.noEnemies) return;       // 🆕 в песочнице нет победы
  if (state.enemiesTotal === 0) return;
  if (state.enemiesKilled >= state.enemiesTotal) {
    setTimeout(() => {
      if (!state.isRunning) return;
      state.isRunning = false;
      state.lastResult = 'win';
      state.awaitingUpgrade = true;
      if (pauseExtras) pauseExtras.classList.add('hidden');
      if (state.animId) cancelAnimationFrame(state.animId);
      showUpgradeChoice();
    }, 800);
  }
}

// ---------------------------------------------------------------------
// UPGRADE UI
// ---------------------------------------------------------------------
function pickUpgradeChoices() {
  const pool = UPGRADES.filter(u => (state.build[u.key] || 0) < u.max);
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, 3);
}

function showUpgradeChoice() {
  upgradeLevelNum.textContent = state.level;
  const choices = pickUpgradeChoices();
  upgradeCards.innerHTML = '';

  if (choices.length === 0) {
    const btn = document.createElement('button');
    btn.className = 'upgrade-card';
    btn.innerHTML = `
      <div class="upgrade-card-icon">⭐</div>
      <div class="upgrade-card-name">Всё прокачано!</div>
      <div class="upgrade-card-level">Максимум</div>
      <div class="upgrade-card-desc">Танк полностью улучшен</div>`;
    const go = (e) => { e.preventDefault(); e.stopPropagation(); hideUpgradeOverlay(); nextLevel(); };
    btn.addEventListener('click', go);
    btn.addEventListener('touchend', go, { passive: false });
    upgradeCards.appendChild(btn);
  } else {
    for (const u of choices) {
      const currentLvl = state.build[u.key] || 0;
      const card = document.createElement('button');
      card.className = 'upgrade-card';
      card.innerHTML = `
        <div class="upgrade-card-icon">${u.icon}</div>
        <div class="upgrade-card-name">${u.name}</div>
        <div class="upgrade-card-level">${u.levelText(currentLvl)}</div>
        <div class="upgrade-card-desc">${u.desc(currentLvl)}</div>`;
      const fire = (e) => {
        e.preventDefault(); e.stopPropagation();
        applyUpgrade(u.key); hideUpgradeOverlay(); nextLevel();
      };
      card.addEventListener('click', fire);
      card.addEventListener('touchend', fire, { passive: false });
      upgradeCards.appendChild(card);
    }
  }
  upgradeOverlay.classList.remove('hidden');
}

function hideUpgradeOverlay() {
  upgradeOverlay.classList.add('hidden');
  state.awaitingUpgrade = false;
}

function applyUpgrade(key) {
  state.build[key] = (state.build[key] || 0) + 1;
  updateHUD();
}

// ---------------------------------------------------------------------
// UPDATE
// ---------------------------------------------------------------------
function update(dtMs) {
  const dt = dtMs / 1000;

  if (state.mobileInput.fire) shootPlayer();

  if (!state.noEnemies) {
    state.spawnTimerMs += dtMs;
    if (state.spawnTimerMs >= state.spawnIntervalMs) {
      state.spawnTimerMs = 0;
      trySpawnEnemy();
    }
    if (state.enemies.filter(e => e.alive).length === 0 && state.spawnQueue.length > 0) {
      trySpawnEnemy();
    }
  }

  updatePlayer(dt);
  updateRespawn(dtMs);

  const nowSec = performance.now() / 1000;
  for (const e of state.enemies) updateEnemy(e, dt, nowSec);

  state.enemies = state.enemies.filter(e => e.alive);
  updateBullets(dt);
}

// ---------------------------------------------------------------------
// INPUT — клавиатура
// ---------------------------------------------------------------------
const keysDown = new Set();

document.addEventListener('keydown', (e) => {
  if (state.awaitingUpgrade) return;
  if (state.editor.active) return;

  if (e.code === 'Space' || e.key === ' ') {
    e.preventDefault();
    if (!state.isRunning) startGame();
    else if (state.isPaused) togglePause();
    else shootPlayer();
    return;
  }
  if (e.key === 'p' || e.key === 'P' || e.key === 'з' || e.key === 'З') {
    e.preventDefault();
    if (state.isRunning) togglePause();
    return;
  }
  keysDown.add(e.code);
});

document.addEventListener('keyup', (e) => {
  keysDown.delete(e.code);
});

// ---------------------------------------------------------------------
// RENDER — тайлы
// ---------------------------------------------------------------------
function drawField() {
  ctx.fillStyle = CONFIG.PALETTE.bg;
  ctx.fillRect(0, 0, W, W);

  if (CONFIG.GRID_ALPHA > 0) {
    ctx.strokeStyle = `rgba(255, 183, 224, ${CONFIG.GRID_ALPHA})`;
    ctx.lineWidth = 1;
    for (let i = 0; i <= CONFIG.GRID; i++) {
      const p = i * CONFIG.TILE + 0.5;
      ctx.beginPath(); ctx.moveTo(p, 0); ctx.lineTo(p, W); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, p); ctx.lineTo(W, p); ctx.stroke();
    }
  }
}

function drawBrickSub(sx, sy, size) {
  const P = CONFIG.PALETTE;
  ctx.fillStyle = P.brickDark;
  ctx.fillRect(sx, sy, size, size);
  const pad = 1;
  const w = size - pad * 2;
  const h = size - pad * 2;
  ctx.fillStyle = P.brick;
  ctx.fillRect(sx + pad, sy + pad, w, h);
  ctx.fillStyle = P.brickLight;
  ctx.fillRect(sx + pad, sy + pad, w, 2);
  ctx.fillStyle = P.brickDark;
  ctx.fillRect(sx, sy + size / 2 - 1, size, 2);
}

function drawBrick(x, y, sub) {
  const { TILE } = CONFIG;
  const px = x * TILE, py = y * TILE, half = TILE / 2;
  const positions = [
    [px, py], [px + half, py], [px, py + half], [px + half, py + half],
  ];
  for (let i = 0; i < 4; i++) {
    if (sub[i]) drawBrickSub(positions[i][0], positions[i][1], half);
  }
}

function drawSteel(x, y) {
  const { TILE, PALETTE: P } = CONFIG;
  const px = x * TILE, py = y * TILE;
  const pad = 1, s = TILE / 2;
  ctx.fillStyle = P.steelDark;
  ctx.fillRect(px, py, TILE, TILE);
  for (let i = 0; i < 4; i++) {
    const dx = (i % 2) * s, dy = Math.floor(i / 2) * s;
    ctx.fillStyle = P.steel;
    ctx.fillRect(px + dx + pad, py + dy + pad, s - pad * 2, s - pad * 2);
    ctx.fillStyle = P.steelLight;
    ctx.fillRect(px + dx + pad, py + dy + pad, s - pad * 2, 2);
    ctx.fillRect(px + dx + pad, py + dy + pad, 2, s - pad * 2);
    ctx.fillStyle = P.steelDark;
    ctx.fillRect(px + dx + pad, py + dy + s - pad - 2, s - pad * 2, 2);
  }
}

let waterPhase = 0;
function drawWater(x, y) {
  const { TILE, PALETTE: P } = CONFIG;
  const px = x * TILE, py = y * TILE;
  ctx.fillStyle = P.water;
  ctx.fillRect(px, py, TILE, TILE);
  const phase = Math.floor(waterPhase);
  ctx.fillStyle = P.waterDeep;
  ctx.fillRect(px, py + TILE / 2 - 1, TILE, 2);
  ctx.fillStyle = P.waterLight;
  const y1 = py + 6 + (phase % 2 === 0 ? 0 : 2);
  ctx.fillRect(px + 4, y1, TILE - 8, 2);
  const y2 = py + TILE - 8 - (phase % 2 === 0 ? 0 : 2);
  ctx.fillRect(px + 4, y2, TILE - 8, 2);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
  ctx.fillRect(px + 6, y1 - 2, 4, 1);
  ctx.fillRect(px + TILE - 10, y2 - 2, 4, 1);
}

function drawTrees(x, y) {
  const { TILE, PALETTE: P } = CONFIG;
  const px = x * TILE, py = y * TILE;
  const R = TILE / 7;
  ctx.fillStyle = P.treesDark;
  ctx.fillRect(px, py, TILE, TILE);
  const clusters = [
    [px + TILE * 0.25, py + TILE * 0.30, R * 1.3],
    [px + TILE * 0.70, py + TILE * 0.30, R * 1.2],
    [px + TILE * 0.35, py + TILE * 0.70, R * 1.25],
    [px + TILE * 0.75, py + TILE * 0.72, R * 1.15],
  ];
  ctx.fillStyle = P.trees;
  for (const [cx, cy, r] of clusters) {
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
  }
  ctx.fillStyle = P.treesLight;
  for (const [cx, cy, r] of clusters) {
    ctx.beginPath(); ctx.arc(cx - r * 0.25, cy - r * 0.25, r * 0.45, 0, Math.PI * 2); ctx.fill();
  }
}

function drawBase() {
  if (!state.base) return;
  const { TILE, PALETTE: P } = CONFIG;
  const px = state.base.x * TILE, py = state.base.y * TILE;
  const size = TILE * 2;

  if (!state.base.alive) {
    ctx.fillStyle = P.baseBg;
    ctx.fillRect(px, py, size, size);
    ctx.strokeStyle = P.baseDark;
    ctx.lineWidth = 2;
    ctx.strokeRect(px + 1, py + 1, size - 2, size - 2);
    ctx.fillStyle = '#3a1a10';
    for (let i = 0; i < 6; i++) {
      const rx = px + 4 + Math.random() * (size - 16);
      const ry = py + 4 + Math.random() * (size - 16);
      ctx.fillRect(rx, ry, 4 + Math.random() * 6, 3 + Math.random() * 5);
    }
    ctx.fillStyle = 'rgba(120, 120, 120, 0.4)';
    ctx.beginPath();
    ctx.arc(px + size * 0.4, py + size * 0.35, 8, 0, Math.PI * 2);
    ctx.arc(px + size * 0.65, py + size * 0.55, 6, 0, Math.PI * 2);
    ctx.fill();
    return;
  }

  ctx.fillStyle = P.baseBg;
  ctx.fillRect(px, py, size, size);
  ctx.strokeStyle = P.baseDark;
  ctx.lineWidth = 2;
  ctx.strokeRect(px + 1, py + 1, size - 2, size - 2);
  ctx.strokeStyle = P.base;
  ctx.lineWidth = 1.5;
  ctx.strokeRect(px + 3.5, py + 3.5, size - 7, size - 7);
  ctx.save();
  ctx.font = `${size * 0.72}px serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = P.baseLight;
  ctx.shadowBlur = 10;
  ctx.fillText('🦅', px + size / 2, py + size / 2 + 2);
  ctx.restore();
}

function drawTile(tile, x, y) {
  if (!tile) return;
  switch (tile.type) {
    case 'brick': drawBrick(x, y, tile.sub); break;
    case 'steel': drawSteel(x, y); break;
    case 'water': drawWater(x, y); break;
    case 'trees': drawTrees(x, y); break;
  }
}

// ---------------------------------------------------------------------
// RENDER — танки и пули
// ---------------------------------------------------------------------
function drawTankCommon(cx, cy, dir, colors, opts = {}) {
  const { TILE } = CONFIG;
  const { track, trackLight, body, bodyLight, turret, barrel } = colors;
  ctx.save();
  ctx.translate(cx, cy);
  let angle = 0;
  if (dir === 'right') angle = Math.PI / 2;
  else if (dir === 'down') angle = Math.PI;
  else if (dir === 'left') angle = -Math.PI / 2;
  ctx.rotate(angle);

  const s = TILE, half = s / 2;
  ctx.fillStyle = track;
  ctx.fillRect(-half, -half, 5, s);
  ctx.fillRect(half - 5, -half, 5, s);
  ctx.fillStyle = trackLight;
  for (let y = -half + 2; y < half - 1; y += 5) {
    ctx.fillRect(-half + 1, y, 3, 2);
    ctx.fillRect(half - 4, y, 3, 2);
  }
  ctx.fillStyle = body;
  ctx.fillRect(-half + 5, -half + 2, s - 10, s - 4);
  ctx.fillStyle = bodyLight;
  ctx.fillRect(-half + 5, -half + 2, s - 10, 3);
  ctx.fillStyle = turret;
  ctx.fillRect(-7, -5, 14, 12);
  ctx.fillStyle = bodyLight;
  ctx.fillRect(-5, -3, 10, 3);
  ctx.fillStyle = barrel;
  ctx.fillRect(-2, -half - 2, 4, 9);
  if (opts.stripes) {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
    ctx.fillRect(-half + 5, half - 6, s - 10, 2);
  }
  ctx.restore();
}

function drawPlayerTank(t) {
  let alpha = 1;
  if (state.invulnTimerMs > 0) {
    alpha = (Math.floor(performance.now() / 100) % 2 === 0) ? 0.35 : 1;
  }
  const P = CONFIG.PALETTE;
  const colors = {
    track: P.playerTrack, trackLight: P.playerTrackLight,
    body: P.playerBody, bodyLight: P.playerBodyLight,
    turret: P.playerTurret, barrel: P.playerBarrel,
  };
  ctx.save();
  ctx.globalAlpha = alpha;
  drawTankCommon(t.x + t.w / 2, t.y + t.h / 2, t.dir, colors);
  if (t.maxHp > 1) {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.fillRect(t.x, t.y - 6, t.w, 3);
    ctx.fillStyle = '#7bff8f';
    ctx.fillRect(t.x, t.y - 6, t.w * (t.hp / t.maxHp), 3);
  }
  ctx.restore();
}

function drawEnemyTank(e) {
  const colors = {
    track: e.colorDark, trackLight: e.color,
    body: e.color, bodyLight: 'rgba(255, 255, 255, 0.5)',
    turret: e.colorDark, barrel: '#ffffff',
  };
  let alpha = 1;
  if (e.spawnFlash > 0) {
    alpha = (Math.floor(performance.now() / 80) % 2 === 0) ? 0.3 : 1;
  }
  ctx.save();
  ctx.globalAlpha = alpha;
  drawTankCommon(e.x + e.w / 2, e.y + e.h / 2, e.dir, colors, { stripes: true });
  ctx.restore();
  if (e.hp < e.maxHp) {
    const barW = e.w - 4;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(e.x + 2, e.y - 5, barW, 3);
    ctx.fillStyle = '#ff5f5f';
    ctx.fillRect(e.x + 2, e.y - 5, barW * (e.hp / e.maxHp), 3);
  }
}

function drawBullet(b) {
  const P = CONFIG.PALETTE;
  ctx.save();
  ctx.shadowColor = b.owner === 'player' ? P.bulletGlow : '#ff5f5f';
  ctx.shadowBlur = 8;
  ctx.fillStyle = b.owner === 'player' ? P.bullet : '#ff8080';
  ctx.fillRect(b.x, b.y, b.w, b.h);
  ctx.fillStyle = '#fff';
  ctx.fillRect(b.x + 1, b.y + 1, 2, 2);
  ctx.restore();
}

function render() {
  drawField();

  if (state.map) {
    for (let y = 0; y < CONFIG.GRID; y++) {
      for (let x = 0; x < CONFIG.GRID; x++) {
        const t = state.map[y][x];
        if (t && t.type !== 'trees') drawTile(t, x, y);
      }
    }
  }
  drawBase();
  for (const e of state.enemies) drawEnemyTank(e);
  if (state.player && state.player.alive) drawPlayerTank(state.player);
  for (const b of state.bullets) drawBullet(b);

  if (state.map) {
    for (let y = 0; y < CONFIG.GRID; y++) {
      for (let x = 0; x < CONFIG.GRID; x++) {
        const t = state.map[y][x];
        if (t && t.type === 'trees') drawTrees(x, y);
      }
    }
  }
}

// ---------------------------------------------------------------------
// HUD
// ---------------------------------------------------------------------
function updateHUD() {
  hudLevel.textContent = state.level;
  hudScore.textContent = state.score;

  const maxHearts = 5;
  let lifeStr = '';
  if (state.lives > 0) {
    lifeStr = '❤'.repeat(Math.min(state.lives, maxHearts));
    if (state.lives > maxHearts) lifeStr += ` +${state.lives - maxHearts}`;
  } else lifeStr = '—';

  const p = state.player;
  if (p && p.maxHp > 1) lifeStr += ` · 🛡${p.hp}/${p.maxHp}`;

  hudLives.textContent = lifeStr;
  hudEnemies.textContent = `${state.enemiesKilled} / ${state.enemiesTotal}`;

  buildSpeed.textContent = state.build.speed;
  buildArmor.textContent = state.build.armor;
  buildReload.textContent = state.build.reload;
  buildDamage.textContent = state.build.damage;
  buildDouble.textContent = state.build.doubleShot > 0 ? 'ON' : '—';
}

// ---------------------------------------------------------------------
// LOOP
// ---------------------------------------------------------------------
function loop(time) {
  if (!state.isRunning) return;
  if (!state.lastTime) state.lastTime = time;
  let delta = time - state.lastTime;
  state.lastTime = time;
  if (delta > 100) delta = 100;

  if (!state.isPaused && !state.awaitingUpgrade) {
    state.accumulator += delta;
    while (state.accumulator >= CONFIG.STEP_MS) {
      update(CONFIG.STEP_MS);
      state.accumulator -= CONFIG.STEP_MS;
    }
    waterPhase = (waterPhase + delta / 220) % 4;
  }
  render();
  state.animId = requestAnimationFrame(loop);
}

// ---------------------------------------------------------------------
// GAME CONTROL
// ---------------------------------------------------------------------
function startGame(useCustomMap = false) {
  if (!useCustomMap) {
    state.level = 1;
    state.score = 0;
    state.lives = 3;
    state.build = { speed: 1, armor: 1, reload: 1, damage: 1, doubleShot: 0 };
    state.noEnemies = false;
    loadLevel(0);
  }

  state.pendingRespawn = false;
  state.respawnTimerMs = 0;
  state.invulnTimerMs = 0;
  state.lastResult = null;
  state.awaitingUpgrade = false;

  if (menuExtras) menuExtras.classList.add('hidden');
  if (pauseExtras) pauseExtras.classList.add('hidden');

  spawnPlayer();

  state.lastTime = 0;
  state.accumulator = 0;
  state.isRunning = true;
  state.isPaused = false;

  updateHUD();
  overlay.classList.add('hidden');
  upgradeOverlay.classList.add('hidden');

  if (state.animId) cancelAnimationFrame(state.animId);
  state.animId = requestAnimationFrame(loop);
}

function nextLevel() {
  state.level += 1;
  state.pendingRespawn = false;
  state.respawnTimerMs = 0;
  state.invulnTimerMs = 0;
  state.lastResult = null;
  state.awaitingUpgrade = false;

  if (pauseExtras) pauseExtras.classList.add('hidden');

  loadLevel(state.level - 1);
  spawnPlayer();

  state.lastTime = 0;
  state.accumulator = 0;
  state.isRunning = true;
  state.isPaused = false;

  updateHUD();
  overlay.classList.add('hidden');
  upgradeOverlay.classList.add('hidden');

  if (state.animId) cancelAnimationFrame(state.animId);
  state.animId = requestAnimationFrame(loop);
}

function gameOver(reason) {
  state.isRunning = false;
  state.pendingRespawn = false;
  state.lastResult = 'lose';
  state.awaitingUpgrade = false;
  upgradeOverlay.classList.add('hidden');
  if (pauseExtras) pauseExtras.classList.add('hidden');
  if (state.animId) cancelAnimationFrame(state.animId);

  overlayTitle.textContent = '💥 Игра окончена';
  overlayText.innerHTML =
    `<span style="color:#ff8fc8">${reason || ''}</span><br><br>` +
    `Уровень: <b>${state.level}</b><br>` +
    `Очки: <b>${state.score}</b><br>` +
    `Уничтожено врагов: <b>${state.enemiesKilled}</b><br>` +
    `Рекорд: <b>${state.best}</b>`;
  startBtn.textContent = 'Заново';
  if (menuExtras) menuExtras.classList.remove('hidden');
  overlay.classList.remove('hidden');
}

function togglePause() {
  if (!state.isRunning) return;
  if (state.awaitingUpgrade) return;
  state.isPaused = !state.isPaused;

  if (state.isPaused) {
    overlayTitle.textContent = '⏸ Пауза';
    overlayText.textContent = 'Space или P — продолжить';
    startBtn.textContent = 'Продолжить';
    if (menuExtras) menuExtras.classList.add('hidden');
    if (pauseExtras) pauseExtras.classList.remove('hidden');
    overlay.classList.remove('hidden');
  } else {
    overlay.classList.add('hidden');
    if (pauseExtras) pauseExtras.classList.add('hidden');
    state.lastTime = performance.now();
    state.accumulator = 0;
  }
}

// ---------------------------------------------------------------------
// BUTTONS
// ---------------------------------------------------------------------
function handleStartBtn(e) {
  e.preventDefault();
  e.stopPropagation();
  if (state.isRunning && state.isPaused) togglePause();
  else startGame();
}

startBtn.addEventListener('click', handleStartBtn);
startBtn.addEventListener('touchend', handleStartBtn, { passive: false });

// ---------------------------------------------------------------------
// MOBILE INPUT
// ---------------------------------------------------------------------
(function initMobileControls() {
  const joystickEl = document.getElementById('joystick');
  const knobEl     = document.getElementById('joystick-knob');
  const fireBtn    = document.getElementById('fire-btn');
  const pauseBtn   = document.getElementById('mobile-pause-btn');
  if (!joystickEl || !knobEl || !fireBtn) return;

  const MAX_RADIUS = 42;
  const DEAD_ZONE  = 0.15;
  let joyTouchId = null;
  let joyCenterX = 0, joyCenterY = 0;

  function setKnobOffset(dx, dy) {
    knobEl.style.transform = `translate(${dx}px, ${dy}px)`;
  }
  function updateMoveVector(dx, dy) {
    const nx = dx / MAX_RADIUS, ny = dy / MAX_RADIUS;
    const len = Math.hypot(nx, ny);
    if (len < DEAD_ZONE) {
      state.mobileInput.moveX = 0;
      state.mobileInput.moveY = 0;
      return;
    }
    const k = len > 1 ? 1 / len : 1;
    state.mobileInput.moveX = nx * k;
    state.mobileInput.moveY = ny * k;
  }
  function joyStart(t) {
    joyTouchId = t.identifier;
    const rect = joystickEl.getBoundingClientRect();
    joyCenterX = rect.left + rect.width / 2;
    joyCenterY = rect.top + rect.height / 2;
    handleJoyMove(t);
  }
  function handleJoyMove(t) {
    if (t.identifier !== joyTouchId) return;
    let dx = t.clientX - joyCenterX;
    let dy = t.clientY - joyCenterY;
    const len = Math.hypot(dx, dy);
    if (len > MAX_RADIUS) { const k = MAX_RADIUS / len; dx *= k; dy *= k; }
    setKnobOffset(dx, dy);
    updateMoveVector(dx, dy);
  }
  function joyEnd(t) {
    if (t && t.identifier !== joyTouchId) return;
    joyTouchId = null;
    setKnobOffset(0, 0);
    state.mobileInput.moveX = 0;
    state.mobileInput.moveY = 0;
  }

  joystickEl.addEventListener('touchstart', (e) => { e.preventDefault(); for (const t of e.changedTouches) joyStart(t); }, { passive: false });
  joystickEl.addEventListener('touchmove',  (e) => { e.preventDefault(); for (const t of e.changedTouches) handleJoyMove(t); }, { passive: false });
  joystickEl.addEventListener('touchend',   (e) => { e.preventDefault(); for (const t of e.changedTouches) joyEnd(t); }, { passive: false });
  joystickEl.addEventListener('touchcancel', () => joyEnd(), { passive: false });

  function fireDown(e) { e.preventDefault(); e.stopPropagation(); state.mobileInput.fire = true; }
  function fireUp(e) { if (e) e.preventDefault(); state.mobileInput.fire = false; }
  fireBtn.addEventListener('touchstart', fireDown, { passive: false });
  fireBtn.addEventListener('touchend', fireUp, { passive: false });
  fireBtn.addEventListener('touchcancel', fireUp, { passive: false });
  fireBtn.addEventListener('mousedown', fireDown);
  fireBtn.addEventListener('mouseup', fireUp);
  fireBtn.addEventListener('mouseleave', fireUp);

  function pauseTap(e) {
    e.preventDefault();
    e.stopPropagation();
    if (!state.isRunning) {
      if (!state.awaitingUpgrade) startGame();
    } else if (state.awaitingUpgrade) return;
    else togglePause();
  }
  if (pauseBtn) {
    pauseBtn.addEventListener('touchstart', pauseTap, { passive: false });
    pauseBtn.addEventListener('click', pauseTap);
  }

  canvas.addEventListener('touchstart', (e) => {
    e.preventDefault();
    if (state.isRunning && !state.isPaused && !state.awaitingUpgrade) shootPlayer();
  }, { passive: false });
})();

// =====================================================================
// CUSTOM LEVELS
// =====================================================================
const LS_CUSTOM_LEVELS = CONFIG.LS_CUSTOM_LEVELS;

function getCustomLevels() {
  try {
    const raw = localStorage.getItem(LS_CUSTOM_LEVELS);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch (e) { return []; }
}

function saveCustomLevels(arr) {
  try { localStorage.setItem(LS_CUSTOM_LEVELS, JSON.stringify(arr)); }
  catch (e) { console.error('Не удалось сохранить уровни:', e); }
}

function isBaseArea(x, y) {
  if (!state.editor.base) return false;
  const b = state.editor.base;
  return x >= b.x && x < b.x + 2 && y >= b.y && y < b.y + 2;
}

function serializeCustom(map, base, noEnemies) {
  const lines = [];
  for (let y = 0; y < state.editor.gridSize; y++) {
    let line = '';
    for (let x = 0; x < state.editor.gridSize; x++) {
      const t = map[y][x];
      if (!t) line += '.';
      else if (t.type === 'brick') line += 'B';
      else if (t.type === 'steel') line += 'S';
      else if (t.type === 'water') line += 'W';
      else if (t.type === 'trees') line += 'T';
      else line += '.';
    }
    lines.push(line);
  }
  return {
    base: { x: base.x, y: base.y },
    lines,
    gridSize: state.editor.gridSize,
    noEnemies: !!noEnemies,
  };
}

function deserializeCustom(data) {
  const gridSize = data.gridSize || CONFIG.GRID;
  const map = [];
  for (let y = 0; y < gridSize; y++) {
    const row = [];
    const line = (data.lines && data.lines[y]) || '';
    for (let x = 0; x < gridSize; x++) {
      const ch = line[x];
      if (ch === 'B') row.push({ type: 'brick', sub: [1, 1, 1, 1] });
      else if (ch === 'S') row.push({ type: 'steel' });
      else if (ch === 'W') row.push({ type: 'water' });
      else if (ch === 'T') row.push({ type: 'trees' });
      else row.push(null);
    }
    map.push(row);
  }
  const bx = Math.max(0, Math.min(gridSize - 2, data.base.x));
  const by = Math.max(0, Math.min(gridSize - 2, data.base.y));
  for (let dy = 0; dy < 2; dy++)
    for (let dx = 0; dx < 2; dx++)
      map[by + dy][bx + dx] = null;

  return {
    base: { x: bx, y: by },
    map,
    gridSize,
    noEnemies: !!data.noEnemies,
  };
}

// ---------- Размер карты ----------
function applyEditorGridSize(newSize) {
  const size = Math.max(CONFIG.MIN_GRID, Math.min(CONFIG.MAX_GRID, newSize));
  if (size === state.editor.gridSize) return;

  const oldMap = state.editor.map;
  const oldBase = state.editor.base;

  // Новая карта
  const newMap = [];
  for (let y = 0; y < size; y++) {
    const row = [];
    for (let x = 0; x < size; x++) {
      const oldT = (oldMap && oldMap[y] && oldMap[y][x]) || null;
      row.push(oldT ? JSON.parse(JSON.stringify(oldT)) : null);
    }
    newMap.push(row);
  }

  state.editor.gridSize = size;
  state.editor.map = newMap;

  // Позиция базы — если вылезает за пределы, в угол
  let bx = oldBase ? oldBase.x : Math.floor((size - 2) / 2);
  let by = oldBase ? oldBase.y : size - 2;
  bx = Math.max(0, Math.min(size - 2, bx));
  by = Math.max(0, Math.min(size - 2, by));
  state.editor.base = { x: bx, y: by };

  // Очищаем площадь базы
  for (let dy = 0; dy < 2; dy++)
    for (let dx = 0; dx < 2; dx++)
      state.editor.map[by + dy][bx + dx] = null;

  // Обновить canvas размером под новое поле
  editorCanvas.width = CONFIG.TILE * size;
  editorCanvas.height = CONFIG.TILE * size;
  sizeValueEl.textContent = `${size} × ${size}`;

  updateSizeButtons();
  renderEditor();
}

function updateSizeButtons() {
  if (sizeMinusBtn) sizeMinusBtn.disabled = state.editor.gridSize <= CONFIG.MIN_GRID;
  if (sizePlusBtn)  sizePlusBtn.disabled  = state.editor.gridSize >= CONFIG.MAX_GRID;
  if (sizeValueEl)  sizeValueEl.textContent = `${state.editor.gridSize} × ${state.editor.gridSize}`;
}

// ---------- Открытие / закрытие ----------
function openEditor() {
  // Если карта ещё не загружена (до старта игры) — возьмём дефолтную
  if (!state.map || !state.base) {
    loadLevel(0);
  }

  const gridSize = CONFIG.GRID;
  const map = [];
  for (let y = 0; y < gridSize; y++) {
    const row = [];
    for (let x = 0; x < gridSize; x++) {
      const t = state.map[y][x];
      if (!t) row.push(null);
      else if (t.type === 'brick') row.push({ type: 'brick', sub: [1, 1, 1, 1] });
      else row.push({ type: t.type });
    }
    map.push(row);
  }

  state.editor.active = true;
  state.editor.selectedTile = 'empty';
  state.editor.map = map;
  state.editor.base = { x: state.base.x, y: state.base.y };
  state.editor.painting = false;
  state.editor.eraseMode = false;
  state.editor.gridSize = gridSize;
  state.editor.noEnemies = state.noEnemies;

  editorCanvas.width = CONFIG.TILE * gridSize;
  editorCanvas.height = CONFIG.TILE * gridSize;

  if (noEnemiesChk) noEnemiesChk.checked = state.editor.noEnemies;

  updateSizeButtons();
  updatePaletteUI();

  overlay.classList.add('hidden');
  upgradeOverlay.classList.add('hidden');
  editorOverlay.classList.remove('hidden');

  renderEditor();
}

function closeEditor() {
  state.editor.active = false;
  editorOverlay.classList.add('hidden');

  // Показать стартовый оверлей или паузу
  if (state.isRunning) {
    state.isPaused = true;
    overlayTitle.textContent = '⏸ Пауза';
    overlayText.textContent = 'Space или P — продолжить';
    startBtn.textContent = 'Продолжить';
    if (menuExtras) menuExtras.classList.add('hidden');
    if (pauseExtras) pauseExtras.classList.remove('hidden');
  } else {
    // Возврат в стартовое меню
    if (state.lastResult !== 'lose') {
      overlayTitle.textContent = '🎮 Стальные коты';
      overlayText.textContent = 'Защити базу от вражеских танков';
      startBtn.textContent = 'Играть';
    }
    if (menuExtras) menuExtras.classList.remove('hidden');
    if (pauseExtras) pauseExtras.classList.add('hidden');
  }
  overlay.classList.remove('hidden');
}

// ---------- Палитра ----------
function updatePaletteUI() {
  paletteBtns.forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tile === state.editor.selectedTile);
  });
}

paletteBtns.forEach(btn => {
  const fire = (e) => {
    e.preventDefault(); e.stopPropagation();
    state.editor.selectedTile = btn.dataset.tile;
    updatePaletteUI();
  };
  btn.addEventListener('click', fire);
  btn.addEventListener('touchend', fire, { passive: false });
});

// ---------- Размер карты ----------
if (sizeMinusBtn) {
  const fire = (e) => {
    e.preventDefault(); e.stopPropagation();
    applyEditorGridSize(state.editor.gridSize - 2);
  };
  sizeMinusBtn.addEventListener('click', fire);
  sizeMinusBtn.addEventListener('touchend', fire, { passive: false });
}
if (sizePlusBtn) {
  const fire = (e) => {
    e.preventDefault(); e.stopPropagation();
    applyEditorGridSize(state.editor.gridSize + 2);
  };
  sizePlusBtn.addEventListener('click', fire);
  sizePlusBtn.addEventListener('touchend', fire, { passive: false });
}

// ---------- Без врагов ----------
if (noEnemiesChk) {
  noEnemiesChk.addEventListener('change', () => {
    state.editor.noEnemies = noEnemiesChk.checked;
  });
}

// ---------- Рендер редактора ----------
function renderEditor() {
  if (!state.editor.active) return;
  const TILE = CONFIG.TILE;
  const size = state.editor.gridSize;
  const sizePx = TILE * size;
  const P = CONFIG.PALETTE;
  const eCtx = editorCanvas.getContext('2d');

  eCtx.fillStyle = P.bg;
  eCtx.fillRect(0, 0, sizePx, sizePx);

  eCtx.strokeStyle = 'rgba(255, 183, 224, 0.10)';
  eCtx.lineWidth = 1;
  for (let i = 0; i <= size; i++) {
    const p = i * TILE + 0.5;
    eCtx.beginPath(); eCtx.moveTo(p, 0); eCtx.lineTo(p, sizePx); eCtx.stroke();
    eCtx.beginPath(); eCtx.moveTo(0, p); eCtx.lineTo(sizePx, p); eCtx.stroke();
  }

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const t = state.editor.map[y][x];
      if (!t) continue;
      const px = x * TILE, py = y * TILE;

      if (t.type === 'brick') {
        eCtx.fillStyle = P.brick;
        eCtx.fillRect(px + 1, py + 1, TILE - 2, TILE - 2);
        eCtx.strokeStyle = P.brickDark;
        eCtx.lineWidth = 1;
        eCtx.strokeRect(px + 1.5, py + 1.5, TILE - 3, TILE - 3);
        eCtx.beginPath();
        eCtx.moveTo(px + 1, py + TILE / 2);
        eCtx.lineTo(px + TILE - 1, py + TILE / 2);
        eCtx.stroke();
      } else if (t.type === 'steel') {
        eCtx.fillStyle = P.steel;
        eCtx.fillRect(px + 1, py + 1, TILE - 2, TILE - 2);
        eCtx.strokeStyle = P.steelDark;
        eCtx.strokeRect(px + 1.5, py + 1.5, TILE - 3, TILE - 3);
        eCtx.fillStyle = P.steelDark;
        eCtx.fillRect(px + 1, py + TILE / 2 - 1, TILE - 2, 2);
        eCtx.fillRect(px + TILE / 2 - 1, py + 1, 2, TILE - 2);
      } else if (t.type === 'water') {
        eCtx.fillStyle = P.water;
        eCtx.fillRect(px + 1, py + 1, TILE - 2, TILE - 2);
        eCtx.fillStyle = P.waterLight;
        eCtx.fillRect(px + 4, py + TILE / 2 - 1, TILE - 8, 2);
      } else if (t.type === 'trees') {
        eCtx.fillStyle = P.treesDark;
        eCtx.fillRect(px + 1, py + 1, TILE - 2, TILE - 2);
        eCtx.fillStyle = P.trees;
        eCtx.beginPath();
        eCtx.arc(px + TILE / 2, py + TILE / 2, TILE * 0.3, 0, Math.PI * 2);
        eCtx.fill();
        eCtx.fillStyle = P.treesLight;
        eCtx.beginPath();
        eCtx.arc(px + TILE / 2 - 2, py + TILE / 2 - 2, TILE * 0.15, 0, Math.PI * 2);
        eCtx.fill();
      }
    }
  }

  // База
  const b = state.editor.base;
  if (b) {
    const bpx = b.x * TILE;
    const bpy = b.y * TILE;
    const bs = TILE * 2;
    eCtx.fillStyle = P.baseBg;
    eCtx.fillRect(bpx, bpy, bs, bs);
    eCtx.strokeStyle = P.base;
    eCtx.lineWidth = 2;
    eCtx.strokeRect(bpx + 1, bpy + 1, bs - 2, bs - 2);
    eCtx.save();
    eCtx.font = `${bs * 0.7}px serif`;
    eCtx.textAlign = 'center';
    eCtx.textBaseline = 'middle';
    eCtx.fillText('🦅', bpx + bs / 2, bpy + bs / 2 + 2);
    eCtx.restore();
  }
}

// ---------- Рисование ----------
function editorCellFromEvent(clientX, clientY) {
  const rect = editorCanvas.getBoundingClientRect();
  const scaleX = editorCanvas.width / rect.width;
  const scaleY = editorCanvas.height / rect.height;
  const cx = (clientX - rect.left) * scaleX;
  const cy = (clientY - rect.top) * scaleY;
  const x = Math.floor(cx / CONFIG.TILE);
  const y = Math.floor(cy / CONFIG.TILE);
  if (x < 0 || x >= state.editor.gridSize || y < 0 || y >= state.editor.gridSize) return null;
  return { x, y };
}

function paintAt(x, y, forceErase) {
  if (!state.editor.active) return;
  const erasing = forceErase || state.editor.selectedTile === 'empty';

  if (!erasing && state.editor.selectedTile === 'base') {
    const bx = Math.max(0, Math.min(state.editor.gridSize - 2, x));
    const by = Math.max(0, Math.min(state.editor.gridSize - 2, y));
    state.editor.base = { x: bx, y: by };
    for (let dy = 0; dy < 2; dy++)
      for (let dx = 0; dx < 2; dx++)
        state.editor.map[by + dy][bx + dx] = null;
    renderEditor();
    return;
  }

  if (isBaseArea(x, y)) return;

  if (erasing) state.editor.map[y][x] = null;
  else {
    const tile = state.editor.selectedTile;
    if (tile === 'brick') state.editor.map[y][x] = { type: 'brick', sub: [1, 1, 1, 1] };
    else if (tile === 'steel') state.editor.map[y][x] = { type: 'steel' };
    else if (tile === 'water') state.editor.map[y][x] = { type: 'water' };
    else if (tile === 'trees') state.editor.map[y][x] = { type: 'trees' };
  }
  renderEditor();
}

if (editorCanvas) {
  editorCanvas.addEventListener('mousedown', (e) => {
    e.preventDefault();
    state.editor.painting = true;
    state.editor.eraseMode = (e.button === 2);
    const cell = editorCellFromEvent(e.clientX, e.clientY);
    if (cell) paintAt(cell.x, cell.y, state.editor.eraseMode);
  });
  editorCanvas.addEventListener('mousemove', (e) => {
    if (!state.editor.painting) return;
    const cell = editorCellFromEvent(e.clientX, e.clientY);
    if (cell) paintAt(cell.x, cell.y, state.editor.eraseMode);
  });
  window.addEventListener('mouseup', () => {
    state.editor.painting = false;
    state.editor.eraseMode = false;
  });
  editorCanvas.addEventListener('contextmenu', (e) => e.preventDefault());

  editorCanvas.addEventListener('touchstart', (e) => {
    e.preventDefault();
    const t = e.touches[0];
    const cell = editorCellFromEvent(t.clientX, t.clientY);
    if (cell) paintAt(cell.x, cell.y, false);
  }, { passive: false });
  editorCanvas.addEventListener('touchmove', (e) => {
    e.preventDefault();
    const t = e.touches[0];
    const cell = editorCellFromEvent(t.clientX, t.clientY);
    if (cell) paintAt(cell.x, cell.y, false);
  }, { passive: false });
}

// ---------- Кнопки редактора ----------
function bindBtn(btn, handler) {
  if (!btn) return;
  const fire = (e) => { e.preventDefault(); e.stopPropagation(); handler(); };
  btn.addEventListener('click', fire);
  btn.addEventListener('touchend', fire, { passive: false });
}

bindBtn(editorClearBtn, () => {
  if (!state.editor.map) return;
  for (let y = 0; y < state.editor.gridSize; y++)
    for (let x = 0; x < state.editor.gridSize; x++)
      state.editor.map[y][x] = null;
  renderEditor();
});

bindBtn(editorCloseBtn, () => closeEditor());

bindBtn(editorSaveBtn, () => {
  const data = serializeCustom(state.editor.map, state.editor.base, state.editor.noEnemies);
  const levels = getCustomLevels();
  const now = new Date();
  const name = `Мой уровень ${now.toLocaleDateString()} ${now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  levels.push({
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    name,
    ...data,
  });
  saveCustomLevels(levels);
  const original = editorSaveBtn.textContent;
  editorSaveBtn.textContent = '✅ Сохранено';
  editorSaveBtn.disabled = true;
  setTimeout(() => {
    editorSaveBtn.textContent = original;
    editorSaveBtn.disabled = false;
  }, 1200);
});

bindBtn(editorApplyBtn, () => {
  applyEditorToGame();
});

// ---------- Применение к игре ----------
function applyEditorToGame() {
  if (!state.editor.map) return;

  const size = state.editor.gridSize;

  // 1) Обновить глобальный GRID (если размер изменился)
  CONFIG.GRID = size;
  updateW();

  // 2) Собрать карту
  const base = { x: state.editor.base.x, y: state.editor.base.y, alive: true };
  const map = [];
  for (let y = 0; y < size; y++) {
    const row = [];
    for (let x = 0; x < size; x++) {
      const t = state.editor.map[y][x];
      if (!t) row.push(null);
      else if (t.type === 'brick') row.push({ type: 'brick', sub: [1, 1, 1, 1] });
      else row.push({ type: t.type });
    }
    map.push(row);
  }

  // 3) Расчистить зону игрока (слева от базы, в нижних рядах)
  for (let dy = size - 3; dy < size; dy++) {
    for (let dx = 0; dx < Math.max(1, base.x - 1); dx++) {
      if (dy >= 0 && dy < size && dx >= 0 && dx < size) {
        map[dy][dx] = null;
      }
    }
  }

  // 4) Записать в state
  state.base = base;
  state.map = map;
  state.enemies = [];
  state.bullets = [];
  state.noEnemies = !!state.editor.noEnemies;

  // 5) Очередь врагов
  if (state.noEnemies) {
    state.spawnQueue = [];
    state.enemiesTotal = 0;
    state.enemiesKilled = 0;
  } else {
    state.spawnQueue = buildSpawnQueue(state.level);
    state.enemiesTotal = state.spawnQueue.length;
    state.enemiesKilled = 0;
  }

  state.pendingRespawn = false;
  state.respawnTimerMs = 0;
  state.invulnTimerMs = 0;
  state.lastResult = null;
  state.awaitingUpgrade = false;

  closeEditor();
  // Если игра уже была — перезапускаем
  if (!state.isRunning) {
    // Сбрасываем очки/жизни если пользователь в меню
    state.level = 1;
    state.score = 0;
    state.lives = 3;
    state.build = { speed: 1, armor: 1, reload: 1, damage: 1, doubleShot: 0 };
  }

  startGame(true);
  render();
}

// ---------- Мои уровни ----------
function openLevels() {
  levelsOverlay.classList.remove('hidden');
  overlay.classList.add('hidden');
  renderLevelsList();
}

function renderLevelsList() {
  const levels = getCustomLevels();
  levelsList.innerHTML = '';

  if (levels.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'levels-empty';
    empty.textContent = 'Пока нет сохранённых уровней';
    levelsList.appendChild(empty);
    return;
  }

  for (const lvl of levels) {
    const item = document.createElement('div');
    item.className = 'level-item';

    const name = document.createElement('div');
    name.className = 'level-item-name';
    name.textContent = lvl.name || 'Без названия';
    item.appendChild(name);

    // Кнопка «играть этот уровень»
    const playBtn = document.createElement('button');
    playBtn.className = 'level-item-btn';
    playBtn.type = 'button';
    playBtn.title = 'Играть';
    playBtn.textContent = '▶';
    const onPlay = (e) => {
      e.preventDefault(); e.stopPropagation();
      playCustomLevel(lvl);
    };
    playBtn.addEventListener('click', onPlay);
    playBtn.addEventListener('touchend', onPlay, { passive: false });
    item.appendChild(playBtn);

    // Редактировать
    const editBtn = document.createElement('button');
    editBtn.className = 'level-item-btn';
    editBtn.type = 'button';
    editBtn.title = 'Редактировать';
    editBtn.textContent = '✎';
    const onEdit = (e) => {
      e.preventDefault(); e.stopPropagation();
      openLevelInEditor(lvl);
    };
    editBtn.addEventListener('click', onEdit);
    editBtn.addEventListener('touchend', onEdit, { passive: false });
    item.appendChild(editBtn);

    // Удалить
    const delBtn = document.createElement('button');
    delBtn.className = 'level-item-btn danger';
    delBtn.type = 'button';
    delBtn.title = 'Удалить';
    delBtn.textContent = '✕';
    const onDel = (e) => {
      e.preventDefault(); e.stopPropagation();
      const remaining = getCustomLevels().filter(l => l.id !== lvl.id);
      saveCustomLevels(remaining);
      renderLevelsList();
    };
    delBtn.addEventListener('click', onDel);
    delBtn.addEventListener('touchend', onDel, { passive: false });
    item.appendChild(delBtn);

    levelsList.appendChild(item);
  }
}

function playCustomLevel(lvl) {
  const data = deserializeCustom(lvl);

  CONFIG.GRID = data.gridSize;
  updateW();

  state.base = { x: data.base.x, y: data.base.y, alive: true };
  state.map = data.map;
  state.enemies = [];
  state.bullets = [];
  state.noEnemies = !!data.noEnemies;

  if (state.noEnemies) {
    state.spawnQueue = [];
    state.enemiesTotal = 0;
    state.enemiesKilled = 0;
  } else {
    state.spawnQueue = buildSpawnQueue(state.level);
    state.enemiesTotal = state.spawnQueue.length;
    state.enemiesKilled = 0;
  }

  state.level = 1;
  state.score = 0;
  state.lives = 3;
  state.build = { speed: 1, armor: 1, reload: 1, damage: 1, doubleShot: 0 };

  levelsOverlay.classList.add('hidden');
  startGame(true);
}

function openLevelInEditor(lvl) {
  const data = deserializeCustom(lvl);

  // Подгоняем editor canvas под размер
  CONFIG.GRID = data.gridSize;
  updateW();

  state.editor.active = true;
  state.editor.selectedTile = 'empty';
  state.editor.map = data.map;
  state.editor.base = data.base;
  state.editor.painting = false;
  state.editor.gridSize = data.gridSize;
  state.editor.noEnemies = data.noEnemies;

  editorCanvas.width = CONFIG.TILE * data.gridSize;
  editorCanvas.height = CONFIG.TILE * data.gridSize;

  if (noEnemiesChk) noEnemiesChk.checked = data.noEnemies;

  updateSizeButtons();
  updatePaletteUI();

  levelsOverlay.classList.add('hidden');
  overlay.classList.add('hidden');
  editorOverlay.classList.remove('hidden');

  renderEditor();
}

// ---------- Кнопки в меню и паузе ----------
bindBtn(menuEditorBtn, () => openEditor());
bindBtn(menuLevelsBtn, () => openLevels());
bindBtn(openEditorBtn, () => openEditor());
bindBtn(openLevelsBtn, () => openLevels());

bindBtn(levelsCloseBtn, () => {
  levelsOverlay.classList.add('hidden');
  if (state.isRunning && state.isPaused) {
    overlayTitle.textContent = '⏸ Пауза';
    overlayText.textContent = 'Space или P — продолжить';
    startBtn.textContent = 'Продолжить';
    if (pauseExtras) pauseExtras.classList.remove('hidden');
  } else {
    if (state.lastResult !== 'lose') {
      overlayTitle.textContent = '🎮 Стальные коты';
      overlayText.textContent = 'Защити базу от вражеских танков';
      startBtn.textContent = 'Играть';
    }
    if (menuExtras) menuExtras.classList.remove('hidden');
    if (pauseExtras) pauseExtras.classList.add('hidden');
  }
  overlay.classList.remove('hidden');
});

// ---------------------------------------------------------------------
// INIT
// ---------------------------------------------------------------------
(function init() {
  loadLevel(0);
  spawnPlayer();
  state.invulnTimerMs = 0;
  updateHUD();
  render();
})();