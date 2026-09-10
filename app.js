/**
 * Bahamas WarRoom - Script Principal
 */

const CONFIG = {
  UNIT_UCHIHA_ID: "6997581b896745b3e1b21d0f",
  UNIT_AKATSUKI_ID: "69f542668d7015d064d4147a",
  CACHE_TTL_MS: 2 * 60 * 1000, // 5 minutos
  CACHE_STORAGE_KEY: 'warera_cache_v1'
};

// ===== ESTADO GLOBAL =====
let appState = {
  apiKey: localStorage.getItem('warera_api_key') || '',
  selectedUnit: 'Uchiha',
  selectedMode: 'WAR',
  smartSort: false,
  ordenActual: 'alfabetico',
  playersData: [],
  cachedData: { 'Uchiha': null, 'Akatsuki': null },
  lastFetchTime: { 'Uchiha': 0, 'Akatsuki': 0 },
  vistaActual: 'tabla',
  eleccionManual: false
};

// ===== DOM REFS =====
const sidebar = document.getElementById('apiSidebar');
const overlay = document.getElementById('overlay');
const openApiBtn = document.getElementById('openApiBtn');
const closeApiBtn = document.getElementById('closeApiBtn');
const apiKeyInput = document.getElementById('apiKeyInput');
const saveKeyBtn = document.getElementById('saveKeyBtn');
const refreshBtn = document.getElementById('refreshDataBtn');
const smartSortToggle = document.getElementById('smartSortToggle');
const usersContainer = document.getElementById('usersContainer');
const radioVista = document.getElementsByName('vistaToggle');
const toast = document.getElementById('toast');
const toastMessage = document.getElementById('toastMessage');
const toastBar = document.getElementById('toastBar');

// ===== INICIALIZACIÓN =====
document.addEventListener('DOMContentLoaded', () => {
  if (appState.apiKey) {
    apiKeyInput.value = appState.apiKey;
  }

  // Cargar caché persistente ANTES de cualquier fetch
  loadCacheFromStorage();

  openApiBtn.addEventListener('click', () => {
    sidebar.classList.add('open');
    overlay.classList.add('active');
  });
  closeApiBtn.addEventListener('click', cerrarSidebar);
  overlay.addEventListener('click', cerrarSidebar);

  saveKeyBtn.addEventListener('click', () => {
    const key = apiKeyInput.value.trim();
    localStorage.setItem('warera_api_key', key);
    appState.apiKey = key;
    mostrarNotificacion('API Key guardada localmente.', 2000, 'success');
    cerrarSidebar();
  });

  document.querySelectorAll('[data-unit]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      document.querySelectorAll('[data-unit]').forEach(b => b.classList.remove('active'));
      e.target.classList.add('active');
      appState.selectedUnit = e.target.dataset.unit;

      // Si hay caché para la unidad, mostrar inmediatamente
      if (appState.cachedData[appState.selectedUnit]) {
        appState.playersData = appState.cachedData[appState.selectedUnit];
        renderUsers();
      }
      fetchApiData();
    });
  });

  document.querySelectorAll('[data-mode]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      document.querySelectorAll('[data-mode]').forEach(b => b.classList.remove('active'));
      e.target.classList.add('active');
      appState.selectedMode = e.target.dataset.mode;
      renderUsers();
    });
  });

  document.querySelectorAll('[data-order]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      document.querySelectorAll('[data-order]').forEach(b => b.classList.remove('active'));
      e.target.classList.add('active');
      appState.ordenActual = e.target.dataset.order;
      renderUsers();
    });
  });

  smartSortToggle.addEventListener('change', (e) => {
    appState.smartSort = e.target.checked;
    renderUsers();
  });

  refreshBtn.addEventListener('click', () => {
    fetchApiData(true);
  });

  radioVista.forEach(radio => {
    radio.addEventListener('change', (e) => {
      appState.vistaActual = e.target.value;
      appState.eleccionManual = true;
      renderUsers();
      localStorage.setItem('vistaPreferida', appState.vistaActual);
    });
  });

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

  const vistaGuardada = localStorage.getItem('vistaPreferida');
  if (vistaGuardada) {
    appState.vistaActual = vistaGuardada;
    appState.eleccionManual = true;
    document.querySelector(`input[name="vistaToggle"][value="${vistaGuardada}"]`).checked = true;
  } else {
    determinarVistaAutomatica();
  }

  // Render inmediato si hay caché para la unidad activa
  if (appState.cachedData[appState.selectedUnit]) {
    appState.playersData = appState.cachedData[appState.selectedUnit];
    renderUsers();
  }

  // Fetch inicial (usa caché si sigue vigente, silencioso)
  fetchApiData();
  updateFreshnessIndicator();
  startTimerLoop();

  // Refresco automático cada 2 minutos
  setInterval(() => {
    fetchApiData(true);
  }, CONFIG.CACHE_TTL_MS);
});

