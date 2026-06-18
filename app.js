/* =============================================
   SIMULADOR DE METAS BANCARIAS – app.js (Premium Edition)
   ============================================= */

// --------------------------------------------------
// 1. DATOS BASE
// --------------------------------------------------
const GOALS_DATA = [
  { id: 2, peso: 13, rubro: 'Facturación Pyme', meta: 2568000, real: 841274.57, avance: 0, isMultiplicador: false, isStock: false },
  { id: 5, peso: 12, rubro: 'Altas de Nóminas', meta: 89, real: 65, avance: 0, isMultiplicador: false, isStock: false, noCurrency: true },
  { id: 1, peso: 10, rubro: 'Var SM V+A Soles y Dólares', meta: 300000, real: 876046.76, avance: 0, isMultiplicador: false, isStock: true },
  { id: 3, peso: 10, rubro: 'Facturación Clientes Nuevos', meta: 385000, real: 58997.05, avance: 0, isMultiplicador: false, isStock: false },
  { id: 4, peso: 10, rubro: 'Seguros (Primas)', meta: 19600, real: 1508, avance: 0, isMultiplicador: false, isStock: false },
  { id: 11, peso: 10, rubro: 'POS (puntos)', meta: 6, real: 0, avance: 0, isMultiplicador: false, isStock: false, noCurrency: true },
  { id: 13, peso: 9, rubro: 'Flujos QR Empresa', meta: 54749, real: 0, avance: 0, isMultiplicador: false, isStock: false },
  { id: 12, peso: 8, rubro: 'Efectividad de Contención', meta: 49068.956, real: 0, avance: 0, isMultiplicador: false, isStock: false },
  { id: 14, peso: 8, rubro: 'Var. SM Inversión Rentable', meta: 419000, real: -44197.36, avance: 0, isMultiplicador: false, isStock: true },
  { id: 6, peso: 5, rubro: 'Acciones Comerciales (Afiliaciones)', meta: 12, real: 1, avance: 0, isMultiplicador: false, isStock: false, noCurrency: true },
  { id: 7, peso: 5, rubro: 'Acciones Comerciales (Altas)', meta: 1, real: 0, avance: 0, isMultiplicador: false, isStock: false, noCurrency: true },
  { id: 8, peso: 5, rubro: 'Contención Pyme', meta: 47589.056, real: 0, avance: 0, isMultiplicador: false, isStock: false },
  { id: 10, peso: 3, rubro: 'Solución Pyme', meta: 1479900, real: 0, avance: 0, isMultiplicador: false, isStock: false },
  { id: 9, peso: 0, rubro: 'MultiplicaDOR RCP', meta: 0, real: 0, avance: 0, isMultiplicador: true, isStock: false, noCurrency: true },
];

const TOTAL_DAYS = 30;

function getBankingSimDay() {
  const today = new Date();
  const dayOfWeek = today.getDay();
  let offset = 1;
  
  if (dayOfWeek === 0) offset = 2; // Domingo -> Viernes
  else if (dayOfWeek === 1) offset = 3; // Lunes -> Viernes
  
  let simDay = today.getDate() - offset;
  if (simDay < 1) simDay = 1;
  if (simDay > 30) simDay = 30;
  return simDay;
}

let currentSimDay = getBankingSimDay();
let goals = GOALS_DATA.map(g => ({ ...g }));

