// ============================================================================
// main.js — Víbora WebGL (versión sin cuadrícula, estilo más formal)
// ----------------------------------------------------------------------------
// Características principales:
//  - Tablero 20x20 (600px).
//  - Obstáculos que aumentan por nivel (nivel 1 sin obstáculos).
//  - La comida desaparece tras cierto tiempo y se recoloca (más difícil en niveles altos).
//  - Velocidad aumenta con los puntos.
//  - Diseño de víbora con cabeza diferenciada y ojos.
// ============================================================================

import { createGL, pushRect } from './gl.js';

// ---------------------- Configuración general ----------------------
const GRID = 20;                  // Número de celdas por fila/columna
const CELL = 30;                  // Tamaño en píxeles de cada celda
const GROW_PER_FOOD = 1;          // Crecimiento por cada comida

// Velocidades por nivel (celdas por segundo)
const SPEEDS = [8,8,10,10,14,14,16,16,18,20];

// Tiempo de vida de la comida según el nivel (mínimo 3s)
function foodTTL(level) { return Math.max(3, 9 - level); }

// Obstáculos: nivel 1 = 0; luego incrementa hasta 12
function obstaclesFor(level) { return Math.min(level - 1, 12); }

// ---------------------- Paleta de colores ----------------------
const COL_SNAKE      = [0.20, 0.95, 0.70, 1.0];   // cuerpo verde menta
const COL_HEAD       = [0.98, 0.86, 0.25, 1.0];   // cabeza ámbar
const COL_EYE        = [0.06, 0.10, 0.20, 1.0];   // ojos oscuros
const COL_FOOD       = [0.95, 0.35, 0.65, 1.0];   // comida rosa neón
const COL_OBS        = [0.50, 0.65, 1.0, 0.35];   // obstáculo (borde translúcido)
const COL_OBS_INNER  = [0.32, 0.55, 1.0, 0.85];   // obstáculo (interior sólido)

// ---------------------- Elementos del DOM ----------------------
const canvas       = document.getElementById('game');
const tint         = document.getElementById('tint');     // Capa extra decorativa
const tctx         = tint.getContext('2d');
const scoreEl      = document.getElementById('score');
const levelEl      = document.getElementById('level');
const speedEl      = document.getElementById('speed');
const foodTimerEl  = document.getElementById('foodTimer');
const btnPause     = document.getElementById('btnPause');
const btnReset     = document.getElementById('btnReset');
const overlay      = document.getElementById('overlay');
const modalTitle   = document.getElementById('modalTitle');
const modalText    = document.getElementById('modalText');
const modalBtn     = document.getElementById('modalBtn');

const { clear, drawRects, resize } = createGL(canvas);

// ---------------------- Estado ----------------------
let state = null;         // Estado completo del juego
let lastTime = 0;         // Tiempo del frame anterior
let accumulator = 0;      // Acumulador de tiempo para steps discretos

// ---------------------- Utilidades ----------------------
function randomCell(){ return { x: (Math.random()*GRID)|0, y: (Math.random()*GRID)|0 }; }
function cellsEqual(a,b){ return a.x===b.x && a.y===b.y; }
function cellInSnake(c){ return state.snake.some(s => cellsEqual(s,c)); }
function cellInObstacles(c){ return state.obstacles.some(o => cellsEqual(o,c)); }
function freeRandomCell(){
  // Devuelve una celda libre de serpiente y obstáculos
  let c; do { c = randomCell(); } while (cellInSnake(c) || cellInObstacles(c));
  return c;
}

// ---------------------- Comida ----------------------
function regenFoodTimer(){ state.foodTTL = foodTTL(state.level); state.foodTimer = state.foodTTL; }
function placeFood(){ state.food = freeRandomCell(); regenFoodTimer(); }
function tickFoodTimer(dt){ state.foodTimer -= dt; if (state.foodTimer <= 0) placeFood(); }

// ---------------------- Obstáculos ----------------------
function buildObstacles(level){
  const n = obstaclesFor(level), obs = [];
  for (let i=0;i<n;i++){
    let c;
    do { c = randomCell(); }
    while (cellInSnake(c) || (state.food && cellsEqual(c,state.food)) || obs.some(o=>cellsEqual(o,c)));
    obs.push(c);
  }
  return obs;
}

// ---------------------- Niveles y HUD ----------------------
function levelUpIfNeeded(){
  const newLevel = Math.min(1 + Math.floor(state.score/30), SPEEDS.length);
  if (newLevel !== state.level){
    state.level = newLevel;
    state.obstacles = buildObstacles(state.level);
  }
}
function updateHUD(){
  scoreEl.textContent = state.score;
  levelEl.textContent = state.level;
  const cps = SPEEDS[Math.min(state.level-1, SPEEDS.length-1)];
  speedEl.textContent = String(cps);
  foodTimerEl.textContent = String(Math.ceil(state.foodTimer));
}

// ---------------------- Inicio de juego ----------------------
function newGame(){
  state = {
    dir:{x:1,y:0}, nextDir:{x:1,y:0},
    snake:[{x:5,y:10},{x:4,y:10},{x:3,y:10}],
    grow:0,
    food:{x:0,y:0}, foodTTL:8, foodTimer:8,
    score:0, level:1,
    obstacles:[],
    playing:true, over:false, paused:false,
  };
  state.obstacles = buildObstacles(state.level);
  placeFood();
  updateHUD();
  drawTint();
  hideOverlay();
}

