/* ==========================================================================
   HISTORIA — EL JAVASCRIPT DE LOS DIEZ COMPONENTES NUEVOS
   --------------------------------------------------------------------------
   Carga despues de app.js y solo se ocupa de lo que de verdad necesita
   scripting. Lo demas (tabla, formula, grafica, linea de tiempo, comparador,
   notas, cita, lamina y termino) es HTML y CSS y funciona con el JavaScript
   apagado.

   Aqui no hay un segundo sistema de aparicion al hacer scroll: eso ya lo
   hace app.js con la clase .aparece. Solo se aprovechan sus dos ideas: un
   IntersectionObserver con la misma comprobacion de disponibilidad, y
   listeners de scroll pasivos.
   ========================================================================== */
(function () {
  'use strict';

  /* ------------------------------------------------------------------
     1. LA BARRA DE PROGRESO DE LECTURA
     Mide sobre el alto real del documento en cada golpe y no sobre uno
     guardado al cargar: las paginas largas usan content-visibility, asi que
     el alto total cambia mientras se van dibujando las secciones.
     ------------------------------------------------------------------ */
  var relleno = document.querySelector('.hist__progreso > span');

  function medirProgreso() {
    var recorrido = document.documentElement.scrollHeight - window.innerHeight;

    // Sin recorrido no hay nada que recorrer: la pagina esta leida entera.
    if (recorrido <= 0) {
      relleno.style.width = '100%';
      return;
    }

    var avance = Math.min(1, Math.max(0, window.scrollY / recorrido));
    relleno.style.width = (avance * 100).toFixed(2) + '%';
  }

  /* Un golpe de scroll por fotograma, como mucho. */
  var medidorPedido = false;
  function pedirMedida() {
    if (medidorPedido) return;
    medidorPedido = true;
    window.requestAnimationFrame(function () {
      medidorPedido = false;
      medirProgreso();
    });
  }

  if (relleno) {
    medirProgreso();
    window.addEventListener('scroll', pedirMedida, { passive: true });
    window.addEventListener('resize', pedirMedida);
  }

  /* ------------------------------------------------------------------
     2. LA SECCION ACTIVA DEL INDICE
     Se observa con una franja fina en la parte alta de la ventana. Cuando
     una seccion sale de la franja no se marca nada, de modo que al bajar al
     pie la ultima seccion sigue siendo la activa en vez de perderse.

     Si el navegador no tiene IntersectionObserver, el indice se queda sin
     marcar y no se rompe nada: sigue siendo una lista de enlaces.
     ------------------------------------------------------------------ */
  var indice = document.querySelector('.hist__indice');

  if (indice && 'IntersectionObserver' in window) {
    var destinos = [];

    var enlaces = indice.querySelectorAll('a[href^="#"]');
    for (var i = 0; i < enlaces.length; i++) {
      var seccion = document.getElementById(enlaces[i].getAttribute('href').slice(1));
      if (seccion) destinos.push({ enlace: enlaces[i], seccion: seccion });
    }

    var marcar = function (activa) {
      for (var j = 0; j < destinos.length; j++) {
        if (destinos[j].seccion === activa) {
          destinos[j].enlace.setAttribute('aria-current', 'true');
        } else {
          destinos[j].enlace.removeAttribute('aria-current');
        }
      }
    };

    if (destinos.length) {
      var observador = new IntersectionObserver(function (entradas) {
        for (var k = 0; k < entradas.length; k++) {
          if (entradas[k].isIntersecting) marcar(entradas[k].target);
        }
      }, { rootMargin: '-20% 0px -70% 0px', threshold: 0 });

      for (var m = 0; m < destinos.length; m++) observador.observe(destinos[m].seccion);
    }
  }

  /* ------------------------------------------------------------------
     3. LA TABLA QUE SE DESPLAZA
     Un contenedor con desplazamiento horizontal no se puede recorrer con el
     teclado por si solo. Se marca como region y recibe el foco solo cuando de
     verdad hay algo fuera: un tabulador de mas en una tabla que cabe es ruido.
     ------------------------------------------------------------------ */
  var cajas = document.querySelectorAll('.hist__tabla');

  var ajustarCaja = function (caja) {
    if (caja.scrollWidth > caja.clientWidth + 1) {
      caja.setAttribute('tabindex', '0');
    } else {
      caja.removeAttribute('tabindex');
    }
  };

  for (var t = 0; t < cajas.length; t++) {
    var tabla = cajas[t].querySelector('table');
    if (!tabla) continue;

    var titulo = tabla.querySelector('.hist__tabla-titulo');
    if (titulo && titulo.textContent.trim()) {
      cajas[t].setAttribute('role', 'region');
      cajas[t].setAttribute('aria-label', titulo.textContent.trim());
    }
    ajustarCaja(cajas[t]);
  }

  if (cajas.length) {
    window.addEventListener('resize', function () {
      for (var c = 0; c < cajas.length; c++) ajustarCaja(cajas[c]);
    }, { passive: true });
  }

  /* ------------------------------------------------------------------
     4. LA LAMINA AMPLIABLE
     Si el navegador no tiene <dialog>, el boton y el cuadro sobran: se
     quitan del documento y la imagen se ve igual que las de al lado.
     ------------------------------------------------------------------ */
  var hayDialogo = typeof window.HTMLDialogElement === 'function'
    && typeof window.HTMLDialogElement.prototype.showModal === 'function';

  var montarAmpliable = function (lamina) {
    var boton = lamina.querySelector('.hist__lamina-zoom');
    var cuadro = lamina.querySelector('.hist__lamina-dialogo');
    if (!boton || !cuadro) return;

    if (!hayDialogo) {
      boton.remove();
      cuadro.remove();
      return;
    }

    var original = lamina.querySelector('img');
    var copia = cuadro.querySelector('.hist__lamina-amplia');
    var cerrar = cuadro.querySelector('.hist__lamina-cerrar');

    boton.addEventListener('click', function () {
      if (!original || !copia || cuadro.open) return;
      copia.src = original.currentSrc || original.src;
      copia.alt = original.alt;
      cuadro.showModal();
    });

    if (cerrar) {
      cerrar.addEventListener('click', function () { cuadro.close(); });
    }

    /* El Escape ya lo cierra el navegador. Este es el clic en el velo. */
    cuadro.addEventListener('click', function (ev) {
      if (ev.target === cuadro) cuadro.close();
    });
  };

  var laminas = document.querySelectorAll('.hist__lamina--ampliable');
  for (var l = 0; l < laminas.length; l++) montarAmpliable(laminas[l]);
})();