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
  MANUAL_COOLDOWN_MS: 15 * 1000,
  RATE_LIMIT_COOLDOWN_MS: 30 * 1000,
  FRESHNESS_REFRESH_EVERY_N_TICKS: 5,
  HOLD_MS: 1000,
  BATTLE_BONUS_DEFAULT: 30,
  BATTLE_BONUS_TTL_MS: 2 * 60 * 60 * 1000,
  DEBUFF_WINDOW_MS: 60 * 60 * 1000
};

const UNITS = ['Uchiha', 'Akatsuki'];

const { escapeHtml, formatDmg, formatTimer } = WareraUtils;
const { calcDamagePotential } = WareraDamage;

function loadContarRegenState() {
  try { return localStorage.getItem('warera_contar_regen') === '1'; }
  catch { return false; }
}

function loadBattleBonusState() {
  try {
    const raw = localStorage.getItem('warera_battle_bonus');
    if (!raw) return CONFIG.BATTLE_BONUS_DEFAULT;
    const { value, setAt } = JSON.parse(raw);
    if (Date.now() - setAt > CONFIG.BATTLE_BONUS_TTL_MS) return CONFIG.BATTLE_BONUS_DEFAULT;
    const v = Number(value);
    if (!isFinite(v)) return CONFIG.BATTLE_BONUS_DEFAULT;
    return Math.max(0, Math.min(200, v));
  } catch { return CONFIG.BATTLE_BONUS_DEFAULT; }
}

function saveBattleBonusState(value) {
  try {
    localStorage.setItem('warera_battle_bonus', JSON.stringify({ value, setAt: Date.now() }));
  } catch {}
}

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
  forceDownload: localStorage.getItem('warera_force_download') === '1',
  damagePanelActive: false,
  contarRegen: loadContarRegenState(),
  battleBonus: loadBattleBonusState()
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

const damageToggleGroup   = document.getElementById('damageToggleGroup');
const damageRegenGroup    = document.getElementById('damageRegenGroup');
const damageToggle        = document.getElementById('damageToggle');
const contarRegenToggle   = document.getElementById('contarRegenToggle');
const battleBonusInput    = document.getElementById('battleBonusInput');
const damagePanel         = document.getElementById('damagePanel');
const damagePanelMeta     = document.getElementById('damagePanelMeta');
const damagePanelTotal    = document.getElementById('damagePanelTotal');

const debuffPanel         = document.getElementById('debuffPanel');
const debuffPanelMeta     = document.getElementById('debuffPanelMeta');
const debuffPanelBody     = document.getElementById('debuffPanelBody');

let refreshIntervalId  = null;
let timerLoopId        = null;
let freshnessTickCount = 0;
let pendingFetches     = 0;

let rateLimitedUntil = 0;
let refreshInFlight  = false;

const refreshCooldown = { until: 0, total: CONFIG.MANUAL_COOLDOWN_MS };

document.addEventListener('DOMContentLoaded', () => {
  initModules();
  loadCacheFromStorage();
  bindUiEvents();
  restoreViewPreference();
  primerRender();

  if (damageToggle) damageToggle.checked = false;
  if (contarRegenToggle) contarRegenToggle.checked = appState.contarRegen;
  if (battleBonusInput) battleBonusInput.value = appState.battleBonus;
  syncDamageControls();

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

function initModules() {
  WareraCapture.init({
    getState: () => appState,
    calcDamagePotential,
    formatDmg,
    formatTimer,
    truncateText: WareraUtils.truncateText,
    notify: mostrarNotificacion
  });

  WareraPress.init({
    getPlayerById: id => appState.playersById.get(id),
    copyPlayerCapture: player => copyPlayerCapture(player),
    holdMs: CONFIG.HOLD_MS
  });

  WareraRender.init({
    getState: () => appState,
    getFilteredAndSortedPlayers,
    escapeHtml,
    formatDmg,
    formatTimer,
    calcDamagePotential,
    DEBUFF_WINDOW_MS: CONFIG.DEBUFF_WINDOW_MS,
    usersContainer,
    damagePanel,
    damagePanelMeta,
    damagePanelTotal,
    debuffPanel,
    debuffPanelMeta,
    debuffPanelBody
  });
}

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
          : 'Capturas usarán portapapeles o compartir.',
        1500, 'success'
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
    syncDamageControls();
    renderUsers();
  });

  if (damageToggle) {
    damageToggle.addEventListener('change', (e) => {
      appState.damagePanelActive = e.target.checked;
      syncDamageControls();
      renderUsers();
    });
  }

  if (contarRegenToggle) {
    contarRegenToggle.addEventListener('change', (e) => {
      appState.contarRegen = e.target.checked;
      try { localStorage.setItem('warera_contar_regen', appState.contarRegen ? '1' : '0'); } catch {}
      WareraRender.renderDamagePanel();
      WareraRender.actualizarDañosEnVista();
    });
  }

  if (battleBonusInput) {
    battleBonusInput.addEventListener('input', (e) => {
      const v = Math.max(0, Math.min(200, Number(e.target.value) || 0));
      if (v === appState.battleBonus) return;
      appState.battleBonus = v;
      saveBattleBonusState(v);
      WareraRender.renderDamagePanel();
      WareraRender.actualizarDañosEnVista();
    });
  }

  refreshBtn.addEventListener('click', () => {
    if (refreshBtn.disabled) return;
    refreshAllUnits(true, false, { startCooldown: true });
  });

  copyCaptureBtn.addEventListener('click', copyCurrentCapture);
  WareraPress.initPressToCapture();

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