// --------------------------------------------------
// 2. UTILIDADES
// --------------------------------------------------
function fmt(n, decimals = 2) {
  if (n === null || n === undefined || isNaN(n)) return '0,00';
  return n.toLocaleString('es-PE', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}
function fmtGoal(n, goal) {
  if (n === null || n === undefined || isNaN(n)) n = 0;
  const isC = !goal.noCurrency && !goal.isMultiplicador;
  const str = fmt(n, n < 100 && !isC ? 0 : 2);
  return isC ? `S/ ${str}` : str;
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
    const target140 = goal.meta * 1.40;
    const falta140 = Math.max(0, target140 - totalReal);
    const isAchieved = (goal.meta > 0 && totalReal >= target140);
    
    const barWidth = clamp(cons, 0, 100);
    const { label: rangeLabel, cls: rangeCls } = bbvaRangeLabel(cons, goal.isStock);

    const consClass = cons >= 90 ? (cons >= 100 ? 'high' : 'mid') : 'low';

    const stockBadge = goal.isStock ? '<span class="sm-tag">SM</span>' : '';
    const multBadge  = goal.isMultiplicador ? '<span class="mult-tag">MULT</span>' : '';

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><span class="peso-badge" style="background:rgba(255,255,255,0.1);color:var(--text-main)">${goal.peso}</span></td>
      <td class="td-rubro">${goal.rubro}${stockBadge}${multBadge}</td>
      <td class="td-meta">${goal.meta === 0 ? '—' : fmtGoal(goal.meta, goal)}</td>
      <td class="td-real" onclick="this.querySelector('input').focus()">
        <div class="inline-input-wrapper">
          <input type="text" class="inline-input" data-id="${goal.id}" data-field="real" value="${fmtGoal(goal.real, goal)}" />
        </div>
      </td>
      <td class="td-avance" onclick="this.querySelector('input').focus()">
        <div class="inline-input-wrapper">
          <input type="text" class="inline-input" data-id="${goal.id}" data-field="avance" value="${fmtGoal(goal.avance || 0, goal)}" style="color:var(--color-green);border-color:var(--color-green)" />
        </div>
      </td>
      <td class="td-proyectado" style="color:${isAchieved ? 'var(--color-green)' : 'var(--color-yellow)'}">
        ${goal.meta === 0 ? '—' : (isAchieved ? '✅ Logrado' : fmtGoal(falta140, goal))}
      </td>
      <td><span class="cons-badge ${consClass}">${goal.meta === 0 ? '—' : fmtPct(cons)}</span></td>
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
      const rawVal = e.target.value.replace(/S\/\s?/g, '').replace(/,/g, '').trim();
      const val = parseFloat(rawVal);
      const goal = goals.find(g => g.id === id);
      if (goal && !isNaN(val)) {
        goal[field] = val;
        saveToStorage();
        updateAll();
      } else if (goal) {
        e.target.value = fmtGoal(goal[field], goal);
      }
    });

    input.addEventListener('focus', (e) => {
      const id = parseInt(e.target.dataset.id);
      const goal = goals.find(g => g.id === id);
      const field = e.target.dataset.field;
      if (goal) {
        e.target.value = goal[field]; // sin formato para editar rápido
      }
      e.target.select();
    });

    input.addEventListener('blur', (e) => {
      const id = parseInt(e.target.dataset.id);
      const goal = goals.find(g => g.id === id);
      const field = e.target.dataset.field;
      if (goal) {
        e.target.value = fmtGoal(goal[field], goal);
      }
    });
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
// 6. STRATEGY PANEL (NUEVO)
// --------------------------------------------------
function renderStrategyPanel() {
  const container = document.getElementById('strategy-grid');
  if (!container) return;
  container.innerHTML = '';

  const activeGoals = goals.filter(g => !g.isMultiplicador && g.meta > 0 && g.id !== 5);
  const diasRestantes = Math.max(1, TOTAL_DAYS - currentSimDay + 1);

  const stratData = activeGoals.map(g => {
    const totalReal = g.real + (g.avance || 0);
    const target140 = g.meta * 1.4;
    const missing = Math.max(0, target140 - totalReal);
    const quota = missing / diasRestantes;
    
    return { ...g, totalReal, target140, missing, quota };
  }).filter(g => g.missing > 0);

  // Ordenar por Peso (para enfocarse en las que dan más puntos)
  stratData.sort((a, b) => b.peso - a.peso);

  // Tomar las top 4 o mostrar un mensaje si todo está al 140%
  const topStrats = stratData.slice(0, 4);

  if (topStrats.length === 0) {
    container.innerHTML = `<div style="color:var(--color-green); font-weight:700; padding:10px;">¡Felicidades! Todas las metas han alcanzado el 140%.</div>`;
    return;
  }

  topStrats.forEach(g => {
    const card = document.createElement('div');
    card.className = 'strat-card';
    
    card.innerHTML = `
      <div class="strat-card-header">
        <div class="strat-title">${g.rubro}</div>
        <div class="strat-peso">Peso: ${g.peso}</div>
      </div>
      
      <div class="strat-gap-row">
        <span class="strat-gap-label">Brecha al 140%:</span>
        <span class="strat-gap-val">${fmtGoal(g.missing, g)}</span>
      </div>

      <div class="strat-action-box">
        <span class="strat-action-label">Deberías hacer hoy:</span>
        <span class="strat-action-val">+ ${fmtGoal(g.quota, g)}</span>
      </div>
    `;
    container.appendChild(card);
  });
}

