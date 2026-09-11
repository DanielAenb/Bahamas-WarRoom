/**
 * Bahamas WarRoom — Script principal.
 */

const CONFIG = {
  UNIT_UCHIHA_ID: "6997581b896745b3e1b21d0f",
  UNIT_AKATSUKI_ID: "69f542668d7015d064d4147a",
  CACHE_TTL_MS: 2 * 60 * 1000,
  CACHE_MAX_AGE_MS: 10 * 60 * 1000,
  AUTO_REFRESH_MIN_GAP_MS: 90 * 1000,
  CACHE_STORAGE_KEY: 'warera_cache_v2',
  CACHE_VERSION: 2,
  MANUAL_COOLDOWN_MS: 30 * 1000,
  RATE_LIMIT_COOLDOWN_MS: 60 * 1000,
  FRESHNESS_REFRESH_EVERY_N_TICKS: 5,
  HOLD_MS: 1000,
  CAPTURE_SCALE: 2.5,
  IMAGE_LOAD_TIMEOUT_MS: 12000
};

const UNITS = ['Uchiha', 'Akatsuki'];

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
  eleccionManual: false,
  apiStatus: 'ok',
  forceDownload: localStorage.getItem('warera_force_download') === '1'
};

const sidebar             = document.getElementById('apiSidebar');
const overlay             = document.getElementById('overlay');
const openApiBtn          = document.getElementById('openApiBtn');
const closeApiBtn         = document.getElementById('closeApiBtn');
const copyCaptureBtn      = document.getElementById('copyCaptureBtn');
const apiKeyInput         = document.getElementById('apiKeyInput');
const saveKeyBtn          = document.getElementById('saveKeyBtn');
const clearKeyBtn         = document.getElementById('clearKeyBtn');
const forceDownloadToggle = document.getElementById('forceDownloadToggle');
const refreshBtn          = document.getElementById('refreshDataBtn');
const refreshDataLabel    = document.getElementById('refreshDataLabel');
const refreshDataProgress = document.getElementById('refreshDataProgress');
const smartSortToggle     = document.getElementById('smartSortToggle');
const usersContainer      = document.getElementById('usersContainer');
const apiBanner           = document.getElementById('apiBanner');
const apiBannerText       = document.getElementById('apiBannerText');
const toast               = document.getElementById('toast');
const toastMessage        = document.getElementById('toastMessage');
const toastBar            = document.getElementById('toastBar');
const freshnessDot        = document.getElementById('freshnessDot');

let refreshIntervalId  = null;
let timerLoopId        = null;
let freshnessTickCount = 0;
let pendingFetches     = 0;

let rateLimitedUntil = 0;
let refreshInFlight  = false;

const refreshCooldown = {
  until: 0,
  total: CONFIG.MANUAL_COOLDOWN_MS
};

// ===== INICIALIZACIÓN =====
document.addEventListener('DOMContentLoaded', () => {
  loadCacheFromStorage();
  bindUiEvents();
  restoreViewPreference();
  primerRender();

  refreshAllUnits(false, false, { startCooldown: true });
  updateFreshnessIndicator();
  updateRefreshButton();
  startTimerLoop();

  refreshIntervalId = setInterval(() => {
    const lastAny = Math.max(...UNITS.map(u => appState.lastFetchTime[u] || 0));
    if (Date.now() - lastAny < CONFIG.AUTO_REFRESH_MIN_GAP_MS) return;
    refreshAllUnits(true, true);
  }, CONFIG.CACHE_TTL_MS);
});

function bindUiEvents() {
  openApiBtn.addEventListener('click', () => {
    sidebar.classList.add('open');
    overlay.classList.add('active');
  });
  closeApiBtn.addEventListener('click', cerrarSidebar);
  overlay.addEventListener('click', cerrarSidebar);

  if (apiKeyInput) apiKeyInput.value = localStorage.getItem('warera_api_key') || '';

  if (forceDownloadToggle) {
    forceDownloadToggle.checked = appState.forceDownload;
    forceDownloadToggle.addEventListener('change', (e) => {
      appState.forceDownload = e.target.checked;
      localStorage.setItem('warera_force_download', appState.forceDownload ? '1' : '0');
      mostrarNotificacion(
        appState.forceDownload
          ? 'Capturas se descargarán como PNG.'
          : 'Capturas usarán el mejor método disponible.',
        1500,
        'success'
      );
    });
  }

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
      rateLimitedUntil = 0;
      refreshCooldown.until = 0;
      refreshAllUnits(true, false, { startCooldown: true });
      cerrarSidebar();
    });
  }

  if (clearKeyBtn) {
    clearKeyBtn.addEventListener('click', () => {
      localStorage.removeItem('warera_api_key');
      if (apiKeyInput) apiKeyInput.value = '';
      mostrarNotificacion('API Key borrada.', 1500, 'success');
      rateLimitedUntil = 0;
      refreshCooldown.until = 0;
      refreshAllUnits(true, false, { startCooldown: true });
    });
  }

  document.querySelectorAll('[data-vista]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      document.querySelectorAll('[data-vista]').forEach(b => b.classList.remove('active'));
      e.currentTarget.classList.add('active');
      appState.vistaActual = e.currentTarget.dataset.vista;
      appState.eleccionManual = true;
      localStorage.setItem('vistaPreferida', appState.vistaActual);
      renderUsers();
      cerrarSidebar();
    });
  });

  document.querySelectorAll('[data-unit]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      document.querySelectorAll('[data-unit]').forEach(b => b.classList.remove('active'));
      e.currentTarget.classList.add('active');
      appState.selectedUnit = e.currentTarget.dataset.unit;

      if (appState.cachedData[appState.selectedUnit]) {
        appState.playersData = appState.cachedData[appState.selectedUnit];
        rebuildPlayerIndex();
      }
      renderUsers();
      updateFreshnessIndicator();
      fetchApiData(false, appState.selectedUnit, false);
    });
  });

  document.querySelectorAll('[data-mode]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      document.querySelectorAll('[data-mode]').forEach(b => b.classList.remove('active'));
      e.currentTarget.classList.add('active');
      appState.selectedMode = e.currentTarget.dataset.mode;
      renderUsers();
    });
  });

  document.querySelectorAll('[data-order]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      document.querySelectorAll('[data-order]').forEach(b => b.classList.remove('active'));
      e.currentTarget.classList.add('active');
      appState.ordenActual = e.currentTarget.dataset.order;
      renderUsers();
    });
  });

  smartSortToggle.addEventListener('change', (e) => {
    appState.smartSort = e.target.checked;
    renderUsers();
  });

  refreshBtn.addEventListener('click', () => {
    if (refreshBtn.disabled) return;
    refreshAllUnits(true, false, { startCooldown: true });
  });

  copyCaptureBtn.addEventListener('click', copyCurrentCapture);

  initPressToCapture();

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

