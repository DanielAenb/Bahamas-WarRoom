/**
 * Bahamas WarRoom - Script Principal con Configuración y Vistas
 */

const CONFIG = {
  UNIT_UCHIHA_ID: "6997581b896745b3e1b21d0f",
  UNIT_AKATSUKI_ID: "69f542668d7015d064d4147a",
  CACHE_TTL_MS: 5 * 60 * 1000 // 5 minutos
};

// ===== ESTADO GLOBAL =====
let appState = {
  apiKey: localStorage.getItem('warera_api_key') || '',
  selectedUnit: 'Uchiha',
  selectedMode: 'WAR',
  smartSort: false,
  playersData: [],
  cachedData: { 'Uchiha': null, 'Akatsuki': null },
  lastFetchTime: { 'Uchiha': 0, 'Akatsuki': 0 },
  vistaActual: 'tabla',      // 'tabla', 'tarjeta', 'tarjeta-compacta'
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

// ===== INICIALIZACIÓN =====
document.addEventListener('DOMContentLoaded', () => {
  // Cargar API Key guardada
  if (appState.apiKey) {
    apiKeyInput.value = appState.apiKey;
  }

  // Eventos del sidebar
  openApiBtn.addEventListener('click', () => {
    sidebar.classList.add('open');
    overlay.classList.add('active');
  });
  closeApiBtn.addEventListener('click', cerrarSidebar);
  overlay.addEventListener('click', cerrarSidebar);

  // Guardar API Key
  saveKeyBtn.addEventListener('click', () => {
    const key = apiKeyInput.value.trim();
    localStorage.setItem('warera_api_key', key);
    appState.apiKey = key;
    alert('API Key guardada localmente.');
    cerrarSidebar();
  });

  // Selector de unidad
  document.querySelectorAll('[data-unit]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      document.querySelectorAll('[data-unit]').forEach(b => b.classList.remove('active'));
      e.target.classList.add('active');
      appState.selectedUnit = e.target.dataset.unit;
      fetchApiData();
    });
  });

  // Selector de modo
  document.querySelectorAll('[data-mode]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      document.querySelectorAll('[data-mode]').forEach(b => b.classList.remove('active'));
      e.target.classList.add('active');
      appState.selectedMode = e.target.dataset.mode;
      renderUsers();
    });
  });

  // Prioridad táctica
  smartSortToggle.addEventListener('change', (e) => {
    appState.smartSort = e.target.checked;
    renderUsers();
  });

  // Botón actualizar
  refreshBtn.addEventListener('click', () => {
    fetchApiData(true);
  });

  // Radio buttons de vista
  radioVista.forEach(radio => {
    radio.addEventListener('change', (e) => {
      appState.vistaActual = e.target.value;
      appState.eleccionManual = true;
      renderUsers();
      localStorage.setItem('vistaPreferida', appState.vistaActual);
    });
  });

  // Detección de cambio de tamaño (responsive automático)
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

  // Cargar preferencia de vista guardada
  const vistaGuardada = localStorage.getItem('vistaPreferida');
  if (vistaGuardada) {
    appState.vistaActual = vistaGuardada;
    appState.eleccionManual = true;
    document.querySelector(`input[name="vistaToggle"][value="${vistaGuardada}"]`).checked = true;
  } else {
    determinarVistaAutomatica();
  }

  // Obtener datos y renderizar
  fetchApiData();
  startTimerLoop();

  // Refresco periódico
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
  // Puedes elegir aquí qué vista usar en móvil: 'tarjeta' o 'tarjeta-compacta'
  appState.vistaActual = esMovil ? 'tarjeta' : 'tabla';
  document.querySelector(`input[name="vistaToggle"][value="${appState.vistaActual}"]`).checked = true;
}

// ===== CONEXIÓN API Y CACHÉ =====
async function fetchApiData(forceRefresh = false) {
  const currentUnitId = appState.selectedUnit === 'Uchiha' ? CONFIG.UNIT_UCHIHA_ID : CONFIG.UNIT_AKATSUKI_ID;
  const now = Date.now();

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
      const hungerVal = user.skills?.hunger?.currentBarValue || 0;
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
        hunger: Math.floor(hungerVal),
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

  } catch (error) {
    console.error("Error consultando API:", error);
    alert("Error conectando con la API. Posible límite de peticiones.");
  } finally {
    refreshBtn.innerText = "🔄 Actualizar";
    refreshBtn.disabled = false;
    renderUsers();
  }
}

// ===== FILTRADO Y ORDENAMIENTO =====
function getFilteredAndSortedPlayers() {
  let list = [...appState.playersData];

  if (appState.smartSort) {
    // Prioridad Táctica: solo BUFF
    list = list.filter(p => p.pillStatus === 'BUFF');
    list.sort((a, b) => {
      if (a.isCombatReady !== b.isCombatReady) return b.isCombatReady - a.isCombatReady;
      if (a.pillRemainingMs !== b.pillRemainingMs) return a.pillRemainingMs - b.pillRemainingMs;
      const resourceA = a.health + (a.hunger * 10);
      const resourceB = b.health + (b.hunger * 10);
      return resourceB - resourceA;
    });
  } else {
    if (appState.selectedMode !== 'ALL') {
      list = list.filter(p => p.modo === appState.selectedMode);
    }
    list.sort((a, b) => a.name.localeCompare(b.name));
  }
  return list;
}

