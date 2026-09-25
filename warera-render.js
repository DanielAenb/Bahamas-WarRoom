/**
 * Bahamas WarRoom — Capa de render (datos → HTML).
 * Expone window.WareraRender.
 *
 * Requiere init({...}) antes de usar cualquier función.
 * No accede a appState directamente: lo recibe vía deps.getState().
 */
(function () {
  'use strict';

  let deps = null;

  function init(d) {
    deps = d;
  }

  // ===== ESTADOS ESPECIALES =====
  function renderApiDown() {
    deps.usersContainer.innerHTML = `
      <div class="empty-state api-down">
        <div class="empty-state-icon">📡</div>
        <p class="api-down-title">API NO DISPONIBLE</p>
        <p class="api-down-sub">No se pudieron cargar datos y la caché es demasiado antigua.</p>
      </div>`;
  }

  function renderLoading() {
    deps.usersContainer.innerHTML = `
      <div class="empty-state loading">
        <div class="empty-state-icon">⏳</div>
        <p>Cargando información…</p>
      </div>`;
  }

  function renderEmptyState() {
    const smartSort = deps.getState().smartSort;
    const motivo = smartSort
      ? 'No hay jugadores con BUFF activo en este momento.'
      : 'No hay jugadores que coincidan con los filtros actuales.';
    deps.usersContainer.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">🕵️</div>
        <p>${motivo}</p>
      </div>`;
  }

  // ===== HELPERS DE STATUS =====
  function getStatusHtml(player) {
    if (player.pillStatus === 'BUFF') {
      return `<span class="status-dot dot-buff"></span> <span class="pill-badge buff">BUFF</span> <span class="timer-text" data-player-id="${player.id}">${deps.formatTimer(player.pillRemainingMs)}</span>`;
    }
    if (player.pillStatus === 'DEBUFF') {
      return `<span class="status-dot dot-debuff"></span> <span class="pill-badge debuff">DEBUFF</span> <span class="timer-text" data-player-id="${player.id}">${deps.formatTimer(player.pillRemainingMs)}</span>`;
    }
    return `<span class="status-dot dot-standby"></span> <span class="pill-badge standby">En Espera</span>`;
  }

  // ===== VISTAS PRINCIPALES =====
  function renderTabla(players) {
    const state = deps.getState();
    const showDamage = !!state.damagePanelActive;

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
            deps.formatDmg(deps.calcDamagePotential(p, {
              contarRegen: state.contarRegen,
              battleBonus: state.battleBonus
            }).dmgTotal)
          }</td>`
        : '';

      return `
        <tr class="${rowClass}" data-copy-player="${p.id}" style="animation-delay: ${index * 0.05}s">
          <td>
            <div class="player-info">
              <img src="${p.avatarUrl}" class="avatar" alt="" loading="lazy" data-avatar-player="${p.id}"
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

    deps.usersContainer.innerHTML = `
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
    const state = deps.getState();
    const showDamage = !!state.damagePanelActive;

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
            deps.formatDmg(deps.calcDamagePotential(p, {
              contarRegen: state.contarRegen,
              battleBonus: state.battleBonus
            }).dmgTotal)
          }</span>`
        : '';

      return `
        <div class="tarjeta-usuario ${estadoClass}" data-copy-player="${p.id}" style="animation-delay: ${index * 0.05}s">
          <div class="player-info">
            <img src="${p.avatarUrl}" class="avatar" alt="" loading="lazy" data-avatar-player="${p.id}"
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

    deps.usersContainer.innerHTML = `<div class="vista-tarjetas">${cards}</div>`;
  }

  function renderCompacta(players) {
    const state = deps.getState();
    const showDamage = !!state.damagePanelActive;

    const cards = players.map((p, index) => {
      const healthPct = p.healthMax > 0 ? Math.min(100, (p.health / p.healthMax) * 100) : 0;
      const hungerPct = p.hungerMax > 0 ? Math.min(100, (p.hunger / p.hungerMax) * 100) : 0;
      const estadoClass = p.pillStatus.toLowerCase();
      const safeName = encodeURIComponent(p.name);
      const shortName = p.name.length > 12 ? p.name.slice(0, 11) + '…' : p.name;

      let statusMini;
      if (p.pillStatus === 'BUFF') {
        statusMini = `<span class="status-dot dot-buff"></span><span class="timer-text" data-player-id="${p.id}">${deps.formatTimer(p.pillRemainingMs)}</span>`;
      } else if (p.pillStatus === 'DEBUFF') {
        statusMini = `<span class="status-dot dot-debuff"></span><span class="timer-text" data-player-id="${p.id}">${deps.formatTimer(p.pillRemainingMs)}</span>`;
      } else {
        statusMini = `<span class="status-dot dot-standby"></span><span class="mini-standby">STBY</span>`;
      }

      const damageMini = showDamage
        ? `<span class="damage-mini" data-damage-id="${p.id}">${
            deps.formatDmg(deps.calcDamagePotential(p, {
              contarRegen: state.contarRegen,
              battleBonus: state.battleBonus
            }).dmgTotal)
          }</span>`
        : '';

      return `
        <div class="mini-card ${estadoClass}" data-copy-player="${p.id}" style="animation-delay: ${index * 0.02}s">
          <div class="mini-top">
            <img src="${p.avatarUrl}" class="mini-avatar" alt="" loading="lazy" data-avatar-player="${p.id}"
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

    deps.usersContainer.innerHTML = `<div class="vista-compacta">${cards}</div>`;
  }

  // ===== TIMERS Y DAÑOS DINÁMICOS =====
  function actualizarTemporizadores() {
    const state = deps.getState();
    document.querySelectorAll('.timer-text').forEach(el => {
      const player = state.playersById.get(el.dataset.playerId);
      if (player && player.pillStatus !== 'STANDBY') {
        el.innerText = deps.formatTimer(player.pillRemainingMs);
      }
    });

    document.querySelectorAll('.debuff-card-time[data-player-id]').forEach(el => {
      const player = state.playersById.get(el.dataset.playerId);
      if (player) el.innerText = deps.formatTimer(player.pillRemainingMs);
    });

    actualizarDañosEnVista();
  }

  function actualizarDañosEnVista() {
    const state = deps.getState();
    if (!state.damagePanelActive) return;
    const opts = { contarRegen: state.contarRegen, battleBonus: state.battleBonus };
    document.querySelectorAll('[data-damage-id]').forEach(el => {
      const player = state.playersById.get(el.dataset.damageId);
      if (!player) return;
      const calc = deps.calcDamagePotential(player, opts);
      el.textContent = deps.formatDmg(calc.dmgTotal);
    });
  }

  // ===== PANELES =====
  function renderDamagePanel() {
    if (!deps.damagePanel) return;
    const state = deps.getState();

    if (!state.smartSort || !state.damagePanelActive) {
      deps.damagePanel.hidden = true;
      return;
    }

    const players = deps.getFilteredAndSortedPlayers().filter(p => p.pillStatus === 'BUFF');
    if (players.length === 0) { deps.damagePanel.hidden = true; return; }

    let total = 0;
    for (const p of players) {
      const calc = deps.calcDamagePotential(p, {
        contarRegen: state.contarRegen,
        battleBonus: state.battleBonus
      });
      total += calc.dmgTotal;
    }

    if (deps.damagePanelTotal) deps.damagePanelTotal.textContent = deps.formatDmg(total);
    if (deps.damagePanelMeta) {
      deps.damagePanelMeta.textContent =
        `${players.length} buffeados · Bonus ${state.battleBonus}% · Regen ${state.contarRegen ? 'ON' : 'OFF'}`;
    }

    deps.damagePanel.hidden = false;
  }

  function renderDebuffPanel() {
    if (!deps.debuffPanel) return;
    const state = deps.getState();
    if (!state.smartSort) { deps.debuffPanel.hidden = true; return; }

    let list = [...state.playersData];
    if (state.selectedMode !== 'ALL') list = list.filter(p => p.modo === state.selectedMode);

    const debuffed = list
      .filter(p => p.pillStatus === 'DEBUFF' && p.pillRemainingMs > 0 && p.pillRemainingMs <= deps.DEBUFF_WINDOW_MS)
      .sort((a, b) => a.pillRemainingMs - b.pillRemainingMs);

    if (debuffed.length === 0) { deps.debuffPanel.hidden = true; return; }

    if (deps.debuffPanelMeta) {
      deps.debuffPanelMeta.textContent = `${debuffed.length} jugador${debuffed.length === 1 ? '' : 'es'} · ≤1h`;
    }

    if (deps.debuffPanelBody) {
      deps.debuffPanelBody.innerHTML = debuffed.map(p => {
        const safeName = deps.escapeHtml(p.name);
        const shortName = p.name.length > 14 ? p.name.slice(0, 13) + '…' : p.name;
        return `
          <div class="debuff-card" data-copy-player="${p.id}">
            <img src="${p.avatarUrl}" alt="" loading="lazy" data-avatar-player="${p.id}"
                 onerror="this.onerror=null;this.src='https://ui-avatars.com/api/?name=${encodeURIComponent(p.name)}&background=334155&color=fff'">
            <span class="debuff-card-name" title="${safeName}">${deps.escapeHtml(shortName)}</span>
            <span class="debuff-card-time" data-player-id="${p.id}">${deps.formatTimer(p.pillRemainingMs)}</span>
          </div>`;
      }).join('');
    }

    deps.debuffPanel.hidden = false;
  }

  window.WareraRender = {
    init,
    renderApiDown,
    renderLoading,
    renderEmptyState,
    getStatusHtml,
    renderTabla,
    renderTarjetas,
    renderCompacta,
    actualizarTemporizadores,
    actualizarDañosEnVista,
    renderDamagePanel,
    renderDebuffPanel
  };
})();