function cerrarSidebar() {
  sidebar.classList.remove('open');
  overlay.classList.remove('active');
}

function determinarVistaAutomatica() {
  if (appState.eleccionManual) return;
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

// ===== PERSISTENCIA =====
function saveCacheToStorage() {
  try {
    const cache = {
      version: CONFIG.CACHE_VERSION,
      Uchiha:   { data: appState.cachedData.Uchiha,   time: appState.lastFetchTime.Uchiha },
      Akatsuki: { data: appState.cachedData.Akatsuki, time: appState.lastFetchTime.Akatsuki }
    };
    localStorage.setItem(CONFIG.CACHE_STORAGE_KEY, JSON.stringify(cache));
  } catch (e) { console.warn('No se pudo guardar la caché:', e); }
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
  } catch (e) { console.warn('No se pudo cargar la caché:', e); }
}

// ===== TOAST =====
function mostrarNotificacion(mensaje = 'Información estratégica cargada', duracion = 1000, tipo = 'success') {
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

// ===== FRESCURA =====
function updateFreshnessIndicator() {
  if (!freshnessDot) return;

  if (Date.now() < rateLimitedUntil) {
    freshnessDot.style.backgroundColor = '#f59e0b';
    freshnessDot.style.boxShadow = '0 0 8px #f59e0b';
    const remaining = Math.ceil((rateLimitedUntil - Date.now()) / 1000);
    freshnessDot.title = `Límite de API alcanzado. Reintento en ${remaining}s`;
    return;
  }

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
  if (ratio < 0.5) hue = 142 + (30 - 142) * (ratio / 0.5);
  else             hue = 30 + (0 - 30) * ((ratio - 0.5) / 0.5);

  const color = `hsl(${hue}, 71%, 45%)`;
  freshnessDot.style.backgroundColor = color;
  freshnessDot.style.boxShadow = `0 0 8px ${color}`;
  const seconds = Math.floor(age / 1000);
  freshnessDot.title = seconds < 60
    ? `Datos frescos (hace ${seconds}s)`
    : `Datos con ${Math.floor(seconds / 60)}m ${seconds % 60}s de antigüedad`;
}

// ===== BOTÓN DE REFRESH =====
function updateRefreshButton() {
  const now = Date.now();
  const inCooldown = now < refreshCooldown.until;
  const isLoading = pendingFetches > 0;

  if (isLoading) {
    refreshBtn.disabled = true;
    refreshBtn.classList.remove('cooldown');
    refreshDataLabel.textContent = '⏳ Cargando...';
    refreshDataProgress.style.width = '0%';
    return;
  }

  if (inCooldown) {
    const remaining = refreshCooldown.until - now;
    const pct = Math.max(0, Math.min(100, (remaining / refreshCooldown.total) * 100));
    refreshBtn.disabled = true;
    refreshBtn.classList.add('cooldown');
    refreshDataLabel.textContent = `⏳ Espera ${Math.ceil(remaining / 1000)}s`;
    refreshDataProgress.style.width = pct + '%';
    return;
  }

  refreshBtn.disabled = false;
  refreshBtn.classList.remove('cooldown');
  refreshDataLabel.textContent = '🔄 Actualizar Datos';
  refreshDataProgress.style.width = '0%';
}

// ===== BANNER DE ESTADO =====
function updateApiBanner() {
  if (!apiBanner) return;

  const mainState = decideMainState();

  if (mainState !== 'data') {
    apiBanner.hidden = true;
    return;
  }

  if (appState.apiStatus === 'limited') {
    apiBanner.hidden = false;
    apiBanner.className = 'api-banner limited';
    apiBannerText.textContent = '⚠️ API AL LÍMITE · INFO DE CACHÉ';
    return;
  }

  if (appState.apiStatus === 'error') {
    const unit = appState.selectedUnit;
    const lastFetch = appState.lastFetchTime[unit];
    const cacheAge = lastFetch ? Date.now() - lastFetch : 0;
    const min = Math.floor(cacheAge / 60000);
    const sec = Math.floor((cacheAge % 60000) / 1000);
    const ageTxt = min > 0 ? `${min}m ${sec}s` : `${sec}s`;
    apiBanner.hidden = false;
    apiBanner.className = 'api-banner error';
    apiBannerText.textContent = `⚠️ API NO DISPONIBLE · INFO DE CACHÉ (${ageTxt})`;
    return;
  }

  apiBanner.hidden = true;
}

// ===== DECISIÓN DE ESTADO =====
function decideMainState() {
  const unit = appState.selectedUnit;
  const lastFetch = appState.lastFetchTime[unit];
  const cacheAge = lastFetch ? Date.now() - lastFetch : Infinity;
  const apiDown = appState.apiStatus === 'limited' || appState.apiStatus === 'error';
  const cacheExpired = cacheAge > CONFIG.CACHE_MAX_AGE_MS;
  const hasData = appState.playersData.length > 0;

  if (apiDown && (!hasData || cacheExpired)) return 'api-down';
  if (hasData) return 'data';
  if (appState.apiStatus === 'loading') return 'loading';
  return 'empty';
}

// ===== API =====
async function fetchApiData(force = false, unitArg = null, silent = false) {
  const unit = unitArg || appState.selectedUnit;
  const isDisplayedUnit = appState.selectedUnit === unit;
  const currentUnitId = unit === 'Uchiha' ? CONFIG.UNIT_UCHIHA_ID : CONFIG.UNIT_AKATSUKI_ID;
  const now = Date.now();

  if (!force && now < rateLimitedUntil) {
    if (isDisplayedUnit && appState.cachedData[unit]) {
      appState.playersData = appState.cachedData[unit];
      rebuildPlayerIndex();
      renderUsers();
    }
    return 'limited';
  }

  if (!force && appState.cachedData[unit] && (now - appState.lastFetchTime[unit] < CONFIG.CACHE_TTL_MS)) {
    if (isDisplayedUnit) {
      appState.playersData = appState.cachedData[unit];
      rebuildPlayerIndex();
      renderUsers();
    }
    return 'ok';
  }

  setRefreshLoading(true);

  try {
    const { players, failures, total, rateLimited } = await WareraAPI.fetchUnitPlayers(currentUnitId);

    appState.cachedData[unit] = players;
    appState.lastFetchTime[unit] = Date.now();
    saveCacheToStorage();

    if (appState.selectedUnit === unit) {
      appState.playersData = players;
      rebuildPlayerIndex();
    }

    if (!silent && isDisplayedUnit) {
      if (rateLimited) {
        mostrarNotificacion(`⚠️ Límite de API · ${players.length}/${total} cargados`, 3500, 'error');
      } else if (failures > 0) {
        mostrarNotificacion(`⚠️ ${total - failures}/${total} cargados`, 2500, 'error');
      } else {
        mostrarNotificacion('Información estratégica cargada', 1200, 'success');
      }
    }

    return rateLimited ? 'limited' : 'ok';
  } catch (error) {
    const isRateLimit = error.name === 'RateLimitError';

    if (isRateLimit) {
      rateLimitedUntil = Date.now() + CONFIG.RATE_LIMIT_COOLDOWN_MS;
      console.warn(`Rate limit en ${unit}. Cooldown ${CONFIG.RATE_LIMIT_COOLDOWN_MS / 1000}s.`);

      if (appState.cachedData[unit] && appState.selectedUnit === unit) {
        appState.playersData = appState.cachedData[unit];
        rebuildPlayerIndex();
        if (!silent) mostrarNotificacion('⚠️ Límite de API. Mostrando datos guardados.', 4000, 'error');
      } else if (!silent && isDisplayedUnit) {
        mostrarNotificacion('⚠️ Límite de API. Espera ~1 minuto.', 4000, 'error');
      }
      return 'limited';
    }

    console.error(`Error consultando API (${unit}):`, error);
    if (appState.cachedData[unit] && appState.selectedUnit === unit) {
      appState.playersData = appState.cachedData[unit];
      rebuildPlayerIndex();
      if (!silent) mostrarNotificacion('Sin conexión. Mostrando datos guardados.', 3500, 'error');
    } else if (!appState.cachedData[unit] && isDisplayedUnit) {
      if (!silent) mostrarNotificacion('Error conectando con la API. Intenta más tarde.', 3500, 'error');
    }
    return 'error';
  } finally {
    setRefreshLoading(false);
    if (isDisplayedUnit) {
      renderUsers();
      updateFreshnessIndicator();
    }
  }
}

async function refreshAllUnits(force = true, silent = false, options = {}) {
  if (refreshInFlight) return;
  refreshInFlight = true;

  const { startCooldown = false } = options;

  if (!silent) {
    appState.apiStatus = 'loading';
    renderUsers();
  }

  try {
    const settled = await Promise.allSettled(
      UNITS.map(u => fetchApiData(force, u, silent))
    );

    const statuses = settled
      .filter(r => r.status === 'fulfilled')
      .map(r => r.value);

    let worst = 'ok';
    for (const s of statuses) {
      if (s === 'error') { worst = 'error'; break; }
      if (s === 'limited') worst = 'limited';
    }
    if (settled.some(r => r.status === 'rejected')) worst = 'error';

    appState.apiStatus = worst;
  } finally {
    if (startCooldown) {
      refreshCooldown.until = Date.now() + CONFIG.MANUAL_COOLDOWN_MS;
    }
    refreshInFlight = false;
    renderUsers();
    updateRefreshButton();
    updateFreshnessIndicator();
  }
}

function setRefreshLoading(isLoading) {
  pendingFetches += isLoading ? 1 : -1;
  if (pendingFetches < 0) pendingFetches = 0;
  updateRefreshButton();
}

// ===== FILTRADO / ORDEN =====
function getFilteredAndSortedPlayers() {
  let list = [...appState.playersData];
  if (appState.selectedMode !== 'ALL') list = list.filter(p => p.modo === appState.selectedMode);

  if (appState.smartSort) {
    return list.filter(p => p.pillStatus === 'BUFF').sort((a, b) => {
      if (a.isCombatReady !== b.isCombatReady) return b.isCombatReady - a.isCombatReady;
      if (a.pillRemainingMs !== b.pillRemainingMs) return a.pillRemainingMs - b.pillRemainingMs;
      return (b.health + b.hunger * 10) - (a.health + a.hunger * 10);
    });
  }

  if (appState.ordenActual === 'alfabetico') {
    list.sort((a, b) => a.name.localeCompare(b.name));
    return list;
  }

  const score = (p) => p.health + p.hunger * 10;
  list.sort((a, b) => {
    if (a.pillStatus === 'BUFF'    && b.pillStatus !== 'BUFF')    return -1;
    if (a.pillStatus !== 'BUFF'    && b.pillStatus === 'BUFF')    return  1;
    if (a.pillStatus === 'STANDBY' && b.pillStatus !== 'STANDBY') return -1;
    if (a.pillStatus !== 'STANDBY' && b.pillStatus === 'STANDBY') return  1;
    if (a.pillStatus === 'DEBUFF'  && b.pillStatus !== 'DEBUFF')  return  1;
    if (a.pillStatus !== 'DEBUFF'  && b.pillStatus === 'DEBUFF')  return -1;

    if (a.pillStatus === 'BUFF') {
      if (a.pillRemainingMs !== b.pillRemainingMs) return a.pillRemainingMs - b.pillRemainingMs;
      return score(b) - score(a);
    }
    if (a.pillStatus === 'STANDBY') {
      if (score(a) !== score(b)) return score(b) - score(a);
      return a.name.localeCompare(b.name);
    }
    if (a.pillStatus === 'DEBUFF') return a.pillRemainingMs - b.pillRemainingMs;
    return 0;
  });
  return list;
}

// ===== RENDER =====
function renderUsers() {
  if (pressState) return;
  updateApiBanner();

  const state = decideMainState();

  if (state === 'api-down') { renderApiDown(); return; }
  if (state === 'loading')  { renderLoading(); return; }
  if (state === 'empty')    { renderEmptyState(); return; }

  const players = getFilteredAndSortedPlayers();
  if (players.length === 0) { renderEmptyState(); return; }

  if (appState.vistaActual === 'tabla') renderTabla(players);
  else if (appState.vistaActual === 'compacta') renderCompacta(players);
  else renderTarjetas(players);

  actualizarTemporizadores();
}

function renderApiDown() {
  usersContainer.innerHTML = `
    <div class="empty-state api-down">
      <div class="empty-state-icon">📡</div>
      <p class="api-down-title">API NO DISPONIBLE</p>
      <p class="api-down-sub">No se pudieron cargar datos y la caché es demasiado antigua.</p>
    </div>`;
}

function renderLoading() {
  usersContainer.innerHTML = `
    <div class="empty-state loading">
      <div class="empty-state-icon">⏳</div>
      <p>Cargando información…</p>
    </div>`;
}

function renderEmptyState() {
  const motivo = appState.smartSort
    ? 'No hay jugadores con BUFF activo en este momento.'
    : 'No hay jugadores que coincidan con los filtros actuales.';
  usersContainer.innerHTML = `
    <div class="empty-state">
      <div class="empty-state-icon">🕵️</div>
      <p>${motivo}</p>
    </div>`;
}

function renderTabla(players) {
  const rows = players.map((p, index) => {
    const statusHtml = getStatusHtml(p);
    const modoBadge = p.modo === 'WAR'
      ? `<span class="badge-mode badge-war">WAR</span>`
      : `<span class="badge-mode badge-eco">ECO</span>`;
    const healthPct = p.healthMax > 0 ? Math.min(100, (p.health / p.healthMax) * 100) : 0;
    const hungerPct = p.hungerMax > 0 ? Math.min(100, (p.hunger / p.hungerMax) * 100) : 0;
    const rowClass = p.isCombatReady ? '' : 'out-of-combat';
    const safeName = encodeURIComponent(p.name);

    return `
      <tr class="${rowClass}" data-copy-player="${p.id}" style="animation-delay: ${index * 0.05}s">
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

function renderTarjetas(players) {
  const cards = players.map((p, index) => {
    const statusHtml = getStatusHtml(p);
    const modoBadge = p.modo === 'WAR'
      ? `<span class="modo-badge war">WAR</span>`
      : `<span class="modo-badge eco">ECO</span>`;
    const healthPct = p.healthMax > 0 ? Math.min(100, (p.health / p.healthMax) * 100) : 0;
    const hungerPct = p.hungerMax > 0 ? Math.min(100, (p.hunger / p.hungerMax) * 100) : 0;
    const estadoClass = p.pillStatus.toLowerCase();
    const safeName = encodeURIComponent(p.name);

    return `
      <div class="tarjeta-usuario ${estadoClass}" data-copy-player="${p.id}" style="animation-delay: ${index * 0.05}s">
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
      statusMini = `<span class="status-dot dot-standby"></span><span class="mini-standby">STBY</span>`;
    }

    return `
      <div class="mini-card ${estadoClass}" data-copy-player="${p.id}" style="animation-delay: ${index * 0.02}s">
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
      </div>`;
  }).join('');

  usersContainer.innerHTML = `<div class="vista-compacta">${cards}</div>`;
}

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

    updateRefreshButton();

    if (++freshnessTickCount >= CONFIG.FRESHNESS_REFRESH_EVERY_N_TICKS) {
      freshnessTickCount = 0;
      updateFreshnessIndicator();
      updateApiBanner();
    }

    if (statusChanged && appState.smartSort && !pressState) renderUsers();
    else actualizarTemporizadores();
  }, 1000);
}

