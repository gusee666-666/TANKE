// =====================================================================
// 🎮 Battle City — Стальные коты
// Step 3.1: фикс прыжка при повороте + разрушение кирпича половинами
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

  // Игрок
  PLAYER: {
    SPEED: 90,
    SNAP_SPEED: 200,
    BULLET_SPEED: 280,
    BULLET_SIZE: 6,
    RELOAD_MS: 380,
  },

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
  lives: 3,
  enemiesTotal: 0,
  enemiesKilled: 0,

  build: { speed: 1, armor: 1, reload: 1, damage: 1 },

  levelData: null,
  map: null,
  base: null,

  player: null,
  bullets: [],
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

  // Очистка области базы
  for (let dy = 0; dy < 2; dy++) {
    for (let dx = 0; dx < 2; dx++) {
      const by = state.base.y + dy;
      const bx = state.base.x + dx;
      if (by >= 0 && by < CONFIG.GRID && bx >= 0 && bx < CONFIG.GRID) {
        state.map[by][bx] = null;
      }
    }
  }
}

function isBaseCell(x, y) {
  if (!state.base) return false;
  return x >= state.base.x && x < state.base.x + 2 &&
         y >= state.base.y && y < state.base.y + 2;
}

// ---------------------------------------------------------------------
// TANK — создание игрока
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
}

// ---------------------------------------------------------------------
// INPUT — клавиатура
// ---------------------------------------------------------------------
const keysDown = new Set();

