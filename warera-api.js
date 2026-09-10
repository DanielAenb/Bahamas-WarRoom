/**
 * Bahamas WarRoom — Capa de acceso a la API de Warera.
 * Expone window.WareraAPI.fetchUnitPlayers(unitId) → Promise<{ players, failures, total }>
 */
(function () {
  'use strict';

  const API_BASE = 'https://api2.warera.io/trpc';
  const API_KEY_STORAGE = 'warera_api_key';

  // A partir de este nivel de ataque un jugador se considera en modo WAR.
  const WAR_ATTACK_LEVEL_THRESHOLD = 2;

  function getApiKey() {
    try { return localStorage.getItem(API_KEY_STORAGE) || ''; }
    catch { return ''; }
  }

  async function post(path, body) {
    const headers = { 'Content-Type': 'application/json' };

    // Si el usuario configuró una key personal, la enviamos.
    // OJO: si algún día Warera cambia el esquema (por ejemplo a 'x-api-key'
    // o a un query param), este es el ÚNICO sitio que hay que tocar.
    const key = getApiKey();
    if (key) headers['Authorization'] = `Bearer ${key}`;

    const res = await fetch(`${API_BASE}/${path}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body)
    });
    if (!res.ok) throw new Error(`HTTP ${res.status} en ${path}`);
    return res.json();
  }

  async function fetchUnitMembers(unitId) {
    const json = await post('mu.getById', { muId: unitId });
    const members = json?.result?.data?.members;
    if (!Array.isArray(members)) {
      throw new Error('Respuesta inválida de mu.getById');
    }
    return members;
  }

  async function fetchUser(userId) {
    const json = await post('user.getUserById', { userId });
    const data = json?.result?.data;
    if (!data) throw new Error(`Usuario ${userId} sin datos`);
    return data;
  }

  function formatPlayer(user, now) {
    const healthVal  = user.skills?.health?.currentBarValue ?? 0;
    const healthMax  = user.skills?.health?.total           ?? 100;
    const hungerVal  = user.skills?.hunger?.currentBarValue ?? 0;
    const hungerMax  = user.skills?.hunger?.total           ?? 10;

    const attackLevel = user.skills?.attack?.level ?? 0;
    const modo = attackLevel > WAR_ATTACK_LEVEL_THRESHOLD ? 'WAR' : 'ECO';

    let pillStatus = 'STANDBY';
    let pillEndTime = null;
    let pillRemainingMs = 0;

    if (user.buffs) {
      const buffEnd   = user.buffs.buffEndAt   ? new Date(user.buffs.buffEndAt).getTime()   : 0;
      const debuffEnd = user.buffs.debuffEndAt ? new Date(user.buffs.debuffEndAt).getTime() : 0;

      if (user.buffs.buffCodes?.includes('cocain') && buffEnd > now) {
        pillStatus = 'BUFF';
        pillEndTime = buffEnd;
        pillRemainingMs = buffEnd - now;
      } else if (user.buffs.debuffCodes?.includes('cocain') && debuffEnd > now) {
        pillStatus = 'DEBUFF';
        pillEndTime = debuffEnd;
        pillRemainingMs = debuffEnd - now;
      }
    }

    const avatarUrl = user.avatarUrl
      || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.username)}&background=334155&color=fff`;

    return {
      id: user._id,
      name: user.username,
      avatarUrl,
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
  }

  /**
   * Carga todos los miembros de una unidad y devuelve los jugadores formateados.
   * Tolerante a fallos individuales: si un miembro falla, el resto se devuelve igual.
   */
  async function fetchUnitPlayers(unitId) {
    const memberIds = await fetchUnitMembers(unitId);
    if (memberIds.length === 0) return { players: [], failures: 0, total: 0 };

    const now = Date.now();
    const results = await Promise.allSettled(memberIds.map(fetchUser));

    const players = [];
    let failures = 0;
    for (const r of results) {
      if (r.status === 'fulfilled') {
        players.push(formatPlayer(r.value, now));
      } else {
        failures++;
      }
    }

    if (players.length === 0) {
      throw new Error('No se pudo cargar ningún miembro de la unidad');
    }

    return { players, failures, total: memberIds.length };
  }

  window.WareraAPI = { fetchUnitPlayers, getApiKey };
})();