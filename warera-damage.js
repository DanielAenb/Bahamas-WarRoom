/**
 * Bahamas WarRoom — Simulador de daño potencial.
 * Expone window.WareraDamage.calcDamagePotential(player, opts).
 * AHORA SIMULA SET ÉPICO POR DEFECTO
 */
(function () {
  'use strict';

  function calcDamagePotential(player, opts) {
    const c = player.combat || {};

    // ===== 1. Set épico =====
    const EPIC_WEAPON_ATK        = 101;
    const EPIC_WEAPON_CRIT       = 16;
    const EPIC_HELMET_CRIT_DMG   = 71;
    const EPIC_GLOVES_PRECISION  = 21;
    const EPIC_ARMOR             = 42;
    const EPIC_DODGE             = 21;

    // ===== 2. Stats con set épico =====
    const rankMult = 1 + (c.militaryRankPercent || 0) / 100;
    const ammoMult = 1.10;

    // NUEVO: el estado efectivo (manual override) manda si existe.
    const pillState = opts.effectivePillStatus || player.pillStatus;
    const pillMult  = pillState === 'BUFF'   ? 1.6
                    : pillState === 'DEBUFF' ? 0.4
                    : 1.0;   // TIRED / STANDBY / undefined → 1.0

    const attack           = (c.attackBase + EPIC_WEAPON_ATK) * rankMult * ammoMult * pillMult;
    const precision        = c.precisionBase + EPIC_GLOVES_PRECISION + (c.precisionStrategic || 0);
    const criticalChance   = c.critChanceBase + EPIC_WEAPON_CRIT;
    const criticalDamages  = c.critDamageBase + EPIC_HELMET_CRIT_DMG;

    // ===== 3. Horas =====
    const horasBuff = Math.max(0, (player.pillRemainingMs || 0) / 3600000);
    let horasBase;
    if (horasBuff > 0) {
      horasBase = opts.horas !== undefined ? Math.min(opts.horas, horasBuff) : horasBuff;
    } else {
      horasBase = opts.horas !== undefined ? opts.horas : 8;
    }
    const horas = Math.floor(horasBase);

    // ===== 4. Daño por golpe =====
    let prc = precision / 100;
    const cc = criticalChance / 100;
    const cd = criticalDamages / 100;

    const finalAttack   = attack + 4 * Math.max(0, (prc - 1) * 100);
    const extraCritMult = 4 * Math.max(0, (cc - 1) * 100);
    const h             = Math.min(1, prc);
    const ccCap         = Math.min(1, cc);

    const dmgPerHit = finalAttack * h * (1 + ccCap * (cd + 0.01 * extraCritMult))
                    + (finalAttack / 2) * (1 - h);

    // ===== 5. Vida / hambre =====
    const healthMax = player.healthMax || 100;
    const y = Math.max(0, player.health || 0);
    const j = Math.max(0, player.hunger || 0);

    const k = opts.contarRegen ? Math.max(0, (c.regenHP || 0) * horas) : 0;
    const P = Math.max(0, Math.floor(opts.contarRegen ? j + (c.regenHunger || 0) * horas : j));

    // ===== 6. Mitigación =====
    const S = EPIC_ARMOR;
    const H = EPIC_DODGE;
    const M = 10 * (1 - S / (S + 40)) * (1 - H / (H + 40));

    const nAttacks = M > 0 ? (y + k + 0.2 * P * healthMax) / M : 0;

    // ===== 7. Total =====
    const dmgTotal = dmgPerHit * nAttacks * (1 + (opts.battleBonus || 0) / 100);

    return { dmgTotal, dmgPerHit, nAttacks, horas, hpEfec: y + k, foodEfec: P };
  }

  window.WareraDamage = { calcDamagePotential };
})();