function updateApiBanner() {
  if (!apiBanner) return;
  const mainState = decideMainState();
  if (mainState !== 'data') { apiBanner.hidden = true; return; }

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
    const statuses = settled.filter(r => r.status === 'fulfilled').map(r => r.value);

    let worst = 'ok';
    for (const s of statuses) {
      if (s === 'error') { worst = 'error'; break; }
      if (s === 'limited') worst = 'limited';
    }
    if (settled.some(r => r.status === 'rejected')) worst = 'error';

    appState.apiStatus = worst;
  } finally {
    if (startCooldown) refreshCooldown.until = Date.now() + CONFIG.MANUAL_COOLDOWN_MS;
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

function getFilteredAndSortedPlayers() {
  return WareraUtils.getFilteredAndSortedPlayers(
    appState.playersData,
    appState.selectedMode,
    appState.smartSort,
    appState.ordenActual
  );
}

// ===== SIMULADOR =====
function syncDamageControls() {
  if (!damageToggleGroup) return;
  const smartOn = !!appState.smartSort;
  const regenEnabled = smartOn && !!appState.damagePanelActive;

  damageToggleGroup.hidden = !smartOn;

  if (damageRegenGroup) {
    damageRegenGroup.hidden = !smartOn;
    damageRegenGroup.classList.toggle('disabled', !regenEnabled);
    if (contarRegenToggle) contarRegenToggle.disabled = !regenEnabled;
  }

  if (damagePanel) damagePanel.hidden = !regenEnabled;

  if (!smartOn) {
    appState.damagePanelActive = false;
    if (damageToggle) damageToggle.checked = false;
  }
}

function renderUsers() {
  if (WareraPress.isPressing()) return;
  updateApiBanner();

  const state = decideMainState();

  if (state === 'api-down') {
    WareraRender.renderApiDown();
    WareraRender.renderDamagePanel();
    WareraRender.renderDebuffPanel();
    return;
  }
  if (state === 'loading') {
    WareraRender.renderLoading();
    WareraRender.renderDamagePanel();
    WareraRender.renderDebuffPanel();
    return;
  }
  if (state === 'empty') {
    WareraRender.renderEmptyState();
    WareraRender.renderDamagePanel();
    WareraRender.renderDebuffPanel();
    return;
  }

  const players = getFilteredAndSortedPlayers();
  if (players.length === 0) {
    WareraRender.renderEmptyState();
    WareraRender.renderDamagePanel();
    WareraRender.renderDebuffPanel();
    return;
  }

  if (appState.vistaActual === 'tabla') WareraRender.renderTabla(players);
  else if (appState.vistaActual === 'compacta') WareraRender.renderCompacta(players);
  else WareraRender.renderTarjetas(players);

  WareraRender.actualizarTemporizadores();
  WareraRender.renderDamagePanel();
  WareraRender.renderDebuffPanel();
}

function startTimerLoop() {
  if (timerLoopId) return;
  timerLoopId = setInterval(() => {
    let statusChanged = false;
    let debuffSetChanged = false;
    const now = Date.now();

    for (const p of appState.playersData) {
      if (p.pillStatus !== 'STANDBY' && p.pillEndTime) {
        const prevRemaining = p.pillRemainingMs;
        p.pillRemainingMs = p.pillEndTime - now;

        if (p.pillRemainingMs <= 0) {
          p.pillRemainingMs = 0;
          p.pillStatus = 'STANDBY';
          p.pillEndTime = null;
          statusChanged = true;
        } else if (p.pillStatus === 'DEBUFF') {
          if (prevRemaining > CONFIG.DEBUFF_WINDOW_MS && p.pillRemainingMs <= CONFIG.DEBUFF_WINDOW_MS) {
            debuffSetChanged = true;
          }
        }
      }
    }

    updateRefreshButton();

    if (++freshnessTickCount >= CONFIG.FRESHNESS_REFRESH_EVERY_N_TICKS) {
      freshnessTickCount = 0;
      updateFreshnessIndicator();
      updateApiBanner();
    }

    if ((statusChanged || debuffSetChanged) && appState.smartSort && !WareraPress.isPressing()) {
      renderUsers();
    } else {
      WareraRender.actualizarTemporizadores();
    }
  }, 1000);
}

function stopApp() {
  if (timerLoopId)       { clearInterval(timerLoopId);       timerLoopId = null; }
  if (refreshIntervalId) { clearInterval(refreshIntervalId); refreshIntervalId = null; }
}

// ================================================================
// ===== CAPTURA (delegada a WareraCapture) =======================
// ================================================================

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
    const blob = await WareraCapture.buildCaptureBlob(players);
    if (!blob) throw new Error('toBlob devolvió null');
    const filename = WareraCapture.buildFilename(appState.selectedUnit.toLowerCase());
    const result = await WareraCapture.deliverBlob(blob, filename);
    WareraCapture.notifyDeliveryResult(result);
  } catch (e) {
    console.error('Error generando captura:', e);
    WareraCapture.notifyDeliveryResult({ method: 'error' });
  } finally {
    copyCaptureBtn.disabled = false;
    copyCaptureBtn.textContent = original;
  }
}

async function copyPlayerCapture(player) {
  try {
    const blob = await WareraCapture.buildPlayerCaptureBlob(player);
    if (!blob) throw new Error('toBlob devolvió null');
    const filename = WareraCapture.buildFilename(player.name.replace(/\s+/g, '_'));
    const result = await WareraCapture.deliverBlob(blob, filename);
    WareraCapture.notifyDeliveryResult(result);
  } catch (e) {
    console.error('Error generando ficha:', e);
    WareraCapture.notifyDeliveryResult({ method: 'error' });
  }
}

window.__warroom = { stopApp, appState };