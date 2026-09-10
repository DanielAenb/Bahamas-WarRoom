/**
 * Bahamas WarRoom — Script principal.
 * Depende de warera-api.js (window.WareraAPI).
 */

const CONFIG = {
  UNIT_UCHIHA_ID: "6997581b896745b3e1b21d0f",
  UNIT_AKATSUKI_ID: "69f542668d7015d064d4147a",
  CACHE_TTL_MS: 2 * 60 * 1000,           // 2 minutos
  CACHE_STORAGE_KEY: 'warera_cache_v2',
  CACHE_VERSION: 2,
  REFRESH_BTN_IDLE: '🔄 Actualizar Datos',
  REFRESH_BTN_LOADING: '⏳ Cargando...',
  FRESHNESS_REFRESH_EVERY_N_TICKS: 5     // Actualizar el dot cada 5 s
};

const UNITS = ['Uchiha', 'Akatsuki'];

// ===== ESTADO GLOBAL =====
const appState = {
  selectedUnit: 'Uchiha',
  selectedMode: 'WAR',
  smartSort: false,
  ordenActual: 'alfabetico',
  playersData: [],
  playersById: new Map(),
  cachedData: { Uchiha: null, Akatsuki: null },
  lastFetchTime: { Uchiha: 0, Akatsuki: 0 },
  vistaActual: 'tabla',
  eleccionManual: false
};

// ===== DOM REFS =====
const sidebar         = document.getElementById('apiSidebar');
const overlay         = document.getElementById('overlay');
const openApiBtn      = document.getElementById('openApiBtn');
const closeApiBtn     = document.getElementById('closeApiBtn');
const apiKeyInput     = document.getElementById('apiKeyInput');
const saveKeyBtn      = document.getElementById('saveKeyBtn');
const clearKeyBtn     = document.getElementById('clearKeyBtn');
const refreshBtn      = document.getElementById('refreshDataBtn');
const smartSortToggle = document.getElementById('smartSortToggle');
const usersContainer  = document.getElementById('usersContainer');
const toast           = document.getElementById('toast');
const toastMessage    = document.getElementById('toastMessage');
const toastBar        = document.getElementById('toastBar');
const freshnessDot    = document.getElementById('freshnessDot');

// ===== INTERVALOS Y CONTADORES =====
let refreshIntervalId  = null;
let timerLoopId        = null;
let freshnessTickCount = 0;
let pendingFetches     = 0;

// ===== INICIALIZACIÓN =====
document.addEventListener('DOMContentLoaded', () => {
  loadCacheFromStorage();
  bindUiEvents();
  restoreViewPreference();
  primerRender();

  // Fetch inicial de ambas unidades (usa caché si está vigente).
  refreshAllUnits(false, false);

  updateFreshnessIndicator();
  startTimerLoop();
  refreshIntervalId = setInterval(() => refreshAllUnits(true, true), CONFIG.CACHE_TTL_MS);
});

