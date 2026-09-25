/* global describe, it, expect, WareraUtils, WareraDamage, WareraCapture */
(function () {
  'use strict';

  const { escapeHtml, formatDmg, formatTimer, getFilteredAndSortedPlayers } = WareraUtils;
  const { calcDamagePotential } = WareraDamage;
  const { computeCaptureBg, computePlayerCaptureBg } = WareraCapture;

  // ============ escapeHtml ============
  describe('escapeHtml', () => {
    it('escapa ampersand', () => expect(escapeHtml('a & b')).toBe('a &amp; b'));
    it('escapa < y >', () => expect(escapeHtml('<script>')).toBe('&lt;script&gt;'));
    it('escapa comillas dobles y simples', () =>
      expect(escapeHtml('"hi" and \'bye\'')).toBe('&quot;hi&quot; and &#39;bye&#39;'));
    it('convierte no-strings a string', () => {
      expect(escapeHtml(42)).toBe('42');
      expect(escapeHtml(null)).toBe('null');
    });
    it('no modifica texto plano', () => expect(escapeHtml('hola mundo')).toBe('hola mundo'));
  });

  // ============ formatDmg ============
  describe('formatDmg', () => {
    it('devuelve "0" para 0',            () => expect(formatDmg(0)).toBe('0'));
    it('devuelve "0" para negativos',    () => expect(formatDmg(-5)).toBe('0'));
    it('devuelve "0" para NaN',          () => expect(formatDmg(NaN)).toBe('0'));
    it('devuelve "0" para Infinity',     () => expect(formatDmg(Infinity)).toBe('0'));
    it('entero bajo 1000 sin sufijo',    () => expect(formatDmg(999)).toBe('999'));
    it('miles con K y un decimal',       () => expect(formatDmg(1500)).toBe('1.5K'));
    it('millones con M y dos decimales', () => expect(formatDmg(2_500_000)).toBe('2.50M'));
    it('billones con B y dos decimales', () => expect(formatDmg(3_140_000_000)).toBe('3.14B'));
    it('trunca decimales por debajo de 1000', () => expect(formatDmg(42.9)).toBe('42'));
  });

  // ============ formatTimer ============
  describe('formatTimer', () => {
    it('devuelve "00:00:00" para 0', () => expect(formatTimer(0)).toBe('00:00:00'));
    it('devuelve "00:00:00" para null/undefined/negativo', () => {
      expect(formatTimer(null)).toBe('00:00:00');
      expect(formatTimer(undefined)).toBe('00:00:00');
      expect(formatTimer(-100)).toBe('00:00:00');
    });
    it('formatea segundos',              () => expect(formatTimer(1000)).toBe('00:00:01'));
    it('formatea minutos y segundos',    () => expect(formatTimer(65_000)).toBe('00:01:05'));
    it('formatea 1 hora exacta',         () => expect(formatTimer(3_600_000)).toBe('01:00:00'));
    it('formatea horas con padStart',    () =>
      expect(formatTimer(2 * 3_600_000 + 5 * 60_000 + 3_000)).toBe('02:05:03'));
    it('trunca milisegundos sobrantes',  () => expect(formatTimer(1999)).toBe('00:00:01'));
  });

  // ============ getFilteredAndSortedPlayers ============
  function mkPlayer(over = {}) {
    return {
      id: over.id || Math.random().toString(36).slice(2),
      name: over.name || 'Anon',
      modo: over.modo || 'WAR',
      pillStatus: over.pillStatus || 'STANDBY',
      pillRemainingMs: over.pillRemainingMs !== undefined ? over.pillRemainingMs : 0,
      isCombatReady: over.isCombatReady !== undefined ? over.isCombatReady : true,
      health: over.health !== undefined ? over.health : 100,
      hunger: over.hunger !== undefined ? over.hunger : 50
    };
  }

  describe('getFilteredAndSortedPlayers · filtrado', () => {
    const players = [
      mkPlayer({ name: 'Ana',   modo: 'WAR' }),
      mkPlayer({ name: 'Beto',  modo: 'ECO' }),
      mkPlayer({ name: 'Carla', modo: 'WAR' })
    ];
    it('modo ALL devuelve todos', () => {
      const r = getFilteredAndSortedPlayers(players, 'ALL', false, 'alfabetico');
      expect(r).toHaveLength(3);
    });
    it('modo WAR filtra solo WAR', () => {
      const r = getFilteredAndSortedPlayers(players, 'WAR', false, 'alfabetico');
      expect(r).toHaveLength(2);
      expect(r.every(p => p.modo === 'WAR')).toBeTruthy();
    });
    it('modo ECO filtra solo ECO', () => {
      const r = getFilteredAndSortedPlayers(players, 'ECO', false, 'alfabetico');
      expect(r).toHaveLength(1);
      expect(r[0].name).toBe('Beto');
    });
    it('no muta el array original', () => {
      const antes = players.map(p => p.name);
      getFilteredAndSortedPlayers(players, 'ALL', false, 'estado');
      const despues = players.map(p => p.name);
      expect(despues).toEqual(antes);
    });
  });

  describe('getFilteredAndSortedPlayers · alfabético', () => {
    it('ordena alfabéticamente por nombre', () => {
      const players = [
        mkPlayer({ name: 'Zoe' }),
        mkPlayer({ name: 'Ana' }),
        mkPlayer({ name: 'Mike' })
      ];
      const r = getFilteredAndSortedPlayers(players, 'ALL', false, 'alfabetico');
      expect(r.map(p => p.name)).toEqual(['Ana', 'Mike', 'Zoe']);
    });
  });

  describe('getFilteredAndSortedPlayers · smartSort', () => {
    it('solo conserva BUFF', () => {
      const players = [
        mkPlayer({ name: 'A', pillStatus: 'BUFF' }),
        mkPlayer({ name: 'B', pillStatus: 'STANDBY' }),
        mkPlayer({ name: 'C', pillStatus: 'DEBUFF' }),
        mkPlayer({ name: 'D', pillStatus: 'BUFF' })
      ];
      const r = getFilteredAndSortedPlayers(players, 'ALL', true, 'alfabetico');
      expect(r).toHaveLength(2);
      expect(r.every(p => p.pillStatus === 'BUFF')).toBeTruthy();
    });
    it('prioriza combat-ready sobre no-combat-ready', () => {
      const players = [
        mkPlayer({ name: 'NoReady', pillStatus: 'BUFF', isCombatReady: false, pillRemainingMs: 1000 }),
        mkPlayer({ name: 'Ready',   pillStatus: 'BUFF', isCombatReady: true,  pillRemainingMs: 1000 })
      ];
      const r = getFilteredAndSortedPlayers(players, 'ALL', true, 'alfabetico');
      expect(r[0].name).toBe('Ready');
    });
    it('con igual readiness, ordena por tiempo restante ascendente', () => {
      const players = [
        mkPlayer({ name: 'Largo', pillStatus: 'BUFF', pillRemainingMs: 60_000 }),
        mkPlayer({ name: 'Corto', pillStatus: 'BUFF', pillRemainingMs: 10_000 })
      ];
      const r = getFilteredAndSortedPlayers(players, 'ALL', true, 'alfabetico');
      expect(r[0].name).toBe('Corto');
    });
    it('con igual readiness y tiempo, ordena por score descendente', () => {
      const players = [
        mkPlayer({ name: 'Bajo', pillStatus: 'BUFF', health: 100, hunger: 10, pillRemainingMs: 1000 }),
        mkPlayer({ name: 'Alto', pillStatus: 'BUFF', health: 100, hunger: 90, pillRemainingMs: 1000 })
      ];
      const r = getFilteredAndSortedPlayers(players, 'ALL', true, 'alfabetico');
      expect(r[0].name).toBe('Alto');
    });
  });

  describe('getFilteredAndSortedPlayers · por estado', () => {
    it('BUFF va primero, DEBUFF último', () => {
      const players = [
        mkPlayer({ name: 'D', pillStatus: 'DEBUFF',  pillRemainingMs: 1000 }),
        mkPlayer({ name: 'S', pillStatus: 'STANDBY' }),
        mkPlayer({ name: 'B', pillStatus: 'BUFF',    pillRemainingMs: 1000 })
      ];
      const r = getFilteredAndSortedPlayers(players, 'ALL', false, 'estado');
      expect(r[0].pillStatus).toBe('BUFF');
      expect(r[1].pillStatus).toBe('STANDBY');
      expect(r[2].pillStatus).toBe('DEBUFF');
    });
    it('BUFF se ordena por tiempo restante ascendente', () => {
      const players = [
        mkPlayer({ name: 'B1', pillStatus: 'BUFF', pillRemainingMs: 50_000 }),
        mkPlayer({ name: 'B2', pillStatus: 'BUFF', pillRemainingMs: 10_000 })
      ];
      const r = getFilteredAndSortedPlayers(players, 'ALL', false, 'estado');
      expect(r[0].name).toBe('B2');
    });
    it('DEBUFF se ordena por tiempo restante ascendente', () => {
      const players = [
        mkPlayer({ name: 'D1', pillStatus: 'DEBUFF', pillRemainingMs: 50_000 }),
        mkPlayer({ name: 'D2', pillStatus: 'DEBUFF', pillRemainingMs: 10_000 })
      ];
      const r = getFilteredAndSortedPlayers(players, 'ALL', false, 'estado');
      expect(r[0].name).toBe('D2');
    });
    it('STANDBY se ordena por score descendente', () => {
      const players = [
        mkPlayer({ name: 'S1', pillStatus: 'STANDBY', health: 50,  hunger: 10 }),
        mkPlayer({ name: 'S2', pillStatus: 'STANDBY', health: 100, hunger: 90 })
      ];
      const r = getFilteredAndSortedPlayers(players, 'ALL', false, 'estado');
      expect(r[0].name).toBe('S2');
    });
  });

  // ============ calcDamagePotential ============
  describe('calcDamagePotential · casos base', () => {
    const baseCombat = {
      attack: 10, precision: 100, criticalChance: 0, criticalDamages: 0,
      armor: 0, dodge: 0, regenHP: 5, regenHunger: 1
    };
    function mkFighter(over = {}) {
      return {
        health: over.health !== undefined ? over.health : 100,
        healthMax: over.healthMax !== undefined ? over.healthMax : 100,
        hunger: over.hunger !== undefined ? over.hunger : 50,
        pillRemainingMs: over.pillRemainingMs !== undefined ? over.pillRemainingMs : 0,
        combat: { ...baseCombat, ...(over.combat || {}) }
      };
    }

    it('calcula daño con stats planos, sin regen ni bonus', () => {
      const calc = calcDamagePotential(mkFighter(), { contarRegen: false, battleBonus: 0 });
      // dmgPerHit = 10·1·1 = 10
      // M = 10·1·1 = 10
      // nAttacks = (100 + 0.2·50·100)/10 = 110
      // total = 10·110 = 1100
      expect(calc.dmgPerHit).toBeCloseTo(10, 4);
      expect(calc.nAttacks).toBeCloseTo(110, 4);
      expect(calc.dmgTotal).toBeCloseTo(1100, 4);
    });

    it('aplica battle bonus multiplicativo', () => {
      const calc = calcDamagePotential(mkFighter(), { contarRegen: false, battleBonus: 50 });
      expect(calc.dmgTotal).toBeCloseTo(1100 * 1.5, 4);
    });

    it('sin regen no suma vida ni comida futura', () => {
      const calc = calcDamagePotential(mkFighter(), { contarRegen: false, battleBonus: 0 });
      expect(calc.hpEfec).toBe(100);
      expect(calc.foodEfec).toBe(50);
    });

    it('con regen suma hp = y usa horas del buff activo', () => {
      const calc = calcDamagePotential(
        mkFighter({ pillRemainingMs: 2 * 3_600_000 }),
        { contarRegen: true, battleBonus: 0 }
      );
      // horas = 2 → k = 10, hpEfec = 110, P = floor(50 + 2) = 52
      expect(calc.horas).toBeCloseTo(2, 4);
      expect(calc.hpEfec).toBeCloseTo(110, 4);
      expect(calc.foodEfec).toBeCloseTo(52, 4);
    });

    it('sin buff activo usa horas = 8 (default) si contarRegen', () => {
      const calc = calcDamagePotential(
        mkFighter({ pillRemainingMs: 0 }),
        { contarRegen: true, battleBonus: 0 }
      );
      // horas = 8 → k = 40, hpEfec = 140, P = floor(50 + 8) = 58
      expect(calc.horas).toBe(8);
      expect(calc.hpEfec).toBeCloseTo(140, 4);
      expect(calc.foodEfec).toBeCloseTo(58, 4);
    });
  });

  describe('calcDamagePotential · precisión y crítico', () => {
    function mkFighter(combatOver = {}) {
      return {
        health: 100, healthMax: 100, hunger: 50, pillRemainingMs: 0,
        combat: {
          attack: 10, precision: 100, criticalChance: 0, criticalDamages: 0,
          armor: 0, dodge: 0, regenHP: 0, regenHunger: 0,
          ...combatOver
        }
      };
    }
    const opts = { contarRegen: false, battleBonus: 0 };

    it('precision 50% golpea con h=0.5 + mitad de "miss damage"', () => {
      // dmgPerHit = 10·0.5·1 + 5·0.5 = 7.5
      const calc = calcDamagePotential(mkFighter({ precision: 50 }), opts);
      expect(calc.dmgPerHit).toBeCloseTo(7.5, 4);
    });

    it('precision >100% bonifica attack: +4 por cada 100% extra', () => {
      // prc = 1.5 → attack = 10 + 4·50 = 210
      const calc = calcDamagePotential(mkFighter({ precision: 150 }), opts);
      expect(calc.dmgPerHit).toBeCloseTo(210, 4);
    });

    it('criticalChance 50% con cd 100% multiplica por 1.5', () => {
      // dmgPerHit = 10·(1 + 0.5·1) = 15
      const calc = calcDamagePotential(
        mkFighter({ criticalChance: 50, criticalDamages: 100 }), opts
      );
      expect(calc.dmgPerHit).toBeCloseTo(15, 4);
    });

    it('criticalChance >100% dispara extraCritMult', () => {
      // cc=1.5 → ccCap=1, extraCritMult=4·50=200, cd=1
      // dmgPerHit = 10·(1 + 1·(1 + 0.01·200)) = 40
      const calc = calcDamagePotential(
        mkFighter({ criticalChance: 150, criticalDamages: 100 }), opts
      );
      expect(calc.dmgPerHit).toBeCloseTo(40, 4);
    });
  });

  describe('calcDamagePotential · armadura y dodge', () => {
    function mkFighter(combatOver = {}) {
      return {
        health: 100, healthMax: 100, hunger: 50, pillRemainingMs: 0,
        combat: {
          attack: 10, precision: 100, criticalChance: 0, criticalDamages: 0,
          armor: 0, dodge: 0, regenHP: 0, regenHunger: 0,
          ...combatOver
        }
      };
    }
    const opts = { contarRegen: false, battleBonus: 0 };

    it('armor = dodge = 0 → nAttacks = 110', () => {
      const calc = calcDamagePotential(mkFighter(), opts);
      expect(calc.nAttacks).toBeCloseTo(110, 4);
    });

    it('armor alta reduce M (más ataques necesarios)', () => {
      // armor=40 → M = 10·(1-40/80)·1 = 5 → nAttacks = 1100/5 = 220
      const calc = calcDamagePotential(mkFighter({ armor: 40 }), opts);
      expect(calc.nAttacks).toBeCloseTo(220, 4);
    });

    it('dodge reduce M igual que armor', () => {
      const calc = calcDamagePotential(mkFighter({ dodge: 40 }), opts);
      expect(calc.nAttacks).toBeCloseTo(220, 4);
    });

    it('armor y dodge se combinan de forma multiplicativa', () => {
      // M = 10·0.5·0.5 = 2.5 → nAttacks = 1100/2.5 = 440
      const calc = calcDamagePotential(mkFighter({ armor: 40, dodge: 40 }), opts);
      expect(calc.nAttacks).toBeCloseTo(440, 4);
    });
  });

  describe('calcDamagePotential · robustez', () => {
    it('player sin combat no explota', () => {
      const calc = calcDamagePotential(
        { health: 100, healthMax: 100, hunger: 50, pillRemainingMs: 0 },
        { contarRegen: false, battleBonus: 0 }
      );
      expect(calc.dmgTotal).toBe(0);
    });
    it('healthMax 0 usa fallback 100', () => {
      const calc = calcDamagePotential(
        {
          health: 100, healthMax: 0, hunger: 50, pillRemainingMs: 0,
          combat: { attack: 10, precision: 100, armor: 0, dodge: 0, regenHP: 0, regenHunger: 0 }
        },
        { contarRegen: false, battleBonus: 0 }
      );
      expect(calc.dmgTotal).toBeCloseTo(1100, 4);
    });
  });

  // ============ computeCaptureBg ============
  describe('computeCaptureBg', () => {
    it('sin activos → start = end = gris base', () => {
      const bg = computeCaptureBg(0, 0);
      expect(bg.start).toBe('rgb(14,14,14)');
      expect(bg.end).toBe('rgb(14,14,14)');
    });
    it('≤3 activos no genera tinte', () => {
      const bg = computeCaptureBg(2, 1);
      expect(bg.end).toBe('rgb(14,14,14)');
    });
    it('>3 activos con mayoría BUFF tinta hacia verde', () => {
      const bg = computeCaptureBg(10, 0);
      const m = bg.end.match(/rgb\((\d+),(\d+),(\d+)\)/);
      const [, r, g] = m.map(Number);
      expect(g).toBeGreaterThan(r);
    });
    it('>3 activos con mayoría DEBUFF tinta hacia rojo', () => {
      const bg = computeCaptureBg(0, 10);
      const m = bg.end.match(/rgb\((\d+),(\d+),(\d+)\)/);
      const [, r, g] = m.map(Number);
      expect(r).toBeGreaterThan(g);
    });
  });

  describe('computePlayerCaptureBg', () => {
    it('STANDBY → gris base', () => {
      const bg = computePlayerCaptureBg({ pillStatus: 'STANDBY' });
      expect(bg.start).toBe('rgb(14,14,14)');
      expect(bg.end).toBe('rgb(14,14,14)');
    });
    it('BUFF → tinte verde (g > r)', () => {
      const bg = computePlayerCaptureBg({ pillStatus: 'BUFF' });
      const [, r, g] = bg.end.match(/rgb\((\d+),(\d+),(\d+)\)/).map(Number);
      expect(g).toBeGreaterThan(r);
    });
    it('DEBUFF → tinte rojo (r > g)', () => {
      const bg = computePlayerCaptureBg({ pillStatus: 'DEBUFF' });
      const [, r, g] = bg.end.match(/rgb\((\d+),(\d+),(\d+)\)/).map(Number);
      expect(r).toBeGreaterThan(g);
    });
  });

})();