function stopApp() {
  if (timerLoopId)       { clearInterval(timerLoopId);       timerLoopId = null; }
  if (refreshIntervalId) { clearInterval(refreshIntervalId); refreshIntervalId = null; }
}

// ================================================================
// ===== CAPTURA COMO IMAGEN ======================================
// ================================================================

const CAPTURE = {
  FONT: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  MONO: '"Courier New", monospace',
  C: {
    base: '#0e0e0e',
    separator: 'rgba(255, 255, 255, 0.10)',
    title: '#ffffff',
    titleAccent: '#00b1ff',
    subtitle: '#94a3b8',
    name: '#ffffff',
    label: '#8b95a3',
    value: '#e2e8f0',
    footer: '#64748b',
    buff: '#22c55e',
    debuff: '#ef4444',
    standby: '#818fa3',
    hpFill: '#22c55e',
    fdFill: '#f97316',
    barBg: 'rgba(255, 255, 255, 0.10)',
    badgeWarBg: 'rgba(239, 68, 68, 0.20)',
    badgeWarText: '#fca5a5',
    badgeWarBorder: 'rgba(239, 68, 68, 0.55)',
    badgeEcoBg: 'rgba(34, 197, 94, 0.20)',
    badgeEcoText: '#86efac',
    badgeEcoBorder: 'rgba(34, 197, 94, 0.55)'
  }
};

