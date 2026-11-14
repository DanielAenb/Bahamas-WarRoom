/**
 * Bahamas WarRoom — Utilidades puras.
 * Sin DOM, sin estado, sin API.
 * Expone window.WareraUtils.
 */
(function () {
  'use strict';

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[c]);
  }

  function formatDmg(n) {
    if (!isFinite(n) || n <= 0) return '0';
    if (n >= 1e9) return (n / 1e9).toFixed(2) + 'B';
    if (n >= 1e6) return (n / 1e6).toFixed(2) + 'M';
    if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K';
    return Math.floor(n).toString();
  }

  function formatTimer(ms) {
    if (!ms || ms <= 0) return '00:00:00';
    const totalSeconds = Math.floor(ms / 1000);
    const hours   = String(Math.floor(totalSeconds / 3600)).padStart(2, '0');
    const minutes = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, '0');
    const seconds = String(totalSeconds % 60).padStart(2, '0');
    return `${hours}:${minutes}:${seconds}`;
  }

  function truncateText(ctx, text, maxWidth) {
    if (ctx.measureText(text).width <= maxWidth) return text;
    let t = text;
    while (t.length > 0 && ctx.measureText(t + '…').width > maxWidth) t = t.slice(0, -1);
    return t + '…';
  }

// Firma nueva: (playersData, selectedMode, smartSort, ordenActual, getEffectiveStatus?)
// getEffectiveStatus es opcional. Si no se pasa, se usa p.pillStatus (compat con tests).
function getFilteredAndSortedPlayers(playersData, selectedMode, smartSort, ordenActual, getEffectiveStatus) {
  let list = [...playersData];

  if (selectedMode !== 'ALL') {
    const modeTarget = String(selectedMode).trim().toUpperCase();
    list = list.filter(p => String(p.modo || '').trim().toUpperCase() === modeTarget);
  }

  const statusOf = typeof getEffectiveStatus === 'function'
    ? (p) => getEffectiveStatus(p)
    : (p) => p.pillStatus;

  if (smartSort) {
    return list.filter(p => statusOf(p) === 'BUFF').sort((a, b) => {
      if (a.isCombatReady !== b.isCombatReady) return b.isCombatReady - a.isCombatReady;
      if (a.pillRemainingMs !== b.pillRemainingMs) return a.pillRemainingMs - b.pillRemainingMs;
      return (b.health + b.hunger * 10) - (a.health + a.hunger * 10);
    });
  }

  if (ordenActual === 'alfabetico') {
    list.sort((a, b) => a.name.localeCompare(b.name));
    return list;
  }

  const score = (p) => p.health + p.hunger * 10;
  list.sort((a, b) => {
    const sa = statusOf(a);
    const sb = statusOf(b);
    if (sa === 'BUFF'    && sb !== 'BUFF')    return -1;
    if (sa !== 'BUFF'    && sb === 'BUFF')    return  1;
    if (sa === 'STANDBY' && sb !== 'STANDBY') return -1;
    if (sa !== 'STANDBY' && sb === 'STANDBY') return  1;
    if (sa === 'DEBUFF'  && sb !== 'DEBUFF')  return  1;
    if (sa !== 'DEBUFF'  && sb === 'DEBUFF')  return -1;

    if (sa === 'BUFF') {
      if (a.pillRemainingMs !== b.pillRemainingMs) return a.pillRemainingMs - b.pillRemainingMs;
      return score(b) - score(a);
    }
    if (sa === 'STANDBY') {
      if (score(a) !== score(b)) return score(b) - score(a);
      return a.name.localeCompare(b.name);
    }
    if (sa === 'DEBUFF') return a.pillRemainingMs - b.pillRemainingMs;
    return 0;
  });
  return list;
}


  window.WareraUtils = {
    escapeHtml,
    formatDmg,
    formatTimer,
    truncateText,
    getFilteredAndSortedPlayers
  };
})();
