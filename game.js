// =====================================================================
// 🎮 Battle City — Стальные коты
// Step 2: карта и препятствия
// =====================================================================

// ---------------------------------------------------------------------
// CONFIG
// ---------------------------------------------------------------------
const CONFIG = {
  TILE: 28,
  GRID: 17,

  FPS: 60,
  STEP_MS: 1000 / 60,

  // Насколько видна фоновая сетка (0 = совсем нет)
  GRID_ALPHA: 0.025,

  PALETTE: {
    bg:         '#0a0612',

    // Кирпич
    brick:      '#b8543a',
    brickLight: '#d96a4a',
    brickDark:  '#6e2c1c',

    // Сталь
    steel:      '#c8c8d2',
    steelLight: '#f0f0f5',
    steelDark:  '#6e6e7a',

    // Вода
    water:      '#1e4f9e',
    waterLight: '#5c94e8',
    waterDeep:  '#0d2c5e',

    // Кусты
    trees:      '#2d7a3a',
    treesLight: '#4aa85a',
    treesDark:  '#123a1c',

    // База
    base:       '#ffd24a',
    baseLight:  '#fff0a8',
    baseDark:   '#7a5210',
    baseBg:     '#2a1a05',
  },
};

const W = CONFIG.TILE * CONFIG.GRID; // 476

// ---------------------------------------------------------------------
// LEVELS — карты уровней
//   B — brick    (кирпич)
//   S — steel    (сталь)
//   W — water    (вода)
//   T — trees    (кусты)
//   . — empty    (пусто)
//   База задаётся отдельным полем base: {x, y} — левый верхний угол 2×2
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

  // 🆕 Карта
  levelData: null,
  map: null,          // 2D-массив тайлов [y][x]
  base: null,         // { x, y, alive }
};

// ---------------------------------------------------------------------
// MAP — загрузка уровня из шаблона
// ---------------------------------------------------------------------
function loadLevel(index) {
  const level = LEVELS[index % LEVELS.length];
  state.levelData = level;

  // База
  state.base = {
    x: level.base.x,
    y: level.base.y,
    alive: true,
  };

  // Карта
  state.map = [];
  for (let y = 0; y < CONFIG.GRID; y++) {
    const row = [];
    const line = level.map[y] || '';

    for (let x = 0; x < CONFIG.GRID; x++) {
      const ch = line[x] || '.';
      let tile = null;

      switch (ch) {
        case 'B':
          // sub[] — 4 подъячейки: [TL, TR, BL, BR] (1 = целая, 0 = разрушена)
          tile = { type: 'brick', sub: [1, 1, 1, 1] };
          break;
        case 'S':
          tile = { type: 'steel' };
          break;
        case 'W':
          tile = { type: 'water' };
          break;
        case 'T':
          tile = { type: 'trees' };
          break;
        // '.' → null (пусто)
      }

      row.push(tile);
    }
    state.map.push(row);
  }

  // Очищаем область базы — там не должно быть тайлов
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

// Проверка: попадает ли клетка (x, y) в область базы 2×2
function isBaseCell(x, y) {
  if (!state.base) return false;
  return x >= state.base.x && x < state.base.x + 2 &&
         y >= state.base.y && y < state.base.y + 2;
}

// ---------------------------------------------------------------------
// RENDER — рисование
// ---------------------------------------------------------------------

// Фон + едва заметная сетка
function drawField() {
  ctx.fillStyle = CONFIG.PALETTE.bg;
  ctx.fillRect(0, 0, W, W);

  if (CONFIG.GRID_ALPHA > 0) {
    ctx.strokeStyle = `rgba(255, 183, 224, ${CONFIG.GRID_ALPHA})`;
    ctx.lineWidth = 1;
    for (let i = 0; i <= CONFIG.GRID; i++) {
      const p = i * CONFIG.TILE + 0.5;
      ctx.beginPath();
      ctx.moveTo(p, 0); ctx.lineTo(p, W);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, p); ctx.lineTo(W, p);
      ctx.stroke();
    }
  }
}

