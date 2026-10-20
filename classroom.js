(function () {
  'use strict';

  // ==========================================
  // 1. CONFIGURACIÓN DE GUÍAS
  // Cambia los "src" por las rutas reales de tus imágenes.
  // ==========================================
  const TOPICS = {
    'modo-war': {
      title: 'Modo War',
      src: 'guias/Guia War.png' // <-- Pon aquí tu imagen de Modo War
    },
    'builds': {
      title: 'Builds',
      src: 'guias/Guia Builds.png'   // <-- Pon aquí tu imagen de Builds
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
    
    // Mostrar spinner y ocultar imagen vieja
    guideImage.style.display = 'none';
    loadingSpinner.hidden = false;

    // Cargar nueva imagen
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

  if (appSwitcherTrigger && appSwitcherOverlay && appSwitcherMenu) {
    const openSwitcher = () => {
      appSwitcherOverlay.hidden = false;
      appSwitcherMenu.hidden = false;
      requestAnimationFrame(() => {
        appSwitcherOverlay.classList.add('show');
        appSwitcherMenu.classList.add('show');
      });
    };

    const closeSwitcher = () => {
      appSwitcherOverlay.classList.remove('show');
      appSwitcherMenu.classList.remove('show');
      setTimeout(() => {
        appSwitcherOverlay.hidden = true;
        appSwitcherMenu.hidden = true;
      }, 250);
    };

    appSwitcherTrigger.addEventListener('click', openSwitcher);
    closeSwitcherBtn.addEventListener('click', closeSwitcher);
    appSwitcherOverlay.addEventListener('click', closeSwitcher);

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