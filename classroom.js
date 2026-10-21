(function () {
  'use strict';

  // ==========================================
  // 1. CONFIGURACIÓN DE GUÍAS
  // Cambia los "src" por las rutas reales de tus imágenes.
  // ==========================================
  const TOPICS = {
    'modo-war': {
      title: 'Modo War',
      // Versión optimizada (2000 px de ancho). El PNG original se conserva:
      // guias/Guia War.png
      src: 'guias/guia-war.jpg'
    },
    'builds': {
      title: 'Builds',
      // Versión optimizada (2000 px de ancho). El PNG original se conserva:
      // guias/Guia Builds.png
      src: 'guias/guia-builds.jpg'
    }
  };

  // ==========================================
  // 2. LÓGICA DEL VISOR
  // ==========================================
  const topicBtns = document.querySelectorAll('.topic-btn');
  const viewerTitle = document.getElementById('viewerTitle');
  const guideImage = document.getElementById('guideImage');
  const loadingSpinner = document.getElementById('loadingSpinner');

  function loadTopic(topicId) {
    const topic = TOPICS[topicId];
    if (!topic) return;

    // Actualizar UI
    topicBtns.forEach(btn => btn.classList.remove('active'));
    document.querySelector(`.topic-btn[data-topic="${topicId}"]`).classList.add('active');
    
    viewerTitle.textContent = topic.title;
    
    // Mostrar spinner y ocultar imagen vieja (reseteando un error anterior)
    guideImage.style.display = 'none';
    loadingSpinner.hidden = false;
    loadingSpinner.textContent = 'Cargando imagen...';
    loadingSpinner.style.color = '';

    // Cargar nueva imagen
    guideImage.alt = `Guía: ${topic.title}`;
    guideImage.src = topic.src;
    
    guideImage.onload = () => {
      loadingSpinner.hidden = true;
      guideImage.style.display = 'block';
    };

    guideImage.onerror = () => {
      loadingSpinner.textContent = 'Error al cargar la imagen. Verifica la ruta.';
      loadingSpinner.style.color = '#ef4444';
      guideImage.style.display = 'none';
    };
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
          // Ya estamos en classroom, solo cerramos el menú
          closeSwitcher();
        }
      });
    });
  }

})();