// ===== FUNCIONES AUXILIARES =====
function cerrarSidebar() {
  sidebar.classList.remove('open');
  overlay.classList.remove('active');
}

function determinarVistaAutomatica() {
  if (appState.eleccionManual) return;
  const esMovil = window.innerWidth <= 768;
  appState.vistaActual = esMovil ? 'tarjeta' : 'tabla';
  document.querySelector(`input[name="vistaToggle"][value="${appState.vistaActual}"]`).checked = true;
}

// ===== PERSISTENCIA DE CACHÉ EN LOCALSTORAGE =====
function saveCacheToStorage() {
  try {
    const cache = {
      'Uchiha': { data: appState.cachedData['Uchiha'], time: appState.lastFetchTime['Uchiha'] },
      'Akatsuki': { data: appState.cachedData['Akatsuki'], time: appState.lastFetchTime['Akatsuki'] }
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
    ['Uchiha', 'Akatsuki'].forEach(unit => {
      if (cache[unit] && cache[unit].data) {
        appState.cachedData[unit] = cache[unit].data;
        appState.lastFetchTime[unit] = cache[unit].time || 0;
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
  toast.classList.add(tipo);
  toast.classList.add('show');

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

// ===== INDICADOR DE FRESCURA =====
function updateFreshnessIndicator() {
  const dot = document.getElementById('freshnessDot');
  if (!dot) return;

  const lastFetch = appState.lastFetchTime[appState.selectedUnit];
  if (!lastFetch) {
    dot.style.backgroundColor = '#64748b';
    dot.style.boxShadow = '0 0 8px rgba(100, 116, 139, 0.6)';
    dot.title = 'Sin datos';
    return;
  }

  const age = Date.now() - lastFetch;
  const ratio = Math.min(1, age / CONFIG.CACHE_TTL_MS); // 0 → fresco, 1 → vencido

  // Interpolación en dos segmentos: verde → naranja → rojo
  let hue;
  if (ratio < 0.5) {
    // 142 (verde) → 30 (naranja)
    hue = 142 + (30 - 142) * (ratio / 0.5);
  } else {
    // 30 (naranja) → 0 (rojo)
    hue = 30 + (0 - 30) * ((ratio - 0.5) / 0.5);
  }

  const color = `hsl(${hue}, 71%, 45%)`;
  dot.style.backgroundColor = color;
  dot.style.boxShadow = `0 0 8px ${color}`;

  // Tooltip descriptivo
  const seconds = Math.floor(age / 1000);
  if (seconds < 60) {
    dot.title = `Datos frescos (hace ${seconds}s)`;
  } else {
    const min = Math.floor(seconds / 60);
    const sec = seconds % 60;
    dot.title = `Datos con ${min}m ${sec}s de antigüedad`;
  }
}

// ===== CONEXIÓN API Y CACHÉ =====
async function fetchApiData(forceRefresh = false) {
  const currentUnitId = appState.selectedUnit === 'Uchiha' ? CONFIG.UNIT_UCHIHA_ID : CONFIG.UNIT_AKATSUKI_ID;
  const now = Date.now();

  // Usar caché si sigue vigente y no se fuerza (SILENCIOSO, sin toast)
  if (!forceRefresh && appState.cachedData[appState.selectedUnit] &&
      (now - appState.lastFetchTime[appState.selectedUnit] < CONFIG.CACHE_TTL_MS)) {
    appState.playersData = appState.cachedData[appState.selectedUnit];
    renderUsers();
    return;
  }

  refreshBtn.innerText = "⏳ Cargando...";
  refreshBtn.disabled = true;

  try {
    const muResponse = await fetch('https://api2.warera.io/trpc/mu.getById', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ muId: currentUnitId })
    });
    const muJson = await muResponse.json();
    const memberIds = muJson.result.data.members;

    // Peticiones en paralelo
    const userPromises = memberIds.map(id =>
      fetch('https://api2.warera.io/trpc/user.getUserById', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: id })
      }).then(res => res.json())
    );

    const usersResponses = await Promise.all(userPromises);

    const formattedPlayers = usersResponses.map(res => {
      const user = res.result.data;
      const healthVal = user.skills?.health?.currentBarValue || 0;
      const healthMax = user.skills?.health?.total || 100;
      const hungerVal = user.skills?.hunger?.currentBarValue || 0;
      const hungerMax = user.skills?.hunger?.total || 10;

      const attackLevel = user.skills?.attack?.level || 0;
      const modo = attackLevel > 2 ? 'WAR' : 'ECO';

      let pillStatus = 'STANDBY';
      let pillEndTime = null;
      let pillRemainingMs = 0;

      if (user.buffs) {
        if (user.buffs.buffCodes?.includes('cocain') && user.buffs.buffEndAt) {
          const end = new Date(user.buffs.buffEndAt).getTime();
          if (end > now) {
            pillStatus = 'BUFF';
            pillEndTime = end;
            pillRemainingMs = end - now;
          }
        } else if (user.buffs.debuffCodes?.includes('cocain') && user.buffs.debuffEndAt) {
          const end = new Date(user.buffs.debuffEndAt).getTime();
          if (end > now) {
            pillStatus = 'DEBUFF';
            pillEndTime = end;
            pillRemainingMs = end - now;
          }
        }
      }

      const avatarStr = user.avatarUrl || `https://ui-avatars.com/api/?name=${user.username}&background=334155&color=fff`;

      return {
        id: user._id,
        name: user.username,
        avatarUrl: avatarStr,
        health: Math.floor(healthVal),
        healthMax: Math.floor(healthMax),
        hunger: Math.floor(hungerVal),
        hungerMax: Math.floor(hungerMax),
        pillStatus,
        pillEndTime,
        pillRemainingMs,
        modo,
        isCombatReady: healthVal > 0 && hungerVal > 0
      };
    });

    appState.cachedData[appState.selectedUnit] = formattedPlayers;
    appState.lastFetchTime[appState.selectedUnit] = Date.now();
    appState.playersData = formattedPlayers;
    saveCacheToStorage();
    mostrarNotificacion('Datos estratégicos cargados', 1000, 'success');

  } catch (error) {
    console.error("Error consultando API:", error);

    // Si hay caché disponible (de esta sesión o de localStorage), usarla
    if (appState.cachedData[appState.selectedUnit]) {
      appState.playersData = appState.cachedData[appState.selectedUnit];
      renderUsers();
      mostrarNotificacion('Sin conexión. Mostrando datos guardados.', 3500, 'error');
    } else {
      mostrarNotificacion('Error conectando con la API. Intenta más tarde.', 3500, 'error');
    }
  } finally {
    refreshBtn.innerText = "🔄 Actualizar";
    refreshBtn.disabled = false;
    renderUsers();
    renderUsers();
    updateFreshnessIndicator();
  }
}

