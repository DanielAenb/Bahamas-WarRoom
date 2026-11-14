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
  function init(d) { deps = d; }

  // ===== ESTADO EFECTIVO (manual override > API) =====
  function effectiveStatusOf(player) {
    const manual = deps.getManualState ? deps.getManualState(player.id) : null;
    return manual || player.pillStatus;
  }

  function calcForPlayer(player, state) {
    return deps.calcDamagePotential(player, {
      contarRegen: state.contarRegen,
      battleBonus: state.battleBonus,
      horas: state.regenHours,
      effectivePillStatus: effectiveStatusOf(player)
    });
  }

  // ===== ESTADOS ESPECIALES (sin cambios) =====
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

  // ===== STATUS HTML CON DROPDOWN =====
function getStatusHtml(player) {
  const safeId = deps.escapeHtml(player.id);
  const effective = effectiveStatusOf(player);

  // Solo los BUFF reales (pill activo) pueden abrir el menú.
  // TIRED también lo permite porque el pill sigue activo por debajo.
  const canOpenMenu = player.pillStatus === 'BUFF';

  let dotClass, badgeClass, label, timer = '';

  if (effective === 'BUFF') {
    dotClass = 'dot-buff'; badgeClass = 'buff'; label = 'BUFF';
    if (player.pillRemainingMs > 0) {
      timer = `<span class="timer-text" data-player-id="${safeId}">${deps.formatTimer(player.pillRemainingMs)}</span>`;
    }
  } else if (effective === 'DEBUFF') {
    dotClass = 'dot-debuff'; badgeClass = 'debuff'; label = 'DEBUFF';
    if (player.pillRemainingMs > 0) {
      timer = `<span class="timer-text" data-player-id="${safeId}">${deps.formatTimer(player.pillRemainingMs)}</span>`;
    }
  } else if (effective === 'TIRED') {
    // TIRED representa "descansando" — no se muestra el timer del pill
    dotClass = 'dot-tired'; badgeClass = 'tired'; label = 'TIRED';
  } else {
    dotClass = 'dot-standby'; badgeClass = 'standby'; label = 'En Espera';
  }

  const triggerClass = canOpenMenu ? ' status-trigger' : '';
  const triggerAttrs = canOpenMenu
    ? ` data-status-trigger="${safeId}" role="button" tabindex="0" aria-haspopup="menu" aria-expanded="false" title="Cambiar estado"`
    : '';

  return `
    <div class="status-dropdown" data-status-dropdown="${safeId}">
      <span class="status-dot ${dotClass}"></span>
      <span class="pill-badge ${badgeClass}${triggerClass}"${triggerAttrs}>${label}</span>
      ${timer}
    </div>`;
}

  function getLevelBadge(player, compact = false) {
    const level = Number(player.level);
    if (!Number.isFinite(level) || level <= 0) return '';
    const n = Math.floor(level);
    return `<span class="player-level${compact ? ' player-level-sm' : ''}" title="Nivel ${n}">Nv.${compact ? '' : ' '}${n}</span>`;
  }

  // ===== VISTAS =====
  function renderTabla(players) {
    const state = deps.getState();
    const showDamage = !!state.damagePanelActive;

    const rows = players.map((p, index) => {
      const eff = effectiveStatusOf(p);
      const statusHtml = getStatusHtml(p);
      const modoBadge = p.modo === 'WAR'
        ? `<span class="badge-mode badge-war">WAR</span>`
        : `<span class="badge-mode badge-eco">ECO</span>`;
      const healthPct = p.healthMax > 0 ? Math.min(100, (p.health / p.healthMax) * 100) : 0;
      const hungerPct = p.hungerMax > 0 ? Math.min(100, (p.hunger / p.hungerMax) * 100) : 0;

      let rowClass = p.isCombatReady ? '' : 'out-of-combat';
      if (eff === 'TIRED') rowClass = rowClass ? `${rowClass} tr-tired` : 'tr-tired';

      const safeName = deps.escapeHtml(p.name);
      const safeAvatar = deps.escapeHtml(p.avatarUrl);
      const safeId = deps.escapeHtml(p.id);

      const damageCell = showDamage
        ? `<td class="damage-cell" data-damage-id="${safeId}">${deps.formatDmg(calcForPlayer(p, state).dmgTotal)}</td>`
        : '';

      return `
        <tr class="${rowClass}" data-copy-player="${safeId}" style="animation-delay: ${index * 0.05}s">
          <td>
            <div class="player-info">
              <img src="${safeAvatar}" class="avatar" alt="${safeName}" loading="lazy" data-avatar-player="${safeId}">
              <strong>${safeName}</strong>
              ${getLevelBadge(p)}
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
      const eff = effectiveStatusOf(p);
      const statusHtml = getStatusHtml(p);
      const modoBadge = p.modo === 'WAR'
        ? `<span class="modo-badge war">WAR</span>`
        : `<span class="modo-badge eco">ECO</span>`;
      const healthPct = p.healthMax > 0 ? Math.min(100, (p.health / p.healthMax) * 100) : 0;
      const hungerPct = p.hungerMax > 0 ? Math.min(100, (p.hunger / p.hungerMax) * 100) : 0;
      const estadoClass = eff.toLowerCase();
      const safeName = deps.escapeHtml(p.name);
      const safeAvatar = deps.escapeHtml(p.avatarUrl);
      const safeId = deps.escapeHtml(p.id);

      const damageSpan = showDamage
        ? `<span class="damage-badge" data-damage-id="${safeId}">${deps.formatDmg(calcForPlayer(p, state).dmgTotal)}</span>`
        : '';

      return `
        <div class="tarjeta-usuario ${estadoClass}" data-copy-player="${safeId}" style="animation-delay: ${index * 0.05}s">
          <div class="player-info">
            <img src="${safeAvatar}" class="avatar" alt="${safeName}" loading="lazy" data-avatar-player="${safeId}">
            <div class="player-name-wrap">
              <span class="player-name">${safeName}</span>
              ${getLevelBadge(p)}
            </div>
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
      const eff = effectiveStatusOf(p);
      const healthPct = p.healthMax > 0 ? Math.min(100, (p.health / p.healthMax) * 100) : 0;
      const hungerPct = p.hungerMax > 0 ? Math.min(100, (p.hunger / p.hungerMax) * 100) : 0;
      const estadoClass = eff.toLowerCase();
      const safeName = deps.escapeHtml(p.name);
      const safeAvatar = deps.escapeHtml(p.avatarUrl);
      const safeId = deps.escapeHtml(p.id);
      const shortName = deps.escapeHtml(p.name.length > 12 ? p.name.slice(0, 11) + '…' : p.name);

      let statusMini;
      if (eff === 'BUFF') {
        statusMini = `<span class="status-dot dot-buff"></span><span class="timer-text" data-player-id="${safeId}">${deps.formatTimer(p.pillRemainingMs)}</span>`;
      } else if (eff === 'DEBUFF') {
        statusMini = `<span class="status-dot dot-debuff"></span><span class="timer-text" data-player-id="${safeId}">${deps.formatTimer(p.pillRemainingMs)}</span>`;
      } else if (eff === 'TIRED') {
        statusMini = `<span class="status-dot dot-tired"></span><span class="mini-standby" style="color:#f97316">TIRED</span>`;
      } else {
        statusMini = `<span class="status-dot dot-standby"></span><span class="mini-standby">STBY</span>`;
      }

      const damageMini = showDamage
        ? `<span class="damage-mini" data-damage-id="${safeId}">${deps.formatDmg(calcForPlayer(p, state).dmgTotal)}</span>`
        : '';

      return `
        <div class="mini-card ${estadoClass}" data-copy-player="${safeId}" style="animation-delay: ${index * 0.02}s">
          <div class="mini-top">
            <img src="${safeAvatar}" class="mini-avatar" alt="${safeName}" loading="lazy" data-avatar-player="${safeId}">
            <span class="mini-name" title="${safeName}">${shortName}</span>
            ${getLevelBadge(p, true)}
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
      if (player && effectiveStatusOf(player) !== 'STANDBY') {
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

    document.querySelectorAll('[data-damage-id]').forEach(el => {
      const player = state.playersById.get(el.dataset.damageId);
      if (!player) return;
      el.textContent = deps.formatDmg(calcForPlayer(player, state).dmgTotal);
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

    const players = deps.getFilteredAndSortedPlayers().filter(p => effectiveStatusOf(p) === 'BUFF');
    if (players.length === 0) { deps.damagePanel.hidden = true; return; }

    let total = 0;
    for (const p of players) total += calcForPlayer(p, state).dmgTotal;

    if (deps.damagePanelTotal) deps.damagePanelTotal.textContent = deps.formatDmg(total);
    if (deps.damagePanelMeta) {
      deps.damagePanelMeta.textContent =
        `${players.length} buffeados · Bonus ${state.battleBonus}% · Regen ${state.contarRegen ? `ON · ${state.regenHours}h` : 'OFF'}`;
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
      .filter(p => effectiveStatusOf(p) === 'DEBUFF' && p.pillRemainingMs > 0 && p.pillRemainingMs <= deps.DEBUFF_WINDOW_MS)
      .sort((a, b) => a.pillRemainingMs - b.pillRemainingMs);

    if (debuffed.length === 0) { deps.debuffPanel.hidden = true; return; }

    if (deps.debuffPanelMeta) {
      deps.debuffPanelMeta.textContent = `${debuffed.length} jugador${debuffed.length === 1 ? '' : 'es'} · ≤1h`;
    }
    if (deps.debuffPanelBody) {
      deps.debuffPanelBody.innerHTML = debuffed.map(p => {
        const safeName = deps.escapeHtml(p.name);
        const safeAvatar = deps.escapeHtml(p.avatarUrl);
        const safeId = deps.escapeHtml(p.id);
        const shortName = p.name.length > 14 ? p.name.slice(0, 13) + '…' : p.name;
        return `
          <div class="debuff-card" data-copy-player="${safeId}">
            <img src="${safeAvatar}" alt="${safeName}" loading="lazy" data-avatar-player="${safeId}">
            <span class="debuff-card-name" title="${safeName}">${deps.escapeHtml(shortName)}</span>
            ${getLevelBadge(p, true)}
            <span class="debuff-card-time" data-player-id="${safeId}">${deps.formatTimer(p.pillRemainingMs)}</span>
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