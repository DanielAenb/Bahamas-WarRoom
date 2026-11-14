/**
 * Bahamas WarRoom — Simulador de daño potencial.
 * Expone window.WareraDamage.calcDamagePotential(player, opts).
 * AHORA SIMULA SET ÉPICO POR DEFECTO
 */
(function () {
  'use strict';

  function calcDamagePotential(player, opts) {
    const c = player.combat || {};
    
    // ==========================================
    // 1. INYECCIÓN DEL SET ÉPICO (Valores fijos)
    // ==========================================
    const EPIC_WEAPON_ATK = 101;
    const EPIC_WEAPON_CRIT = 16;
    const EPIC_HELMET_CRIT_DMG = 71;
    const EPIC_GLOVES_PRECISION = 21;
    const EPIC_ARMOR = 42; // 21 (pechera) + 21 (pantalón)
    const EPIC_DODGE = 21; // 21 (botas)

    // ==========================================
    // 2. RECONSTRUCCIÓN DE STATS CON SET ÉPICO
    // ==========================================
    const rankMult = 1 + (c.militaryRankPercent || 0) / 100;
    const ammoMult = 1.10; // Munición verde fija
    const pillMult = player.pillStatus === 'BUFF' ? 1.6 : (player.pillStatus === 'DEBUFF' ? 0.4 : 1.0);

    // Ataque: (Base + Arma Épica) * Rango * Munición * Pastilla
    const attack = (c.attackBase + EPIC_WEAPON_ATK) * rankMult * ammoMult * pillMult;

    // Precisión: Base + Guantes Épicos + Estrategia (Alianza)
    const precision = c.precisionBase + EPIC_GLOVES_PRECISION + (c.precisionStrategic || 0);

    // Crítico: Base + Arma Épica
    const criticalChance = c.critChanceBase + EPIC_WEAPON_CRIT;

    // Daño Crítico: Base + Casco Épico
    const criticalDamages = c.critDamageBase + EPIC_HELMET_CRIT_DMG;

    // ==========================================
    // 3. CÁLCULO DE TIEMPO (Regen)
    // ==========================================
    const horasBuff = Math.max(0, (player.pillRemainingMs || 0) / 3600000);
    let horasBase;
    if (horasBuff > 0) {
      horasBase = opts.horas !== undefined ? Math.min(opts.horas, horasBuff) : horasBuff;
    } else {
      horasBase = opts.horas !== undefined ? opts.horas : 8;
    }
    const horas = Math.floor(horasBase); // Solo horas completas

    // ==========================================
    // 4. CÁLCULO DE DAÑO POR GOLPE
    // ==========================================
    let prc = precision / 100;
    const cc = criticalChance / 100;
    const cd = criticalDamages / 100;

    // Overflow
    let finalAttack = attack + 4 * Math.max(0, (prc - 1) * 100);
    const extraCritMult = 4 * Math.max(0, (cc - 1) * 100);
    const h = Math.min(1, prc);
    const ccCap = Math.min(1, cc);

    const dmgPerHit = finalAttack * h * (1 + ccCap * (cd + 0.01 * extraCritMult))
                    + (finalAttack / 2) * (1 - h);

    // ==========================================
    // 5. VIDA Y HAMBRE (Blindado contra negativos)
    // ==========================================
    const healthMax = player.healthMax || 100;
    const y = Math.max(0, player.health || 0);
    const j = Math.max(0, player.hunger || 0);

    const k = opts.contarRegen ? Math.max(0, (c.regenHP || 0) * horas) : 0;
    const P = Math.max(0, Math.floor(opts.contarRegen ? j + (c.regenHunger || 0) * horas : j));

    // ==========================================
    // 6. MITIGACIÓN (Armadura y Esquiva Épicas)
    // ==========================================
    const S = EPIC_ARMOR;
    const H = EPIC_DODGE;
    const M = 10 * (1 - S / (S + 40)) * (1 - H / (H + 40));

    const nAttacks = M > 0 ? (y + k + 0.2 * P * healthMax) / M : 0;

    // ==========================================
    // 7. DAÑO TOTAL (con Battle Bonus final)
    // ==========================================
    const dmgTotal = dmgPerHit * nAttacks * (1 + opts.battleBonus / 100);

    return { 
      dmgTotal, 
      dmgPerHit, 
      nAttacks, 
      horas, 
      hpEfec: y + k, 
      foodEfec: P 
    };
  }

  window.WareraDamage = { calcDamagePotential };
})();
