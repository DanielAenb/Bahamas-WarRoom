/**
 * Bahamas WarRoom — Simulador de daño potencial.
 */
(function () {
  'use strict';

  // ⚙️ CONFIGURACIÓN: 
  // true = Asume Arma Épica (Daño Potencial Teórico)
  // false = Usa el Arma Actual del jugador (Igual al juego)
  const ASSUME_EPIC_GEAR = true; 

  // Multiplicador interno de daño de Warera (Ataque -> Daño)
  const WARERA_DAMAGE_MULTIPLIER = 30;

  // Valores del Gear Épico
  const EPIC_WEAPON_ATK       = 101;
  const EPIC_WEAPON_CRIT      = 16;
  const EPIC_HELMET_CRIT_DMG  = 71;
  const EPIC_GLOVES_PRECISION = 21;
  
  function calcDamagePotential(player, opts) {
    const c = player.combat || {};

    let attack, precision, criticalChance, criticalDamages;

    // ===== 1. Cálculo de Stats (Épico vs Real) =====
    if (ASSUME_EPIC_GEAR) {
      // Simulamos Gear Épico (reconstruimos el ataque)
      const rankMult = 1 + (c.militaryRankPercent || 0) / 100;
      const ammoMult = 1 + (c.ammoPercent ?? 10) / 100;
      const pillMult = player.pillStatus === 'BUFF' ? 1.6 : (player.pillStatus === 'DEBUFF' ? 0.4 : 1.0);

      attack = (c.attackBase + EPIC_WEAPON_ATK) * rankMult * ammoMult * pillMult;
      precision = c.precisionBase + EPIC_GLOVES_PRECISION + (c.precisionStrategic || 0);
      criticalChance = c.critChanceBase + EPIC_WEAPON_CRIT;
      criticalDamages = c.critDamageBase + EPIC_HELMET_CRIT_DMG;
    } else {
      // Usamos los Totales Reales del API
      attack = c.attack || c.attackBase || 0;
      precision = c.precision || 100;
      criticalChance = c.criticalChance || 0;
      criticalDamages = c.criticalDamages || 0;
    }

    // ===== 2. Daño por Golpe (con multiplicador de Warera) =====
    const prc = precision / 100;
    const cc = criticalChance / 100;
    const cd = criticalDamages / 100;

    const finalAttack = attack + 4 * Math.max(0, (prc - 1) * 100);
    const extraCritMult = 4 * Math.max(0, (cc - 1) * 100);
    const h = Math.min(1, prc);
    const ccCap = Math.min(1, cc);

    // Aquí aplicamos el multiplicador de 30x que tiene Warera internamente
    const dmgPerHit = (finalAttack * h * (1 + ccCap * (cd + 0.01 * extraCritMult))
                    + (finalAttack / 2) * (1 - h)) * WARERA_DAMAGE_MULTIPLIER;

    // ===== 3. Hambre (Ataques disponibles) =====
    const j = Math.max(0, player.hunger || 0);
    // Regeneración de hambre: 20% de la barra por hora
    const regen = (player.hungerMax || 10) * 0.20 * (opts.horas || 8);
    const P = Math.max(0, Math.floor(opts.contarRegen ? j + regen : j));

    const nAttacks = P; // 1 punto de hambre = 1 ataque

    // ===== 4. Battle Bonus =====
    const bonusMult = 1 + (opts.battleBonus || 0) / 100;

    // ===== 5. Daño Total =====
    const dmgTotal = dmgPerHit * nAttacks * bonusMult;

    return {
      dmgTotal,
      dmgPerHit,
      nAttacks,
      horas: opts.horas || 8,
      hpEfec: Math.max(0, player.health || 0) + (opts.contarRegen ? (c.regenHP || 0) * (opts.horas || 8) : 0),
      foodEfec: P
    };
  }

  window.WareraDamage = { calcDamagePotential };
})();