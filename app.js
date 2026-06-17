/* =============================================
   SIMULADOR DE METAS BANCARIAS – app.js (Premium Edition)
   ============================================= */

// --------------------------------------------------
// 1. DATOS BASE
// --------------------------------------------------
const GOALS_DATA = [
  { id: 1, peso: 10, rubro: 'Var SM V+A Soles y Dólares', meta: 300000, real: 876046.76, avance: 0, isMultiplicador: false, isStock: true },
  { id: 2, peso: 13, rubro: 'Facturación Pyme', meta: 2568000, real: 841274.57, avance: 0, isMultiplicador: false, isStock: false },
  { id: 3, peso: 10, rubro: 'Facturación Clientes Nuevos', meta: 385000, real: 58997.05, avance: 0, isMultiplicador: false, isStock: false },
  { id: 4, peso: 10, rubro: 'Seguros (Primas)', meta: 19600, real: 1508, avance: 0, isMultiplicador: false, isStock: false },
  { id: 5, peso: 12, rubro: 'Altas de Nóminas', meta: 89, real: 65, avance: 0, isMultiplicador: false, isStock: false },
  { id: 6, peso: 5, rubro: 'Acciones Comerciales (Afiliaciones)', meta: 12, real: 1, avance: 0, isMultiplicador: false, isStock: false },
  { id: 7, peso: 5, rubro: 'Acciones Comerciales (Altas)', meta: 1, real: 0, avance: 0, isMultiplicador: false, isStock: false },
  { id: 8, peso: 5, rubro: 'Contención Pyme', meta: 47589.056, real: 0, avance: 0, isMultiplicador: false, isStock: false },
  { id: 9, peso: 0, rubro: 'MultiplicaDOR RCP', meta: 0, real: 0, avance: 0, isMultiplicador: true, isStock: false },
  { id: 10, peso: 3, rubro: 'Solución Pyme', meta: 1479900, real: 0, avance: 0, isMultiplicador: false, isStock: false },
  { id: 11, peso: 10, rubro: 'POS (puntos)', meta: 6, real: 0, avance: 0, isMultiplicador: false, isStock: false },
  { id: 12, peso: 8, rubro: 'Efectividad de Contención', meta: 49068.956, real: 0, avance: 0, isMultiplicador: false, isStock: false },
  { id: 13, peso: 9, rubro: 'Flujos QR Empresa', meta: 54749, real: 0, avance: 0, isMultiplicador: false, isStock: false },
  { id: 14, peso: 8, rubro: 'Var. SM Inversión Rentable', meta: 419000, real: -44197.36, avance: 0, isMultiplicador: false, isStock: true },
];

const TOTAL_DAYS = 30;
let currentSimDay = 16;
let goals = GOALS_DATA.map(g => ({ ...g }));

