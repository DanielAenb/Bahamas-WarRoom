/**
 * Bahamas WarRoom — Capa de acceso a la API de Warera.
 * Expone window.WareraAPI.fetchUnitPlayers(unitId)
 *
 * v2 — Batch tRPC: 1 request para la MU + 1 batch por cada ~40 miembros.
 *      Antes: 1 + N requests. Ahora: 2 requests (MUs de tamaño normal).
 *
 * v2.1 — formatPlayer añade `combat` con stats precalculados para el simulador.
 */

(function () {
  'use strict';

  const API_BASE = 'https://api2.warera.io/trpc';
  const API_KEY_STORAGE = 'warera_api_key';
  const WAR_ATTACK_LEVEL_THRESHOLD = 2;

  // Techo práctico medido: 50 OK, 100 falla con 413. Margen seguro: 40.
  const BATCH_LIMIT = 40;

  // Proxy de imágenes con CORS garantizado (para canvas / capturas).
  const IMAGE_PROXY = 'https://wsrv.nl/';

  function getApiKey() {
    try { return localStorage.getItem(API_KEY_STORAGE) || ''; }
    catch { return ''; }
  }

  function buildProxyUrl(url) {
    if (!url) return url;
    const params = new URLSearchParams({
      url: url,
      w: '200',
      h: '200',
      fit: 'cover',
      output: 'png'
    });
    return `${IMAGE_PROXY}?${params.toString()}`;
  }

  class RateLimitError extends Error {
    constructor(msg) {
      super(msg);
      this.name = 'RateLimitError';
      this.status = 429;
    }
  }

  function chunk(arr, size) {
    const out = [];
    for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
    return out;
  }

  async function callBatch(procedures, body) {
    const url = `${API_BASE}/${procedures.join(',')}?batch=1`;

    const headers = { 'Content-Type': 'application/json' };
    const key = getApiKey();
    if (key) headers['X-API-Key'] = key;

    let res;
    try {
      res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) });
    } catch (e) {
      throw new Error(`Fallo de red: ${e.message}`);
    }

    if (res.status === 429) {
      throw new RateLimitError(`Rate limit en batch (${procedures.length} procedimientos)`);
    }
    // 200 = todo OK · 207 = parcial (algunos items con error)
    if (res.status !== 200 && res.status !== 207) {
      throw new Error(`HTTP ${res.status} en batch`);
    }

    let json;
    try { json = await res.json(); }
    catch { throw new Error('Respuesta no-JSON del servidor'); }

    if (!Array.isArray(json)) {
      throw new Error('Respuesta batch inválida (no es array)');
    }
    return json;
  }

  async function fetchUnitWithMembers(unitId) {
    // --- Request 1: la MU ---
    const muJson = await callBatch(['mu.getById'], { 0: { muId: unitId } });
    const muData = muJson[0]?.result?.data;

    if (!muData || !Array.isArray(muData.members)) {
      throw new Error('Respuesta inválida de mu.getById');
    }

    const memberIds = muData.members;
    if (memberIds.length === 0) {
      return { mu: muData, members: [], failuresDetail: [] };
    }

    // --- Requests 2..K: batches de getUserLite ---
    const members = [];
    const failuresDetail = [];
    const batches = chunk(memberIds, BATCH_LIMIT);

    for (const ids of batches) {
      const procedures = ids.map(() => 'user.getUserLite');
      const body = Object.fromEntries(ids.map((id, i) => [i, { userId: id }]));

      let results;
      try {
        results = await callBatch(procedures, body);
      } catch (e) {
        for (const id of ids) {
          failuresDetail.push({
            id,
            reason: e.message,
            isRateLimit: e.name === 'RateLimitError'
          });
        }
        if (e.name === 'RateLimitError') break;
        continue;
      }

      for (let i = 0; i < ids.length; i++) {
        const r = results[i];
        if (r?.result?.data) {
          members.push(r.result.data);
        } else {
          failuresDetail.push({
            id: ids[i],
            reason: r?.error?.message ? String(r.error.message).slice(0, 200) : 'Sin datos',
            isRateLimit: false
          });
        }
      }
    }

    return { mu: muData, members, failuresDetail };
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
    const avatarUrlProxy = buildProxyUrl(avatarUrl);

    // Stats de combate precalculadas por el servidor (ya incluyen gear + buff + rank).
    const combat = {
      attack:         user.skills?.attack?.total           ?? 0,
      precision:      user.skills?.precision?.total        ?? 0,
      criticalChance: user.skills?.criticalChance?.total   ?? 0,
      criticalDamages:user.skills?.criticalDamages?.total  ?? 0,
      armor:          user.skills?.armor?.total            ?? 0,
      dodge:          user.skills?.dodge?.total            ?? 0,
      regenHP:        user.skills?.health?.hourlyBarRegen  ?? 0,
      regenHunger:    user.skills?.hunger?.hourlyBarRegen  ?? 0
    };

    return {
      id: user._id,
      name: user.username,
      avatarUrl,
      avatarUrlProxy,
      health: Math.floor(healthVal),
      healthMax: Math.floor(healthMax),
      hunger: Math.floor(hungerVal),
      hungerMax: Math.floor(hungerMax),
      pillStatus,
      pillEndTime,
      pillRemainingMs,
      modo,
      isCombatReady: healthVal > 0 && hungerVal > 0,
      combat
    };
  }

  async function fetchUnitPlayers(unitId) {
    const now = Date.now();
    const { members, failuresDetail } = await fetchUnitWithMembers(unitId);

    const players = members.map(u => formatPlayer(u, now));
    const total   = players.length + failuresDetail.length;
    const rateLimited = failuresDetail.some(f => f.isRateLimit);

    if (players.length === 0 && total > 0) {
      if (rateLimited) throw new RateLimitError('Límite alcanzado sin datos');
      throw new Error('No se pudo cargar ningún miembro de la unidad');
    }

    if (failuresDetail.length > 0) {
      console.group(`[Warera] ${unitId}: ${players.length}/${total} cargados`);
      console.table(failuresDetail);
      console.groupEnd();
    }

    return {
      players,
      failures: failuresDetail.length,
      total,
      rateLimited,
      failuresDetail
    };
  }

  window.WareraAPI = { fetchUnitPlayers, getApiKey, RateLimitError };
})();