// --------------------------------------------------
// 7. ADVANCED STATS (NUEVO)
// --------------------------------------------------
function renderAdvancedStats() {
  const container = document.getElementById('advanced-stats-grid');
  if (!container) return;
  container.innerHTML = '';

  const activeGoals = goals.filter(g => !g.isMultiplicador && g.meta > 0);
  if (activeGoals.length === 0) return;

  // 1. Top Ganador (Mayor % consecución)
  const topGanador = [...activeGoals].sort((a,b) => calcConsecucion(b) - calcConsecucion(a))[0];
  const consGanador = calcConsecucion(topGanador);

  // 2. Mayor Riesgo (Menor % consecución ponderado por peso)
  // Penalizamos las que tienen mucho peso pero poco avance
  const mayorRiesgo = [...activeGoals].sort((a,b) => {
    const scoreA = (100 - Math.min(100, calcConsecucion(a))) * a.peso;
    const scoreB = (100 - Math.min(100, calcConsecucion(b))) * b.peso;
    return scoreB - scoreA;
  })[0];
  const consRiesgo = calcConsecucion(mayorRiesgo);

  // 3. Velocidad de Cierre (Pts por día)
  let totalPtsSoFar = 0;
  goals.forEach(g => { totalPtsSoFar += calcPuntamat(g); });
  const runRate = currentSimDay > 0 ? (totalPtsSoFar / currentSimDay) : 0;
  const projTotal = runRate * TOTAL_DAYS;

  // 4. Estado de Matrícula
  let matriculaStatus = '';
  let matriculaColor = '';
  let matriculaFill = 0;
  if (projTotal >= 100) {
    matriculaStatus = 'Sobresaliente';
    matriculaColor = 'var(--color-blue)';
    matriculaFill = 100;
  } else if (projTotal >= 75) {
    matriculaStatus = 'Encaminado';
    matriculaColor = 'var(--color-green)';
    matriculaFill = (projTotal / 100) * 100;
  } else if (projTotal >= 50) {
    matriculaStatus = 'En Riesgo';
    matriculaColor = 'var(--color-yellow)';
    matriculaFill = (projTotal / 75) * 100;
  } else {
    matriculaStatus = 'Crítico';
    matriculaColor = 'var(--color-red)';
    matriculaFill = (projTotal / 75) * 100;
  }

  // Tarjetas HTML
  const cardsHtml = `
    <!-- Top Ganador -->
    <div class="adv-card">
      <div class="adv-card-glow" style="background: radial-gradient(circle, var(--color-green) 0%, transparent 50%);"></div>
      <div class="adv-header">
        <div class="adv-icon" style="color:var(--color-green)">🏆</div>
        <div class="adv-title">Top Ganador</div>
      </div>
      <div class="adv-body">
        <div class="adv-value" style="font-size: 1.2rem;">${topGanador.rubro}</div>
        <div class="adv-subtext" style="color:var(--color-green)">${fmtPct(consGanador)} Consecución</div>
        <div class="adv-status-bar">
          <div class="adv-status-fill" style="width:${clamp(consGanador, 0, 100)}%; background:var(--color-green)"></div>
        </div>
      </div>
    </div>

    <!-- Mayor Riesgo -->
    <div class="adv-card">
      <div class="adv-card-glow" style="background: radial-gradient(circle, var(--color-red) 0%, transparent 50%);"></div>
      <div class="adv-header">
        <div class="adv-icon" style="color:var(--color-red)">⚠️</div>
        <div class="adv-title">Mayor Riesgo</div>
      </div>
      <div class="adv-body">
        <div class="adv-value" style="font-size: 1.2rem;">${mayorRiesgo.rubro}</div>
        <div class="adv-subtext" style="color:var(--color-red)">${fmtPct(consRiesgo)} (Peso: ${mayorRiesgo.peso})</div>
        <div class="adv-status-bar">
          <div class="adv-status-fill" style="width:${clamp(consRiesgo, 0, 100)}%; background:var(--color-red)"></div>
        </div>
      </div>
    </div>

    <!-- Velocidad de Cierre -->
    <div class="adv-card">
      <div class="adv-card-glow" style="background: radial-gradient(circle, var(--accent-cyan) 0%, transparent 50%);"></div>
      <div class="adv-header">
        <div class="adv-icon" style="color:var(--accent-cyan)">⚡</div>
        <div class="adv-title">Velocidad Cierre</div>
      </div>
      <div class="adv-body">
        <div class="adv-value">${fmt(runRate)} <span style="font-size:1rem;color:var(--text-faded)">pts/día</span></div>
        <div class="adv-subtext">Proyección fin de mes: ${fmt(projTotal)} pts</div>
        <div class="adv-status-bar">
          <div class="adv-status-fill" style="width:${clamp((projTotal/100)*100, 0, 100)}%; background:var(--accent-cyan)"></div>
        </div>
      </div>
    </div>

    <!-- Estado Matrícula -->
    <div class="adv-card">
      <div class="adv-card-glow" style="background: radial-gradient(circle, ${matriculaColor} 0%, transparent 50%);"></div>
      <div class="adv-header">
        <div class="adv-icon" style="color:${matriculaColor}">🎓</div>
        <div class="adv-title">Proyección Matrícula</div>
      </div>
      <div class="adv-body">
        <div class="adv-value" style="color:${matriculaColor}; font-size:1.5rem;">${matriculaStatus}</div>
        <div class="adv-subtext">Minimo requerido: 75 pts</div>
        <div class="adv-status-bar">
          <div class="adv-status-fill" style="width:${clamp(matriculaFill, 0, 100)}%; background:${matriculaColor}"></div>
        </div>
      </div>
    </div>
  `;

  container.innerHTML = cardsHtml;
}