// --------------------------------------------------
// 2. UTILIDADES
// --------------------------------------------------
function fmt(n, decimals = 2) {
  if (n === null || n === undefined || isNaN(n)) return '0,00';
  return n.toLocaleString('es-PE', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}
function fmtPct(n) { return n.toFixed(2) + ' %'; }
function clamp(v, min, max) { return Math.min(max, Math.max(min, v)); }

function calcConsecucion(goal) {
  if (goal.meta === 0) return 0;
  const totalReal = goal.real + (goal.avance || 0);
  return Math.max(0, (totalReal / goal.meta) * 100);
}

function calcReconocimiento(cons) {
  if (cons < 90) return 0;
  if (cons <= 100) return cons;
  if (cons <= 120) return 100 + (cons - 100) * 2;
  if (cons <= 140) return 100 + 40 + (cons - 120) * 3;
  return 200;
}

function calcReconocimientoStock(cons) {
  if (cons < 99) return 0;
  if (cons <= 110) return 90 + (cons - 99) * 10;
  return 200;
}

function getReconocimiento(goal) {
  if (goal.isMultiplicador || goal.meta === 0) return 0;
  const cons = calcConsecucion(goal);
  return goal.isStock ? calcReconocimientoStock(Math.min(cons, 110)) : calcReconocimiento(Math.min(cons, 200));
}

function calcPuntamat(goal) {
  const recono = getReconocimiento(goal);
  return parseFloat((goal.peso * (recono / 100)).toFixed(2));
}

function proyectarAlMes(realActual, dia) {
  if (dia === 0) return 0;
  return (realActual / dia) * TOTAL_DAYS;
}

function gradientByCons(pct) {
  if (pct >= 140) return 'linear-gradient(90deg, #0ea5e9, #38bdf8)'; // Cyan
  if (pct >= 100) return 'linear-gradient(90deg, #10b981, #34d399)'; // Green
  if (pct >= 90)  return 'linear-gradient(90deg, #f59e0b, #fbbf24)'; // Yellow
  if (pct > 0)    return 'linear-gradient(90deg, #3b82f6, #60a5fa)'; // Blue
  return 'linear-gradient(90deg, #ef4444, #f87171)';                 // Red
}

function bbvaRangeLabel(cons, isStock) {
  if (isStock) {
    if (cons < 99)  return { label: 'No activa', cls: 'rl-off' };
    if (cons < 110) return { label: 'Stock Acel.', cls: 'rl-2x' };
    return { label: 'Stock 200%', cls: 'rl-200' };
  }
  if (cons < 90)  return { label: 'No activa', cls: 'rl-off' };
  if (cons <= 100) return { label: 'Lineal', cls: 'rl-lin' };
  if (cons <= 120) return { label: 'Acel. 2×', cls: 'rl-2x' };
  if (cons <= 140) return { label: 'Acel. 3×', cls: 'rl-3x' };
  return { label: 'Directo 200%', cls: 'rl-200' };
}

// --------------------------------------------------
// 3. RENDER TABLA
// --------------------------------------------------
function renderTable() {
  const tbody = document.getElementById('goals-tbody');
  tbody.innerHTML = '';
  let totalPts = 0;

  goals.forEach(goal => {
    const cons   = calcConsecucion(goal);
    const recono = getReconocimiento(goal);
    const pts    = calcPuntamat(goal);
    totalPts    += pts;

    const totalReal = goal.real + (goal.avance || 0);
    const proyectado = proyectarAlMes(totalReal, currentSimDay);
    const consProy   = goal.meta > 0 ? Math.max(0, (proyectado / goal.meta) * 100) : 0;
    
    const barWidth = clamp(cons, 0, 100);
    const { label: rangeLabel, cls: rangeCls } = bbvaRangeLabel(cons, goal.isStock);

    const consClass = cons >= 90 ? (cons >= 100 ? 'high' : 'mid') : 'low';
    const proyColor = consProy >= 100 ? 'var(--color-green)' : consProy >= 90 ? 'var(--color-yellow)' : 'var(--color-red)';

    const stockBadge = goal.isStock ? '<span class="sm-tag">SM</span>' : '';
    const multBadge  = goal.isMultiplicador ? '<span class="mult-tag">MULT</span>' : '';

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><span class="peso-badge" style="background:rgba(255,255,255,0.1);color:var(--text-main)">${goal.peso}</span></td>
      <td class="td-rubro">${goal.rubro}${stockBadge}${multBadge}</td>
      <td class="td-meta">${goal.meta === 0 ? '—' : fmt(goal.meta, goal.meta < 100 ? 0 : 2)}</td>
      <td class="td-real">
        <div class="inline-input-wrapper">
          <input type="number" class="inline-input" data-id="${goal.id}" data-field="real" value="${goal.real}" step="any" />
        </div>
      </td>
      <td class="td-avance">
        <div class="inline-input-wrapper">
          <input type="number" class="inline-input" data-id="${goal.id}" data-field="avance" value="${goal.avance || 0}" step="any" style="color:var(--color-green);border-color:var(--color-green)" />
        </div>
      </td>
      <td class="td-proyectado" style="color:${proyColor}">
        ${goal.meta === 0 ? '—' : fmt(proyectado)}
        <span class="proy-pct">${goal.meta === 0 ? '' : fmtPct(consProy)}</span>
      </td>
      <td><span class="cons-badge ${consClass}">${goal.meta === 0 ? '—' : fmtPct(cons)}</span></td>
      <td class="td-recono">
        ${goal.meta === 0 || goal.isMultiplicador ? '<span style="color:var(--text-faded)">—</span>' : `
          <div class="recono-val">${fmtPct(recono)}</div>
          <span class="recono-label ${rangeCls}">${rangeLabel}</span>
        `}
      </td>
      <td>
        <div class="progress-wrap">
          <div class="progress-fill" style="width:${barWidth}%;background:${gradientByCons(cons)}"></div>
        </div>
      </td>
      <td class="td-pts" style="color:${pts > 0 ? 'var(--color-green)' : 'var(--text-faded)'}">${fmt(pts)}</td>
    `;
    tbody.appendChild(tr);
  });

  document.getElementById('total-pts').textContent = fmt(totalPts);
  document.getElementById('pts-matricula').textContent = fmt(totalPts);

  const minBadge = document.getElementById('min-pts-badge');
  minBadge.style.color = totalPts >= 75 ? 'var(--color-green)' : 'var(--color-red)';
  minBadge.textContent = totalPts >= 75 ? '✅ Supera mínimo (75 pts)' : `⚠️ Faltan ${fmt(75 - totalPts)} pts para matrícula`;

  // Listeners para edición inline
  document.querySelectorAll('.inline-input').forEach(input => {
    input.addEventListener('change', (e) => {
      const id = parseInt(e.target.dataset.id);
      const field = e.target.dataset.field; // "real" o "avance"
      const val = parseFloat(e.target.value);
      const goal = goals.find(g => g.id === id);
      if (goal && !isNaN(val)) {
        goal[field] = val;
        saveToStorage();
        updateAll();
      }
    });
    // Seleccionar todo el texto al hacer focus para edición más rápida
    input.addEventListener('focus', (e) => e.target.select());
  });
}

// --------------------------------------------------
// 4. SUMMARY CARDS
// --------------------------------------------------
function renderSummaryCards() {
  const container = document.getElementById('summary-cards');
  container.innerHTML = '';

  const activeGoals = goals.filter(g => !g.isMultiplicador && g.meta > 0);
  
  // Mostrar solo las 4 metas principales (mayor peso)
  const topGoals = [...activeGoals].sort((a,b) => b.peso - a.peso).slice(0, 4);

  topGoals.forEach(goal => {
    const cons = calcConsecucion(goal);
    const grad = gradientByCons(cons);
    const barW = clamp(cons, 0, 100);

    const card = document.createElement('div');
    card.className = 'sum-card';
    card.innerHTML = `
      <div class="sum-card-glow" style="background:${grad}"></div>
      <div class="sc-title">${goal.rubro}</div>
      <div class="sc-value-row">
        <div class="sc-pct text-gradient" style="background:${grad}; -webkit-background-clip: text;">${fmtPct(cons)}</div>
      </div>
      <div class="sc-real">Simulado: ${fmt(goal.real + (goal.avance || 0))} / Meta: ${fmt(goal.meta, 0)}</div>
      <div class="sc-bar-bg">
        <div class="sc-bar-fill" style="width:${barW}%; background:${grad}"></div>
      </div>
    `;
    container.appendChild(card);
  });
}

function updateKPIs(totalPts) {
  const goalsOver100 = goals.filter(g => !g.isMultiplicador && g.meta > 0 && calcConsecucion(g) >= 100).length;
  const totalActiveGoals = goals.filter(g => !g.isMultiplicador && g.meta > 0).length;
  const pctGoalsOver = (goalsOver100 / totalActiveGoals) * 100;

  let multiplicador = 0;
  if (pctGoalsOver >= 80) multiplicador = totalPts * 0.25;
  else if (pctGoalsOver >= 50) multiplicador = totalPts * 0.10;

  document.getElementById('pts-multiplicador').textContent = fmt(multiplicador);
}

// --------------------------------------------------
// 5. TIMELINE & PROJECTION
// --------------------------------------------------
function updateTimeline(day) {
  const pct = ((day - 1) / (TOTAL_DAYS - 1)) * 100;
  document.getElementById('slider-track-fill').style.width = pct + '%';
  document.getElementById('day-fraction').textContent = `Día ${day} de ${TOTAL_DAYS}`;
  document.getElementById('day-pct-label').textContent = `${pct.toFixed(1)}% del mes transcurrido`;
}

function updateProjectionPill(day) {
  const pill  = document.getElementById('projection-pill');
  const label = document.getElementById('projection-label');

  const activeGoals = goals.filter(g => !g.isMultiplicador && g.meta > 0);
  let goalsOnTrack  = 0;

  activeGoals.forEach(g => {
    const totalReal = g.real + (g.avance || 0);
    if (proyectarAlMes(totalReal, day) >= g.meta) goalsOnTrack++;
  });

  const pct = (goalsOnTrack / activeGoals.length) * 100;

  if (pct >= 70) {
    pill.style.background = 'rgba(16,185,129,0.15)';
    pill.style.color = 'var(--color-green)';
    label.textContent = `📈 ${goalsOnTrack}/${activeGoals.length} metas bien encaminadas`;
  } else if (pct >= 40) {
    pill.style.background = 'rgba(245,158,11,0.15)';
    pill.style.color = 'var(--color-yellow)';
    label.textContent = `⚠️ ${goalsOnTrack}/${activeGoals.length} metas bien encaminadas`;
  } else {
    pill.style.background = 'rgba(239,68,68,0.15)';
    pill.style.color = 'var(--color-red)';
    label.textContent = `🔴 ${goalsOnTrack}/${activeGoals.length} metas bien encaminadas`;
  }
}

// --------------------------------------------------
// 6. GENERAL UPDATER
// --------------------------------------------------
function updateAll() {
  renderTable();
  renderSummaryCards();
  updateTimeline(currentSimDay);
  updateProjectionPill(currentSimDay);
  showLastUpdate();
}

// --------------------------------------------------
// 7. STORAGE & CLOCK
// --------------------------------------------------
const LS_KEY   = 'metas_goals_premium';
const LS_DATE  = 'metas_lastupdate_premium';

function saveToStorage() {
  localStorage.setItem(LS_KEY, JSON.stringify(goals.map(g => ({ id: g.id, real: g.real, avance: g.avance }))));
  localStorage.setItem(LS_DATE, new Date().toISOString());
}

function loadFromStorage() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return false;
    JSON.parse(raw).forEach(s => {
      const g = goals.find(x => x.id === s.id);
      if (g) {
        if (s.real !== undefined) g.real = s.real;
        if (s.avance !== undefined) g.avance = s.avance;
      }
    });
    return true;
  } catch { return false; }
}

function showLastUpdate() {
  const badge = document.getElementById('last-update-badge');
  const text  = document.getElementById('last-update-text');
  const raw   = localStorage.getItem(LS_DATE);
  if (!raw) { badge.style.display = 'none'; return; }
  const d = new Date(raw);
  text.textContent = `Guardado: ${d.toLocaleTimeString('es-PE', {hour:'2-digit', minute:'2-digit'})}`;
  badge.style.display = 'flex';
}

function updateClock() {
  const now = new Date();
  document.getElementById('current-date').textContent = `Al ${now.toLocaleDateString('es-PE', {day:'2-digit', month:'2-digit', year:'numeric'})}`;
  document.getElementById('current-time').textContent = now.toLocaleTimeString('es-PE', {hour:'2-digit', minute:'2-digit', second:'2-digit'});
}

function resetData() {
  if (!confirm('¿Restablecer todos los valores a cero o a los por defecto?')) return;
  goals = GOALS_DATA.map(g => ({ ...g }));
  localStorage.removeItem(LS_KEY);
  localStorage.removeItem(LS_DATE);
  document.getElementById('last-update-badge').style.display = 'none';
  updateAll();
}

// --------------------------------------------------
// 8. LOOKER DRAWER
// --------------------------------------------------
const LS_URL = 'https://lookerstudio.google.com/embed/reporting/225582d5-e39b-4e5e-bdcb-f25cebd5ae71/page/p_oitiw9jc2d';

function toggleDrawer(open) {
  document.getElementById('ls-drawer').classList.toggle('open', open);
  document.getElementById('ls-backdrop').classList.toggle('active', open);
  document.body.style.overflow = open ? 'hidden' : '';
}

function loadLooker() {
  const iframe = document.getElementById('ls-iframe');
  document.getElementById('ls-login-notice').style.display = 'none';
  document.getElementById('ls-loading').style.display = 'flex';
  iframe.style.display = 'none';
  iframe.src = LS_URL;
  iframe.onload = () => {
    document.getElementById('ls-loading').style.display = 'none';
    iframe.style.display = 'block';
  };
}

// --------------------------------------------------
// INIT
// --------------------------------------------------
document.addEventListener('DOMContentLoaded', () => {
  loadFromStorage();
  updateAll();
  
  // Slider Events
  const slider = document.getElementById('sim-day');
  slider.addEventListener('input', () => {
    currentSimDay = parseInt(slider.value);
    updateAll();
  });

  // Clock
  updateClock();
  setInterval(updateClock, 1000);

  // Buttons
  document.getElementById('btn-reset').addEventListener('click', resetData);
  document.getElementById('btn-open-looker').addEventListener('click', () => toggleDrawer(true));
  document.getElementById('ls-btn-close').addEventListener('click', () => toggleDrawer(false));
  document.getElementById('ls-backdrop').addEventListener('click', () => toggleDrawer(false));
  document.getElementById('ls-btn-load').addEventListener('click', loadLooker);
  document.getElementById('ls-btn-refresh').addEventListener('click', loadLooker);

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') toggleDrawer(false);
  });
});