// --- Кирпич ---
function drawBrickSub(sx, sy, size) {
  const P = CONFIG.PALETTE;

  // Фон-шов
  ctx.fillStyle = P.brickDark;
  ctx.fillRect(sx, sy, size, size);

  // Светлый верхний блок
  const pad = 1;
  const w = size - pad * 2;
  const h = size - pad * 2;

  ctx.fillStyle = P.brick;
  ctx.fillRect(sx + pad, sy + pad, w, h);

  // Верхний блик
  ctx.fillStyle = P.brickLight;
  ctx.fillRect(sx + pad, sy + pad, w, 2);

  // Горизонтальный шов посередине
  ctx.fillStyle = P.brickDark;
  ctx.fillRect(sx, sy + size / 2 - 1, size, 2);
}

function drawBrick(x, y, sub) {
  const { TILE } = CONFIG;
  const px = x * TILE;
  const py = y * TILE;
  const half = TILE / 2;

  // 4 подъячейки: 0=TL, 1=TR, 2=BL, 3=BR
  const positions = [
    [px,        py       ], // TL
    [px + half, py       ], // TR
    [px,        py + half], // BL
    [px + half, py + half], // BR
  ];

  for (let i = 0; i < 4; i++) {
    if (sub[i]) {
      drawBrickSub(positions[i][0], positions[i][1], half);
    }
  }
}

// --- Сталь ---
function drawSteel(x, y) {
  const { TILE, PALETTE: P } = CONFIG;
  const px = x * TILE;
  const py = y * TILE;

  // Фон
  ctx.fillStyle = P.steelDark;
  ctx.fillRect(px, py, TILE, TILE);

  // Металлический блок (2×2 подблока с бликом)
  const pad = 1;
  const s = TILE / 2;

  for (let i = 0; i < 4; i++) {
    const dx = (i % 2) * s;
    const dy = Math.floor(i / 2) * s;

    // Основной блок
    ctx.fillStyle = P.steel;
    ctx.fillRect(px + dx + pad, py + dy + pad, s - pad * 2, s - pad * 2);

    // Верхний блик
    ctx.fillStyle = P.steelLight;
    ctx.fillRect(px + dx + pad, py + dy + pad, s - pad * 2, 2);

    // Левый блик
    ctx.fillRect(px + dx + pad, py + dy + pad, 2, s - pad * 2);

    // Нижняя тень
    ctx.fillStyle = P.steelDark;
    ctx.fillRect(px + dx + pad, py + dy + s - pad - 2, s - pad * 2, 2);
  }
}

// --- Вода ---
let waterPhase = 0;
function drawWater(x, y) {
  const { TILE, PALETTE: P } = CONFIG;
  const px = x * TILE;
  const py = y * TILE;

  // Фон
  ctx.fillStyle = P.water;
  ctx.fillRect(px, py, TILE, TILE);

  // Волны — 3 горизонтальные полосы, фаза сдвигается
  const phase = Math.floor(waterPhase);
  const waveColor = P.waterLight;
  const deepColor = P.waterDeep;

  ctx.fillStyle = deepColor;
  ctx.fillRect(px, py + TILE / 2 - 1, TILE, 2);

  ctx.fillStyle = waveColor;
  // Верхняя волна
  const y1 = py + 6 + (phase % 2 === 0 ? 0 : 2);
  ctx.fillRect(px + 4, y1, TILE - 8, 2);

  // Нижняя волна
  const y2 = py + TILE - 8 - (phase % 2 === 0 ? 0 : 2);
  ctx.fillRect(px + 4, y2, TILE - 8, 2);

  // Блики
  ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
  ctx.fillRect(px + 6, y1 - 2, 4, 1);
  ctx.fillRect(px + TILE - 10, y2 - 2, 4, 1);
}

