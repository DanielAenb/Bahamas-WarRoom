/**
 * Bahamas WarRoom — HUD del contrato activo.
 * Se integra con app.js. Escanea la MU seleccionada, muestra 1 contrato activo.
 *
 * API:
 *   window.WareraContractsHud.init({ getMuId, getEnabled, els })
 *   window.WareraContractsHud.refresh()   // fetch + render
 *   window.WareraContractsHud.clear()     // borrar caché de countries/regions/done
 */
(function () {
  'use strict';

  const API_BASE      = 'https://api2.warera.io/trpc';
  const PROC_AUCTIONS = 'mercenaryContractAuction.getPaginatedAuctions';
  const PROC_BATTLE   = 'battle.getById';
  const PROC_LIVE     = 'battle.getLiveBattleData';
  const LIMIT         = 50;
  const STATUSES      = ['active', 'won', 'expiredBattle', 'expiredRound', 'expiredNoBids'];

  const AGE_WINDOW_MS = 60 * 60 * 1000;   // 1h → borde izquierdo verde→rojo

  const LS_COUNTRY = 'warera_countries_cache_v1';
  const LS_REGION  = 'warera_regions_cache_v1';
  const LS_DONE    = 'warera_contracts_manual_done';

  let deps = null;    // { getMuId, getEnabled, els }
  let currentContract = null;
  let currentEst      = null;
  let fetching        = false;
  let tickIntervalId  = null;

  // ===== Helpers =====
  const fmtDmg = n => {
    if (!isFinite(n) || n <= 0) return '0';
    if (n >= 1e9) return (n / 1e9).toFixed(2) + 'B';
    if (n >= 1e6) return (n / 1e6).toFixed(2) + 'M';
    if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K';
    return Math.floor(n).toString();
  };
  const shortId = id => (id ? id.slice(-6) : '');

  const fmtDuration = ms => {
    if (ms <= 0) return '0m';
    const s = Math.floor(ms / 1000);
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    if (h > 0) return `${h}h ${String(m).padStart(2, '0')}m`;
    if (m > 0) return `${m}m ${String(sec).padStart(2, '0')}s`;
    return `${sec}s`;
  };

  const load = (key, def) => {
    try { return JSON.parse(localStorage.getItem(key)) ?? def; }
    catch { return def; }
  };
  const save = (key, val) => {
    try { localStorage.setItem(key, JSON.stringify(val)); } catch {}
  };

  // ===== Fetch helpers =====
  async function fetchOne(procedure, param) {
    const res = await fetch(`${API_BASE}/${procedure}?batch=1`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 0: param }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    return (Array.isArray(json) ? json[0] : json)?.result?.data;
  }

  async function fetchAllAuctions() {
    const results = await Promise.allSettled(
      STATUSES.map(status => fetchOne(PROC_AUCTIONS, { limit: LIMIT, offset: 0, status }))
    );
    const out = [];
    results.forEach((r, i) => {
      if (r.status === 'fulfilled' && r.value?.items) out.push(...r.value.items);
      else if (r.status === 'rejected') console.warn(`HUD status=${STATUSES[i]}:`, r.reason.message);
    });
    return out;
  }

  async function fetchBattlesStatic(battleIds) {
    const ids = [...new Set(battleIds)].filter(Boolean);
    if (!ids.length) return new Map();
    const body = Object.fromEntries(ids.map((id, i) => [i, { battleId: id }]));
    try {
      const res = await fetch(
        `${API_BASE}/${ids.map(() => PROC_BATTLE).join(',')}?batch=1`,
        { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const arr = await res.json();
      const map = new Map();
      ids.forEach((id, i) => {
        const d = (Array.isArray(arr) ? arr[i] : arr)?.result?.data;
        if (d) map.set(id, d);
      });
      return map;
    } catch (e) {
      console.warn('HUD battles static:', e.message);
      return new Map();
    }
  }

  async function fetchBattleLive(battleId) {
    const input = encodeURIComponent(JSON.stringify({ battleId }));
    const res = await fetch(`${API_BASE}/${PROC_LIVE}?input=${input}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    if (json?.error) throw new Error(json.error.message || 'Error');
    return json?.result?.data || null;
  }

  async function fetchBattlesLive(battleIds) {
    const ids = [...new Set(battleIds)].filter(Boolean);
    const map = new Map();
    if (!ids.length) return map;
    const results = await Promise.allSettled(ids.map(id => fetchBattleLive(id)));
    results.forEach((r, i) => {
      if (r.status === 'fulfilled' && r.value) map.set(ids[i], r.value);
    });
    return map;
  }

  async function fetchBattleData(battleIds) {
    const staticMap = await fetchBattlesStatic(battleIds);
    const activeIds = [...staticMap.entries()].filter(([, b]) => b.isActive).map(([id]) => id);
    const liveMap = await fetchBattlesLive(activeIds);
    const merged = new Map();
    for (const [id, stat] of staticMap) {
      merged.set(id, { static: stat, live: liveMap.get(id) || null });
    }
    return merged;
  }

  // ===== Locations =====
  let countries = load(LS_COUNTRY, {});
  let regions   = load(LS_REGION, {});

  async function resolveLocations(countryIds, regionIds) {
    const pendingCountries = [...new Set(countryIds)].filter(id => id && !countries[id]?.name);
    const pendingRegions   = [...new Set(regionIds)].filter(id => id && !regions[id]?.name);
    if (!pendingCountries.length && !pendingRegions.length) return;

    const procedures = [];
    const params = {};
    let i = 0;
    for (const id of pendingCountries) { procedures.push('country.getById'); params[i++] = { countryId: id }; }
    for (const id of pendingRegions)   { procedures.push('region.getById');  params[i++] = { regionId: id }; }

    try {
      const res = await fetch(`${API_BASE}/${procedures.join(',')}?batch=1`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const arr = await res.json();
      let idx = 0, dirtyC = false, dirtyR = false;
      for (const id of pendingCountries) {
        const d = (Array.isArray(arr) ? arr[idx] : arr)?.result?.data;
        idx++;
        if (d?.name) { countries[id] = { code: d.code || '', name: d.name }; dirtyC = true; }
      }
      for (const id of pendingRegions) {
        const d = (Array.isArray(arr) ? arr[idx] : arr)?.result?.data;
        idx++;
        if (d?.name) { regions[id] = { name: d.name }; dirtyR = true; }
      }
      if (dirtyC) save(LS_COUNTRY, countries);
      if (dirtyR) save(LS_REGION, regions);
    } catch (e) {
      console.warn('HUD locations:', e.message);
    }
  }

  // ===== Battle estimation =====
  function estimateBattle(entry, now) {
    if (!entry?.static?.createdAt) return null;
    const stat = entry.static;
    const live = entry.live;

    const startMs = new Date(stat.createdAt).getTime();
    const roundsToWin = stat.roundsToWin || 3;
    const maxRounds = roundsToWin * 2 - 1;

    const roundIds = live?.battle?.roundIds || stat.rounds || [];
    const roundHistory = live?.battle?.roundHistory || stat.roundsHistory || [];
    const currentRoundNum = roundIds.length || (roundHistory.length + (stat.isActive ? 1 : 0)) || 1;

    const elapsedMs = now - startMs;
    const avgRoundMs = currentRoundNum > 0 ? elapsedMs / currentRoundNum : 0;
    const remainingWorstCase = Math.max(0, maxRounds - currentRoundNum);
    const estimatedEndMs = stat.isActive && avgRoundMs > 0
      ? now + remainingWorstCase * avgRoundMs
      : null;

    return {
      startMs,
      elapsedMs,
      estimatedEndMs,
      currentRoundNum,
      maxRounds,
      isActive: !!stat.isActive,
      endedAt: stat.endedAt ? new Date(stat.endedAt).getTime() : null,
      regionId: stat.defender?.region || null,
    };
  }

  // ===== Age color (verde → rojo) =====
  function ageColor(ageMs) {
    const ratio = Math.min(1, Math.max(0, ageMs / AGE_WINDOW_MS));
    const hue = 142 + (0 - 142) * ratio;
    return `hsl(${hue}, 71%, 45%)`;
  }

  // ===== Render =====
  function hideHud() {
    if (deps?.els?.hud) deps.els.hud.hidden = true;
    currentContract = null;
    currentEst = null;
  }

  function renderHud(contract, est) {
    const { els } = deps;
    if (!contract) { hideHud(); return; }

    currentContract = contract;
    currentEst = est;

    // Nombre batalla
    const regionId = est?.regionId;
    const region = regionId ? regions[regionId] : null;
    const country = countries[contract.forCountry];
    const battleName = region?.name || country?.name || (contract.battle ? `Batalla #${shortId(contract.battle)}` : '—');
    els.battleName.textContent = battleName;

    // Link batalla
    if (contract.battle) {
      els.battleLink.href = `https://app.warera.io/battle/${encodeURIComponent(contract.battle)}`;
      els.battleLink.style.display = '';
    } else {
      els.battleLink.style.display = 'none';
    }

    // Stats
    els.minDmg.textContent = fmtDmg(contract.minimumDamage);
    els.payout.textContent = `$${fmtDmg(contract.currentPayout)}`;
    els.perK.textContent = `${(contract.currentPerK || 0).toFixed(3)}$`;

    // Botón COMPLETADO
    els.completeBtn.dataset.contractId = contract._id;
    els.completeBtn.classList.remove('done');
    els.completeBtn.textContent = 'COMPLETADO';

    els.hud.hidden = false;
    tickHud();
  }

  function tickHud() {
    if (!currentContract || !deps?.els?.hud || deps.els.hud.hidden) return;
    const { els } = deps;
    const c = currentContract;
    const est = currentEst;
    const now = Date.now();

    // Borde izquierdo: edad del contrato desde expiresAt
    const expiresMs = c.expiresAt ? new Date(c.expiresAt).getTime() : 0;
    const ageMs = expiresMs ? (now - expiresMs) : 0;
    const color = ageColor(ageMs);
    els.ageBar.style.background = color;
    els.ageBar.style.boxShadow = `0 0 12px -2px ${color}`;

    // "Contrato detectado — hace X"
    const detectedMin = Math.floor(ageMs / 60000);
    if (detectedMin < 1) {
      els.detected.textContent = 'Contrato detectado — ahora mismo';
    } else if (detectedMin < 60) {
      els.detected.textContent = `Contrato detectado — hace ${detectedMin} min`;
    } else {
      const h = Math.floor(detectedMin / 60);
      const m = detectedMin % 60;
      els.detected.textContent = `Contrato detectado — hace ${h}h ${m}m`;
    }

    // Timer tiempo restante
    if (est) {
      if (!est.isActive) {
        els.timerText.textContent = 'Batalla finalizada';
      } else if (est.estimatedEndMs) {
        const rem = Math.max(0, est.estimatedEndMs - now);
        els.timerText.textContent = `Tiempo restante para terminar la batalla: ~${fmtDuration(rem)}`;
      } else {
        els.timerText.textContent = 'Estimando tiempo restante…';
      }
    } else {
      els.timerText.textContent = 'Sin datos de batalla';
    }

    // Barra inferior
    if (est && est.isActive && est.estimatedEndMs) {
      const totalMs = est.estimatedEndMs - est.startMs;
      const rem = Math.max(0, est.estimatedEndMs - now);
      const pct = totalMs > 0 ? Math.max(0, Math.min(100, (rem / totalMs) * 100)) : 0;
      els.progressFill.style.width = pct + '%';
      els.progressFill.classList.toggle('danger', pct < 15);
    } else if (est && !est.isActive) {
      els.progressFill.style.width = '0%';
      els.progressFill.classList.add('danger');
    } else {
      els.progressFill.style.width = '100%';
      els.progressFill.classList.remove('danger');
    }
  }

  // ===== Refresh =====
  async function refresh() {
    if (!deps) return;
    if (!deps.getEnabled()) { hideHud(); return; }
    if (fetching) return;
    fetching = true;

    try {
      const muId = deps.getMuId();
      if (!muId) { hideHud(); return; }

      const all = await fetchAllAuctions();
      const doneMap = load(LS_DONE, {});
      const mine = all.filter(c => c.currentWinner === muId && !doneMap[c._id]);
      if (!mine.length) { hideHud(); return; }

      // El más reciente
      mine.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      const active = mine[0];

      const battleMap = await fetchBattleData(active.battle ? [active.battle] : []);
      const regionIds = active.battle
        ? [battleMap.get(active.battle)?.static?.defender?.region].filter(Boolean)
        : [];
      await resolveLocations([active.forCountry], regionIds);

      const est = active.battle
        ? estimateBattle(battleMap.get(active.battle), Date.now())
        : null;

      // Solo mostrar si la batalla sigue activa
      if (!est || !est.isActive) {
        hideHud();
        return;
      }

      renderHud(active, est);
    } catch (e) {
      console.warn('HUD refresh:', e.message);
      hideHud();
    } finally {
      fetching = false;
    }
  }

  // ===== API =====
  function init(dependencies) {
    deps = dependencies;

    // Timer 1s para actualizar edad / countdown / barra
    if (tickIntervalId) clearInterval(tickIntervalId);
    tickIntervalId = setInterval(tickHud, 1000);

    // Botón COMPLETADO
    if (deps.els.completeBtn) {
      deps.els.completeBtn.addEventListener('click', () => {
        const id = deps.els.completeBtn.dataset.contractId;
        if (!id) return;
        const doneMap = load(LS_DONE, {});
        doneMap[id] = Date.now();
        save(LS_DONE, doneMap);
        hideHud();
      });
    }
  }

  function clear() {
    localStorage.removeItem(LS_COUNTRY);
    localStorage.removeItem(LS_REGION);
    localStorage.removeItem(LS_DONE);
    countries = {};
    regions = {};
    hideHud();
  }

  // ===== Debug: inyectar contrato falso =====
  function __debugInject(opts) {
    if (!opts || !opts.contract) {
      console.warn('[HUD] __debugInject: falta opts.contract');
      return;
    }
    const { contract, country, region, battleStatic, battleLive } = opts;

    // Cachear país / región para que se vean los nombres reales
    if (country && contract.forCountry) {
      countries[contract.forCountry] = country;
    }
    if (region && battleStatic?.defender?.region) {
      regions[battleStatic.defender.region] = region;
    }

    // Si no hay battleStatic, inventamos uno básico para que estimateBattle funcione
    let stat = battleStatic;
    if (!stat) {
      const now = Date.now();
      stat = {
        _id: contract.battle || 'fake_battle',
        isActive: true,
        createdAt: new Date(now - 8 * 3600 * 1000).toISOString(),
        roundsToWin: 3,
        rounds: ['r1', 'r2', 'r3'],
        roundsHistory: [
          { wonBy: 'attacker', attackerDamages: 0, defenderDamages: 0 },
          { wonBy: 'defender', attackerDamages: 0, defenderDamages: 0 },
        ],
        defender: { region: contract.battle ? `reg_${contract.battle.slice(-6)}` : null },
        endedAt: null,
      };
    }

    const est = estimateBattle({ static: stat, live: battleLive || null }, Date.now());
    renderHud(contract, est);
    console.log('[HUD] Contrato inyectado:', contract._id, '· battle:', contract.battle);
  }

  function __debugClear() {
    hideHud();
    console.log('[HUD] Contrato debug limpiado.');
  }

  function __debugHelp() {
    const now = Date.now();
    const muUchiha = '6997581b896745b3e1b21d0f';
    const muAkatsuki = '69f542668d7015d064d4147a';

    console.log('%c=== HUD DEBUG ===', 'color:#00b1ff;font-weight:bold;font-size:14px');
    console.log('MU Uchiha:  ', muUchiha);
    console.log('MU Akatsuki:', muAkatsuki);
    console.log('');
    console.log('%cInyectar contrato para Uchiha (activo desde hace 5 min):', 'color:#22c55e;font-weight:bold');
    console.log(`WareraContractsHud.__debugInject({
  contract: {
    _id: 'fake_uchiha_${now}',
    currentWinner: '${muUchiha}',
    forCountry: '6813b6d446e731854c7ac7fb',
    forCountrySide: 'attacker',
    battle: '6ab2efcce6a3d6dc8c59c7c4',
    minimumDamage: 1050000,
    currentPerK: 0.11,
    currentPayout: 115.83,
    expiresAt: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
    createdAt: new Date(Date.now() - 30 * 60 * 1000).toISOString()
  },
  country: { code: 'FR', name: 'France' },
  region:  { name: 'Île-de-France' }
});`);
    console.log('');
    console.log('%cInyectar contrato para Akatsuki (activo desde hace 45 min):', 'color:#f97316;font-weight:bold');
    console.log(`WareraContractsHud.__debugInject({
  contract: {
    _id: 'fake_akatsuki_${now}',
    currentWinner: '${muAkatsuki}',
    forCountry: '6813b6d446e731854c7ac79c',
    forCountrySide: 'defender',
    battle: '6ab2efcce6a3d6dc8c59c7c4',
    minimumDamage: 2500000,
    currentPerK: 0.08,
    currentPayout: 200,
    expiresAt: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
    createdAt: new Date(Date.now() - 2 * 3600 * 1000).toISOString()
  },
  country: { code: 'DE', name: 'Germany' },
  region:  { name: 'Bavaria' }
});`);
    console.log('');
    console.log('%cLimpiar:', 'color:#ef4444;font-weight:bold');
    console.log('WareraContractsHud.__debugClear();');
  }

  window.WareraContractsHud = { init, refresh, clear, __debugInject, __debugClear, __debugHelp };

//  window.WareraContractsHud = { init, refresh, clear };
}
)();