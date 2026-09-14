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
  DEBUFF_WINDOW_MS: 15 * 60 * 1000
};

const UNITS = ['Uchiha', 'Akatsuki'];

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
      renderDamagePanel();
      actualizarDañosEnVista();
    });
  }

  if (battleBonusInput) {
    battleBonusInput.addEventListener('input', (e) => {
      const v = Math.max(0, Math.min(200, Number(e.target.value) || 0));
      if (v === appState.battleBonus) return;
      appState.battleBonus = v;
      saveBattleBonusState(v);
      renderDamagePanel();
      actualizarDañosEnVista();
    });
  }

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

function calcDamagePotential(player, opts) {
  const c = player.combat || {};
  let attack            = c.attack          || 0;
  const precision       = c.precision       || 0;
  const criticalChance  = c.criticalChance  || 0;
  const criticalDamages = c.criticalDamages || 0;
  const armor           = c.armor           || 0;
  const dodge           = c.dodge           || 0;
  const regenHP         = c.regenHP         || 0;
  const regenHunger     = c.regenHunger     || 0;

  const horasBuff = Math.max(0, (player.pillRemainingMs || 0) / 3600000);
  const horas = horasBuff > 0 ? horasBuff : 8;

  let prc = precision / 100;
  const cc = criticalChance / 100;
  const cd = criticalDamages / 100;

  const extraCritMult = 4 * Math.max(0, (cc - 1) * 100);
  attack += 4 * Math.max(0, (prc - 1) * 100);

  const h = Math.min(1, prc);
  const ccCap = Math.min(1, cc);

  const dmgPerHit = attack * h * (1 + ccCap * (cd + 0.01 * extraCritMult))
                  + (attack / 2) * (1 - h);

  const healthMax = player.healthMax || 100;
  const y = player.health;
  const j = player.hunger;

  const k = opts.contarRegen ? regenHP * horas : 0;
  const P = Math.floor(opts.contarRegen ? j + regenHunger * horas : j);

  const S = armor;
  const H = dodge;
  const M = 10 * (1 - S / (S + 40)) * (1 - H / (H + 40));

  const nAttacks = M > 0 ? (y + k + 0.2 * P * healthMax) / M : 0;

  const dmgTotal = dmgPerHit * nAttacks * (1 + opts.battleBonus / 100);

  return { dmgTotal, dmgPerHit, nAttacks, horas, hpEfec: y + k, foodEfec: P };
}