function computeCaptureBg(buffCount, debuffCount) {
  const BASE = [14, 14, 14];
  const active = buffCount + debuffCount;

  if (active <= 3) {
    return { start: `rgb(${BASE.join(',')})`, end: `rgb(${BASE.join(',')})` };
  }

  const strength = Math.min(1, (active - 3) / 15) * 0.10;
  const isGreen = buffCount >= debuffCount;
  const tint = isGreen ? [34, 197, 94] : [239, 68, 68];

  const end = [
    Math.round(BASE[0] + (tint[0] - BASE[0]) * strength),
    Math.round(BASE[1] + (tint[1] - BASE[1]) * strength),
    Math.round(BASE[2] + (tint[2] - BASE[2]) * strength)
  ];

  return { start: `rgb(${BASE.join(',')})`, end: `rgb(${end.join(',')})` };
}

function computePlayerCaptureBg(player) {
  const BASE = [14, 14, 14];
  if (player.pillStatus === 'STANDBY') {
    return { start: `rgb(${BASE.join(',')})`, end: `rgb(${BASE.join(',')})` };
  }
  const tint = player.pillStatus === 'BUFF' ? [34, 197, 94] : [239, 68, 68];
  const strength = 0.15;
  const end = [
    Math.round(BASE[0] + (tint[0] - BASE[0]) * strength),
    Math.round(BASE[1] + (tint[1] - BASE[1]) * strength),
    Math.round(BASE[2] + (tint[2] - BASE[2]) * strength)
  ];
  return { start: `rgb(${BASE.join(',')})`, end: `rgb(${end.join(',')})` };
}

