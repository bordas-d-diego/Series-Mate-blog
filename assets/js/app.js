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
     3. Enlaces del índice (href="#..."): scroll suave + foco en el destino
        TAREA T04: al pulsar una ancla se hace scrollIntoView suave y luego
        se pone el foco en la sección destino para accesibilidad.
     ------------------------------------------------------------------ */
  document.addEventListener('click', function (ev) {
    var enlace = ev.target.closest ? ev.target.closest('a[href^="#"]') : null;
    if (!enlace) return;

    var hash = enlace.getAttribute('href');
    if (!hash || hash === '#') return;

    var destino;
    try {
      destino = document.querySelector(hash);
    } catch (e) {
      return; // hash no válido como selector: dejar el comportamiento nativo
    }
    if (!destino) return;

    ev.preventDefault();

    // Preparar el destino para poder recibir el foco por JavaScript.
    if (!destino.hasAttribute('tabindex')) {
      destino.setAttribute('tabindex', '-1');
    }

    destino.scrollIntoView({ behavior: 'smooth', block: 'start' });
    destino.focus({ preventScroll: true });

    // Al navegar desde el dropdown del indice, se cierra en celular.
    cerrarIndiceMovil();

    // Actualizar la URL sin disparar un salto adicional.
    if (history.pushState) history.pushState(null, '', hash);
  });

  /* ------------------------------------------------------------------
     3.b Dropdown del indice compacto en celular (TAREA T05)
         Bajo max-width: 640px el indice es un boton que despliega la
         lista; aqui esta su comportamiento y su cierre con Escape o al
         pulsar fuera.
     ------------------------------------------------------------------ */
  var botonIndice = document.getElementById('indiceInterruptor');
  var listaIndice = document.getElementById('indiceLista');

  function esMovilIndice() { return window.matchMedia('(max-width: 640px)').matches; }

  function aplicarIndice(abierto) {
    if (!botonIndice || !listaIndice) return;
    botonIndice.setAttribute('aria-expanded', String(abierto));
    botonIndice.setAttribute('aria-label', abierto ? 'Cerrar el índice de la página'
                                                   : 'Abrir el índice de la página');
    listaIndice.hidden = !abierto;
  }

  function cerrarIndiceMovil() {
    if (esMovilIndice() && botonIndice && listaIndice && !listaIndice.hidden) {
      aplicarIndice(false);
    }
  }

  if (botonIndice && listaIndice) {
    // En pantalla grande la lista siempre esta visible (fila con scroll).
    aplicarIndice(esMovilIndice() ? false : true);

    botonIndice.addEventListener('click', function () {
      aplicarIndice(botonIndice.getAttribute('aria-expanded') !== 'true');
    });

    document.addEventListener('click', function (ev) {
      if (!esMovilIndice() || listaIndice.hidden) return;
      if (listaIndice.contains(ev.target) || botonIndice.contains(ev.target)) return;
      aplicarIndice(false);
    });

    document.addEventListener('keydown', function (ev) {
      if (ev.key === 'Escape' && !listaIndice.hidden) {
        aplicarIndice(false);
        botonIndice.focus();
      }
    });

    window.matchMedia('(max-width: 640px)').addEventListener('change', function (e) {
      aplicarIndice(!e.matches);
    });
  }

  /* ------------------------------------------------------------------
     3.c Seccion activa en el indice y barra de progreso de lectura
         TAREA T06: un IntersectionObserver con rootMargin que coincide
         con la cabecera pegajosa (recorta los 64px de arriba y deja una
         banda fina en la parte inferior). El enlace correspondiente
         recibe la clase .activo; los demas lo pierden. Para evitar
         saltos y parpadeos: (a) se observa el tramo [h2, siguiente h2]
         de cada seccion, no la seccion entera, y (b) si ninguna banda
         esta visible (hueco entre dos secciones) se mantiene la ultima
         marca en lugar de dejar el indice sin resaltar.
     ------------------------------------------------------------------ */
  var indice = document.querySelector('.hist__indice');

  if (indice && 'IntersectionObserver' in window) {
    var enlacesIndice = [].slice.call(indice.querySelectorAll('ol a[href^="#"]'));
    // Mapa destino -> enlace del indice.
    var mapaEnlaces = {};
    enlacesIndice.forEach(function (enlace) {
      try {
        var d = document.querySelector(enlace.getAttribute('href'));
        if (d) mapaEnlaces[d.id] = enlace;
      } catch (e) { /* hash no valido como selector: se ignora */ }
    });

    // Banda de observacion: desde el titulo de la seccion hasta el titulo
    // de la siguiente. Asi solo una puede estar en la banda a la vez.
    var bandas = [];
    Object.keys(mapaEnlaces).forEach(function (id) {
      var destino = document.getElementById(id);
      if (!destino) return;
      var inicio = destino.matches('h2, h3') ? destino
               : destino.querySelector('h2, h3') || destino;
      var fin = null;
      var todos = [].slice.call(document.querySelectorAll('main h2'));
      var posicion = todos.indexOf(inicio);
      if (posicion > -1 && posicion < todos.length - 1) fin = todos[posicion + 1];
      bandas.push({ id: id, inicio: inicio, fin: fin });
    });

    var activoActual = null;
    function marcarActivo(id) {
      if (id === activoActual) return;          // sin parpadeo: solo cambia si cambia
      var anterior = activoActual && mapaEnlaces[activoActual];
      if (anterior) {
        anterior.classList.remove('activo');
        anterior.removeAttribute('aria-current');
      }
      activoActual = id;
      if (id && mapaEnlaces[id]) {
        mapaEnlaces[id].classList.add('activo');
        mapaEnlaces[id].setAttribute('aria-current', 'true');
      }
    }

    var obsSecciones = new IntersectionObserver(function () {
      // Franja de lectura: debajo de la cabecera (64px) y por encima de los
      // ultimos ~20% de la ventana. La seccion cuyo tramo la cruza es la activa.
      var franjaSuperior = 64;   // --nav-h: coincide con el rootMargin del observer
      var franjaInferior = Math.max(franjaSuperior + 1, window.innerHeight * 0.8);
      var mejor = null, mejorDistancia = Infinity;
      bandas.forEach(function (banda) {
        var top = banda.inicio.getBoundingClientRect().top;
        var bottom = banda.fin ? banda.fin.getBoundingClientRect().top
                               : document.body.scrollHeight;
        var solape = Math.min(bottom, franjaInferior) - Math.max(top, franjaSuperior);
        if (solape > 0) {
          // Si varias cruzan la franja (secciones muy cortas), gana la mas alta.
          var prioridad = top - franjaSuperior;
          if (prioridad < mejorDistancia) { mejorDistancia = prioridad; mejor = banda.id; }
        }
      });
      // Sin huecos ni saltos: si ninguna banda cruza la franja se conserva la
      // ultima seccion marcada.
      if (mejor) marcarActivo(mejor);

      // La barra de progreso comparte este bucle: el navegador ya convoca el
      // callback en los cambios de interseccion, asi que no hace falta otro
      // listener de scroll para ella.
      actualizarProgreso();
    }, {
      // rootMargin igual a la altura de la cabecera pegajosa: la banda activa
      // queda entre -64px arriba y -80% abajo, como pide el plan. Las dos
      // margenes laterales van puestas para que el valor sea exacto.
      rootMargin: '-64px 0px -80% 0px',
      threshold: 0
    });

    bandas.forEach(function (banda) { obsSecciones.observe(banda.inicio); });

    // Estado inicial correcto al cargar (por ejemplo con #ancla en la URL).
    marcarActivo(location.hash && location.hash.slice(1) !== ''
                 && mapaEnlaces[location.hash.slice(1)] ? location.hash.slice(1) : null);
    if (!activoActual && bandas.length) marcarActivo(bandas[0].id);
  }

  /* Barra de progreso de lectura (TAREA T06): rellena el riel fino que
     historia.css pone sobre el canto de abajo de la cabecera. Trabaja con
     scrollY, que el observer no mira, asi que lleva su propio listener
     pasivo; el callback del observer la refresca tambien cuando cambia la
     seccion activa. */
  var barraProgreso = document.querySelector('.hist__progreso > span');
  function actualizarProgreso() {
    if (!barraProgreso) return;
    var total = document.documentElement.scrollHeight - window.innerHeight;
    var fraccion = total > 0 ? Math.min(window.scrollY / total, 1) : 0;
    barraProgreso.style.width = (fraccion * 100).toFixed(2) + '%';
  }
  if (barraProgreso) {
    actualizarProgreso();
    window.addEventListener('scroll', actualizarProgreso, { passive: true });
    window.addEventListener('resize', actualizarProgreso, { passive: true });
  }

  /* ------------------------------------------------------------------
     4. Aparición suave de los elementos al entrar en pantalla
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