// =====================================================================
// 🎮 Battle City — Стальные коты
// Step 4: враги
// =====================================================================

// ---------------------------------------------------------------------
// CONFIG
// ---------------------------------------------------------------------
const CONFIG = {
  TILE: 28,
  GRID: 17,

  FPS: 60,
  STEP_MS: 1000 / 60,

  GRID_ALPHA: 0.025,

  PLAYER: {
    SPEED: 90,
    SNAP_SPEED: 200,
    BULLET_SPEED: 280,
    BULLET_SIZE: 6,
    RELOAD_MS: 380,
    INVULN_MS: 3000,
    RESPAWN_MS: 1500,
  },

  ENEMY: {
    BULLET_SPEED: 200,
    BULLET_SIZE: 6,
    SNAP_SPEED: 200,
  },

  // Спавн
  SPAWN_INTERVAL_START: 3000,     // мс между спавнами
  SPAWN_INTERVAL_PER_LEVEL: 200,  // уменьшение интервала за уровень
  SPAWN_INTERVAL_MIN: 1200,
  MAX_CONCURRENT_START: 3,        // одновременных врагов на 1 ур.
  MAX_CONCURRENT_PER_2_LEVELS: 1, // +1 враг каждые 2 уровня

  LS_BEST: 'battleCityBest',

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

const W = CONFIG.TILE * CONFIG.GRID;

// ---------------------------------------------------------------------
// ENEMY TYPES
// ---------------------------------------------------------------------
const ENEMY_TYPES = {
  basic: { hp: 1, speed: 45, fireRate: 1.6, score: 100,  color: '#b0b0b0', colorDark: '#5a5a5a' },
  fast:  { hp: 1, speed: 100, fireRate: 1.6, score: 200, color: '#ffffff', colorDark: '#a0a0a0' },
  power: { hp: 1, speed: 45, fireRate: 0.6, score: 300,  color: '#ff5f5f', colorDark: '#a03030' },
  armor: { hp: 4, speed: 35, fireRate: 1.2, score: 400,  color: '#4aa85a', colorDark: '#2a6030' },
  heavy: { hp: 2, speed: 100, fireRate: 0.6, score: 500, color: '#ffd24a', colorDark: '#a08030' },
  boss:  { hp: 8, speed: 50, fireRate: 0.5, score: 1000, color: '#b87cff', colorDark: '#5a3a9a' },
};

// 3 точки спавна сверху (левый верхний угол танка)
const SPAWN_POINTS = [
  { x: 0,  y: 0 },
  { x: 8,  y: 0 },
  { x: 16, y: 0 },
];

// ---------------------------------------------------------------------
// LEVELS
// ---------------------------------------------------------------------
const LEVELS = [
  {
    name: 'Летний сад',
    base: { x: 7, y: 15 },
    map: [
      '.................',
      '.................',
      '.................',
      '..BBB.......BBB..',
      '..B.B.......B.B..',
      '..BBB.......BBB..',
      '.................',
      '.....BB...BB.....',
      '.....B.....B.....',
      '..SS.B.....B.SS..',
      '.....B.....B.....',
      '.....BB...BB.....',
      '.................',
      '.................',
      '......BBBB.......',
      '......B..B.......',
      '......B..B.......',
    ],
  },
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

const overlay     = document.getElementById('overlay');
const overlayTitle = document.getElementById('overlay-title');
const overlayText  = document.getElementById('overlay-text');
const startBtn     = document.getElementById('start-btn');

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

  build: { speed: 1, armor: 1, reload: 1, damage: 1 },

  levelData: null,
  map: null,
  base: null,

  player: null,
  enemies: [],
  bullets: [],

  spawnQueue: [],

  // Респавн игрока
  pendingRespawn: false,
  respawnTimerMs: 0,
  invulnTimerMs: 0,
};

// ---------------------------------------------------------------------
// MAP
// ---------------------------------------------------------------------
function loadLevel(index) {
  const level = LEVELS[index % LEVELS.length];
  state.levelData = level;

  state.base = {
    x: level.base.x,
    y: level.base.y,
    alive: true,
  };

  state.map = [];
  for (let y = 0; y < CONFIG.GRID; y++) {
    const row = [];
    const line = level.map[y] || '';
    for (let x = 0; x < CONFIG.GRID; x++) {
      const ch = line[x] || '.';
      let tile = null;
      switch (ch) {
        case 'B': tile = { type: 'brick', sub: [1, 1, 1, 1] }; break;
        case 'S': tile = { type: 'steel' }; break;
        case 'W': tile = { type: 'water' }; break;
        case 'T': tile = { type: 'trees' }; break;
      }
      row.push(tile);
    }
    state.map.push(row);
  }

  for (let dy = 0; dy < 2; dy++) {
    for (let dx = 0; dx < 2; dx++) {
      const by = state.base.y + dy;
      const bx = state.base.x + dx;
      if (by >= 0 && by < CONFIG.GRID && bx >= 0 && bx < CONFIG.GRID) {
        state.map[by][bx] = null;
      }
    }
  }

  // Очередь врагов на уровень
  state.spawnQueue = buildSpawnQueue(index + 1);
  state.enemiesTotal = state.spawnQueue.length;
  state.enemiesKilled = 0;
  state.enemies = [];
  state.bullets = [];

  // Параметры спавна по уровню
  const lvl = index + 1;
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

// Состав врагов на уровень — взвешенный рандом с ростом сложности
function buildSpawnQueue(level) {
  const total = 10 + level * 2; // 12 врагов на 1 уровне
  const queue = [];
  for (let i = 0; i < total; i++) {
    const r = Math.random();
    // Чем выше уровень, тем больше «жирных» типов
    const bossChance   = Math.min(0.05 + level * 0.01, 0.15);
    const heavyChance  = Math.min(0.06 + level * 0.02, 0.18);
    const armorChance  = Math.min(0.10 + level * 0.02, 0.20);
    const powerChance  = Math.min(0.14 + level * 0.01, 0.22);
    const fastChance   = 0.20;

    if (r < bossChance)                       queue.push('boss');
    else if (r < bossChance + heavyChance)    queue.push('heavy');
    else if (r < bossChance + heavyChance + armorChance) queue.push('armor');
    else if (r < bossChance + heavyChance + armorChance + powerChance) queue.push('power');
    else if (r < bossChance + heavyChance + armorChance + powerChance + fastChance) queue.push('fast');
    else                                       queue.push('basic');
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

// Блокирующие тайлы + границы поля
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
      if (t.type === 'brick' || t.type === 'steel' || t.type === 'water') {
        return true;
      }
    }
  }
  return false;
}

// Может ли танк (player или enemy) перейти в точку (nx, ny)
// Учитывает: карта + база + другие танки
function canMove(tank, nx, ny) {
  if (tankCollidesMap(nx, ny, tank.w, tank.h)) return false;

  const rect = { x: nx, y: ny, w: tank.w, h: tank.h };
  const { TILE } = CONFIG;

  // База
  if (state.base && state.base.alive) {
    const bx = state.base.x * TILE;
    const by = state.base.y * TILE;
    const bs = TILE * 2;
    if (aabb(rect, { x: bx, y: by, w: bs, h: bs })) return false;
  }

  // Игрок
  if (state.player && state.player.alive && tank !== state.player) {
    if (aabb(rect, state.player)) return false;
  }

  // Враги
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
  state.player = {
    x: 4 * TILE,
    y: 15 * TILE,
    w: TILE,
    h: TILE,
    dir: 'up',
    moving: false,
    alive: true,
    speed: CONFIG.PLAYER.SPEED,
    lastShot: 0,
    reloadMs: CONFIG.PLAYER.RELOAD_MS,
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

  state.lives--;
  updateHUD();

  if (state.lives <= 0) {
    state.player.alive = false;
    gameOver('Жизни закончились');
    return;
  }

  state.player.alive = false;
  state.pendingRespawn = true;
  state.respawnTimerMs = CONFIG.PLAYER.RESPAWN_MS;
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
function shootPlayer() {
  const p = state.player;
  if (!p || !p.alive) return;

  const hasBullet = state.bullets.some(b => b.owner === 'player');
  if (hasBullet) return;

  const now = performance.now();
  if (now - p.lastShot < p.reloadMs) return;
  p.lastShot = now;

  const { BULLET_SIZE, BULLET_SPEED } = CONFIG.PLAYER;
  const cx = p.x + p.w / 2;
  const cy = p.y + p.h / 2;
  const half = BULLET_SIZE / 2;

  let bx, by, dx = 0, dy = 0;
  switch (p.dir) {
    case 'left':  dx = -1; bx = p.x - half;         by = cy - half;         break;
    case 'right': dx = 1;  bx = p.x + p.w - half;   by = cy - half;         break;
    case 'up':    dy = -1; bx = cx - half;          by = p.y - half;        break;
    case 'down':  dy = 1;  bx = cx - half;          by = p.y + p.h - half;  break;
  }

  state.bullets.push({
    x: bx, y: by, w: BULLET_SIZE, h: BULLET_SIZE,
    dx, dy, speed: BULLET_SPEED,
    owner: 'player',
  });
}

function enemyShoot(e) {
  const hasBullet = state.bullets.some(b => b.enemyRef === e);
  if (hasBullet) return;

  const { BULLET_SIZE, BULLET_SPEED } = CONFIG.ENEMY;
  const cx = e.x + e.w / 2;
  const cy = e.y + e.h / 2;
  const half = BULLET_SIZE / 2;

  let bx, by, dx = 0, dy = 0;
  switch (e.dir) {
    case 'left':  dx = -1; bx = e.x - half;         by = cy - half;         break;
    case 'right': dx = 1;  bx = e.x + e.w - half;   by = cy - half;         break;
    case 'up':    dy = -1; bx = cx - half;          by = e.y - half;        break;
    case 'down':  dy = 1;  bx = cx - half;          by = e.y + e.h - half;  break;
  }

  state.bullets.push({
    x: bx, y: by, w: BULLET_SIZE, h: BULLET_SIZE,
    dx, dy, speed: BULLET_SPEED,
    owner: 'enemy',
    enemyRef: e,
  });
}

// Кирпич — рушим ближнюю половину, если её нет — дальнюю
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

// Попадание в карту и базу
function bulletHitWorld(bullet) {
  const { TILE, GRID } = CONFIG;

  if (bullet.x < 0 || bullet.y < 0 ||
      bullet.x + bullet.w > W || bullet.y + bullet.h > W) {
    return true;
  }

  // База — рушится ТОЛЬКО от пуль врагов
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
      if (t.type === 'steel') return true;
    }
  }
  return false;
}

// Попадание в танки
function bulletHitTanks(bullet) {
  if (bullet.owner === 'player') {
    for (const e of state.enemies) {
      if (!e.alive) continue;
      if (aabb(bullet, e)) {
        e.hp -= 1;
        if (e.hp <= 0) killEnemy(e);
        return true;
      }
    }
  } else if (bullet.owner === 'enemy') {
    if (state.player && state.player.alive && state.invulnTimerMs <= 0) {
      if (aabb(bullet, state.player)) {
        damagePlayer();
        return true;
      }
    }
  }
  return false;
}

function updateBullets(dt) {
  const alive = [];
  for (const b of state.bullets) {
    b.x += b.dx * b.speed * dt;
    b.y += b.dy * b.speed * dt;

    if (bulletHitTanks(b)) continue;
    if (bulletHitWorld(b)) continue;

    alive.push(b);
  }
  state.bullets = alive;
}

// ---------------------------------------------------------------------
// ENEMIES — спавн
// ---------------------------------------------------------------------
function trySpawnEnemy() {
  if (state.spawnQueue.length === 0) return;
  if (state.enemies.filter(e => e.alive).length >= state.maxConcurrent) return;

  const { TILE } = CONFIG;

  // Свободные точки спавна
  const free = SPAWN_POINTS.filter(sp => {
    const rect = { x: sp.x * TILE, y: sp.y * TILE, w: TILE, h: TILE };
    if (state.player && state.player.alive && aabb(rect, state.player)) return false;
    for (const e of state.enemies) {
      if (!e.alive) continue;
      if (aabb(rect, e)) return false;
    }
    return true;
  });

  if (free.length === 0) return;

  const point = free[Math.floor(Math.random() * free.length)];
  const typeName = state.spawnQueue.shift();
  const type = ENEMY_TYPES[typeName];

  state.enemies.push({
    x: point.x * TILE,
    y: point.y * TILE,
    w: TILE,
    h: TILE,
    dir: 'down',
    alive: true,
    type: typeName,
    hp: type.hp,
    maxHp: type.hp,
    speed: type.speed,
    fireRate: type.fireRate,
    score: type.score,
    color: type.color,
    colorDark: type.colorDark,
    lastShot: 0,
    moveTimer: 0.3 + Math.random() * 0.8,
    spawnFlash: 0.5,
  });
}

// ---------------------------------------------------------------------
// ENEMIES — обновление и ИИ
// ---------------------------------------------------------------------
function changeEnemyDir(e) {
  e.moveTimer = 0.6 + Math.random() * 1.6;

  // 65% — предпочитаем вниз, иначе случайное
  if (Math.random() < 0.65) {
    e.dir = 'down';
  } else {
    const dirs = ['up', 'down', 'left', 'right'];
    e.dir = dirs[Math.floor(Math.random() * 4)];
  }
}

function isAlignedWithTarget(e) {
  const { TILE } = CONFIG;
  const eCx = e.x + e.w / 2;
  const eCy = e.y + e.h / 2;

  // База
  if (state.base && state.base.alive) {
    const bCx = (state.base.x + 1) * TILE;
    const bCy = (state.base.y + 1) * TILE;

    if (Math.abs(eCx - bCx) < TILE && e.dir === 'down' && bCy > eCy) return true;
    if (Math.abs(eCy - bCy) < TILE) {
      if (e.dir === 'right' && bCx > eCx) return true;
      if (e.dir === 'left'  && bCx < eCx) return true;
    }
  }

  // Игрок
  if (state.player && state.player.alive) {
    const pCx = state.player.x + state.player.w / 2;
    const pCy = state.player.y + state.player.h / 2;

    if (Math.abs(eCx - pCx) < TILE) {
      if (e.dir === 'down' && pCy > eCy) return true;
      if (e.dir === 'up'   && pCy < eCy) return true;
    }
    if (Math.abs(eCy - pCy) < TILE) {
      if (e.dir === 'right' && pCx > eCx) return true;
      if (e.dir === 'left'  && pCx < eCx) return true;
    }
  }

  return false;
}

function updateEnemy(e, dt, nowSec) {
  if (!e.alive) return;

  if (e.spawnFlash > 0) e.spawnFlash = Math.max(0, e.spawnFlash - dt);

  const { TILE } = CONFIG;
  e.moveTimer -= dt;

  // 1) Снап перпендикуляра
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

  // 2) Смена направления по таймеру
  if (e.moveTimer <= 0) changeEnemyDir(e);

  // 3) Основное движение
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

  // 4) Стрельба
  tryEnemyShoot(e, nowSec);
}

function tryEnemyShoot(e, nowSec) {
  if (e.spawnFlash > 0) return;
  if (nowSec - e.lastShot < e.fireRate) return;

  const aligned = isAlignedWithTarget(e);
  if (aligned || Math.random() < 0.15) {
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
  if (state.enemiesKilled >= state.enemiesTotal) {
    // Небольшая задержка, чтобы последний взрыв успел «прочитаться»
    setTimeout(() => {
      if (!state.isRunning) return;
      state.isRunning = false;
      if (state.animId) cancelAnimationFrame(state.animId);

      overlayTitle.textContent = '🏆 Уровень пройден!';
      overlayText.innerHTML =
        `Уровень: <b>${state.level}</b><br>` +
        `Очки: <b>${state.score}</b><br>` +
        `Жизни: <b>${state.lives}</b>`;
      startBtn.textContent = 'Продолжить';
      overlay.classList.remove('hidden');
    }, 800);
  }
}

// ---------------------------------------------------------------------
// UPDATE
// ---------------------------------------------------------------------
function update(dtMs) {
  const dt = dtMs / 1000;

  // Таймер спавна врагов
  state.spawnTimerMs += dtMs;
  if (state.spawnTimerMs >= state.spawnIntervalMs) {
    state.spawnTimerMs = 0;
    trySpawnEnemy();
  }

  // Спавним врагов и без таймера, если на поле пусто (не ждать 3 сек с пустым полем)
  if (state.enemies.filter(e => e.alive).length === 0 && state.spawnQueue.length > 0) {
    trySpawnEnemy();
  }

  updatePlayer(dt);
  updateRespawn(dtMs);

  const nowSec = performance.now() / 1000;
  for (const e of state.enemies) updateEnemy(e, dt, nowSec);

  // Чистим убитых
  state.enemies = state.enemies.filter(e => e.alive);

  updateBullets(dt);
}

// ---------------------------------------------------------------------
// INPUT
// ---------------------------------------------------------------------
const keysDown = new Set();

document.addEventListener('keydown', (e) => {
  if (e.code === 'Space' || e.key === ' ') {
    e.preventDefault();
    if (!state.isRunning) {
      // На экране «Уровень пройден» / «Заново» — рестарт
      startGame();
    } else if (state.isPaused) {
      togglePause();
    } else {
      shootPlayer();
    }
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
  const px = x * TILE;
  const py = y * TILE;
  const half = TILE / 2;

  const positions = [
    [px,        py       ],
    [px + half, py       ],
    [px,        py + half],
    [px + half, py + half],
  ];

  for (let i = 0; i < 4; i++) {
    if (sub[i]) drawBrickSub(positions[i][0], positions[i][1], half);
  }
}

function drawSteel(x, y) {
  const { TILE, PALETTE: P } = CONFIG;
  const px = x * TILE;
  const py = y * TILE;
  const pad = 1;
  const s = TILE / 2;

  ctx.fillStyle = P.steelDark;
  ctx.fillRect(px, py, TILE, TILE);

  for (let i = 0; i < 4; i++) {
    const dx = (i % 2) * s;
    const dy = Math.floor(i / 2) * s;

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
  const px = x * TILE;
  const py = y * TILE;

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
  const px = x * TILE;
  const py = y * TILE;
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
  const px = state.base.x * TILE;
  const py = state.base.y * TILE;
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
// RENDER — танки
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

  const s = TILE;
  const half = s / 2;

  // Гусеницы
  ctx.fillStyle = track;
  ctx.fillRect(-half, -half, 5, s);
  ctx.fillRect(half - 5, -half, 5, s);

  ctx.fillStyle = trackLight;
  for (let y = -half + 2; y < half - 1; y += 5) {
    ctx.fillRect(-half + 1, y, 3, 2);
    ctx.fillRect(half - 4, y, 3, 2);
  }

  // Корпус
  ctx.fillStyle = body;
  ctx.fillRect(-half + 5, -half + 2, s - 10, s - 4);

  ctx.fillStyle = bodyLight;
  ctx.fillRect(-half + 5, -half + 2, s - 10, 3);

  // Башня
  ctx.fillStyle = turret;
  ctx.fillRect(-7, -5, 14, 12);

  // Центр башни — блик
  ctx.fillStyle = bodyLight;
  ctx.fillRect(-5, -3, 10, 3);

  // Ствол
  ctx.fillStyle = barrel;
  ctx.fillRect(-2, -half - 2, 4, 9);

  // Дополнительные детали для врагов (полоска на корпусе)
  if (opts.stripes) {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
    ctx.fillRect(-half + 5, half - 6, s - 10, 2);
  }

  ctx.restore();
}

function drawPlayerTank(t) {
  // Мерцание при неуязвимости
  let alpha = 1;
  if (state.invulnTimerMs > 0) {
    alpha = (Math.floor(performance.now() / 100) % 2 === 0) ? 0.35 : 1;
  }

  const P = CONFIG.PALETTE;
  const colors = {
    track:      P.playerTrack,
    trackLight: P.playerTrackLight,
    body:       P.playerBody,
    bodyLight:  P.playerBodyLight,
    turret:     P.playerTurret,
    barrel:     P.playerBarrel,
  };

  ctx.save();
  ctx.globalAlpha = alpha;
  drawTankCommon(t.x + t.w / 2, t.y + t.h / 2, t.dir, colors);
  ctx.restore();
}

function drawEnemyTank(e) {
  const colors = {
    track:      e.colorDark,
    trackLight: e.color,
    body:       e.color,
    bodyLight:  'rgba(255, 255, 255, 0.5)',
    turret:     e.colorDark,
    barrel:     '#ffffff',
  };

  // При спавне — мерцание
  let alpha = 1;
  if (e.spawnFlash > 0) {
    alpha = (Math.floor(performance.now() / 80) % 2 === 0) ? 0.3 : 1;
  }

  ctx.save();
  ctx.globalAlpha = alpha;
  drawTankCommon(e.x + e.w / 2, e.y + e.h / 2, e.dir, colors, { stripes: true });
  ctx.restore();

  // HP-полоска над врагом, если он ранен
  if (e.hp < e.maxHp) {
    const barW = e.w - 4;
    const barH = 3;
    const bx = e.x + 2;
    const by = e.y - 5;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(bx, by, barW, barH);
    ctx.fillStyle = '#ff5f5f';
    ctx.fillRect(bx, by, barW * (e.hp / e.maxHp), barH);
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

// ---------------------------------------------------------------------
// RENDER — кадр
// ---------------------------------------------------------------------
function render() {
  drawField();

  // 1. Земля (без кустов)
  if (state.map) {
    for (let y = 0; y < CONFIG.GRID; y++) {
      for (let x = 0; x < CONFIG.GRID; x++) {
        const t = state.map[y][x];
        if (t && t.type !== 'trees') drawTile(t, x, y);
      }
    }
  }

  // 2. База
  drawBase();

  // 3. Враги
  for (const e of state.enemies) drawEnemyTank(e);

  // 4. Игрок
  if (state.player && state.player.alive) drawPlayerTank(state.player);

  // 5. Пули
  for (const b of state.bullets) drawBullet(b);

  // 6. Кусты поверх
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
  const hearts = state.lives > 0
    ? '❤'.repeat(Math.min(state.lives, maxHearts)) +
      (state.lives > maxHearts ? ` +${state.lives - maxHearts}` : '')
    : '—';
  hudLives.textContent = hearts;

  hudEnemies.textContent = `${state.enemiesKilled} / ${state.enemiesTotal}`;

  buildSpeed.textContent  = state.build.speed;
  buildArmor.textContent  = state.build.armor;
  buildReload.textContent = state.build.reload;
  buildDamage.textContent = state.build.damage;
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

  if (!state.isPaused) {
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
function startGame() {
  state.level = 1;
  state.score = 0;
  state.lives = 3;
  state.build = { speed: 1, armor: 1, reload: 1, damage: 1 };
  state.pendingRespawn = false;
  state.respawnTimerMs = 0;
  state.invulnTimerMs = 0;

  loadLevel(state.level - 1);
  spawnPlayer();

  state.lastTime = 0;
  state.accumulator = 0;
  state.isRunning = true;
  state.isPaused = false;

  updateHUD();
  overlay.classList.add('hidden');

  if (state.animId) cancelAnimationFrame(state.animId);
  state.animId = requestAnimationFrame(loop);
}

function gameOver(reason) {
  state.isRunning = false;
  state.pendingRespawn = false;
  if (state.animId) cancelAnimationFrame(state.animId);

  overlayTitle.textContent = '💥 Игра окончена';
  overlayText.innerHTML =
    `<span style="color:#ff8fc8">${reason || ''}</span><br><br>` +
    `Уровень: <b>${state.level}</b><br>` +
    `Очки: <b>${state.score}</b><br>` +
    `Уничтожено врагов: <b>${state.enemiesKilled}</b><br>` +
    `Рекорд: <b>${state.best}</b>`;
  startBtn.textContent = 'Заново';
  overlay.classList.remove('hidden');
}

function togglePause() {
  if (!state.isRunning) return;
  state.isPaused = !state.isPaused;

  if (state.isPaused) {
    overlayTitle.textContent = '⏸ Пауза';
    overlayText.textContent = 'Space или P — продолжить';
    startBtn.textContent = 'Продолжить';
    overlay.classList.remove('hidden');
  } else {
    overlay.classList.add('hidden');
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
// INIT
// ---------------------------------------------------------------------
(function init() {
  loadLevel(0);
  spawnPlayer();
  state.invulnTimerMs = 0; // до старта не мигаем
  updateHUD();
  render();
})();