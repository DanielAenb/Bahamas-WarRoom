/**
 * Bahamas WarRoom — Simulador de daño potencial.
 */
(function () {
  'use strict';

  const ASSUME_EPIC_GEAR = true; 
  const WARERA_DAMAGE_MULTIPLIER = 30;

  const EPIC_WEAPON_ATK       = 101;
  const EPIC_WEAPON_CRIT      = 16;
  const EPIC_HELMET_CRIT_DMG  = 71;
  const EPIC_GLOVES_PRECISION = 21;
  
  function calcDamagePotential(player, opts) {
    const c = player.combat || {};

    let attack, precision, criticalChance, criticalDamages;

    // ===== 1. Cálculo de Stats (Épico vs Real) =====
    if (ASSUME_EPIC_GEAR) {
      const rankMult = 1 + (c.militaryRankPercent || 0) / 100;
      const ammoMult = 1 + (c.ammoPercent ?? 10) / 100;
      const pillMult = player.pillStatus === 'BUFF' ? 1.6 : (player.pillStatus === 'DEBUFF' ? 0.4 : 1.0);

      attack = (c.attackBase + EPIC_WEAPON_ATK) * rankMult * ammoMult * pillMult;
      precision = c.precisionBase + EPIC_GLOVES_PRECISION + (c.precisionStrategic || 0);
      criticalChance = c.critChanceBase + EPIC_WEAPON_CRIT;
      criticalDamages = c.critDamageBase + EPIC_HELMET_CRIT_DMG;
    } else {
      attack = c.attack || c.attackBase || 0;
      precision = c.precision || 100;
      criticalChance = c.criticalChance || 0;
      criticalDamages = c.criticalDamages || 0;
    }

    // ===== 2. Horas de Regeneración (Limitadas por el Buff) =====
    const rawHours = Math.max(0, (player.pillRemainingMs || 0) / 3_600_000);
    const sliderHours = opts.horas !== undefined ? opts.horas : 8;
    let horas = 0;

    if (rawHours > 0) {
        // Si hay buff activo, el límite es el tiempo del buff (redondeado hacia abajo)
        let buffHours = Math.floor(rawHours);
        
        // Si le queda menos de 1 hora de buff, se cuenta como 1 hora completa
        if (buffHours === 0) buffHours = 1; 
        
        // El slider manda, pero nunca puede superar las horas de buff reales
        horas = Math.min(sliderHours, buffHours);
    } else {
        // Sin buff (Standby), usamos el slider directamente
        horas = sliderHours;
    }

    // ===== 3. Daño por Golpe =====
    const prc = precision / 100;
    const cc = criticalChance / 100;
    const cd = criticalDamages / 100;

    const finalAttack = attack + 4 * Math.max(0, (prc - 1) * 100);
    const extraCritMult = 4 * Math.max(0, (cc - 1) * 100);
    const h = Math.min(1, prc);
    const ccCap = Math.min(1, cc);

    const dmgPerHit = (finalAttack * h * (1 + ccCap * (cd + 0.01 * extraCritMult))
                    + (finalAttack / 2) * (1 - h)) * WARERA_DAMAGE_MULTIPLIER;

    // ===== 4. Hambre (Ataques disponibles) =====
    const j = Math.max(0, player.hunger || 0);
    // Usamos la regeneración de hambre real del API, o el 20% de la barra como fallback
    const regenHunger = c.regenHunger !== undefined ? c.regenHunger : (player.hungerMax || 10) * 0.2;
    const P = Math.max(0, Math.floor(opts.contarRegen ? j + (regenHunger * horas) : j));

    const nAttacks = P; 

    // ===== 5. Battle Bonus =====
    const bonusMult = 1 + (opts.battleBonus || 0) / 100;

    // ===== 6. Daño Total =====
    const dmgTotal = dmgPerHit * nAttacks * bonusMult;

    // ===== 7. Retorno =====
    const regenHP = c.regenHP !== undefined ? c.regenHP : (player.healthMax || 100) * 0.2;
    
    return {
      dmgTotal,
      dmgPerHit,
      nAttacks,
      horas,
      hpEfec: Math.max(0, player.health || 0) + (opts.contarRegen ? regenHP * horas : 0),
      foodEfec: P
    };
  }

  window.WareraDamage = { calcDamagePotential };
})();