// --------------------------------------------------
// 8. GENERAL UPDATER
// --------------------------------------------------
function updateAll() {
  renderTable();
  renderStrategyPanel();
  renderAdvancedStats();
  updateTimeline(currentSimDay);
  updateProjectionPill(currentSimDay);
  showLastUpdate();
}

// --------------------------------------------------
// 8. STORAGE & CLOCK
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

const WINNING_QUOTES = [
  "Ya he superado el 140%, el éxito financiero es mi estado natural.",
  "Celebro que hoy mis metas están cumplidas y desbordadas.",
  "El reconocimiento máximo ya es mío, soy un ganador absoluto.",
  "Disfruto de la satisfacción de ver mi matrícula asegurada.",
  "Atraigo resultados extraordinarios sin esfuerzo.",
  "Mis metas comerciales están destrozadas; logré más de lo que imaginaba.",
  "Siento una inmensa gratitud porque ya alcancé el acelerador más alto.",
  "Mi nombre está en la cima del ranking, el trabajo ya está hecho.",
  "El multiplicador está a mi favor, la victoria ya me pertenece.",
  "Agradezco porque el 200% de cumplimiento ya es una realidad en mis números.",
  "El éxito fluye hacia mí, mi cuota del mes ya está rebasada.",
  "Todo lo que toco se convierte en puntos a mi favor, ya lo logré.",
  "Respiro tranquilidad porque mi objetivo ya está cerrado con excelencia.",
  "Hoy simplemente disfruto los frutos de mi victoria ya asegurada.",
  "Ya pasé la meta, ahora solo multiplico mis ganancias.",
  "Soy el mejor en lo que hago y mis números actuales lo demuestran.",
  "El bono ya está asegurado, celebro este éxito increíble.",
  "Siento gran orgullo al ver todas mis metas en verde y superadas.",
  "La victoria es mi estado actual, todo ya está resuelto a mi favor.",
  "He superado todas mis expectativas, la meta ya es historia.",
  "Hoy admiro mi trabajo porque ya logré el objetivo máximo del 140%.",
  "El cierre es perfecto, ya alcancé la excelencia que buscaba.",
  "Mis aceleradores ya están al máximo nivel, gracias por este logro.",
  "Miro mis métricas y sonrío: la meta ya está aplastada."
];

let lastQuoteHour = -1;

function updateClock() {
  const now = new Date();
  document.getElementById('current-date').textContent = `Al ${now.toLocaleDateString('es-PE', {day:'2-digit', month:'2-digit', year:'numeric'})}`;
  document.getElementById('current-time').textContent = now.toLocaleTimeString('es-PE', {hour:'2-digit', minute:'2-digit', second:'2-digit'});
  
  // Actualizar frase motivacional cada hora
  const currentHour = now.getHours();
  if (currentHour !== lastQuoteHour) {
    const quoteEl = document.getElementById('motivational-quote');
    if (quoteEl) {
      quoteEl.textContent = `🔥 ${WINNING_QUOTES[currentHour % WINNING_QUOTES.length]}`;
    }
    lastQuoteHour = currentHour;
  }
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
  const panel = document.getElementById('ls-split-panel');
  panel.classList.toggle('open', open);
  document.body.classList.toggle('split-mode', open);
  
  if (open) {
    loadLooker();
  }
}