function bindUiEvents() {
  // --- Sidebar ---
  openApiBtn.addEventListener('click', () => {
    sidebar.classList.add('open');
    overlay.classList.add('active');
  });
  closeApiBtn.addEventListener('click', cerrarSidebar);
  overlay.addEventListener('click', cerrarSidebar);

  // --- API Key ---
  if (apiKeyInput) apiKeyInput.value = localStorage.getItem('warera_api_key') || '';

  if (saveKeyBtn) {
    saveKeyBtn.addEventListener('click', () => {
      const key = apiKeyInput.value.trim();
      if (key) {
        localStorage.setItem('warera_api_key', key);
        mostrarNotificacion('API Key guardada. Reconsultando…', 1500, 'success');
      } else {
        localStorage.removeItem('warera_api_key');
        mostrarNotificacion('Sin key: usando API pública.', 1500, 'success');
      }
      refreshAllUnits(true, false);
      cerrarSidebar();
    });
  }

  if (clearKeyBtn) {
    clearKeyBtn.addEventListener('click', () => {
      localStorage.removeItem('warera_api_key');
      if (apiKeyInput) apiKeyInput.value = '';
      mostrarNotificacion('API Key borrada.', 1500, 'success');
      refreshAllUnits(true, false);
    });
  }

  // --- Selector de vista (dentro del sidebar) ---
  document.querySelectorAll('[data-vista]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      document.querySelectorAll('[data-vista]').forEach(b => b.classList.remove('active'));
      e.currentTarget.classList.add('active');
      appState.vistaActual  = e.currentTarget.dataset.vista;
      appState.eleccionManual = true;
      localStorage.setItem('vistaPreferida', appState.vistaActual);
      renderUsers();
      cerrarSidebar();
    });
  });

  // --- Selector de unidad ---
  document.querySelectorAll('[data-unit]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      document.querySelectorAll('[data-unit]').forEach(b => b.classList.remove('active'));
      e.currentTarget.classList.add('active');
      appState.selectedUnit = e.currentTarget.dataset.unit;

      if (appState.cachedData[appState.selectedUnit]) {
        appState.playersData = appState.cachedData[appState.selectedUnit];
        rebuildPlayerIndex();
        renderUsers();
        updateFreshnessIndicator();
      }
      fetchApiData(false, appState.selectedUnit, false);
    });
  });

  // --- Selector de modo ---
  document.querySelectorAll('[data-mode]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      document.querySelectorAll('[data-mode]').forEach(b => b.classList.remove('active'));
      e.currentTarget.classList.add('active');
      appState.selectedMode = e.currentTarget.dataset.mode;
      renderUsers();
    });
  });

  // --- Selector de orden ---
  document.querySelectorAll('[data-order]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      document.querySelectorAll('[data-order]').forEach(b => b.classList.remove('active'));
      e.currentTarget.classList.add('active');
      appState.ordenActual = e.currentTarget.dataset.order;
      renderUsers();
    });
  });

  // --- Prioridad táctica ---
  smartSortToggle.addEventListener('change', (e) => {
    appState.smartSort = e.target.checked;
    renderUsers();
  });

  // --- Refresco manual ---
  refreshBtn.addEventListener('click', () => refreshAllUnits(true, false));

  // --- Resize ---
  let resizeTimeout;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(() => {
      if (!appState.eleccionManual) {
        determinarVistaAutomatica();
        renderUsers();
      }
    }, 300);
  });
}

// ===== FUNCIONES AUXILIARES =====
function cerrarSidebar() {
  sidebar.classList.remove('open');
  overlay.classList.remove('active');
}

function determinarVistaAutomatica() {
  if (appState.eleccionManual) return;
  // Móviles: compacta (más densidad). Desktop: tabla.
  appState.vistaActual = window.innerWidth <= 768 ? 'compacta' : 'tabla';
  syncVistaButtons();
}

function syncVistaButtons() {
  document.querySelectorAll('[data-vista]').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.vista === appState.vistaActual);
  });
}

function restoreViewPreference() {
  const vistaGuardada = localStorage.getItem('vistaPreferida');
  if (vistaGuardada) {
    appState.vistaActual = vistaGuardada;
    appState.eleccionManual = true;
  } else {
    determinarVistaAutomatica();
  }
  syncVistaButtons();
}

function primerRender() {
  if (appState.cachedData[appState.selectedUnit]) {
    appState.playersData = appState.cachedData[appState.selectedUnit];
    rebuildPlayerIndex();
    renderUsers();
  }
}

function rebuildPlayerIndex() {
  appState.playersById.clear();
  for (const p of appState.playersData) appState.playersById.set(p.id, p);
}

// ===== PERSISTENCIA DE CACHÉ =====
function saveCacheToStorage() {
  try {
    const cache = {
      version: CONFIG.CACHE_VERSION,
      Uchiha:   { data: appState.cachedData.Uchiha,   time: appState.lastFetchTime.Uchiha },
      Akatsuki: { data: appState.cachedData.Akatsuki, time: appState.lastFetchTime.Akatsuki }
    };
    localStorage.setItem(CONFIG.CACHE_STORAGE_KEY, JSON.stringify(cache));
  } catch (e) {
    console.warn('No se pudo guardar la caché en localStorage:', e);
  }
}

function loadCacheFromStorage() {
  try {
    const raw = localStorage.getItem(CONFIG.CACHE_STORAGE_KEY);
    if (!raw) return;
    const cache = JSON.parse(raw);

    if (cache.version !== CONFIG.CACHE_VERSION) {
      localStorage.removeItem(CONFIG.CACHE_STORAGE_KEY);
      return;
    }

    UNITS.forEach(unit => {
      const entry = cache[unit];
      if (entry && entry.data) {
        appState.cachedData[unit] = entry.data;
        appState.lastFetchTime[unit] = entry.time || 0;
      }
    });
  } catch (e) {
    console.warn('No se pudo cargar la caché desde localStorage:', e);
  }
}

