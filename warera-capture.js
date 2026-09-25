/**
 * Bahamas WarRoom — Capturas (canvas + entrega de blob).
 * Expone window.WareraCapture.
 *
 * Requiere init({
 *   getState, calcDamagePotential, formatDmg, formatTimer, truncateText, notify
 * }) antes de usar cualquier función.
 */
(function () {
  'use strict';

  const CAPTURE = {
    FONT: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    MONO: '"Courier New", monospace',
    C: {
      base: '#0e0e0e',
      separator: 'rgba(255, 255, 255, 0.10)',
      title: '#ffffff',
      titleAccent: '#00b1ff',
      subtitle: '#94a3b8',
      name: '#ffffff',
      label: '#8b95a3',
      value: '#e2e8f0',
      footer: '#64748b',
      buff: '#22c55e',
      debuff: '#ef4444',
      standby: '#818fa3',
      hpFill: '#22c55e',
      fdFill: '#f97316',
      damageAccent: '#22c55e',
      barBg: 'rgba(255, 255, 255, 0.10)',
      badgeWarBg: 'rgba(239, 68, 68, 0.20)',
      badgeWarText: '#fca5a5',
      badgeWarBorder: 'rgba(239, 68, 68, 0.55)',
      badgeEcoBg: 'rgba(34, 197, 94, 0.20)',
      badgeEcoText: '#86efac',
      badgeEcoBorder: 'rgba(34, 197, 94, 0.55)'
    }
  };

  let deps = null;
  function init(d) { deps = d; }

  function computeCaptureBg(buffCount, debuffCount) {
    const BASE = [14, 14, 14];
    const active = buffCount + debuffCount;
    if (active <= 3) return { start: `rgb(${BASE.join(',')})`, end: `rgb(${BASE.join(',')})` };
    const strength = Math.min(1, (active - 3) / 15) * 0.10;
    const tint = buffCount >= debuffCount ? [34, 197, 94] : [239, 68, 68];
    const end = [
      Math.round(BASE[0] + (tint[0] - BASE[0]) * strength),
      Math.round(BASE[1] + (tint[1] - BASE[1]) * strength),
      Math.round(BASE[2] + (tint[2] - BASE[2]) * strength)
    ];
    return { start: `rgb(${BASE.join(',')})`, end: `rgb(${end.join(',')})` };
  }

  function computePlayerCaptureBg(player) {
    const BASE = [14, 14, 14];
    if (player.pillStatus === 'STANDBY') return { start: `rgb(${BASE.join(',')})`, end: `rgb(${BASE.join(',')})` };
    const tint = player.pillStatus === 'BUFF' ? [34, 197, 94] : [239, 68, 68];
    const strength = 0.15;
    const end = [
      Math.round(BASE[0] + (tint[0] - BASE[0]) * strength),
      Math.round(BASE[1] + (tint[1] - BASE[1]) * strength),
      Math.round(BASE[2] + (tint[2] - BASE[2]) * strength)
    ];
    return { start: `rgb(${BASE.join(',')})`, end: `rgb(${end.join(',')})` };
  }

  function fillCaptureBg(ctx, w, h, colors) {
    const grad = ctx.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, colors.start);
    grad.addColorStop(0.45, colors.start);
    grad.addColorStop(1, colors.end);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
  }

  function roundRect(ctx, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  async function loadImage(url, timeoutMs = 8000) {
    if (!url) return null;
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      const res = await fetch(url, { mode: 'cors', signal: controller.signal });
      clearTimeout(timer);
      if (res.ok) {
        const blob = await res.blob();
        const objUrl = URL.createObjectURL(blob);
        const img = await new Promise((resolve) => {
          const i = new Image();
          i.onload = () => resolve(i);
          i.onerror = () => resolve(null);
          i.src = objUrl;
        });
        URL.revokeObjectURL(objUrl);
        if (img) return img;
      }
    } catch (_) {}
    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      let settled = false;
      const timer = setTimeout(() => {
        if (settled) return;
        settled = true;
        resolve(null);
      }, timeoutMs);
      img.onload = () => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve(img);
      };
      img.onerror = () => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve(null);
      };
      img.src = url;
    });
  }

  function drawAvatar(ctx, img, player, cx, cy, radius) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.closePath();
    ctx.clip();
    if (img) {
      ctx.drawImage(img, cx - radius, cy - radius, radius * 2, radius * 2);
    } else {
      ctx.fillStyle = '#334155';
      ctx.fillRect(cx - radius, cy - radius, radius * 2, radius * 2);
      ctx.fillStyle = '#ffffff';
      ctx.font = `bold ${Math.round(radius * 1.05)}px ${CAPTURE.FONT}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const initial = (player.name || '?').trim().charAt(0).toUpperCase();
      ctx.fillText(initial, cx, cy + 1);
    }
    ctx.restore();
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }

  function drawModoBadge(ctx, modo, x, y, size = 'md') {
    const isWar = modo === 'WAR';
    const bg     = isWar ? CAPTURE.C.badgeWarBg     : CAPTURE.C.badgeEcoBg;
    const fg     = isWar ? CAPTURE.C.badgeWarText   : CAPTURE.C.badgeEcoText;
    const border = isWar ? CAPTURE.C.badgeWarBorder : CAPTURE.C.badgeEcoBorder;
    const fontSize = size === 'sm' ? 11 : size === 'lg' ? 15 : 13;
    ctx.font = `bold ${fontSize}px ${CAPTURE.FONT}`;
    const textW = ctx.measureText(modo).width;
    const padX = size === 'lg' ? 11 : 9;
    const w = textW + padX * 2;
    const h = fontSize + 10;
    ctx.fillStyle = bg;
    roundRect(ctx, x, y - h / 2, w, h, 5);
    ctx.fill();
    ctx.strokeStyle = border;
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = fg;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(modo, x + padX, y + 0.5);
    return w;
  }

  function drawStatusInline(ctx, player, x, y, size = 'md') {
    const dotR = size === 'sm' ? 5 : size === 'lg' ? 7 : 6;
    const fontSize = size === 'sm' ? 12 : size === 'lg' ? 16 : 14;
    const color = player.pillStatus === 'BUFF' ? CAPTURE.C.buff
                : player.pillStatus === 'DEBUFF' ? CAPTURE.C.debuff
                : CAPTURE.C.standby;
    ctx.beginPath();
    ctx.arc(x, y, dotR + 3, 0, Math.PI * 2);
    ctx.fillStyle = color + '22';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x, y, dotR, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
    let label, labelColor, timer = null;
    if (player.pillStatus === 'BUFF') { label = 'BUFF'; labelColor = '#4ade80'; timer = deps.formatTimer(player.pillRemainingMs); }
    else if (player.pillStatus === 'DEBUFF') { label = 'DEBUFF'; labelColor = '#f87171'; timer = deps.formatTimer(player.pillRemainingMs); }
    else { label = 'En Espera'; labelColor = '#94a3b8'; }
    const textX = x + dotR + 10;
    ctx.font = `bold ${fontSize}px ${CAPTURE.FONT}`;
    ctx.fillStyle = labelColor;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, textX, y);
    if (timer) {
      const labelW = ctx.measureText(label).width;
      ctx.font = `bold ${fontSize}px ${CAPTURE.MONO}`;
      ctx.fillStyle = CAPTURE.C.name;
      ctx.fillText(timer, textX + labelW + 12, y);
    }
  }

  function drawStatusStacked(ctx, player, x, cy) {
    const color = player.pillStatus === 'BUFF' ? CAPTURE.C.buff
                : player.pillStatus === 'DEBUFF' ? CAPTURE.C.debuff
                : CAPTURE.C.standby;
    const topY = cy - 17;
    const botY = cy + 17;
    const dotR = 6;
    ctx.beginPath();
    ctx.arc(x + dotR, topY, dotR + 3, 0, Math.PI * 2);
    ctx.fillStyle = color + '22';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x + dotR, topY, dotR, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
    let label, labelColor;
    if (player.pillStatus === 'BUFF')        { label = 'BUFF';      labelColor = '#4ade80'; }
    else if (player.pillStatus === 'DEBUFF') { label = 'DEBUFF';    labelColor = '#f87171'; }
    else                                     { label = 'En Espera'; labelColor = '#94a3b8'; }
    ctx.font = `bold 17px ${CAPTURE.FONT}`;
    ctx.fillStyle = labelColor;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, x + dotR * 2 + 10, topY);
    if (player.pillStatus !== 'STANDBY') {
      ctx.font = `bold 19px ${CAPTURE.MONO}`;
      ctx.fillStyle = CAPTURE.C.name;
      ctx.fillText(deps.formatTimer(player.pillRemainingMs), x, botY);
    } else {
      ctx.font = `13px ${CAPTURE.FONT}`;
      ctx.fillStyle = CAPTURE.C.subtitle;
      ctx.fillText('sin efecto activo', x, botY);
    }
  }

  function drawStatBar(ctx, x, y, label, current, max, fillColor, barW, size = 'md') {
    const labelSize = size === 'sm' ? 10 : size === 'lg' ? 14 : 12;
    const valueSize = size === 'sm' ? 12 : size === 'lg' ? 16 : 14;
    const barH      = size === 'sm' ? 7  : size === 'lg' ? 11 : 9;
    const labelW    = size === 'sm' ? 24 : size === 'lg' ? 32 : 28;
    ctx.font = `bold ${labelSize}px ${CAPTURE.FONT}`;
    ctx.fillStyle = CAPTURE.C.label;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, x, y);
    const barX = x + labelW;
    ctx.save();
    roundRect(ctx, barX, y - barH / 2, barW, barH, barH / 2);
    ctx.clip();
    ctx.fillStyle = CAPTURE.C.barBg;
    ctx.fillRect(barX, y - barH / 2, barW, barH);
    const pct = max > 0 ? Math.min(1, current / max) : 0;
    ctx.fillStyle = fillColor;
    ctx.fillRect(barX, y - barH / 2, barW * pct, barH);
    ctx.restore();
    ctx.font = `600 ${valueSize}px ${CAPTURE.FONT}`;
    ctx.fillStyle = CAPTURE.C.value;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${current} / ${max}`, barX + barW + 12, y);
  }

  function getFilterSummaryLines() {
    const s = deps.getState();
    const unitLabel  = s.selectedUnit === 'Uchiha' ? 'Clan Uchiha' : 'Clan Akatsuki';
    const modeLabel  = s.selectedMode === 'ALL' ? 'Ver Todo' : `Modo ${s.selectedMode}`;
    const orderLabel = s.ordenActual === 'alfabetico' ? 'Alfabético' : 'Por Estado';
    const parts = [unitLabel, modeLabel, orderLabel];
    if (s.smartSort) parts.push('Prioridad Táctica');
    if (s.damagePanelActive) {
      parts.push(`Bonus ${s.battleBonus}%`);
      parts.push(`Regen ${s.contarRegen ? 'ON' : 'OFF'}`);
    }
    return parts;
  }

  function drawListHeader(ctx, width, height, showDamage) {
    const PAD = 40;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.font = `bold 30px ${CAPTURE.FONT}`;
    const bah = 'BAHAMAS ';
    const war = 'WARROOM';
    const bahW = ctx.measureText(bah).width;
    ctx.fillStyle = CAPTURE.C.title;
    ctx.fillText(bah, PAD, 42);
    ctx.fillStyle = CAPTURE.C.titleAccent;
    ctx.fillText(war, PAD + bahW, 42);

    ctx.font = `17px ${CAPTURE.FONT}`;
    ctx.fillStyle = CAPTURE.C.subtitle;
    ctx.fillText(getFilterSummaryLines().join('   ·   '), PAD, 84);

    if (showDamage) {
      ctx.font = `bold 13px ${CAPTURE.FONT}`;
      ctx.fillStyle = CAPTURE.C.damageAccent;
      ctx.textAlign = 'right';
      ctx.fillText('DAÑO POTENCIAL', width - PAD, 84);
      ctx.textAlign = 'left';
    }

    ctx.fillStyle = CAPTURE.C.separator;
    ctx.fillRect(PAD, height - 1, width - PAD * 2, 1);
  }

  async function buildCaptureBlob(players) {
    const state = deps.getState();
    const showDamage = !!state.damagePanelActive;
    const PAD = 40;
    const W = showDamage ? 1160 : 1000;
    const HEADER_H = 126;
    const ROW_H = 102;
    const FOOTER_H = 60;
    const TOTAL_H = HEADER_H + ROW_H * players.length + FOOTER_H;
    const scale = 2;
    const canvas = document.createElement('canvas');
    canvas.width = W * scale;
    canvas.height = TOTAL_H * scale;
    const ctx = canvas.getContext('2d');
    ctx.scale(scale, scale);

    let buff = 0, debuff = 0;
    for (const p of players) {
      if (p.pillStatus === 'BUFF') buff++;
      else if (p.pillStatus === 'DEBUFF') debuff++;
    }
    fillCaptureBg(ctx, W, TOTAL_H, computeCaptureBg(buff, debuff));
    drawListHeader(ctx, W, HEADER_H, showDamage);

    const avatars = await Promise.all(players.map(p => loadImage(p.avatarUrlProxy || p.avatarUrl)));

    let totalDamage = 0;
    if (showDamage) {
      for (const p of players) {
        const c = deps.calcDamagePotential(p, {
          contarRegen: state.contarRegen,
          battleBonus: state.battleBonus
        });
        totalDamage += c.dmgTotal;
      }
    }

    players.forEach((p, i) => {
      const rowY = HEADER_H + i * ROW_H;
      const cy = rowY + ROW_H / 2;
      if (i > 0) {
        ctx.fillStyle = CAPTURE.C.separator;
        ctx.fillRect(PAD, rowY, W - PAD * 2, 1);
      }
      drawAvatar(ctx, avatars[i], p, PAD + 36, cy, 34);

      ctx.font = `bold 21px ${CAPTURE.FONT}`;
      ctx.fillStyle = CAPTURE.C.name;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(deps.truncateText(ctx, p.name, 180), PAD + 90, cy);

      drawModoBadge(ctx, p.modo, 320, cy, 'md');
      drawStatusStacked(ctx, p, 430, cy);

      drawStatBar(ctx, 660, cy - 17, 'HP', p.health, p.healthMax, CAPTURE.C.hpFill, 140, 'md');
      drawStatBar(ctx, 660, cy + 17, 'FD', p.hunger, p.hungerMax, CAPTURE.C.fdFill, 140, 'md');

      if (showDamage) {
        const calc = deps.calcDamagePotential(p, {
          contarRegen: state.contarRegen,
          battleBonus: state.battleBonus
        });
        ctx.font = `bold 22px ${CAPTURE.MONO}`;
        ctx.fillStyle = CAPTURE.C.damageAccent;
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';
        ctx.fillText(deps.formatDmg(calc.dmgTotal), W - PAD, cy);
      }
    });

    const footY = TOTAL_H - FOOTER_H;
    ctx.fillStyle = CAPTURE.C.separator;
    ctx.fillRect(PAD, footY, W - PAD * 2, 1);
    ctx.font = `15px ${CAPTURE.FONT}`;
    ctx.fillStyle = CAPTURE.C.footer;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    const leftLabel = `Bahamas WarRoom  ·  ${players.length} jugador${players.length === 1 ? '' : 'es'}`;
    ctx.fillText(leftLabel, PAD, footY + FOOTER_H / 2);

    if (showDamage) {
      ctx.font = `bold 17px ${CAPTURE.MONO}`;
      ctx.fillStyle = CAPTURE.C.damageAccent;
      ctx.textAlign = 'right';
      ctx.fillText(`Total: ${deps.formatDmg(totalDamage)}`, W - PAD, footY + FOOTER_H / 2);
    }

    return new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
  }

  async function buildPlayerCaptureBlob(player) {
    const state = deps.getState();
    const showDamage = !!state.damagePanelActive;
    const PAD = 24;
    const W = 520;
    const H = showDamage ? 280 : 230;

    const scale = 2;
    const canvas = document.createElement('canvas');
    canvas.width = W * scale;
    canvas.height = H * scale;
    const ctx = canvas.getContext('2d');
    ctx.scale(scale, scale);

    fillCaptureBg(ctx, W, H, computePlayerCaptureBg(player));

    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.font = `bold 13px ${CAPTURE.FONT}`;
    const bah = 'BAHAMAS ';
    const war = 'WARROOM';
    const bahW = ctx.measureText(bah).width;
    const warW = ctx.measureText(war).width;
    ctx.fillStyle = CAPTURE.C.title;
    ctx.fillText(bah, PAD, 22);
    ctx.fillStyle = CAPTURE.C.titleAccent;
    ctx.fillText(war, PAD + bahW, 22);
    ctx.font = `13px ${CAPTURE.FONT}`;
    ctx.fillStyle = CAPTURE.C.subtitle;
    ctx.fillText('·  Ficha de jugador', PAD + bahW + warW + 8, 22);

    ctx.fillStyle = CAPTURE.C.separator;
    ctx.fillRect(PAD, 40, W - PAD * 2, 1);

    const avatarImg = await loadImage(player.avatarUrlProxy || player.avatarUrl);
    drawAvatar(ctx, avatarImg, player, PAD + 36, 105, 36);

    const nameX = PAD + 90;
    ctx.font = `bold 20px ${CAPTURE.FONT}`;
    ctx.fillStyle = CAPTURE.C.name;
    ctx.textBaseline = 'middle';
    ctx.fillText(deps.truncateText(ctx, player.name, W - nameX - PAD), nameX, 90);

    const badgeW = drawModoBadge(ctx, player.modo, nameX, 124, 'md');
    drawStatusInline(ctx, player, nameX + badgeW + 18, 124, 'md');

    drawStatBar(ctx, PAD, 178, 'HP', player.health, player.healthMax, CAPTURE.C.hpFill, 320, 'lg');
    drawStatBar(ctx, PAD, 208, 'FD', player.hunger, player.hungerMax, CAPTURE.C.fdFill, 320, 'lg');

    if (showDamage) {
      ctx.fillStyle = CAPTURE.C.separator;
      ctx.fillRect(PAD, 238, W - PAD * 2, 1);

      const calc = deps.calcDamagePotential(player, {
        contarRegen: state.contarRegen,
        battleBonus: state.battleBonus
      });

      ctx.font = `bold 11px ${CAPTURE.FONT}`;
      ctx.fillStyle = CAPTURE.C.label;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText('DAÑO POTENCIAL', PAD, 257);

      ctx.font = `bold 22px ${CAPTURE.MONO}`;
      ctx.fillStyle = CAPTURE.C.damageAccent;
      ctx.textAlign = 'right';
      ctx.fillText(deps.formatDmg(calc.dmgTotal), W - PAD, 257);
    }

    return new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
  }

  async function copyBlobToClipboard(blob) {
    try {
      if (navigator.clipboard && window.ClipboardItem) {
        await navigator.clipboard.write([ new ClipboardItem({ 'image/png': blob }) ]);
        return true;
      }
    } catch (e) { console.warn('Portapapeles no disponible:', e); }
    return false;
  }

  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  async function deliverBlob(blob, filename) {
    if (deps.getState().forceDownload) {
      downloadBlob(blob, filename);
      return { method: 'download' };
    }
    const file = new File([blob], filename, { type: 'image/png' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: 'Bahamas WarRoom', text: 'Captura del clan' });
        return { method: 'share' };
      } catch (e) {
        if (e.name === 'AbortError') return { method: 'cancelled' };
        console.warn('Share falló, probando alternativas:', e);
      }
    }
    const ok = await copyBlobToClipboard(blob);
    if (ok) return { method: 'clipboard' };
    downloadBlob(blob, filename);
    return { method: 'download' };
  }

  function buildFilename(prefix) {
    const ts = new Date().toISOString().slice(0, 16).replace(/[:T]/g, '');
    return `warroom_${prefix}_${ts}.png`;
  }

  function notifyDeliveryResult(result) {
    switch (result.method) {
      case 'share': mostrarNotificacion('Captura lista para compartir.', 1800, 'success'); break;
      case 'cancelled': break;
      case 'clipboard': mostrarNotificacion('Captura copiada al portapapeles.', 2000, 'success'); break;
      case 'download': mostrarNotificacion('Captura descargada.', 2000, 'success'); break;
      case 'error': mostrarNotificacion('Error generando la captura.', 2500, 'error'); break;
    }
  }

  function mostrarNotificacion(...args) { return deps.notify(...args); }



  window.WareraCapture = {
    init,
    buildCaptureBlob,
    buildPlayerCaptureBlob,
    deliverBlob,
    buildFilename,
    notifyDeliveryResult,
    computeCaptureBg,        // ← nuevo
    computePlayerCaptureBg   // ← nuevo
  };
})();