function formatEtaFromMs(ms) {
  if (!ms || ms <= 0) return '0m';
  const totalMin = Math.floor(ms / 60000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function formatDmg(n) {
  if (!isFinite(n) || n <= 0) return '0';
  if (n >= 1e9) return (n / 1e9).toFixed(2) + 'B';
  if (n >= 1e6) return (n / 1e6).toFixed(2) + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K';
  return Math.floor(n).toString();
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[c]);
}

function actualizarDañosEnVista() {
  if (!appState.damagePanelActive) return;
  const opts = { contarRegen: appState.contarRegen, battleBonus: appState.battleBonus };
  document.querySelectorAll('[data-damage-id]').forEach(el => {
    const player = appState.playersById.get(el.dataset.damageId);
    if (!player) return;
    const calc = calcDamagePotential(player, opts);
    el.textContent = formatDmg(calc.dmgTotal);
  });
}

function renderDamagePanel() {
  if (!damagePanel) return;

  if (!appState.smartSort || !appState.damagePanelActive) {
    damagePanel.hidden = true;
    return;
  }

  const players = getFilteredAndSortedPlayers().filter(p => p.pillStatus === 'BUFF');
  if (players.length === 0) { damagePanel.hidden = true; return; }

  let total = 0;
  for (const p of players) {
    const calc = calcDamagePotential(p, {
      contarRegen: appState.contarRegen,
      battleBonus: appState.battleBonus
    });
    total += calc.dmgTotal;
  }

  if (damagePanelTotal) damagePanelTotal.textContent = formatDmg(total);
  if (damagePanelMeta) {
    damagePanelMeta.textContent =
      `${players.length} buffeados · Bonus ${appState.battleBonus}% · Regen ${appState.contarRegen ? 'ON' : 'OFF'}`;
  }

  damagePanel.hidden = false;
}

function renderDebuffPanel() {
  if (!debuffPanel) return;
  if (!appState.smartSort) { debuffPanel.hidden = true; return; }

  let list = [...appState.playersData];
  if (appState.selectedMode !== 'ALL') list = list.filter(p => p.modo === appState.selectedMode);

  const debuffed = list
    .filter(p => p.pillStatus === 'DEBUFF' && p.pillRemainingMs > 0 && p.pillRemainingMs <= CONFIG.DEBUFF_WINDOW_MS)
    .sort((a, b) => a.pillRemainingMs - b.pillRemainingMs);

  if (debuffed.length === 0) { debuffPanel.hidden = true; return; }

  if (debuffPanelMeta) {
    debuffPanelMeta.textContent = `${debuffed.length} jugador${debuffed.length === 1 ? '' : 'es'} · ≤15m`;
  }

  if (debuffPanelBody) {
    debuffPanelBody.innerHTML = debuffed.map(p => {
      const safeName = escapeHtml(p.name);
      const shortName = p.name.length > 14 ? p.name.slice(0, 13) + '…' : p.name;
      return `
        <div class="debuff-card" data-copy-player="${p.id}">
          <img src="${p.avatarUrl}" alt="" loading="lazy"
               onerror="this.onerror=null;this.src='https://ui-avatars.com/api/?name=${encodeURIComponent(p.name)}&background=334155&color=fff'">
          <span class="debuff-card-name" title="${safeName}">${escapeHtml(shortName)}</span>
          <span class="debuff-card-time" data-player-id="${p.id}">${formatTimer(p.pillRemainingMs)}</span>
        </div>`;
    }).join('');
  }

  debuffPanel.hidden = false;
}

function renderUsers() {
  if (pressState) return;
  updateApiBanner();

  const state = decideMainState();

  if (state === 'api-down') { renderApiDown(); renderDamagePanel(); renderDebuffPanel(); return; }
  if (state === 'loading')  { renderLoading(); renderDamagePanel(); renderDebuffPanel(); return; }
  if (state === 'empty')    { renderEmptyState(); renderDamagePanel(); renderDebuffPanel(); return; }

  const players = getFilteredAndSortedPlayers();
  if (players.length === 0) { renderEmptyState(); renderDamagePanel(); renderDebuffPanel(); return; }

  if (appState.vistaActual === 'tabla') renderTabla(players);
  else if (appState.vistaActual === 'compacta') renderCompacta(players);
  else renderTarjetas(players);

  actualizarTemporizadores();
  renderDamagePanel();
  renderDebuffPanel();
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
  const showDamage = !!appState.damagePanelActive;

  const rows = players.map((p, index) => {
    const statusHtml = getStatusHtml(p);
    const modoBadge = p.modo === 'WAR'
      ? `<span class="badge-mode badge-war">WAR</span>`
      : `<span class="badge-mode badge-eco">ECO</span>`;
    const healthPct = p.healthMax > 0 ? Math.min(100, (p.health / p.healthMax) * 100) : 0;
    const hungerPct = p.hungerMax > 0 ? Math.min(100, (p.hunger / p.hungerMax) * 100) : 0;
    const rowClass = p.isCombatReady ? '' : 'out-of-combat';
    const safeName = encodeURIComponent(p.name);

    const damageCell = showDamage
      ? `<td class="damage-cell" data-damage-id="${p.id}">${
          formatDmg(calcDamagePotential(p, { contarRegen: appState.contarRegen, battleBonus: appState.battleBonus }).dmgTotal)
        }</td>`
      : '';

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
        ${damageCell}
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
          ${showDamage ? '<th class="damage-th">Daño Potencial</th>' : ''}
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>`;
}

function renderTarjetas(players) {
  const showDamage = !!appState.damagePanelActive;

  const cards = players.map((p, index) => {
    const statusHtml = getStatusHtml(p);
    const modoBadge = p.modo === 'WAR'
      ? `<span class="modo-badge war">WAR</span>`
      : `<span class="modo-badge eco">ECO</span>`;
    const healthPct = p.healthMax > 0 ? Math.min(100, (p.health / p.healthMax) * 100) : 0;
    const hungerPct = p.hungerMax > 0 ? Math.min(100, (p.hunger / p.hungerMax) * 100) : 0;
    const estadoClass = p.pillStatus.toLowerCase();
    const safeName = encodeURIComponent(p.name);

    const damageSpan = showDamage
      ? `<span class="damage-badge" data-damage-id="${p.id}">${
          formatDmg(calcDamagePotential(p, { contarRegen: appState.contarRegen, battleBonus: appState.battleBonus }).dmgTotal)
        }</span>`
      : '';

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
        <div class="status-row">
          ${statusHtml}
          ${damageSpan}
        </div>
      </div>`;
  }).join('');

  usersContainer.innerHTML = `<div class="vista-tarjetas">${cards}</div>`;
}

function renderCompacta(players) {
  const showDamage = !!appState.damagePanelActive;

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

    const damageMini = showDamage
      ? `<span class="damage-mini" data-damage-id="${p.id}">${
          formatDmg(calcDamagePotential(p, { contarRegen: appState.contarRegen, battleBonus: appState.battleBonus }).dmgTotal)
        }</span>`
      : '';

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
        <div class="mini-status">
          ${statusMini}
          ${damageMini}
        </div>
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

  document.querySelectorAll('.debuff-card-time[data-player-id]').forEach(el => {
    const player = appState.playersById.get(el.dataset.playerId);
    if (player) el.innerText = formatTimer(player.pillRemainingMs);
  });

  actualizarDañosEnVista();
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

    if ((statusChanged || debuffSetChanged) && appState.smartSort && !pressState) {
      renderUsers();
    } else {
      actualizarTemporizadores();
    }
  }, 1000);
}