// ===== TOAST =====
function mostrarNotificacion(mensaje = 'Datos estratégicos cargados', duracion = 1000, tipo = 'success') {
  if (toast._intervalo) clearInterval(toast._intervalo);

  toastMessage.textContent = mensaje;
  toast.classList.remove('success', 'error');
  toast.classList.add(tipo, 'show');
  toastBar.style.width = '100%';

  const startTime = Date.now();
  toast._intervalo = setInterval(() => {
    const elapsed = Date.now() - startTime;
    const progress = Math.max(0, 1 - elapsed / duracion);
    toastBar.style.width = (progress * 100) + '%';
    if (elapsed >= duracion) {
      clearInterval(toast._intervalo);
      toast._intervalo = null;
      toast.classList.remove('show');
    }
  }, 30);
}

// ===== INDICADOR DE FRESCURA (global) =====
function updateFreshnessIndicator() {
  if (!freshnessDot) return;

  const times = UNITS.map(u => appState.lastFetchTime[u]).filter(t => t > 0);
  if (times.length === 0) {
    freshnessDot.style.backgroundColor = '#64748b';
    freshnessDot.style.boxShadow = '0 0 8px rgba(100, 116, 139, 0.6)';
    freshnessDot.title = 'Sin datos';
    return;
  }

  const lastFetch = Math.max(...times);
  const age = Date.now() - lastFetch;
  const ratio = Math.min(1, age / CONFIG.CACHE_TTL_MS);

  let hue;
  if (ratio < 0.5) {
    hue = 142 + (30 - 142) * (ratio / 0.5);
  } else {
    hue = 30 + (0 - 30) * ((ratio - 0.5) / 0.5);
  }

  const color = `hsl(${hue}, 71%, 45%)`;
  freshnessDot.style.backgroundColor = color;
  freshnessDot.style.boxShadow = `0 0 8px ${color}`;

  const seconds = Math.floor(age / 1000);
  if (seconds < 60) {
    freshnessDot.title = `Datos frescos (hace ${seconds}s)`;
  } else {
    const min = Math.floor(seconds / 60);
    const sec = seconds % 60;
    freshnessDot.title = `Datos con ${min}m ${sec}s de antigüedad`;
  }
}

// ===== CONEXIÓN API Y CACHÉ =====
async function fetchApiData(force = false, unitArg = null, silent = false) {
  const unit = unitArg || appState.selectedUnit;
  const isDisplayedUnit = appState.selectedUnit === unit;
  const currentUnitId = unit === 'Uchiha' ? CONFIG.UNIT_UCHIHA_ID : CONFIG.UNIT_AKATSUKI_ID;
  const now = Date.now();

  if (!force &&
      appState.cachedData[unit] &&
      (now - appState.lastFetchTime[unit] < CONFIG.CACHE_TTL_MS)) {
    if (isDisplayedUnit) {
      appState.playersData = appState.cachedData[unit];
      rebuildPlayerIndex();
      renderUsers();
    }
    return;
  }

  setRefreshLoading(true);

  try {
    const { players, failures, total } = await WareraAPI.fetchUnitPlayers(currentUnitId);

    appState.cachedData[unit] = players;
    appState.lastFetchTime[unit] = Date.now();
    saveCacheToStorage();

    if (appState.selectedUnit === unit) {
      appState.playersData = players;
      rebuildPlayerIndex();
    }

    if (!silent && isDisplayedUnit) {
      if (failures > 0) {
        mostrarNotificacion(`Cargados ${total - failures}/${total} miembros`, 2200, 'success');
      } else {
        mostrarNotificacion('Datos estratégicos cargados', 1200, 'success');
      }
    }
  } catch (error) {
    console.error(`Error consultando API (${unit}):`, error);

    if (appState.cachedData[unit] && appState.selectedUnit === unit) {
      appState.playersData = appState.cachedData[unit];
      rebuildPlayerIndex();
      if (!silent) mostrarNotificacion('Sin conexión. Mostrando datos guardados.', 3500, 'error');
    } else if (!appState.cachedData[unit] && isDisplayedUnit) {
      if (!silent) mostrarNotificacion('Error conectando con la API. Intenta más tarde.', 3500, 'error');
    }
  } finally {
    setRefreshLoading(false);
    if (isDisplayedUnit) {
      renderUsers();
      updateFreshnessIndicator();
    }
  }
}