function fillCaptureBg(ctx, w, h, colors) {
  const grad = ctx.createLinearGradient(0, 0, w, h);
  grad.addColorStop(0, colors.start);
  grad.addColorStop(0.45, colors.start);
  grad.addColorStop(1, colors.end);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);
}

function roundRect(ctx, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

/**
 * Carga una imagen lista para dibujar en <canvas>.
 * Estrategia doble: primero el proxy con CORS garantizado,
 * luego el original con crossOrigin (por si el CDN lo permite).
 */
async function loadImage(primaryUrl, fallbackUrl = null, timeoutMs = CONFIG.IMAGE_LOAD_TIMEOUT_MS) {
  const tryLoad = async (url) => {
    if (!url) return null;

    // Intento 1: fetch + blob URL (evita tainting)
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      const res = await fetch(url, { mode: 'cors', signal: controller.signal });
      clearTimeout(timer);
      if (res.ok) {
        const blob = await res.blob();
        const objUrl = URL.createObjectURL(blob);
        const img = await new Promise((resolve) => {
          const i = new Image();
          i.onload = () => resolve(i);
          i.onerror = () => resolve(null);
          i.src = objUrl;
        });
        URL.revokeObjectURL(objUrl);
        if (img) return img;
      }
    } catch (_) {}

    // Intento 2: <img crossOrigin='anonymous'> directo
    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      let settled = false;
      const timer = setTimeout(() => {
        if (settled) return;
        settled = true;
        resolve(null);
      }, timeoutMs);
      img.onload = () => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve(img);
      };
      img.onerror = () => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve(null);
      };
      img.src = url;
    });
  };

  let img = await tryLoad(primaryUrl);
  if (!img && fallbackUrl && fallbackUrl !== primaryUrl) {
    img = await tryLoad(fallbackUrl);
  }
  return img;
}

function truncateText(ctx, text, maxWidth) {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let t = text;
  while (t.length > 0 && ctx.measureText(t + '…').width > maxWidth) t = t.slice(0, -1);
  return t + '…';
}

