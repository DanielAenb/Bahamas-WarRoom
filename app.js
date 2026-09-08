/**
 * Bahamas WarRoom - Script Principal y Conexión API
 */

const CONFIG = {
  UNIT_UCHIHA_ID: "6997581b896745b3e1b21d0f", 
  UNIT_AKATSUKI_ID: "69f542668d7015d064d4147a",
  CACHE_TTL_MS: 5 * 60 * 1000 // 5 minutos en milisegundos
};

let appState = {
  apiKey: localStorage.getItem('warera_api_key') || '',
  selectedUnit: 'Uchiha', 
  selectedMode: 'WAR', 
  smartSort: false,     
  playersData: [], 
  cachedData: {
    'Uchiha': null,
    'Akatsuki': null
  },
  lastFetchTime: {
    'Uchiha': 0,
    'Akatsuki': 0
  }
};

document.addEventListener('DOMContentLoaded', () => {
  initUI();
  loadApiKey();
  fetchApiData(); 
  startTimerLoop();

  setInterval(() => {
    fetchApiData(true);
  }, CONFIG.CACHE_TTL_MS);
});

function initUI() {
  const sidebar = document.getElementById('apiSidebar');
  document.getElementById('openApiBtn').addEventListener('click', () => sidebar.classList.add('open'));
  document.getElementById('closeApiBtn').addEventListener('click', () => sidebar.classList.remove('open'));

  document.getElementById('saveKeyBtn').addEventListener('click', () => {
    const key = document.getElementById('apiKeyInput').value.trim();
    localStorage.setItem('warera_api_key', key);
    appState.apiKey = key;
    sidebar.classList.remove('open');
    alert('API Key guardada localmente.');
  });

  document.querySelectorAll('[data-unit]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      document.querySelectorAll('[data-unit]').forEach(b => b.classList.remove('active'));
      e.target.classList.add('active');
      appState.selectedUnit = e.target.dataset.unit;
      fetchApiData(); 
    });
  });

  document.querySelectorAll('[data-mode]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      document.querySelectorAll('[data-mode]').forEach(b => b.classList.remove('active'));
      e.target.classList.add('active');
      appState.selectedMode = e.target.dataset.mode;
      renderTable(); 
    });
  });

  document.getElementById('smartSortToggle').addEventListener('change', (e) => {
    appState.smartSort = e.target.checked;
    renderTable(); 
  });

  document.getElementById('refreshDataBtn').addEventListener('click', () => {
    fetchApiData(true);
  });
}

function loadApiKey() {
  if (appState.apiKey) {
    document.getElementById('apiKeyInput').value = appState.apiKey;
  }
}

// ==========================================
// CONEXIÓN A LA API Y CACHÉ
// ==========================================
async function fetchApiData(forceRefresh = false) {
  const currentUnitId = appState.selectedUnit === 'Uchiha' ? CONFIG.UNIT_UCHIHA_ID : CONFIG.UNIT_AKATSUKI_ID;
  const now = Date.now();

  if (!forceRefresh && appState.cachedData[appState.selectedUnit] && (now - appState.lastFetchTime[appState.selectedUnit] < CONFIG.CACHE_TTL_MS)) {
    appState.playersData = appState.cachedData[appState.selectedUnit];
    renderTable();
    return;
  }

  const btn = document.getElementById('refreshDataBtn');
  btn.innerText = "⏳ Cargando...";
  btn.disabled = true;

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
        pillStatus: pillStatus,
        pillEndTime: pillEndTime,
        pillRemainingMs: pillRemainingMs,
        modo: modo,
        isCombatReady: Math.floor(healthVal) > 0 && Math.floor(hungerVal) > 0
      };
    });

    appState.cachedData[appState.selectedUnit] = formattedPlayers;
    appState.lastFetchTime[appState.selectedUnit] = Date.now();
    appState.playersData = formattedPlayers;

  } catch (error) {
    console.error("Error consultando la API de WarEra:", error);
    alert("Error conectando con la API. Posible límite de peticiones alcanzado.");
  } finally {
    btn.innerText = "🔄 Actualizar";
    btn.disabled = false;
    renderTable(); 
  }
}

