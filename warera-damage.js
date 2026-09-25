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

    const horasBuff = Math.max(0, (player.pillRemainingMs || 0) / 3600000);
    const horas = horasBuff > 0 ? horasBuff : 8;

    let prc = precision / 100;
    const cc = criticalChance / 100;
    const cd = criticalDamages / 100;

    const extraCritMult = 4 * Math.max(0, (cc - 1) * 100);
    attack += 4 * Math.max(0, (prc - 1) * 100);

    const h = Math.min(1, prc);
    const ccCap = Math.min(1, cc);

    const dmgPerHit = attack * h * (1 + ccCap * (cd + 0.01 * extraCritMult))
                    + (attack / 2) * (1 - h);

    const healthMax = player.healthMax || 100;
    const y = player.health;
    const j = player.hunger;

    const k = opts.contarRegen ? regenHP * horas : 0;
    const P = Math.floor(opts.contarRegen ? j + regenHunger * horas : j);

    const S = armor;
    const H = dodge;
    const M = 10 * (1 - S / (S + 40)) * (1 - H / (H + 40));

    const nAttacks = M > 0 ? (y + k + 0.2 * P * healthMax) / M : 0;

    const dmgTotal = dmgPerHit * nAttacks * (1 + opts.battleBonus / 100);

    return { dmgTotal, dmgPerHit, nAttacks, horas, hpEfec: y + k, foodEfec: P };
  }

  window.WareraDamage = { calcDamagePotential };
})();
