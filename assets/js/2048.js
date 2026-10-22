/* ==========================================================================
   2048 - motor del juego
   --------------------------------------------------------------------------
   Aqui es donde vive la serie. No hay una formula escrita en ninguna parte:
   la serie esta en las dos lineas que hacen todo el trabajo.

     valor de la ficha siguiente = valor de la ficha actual * 2
     puntuacion += valor de la ficha recien formada

   La primera produce 2, 4, 8, 16, 32... hasta 2048. La segunda va sumando
   esos mismos numeros uno a uno. Quien juega no ve ninguna de las dos
   lineas; solo ve fichas que se juntan y un marcador que sube.
   ========================================================================== */

(function () {
  'use strict';

  var LADO = 5;

  /* Cuatro fases: 128, 512, 1024, 2048. */
  var RONDAS = [
    { meta: 128,  lema: 'Une parejas hasta fabricar la ficha de 128.' },
    { meta: 512,  lema: 'El tablero se esta llenando. Ahora llega a 512.' },
    { meta: 1024, lema: 'Quedan dos. Llega a 1024 sin quedarte sin sitio.' },
    { meta: 2048, lema: 'La ultima: la ficha de 2048, la que da nombre al juego.' }
  ];

  /* Las estrellas se cuentan por movimientos. */
  var ESTRELLAS = [
    { tres: 110,  dos: 160 },
    { tres: 350,  dos: 520 },
    { tres: 600,  dos: 780 },
    { tres: 1050, dos: 1400 }
  ];

  var NOMBRES = { izq: 'izquierda', der: 'derecha', arr: 'arriba', abo: 'abajo' };

  var estado = {
    ronda: 0,
    fichas: [],
    puntos: 0,
    movimientos: 0,
    terminado: false,
    entero: false,
    finalizado: false,
    estrellas: [0, 0, 0, 0],
    vidas: 3,
    cadena: 0,
    pidePista: false,
    /* Los ids de las fichas que salieron de la ultima fusion. Se quedan con
       un aro hasta que vuelva a haber una fusion: el tablero no dice que
       acaba de pasar y esto si. */
    marcadas: {}
  };

  var siguienteId = 1;
  var nodos = {};
  /* Momento en el que se vuelve a admitir otra jugada. Es un reloj y no un
     contador de animaciones: si la pestaña pasa a segundo plano, el
     navegador congela los temporizadores y un contador se quedaría arriba
     para siempre, dejando el juego bloqueado. Con el reloj no hay nada
     que pueda quedar colgado. */
  var bloqueadoHasta = 0;
  var temporizadorVida = 0;
  var faseEnProceso = false;

  /* Fichas que ya no existen en el juego pero siguen en la pantalla
     desvaneciendose: id -> { nodo, expira }. */
  var salientes = {};
  /* Una sola jugada pendiente, no una cola: la ultima pulsacion que llego
     mientras el tablero se movia. */
  var jugadaEnCola = null;
  var temporizadorCola = 0;
  /* Los puntos del ultimo pintado, para saber cuanto suben. */
  var puntosPintados = 0;

  function $(id) { return document.getElementById(id); }

  /* ------------------------------------------------------------- tablero */

  function nuevaFicha(i, j, valor, nueva) {
    return { id: siguienteId++, i: i, j: j, valor: valor, nueva: !!nueva };
  }

  function valorEn(fichas, i, j) {
    for (var n = 0; n < fichas.length; n++) {
      if (fichas[n].i === i && fichas[n].j === j) { return fichas[n]; }
    }
    return null;
  }

  /* Las cinco lineas de la direccion indicada, ordenadas de la esquina hacia
     la que se desliza. Asi el movimiento es siempre el mismo codigo y solo
     cambian las coordenadas que se leen. */
  function lineasDe(dir) {
    var lineas = [];
    for (var n = 0; n < LADO; n++) {
      var linea = [];
      for (var k = 0; k < LADO; k++) {
        if (dir === 'izq')      { linea.push({ i: k, j: n }); }
        else if (dir === 'der') { linea.push({ i: LADO - 1 - k, j: n }); }
        else if (dir === 'arr') { linea.push({ i: n, j: k }); }
        else                    { linea.push({ i: n, j: LADO - 1 - k }); }
      }
      lineas.push(linea);
    }
    return lineas;
  }

  /* El movimiento completo sobre una lista de fichas. Devuelve las fichas
     nuevas, cuantos puntos sumo el deslizamiento y si cambio algo. */
  function desplazar(fichas, dir) {
    var porId = {};
    var n;
    for (n = 0; n < fichas.length; n++) { porId[fichas[n].id] = fichas[n]; }

    var salida = [];
    var puntos = 0;
    var cambio = false;
    var lineas = lineasDe(dir);
    /* Los ids de las fichas que salen de una fusion. */
    var resultados = [];
    /* La ficha mas grande que ha salido de una fusion en este movimiento, o
       cero si no se ha juntado ninguna. La necesita el patron de vibracion:
       lo que vibra es la ficha que se acaba de formar, no la que mas grande
       hubiera en el tablero, que puede llevar manyas jugadas sin juntarse. */
    var fusionMayor = 0;

    for (var n2 = 0; n2 < LADO; n2++) {
      var pos = lineas[n2];
      var ocupadas = [];
      for (var k = 0; k < LADO; k++) {
        var f = valorEn(fichas, pos[k].i, pos[k].j);
        if (f) { ocupadas.push(f); }
      }

      /* aqui esta la serie, parte 1: dos fichas iguales hacen una del doble */
      var nuevaLinea = [];
      var p = 0;
      var sumadas = [];
      while (p < ocupadas.length) {
        if (p + 1 < ocupadas.length && ocupadas[p].valor === ocupadas[p + 1].valor) {
          var idResultante = Math.max(ocupadas[p].id, ocupadas[p + 1].id);
          nuevaLinea.push({
            id: idResultante,
            valor: ocupadas[p].valor * 2,
            absorbe: [ocupadas[p].id, ocupadas[p + 1].id],
            sumada: true
          });
          /* y aqui la parte 2: el marcador suma lo recien formado */
          puntos += ocupadas[p].valor * 2;
          if (ocupadas[p].valor * 2 > fusionMayor) { fusionMayor = ocupadas[p].valor * 2; }
          sumadas.push(ocupadas[p].id, ocupadas[p + 1].id);
          /* Los ids de las fichas nuevas, que son las que llevan el aro. */
          resultados.push(idResultante);
          p += 2;
        } else {
          nuevaLinea.push({
            id: ocupadas[p].id,
            valor: ocupadas[p].valor,
            absorbe: [ocupadas[p].id],
            sumada: false
          });
          p += 1;
        }
      }

      for (var m = 0; m < nuevaLinea.length; m++) {
        var s = nuevaLinea[m];
        var antes = porId[s.id];
        if (antes.i !== pos[m].i || antes.j !== pos[m].j || s.sumada) { cambio = true; }
        salida.push({ id: s.id, i: pos[m].i, j: pos[m].j, valor: s.valor, sumada: s.sumada, absorbe: s.absorbe });
      }
    }

    return { fichas: salida, puntos: puntos, cambio: cambio, sumadas: sumadas, resultados: resultados, fusionMayor: fusionMayor };
  }

  function casillaLibre(fichas) {
    var libres = [];
    for (var j = 0; j < LADO; j++) {
      for (var i = 0; i < LADO; i++) {
        if (!valorEn(fichas, i, j)) { libres.push({ i: i, j: j }); }
      }
    }
    return libres;
  }

  function ponerAleatoria(fichas) {
    var libres = casillaLibre(fichas);
    if (!libres.length) { return fichas; }
    var elegida = libres[Math.floor(Math.random() * libres.length)];
    /* casi siempre un 2: es lo que hace el juego original y evita que se
       dispare la serie sin que el jugador haya juntado nada */
    var valor = Math.random() < 0.9 ? 2 : 4;
    fichas.push(nuevaFicha(elegida.i, elegida.j, valor, true));
    return fichas;
  }

  /* ------------------------------------------------------------- estados */

  function mayor() {
    var m = 0;
    for (var n = 0; n < estado.fichas.length; n++) {
      if (estado.fichas[n].valor > m) { m = estado.fichas[n].valor; }
    }
    return m;
  }

  function puedeMover() {
    if (casillaLibre(estado.fichas).length) { return true; }
    for (var n = 0; n < LADO; n++) {
      for (var k = 0; k < LADO; k++) {
        var a = valorEn(estado.fichas, k, n);
        var b = valorEn(estado.fichas, k + 1, n);
        var c = valorEn(estado.fichas, k, n + 1);
        if (a && b && a.valor === b.valor) { return true; }
        if (a && c && a.valor === c.valor) { return true; }
      }
    }
    return false;
  }

  function estrellasDe(ronda, movimientos) {
    var t = ESTRELLAS[ronda];
    if (movimientos <= t.tres) { return 3; }
    if (movimientos <= t.dos) { return 2; }
    return 1;
  }

  /* ---------------------------------------------------------------- dibujo */

  /* Las clases de animacion se quitan al principio del siguiente pintado, no
     con un setTimeout. Si la pestana pasa a segundo plano, el navegador
     congela los temporizadores y un contador de animaciones se queda
     siempre arriba: el juego se congela y no vuelve. Con el reloj no hay
     nada que se pueda quedar colgado. */
  function pintar() {
    var capa = nodos.fichas;
    var vistos = {};
    var huboAnimacion = false;
    var ahora = Date.now();
    /* Donde acaba cada ficha que se fusiona. La que se absorbe tiene que
       desvanecerse ENCIMA de la que la absorbe, no quedarse atras en la
       casilla de donde venia. */
    var destino = {};

    /* Una ficha que se fue hace rato y sigue en la pantalla: se lleva. Es la
       red de seguridad para cuando el navegador se ha tragado el evento de
       fin de animacion, que es lo que pasa con una pestana oculta. */
    for (var salida in salientes) {
      if (salientes[salida].expira <= ahora) { retirarSaliente(salida); }
    }
    /* Lo mismo con las chispas de la ultima fusion, por si la animacion no
       llegó a dar su evento. */
    barrerChispas(ahora);

    var previas = capa.querySelectorAll('.ficha--nueva, .ficha--sumada, .ficha--marcada');
    for (var q = 0; q < previas.length; q++) {
      previas[q].classList.remove('ficha--nueva');
      previas[q].classList.remove('ficha--sumada');
      previas[q].classList.remove('ficha--marcada');
    }
    /* Los efectos del tablero tampoco se quedan puestos: se caen con el
       pintado siguiente, igual que las clases de las fichas. Sin esto la
       sacudida se acumularia sobre el transform de la anterior. */
    nodos.tablero.classList.remove('dosmil__tablero--sacude', 'dosmil__tablero--asienta');
    nodos.tablero.style.removeProperty('--sacudida');
    nodos.fichas.classList.remove('dosmil__fichas--arranca');

    for (var n = 0; n < estado.fichas.length; n++) {
      var f = estado.fichas[n];
      vistos[f.id] = true;
      var el = nodos.mapa[f.id];
      if (!el) {
        el = document.createElement('div');
        el.className = 'ficha';
        el.innerHTML = '<span class="ficha__caja"></span>';
        capa.appendChild(el);
        nodos.mapa[f.id] = el;
      }
      /* Se apunta antes de apagar la bandera sumada: es el unico momento en
         que se sabe que ficha de este movimiento absorbs a cuales. */
      if (f.sumada) {
        for (var a = 0; a < f.absorbe.length; a++) { destino[f.absorbe[a]] = f; }
      }
      el.style.setProperty('--i', f.i);
      el.style.setProperty('--j', f.j);
      var caja = el.firstChild;
      if (caja.getAttribute('data-v') !== String(f.valor)) {
        var texto = String(f.valor);
        caja.setAttribute('data-v', texto);
        /* Cuantas cifras, para que la caja elija el tamano de letra. */
        caja.setAttribute('data-c', String(texto.length));
        caja.textContent = texto;
      }
      if (estado.marcadas[f.id]) { el.classList.add('ficha--marcada'); }
      /* El trofeo: 2048 o mas. Va en la ficha y no en el tablero, porque es
         esa ficha la que es el objetivo y no el tablero entero. */
      el.classList.toggle('ficha--trofeo', f.valor >= TROFEO);
      if (f.nueva) {
        el.classList.add('ficha--nueva');
        f.nueva = false;
        huboAnimacion = true;
      }
      if (f.sumada) {
        el.classList.add('ficha--sumada');
        f.sumada = false;
        huboAnimacion = true;
        /* De aqui salen la rafaga y, a partir de 128, la sacudida. Las dos
           se piden en el mismo fotograma en que aparece la ficha nueva, que
           es cuando el jugador esta mirando ese sitio. */
        soltarParticulas(el);
        sacudir(f.valor);
      }
    }

    /* La ficha absorbida no se borra en el mismo fotograma de la fusion: se
       queda con la clase de salida y se retira cuando su animacion acaba.
       Sin esto desaparece de golpe y el jugador no ve que se junto con
       nada. */
    for (var id in nodos.mapa) {
      if (vistos[id]) { continue; }
      var saliente = nodos.mapa[id];
      delete nodos.mapa[id];
      if (destino[id]) {
        saliente.style.setProperty('--i', destino[id].i);
        saliente.style.setProperty('--j', destino[id].j);
      }
      saliente.setAttribute('data-saliendo', id);
      saliente.addEventListener('animationend', alTerminarSalida);
      saliente.classList.add('ficha--absorbida');
      salientes[id] = { nodo: saliente, expira: ahora + 320 };
    }

    if (huboAnimacion) { bloqueadoHasta = ahora + 200; }

    pintarMarcador();
  }

  /* La ficha que se va avisa con su propia animacion, no con un reloj: cada
     nodo lleva el manejador puesto en el momento en que se retira, asi que
     el evento solo puede venir de el. No hay forma de que una ficha que ya
     se esta reutilizando se borre por error. */
  function alTerminarSalida(e) {
    if (e.animationName !== 'fichaAbsorbida') { return; }
    retirarSaliente(e.currentTarget.getAttribute('data-saliendo'));
  }

  /* Las dos vias de retirada, el evento y el barrido de pintar(), pasan por
     aqui: un nodo sale una sola vez o ninguna. */
  function retirarSaliente(id) {
    var salida = salientes[id];
    if (!salida) { return; }
    delete salientes[id];
    salida.nodo.removeEventListener('animationend', alTerminarSalida);
    if (salida.nodo.parentNode) { salida.nodo.parentNode.removeChild(salida.nodo); }
  }

  /* Quitar y volver a poner una clase no reinicia su animacion: el motor la
     da por terminada en cuanto ve que el estado no ha cambiado. Medir entre
     las dos operaciones es lo que le hace ver la ausencia y arrancar de
     cero. */
  function repetir(el, clase) {
    el.classList.remove(clase);
    void el.offsetWidth;
    el.classList.add(clase);
  }

  function pintarMarcador() {
    var ronda = RONDAS[estado.ronda];
    var suben = estado.puntos - puntosPintados;
    puntosPintados = estado.puntos;
    nodos.puntos.textContent = estado.puntos;
    if (nodos.puntos2) { nodos.puntos2.textContent = estado.puntos; }
    if (suben > 0) {
      nodos.suma.textContent = '+' + suben;
      repetir(nodos.etiquetaPuntos, 'dosmil__meta--sube');
    }
    nodos.movimientos.textContent = estado.movimientos;
    if (nodos.meta) { nodos.meta.textContent = ronda.meta; }
    nodos.estado.textContent = estado.terminado
      ? (estado.entero ? 'Ronda ganada' : 'Sin jugadas')
      : 'Meta: ' + ronda.meta;
    nodos.estado.classList.toggle('dosmil__estado--lleno', mayor() >= ronda.meta);

    var libres = casillaLibre(estado.fichas).length;
    if (nodos.libres) { nodos.libres.textContent = libres; }
    if (nodos.vidas) { nodos.vidas.textContent = typeof estado.vidas === 'number' ? estado.vidas : 3; }
    if (nodos.cadena) {
      nodos.cadena.textContent = (typeof estado.cadena === 'number' ? estado.cadena : 0) + '/5';
      nodos.cadena.classList.toggle('dosmil__meta--acento', (typeof estado.cadena === 'number' ? estado.cadena : 0) >= 4);
    }
    pintarMarcadorRondas();
  }

  function anunciar(texto) {
    if (nodos.viva.textContent !== texto) { nodos.viva.textContent = texto; }
  }

  /* "1 movimiento" y "2 movimientos": el cierre de ronda se lee en voz alta, y
     suena muy mal si dice "1 movimientos". Es la misma regla que sigue el
     Asteroides, con la misma firma. */
  function plural(n, uno, varios) {
    return n === 1 ? uno : varios;
  }

  /* -------------------------------------------------------------- efectos */
  /* Todo lo que hay de aqui al final de la seccion es adorno sobre una
     logica que ya funciona sin nada de esto. Por eso vive aparte y por eso
     todas las piezas de efecto comparten una sola disciplina: se crean desde
     una unica llamada, avisan de su final con su propia animacion y se
     retiran por un unico sitio, con un barrido de reloj como segunda via
     para cuando el navegador se ha tragado el evento.

     Y hay un unico bucle en toda la pagina, el de paso(), que se para solo
     en cuanto no queda nada que animar. El 2048 es un juego de pensar y una
     rafaga no puede costarle la bateria a nadie. */

  /* La ficha que es trofeo: el objetivo del juego. A partir de aqui la ficha
     late y lleva halo. */
  var TROFEO = 2048;
  /* Cuanto vive el fondo del tablero despues de una jugada. Al acabarse, el
     paso se queda sin nada que hacer y el bucle se apaga solo. */
  var ALIENTO_MS = 700;
  /* Las particulas sueltas por una fusion: nodo -> { nodo, expira }. */
  var particulas = {};
  var siguienteChispa = 1;
  /* Identificador del fotograma pedido. Cero significa que no hay ninguno
     pedido, que es exactamente lo que se publica para poder comprobarlo. */
  var pasoPedido = 0;
  /* Reloj en milisegundos hasta el que el fondo del tablero sigue vivo. */
  var alientoHasta = 0;
  var sinMovimiento = window.matchMedia('(prefers-reduced-motion: reduce)');

  function respetaMovimientoReducido() { return sinMovimiento.matches; }

  /* Cuantas particulas suelta una fusion. El numero crece con el valor de la
     ficha que acaba de salir, en pasos de escala logaritmica porque los
     valores del juego son potencias de dos: un 2 con un 2 se queda en tres y
     un 256 con un 256 suelta las diez. */
  function particulasDe(valor) {
    var n = 1 + Math.round(Math.log(valor) / Math.LN2);
    if (n < 3) { return 3; }
    if (n > 10) { return 10; }
    return n;
  }

  /* El color sale de la ficha, no de una tabla de aqui: se le pregunta al
     navegador por el fondo que tiene puesto ahora mismo, que es la misma
     rampa que esta escrita en la hoja de estilo. Si el motor no devolviera un
     color se devuelve null y la fusion se queda sin particulas, pero con su
     destello y su aro, que son los que dicen que se junto algo. */
  function colorDeCaja(caja) {
    var color = window.getComputedStyle(caja).backgroundColor;
    return /^rgba?\(\s*[\d.]+\s*,\s*[\d.]+\s*,\s*[\d.]+/.test(color) ? color : null;
  }

  function centroEnCapa(capa, el) {
    var caja = el.getBoundingClientRect();
    var capaCaja = capa.getBoundingClientRect();
    return {
      x: caja.left - capaCaja.left + caja.width / 2,
      y: caja.top - capaCaja.top + caja.height / 2,
      lado: caja.width
    };
  }

  /* La rafaga. Sale del centro de la ficha nueva, con su color, y se apaga
     en 400 o 500 ms segun le toque. Devuelve cuantas ha soltado para que se
     pueda comprobar desde fuera. */
  function soltarParticulas(elFicha) {
    if (respetaMovimientoReducido()) { return 0; }
    var caja = elFicha && elFicha.firstChild;
    if (!caja) { return 0; }
    var color = colorDeCaja(caja);
    if (!color) { return 0; }
    var valor = Number(caja.getAttribute('data-v')) || 0;
    if (valor < 4) { return 0; }

    var centro = centroEnCapa(nodos.chispa, elFicha);
    var cuantas = particulasDe(valor);
    /* El alcance tiene que PASAR la ficha, no quedarse debajo: el ancho
       mide la mitad de la casilla, asi que desde 0,55 ya salen por fuera, y
       con la fusion grande llegan a rebasar el canto por el doble. */
    var alcance = centro.lado * (.55 + .07 * (cuantas - 3));
    /* Los angulos se reparten a la redonda con un desvio pequeno. Con angulos
       del todo al azar la rafaga se amontona en un lado y se ve como un
       chorro, no como una explosion. */
    var fase = Math.random() * Math.PI * 2;
    for (var n = 0; n < cuantas; n++) {
      var angulo = fase + n * 2 * Math.PI / cuantas + (Math.random() - .5) * .5;
      var largo = alcance * (.55 + Math.random() * .55);
      crearChispa(centro, color, Math.cos(angulo) * largo, Math.sin(angulo) * largo, valor);
    }
    return cuantas;
  }

  function crearChispa(centro, color, dx, dy, valor) {
    var p = document.createElement('span');
    var id = String(siguienteChispa++);
    var dur = 400 + Math.round(Math.random() * 100);
    p.className = 'chispa';
    p.setAttribute('aria-hidden', 'true');
    p.setAttribute('data-chispa', id);
    p.style.left = centro.x + 'px';
    p.style.top = centro.y + 'px';
    p.style.setProperty('--c', color);
    p.style.setProperty('--dx', dx.toFixed(1) + 'px');
    p.style.setProperty('--dy', dy.toFixed(1) + 'px');
    p.style.setProperty('--tam', (4 + Math.min(valor / 128, 5)).toFixed(1) + 'px');
    p.style.setProperty('--dur', dur + 'ms');
    p.addEventListener('animationend', alTerminarChispa);
    nodos.chispa.appendChild(p);
    particulas[id] = { nodo: p, expira: Date.now() + dur + 160 };
  }

  /* La primera salida de cada chispa es su propia animacion -igual que la
     de la ficha absorbida, y por el mismo motivo: el evento solo puede venir
     del nodo que lleva el manejador-. El barrido de paso() y el de pintar()
     son la segunda via, para cuando el navegador se ha tragado el evento, que
     es lo que pasa con una pestana oculta. */
  function alTerminarChispa(e) {
    if (e.animationName !== 'chispaSale') { return; }
    retirarChispa(e.currentTarget.getAttribute('data-chispa'));
  }

  function retirarChispa(id) {
    var chispa = particulas[id];
    if (!chispa) { return; }
    delete particulas[id];
    chispa.nodo.removeEventListener('animationend', alTerminarChispa);
    if (chispa.nodo.parentNode) { chispa.nodo.parentNode.removeChild(chispa.nodo); }
  }

  function barrerChispas(ahora) {
    for (var id in particulas) {
      if (particulas[id].expira <= ahora) { retirarChispa(id); }
    }
  }

  function vaciarChispas() {
    for (var id in particulas) { retirarChispa(id); }
  }

  /* Cuanto se mueve el tablero. Nada por debajo de 128: si todo tiembla, no
     tiembla nada. A partir de ahi crece con la ficha que se acaba de formar y
     se queda en seis pixeles a partir de 1024. */
  function amplitudDeSacudida(valor) {
    if (valor >= 1024) { return 6; }
    if (valor >= 512) { return 4; }
    if (valor >= 256) { return 3; }
    if (valor >= 128) { return 2; }
    return 0;
  }

  function sacudir(valor) {
    var amplitud = amplitudDeSacudida(valor);
    if (!amplitud || respetaMovimientoReducido()) { return 0; }
    nodos.tablero.style.setProperty('--sacudida', amplitud + 'px');
    efectoTablero('dosmil__tablero--sacude');
    return amplitud;
  }

  /* Solo una clase de efecto en el tablero a la vez: la sacudida y el
     asentamiento se pelearian el transform si coincidieran. */
  function efectoTablero(clase) {
    nodos.tablero.classList.remove('dosmil__tablero--sacude', 'dosmil__tablero--asienta');
    repetir(nodos.tablero, clase);
  }

  /* El arranque de ronda: las dos fichas entran con mas caracter y el tablero
     se asienta. Se quita sola, en el pintado siguiente, sin temporizador. */
  function asentarTablero() {
    if (respetaMovimientoReducido()) { return; }
    efectoTablero('dosmil__tablero--asienta');
    nodos.fichas.classList.add('dosmil__fichas--arranca');
  }

  /* --------------------------------------------------------------- el tacto */
  /* Un patron por evento y ninguno mas. La vibracion no vive en ningun bucle
     ni en ningun temporizador: se pide una vez por jugada, desde el mismo
     sitio que la sacudida y la rafaga, y no hay nada en la pagina que la
     vuelva a pedir sola.

     Por debajo de 64 no vibra nada. Un 2 con un 2 pasa decenas de veces por
     partida y si vibra todo no vibra nada: es la misma regla que la sacudida y
     por el mismo motivo. */
  var PATRONES = {
    fusion64: 8,
    fusion256: 14,
    fusion1024: 20,
    trofeo: [20, 30, 20, 30, 60],
    ronda: [15, 45, 15, 45],
    sinJugadas: [50, 45, 50],
    vidaPerdida: [40, 60, 40],
    vidaExtra: [15, 30, 15, 30]
  };

  /* El ultimo patron pedido, cuantas veces se ha pedido uno y si el aparato ha
     aceptado el patron. Es la superficie de pruebas: sin un movil en la mano,
     esto es lo unico que hay de la vibracion. Ojo al nombre: que el aparato
     acepte el patron no quiere decir que suene. El navegador tambien acepta
     la llamada y la reprime si la pagina no ha sido tocada todavia, y eso no
     se puede ver desde aqui. */
  var ultimaVibracion = { patron: null, llamadas: 0, aceptada: false };

  /* Si el 2048 se ha celebrado ya. Se celebra una sola vez por carga de la
     pagina, la primera, y a partir de ahi una segunda ficha de 2048 vuelve al
     patron de fusion corriente: repetirla cada vez dejaria de significar nada. */
  var trofeoCelebrado = false;
  /* Que el 2048 se ha celebrado en ESTA jugada. El cierre de ronda consulta
     esta bandera antes de mandar su patron. */
  var celebraTrofeoEnEstaJugada = false;

  /* El aparato es lo unico de todo el juego que no esta siempre: no existe en
     el navegador de escritorio, existe en unos Android y en otros no, y alguno
     la lanza si se le pide un patron raro. Si no esta o si falla, se sigue
     jugando igual y sin ruido, porque una molestia tactil no puede ser un
     error. Que pasara o no queda escrito en `aceptada`, que sale por la
     superficie de pruebas. */
  function vibrar(patron) {
    ultimaVibracion.patron = patron;
    ultimaVibracion.llamadas++;
    var aceptada = false;
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      try {
        aceptada = navigator.vibrate(patron) !== false;
      } catch (e) {
        aceptada = false;
      }
    }
    ultimaVibracion.aceptada = aceptada;
    return aceptada;
  }

  /* Que patron lleva una fusion. Por debajo de 64 no hay ninguno. */
  function patronDeFusion(valor) {
    if (valor >= 1024) { return PATRONES.fusion1024; }
    if (valor >= 256) { return PATRONES.fusion256; }
    if (valor >= 64) { return PATRONES.fusion64; }
    return null;
  }

  /* Una sola vibracion por jugada. El aparato vibra una cosa cada vez: dos
     llamadas seguidas en el mismo movimiento hacen que solo se sienta la
     segunda, asi que aqui se decide cual de las tres sale y gana la mas
     grande. Fabricar el 2048 pesa mas que cerrar la ronda, y cerrar la ronda
     pesa mas que la fusion. Devuelve el patron que ha salido, o null. */
  function vibrarJugada(valorFusion, rondaSeCierra) {
    if (valorFusion >= TROFEO && !trofeoCelebrado) {
      trofeoCelebrado = true;
      celebraTrofeoEnEstaJugada = true;
      vibrar(PATRONES.trofeo);
      return PATRONES.trofeo;
    }
    if (rondaSeCierra) { return null; }
    var patron = patronDeFusion(valorFusion);
    if (patron === null) { return null; }
    vibrar(patron);
    return patron;
  }

  /* Lo que se le ha pedido al aparato y si lo ha aceptado. */
  function vibracion() {
    return {
      patron: ultimaVibracion.patron,
      llamadas: ultimaVibracion.llamadas,
      aceptada: ultimaVibracion.aceptada
    };
  }

  /* ------------------------------------------------------------- el pulso */
  /* El unico bucle de la pagina. Arranca cuando hay algo que animar y se para
     solo en cuanto no queda nada: pide un fotograma mas solo si todavia hay
     una chispa en el aire o si al brulo del tablero le queda recorrido. Con
     el movimiento reducido ni se arranca nunca, porque ahi no hay nada que
     animar y porque el bucle no debe gastar bateria en una decoracion que el
     jugador ha pedido no ver. */
  function despertar() {
    if (respetaMovimientoReducido()) { return; }
    alientoHasta = Date.now() + ALIENTO_MS;
    if (pasoPedido) { return; }
    nodos.tablero.classList.add('dosmil__tablero--vivo');
    pasoPedido = requestAnimationFrame(paso);
  }

  /* El valor que mantiene despierto el fondo del tablero: vale 1 mientras
     acaba de pasar algo y baja a cero en ALIENTO_MS. */
  function alientoDe(ahora) {
    var queda = alientoHasta - ahora;
    if (queda <= 0) { return null; }
    if (queda < ALIENTO_MS * .01) { alientoHasta = 0; return '0.00'; }
    return (queda / ALIENTO_MS).toFixed(2);
  }

  function quedanChispas() {
    for (var id in particulas) { return true; }
    return false;
  }

  function paso() {
    pasoPedido = 0;
    var ahora = Date.now();
    barrerChispas(ahora);
    var aliento = alientoDe(ahora);
    if (aliento === null) { nodos.tablero.style.removeProperty('--aliento'); }
    else { nodos.tablero.style.setProperty('--aliento', aliento); }

    /* Nada que dibujar: no se pide otro fotograma y aqui se acaba. */
    if (!quedanChispas() && aliento === null) {
      nodos.tablero.classList.remove('dosmil__tablero--vivo');
      return;
    }
    pasoPedido = requestAnimationFrame(paso);
  }

  /* --------------------------------------------------------------- turnos */

  /* Una pulsacion que llega mientras el tablero se esta moviendo no se tira:
     se guarda y se suelta sola en cuanto el reloj pasa de bloqueadoHasta.
     El temporizador vuelve a mirar el reloj antes de soltar, de modo que una
     pestana en segundo plano lo alarga pero no lo rompe, y limpiar su numero
     antes de armarlo impide soltar dos veces la misma jugada. */
  function programarSuelta(ms) {
    if (temporizadorCola) { clearTimeout(temporizadorCola); }
    temporizadorCola = setTimeout(soltarCola, ms);
  }

  function soltarCola() {
    temporizadorCola = 0;
    if (jugadaEnCola === null) { return; }
    var faltan = bloqueadoHasta - Date.now();
    if (faltan > 0) { programarSuelta(faltan); return; }
    var dir = jugadaEnCola;
    jugadaEnCola = null;
    if (!estado.terminado) { jugar(dir); }
  }

  function vaciarCola() {
    jugadaEnCola = null;
    if (temporizadorCola) { clearTimeout(temporizadorCola); temporizadorCola = 0; }
  }

  function quitarMenores(cuantas) {
    if (!cuantas || cuantas <= 0) { return 0; }
    var lista = estado.fichas.slice();
    lista.sort(function(a,b){ return a.valor - b.valor; });
    var quitar = [];
    for (var i = 0; i < lista.length && quitar.length < cuantas; i++) {
      quitar.push(lista[i].id);
    }
    if (quitar.length === 0) { return 0; }
    var porIdQuitar = {};
    for (var q = 0; q < quitar.length; q++) { porIdQuitar[quitar[q]] = true; }
    var ahora = Date.now();
    var quedan = [];
    for (var f = 0; f < estado.fichas.length; f++) {
      var ficha = estado.fichas[f];
      if (porIdQuitar[ficha.id]) {
        var el = nodos.mapa[ficha.id];
        if (el) {
          delete nodos.mapa[ficha.id];
          el.setAttribute('data-saliendo', ficha.id);
          el.addEventListener('animationend', alTerminarSalida);
          el.classList.add('ficha--absorbida');
          salientes[ficha.id] = { nodo: el, expira: ahora + 320 };
        }
      } else {
        quedan.push(ficha);
      }
    }
    estado.fichas = quedan;
    return quitar.length;
  }

  function perderVidaAhora() {
    if (temporizadorVida) { clearTimeout(temporizadorVida); temporizadorVida = 0; }
    if (estado.terminado || faseEnProceso) { return; }
    if (!puedeMover()) {
      if (typeof estado.vidas !== 'number') { estado.vidas = 3; }
      if (estado.vidas > 1) {
        estado.vidas = estado.vidas - 1;
        quitarMenores(6);
        estado.terminado = false;
        estado.entero = false;
        vaciarCola();
        pintar();
        bloquearHasta(200);
        anunciar('Sin jugadas: pierdes una vida. Te quedan ' + estado.vidas + '.');
        pintarMarcador();
        if (window.d2048Audio && window.d2048Audio.vidaPerdida) { window.d2048Audio.vidaPerdida(); }
        if (typeof vibrar === 'function') { vibrar(PATRONES.vidaPerdida || PATRONES.sinJugadas); }
        return;
      }
      estado.terminado = true;
      estado.entero = false;
      pintar();
      pintarMarcador();
      cerrarRonda('Se acabaron las jugadas del tablero antes de llegar a ' + rondaActual().meta + '.');
    }
  }

  function programarPerdidaVida(ms) {
    if (temporizadorVida) { clearTimeout(temporizadorVida); }
    temporizadorVida = setTimeout(perderVidaAhora, ms || 250);
  }

  function bloquearHasta(ms) {
    bloqueadoHasta = Date.now() + (ms || 0);
  }

  function pintarMarcadorRondas() {
    if (!nodos.marcador) { return; }
    nodos.marcador.innerHTML = '';
    var caja = document.createElement('div');
    caja.className = 'marcador-dots';
    for (var i = 0; i < RONDAS.length; i++) {
      var p = document.createElement('span');
      p.className = 'marcador-dots__punto';
      if (estado.ronda === i && !estado.terminado) { p.className += ' marcador-dots__punto--actual'; }
      if ((estado.estrellas[i] || 0) > 0 || i < estado.ronda) { p.className += ' marcador-dots__punto--ok'; }
      caja.appendChild(p);
    }
    nodos.marcador.appendChild(caja);
  }

  function iniciarAnimacionFase() {
    faseEnProceso = true;
    if (temporizadorVida) { clearTimeout(temporizadorVida); temporizadorVida = 0; }
    vaciarCola();
    bloquearHasta(1500);
    var ronda = rondaActual();
    var meta = ronda.meta;
    var ficha = null;
    for (var i = 0; i < estado.fichas.length; i++) {
      if (estado.fichas[i].valor === meta) { ficha = estado.fichas[i]; break; }
    }
    if (ficha) {
      var el = nodos.mapa[ficha.id];
      if (el) {
        el.classList.add('ficha--fase');
        setTimeout(function() { if (el) { el.classList.remove('ficha--fase'); } }, 950);
      }
    }
    if (nodos.brillo && nodos.tablero) {
      nodos.tablero.classList.add('dosmil__tablero--fasebrillo');
      setTimeout(function() { if (nodos.tablero) { nodos.tablero.classList.remove('dosmil__tablero--fasebrillo'); } }, 650);
    }
    if (nodos.faseHecha && nodos.faseHechaNum) {
      nodos.faseHechaNum.textContent = meta;
      nodos.faseHecha.hidden = false;
      setTimeout(function() {
        if (nodos.faseHecha) { nodos.faseHecha.hidden = true; }
      }, 1500);
    }
    if (!respetaMovimientoReducido() && nodos.confeti) {
      soltarConfeti();
    }
    if (window.d2048Audio && window.d2048Audio.fase) { window.d2048Audio.fase(); }
    if (typeof vibrar === 'function') { vibrar(PATRONES.ronda || [15,45,15,45]); }
    setTimeout(function() {
      faseEnProceso = false;
      var texto = 'Saliste con la ficha de ' + meta + ' en ' +
                  estado.movimientos +
                  plural(estado.movimientos, ' movimiento.', ' movimientos.');
      cerrarRonda(texto);
    }, 1200);
  }

  function soltarConfeti() {
    if (!nodos.confeti) { return; }
    nodos.confeti.innerHTML = '';
    var colores = ['#f0d36b', '#c9e88a', '#2a4fd0', '#c23a42', '#86289e'];
    for (var i = 0; i < 24; i++) {
      var p = document.createElement('span');
      p.className = 'dosmil__confeti-pieza';
      p.style.left = Math.round(Math.random() * 100) + '%';
      p.style.background = colores[i % colores.length];
      p.style.animationDelay = Math.round(Math.random() * 200) + 'ms';
      p.style.transform = 'translateY(0) rotate(' + Math.round(Math.random() * 360) + 'deg)';
      nodos.confeti.appendChild(p);
    }
    setTimeout(function() {
      if (nodos.confeti) { nodos.confeti.innerHTML = ''; }
    }, 1500);
  }

  function jugar(dir) {
    if (window.d2048Audio && window.d2048Audio.ensure) { window.d2048Audio.ensure(); }
    celebraTrofeoEnEstaJugada = false;
    if (estado.terminado || faseEnProceso) { return false; }
    if (NOMBRES[dir] === undefined) { return false; }
    if (Date.now() < bloqueadoHasta) {
      /* Solo la ultima: dos pulsaciones seguidas no son dos jugadas de cola,
         porque la primera se comeria a la segunda y el jugador acabaria
         viendo una jugada menos de las que ha pulsado. */
      jugadaEnCola = dir;
      programarSuelta(bloqueadoHasta - Date.now());
      return false;
    }

    /* Si el tablero ya no tiene jugadas, se maneja con vidas o se cierra la ronda. */
    if (!puedeMover()) {
      bloquearHasta(250);
      programarPerdidaVida(250);
      return true;
    }

    var r = desplazar(estado.fichas, dir);
    if (!r.cambio) {
      anunciar('El tablero no se mueve hacia ' + NOMBRES[dir] + '.');
      if (window.d2048Audio && window.d2048Audio.invalido) { window.d2048Audio.invalido(); }
      return false;
    }

    estado.fichas = r.fichas;
    nodos.tablero.classList.remove('dosmil__tablero--pista');
    delete nodos.tablero.dataset.pista;
    estado.puntos += r.puntos;
    estado.movimientos++;
    /* El aro lo trae la ultima fusion, no la ultima jugada: un
       deslizamiento sin parejas no borra el rastro de lo que se junto. */
    if (r.resultados.length) { estado.marcadas = marcadasDe(r.resultados); }

    if (typeof estado.cadena !== 'number') { estado.cadena = 0; }
    if (r.resultados.length > 0) {
      estado.cadena = estado.cadena + 1;
      if (estado.cadena >= 5) {
        if (typeof estado.vidas !== 'number') { estado.vidas = 3; }
        if (estado.vidas < 6) {
          estado.vidas = estado.vidas + 1;
          anunciar('¡Vida extra!');
          if (window.d2048Audio && window.d2048Audio.vidaExtra) { window.d2048Audio.vidaExtra(); }
          if (typeof vibrar === 'function') { vibrar(PATRONES.vidaExtra || PATRONES.fusion256); }
        }
        estado.cadena = 0;
      }
    } else {
      estado.cadena = 0;
    }

    var mayorAhora = mayor();
    ponerAleatoria(estado.fichas);

    pintar();
    pintarMarcador();
    /* Cada jugada despierta el fondo del tablero. Vuelve a dormirse solo,
       cuando al brulo se le acaba el recorrido y no queda ninguna chispa. */
    despertar();

    if (window.d2048Audio) {
      if (r.resultados.length > 0 && r.fusionMayor >= 2) {
        if (window.d2048Audio.fusion) { window.d2048Audio.fusion(r.fusionMayor); }
      } else if (r.cambio) {
        if (window.d2048Audio.mover) { window.d2048Audio.mover(); }
      } else {
        if (window.d2048Audio.invalido) { window.d2048Audio.invalido(); }
      }
    }

    var alcanzaMeta = mayorAhora >= rondaActual().meta;
    var sinJugadas = !alcanzaMeta && !puedeMover();

    /* La vibracion va antes que el cierre, y por que se decida aqui y no
       dentro: fabricar el 2048 es lo mas grande que puede pasar en una jugada y
       tiene que salir aunque la jugada cierre la ronda. Y si la jugada cierra
       la ronda, la fusion se calla, porque el aparato vibra una sola cosa a la
       vez y con las dos solo se sentiria la segunda. */
    vibrarJugada(r.fusionMayor, alcanzaMeta || sinJugadas);
    if (r.resultados.length > 0 && r.fusionMayor >= 2048 && !trofeoCelebrado) {
      if (window.d2048Audio && window.d2048Audio.trofeo) { window.d2048Audio.trofeo(); }
    }

    if (alcanzaMeta) {
      ganarRonda();
      return true;
    }

    if (sinJugadas) {
      bloquearHasta(250);
      programarPerdidaVida(250);
      return true;
    }

    anunciar('Puntos ' + estado.puntos + '. Movimientos ' + estado.movimientos +
             '. Ficha más grande ' + mayorAhora + '.');
    return true;
  }

  function rondaActual() { return RONDAS[estado.ronda]; }

  function marcadasDe(ids) {
    var marcadas = {};
    for (var n = 0; n < ids.length; n++) { marcadas[ids[n]] = true; }
    return marcadas;
  }

  function ganarRonda() {
    estado.entero = true;
    estado.terminado = true;
    estado.estrellas[estado.ronda] = estrellasDe(estado.ronda, estado.movimientos);
    iniciarAnimacionFase();
  }

  function cerrarRonda(texto) {
    vaciarCola();
    if (temporizadorVida) { clearTimeout(temporizadorVida); temporizadorVida = 0; }
    /* El cierre manda su patron: el premio si se gano, el aviso si se acabaron
       las jugadas. No vuelve a mandar nada si esta misma jugada ya celebro el
       2048, porque el aparato vibra una sola cosa a la vez. */
    if (!celebraTrofeoEnEstaJugada) {
      vibrar(estado.entero ? PATRONES.ronda : PATRONES.sinJugadas);
    }
    if (window.d2048Audio) {
      if (estado.entero) { if (window.d2048Audio.fase) { window.d2048Audio.fase(); } }
      else { if (window.d2048Audio.invalido) { window.d2048Audio.invalido(); } }
    }
    nodos.textoTurno.innerHTML = texto + ' Puntos: <b>' + estado.puntos + '</b>.';
    nodos.btnSeguir.textContent = estado.entero
      ? (estado.ronda < RONDAS.length - 1 ? 'Ronda siguiente' : 'Ver el resultado')
      : 'Otra vez';
    nodos.turno.hidden = false;
    nodos.chamaco.hidden = false;
    nodos.chamaco.className = 'chamaco chamaco--' + (estado.entero ? 'bien' : 'mal');
    nodos.chamacoTexto.textContent = estado.entero
      ? rondaActual().meta + ' conseguida.'
      : 'Te quedaste en ' + mayor() + ' y la meta era ' + rondaActual().meta + '.';
    pintarEstrellas();
    pintarMarcador();
    anunciar(texto + ' Ronda ' + (estado.ronda + 1) + ' de ' + RONDAS.length + '.');
  }

  function pintarEstrellas() {
    var caja = nodos.estrellas;
    caja.innerHTML = '';
    var n = estado.estrellas[estado.ronda] || 0;
    var svg = '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M10 1.6l2.6 5.3 5.8.8-4.2 4.1 1 5.8L10 14.9l-5.2 2.7 1-5.8L1.6 7.7l5.8-.8z"/></svg>';
    for (var k = 0; k < 3; k++) {
      var env = document.createElement('span');
      env.innerHTML = svg;
      var s = env.firstChild;
      s.setAttribute('class', 'estrella ' + (k < n ? 'estrella--ganada' : 'estrella--perdida'));
      caja.appendChild(s);
    }
    nodos.estrellasTxt.textContent = n + ' de 3 estrellas.';
  }

  /* ------------------------------------------------------------- rondas */

  function abrirRonda(n) {
    estado.ronda = n;
    estado.fichas = [];
    estado.puntos = 0;
    estado.movimientos = 0;
    estado.terminado = false;
    estado.entero = false;
    estado.finalizado = false;
    estado.marcadas = {};
    estado.vidas = 3;
    estado.cadena = 0;
    if (temporizadorVida) { clearTimeout(temporizadorVida); temporizadorVida = 0; }
    faseEnProceso = false;

    vaciarCola();
    puntosPintados = 0;
    /* La suma del ronda anterior se queda ahi invisible, pero su texto viejo
       no debe quedar colgando por si alguien lo lee con el tablero quieto. */
    nodos.suma.textContent = '';
    /* Las fichas que se estaban desvaneciendo mueren con la ronda: sus
       nodos salen con el resto de la capa y el mapa se vacia entero. */
    salientes = {};
    /* Y las chispas que quedaban en el aire. */
    vaciarChispas();
    nodos.fichas.innerHTML = '';
    nodos.mapa = {};

    ponerAleatoria(estado.fichas);
    ponerAleatoria(estado.fichas);

    nodos.tituloRonda.textContent = 'Ronda ' + (n + 1) + ' de ' + RONDAS.length;
    nodos.lemaRonda.textContent = RONDAS[n].lema;
    nodos.turno.hidden = true;
    nodos.chamaco.hidden = true;
    nodos.pista.hidden = true;
    nodos.tablero.classList.remove('dosmil__tablero--pista');
    delete nodos.tablero.dataset.pista;
    nodos.btnPista.setAttribute('aria-expanded', 'false');

    pintar();
    pintarEstrellas();
    anunciar('Ronda ' + (n + 1) + ' de ' + RONDAS.length + '. ' + RONDAS[n].lema);
    /* El arranque: las dos fichas entran con mas caracter y el tablero se
       asienta. Va despues de pintar(), porque el pintado del arranque borra
       las clases de efecto que hubiera. */
    asentarTablero();
    despertar();
    /* Sin preventScroll, enfocar el tablero arrastra la pagina. */
    nodos.tablero.focus({ preventScroll: true });
  }

  function siguiente() {
    if (window.d2048Audio && window.d2048Audio.boton) { window.d2048Audio.boton(); }
    if (estado.terminado && estado.entero && faseEnProceso) { return; }
    if (!estado.entero) { abrirRonda(estado.ronda); return; }
    if (estado.ronda < RONDAS.length - 1) { abrirRonda(estado.ronda + 1); return; }
    if (estado.finalizado) { abrirRonda(0); return; }
    estado.finalizado = true;
    if (window.d2048Audio && window.d2048Audio.fin) { window.d2048Audio.fin(); }
    cerrarTodo();
  }

  function cerrarTodo() {
    var total = (estado.estrellas[0] || 0) + (estado.estrellas[1] || 0) + (estado.estrellas[2] || 0) + (estado.estrellas[3] || 0);
    var maxEstrellas = RONDAS.length * 3;
    nodos.turno.hidden = false;
    nodos.textoTurno.innerHTML =
      'Las cuatro rondas est&aacute;n hechas. Suman <b>' + total + '</b> de ' + maxEstrellas + ' estrellas.';
    nodos.btnSeguir.textContent = 'Jugar de nuevo';
    nodos.chamaco.hidden = false;
    var bien = total >= Math.ceil(maxEstrellas * 7 / 9);
    nodos.chamaco.className = 'chamaco chamaco--' + (bien ? 'bien' : 'mal');
    nodos.chamacoTexto.textContent = total + ' de ' + maxEstrellas + ' estrellas en total.';
    nodos.estado.textContent = 'Las cuatro rondas';
    pintarMarcador();
    anunciar('Fin. ' + total + ' de ' + maxEstrellas + ' estrellas.');
  }

  /* --------------------------------------------------------------- pista */

  /* La pista prueba los cuatro deslizamientos sobre una copia del tablero y
     se queda con el que deja mas huecos y la ficha grande mas cerca de una
     esquina. Es la misma cuenta que hace un jugador con ojo, nada mas. */
  function mejorJugada() {
    var dirs = ['izq', 'der', 'arr', 'abo'];
    var mejor = null;
    var mejorPuntos = -1;

    for (var n = 0; n < dirs.length; n++) {
      var r = desplazar(estado.fichas, dirs[n]);
      if (!r.cambio) { continue; }
      var copia = r.fichas.slice();
      ponerAleatoria(copia);

      var libres = casillaLibre(copia).length;
      var grande = 0;
      var posGrande = { i: 0, j: 0 };
      for (var k = 0; k < copia.length; k++) {
        if (copia[k].valor > grande) { grande = copia[k].valor; posGrande = copia[k]; }
      }
      var esquina = Math.min(posGrande.i, LADO - 1 - posGrande.i) +
                    Math.min(posGrande.j, LADO - 1 - posGrande.j);
      var puntos = libres * 8 - esquina * 6 + (grande / 100);
      if (puntos > mejorPuntos) { mejorPuntos = puntos; mejor = dirs[n]; }
    }

    return mejor;
  }

  function pedirPista() {
    if (estado.terminado) { return; }
    var dir = mejorJugada();
    if (!dir) {
      nodos.textoPista.textContent = 'No queda ningún deslizamiento que sirva.';
      nodos.pista.hidden = false;
      nodos.btnPista.setAttribute('aria-expanded', 'true');
      return;
    }
    nodos.tablero.classList.add('dosmil__tablero--pista');
    nodos.tablero.dataset.pista = dir;
    nodos.textoPista.innerHTML =
      'Desliza hacia <strong>' + NOMBRES[dir] + '</strong>. ' +
      'Conviene dejar la ficha grande en una esquina y no llenar el centro de números.';
    nodos.pista.hidden = false;
    nodos.btnPista.setAttribute('aria-expanded', 'true');
    anunciar('Pista: desliza hacia ' + NOMBRES[dir] + '.');
  }

  /* -------------------------------------------------------------- mandos */

  /* Las cuatro flechas mas WASD, todo en minusculas. La pulsacion se normaliza
     con toLowerCase, asi que las mayusculas y el BloqMayus hacen la misma
     jugada que las minusculas. */
  var TECLAS = {
    arrowleft: 'izq', arrowright: 'der', arrowup: 'arr', arrowdown: 'abo',
    a: 'izq', d: 'der', w: 'arr', s: 'abo'
  };

  function alPulsar(e) {
    if (window.d2048Audio && window.d2048Audio.activar) { window.d2048Audio.activar(); }
    if (e.metaKey || e.ctrlKey || e.altKey) { return; }
    var dir = TECLAS[String(e.key).toLowerCase()];
    if (!dir) { return; }
    var enCampo = document.activeElement &&
      (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA');
    if (enCampo) { return; }
    e.preventDefault();
    jugar(dir);
  }

  /* El deslizamiento con el dedo o con el raton. Se mide el arranque y la
     salida: si el dedo fue mas largo en una direccion que en la otra, esa
     direccion gana. El umbral son catorce pixeles netos, que es lo que
     recorre un pulgar en una pantalla de telefono; con veinticuatro, media
     partida se perdia en gestos que el jugador daba por buenos. Un simple
     toque no hace nada. */
  var inicio = null;
  var UMBRAL_GESTO = 14;

  function alBajar(e) {
    if (window.d2048Audio && window.d2048Audio.activar) { window.d2048Audio.activar(); }
    if (e.target.closest('button')) { return; }
    inicio = { x: e.clientX, y: e.clientY };
  }
  function alSubir(e) {
    if (!inicio) { return; }
    var dx = e.clientX - inicio.x;
    var dy = e.clientY - inicio.y;
    inicio = null;
    if (Math.abs(dx) < UMBRAL_GESTO && Math.abs(dy) < UMBRAL_GESTO) { return; }
    if (Math.abs(dx) > Math.abs(dy)) { jugar(dx > 0 ? 'der' : 'izq'); }
    else { jugar(dy > 0 ? 'abo' : 'arr'); }
  }

  /* ------------------------------------------------------------- arranque */

  function montar() {
    nodos.tablero = $('tablero');
    nodos.fichas = $('fichas');
    nodos.brillo = $('brillo');
    nodos.chispa = $('chispa');
    nodos.confeti = $('confeti');
    nodos.faseHecha = $('faseHecha');
    nodos.faseHechaNum = $('faseHechaNum');
    nodos.marcador = $('marcador');
    nodos.mapa = {};
    nodos.puntos = $('leerPuntos');
    nodos.movimientos = $('leerMovimientos');
    nodos.meta = $('leerMeta');
    nodos.libres = $('leerLibres');
    nodos.vidas = $('leerVidas');
    nodos.cadena = $('leerCadena');
    nodos.estado = $('estadoTablero');
    nodos.viva = $('lecturaViva');
    nodos.turno = $('turno');
    nodos.textoTurno = $('textoTurno');
    nodos.btnSeguir = $('btnSeguir');
    nodos.chamaco = $('chamaco');
    nodos.chamacoTexto = $('chamacoTexto');
    nodos.estrellas = $('estrellas');
    nodos.estrellasTxt = $('lecturaEstrellas');
    nodos.pista = $('pista');
    nodos.textoPista = $('textoPista');
    nodos.btnPista = $('btnPista');
    nodos.tituloRonda = $('tituloRonda');
    nodos.lemaRonda = $('lemaRonda');
    nodos.btnSilencio = $('btnSilencio');
    /* Mismo caso: la fila de abajo repite los puntos y hay que
       mantenerla al dia para que no contradiga a la barra de arriba. */
    nodos.puntos2 = $('leerPuntos2');

    /* La suma que sube con los puntos y el pulso del marcador. El nodo se
       crea una sola vez y se reutiliza para siempre, asi que por mucho que
       suban los puntos nunca hay mas de una en el documento. Va dentro de
       la etiqueta de los puntos, que es el sitio que no se mueve cuando la
       suma aparece. */
    nodos.etiquetaPuntos = nodos.puntos.parentNode;
    nodos.suma = document.createElement('span');
    nodos.suma.className = 'dosmil__suma';
    nodos.suma.setAttribute('aria-hidden', 'true');
    nodos.etiquetaPuntos.appendChild(nodos.suma);

    var celdas = '';
    for (var n = 0; n < LADO * LADO; n++) { celdas += '<div class="dosmil__hueco"></div>'; }
    $('celdas').innerHTML = celdas;

    nodos.tablero.addEventListener('pointerdown', alBajar);
    nodos.tablero.addEventListener('pointerup', alSubir);
    nodos.tablero.addEventListener('pointercancel', function () { inicio = null; });
    document.addEventListener('keydown', alPulsar);
    nodos.btnSeguir.addEventListener('click', function() {
      if (window.d2048Audio && window.d2048Audio.activar) { window.d2048Audio.activar(); }
      if (window.d2048Audio && window.d2048Audio.boton) { window.d2048Audio.boton(); }
      siguiente();
    });
    nodos.btnPista.addEventListener('click', function() {
      if (window.d2048Audio && window.d2048Audio.activar) { window.d2048Audio.activar(); }
      if (window.d2048Audio && window.d2048Audio.boton) { window.d2048Audio.boton(); }
      pedirPista();
    });
    if (nodos.btnSilencio) {
      nodos.btnSilencio.addEventListener('click', function() {
        if (window.d2048Audio && window.d2048Audio.activar) { window.d2048Audio.activar(); }
        if (window.d2048Audio && window.d2048Audio.toggleSilencio) {
          var sil = window.d2048Audio.toggleSilencio();
          nodos.btnSilencio.setAttribute('aria-pressed', sil ? 'true' : 'false');
        } else if (window.d2048Audio && window.d2048Audio.activar) {
          window.d2048Audio.activar();
          nodos.btnSilencio.setAttribute('aria-pressed', 'false');
        }
      });
      if (window.d2048Audio && window.d2048Audio.estaSilenciado) {
        nodos.btnSilencio.setAttribute('aria-pressed', window.d2048Audio.estaSilenciado() ? 'true' : 'false');
      }
    }

    pintarMarcador();
    abrirRonda(0);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', montar);
  } else {
    montar();
  }

  /* Coloca una ficha con un valor dado en una casilla, para poder montar una
     partida -o una fusion- sin tener que jugarla entera. Sustituye lo que
     hubiera en esa casilla y retira su nodo en el acto, sin pasar por la
     animacion de ficha absorbida: aqui no se esta jugando, se esta
     preparando. */
  function colocar(i, j, valor) {
    if (!(i >= 0 && i < LADO) || !(j >= 0 && j < LADO)) { return null; }
    var num = Number(valor);
    if (!(num >= 2)) { return null; }

    var fuera = [];
    var quedan = [];
    for (var n = 0; n < estado.fichas.length; n++) {
      var f = estado.fichas[n];
      if (f.i === i && f.j === j) { fuera.push(f.id); } else { quedan.push(f); }
    }
    estado.fichas = quedan;
    for (var k = 0; k < fuera.length; k++) {
      var el = nodos.mapa[fuera[k]];
      delete nodos.mapa[fuera[k]];
      if (el && el.parentNode) { el.parentNode.removeChild(el); }
    }

    var ficha = nuevaFicha(i, j, num, false);
    estado.fichas.push(ficha);
    pintar();
    return ficha;
  }

  /* Cuantas chispas hay ahora mismo en la pantalla. Cuenta los nodos del
     documento y no los del registro: es el numero del que hay que fiarse
     para saber que no se estan acumulando. */
  function particulasVivas() {
    return nodos.chispa.children.length;
  }

  /* Si se ha pedido un fotograma o no. Es lo que dice si el unico bucle de la
     pagina esta corriendo en este instante. */
  function bucleCorriendo() { return pasoPedido !== 0; }

  /* ---------------------------------------------------------------- audio */
  /* Sintesis con Web Audio: sin archivos de sonido y sin terceros. El
     contexto NO existe hasta el primer gesto del jugador -asi lo exige la
     politica de reproduccion automatica del navegador-. Antes de eso
     `estado()` dice que no hay contexto y no suena nada. */
  var aud = {
    ctx: null,
    maestra: null,
    silenciado: false,
    clave: 'series_2048_sonido'
  };

  var ESCALA_PENTA = [0, 2, 4, 7, 9];

  function leerSilencio() {
    try {
      var v = window.localStorage.getItem(aud.clave);
      return v === '0';
    } catch (e) {
      /* Sin almacenamiento (modo privado) el juego suena igual: no poder
         recordar la preferencia no es un error que deba romper nada. */
      return false;
    }
  }

  function guardarSilencio(v) {
    try { window.localStorage.setItem(aud.clave, v ? '0' : '1'); }
    catch (e) { /* sin persistencia: se queda en memoria */ }
  }

  function activarAudio() {
    if (aud.ctx) {
      if (aud.ctx.state === 'suspended' && aud.ctx.resume) { aud.ctx.resume(); }
      return aud.ctx;
    }
    var Ctor = window.AudioContext || window.webkitAudioContext;
    if (!Ctor) { return null; }
    try {
      aud.ctx = new Ctor();
      aud.maestra = aud.ctx.createGain();
      aud.maestra.gain.value = aud.silenciado ? 0 : 0.5;
      aud.maestra.connect(aud.ctx.destination);
    } catch (e) {
      aud.ctx = null;
      aud.maestra = null;
    }
    return aud.ctx;
  }

  /* El grafo de una nota, sobre el contexto que se le pase. Va aparte para
     que la misma receta sirva en el contexto real y en uno offline: asi lo
     que se prueba es exactamente lo que suena. */
  function notaEn(ctx, destino, frecuencia, inicio, dur, tipo, ganancia) {
    if (!ctx || !destino) { return; }
    var t0 = ctx.currentTime + inicio;
    var osc = ctx.createOscillator();
    var g = ctx.createGain();
    osc.type = tipo || 'sine';
    osc.frequency.setValueAtTime(frecuencia, t0);
    /* Envolvente con subida y bajada cortas: sin ellas cada nota empieza y
       acaba con un chasquido. */
    var pico = ganancia === undefined ? 0.3 : ganancia;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(pico, t0 + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g);
    g.connect(destino);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  function nota(frecuencia, inicio, dur, tipo, ganancia) {
    notaEn(aud.ctx, aud.maestra, frecuencia, inicio, dur, tipo, ganancia);
  }

  function frecuenciaDeValor(valor) {
    var n = Math.round(Math.log(valor) / Math.LN2);
    var idx = Math.max(0, n - 1);
    var grado = ESCALA_PENTA[(idx + 5) % 5] - 12;
    var octava = 12 * Math.floor(idx / 5);
    var semis = grado + octava + 12;
    return 330 * Math.pow(2, semis / 12);
  }

  /* Cada receta recibe (emitir, arg): `emitir` es la nota sobre el contexto
     que toque. Asi la misma definicion sirve para el audio real y para el
     render offline con el que se comprueba que cada efecto tiene pico y
     duracion. */
  var RECETAS = {
    mover: function(emitir) {
      emitir(140, 0, 0.05, 'sine', 0.16);
    },
    fusion: function(emitir, valor) {
      var f = frecuenciaDeValor(valor >= 2 ? valor : 2);
      emitir(f, 0, 0.09, 'triangle', 0.28);
    },
    invalido: function(emitir) {
      emitir(90, 0, 0.07, 'square', 0.18);
    },
    fase: function(emitir) {
      emitir(440, 0, 0.16, 'triangle', 0.26);
      emitir(554.37, 0.16, 0.16, 'triangle', 0.26);
      emitir(659.25, 0.32, 0.28, 'triangle', 0.3);
    },
    vidaPerdida: function(emitir) {
      emitir(392, 0, 0.18, 'sawtooth', 0.22);
      emitir(261.63, 0.2, 0.2, 'sawtooth', 0.22);
    },
    vidaExtra: function(emitir) {
      emitir(523.25, 0, 0.12, 'triangle', 0.24);
      emitir(659.25, 0.12, 0.12, 'triangle', 0.24);
      emitir(783.99, 0.24, 0.12, 'triangle', 0.24);
      emitir(1046.5, 0.36, 0.14, 'triangle', 0.26);
    },
    trofeo: function(emitir) {
      emitir(523.25, 0, 0.14, 'square', 0.2);
      emitir(659.25, 0.14, 0.14, 'square', 0.2);
      emitir(783.99, 0.28, 0.14, 'square', 0.2);
      emitir(1046.5, 0.42, 0.14, 'square', 0.22);
      emitir(1318.5, 0.56, 0.24, 'square', 0.24);
    },
    fin: function(emitir) {
      emitir(659.25, 0, 0.3, 'triangle', 0.26);
      emitir(523.25, 0.16, 0.3, 'triangle', 0.26);
      emitir(392, 0.32, 0.42, 'triangle', 0.26);
    },
    boton: function(emitir) {
      emitir(660, 0, 0.04, 'square', 0.14);
    }
  };

  var NOMBRES_FX = ['mover', 'fusion', 'invalido', 'fase', 'vidaPerdida',
                    'vidaExtra', 'trofeo', 'fin', 'boton'];

  function sonar(nombre, arg) {
    var receta = RECETAS[nombre];
    if (!receta || !aud.ctx || aud.silenciado) { return; }
    receta(function(f, ini, dur, tipo, g) {
      notaEn(aud.ctx, aud.maestra, f, ini, dur, tipo, g);
    }, arg);
  }

  /* Renderiza una receta en un contexto offline y devuelve pico y duracion.
     Es la superficie con la que se comprueba que las nueve suenan de verdad
     sin necesidad de un oido ni de un aparato. */
  function renderOffline(nombre, arg, duracion) {
    var receta = RECETAS[nombre];
    if (!receta) { return null; }
    var Ctor = window.OfflineAudioContext || window.webkitOfflineAudioContext;
    if (!Ctor) { return null; }
    var dur = duracion || 2;
    var ctx = new Ctor(1, Math.ceil(44100 * dur), 44100);
    receta(function(f, ini, d, tipo, g) {
      notaEn(ctx, ctx.destination, f, ini, d, tipo, g);
    }, arg);
    var datos = null;
    ctx.oncomplete = function(e) { datos = e.renderedBuffer.getChannelData(0); };
    var p = ctx.startRendering();
    /* startRendering devuelve promesa o usa oncomplete segun el navegador:
       se atiende a las dos para no depender de cual toque. */
    if (p && p.then) {
      return p.then(function(buf) {
        return medirPico(buf.getChannelData(0));
      });
    }
    return new Promise(function(res) {
      setTimeout(function() { res(medirPico(datos)); }, dur * 1000 + 40);
    });
  }

  function medirPico(datos) {
    if (!datos) { return { pico: 0, duracion: 0, muestras: 0 }; }
    var pico = 0;
    var ultima = 0;
    for (var i = 0; i < datos.length; i++) {
      var v = Math.abs(datos[i]);
      if (v > pico) { pico = v; }
      if (v > 0.0005) { ultima = i; }
    }
    return { pico: pico, duracion: ultima / 44100, muestras: datos.length };
  }

  var interfazAudio = {
    ensure: activarAudio,
    activar: activarAudio,
    estado: function() {
      return {
        hayContexto: !!aud.ctx,
        estado: aud.ctx ? aud.ctx.state : 'ninguno',
        silenciado: aud.silenciado,
        maestra: aud.maestra ? aud.maestra.gain.value : null
      };
    },
    estaSilenciado: function() { return aud.silenciado; },
    toggleSilencio: function() {
      aud.silenciado = !aud.silenciado;
      if (aud.maestra) { aud.maestra.gain.value = aud.silenciado ? 0 : 0.5; }
      guardarSilencio(aud.silenciado);
      return aud.silenciado;
    },
    silenciar: function() { if (!aud.silenciado) { interfazAudio.toggleSilencio(); } return aud.silenciado; },
    activarSonido: function() { if (aud.silenciado) { interfazAudio.toggleSilencio(); } return aud.silenciado; },
    ganancia: function() { return aud.maestra ? aud.maestra.gain.value : null; },
    recetas: RECETAS,
    nombres: NOMBRES_FX,
    renderOffline: renderOffline,
    nota: nota
  };

  /* Los efectos de verdad, llamados desde el juego. Se exponen aqui para que
     el disparo quede en un solo sitio y para que las pruebas puedan
     invocarlos. */
  interfazAudio.mover = function() { sonar('mover'); };
  interfazAudio.fusion = function(valor) { sonar('fusion', valor); };
  interfazAudio.invalido = function() { sonar('invalido'); };
  interfazAudio.fase = function() { sonar('fase'); };
  interfazAudio.vidaPerdida = function() { sonar('vidaPerdida'); };
  interfazAudio.vidaExtra = function() { sonar('vidaExtra'); };
  interfazAudio.trofeo = function() { sonar('trofeo'); };
  interfazAudio.fin = function() { sonar('fin'); };
  interfazAudio.boton = function() { sonar('boton'); };

  aud.silenciado = leerSilencio();
  window.d2048Audio = interfazAudio;

  function vidas() { return estado.vidas; }
  function cadena() { return estado.cadena; }
  function ponerCadena(n) { estado.cadena = n; pintarMarcador(); return estado.cadena; }
  function llenarTablero() {
    estado.fichas = [];
    var valor = 2;
    var idx = 0;
    for (var j = 0; j < LADO && idx < LADO * LADO; j++) {
      for (var i = 0; i < LADO && idx < LADO * LADO; i++) {
        estado.fichas.push(nuevaFicha(i, j, valor, false));
        idx++;
        valor = valor * 2;
        if (valor > 131072) { valor = 2; }
      }
    }
    pintar();
  }

  window.d2048 = {
    estado: estado,
    RONDAS: RONDAS,
    ESTRELLAS: ESTRELLAS,
    LADO: LADO,
    jugar: jugar,
    desplazar: desplazar,
    mejorJugada: mejorJugada,
    abrirRonda: abrirRonda,
    ponerAleatoria: ponerAleatoria,
    mayor: mayor,
    colocar: colocar,
    particulasDe: particulasDe,
    amplitudDeSacudida: amplitudDeSacudida,
    particulasVivas: particulasVivas,
    bucleCorriendo: bucleCorriendo,
    respetaMovimientoReducido: respetaMovimientoReducido,
    vibracion: vibracion,
    patronDeFusion: patronDeFusion,
    PATRONES: PATRONES,
    vidas: vidas,
    cadena: cadena,
    ponerCadena: ponerCadena,
    llenarTablero: llenarTablero
  };
}());