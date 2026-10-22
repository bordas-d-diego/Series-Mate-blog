/* ==========================================================================
   COMPORTAMIENTO GENERAL DEL SITIO
   Menú de celular, línea de la barra al bajar y aparición al hacer scroll.
   Se carga en todas las páginas.
   ========================================================================== */
(function () {
  'use strict';

  /* ------------------------------------------------------------------
     1. Menú de navegación en celular
     ------------------------------------------------------------------ */
  var boton = document.getElementById('navInterruptor');
  var menu = document.getElementById('navMenu');

  if (boton && menu) {
    var esMovil = function () { return window.matchMedia('(max-width: 900px)').matches; };

    function aplicar(abierto) {
      boton.setAttribute('aria-expanded', String(abierto));
      boton.setAttribute('aria-label', abierto ? 'Cerrar el menú' : 'Abrir el menú');
      menu.hidden = !abierto;
    }

    // En computadora el menú siempre está abierto
    aplicar(!esMovil());

    boton.addEventListener('click', function () {
      aplicar(boton.getAttribute('aria-expanded') !== 'true');
    });

    document.addEventListener('click', function (ev) {
      if (!esMovil() || menu.hidden) return;
      if (menu.contains(ev.target) || boton.contains(ev.target)) return;
      aplicar(false);
    });

    document.addEventListener('keydown', function (ev) {
      if (ev.key === 'Escape' && !menu.hidden) {
        aplicar(false);
        boton.focus();
      }
    });

    window.matchMedia('(max-width: 900px)').addEventListener('change', function (e) {
      aplicar(!e.matches);
    });
  }

  /* ------------------------------------------------------------------
     2. Línea bajo la barra al bajar
     ------------------------------------------------------------------ */
  var nav = document.getElementById('nav');
  if (nav) {
    var marcar = function () {
      nav.classList.toggle('is-stuck', window.scrollY > 8);
    };
    marcar();
    window.addEventListener('scroll', marcar, { passive: true });
  }

  /* ------------------------------------------------------------------
     3. Aparición suave de los elementos al entrar en pantalla
     ------------------------------------------------------------------ */
  var revelables = document.querySelectorAll('.aparece');

  if (!revelables.length) return;

  if (!('IntersectionObserver' in window)) {
    for (var a = 0; a < revelables.length; a++) revelables[a].classList.add('es-visible');
    return;
  }

  var obs = new IntersectionObserver(function (entradas) {
    entradas.forEach(function (e) {
      if (!e.isIntersecting) return;
      e.target.classList.add('es-visible');
      obs.unobserve(e.target);
    });
  }, { rootMargin: '0px 0px -8% 0px', threshold: 0.12 });

  for (var i = 0; i < revelables.length; i++) {
    revelables[i].style.transitionDelay = ((i % 4) * 70) + 'ms';
    obs.observe(revelables[i]);
  }
})();