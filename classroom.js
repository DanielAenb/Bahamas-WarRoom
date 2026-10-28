(function () {
  'use strict';

  // ==========================================
  // 1. CONFIGURACIÓN DE GUÍAS
  // ==========================================
  const TOPICS = {
    'modo-war': {
      title: 'Modo War',
      type: 'image',
      // Enlace RAW de GitHub (reemplaza la rama y el hash si es necesario)
      src: 'https://raw.githubusercontent.com/DanielAenb/Bahamas-WarRoom/ab5514767704368cc2739ab0ede3995d2fa3ef4b/guias/Guia%20War.png',
      // Fallback: enlace de Imgur (álbum, puede no funcionar como imagen directa)
      fallback: 'https://imgur.com/a/e92kqhP'
    },
    'builds': {
      title: 'Builds',
      type: 'image',
      // Enlace RAW de GitHub
      src: 'https://raw.githubusercontent.com/DanielAenb/Bahamas-WarRoom/ab5514767704368cc2739ab0ede3995d2fa3ef4b/guias/Guia%20Builds.png',
      // Fallback: enlace de Imgur
      fallback: 'https://imgur.com/a/8aUMcow'
    },
    'workforce': {
      title: 'WorkForce v0.27',
      type: 'html'
    }
  };

  // ==========================================
  // 2. LÓGICA DEL VISOR
  // ==========================================
  const topicBtns = document.querySelectorAll('.topic-btn');
  const viewerTitle = document.getElementById('viewerTitle');
  const imageContainer = document.getElementById('imageContainer');
  const guideImage = document.getElementById('guideImage');
  const loadingSpinner = document.getElementById('loadingSpinner');
  const workforceContent = document.getElementById('workforceContent');

  let loadSequence = 0;

  function loadTopic(topicId) {
    const topic = TOPICS[topicId];
    if (!topic) return;

    // Actualizar UI
    topicBtns.forEach(btn => btn.classList.remove('active'));
    const activeBtn = document.querySelector(`.topic-btn[data-topic="${topicId}"]`);
    if (activeBtn) activeBtn.classList.add('active');

    viewerTitle.textContent = topic.title;

    const isHtml = topic.type === 'html';
    if (imageContainer) imageContainer.hidden = isHtml;
    if (workforceContent) workforceContent.hidden = !isHtml;

    if (isHtml) {
      if (workforceContent && window.WareraWorkforce) {
        window.WareraWorkforce.render(workforceContent);
      }
      return;
    }

    // Mostrar spinner y ocultar imagen vieja
    guideImage.style.display = 'none';
    loadingSpinner.hidden = false;
    loadingSpinner.textContent = 'Cargando imagen...';
    loadingSpinner.style.color = '';

    const loadToken = ++loadSequence;
    let usingFallback = false;

    guideImage.alt = `Guía: ${topic.title}`;

    guideImage.onload = () => {
      if (loadToken !== loadSequence) return;
      loadingSpinner.hidden = true;
      guideImage.style.display = 'block';
    };

    guideImage.onerror = () => {
      if (loadToken !== loadSequence) return;

      if (!usingFallback && topic.fallback) {
        usingFallback = true;
        loadingSpinner.textContent = 'Cargando versión online...';
        guideImage.src = topic.fallback;
        return;
      }

      loadingSpinner.textContent = 'Error al cargar la imagen. Verifica la ruta.';
      loadingSpinner.style.color = '#ef4444';
      guideImage.style.display = 'none';
    };

    guideImage.src = topic.src;
  }

  // Eventos de los botones
  topicBtns.forEach(btn => {
    btn.addEventListener('click', () => loadTopic(btn.dataset.topic));
  });

  // Cargar el primer tema por defecto
  loadTopic('modo-war');

  // ==========================================
  // 3. APP SWITCHER (Menú Flotante)
  // ==========================================
  const appSwitcherTrigger = document.getElementById('appSwitcherTrigger');
  const appSwitcherOverlay = document.getElementById('appSwitcherOverlay');
  const appSwitcherMenu = document.getElementById('appSwitcherMenu');
  const closeSwitcherBtn = document.getElementById('closeSwitcherBtn');

  if (appSwitcherTrigger && appSwitcherOverlay && appSwitcherMenu && closeSwitcherBtn) {
    const openSwitcher = () => {
      appSwitcherOverlay.hidden = false;
      appSwitcherMenu.hidden = false;
      appSwitcherTrigger.setAttribute('aria-expanded', 'true');
      requestAnimationFrame(() => {
        appSwitcherOverlay.classList.add('show');
        appSwitcherMenu.classList.add('show');
      });
      closeSwitcherBtn.focus();
    };

    const closeSwitcher = () => {
      if (appSwitcherMenu.hidden) return;
      appSwitcherTrigger.setAttribute('aria-expanded', 'false');
      appSwitcherOverlay.classList.remove('show');
      appSwitcherMenu.classList.remove('show');
      setTimeout(() => {
        appSwitcherOverlay.hidden = true;
        appSwitcherMenu.hidden = true;
      }, 250);
      appSwitcherTrigger.focus();
    };

    appSwitcherTrigger.addEventListener('click', openSwitcher);
    appSwitcherTrigger.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        openSwitcher();
      }
    });
    closeSwitcherBtn.addEventListener('click', closeSwitcher);
    appSwitcherOverlay.addEventListener('click', closeSwitcher);

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !appSwitcherMenu.hidden) closeSwitcher();
    });

    document.querySelectorAll('.app-switcher-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const target = btn.dataset.target;
        
        if (target === 'warroom') {
          window.location.href = 'index.html';
        } else if (target === 'classroom') {
          closeSwitcher();
        }
      });
    });
  }

})();