/**
 * Refresca AMBAS unidades en paralelo.
 *  - force: ignora el TTL de caché.
 *  - silent: no muestra toast de éxito (para el auto-refresco).
 */
async function refreshAllUnits(force = true, silent = false) {
  await Promise.allSettled(UNITS.map(u => fetchApiData(force, u, silent)));
}

function setRefreshLoading(isLoading) {
  pendingFetches += isLoading ? 1 : -1;
  if (pendingFetches < 0) pendingFetches = 0;

  if (pendingFetches > 0) {
    refreshBtn.innerText = CONFIG.REFRESH_BTN_LOADING;
    refreshBtn.disabled = true;
  } else {
    refreshBtn.innerText = CONFIG.REFRESH_BTN_IDLE;
    refreshBtn.disabled = false;
  }
}

// ===== FILTRADO Y ORDENAMIENTO =====
function getFilteredAndSortedPlayers() {
  let list = [...appState.playersData];

  if (appState.selectedMode !== 'ALL') {
    list = list.filter(p => p.modo === appState.selectedMode);
  }

  if (appState.smartSort) {
    return list
      .filter(p => p.pillStatus === 'BUFF')
      .sort((a, b) => {
        if (a.isCombatReady !== b.isCombatReady) return b.isCombatReady - a.isCombatReady;
        if (a.pillRemainingMs !== b.pillRemainingMs) return a.pillRemainingMs - b.pillRemainingMs;
        const scoreA = a.health + a.hunger * 10;
        const scoreB = b.health + b.hunger * 10;
        return scoreB - scoreA;
      });
  }

  if (appState.ordenActual === 'alfabetico') {
    list.sort((a, b) => a.name.localeCompare(b.name));
    return list;
  }

  const resourceScore = (p) => p.health + p.hunger * 10;

  list.sort((a, b) => {
    if (a.pillStatus === 'BUFF'    && b.pillStatus !== 'BUFF')    return -1;
    if (a.pillStatus !== 'BUFF'    && b.pillStatus === 'BUFF')    return  1;
    if (a.pillStatus === 'STANDBY' && b.pillStatus !== 'STANDBY') return -1;
    if (a.pillStatus !== 'STANDBY' && b.pillStatus === 'STANDBY') return  1;
    if (a.pillStatus === 'DEBUFF'  && b.pillStatus !== 'DEBUFF')  return  1;
    if (a.pillStatus !== 'DEBUFF'  && b.pillStatus === 'DEBUFF')  return -1;

    if (a.pillStatus === 'BUFF') {
      if (a.pillRemainingMs !== b.pillRemainingMs) return a.pillRemainingMs - b.pillRemainingMs;
      return resourceScore(b) - resourceScore(a);
    }
    if (a.pillStatus === 'STANDBY') {
      if (resourceScore(a) !== resourceScore(b)) return resourceScore(b) - resourceScore(a);
      return a.name.localeCompare(b.name);
    }
    if (a.pillStatus === 'DEBUFF') {
      return a.pillRemainingMs - b.pillRemainingMs;
    }
    return 0;
  });
  return list;
}

// ===== RENDERIZADO PRINCIPAL =====
function renderUsers() {
  const players = getFilteredAndSortedPlayers();

  if (players.length === 0) {
    renderEmptyState();
  } else if (appState.vistaActual === 'tabla') {
    renderTabla(players);
  } else if (appState.vistaActual === 'compacta') {
    renderCompacta(players);
  } else {
    renderTarjetas(players);
  }

  actualizarTemporizadores();
}

function renderEmptyState() {
  const motivo = appState.smartSort
    ? 'No hay jugadores con BUFF activo en este momento.'
    : 'No hay jugadores que coincidan con los filtros actuales.';
  usersContainer.innerHTML = `
    <div class="empty-state">
      <div class="empty-state-icon">🕵️</div>
      <p>${motivo}</p>
    </div>
  `;
}

