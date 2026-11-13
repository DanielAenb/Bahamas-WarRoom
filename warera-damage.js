/**
 * Bahamas WarRoom — Simulador de daño potencial.
 * Expone window.WareraDamage.calcDamagePotential(player, opts).
 */
(function () {
  'use strict';

  function calcDamagePotential(player, opts) {
    const c = player.combat || {};
    let attack            = c.attack          || 0;
    const precision       = c.precision       || 0;
    const criticalChance  = c.criticalChance  || 0;
    const criticalDamages = c.criticalDamages || 0;
    const armor           = c.armor           || 0;
    const dodge           = c.dodge           || 0;
    const regenHP         = c.regenHP         || 0;
    const regenHunger     = c.regenHunger     || 0;
    const militaryRankPct = c.militaryRankPercent || 0;

    // 1. Calcular tiempo base (Tope por buff y slider)
    const horasBuff = Math.max(0, (player.pillRemainingMs || 0) / 3600000);
    let horasBase;
    
    if (horasBuff > 0) {
      // Si tiene buff, el tope es el menor entre el slider y el tiempo del buff
      horasBase = opts.horas !== undefined ? Math.min(opts.horas, horasBuff) : horasBuff;
    } else {
      // Si no tiene buff, usamos el slider (o 8 por defecto)
      horasBase = opts.horas !== undefined ? opts.horas : 8;
    }

    // 2. REGLA DE ORO: Redondeo discreto. Solo contamos horas completas.
    // Si el buff dura 1.62h, solo se cuenta 1 tick de regeneración.
    const horas = Math.floor(horasBase);

    // 3. Overflow: Si precisión o crítico superan 100%, el excedente suma ataque o daño extra
    let prc = precision / 100;
    const cc = criticalChance / 100;
    const cd = criticalDamages / 100;
    
    attack += 4 * Math.max(0, (prc - 1) * 100);

    // 4. Multiplicadores Fijos (Munición verde 1.10 y Rango Militar)
    const ammoMultiplier = 1.10; 
    const rankMultiplier = 1 + (militaryRankPct / 100);
    attack = attack * ammoMultiplier * rankMultiplier;

    // 5. Daño por golpe (Aplicando overflow de crítico)
    const extraCritMult = 4 * Math.max(0, (cc - 1) * 100);
    const h = Math.min(1, prc);
    const ccCap = Math.min(1, cc);

    const dmgPerHit = attack * h * (1 + ccCap * (cd + 0.01 * extraCritMult))
                    + (attack / 2) * (1 - h);

    // 6. Vida y Hambre Efectiva
    const healthMax = player.healthMax || 100;
    const y = player.health || 0;
    const j = player.hunger || 0;

    // Aplicamos la regeneración solo si está activada (usando las "horas" enteras)
    const k = opts.contarRegen ? regenHP * horas : 0;
    const P = Math.floor(opts.contarRegen ? j + regenHunger * horas : j);

    // 7. Mitigación (Armadura y Esquiva)
    const S = armor;
    const H = dodge;
    const M = 10 * (1 - S / (S + 40)) * (1 - H / (H + 40));

    // 8. Cantidad de golpes
    const nAttacks = M > 0 ? (y + k + 0.2 * P * healthMax) / M : 0;

    // 9. Daño Total (con Battle Bonus final)
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
