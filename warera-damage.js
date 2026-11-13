/**
 * Bahamas WarRoom — Simulador de daño potencial.
 * Expone window.WareraDamage.calcDamagePotential(player, opts).
 */
(function () {
  'use strict';

  function calcDamagePotential(player, opts) {
    const c = player.combat || {};
    
    // La API ya nos da los totales con equipo, alianza, rango y munición incluidos.
    const attack            = c.attack          || 0;
    const precision         = c.precision       || 0;
    const criticalChance    = c.criticalChance  || 0;
    const criticalDamages   = c.criticalDamages || 0;
    const armor             = c.armor           || 0;
    const dodge             = c.dodge           || 0;
    const regenHP           = c.regenHP         || 0;
    const regenHunger       = c.regenHunger     || 0;

    // 1. Calcular tiempo base (Tope por buff y slider)
    const horasBuff = Math.max(0, (player.pillRemainingMs || 0) / 3600000);
    let horasBase;
    
    if (horasBuff > 0) {
      horasBase = opts.horas !== undefined ? Math.min(opts.horas, horasBuff) : horasBuff;
    } else {
      horasBase = opts.horas !== undefined ? opts.horas : 8;
    }

    // 2. REGLA DE ORO: Redondeo discreto (solo horas completas)
    const horas = Math.floor(horasBase);

    // 3. Cálculo de daño por golpe (Overflow ya incluido en la API)
    let prc = precision / 100;
    const cc = criticalChance / 100;
    const cd = criticalDamages / 100;

    const h = Math.min(1, prc);
    const ccCap = Math.min(1, cc);

    // La fórmula estándar de WarEra
    const dmgPerHit = attack * h * (1 + ccCap * cd)
                    + (attack / 2) * (1 - h);

    // 4. Vida y Hambre
    const healthMax = player.healthMax || 100;
    const y = player.health || 0;
    const j = player.hunger || 0;

    // Aplicamos la regeneración (solo horas completas)
    const k = opts.contarRegen ? regenHP * horas : 0;
    const P = Math.floor(opts.contarRegen ? j + regenHunger * horas : j);

    // 5. Mitigación
    const S = armor;
    const H = dodge;
    const M = 10 * (1 - S / (S + 40)) * (1 - H / (H + 40));

    // 6. Cantidad de golpes (Sumando comida extra)
    const nAttacks = M > 0 ? (y + k + 0.2 * P * healthMax) / M : 0;

    // 7. Daño Total (con Battle Bonus final)
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
