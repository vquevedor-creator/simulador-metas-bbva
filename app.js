/* =============================================
   SIMULADOR DE METAS BANCARIAS – app.js
   Víctor Hugo Quevedo · EN-005448
   ============================================= */

// --------------------------------------------------
// 1. DATOS BASE (capturados de la imagen)
// --------------------------------------------------
const GOALS_DATA = [
  {
    id: 1,
    peso: 10,
    rubro: 'Var SM V+A Soles y Dólares',
    meta: 300000,
    real: 876046.76,
    isMultiplicador: false,
    isStock: true,   // Saldo Mensual → fórmula acelerada Stock
  },
  {
    id: 2,
    peso: 13,
    rubro: 'Facturación Pyme',
    meta: 2568000,
    real: 841274.57,
    isMultiplicador: false,
    isStock: false,
  },
  {
    id: 3,
    peso: 10,
    rubro: 'Facturación Clientes Nuevos',
    meta: 385000,
    real: 58997.05,
    isMultiplicador: false,
    isStock: false,
  },
  {
    id: 4,
    peso: 10,
    rubro: 'Seguros (Primas)',
    meta: 19600,
    real: 1508,
    isMultiplicador: false,
    isStock: false,
  },
  {
    id: 5,
    peso: 12,
    rubro: 'Altas de Nóminas',
    meta: 89,
    real: 65,
    isMultiplicador: false,
    isStock: false,
  },
  {
    id: 6,
    peso: 5,
    rubro: 'Acciones Comerciales (Afiliaciones)',
    meta: 12,
    real: 1,
    isMultiplicador: false,
    isStock: false,
  },
  {
    id: 7,
    peso: 5,
    rubro: 'Acciones Comerciales (Altas)',
    meta: 1,
    real: 0,
    isMultiplicador: false,
    isStock: false,
  },
  {
    id: 8,
    peso: 5,
    rubro: 'Contención Pyme',
    meta: 47589.056,
    real: 0,
    isMultiplicador: false,
    isStock: false,
  },
  {
    id: 9,
    peso: 0,
    rubro: 'MultiplicaDOR RCP',
    meta: 0,
    real: 0,
    isMultiplicador: true,
    isStock: false,
  },
  {
    id: 10,
    peso: 3,
    rubro: 'Solución Pyme',
    meta: 1479900,
    real: 0,
    isMultiplicador: false,
    isStock: false,
  },
  {
    id: 11,
    peso: 10,
    rubro: 'POS (puntos)',
    meta: 6,
    real: 0,
    isMultiplicador: false,
    isStock: false,
  },
  {
    id: 12,
    peso: 8,
    rubro: 'Efectividad de Contención',
    meta: 49068.956,
    real: 0,
    isMultiplicador: false,
    isStock: false,
  },
  {
    id: 13,
    peso: 9,
    rubro: 'Flujos QR Empresa',
    meta: 54749,
    real: 0,
    isMultiplicador: false,
    isStock: false,
  },
  {
    id: 14,
    peso: 8,
    rubro: 'Var. SM Inversión Rentable',
    meta: 419000,
    real: -44197.36,
    isMultiplicador: false,
    isStock: true,   // Saldo Mensual → fórmula acelerada Stock
  },
];

// Días hábiles totales y actuales (ajusta según tu banco)
const TOTAL_DAYS = 30;
let currentSimDay = 16; // día actual del mes

// Estado mutable
let goals = GOALS_DATA.map(g => ({ ...g }));
let editingId = null;