function drawAvatar(ctx, img, player, cx, cy, radius) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.closePath();
  ctx.clip();
  if (img) {
    ctx.drawImage(img, cx - radius, cy - radius, radius * 2, radius * 2);
  } else {
    ctx.fillStyle = '#334155';
    ctx.fillRect(cx - radius, cy - radius, radius * 2, radius * 2);
    ctx.fillStyle = '#ffffff';
    ctx.font = `bold ${Math.round(radius * 1.05)}px ${CAPTURE.FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const initial = (player.name || '?').trim().charAt(0).toUpperCase();
    ctx.fillText(initial, cx, cy + 1);
  }
  ctx.restore();
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
  ctx.lineWidth = 1.5;
  ctx.stroke();
}

function drawModoBadge(ctx, modo, x, y, size = 'md') {
  const isWar = modo === 'WAR';
  const bg     = isWar ? CAPTURE.C.badgeWarBg     : CAPTURE.C.badgeEcoBg;
  const fg     = isWar ? CAPTURE.C.badgeWarText   : CAPTURE.C.badgeEcoText;
  const border = isWar ? CAPTURE.C.badgeWarBorder : CAPTURE.C.badgeEcoBorder;

  const fontSize = size === 'sm' ? 11 : size === 'lg' ? 15 : 13;
  ctx.font = `bold ${fontSize}px ${CAPTURE.FONT}`;
  const textW = ctx.measureText(modo).width;
  const padX = size === 'lg' ? 11 : 9;
  const w = textW + padX * 2;
  const h = fontSize + 10;

  ctx.fillStyle = bg;
  roundRect(ctx, x, y - h / 2, w, h, 5);
  ctx.fill();
  ctx.strokeStyle = border;
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.fillStyle = fg;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(modo, x + padX, y + 0.5);
  return w;
}

function drawStatusInline(ctx, player, x, y, size = 'md') {
  const dotR = size === 'sm' ? 5 : size === 'lg' ? 7 : 6;
  const fontSize = size === 'sm' ? 12 : size === 'lg' ? 16 : 14;

  const color = player.pillStatus === 'BUFF' ? CAPTURE.C.buff
              : player.pillStatus === 'DEBUFF' ? CAPTURE.C.debuff
              : CAPTURE.C.standby;

  ctx.beginPath();
  ctx.arc(x, y, dotR + 3, 0, Math.PI * 2);
  ctx.fillStyle = color + '22';
  ctx.fill();
  ctx.beginPath();
  ctx.arc(x, y, dotR, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();

  let label, labelColor, timer = null;
  if (player.pillStatus === 'BUFF') {
    label = 'BUFF'; labelColor = '#4ade80';
    timer = formatTimer(player.pillRemainingMs);
  } else if (player.pillStatus === 'DEBUFF') {
    label = 'DEBUFF'; labelColor = '#f87171';
    timer = formatTimer(player.pillRemainingMs);
  } else {
    label = 'En Espera'; labelColor = '#94a3b8';
  }

  const textX = x + dotR + 10;
  ctx.font = `bold ${fontSize}px ${CAPTURE.FONT}`;
  ctx.fillStyle = labelColor;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, textX, y);

  if (timer) {
    const labelW = ctx.measureText(label).width;
    ctx.font = `bold ${fontSize}px ${CAPTURE.MONO}`;
    ctx.fillStyle = CAPTURE.C.name;
    ctx.fillText(timer, textX + labelW + 12, y);
  }
}

function drawStatusStacked(ctx, player, x, cy) {
  const color = player.pillStatus === 'BUFF' ? CAPTURE.C.buff
              : player.pillStatus === 'DEBUFF' ? CAPTURE.C.debuff
              : CAPTURE.C.standby;
  const topY = cy - 17;
  const botY = cy + 17;

  const dotR = 6;
  ctx.beginPath();
  ctx.arc(x + dotR, topY, dotR + 3, 0, Math.PI * 2);
  ctx.fillStyle = color + '22';
  ctx.fill();
  ctx.beginPath();
  ctx.arc(x + dotR, topY, dotR, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();

  let label, labelColor;
  if (player.pillStatus === 'BUFF')        { label = 'BUFF';      labelColor = '#4ade80'; }
  else if (player.pillStatus === 'DEBUFF') { label = 'DEBUFF';    labelColor = '#f87171'; }
  else                                     { label = 'En Espera'; labelColor = '#94a3b8'; }

  ctx.font = `bold 17px ${CAPTURE.FONT}`;
  ctx.fillStyle = labelColor;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, x + dotR * 2 + 10, topY);

  if (player.pillStatus !== 'STANDBY') {
    ctx.font = `bold 19px ${CAPTURE.MONO}`;
    ctx.fillStyle = CAPTURE.C.name;
    ctx.fillText(formatTimer(player.pillRemainingMs), x, botY);
  } else {
    ctx.font = `13px ${CAPTURE.FONT}`;
    ctx.fillStyle = CAPTURE.C.subtitle;
    ctx.fillText('sin efecto activo', x, botY);
  }
}

function drawStatBar(ctx, x, y, label, current, max, fillColor, barW, size = 'md') {
  const labelSize = size === 'sm' ? 10 : size === 'lg' ? 14 : 12;
  const valueSize = size === 'sm' ? 12 : size === 'lg' ? 16 : 14;
  const barH      = size === 'sm' ? 7  : size === 'lg' ? 11 : 9;
  const labelW    = size === 'sm' ? 24 : size === 'lg' ? 32 : 28;

  ctx.font = `bold ${labelSize}px ${CAPTURE.FONT}`;
  ctx.fillStyle = CAPTURE.C.label;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, x, y);

  const barX = x + labelW;

  ctx.save();
  roundRect(ctx, barX, y - barH / 2, barW, barH, barH / 2);
  ctx.clip();
  ctx.fillStyle = CAPTURE.C.barBg;
  ctx.fillRect(barX, y - barH / 2, barW, barH);
  const pct = max > 0 ? Math.min(1, current / max) : 0;
  ctx.fillStyle = fillColor;
  ctx.fillRect(barX, y - barH / 2, barW * pct, barH);
  ctx.restore();

  ctx.font = `600 ${valueSize}px ${CAPTURE.FONT}`;
  ctx.fillStyle = CAPTURE.C.value;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(`${current} / ${max}`, barX + barW + 12, y);
}

function getFilterSummaryLines() {
  const unitLabel  = appState.selectedUnit === 'Uchiha' ? 'Clan Uchiha' : 'Clan Akatsuki';
  const modeLabel  = appState.selectedMode === 'ALL' ? 'Ver Todo' : `Modo ${appState.selectedMode}`;
  const orderLabel = appState.ordenActual === 'alfabetico' ? 'Alfabético' : 'Por Estado';
  const parts = [unitLabel, modeLabel, orderLabel];
  if (appState.smartSort) parts.push('Prioridad Táctica');
  return parts;
}

function drawListHeader(ctx, width, height) {
  const PAD = 40;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';

  ctx.font = `bold 30px ${CAPTURE.FONT}`;
  const bah = 'BAHAMAS ';
  const war = 'WARROOM';
  const bahW = ctx.measureText(bah).width;
  ctx.fillStyle = CAPTURE.C.title;
  ctx.fillText(bah, PAD, 42);
  ctx.fillStyle = CAPTURE.C.titleAccent;
  ctx.fillText(war, PAD + bahW, 42);

  ctx.font = `17px ${CAPTURE.FONT}`;
  ctx.fillStyle = CAPTURE.C.subtitle;
  ctx.fillText(getFilterSummaryLines().join('   ·   '), PAD, 84);

  ctx.fillStyle = CAPTURE.C.separator;
  ctx.fillRect(PAD, height - 1, width - PAD * 2, 1);
}

async function buildCaptureBlob(players) {
  const W = 1000;
  const PAD = 40;
  const HEADER_H = 126;
  const ROW_H = 102;
  const FOOTER_H = 60;
  const TOTAL_H = HEADER_H + ROW_H * players.length + FOOTER_H;

  const scale = CONFIG.CAPTURE_SCALE;
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(W * scale);
  canvas.height = Math.round(TOTAL_H * scale);
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.scale(scale, scale);

  let buff = 0, debuff = 0;
  for (const p of players) {
    if (p.pillStatus === 'BUFF') buff++;
    else if (p.pillStatus === 'DEBUFF') debuff++;
  }
  fillCaptureBg(ctx, W, TOTAL_H, computeCaptureBg(buff, debuff));

  drawListHeader(ctx, W, HEADER_H);

  const avatars = await Promise.all(
    players.map(p => loadImage(p.avatarUrlProxy, p.avatarUrl))
  );

  players.forEach((p, i) => {
    const rowY = HEADER_H + i * ROW_H;
    const cy = rowY + ROW_H / 2;

    if (i > 0) {
      ctx.fillStyle = CAPTURE.C.separator;
      ctx.fillRect(PAD, rowY, W - PAD * 2, 1);
    }

    drawAvatar(ctx, avatars[i], p, PAD + 36, cy, 34);

    ctx.font = `bold 21px ${CAPTURE.FONT}`;
    ctx.fillStyle = CAPTURE.C.name;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(truncateText(ctx, p.name, 180), PAD + 90, cy);

    drawModoBadge(ctx, p.modo, 320, cy, 'md');
    drawStatusStacked(ctx, p, 430, cy);

    drawStatBar(ctx, 660, cy - 17, 'HP', p.health, p.healthMax, CAPTURE.C.hpFill, 140, 'md');
    drawStatBar(ctx, 660, cy + 17, 'FD', p.hunger, p.hungerMax, CAPTURE.C.fdFill, 140, 'md');
  });

  const footY = TOTAL_H - FOOTER_H;
  ctx.fillStyle = CAPTURE.C.separator;
  ctx.fillRect(PAD, footY, W - PAD * 2, 1);
  ctx.font = `15px ${CAPTURE.FONT}`;
  ctx.fillStyle = CAPTURE.C.footer;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(
    `Bahamas WarRoom  ·  ${players.length} jugador${players.length === 1 ? '' : 'es'}`,
    PAD, footY + FOOTER_H / 2
  );

  return new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
}

async function buildPlayerCaptureBlob(player) {
  const W = 520;
  const H = 230;
  const PAD = 24;

  const scale = CONFIG.CAPTURE_SCALE;
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(W * scale);
  canvas.height = Math.round(H * scale);
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.scale(scale, scale);

  fillCaptureBg(ctx, W, H, computePlayerCaptureBg(player));

  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.font = `bold 13px ${CAPTURE.FONT}`;
  const bah = 'BAHAMAS ';
  const war = 'WARROOM';
  const bahW = ctx.measureText(bah).width;
  const warW = ctx.measureText(war).width;
  ctx.fillStyle = CAPTURE.C.title;
  ctx.fillText(bah, PAD, 22);
  ctx.fillStyle = CAPTURE.C.titleAccent;
  ctx.fillText(war, PAD + bahW, 22);
  ctx.font = `13px ${CAPTURE.FONT}`;
  ctx.fillStyle = CAPTURE.C.subtitle;
  ctx.fillText('·  Ficha de jugador', PAD + bahW + warW + 8, 22);

  ctx.fillStyle = CAPTURE.C.separator;
  ctx.fillRect(PAD, 40, W - PAD * 2, 1);

  const avatarImg = await loadImage(player.avatarUrlProxy, player.avatarUrl);
  drawAvatar(ctx, avatarImg, player, PAD + 36, 105, 36);

  const nameX = PAD + 90;
  ctx.font = `bold 20px ${CAPTURE.FONT}`;
  ctx.fillStyle = CAPTURE.C.name;
  ctx.textBaseline = 'middle';
  ctx.fillText(truncateText(ctx, player.name, W - nameX - PAD), nameX, 90);

  const badgeW = drawModoBadge(ctx, player.modo, nameX, 124, 'md');
  drawStatusInline(ctx, player, nameX + badgeW + 18, 124, 'md');

  drawStatBar(ctx, PAD, 178, 'HP', player.health, player.healthMax, CAPTURE.C.hpFill, 320, 'lg');
  drawStatBar(ctx, PAD, 208, 'FD', player.hunger, player.hungerMax, CAPTURE.C.fdFill, 320, 'lg');

  return new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
}

// ===== ENTREGA DEL BLOB =====
function isMobileDevice() {
  return /Android|iPhone|iPad|iPod|Mobile|Opera Mini|IEMobile/i.test(navigator.userAgent);
}

async function copyBlobToClipboard(blob) {
  try {
    if (navigator.clipboard && window.ClipboardItem) {
      await navigator.clipboard.write([ new ClipboardItem({ 'image/png': blob }) ]);
      return true;
    }
  } catch (e) { console.warn('Portapapeles no disponible:', e); }
  return false;
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function deliverBlob(blob, filename) {
  // 1) Forzar descarga si el usuario lo pidió
  if (appState.forceDownload) {
    downloadBlob(blob, filename);
    return { method: 'download' };
  }

  // 2) Web Share API — SOLO en móvil (PC abre el share sheet de Windows 11, no lo queremos)
  if (isMobileDevice()) {
    const file = new File([blob], filename, { type: 'image/png' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({
          files: [file],
          title: 'Bahamas WarRoom',
          text: 'Captura del clan'
        });
        return { method: 'share' };
      } catch (e) {
        if (e.name === 'AbortError') return { method: 'cancelled' };
        console.warn('Share falló, probando portapapeles:', e);
      }
    }
  }

  // 3) Portapapeles (desktop / móvil sin share)
  const ok = await copyBlobToClipboard(blob);
  if (ok) return { method: 'clipboard' };

  // 4) Fallback final: descarga
  downloadBlob(blob, filename);
  return { method: 'download' };
}

function buildFilename(prefix) {
  const ts = new Date().toISOString().slice(0, 16).replace(/[:T]/g, '');
  return `warroom_${prefix}_${ts}.png`;
}

function notifyDeliveryResult(result) {
  switch (result.method) {
    case 'share':
      mostrarNotificacion('Captura lista para compartir.', 1800, 'success');
      break;
    case 'cancelled':
      break;
    case 'clipboard':
      mostrarNotificacion('Captura copiada al portapapeles.', 2000, 'success');
      break;
    case 'download':
      mostrarNotificacion('Captura descargada.', 2000, 'success');
      break;
    case 'error':
      mostrarNotificacion('Error generando la captura.', 2500, 'error');
      break;
  }
}

async function copyCurrentCapture() {
  const players = getFilteredAndSortedPlayers();
  if (players.length === 0) {
    mostrarNotificacion('No hay jugadores para capturar.', 2000, 'error');
    return;
  }

  copyCaptureBtn.disabled = true;
  const original = copyCaptureBtn.textContent;
  copyCaptureBtn.textContent = '⏳';

  try {
    const blob = await buildCaptureBlob(players);
    if (!blob) throw new Error('toBlob devolvió null');

    const filename = buildFilename(appState.selectedUnit.toLowerCase());
    const result = await deliverBlob(blob, filename);
    notifyDeliveryResult(result);
  } catch (e) {
    console.error('Error generando captura:', e);
    notifyDeliveryResult({ method: 'error' });
  } finally {
    copyCaptureBtn.disabled = false;
    copyCaptureBtn.textContent = original;
  }
}

async function copyPlayerCapture(player) {
  try {
    const blob = await buildPlayerCaptureBlob(player);
    if (!blob) throw new Error('toBlob devolvió null');

    const filename = buildFilename(player.name.replace(/\s+/g, '_'));
    const result = await deliverBlob(blob, filename);
    notifyDeliveryResult(result);
  } catch (e) {
    console.error('Error generando ficha:', e);
    notifyDeliveryResult({ method: 'error' });
  }
}

// ================================================================
// ===== PRESS-AND-HOLD CON SPINNER ===============================
// ================================================================

let pressState = null;
let holdSpinnerEl = null;

function initPressToCapture() {
  const MOVE_TOLERANCE = 10;

  holdSpinnerEl = document.createElement('div');
  holdSpinnerEl.className = 'hold-spinner';
  document.body.appendChild(holdSpinnerEl);

  usersContainer.addEventListener('pointerdown', (e) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    const card = e.target.closest('[data-copy-player]');
    if (!card) return;
    startPress(card, e.clientX, e.clientY);
  });

  usersContainer.addEventListener('pointermove', (e) => {
    if (!pressState) return;
    const dx = e.clientX - pressState.startX;
    const dy = e.clientY - pressState.startY;
    if (Math.hypot(dx, dy) > MOVE_TOLERANCE) cancelPress();
  });

  ['pointerup', 'pointercancel', 'pointerleave'].forEach(ev => {
    usersContainer.addEventListener(ev, cancelPress);
  });

  window.addEventListener('scroll', cancelPress, { passive: true, capture: true });

  usersContainer.addEventListener('contextmenu', (e) => {
    if (e.target.closest('[data-copy-player]')) e.preventDefault();
  });
}

function startPress(card, x, y) {
  cancelPress();

  const playerId = card.dataset.copyPlayer;
  const player = appState.playersById.get(playerId);
  if (!player) return;

  card.classList.add('pressing');
  card.style.setProperty('--progress', '0%');

  showHoldSpinner(x, y);

  const startTime = performance.now();

  const tick = (now) => {
    if (!pressState || pressState.card !== card) return;
    const elapsed = now - startTime;
    const progress = Math.min(1, elapsed / CONFIG.HOLD_MS);
    card.style.setProperty('--progress', (progress * 100) + '%');
    if (holdSpinnerEl) {
      holdSpinnerEl.style.setProperty('--progress', (progress * 100) + '%');
    }

    if (progress >= 1) {
      const p = pressState.player;
      cancelPress();
      card.classList.add('capture-flash');
      setTimeout(() => card.classList.remove('capture-flash'), 600);
      copyPlayerCapture(p);
      return;
    }
    pressState.rafId = requestAnimationFrame(tick);
  };

  pressState = {
    card,
    player,
    startX: x,
    startY: y,
    rafId: requestAnimationFrame(tick)
  };
}

function cancelPress() {
  hideHoldSpinner();
  if (!pressState) return;
  cancelAnimationFrame(pressState.rafId);
  pressState.card.classList.remove('pressing');
  pressState.card.style.removeProperty('--progress');
  pressState = null;
}

function showHoldSpinner(x, y) {
  if (!holdSpinnerEl) return;
  holdSpinnerEl.style.left = x + 'px';
  holdSpinnerEl.style.top = y + 'px';
  holdSpinnerEl.style.setProperty('--progress', '0%');
  holdSpinnerEl.style.display = 'block';

  void holdSpinnerEl.offsetWidth;
  holdSpinnerEl.classList.add('visible');
}

function hideHoldSpinner() {
  if (!holdSpinnerEl) return;
  holdSpinnerEl.classList.remove('visible');
  setTimeout(() => {
    if (holdSpinnerEl && !holdSpinnerEl.classList.contains('visible')) {
      holdSpinnerEl.style.display = 'none';
    }
  }, 200);
}

window.__warroom = { stopApp, appState };