// ==========================================
// RENDERIZADO Y LÓGICA DE TABLA
// ==========================================
function getFilteredAndSortedPlayers() {
  let list = [...appState.playersData];

  if (appState.smartSort) {
    // Prioridad Táctica: SOLO BUFF (se excluyen debuff y standby)
    list = list.filter(p => p.pillStatus === 'BUFF');

    list.sort((a, b) => {
      // 1. Priorizar si tienen recursos para combatir
      if (a.isCombatReady !== b.isCombatReady) {
        return b.isCombatReady - a.isCombatReady; 
      }
      // 2. Tiempo antes de que se acabe el buff (menor tiempo restante primero)
      if (a.pillRemainingMs !== b.pillRemainingMs) {
        return a.pillRemainingMs - b.pillRemainingMs;
      }
      // 3. Basado en vida y hambre
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

function renderTable() {
  const tbody = document.getElementById('unitTableBody');
  tbody.innerHTML = '';
  const players = getFilteredAndSortedPlayers();

  players.forEach((p, index) => {
    const tr = document.createElement('tr');
    tr.style.animationDelay = `${index * 0.05}s`;
    
    if (!p.isCombatReady) {
      tr.classList.add('out-of-combat');
    }

    let statusContent = '';
    if (p.pillStatus === 'BUFF') {
      statusContent = `<div class="timer-wrapper"><span class="status-dot dot-buff"></span> <span class="pill-badge buff">BUFF</span> <span class="timer-text">${formatTimer(p.pillRemainingMs)}</span></div>`;
    } else if (p.pillStatus === 'DEBUFF') {
      statusContent = `<div class="timer-wrapper"><span class="status-dot dot-debuff"></span> <span class="pill-badge debuff">DEBUFF</span> <span class="timer-text">${formatTimer(p.pillRemainingMs)}</span></div>`;
    } else {
      statusContent = `<div class="timer-wrapper"><span class="status-dot dot-standby"></span> <span class="pill-badge standby">En Espera</span></div>`;
    }

    const modoBadge = p.modo === 'WAR' ? `<span class="badge-mode badge-war">WAR</span>` : `<span class="badge-mode badge-eco">ECO</span>`;
    const healthPercent = Math.min(100, p.health);
    const hungerPercent = Math.min(100, (p.hunger / 10) * 100);

    tr.innerHTML = `
      <td>
        <div class="player-info">
          <img src="${p.avatarUrl}" class="avatar" alt="Avatar" onerror="this.src='https://ui-avatars.com/api/?name=${p.name}&background=334155&color=fff'">
          <strong>${p.name}</strong>
        </div>
      </td>
      <td>${statusContent}</td>
      <td>
        <div class="stat-text">${p.health} HP</div>
        <div class="progress-bg"><div class="progress-fill health-fill" style="width: ${healthPercent}%"></div></div>
      </td>
      <td>
        <div class="stat-text">${p.hunger} / 10</div>
        <div class="progress-bg"><div class="progress-fill hunger-fill" style="width: ${hungerPercent}%"></div></div>
      </td>
      <td>${modoBadge}</td>
    `;

    tbody.appendChild(tr);
  });
}

function formatTimer(ms) {
  if (!ms || ms <= 0) return '00:00:00';
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

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
          statusChanged = true; // Un buff expiró, requiere reordenar
        }
      }
    });

    // Si un estado expira, re-renderizamos; de lo contrario, actualizamos solo el texto del reloj sin parpadeos ni bucles
    if (statusChanged && appState.smartSort) {
      renderTable();
    } else {
      const currentList = getFilteredAndSortedPlayers();
      const rows = document.querySelectorAll('#unitTableBody tr');
      rows.forEach((tr, i) => {
        const player = currentList[i];
        if (player && player.pillStatus !== 'STANDBY') {
          const timerSpan = tr.querySelector('.timer-text');
          if (timerSpan) timerSpan.innerText = formatTimer(player.pillRemainingMs);
        }
      });
    }
  }, 1000);
}