// ---------------------- Movimiento ----------------------
function step(){
  // Evitar reversa inmediata
  const nd = state.nextDir;
  if (!(nd.x === -state.dir.x && nd.y === -state.dir.y)) state.dir = nd;

  const head = state.snake[0];
  const nx = head.x + state.dir.x, ny = head.y + state.dir.y;

  // Colisión con paredes
  if (nx<0 || ny<0 || nx>=GRID || ny>=GRID) return gameOver();
  const newHead = {x:nx,y:ny};

  // Colisión con obstáculos o cuerpo
  if (cellInObstacles(newHead) || state.snake.some(s => cellsEqual(s,newHead))) return gameOver();

  // Avanzar
  state.snake.unshift(newHead);

  // Comer
  if (cellsEqual(newHead, state.food)){
    state.score += 10;
    state.grow  += GROW_PER_FOOD;
    levelUpIfNeeded();
    placeFood();
    updateHUD();
  }

  // Crecer o mover cola
  if (state.grow>0) state.grow--; else state.snake.pop();
}

// ---------------------- Estados especiales ----------------------
function gameOver(){
  state.playing = false; state.over = true;
  showOverlay('¡Game Over!', `Puntaje: <b>${state.score}</b><br/>Presiona <b>R</b> para reiniciar.`, 'Reiniciar');
}
function togglePause(force){
  if (state.over) return;
  const willPause = (typeof force==='boolean') ? force : !state.paused;
  state.paused = willPause;
  willPause
    ? showOverlay('Juego en pausa','Presiona <b>P</b> para continuar.','Continuar')
    : hideOverlay();
}

// ---------------------- Render (sin cuadrícula) ----------------------
function drawTint(){
  // Capa 2D encima del canvas (decoración ligera)
  const g = tctx.createLinearGradient(0,0,600,600);
  g.addColorStop(0, 'rgba(35,100,255,0.08)');
  g.addColorStop(1, 'rgba(255,60,180,0.04)');
  tctx.clearRect(0,0,600,600);
  tctx.fillStyle = g;
  tctx.fillRect(0,0,600,600);
}

function render(){
  clear(); resize();

  // Obstáculos
  if (state.obstacles.length){
    const o = [];
    for (const c of state.obstacles) pushRect(o, c.x*CELL+1, c.y*CELL+1, CELL-2, CELL-2);
    drawRects(o, COL_OBS);

    const o2 = [];
    for (const c of state.obstacles) pushRect(o2, c.x*CELL+6, c.y*CELL+6, CELL-12, CELL-12);
    drawRects(o2, COL_OBS_INNER);
  }

  // Comida
  const fx = state.food.x * CELL, fy = state.food.y * CELL;
  const f1 = []; pushRect(f1, fx+5, fy+5, CELL-10, CELL-10); drawRects(f1, COL_FOOD);
  const f2 = []; pushRect(f2, fx+11, fy+11, CELL-22, CELL-22); drawRects(f2, [1,0.92,0.98,0.9]);

  // Cuerpo
  const body = [];
  for (let i=1;i<state.snake.length;i++){
    const c = state.snake[i];
    pushRect(body, c.x*CELL+3, c.y*CELL+3, CELL-6, CELL-6);
  }
  drawRects(body, COL_SNAKE);

  // Cabeza
  const h = state.snake[0];
  const head = []; pushRect(head, h.x*CELL+2, h.y*CELL+2, CELL-4, CELL-4);
  drawRects(head, COL_HEAD);

  // Ojos
  const eyes = [];
  const exOff = state.dir.x ? (state.dir.x>0 ? 8 : -8) : 0;
  const eyOff = state.dir.y ? (state.dir.y>0 ? 8 : -8) : 0;
  const hx = h.x*CELL + CELL/2, hy = h.y*CELL + CELL/2;
  pushRect(eyes, hx-7+exOff, hy-4+eyOff, 4, 4);
  pushRect(eyes, hx+3+exOff, hy-4+eyOff, 4, 4);
  drawRects(eyes, COL_EYE);
}

// ---------------------- Loop principal ----------------------
function loop(ts){
  if (!state) return;
  const dt = (ts - lastTime) / 1000; lastTime = ts;

  if (!state.paused && state.playing){
    const stepPerSec = SPEEDS[Math.min(state.level-1, SPEEDS.length-1)];
    accumulator += dt; const stepTime = 1/stepPerSec;
    while (accumulator >= stepTime){ step(); accumulator -= stepTime; }
    tickFoodTimer(dt);
  }

  updateHUD(); render();
  requestAnimationFrame(loop);
}

// ---------------------- Entradas ----------------------
window.addEventListener('keydown', (e)=>{
  const k=e.key.toLowerCase();
  if (k==='arrowup'||k==='w') state.nextDir = {x:0,y:-1};
  else if (k==='arrowdown'||k==='s') state.nextDir = {x:0,y:1};
  else if (k==='arrowleft'||k==='a') state.nextDir = {x:-1,y:0};
  else if (k==='arrowright'||k==='d') state.nextDir = {x:1,y:0};
  else if (k==='p') togglePause();
  else if (k==='r') newGame();
});
btnPause.addEventListener('click', ()=>togglePause());
btnReset.addEventListener('click', ()=>newGame());
modalBtn.addEventListener('click', ()=>{ if (state.over) newGame(); else togglePause(false); });

// ---------------------- Overlay ----------------------
function showOverlay(title, html, btnText){
  overlay.classList.remove('hidden');
  modalTitle.textContent = title;
  modalText.innerHTML = html;
  modalBtn.textContent = btnText;
}
function hideOverlay(){ overlay.classList.add('hidden'); }

// ---------------------- Inicio ----------------------
newGame();
requestAnimationFrame(t=>{ lastTime=t; requestAnimationFrame(loop); });