// ===== RENDERIZADO: TABLA =====
function renderTabla(players) {
  const rows = players.map((p, index) => {
    const statusHtml = getStatusHtml(p);
    const modoBadge  = p.modo === 'WAR'
      ? `<span class="badge-mode badge-war">WAR</span>`
      : `<span class="badge-mode badge-eco">ECO</span>`;
    const healthPct  = p.healthMax > 0 ? Math.min(100, (p.health / p.healthMax) * 100) : 0;
    const hungerPct  = p.hungerMax > 0 ? Math.min(100, (p.hunger / p.hungerMax) * 100) : 0;
    const rowClass   = p.isCombatReady ? '' : 'out-of-combat';
    const safeName   = encodeURIComponent(p.name);

    return `
      <tr class="${rowClass}" style="animation-delay: ${index * 0.05}s">
        <td>
          <div class="player-info">
            <img src="${p.avatarUrl}" class="avatar" alt="" loading="lazy"
                 onerror="this.onerror=null;this.src='https://ui-avatars.com/api/?name=${safeName}&background=334155&color=fff'">
            <strong>${p.name}</strong>
          </div>
        </td>
        <td>${statusHtml}</td>
        <td>
          <div class="stat-text">${p.health} / ${p.healthMax} HP</div>
          <div class="progress-bg"><div class="progress-fill health-fill" style="width: ${healthPct}%"></div></div>
        </td>
        <td>
          <div class="stat-text">${p.hunger} / ${p.hungerMax}</div>
          <div class="progress-bg"><div class="progress-fill hunger-fill" style="width: ${hungerPct}%"></div></div>
        </td>
        <td>${modoBadge}</td>
      </tr>`;
  }).join('');

  usersContainer.innerHTML = `
    <table class="vista-tabla">
      <thead>
        <tr>
          <th>Jugador</th>
          <th>Estado</th>
          <th style="width:15%;">Vida</th>
          <th style="width:15%;">Hambre</th>
          <th>Modo</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>`;
}

// ===== RENDERIZADO: TARJETAS =====
function renderTarjetas(players) {
  const cards = players.map((p, index) => {
    const statusHtml = getStatusHtml(p);
    const modoBadge  = p.modo === 'WAR'
      ? `<span class="modo-badge war">WAR</span>`
      : `<span class="modo-badge eco">ECO</span>`;
    const healthPct = p.healthMax > 0 ? Math.min(100, (p.health / p.healthMax) * 100) : 0;
    const hungerPct = p.hungerMax > 0 ? Math.min(100, (p.hunger / p.hungerMax) * 100) : 0;
    const estadoClass = p.pillStatus.toLowerCase();
    const safeName = encodeURIComponent(p.name);

    return `
      <div class="tarjeta-usuario ${estadoClass}" style="animation-delay: ${index * 0.05}s">
        <div class="player-info">
          <img src="${p.avatarUrl}" class="avatar" alt="" loading="lazy"
               onerror="this.onerror=null;this.src='https://ui-avatars.com/api/?name=${safeName}&background=334155&color=fff'">
          <span class="player-name">${p.name}</span>
          ${modoBadge}
        </div>
        <div class="stat-row">
          <span class="stat-text">Vida: ${p.health} / ${p.healthMax} HP</span>
          <div class="progress-bg"><div class="progress-fill health-fill" style="width: ${healthPct}%"></div></div>
        </div>
        <div class="stat-row">
          <span class="stat-text">Hambre: ${p.hunger} / ${p.hungerMax}</span>
          <div class="progress-bg"><div class="progress-fill hunger-fill" style="width: ${hungerPct}%"></div></div>
        </div>
        <div class="status-row">${statusHtml}</div>
      </div>`;
  }).join('');

  usersContainer.innerHTML = `<div class="vista-tarjetas">${cards}</div>`;
}