function stopApp() {
  if (timerLoopId)       { clearInterval(timerLoopId);       timerLoopId = null; }
  if (refreshIntervalId) { clearInterval(refreshIntervalId); refreshIntervalId = null; }
}

// ================================================================
// ===== CAPTURA ==================================================
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
    damageAccent: '#22c55e',
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
  if (active <= 3) return { start: `rgb(${BASE.join(',')})`, end: `rgb(${BASE.join(',')})` };
  const strength = Math.min(1, (active - 3) / 15) * 0.10;
  const tint = buffCount >= debuffCount ? [34, 197, 94] : [239, 68, 68];
  const end = [
    Math.round(BASE[0] + (tint[0] - BASE[0]) * strength),
    Math.round(BASE[1] + (tint[1] - BASE[1]) * strength),
    Math.round(BASE[2] + (tint[2] - BASE[2]) * strength)
  ];
  return { start: `rgb(${BASE.join(',')})`, end: `rgb(${end.join(',')})` };
}

function computePlayerCaptureBg(player) {
  const BASE = [14, 14, 14];
  if (player.pillStatus === 'STANDBY') return { start: `rgb(${BASE.join(',')})`, end: `rgb(${BASE.join(',')})` };
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

async function loadImage(url, timeoutMs = 8000) {
  if (!url) return null;
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
  if (player.pillStatus === 'BUFF') { label = 'BUFF'; labelColor = '#4ade80'; timer = formatTimer(player.pillRemainingMs); }
  else if (player.pillStatus === 'DEBUFF') { label = 'DEBUFF'; labelColor = '#f87171'; timer = formatTimer(player.pillRemainingMs); }
  else { label = 'En Espera'; labelColor = '#94a3b8'; }
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
  if (appState.damagePanelActive) {
    parts.push(`Bonus ${appState.battleBonus}%`);
    parts.push(`Regen ${appState.contarRegen ? 'ON' : 'OFF'}`);
  }
  return parts;
}

function drawListHeader(ctx, width, height, showDamage) {
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

  if (showDamage) {
    ctx.font = `bold 13px ${CAPTURE.FONT}`;
    ctx.fillStyle = CAPTURE.C.damageAccent;
    ctx.textAlign = 'right';
    ctx.fillText('DAÑO POTENCIAL', width - PAD, 84);
    ctx.textAlign = 'left';
  }

  ctx.fillStyle = CAPTURE.C.separator;
  ctx.fillRect(PAD, height - 1, width - PAD * 2, 1);
}

async function buildCaptureBlob(players) {
  const showDamage = !!appState.damagePanelActive;
  const PAD = 40;
  const W = showDamage ? 1160 : 1000;
  const HEADER_H = 126;
  const ROW_H = 102;
  const FOOTER_H = 60;
  const TOTAL_H = HEADER_H + ROW_H * players.length + FOOTER_H;
  const scale = 2;
  const canvas = document.createElement('canvas');
  canvas.width = W * scale;
  canvas.height = TOTAL_H * scale;
  const ctx = canvas.getContext('2d');
  ctx.scale(scale, scale);

  let buff = 0, debuff = 0;
  for (const p of players) {
    if (p.pillStatus === 'BUFF') buff++;
    else if (p.pillStatus === 'DEBUFF') debuff++;
  }
  fillCaptureBg(ctx, W, TOTAL_H, computeCaptureBg(buff, debuff));
  drawListHeader(ctx, W, HEADER_H, showDamage);

  const avatars = await Promise.all(players.map(p => loadImage(p.avatarUrlProxy || p.avatarUrl)));

  let totalDamage = 0;
  if (showDamage) {
    for (const p of players) {
      const c = calcDamagePotential(p, { contarRegen: appState.contarRegen, battleBonus: appState.battleBonus });
      totalDamage += c.dmgTotal;
    }
  }

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

    if (showDamage) {
      const calc = calcDamagePotential(p, { contarRegen: appState.contarRegen, battleBonus: appState.battleBonus });
      ctx.font = `bold 22px ${CAPTURE.MONO}`;
      ctx.fillStyle = CAPTURE.C.damageAccent;
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      ctx.fillText(formatDmg(calc.dmgTotal), W - PAD, cy);
    }
  });

  const footY = TOTAL_H - FOOTER_H;
  ctx.fillStyle = CAPTURE.C.separator;
  ctx.fillRect(PAD, footY, W - PAD * 2, 1);
  ctx.font = `15px ${CAPTURE.FONT}`;
  ctx.fillStyle = CAPTURE.C.footer;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  const leftLabel = `Bahamas WarRoom  ·  ${players.length} jugador${players.length === 1 ? '' : 'es'}`;
  ctx.fillText(leftLabel, PAD, footY + FOOTER_H / 2);

  if (showDamage) {
    ctx.font = `bold 17px ${CAPTURE.MONO}`;
    ctx.fillStyle = CAPTURE.C.damageAccent;
    ctx.textAlign = 'right';
    ctx.fillText(`Total: ${formatDmg(totalDamage)}`, W - PAD, footY + FOOTER_H / 2);
  }

  return new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
}