// --- Кусты ---
function drawTrees(x, y) {
  const { TILE, PALETTE: P } = CONFIG;
  const px = x * TILE;
  const py = y * TILE;

  // Фон
  ctx.fillStyle = P.treesDark;
  ctx.fillRect(px, py, TILE, TILE);

  // Кластеры листвы — маленькие круги
  const R = TILE / 7;

  const clusters = [
    [px + TILE * 0.25, py + TILE * 0.30, R * 1.3],
    [px + TILE * 0.70, py + TILE * 0.30, R * 1.2],
    [px + TILE * 0.35, py + TILE * 0.70, R * 1.25],
    [px + TILE * 0.75, py + TILE * 0.72, R * 1.15],
  ];

  // Тёмный слой
  ctx.fillStyle = P.trees;
  for (const [cx, cy, r] of clusters) {
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
  }

  // Светлые пятнышки
  ctx.fillStyle = P.treesLight;
  for (const [cx, cy, r] of clusters) {
    ctx.beginPath();
    ctx.arc(cx - r * 0.25, cy - r * 0.25, r * 0.45, 0, Math.PI * 2);
    ctx.fill();
  }
}

// --- База 2×2 ---
function drawBase() {
  if (!state.base || !state.base.alive) return;

  const { TILE, PALETTE: P } = CONFIG;
  const px = state.base.x * TILE;
  const py = state.base.y * TILE;
  const size = TILE * 2;

  // Фон базы
  ctx.fillStyle = P.baseBg;
  ctx.fillRect(px, py, size, size);

  // Двойная рамка
  ctx.strokeStyle = P.baseDark;
  ctx.lineWidth = 2;
  ctx.strokeRect(px + 1, py + 1, size - 2, size - 2);

  ctx.strokeStyle = P.base;
  ctx.lineWidth = 1.5;
  ctx.strokeRect(px + 3.5, py + 3.5, size - 7, size - 7);

  // Орёл 🦅
  ctx.save();
  ctx.font = `${size * 0.72}px serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = P.baseLight;
  ctx.shadowBlur = 10;
  ctx.fillText('🦅', px + size / 2, py + size / 2 + 2);
  ctx.restore();
}

// Диспетчер тайла
function drawTile(tile, x, y) {
  if (!tile) return;
  switch (tile.type) {
    case 'brick': drawBrick(x, y, tile.sub); break;
    case 'steel': drawSteel(x, y); break;
    case 'water': drawWater(x, y); break;
    case 'trees': drawTrees(x, y); break;
  }
}

// --- Полный кадр ---
function render() {
  drawField();

  // Слой 1: земля (кирпич, сталь, вода) — БЕЗ кустов
  if (state.map) {
    for (let y = 0; y < CONFIG.GRID; y++) {
      for (let x = 0; x < CONFIG.GRID; x++) {
        const t = state.map[y][x];
        if (t && t.type !== 'trees') {
          drawTile(t, x, y);
        }
      }
    }
  }

  // Слой 2: база
  drawBase();

  // Слой 3: кусты (поверх земли и базы — но под танками в след. шагах)
  if (state.map) {
    for (let y = 0; y < CONFIG.GRID; y++) {
      for (let x = 0; x < CONFIG.GRID; x++) {
        const t = state.map[y][x];
        if (t && t.type === 'trees') {
          drawTrees(x, y);
        }
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

    // Фаза воды для анимации — не зависит от фикс. шага
    waterPhase = (waterPhase + delta / 220) % 4;
  }

  render();

  state.animId = requestAnimationFrame(loop);
}

// ---------------------------------------------------------------------
// UPDATE
// ---------------------------------------------------------------------
function update(_dt) {
  // Логика танков, пуль, ИИ — в следующих шагах
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

  // 🆕 Загрузка карты
  loadLevel(state.level - 1);

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
// INPUT
// ---------------------------------------------------------------------
document.addEventListener('keydown', (e) => {
  if (e.code === 'Space' || e.key === ' ' ||
      e.key === 'p' || e.key === 'P' || e.key === 'з' || e.key === 'З') {
    e.preventDefault();
    if (!state.isRunning) startGame();
    else togglePause();
    return;
  }
});

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
  // Показываем карту сразу — за оверлеем, чтобы было видно до старта
  loadLevel(0);

  updateHUD();
  render();
})();