function loadLooker() {
  const iframe = document.getElementById('ls-iframe');
  const loading = document.getElementById('ls-loading');
  
  if (iframe.src && iframe.src !== '' && iframe.src !== 'about:blank') {
    // Ya está cargado, solo refrescar
    loading.style.display = 'flex';
    iframe.style.display = 'none';
    iframe.src = LS_URL;
  } else {
    loading.style.display = 'flex';
    iframe.style.display = 'none';
    iframe.src = LS_URL;
  }
  
  iframe.onload = () => {
    loading.style.display = 'none';
    iframe.style.display = 'block';
  };
}

// --------------------------------------------------
// INIT
// --------------------------------------------------
document.addEventListener('DOMContentLoaded', () => {
  loadFromStorage();
  
  // Sincronizar slider con el día calculado automáticamente
  const slider = document.getElementById('sim-day');
  slider.value = currentSimDay;

  updateAll();
  
  // Slider Events
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
  document.getElementById('ls-btn-refresh').addEventListener('click', loadLooker);
  
  const btnImport = document.getElementById('ls-btn-import');
  if (btnImport) {
    btnImport.addEventListener('click', async () => {
      try {
        const text = await navigator.clipboard.readText();
        if (!text || text.trim() === '') {
          alert('El portapapeles está vacío.\n\nInstrucciones:\n1. Selecciona la tabla de metas en Looker Studio.\n2. Presiona Ctrl+C (o Cmd+C) para copiar.\n3. Vuelve a hacer clic en este botón.');
          return;
        }

        const normalize = (s) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
        
        function parseLookerNumber(str) {
          let clean = str.replace(/S\/\.?\s?/gi, '').replace(/%/g, '').trim();
          if (clean === '-' || clean === '') return 0;
          
          const lastComma = clean.lastIndexOf(',');
          const lastDot = clean.lastIndexOf('.');
          if (lastComma > lastDot) {
            clean = clean.replace(/\./g, '').replace(',', '.');
          } else if (lastDot > lastComma) {
            clean = clean.replace(/,/g, '');
          } else if (lastComma > -1) {
            if (clean.length - lastComma <= 3) clean = clean.replace(',', '.');
            else clean = clean.replace(/,/g, '');
          }
          clean = clean.replace(/\s/g, '');
          const n = parseFloat(clean);
          return isNaN(n) ? Number.NaN : n;
        }

        const allTokens = text.split(/[\n\t]+/).map(t => t.trim()).filter(t => t.length > 0);
        let updatedCount = 0;
        let i = 0;

        while (i < allTokens.length) {
           const token = allTokens[i];
           const nSearch = normalize(token);
           
           const goal = goals.find(g => {
             const nName = normalize(g.rubro);
             return nSearch === nName || (nSearch.length > 5 && (nSearch.includes(nName) || nName.includes(nSearch)));
           });
           
           if (goal) {
              const nums = [];
              let j = i + 1;
              while (j < allTokens.length) {
                const nextTok = allTokens[j];
                if (nextTok.match(/^S\/?$/i)) { j++; continue; }
                const n = parseLookerNumber(nextTok);
                if (!isNaN(n)) {
                  nums.push(n);
                  j++;
                } else {
                  break;
                }
              }
              
              if (nums.length > 0) {
                 const realCandidates = nums.filter(n => Math.abs(n - goal.meta) > 0.01 || n === 0);
                 if (realCandidates.length > 0) {
                    goal.real = realCandidates[0];
                    if (realCandidates.length > 1) {
                       goal.avance = realCandidates[1];
                    } else {
                       goal.avance = 0;
                    }
                    updatedCount++;
                 }
              }
              i = j;
           } else {
              i++;
           }
        }

        if (updatedCount > 0) {
          saveToStorage();
          updateAll();
          alert(`✅ ¡Magia pura! Se leyeron y actualizaron ${updatedCount} metas basándose en lo que copiaste.`);
        } else {
          alert('No se reconocieron datos compatibles.\nRecuerda seleccionar los nombres de las metas junto con sus números en Looker Studio y copiar (Ctrl+C).');
        }
      } catch (err) {
        alert('No se pudo acceder al portapapeles. Es posible que debas darle permisos a tu navegador.');
      }
    });
  }

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') toggleDrawer(false);
  });
});