async function buildPlayerCaptureBlob(player) {
  const showDamage = !!appState.damagePanelActive;
  const PAD = 24;
  const W = 520;
  const H = showDamage ? 280 : 230;

  const scale = 2;
  const canvas = document.createElement('canvas');
  canvas.width = W * scale;
  canvas.height = H * scale;
  const ctx = canvas.getContext('2d');
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

  const avatarImg = await loadImage(player.avatarUrlProxy || player.avatarUrl);
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

  if (showDamage) {
    ctx.fillStyle = CAPTURE.C.separator;
    ctx.fillRect(PAD, 238, W - PAD * 2, 1);

    const calc = calcDamagePotential(player, { contarRegen: appState.contarRegen, battleBonus: appState.battleBonus });

    ctx.font = `bold 11px ${CAPTURE.FONT}`;
    ctx.fillStyle = CAPTURE.C.label;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText('DAÑO POTENCIAL', PAD, 257);

    ctx.font = `bold 22px ${CAPTURE.MONO}`;
    ctx.fillStyle = CAPTURE.C.damageAccent;
    ctx.textAlign = 'right';
    ctx.fillText(formatDmg(calc.dmgTotal), W - PAD, 257);
  }

  return new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
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
  if (appState.forceDownload) {
    downloadBlob(blob, filename);
    return { method: 'download' };
  }
  const file = new File([blob], filename, { type: 'image/png' });
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: 'Bahamas WarRoom', text: 'Captura del clan' });
      return { method: 'share' };
    } catch (e) {
      if (e.name === 'AbortError') return { method: 'cancelled' };
      console.warn('Share falló, probando alternativas:', e);
    }
  }
  const ok = await copyBlobToClipboard(blob);
  if (ok) return { method: 'clipboard' };
  downloadBlob(blob, filename);
  return { method: 'download' };
}

function buildFilename(prefix) {
  const ts = new Date().toISOString().slice(0, 16).replace(/[:T]/g, '');
  return `warroom_${prefix}_${ts}.png`;
}

function notifyDeliveryResult(result) {
  switch (result.method) {
    case 'share': mostrarNotificacion('Captura lista para compartir.', 1800, 'success'); break;
    case 'cancelled': break;
    case 'clipboard': mostrarNotificacion('Captura copiada al portapapeles.', 2000, 'success'); break;
    case 'download': mostrarNotificacion('Captura descargada.', 2000, 'success'); break;
    case 'error': mostrarNotificacion('Error generando la captura.', 2500, 'error'); break;
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

// ===== PRESS-AND-HOLD =====
let pressState = null;
let holdSpinnerEl = null;

function initPressToCapture() {
  const MOVE_TOLERANCE = 10;
  holdSpinnerEl = document.createElement('div');
  holdSpinnerEl.className = 'hold-spinner';
  document.body.appendChild(holdSpinnerEl);

  document.addEventListener('pointerdown', (e) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    const card = e.target.closest('[data-copy-player]');
    if (!card) return;
    startPress(card, e.clientX, e.clientY);
  });

  document.addEventListener('pointermove', (e) => {
    if (!pressState) return;
    const dx = e.clientX - pressState.startX;
    const dy = e.clientY - pressState.startY;
    if (Math.hypot(dx, dy) > MOVE_TOLERANCE) cancelPress();
  });

  ['pointerup', 'pointercancel'].forEach(ev => {
    document.addEventListener(ev, cancelPress);
  });

  window.addEventListener('scroll', cancelPress, { passive: true, capture: true });

  document.addEventListener('contextmenu', (e) => {
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
    if (holdSpinnerEl) holdSpinnerEl.style.setProperty('--progress', (progress * 100) + '%');
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
  pressState = { card, player, startX: x, startY: y, rafId: requestAnimationFrame(tick) };
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