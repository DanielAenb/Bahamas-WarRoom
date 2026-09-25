/**
 * Bahamas WarRoom — Press-and-hold para capturas individuales.
 * Expone window.WareraPress.
 *
 * Requiere init({ getPlayerById, copyPlayerCapture, holdMs }).
 */
(function () {
  'use strict';

  const SPINNER_RADIUS = 22;
  const SPINNER_CIRCUMFERENCE = 2 * Math.PI * SPINNER_RADIUS;
  const MOVE_TOLERANCE = 10;

  let deps = null;
  let pressState = null;
  let holdSpinnerEl = null;

  function init(d) { deps = d; }

  function initPressToCapture() {
    holdSpinnerEl = document.createElement('div');
    holdSpinnerEl.className = 'hold-spinner';
    holdSpinnerEl.innerHTML = `
      <svg viewBox="0 0 52 52" width="52" height="52" aria-hidden="true">
        <circle class="spinner-track"
                cx="26" cy="26" r="${SPINNER_RADIUS}"
                fill="none"
                stroke="rgba(255,255,255,0.15)"
                stroke-width="3"></circle>
        <circle class="spinner-ring"
                cx="26" cy="26" r="${SPINNER_RADIUS}"
                fill="none"
                stroke="#00b1ff"
                stroke-width="3"
                stroke-linecap="round"
                stroke-dasharray="${SPINNER_CIRCUMFERENCE}"
                stroke-dashoffset="${SPINNER_CIRCUMFERENCE}"
                transform="rotate(-90 26 26)"></circle>
      </svg>
    `;
    document.body.appendChild(holdSpinnerEl);

    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('pointermove', onPointerMove);

    ['pointerup', 'pointercancel'].forEach(ev => {
      document.addEventListener(ev, cancelPress);
    });

    window.addEventListener('scroll', cancelPress, { passive: true, capture: true });

    document.addEventListener('contextmenu', (e) => {
      if (e.target.closest('[data-copy-player]')) e.preventDefault();
    });
  }

  function onPointerDown(e) {
    if (e.button !== 0 && e.pointerType === 'mouse') return;

    const avatar = e.target.closest('[data-avatar-player]');
    if (avatar) {
      e.preventDefault();
      e.stopPropagation();

      const id = avatar.dataset.avatarPlayer;
      const player = deps.getPlayerById(id);
      if (!player) return;

      const card = avatar.closest('[data-copy-player]');
      if (card) {
        card.classList.add('capture-flash');
        setTimeout(() => card.classList.remove('capture-flash'), 600);
      }

      deps.copyPlayerCapture(player);
      return;
    }

    const card = e.target.closest('[data-copy-player]');
    if (!card) return;
    startPress(card, e.clientX, e.clientY);
  }

  function onPointerMove(e) {
    if (!pressState) return;
    const dx = e.clientX - pressState.startX;
    const dy = e.clientY - pressState.startY;
    if (Math.hypot(dx, dy) > MOVE_TOLERANCE) cancelPress();
  }

  function startPress(card, x, y) {
    cancelPress();
    const playerId = card.dataset.copyPlayer;
    const player = deps.getPlayerById(playerId);
    if (!player) return;

    card.classList.add('pressing');
    card.style.setProperty('--progress', '0%');

    showHoldSpinner(x, y);

    const startTime = performance.now();
    const ringEl = holdSpinnerEl ? holdSpinnerEl.querySelector('.spinner-ring') : null;

    const tick = (now) => {
      if (!pressState || pressState.card !== card) return;
      const elapsed = now - startTime;
      const progress = Math.min(1, elapsed / deps.holdMs);

      card.style.setProperty('--progress', (progress * 100) + '%');

      if (ringEl) {
        ringEl.style.strokeDashoffset = String(SPINNER_CIRCUMFERENCE * (1 - progress));
      }

      if (progress >= 1) {
        const p = pressState.player;
        cancelPress();
        card.classList.add('capture-flash');
        setTimeout(() => card.classList.remove('capture-flash'), 600);
        deps.copyPlayerCapture(p);
        return;
      }
      pressState.rafId = requestAnimationFrame(tick);
    };

    pressState = { card, player, startX: x, startY: y, rafId: requestAnimationFrame(tick) };
  }

  function cancelPress() {
    hideHoldSpinner();
    if (!pressState) return;
    cancelAnimationFrame(pressState.rafId);
    pressState.card.classList.remove('pressing');
    pressState.card.style.removeProperty('--progress');
    pressState = null;
  }

  function showHoldSpinner(x, y) {
    if (!holdSpinnerEl) return;
    holdSpinnerEl.style.left = x + 'px';
    holdSpinnerEl.style.top = y + 'px';

    const ringEl = holdSpinnerEl.querySelector('.spinner-ring');
    if (ringEl) {
      ringEl.style.transition = 'none';
      ringEl.style.strokeDashoffset = String(SPINNER_CIRCUMFERENCE);
    }

    holdSpinnerEl.style.display = 'block';
    void holdSpinnerEl.offsetWidth;
    holdSpinnerEl.classList.add('visible');
  }

  function hideHoldSpinner() {
    if (!holdSpinnerEl) return;
    holdSpinnerEl.classList.remove('visible');
    setTimeout(() => {
      if (holdSpinnerEl && !holdSpinnerEl.classList.contains('visible')) {
        holdSpinnerEl.style.display = 'none';
        const ringEl = holdSpinnerEl.querySelector('.spinner-ring');
        if (ringEl) ringEl.style.strokeDashoffset = String(SPINNER_CIRCUMFERENCE);
      }
    }, 200);
  }

  function isPressing() { return pressState !== null; }

  window.WareraPress = { init, initPressToCapture, cancelPress, isPressing };
})();