// ===== RENDERIZADO PRINCIPAL =====
function renderUsers() {
  const players = getFilteredAndSortedPlayers();
  const vista = appState.vistaActual;

  if (vista === 'tabla') {
    renderTabla(players);
  } else if (vista === 'tarjeta') {
    renderTarjetas(players);
  } else if (vista === 'tarjeta-compacta') {
    renderTarjetasCompactas(players);
  }

  actualizarTemporizadores();
}

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
    const healthPercent = Math.min(100, p.health);
    const hungerPercent = Math.min(100, (p.hunger / 10) * 100);
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
          <div class="stat-text">${p.health} HP</div>
          <div class="progress-bg"><div class="progress-fill health-fill" style="width: ${healthPercent}%"></div></div>
        </td>
        <td>
          <div class="stat-text">${p.hunger} / 10</div>
          <div class="progress-bg"><div class="progress-fill hunger-fill" style="width: ${hungerPercent}%"></div></div>
        </td>
        <td>${modoBadge}</td>
      </tr>
    `;
  });

  html += `</tbody></table>`;
  usersContainer.innerHTML = html;
}

function renderTarjetas(players) {
  let html = `<div class="vista-tarjetas">`;

  players.forEach((p, index) => {
    const statusHtml = getStatusHtml(p);
    const modoBadge = p.modo === 'WAR' ? `<span class="badge-mode badge-war">WAR</span>` : `<span class="badge-mode badge-eco">ECO</span>`;
    const healthPercent = Math.min(100, p.health);
    const hungerPercent = Math.min(100, (p.hunger / 10) * 100);

    html += `
      <div class="tarjeta-usuario" style="animation-delay: ${index * 0.05}s">
        <div class="player-info">
          <img src="${p.avatarUrl}" class="avatar" alt="Avatar" onerror="this.src='https://ui-avatars.com/api/?name=${p.name}&background=334155&color=fff'">
          <span class="player-name">${p.name}</span>
        </div>
        <div class="status-row">${statusHtml}</div>
        <div class="stat-row">
          <span class="stat-text">Vida: ${p.health} HP</span>
          <div class="progress-bg"><div class="progress-fill health-fill" style="width: ${healthPercent}%"></div></div>
        </div>
        <div class="stat-row">
          <span class="stat-text">Hambre: ${p.hunger} / 10</span>
          <div class="progress-bg"><div class="progress-fill hunger-fill" style="width: ${hungerPercent}%"></div></div>
        </div>
        <div>${modoBadge}</div>
      </div>
    `;
  });

  html += `</div>`;
  usersContainer.innerHTML = html;
}

function renderTarjetasCompactas(players) {
  let html = `<div class="vista-tarjetas-compactas">`;

  players.forEach((p, index) => {
    const statusHtml = getStatusHtml(p);
    const modoBadge = p.modo === 'WAR' ? `<span class="badge-mode badge-war">WAR</span>` : `<span class="badge-mode badge-eco">ECO</span>`;
    const healthPercent = Math.min(100, p.health);
    const hungerPercent = Math.min(100, (p.hunger / 10) * 100);

    html += `
      <div class="tarjeta-compacta" style="animation-delay: ${index * 0.05}s">
        <div class="player-info">
          <img src="${p.avatarUrl}" class="avatar" alt="Avatar" onerror="this.src='https://ui-avatars.com/api/?name=${p.name}&background=334155&color=fff'">
          <span class="player-name">${p.name}</span>
        </div>
        <div class="status-row">${statusHtml}</div>
        <div class="stat-row">
          <span class="stat-text">Vida ${p.health}</span>
          <div class="progress-bg"><div class="progress-fill health-fill" style="width: ${healthPercent}%"></div></div>
        </div>
        <div class="stat-row">
          <span class="stat-text">Hambre ${p.hunger}</span>
          <div class="progress-bg"><div class="progress-fill hunger-fill" style="width: ${hungerPercent}%"></div></div>
        </div>
        <div>${modoBadge}</div>
      </div>
    `;
  });

  html += `</div>`;
  usersContainer.innerHTML = html;
}

function getStatusHtml(player) {
  if (player.pillStatus === 'BUFF') {
    return `<div class="timer-wrapper"><span class="status-dot dot-buff"></span> <span class="pill-badge buff">BUFF</span> <span class="timer-text" data-player-id="${player.id}">${formatTimer(player.pillRemainingMs)}</span></div>`;
  } else if (player.pillStatus === 'DEBUFF') {
    return `<div class="timer-wrapper"><span class="status-dot dot-debuff"></span> <span class="pill-badge debuff">DEBUFF</span> <span class="timer-text" data-player-id="${player.id}">${formatTimer(player.pillRemainingMs)}</span></div>`;
  } else {
    return `<div class="timer-wrapper"><span class="status-dot dot-standby"></span> <span class="pill-badge standby">En Espera</span></div>`;
  }
}

// ===== ACTUALIZACIÓN DE TEMPORIZADORES =====
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

    if (statusChanged && appState.smartSort) {
      renderUsers();
    } else {
      actualizarTemporizadores();
    }
  }, 1000);
}