document.addEventListener('keydown', (e) => {
  if (e.code === 'Space' || e.key === ' ') {
    e.preventDefault();
    if (!state.isRunning) {
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
// PHYSICS — коллизии
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
      if (t.type === 'brick' || t.type === 'steel' || t.type === 'water') {
        return true;
      }
    }
  }

  if (state.base && state.base.alive) {
    const bx = state.base.x * TILE;
    const by = state.base.y * TILE;
    const bs = TILE * 2;
    if (aabb({ x, y, w, h }, { x: bx, y: by, w: bs, h: bs })) return true;
  }

  return false;
}

// ---------------------------------------------------------------------
// TANK — движение игрока (ФИКС: снап перпендикуляра с return)
// ---------------------------------------------------------------------
function updatePlayer(dt) {
  const p = state.player;
  if (!p || !p.alive) return;

  // Определяем желаемое направление
  let ndir = null;
  if (keysDown.has('ArrowLeft') || keysDown.has('KeyA')) ndir = 'left';
  else if (keysDown.has('ArrowRight') || keysDown.has('KeyD')) ndir = 'right';
  else if (keysDown.has('ArrowUp') || keysDown.has('KeyW')) ndir = 'up';
  else if (keysDown.has('ArrowDown') || keysDown.has('KeyS')) ndir = 'down';

  if (!ndir) {
    p.moving = false;
    return;
  }

  p.moving = true;
  p.dir = ndir;

  const { TILE } = CONFIG;

  // 1) СНАП перпендикулярной оси к сетке.
  //    Пока не выровнены — основную ось НЕ двигаем.
  if (p.dir === 'left' || p.dir === 'right') {
    const target = Math.round(p.y / TILE) * TILE;
    const diff = target - p.y;

    if (Math.abs(diff) > 0.5) {
      const step = Math.sign(diff) * Math.min(CONFIG.PLAYER.SNAP_SPEED * dt, Math.abs(diff));
      const ny = p.y + step;
      if (!tankCollidesMap(p.x, ny, p.w, p.h)) {
        p.y = ny;
      }
      return; // ← фикс прыжка
    }
    p.y = target;
  } else {
    const target = Math.round(p.x / TILE) * TILE;
    const diff = target - p.x;

    if (Math.abs(diff) > 0.5) {
      const step = Math.sign(diff) * Math.min(CONFIG.PLAYER.SNAP_SPEED * dt, Math.abs(diff));
      const nx = p.x + step;
      if (!tankCollidesMap(nx, p.y, p.w, p.h)) {
        p.x = nx;
      }
      return; // ← фикс прыжка
    }
    p.x = target;
  }

  // 2) ОСНОВНОЕ движение
  let dx = 0, dy = 0;
  if (p.dir === 'left') dx = -1;
  else if (p.dir === 'right') dx = 1;
  else if (p.dir === 'up') dy = -1;
  else if (p.dir === 'down') dy = 1;

  const nx = p.x + dx * p.speed * dt;
  const ny = p.y + dy * p.speed * dt;

  if (dx !== 0) {
    if (!tankCollidesMap(nx, p.y, p.w, p.h)) p.x = nx;
  }
  if (dy !== 0) {
    if (!tankCollidesMap(p.x, ny, p.w, p.h)) p.y = ny;
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

  let bx, by, dx = 0, dy = 0;
  const half = BULLET_SIZE / 2;

  switch (p.dir) {
    case 'left':
      dx = -1; bx = p.x - half;        by = cy - half; break;
    case 'right':
      dx = 1;  bx = p.x + p.w - half;  by = cy - half; break;
    case 'up':
      dy = -1; bx = cx - half;         by = p.y - half; break;
    case 'down':
      dy = 1;  bx = cx - half;         by = p.y + p.h - half; break;
  }

  state.bullets.push({
    x: bx, y: by,
    w: BULLET_SIZE, h: BULLET_SIZE,
    dx, dy,
    speed: BULLET_SPEED,
    owner: 'player',
  });
}

// ---------------------------------------------------------------------
// BULLET × BRICK — ФИКС: рушим половину в направлении пули
//   sub[0]=TL, sub[1]=TR, sub[2]=BL, sub[3]=BR
// ---------------------------------------------------------------------
function hitBrick(cx, cy, bullet) {
  const tile = state.map[cy][cx];
  if (!tile || tile.type !== 'brick') return;

  let toBreak = [];

  if (bullet.dy < 0) {
    // Летит вверх → рушим НИЖНИЙ ряд
    toBreak = [2, 3];
  } else if (bullet.dy > 0) {
    // Летит вниз → рушим ВЕРХНИЙ ряд
    toBreak = [0, 1];
  } else if (bullet.dx < 0) {
    // Летит влево → рушим ПРАВЫЙ столбец
    toBreak = [1, 3];
  } else if (bullet.dx > 0) {
    // Летит вправо → рушим ЛЕВЫЙ столбец
    toBreak = [0, 2];
  }

  for (const i of toBreak) {
    tile.sub[i] = 0;
  }

  if (tile.sub.every(s => s === 0)) {
    state.map[cy][cx] = null;
  }
}

// Проверка попадания пули. Возвращает true если пуля остановилась.
function bulletHitWorld(bullet) {
  const { TILE, GRID } = CONFIG;

  if (bullet.x < 0 || bullet.y < 0 ||
      bullet.x + bullet.w > W || bullet.y + bullet.h > W) {
    return true;
  }

  if (state.base && state.base.alive) {
    const bx = state.base.x * TILE;
    const by = state.base.y * TILE;
    const bs = TILE * 2;
    if (aabb(bullet, { x: bx, y: by, w: bs, h: bs })) {
      state.base.alive = false;
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

      if (t.type === 'brick') {
        hitBrick(cx, cy, bullet);
        return true;
      }
      if (t.type === 'steel') {
        return true;
      }
      // water / trees — пролетает
    }
  }

  return false;
}

function updateBullets(dt) {
  const alive = [];
  for (const b of state.bullets) {
    b.x += b.dx * b.speed * dt;
    b.y += b.dy * b.speed * dt;

    if (bulletHitWorld(b)) continue;
    alive.push(b);
  }
  state.bullets = alive;
}

// ---------------------------------------------------------------------
// UPDATE
// ---------------------------------------------------------------------
function update(dtMs) {
  const dt = dtMs / 1000;
  updatePlayer(dt);
  updateBullets(dt);
}

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
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.fillStyle = P.treesLight;
  for (const [cx, cy, r] of clusters) {
    ctx.beginPath();
    ctx.arc(cx - r * 0.25, cy - r * 0.25, r * 0.45, 0, Math.PI * 2);
    ctx.fill();
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
// RENDER — танк и пули
// ---------------------------------------------------------------------
function drawPlayerTank(t) {
  const { TILE, PALETTE: P } = CONFIG;
  const cx = t.x + t.w / 2;
  const cy = t.y + t.h / 2;

  ctx.save();
  ctx.translate(cx, cy);

  let angle = 0;
  if (t.dir === 'right') angle = Math.PI / 2;
  else if (t.dir === 'down') angle = Math.PI;
  else if (t.dir === 'left') angle = -Math.PI / 2;
  ctx.rotate(angle);

  const s = TILE;
  const half = s / 2;

  // Гусеницы
  ctx.fillStyle = P.playerTrack;
  ctx.fillRect(-half, -half, 5, s);
  ctx.fillRect(half - 5, -half, 5, s);

  ctx.fillStyle = P.playerTrackLight;
  for (let y = -half + 2; y < half - 1; y += 5) {
    ctx.fillRect(-half + 1, y, 3, 2);
    ctx.fillRect(half - 4, y, 3, 2);
  }

  // Корпус
  ctx.fillStyle = P.playerBody;
  ctx.fillRect(-half + 5, -half + 2, s - 10, s - 4);

  ctx.fillStyle = P.playerBodyLight;
  ctx.fillRect(-half + 5, -half + 2, s - 10, 3);

  // Башня
  ctx.fillStyle = P.playerTurret;
  ctx.fillRect(-7, -5, 14, 12);

  ctx.fillStyle = P.playerBodyLight;
  ctx.fillRect(-5, -3, 10, 3);

  // Ствол
  ctx.fillStyle = P.playerBarrel;
  ctx.fillRect(-2, -half - 2, 4, 9);

  ctx.restore();
}

function drawBullet(b) {
  const P = CONFIG.PALETTE;
  ctx.save();
  ctx.shadowColor = P.bulletGlow;
  ctx.shadowBlur = 8;
  ctx.fillStyle = P.bullet;
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

  // 3. Игрок и пули
  if (state.player && state.player.alive) drawPlayerTank(state.player);
  for (const b of state.bullets) drawBullet(b);

  // 4. Кусты поверх танка
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
  state.enemiesTotal = 0;
  state.enemiesKilled = 0;
  state.build = { speed: 1, armor: 1, reload: 1, damage: 1 };
  state.bullets = [];

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

function gameOver(_reason) {
  state.isRunning = false;
  if (state.animId) cancelAnimationFrame(state.animId);

  overlayTitle.textContent = '💥 Игра окончена';
  overlayText.innerHTML =
    `Уровень: <b>${state.level}</b><br>` +
    `Очки: <b>${state.score}</b><br>` +
    `Уничтожено врагов: <b>${state.enemiesKilled}</b>`;
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
  updateHUD();
  render();
})();