// ===== FILTRADO Y ORDENAMIENTO =====
function getFilteredAndSortedPlayers() {
  let list = [...appState.playersData];

  if (appState.selectedMode !== 'ALL') {
    list = list.filter(p => p.modo === appState.selectedMode);
  }

  if (appState.smartSort) {
    list = list.filter(p => p.pillStatus === 'BUFF');
    list.sort((a, b) => {
      if (a.isCombatReady !== b.isCombatReady) return b.isCombatReady - a.isCombatReady;
      if (a.pillRemainingMs !== b.pillRemainingMs) return a.pillRemainingMs - b.pillRemainingMs;
      const resourceA = a.health + (a.hunger * 10);
      const resourceB = b.health + (b.hunger * 10);
      return resourceB - resourceA;
    });
    return list;
  }

  if (appState.ordenActual === 'alfabetico') {
    list.sort((a, b) => a.name.localeCompare(b.name));
  } else { // 'estado'
    const resourceScore = (p) => p.health + (p.hunger * 10);

    list.sort((a, b) => {
      if (a.pillStatus === 'BUFF' && b.pillStatus !== 'BUFF') return -1;
      if (a.pillStatus !== 'BUFF' && b.pillStatus === 'BUFF') return 1;
      if (a.pillStatus === 'STANDBY' && b.pillStatus !== 'STANDBY') return -1;
      if (a.pillStatus !== 'STANDBY' && b.pillStatus === 'STANDBY') return 1;
      if (a.pillStatus === 'DEBUFF' && b.pillStatus !== 'DEBUFF') return 1;
      if (a.pillStatus !== 'DEBUFF' && b.pillStatus === 'DEBUFF') return -1;

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
  }
  return list;
}

// ===== RENDERIZADO PRINCIPAL =====
function renderUsers() {
  const players = getFilteredAndSortedPlayers();
  const vista = appState.vistaActual;

  if (vista === 'tabla') {
    renderTabla(players);
  } else {
    renderTarjetas(players);
  }

  actualizarTemporizadores();
}

// ===== RENDERIZADO: TABLA =====
function renderTabla(players) {
  let html = `
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
      <tbody>
  `;

  players.forEach((p, index) => {
    const statusHtml = getStatusHtml(p);
    const modoBadge = p.modo === 'WAR' ? `<span class="badge-mode badge-war">WAR</span>` : `<span class="badge-mode badge-eco">ECO</span>`;
    const healthPercent = p.healthMax > 0 ? Math.min(100, (p.health / p.healthMax) * 100) : 0;
    const hungerPercent = p.hungerMax > 0 ? Math.min(100, (p.hunger / p.hungerMax) * 100) : 0;
    const rowClass = p.isCombatReady ? '' : 'out-of-combat';

    html += `
      <tr class="${rowClass}" style="animation-delay: ${index * 0.05}s">
        <td>
          <div class="player-info">
            <img src="${p.avatarUrl}" class="avatar" alt="Avatar" onerror="this.src='https://ui-avatars.com/api/?name=${p.name}&background=334155&color=fff'">
            <strong>${p.name}</strong>
          </div>
        </td>
        <td>${statusHtml}</td>
        <td>
          <div class="stat-text">${p.health} / ${p.healthMax} HP</div>
          <div class="progress-bg"><div class="progress-fill health-fill" style="width: ${healthPercent}%"></div></div>
        </td>
        <td>
          <div class="stat-text">${p.hunger} / ${p.hungerMax}</div>
          <div class="progress-bg"><div class="progress-fill hunger-fill" style="width: ${hungerPercent}%"></div></div>
        </td>
        <td>${modoBadge}</td>
      </tr>
    `;
  });

  html += `</tbody></table>`;
  usersContainer.innerHTML = html;
}

// ===== RENDERIZADO: TARJETAS (2 columnas) =====
function renderTarjetas(players) {
  let html = `<div class="vista-tarjetas">`;

  players.forEach((p, index) => {
    const statusHtml = getStatusHtml(p);
    const modoBadge = p.modo === 'WAR' ? `<span class="modo-badge war">WAR</span>` : `<span class="modo-badge eco">ECO</span>`;
    const healthPercent = p.healthMax > 0 ? Math.min(100, (p.health / p.healthMax) * 100) : 0;
    const hungerPercent = p.hungerMax > 0 ? Math.min(100, (p.hunger / p.hungerMax) * 100) : 0;
    const estadoClass = p.pillStatus.toLowerCase();

    html += `
      <div class="tarjeta-usuario ${estadoClass}" style="animation-delay: ${index * 0.05}s">
        <div class="player-info">
          <img src="${p.avatarUrl}" class="avatar" alt="Avatar" onerror="this.src='https://ui-avatars.com/api/?name=${p.name}&background=334155&color=fff'">
          <span class="player-name">${p.name}</span>
          ${modoBadge}
        </div>
        <div class="stat-row">
          <span class="stat-text">Vida: ${p.health} / ${p.healthMax} HP</span>
          <div class="progress-bg"><div class="progress-fill health-fill" style="width: ${healthPercent}%"></div></div>
        </div>
        <div class="stat-row">
          <span class="stat-text">Hambre: ${p.hunger} / ${p.hungerMax}</span>
          <div class="progress-bg"><div class="progress-fill hunger-fill" style="width: ${hungerPercent}%"></div></div>
        </div>
        <div class="status-row">${statusHtml}</div>
      </div>
    `;
  });

  html += `</div>`;
  usersContainer.innerHTML = html;
}

// ===== UTILIDADES: ESTADO Y TEMPORIZADORES =====
function getStatusHtml(player) {
  if (player.pillStatus === 'BUFF') {
    return `<span class="status-dot dot-buff"></span> <span class="pill-badge buff">BUFF</span> <span class="timer-text" data-player-id="${player.id}">${formatTimer(player.pillRemainingMs)}</span>`;
  } else if (player.pillStatus === 'DEBUFF') {
    return `<span class="status-dot dot-debuff"></span> <span class="pill-badge debuff">DEBUFF</span> <span class="timer-text" data-player-id="${player.id}">${formatTimer(player.pillRemainingMs)}</span>`;
  } else {
    return `<span class="status-dot dot-standby"></span> <span class="pill-badge standby">En Espera</span>`;
  }
}

function actualizarTemporizadores() {
  const timers = document.querySelectorAll('.timer-text');
  timers.forEach(el => {
    const playerId = el.dataset.playerId;
    if (!playerId) return;
    const player = appState.playersData.find(p => p.id === playerId);
    if (player && player.pillStatus !== 'STANDBY') {
      el.innerText = formatTimer(player.pillRemainingMs);
    }
  });
}

function formatTimer(ms) {
  if (!ms || ms <= 0) return '00:00:00';
  const totalSeconds = Math.floor(ms / 1000);
  const hours = String(Math.floor(totalSeconds / 3600)).padStart(2, '0');
  const minutes = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, '0');
  const seconds = String(totalSeconds % 60).padStart(2, '0');
  return `${hours}:${minutes}:${seconds}`;
}

// ===== BUCLE DE TEMPORIZADORES =====
function startTimerLoop() {
  setInterval(() => {
    let statusChanged = false;
    const now = Date.now();

    appState.playersData.forEach(p => {
      if (p.pillStatus !== 'STANDBY' && p.pillEndTime) {
        p.pillRemainingMs = p.pillEndTime - now;
        if (p.pillRemainingMs <= 0) {
          p.pillRemainingMs = 0;
          p.pillStatus = 'STANDBY';
          p.pillEndTime = null;
          statusChanged = true;
        }
      }
    });

    // Actualizar indicador de frescura cada segundo
    updateFreshnessIndicator();

    if (statusChanged && appState.smartSort) {
      renderUsers();
    } else {
      actualizarTemporizadores();
    }
  }, 1000);
}