// ===== RENDERIZADO: COMPACTA (mini-tarjetas densas) =====
function renderCompacta(players) {
  const cards = players.map((p, index) => {
    const healthPct = p.healthMax > 0 ? Math.min(100, (p.health / p.healthMax) * 100) : 0;
    const hungerPct = p.hungerMax > 0 ? Math.min(100, (p.hunger / p.hungerMax) * 100) : 0;
    const estadoClass = p.pillStatus.toLowerCase();
    const safeName = encodeURIComponent(p.name);
    const shortName = p.name.length > 12 ? p.name.slice(0, 11) + '…' : p.name;

    let statusMini;
    if (p.pillStatus === 'BUFF') {
      statusMini = `<span class="status-dot dot-buff"></span><span class="timer-text" data-player-id="${p.id}">${formatTimer(p.pillRemainingMs)}</span>`;
    } else if (p.pillStatus === 'DEBUFF') {
      statusMini = `<span class="status-dot dot-debuff"></span><span class="timer-text" data-player-id="${p.id}">${formatTimer(p.pillRemainingMs)}</span>`;
    } else {
      statusMini = `<span class="status-dot dot-standby"></span><span class="mini-standby">ESPERA</span>`;
    }

    return `
      <div class="mini-card ${estadoClass}" style="animation-delay: ${index * 0.02}s">
        <div class="mini-top">
          <img src="${p.avatarUrl}" class="mini-avatar" alt="" loading="lazy"
               onerror="this.onerror=null;this.src='https://ui-avatars.com/api/?name=${safeName}&background=334155&color=fff'">
          <span class="mini-name" title="${p.name}">${shortName}</span>
        </div>
        <div class="mini-bar-row">
          <span class="mini-label">HP</span>
          <div class="mini-bar"><div class="mini-fill health-fill" style="width:${healthPct}%"></div></div>
          <span class="mini-value">${p.health}</span>
        </div>
        <div class="mini-bar-row">
          <span class="mini-label">FD</span>
          <div class="mini-bar"><div class="mini-fill hunger-fill" style="width:${hungerPct}%"></div></div>
          <span class="mini-value">${p.hunger}</span>
        </div>
        <div class="mini-status">${statusMini}</div>
      </div>
    `;
  }).join('');

  usersContainer.innerHTML = `<div class="vista-compacta">${cards}</div>`;
}

// ===== UTILIDADES: ESTADO Y TEMPORIZADORES =====
function getStatusHtml(player) {
  if (player.pillStatus === 'BUFF') {
    return `<span class="status-dot dot-buff"></span> <span class="pill-badge buff">BUFF</span> <span class="timer-text" data-player-id="${player.id}">${formatTimer(player.pillRemainingMs)}</span>`;
  }
  if (player.pillStatus === 'DEBUFF') {
    return `<span class="status-dot dot-debuff"></span> <span class="pill-badge debuff">DEBUFF</span> <span class="timer-text" data-player-id="${player.id}">${formatTimer(player.pillRemainingMs)}</span>`;
  }
  return `<span class="status-dot dot-standby"></span> <span class="pill-badge standby">En Espera</span>`;
}

function actualizarTemporizadores() {
  document.querySelectorAll('.timer-text').forEach(el => {
    const player = appState.playersById.get(el.dataset.playerId);
    if (player && player.pillStatus !== 'STANDBY') {
      el.innerText = formatTimer(player.pillRemainingMs);
    }
  });
}

function formatTimer(ms) {
  if (!ms || ms <= 0) return '00:00:00';
  const totalSeconds = Math.floor(ms / 1000);
  const hours   = String(Math.floor(totalSeconds / 3600)).padStart(2, '0');
  const minutes = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, '0');
  const seconds = String(totalSeconds % 60).padStart(2, '0');
  return `${hours}:${minutes}:${seconds}`;
}

// ===== BUCLE DE TEMPORIZADORES =====
function startTimerLoop() {
  if (timerLoopId) return;
  timerLoopId = setInterval(() => {
    let statusChanged = false;
    const now = Date.now();

    for (const p of appState.playersData) {
      if (p.pillStatus !== 'STANDBY' && p.pillEndTime) {
        p.pillRemainingMs = p.pillEndTime - now;
        if (p.pillRemainingMs <= 0) {
          p.pillRemainingMs = 0;
          p.pillStatus = 'STANDBY';
          p.pillEndTime = null;
          statusChanged = true;
        }
      }
    }

    if (++freshnessTickCount >= CONFIG.FRESHNESS_REFRESH_EVERY_N_TICKS) {
      freshnessTickCount = 0;
      updateFreshnessIndicator();
    }

    if (statusChanged && appState.smartSort) {
      renderUsers();
    } else {
      actualizarTemporizadores();
    }
  }, 1000);
}

/**
 * Detiene los intervalos activos.
 */
function stopApp() {
  if (timerLoopId)       { clearInterval(timerLoopId);       timerLoopId = null; }
  if (refreshIntervalId) { clearInterval(refreshIntervalId); refreshIntervalId = null; }
}

window.__warroom = { stopApp, appState };