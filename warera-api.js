/**
 * Bahamas WarRoom — Capa de acceso a la API de Warera.
 * Expone window.WareraAPI.fetchUnitPlayers(unitId)
 */
(function () {
  'use strict';

  const API_BASE = 'https://api2.warera.io/trpc';
  const API_KEY_STORAGE = 'warera_api_key';
  const WAR_ATTACK_LEVEL_THRESHOLD = 2;

  const REQUEST_LIMIT = {
    CONCURRENCY: 4,
    DELAY_BETWEEN_MS: 40
  };

  function getApiKey() {
    try { return localStorage.getItem(API_KEY_STORAGE) || ''; }
    catch { return ''; }
  }

  function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

  class RateLimitError extends Error {
    constructor(msg) {
      super(msg);
      this.name = 'RateLimitError';
      this.status = 429;
    }
  }

  async function post(path, body) {
    const headers = { 'Content-Type': 'application/json' };
    const key = getApiKey();
    if (key) headers['X-API-Key'] = key;

    const res = await fetch(`${API_BASE}/${path}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body)
    });

    if (res.status === 429) throw new RateLimitError(`Rate limited en ${path}`);
    if (!res.ok) throw new Error(`HTTP ${res.status} en ${path}`);
    return res.json();
  }

  async function fetchUnitMembers(unitId) {
    const json = await post('mu.getById', { muId: unitId });
    const members = json?.result?.data?.members;
    if (!Array.isArray(members)) throw new Error('Respuesta inválida de mu.getById');
    return members;
  }

  async function fetchUser(userId) {
    try {
      const json = await post('user.getUserById', { userId });
      const data = json?.result?.data;
      if (!data) {
        console.warn(`[Warera] Usuario ${userId} devolvió data null`);
        throw new Error(`Usuario ${userId} sin datos`);
      }
      return data;
    } catch (e) {
      if (e.name !== 'RateLimitError') {
        console.warn(`[Warera] Falló user ${userId}: ${e.message}`);
      }
      throw e;
    }
  }

  async function fetchUsersBatch(memberIds) {
    const results = new Array(memberIds.length);
    let cursor = 0;
    let rateLimited = false;

    async function worker() {
      while (true) {
        if (rateLimited) return;
        const i = cursor++;
        if (i >= memberIds.length) return;

        try {
          const user = await fetchUser(memberIds[i]);
          results[i] = { status: 'fulfilled', value: user };
        } catch (e) {
          results[i] = { status: 'rejected', reason: e, id: memberIds[i] };
          if (e.name === 'RateLimitError') {
            rateLimited = true;
            return;
          }
        }
        await sleep(REQUEST_LIMIT.DELAY_BETWEEN_MS);
      }
    }

    const workerCount = Math.min(REQUEST_LIMIT.CONCURRENCY, memberIds.length);
    await Promise.all(Array.from({ length: workerCount }, () => worker()));

    for (let i = 0; i < results.length; i++) {
      if (!results[i]) {
        results[i] = { status: 'rejected', reason: new Error('No procesado'), id: memberIds[i] };
      }
    }

    return { results, rateLimited };
  }

  function formatPlayer(user, now) {
    const healthVal = user.skills?.health?.currentBarValue ?? 0;
    const healthMax = user.skills?.health?.total           ?? 100;
    const hungerVal = user.skills?.hunger?.currentBarValue ?? 0;
    const hungerMax = user.skills?.hunger?.total           ?? 10;

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

  async function fetchUnitPlayers(unitId) {
    const memberIds = await fetchUnitMembers(unitId);
    if (memberIds.length === 0) {
      return { players: [], failures: 0, total: 0, rateLimited: false, failuresDetail: [] };
    }

    const now = Date.now();
    const { results, rateLimited } = await fetchUsersBatch(memberIds);

    const players = [];
    const failuresDetail = [];
    for (let i = 0; i < results.length; i++) {
      const r = results[i];
      if (r.status === 'fulfilled') {
        players.push(formatPlayer(r.value, now));
      } else {
        failuresDetail.push({
          id: r.id,
          reason: r.reason?.message || 'desconocido',
          isRateLimit: r.reason?.name === 'RateLimitError'
        });
      }
    }

    if (failuresDetail.length > 0) {
      console.group(`[Warera] ${unitId}: ${players.length}/${memberIds.length} cargados`);
      console.table(failuresDetail);
      console.groupEnd();
    }

    if (players.length === 0) {
      if (rateLimited) throw new RateLimitError('Límite alcanzado sin datos');
      throw new Error('No se pudo cargar ningún miembro de la unidad');
    }

    return {
      players,
      failures: failuresDetail.length,
      total: memberIds.length,
      rateLimited,
      failuresDetail
    };
  }

  window.WareraAPI = { fetchUnitPlayers, getApiKey, RateLimitError };
})();