// --------------------------------------------------
// 2. UTILIDADES
// --------------------------------------------------
function fmt(n, decimals = 2) {
  if (n === null || n === undefined || isNaN(n)) return '0,00';
  return n.toLocaleString('es-PE', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

function fmtPct(n) {
  return n.toFixed(2) + ' %';
}

function clamp(v, min, max) {
  return Math.min(max, Math.max(min, v));
}

/**
 * BBVA 2025 – Consecución real (sin cap, puede superar 200%).
 * Se usa solo para mostrar el % frente a meta.
 */
function calcConsecucion(goal) {
  if (goal.meta === 0) return 0;
  const raw = (goal.real / goal.meta) * 100;
  return Math.max(0, raw); // nunca negativo en pantalla
}

/**
 * BBVA 2025 – Reconocimiento para indicadores NORMALES
 * • < 90%          → 0  (no activa)
 * • 90% – 100%     → Lineal  (reconocimiento = consecución)
 * • 100.1% – 120%  → Acelerada 2x:  100 + (exceso × 2)
 * • 120.1% – 140%  → Acelerada 3x:  100 + 40 + (exceso × 3)
 * • > 140%          → Directo 200%
 */
function calcReconocimiento(cons) {
  if (cons < 90)   return 0;
  if (cons <= 100) return cons;                                 // lineal
  if (cons <= 120) return 100 + (cons - 100) * 2;              // 2x
  if (cons <= 140) return 100 + 20 * 2 + (cons - 120) * 3;    // 3x  (máx en 140 = 200)
  return 200;                                                   // directo 200%
}

/**
 * BBVA 2025 – Reconocimiento para indicadores de SALDO (SM)
 * • < 99%           → 0  (no activa)
 * • 99% – 110%+     → Acelerador: 90 + (cons - 99) × 10
 *   - En 99%  →  90%
 *   - En 100% → 100%
 *   - En 105% → 150%
 *   - En 110% → 200%
 * • > 110%           → Directo 200%
 */
function calcReconocimientoStock(cons) {
  if (cons < 99)   return 0;
  if (cons <= 110) return 90 + (cons - 99) * 10;
  return 200;
}

/**
 * Obtiene el reconocimiento según el tipo de indicador.
 */
function getReconocimiento(goal) {
  if (goal.isMultiplicador || goal.meta === 0) return 0;
  const cons = calcConsecucion(goal);
  return goal.isStock
    ? calcReconocimientoStock(Math.min(cons, 110))
    : calcReconocimiento(Math.min(cons, 200));
}

/**
 * BBVA 2025 – PUNTAMAT = Peso × (Reconocimiento / 100)
 * Requiere mínimo 75 pts matrícula para activar pago (se indica en UI).
 */
function calcPuntamat(goal) {
  const recono = getReconocimiento(goal);
  return parseFloat((goal.peso * (recono / 100)).toFixed(2));
}

/**
 * Proyecta el valor REAL al final del mes basado en el ritmo actual.
 */
function proyectarAlMes(realActual, dia) {
  if (dia === 0) return 0;
  const ritmo = realActual / dia;
  return ritmo * TOTAL_DAYS;
}

/**
 * Devuelve color CSS según el RECONOCIMIENTO BBVA
 */
function colorByRecono(r) {
  if (r >= 200)  return 'var(--cyan)';
  if (r >= 100)  return 'var(--green)';
  if (r >= 90)   return 'var(--yellow)';
  if (r > 0)     return 'var(--yellow)';
  return 'var(--red)';
}

function colorByCons(pct) {
  if (pct >= 140) return 'var(--cyan)';
  if (pct >= 100) return 'var(--green)';
  if (pct >= 90)  return 'var(--yellow)';
  if (pct >= 50)  return 'var(--blue-main)';
  return 'var(--red)';
}

function gradientByCons(pct) {
  if (pct >= 140) return 'linear-gradient(90deg, #06b6d4, #22d3ee)';
  if (pct >= 100) return 'linear-gradient(90deg, #10b981, #34d399)';
  if (pct >= 90)  return 'linear-gradient(90deg, #f59e0b, #fbbf24)';
  if (pct >= 50)  return 'linear-gradient(90deg, #3b82f6, #60a5fa)';
  return 'linear-gradient(90deg, #ef4444, #f87171)';
}

/**
 * Etiqueta descriptiva del rango BBVA según consecución
 */
function bbvaRangeLabel(cons, isStock) {
  if (isStock) {
    if (cons < 99)  return { label: 'No activa ⚠️', cls: 'range-off' };
    if (cons < 110) return { label: 'Stock Acel. ⚡', cls: 'range-2x' };
    return { label: 'Stock 200% 🔥', cls: 'range-200' };
  }
  if (cons < 90)  return { label: 'No activa ⚠️', cls: 'range-off' };
  if (cons <= 100) return { label: 'Lineal 📈', cls: 'range-lin' };
  if (cons <= 120) return { label: 'Acel. 2× ⚡', cls: 'range-2x' };
  if (cons <= 140) return { label: 'Acel. 3× 🚀', cls: 'range-3x' };
  return { label: 'Directo 200% 🔥', cls: 'range-200' };
}

function pesoColor(peso) {
  if (peso >= 12) return { bg: 'rgba(239,68,68,0.15)', color: '#f87171' };
  if (peso >= 9)  return { bg: 'rgba(245,158,11,0.15)', color: '#fbbf24' };
  if (peso >= 5)  return { bg: 'rgba(59,130,246,0.15)', color: '#60a5fa' };
  return { bg: 'rgba(100,116,139,0.15)', color: '#94a3b8' };
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

    const proyectado  = proyectarAlMes(goal.real, currentSimDay);
    const consProy    = goal.meta > 0 ? Math.max(0, (proyectado / goal.meta) * 100) : 0;
    const reconoProy  = goal.isStock
      ? calcReconocimientoStock(Math.min(consProy, 110))
      : calcReconocimiento(Math.min(consProy, 200));

    const barWidth = clamp(cons, 0, 100);
    const { bg: pesoBg, color: pesoCol } = pesoColor(goal.peso);
    const { label: rangeLabel, cls: rangeCls } = bbvaRangeLabel(cons, goal.isStock);

    // Clases CSS consecución
    const consClass = cons >= 90 ? (cons >= 100 ? 'cons-high' : 'cons-mid') : 'cons-low';
    const ptsClass  = pts > 0 ? 'style="color:var(--green)"' : 'style="color:var(--text-muted)"';

    // Color reconocimiento
    const reconoColor = colorByRecono(recono);
    const proyColor   = reconoProy >= 100 ? 'var(--green)' : reconoProy >= 90 ? 'var(--yellow)' : 'var(--red)';

    // Badge isStock
    const stockBadge = goal.isStock
      ? ' <span style="font-size:0.6rem;color:var(--cyan);background:rgba(6,182,212,0.15);padding:2px 6px;border-radius:4px;border:1px solid rgba(6,182,212,0.3)">SM</span>'
      : '';
    const multBadge = goal.isMultiplicador
      ? ' <span style="font-size:0.65rem;color:var(--purple);background:rgba(139,92,246,0.15);padding:2px 6px;border-radius:4px;">MULT</span>'
      : '';

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="td-peso">
        <span class="peso-badge" style="background:${pesoBg};color:${pesoCol}">${goal.peso}</span>
      </td>
      <td class="td-rubro">${goal.rubro}${stockBadge}${multBadge}</td>
      <td class="td-meta">${goal.meta === 0 ? '—' : fmt(goal.meta, goal.meta < 100 ? 0 : 2)}</td>
      <td class="td-real" data-id="${goal.id}" title="Clic para editar">
        <span style="color:${goal.real < 0 ? 'var(--red)' : 'var(--blue-light)'}">${fmt(goal.real)}</span>
      </td>
      <td class="td-proyectado" style="color:${proyColor}">
        ${goal.meta === 0 ? '—' : fmt(proyectado)}
        <div style="font-size:0.65rem;color:${proyColor};opacity:0.8;margin-top:2px">${goal.meta === 0 ? '' : fmtPct(consProy)}</div>
      </td>
      <td class="td-cons">
        <span class="cons-badge ${consClass}">${goal.meta === 0 ? '—' : fmtPct(cons)}</span>
      </td>
      <td class="td-recono">
        ${goal.meta === 0 || goal.isMultiplicador ? '<span style="color:var(--text-muted)">—</span>' : `
          <div style="font-size:0.9rem;font-weight:800;color:${reconoColor}">${fmtPct(recono)}</div>
          <span class="range-badge ${rangeCls}">${rangeLabel}</span>
        `}
      </td>
      <td class="td-bar">
        <div class="progress-wrap">
          <div class="progress-fill" style="width:${barWidth}%;background:${gradientByCons(cons)}"></div>
        </div>
      </td>
      <td class="td-pts" ${ptsClass}>${fmt(pts)}</td>
    `;
    tbody.appendChild(tr);
  });

  document.getElementById('total-pts').textContent = fmt(totalPts);
  document.getElementById('pts-matricula').textContent = fmt(totalPts);

  // Indicador 75 pts
  const minBadge = document.getElementById('min-pts-badge');
  if (minBadge) {
    minBadge.style.color = totalPts >= 75 ? 'var(--green)' : '#f87171';
    minBadge.textContent = totalPts >= 75 ? '✅ Supera mínimo (75 pts)' : `⚠️ Faltan ${fmt(75 - totalPts)} pts para mínimo`;
  }

  // Listeners en celdas REAL
  tbody.querySelectorAll('.td-real').forEach(td => {
    td.addEventListener('click', () => openModal(parseInt(td.dataset.id)));
  });

  updateSummaryCards();
  updateKPIs(totalPts);
}

// --------------------------------------------------
// 4. SUMMARY CARDS
// --------------------------------------------------
function renderSummaryCards() {
  const container = document.getElementById('summary-cards');
  container.innerHTML = '';

  goals.filter(g => !g.isMultiplicador && g.meta > 0).forEach(goal => {
    const cons = calcConsecucion(goal);
    const color = colorByCons(cons);
    const grad  = gradientByCons(cons);
    const barW  = clamp(cons, 0, 100);

    const card = document.createElement('div');
    card.className = 'summary-card';
    card.style.cssText = `border-color: ${color}33;`;
    card.innerHTML = `
      <div style="position:absolute;top:0;left:0;right:0;height:3px;border-radius:3px 3px 0 0;background:${grad}"></div>
      <div class="sc-rubro">${goal.rubro}</div>
      <div class="sc-pct" style="color:${color}">${fmtPct(cons)}</div>
      <div class="sc-bar-wrap">
        <div class="sc-bar-fill" style="width:${barW}%;background:${grad}"></div>
      </div>
      <div class="sc-sub">Real: ${fmt(goal.real)} / Meta: ${fmt(goal.meta, goal.meta < 100 ? 0 : 2)}</div>
    `;
    container.appendChild(card);
  });
}

function updateSummaryCards() {
  const cards = document.querySelectorAll('.summary-card');
  const activeGoals = goals.filter(g => !g.isMultiplicador && g.meta > 0);

  cards.forEach((card, i) => {
    if (i >= activeGoals.length) return;
    const goal = activeGoals[i];
    const cons = calcConsecucion(goal);
    const color = colorByCons(cons);
    const grad  = gradientByCons(cons);
    const barW  = clamp(cons, 0, 100);

    card.style.borderColor = color + '33';
    card.querySelector('.sc-pct').textContent = fmtPct(cons);
    card.querySelector('.sc-pct').style.color = color;
    card.querySelector('.sc-bar-fill').style.width = barW + '%';
    card.querySelector('.sc-bar-fill').style.background = grad;
    card.querySelector('div[style*="height:3px"]').style.background = grad;
    card.querySelector('.sc-sub').textContent =
      `Real: ${fmt(goal.real)} / Meta: ${fmt(goal.meta, goal.meta < 100 ? 0 : 2)}`;
  });
}

// --------------------------------------------------
// 5. KPIs HEADER
// --------------------------------------------------
function updateKPIs(totalPts) {
  // Multiplicador simulado (si supera ciertas metas)
  const goalsOver100 = goals.filter(g => !g.isMultiplicador && g.meta > 0 && calcConsecucion(g) >= 100).length;
  const totalActiveGoals = goals.filter(g => !g.isMultiplicador && g.meta > 0).length;
  const pctGoalsOver = (goalsOver100 / totalActiveGoals) * 100;

  let multiplicador = 0;
  if (pctGoalsOver >= 80) multiplicador = totalPts * 0.25;
  else if (pctGoalsOver >= 50) multiplicador = totalPts * 0.10;

  document.getElementById('pts-multiplicador').textContent = fmt(multiplicador);
}

// --------------------------------------------------
// 6. TIMELINE (línea del día)
// --------------------------------------------------
function updateTimeline(day) {
  const pct = ((day - 1) / (TOTAL_DAYS - 1)) * 100;
  const fill = document.getElementById('timeline-fill');
  const marker = document.getElementById('timeline-marker');
  const label  = document.getElementById('marker-label');
  const dayPctLabel = document.getElementById('day-pct-label');
  const dayFraction = document.getElementById('day-fraction');

  fill.style.width   = pct + '%';
  marker.style.left  = clamp(pct, 1, 98) + '%';
  label.textContent  = `Día ${day}`;
  dayFraction.textContent = `Día ${day} de ${TOTAL_DAYS} del mes`;
  dayPctLabel.textContent = `${pct.toFixed(1)}% del mes transcurrido`;
}

// --------------------------------------------------
// 7. PROYECCIÓN GENERAL
// --------------------------------------------------
function updateProjectionPill(day) {
  const pill  = document.getElementById('projection-pill');
  const label = document.getElementById('projection-label');

  const activeGoals = goals.filter(g => !g.isMultiplicador && g.meta > 0);
  let goalsOnTrack  = 0;

  activeGoals.forEach(g => {
    const proyectado = proyectarAlMes(g.real, day);
    if (proyectado >= g.meta) goalsOnTrack++;
  });

  const pct = (goalsOnTrack / activeGoals.length) * 100;

  if (pct >= 70) {
    pill.style.background = 'rgba(16,185,129,0.15)';
    pill.style.borderColor = 'rgba(16,185,129,0.4)';
    pill.style.color = 'var(--green)';
    label.textContent = `📈 ${goalsOnTrack}/${activeGoals.length} metas en camino`;
  } else if (pct >= 40) {
    pill.style.background = 'rgba(245,158,11,0.15)';
    pill.style.borderColor = 'rgba(245,158,11,0.4)';
    pill.style.color = 'var(--yellow)';
    label.textContent = `⚠️ ${goalsOnTrack}/${activeGoals.length} metas en camino`;
  } else {
    pill.style.background = 'rgba(239,68,68,0.12)';
    pill.style.borderColor = 'rgba(239,68,68,0.3)';
    pill.style.color = '#f87171';
    label.textContent = `🔴 ${goalsOnTrack}/${activeGoals.length} metas en camino`;
  }
}

// --------------------------------------------------
// 8. MODAL DE EDICIÓN
// --------------------------------------------------
function openModal(id) {
  const goal = goals.find(g => g.id === id);
  if (!goal) return;
  editingId = id;

  document.getElementById('modal-rubro').textContent = goal.rubro;
  document.getElementById('modal-meta').textContent  = fmt(goal.meta);
  document.getElementById('modal-input').value = goal.real;
  document.getElementById('modal-overlay').classList.add('active');
  setTimeout(() => document.getElementById('modal-input').focus(), 200);
}

function closeModal() {
  document.getElementById('modal-overlay').classList.remove('active');
  editingId = null;
}

function saveModal() {
  const val = parseFloat(document.getElementById('modal-input').value);
  if (isNaN(val)) { alert('Por favor ingresa un número válido.'); return; }

  const goal = goals.find(g => g.id === editingId);
  if (goal) goal.real = val;

  closeModal();
  saveToStorage();
  renderTable();
  updateProjectionPill(currentSimDay);
  showLastUpdate();
}

// --------------------------------------------------
// 9. RELOJ EN TIEMPO REAL
// --------------------------------------------------
function updateClock() {
  const now = new Date();
  const date = now.toLocaleDateString('es-PE', { day:'2-digit', month:'2-digit', year:'numeric' });
  const time = now.toLocaleTimeString('es-PE', { hour:'2-digit', minute:'2-digit', second:'2-digit' });
  document.getElementById('current-date').textContent = `Al ${date}`;
  document.getElementById('current-time').textContent = time;
}

// --------------------------------------------------
// 10. SLIDER LISTENER
// --------------------------------------------------
function initSlider() {
  const slider = document.getElementById('sim-day');
  const valEl  = document.getElementById('sim-day-val');

  slider.addEventListener('input', () => {
    const day = parseInt(slider.value);
    currentSimDay = day;
    valEl.textContent = day;
    updateTimeline(day);
    renderTable();
    updateProjectionPill(day);
  });
}

// --------------------------------------------------
// 11. RESET
// --------------------------------------------------
function resetData() {
  if (!confirm('¿Resetear todos los valores REAL a los originales de la imagen?')) return;
  goals = GOALS_DATA.map(g => ({ ...g }));
  localStorage.removeItem('metas_goals');
  localStorage.removeItem('metas_lastupdate');
  document.getElementById('last-update-badge').style.display = 'none';
  renderTable();
  updateProjectionPill(currentSimDay);
}

// --------------------------------------------------
// 12. LOCALSTORAGE
// --------------------------------------------------
const LS_KEY   = 'metas_goals';
const LS_DATE  = 'metas_lastupdate';

function saveToStorage() {
  const data = goals.map(g => ({ id: g.id, real: g.real }));
  localStorage.setItem(LS_KEY,  JSON.stringify(data));
  localStorage.setItem(LS_DATE, new Date().toISOString());
}

function loadFromStorage() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return false;
    const saved = JSON.parse(raw);
    saved.forEach(s => {
      const g = goals.find(x => x.id === s.id);
      if (g) g.real = s.real;
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
  const timeStr = d.toLocaleTimeString('es-PE', { hour:'2-digit', minute:'2-digit', second:'2-digit' });
  const dateStr = d.toLocaleDateString('es-PE', { day:'2-digit', month:'2-digit' });
  text.textContent = `Última sync: ${dateStr} ${timeStr}`;
  badge.style.display = 'flex';
}

// --------------------------------------------------
// 13. LOOKER STUDIO DRAWER
// --------------------------------------------------
const LS_URL = 'https://lookerstudio.google.com/embed/reporting/225582d5-e39b-4e5e-bdcb-f25cebd5ae71/page/p_oitiw9jc2d';

function openDrawer() {
  document.getElementById('ls-drawer').classList.add('open');
  document.getElementById('ls-backdrop').classList.add('active');
  document.body.style.overflow = 'hidden';
}

function closeDrawer() {
  document.getElementById('ls-drawer').classList.remove('open');
  document.getElementById('ls-backdrop').classList.remove('active');
  document.body.style.overflow = '';
}

function loadLookerIframe() {
  const notice  = document.getElementById('ls-login-notice');
  const iframe  = document.getElementById('ls-iframe');
  const loading = document.getElementById('ls-loading');

  // Mostrar spinner
  notice.style.display  = 'none';
  loading.style.display = 'flex';
  iframe.style.display  = 'none';

  // Cargar iframe
  iframe.src = LS_URL;
  iframe.onload = () => {
    loading.style.display = 'none';
    iframe.style.display  = 'block';
  };
}

function reloadLookerIframe() {
  const iframe  = document.getElementById('ls-iframe');
  const loading = document.getElementById('ls-loading');
  if (!iframe.src || iframe.src === window.location.href) {
    loadLookerIframe();
    return;
  }
  loading.style.display = 'flex';
  iframe.style.display  = 'none';
  iframe.src = iframe.src; // Force reload
  iframe.onload = () => {
    loading.style.display = 'none';
    iframe.style.display  = 'block';
  };
}

function initDrawer() {
  document.getElementById('btn-open-looker').addEventListener('click', openDrawer);
  document.getElementById('ls-btn-close').addEventListener('click', closeDrawer);
  document.getElementById('ls-backdrop').addEventListener('click', closeDrawer);
  document.getElementById('ls-btn-load').addEventListener('click', loadLookerIframe);
  document.getElementById('ls-btn-refresh').addEventListener('click', reloadLookerIframe);
}

// --------------------------------------------------
// 14. SYNC MODAL (actualización masiva)
// --------------------------------------------------
let syncDraft = {}; // id -> valor temporal

function openSyncModal() {
  // Inicializar draft con valores actuales
  syncDraft = {};
  goals.forEach(g => { syncDraft[g.id] = g.real; });

  // Construir campos
  const container = document.getElementById('sync-fields-container');
  container.innerHTML = '';

  goals.filter(g => !g.isMultiplicador && g.meta > 0).forEach(goal => {
    const div = document.createElement('div');
    div.className = 'sync-field';

    const cons = calcConsecucion(goal);
    const color = colorByCons(cons);

    div.innerHTML = `
      <div class="sync-field-label">
        <span>${goal.rubro}</span>
        <span class="sync-field-meta">Meta: ${fmt(goal.meta, goal.meta < 100 ? 0 : 2)}</span>
      </div>
      <input
        class="sync-field-input"
        type="number"
        step="any"
        data-id="${goal.id}"
        value="${goal.real}"
        placeholder="0"
      />
      <div class="sync-field-preview" data-preview="${goal.id}" style="color:${color}">
        ${fmtPct(cons)} consecución
      </div>
    `;
    container.appendChild(div);
  });

  // Listeners de inputs
  container.querySelectorAll('.sync-field-input').forEach(inp => {
    inp.addEventListener('input', () => {
      const id  = parseInt(inp.dataset.id);
      const val = parseFloat(inp.value);
      syncDraft[id] = isNaN(val) ? 0 : val;
      updateSyncPreview(id);
    });
  });

  updateSyncTotal();
  document.getElementById('sync-overlay').classList.add('active');
}

function updateSyncPreview(id) {
  const draft = syncDraft[id];
  const goal  = goals.find(g => g.id === id);
  if (!goal || goal.meta === 0) return;

  const tempCons = clamp((draft / goal.meta) * 100, 0, 200);
  const color    = colorByCons(tempCons);
  const el       = document.querySelector(`[data-preview="${id}"]`);
  if (el) {
    el.style.color   = color;
    el.textContent   = `${fmtPct(tempCons)} consecución`;
  }
  updateSyncTotal();
}

function updateSyncTotal() {
  let total = 0;
  goals.forEach(g => {
    if (g.isMultiplicador || g.meta === 0) return;
    const real = syncDraft[g.id] !== undefined ? syncDraft[g.id] : g.real;
    const cons = clamp((real / g.meta) * 100, 0, 200);
    const pts  = cons < 20 ? 0 : parseFloat((g.peso * Math.min(cons / 100, 2.0)).toFixed(2));
    total += pts;
  });
  document.getElementById('sync-preview-pts').textContent = fmt(total);
}

function applySyncModal() {
  // Aplicar draft a goals
  Object.entries(syncDraft).forEach(([idStr, val]) => {
    const id   = parseInt(idStr);
    const goal = goals.find(g => g.id === id);
    if (goal) goal.real = val;
  });
  closeSyncModal();
  saveToStorage();
  showLastUpdate();
  renderTable();
  updateProjectionPill(currentSimDay);
}

function closeSyncModal() {
  document.getElementById('sync-overlay').classList.remove('active');
  syncDraft = {};
}

function initSyncModal() {
  document.getElementById('btn-open-sync').addEventListener('click', openSyncModal);
  document.getElementById('sync-modal-close').addEventListener('click', closeSyncModal);
  document.getElementById('sync-cancel').addEventListener('click', closeSyncModal);
  document.getElementById('sync-save').addEventListener('click', applySyncModal);
  document.getElementById('sync-overlay').addEventListener('click', e => {
    if (e.target === document.getElementById('sync-overlay')) closeSyncModal();
  });
}

// --------------------------------------------------
// 15. PASTE FROM LOOKER MODAL
// --------------------------------------------------
let parsedPasteData = []; // array of { id, rubro, newValue, oldValue }

/**
 * Normaliza un texto para comparación fuzzy:
 * elimina acentos, pasa a minúsculas, elimina chars especiales.
 */
function normalize(str) {
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Calcula similitud entre dos strings (0-1)
 * Basado en tokens compartidos
 */
function similarity(a, b) {
  const tokensA = normalize(a).split(' ').filter(t => t.length > 2);
  const tokensB = normalize(b).split(' ').filter(t => t.length > 2);
  if (tokensA.length === 0 || tokensB.length === 0) return 0;

  let matches = 0;
  for (const ta of tokensA) {
    for (const tb of tokensB) {
      if (ta === tb || ta.includes(tb) || tb.includes(ta)) {
        matches++;
        break;
      }
    }
  }
  return matches / Math.max(tokensA.length, tokensB.length);
}

/**
 * Parsea un string numérico con formatos variados:
 * "876,046.76" → 876046.76
 * "876.046,76" → 876046.76 (formato europeo)
 * "-44,197.36" → -44197.36
 * "1 508"      → 1508
 */
function parseNumber(str) {
  if (!str) return null;
  let s = str.trim().replace(/\s/g, '');

  // Detectar formato europeo (punto como separador de miles, coma como decimal)
  // vs. formato US (coma como separador de miles, punto como decimal)
  const lastComma = s.lastIndexOf(',');
  const lastDot   = s.lastIndexOf('.');

  if (lastComma > lastDot && lastComma > 0) {
    // Formato europeo: 876.046,76
    s = s.replace(/\./g, '').replace(',', '.');
  } else {
    // Formato US: 876,046.76
    s = s.replace(/,/g, '');
  }

  const n = parseFloat(s);
  return isNaN(n) ? null : n;
}

/**
 * Intenta parsear el texto pegado y asociar valores a los goals.
 * Estrategias:
 *  1. Detectar filas con nombre de rubro → extraer último número como "real"
 *  2. Si solo hay números (uno por línea), asignar en orden a los goals activos
 */
function parsePastedData(text) {
  const results = [];
  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);

  if (lines.length === 0) return results;

  const activeGoals = goals.filter(g => !g.isMultiplicador && g.meta > 0);

  // Estrategia 1: Intentar match por nombre de rubro
  const matchedById = new Set();

  for (const line of lines) {
    // Separar por tabs o múltiples espacios
    const parts = line.split(/\t|(?:  +)/).map(p => p.trim()).filter(p => p);

    if (parts.length >= 2) {
      // Buscar qué parte es texto (rubro) y cuáles son números
      const textParts = [];
      const numParts = [];

      for (const part of parts) {
        const num = parseNumber(part);
        if (num !== null && /[\d]/.test(part)) {
          numParts.push(num);
        } else {
          textParts.push(part);
        }
      }

      if (textParts.length > 0 && numParts.length > 0) {
        const rubroText = textParts.join(' ');

        // Buscar el goal más similar
        let bestMatch = null;
        let bestScore = 0;

        for (const goal of activeGoals) {
          if (matchedById.has(goal.id)) continue;
          const score = similarity(rubroText, goal.rubro);
          if (score > bestScore && score >= 0.35) {
            bestScore = score;
            bestMatch = goal;
          }
        }

        if (bestMatch) {
          // Tomar el último número como "real" (generalmente va: meta, real, o solo real)
          const realValue = numParts[numParts.length - 1];
          matchedById.add(bestMatch.id);
          results.push({
            id: bestMatch.id,
            rubro: bestMatch.rubro,
            newValue: realValue,
            oldValue: bestMatch.real,
          });
        }
      }
    }
  }

  // Estrategia 2: Si no se encontró ningún match por rubro,
  // intentar asignar números en orden
  if (results.length === 0) {
    const allNumbers = [];
    for (const line of lines) {
      const num = parseNumber(line.replace(/\t/g, '').trim());
      if (num !== null) {
        allNumbers.push(num);
      } else {
        // Intentar extraer números de la línea
        const matches = line.match(/-?[\d.,]+/g);
        if (matches) {
          for (const m of matches) {
            const n = parseNumber(m);
            if (n !== null) allNumbers.push(n);
          }
        }
      }
    }

    // Si tenemos exactamente la misma cantidad o más que los goals activos,
    // asignar en orden
    if (allNumbers.length >= activeGoals.length) {
      for (let i = 0; i < activeGoals.length; i++) {
        results.push({
          id: activeGoals[i].id,
          rubro: activeGoals[i].rubro,
          newValue: allNumbers[i],
          oldValue: activeGoals[i].real,
        });
      }
    } else if (allNumbers.length > 0) {
      // Asignar los que tengamos
      for (let i = 0; i < Math.min(allNumbers.length, activeGoals.length); i++) {
        results.push({
          id: activeGoals[i].id,
          rubro: activeGoals[i].rubro,
          newValue: allNumbers[i],
          oldValue: activeGoals[i].real,
        });
      }
    }
  }

  return results;
}

function openPasteModal() {
  document.getElementById('paste-textarea').value = '';
  document.getElementById('paste-preview').style.display = 'none';
  document.getElementById('paste-error').style.display = 'none';
  document.getElementById('paste-detected').textContent = '0 valores detectados';
  document.getElementById('paste-apply').disabled = true;
  parsedPasteData = [];
  document.getElementById('paste-overlay').classList.add('active');
  setTimeout(() => document.getElementById('paste-textarea').focus(), 200);
}

function closePasteModal() {
  document.getElementById('paste-overlay').classList.remove('active');
  parsedPasteData = [];
}

function onPasteTextareaInput() {
  const text = document.getElementById('paste-textarea').value;
  const preview = document.getElementById('paste-preview');
  const previewList = document.getElementById('paste-preview-list');
  const error = document.getElementById('paste-error');
  const detected = document.getElementById('paste-detected');
  const applyBtn = document.getElementById('paste-apply');

  if (!text.trim()) {
    preview.style.display = 'none';
    error.style.display = 'none';
    detected.textContent = '0 valores detectados';
    applyBtn.disabled = true;
    parsedPasteData = [];
    return;
  }

  parsedPasteData = parsePastedData(text);

  if (parsedPasteData.length === 0) {
    preview.style.display = 'none';
    error.style.display = 'block';
    error.textContent = '⚠️ No se pudieron detectar valores. Asegúrate de copiar la tabla completa desde Looker Studio, o pega los números (uno por línea) en el orden de la tabla.';
    detected.textContent = '0 valores detectados';
    applyBtn.disabled = true;
    return;
  }

  // Show preview
  error.style.display = 'none';
  preview.style.display = 'block';
  previewList.innerHTML = '';

  parsedPasteData.forEach(item => {
    const changed = item.newValue !== item.oldValue;
    const div = document.createElement('div');
    div.className = `paste-preview-item ${changed ? '' : 'pp-unchanged'}`;
    div.innerHTML = `
      <span class="pp-rubro">${item.rubro}</span>
      <span class="pp-old">${fmt(item.oldValue)}</span>
      <span class="pp-arrow">→</span>
      <span class="pp-new">${fmt(item.newValue)}</span>
    `;
    previewList.appendChild(div);
  });

  detected.textContent = `${parsedPasteData.length} valores detectados`;
  detected.style.color = 'var(--green)';
  applyBtn.disabled = false;
}

function applyPasteData() {
  if (parsedPasteData.length === 0) return;

  parsedPasteData.forEach(item => {
    const goal = goals.find(g => g.id === item.id);
    if (goal) goal.real = item.newValue;
  });

  closePasteModal();
  saveToStorage();
  showLastUpdate();
  renderTable();
  updateProjectionPill(currentSimDay);
}

function initPasteModal() {
  document.getElementById('btn-open-paste').addEventListener('click', openPasteModal);
  document.getElementById('paste-modal-close').addEventListener('click', closePasteModal);
  document.getElementById('paste-cancel').addEventListener('click', closePasteModal);
  document.getElementById('paste-apply').addEventListener('click', applyPasteData);
  document.getElementById('paste-overlay').addEventListener('click', e => {
    if (e.target === document.getElementById('paste-overlay')) closePasteModal();
  });

  // Detectar cambios en el textarea (input + paste event)
  const textarea = document.getElementById('paste-textarea');
  textarea.addEventListener('input', onPasteTextareaInput);
  textarea.addEventListener('paste', () => {
    // El evento paste ocurre antes de que el valor se actualice,
    // así que usamos setTimeout
    setTimeout(onPasteTextareaInput, 50);
  });
}

// --------------------------------------------------
// 16. INIT
// --------------------------------------------------
function init() {
  // Cargar desde localStorage si hay datos guardados
  const restored = loadFromStorage();

  // Render inicial
  renderTable();
  renderSummaryCards();
  updateTimeline(currentSimDay);
  updateProjectionPill(currentSimDay);

  // Mostrar badge si hay datos guardados
  if (restored) showLastUpdate();

  // Slider
  initSlider();

  // Reloj
  updateClock();
  setInterval(updateClock, 1000);

  // Modal edición individual
  document.getElementById('modal-close').addEventListener('click', closeModal);
  document.getElementById('btn-cancel').addEventListener('click', closeModal);
  document.getElementById('btn-save').addEventListener('click', saveModal);
  document.getElementById('modal-overlay').addEventListener('click', e => {
    if (e.target === document.getElementById('modal-overlay')) closeModal();
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') { closeModal(); closeSyncModal(); closeDrawer(); closePasteModal(); }
    if (e.key === 'Enter' && document.getElementById('modal-overlay').classList.contains('active')) saveModal();
  });

  // Reset
  document.getElementById('btn-reset').addEventListener('click', resetData);

  // Looker Studio drawer
  initDrawer();

  // Sync modal
  initSyncModal();

  // Paste from Looker modal
  initPasteModal();
}

document.addEventListener('DOMContentLoaded', init);

