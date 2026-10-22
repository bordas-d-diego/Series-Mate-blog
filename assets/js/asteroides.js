/* ==========================================================================
   ASTEROIDES - motor del juego
   --------------------------------------------------------------------------
   Aqui viven las dos series, y las dos estan en la mecanica, no pegadas al
   marcador.

   LA GEOMETRICA, en como se parte una roca. Cada roca se parte en dos, y por
   eso los pedazos que salen de una sola roca son:

       una enorme -> dos grandes -> cuatro medianas -> ocho pequenas
           1      ->      2     ->         4         ->      8

   Ese 1, 2, 4, 8 es la progresion geometrica de razon 2, y sale de ahi: el
   bucle de partir() siempre hace dos.

   LA GEOMETRICA OTRA VEZ, en la puntuacion, que se duplica en cada salto:

       puntosDe(4) = 20      puntosDe(3) = 40
       puntosDe(2) = 80      puntosDe(1) = 160

   LA ARITMETICA, en las rocas de cada ronda: 4, 5 y 6. Siempre una mas que
   la ronda anterior.

   Y encima de las dos series hay cuatro cosas mas que hacen que una partida
   valga mas que otra: el arma sube de nivel cuando la pides, las rocas sueltan
   botines que la mejoran, un platillo las cruza disparando, y encadenar rocas
   sin que te den multiplica los puntos. Ninguna de las cuatro rompe las
   series: las multiplica.

   Quien juega no ve ninguna de estas lineas. Solo ve una roca partirse en
   dos y un marcador que sube al doble.
   ========================================================================== */

(function () {
  'use strict';

  var LADO = 4;
  var RADIO = { 4: 34, 3: 24, 2: 15, 1: 8 };

  function puntosDe(tam) {
    return 20 * Math.pow(2, LADO - tam);
  }

  function separaciones(cantidad) {
    var salida = [];
    for (var i = 0; i < cantidad; i++) {
      salida.push(i * (2 * Math.PI / cantidad) + 0.4);
    }
    return salida;
  }

  /* Cada ronda tiene una roca grande mas que la anterior: 4, 5 y 6. Esa es
     la progresion aritmetica del juego.

     El tercer numero de cada fila es la probabilidad de que el platillo salga
     al romper una roca. No es "uno por ronda": se tira un dado en cada roca
     rota, y asi aparece a destiempo, que es como se recuerda. Los tres
     ronda porque una ronda con seis rocas enormes ya exige mas atencion que una
     con cuatro.

     Cuantos salen de verdad los manda el otro freno, no el dado: solo puede
     haber un platillo en el campo y, cuando se va, hay que esperar
     PAUSA_PLATILLO segundos antes de que pueda entrar otro. Medido con un robot
     que juega a ritmo humano, con estas cifras salen del orden de uno a tres
     platillos por partida completa de tres rondas: lo bastante para que el
     jugador se acuerde de el, y no para que sea un obstaculo mas. */
  /* El color de cada fase. El `campo` es el fondo puro, la `nebulosa` el
     color de la mancha grande del cielo, el `acento` el que usan el
     platillo, las balas y el Centinela, y la `neblina` la fuerza con la que
     se ve esa mancha: entre 0,16 y 0,24, ni tan fuerte como para tapar las
     estrellas ni tan floja como para no verse.

     Los cinco `campo` son casi iguales de oscuros, a proposito: el fondo es
     el negro del espacio y lo que cambia de una fase a otra es la luz que
     le cae encima. Por eso las nebulosas van cada una por su color y en su
     sitio, que es lo que hace que dos fases no se confundan. */
  var RONDAS = [
    { id: 'cinturon',  nombre: 'Cinturón interior',   lema: 'Cuatro rocas enormes. Partelas y esquiva los pedazos.', rocas: 4, medianas: 0, platillo: 0.06, cometa: 0,  velocidad: 1.00, campo: '#191322', nebulosa: '#8f6bff', neblina: 0.23, estrellas: 22, acento: '#d7b9ff' },
    { id: 'escombros', nombre: 'Lluvia de escombros', lema: 'Más rocas, más rápidas, y empiezan a caer cometas.',     rocas: 5, medianas: 2, platillo: 0.10, cometa: 22, velocidad: 1.08, campo: '#1d1610', nebulosa: '#ff9d3c', neblina: 0.22, estrellas: 28, acento: '#f2b872' },
    { id: 'hielo',     nombre: 'Campo de hielo',      lema: 'Rocas lentas pero muchas, y platillos que no perdonan.',     rocas: 5, medianas: 4, platillo: 0.18, cometa: 19, velocidad: 1.10, campo: '#0f1a20', nebulosa: '#4fd6ff', neblina: 0.22, estrellas: 35, acento: '#8fc9ec' },
    { id: 'tormenta',  nombre: 'Tormenta',            lema: 'Todo a la vez: rocas, cometas y platillos. Aguanta.',       rocas: 6, medianas: 5, platillo: 0.24, cometa: 14, velocidad: 1.16, campo: '#1e0f1c', nebulosa: '#ff4fd0', neblina: 0.22, estrellas: 42, acento: '#f08fcf' },
    { id: 'jefe',      nombre: 'El Centinela',        lema: 'El núcleo del Centinela. Solo se abre cuando ataca.',      rocas: 3, medianas: 0, platillo: 0.10, cometa: 18, velocidad: 1.12, campo: '#1a0d0e', nebulosa: '#ff4033', neblina: 0.20, estrellas: 18, acento: '#ff4d4d', jefe: true }
  ];

  var VIDA = 3;

  var estado = {
    ronda: 0,
    puntos: 0,
    vidas: VIDA,
    terminado: false,
    entero: false,
    finalizado: false,
    estrellas: [],
    rocas: [],
    balas: [],
    chispas: [],
    nave: null,
    empuja: 0,
    girando: 0,
    cometas: [],
    siguienteCometa: 0,
    cometaAvisoHasta: 0,

    /* Lo que vino despues del unico disparo que habia.

       El arma es un NIVEL (1 a 3) y no un reloj: no se acaba sola, se pierde
       al morir, que es lo que le da sentido al botin que la sube. Los otros
       tres si son relojes, en segundos que quedan. */
    arma: 1,
    efectos: { cadencia: 0, perforante: 0, escudo: 0 },
    /* Un aviso por efecto, para no repetir el mismo "se acaba" cada 0,1 s. */
    efectosAviso: { cadencia: false, perforante: false, escudo: false },
    botines: [],
    platillo: null,
    /* El Centinela: una sola entidad, como el platillo, pero solo vive en
       la quinta fase. En las demas queda en null. */
    jefe: null,

    /* La racha son las rocas que llevas roto sin que te den; el multiplicador
       es lo que valen esas rocas mientras la ventana siga abierta. */
    racha: 0,
    multiplicador: 1,
    multiplicadorAnterior: 1,
    ventanaRacha: 0,
    multSubeEn: -99,
    rachaSube: false,

    /* Dos cuentas de reloj que solo usa la consola de pruebas. */
    disparos: 0,
    ultimoDisparo: 0
  };

  var ancho = 900;
  var alto = 620;
  var lienzo = null;
  var ctx = null;
  var nodos = {};
  var reloj = 0;
  var anterior = 0;

  var VUELTA = 3.6;
  var IMPULSO = 200;
  var MAXIMO = 265;
  var FROTE = 0.986;
  var VIDA_BALA = 0.9;
  var VELOCIDAD_BALA = 470;

  function $(id) { return document.getElementById(id); }

  /* ---------------------------------------------------------------- rocas */

  var sigId = 1;

  /* Una piedra de verdad no es un circulo: se le sacan un par de lados mas
     planos, como si le hubieran pegado un golpe. Cada roca tiene la suya.

     Lo que hay aqui son tres cosas que no estaban, y son las que hacen que
     dos rocas del mismo tamano no parezcan la misma figura:

        1. El numero de lados varia de 8 a 12, y el reparto de los angulos
           tambien. Con nueve lados fijos y solo el radio variable, dos
           rocas grandes se parecian demasiado.
        2. Cada vertice tiene su propio relieve, y el relieve no se aplica
           sobre una circunferencia: la roca es una elipse mildisima con los
           vertices empujados o hundidos. De ahi salen los golfos.
        3. El relieve de cada vertice se guarda aparte, y es lo que despues
           se ve en el borde al pintar.

     Los puntos y el relieve van en coordenadas LOCALES a la roca, y se
     pintan dentro de una rotacion por roca.ang, asi que la forma y los
     crateres giran con ella. */
  function silueta(radio) {
    var lados = 8 + Math.floor(Math.random() * 5);
    var puntos = [];
    var relieve = [];
    /* El estiramiento de la roca: dos ejes Mildisimamente distintos, no un
       circulo perfecto. */
    var ejeX = 0.94 + Math.random() * 0.16;
    var ejeY = 0.94 + Math.random() * 0.16;
    for (var i = 0; i < lados; i++) {
      var a = (i / lados) * Math.PI * 2 + (Math.random() - 0.5) * 0.16;
      var r = radio * (0.70 + Math.random() * 0.34);
      puntos.push({ x: Math.cos(a) * r * ejeX, y: Math.sin(a) * r * ejeY });
      relieve.push(0.80 + Math.random() * 0.32);
    }
    return { puntos: puntos, relieve: relieve };
  }

  /* Los crateres. Entre dos y cuatro por roca, en coordenadas locales, cada
     uno con su boca, su sombra y su labio. La luz del campo viene de arriba a
     la izquierda, asi que la sombra se dibuja hacia abajo a la derecha y el
     labio iluminado hacia arriba a la izquierda. Como todo va en coordenadas
     locales, el crater gira con la roca.

     Se reparten con separacion minima entre bocas: dos crateres encima uno
     del otro se leen como una mancha y no como dos crateres. */
  function crateres(radio) {
    var cuantos = 2 + Math.floor(Math.random() * 3);
    var salida = [];
    var intentos = 0;
    while (salida.length < cuantos && intentos < 80) {
      intentos++;
      var a = Math.random() * Math.PI * 2;
      var d = Math.sqrt(Math.random()) * radio * 0.55;
      var boca = radio * (0.10 + Math.random() * 0.11);
      var cx = Math.cos(a) * d;
      var cy = Math.sin(a) * d;
      var pegado = false;
      for (var i = 0; i < salida.length; i++) {
        var dx = salida[i].x - cx;
        var dy = salida[i].y - cy;
        if (Math.sqrt(dx * dx + dy * dy) < (boca + salida[i].r) * 1.35) { pegado = true; }
      }
      if (pegado) { continue; }
      salida.push({ x: cx, y: cy, r: boca, a: Math.random() * Math.PI * 2 });
    }
    return salida;
  }

  /* La luz del campo viene de arriba a la izquierda, y ahora esta escrita
     como vector para el sombreado de las placas. La z es la inclinacion de
     la piedra hacia el jugador: cuanto mas de frente, mas luz recoge una
     placa. La misma direccion que ya usaban los crateres. */
  var LUZ_X = -0.62;
  var LUZ_Y = -0.78;
  var LUZ_Z = 0.35;

  /* La piedra, de la sombra al plano iluminado pasando por el tono medio.
     El cuerpo de la roca se tiende entero entre estos tres colores. El color
     de la leyenda (COLOR_ROCA) no entra aqui: va en el canto, en el halo y
     en el brillo cosmico, que es lo que tiene que seguir diciendo el tamano.

     El suelo de color existe porque una roca no tiene agujeros negros: si la
     variacion de brillo de una placa la hunde por debajo, se recorta ahi. */
  var PIEDRA_SOMBRA = '#2f3542';
  var PIEDRA_MEDIA = '#6f6152';
  var PIEDRA_CLARA = '#a8927a';
  var PIEDRA_MINIMO = { r: 0x23, g: 0x27, b: 0x33 };
  var PIEDRA_PASOS = 12;

  /* Un tono de la rampa, como tres canales recortados al suelo. Se usa solo
     al crear la roca, para cocinar sus doce tonos y sus variantes. */
  function triPiedra(t, brillo) {
    var a = t < 0.5 ? PIEDRA_SOMBRA : PIEDRA_MEDIA;
    var b = t < 0.5 ? PIEDRA_MEDIA : PIEDRA_CLARA;
    var u = t < 0.5 ? t * 2 : (t - 0.5) * 2;
    var ca = parseInt(a.slice(1), 16);
    var cb = parseInt(b.slice(1), 16);
    var r = (((ca >> 16) & 255) * (1 - u) + ((cb >> 16) & 255) * u) * brillo;
    var g = (((ca >> 8) & 255) * (1 - u) + ((cb >> 8) & 255) * u) * brillo;
    var az = ((ca & 255) * (1 - u) + (cb & 255) * u) * brillo;
    return {
      r: Math.max(PIEDRA_MINIMO.r, Math.min(255, Math.round(r))),
      g: Math.max(PIEDRA_MINIMO.g, Math.min(255, Math.round(g))),
      b: Math.max(PIEDRA_MINIMO.b, Math.min(255, Math.round(az)))
    };
  }

  function textoPiedra(c) {
    return 'rgb(' + c.r + ',' + c.g + ',' + c.b + ')';
  }

  /* La misma piedra con la luminosidad movida un ocho por ciento. Es lo que
     usan las manchas de dentro de cada placa. */
  function variarPiedra(c, factor) {
    return textoPiedra({
      r: Math.max(PIEDRA_MINIMO.r, Math.min(255, Math.round(c.r * factor))),
      g: Math.max(PIEDRA_MINIMO.g, Math.min(255, Math.round(c.g * factor))),
      b: Math.max(PIEDRA_MINIMO.b, Math.min(255, Math.round(c.b * factor)))
    });
  }

  /* La silueta partida en tramos rectos: cada arista se parte en dos o tres
     y el punto intermedio se desplaza hasta un 6 % del radio en
     perpendicular. Se ven esquinas, no una curva. Se calcula una vez por
     roca, junto con el resto de la geometria. */
  function fractalizar(puntos, radio) {
    var salida = [];
    for (var i = 0; i < puntos.length; i++) {
      var a = puntos[i];
      var b = puntos[(i + 1) % puntos.length];
      var dx = b.x - a.x;
      var dy = b.y - a.y;
      var largo = Math.sqrt(dx * dx + dy * dy) || 1;
      var nx = -dy / largo;
      var ny = dx / largo;
      var tramos = 2 + Math.floor(Math.random() * 2);
      salida.push(a);
      for (var k = 1; k < tramos; k++) {
        var t = k / tramos;
        var d = (Math.random() - 0.5) * 2 * radio * 0.06;
        salida.push({ x: a.x + dx * t + nx * d, y: a.y + dy * t + ny * d });
      }
    }
    return salida;
  }

  /* Recorte de un poligono por el semiplano a*x + b*y + c <= 0
     (Sutherland-Hodgman). Es la pieza con la que se sacan las celdas de
     Voronoi: cada mediatriz recorta lo que no es de esta semilla. */
  function recortarSemiplano(poligono, a, b, c) {
    var salida = [];
    for (var i = 0; i < poligono.length; i++) {
      var p = poligono[i];
      var q = poligono[(i + 1) % poligono.length];
      var dp = a * p.x + b * p.y + c;
      var dq = a * q.x + b * q.y + c;
      if (dp <= 0) { salida.push(p); }
      if ((dp < 0 && dq > 0) || (dp > 0 && dq < 0)) {
        var t = dp / (dp - dq);
        salida.push({ x: p.x + (q.x - p.x) * t, y: p.y + (q.y - p.y) * t });
      }
    }
    return salida;
  }

  function puntoEnPoligono(x, y, puntos) {
    var dentro = false;
    for (var i = 0, j = puntos.length - 1; i < puntos.length; j = i++) {
      var pi = puntos[i];
      var pj = puntos[j];
      if ((pi.y > y) !== (pj.y > y) &&
        x < (pj.x - pi.x) * (y - pi.y) / (pj.y - pi.y) + pi.x) {
        dentro = !dentro;
      }
    }
    return dentro;
  }

  /* Las placas: semillas repartidas dentro de la silueta y su celda de
     Voronoi, que sale de recortar la silueta con las mediatrices frente a
     las demas semillas. Con veintidos semillas son veintiun recortes por
     celda, y todo esto se hace UNA vez, en crearRoca. */
  function placas(contorno, radio, cuantas) {
    var semillas = [];
    var intentos = 0;
    while (semillas.length < cuantas && intentos < 600) {
      intentos++;
      var x = (Math.random() - 0.5) * 2 * radio;
      var y = (Math.random() - 0.5) * 2 * radio;
      if (!puntoEnPoligono(x, y, contorno)) { continue; }
      /* Dos semillas casi encima dan una placa de un pixel: no se admiten. */
      var pegada = false;
      for (var s = 0; s < semillas.length; s++) {
        var dx = semillas[s].x - x;
        var dy = semillas[s].y - y;
        if (dx * dx + dy * dy < radio * radio * 0.02) { pegada = true; }
      }
      if (pegada) { continue; }
      semillas.push({ x: x, y: y });
    }
    var celdas = [];
    for (var i = 0; i < semillas.length; i++) {
      var si = semillas[i];
      var celda = contorno;
      for (var j = 0; j < semillas.length && celda.length >= 3; j++) {
        if (i === j) { continue; }
        var sj = semillas[j];
        /* Punto mas cerca de si que de sj: 2p.(sj-si) <= |sj|^2-|si|^2,
           escrito como 2p.(sj-si) + (|si|^2-|sj|^2) <= 0. */
        celda = recortarSemiplano(celda,
          2 * (sj.x - si.x),
          2 * (sj.y - si.y),
          si.x * si.x + si.y * si.y - sj.x * sj.x - sj.y * sj.y);
      }
      if (celda.length >= 3) { celdas.push({ puntos: celda, semilla: si }); }
    }
    return celdas;
  }

  /* Las normales de las aristas de un poligono, apuntando hacia fuera de su
     centro. Se usan para saber que fisuras y que canto miran a la luz. */
  function normalesAristas(puntos, cx, cy) {
    var nrm = [];
    for (var i = 0; i < puntos.length; i++) {
      var p = puntos[i];
      var q = puntos[(i + 1) % puntos.length];
      var dx = q.x - p.x;
      var dy = q.y - p.y;
      var largo = Math.sqrt(dx * dx + dy * dy) || 1;
      var nx = dy / largo;
      var ny = -dx / largo;
      if (nx * ((p.x + q.x) / 2 - cx) + ny * ((p.y + q.y) / 2 - cy) < 0) {
        nx = -nx;
        ny = -ny;
      }
      nrm.push({ x: nx, y: ny });
    }
    return nrm;
  }

  /* Un punto dentro de una celda, tomado de su caja. Se usa al crear la
     roca, para las manchas y para colocar la boca, nunca al pintar. */
  function puntoDentroDeCelda(celda) {
    var minX = Infinity;
    var maxX = -Infinity;
    var minY = Infinity;
    var maxY = -Infinity;
    for (var i = 0; i < celda.puntos.length; i++) {
      var p = celda.puntos[i];
      if (p.x < minX) { minX = p.x; }
      if (p.x > maxX) { maxX = p.x; }
      if (p.y < minY) { minY = p.y; }
      if (p.y > maxY) { maxY = p.y; }
    }
    for (var intento = 0; intento < 12; intento++) {
      var x = minX + Math.random() * (maxX - minX);
      var y = minY + Math.random() * (maxY - minY);
      if (puntoEnPoligono(x, y, celda.puntos)) { return { x: x, y: y }; }
    }
    return { x: celda.semilla.x, y: celda.semilla.y };
  }

  /* Cruza el rayo que sale de (x,y) con la silueta y devuelve el primer
     borde. Es lo que hace que la grieta de la boca acabe en el canto de la
     piedra y no flotando dentro. */
  function bordeEnDireccion(contorno, x, y, dx, dy) {
    var mejor = null;
    var minimo = Infinity;
    for (var i = 0; i < contorno.length; i++) {
      var a = contorno[i];
      var b = contorno[(i + 1) % contorno.length];
      var ex = b.x - a.x;
      var ey = b.y - a.y;
      var den = dx * ey - dy * ex;
      if (Math.abs(den) < 1e-9) { continue; }
      var qx = a.x - x;
      var qy = a.y - y;
      var t = (qx * ey - qy * ex) / den;
      var u = (qx * dy - qy * dx) / den;
      if (t > 0 && t < minimo && u >= 0 && u <= 1) {
        minimo = t;
        mejor = { x: x + dx * t, y: y + dy * t };
      }
    }
    return mejor;
  }

  /* La grieta que sale de la boca hacia el borde: tres tramos con un desvio
     pequeno, que se apaga en los extremos para no salirse de la piedra. */
  function fisuraHaciaBorde(contorno, grieta, radio) {
    var ang = Math.atan2(grieta.cy, grieta.cx);
    ang += (Math.random() - 0.5) * 0.45;
    var dx = Math.cos(ang);
    var dy = Math.sin(ang);
    var fin = bordeEnDireccion(contorno, grieta.cx, grieta.cy, dx, dy);
    if (!fin) {
      fin = { x: grieta.cx + dx * radio, y: grieta.cy + dy * radio };
    }
    var inicio = {
      x: grieta.cx + dx * grieta.radio * 0.92,
      y: grieta.cy + dy * grieta.radio * 0.92
    };
    var puntos = [inicio];
    var tramos = 3;
    for (var i = 1; i < tramos; i++) {
      var t = i / tramos;
      var desvio = (Math.random() - 0.5) * radio * 0.05 * Math.sin(Math.PI * t);
      puntos.push({
        x: inicio.x + (fin.x - inicio.x) * t - dy * desvio,
        y: inicio.y + (fin.y - inicio.y) * t + dx * desvio
      });
    }
    puntos.push(fin);
    return puntos;
  }

  /* El boquete de la grieta cosmica: un poligono de 7 a 9 vertices dentro de
     una placa, las estrellas y el centro del brillo. Todo va guardado en la
     roca; pintar solo pinta. */
  function boqueteDe(celda, radio) {
    var centro = null;
    var mejor = -1;
    /* La boca va descentrada: se busca el punto de la placa elegida que mas
       se aleja del centro de la roca. Una boca centrada se lee como un ojo. */
    for (var intento = 0; intento < 26; intento++) {
      var c = puntoDentroDeCelda(celda);
      var d = Math.sqrt(c.x * c.x + c.y * c.y);
      if (d > radio * 0.50) { continue; }
      if (d > mejor) {
        mejor = d;
        centro = c;
      }
    }
    if (!centro) {
      centro = { x: celda.semilla.x, y: celda.semilla.y };
    }
    var objetivo = radio * (0.31 + Math.random() * 0.12);
    var n = 7 + Math.floor(Math.random() * 3);
    var giro = Math.random() * Math.PI * 2;
    var puntos = [];
    for (var k = 0; k < n; k++) {
      var ang = giro + (k / n) * Math.PI * 2 + (Math.random() - 0.5) * 0.30;
      var r = objetivo * (0.72 + Math.random() * 0.34);
      puntos.push({ x: centro.x + Math.cos(ang) * r, y: centro.y + Math.sin(ang) * r });
    }
    var cx = 0;
    var cy = 0;
    for (k = 0; k < puntos.length; k++) {
      cx += puntos[k].x;
      cy += puntos[k].y;
    }
    cx /= puntos.length;
    cy /= puntos.length;
    /* El radio se fija de verdad al objetivo: el sorteo de los vertices solo
       decide lo irregular que es el borde. */
    var alcanza = 0;
    for (k = 0; k < puntos.length; k++) {
      var ex = puntos[k].x - cx;
      var ey = puntos[k].y - cy;
      alcanza = Math.max(alcanza, Math.sqrt(ex * ex + ey * ey));
    }
    var escala = alcanza > 0 ? objetivo / alcanza : 1;
    for (k = 0; k < puntos.length; k++) {
      puntos[k].x = cx + (puntos[k].x - cx) * escala;
      puntos[k].y = cy + (puntos[k].y - cy) * escala;
    }
    var estrellas = [];
    var cuantas = 25 + Math.floor(Math.random() * 21);
    var intentos = 0;
    while (estrellas.length < cuantas && intentos < 500) {
      intentos++;
      var ea = Math.random() * Math.PI * 2;
      /* El exponente concentra las estrellas en el centro de la boca. */
      var ed = objetivo * Math.pow(Math.random(), 1.55);
      var stx = cx + Math.cos(ea) * ed;
      var sty = cy + Math.sin(ea) * ed;
      if (!puntoEnPoligono(stx, sty, puntos)) { continue; }
      var alfa = 0.55 + Math.random() * 0.45;
      estrellas.push({
        x: stx,
        y: sty,
        r: 0.5 + Math.random() * 0.9,
        color: Math.random() < 0.22
          ? 'rgba(255,217,160,' + alfa.toFixed(2) + ')'
          : 'rgba(255,255,255,' + alfa.toFixed(2) + ')'
      });
    }
    return {
      puntos: puntos,
      nrm: normalesAristas(puntos, cx, cy),
      cx: cx,
      cy: cy,
      radio: objetivo,
      estrellas: estrellas
    };
  }

  /* La velocidad base de cada tamano de roca. La de la enorme es la mas
     baja a proposito: una piedra grande que se mueve rapido deja menos
     tiempo para apuntar. */
  var VELOCIDAD_POR_TAMANO = { 4: 36, 3: 50, 2: 70, 1: 98 };

  /* El lema de la ronda 2 dice "y se mueven mas rapido", y el motor lo
     cumple: cada ronda multiplica la velocidad base por este factor. La
     ronda 1 es la base (x1) y queda exactamente igual; de la primera a la
     segunda las rocas ya van un 25 por ciento mas rapidas, y en la tercera
     un 56. Es un salto que se nota sin volverse imposible de esquivar. */
  var VELOCIDAD_RONDA = 1.25;

  /* Los cuatro colores de roca y el borde claro de cada uno. El color va al
     reves del tamano: la roca mas pequena es la mas clara. Antes la enorme
     era la clara y la pequena se perdia contra el fondo (1,4:1 de contraste)
     siendo justo la que mas puntos vale. Ahora la pequena se ve, que es donde
     esta la partida. Son los mismos cuatro colores que la leyenda de la
     pagina, y el borde es el mismo con un 40 % mas de luz. */
  var COLOR_ROCA = { 4: '#5b8aa8', 3: '#4f9d8f', 2: '#a394c9', 1: '#d18aa0' };
  var BORDE_ROCA = { 4: '#8fb4cc', 3: '#7fc0b4', 2: '#c4b9df', 1: '#e6b3c3' };

  function crearRoca(tam, x, y, angulo, ronda) {
    var nivel = ronda === undefined ? 0 : ronda;
    var base = VELOCIDAD_POR_TAMANO[tam];
    if (nivel >= 0 && nivel < RONDAS.length && RONDAS[nivel].velocidad) {
      base = VELOCIDAD_POR_TAMANO[tam] * RONDAS[nivel].velocidad;
    } else {
      base = VELOCIDAD_POR_TAMANO[tam] * Math.pow(VELOCIDAD_RONDA, nivel);
    }
    var giro = (angulo !== undefined) ? angulo : Math.random() * Math.PI * 2;
    var radio = RADIO[tam];
    var variante = Math.floor(Math.random() * 3);
    var forma = silueta(radio);
    var contorno = fractalizar(forma.puntos, radio);
    /* Cuantas placas segun el tamano. Mas pequenas de lo que estaban: una
       placa grande y lisa se lee como carton, y la textura necesita donde
       caer. */
    var celdas = placas(contorno, radio, { 4: 22, 3: 18, 2: 14, 1: 10 }[tam]);
    var i;
    for (i = 0; i < celdas.length; i++) {
      var celda = celdas[i];
      /* La normal de la placa: hacia afuera desde el centro de la roca,
         inclinada un poco al azar, y con la z que la inclina al jugador. */
      var nx = celda.semilla.x + (Math.random() - 0.5) * radio * 0.55;
      var ny = celda.semilla.y + (Math.random() - 0.5) * radio * 0.55;
      var nz = radio * (0.80 + Math.random() * 0.30);
      var largo = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1;
      celda.n = { x: nx / largo, y: ny / largo, z: nz / largo };
      /* La rampa de doce tonos, con su variacion propia de +-6 %, para que
         dos placas con la misma difusa no sean el mismo color. Cada tono
         trae ademas sus dos variantes de +-8 %, que son las manchas. */
      var brillo = 0.94 + Math.random() * 0.12;
      celda.rampa = [];
      celda.colorOscuro = [];
      celda.colorClaro = [];
      for (var tono = 0; tono < PIEDRA_PASOS; tono++) {
        var color = triPiedra(tono / (PIEDRA_PASOS - 1), brillo);
        celda.rampa.push(textoPiedra(color));
        celda.colorOscuro.push(variarPiedra(color, 0.92));
        celda.colorClaro.push(variarPiedra(color, 1.08));
      }
      /* El grano de la placa: tres o cuatro manchas irregulares y seis a diez
         motas, repartidas dentro de la celda. Van en un solo trazado y con un
         solo signo por placa (+8 % o -8 %), que es un relleno por placa y no
         dos: medido, el segundo relleno costaba tanto como el primero. En la
         roca pequena no hay grano, que la placa mide tres pixeles. */
      celda.manchas = null;
      if (tam >= 2) {
        celda.manchas = new Path2D();
        celda.signo = Math.random() < 0.5 ? -1 : 1;
        var cuantasManchas = tam >= 3 ? 3 + Math.floor(Math.random() * 2) : 2;
        for (var m = 0; m < cuantasManchas; m++) {
          var centroMancha = puntoDentroDeCelda(celda);
          var bruto = radio * (0.05 + Math.random() * 0.06);
          var lados = 5 + Math.floor(Math.random() * 3);
          var giroMancha = Math.random() * Math.PI * 2;
          for (var lado = 0; lado < lados; lado++) {
            var angulo = giroMancha + (lado / lados) * Math.PI * 2 +
              (Math.random() - 0.5) * 0.35;
            var radioMancha = bruto * (0.55 + Math.random() * 0.55);
            var mx2 = centroMancha.x + Math.cos(angulo) * radioMancha;
            var my2 = centroMancha.y + Math.sin(angulo) * radioMancha;
            if (lado === 0) {
              celda.manchas.moveTo(mx2, my2);
            } else {
              celda.manchas.lineTo(mx2, my2);
            }
          }
          celda.manchas.closePath();
        }
        var cuantasMotas = tam >= 3 ? 6 + Math.floor(Math.random() * 5) : 4;
        for (var mota = 0; mota < cuantasMotas; mota++) {
          var puntoMota = puntoDentroDeCelda(celda);
          var tamMota = 1 + Math.random();
          celda.manchas.rect(puntoMota.x - tamMota / 2,
            puntoMota.y - tamMota / 2, tamMota, tamMota);
        }
      }
      var mx = 0;
      var my = 0;
      for (var k = 0; k < celda.puntos.length; k++) {
        mx += celda.puntos[k].x;
        my += celda.puntos[k].y;
      }
      celda.nrm = normalesAristas(celda.puntos,
        mx / celda.puntos.length, my / celda.puntos.length);
    }

    /* Una sola boca cosmica por roca, y solo donde se lee: en las dos rocas
       mayores. Se abre en una de las placas de mas superficie, la que queda
       mas lejos del centro, y de ella sale una grieta hasta el canto. */
    var orden = [];
    for (i = 0; i < celdas.length; i++) {
      var area = 0;
      for (var v = 0; v < celdas[i].puntos.length; v++) {
        var p1 = celdas[i].puntos[v];
        var p2 = celdas[i].puntos[(v + 1) % celdas[i].puntos.length];
        area += p1.x * p2.y - p2.x * p1.y;
      }
      orden.push({ i: i, area: Math.abs(area) });
    }
    orden.sort(function (a, b) { return b.area - a.area; });
    var grietas = [];
    if (tam === 4 || tam === 3) {
      var elegida = orden[0].i;
      var lejania = 0;
      for (i = 0; i < orden.length && i < 4; i++) {
        var semilla = celdas[orden[i].i].semilla;
        var distancia = Math.sqrt(semilla.x * semilla.x + semilla.y * semilla.y);
        if (distancia > lejania) {
          lejania = distancia;
          elegida = orden[i].i;
        }
      }
      var boca = boqueteDe(celdas[elegida], radio);
      boca.salida = fisuraHaciaBorde(contorno, boca, radio);
      grietas.push(boca);
    }

    var crat = crateres(radio);
    /* Tres como maximo: cuatro bocas en una roca mediana la vuelven una
       mancha. */
    if (crat.length > 3) { crat.length = 3; }

    return {
      id: sigId++,
      tam: tam,
      ronda: nivel,
      variante: variante,
      x: x,
      y: y,
      vx: Math.cos(giro) * base * (0.65 + Math.random() * 0.7),
      vy: Math.sin(giro) * base * (0.65 + Math.random() * 0.7),
      ang: Math.random() * Math.PI * 2,
      va: (Math.random() - 0.5) * 1.1,
      puntos: puntosDe(tam),
      color: COLOR_ROCA[tam],
      borde: BORDE_ROCA[tam],
      forma: forma.puntos,
      relieve: forma.relieve,
      contorno: contorno,
      canto: normalesAristas(contorno, 0, 0),
      celdas: celdas,
      grietas: grietas,
      crateres: crat
    };
  }

  /* La partida de una roca. Cada roca se parte en DOS, y por eso los pedazos
     que salen de una sola roca son 1, 2, 4 y 8 segun quantas veces se haya
     partido. Ese 1, 2, 4, 8 es la progresion geometrica, y sale de aqui. */
  function partir(roca) {
    if (roca.tam <= 1) { return []; }
    var dirs = separaciones(2);
    var nuevas = [];
    for (var i = 0; i < 2; i++) {
      nuevas.push(crearRoca(roca.tam - 1, roca.x, roca.y, roca.ang + dirs[i], roca.ronda));
    }
    return nuevas;
  }

  /* Cuantos pedazos de un tamano dado hay al final de toda la cadena.
     Con cuatro tamanos esto es exactamente 1, 2, 4 y 8. */
  function pedazosDe(tam) {
    return Math.pow(2, LADO - tam);
  }

  function soltarRonda(n) {
    estado.rocas = [];
    var r = RONDAS[n];
    var total = r.rocas;
    for (var i = 0; i < total; i++) {
      var a = (i / total) * Math.PI * 2;
      var d = 200 + Math.random() * 110;
      estado.rocas.push(crearRoca(LADO,
        ancho / 2 + Math.cos(a) * d,
        alto / 2 + Math.sin(a) * d,
        a + Math.PI, n));
    }
    if (r.medianas) {
      for (var m = 0; m < r.medianas; m++) {
        var am = Math.random() * Math.PI * 2;
        var dm = 60 + Math.random() * 200;
        var xm = ancho / 2 + Math.cos(am) * dm;
        var ym = alto / 2 + Math.sin(am) * dm;
        if (xm < 0) { xm += ancho; }
        if (xm > ancho) { xm -= ancho; }
        if (ym < 0) { ym += alto; }
        if (ym > alto) { ym -= alto; }
        estado.rocas.push(crearRoca(2, xm, ym, Math.random() * Math.PI * 2, n));
      }
    }
  }

  /* ESCUDO = segundos de invulnerabilidad al aparecer la nave.  Con 2,4 el
     escudo se acababa antes de que la roca mas cercana pasara de largo, y
     el jugador se perdia dos vidas sin haber tenido tiempo de apuntar. */
var ESCUDO = 3.4;

/* La nave reaparece en el centro, que es justo por donde pasan todas las
     rocas.  Esta funcion aparta las que esten demasiado cerca para que al
     acabarse el escudo el jugador no muera otra vez sin haber apuntado. */
function despejar() {
    var n = estado.nave;
    if (!n) { return; }
    for (var i = 0; i < estado.rocas.length; i++) {
      var r = estado.rocas[i];
      var dx = r.x - n.x;
      var dy = r.y - n.y;
      var d = Math.sqrt(dx * dx + dy * dy);
      var fuera = RADIO[r.tam] + 150;
      if (d < fuera) {
        var a = d < 1 ? i * 1.7 : Math.atan2(dy, dx);
        r.x = n.x + Math.cos(a) * (fuera + 40);
        r.y = n.y + Math.sin(a) * (fuera + 40);
      }
    }
  }

function soltarNave() {
    estado.nave = {
      x: ancho / 2, y: alto / 2, ang: -Math.PI / 2, vx: 0, vy: 0,
      escudo: ESCUDO,
      /* El RELOJ de invulnerabilidad es el mismo de siempre. Esto solo dice de
         donde viene el escudo que lleva ahora mismo: del ratito de gracia de
         nacer, o de un botin. Solo el del botin dibuja el anillo. */
      escudoBotin: false
    };
    estado.girando = 0;
    estado.empuja = 0;
    despejar();
  }

  /* ------------------------------------------------------------------ arma */

  /* NIVEL_ARMA_MAX es el tope del arma. El arma no es un reloj: no se acaba
     sola. Se pierde al morir, y eso es justo lo que hace que el botin que la
     sube deje de ser decoracion. */
  var NIVEL_ARMA_MAX = 3;

  /* SEPARACION_CANON son las unidades de margen con las que se abre el tiro
     de nivel 2, y ABANICO_CANON los 9 grados del abanico de nivel 3. Con 7
     unidades los tres canoneles caben de sobra en el fuselaje de 22 de ancho
     que se dibuja, y con 9 grados el abanico central abarca 18: ni se junta
     todo el tiro ni se pierde una roca de lado. BOCA_CANON es la distancia del
     centro de la nave a la boca, la misma de 14 que usaba el disparo unico. */
  var SEPARACION_CANON = 7;
  var ABANICO_CANON = 9 * Math.PI / 180;
  var BOCA_CANON = 14;

  /* Donde nace cada bala de un disparo, en coordenadas de la nave: "angulo"
     es el giro que se le anade al rumbo de la nave, y "lado" el desplazamiento
     perpendicular a ese rumbo. Nivel 1: una sola por el centro. Nivel 2: dos
     paralelas separadas 7 unidades. Nivel 3: una al centro y dos abiertas 9
     grados, naciendo cada una del flanco hacia el que se abre. */
  function salidasCanon(nivel) {
    if (nivel >= 3) {
      return [
        { angulo: -ABANICO_CANON, lado: -SEPARACION_CANON },
        { angulo: 0, lado: 0 },
        { angulo: ABANICO_CANON, lado: SEPARACION_CANON }
      ];
    }
    if (nivel === 2) {
      return [
        { angulo: 0, lado: -SEPARACION_CANON },
        { angulo: 0, lado: SEPARACION_CANON }
      ];
    }
    return [{ angulo: 0, lado: 0 }];
  }

  /* Como en el juego original, solo caben unas pocas balas en el campo a la
     vez. Cuando se dispara con el tope lleno, la bala mas vieja se retira,
     para que el canon nunca se sienta atascado. El tope tambien evita que
     se acumulen miles de balas si el navegador congela un momento el juego
     al cambiar de pestana.

     El tope es POR CANON y no un numero fijo: seis por cada canon que tiene
     el arma. La cuenta de 0,96 s del comentario de abajo sigue valiendo igual
     en los tres niveles, que es justo lo que hace que subir de nivel no
     amontone el campo de puntos de luz. */
  var MAX_BALAS_POR_CANON = 6;

  function topeBalas() {
    return MAX_BALAS_POR_CANON * estado.arma;
  }

  /* CADENCIA = segundos que hay entre disparo y disparo cuando el puntero
     esta apoyado sobre el lienzo. Sin ella el dedo apoyado seria una
     ametralladora. Con 0,16 las seis balas del tope salen en 0,96 s y cada
     una vive 0,9 s: el canon nunca se atasca y el campo no se llena de
     puntos de luz. Ademas, a velocidad normal, el jugador ve partir la roca
     antes de que le cambie el angulo de la siguiente.

     El botin de cadencia la baja a 0,09 s. No se baja mas porque entonces el
     tope de balas pasaria a ser el que manda y no la cadencia, y el efecto se
     notaria menos: a 0,09 lo que cambia es que las mismas seis balas alrededor
     de la nave se renuevan mucho mas seguido. */
  var CADENCIA = 0.16;
  var CADENCIA_BOTIN = 0.09;

  function cadenciaActual() {
    return estado.efectos.cadencia > 0 ? CADENCIA_BOTIN : CADENCIA;
  }

  var sigBala = 1;

  function disparar() {
    /* La pausa congela el juego entero, y las entradas son parte del juego: si
       no se mirase aqui, con el campo congelado la barra espaciadora seguiria
       creando balas y el puntero seguiria disparando solo. */
    if (pausado || estado.terminado || !estado.nave) { return; }
    var n = estado.nave;
    var salidas = salidasCanon(estado.arma);
    var tope = topeBalas();
    /* Perforante se decide aqui, al disparar, y no al tocar: si el efecto se
       acabara con la bala en el aire, esa bala debe seguir perforando. */
    var perfora = estado.efectos.perforante > 0;
    while (estado.balas.length + salidas.length > tope) { estado.balas.shift(); }
    for (var i = 0; i < salidas.length; i++) {
      var s = salidas[i];
      var a = n.ang + s.angulo;
      var ca = Math.cos(a);
      var sa = Math.sin(a);
      var mx = n.x + ca * BOCA_CANON - sa * s.lado;
      var my = n.y + sa * BOCA_CANON + ca * s.lado;
      estado.balas.push({
        id: sigBala++,
        /* La perpendicular a un rumbo es su giro de 90 grados. Por eso las
           balas de los costados salen pegadas al flanco de la nave y no del
           centro geometrico. */
        x: mx,
        y: my,
        vx: n.vx + ca * VELOCIDAD_BALA,
        vy: n.vy + sa * VELOCIDAD_BALA,
        vida: VIDA_BALA,
        perfora: perfora,
        /* Las rocas ya tocadas por ESTA bala. Sin ellas una bala
           perforante reventaria la misma roca en cuanto se partiera. */
        golpes: perfora ? [] : null,
        bajas: 0
      });
      /* El fogonazo va en la misma boca por la que sale la bala, y con la
         misma cantidad de canonles: con el arma al tope son tres destellos
         en el mismo cuadro. Y a proposito NO vibra: si vibrara, el disparo
         automatico con el puntero apoyado seria un zumbido continuo. */
      fx.fogonazos.push({
        x: mx, y: my, ang: a,
        vida: 0.075, max: 0.075
      });
    }
    if (fx.fogonazos.length > TOPE_FOGONAZOS) {
      fx.fogonazos.splice(0, fx.fogonazos.length - TOPE_FOGONAZOS);
    }
    estado.disparos++;
    estado.ultimoDisparo = reloj;
    /* Un solo chasquido por disparo aunque el arma suelte las tres balas del
       nivel 3: tres voces en el mismo cuadro se oirian como un golpe sucio.
       sonar() respeta ademas su propio tope de un disparo cada 30 ms. */
    sonar('disparo');
  }

  function chispas(x, y, cuantas) {
    for (var i = 0; i < cuantas; i++) {
      var a = Math.random() * Math.PI * 2;
      var v = 40 + Math.random() * 160;
      estado.chispas.push({
        x: x, y: y,
        vx: Math.cos(a) * v, vy: Math.sin(a) * v,
        vida: 0.3 + Math.random() * 0.45,
        max: 0.75,
        r: 1.3 + Math.random() * 2.1
      });
    }
  }

  /* ------------------------------------------------------------ envoltura */

  function envolver(o, margen) {
    if (o.x < -margen) { o.x += ancho + margen * 2; }
    if (o.x > ancho + margen) { o.x -= ancho + margen * 2; }
    if (o.y < -margen) { o.y += alto + margen * 2; }
    if (o.y > alto + margen) { o.y -= alto + margen * 2; }
  }

  /* Cometas: pasan por el campo y matan a la nave (las balas no les hacen
     dano). Se avisa 1.5 s antes y se usa su sonido propio. */

  /* La pantalla se envuelve, asi que dos cosas separadas por el borde
     cuentan como pegadas. Sin esto, los disparos fallarian al cruzar. */
  function cerca(a, b) {
    var dx = Math.abs(a.x - b.x);
    var dy = Math.abs(a.y - b.y);
    if (dx > ancho / 2) { dx = ancho - dx; }
    if (dy > alto / 2) { dy = alto - dy; }
    return Math.sqrt(dx * dx + dy * dy);
  }

  /* Distancia recta, sin la envoltura. La usan el platillo y sus balas, que
     son una visita y no un habitante del aro: si contasen a traves del borde,
     un platillo todavia fuera de la pantalla podria tocarte desde el lado
     opuesto de donde esta. */
  function plano(a, b) {
    var dx = a.x - b.x;
    var dy = a.y - b.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  function fueraDePantalla(o, margen) {
    return o.x < -margen || o.x > ancho + margen || o.y < -margen || o.y > alto + margen;
  }

  /* -------------------------------------------------------------- botines */

  /* Los cuatro botines. El color de cada uno es el mismo con el que se dibuja
     dentro del campo, y el glifo es un dibujo de trazos: a trescientas
     unidades de lado el jugador no lee, reconoce. */
  var TIPOS_BOTIN = {
    arma:       { nombre: 'Arma',       color: '#f2c98a' },
    cadencia:   { nombre: 'Cadencia',   color: '#5fd0c4', duracion: 9 },
    perforante: { nombre: 'Perforante', color: '#f28ab4', duracion: 8 },
    escudo:     { nombre: 'Escudo',     color: '#c9b2e2', duracion: 8 }
  };

  /* Que probabilidad de soltar botin tiene cada tamano de roca. Cuanto mas
     grande la roca mas probable: la enorme pesa cuatro veces mas que la
     pequena (4 al cuadrado contra 2 al cuadrado) y es la que mas puntos da,
     asi que el botin cae donde esta la partida. Las cuatro sumarian un 47 %,
     con lo que casi la mitad de las rocas que partes sueltan algo. */
  var PROBABILIDAD_BOTIN = { 4: 0.28, 3: 0.16, 2: 0.08, 1: 0.03 };

  /* De los cuatro tipos, cuales salen mas. El arma es el mas frecuente
     porque es el unico que no se acaba solo y el que mas cambia la partida.
     El escudo es el mas raro: protege mientras dura, y ocho segundos no
     alcanzan contra un platillo que vuelve cada pocos segundos. */
  var PESOS_BOTIN = { arma: 0.30, cadencia: 0.25, perforante: 0.25, escudo: 0.20 };

  /* El botin flota nueve segundos. Los ultimos dos parpadean, para que se vea
     que se va en lugar de evaporarse, y el ultimo medio segundo se apaga en
     vez de parpadear: nada desaparece nunca sin avisar. */
  var VIDA_BOTIN = 9;
  var PARPADEO_BOTIN = 2;
  var DESVANE_BOTIN = 0.7;
  var RADIO_BOTIN = 13;
  var RECOGER_BOTIN = 26;

  /* De aqui para abajo, el aviso de "se te acaba" de cada efecto. */
  var AVISO_EFECTO = 2.5;

  var sigBotin = 1;

  function crearBotin(tipo, x, y) {
    if (!TIPOS_BOTIN[tipo]) {
      throw new Error('Tipo de botin desconocido: "' + tipo +
                      '". Valen: ' + Object.keys(TIPOS_BOTIN).join(', ') + '.');
    }
    var a = Math.random() * Math.PI * 2;
    return {
      id: sigBotin++,
      tipo: tipo,
      x: x,
      y: y,
      /* Deriva lenta y constante. Sin rozamiento, porque con rozamiento el
         botin acabaria parado justo donde murio la roca, que es donde el
         jugador estaba hace un segundo. */
      vx: Math.cos(a) * 14,
      vy: Math.sin(a) * 14,
      ang: Math.random() * Math.PI * 2,
      va: (Math.random() - 0.5) * 1.8,
      vida: VIDA_BOTIN
    };
  }

  /* Un dado sobre los cuatro pesos. El arma sale algo mas a menudo porque es
     el unico efecto que sobrevive a la muerte; el escudo algo menos, porque
     ocho segundos de proteccion no son la mejor defensa contra el platillo. */
  function tipoDeBotin() {
    var claves = Object.keys(PESOS_BOTIN);
    var total = 0;
    var i;
    for (i = 0; i < claves.length; i++) { total += PESOS_BOTIN[claves[i]]; }
    var dado = Math.random() * total;
    for (i = 0; i < claves.length; i++) {
      dado -= PESOS_BOTIN[claves[i]];
      if (dado <= 0) { return claves[i]; }
    }
    return claves[claves.length - 1];
  }

  function soltarBotin(roca) {
    if (Math.random() > PROBABILIDAD_BOTIN[roca.tam]) { return; }
    estado.botines.push(crearBotin(tipoDeBotin(), roca.x, roca.y));
  }

  /* Que hace cada botin al tocarlo con la nave. El arma sube un nivel y se
     queda; los otros dos ponen en marcha un reloj; el escudo se lo pasa al
     mismo contador de invulnerabilidad que ya usaba la nave al reaparecer, en
     vez de inventar un segundo sistema de proteccion. */
  function aplicarBotin(b) {
    var msg;
    switch (b.tipo) {
      case 'arma':
        estado.arma = Math.min(NIVEL_ARMA_MAX, estado.arma + 1);
        msg = estado.arma >= NIVEL_ARMA_MAX
          ? 'Arma al tope: tres balas por disparo.'
          : 'Arma al nivel ' + estado.arma + '.';
        break;
      case 'cadencia':
        estado.efectos.cadencia = TIPOS_BOTIN.cadencia.duracion;
        estado.efectosAviso.cadencia = false;
        msg = 'Cadencia: disparas mas rapido.';
        break;
      case 'perforante':
        estado.efectos.perforante = TIPOS_BOTIN.perforante.duracion;
        estado.efectosAviso.perforante = false;
        msg = 'Perforante: las balas atraviesan las rocas.';
        break;
      case 'escudo':
        estado.nave.escudo = Math.max(estado.nave.escudo, TIPOS_BOTIN.escudo.duracion);
        estado.nave.escudoBotin = true;
        estado.efectos.escudo = estado.nave.escudo;
        estado.efectosAviso.escudo = false;
        msg = 'Escudo alrededor de la nave.';
        break;
      default:
        throw new Error('No hay regla para el botin "' + b.tipo + '".');
    }
    chispas(b.x, b.y, 8);
    /* Cada botin se siente distinto: el arma son tres golpecitos, la
       cadencia cuatro muy cortos, el perforante uno largo y el escudo dos
       medios. */
    vibrar(PATRONES.botinSimple);
    /* El escudo tiene su propia nota sostenida; cualquier otro botin suena a
       las dos notas que suben. */
    sonar(b.tipo === 'escudo' ? 'escudo' : 'botin');
    anunciar(msg);
    pintarMarcador();
    pintarEfectos();
    return msg;
  }

  /* Cuanto se ve cada botin ahora mismo. Es lo que dibuja el motor y lo que
     sirve para comprobar el parpadeo desde la consola. */
  function opacidadBotin(b) {
    var a = 1;
    if (b.vida <= PARPADEO_BOTIN) {
      a = Math.floor(reloj * 9) % 2 === 0 ? 1 : 0.22;
    }
    if (b.vida < DESVANE_BOTIN) { a = Math.min(a, b.vida / DESVANE_BOTIN); }
    return Math.max(0, a);
  }

  /* ------------------------------------------------------------- platillo */

  /* El platillo no es una roca mas: es una visita. Entra por un lado, cruza
     el campo en zigzag, dispara con punteria y se va por el otro.

     Y por eso NO usa la envoltura toroidal que usan las rocas y las balas: si
     se envolviera reapareceria por el lado opuesto y el jugador veria un
     platillo que deberia haberse ido ya, ademas de recibir sus disparos desde
     un punto donde no hay nada. Todo lo suyo vive en coordenadas de pantalla
     reales y desaparece al salir. */
  var PLATILLO_PUNTOS = 300;
  var RADIO_PLATILLO = 19;
  var DISPARO_PLATILLO = 1.7;
  var VELOCIDAD_DISPARO_PLATILLO = 300;
  var PAUSA_PLATILLO = 5;
  var esperaPlatillo = 0;

  /* Cometas */
  var RADIO_COMETA = 6;
  var VELOCIDAD_COMETA = 180;
  var AVISO_COMETA = 1.5;
  var CADENCIA_COMETA_MIN = 3;
  var CADENCIA_COMETA_MAX = 8;

  function crearCometa() {
    var izquierda = Math.random() < 0.5;
    var cruce = VELOCIDAD_COMETA + Math.random() * 30;
    var ang = izquierda ? 0 : Math.PI;
    return {
      x: izquierda ? -60 : ancho + 60,
      y: alto * (0.12 + Math.random() * 0.76),
      vx: Math.cos(ang) * cruce,
      vy: Math.sin(ang) * cruce * 0.4 + (Math.random() - 0.5) * 20,
      ang: ang,
      radio: RADIO_COMETA,
      vida: 0,
      golpeado: false
    };
  }

  function forzarCometa() {
    if (!estado.cometas) { estado.cometas = []; }
    estado.cometas.push(crearCometa());
    estado.siguienteCometa = reloj + CADENCIA_COMETA_MIN + Math.random() * (CADENCIA_COMETA_MAX - CADENCIA_COMETA_MIN);
    estado.cometaAvisoHasta = 0;
  }

  function actualizarCometas(dt) {
    var i;
    if (!estado.cometas) { estado.cometas = []; }
    if (estado.siguienteCometa === undefined) { estado.siguienteCometa = 0; }
    if (estado.cometaAvisoHasta === undefined) { estado.cometaAvisoHasta = 0; }
    if (reloj > estado.siguienteCometa && estado.cometas.length === 0 && !estado.terminado) {
      var ronda = RONDAS[estado.ronda] || RONDAS[0];
      if (ronda.cometa && Math.random() * 100 < ronda.cometa) {
        estado.cometaAvisoHasta = reloj + AVISO_COMETA;
        estado.siguienteCometa = estado.cometaAvisoHasta + 0.4;
        if (typeof sonar === 'function') { sonar('cometaAviso'); }
        if (typeof vibrar === 'function') { vibrar([20, 30, 20]); }
      } else {
        estado.siguienteCometa = reloj + CADENCIA_COMETA_MIN + Math.random() * (CADENCIA_COMETA_MAX - CADENCIA_COMETA_MIN);
      }
    }
    if (estado.cometaAvisoHasta > 0 && reloj > estado.cometaAvisoHasta && estado.cometas.length === 0 && !estado.terminado) {
      estado.cometas.push(crearCometa());
      estado.cometaAvisoHasta = 0;
      estado.siguienteCometa = reloj + CADENCIA_COMETA_MIN + Math.random() * (CADENCIA_COMETA_MAX - CADENCIA_COMETA_MIN);
      if (typeof sonar === 'function') { sonar('cometaPasa'); }
    }
    for (i = estado.cometas.length - 1; i >= 0; i--) {
      var c = estado.cometas[i];
      c.x += c.vx * dt;
      c.y += c.vy * dt;
      c.vida += dt;
      if (fueraDePantalla(c, 80)) {
        estado.cometas.splice(i, 1);
        continue;
      }
      if (estado.nave && !estado.terminado && c.golpeado === false && c.vida > 0.05) {
        if (cerca(estado.nave, c) < RADIO_COMETA + 9) {
          c.golpeado = true;
          if (typeof perderVida === 'function') { perderVida(); }
        }
      }
    }
  }

  function dibujarCometas() {
    if (!ctx || !estado.cometas) { return; }
    var i;
    for (i = 0; i < estado.cometas.length; i++) {
      var c = estado.cometas[i];
      ctx.save();
      ctx.translate(c.x, c.y);
      ctx.rotate(Math.atan2(c.vy, c.vx));
      ctx.fillStyle = '#f2d26a';
      ctx.beginPath();
      ctx.moveTo(4, 0);
      ctx.lineTo(-4, -2);
      ctx.lineTo(-4, 2);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#e66a4a';
      ctx.beginPath();
      ctx.arc(5, 0, 1.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  /* El cruce va de 96 a 130 px por segundo y el zigzag de 54 a 80. En un
     campo de 460 de alto eso son dos o tres cambios de lado antes de salir: se
     ve venir sin ser un adversario al que haya que adivinar. */
  function crearPlatillo() {
    var izquierda = Math.random() < 0.5;
    var cruce = 96 + Math.random() * 34;
    return {
      x: izquierda ? -70 : ancho + 70,
      y: alto * (0.22 + Math.random() * 0.56),
      vx: izquierda ? cruce : -cruce,
      vy: (Math.random() < 0.5 ? -1 : 1) * (54 + Math.random() * 26),
      giraEn: 0.8 + Math.random() * 0.5,
      disparoEn: 1.1 + Math.random() * 0.8,
      vida: 0,
      rumbo: izquierda ? 1 : -1,
      puntos: PLATILLO_PUNTOS,
      balas: []
    };
  }

  function invocarPlatillo() {
    estado.platillo = crearPlatillo();
    return { x: estado.platillo.x, y: estado.platillo.y, rumbo: estado.platillo.rumbo };
  }

  /* Sale con un dado por cada roca rota, y solo si no hay ya un platillo en el
     campo y se cumplio la espera de la salida anterior. La espera se cuenta
     desde que se va o desde que lo derriban, nunca desde que entra: mientras
     esta dentro, el freno de "solo uno a la vez" ya esta puesto y hacer correr
     dos relojes a la vez no anade nada. */
  function soltarPlatillo() {
    if (estado.platillo || esperaPlatillo > 0) { return; }
    if (Math.random() > RONDAS[estado.ronda].platillo) { return; }
    invocarPlatillo();
  }

  function moverPlatillo(dt) {
    var pf = estado.platillo;
    var i;
    pf.vida += dt;

    /* El zigzag es un reflejo de la velocidad lateral cada 0,8 o 1,3 s: como
       el magnitud no cambia, la trayectoria lateral es un triangulo limpio. */
    pf.giraEn -= dt;
    if (pf.giraEn <= 0) {
      pf.vy = -pf.vy;
      pf.giraEn = 0.8 + Math.random() * 0.5;
    }
    pf.x += pf.vx * dt;
    pf.y += pf.vy * dt;
    if (pf.y < 30) { pf.y = 30; pf.vy = Math.abs(pf.vy); }
    if (pf.y > alto - 30) { pf.y = alto - 30; pf.vy = -Math.abs(pf.vy); }

    for (i = pf.balas.length - 1; i >= 0; i--) {
      pf.balas[i].x += pf.balas[i].vx * dt;
      pf.balas[i].y += pf.balas[i].vy * dt;
      pf.balas[i].vida -= dt;
      if (pf.balas[i].vida <= 0 || fueraDePantalla(pf.balas[i], 20)) {
        pf.balas.splice(i, 1);
      }
    }

    pf.disparoEn -= dt;
    if (pf.disparoEn <= 0) {
      dispararPlatillo();
      pf.disparoEn = DISPARO_PLATILLO + Math.random() * 0.6;
    }

    if (pf.x < -120 || pf.x > ancho + 120) {
      estado.platillo = null;
      esperaPlatillo = PAUSA_PLATILLO;
    }
  }

  /* Apunta a la nave con medio angulo de error. Sin margen seria
     imposible; con mas, un disparo que casi nunca tocaria. La bala del
     platillo va a 300 px/s: mas rapida que la nave (265) para que obligue a
     moverse, y bastante mas lenta que la del jugador (470) para que de tiempo
     de reaccionar. Y de color distinto, que es como se distingue de un
     vistazo. */
  function dispararPlatillo() {
    var pf = estado.platillo;
    if (!pf || !estado.nave) { return; }
    var a = Math.atan2(estado.nave.y - pf.y, estado.nave.x - pf.x) + (Math.random() - 0.5) * 0.22;
    pf.balas.push({
      x: pf.x + Math.cos(a) * 16,
      y: pf.y + Math.sin(a) * 16,
      vx: Math.cos(a) * VELOCIDAD_DISPARO_PLATILLO,
      vy: Math.sin(a) * VELOCIDAD_DISPARO_PLATILLO,
      vida: 4
    });
    sonar('platilloDispara');
  }

  /* ---------------------------------------------------------------- jefe

     El Centinela, el jefe de la quinta fase. Es de la misma familia que el
     platillo: una sola entidad con posicion, disparo y choque. Entra de
     fuera del tablero, se mece en el aire de arriba, ataca por su orden y
     muere contando la vida que le van quitando las balas.

     Solo se diferencia del platillo en las cosas que un jefe pide: el
     nucleo, que solo esta abierto el ratito que sigue a cada ataque, y el
     anillo de vida, que se ve vaciarse desde la propia figura. */

  var JEFE = {
    RADIO: 54,            /* radio de colision del casco */
    ANILLO: 66,           /* radio del anillo de vida */
    VIDA: 80,
    ENTRADA: 1.5,         /* de y=-90 a su altura, en segundos */
    ALTURA: 0.24,         /* la parte del alto donde se queda */
    MECIDA_DE: 0.22,      /* los extremos del mecido, en fraccion del ancho */
    MECIDA_A: 0.78,
    MECIDA_SEG: 6,        /* periodo del mecido horizontal */
    ATAQUE_CADA: 6,       /* segundos entre un ataque y el siguiente */
    APERTURA: 2.5,        /* nucleo abierto despues de cada ataque */
    PATRONES: ['rocas', 'radial', 'laser'],
    LASER_AVISO: 1.2,     /* aviso con la linea fina */
    LASER_BARRIDO: 0.6,   /* el barrido que quita la vida */
    LASER_ANCHO: 18,
    RADIALES: 10,
    VELOCIDAD_RADIAL: 800,
    DANO_ABIERTO: 2,
    DANO_CERRADO: 1,
    FLOTE: 10,            /* quanto sube y baja sobre la altura donde se queda */
    FLOTE_SEG: 3.2,       /* periodo de esa flotacion vertical */
    NUCLEO_CERRADO: '#7a2030',
    NUCLEO_ABIERTO: '#ffd0a0'
  };

  function invocarJefe() {
    estado.jefe = {
      x: ancho / 2,
      y: -90,
      edad: 0,
      hp: JEFE.VIDA,
      hpMax: JEFE.VIDA,
      abierto: false,
      abiertoEn: 0,
      patron: 0,            /* indice del proximo ataque */
      ataqueEn: JEFE.ATAQUE_CADA,
      balas: [],
      laser: null
    };
    return estado.jefe;
  }

  function estadoJefe() {
    var j = estado.jefe;
    if (!j) { return null; }
    return {
      hp: j.hp,
      hpMax: j.hpMax,
      abierto: j.abierto,
      patron: JEFE.PATRONES[j.patron % JEFE.PATRONES.length],
      x: j.x,
      y: j.y
    };
  }

  /* Pone el siguiente ataque con su nombre y lo arma para que salga ya.
     Devuelve false si el nombre no es ninguno de los tres, para que no se
     entienda como hecho.
     El laser que estuviera en curso se cancela: el jefe no puede atacar dos
     veces a la vez y el aviso con el barrido se lleva casi dos segundos. Sin
     esto, forzar un patron mientras el laser barre no hace nada y parece que
     el gancho esta roto. */
  function forzarPatron(nombre) {
    var j = estado.jefe;
    if (!j) { return false; }
    for (var i = 0; i < JEFE.PATRONES.length; i++) {
      if (JEFE.PATRONES[i] === nombre) {
        j.patron = i;
        j.laser = null;
        j.ataqueEn = 0.001;
        return true;
      }
    }
    return false;
  }

  /* El nucleo se abre 2.5 s: es la ventana en la que cada bala del jugador
     vale el doble. Se cierra sola cuando se acaba el tiempo. */
  function abrirNucleo() {
    var j = estado.jefe;
    if (!j) { return false; }
    j.abierto = true;
    j.abiertoEn = JEFE.APERTURA;
    sonar('jefeNucleo');
    return true;
  }

  /* El mecido horizontal. Arranca cuando acaba la entrada, desde el centro
     del ancho, y por eso las dos fases de movimiento no se pisan. */
  function mecerJefe(j) {
    var amplitud = ((JEFE.MECIDA_A - JEFE.MECIDA_DE) / 2) * ancho;
    var pasos = Math.max(0, j.edad - JEFE.ENTRADA);
    return ancho / 2 +
           Math.sin(pasos * Math.PI * 2 / JEFE.MECIDA_SEG) * amplitud;
  }

  function moverJefe(dt) {
    var j = estado.jefe;
    var i;
    j.edad += dt;

    /* La entrada frena al llegar: sale rapida y se asienta suave. Mientras
       dura, la altura avanza y el mecido todavia no manda. */
    var progreso = Math.min(1, j.edad / JEFE.ENTRADA);
    progreso = 1 - (1 - progreso) * (1 - progreso);
    /* La flotacion vertical: el Centinela sube y baja diez unidades sin
       separarse de la altura donde se ha quedado. */
    var destino = Math.max(alto * JEFE.ALTURA,
                           BANDA_HUD + JEFE.ANILLO + JEFE.FLOTE + 8);
    j.y = -90 + (destino + 90) * progreso +
          Math.sin(j.edad * Math.PI * 2 / JEFE.FLOTE_SEG) * JEFE.FLOTE;
    j.x = mecerJefe(j);

    if (j.abierto) {
      j.abiertoEn -= dt;
      if (j.abiertoEn <= 0) { j.abierto = false; }
    }

    /* Las balas del abanico, como las del platillo: viven solas y se van
       cuando se salen del campo. */
    for (i = j.balas.length - 1; i >= 0; i--) {
      j.balas[i].x += j.balas[i].vx * dt;
      j.balas[i].y += j.balas[i].vy * dt;
      j.balas[i].vida -= dt;
      if (j.balas[i].vida <= 0 || fueraDePantalla(j.balas[i], 20)) {
        j.balas.splice(i, 1);
      }
    }

    if (estado.terminado) { return; }

    /* El laser va a su propio tiempo: avisar 1.2 s y barrer 0.6 s. Solo
       cuando el barrido acaba se abre el nucleo y se apunta el ataque
       siguiente: abrirlo pronto seria regalar la ventana buena. */
    if (j.laser) {
      if (j.laser.avisoEn > 0) {
        j.laser.avisoEn -= dt;
        if (j.laser.avisoEn <= 0) { sonar('jefeDispara'); }
      } else {
        j.laser.barridoEn -= dt;
        if (j.laser.barridoEn <= 0) {
          j.laser = null;
          abrirNucleo();
          j.ataqueEn = JEFE.ATAQUE_CADA;
        }
      }
      return;
    }

    if (j.edad >= JEFE.ENTRADA) {
      j.ataqueEn -= dt;
      if (j.ataqueEn <= 0) { atacarJefe(j); }
    }
  }

  /* Los tres ataques, siempre en el mismo orden. Cada uno acaba con el
     nucleo abierto 2.5 s, que es la racion de dano del jugador. */
  function atacarJefe(j) {
    var nombre = JEFE.PATRONES[j.patron % JEFE.PATRONES.length];
    j.patron++;
    if (nombre === 'rocas') {
      bombardearJefe(j);
    } else if (nombre === 'radial') {
      abanicoJefe(j);
    } else {
      laserJefe(j);
    }
  }

  /* Tres rocas de tamano 3 hacia abajo, desde el casco. */
  function bombardearJefe(j) {
    sonar('jefeDispara');
    for (var k = 0; k < 3; k++) {
      estado.rocas.push(crearRoca(3,
        j.x + (k - 1) * 30, j.y + 30,
        Math.PI / 2 + (k - 1) * 0.5 + (Math.random() - 0.5) * 0.2,
        estado.ronda));
    }
    abrirNucleo();
    j.ataqueEn = JEFE.ATAQUE_CADA;
  }

  /* Diez proyectiles en abanico hacia abajo, a 800 px por segundo. El abanico
     va centrado en la vertical: todos salen hacia el suelo, que es donde esta
     la nave, y los de los bordes se pierden si la nave ya se ha movido. */
  function abanicoJefe(j) {
    var amplitud = 1.4;
    for (var k = 0; k < JEFE.RADIALES; k++) {
      var a = Math.PI / 2 - amplitud / 2 +
              amplitud * (k / (JEFE.RADIALES - 1));
      j.balas.push({
        x: j.x + Math.cos(a) * (JEFE.RADIO + 6),
        y: j.y + Math.sin(a) * (JEFE.RADIO + 6),
        vx: Math.cos(a) * JEFE.VELOCIDAD_RADIAL,
        vy: Math.sin(a) * JEFE.VELOCIDAD_RADIAL,
        vida: 4
      });
    }
    sonar('jefeDispara');
    abrirNucleo();
    j.ataqueEn = JEFE.ATAQUE_CADA;
  }

  /* El laser avisa con una linea fina en la columna donde va a barrer: la
     columna queda donde estaba la nave al empezar el aviso, y esquivala
     moviendose. Mientras el barrido corre la nave tiene que estar fuera. */
  function laserJefe(j) {
    var n = estado.nave;
    var x = n ? n.x : ancho / 2;
    j.laser = {
      x: Math.max(30, Math.min(ancho - 30, x)),
      avisoEn: JEFE.LASER_AVISO,
      barridoEn: JEFE.LASER_BARRIDO,
      tocada: false
    };
    sonar('jefeAviso');
  }

  /* Cada bala quita 1 con el nucleo cerrado y 2 con el abierto. Devuelve la
     vida que queda, o null si el jefe ya no esta. Cuando la vida llega a
     cero el Centinela cae y lo que devuelve es 0, que es la vida que le
     queda: asi el gancho de prueba puede saber que lo mato. La caida solo
     puede entrar aqui una vez: con la vida a cero, estado.jefe se va antes
     de que la siguiente bala del mismo fotograma vuelva a mirarlo. */
  function tocarJefe(dano) {
    var j = estado.jefe;
    if (!j || estado.terminado) { return null; }
    j.hp -= dano;
    if (j.hp <= 0) {
      j.hp = 0;
      caerJefe();
      return 0;
    }
    return j.hp;
  }

  function danarJefe(cuanto) {
    return tocarJefe(cuanto);
  }

  function caerJefe() {
    var j = estado.jefe;
    var f = RONDAS[estado.ronda] || RONDAS[0];
    var a = f.acento || COLOR_PLATILLO;
    /* El estallido a tope de escala, con el trazo en blanco: la muerte del
       jefe tiene que pesar como lo que es. */
    estallar(j.x, j.y, 2.2, a, COLOR_NUCLEO, a);
    chispas(j.x, j.y, 30);
    sacudir(SACUDIDA_MAXIMA);
    vibrar(PATRONES.jefe);
    sonar('jefeMuere');
    estado.jefe = null;
    ganarRonda('El Centinela ha caido.');
  }

  /* ---------------------------------------------------------------- racha */

  /* Encadenar rocas sin que te den multiplica los puntos. La primera vale lo
     de siempre, la segunda el doble, la tercera el triple y de la cuarta en
     adelante x4. La ventana entre roca y roca es de 3 s: el arma del nivel 1
     tarda medio segundo en partir una mediana, asi que tres segundos dan para
     tres rocas de la misma cadena. Se corta al morir y al dejar pasar la
     ventana. */
  var VENTANA_RACHA = 3;
  var MULTIPLICADOR_MAX = 4;

  function encadenar(cuantas) {
    estado.racha += cuantas;
    estado.multiplicador = Math.min(MULTIPLICADOR_MAX, estado.racha);
    estado.ventanaRacha = VENTANA_RACHA;
    if (estado.multiplicador > estado.multiplicadorAnterior) {
      estado.multSubeEn = reloj;
    }
    estado.multiplicadorAnterior = estado.multiplicador;
  }

  function cortarRacha() {
    estado.racha = 0;
    estado.multiplicador = 1;
    estado.multiplicadorAnterior = 1;
    estado.ventanaRacha = 0;
    estado.multSubeEn = -99;
  }

  /* ----------------------------------------------------------- movimiento */

  function actualizar(dt) {
    var n = estado.nave;
    var i;

    if (n) {
      if (estado.girando && !estado.terminado) {
        n.ang += estado.girando * VUELTA * dt;
      }
      /* La nave empuja SOLO mientras el jugador la esta llevando: con las flechas
     apretadas, o con el dedo sobre la pantalla. Al soltar, la nave sigue a
         deriva y frena sola. Con el empuje siempre encendido el jugador no
         podia esquivar nada y se perdia en ocho segundos sin tocar nada. */
      if (estado.empuja) {
        n.vx += Math.cos(n.ang) * IMPULSO * dt;
        n.vy += Math.sin(n.ang) * IMPULSO * dt;
      }
      var fr = Math.pow(FROTE, dt * 60);
      n.vx *= fr;
      n.vy *= fr;
      var sp = Math.sqrt(n.vx * n.vx + n.vy * n.vy);
      if (sp > MAXIMO) {
        n.vx = (n.vx / sp) * MAXIMO;
        n.vy = (n.vy / sp) * MAXIMO;
      }
      n.x += n.vx * dt;
      n.y += n.vy * dt;
      envolver(n, 24);
      if (n.escudo > 0) { n.escudo -= dt; }
      if (n.escudo <= 0) { n.escudoBotin = false; }
      /* El escudo de botin no es un reloj aparte: es el MISMO contador de
         invulnerabilidad que ya llevaba la nave, y lo unico que se marca es de
         donde viene. Asi no hay dos cuentas que se puedan desincronizar. */
      estado.efectos.escudo = (n.escudoBotin && n.escudo > 0) ? n.escudo : 0;
      /* El rastro del motor sale mientras la nave se mueve de verdad, y se
         apaga solo. Al pararse, las particulas que quedaban mueren en su
         cuenta de vida y la lista vuelve a cero. */
      empujarEstelaNave(dt, empujeNave(n));
    }

    moverFondo(dt);
    moverEstela(dt);
    moverEstallidos(dt);
    if (fx.fogonazos.length) {
      for (i = fx.fogonazos.length - 1; i >= 0; i--) {
        fx.fogonazos[i].vida -= dt;
        if (fx.fogonazos[i].vida <= 0) { fx.fogonazos.splice(i, 1); }
      }
    }
    moverDestellos(dt);

    for (i = 0; i < estado.balas.length; i++) {
      var b = estado.balas[i];
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.vida -= dt;
      envolver(b, 5);
    }
    estado.balas = estado.balas.filter(function (x) { return x.vida > 0; });

    for (i = 0; i < estado.rocas.length; i++) {
      var r = estado.rocas[i];
      r.x += r.vx * dt;
      r.y += r.vy * dt;
      r.ang += r.va * dt;
      envolver(r, RADIO[r.tam] + 4);
    }

    for (i = 0; i < estado.chispas.length; i++) {
      var c = estado.chispas[i];
      c.x += c.vx * dt;
      c.y += c.vy * dt;
      c.vida -= dt;
      c.vx *= 0.97;
      c.vy *= 0.97;
    }
    estado.chispas = estado.chispas.filter(function (x) { return x.vida > 0; });

    /* Los relojes del jugador van aqui, antes del corte de partida terminada,
       para que el marcador no prometa un efecto que en realidad ya se acabo
       mientras se ve el cartel de fin. */
    if (estado.efectos.cadencia > 0) {
      estado.efectos.cadencia = Math.max(0, estado.efectos.cadencia - dt);
    }
    if (estado.efectos.perforante > 0) {
      estado.efectos.perforante = Math.max(0, estado.efectos.perforante - dt);
    }
    if (estado.ventanaRacha > 0) {
      estado.ventanaRacha -= dt;
      if (estado.ventanaRacha <= 0) { cortarRacha(); }
    }

    for (i = 0; i < estado.botines.length; i++) {
      var bo = estado.botines[i];
      bo.x += bo.vx * dt;
      bo.y += bo.vy * dt;
      bo.ang += bo.va * dt;
      bo.vida -= dt;
      envolver(bo, 22);
    }
    estado.botines = estado.botines.filter(function (x) { return x.vida > 0; });

    /* El botin se coge tocandolo con la nave. Con la envoltura, porque el
       botin si es un habitante del aro: uno que flota pegado al borde tambien
       se recoge desde el otro lado. */
    if (n && !estado.terminado) {
      for (i = estado.botines.length - 1; i >= 0; i--) {
        if (cerca(n, estado.botines[i]) < RECOGER_BOTIN) {
          aplicarBotin(estado.botines.splice(i, 1)[0]);
        }
      }
    }

    actualizarCometas(dt);
    if (estado.platillo) { moverPlatillo(dt); }
    else if (esperaPlatillo > 0) { esperaPlatillo -= dt; }
    if (estado.jefe) { moverJefe(dt); }

    if (estado.terminado) { return; }

    /* Balas contra rocas. Cada roca solo recibe una bala por paso, y la que
       se lleva se parte en el acto. Con el botin de perforante la bala sigue
       de largo, pero recuerda que roca toco, para no reventarla dos veces. */
    var quedan = [];
    var rotas = 0;
    var puntosGanados = 0;
    for (i = 0; i < estado.rocas.length; i++) {
      var roca = estado.rocas[i];
      var muerta = false;
      for (var j = estado.balas.length - 1; j >= 0; j--) {
        var bala = estado.balas[j];
        if (bala.perfora && bala.golpes.indexOf(roca.id) !== -1) { continue; }
        if (cerca(bala, roca) < RADIO[roca.tam] + 5) {
          if (bala.perfora) {
            bala.golpes.push(roca.id);
            bala.bajas++;
          } else {
            estado.balas.splice(j, 1);
          }
          /* El destello del impacto va en una lista aparte: la roca que lo
             recibe se borra en este mismo fotograma. Con el perforante se ve
             una roca entera un instante y se parte justo despues. */
          destellar(bala.x, bala.y, bala.vx, bala.vy, RADIO[roca.tam]);
          muerta = true;
          break;
        }
      }
      if (muerta) {
        rotas++;
        puntosGanados += roca.puntos;
        chispas(roca.x, roca.y, 11);
        /* Todo lo de la rotura se mide con el tamano de la roca: el numero
           de particulas, el radio del anillo y la sacudida. Una enorme tiene
           que ser un acontecimiento y una pequena un chispazo. */
        var frF = RONDAS[roca.ronda] || RONDAS[0];
        estallar(roca.x, roca.y, ESCALA_ROCA[roca.tam], frF.acento || roca.color, frF.acento || roca.borde, frF.acento);
        sacudir(SACUDIDA_ROCA[roca.tam]);
        vibrar(PATRONES.roca[roca.tam]);
        sonar(SONIDO_ROCA[roca.tam]);
        soltarBotin(roca);
        soltarPlatillo();
        var nuevas = partir(roca);
        for (var k = 0; k < nuevas.length; k++) { quedan.push(nuevas[k]); }
      } else {
        quedan.push(roca);
      }
    }
    estado.rocas = quedan;

    /* Los puntos se cuentan DESPUES de encadenar(), no antes. Si se contaran
       antes, la primera roca de cada cadena se quedaria sin multiplicar y el
       multiplicador subiria una roca tarde: el jugador veria en el marcador un
       x2 que multiplico a la roca anterior. Con este orden, el numero que se
       ve en pantalla es exactamente el que multiplico a lo que se rompio. */
    if (rotas > 0) {
      encadenar(rotas);
      estado.puntos += puntosGanados * estado.multiplicador;
      anunciarPuntos();
    }

    /* El platillo lo derriba un balazo, y con el botin de perforante la bala
       sigue de largo hacia la siguiente roca. Sus propias balas se van con
       el: sumar 300 puntos y perder una nave en el mismo cuadro seria la
       forma mas rapida de que el jugador dejara de querer al platillo. */
    if (estado.platillo && !estado.terminado) {
      var plat = estado.platillo;
      for (i = estado.balas.length - 1; i >= 0; i--) {
        if (plano(estado.balas[i], plat) >= RADIO_PLATILLO + 5) { continue; }
        if (!estado.balas[i].perfora) { estado.balas.splice(i, 1); }
        estado.puntos += PLATILLO_PUNTOS * estado.multiplicador;
        chispas(plat.x, plat.y, 20);
        /* El platillo revienta con la misma escala de explosion pero con mas
           amplitud: pesa como cuatro rocas grandes y se nota. */
        var frF2 = RONDAS[estado.ronda] || RONDAS[0];
        estallar(plat.x, plat.y, 1.15, COLOR_PLATILLO, '#ff9d94', frF2.acento);
        sacudir(SACUDIDA_PLATILLO);
        vibrar(PATRONES.platillo);
        sonar('platilloMuere');
        estado.platillo = null;
        esperaPlatillo = PAUSA_PLATILLO;
        pintarMarcador();
        anunciar('Platillo derribado. ' + PLATILLO_PUNTOS + ' puntos.');
        break;
      }
    }

    /* Las balas del jugador contra el Centinela. La bala se consume como
       con el platillo, y el dano depende de como este el nucleo: cerrado
       vale 1, abierto 2. */
    if (estado.jefe && !estado.terminado) {
      for (i = estado.balas.length - 1; i >= 0; i--) {
        var balaJefe = estado.balas[i];
        if (plano(balaJefe, estado.jefe) >= JEFE.RADIO + 5) { continue; }
        if (!balaJefe.perfora) { estado.balas.splice(i, 1); }
        tocarJefe(estado.jefe.abierto ? JEFE.DANO_ABIERTO : JEFE.DANO_CERRADO);
        /* Si el jefe ha caido, estado.jefe ya no esta: el bucle se corta
           aqui para no mirar un jefe que ya no existe. */
        if (!estado.jefe) { break; }
      }
    }

    if (n && n.escudo <= 0) {
      for (i = 0; i < estado.rocas.length; i++) {
        if (cerca(n, estado.rocas[i]) < RADIO[estado.rocas[i].tam] + 9) {
          perderVida();
          break;
        }
      }
    }

    /* El platillo y sus balas matan como una roca. Solo si la nave sigue
       siendo la misma que ha entrado a este cuadro: si una roca ya la mato,
       estado.nave es otro objeto y comprobar contra el seria quitarle dos
       vidas de un golpe. */
    if (estado.nave === n && n.escudo <= 0 && estado.platillo) {
      if (plano(n, estado.platillo) < RADIO_PLATILLO + 9) {
        perderVida();
      } else {
        for (i = estado.platillo.balas.length - 1; i >= 0; i--) {
          if (plano(n, estado.platillo.balas[i]) < 12) {
            estado.platillo.balas.splice(i, 1);
            perderVida();
            break;
          }
        }
      }
    }
    /* Los cometas matan a la nave directamente; las balas no les hacen dano */
    if (n && n.escudo <= 0 && !estado.terminado && estado.cometas) {
      for (i = estado.cometas.length - 1; i >= 0; i--) {
        if (cerca(n, estado.cometas[i]) < RADIO_COMETA + 9) {
          perderVida();
          break;
        }
      }
    }

    /* El Centinela es el platillo de la quinta: casco que mata al tocarlo y
       balas propias. La misma proteccion de la nave que ha entrado en este
       cuadro: si algo ya la mato en el fotograma, el jefe no la mata dos
       veces. */
    if (estado.nave === n && n && n.escudo <= 0 && estado.jefe) {
      if (plano(n, estado.jefe) < JEFE.RADIO + 9) {
        perderVida();
      } else {
        for (i = estado.jefe.balas.length - 1; i >= 0; i--) {
          if (plano(n, estado.jefe.balas[i]) < 12) {
            estado.jefe.balas.splice(i, 1);
            perderVida();
            break;
          }
        }
      }
    }

    /* El laser quita una vida por barrido, no por fotograma: la marca de
       tocada solo se limpia al terminar el barrido. La nave esta dentro si
       su centro cae en la columna con margen de su propio cuerpo. */
    if (estado.nave === n && n && estado.jefe && estado.jefe.laser &&
        !estado.terminado && n.escudo <= 0) {
      var golpeLaser = estado.jefe.laser;
      if (!golpeLaser.tocada && golpeLaser.avisoEn <= 0 && golpeLaser.barridoEn > 0 &&
          Math.abs(n.x - golpeLaser.x) <= JEFE.LASER_ANCHO / 2 + 8) {
        golpeLaser.tocada = true;
        perderVida();
      }
    }

    /* Despejar el campo no gana la ronda si el Centinela sigue en pie: la
       quinta solo se cierra cuando el jefe cae. */
    if (!estado.terminado && estado.rocas.length === 0 && !estado.jefe) {
      ganarRonda();
    }
  }

  /* --------------------------------------------------------------- rondas */

  function perderVida() {
    var n = estado.nave;
    chispas(n.x, n.y, 26);
    /* La nave tambien estalla. Con la escala de una roca enorme y el color de
       la cabina, para que se vea de donde salio. */
    var frF3 = RONDAS[estado.ronda] || RONDAS[0];
    estallar(n.x, n.y, 1.2, COLOR_CABINA, COLOR_CABINA_ALTA, frF3.acento);
    estado.vidas--;
    estado.balas = [];
    /* El arma vuelve a su nivel mas bajo y todo lo que se llevaba encima se
       cae. Sin esto el botin seria decoracion: se recogeria una vez y el
       resto de la partida se jugaria con el. */
    estado.arma = 1;
    estado.efectos.cadencia = 0;
    estado.efectos.perforante = 0;
    estado.efectos.escudo = 0;
    estado.efectosAviso.cadencia = false;
    estado.efectosAviso.perforante = false;
    estado.efectosAviso.escudo = false;
    cortarRacha();
    /* Las balas que el platillo ya habia soltado se retiran con la nave. La
       racha se cae igualmente, pero la nueva nave nace con su ratito de
       escudo y dos o tres disparos sueltos serian una trampa. */
    if (estado.platillo) { estado.platillo.balas = []; }
    /* Lo mismo vale para las balas del Centinela: la nave nueva nace con su
       ratito de escudo, y quedarse con ellas seria otro golpe sin aviso. */
    if (estado.jefe) { estado.jefe.balas = []; }
    if (estado.vidas <= 0) {
      estado.terminado = true;
      estado.entero = false;
      estado.platillo = null;
      estado.jefe = null;
      soltarNave();
      /* Cuando la ultima nave se pierde NO se vibra tambien el patron de
         perder vida: dos patrones seguidos se sentiran como uno solo, y lo
         que tiene que distinguir el pulgar es "se acabo la partida". */
      sacudir(SACUDIDA_VIDA);
      vibrar(PATRONES.fin);
      sonar('naveMuere');
      sonar('fin');
      cerrar('Te quedaste sin naves. Quedaron ' + estado.rocas.length + ' rocas en el campo.');
      pintarMarcador();
      mostrarFin();
      return;
    }
    soltarNave();
    /* La sacudida se queda armada y se apaga sola: el bucle de dibujo no se
       para al terminar la partida -solo se para con la pausa o al esconder la
       pestana- asi que aplicarSacudida() la refresca hasta que su reloj llega a
       cero y devuelve el transform a cadena. Limpiarla aqui, en el mismo
       fotograma en que se arma, era cancelarla antes de que se viera. */
    sacudir(SACUDIDA_VIDA);
    vibrar(PATRONES.vida);
    sonar('naveMuere');
    pintarMarcador();
    anunciar('Nave destruida. Te quedan ' + estado.vidas + ' de 3.');
  }

  /* Con el texto aparte, la caida del Centinela cierra la ronda con su
     propia frase y no con la generica. */
  function ganarRonda(texto) {
    estado.terminado = true;
    estado.entero = true;
    estado.estrellas[estado.ronda] = estado.vidas;
    /* El platillo se va con la ronda: si se queda, sigue cruzando y disparando
       sobre un tablero que ya no se juega. */
    estado.platillo = null;
    estado.botines = [];
    soltarNave();
    /* Como al perder una nave: el bucle sigue dando fotogramas con la partida
       terminada, y por eso la sacudida se ve y se apaga sola. */
    sacudir(SACUDIDA_RONDA);
    vibrar(PATRONES.ronda);
    sonar('ronda');
    cerrar(texto || 'Campo despejado con ' + estado.vidas +
           (estado.vidas === 1 ? ' nave viva.' : ' naves vivas.'));
    pintarMarcador();
    sincronizarHud();
  }

  function cerrar(texto) {
    nodos.textoTurno.textContent = texto + ' Puntos: ' + estado.puntos + '.';
    nodos.btnSeguir.textContent = estado.entero
      ? (estado.ronda < RONDAS.length - 1 ? 'Fase siguiente' : 'Ver el resultado')
      : 'Otra vez';
    nodos.turno.hidden = false;
    pintarEstrellas();
    sincronizarHud();
    anunciar(texto + (estado.entero ? ' Fase superada.' : ' Fase perdida.') +
             ' Fase ' + (estado.ronda + 1) + ' de ' + RONDAS.length + '.');
  }

  function abrirRonda(n) {
    estado.ronda = n;
    /* El cielo se vuelve a cocer aqui: su nebulosa lleva el color y la
       mancha de la fase, y si no se recociera cambiaria de fase sin cambiar
       de cielo hasta que el visor se redimensionara. */
    fondoClave = '';
    prepararFondo();
    estado.puntos = 0;
    estado.vidas = VIDA;
    estado.terminado = false;
    estado.entero = false;
    estado.finalizado = false;
    estado.balas = [];
    estado.chispas = [];
    estado.botines = [];
    estado.platillo = null;
    /* El Centinela solo entra en la fase que lo lleva, y reabrir la ronda lo
       trae de vuelta con la vida entera: perder y repetir es otra pelea. */
    if (RONDAS[n].jefe) { invocarJefe(); } else { estado.jefe = null; }
    if (estado.cometas) { estado.cometas = []; }
    if (estado.cometaAvisoHasta) { estado.cometaAvisoHasta = 0; }
    if (estado.siguienteCometa) { estado.siguienteCometa = 0; }
    limpiarPintura();
    // estado.arma no se resetea; se conserva entre fases
    estado.efectos.cadencia = 0;
    estado.efectos.perforante = 0;
    estado.efectos.escudo = 0;
    estado.efectosAviso.cadencia = false;
    estado.efectosAviso.perforante = false;
    estado.efectosAviso.escudo = false;
    cortarRacha();
    /* La espera del platillo se sortea corta y no entera. Con la de antes, una
       ronda de trece segundos se la comia entera y el platillo no llegaba a
       verse nunca en la primera ronda. */
    esperaPlatillo = 3 + Math.random() * 6;
    soltarNave();
    soltarRonda(n);
    despejar();   // las rocas de la ronda nueva tampoco nacen encima
    if (estado.cometas) { estado.cometas = []; }
    if (estado.cometaAvisoHasta) { estado.cometaAvisoHasta = 0; }
    estado.siguienteCometa = reloj + 2 + Math.random() * 4;

    nodos.tituloRonda.textContent = 'Fase ' + (n + 1) + ' de ' + RONDAS.length;
    nodos.lemaRonda.textContent = RONDAS[n].lema;
    nodos.turno.hidden = true;
    nodos.pista.hidden = true;
    if (nodos.btnPista) { nodos.btnPista.setAttribute('aria-expanded', 'false'); }
    ocultarFin();
    if (typeof mostrarAvisoFase === 'function') { mostrarAvisoFase(n); }

    pintarEstrellas();
    pintarMarcador();
    pintarEfectos();
    anunciar('Fase ' + (n + 1) + ' de ' + RONDAS.length + '. ' + RONDAS[n].lema +
             ' Empiezan ' + RONDAS[n].rocas + ' rocas enormes.');
    /* Al arrancar la pagina se abre la ronda 0 con el MENU delante: enfocar
       entonces el lienzo dejaba el foco en un nodo tapado por el menu, y el
       primer tabulador saltaba a un sitio que no se ve. Con la partida ya en
       marcha si se enfoca, que es lo que permite jugar con el teclado desde el
       primer instante. Sin preventScroll, enfocar arrastra la pagina hacia el
       tablero y se pierde el titulo. */
    if (partidaEmpezada) { lienzo.focus({ preventScroll: true }); }
  }

  /* Las estrellas cuentan la PARTIDA, no la ronda: al empezar una partida
     nueva vuelven a cero, y al pasar a la ronda siguiente se conservan las
     que ya se han ganado. Por eso la limpieza va aqui y no en abrirRonda(),
     que se llama tambien entre rondas de la misma partida. */
  function abrirPartida() {
    estado.estrellas = [];
    for (var es = 0; es < RONDAS.length; es++) { estado.estrellas.push(0); }
    estado.arma = 1;
    abrirRonda(0);
  }

  var avisoFaseTimer = null;

  function mostrarAvisoFase(n) {
    var aviso = nodos.avisoFase;
    if (!aviso) { return; }
    if (nodosMarco.fin && !nodosMarco.fin.hidden) { aviso.hidden = true; return; }
    if (nodosMarco.menu && !nodosMarco.menu.hidden) { aviso.hidden = true; return; }
    var r = RONDAS[n] || RONDAS[0];
    if (nodos.avisoFaseRotulo) { nodos.avisoFaseRotulo.textContent = 'Fase ' + (n + 1) + ' de ' + RONDAS.length; }
    if (nodos.avisoFaseNombre) { nodos.avisoFaseNombre.textContent = r.nombre || ''; }
    if (nodos.avisoFaseLema) { nodos.avisoFaseLema.textContent = r.lema || ''; }
    aviso.hidden = false;
    if (avisoFaseTimer) { clearTimeout(avisoFaseTimer); avisoFaseTimer = null; }
    avisoFaseTimer = setTimeout(function () {
      aviso.hidden = true;
      avisoFaseTimer = null;
    }, 2800);
  }

  /* R devuelve el juego al principio: ronda 1, cero puntos, tres naves y
     cero estrellas. abrirRonda(0) ya se encarga de todo lo demas. */
  function reiniciar() {
    if (pausado) { seguir(); }
    abrirPartida();
    anunciar('Partida reiniciada. Fase 1 de ' + RONDAS.length + '.');
  }

  function siguiente() {
    if (!estado.entero) { abrirRonda(estado.ronda); return; }
    if (estado.ronda < RONDAS.length - 1) { abrirRonda(estado.ronda + 1); return; }
    if (estado.finalizado) { abrirPartida(); return; }
    estado.finalizado = true;
    var total = 0;
    for (var s = 0; s < estado.estrellas.length; s++) { total += estado.estrellas[s] || 0; }
    var maxEst = RONDAS.length * 3;
    nodos.textoTurno.textContent = 'Las cinco fases estan hechas. Suman ' + total + ' de ' + maxEst + ' estrellas.';
    nodos.btnSeguir.textContent = 'Jugar de nuevo';
    nodos.turno.hidden = false;
    anunciar('Fin. ' + total + ' de ' + maxEst + ' estrellas.');
  }

  /* ---------------------------------------------------------------- texto */

  function contarRocas() {
    var c = { 4: 0, 3: 0, 2: 0, 1: 0 };
    for (var i = 0; i < estado.rocas.length; i++) { c[estado.rocas[i].tam]++; }
    return c;
  }

  function pintarEstrellas() {
    var caja = nodos.estrellas;
    if (!caja) { return; }
    caja.innerHTML = '';
    var n = estado.estrellas[estado.ronda] || 0;
    var svg = '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M10 1.6l2.6 5.3 5.8.8-4.2 4.1 1 5.8L10 14.9l-5.2 2.7 1-5.8L1.6 7.7l5.8-.8z"/></svg>';
    for (var k = 0; k < 3; k++) {
      var env = document.createElement('span');
      env.innerHTML = svg;
      var s = env.firstChild;
      if (s) { s.setAttribute('class', 'estrella ' + (k < n ? 'estrella--ganada' : 'estrella--perdida')); }
      caja.appendChild(s || env);
    }
    if (nodos.estrellasTxt) { nodos.estrellasTxt.textContent = n + ' de 3 estrellas.'; }
  }

  function pintarMarcador() {
    var c = contarRocas();
    nodos.puntos.textContent = estado.puntos;
    nodos.rondaActual.textContent = estado.ronda + 1;
    nodos.rocasTotales.textContent = estado.rocas.length;
    nodos.vidas.textContent = estado.vidas;
    nodos.enormes.textContent = c[4];
    nodos.grandes.textContent = c[3];
    nodos.medianas.textContent = c[2];
    nodos.pequenas.textContent = c[1];
    if (nodos.puntos2) { nodos.puntos2.textContent = estado.puntos; }
    if (nodos.rocas2) { nodos.rocas2.textContent = estado.rocas.length; }
    if (nodos.vidas2) { nodos.vidas2.textContent = estado.vidas; }
    texto(nodos.arma, estado.arma + ' de ' + NIVEL_ARMA_MAX);
    texto(nodos.racha, String.fromCharCode(215) + estado.multiplicador);
    /* La racha se pinta en el color del acento durante seis decimas de
       segundo al subir, que es lo que hace que se note sin tener que leer. */
    var subiendo = reloj - estado.multSubeEn < 0.6;
    if (subiendo !== estado.rachaSube) {
      estado.rachaSube = subiendo;
      nodos.racha.classList.toggle('astro__cifra--sube', subiendo);
    }
    texto(nodos.estado, estado.terminado
      ? (estado.entero ? 'Campo despejado' : 'Sin naves')
      : 'Rocas en el campo: ' + estado.rocas.length);
  }

  /* Escribir en el DOM lo que no ha cambiado no vale la pena: el marcador se
     refresca diez veces por segundo y casi siempre dice lo mismo. */
  function texto(nodo, valor) {
    if (nodo && nodo.textContent !== valor) { nodo.textContent = valor; }
  }

  /* La barra de efectos: que lleva el jugador ahora mismo, cuanto le queda y
     cuando se acaba. Los tres nombres, sus tres cuentas y el aviso en rojo de
     los ultimos segundos. El contenido sale de aqui y solo de ahi, que es lo
     que evita que el motor y la pagina digan cosas distintas. */
  function pintarEfectos() {
    var filas = '';
    if (estado.efectos.cadencia > 0) {
      filas += filaEfecto('cadencia', 'Cadencia', estado.efectos.cadencia);
    }
    if (estado.efectos.perforante > 0) {
      filas += filaEfecto('perforante', 'Perforante', estado.efectos.perforante);
    }
    if (estado.efectos.escudo > 0) {
      filas += filaEfecto('escudo', 'Escudo', estado.efectos.escudo);
    }
    if (nodos.efectos.innerHTML !== filas) { nodos.efectos.innerHTML = filas; }
    /* La barra se esconde sola cuando no queda ningun efecto. Con el hidden
       puesto siempre se llega antes: un elemento con hidden y con contenido
       es un elemento que el lector de pantalla se salta. */
    nodos.efectos.hidden = filas === '';
    avisarSiSeAcaba('cadencia', 'Cadencia', estado.efectos.cadencia);
    avisarSiSeAcaba('perforante', 'Perforante', estado.efectos.perforante);
    avisarSiSeAcaba('escudo', 'Escudo', estado.efectos.escudo);
  }

  /* La pieza de la barra. Solo lleva texto que genera el propio motor: el
     nombre de un tipo de botin y un numero con un decimal. */
  function filaEfecto(clave, nombre, segundos) {
    var poca = segundos <= AVISO_EFECTO;
    return '<span class="astro__efecto' + (poca ? ' astro__efecto--alerta' : '') +
           '"><i class="astro__botin astro__botin--' + clave + '" aria-hidden="true"></i>' +
           nombre + ' <b>' + segundos.toFixed(1) + ' s</b>' +
           (poca ? ' &middot; se acaba' : '') + '</span>';
  }

  /* El aviso se dice una vez por efecto, no diez veces por segundo. El
    aviso se limpia al recogerlo otra vez, en aplicarBotin(). */
  function avisarSiSeAcaba(clave, nombre, segundos) {
    if (segundos <= 0 || segundos > AVISO_EFECTO || estado.efectosAviso[clave]) { return; }
    estado.efectosAviso[clave] = true;
    anunciar('Se acaba ' + nombre.toLowerCase() + '.');
  }

  function anunciar(texto) {
    if (nodos.viva.textContent !== texto) { nodos.viva.textContent = texto; }
  }

  /* "1 enorme" y "2 enormes": el aviso se lee en voz alta, y suene muy mal
     si dice "1 enormes". */
  function plural(n, uno, varios) {
    return n === 1 ? uno : varios;
  }

  /* Cada vez que se rompe una roca hay que refrescar el panel: las seis
     cuentas del marcador son la progresion a la vista, y si se quedaran
     congeladas el jugador no veria formarse el 1, 2, 4 y 8. */
  function anunciarPuntos() {
    var c = contarRocas();
    pintarMarcador();
    anunciar('Puntos ' + estado.puntos +
             (estado.multiplicador > 1 ? ' (racha ' + estado.multiplicador + '). ' : '. ') +
             'En el campo quedan ' + estado.rocas.length +
             ' rocas: ' + c[4] + ' ' + plural(c[4], 'enorme', 'enormes') +
             ', ' + c[3] + ' ' + plural(c[3], 'grande', 'grandes') +
             ', ' + c[2] + ' ' + plural(c[2], 'mediana', 'medianas') +
             ' y ' + c[1] + ' ' + plural(c[1], 'pequena', 'pequenas') + '.');
  }

  /* ==================================================================== */
  /* PINTURA                                                              */
  /*                                                                       */
  /* Todo lo que hay de aqui para abajo dibuja, y nada de aqui cambia una  */
  /* regla del juego. Lo que si cambia de sitio son tres cosas: el tamano  */
  /* del bitmap, que antes se estiraba; la sacudida, que se aplica al      */
  /* lienzo y no al estado; y la hapticidad, que solo se dispara en        */
  /* eventos y nunca en el bucle de dibujo.                               */
  /* ==================================================================== */

  /* ------------------------------------------------------------- paleta */

  /* Los colores que ya usaba el lienzo, y los tintes nuevos que se han
     derivado de ellos. No hay ningun color ajeno a la paleta: cada tinte es
     el color de al lado con mas o menos luz, o el fondo #1a1219 con mas o
     menos luz. */
  var COLOR_FONDO = '#1a1219';
  var COLOR_SOMBRA = '#120c12';      /* el fondo al 65 %, para el bisel */
  var COLOR_NEBULOSA_A = '#1b2f3a';  /* azul de la serie #5b8aa8, al 25 % */
  var COLOR_NEBULOSA_B = '#2a2036';  /* ciruela de la serie #a394c9 */
  var COLOR_NEBULOSA_C = '#13302b';  /* verdeagua de la serie #4f9d8f */
  var COLOR_VINETA = '#0e080d';      /* el fondo al 55 % */
  var COLOR_POLVO = '#e8d9dc';       /* el del polvo que ya estaba */
  var COLOR_NUCLEO = '#fff6e2';      /* el alma de las balas y del fuego */
  var COLOR_BALA = '#f2c98a';        /* el ambar de las balas del jugador */
  var COLOR_PLATILLO = '#ff6b5e';   /* el rojo: solo lo usa el platillo */
  var COLOR_CABINA = '#5fd0c4';      /* la cabina encendida, turquesa */
  var COLOR_CABINA_ALTA = '#a9f2ea';/* su reflejo */
  /* El naranja del ala exterior del motor: el rojo del platillo oscurecido,
     para que la llama sea de la familia sin competir con sus balas. */
  var COLOR_LLAMA = '#e8936a';
  var DESTELLO_ROCA = 0.13;         /* segundos que dura el destello de impacto */

  /* El estado de dibujo. No vive dentro de estado porque estado es lo que
     se puede leer desde la consola para comprobar el juego, y ahi solo
     deberia haber reglas. Esto es pintura: se puede vaciar entero en
     cualquier momento sin que cambie un solo punto. */
  var fx = {
    /* Las tres capas de estrellas y su desplazamiento actual. */
    capas: [],
    /* El tiempo que lleva vivo el fondo, para la deriva de las nebulosas y
       el parpadeo de las estrellas. */
    relojFondo: 0,
    /* La estela de la nave y de los motores. */
    estela: [],
    relojEstela: 0,
    /* Las explosiones vivas. */
    estallidos: [],
    /* Los fogonazos de la boca del canon. */
    fogonazos: [],
    /* Los destellos de impacto de las rocas. Viven aparte y no en la roca
       porque la roca que recibe la bala se borra en el MISMO fotograma en que
       se le pondria el destello: si viviera en ella, no se veria nunca. */
    destellos: [],
    /* La sacudida: magnitud acumulada y momento en que termina. */
    sacudidaMag: 0,
    sacudidaFin: -1,
    sacudidas: 0,
    /* La hapticidad: cuantas veces se ha pedido, cuantas no se ha podido y
       cuantas se han descartado porque estaba apagada en el menu. */
    vibraciones: 0,
    vibracionFallos: 0,
    vibracionApagada: 0,
    /* El sonido: cuantos efectos se han lanzado y cuantos se han descartado
       por los topes de voces. Nunca prohibe jugar: si no hay audio, suman
       cero y todo lo demas funciona igual. */
    sonidos: 0,
    sonidosDescartados: 0,
    /* La cuenta de fotogramas, para medir. */
    fotogramas: 0,
    /* El detalle de la fase: las motas de polvo, las rayas de hielo y el
       rayo de la tormenta. Vive aqui porque es pintura: se puede vaciar
       entero sin que cambie ni una regla del juego. */
    detalle: {
      motas: [],
      rayas: [],
      rayoPuntos: [],
      rayoHasta: 0,
      proximoRayo: 0
    }
  };

  /* TOPES. Ninguna de las cuatro listas de pintura puede crecer sin limite:
     son las que mas caben en un fotograma, y las que si se
     desbordan se comen el tiempo de dibujo y hacen el juego injugable. */
  var TOPE_ESTRELAS = 210;
  var TOPE_ESTELA = 160;
  var TOPE_ESTALLIDOS = 20;
  var TOPE_FOGONAZOS = 48;
  var TOPE_DESTELLOS = 24;
  /* Por debajo de este empuje el rastro se apaga: es donde la nave ya solo
     lleva la llama piloto y se ve quieta. */
  var UMBRAL_ESTELA = 0.12;

  /* prefers-reduced-motion. Se lee una vez por fotograma, no una vez por
     estrella ni por particula: matchMedia no es gratis. */
  var consultaMovimiento = (typeof window !== 'undefined' && window.matchMedia)
    ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;

  function sinAnimacion() {
    return !!(consultaMovimiento && consultaMovimiento.matches);
  }

  /* rgba() a partir de un color de seis digitos. Los brillos se cachean en
     lienzos fuera de pantalla y para eso hace falta el color en tres partes
     sueltas, con su alfa. */
  function rgba(hex, alfa) {
    var n = parseInt(hex.slice(1), 16);
    return 'rgba(' + ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + alfa + ')';
  }

  /* --------------------------------------------------------------- brillos

     El halo de un punto de luz no se pinta con shadowBlur en cada fotograma:
     shadowBlur es de las operaciones mas caras que tiene un contexto 2d, y
     aqui habria hasta cuarenta por fotograma. Se cuece una vez por color un
     lienzo de 64 x 64 con el degradado ya hecho, y despues cada halo es un
     drawImage. El precio son 16 KB de memoria por color y un cambio de
     estado del contexto. */

  var BRILLO = {};

  function spriteBrillo(color) {
    if (BRILLO[color]) { return BRILLO[color]; }
    var lado = 64;
    var capa = document.createElement('canvas');
    capa.width = lado;
    capa.height = lado;
    var c = capa.getContext('2d');
    var m = lado / 2;
    var g = c.createRadialGradient(m, m, 0, m, m, m);
    g.addColorStop(0, rgba(color, 0.95));
    g.addColorStop(0.18, rgba(color, 0.55));
    g.addColorStop(0.42, rgba(color, 0.18));
    g.addColorStop(0.72, rgba(color, 0.05));
    g.addColorStop(1, rgba(color, 0));
    c.fillStyle = g;
    c.fillRect(0, 0, lado, lado);
    /* El nucleo opaco: un halo puro se ve como una mancha de aire, y lo que
       tiene que verse es una fuente de luz. */
    c.fillStyle = rgba(color, 0.92);
    c.beginPath();
    c.arc(m, m, lado * 0.055, 0, Math.PI * 2);
    c.fill();
    BRILLO[color] = capa;
    return capa;
  }

  function halo(x, y, radio, color, fuerza) {
    if (radio <= 0.5 || fuerza <= 0.01) { return; }
    var capa = spriteBrillo(color);
    ctx.globalAlpha = fuerza > 1 ? 1 : fuerza;
    ctx.drawImage(capa, x - radio, y - radio, radio * 2, radio * 2);
    ctx.globalAlpha = 1;
  }

  /* --------------------------------------------------------------- fondo

     El fondo son tres capas de estrellas con paralaje, tres nebulosas y un
     vineteado. Las tres cosas se calculan una sola vez por tamano:

       - Las nebulosas y el vineteado se cuecen juntos en un lienzo fuera de
         pantalla del tamano exacto del campo, y cada fotograma se pintan con
         un unico relleno de patron. Una pasada de pantalla completa, que es
         lo que cuesta una pasada de fondo, ni una mas.

       - Las estrellas si se mueven, asi que se dibujan sueltas. Se pintan
         agrupadas en quince escalones de alfa: con eso hay quince cambios
         de estado por capa en vez de uno por estrella.

     El paralaje sale de la nave, no del campo: el campo no se desplaza, la
     nave se mueve dentro de el y la pantalla envuelve. Asi que se acumula el
     desplazamiento de la nave y cada capa se mueve en sentido contrario con
     su factor. La capa lejana casi no se mueve y la cercana se nota.

     Y los tres desplazamientos se envuelven en un periodo igual al tamano del
     campo, con la misma funcion con la que se envuelve la nave. Asi que el
     desplazamiento puede correr horas sin desincronizarse, y no puede abrir
     ningun hueco: si se sale por la derecha, reaparece por la izquierda. */

  var FACTOR_PARALAJE = [0.09, 0.21, 0.42];

  /* Las tres capas: cuantas estrellas, como de grandes y como de tenues.
     La lejana es una nube de puntos, la cercana tiene estrellas con nombre. */
  var CAPA_ESTRELAS = [
    { n: 104, escala: 0.34, radio: [0.7, 1.25], alfa: [0.14, 0.30], brillo: 0.05 },
    { n: 68, escala: 0.58, radio: [0.9, 1.7], alfa: [0.22, 0.46], brillo: 0.20 },
    { n: 38, escala: 1.00, radio: [1.3, 2.5], alfa: [0.38, 0.74], brillo: 0.32 }
  ];

  var fondoCapa = null;
  var fondoPatron = null;
  var fondoClave = '';

  /* Un generador con semilla. El cielo no puede cambiar cada vez que se
     redimensiona el visor: si lo hiciera, al girar el telefono se veria el
     campo entero cambiar de estrellas. */
  function aleatorioConSemilla(semilla) {
    var s = semilla;
    return function () {
      s = (s * 1103515245 + 12345) % 2147483648;
      return s / 2147483648;
    };
  }

  /* BANDA_HUD: las dos franjas del marcador, arriba y abajo, en unidades
     logicas del campo. El cielo se dibuja entero y despues estas dos
     franjas se vuelven a tapar con el color puro de la fase: asi el HUD se
     lee sobre un cielo quieto y las bandas son iguales en las cinco fases.

     En el ancho de un movil el campo mide 375 x 506 y las bandas se comen
     casi una tercera parte: por eso el ancho de la nebulosa se mide contra
     el ancho del campo y no contra su altura. */
  var BANDA_HUD = 90;

  /* Las manchas de la nebulosa, una tabla por fase. Tres manchas en cada
     fase: la grande del centro, otra en una esquina y la del acento en el
     lado contrario. El radio va de 0,35 a 0,6 del ancho del campo, que es
     lo que hace que se lean como manchas de color y no como ruido de
     fondo, y las posiciones son distintas en cada fase, que es lo que hace
     que el cielo de una fase no se parezca al de la otra.

     La `x` es fraccion del ancho, la `y` fraccion del alto y el radio
     fraccion del ancho. */
  var NEBULOSAS = [
    [ { x: 0.50, y: 0.46, r: 0.46, acento: false },
      { x: 0.16, y: 0.70, r: 0.38, acento: false },
      { x: 0.84, y: 0.26, r: 0.40, acento: true } ],
    [ { x: 0.44, y: 0.56, r: 0.48, acento: false },
      { x: 0.80, y: 0.30, r: 0.40, acento: false },
      { x: 0.20, y: 0.24, r: 0.36, acento: true } ],
    [ { x: 0.56, y: 0.44, r: 0.50, acento: false },
      { x: 0.18, y: 0.70, r: 0.38, acento: false },
      { x: 0.86, y: 0.22, r: 0.38, acento: true } ],
    [ { x: 0.42, y: 0.58, r: 0.48, acento: false },
      { x: 0.82, y: 0.64, r: 0.42, acento: false },
      { x: 0.20, y: 0.24, r: 0.36, acento: true } ],
    [ { x: 0.50, y: 0.42, r: 0.52, acento: false },
      { x: 0.18, y: 0.28, r: 0.40, acento: false },
      { x: 0.84, y: 0.72, r: 0.38, acento: true } ]
  ];

  function prepararFondo() {
    fondoCapa = null;
    fondoPatron = null;
    var clave = ancho + 'x' + alto;
    if (clave === fondoClave) { return; }
    fondoClave = clave;

    var azar = aleatorioConSemilla(20261017);
    fx.capas = [];
    for (var c = 0; c < CAPA_ESTRELAS.length; c++) {
      var def = CAPA_ESTRELAS[c];
      var lista = [];
      for (var i = 0; i < def.n; i++) {
        var estrella = {
          u: azar(),
          v: azar(),
          r: (def.radio[0] + azar() * (def.radio[1] - def.radio[0])) * def.escala + 0.4,
          a: def.alfa[0] + azar() * (def.alfa[1] - def.alfa[0]),
          /* Una de cada tres de la capa cercana scintila, y ninguna de las
             otras dos se mueve de sitio. Las de la capa lejana casi nunca:
             si parpadea todo, no hay nada que parpadee. */
          f: azar() < def.brillo ? 0.55 + azar() * 1.1 : 0,
          fase: azar() * Math.PI * 2
        };
        lista.push(estrella);
      }
      fx.capas.push({ estrellas: lista, dx: 0, dy: 0 });
    }

    /* El mosaico del fondo. Se pinta en unidades logicas, no en pixeles
       reales: son manchas suaves, y a dos veces se ven igual de suaves pero
       cuestan la cuarta parte.

       El vineteado NO va aqui, sino en juego-asteroides.css, sobre el marco
       entero. El lienzo llega al borde del marco en todos los anchos, con
       lo que las dos capas cubren la misma caja y la costura no se ve. */
    var capa = document.createElement('canvas');
    capa.width = Math.max(1, Math.round(ancho));
    capa.height = Math.max(1, Math.round(alto));
    var b = capa.getContext('2d');
    dibujarNebulosas(b);
    prepararDetalle();
    fondoCapa = capa;
    try { fondoPatron = ctx.createPattern(capa, 'repeat'); } catch (e) { fondoPatron = null; }
  }

  /* Las manchas de la nebulosa de la fase que se esta jugando. Son tres, y
     las tres van en el color de la fase: dos con el color de la nebulosa y
     una con el acento, que es mas claro y dice de que color es el cielo.

     Cada mancha se pinta nueve veces, desplazada en la rejilla, para que el
     mosaico case por los cuatro lados: una mancha que se sale por la
     izquierda del mosaico esta tambien en la del derecho, y asi el cielo
     puede derivar sin que se vea el corte. */
  function dibujarNebulosas(b) {
    var fR = RONDAS[estado.ronda] || RONDAS[0];
    var nColor = fR.nebulosa || COLOR_NEBULOSA_A;
    var aColor = fR.acento || COLOR_NEBULOSA_A;
    var nAlfa = (typeof fR.neblina === 'number' ? fR.neblina : 0.2);
    /* La mancha del acento es la que dice de que color es la fase, pero no
       puede tapar a la grande: por eso va al minimo del rango. */
    var aAlfa = 0.16;
    var manchas = NEBULOSAS[(estado.ronda || 0) % NEBULOSAS.length] || NEBULOSAS[0];
    for (var i = 0; i < manchas.length; i++) {
      var m = manchas[i];
      var cx = m.x * ancho;
      var cy = m.y * alto;
      var cr = m.r * ancho;
      var color = m.acento ? aColor : nColor;
      var alfa = m.acento ? aAlfa : nAlfa;
      for (var ox = -1; ox <= 1; ox++) {
        for (var oy = -1; oy <= 1; oy++) {
          var x = cx + ox * ancho;
          var y = cy + oy * alto;
          if (x + cr * 1.6 < 0 || x - cr * 1.6 > ancho) { continue; }
          if (y + cr * 1.6 < 0 || y - cr * 1.6 > alto) { continue; }
          var g = b.createRadialGradient(x, y, 0, x, y, cr);
          g.addColorStop(0, rgba(color, alfa));
          g.addColorStop(0.55, rgba(color, alfa * 0.62));
          g.addColorStop(1, rgba(color, 0));
          b.fillStyle = g;
          b.beginPath();
          b.arc(x, y, cr, 0, Math.PI * 2);
          b.fill();
        }
      }
    }
  }

  /* El desplazamiento de una capa, envuelto en el periodo del campo. Es la
     misma cuenta que hace envolver() con las rocas y las balas, y por eso
     el cielo no puede desincronizarse de ellas. */
  function envolverOffset(v, periodo) {
    var m = v % periodo;
    if (m > periodo / 2) { m -= periodo; }
    if (m < -periodo / 2) { m += periodo; }
    return m;
  }

  /* Cuanto se ha movido la nave de un sitio a otro, por el camino corto. Sin
     esto, el salto de la nave al otro lado del borde movia el cielo entero un
     ancho de golpe. */
  function deltaEnvuelto(antes, ahora, tamano) {
    var d = ahora - antes;
    if (d > tamano / 2) { d -= tamano; }
    if (d < -tamano / 2) { d += tamano; }
    return d;
  }

  function moverFondo(dt) {
    fx.relojFondo += dt;
    var n = estado.nave;
    if (!n) { return; }
    if (n.parX === undefined) { n.parX = n.x; n.parY = n.y; return; }
    var dx = deltaEnvuelto(n.parX, n.x, ancho);
    var dy = deltaEnvuelto(n.parY, n.y, alto);
    n.parX = n.x;
    n.parY = n.y;
    for (var i = 0; i < fx.capas.length; i++) {
      var f = FACTOR_PARALAJE[i];
      fx.capas[i].dx = envolverOffset(fx.capas[i].dx - dx * f, ancho);
      fx.capas[i].dy = envolverOffset(fx.capas[i].dy - dy * f, alto);
    }
  }

  function colorCampoFase() {
    var f = RONDAS[estado.ronda];
    if (f && f.campo) { return f.campo; }
    return COLOR_FONDO;
  }

  function dibujarFondo(t, quieto) {
    var i;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.globalAlpha = 1;
    ctx.fillStyle = colorCampoFase();
    ctx.fillRect(0, 0, ancho, alto);

    if (fondoPatron) {
      var dx = quieto ? 0 : Math.sin(fx.relojFondo * 0.055) * 7;
      var dy = quieto ? 0 : Math.cos(fx.relojFondo * 0.041) * 5;
      ctx.save();
      ctx.translate(dx, dy);
      ctx.fillStyle = fondoPatron;
      ctx.fillRect(-dx, -dy, ancho, alto);
      ctx.restore();
    }

    ctx.fillStyle = COLOR_POLVO;
    for (i = 0; i < fx.capas.length; i++) {
      var capa = fx.capas[i];
      var lista = capa.estrellas;
      var cubo = -1;
      for (var j = 0; j < lista.length; j++) {
        var e = lista[j];
        var a = e.a;
        if (e.f !== 0 && !quieto) {
          a *= 0.70 + 0.30 * Math.sin(t * e.f + e.fase);
        }
        var x = e.u * ancho + capa.dx;
        var y = e.v * alto + capa.dy;
        if (x < 0) { x += ancho; } else if (x >= ancho) { x -= ancho; }
        if (y < 0) { y += alto; } else if (y >= alto) { y -= alto; }
        /* Las dos franjas del marcador no tienen estrellas: alli manda el
           color puro del campo, y una estrella a medio cortar se nota. */
        if (y < BANDA_HUD + 4 || y > alto - BANDA_HUD - 4) { continue; }
        /* Quince escalones de alfa: con eso el numero de cambios de estado
           por capa baja de uno por estrella a quince por fotograma. */
        var q = Math.round(a * 15);
        if (q === 0 || q === cubo) { continue; }
        if (q !== cubo) { ctx.globalAlpha = q / 15; cubo = q; }
        ctx.fillRect(x, y, e.r, e.r);
      }
    }
    ctx.globalAlpha = 1;

    /* El detalle de la fase: el polvo, las rayas de hielo, el rayo o el halo
       del Centinela. Va encima de las estrellas y debajo de las bandas. */
    pintarDetalleFase(t, quieto);

    /* Las bandas del HUD. El cielo entero -la nebulosa, las estrellas y el
       detalle de la fase- se dibuja debajo, y aqui se vuelve a tapar con el
       color puro del campo: las bandas quedan iguales en las cinco fases y
       el marcador se lee sobre un cielo quieto. El borde se abre con un
       degradado para que no se note el corte. Cuatro rellenos por
       fotograma. */
    var campo = colorCampoFase();
    ctx.fillStyle = campo;
    ctx.fillRect(0, 0, ancho, BANDA_HUD);
    ctx.fillRect(0, alto - BANDA_HUD, ancho, BANDA_HUD);
    var rampa = 60;
    var gArriba = ctx.createLinearGradient(0, BANDA_HUD, 0, BANDA_HUD + rampa);
    gArriba.addColorStop(0, rgba(campo, 1));
    gArriba.addColorStop(1, rgba(campo, 0));
    ctx.fillStyle = gArriba;
    ctx.fillRect(0, BANDA_HUD, ancho, rampa);
    var gAbajo = ctx.createLinearGradient(0, alto - BANDA_HUD, 0, alto - BANDA_HUD - rampa);
    gAbajo.addColorStop(0, rgba(campo, 1));
    gAbajo.addColorStop(1, rgba(campo, 0));
    ctx.fillStyle = gAbajo;
    ctx.fillRect(0, alto - BANDA_HUD - rampa, ancho, rampa);
  }

  /* --------------------------------------------------------------- detalle

     Cada fase lleva un rasgo propio en el cielo, ademas de su color. Es lo
     que hace que dos fases se reconozcan de un vistazo con el juego parado:

       cinturon   la de referencia: nada, solo el color violeta.
       escombros  polvo caliente pegado al borde de abajo.
       hielo      cuatro rayas frias que bajan muy despacio.
       tormenta   un rayo suelto cada cuatro o cinco segundos.
       jefe       un halo rojo que late detras del Centinela.

     Con movimiento reducido no hay nada que se mueva ni nada que
     centellee: los detalles se quedan quietos, pero siguen estando, porque
     lo que identifica la fase es su color y no su movimiento. */

  function pintarDetalleFase(t, quieto) {
    var f = RONDAS[estado.ronda] || RONDAS[0];
    if (f.id === 'escombros') {
      detalleEscombros(t, quieto);
    } else if (f.id === 'hielo') {
      detalleHielo(t, quieto);
    } else if (f.id === 'tormenta') {
      detalleTormenta(t, quieto);
    } else if (f.id === 'jefe') {
      detalleJefe(t, quieto);
    }
  }

  /* Las semillas del detalle. Las motas y las rayas se siembran una vez
     por fase y por tamano, con su propia serie, para que no cambien de
     sitio cada vez que se recuece el fondo. */
  function prepararDetalle() {
    var d = fx.detalle;
    var azar = aleatorioConSemilla(20261021);
    d.motas = [];
    d.rayas = [];
    d.rayoPuntos = [];
    d.rayoHasta = 0;
    d.proximoRayo = 3 + azar() * 3;
    for (var i = 0; i < 44; i++) {
      d.motas.push({
        x: azar(),
        y: azar(),
        r: 0.7 + azar() * 1.8,
        v: 5 + azar() * 11
      });
    }
    for (var s = 0; s < 4; s++) {
      d.rayas.push({
        x: azar(),
        y: azar(),
        ang: 0.50 + azar() * 0.30,
        largo: 0.45 + azar() * 0.35,
        ancho: 1.4 + azar() * 2.6,
        v: 4 + azar() * 8
      });
    }
  }

  /* El polvo caliente de la segunda fase: una bruma pegada al borde de abajo
     y unas motas que suben despacio y dan la vuelta. */
  function detalleEscombros(t, quieto) {
    var f = RONDAS[estado.ronda] || RONDAS[0];
    var color = f.acento || COLOR_PLATILLO;
    var base = alto - BANDA_HUD;
    var altoBruma = 130;
    var g = ctx.createLinearGradient(0, base, 0, base - altoBruma);
    g.addColorStop(0, rgba(color, 0.15));
    g.addColorStop(0.4, rgba(color, 0.06));
    g.addColorStop(1, rgba(color, 0));
    ctx.fillStyle = g;
    ctx.fillRect(0, base - altoBruma, ancho, altoBruma);
    var motas = fx.detalle.motas;
    for (var i = 0; i < motas.length; i++) {
      var m = motas[i];
      var subida = quieto ? m.y * altoBruma : (m.y * altoBruma + t * m.v) % altoBruma;
      ctx.fillStyle = rgba(color, 0.34 * (1 - subida / altoBruma) + 0.06);
      ctx.beginPath();
      ctx.arc(m.x * ancho, base - subida, m.r, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  /* Las rayas frias de la tercera fase: cuatro estelas diagonales que bajan
     muy despacio, como hielo que se cae de la nada. */
  function detalleHielo(t, quieto) {
    var f = RONDAS[estado.ronda] || RONDAS[0];
    var color = f.acento || COLOR_PLATILLO;
    var rayas = fx.detalle.rayas;
    var recorrido = alto + 320;
    ctx.lineCap = 'round';
    for (var i = 0; i < rayas.length; i++) {
      var r = rayas[i];
      var x = r.x * ancho;
      var y = quieto ? r.y * alto : ((r.y * recorrido + t * r.v) % recorrido) - 160;
      var largo = r.largo * ancho;
      var dx = Math.cos(r.ang) * largo;
      var dy = Math.sin(r.ang) * largo;
      var g = ctx.createLinearGradient(x - dx, y - dy, x, y);
      g.addColorStop(0, rgba(color, 0));
      g.addColorStop(0.6, rgba(color, 0.05));
      g.addColorStop(1, rgba(color, 0.3));
      ctx.strokeStyle = g;
      ctx.lineWidth = r.ancho;
      ctx.beginPath();
      ctx.moveTo(x - dx, y - dy);
      ctx.lineTo(x, y);
      ctx.stroke();
    }
    ctx.lineCap = 'butt';
  }

  /* El rayo de la cuarta fase: cada cuatro o cinco segundos cae una linea
     rota y el campo entero se aclara un pelo. El destello va en blanco, que
     es lo que hace un rayo, y a 0,06 como maximo: se ve el rayo, no se ve
     un fogonazo. */
  function detalleTormenta(t, quieto) {
    var d = fx.detalle;
    /* Con movimiento reducido no hay destellos: el rayo es el unico detalle
       que centellea, y sin centelleo no hay nada que mostrar. */
    if (quieto) { return; }
    if (t >= d.proximoRayo) {
      d.proximoRayo = t + 4 + Math.random() * 2;
      d.rayoHasta = t + 0.26;
      d.rayoPuntos = trazarRayo();
    }
    if (t >= d.rayoHasta || !d.rayoPuntos.length) { return; }
    var vida = (d.rayoHasta - t) / 0.26;
    ctx.fillStyle = rgba('#ffffff', 0.06 * vida);
    ctx.fillRect(0, 0, ancho, alto);
    ctx.strokeStyle = rgba('#ffffff', 0.55 * vida);
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(d.rayoPuntos[0].x, d.rayoPuntos[0].y);
    for (var i = 1; i < d.rayoPuntos.length; i++) {
      ctx.lineTo(d.rayoPuntos[i].x, d.rayoPuntos[i].y);
    }
    ctx.stroke();
  }

  /* El rayo cae en un lado o en el otro, nunca en el centro: el centro del
     campo es donde se juega, y ahi no puede haber un fogonazo. */
  function trazarRayo() {
    var puntos = [];
    var izquierda = Math.random() < 0.5;
    var x = (izquierda ? 0.12 + Math.random() * 0.18 : 0.70 + Math.random() * 0.18) * ancho;
    var pasos = 5 + Math.floor(Math.random() * 3);
    for (var i = 0; i <= pasos; i++) {
      puntos.push({ x: x, y: (i / pasos) * alto });
      x += (Math.random() - 0.5) * ancho * 0.12;
      if (izquierda) {
        x = Math.min(x, ancho * 0.46);
      } else {
        x = Math.max(x, ancho * 0.54);
      }
    }
    return puntos;
  }

  /* El halo rojo del Centinela: late despacio detras del jefe y lo separa
     del cielo. Sin jefe no hay halo: el halo es del jefe. */
  function detalleJefe(t, quieto) {
    var j = estado.jefe;
    if (!j) { return; }
    var f = RONDAS[estado.ronda] || RONDAS[0];
    var color = f.nebulosa || COLOR_PLATILLO;
    var pulso = quieto ? 0.5 : 0.5 + 0.5 * Math.sin(t * 2.2);
    var radio = 150;
    var g = ctx.createRadialGradient(j.x, j.y, 0, j.x, j.y, radio);
    g.addColorStop(0, rgba(color, 0.16 + 0.10 * pulso));
    g.addColorStop(0.45, rgba(color, 0.07 + 0.04 * pulso));
    g.addColorStop(1, rgba(color, 0));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(j.x, j.y, radio, 0, Math.PI * 2);
    ctx.fill();
  }

  /* --------------------------------------------------------------- estela */

  /* La estela son particulas sueltas que salen por detras de los motores. No
     es una linea conectada, sino un nube de puntos que se apaga: asi el rastro
     se disuelve solo y no deja una raya dura detras de la nave. */
  function soltarEstela(x, y, vx, vy, color, radio, vida) {
    fx.estela.push({
      x: x, y: y, vx: vx, vy: vy,
      color: color, r: radio,
      vida: vida, max: vida
    });
    if (fx.estela.length > TOPE_ESTELA) { fx.estela.shift(); }
  }

  function moverEstela(dt) {
    for (var i = fx.estela.length - 1; i >= 0; i--) {
      var p = fx.estela[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vida -= dt;
      p.vx *= 0.965;
      p.vy *= 0.965;
      if (p.vida <= 0) { fx.estela.splice(i, 1); }
      else { envolver(p, 30); }
    }
  }

  /* El empuje de verdad: uno si el jugador esta apretando, y si la nave solo
     va a la deriva, la fraccion de la velocidad maxima que lleva. Lo usan la
     llama, el rastro y el dibujado de la nave, de modo que el fuego y el
     rastro no se pueden contradecir. Que la nave este quieta no es lo mismo
     que este parada: a la deriva todavia sale un poco de llama, pero sin
     rastro. */
  function empujeNave(n) {
    var v = Math.sqrt(n.vx * n.vx + n.vy * n.vy);
    return estado.empuja ? 1 : Math.min(0.5, v / MAXIMO);
  }

  /* El motor de la nave suelta su estela a ritmo fijo, no por fotograma: si
     dependiera de los fotogramas, con el juego a 30 en un portatil viejo el
     rastro seria el doble de largo que a 60.

     El rastro sale mientras hay llama de verdad. Con solo la llama piloto, que
     es lo que queda al soltar, el rastro se apaga en un par de segundos y la
     lista vuelve a cero sola. Y con movimiento reducido no sale ninguno: no
     solo se deja de pintar, que es lo que haria falta para que se vea, sino
     que tampoco se acumula. */
  function empujarEstelaNave(dt, empuje) {
    if (sinAnimacion() || empuje < UMBRAL_ESTELA) { return; }
    fx.relojEstela += dt;
    while (fx.relojEstela > 0.022) {
      fx.relojEstela -= 0.022;
      var n = estado.nave;
      if (!n) { return; }
      soltarEstela(
        n.x + Math.cos(n.ang + Math.PI) * 9 + (Math.random() - 0.5) * 4,
        n.y + Math.sin(n.ang + Math.PI) * 9 + (Math.random() - 0.5) * 4,
        -Math.cos(n.ang) * empuje * 26 + (Math.random() - 0.5) * 14,
        -Math.sin(n.ang) * empuje * 26 + (Math.random() - 0.5) * 14,
        COLOR_BALA, 1.1 + Math.random() * 1.5, 0.22 + Math.random() * 0.18);
    }
  }

  function limpiarEstela() { fx.estela.length = 0; fx.relojEstela = 0; }

  /* Vaciar toda la pintura de una vez. Se llama al abrir una ronda, porque
     un estallido de la ronda anterior no puede seguir flotando sobre el
     tablero nuevo, y cuando el lienzo cambia de tamano, porque las
     coordenadas viejas ya no valen para el campo nuevo. */
  /* El destello del impacto de una bala. No lo dibuja la roca, sino una lista
     aparte: la roca que recibe la bala desaparece en el mismo fotograma, con
     lo que un destello que colgara de ella no se veria ni una vez. Va en el
     punto exacto por donde entro la bala y se orienta en su misma direccion,
     que es lo que dice que el disparo ha entrado y no que la piedra ha
     explotado por dentro. */
  function destellar(x, y, vx, vy, radio) {
    fx.destellos.push({
      x: x, y: y,
      ang: Math.atan2(vy, vx),
      r: radio,
      vida: DESTELLO_ROCA, max: DESTELLO_ROCA
    });
    if (fx.destellos.length > TOPE_DESTELLOS) { fx.destellos.shift(); }
  }

  function moverDestellos(dt) {
    for (var i = fx.destellos.length - 1; i >= 0; i--) {
      fx.destellos[i].vida -= dt;
      if (fx.destellos[i].vida <= 0) { fx.destellos.splice(i, 1); }
    }
  }

  function limpiarPintura() {
    limpiarEstela();
    fx.estallidos.length = 0;
    fx.fogonazos.length = 0;
    fx.destellos.length = 0;
    fx.relojFondo = 0;
    if (estado.nave) { estado.nave.parX = estado.nave.x; estado.nave.parY = estado.nave.y; }
  }

  /* ----------------------------------------------------------- explosiones */

  /* Cuanto pesa cada tamano de roca en la explosion que produce. La escala
     va a ser tambien el numero de particulas, el radio del anillo y la
     sacudida: una enorme tiene que ser un acontecimiento y una pequena un
     chispazo. */
  var ESCALA_ROCA = { 4: 1, 3: 0.66, 2: 0.42, 1: 0.24 };

  function estallar(x, y, escala, color, borde, acentoFase) {
    var quieto = sinAnimacion();
    var dur = 0.32 + 0.26 * escala;
    var fR = RONDAS[estado.ronda] || RONDAS[0];
    var col = acentoFase || (fR && fR.acento ? fR.acento : color);
    var e = {
      x: x, y: y,
      vida: dur, max: dur,
      color: col, borde: borde || col,
      escala: escala,
      /* El anillo: un circulo hueco que crece y se apaga. El grosor baja al
         mismo tiempo que la opacidad, para que no aparezca un aro de grosor
         fijo despegandose del centro. */
      anillo0: 3 + 6 * escala,
      anillo1: 20 + 54 * escala,
      anilloGrueso: 1.2 + 3.4 * escala,
      destello: 0,
      particulas: [],
      escombros: []
    };

    var n = quieto ? Math.round(4 + 8 * escala) : Math.round(6 + 20 * escala);
    for (var i = 0; i < n; i++) {
      var a = Math.random() * Math.PI * 2;
      var v = (40 + Math.random() * 180) * (0.45 + escala);
      e.particulas.push({
        x: x, y: y,
        vx: Math.cos(a) * v, vy: Math.sin(a) * v,
        vida: 0.16 + Math.random() * (0.2 + 0.3 * escala),
        r: 0.8 + Math.random() * (1 + 1.7 * escala)
      });
    }

    /* Los escombros: trozos de la propia roca, con su silueta y girando.
       Son los que dicen que la roca se rompio y no que desaparecio. */
    var trozos = quieto ? 1 + Math.round(2 * escala) : 2 + Math.round(4 * escala);
    for (i = 0; i < trozos; i++) {
      var a2 = Math.random() * Math.PI * 2;
      var v2 = (30 + Math.random() * 90) * (0.4 + escala);
      e.escombros.push({
        x: x, y: y,
        vx: Math.cos(a2) * v2, vy: Math.sin(a2) * v2,
        ang: Math.random() * Math.PI * 2,
        va: (Math.random() - 0.5) * 9,
        r: 2 + escala * 6 * (0.5 + Math.random() * 0.8),
        vida: 0.2 + Math.random() * (0.25 + 0.3 * escala),
        color: color, borde: borde
      });
    }

    fx.estallidos.push(e);
    if (fx.estallidos.length > TOPE_ESTALLIDOS) { fx.estallidos.shift(); }
    return e;
  }

  function moverEstallidos(dt) {
    for (var i = fx.estallidos.length - 1; i >= 0; i--) {
      var e = fx.estallidos[i];
      e.vida -= dt;
      var q;
      for (q = 0; q < e.particulas.length; q++) {
        var p = e.particulas[q];
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vida -= dt;
        p.vx *= 0.955;
        p.vy *= 0.955;
        envolver(p, 6);
      }
      for (q = 0; q < e.escombros.length; q++) {
        var s = e.escombros[q];
        s.x += s.vx * dt;
        s.y += s.vy * dt;
        s.ang += s.va * dt;
        s.vida -= dt;
        s.vx *= 0.975;
        s.vy *= 0.975;
        envolver(s, 12);
      }
      if (e.vida <= 0) { fx.estallidos.splice(i, 1); }
    }
  }

  /* -------------------------------------------------------------- sacudida

     La sacudida se aplica al LIENZO con una transformacion CSS, no al estado:
     la vista es lo que tiembla, no las rocas. Y se limpia poniendo la
     transformacion en cadena, no interpolando hacia cero, para que el rect
     del lienzo vuelva a ser exactamente el de antes, al pixel. */

  var DURACION_SACUDIDA = 0.34;
  var SACUDIDA_MAXIMA = 13;

  /* La magnitud de la sacudida de cada cosa, en pixeles. La de una roca
     enorme es la mayor de las quatro, y la de una pequena y una mediana son
     iguales a proposito: por el pulgar son el mismo golpecito. */
  var SACUDIDA_ROCA = { 4: 6.5, 3: 4, 2: 2.4, 1: 1.4 };
  var SACUDIDA_PLATILLO = 7;
  var SACUDIDA_VIDA = 9;
  var SACUDIDA_RONDA = 5;

  function sacudir(mag) {
    if (sinAnimacion() || !lienzo) { return; }
    fx.sacudidaMag = Math.min(SACUDIDA_MAXIMA, Math.max(fx.sacudidaMag, mag));
    fx.sacudidaFin = performance.now() + DURACION_SACUDIDA * 1000;
    fx.sacudidas++;
    /* Se aplica en el acto, no en el siguiente fotograma: la sacudida tiene
       que empezar en el cuadro en que se rompe la roca. */
    aplicarSacudida();
  }

  function aplicarSacudida() {
    if (!lienzo) { return; }
    var restante = fx.sacudidaFin - performance.now();
    if (restante <= 0) {
      lienzo.style.transform = '';
      fx.sacudidaMag = 0;
      fx.sacudidaFin = -1;
      return;
    }
    var caida = restante / (DURACION_SACUDIDA * 1000);
    var m = fx.sacudidaMag * caida * caida;
    lienzo.style.transform = 'translate(' +
      ((Math.random() * 2 - 1) * m).toFixed(2) + 'px,' +
      ((Math.random() * 2 - 1) * m).toFixed(2) + 'px)';
  }

  function limpiarSacudida() {
    if (!lienzo) { return; }
    fx.sacudidaMag = 0;
    fx.sacudidaFin = -1;
    lienzo.style.transform = '';
  }

  /* -------------------------------------------------------------- haptica

     Los patrones son todos distintos entre si en numero de pulsos y en
     duracion: se distinguen con el pulgar sin mirar. Y SOLO se llaman desde
     eventos, nunca desde el bucle de dibujo ni desde disparar(), que es lo
     que hacia que con el puntero apoyado el juego no se convierta en un
     zumbido continuo. */

  var PATRONES = {
    roca: { 1: [8], 2: [8], 3: [13], 4: [18] },
    platillo: [10, 30, 10],
    botin: {
      arma: [8, 18, 8],
      cadencia: [6, 6, 6, 6],
      perforante: [28],
      escudo: [14, 14]
    },
    /* Los gestos que pide el guion. Cada uno se distingue por el numero de
       pulsos y por lo que dura: la muerte de una nave son dos golpes cortos
       separados (35-30-35), el fin de partida un aviso largo y grave
       (60-45-120), la caida del Centinela el mismo aviso largo y grave, un
       botin un unico toque corto (15) y la ronda ganada tres golpes que suben
       (25-40-25). */
    vida: [35, 30, 35],
    ronda: [25, 40, 25],
    fin: [60, 45, 120],
    jefe: [60, 45, 120],
    botinSimple: [15]
  };

  /* Cada tamano de roca revienta con su propia explosion: mas grave y larga
     cuanto mas grande. El indice es el tamano, igual que en PATRONES. */
  var SONIDO_ROCA = { 1: 'rocaPequena', 2: 'rocaMediana', 3: 'rocaGrande', 4: 'rocaEnorme' };

  /* El interruptor de la hapticidad. Sale encendido; el menu de inicio lo
     apaga y lo enciende, y la eleccion se guarda. Si el navegador no deja
     guardar, se juega igual: la partida que se esta jugando ya lleva su
     valor en memoria. */
  var vibracionActiva = true;

  function vibrar(patron) {
    /* Apagada en el menu: ni se pide ni se cuenta como fallo. */
    if (!vibracionActiva) {
      fx.vibracionApagada++;
      return false;
    }
    try {
      if (typeof navigator === 'undefined' || !navigator.vibrate) {
        fx.vibracionFallos++;
        return false;
      }
      navigator.vibrate(patron);
      fx.vibraciones++;
      return true;
    } catch (error) {
      /* Algunos navegadores tienen navigator.vibrate y lo lanzan si la pagina
         no ha tenido gesto del usuario todavia. No es una averia del juego:
         se cuenta y se sigue jugando sin hapticidad. */
      fx.vibracionFallos++;
      return false;
    }
  }

  /* --------------------------------------------------------------- sonido

     Todo el sonido del juego, sintetizado con la Web Audio API. No hay ni un
     archivo de audio ni una peticion de red: cada efecto es una o varias
     voces -osciladores y ruido- con su envolvente, montadas en el momento.

     Tres reglas que no se rompen nunca:

     - El AudioContext NO se crea hasta el primer gesto real del usuario
       (pulsar jugar). Antes de eso no existe: los navegadores bloquean el
       audio sin gesto y crearlo antes solo gasta memoria y llena la consola
       de avisos.
     - Nada de esto puede bloquear el bucle del juego. Montar una voz son
       unas decenas de instrucciones; los topes de voces descartan efectos en
       vez de encolarlos, para que disparar rapidisimo no acumule sonido.
     - Todo va dentro de try/catch. Si el navegador no tiene Web Audio, o lo
       tiene pero falla, el juego se juega igual, sin un solo error. */

  var audio = {
    /* El contexto y el nodo maestro. Nulos hasta el primer gesto. */
    ctx: null,
    maestro: null,
    /* El volumen general. Discreto: el juego no es un concierto. */
    volumen: 0.5,
    /* El interruptor de silencio. El boton lo alterna. */
    mudo: false,
    /* Cuantos efectos suenan ahora mismo, para respetar el tope de voces. */
    voces: 0,
    /* El instante del ultimo disparo, para no repetirlo mas de una vez cada
       30 ms aunque el jugador apriete a fondo. */
    ultimoDisparo: -1,
    /* Los nombres de los doce efectos del guion mas el clic de boton. */
    nombres: ['disparo', 'rocaEnorme', 'rocaGrande', 'rocaMediana', 'rocaPequena',
              'botin', 'escudo', 'platilloMuere', 'platilloDispara',
              'naveMuere', 'fin', 'ronda', 'boton', 'cometaAviso', 'cometaPasa',
              'jefeAviso', 'jefeDispara', 'jefeNucleo', 'jefeMuere']
  };

  /* El tope de explosiones simultaneas. Mas de esto y el ruido se embarulla;
     a partir de aqui se descarta, no se encola. */
  var AUDIO_TOPE_VOCES = 7;
  /* La separacion minima entre dos disparos, en segundos. */
  var AUDIO_CADENCIA_DISPARO = 0.03;

  var AudioCtx = window.AudioContext || window.webkitAudioContext;

  function soportaAudio() {
    return !!AudioCtx;
  }

  /* Crea el contexto a la primera. Se llama desde los gestos del usuario: el
     boton de jugar y el de silencio. Es idempotente. */
  function abrirAudio() {
    if (!soportaAudio()) { return false; }
    try {
      if (!audio.ctx) {
        audio.ctx = new AudioCtx();
        audio.maestro = audio.ctx.createGain();
        audio.maestro.gain.value = audio.mudo ? 0 : audio.volumen;
        audio.maestro.connect(audio.ctx.destination);
      }
      /* Un contexto creado sin gesto puede nacer suspendido: reanudarlo aqui,
         ya dentro de un gesto, es lo que lo pone a andar. */
      if (audio.ctx.state === 'suspended' && typeof audio.ctx.resume === 'function') {
        var p = audio.ctx.resume();
        if (p && typeof p.catch === 'function') { p.catch(function () {}); }
      }
      return true;
    } catch (error) {
      /* Sin capacidad de audio: el juego sigue sin sonido. */
      audio.ctx = null;
      audio.maestro = null;
      return false;
    }
  }

  /* El estado, para las pruebas y para el icono del boton. */
  function estadoAudio() {
    return {
      soporta: soportaAudio(),
      creado: !!audio.ctx,
      estado: audio.ctx ? audio.ctx.state : 'sin-contexto',
      mudo: audio.mudo,
      volumen: audio.volumen,
      ganancia: audio.maestro ? audio.maestro.gain.value : null,
      voces: audio.voces,
      lanzados: fx.sonidos,
      descartados: fx.sonidosDescartados,
      nombres: audio.nombres.slice()
    };
  }

  /* El reloj del contexto. Si todavia no hay contexto, el sonido no se
     intenta, asi que nunca hace falta un valor de reserva. */
  function ahoraAudio() {
    return audio.ctx ? audio.ctx.currentTime : 0;
  }

  /* Monta una voz de oscilador con envolvente y la conecta al maestro. El
     parametro `tipo` es el de la onda (sine, square, sawtooth, triangle). */
  function vozOscilador(tipo, frecuencia, inicio, duracion, pico, final) {
    var ctx = audio.ctx;
    var osc = ctx.createOscillator();
    var g = ctx.createGain();
    osc.type = tipo;
    osc.frequency.setValueAtTime(frecuencia, inicio);
    if (final !== undefined) {
      /* Un deslizamiento lineal de la frecuencia: es lo que da la caida de
         tono del disparo del platillo y de la muerte de la nave. */
      osc.frequency.linearRampToValueAtTime(final, inicio + duracion);
    }
    g.gain.setValueAtTime(0, inicio);
    g.gain.linearRampToValueAtTime(pico, inicio + Math.min(0.008, duracion * 0.2));
    g.gain.exponentialRampToValueAtTime(0.0001, inicio + duracion);
    osc.connect(g);
    g.connect(audio.maestro);
    osc.start(inicio);
    osc.stop(inicio + duracion + 0.02);
    return osc;
  }

  /* El mismo envoltorio pero para las notas que suben o bajan por pasos: cada
     salto es una frecuencia distinta y el unico tono se sostiene lo justo. */
  function vozNotas(tipo, notas, inicio, duracionNota, pico) {
    var ctx = audio.ctx;
    for (var i = 0; i < notas.length; i++) {
      var t0 = inicio + i * duracionNota;
      var osc = ctx.createOscillator();
      var g = ctx.createGain();
      osc.type = tipo;
      osc.frequency.setValueAtTime(notas[i], t0);
      g.gain.setValueAtTime(0, t0);
      g.gain.linearRampToValueAtTime(pico, t0 + 0.006);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + duracionNota * 0.92);
      osc.connect(g);
      g.connect(audio.maestro);
      osc.start(t0);
      osc.stop(t0 + duracionNota + 0.02);
    }
  }

  /* Las notas sostenidas (el escudo activo) no caben en vozOscilador porque
     su envolvente es plano-sostiene-cae, sin pico inicial. */
  function vozSostenida(frecuencia, inicio, duracion, pico) {
    var ctx = audio.ctx;
    var osc = ctx.createOscillator();
    var g = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(frecuencia, inicio);
    g.gain.setValueAtTime(0, inicio);
    g.gain.linearRampToValueAtTime(pico, inicio + 0.09);
    g.gain.setValueAtTime(pico, inicio + duracion - 0.12);
    g.gain.linearRampToValueAtTime(0, inicio + duracion);
    osc.connect(g);
    g.connect(audio.maestro);
    osc.start(inicio);
    osc.stop(inicio + duracion + 0.02);
  }

  /* Una explosion corta de ruido blanco con un filtro pasa-bajos: es lo que
     hace que una roca suene a roca y no a pitido. */
  function vozRuido(inicio, duracion, pico, corte) {
    var ctx = audio.ctx;
    var largo = Math.max(1, Math.floor(ctx.sampleRate * duracion));
    var buffer = ctx.createBuffer(1, largo, ctx.sampleRate);
    var datos = buffer.getChannelData(0);
    for (var i = 0; i < largo; i++) {
      datos[i] = (Math.random() * 2 - 1) * (1 - i / largo);
    }
    var fuente = ctx.createBufferSource();
    fuente.buffer = buffer;
    var filtro = ctx.createBiquadFilter();
    filtro.type = 'lowpass';
    filtro.frequency.setValueAtTime(corte, inicio);
    filtro.frequency.linearRampToValueAtTime(Math.max(80, corte * 0.35), inicio + duracion);
    var g = ctx.createGain();
    g.gain.setValueAtTime(pico, inicio);
    g.gain.exponentialRampToValueAtTime(0.0001, inicio + duracion);
    fuente.connect(filtro);
    filtro.connect(g);
    g.connect(audio.maestro);
    fuente.start(inicio);
    fuente.stop(inicio + duracion + 0.02);
  }

  /* El catalogo. Cada entrada monta sus voces y NO devuelve nada: la duracion
     total la conoce el propio guion, no hace falta que salga de aqui. */
  var RECETAS = {
    /* Disparo: un chasquido agudo muy corto, 50-70 ms. */
    disparo: function (t) {
      vozOscilador('square', 880, t, 0.055, 0.16, 240);
      vozRuido(t, 0.04, 0.06, 4000);
    },
    /* La explosion de una roca, mas grave y larga cuanto mas grande. */
    rocaEnorme: function (t) {
      vozRuido(t, 0.42, 0.5, 900);
      vozOscilador('sine', 80, t, 0.42, 0.3, 34);
    },
    rocaGrande: function (t) {
      vozRuido(t, 0.32, 0.42, 1100);
      vozOscilador('sine', 110, t, 0.32, 0.24, 46);
    },
    rocaMediana: function (t) {
      vozRuido(t, 0.22, 0.34, 1500);
      vozOscilador('sine', 160, t, 0.22, 0.18, 70);
    },
    rocaPequena: function (t) {
      vozRuido(t, 0.14, 0.26, 2200);
      vozOscilador('sine', 230, t, 0.14, 0.13, 110);
    },
    /* Botin: dos notas que suben, unos 180 ms. */
    botin: function (t) {
      vozNotas('triangle', [660, 990], t, 0.09, 0.18);
    },
    /* Escudo: una nota sostenida mientras dura el efecto. */
    escudo: function (t) {
      vozSostenida(440, t, 0.9, 0.1);
      vozSostenida(660, t + 0.06, 0.8, 0.06);
    },
    /* El platillo derribado: dos notas de fanfarria. */
    platilloMuere: function (t) {
      vozNotas('square', [520, 780], t, 0.11, 0.18);
      vozRuido(t, 0.2, 0.3, 1400);
    },
    /* El disparo del platillo: un tono corto que cae. */
    platilloDispara: function (t) {
      vozOscilador('sawtooth', 620, t, 0.12, 0.1, 180);
    },
    /* La muerte de una nave: una caida de tono larga con ruido, unos 600 ms. */
    naveMuere: function (t) {
      vozOscilador('sawtooth', 520, t, 0.6, 0.28, 60);
      vozRuido(t, 0.6, 0.34, 1200);
    },
    /* Fin de partida: tres notas que bajan. */
    fin: function (t) {
      vozNotas('triangle', [392, 311, 233], t, 0.22, 0.22);
      vozRuido(t, 0.5, 0.16, 700);
    },
    /* Ronda ganada: tres notas que suben. */
    ronda: function (t) {
      vozNotas('triangle', [523, 659, 784], t, 0.14, 0.2);
    },
    /* El clic del boton: un chasquido cortisimo. */
    boton: function (t) {
      vozOscilador('square', 320, t, 0.04, 0.1, 180);
    },
    /* Cometa aviso: pitido doble corto, agudo y seco, 140 ms. */
    cometaAviso: function (t) {
      vozOscilador('square', 1320, t, 0.055, 0.12, 880);
      vozOscilador('square', 1760, t + 0.06, 0.055, 0.1, 1100);
    },
    /* Cometa pasa: siseo con ruido filtrado descendente, 260 ms. */
    cometaPasa: function (t) {
      vozRuido(t, 0.26, 0.18, 3200);
      vozOscilador('sawtooth', 820, t, 0.26, 0.12, 220);
    },
    /* Aviso del laser del jefe: sirena que sube y baja dos veces, 500 ms. */
    jefeAviso: function (t) {
      vozOscilador('triangle', 220, t, 0.25, 0.2, 540);
      vozOscilador('triangle', 220, t + 0.25, 0.25, 0.2, 540);
    },
    /* Golpe de ataque del jefe: un golpe seco contra el casco, 100 ms. */
    jefeDispara: function (t) {
      vozRuido(t, 0.1, 0.24, 2200);
      vozOscilador('square', 300, t, 0.1, 0.14, 130);
    },
    /* El nucleo se abre: dos notas que suben, 200 ms. */
    jefeNucleo: function (t) {
      vozNotas('triangle', [523, 784], t, 0.1, 0.18);
    },
    /* La caida del jefe: explosion larga con un tono que se apaga, 900 ms. */
    jefeMuere: function (t) {
      vozRuido(t, 0.9, 0.5, 1000);
      vozOscilador('sawtooth', 380, t, 0.9, 0.3, 40);
      vozOscilador('sine', 140, t + 0.1, 0.8, 0.24, 30);
    }
  };

  /* El unico camino por el que suena algo. Devuelve true si sono. */
  function sonar(nombre) {
    if (audio.mudo || !audio.ctx || !RECETAS[nombre]) { return false; }
    /* Si el contexto se ha quedado suspendido -nacio asi, o el movil lo
       suspendio al ir a segundo plano-, aqui se reintenta reanudar. Sin esto,
       resume() solo se intentaba al abrir el audio y el juego se quedaba mudo
       para siempre. */
    if (audio.ctx.state === 'suspended' && typeof audio.ctx.resume === 'function') {
      var p = audio.ctx.resume();
      if (p && typeof p.catch === 'function') { p.catch(function () {}); }
    }
    var receta = RECETAS[nombre];
    var esDisparo = nombre === 'disparo';
    var t = ahoraAudio();
    /* Los dos topes: el disparo no mas de una vez cada 30 ms, y en general
       no mas de AUDIO_TOPE_VOCES simultaneas. Se DESCARTA, no se encola. */
    if (esDisparo && t - audio.ultimoDisparo < AUDIO_CADENCIA_DISPARO) {
      fx.sonidosDescartados++;
      return false;
    }
    if (!esDisparo && audio.voces >= AUDIO_TOPE_VOCES) {
      fx.sonidosDescartados++;
      return false;
    }
    if (esDisparo) { audio.ultimoDisparo = t; }
    try {
      receta(t);
      fx.sonidos++;
      /* Las voces del disparo son tan cortas que no hace falta contarlas;
         las explosiones si, que son las que pueden acumularse. */
      if (!esDisparo) {
        audio.voces++;
        window.setTimeout(function () {
          if (audio.voces > 0) { audio.voces--; }
        }, 700);
      }
      return true;
    } catch (error) {
      /* Una receta que falla no puede tumbar el juego. */
      return false;
    }
  }

  /* Monta la receta de un efecto en un contexto cualquiera y devuelve el nodo
     de salida. Solo lo usan las pruebas: cambiando el contexto por uno
     offline se puede medir el pico y la duracion reales de cada efecto sin
     que suene nada. Es el mismo catalogo, no una copia: lo que se mide es lo
     que se oye. */
  function rendirEfecto(nombre, destino) {
    var receta = RECETAS[nombre];
    if (!receta || !destino || !destino.context) { return null; }
    var ctxVivo = audio.ctx;
    var maestroVivo = audio.maestro;
    var salida = destino.context.createGain();
    salida.connect(destino);
    audio.ctx = destino.context;
    audio.maestro = salida;
    try {
      receta(destino.context.currentTime);
      return salida;
    } finally {
      audio.ctx = ctxVivo;
      audio.maestro = maestroVivo;
    }
  }

  /* El interruptor de silencio del boton. Al silenciar, la ganancia del nodo
     maestro va a cero en el acto; al desilenciar vuelve a su volumen. */
  function cambiarMudo(mudo) {
    audio.mudo = !!mudo;
    if (audio.maestro) {
      try {
        audio.maestro.gain.value = audio.mudo ? 0 : audio.volumen;
      } catch (error) { /* sin ganancia no hay nada que cambiar */ }
    }
    sincronizarSilencio();
    return audio.mudo;
  }

  function alternarMudo() {
    /* El gesto del boton tambien vale para abrir el audio si aun no estaba. */
    abrirAudio();
    if (cambiarMudo(!audio.mudo)) { sonar('boton'); return true; }
    sonar('boton');
    return false;
  }

  /* ------------------------------------------- las opciones que se guardan

     Sonido y vibracion. Se guardan en localStorage; si el navegador lo tiene
     bloqueado (modo privado, cookies de terceros), se juega igual: la sesion
     mantiene el valor en memoria y solo se pierde al recargar. Nunca se lanza
     el error hacia arriba. */

  var CLAVE_OPCIONES = 'asteroides.opciones.v1';

  function leerOpciones() {
    var salida = { sonido: true, vibracion: true };
    try {
      var crudo = window.localStorage.getItem(CLAVE_OPCIONES);
      if (!crudo) { return salida; }
      var datos = JSON.parse(crudo);
      if (datos && typeof datos === 'object') {
        if (typeof datos.sonido === 'boolean') { salida.sonido = datos.sonido; }
        if (typeof datos.vibracion === 'boolean') { salida.vibracion = datos.vibracion; }
      }
    } catch (error) {
      /* Sin almacenamiento se usan los valores por defecto. */
    }
    return salida;
  }

  function guardarOpciones() {
    try {
      window.localStorage.setItem(CLAVE_OPCIONES, JSON.stringify({
        sonido: !audio.mudo,
        vibracion: vibracionActiva
      }));
    } catch (error) {
      /* Si no se puede guardar, la partida sigue con lo que hay en memoria. */
    }
  }

  /* --------------------------------------------------------------- dibujo */

  var POLVO = null;

  function hacerPolvo() {
    if (POLVO) { return; }
    POLVO = [];
    var semilla = 7;
    for (var i = 0; i < 120; i++) {
      semilla = (semilla * 1103515245 + 12345) % 2147483648;
      var x = semilla / 2147483648;
      semilla = (semilla * 1103515245 + 12345) % 2147483648;
      var y = semilla / 2147483648;
      semilla = (semilla * 1103515245 + 12345) % 2147483648;
      POLVO.push({ x: x, y: y, z: 0.3 + x * 0.7 });
    }
  }

  /* La constante de tiempo de la estela de las balas. Son segundos: la bala
     del jugador va a 470, asi que 0,11 s son 52 unidades de rastro, y la del
     platillo, que va a 300, son 33. */
  var ESTELA_BALA = 0.11;

  /* La longitud de la llama segun el empuje. Quieto no es lo mismo que
     parado: con la nave a la deriva sigue habiendo llama, mas corta. */
  var LLAMA_CORTA = 7;
  var LLAMA_LARGA = 21;

  function dibujar(t) {
    fx.fotogramas++;
    var quieto = sinAnimacion();
    var i;

    dibujarFondo(t, quieto);

    /* Todo lo que viene ahora se dibuja con la sacudida puesta. La
       transformacion se pone y se quita dentro del mismo marco, asi que al
       salir de dibujar() el contexto queda exactamente como estaba. */
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (fx.sacudidaFin > 0) {
      var restante = fx.sacudidaFin - performance.now();
      if (restante <= 0) { limpiarSacudida(); }
      else {
        var caida = restante / (DURACION_SACUDIDA * 1000);
        var amp = fx.sacudidaMag * caida * caida;
        ctx.translate((Math.random() * 2 - 1) * amp, (Math.random() * 2 - 1) * amp);
      }
    }

    /* El polvo de siempre, en tres velocidades. Se queda porque es lo que
       hacia que el espacio se moviera aunque la nave no se moviera. */
    hacerPolvo();
    for (i = 0; i < POLVO.length; i++) {
      var p = POLVO[i];
      var x = (p.x * ancho - t * 14 * p.z) % ancho;
      var y = (p.y * alto - t * 6 * p.z) % alto;
      if (x < 0) { x += ancho; }
      if (y < 0) { y += alto; }
      ctx.globalAlpha = 0.14 + p.z * 0.3;
      ctx.fillStyle = COLOR_POLVO;
      ctx.fillRect(x, y, p.z * 1.2, p.z * 1.2);
    }
    ctx.globalAlpha = 1;

    for (i = 0; i < estado.rocas.length; i++) { pintarRoca(estado.rocas[i], quieto); }

    /* La estela va por debajo de las rocas y de la nave: es humo de motor, y
       el humo que tapa una roca es humo mal puesto. */
    pintarEstela(quieto);

    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    pintarBalas(quieto);
    pintarFogonazos();

    if (estado.platillo) {
      pintarBalasPlatillo(estado.platillo, quieto);
      pintarPlatillo(estado.platillo);
    }

    /* El Centinela entra al final: sobre el resto del campo y debajo de la
       nave, que nunca deja de verse por culpa del jefe. */
    if (estado.jefe) {
      pintarBalasJefe(estado.jefe, quieto);
      pintarJefe(estado.jefe, quieto);
      pintarLaserJefe(quieto);
    }

    for (i = 0; i < estado.botines.length; i++) { pintarBotin(estado.botines[i], quieto); }

    dibujarCometas();

    var n = estado.nave;
    if (n) {
      /* El ratito de gracia de nacer, que se ve porque la nave parpadea. Con
         movimiento reducido no parpadea: se apaga y se enciende despacio,
         que dice lo mismo sin el fogonazo. */
      var ver = true;
      if (n.escudo > 0) {
        if (quieto) { ver = 0.35 + 0.65 * (0.5 + 0.5 * Math.cos(reloj * 5)); }
        else { ver = Math.floor(reloj * 12) % 2 === 0; }
      }
      if (ver) { pintarNave(n, quieto); }

      /* El anillo del escudo de botin. El ratito de gracia de nacer NO lo
         dibuja, porque la pagina explica que ese se ve por el parpadeo de la
         nave: si tambien tuviera anillo, el texto estaria mintiendo. Cuando el
         escudo se va a acabar, el anillo parpadea con el. */
      if (n.escudoBotin && n.escudo > 0) {
        var aviso = n.escudo <= AVISO_EFECTO && !quieto && Math.floor(reloj * 8) % 2 === 1;
        ctx.save();
        ctx.globalAlpha = aviso ? 0.3 : 0.85;
        ctx.strokeStyle = TIPOS_BOTIN.escudo.color;
        ctx.lineWidth = 2.2;
        ctx.beginPath();
        ctx.arc(n.x, n.y, 22 + (quieto ? 0 : Math.sin(reloj * 3) * 1.2), 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }
    }

    pintarEstallidos(quieto);
    pintarDestellos();

    /* Las chispas sueltas, las que suelta la nave al morir y el botin al
       recogerse. Van las ultimas porque son lo mas pequeno y lo mas
       transitorio. */
    for (i = 0; i < estado.chispas.length; i++) {
      var c2 = estado.chispas[i];
      var f = Math.max(0, c2.vida / c2.max);
      ctx.globalAlpha = f;
      ctx.fillStyle = COLOR_NUCLEO;
      ctx.beginPath();
      ctx.arc(c2.x, c2.y, c2.r * (0.4 + f), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  /* ----------------------------------------------------------------- rocas */

  function pintarRoca(r, quieto) {
    var radio = RADIO[r.tam];
    /* El halo va antes de la roca y es de su color de borde, no de su
       color: el borde es la version clara del mismo, y por eso el halo se ve
       como la misma familia y no como una luz ajena. */
    halo(r.x, r.y, radio * 1.5, r.borde, quieto ? 0.08 : 0.13);

    ctx.save();
    ctx.translate(r.x, r.y);
    ctx.rotate(r.ang);

    /* Si los doce sprites estan cargados, se pinta la foto de verdad y se
       sale: el resto de la funcion es el dibujado procedural de respaldo. La
       rotacion ya la ha aplicado el contexto, asi que el sprite entra recto
       en su cuadrado. El destello y la explosion van aparte, como siempre. */
    if (rocasListas >= 12) {
      var imagenRoca = rocasSprite[r.tam] && rocasSprite[r.tam][r.variante];
      if (imagenRoca && imagenRoca.complete && imagenRoca.naturalWidth > 0) {
        var ladoSprite = radio * FACTOR_SPRITE_ROCA;
        ctx.drawImage(imagenRoca, -ladoSprite / 2, -ladoSprite / 2,
          ladoSprite, ladoSprite);
        ctx.restore();
        return;
      }
    }

    /* La luz es del campo, no de la roca: se gira al reves de r.ang para
       seguir viniendo de arriba a la izquierda de la PANTALLA mientras la
       piedra gira. Son dos productos y una suma, una vez por roca. */
    var lx = LUZ_X * Math.cos(-r.ang) - LUZ_Y * Math.sin(-r.ang);
    var ly = LUZ_X * Math.sin(-r.ang) + LUZ_Y * Math.cos(-r.ang);
    var k;
    var v;
    var p;
    var q;

    /* La silueta entera en la sombra mas honda. Tapa las costuras de un
       pixel que deja el recorte entre celda y celda. */
    ctx.beginPath();
    ctx.moveTo(r.contorno[0].x, r.contorno[0].y);
    for (k = 1; k < r.contorno.length; k++) {
      ctx.lineTo(r.contorno[k].x, r.contorno[k].y);
    }
    ctx.closePath();
    ctx.fillStyle = PIEDRA_SOMBRA;
    ctx.fill();

    /* Las placas. Cada una trae ya su normal y su rampa de doce tonos; aqui
       solo se hace el producto con la luz y se elige el tono. */
    for (k = 0; k < r.celdas.length; k++) {
      var celda = r.celdas[k];
      p = celda.puntos;
      ctx.beginPath();
      ctx.moveTo(p[0].x, p[0].y);
      for (v = 1; v < p.length; v++) { ctx.lineTo(p[v].x, p[v].y); }
      ctx.closePath();
      var difusa = celda.n.x * lx + celda.n.y * ly + celda.n.z * LUZ_Z;
      /* La difusa cruda de estas placas vive entre -0,5 y 0,9: si se lleva
         tal cual a la rampa, media roca cae en el tono mas oscuro y se funde
         con el fondo. Se estira ese intervalo al 0..1 de la rampa para que
         la piedra use los doce tonos y la luz se lea. */
      var tono = Math.floor(((difusa + 0.5) / 1.45) * (PIEDRA_PASOS - 1));
      if (tono < 0) { tono = 0; }
      if (tono > PIEDRA_PASOS - 1) { tono = PIEDRA_PASOS - 1; }
      ctx.fillStyle = celda.rampa[tono];
      ctx.fill();

      /* El grano va recortado a la placa y en un solo relleno: las manchas y
         motas ya vienen en un trazado con su signo. */
      if (celda.manchas) {
        ctx.save();
        ctx.clip();
        ctx.fillStyle = celda.signo > 0
          ? celda.colorClaro[tono]
          : celda.colorOscuro[tono];
        ctx.fill(celda.manchas);
        ctx.restore();
      }
    }

    /* Las fisuras. Todas las aristas en un solo trazo oscuro, y encima las
       que miran a la luz en un segundo trazo claro. Dos cambios de estado
       por roca, no dos por arista. */
    ctx.strokeStyle = 'rgba(12,10,14,0.55)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (k = 0; k < r.celdas.length; k++) {
      var fisura = r.celdas[k];
      for (v = 0; v < fisura.puntos.length; v++) {
        p = fisura.puntos[v];
        q = fisura.puntos[(v + 1) % fisura.puntos.length];
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(q.x, q.y);
      }
    }
    ctx.stroke();

    ctx.strokeStyle = 'rgba(246,230,205,0.35)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (k = 0; k < r.celdas.length; k++) {
      var lumbre = r.celdas[k];
      for (v = 0; v < lumbre.nrm.length; v++) {
        if (lumbre.nrm[v].x * lx + lumbre.nrm[v].y * ly < 0.32) { continue; }
        p = lumbre.puntos[v];
        q = lumbre.puntos[(v + 1) % lumbre.puntos.length];
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(q.x, q.y);
      }
    }
    ctx.stroke();

    /* Los crateres: suelo en sombra y labio iluminado en el lado que mira a
       la luz, no en el opuesto. Giran con la roca porque van dentro de su
       rotacion. */
    var angLuz = Math.atan2(ly, lx);
    for (k = 0; k < r.crateres.length; k++) {
      var cr = r.crateres[k];
      ctx.fillStyle = 'rgba(8,7,11,0.55)';
      ctx.beginPath();
      ctx.arc(cr.x, cr.y, cr.r, 0, Math.PI * 2);
      ctx.fill();
      /* El hundimiento, hacia el lado opuesto a la luz. */
      ctx.fillStyle = 'rgba(0,0,0,0.30)';
      ctx.beginPath();
      ctx.arc(cr.x - lx * cr.r * 0.20, cr.y - ly * cr.r * 0.20,
        cr.r * 0.90, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = rgba(r.borde, 0.90);
      ctx.lineWidth = Math.max(1.1, radio * 0.05);
      ctx.beginPath();
      ctx.arc(cr.x, cr.y, cr.r * 0.95, angLuz - Math.PI / 2, angLuz + Math.PI / 2);
      ctx.stroke();
    }

    /* La boca cosmica: una sola por roca. Negro con estrellas, un nucleo
       calido de tres discos y un halo violeta pegado al labio interior. Nada
       de degradado radial por roca y por fotograma. */
    for (k = 0; k < r.grietas.length; k++) {
      var grieta = r.grietas[k];
      p = grieta.puntos;
      ctx.save();
      /* La boca no puede salirse de la silueta aunque su centro caiga cerca
         del canto. */
      ctx.beginPath();
      ctx.moveTo(r.contorno[0].x, r.contorno[0].y);
      for (v = 1; v < r.contorno.length; v++) {
        ctx.lineTo(r.contorno[v].x, r.contorno[v].y);
      }
      ctx.closePath();
      ctx.clip();

      ctx.beginPath();
      ctx.moveTo(p[0].x, p[0].y);
      for (v = 1; v < p.length; v++) { ctx.lineTo(p[v].x, p[v].y); }
      ctx.closePath();
      ctx.clip();

      ctx.fillStyle = '#05040a';
      ctx.fill();

      /* El halo violeta va solo en el borde interior: se traza el contorno
         con un pincel ancho y el recorte deja la mitad de dentro. */
      ctx.strokeStyle = 'rgba(108,86,216,0.13)';
      ctx.lineWidth = Math.max(2, grieta.radio * 0.30);
      ctx.stroke();

      /* El nucleo calido: tres discos concentricos de alfa bajo, de fuera
         adentro. */
      ctx.fillStyle = '#ffb066';
      ctx.globalAlpha = 0.06;
      ctx.beginPath();
      ctx.arc(grieta.cx, grieta.cy, grieta.radio * 0.62, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 0.12;
      ctx.beginPath();
      ctx.arc(grieta.cx, grieta.cy, grieta.radio * 0.38, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 0.20;
      ctx.beginPath();
      ctx.arc(grieta.cx, grieta.cy, grieta.radio * 0.19, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;

      for (v = 0; v < grieta.estrellas.length; v++) {
        var estrella = grieta.estrellas[v];
        ctx.fillStyle = estrella.color;
        ctx.fillRect(estrella.x - estrella.r / 2, estrella.y - estrella.r / 2,
          estrella.r, estrella.r);
      }
      ctx.restore();

      /* El labio: 2 px claros en el lado que mira a la luz y 1,5 px oscuros
         en el opuesto. */
      ctx.strokeStyle = 'rgba(8,7,12,0.90)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      for (v = 0; v < grieta.nrm.length; v++) {
        if (grieta.nrm[v].x * lx + grieta.nrm[v].y * ly >= 0.15) { continue; }
        p = grieta.puntos[v];
        q = grieta.puntos[(v + 1) % grieta.puntos.length];
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(q.x, q.y);
      }
      ctx.stroke();

      ctx.strokeStyle = rgba(r.borde, 0.90);
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (v = 0; v < grieta.nrm.length; v++) {
        if (grieta.nrm[v].x * lx + grieta.nrm[v].y * ly < 0.15) { continue; }
        p = grieta.puntos[v];
        q = grieta.puntos[(v + 1) % grieta.puntos.length];
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(q.x, q.y);
      }
      ctx.stroke();

      /* La grieta que sale de la boca hacia el canto. Es lo que hace que el
         cosmos parezca estar detras de la piedra y no pegado encima: el
         trazo oscuro abre la placa y el labio claro sigue el lado de la luz. */
      if (grieta.salida && grieta.salida.length > 1) {
        ctx.lineCap = 'round';
        ctx.strokeStyle = 'rgba(8,7,12,0.85)';
        ctx.lineWidth = 2.2;
        ctx.beginPath();
        ctx.moveTo(grieta.salida[0].x, grieta.salida[0].y);
        for (v = 1; v < grieta.salida.length; v++) {
          ctx.lineTo(grieta.salida[v].x, grieta.salida[v].y);
        }
        ctx.stroke();

        ctx.save();
        ctx.translate(lx * 0.9, ly * 0.9);
        ctx.strokeStyle = rgba(r.borde, 0.55);
        ctx.lineWidth = 0.9;
        ctx.beginPath();
        ctx.moveTo(grieta.salida[0].x, grieta.salida[0].y);
        for (v = 1; v < grieta.salida.length; v++) {
          ctx.lineTo(grieta.salida[v].x, grieta.salida[v].y);
        }
        ctx.stroke();
        ctx.restore();
        ctx.lineCap = 'butt';
      }
    }

    /* El contorno: primero toda la silueta en oscuro, que es lo que separa la
       piedra del fondo, y encima el canto claro del tamano SOLO en el arco
       que mira arriba a la izquierda. Un contorno claro cerrado era justo lo
       que aplanaba la roca y la volvia ceramica. */
    ctx.strokeStyle = 'rgba(8,7,12,0.75)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (k = 0; k < r.contorno.length; k++) {
      p = r.contorno[k];
      q = r.contorno[(k + 1) % r.contorno.length];
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(q.x, q.y);
    }
    ctx.stroke();

    ctx.strokeStyle = r.borde;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (k = 0; k < r.contorno.length; k++) {
      if (r.canto[k].x * lx + r.canto[k].y * ly < 0.25) { continue; }
      p = r.contorno[k];
      q = r.contorno[(k + 1) % r.contorno.length];
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(q.x, q.y);
    }
    ctx.stroke();

    ctx.restore();
  }

  /* El destello de impacto. No cuelga de la roca sino de una lista aparte, y
     se dibuja DESPUES de las rocas: es luz, y la luz va encima. */
  function pintarDestellos() {
    for (var i = 0; i < fx.destellos.length; i++) {
      var d = fx.destellos[i];
      var f = d.vida / d.max;
      halo(d.x, d.y, d.r * (0.55 + (1 - f) * 1.1), COLOR_NUCLEO, f * f);
      ctx.save();
      ctx.translate(d.x, d.y);
      ctx.rotate(d.ang);
      ctx.fillStyle = rgba(COLOR_NUCLEO, f);
      ctx.beginPath();
      /* Una estrella de cuatro puntas estirada en la direccion de la bala. */
      ctx.moveTo(d.r * 0.55 * f + 2, 0);
      ctx.lineTo(0, d.r * 0.26 * f);
      ctx.lineTo(-d.r * 0.26 * f, 0);
      ctx.lineTo(0, -d.r * 0.26 * f);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
    ctx.globalAlpha = 1;
  }

  /* ----------------------------------------------------------------- balas */

  function pintarBalas(quieto) {
    var i;
    for (i = 0; i < estado.balas.length; i++) {
      var b = estado.balas[i];
      if (quieto) { continue; }
      /* La estela se apaga hacia atras. Se mide en tiempo y no en pixeles,
         porque la bala del jugador y la del platillo no van a la misma
         velocidad y el rastro tiene que durar lo mismo en las dos. */
      var tx = b.x - b.vx * ESTELA_BALA;
      var ty = b.y - b.vy * ESTELA_BALA;
      /* Si la cola cae al otro lado del borde, la pantalla envuelve y el
         rastro cruzaria el campo entero de lado a lado. En ese caso la bala
         se dibuja sin estela: es un fotograma y no se nota. */
      if (Math.abs(tx - b.x) > ancho / 2 || Math.abs(ty - b.y) > alto / 2) { continue; }
      var base = b.perfora ? TIPOS_BOTIN.perforante.color : COLOR_BALA;
      var g = ctx.createLinearGradient(b.x, b.y, tx, ty);
      g.addColorStop(0, rgba(base, 0.85));
      g.addColorStop(0.35, rgba(base, 0.32));
      g.addColorStop(1, rgba(base, 0));
      ctx.strokeStyle = g;
      ctx.lineWidth = 3.2;
      ctx.beginPath();
      ctx.moveTo(b.x, b.y);
      ctx.lineTo(tx, ty);
      ctx.stroke();
    }
    for (i = 0; i < estado.balas.length; i++) {
      var c = estado.balas[i];
      var tinte = c.perfora ? TIPOS_BOTIN.perforante.color : COLOR_BALA;
      halo(c.x, c.y, 9, tinte, 0.75);
      ctx.fillStyle = COLOR_NUCLEO;
      ctx.beginPath();
      ctx.arc(c.x, c.y, 2.1, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  /* El fogonazo de la boca del canon. Con el arma de nivel 3 hay tres, uno
     por canon, y los tres salen en el mismo cuadro: es la unica manera de
     que el jugador vea de un vistazo por donde esta disparando. */
  function pintarFogonazos() {
    for (var i = 0; i < fx.fogonazos.length; i++) {
      var f = fx.fogonazos[i];
      var v = f.vida / f.max;
      halo(f.x, f.y, 11 * (0.5 + v * 0.7), COLOR_NUCLEO, v * 0.9);
      ctx.save();
      ctx.translate(f.x, f.y);
      ctx.rotate(f.ang);
      ctx.fillStyle = rgba(COLOR_NUCLEO, v);
      ctx.beginPath();
      /* Cuatro puntas: arriba, derecha, abajo, izquierda. */
      ctx.moveTo(7 * v + 1.5, 0);
      ctx.lineTo(0, 4 * v);
      ctx.lineTo(-3 * v, 0);
      ctx.lineTo(0, -4 * v);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
    ctx.globalAlpha = 1;
  }

  /* --------------------------------------------------------------- platillo */

  /* El platillo: una cupula, un cuerpo achatado, tres luces y un motor. La
     cupula va en turquesa translucido con un reflejo, que es el mismo color
     de la cabina de la nave: los dos unicos objetos del campo con algo
     encendido por dentro, y por eso el ojo los separa del resto. */
  function pintarPlatillo(pf) {
    ctx.save();
    ctx.translate(pf.x, pf.y);
    /* Se inclina hacia el lado del zigzag. Como se usa el valor absoluto de
       la velocidad horizontal, nunca se da la vuelta del todo. */
    ctx.rotate(Math.atan2(pf.vy, Math.abs(pf.vx)) * 0.3);

    /* El motor: un halo turquesa por detras del platillo, mas largo cuanto
       mas rapido va. Es lo que dice que viene de fuera. */
    halo(-Math.sign(pf.vx) * 26, 2, 20, COLOR_CABINA, 0.4);
    ctx.fillStyle = rgba(COLOR_CABINA, 0.35);
    ctx.beginPath();
    ctx.moveTo(0, -3);
    ctx.lineTo(-Math.sign(pf.vx) * 20, 0);
    ctx.lineTo(0, 3);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = rgba(COLOR_ROCA[4], 0.34);
    ctx.strokeStyle = rgba(BORDE_ROCA[4], 0.95);
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.ellipse(0, 0, 20, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    /* La cupula. */
    ctx.fillStyle = rgba(COLOR_CABINA, 0.26);
    ctx.beginPath();
    ctx.ellipse(0, -1, 8, 7, 0, Math.PI, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = rgba(COLOR_CABINA, 0.9);
    ctx.lineWidth = 1.4;
    ctx.stroke();
    ctx.strokeStyle = rgba(COLOR_CABINA_ALTA, 0.8);
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(0, -1, 5, Math.PI * 1.12, Math.PI * 1.55);
    ctx.stroke();

    /* Las tres luces de la base, en el color de sus balas. Encendidas, con
       su halo: son las que avisan de que el platillo dispara. */
    for (var k = -1; k <= 1; k++) {
      halo(k * 10, 4.5, 7, COLOR_PLATILLO, 0.7);
      ctx.fillStyle = COLOR_PLATILLO;
      ctx.beginPath();
      ctx.arc(k * 10, 4.5, 2.1, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  /* Las balas del platillo son rojas y no hay ningun otro rojo en el campo:
     ese es el gasto de quitarlas. */
  function pintarBalasPlatillo(pf, quieto) {
    var i;
    if (!quieto) {
      for (i = 0; i < pf.balas.length; i++) {
        var b = pf.balas[i];
        var tx = b.x - b.vx * ESTELA_BALA;
        var ty = b.y - b.vy * ESTELA_BALA;
        if (Math.abs(tx - b.x) > ancho / 2 || Math.abs(ty - b.y) > alto / 2) { continue; }
        var g = ctx.createLinearGradient(b.x, b.y, tx, ty);
        g.addColorStop(0, rgba(COLOR_PLATILLO, 0.8));
        g.addColorStop(0.35, rgba(COLOR_PLATILLO, 0.3));
        g.addColorStop(1, rgba(COLOR_PLATILLO, 0));
        ctx.strokeStyle = g;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(b.x, b.y);
        ctx.lineTo(tx, ty);
        ctx.stroke();
      }
    }
    for (i = 0; i < pf.balas.length; i++) {
      var c = pf.balas[i];
      halo(c.x, c.y, 10, COLOR_PLATILLO, 0.8);
      ctx.fillStyle = COLOR_PLATILLO;
      ctx.beginPath();
      ctx.arc(c.x, c.y, 2.2, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  /* ------------------------------------------------------------------ jefe

     Pintarlo es la mitad de hacerlo jugable: casco oscuro con dos alas, el
     nucleo en el centro y el anillo de vida alrededor. Los tres leo del
     acento de la fase, para que el jefe se vista del mismo color con el que
     la fase ya habla. */

  function pintarBalasJefe(j, quieto) {
    var a = (RONDAS[estado.ronda] || RONDAS[0]).acento || COLOR_PLATILLO;
    var i;
    if (!quieto) {
      for (i = 0; i < j.balas.length; i++) {
        var b = j.balas[i];
        var tx = b.x - b.vx * ESTELA_BALA;
        var ty = b.y - b.vy * ESTELA_BALA;
        if (Math.abs(tx - b.x) > ancho / 2 || Math.abs(ty - b.y) > alto / 2) {
          continue;
        }
        var g = ctx.createLinearGradient(b.x, b.y, tx, ty);
        g.addColorStop(0, rgba(a, 0.8));
        g.addColorStop(0.35, rgba(a, 0.3));
        g.addColorStop(1, rgba(a, 0));
        ctx.strokeStyle = g;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(b.x, b.y);
        ctx.lineTo(tx, ty);
        ctx.stroke();
      }
    }
    for (i = 0; i < j.balas.length; i++) {
      var c = j.balas[i];
      halo(c.x, c.y, 12, a, 0.8);
      ctx.fillStyle = rgba(a, 0.95);
      ctx.beginPath();
      ctx.arc(c.x, c.y, 2.6, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  /* Un rectangulo con las esquinas redondas, trazado a mano porque no todos
     los navegadores traen roundRect. Se anade al camino que ya esta abierto,
     sin borrarlo, para poder pintar las dos alas en un solo relleno. */
  function trazaRectanguloRedondo(x, y, w, h, r) {
    var rr = Math.max(0, Math.min(r, w / 2, h / 2));
    ctx.moveTo(x + rr, y);
    ctx.lineTo(x + w - rr, y);
    ctx.arcTo(x + w, y, x + w, y + rr, rr);
    ctx.lineTo(x + w, y + h - rr);
    ctx.arcTo(x + w, y + h, x + w - rr, y + h, rr);
    ctx.lineTo(x + rr, y + h);
    ctx.arcTo(x, y + h, x, y + h - rr, rr);
    ctx.lineTo(x, y + rr);
    ctx.arcTo(x, y, x + rr, y, rr);
    ctx.closePath();
  }

  /* Las dos alas del Centinela. Cada una es un rectangulo redondeado pegado
     al casco y una punta triangular que se sale hacia fuera. */
  function trazaAlasJefe() {
    var i;
    for (i = -1; i <= 1; i += 2) {
      trazaRectanguloRedondo(i < 0 ? -50 : 10, -12, 40, 24, 11);
      ctx.moveTo(i * 44, -14);
      ctx.lineTo(i * 78, 2);
      ctx.lineTo(i * 44, 18);
      ctx.closePath();
    }
  }

  function pintarJefe(j, quieto) {
    var fase = RONDAS[estado.ronda] || RONDAS[0];
    var a = fase.acento || COLOR_PLATILLO;

    /* La sombra de entrada: mientras el Centinela baja desde arriba, debajo
       de el crece una sombra. Es lo que dice que se esta posando y no
       flotando; cuando ya esta en su altura, la sombra se retira. */
    var entrada = Math.min(1, j.edad / JEFE.ENTRADA);
    if (entrada < 1) {
      var sy = j.y + JEFE.ANILLO * 0.95;
      var sr = JEFE.ANILLO * (0.7 + 0.7 * entrada);
      ctx.save();
      ctx.translate(j.x, sy);
      ctx.scale(1, 0.3);
      var sg = ctx.createRadialGradient(0, 0, 0, 0, 0, sr);
      sg.addColorStop(0, rgba('#000000', 0.5 * entrada));
      sg.addColorStop(0.6, rgba('#000000', 0.22 * entrada));
      sg.addColorStop(1, rgba('#000000', 0));
      ctx.fillStyle = sg;
      ctx.beginPath();
      ctx.arc(0, 0, sr, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    halo(j.x, j.y, JEFE.ANILLO * 1.6, a, quieto ? 0.10 : 0.16);

    ctx.save();
    ctx.translate(j.x, j.y);

    /* Las alas: dos rectangulos redondos pegados al casco y una punta
       triangular que sale hacia fuera. Las dos en el mismo trazado, para que
       queden simetricas sin dibujarlas a mano una por una. */
    ctx.fillStyle = rgba('#302238', 0.95);
    ctx.strokeStyle = rgba(a, 0.45);
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    trazaAlasJefe();
    ctx.fill();
    ctx.stroke();

    /* El casco: la misma ojiva del platillo, mas ancha y mas oscura, con
       el canto en el acento pero a media luz. */
    ctx.fillStyle = rgba('#241a28', 0.96);
    ctx.strokeStyle = rgba(a, 0.65);
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.ellipse(0, 2, 44, 26, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    /* La visera: una franja curva arriba del casco. Es lo que le da cara. */
    ctx.strokeStyle = rgba(a, 0.35);
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 2, 36, Math.PI * 1.15, Math.PI * 1.85);
    ctx.stroke();

    /* El nucleo. Cerrado: una piedra de color vino con un halo bajo, que es
       lo que dice que el nucleo esta tapiado. Abierto: la misma piedra
       encendida en crema, con su halo fuerte y un latido si el juego anima. */
    if (j.abierto) {
      var latido = quieto ? 1 : 1 + Math.sin(reloj * 7) * 0.08;
      halo(0, 0, 34 * latido, JEFE.NUCLEO_ABIERTO, 0.6);
      ctx.fillStyle = rgba(JEFE.NUCLEO_ABIERTO, 0.95);
      ctx.beginPath();
      ctx.arc(0, 0, 13 * latido, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = rgba('#ffffff', 0.85);
      ctx.beginPath();
      ctx.arc(0, 0, 4.5, 0, Math.PI * 2);
      ctx.fill();
    } else {
      halo(0, 0, 24, JEFE.NUCLEO_CERRADO, 0.3);
      ctx.fillStyle = rgba(JEFE.NUCLEO_CERRADO, 0.98);
      ctx.beginPath();
      ctx.arc(0, 0, 13, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = rgba(JEFE.NUCLEO_ABIERTO, 0.35);
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = rgba(JEFE.NUCLEO_ABIERTO, 0.4);
      ctx.beginPath();
      ctx.arc(0, 0, 3, 0, Math.PI * 2);
      ctx.fill();
    }

    /* El anillo de vida. El trazo del fondo es el anillo entero, apagado;
       la vida que queda se dibuja desde arriba y hacia el lado contrario
       del reloj, con lo que el hueco crece yendo en sentido horario. */
    ctx.strokeStyle = rgba(a, 0.22);
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, JEFE.ANILLO, 0, Math.PI * 2);
    ctx.stroke();
    var vida = Math.max(0, j.hp) / j.hpMax;
    if (vida > 0) {
      ctx.strokeStyle = rgba(a, 0.9);
      ctx.lineWidth = 3.2;
      ctx.beginPath();
      ctx.arc(0, 0, JEFE.ANILLO, -Math.PI / 2,
              -Math.PI / 2 + vida * Math.PI * 2, true);
      ctx.stroke();
    }

    ctx.restore();
  }

  /* El laser por delante del jefe y por debajo de la nave. Aviso: linea
     fina que late. Barrido: la columna de 18 px con su alma blanca. */
  function pintarLaserJefe(quieto) {
    var j = estado.jefe;
    if (!j || !j.laser) { return; }
    var l = j.laser;
    var a = (RONDAS[estado.ronda] || RONDAS[0]).acento || COLOR_PLATILLO;
    if (l.avisoEn > 0) {
      var perfil = quieto ? 0.55
        : (Math.floor(reloj * 10) % 2 === 0 ? 0.75 : 0.30);
      ctx.strokeStyle = rgba(a, perfil);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(l.x, 0);
      ctx.lineTo(l.x, alto);
      ctx.stroke();
    } else {
      ctx.fillStyle = rgba(a, 0.55);
      ctx.fillRect(l.x - JEFE.LASER_ANCHO / 2, 0, JEFE.LASER_ANCHO, alto);
      ctx.fillStyle = rgba(COLOR_NUCLEO, 0.8);
      ctx.fillRect(l.x - 1, 0, 2, alto);
    }
  }

  /* ---------------------------------------------------------------- botines */

  /* Un botin: un cuerpo con fondo, un anillo de su color, un nucleo que
     gira mas deprisa que el cuerpo y el glifo de su tipo encima. El fondo
     opaco es lo que hace que el glifo se lea contra el cielo: sin el, el
     rosa sobre el azul de una nebulosa se pierde. */
  function pintarBotin(b, quieto) {
    var color = TIPOS_BOTIN[b.tipo].color;
    var opacidad = opacidadBotin(b);
    if (opacidad <= 0.02) { return; }
    var pulso = quieto ? 1 : (1 + Math.sin(b.vida * 5) * 0.1);
    var r = RADIO_BOTIN * pulso;

    halo(b.x, b.y, r * 2.6, color, opacidad * 0.45);

    ctx.save();
    ctx.globalAlpha = opacidad;
    ctx.translate(b.x, b.y);
    ctx.rotate(b.ang);
    ctx.strokeStyle = color;
    ctx.lineJoin = 'round';
    ctx.lineWidth = 2;

    /* El nucleo gira al reves y mas rapido: es lo que dice que el botin esta
       vivo y no puesto ahi. Va pequeno y tenue, por debajo del glifo, para
       que a 341 de ancho no compita con lo que hay que leer. */
    ctx.save();
    ctx.rotate(-b.ang * 1.8);
    ctx.strokeStyle = rgba(color, 0.45);
    ctx.lineWidth = 1.3;
    ctx.beginPath();
    for (var q = 0; q < 3; q++) {
      var aq = (q / 3) * Math.PI * 2;
      if (q === 0) { ctx.moveTo(Math.cos(aq) * r * 0.34, Math.sin(aq) * r * 0.34); }
      else { ctx.lineTo(Math.cos(aq) * r * 0.34, Math.sin(aq) * r * 0.34); }
    }
    ctx.closePath();
    ctx.stroke();
    ctx.restore();

    /* El cuerpo. Relleno opaco del color del fondo antes que el hexagono:
     es lo que hace legible el glifo sin ensancharlo. */
    ctx.beginPath();
    for (var k = 0; k < 6; k++) {
      var a = (k / 6) * Math.PI * 2;
      if (k === 0) { ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r); }
      else { ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); }
    }
    ctx.closePath();
    ctx.fillStyle = rgba(COLOR_FONDO, 0.62);
    ctx.fill();
    ctx.strokeStyle = color;
    ctx.lineWidth = 2.2;
    ctx.stroke();

    ctx.lineWidth = 2.2;
    ctx.strokeStyle = color;
    glifoBotin(b.tipo);
    ctx.restore();
    ctx.globalAlpha = 1;
  }

  function glifoBotin(tipo) {
    ctx.beginPath();
    if (tipo === 'arma') {
      /* Un soporte con una flecha: subir de nivel. */
      ctx.moveTo(-5, 5); ctx.lineTo(5, 5);
      ctx.moveTo(0, 4); ctx.lineTo(0, -2);
      ctx.moveTo(-4, 1); ctx.lineTo(0, -5); ctx.lineTo(4, 1);
    } else if (tipo === 'cadencia') {
      /* Tres barras de altura creciente: disparas mas seguido. */
      ctx.moveTo(-4.5, 5); ctx.lineTo(-4.5, 1.5);
      ctx.moveTo(0, 5); ctx.lineTo(0, -1.5);
      ctx.moveTo(4.5, 5); ctx.lineTo(4.5, -4.5);
    } else if (tipo === 'perforante') {
      /* Una flecha que atraviesa una linea vertical. */
      ctx.moveTo(-6, 0); ctx.lineTo(6, 0);
      ctx.moveTo(2.5, -3.5); ctx.lineTo(6, 0); ctx.lineTo(2.5, 3.5);
      ctx.moveTo(-0.5, -5.5); ctx.lineTo(-0.5, 5.5);
    } else {
      /* Un escudo. */
      ctx.moveTo(0, -6); ctx.lineTo(5.5, -3.5); ctx.lineTo(5.5, 1);
      ctx.lineTo(0, 6); ctx.lineTo(-5.5, 1); ctx.lineTo(-5.5, -3.5);
      ctx.closePath();
    }
    ctx.stroke();
  }

  /* ------------------------------------------------------------------ nave */

  /* El sprite de la nave. Va recortado a su contenido, con un 4 % de aire y
     a 176 px de alto, asi que dibujarlo a 38 px de ancho no lo deforma. Si
     la imagen falla o aun no ha llegado, la nave sigue siendo el fuselaje
     vectorial de siempre: el juego nunca se queda sin nave. */
  var naveSprite = new Image();
  var naveLista = false;
  naveSprite.onload = function () { naveLista = true; };
  naveSprite.src = 'assets/img/juego/nave.webp';

  /* ------------------------------------------------------------------ rocas
     Los doce sprites de asteroide real (dominio publico), cargados UNA vez al
     arrancar. `rocasSprite[tam][variante]` guarda la imagen y `rocasListas`
     cuenta cuantas han terminado, con exito o sin el: hasta que las doce no
     estan en 12, `pintarRoca` sigue con el dibujado procedural de siempre, que
     queda como respaldo. */
  var VARIANTES_ROCA = ['a', 'b', 'c'];
  var rocasSprite = {};
  var rocasListas = 0;
  (function cargarRocasSprite() {
    var tamanos = [4, 3, 2, 1];
    var t;
    var v;
    for (t = 0; t < tamanos.length; t++) {
      var tam = tamanos[t];
      rocasSprite[tam] = [];
      for (v = 0; v < VARIANTES_ROCA.length; v++) {
        var imagen = new Image();
        imagen.onload = function () { rocasListas++; };
        imagen.onerror = function () { rocasListas++; };
        imagen.src = 'assets/img/juego/roca-' + tam + '-' +
          VARIANTES_ROCA[v] + '.webp';
        rocasSprite[tam].push(imagen);
      }
    }
  })();

  /* El sprite es un cuadrado con el asteroide dentro. Este factor lleva el
     RADIO del dibujado procedural al hueco que ocupa el sprite: el asteroide
     no llena el cuadrado, asi que hay que sobredimensionarlo para que la
     silueta visible coincida con la de antes. Elegido midiendo, no mirando:
     el diametro del circulo de igual area que la silueta, dibujado a
     RADIO*3.0, queda en 0,98 del diametro procedural de media (1,04 en los
     tres cuerpos redondos y 0,80 en Ida, que es alargada y por eso llena
     menos cuadrado). Ni RADIO ni la colision (RADIO + 11) cambian. */
  var FACTOR_SPRITE_ROCA = 3.0;

  var NAVE_ANCHO = 32;

  /* La nave: el sprite si esta, y si no el fuselaje vectorial con su cabina
     y sus lineas de panel. El motor y el nivel de arma se pintan igual en
     los dos casos, para que la nave se lea aunque la imagen no llegue. */
  function pintarNave(n, quieto) {
    var empuje = quieto
      ? (estado.empuja ? 0.8 : 0.2)
      : empujeNave(n);

    halo(n.x - Math.cos(n.ang) * 12, n.y - Math.sin(n.ang) * 12,
         20 + 16 * empuje, COLOR_BALA, 0.22 + 0.2 * empuje);

    ctx.save();
    ctx.translate(n.x, n.y);
    ctx.rotate(n.ang);

    /* El motor. Tres capas: el halo, el cuerpo de la llama y el nucleo. La
       longitud depende del empuje, y el cuerpo vibra de un fotograma a otro
       para que no parezca un cono de carton. La raiz va en el borde de atras
       de lo que se este dibujando: x = -13 con el sprite, cuyo culo acaba
       en -14, y x = -6 con el fuselaje vectorial. */
    var raiz = naveLista ? -13 : -6;
    var anchoRaiz = naveLista ? 3 : 6;
    var largo = LLAMA_CORTA + (LLAMA_LARGA - LLAMA_CORTA) * empuje +
      (quieto ? 0 : Math.random() * 5);
    if (naveLista) { largo *= 1.15; }
    ctx.fillStyle = rgba(COLOR_LLAMA, 0.55);
    ctx.beginPath();
    ctx.moveTo(raiz, -anchoRaiz);
    ctx.lineTo(raiz - largo, 0);
    ctx.lineTo(raiz, anchoRaiz);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = rgba(COLOR_BALA, 0.85);
    ctx.beginPath();
    ctx.moveTo(raiz, -anchoRaiz * 0.6);
    ctx.lineTo(raiz - largo * 0.66, 0);
    ctx.lineTo(raiz, anchoRaiz * 0.6);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = rgba(COLOR_NUCLEO, 0.9);
    ctx.beginPath();
    ctx.moveTo(raiz, -anchoRaiz * 0.27);
    ctx.lineTo(raiz - largo * 0.3, 0);
    ctx.lineTo(raiz, anchoRaiz * 0.27);
    ctx.closePath();
    ctx.fill();

    if (naveLista) {
      /* El sprite apunta hacia arriba y n.ang es hacia donde va la nave: de
         ahi el cuarto de vuelta. Se centra en la nave y conserva la
         proporcion del archivo, 210 x 176. */
      var altoSprite = NAVE_ANCHO * naveSprite.height / naveSprite.width;
      ctx.save();
      ctx.rotate(Math.PI / 2);
      ctx.drawImage(naveSprite, -NAVE_ANCHO / 2, -altoSprite / 2,
        NAVE_ANCHO, altoSprite);
      ctx.restore();
    } else {
      /* El fuselaje vectorial, el de siempre. */
      ctx.beginPath();
      ctx.moveTo(16, 0);
      ctx.lineTo(-11, 9);
      ctx.lineTo(-6, 0);
      ctx.lineTo(-11, -9);
      ctx.closePath();
      ctx.fillStyle = '#f4e4dc';
      ctx.fill();
      ctx.strokeStyle = COLOR_NUCLEO;
      ctx.lineWidth = 1.7;
      ctx.stroke();

      ctx.strokeStyle = rgba(COLOR_SOMBRA, 0.42);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(-2.5, -6.4); ctx.lineTo(-7.5, -7.2);
      ctx.moveTo(-2.5, 6.4); ctx.lineTo(-7.5, 7.2);
      ctx.moveTo(-5, 0); ctx.lineTo(9, 0);
      ctx.stroke();

      ctx.fillStyle = rgba(COLOR_CABINA, 0.9);
      ctx.beginPath();
      ctx.ellipse(3.5, 0, 5, 2.8, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = rgba(COLOR_CABINA_ALTA, 0.85);
      ctx.beginPath();
      ctx.ellipse(4.5, -0.8, 2.2, 1.1, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    /* El nivel del arma se sigue viendo sin apartar la vista del campo: dos
       destellos dorados cortos en las alas desde el nivel 2, y un tercero en
       el lomo con el nivel 3. Con el sprite el ala acaba en |y| = 17 y el
       morro en x = 19; con el fuselaje vectorial, en 9 y 16. */
    if (estado.arma >= 2) {
      var ax = naveLista ? 1 : 6;
      var ay = naveLista ? 14.4 : 7;
      var bx = naveLista ? 3.6 : 10;
      var by = naveLista ? 16.8 : 7;
      ctx.strokeStyle = rgba(COLOR_BALA, 0.9);
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.moveTo(ax, -ay); ctx.lineTo(bx, -by);
      ctx.moveTo(ax, ay); ctx.lineTo(bx, by);
      ctx.stroke();
      ctx.strokeStyle = rgba(COLOR_NUCLEO, 0.95);
      ctx.lineWidth = 0.9;
      ctx.stroke();

      if (estado.arma >= 3) {
        var cx = naveLista ? 10.5 : 12;
        ctx.strokeStyle = rgba(COLOR_BALA, 0.9);
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.moveTo(cx, 0); ctx.lineTo(cx + 4, 0);
        ctx.stroke();
        ctx.strokeStyle = rgba(COLOR_NUCLEO, 0.95);
        ctx.lineWidth = 0.9;
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  /* ------------------------------------------------------------- estela */

  function pintarEstela(quieto) {
    if (quieto) { return; }
    for (var i = 0; i < fx.estela.length; i++) {
      var p = fx.estela[i];
      var f = Math.max(0, p.vida / p.max);
      ctx.globalAlpha = f * 0.85;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r * (0.35 + f * 0.65), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  /* --------------------------------------------------------- explosiones */

  function pintarEstallidos(quieto) {
    for (var i = 0; i < fx.estallidos.length; i++) {
      var e = fx.estallidos[i];
      var f = Math.max(0, e.vida / e.max);
      var q = 1 - f;

      /* El destello: un nucleo blanco que se apaga en un doceavo. Con
         movimiento reducido no hay destello, porque es un fogonazo. */
      if (!quieto) {
        var df = f * f;
        halo(e.x, e.y, (8 + 26 * e.escala) * (0.6 + (1 - f) * 1.2), COLOR_NUCLEO, df);
      }

      /* El anillo de onda. */
      var r = e.anillo0 + (e.anillo1 - e.anillo0) * q;
      ctx.globalAlpha = f * f * 0.9;
      ctx.strokeStyle = e.borde;
      ctx.lineWidth = e.anilloGrueso * (0.3 + f * 0.7);
      ctx.beginPath();
      ctx.arc(e.x, e.y, r, 0, Math.PI * 2);
      ctx.stroke();
      halo(e.x, e.y, r * 1.3, e.borde, f * 0.4);

      /* Las particulas. */
      for (var j = 0; j < e.particulas.length; j++) {
        var p = e.particulas[j];
        var pf = Math.max(0, p.vida / (0.16 + 0.2 + 0.3 * e.escala));
        ctx.globalAlpha = Math.min(1, pf) * 0.9;
        ctx.fillStyle = e.borde;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r * (0.3 + pf * 0.7), 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      /* Los escombros: trozos de la roca girando. */
      for (j = 0; j < e.escombros.length; j++) {
        var s = e.escombros[j];
        var sf = Math.max(0, s.vida / (0.2 + 0.25 + 0.3 * e.escala));
        ctx.save();
        ctx.translate(s.x, s.y);
        ctx.rotate(s.ang);
        ctx.globalAlpha = Math.min(1, sf);
        ctx.beginPath();
        for (var v = 0; v < 5; v++) {
          var av = (v / 5) * Math.PI * 2;
          var rv = s.r * (0.7 + ((v * 37) % 10) / 14);
          if (v === 0) { ctx.moveTo(Math.cos(av) * rv, Math.sin(av) * rv); }
          else { ctx.lineTo(Math.cos(av) * rv, Math.sin(av) * rv); }
        }
        ctx.closePath();
        ctx.fillStyle = s.color;
        ctx.fill();
        ctx.strokeStyle = s.borde;
        ctx.lineWidth = 1.2;
        ctx.stroke();
        ctx.restore();
      }
      ctx.globalAlpha = 1;
    }
  }

  /* --------------------------------------------------------------- dibujar */

  /* El juego dibuja sesenta veces por segundo, y eso no puede seguir pasando
     si nadie lo esta mirando: se gasta la bateria y hace que el resto de la
     pagina vaya mas lento. El bucle se para en cuanto pasa cualquiera de las
     dos cosas, y arranca otra vez al volver. Al arrancar se reinicia el reloj
     para que el primer cuadro no de un salto de medio minuto. */
  var corriendo = false;
  var pausado = false;
  /* El frame que hay encolado ahora mismo. Sin guardarlo, un parar() seguido
     de un arrancar() antes de que el frame llegue a correr dejaba DOS cadenas
     vivas: la vieja -que ya no se puede cancelar- y la nueva. Cada ciclo de
     visibilitychange o del IntersectionObserver sumaba una mas sin techo. Con
     el identificador, parar() cancela el frame pendiente y arrancar() sabe si
     ya hay uno en camino. */
  var frameId = 0;

  function arrancar() {
    /* La pausa manda sobre todo lo demas. Al cambiar de pestana o al salir el
       tablero de la pantalla vuelve a llamar arrancar(), y si aqui no se
       mirase la pausa el juego se seguiria jugando solo. */
    if (corriendo || frameId || !lienzo || pausado) { return; }
    corriendo = true;
    anterior = performance.now();
    frameId = requestAnimationFrame(paso);
  }

  function parar() {
    corriendo = false;
    if (frameId) {
      cancelAnimationFrame(frameId);
      frameId = 0;
    }
  }

  function paso(t) {
    /* Este frame ya se ha consumido: si no se limpia, parar() cancelaria un
       frame que ya corrio y arrancar() creeria que hay uno pendiente. */
    frameId = 0;
    if (!corriendo) { return; }
    var dt = Math.min(0.05, (t - anterior) / 1000);
    anterior = t;
    reloj = t / 1000;
    /* Con el puntero apoyado se dispara solo, con la cadencia de CADENCIA.
       Va antes de actualizar para que la bala salga en el mismo cuadro en que
       la nave ha girado hacia donde esta el dedo. */
    if (puntero && !estado.terminado && reloj >= proximoDisparo) {
      disparar();
      proximoDisparo = reloj + cadenciaActual();
    }
    actualizar(dt);
    dibujar(reloj);
    /* La sacudida del lienzo se refresca en cada fotograma mientras dure, y
       se limpia sola cuando se acaba el reloj. */
    aplicarSacudida();
    /* Diez veces por segundo es suficiente para que una cuenta atras se lea
       como cuenta atras, y de paso escribe lo mismo cuando nada ha
       cambiado. La cadencia se mide en el propio bucle, que es donde sale. */
    if (reloj >= proximoMarcador) {
      proximoMarcador = reloj + 0.1;
      pintarMarcador();
      pintarEfectos();
    }
    frameId = requestAnimationFrame(paso);
  }

  /* ------------------------------------------------------------------ pausa */

  /* La pausa congela el bucle sin tocar el estado: ni una roca avanza, ni un
     punto se suma, ni un escudo gasta. El aviso va en el DOM, no pintado en
     el lienzo, por dos razones: un lector de pantalla lo anuncia y se ve
     aunque el canvas no se pueda dibujar, y sale con los tipos y los colores
     de la pagina sin tener que reimplementar el texto dentro del contexto. */
  function pausar() {
    if (pausado) { return; }
    pausado = true;
    soltarPuntero();
    parar();
    nodos.pausa.hidden = false;
    nodos.estado.textContent = 'En pausa';
    sincronizarPausa();
    anunciar('Juego en pausa. Pulsa P o Escape para seguir.');
  }

  function seguir() {
    if (!pausado) { return; }
    pausado = false;
    nodos.pausa.hidden = true;
    pintarMarcador();
    sincronizarPausa();
    anunciar('Juego reanudado.');
    arrancar();
  }

  function alternarPausa() {
    if (pausado) { seguir(); } else { pausar(); }
  }

  /* El boton de pausa del marco dice en todo momento en que estado esta: el
     pulsado lo pone y lo quita la pausa, venga de donde venga -la tecla P,
     el propio boton o el cierre de pantalla completa-. */
  function sincronizarPausa() {
    if (!nodosMarco.btnPausa) { return; }
    nodosMarco.btnPausa.setAttribute('aria-pressed', pausado ? 'true' : 'false');
    nodosMarco.btnPausa.setAttribute('aria-label',
      pausado ? 'Reanudar el juego' : 'Pausar el juego');
  }

  /* El boton de silencio del marco dice en todo momento en que estado esta.
     Cuando esta mudo lleva la clase que cambia la onda por la cruz. */
  function sincronizarSilencio() {
    var b = nodosMarco.btnSilencio;
    if (!b) { return; }
    b.setAttribute('aria-pressed', audio.mudo ? 'true' : 'false');
    b.setAttribute('aria-label', audio.mudo ? 'Activar el sonido' : 'Silenciar el sonido');
    if (b.classList) { b.classList.toggle('astro__mando--mudo', audio.mudo); }
  }

  /* ---------------------------------------------------------- visibilidad

     Con el menu de inicio o la capa de fin delante, el HUD no tiene sentido:
     sus cifras y sus botones serian ruido encima de una pantalla que pide otra
     cosa. Se esconde el HUD entero -cifras, contadores, estado, efectos-, los
     mandos y la linea de lectura. Y el boton de pausa, ademas, no puede quedar
     a la vista cuando la partida ha terminado: pulsarlo no haria nada util. */
  function sincronizarHud() {
    /* El menu de inicio y la capa de fin tapan la partida entera, asi que
       debajo de cualquiera de las dos no tiene sentido ensenar cifras ni
       botones. El cartel de turno, en cambio, NO tapa la partida: deja ver el
       marcador mientras se decide la ronda siguiente. */
    var capaEncima = (nodosMarco.menu && !nodosMarco.menu.hidden) ||
                     (nodosMarco.fin && !nodosMarco.fin.hidden);
    if (nodosMarco.hud) { nodosMarco.hud.hidden = capaEncima; }
    if (nodosMarco.estado) { nodosMarco.estado.hidden = capaEncima; }
    if (nodosMarco.efectos) { nodosMarco.efectos.hidden = capaEncima || nodos.efectos.hidden; }
    if (nodosMarco.mandos) { nodosMarco.mandos.hidden = capaEncima; }
    if (nodosMarco.lectura) { nodosMarco.lectura.hidden = capaEncima; }
    /* El boton de pausa, en concreto, tampoco puede verse con la partida
       terminada: pulsarlo no haria nada util. Los demas mandos -silencio y
       salir de pantalla completa- siguen teniendo sentido, asi que solo se
       esconde el de pausa. */
    if (nodosMarco.btnPausa) {
      nodosMarco.btnPausa.hidden = capaEncima || estado.terminado;
    }
  }

  /* --------------------------------------------------------------- mandos */

  /* Con el teclado: las flechas giran y empujan. Con la flecha de arriba solo
     empuja, para quien prefiera girar sin mover la nave. P y Escape pausan, R
     reinicia la partida. */
  var TECLAS = { ArrowLeft: -1, a: -1, A: -1, ArrowRight: 1, d: 1, D: 1 };
  var IMPULSO_SOLO = { ArrowUp: 1, w: 1, W: 1 };
  var PAUSA = { p: 1, P: 1, Escape: 1 };
  var REINICIO = { r: 1, R: 1 };
  /* Con el foco puesto encima, estas teclas son del boton o del enlace que
     tiene el foco, no del juego. */
  var ETIQUETAS_DE_CONTROL = { BUTTON: 1, A: 1, INPUT: 1 };

  function esControl(nodo) {
    return !!nodo && !!ETIQUETAS_DE_CONTROL[nodo.tagName];
  }

  function alPulsar(e) {
    if (e.metaKey || e.ctrlKey || e.altKey) { return; }
    var tecla = e.key;
    var espacio = tecla === ' ' || tecla === 'Spacebar';
    /* Sin esto, con el foco en "Ronda siguiente" la barra espaciadora
       disparaba una bala en vez de empezar la ronda: el juego le robaba el
       clic al boton. Las flechas se siguen capturando, que para un juego si
       es lo correcto, y P, Escape y R tambien siguen siendo del juego: si no,
       pausar dejaria de funcionar en cuanto el jugador pulsara un boton. */
    if (espacio && esControl(document.activeElement)) { return; }
    if (espacio) {
      /* En pausa la barra espaciadora no dispara ni se la queda el juego: el
         juego esta congelado y la tecla no pinta nada. */
      if (pausado) { return; }
      e.preventDefault();
      disparar();
      return;
    }
    if (PAUSA[tecla]) {
      e.preventDefault();
      alternarPausa();
      return;
    }
    if (REINICIO[tecla]) {
      e.preventDefault();
      reiniciar();
      return;
    }
    if (IMPULSO_SOLO[tecla]) {
      e.preventDefault();
      estado.empuja = 1;
      return;
    }
    var dir = TECLAS[tecla];
    if (dir) {
      e.preventDefault();
      estado.girando = dir;
      estado.empuja = 1;
    }
  }

  function alSoltar(e) {
    var dir = TECLAS[e.key];
    if (dir && estado.girando === dir) { estado.girando = 0; estado.empuja = 0; }
    if (IMPULSO_SOLO[e.key]) { estado.empuja = 0; }
  }

  /* Con el dedo o con el boton del raton hay UN gesto: el puntero apoyado
     sobre el lienzo gira la nave hacia donde esta y dispara solo, con la
     cadencia de CADENCIA. Asi no hay que aprender dos gestos distintos para
     jugar en un celular, y un toque corto sigue lanzando su bala aunque sea
     de un solo cuadro.

     El angulo se mide desde el CENTRO del lienzo y no desde la nave: el campo
     se envuelve, y cuando la nave esta pegada a un borde el centro es la
     unica referencia estable; medir desde la nave haria que el mismo punto de
     la pantalla apuntara en dos direcciones distintas. */
  var puntero = null;
  var proximoDisparo = 0;
  var proximoMarcador = 0;

  function apuntar(e) {
    if (!estado.nave || estado.terminado) { return; }
    var r = lienzo.getBoundingClientRect();
    var dx = e.clientX - (r.left + r.width / 2);
    var dy = e.clientY - (r.top + r.height / 2);
    estado.nave.ang = Math.atan2(dy, dx);
  }

  function alBajar(e) {
    if (pausado) { return; }
    if (e.target && e.target.closest && e.target.closest('button')) { return; }
    /* Sin esto, si el dedo se va del lienzo el pointerup nunca llega y la
       nave se queda empujando sola hasta el fin de la partida. Con la captura
       el dedo levanta vuelve al lienzo aunque este fuera. Va antes de tocar
       el estado a proposito: si el navegador la negara, el gesto no se
       empieza y el motor no queda encendido. */
    lienzo.setPointerCapture(e.pointerId);
    puntero = { id: e.pointerId };
    estado.empuja = 1;   // mientras el dedo este en la pantalla, la nave empuja
    apuntar(e);
    /* La primera bala sale en el mismo toque y no en el siguiente cuadro: si se
       esperase al bucle, un clic que baja y sube dentro del mismo cuadro se
       quedaria sin disparar. Con esto un toque breve lanza una bala y sola, y
       seguir apretado sigue lanzando una cada CADENCIA. */
    disparar();
    proximoDisparo = reloj + cadenciaActual();
    e.preventDefault();
  }

  function alMover(e) {
    if (!puntero || puntero.id !== e.pointerId) { return; }
    apuntar(e);
  }

  /* Los tres caminos que apagan el motor al soltar: pointerup, pointercancel
     y la perdida de captura. Los tres acaban en el mismo sitio, porque basta
     con que se quede uno sin limpiar para que la nave salga disparada. */
  function soltarPuntero(e) {
    if (e && puntero && e.pointerId !== undefined && e.pointerId !== puntero.id) { return; }
    puntero = null;
    estado.empuja = 0;
  }

  /* Red de seguridad para un navegador que no conceda la captura: sin ella el
     puntero puede salirse del lienzo sin que llegue el dedo levantar. Con la
     captura puesta, pointerout tambien salta cuando el dedo se va fuera y el
     gesto sigue vivo, y ahi no hay que apagar nada. */
  function alSalirDelLienzo(e) {
    if (lienzo.hasPointerCapture(e.pointerId)) { return; }
    soltarPuntero(e);
  }

  function alSubir(e) {
    soltarPuntero(e);
    if (lienzo.hasPointerCapture(e.pointerId)) {
      lienzo.releasePointerCapture(e.pointerId);
    }
  }

  /* ---------------------------------------------------------------- pista */

  /* La pista solo apunta: gira la nave hacia la roca mas cercana. No hace
     falta saber nada de matematicas para entenderla. */
  function pedirPista() {
    if (estado.terminado || !estado.nave || !estado.rocas.length) { return; }
    var mejor = null;
    var mejorD = Infinity;
    for (var i = 0; i < estado.rocas.length; i++) {
      var d = cerca(estado.nave, estado.rocas[i]);
      if (d < mejorD) { mejorD = d; mejor = estado.rocas[i]; }
    }
    if (!mejor) { return; }
    var dx = mejor.x - estado.nave.x;
    var dy = mejor.y - estado.nave.y;
    if (Math.abs(dx) > ancho / 2) { dx = dx > 0 ? dx - ancho : dx + ancho; }
    if (Math.abs(dy) > alto / 2) { dy = dy > 0 ? dy - alto : dy + alto; }
    estado.nave.ang = Math.atan2(dy, dx);
    estado.girando = 0;
    estado.empuja = 0;
    nodos.textoPista.textContent =
      'La nave ya apunta a la roca mas cercana. Dispara con la barra espaciadora o tocando la pantalla.';
    nodos.pista.hidden = false;
    nodos.btnPista.setAttribute('aria-expanded', 'true');
    anunciar('Pista: la nave apunta a la roca mas cercana.');
  }

  /* ----------------------------------------------------------------- medidas */

  /* Las medidas del campo. El lienzo nunca lleva alto fijo en la hoja de
     estilo: el alto sale de la proporcion que le ponen sus propios
     atributos, que es lo que fija esta funcion.

     La proporcion depende del ancho disponible. En un telefono o una
     tableta en vertical el campo va ALTO: en apaisado el bitmap media
     371 x 230, y una roca grande se lleva 80 de esas 371 unidades, casi la
     cuarta parte del campo. En escritorio se mantiene la apaisada, que es
     la del juego original.

     PROPORCION_VERTICAL = 1.35 es el tope del rango util (1.15 a 1.35), y es el
     unico valor de ese rango que llega a los 380 px de alto en un telefono de
     verdad: a 375 px de pantalla da 460 px, y a 320 px da 386. Con 1.25, el
     punto medio, a 375 daba 426 pero a 320 se caia a 358.

     ALTO_MAX es el techo: sin el, a 445 px de ancho el campo mediria 600 px y
     no cabria en la pantalla. Cuando el techo corta, la proporcion se deforma
     un poco, y eso es preferible a un campo mas alto que la pantalla. En la
     rama apaisada el techo no llega a tocar nunca, porque el ancho ya esta
     topado en 940 y 940 * 0.62 = 583. */
  var ANCHO_MIN = 240;
  var ANCHO_MAX = 940;
  var ANCHO_VERTICAL = 620;
  var PROPORCION_VERTICAL = 1.35;
  var PROPORCION_APAISADA = 0.62;
  var ALTO_MAX = 600;

  /* A pantalla completa el campo LLENA el marco. En apaisado se estira la
     proporcion horizontal hasta la del marco; en vertical se hace lo mismo
     con el ancho. En los dos casos el campo logico se topa en los mismos
     valores de siempre (940 de ancho, 620 de alto) para que RADIO, las
     velocidades y los puntos sigan significando exactamente lo mismo: lo que
     cambia es cuantos pixeles ocupa una unidad logica. */
  var PROPORCION_APAISADA_MAX = 2.2;
  var PROPORCION_VERTICAL_MAX = 2.0;

  /* ESCALA_MIN y ESCALA_MAX acotan cuantos pixeles CSS vale una unidad logica.
     Por debajo de ESCALA_MIN una roca enorme de radio 40 se queda en 60 px y
     no se ve; por encima de ESCALA_MAX el campo se agranda tanto que la nave
     (38 px logicos) tapa media pantalla y no hay sitio para esquivar. Son los
     limites que se miden en el informe: en escritorio ronda 1,2 y en un
     telefono en vertical ronda 0,6-1,0 segun el modelo. */
  var ESCALA_MIN = 0.35;
  var ESCALA_MAX = 2.4;

  /* El bitmap se dibuja en pixeles fisicos y el contexto se escala, para que
     el mismo dibujo se vea nitido en una pantalla de 2x o de 3x en lugar de
     estirarse. El tope de 2 es a proposito: por encima del doble la
     diferencia no se nota y el coste de pintado se multiplica.

     El campo LOGICO no se estira nunca. Sus 940 x 583 de escritorio son los
     que deciden donde esta la nave, que tan grande es una roca y cada cuanto
     se dispara, y eso no depende de lo ancho que sea la pantalla. Lo que se
     escala es al reves: el campo se dibuja mas grande. El lienzo ocupa el
     ancho entero del marco y una unidad logica vale mas pixeles cuanto mas
     ancho es ese marco.

     Por eso la cuenta del segundo tope, el del AREA, se hace sobre el tamano
     MOSTRADO y no sobre el logico. Un lienzo de cuatro megapixeles se pinta
     entero en cada fotograma, y en un portatil modesto eso se nota, asi que
     el dpr real nunca es mayor que la raiz del area tope dividida por el area
     mostrada. Cuando el recorte entra, el bitmap se queda algo mas corto que
     los pixeles reales de la pantalla y se ve un estirado leve: eso es
     preferible a devolver la franja muerta que habia al lado. */
  var DPR_MAX = 2;
  var TOPE_AREA_BITMAP = 2500000;

  /* Los tres factores que llevan una unidad logica hasta un pixel de pantalla.
     dpr es el producto de los otros dos y lo unico que necesita el contexto,
     asi que es el que se le pasa a setTransform. */
  var escala = 1;
  var dprBitmap = 1;
  var dpr = 1;

  function dprEfectivo(anchoMostrado, altoMostrado, dprPedido) {
    var area = anchoMostrado * altoMostrado;
    if (area <= 0) { return dprPedido; }
    var tope = Math.sqrt(TOPE_AREA_BITMAP / area);
    return Math.min(dprPedido, Math.max(0.5, tope));
  }

  /* Poner los atributos del lienzo lo borra entero. En un celular el resize
     salta cada vez que aparece o desaparece la barra del navegador, y si el
     bitmap se rehace en cada salto la partida parpadea. Con esta comparacion
     el lienzo solo se toca cuando el marco o el dpr cambian de verdad. */
  var lienzoReconstrucciones = 0;

  function medir() {
    var caja = lienzo.parentNode;
    /* El minimo del marco evita que una medida de cero reparta una division y
       deje el bitmap en cero pixeles: si el visor todavia no esta en la
       pagina, el campo sale al ancho minimo de siempre en vez de romperse. */
    var anchoMarco = Math.max(caja.clientWidth, ANCHO_MIN);
    var altoMarco = caja.clientHeight;
    var disponible;
    var altoNuevo;
    var escalaNueva;

    if (esPantallaCompleta() && altoMarco > 0) {
      /* Pantalla completa: el campo LLENA el marco. El campo logico se topa en
         los mismos valores que la rama normal -ANCHO_MAX de ancho y
         ANCHO_VERTICAL de alto, que es el 620 que ya usaba la rama vertical-,
         y la escala es la que hace que el bitmap cubra el marco entero. Con
         eso el juego sigue siendo el mismo campo, solo que pintado mas
         grande: RADIO, velocidades y puntos no cambian. */
      var relacion = anchoMarco / altoMarco;
      if (relacion >= 1) {
        /* Apaisado: manda el ancho. El alto logico sale de la proporcion para
           que el campo llene el marco en las dos direcciones. */
        disponible = Math.max(ANCHO_MIN, Math.min(ANCHO_MAX, anchoMarco));
        var relacionAlta = Math.min(PROPORCION_APAISADA_MAX, relacion);
        altoNuevo = Math.max(1, Math.round(disponible / relacionAlta));
      } else {
        /* Vertical: manda el ancho tambien, porque el campo logico vertical
           nunca pasa de ANCHO_VERTICAL. */
        disponible = Math.max(ANCHO_MIN, Math.min(ANCHO_VERTICAL, anchoMarco));
        var relacionVertical = Math.min(PROPORCION_VERTICAL_MAX, 1 / relacion);
        altoNuevo = Math.max(1, Math.round(disponible * relacionVertical));
      }
      /* La escala se acota por abajo y por arriba: sin el tope superior, en una
         pantalla muy ancha el campo crece hasta que la nave tapa media pantalla
         y no hay sitio para esquivar; sin el inferior, en una pantalla muy alta
         las rocas se quedan diminutas. */
      var escalaObjetivo = altoMarco / altoNuevo;
      var escalaCorta = anchoMarco / disponible;
      /* Se usa la menor de las dos para que el campo quepa en el marco en las
         dos direcciones; el object-fit del lienzo cubre el resto. */
      escalaNueva = Math.max(ESCALA_MIN, Math.min(ESCALA_MAX,
        Math.min(escalaObjetivo, escalaCorta)));
    } else {
      disponible = Math.max(ANCHO_MIN, Math.min(ANCHO_MAX, anchoMarco));
      var proporcion = disponible < ANCHO_VERTICAL
        ? PROPORCION_VERTICAL
        : PROPORCION_APAISADA;
      altoNuevo = Math.min(ALTO_MAX, Math.round(disponible * proporcion));
      escalaNueva = anchoMarco / disponible;
    }
    /* Cuantos pixeles CSS vale una unidad logica. El lienzo ocupa el marco
       entero, y por eso esta es la escala con la que se pinta el campo. */
    var dprNuevo = dprEfectivo(anchoMarco, altoNuevo * escalaNueva,
      Math.min(DPR_MAX, Math.max(0.5, window.devicePixelRatio || 1)));
    if (disponible === ancho && altoNuevo === alto &&
        escalaNueva === escala && dprNuevo === dprBitmap) { return; }
    ancho = disponible;
    alto = altoNuevo;
    escala = escalaNueva;
    dprBitmap = dprNuevo;
    dpr = escala * dprBitmap;
    /* El ancho mostrado lo pone la hoja de estilo, al 100 % del marco, y el
       alto sale de la proporcion de estos dos atributos: por eso el lienzo
       llega al borde del marco sin dejar banda y no hace falta escribir aqui
       ningun ancho en pixeles. El bitmap es el ancho mostrado por el dpr
       concedido. */
    lienzo.width = Math.round(ancho * dpr);
    lienzo.height = Math.round(alto * dpr);
    lienzoReconstrucciones++;
    /* El sistema de coordenadas no cambia: sigue siendo de ancho x alto
       logicos. Solo se le dice al contexto que cada unidad logica vale dpr
       pixeles de bitmap. */
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    /* El fondo se vuelve a cocer con el tamano nuevo, y lo que estaba en
       vuelo se retira: sus coordenadas ya no valen para el campo nuevo. */
    fondoClave = '';
    prepararFondo();
    limpiarPintura();
    limpiarSacudida();
  }

  /* ====================================================================
     PANTALLA COMPLETA, MENU Y FIN DE PARTIDA
     --------------------------------------------------------------------
     Nada de aqui cambia una regla del juego. Lo que hace es vestir el
     marco: pedir y soltar la pantalla completa, arrancar la partida desde
     el menu, tapar el campo con la capa de fin cuando se acaban las tres
     naves, y reajustar el lienzo cuando el marco cambia de tamano.

     La clase .astro--completa es la que manda: la pone y la quita el
     listener de fullscreenchange segun document.fullscreenElement, y de
     ella cuelga todo el CSS de pantalla completa. No se usa el selector
     :fullscreen, para que funcione con los prefijos de Safari y se pueda
     probar sin navegador real.
     ==================================================================== */

  var nodosMarco = {};

  /* El elemento de la API. Chrome, Edge, Firefox y Safari 16.4+ traen la
     version sin prefijo; Safari viejo trae la de webkit. Se busca una vez. */
  function elementoCompleto() {
    return document.fullscreenElement ||
           document.webkitFullscreenElement ||
           null;
  }

  function soportaCompleta() {
    var raiz = document.documentElement;
    return !!(document.fullscreenEnabled ||
              document.webkitFullscreenEnabled ||
              raiz.requestFullscreen ||
              raiz.webkitRequestFullscreen);
  }

  /* Los cuatro nombres de cada operacion, del estandar al de webkit. */
  function pedirCompleta(el) {
    var f = el.requestFullscreen || el.webkitRequestFullscreen ||
            el.mozRequestFullScreen || el.msRequestFullscreen;
    if (!f) { throw new Error('Este navegador no tiene API de pantalla completa.'); }
    return f.call(el);
  }

  function salirCompleta() {
    var f = document.exitFullscreen || document.webkitExitFullscreen ||
            document.mozCancelFullScreen || document.msExitFullscreen;
    if (!f) { throw new Error('Este navegador no tiene API de pantalla completa.'); }
    return f.call(document);
  }

  /* La clase del marco y el boton de salir cuelgan del ESTADO REAL, no de
     haber pedido la pantalla completa: si el navegador la rechaza, el marco
     se queda como estaba y el juego sigue jugandose igual. */
  function esPantallaCompleta() {
    return !!nodosMarco.marco && nodosMarco.marco.classList.contains('astro--completa');
  }

  function aplicarCompleta(activa) {
    if (!nodosMarco.marco) { return; }
    /* En pantalla completa el menu se muda DENTRO del marco: fuera de el no
       se veria. Al salir vuelve a su sitio, delante del visor. */
    if (nodosMarco.menu) {
      if (activa) {
        if (nodosMarco.menu.parentNode !== nodosMarco.marco) {
          nodosMarco.marco.insertBefore(nodosMarco.menu, nodosMarco.marco.firstChild);
        }
      } else if (nodosMarco.menu.parentNode !== nodosMarco.astro) {
        nodosMarco.astro.insertBefore(nodosMarco.menu, nodosMarco.astro.firstChild);
      }
    }
    nodosMarco.marco.classList.toggle('astro--completa', activa);
    /* La seccion que envuelve el juego lleva content-visibility:auto en
       base.css, y eso la convierte en bloque contenedor de los hijos en
       posicion fija: el marco se colgaria de su esquina y no de la ventana.
       La marca en la raiz apaga ese rendimiento solo mientras dura la
       pantalla completa. */
    document.documentElement.classList.toggle('astro--pantalla', activa);
    if (nodosMarco.btnSalirCompleta) {
      nodosMarco.btnSalirCompleta.hidden = !activa;
    }
    /* El lienzo se vuelve a medir en el acto, sin esperar al resize: al
       insertar el menu o cambiar la clase el marco puede tardar un fotograma
       en reportar el tamano nuevo. */
    medir();
  }

  /* Todo lo que pasa al entrar o salir de pantalla completa, en un solo sitio:
     vestir el marco y, si se sale con una partida en marcha, pausarla. */
  function resolverCompleta(activa) {
    aplicarCompleta(activa);
    if (!activa && partidaEmpezada && !estado.terminado && !pausado) {
      /* Salir de pantalla completa con una partida en marcha la pausa: es lo
         que espera cualquiera, y evita perder una nave mientras se recoloca
         la pagina. */
      pausar();
    }
    anunciar(activa ? 'Pantalla completa.' : 'Pantalla normal.');
  }

  function alCambiarCompleta() {
    resolverCompleta(!!elementoCompleto());
  }

  /* Pedir la pantalla completa puede fallar de tres maneras: que el navegador
     no tenga la API, que el usuario la tenga bloqueada y que el navegador
     rechace la promesa por no venir de un gesto. Ninguna de las tres puede
     dejar el juego inservible: se sigue jugando en modo normal. */
  function entrarCompleta() {
    if (!soportaCompleta()) {
      anunciar('Este navegador no tiene pantalla completa. Se juega en la pagina.');
      return;
    }
    try {
      var promesa = pedirCompleta(nodosMarco.marco);
      if (promesa && typeof promesa.then === 'function') {
        promesa.then(function () {
          /* Algunos navegadores no disparan fullscreenchange si el elemento ya
             estaba a pantalla completa; por si acaso, se aplica a mano. */
          aplicarCompleta(true);
        }, function () {
          /* El usuario o el navegador la rechazaron: se juega igual. */
          aplicarCompleta(false);
          anunciar('El navegador no ha dejado poner la pantalla completa. Se juega en la pagina.');
        });
      }
    } catch (error) {
      aplicarCompleta(false);
      anunciar('El navegador no ha dejado poner la pantalla completa. Se juega en la pagina.');
    }
  }

  function alternarCompleta() {
    try {
      if (esPantallaCompleta() && !elementoCompleto()) { aplicarCompleta(false); return; }
      if (elementoCompleto()) {
        var promesa = salirCompleta();
        if (promesa && typeof promesa.then === 'function') { promesa.catch(function () {}); }
      } else {
        entrarCompleta();
      }
    } catch (error) {
      aplicarCompleta(false);
    }
  }

  /* ------------------------------------------------------------ fin de partida */

  /* La capa de fin aparece SOLA cuando se acaban las tres naves. El motor ya
     tiene un aviso de fin -cerrar() y el turno-; esto no lo sustituye, solo
     anade la capa nueva encima del campo con el resultado. */
  function mostrarFin() {
    if (!nodosMarco.fin) { return; }
    texto(nodosMarco.finPuntos, estado.puntos);
    texto(nodosMarco.finRonda, estado.ronda + 1);
    nodosMarco.fin.hidden = false;
    if (nodos.avisoFase) { nodos.avisoFase.hidden = true; }
    if (avisoFaseTimer) { clearTimeout(avisoFaseTimer); avisoFaseTimer = null; }
    /* La capa de fin aparece sola al perder la ultima nave: el foco tiene que
       ir a su primer boton, o se quedaria donde estuviera -normalmente el
       lienzo, que la capa acaba de tapar-. */
    if (nodosMarco.btnOtraVez) { nodosMarco.btnOtraVez.focus({ preventScroll: true }); }
    /* La capa de fin sustituye al cartel de turno, no se pone encima: la
       partida se acaba de perder, y el cartel de "sin naves" detras del
       resultado serian dos avisos diciendo casi lo mismo, uno tapando al
       otro. */
    if (nodos.turno) { nodos.turno.hidden = true; }
    sincronizarHud();
  }

  function ocultarFin() {
    var estaba = !!(nodosMarco.fin && !nodosMarco.fin.hidden);
    if (nodosMarco.fin) { nodosMarco.fin.hidden = true; }
    /* Si la capa estaba a la vista, el foco apuntaba a un boton que acaba de
       desaparecer: se devuelve al lienzo, que vuelve a estar visible. Quien
       oculta el fin para irse al menu recoloca el foco despues, asi que esta
       devolucion no estorba. */
    if (estaba && lienzo) { lienzo.focus({ preventScroll: true }); }
    sincronizarHud();
  }

  /* OTRA VEZ reinicia y empieza a jugar. MENU suelta la pantalla completa,
     para la partida y vuelve al menu de inicio. */
  function otraVez() {
    ocultarFin();
    abrirAudio();
    reiniciar();
    sincronizarHud();
  }

  function volverAlMenu() {
    ocultarFin();
    parar();
    pausado = false;
    if (nodosMarco.pausa) { nodosMarco.pausa.hidden = true; }
    if (elementoCompleto()) {
      try {
        var promesa = salirCompleta();
        if (promesa && typeof promesa.then === 'function') { promesa.catch(function () {}); }
      } catch (error) { /* ya se sale sola al no poder */ }
    }
    aplicarCompleta(false);
    partidaEmpezada = false;
    if (nodos.avisoFase) { nodos.avisoFase.hidden = true; }
    if (avisoFaseTimer) { clearTimeout(avisoFaseTimer); avisoFaseTimer = null; }
    if (nodosMarco.menu) { nodosMarco.menu.hidden = false; }
    sincronizarHud();
    anunciar('Menu de inicio.');
    if (nodosMarco.btnJugarCompleta) { nodosMarco.btnJugarCompleta.focus(); }
  }

  /* --------------------------------------------------------------- arranque */

  var partidaEmpezada = false;

  /* Arranca de verdad: tapar el menu, abrir la primera ronda y poner el bucle
     en marcha. `completa` dice si antes hay que pedir la pantalla completa. */
  function empezar(completa) {
    ocultarFin();
    /* El primer gesto real del jugador: aqui es donde nace el AudioContext.
       Antes de esto no existe, y por eso la pagina no suena ni avisa de nada
       mientras se ve el menu. */
    abrirAudio();
    /* La marca va ANTES de abrir la ronda: abrirRonda solo enfoca el lienzo si
       la partida ya esta empezada, y al pulsar jugar esa es justo la situacion
       que se quiere -el menu se va y el teclado tiene que estar en el campo-. */
    partidaEmpezada = true;
    abrirPartida();
    if (nodosMarco.menu) { nodosMarco.menu.hidden = true; }
    sincronizarHud();
    if (completa) { entrarCompleta(); }
    arrancar();
  }

  function jugarCompleta() { empezar(true); }
  function jugarAqui() { empezar(false); }


  function montar() {
    lienzo = $('lienzo');
    ctx = lienzo.getContext('2d');
    nodos.turno = $('turno');
    nodos.textoTurno = $('textoTurno');
    nodos.btnSeguir = $('btnSeguir');
    nodos.btnPista = $('btnPista');
    nodos.pista = $('pista');
    nodos.textoPista = $('textoPista');
    nodos.tituloRonda = $('tituloRonda');
    nodos.lemaRonda = $('lemaRonda');
    nodos.viva = $('lecturaViva');
    nodos.puntos = $('leerPuntos');
    nodos.rocasTotales = $('leerRocas');
    nodos.rondaActual = $('leerRonda');
    nodos.vidas = $('leerVidas');
    nodos.estrellas = $('estrellas');
    nodos.estrellasTxt = $('lecturaEstrellas');
    nodos.estado = $('estadoCampo');
    nodos.enormes = $('leerEnormes');
    nodos.grandes = $('leerGrandes');
    nodos.medianas = $('leerMedianas');
    nodos.pequenas = $('leerPequenas');
    nodos.pausa = $('pausa');
    /* La fila de abajo repite puntos, rocas y vidas. Antes esos tres
       numeros se quedaban en su valor inicial y contradecian al panel de
       arriba, asi que se rellenan con los mismos datos. */
    nodos.puntos2 = $('leerPuntos2');
    nodos.rocas2 = $('leerRocas2');
    nodos.vidas2 = $('leerVidas2');
    /* Las tres cuentas nuevas: el nivel del arma, el multiplicador de la
       racha y la barra de efectos. */
    nodos.arma = $('leerArma');
    nodos.racha = $('leerRacha');
    nodos.efectos = $('efectos');
    /* El cartel de fase: rotulo, nombre y lema de la fase que empieza. */
    nodos.avisoFase = $('avisoFase');
    nodos.avisoFaseRotulo = $('avisoFaseRotulo');
    nodos.avisoFaseNombre = $('avisoFaseNombre');
    nodos.avisoFaseLema = $('avisoFaseLema');
    /* Los mandos y las capas nuevas del marco: la pausa de dedo, el boton de
       salir de pantalla completa, el menu de inicio y la capa de fin. */
    nodosMarco.astro = document.querySelector('.astro');
    nodosMarco.marco = $('marco');
    nodosMarco.menu = $('menu');
    nodosMarco.pausa = $('pausa');
    nodosMarco.btnPausa = $('btnPausa');
    nodosMarco.btnSalirCompleta = $('btnSalirCompleta');
    nodosMarco.btnJugarCompleta = $('btnJugarCompleta');
    nodosMarco.btnJugarAqui = $('btnJugarAqui');
    nodosMarco.btnOtraVez = $('btnOtraVez');
    nodosMarco.btnMenu = $('btnMenu');
    nodosMarco.fin = $('fin');
    nodosMarco.finPuntos = $('finPuntos');
    nodosMarco.finRonda = $('finRonda');
    /* El sonido y la vibracion: el boton de silencio del marco y las dos
       casillas del menu. El HUD entero es un nodo mas, para poder esconderlo
       de una pieza cuando hay una capa delante. */
    nodosMarco.btnSilencio = $('btnSilencio');
    nodosMarco.hud = document.querySelector('.astro__hud');
    nodosMarco.estado = $('estadoCampo');
    nodosMarco.efectos = $('efectos');
    nodosMarco.mandos = document.querySelector('.astro__mandos');
    nodos.avisoFase = $('avisoFase');
    nodos.avisoFaseRotulo = $('avisoFaseRotulo');
    nodos.avisoFaseNombre = $('avisoFaseNombre');
    nodos.avisoFaseLema = $('avisoFaseLema');
    estado.cometas = [];
    estado.siguienteCometa = 0;
    estado.cometaAvisoHasta = 0;
    /* La linea de lectura vive pegada al borde inferior del marco, fuera del
       HUD pero dentro del marco. Con el menu o el fin delante tambien tiene
       que desaparecer: si no, sus numeros se leen por debajo de la capa. */
    nodosMarco.lectura = document.querySelector('.lectura');
    nodosMarco.opSonido = $('opSonido');
    nodosMarco.opVibracion = $('opVibracion');

    /* Las opciones guardadas se aplican ANTES de nada: si el jugador dejo el
       sonido apagado, el juego empieza en silencio y el boton ya lo dice. */
    var opciones = leerOpciones();
    audio.mudo = !opciones.sonido;
    vibracionActiva = opciones.vibracion;
    if (nodosMarco.opSonido) { nodosMarco.opSonido.checked = opciones.sonido; }
    if (nodosMarco.opVibracion) { nodosMarco.opVibracion.checked = opciones.vibracion; }
    sincronizarSilencio();

    medir();
    window.addEventListener('resize', medir);
    /* El marco puede cambiar de tamano por cosas que no son la ventana: al
       mudarse el menu dentro, al girar el movil o al entrar el teclado. Un
       ResizeObserver sobre el marco cubre todos los casos con una sola via. */
    if ('ResizeObserver' in window && nodosMarco.marco) {
      new ResizeObserver(function () { medir(); }).observe(nodosMarco.marco);
    }
    /* El estado real de la pantalla completa lo dice este evento, no la
       promesa de la peticion. Se escuchan las dos formas: la estandar y la
       de webkit. */
    document.addEventListener('fullscreenchange', alCambiarCompleta);
    document.addEventListener('webkitfullscreenchange', alCambiarCompleta);

    document.addEventListener('keydown', alPulsar);
    document.addEventListener('keyup', alSoltar);
    lienzo.addEventListener('pointerdown', alBajar);
    lienzo.addEventListener('pointermove', alMover);
    lienzo.addEventListener('pointerup', alSubir);
    /* Los tres caminos que devuelven el motor a cero. */
    lienzo.addEventListener('pointercancel', soltarPuntero);
    lienzo.addEventListener('lostpointercapture', soltarPuntero);
    lienzo.addEventListener('pointerout', alSalirDelLienzo);
    /* Y el cuarto: si la ventana pierde el foco con el dedo apoyado, el
       pointercancel tampoco llega y la nave se quedaria empujando sola. */
    window.addEventListener('blur', soltarPuntero);
    nodos.btnSeguir.addEventListener('click', siguiente);
    nodos.btnPista.addEventListener('click', pedirPista);
    /* Los mandos y botones nuevos. Todos funcionan con raton, con dedo y con
       teclado, porque son <button> de verdad. */
    nodosMarco.btnPausa.addEventListener('click', alternarPausa);
    nodosMarco.btnSalirCompleta.addEventListener('click', alternarCompleta);
    nodosMarco.btnJugarCompleta.addEventListener('click', jugarCompleta);
    nodosMarco.btnJugarAqui.addEventListener('click', jugarAqui);
    nodosMarco.btnOtraVez.addEventListener('click', otraVez);
    nodosMarco.btnMenu.addEventListener('click', volverAlMenu);
    /* El boton de silencio y las dos casillas. Las casillas guardan la
       eleccion; el boton solo cambia el sonido de la partida en curso. */
    if (nodosMarco.btnSilencio) {
      nodosMarco.btnSilencio.addEventListener('click', alternarMudo);
    }
    if (nodosMarco.opSonido) {
      nodosMarco.opSonido.addEventListener('change', function () {
        cambiarMudo(!nodosMarco.opSonido.checked);
        guardarOpciones();
      });
    }
    if (nodosMarco.opVibracion) {
      nodosMarco.opVibracion.addEventListener('change', function () {
        vibracionActiva = !!nodosMarco.opVibracion.checked;
        guardarOpciones();
      });
    }

    /* La partida NO empieza sola: se abre la primera ronda en modo "detenido"
       -el estado queda listo y el marcador pintado-, pero el menu tapa el
       campo y el bucle no corre hasta que se pulsa jugar. */
    abrirRonda(0);
    partidaEmpezada = false;
    parar();
    nodosMarco.menu.hidden = false;
    /* Con el menu delante al arrancar, el HUD nace escondido. */
    sincronizarHud();
    /* El foco arranca en el primer boton del menu, no en el lienzo: la ronda 0
       se abre con el menu delante y el lienzo queda tapado por el. Enfocar el
       primer boton deja el foco donde el jugador lo necesita -pulsar jugar- y
       de paso el primer tabulador no salta a un nodo invisible. */
    if (nodosMarco.btnJugarCompleta) {
      nodosMarco.btnJugarCompleta.focus({ preventScroll: true });
    }

    /* Al cambiar de pestana el juego se para. */
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) { parar(); } else { arrancar(); }
    });

    /* Y tambien cuando el tablero queda por fuera de la pantalla, que es lo
       que pasa en cuanto se empieza a leer la explicacion de abajo. Solo
       arranca si la partida ya ha empezado: con el menu delante, el bucle no
       corre aunque el visor este a la vista. */
    if ('IntersectionObserver' in window) {
      var vigilante = new IntersectionObserver(function (entradas) {
        var visible = false;
        for (var i = 0; i < entradas.length; i++) {
          if (entradas[i].isIntersecting) { visible = true; }
        }
        if (visible && partidaEmpezada) { arrancar(); } else { parar(); }
      }, { threshold: 0.01 });
      vigilante.observe(lienzo);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', montar);
  } else {
    montar();
  }

  /* ------------------------------------------------------ superficie de pruebas

     Todo lo que hay debajo existe para poder comprobar el juego desde la
     consola del navegador sin tener que jugar una ronda entera: forzar un
     botin en un punto, recogerlo, invocar el platillo, sembrar una roca,
     perder una vida, leer lo que lleva encima el jugador y mirar cuantas
     veces se ha rehecho el bitmap del lienzo. No cambia ninguna regla. */

  function forzarBotin(tipo, x, y) {
    var b = crearBotin(tipo, x, y);
    estado.botines.push(b);
    return b.id;
  }

  function recogerBotin(indice) {
    var i = (indice === undefined) ? 0 : indice;
    var b = estado.botines[i];
    if (!b) {
      throw new Error('No hay ningun botin en la posicion ' + i +
                      '. Ahora mismo hay ' + estado.botines.length + '.');
    }
    estado.botines.splice(i, 1);
    return aplicarBotin(b);
  }

  function botinesVivos() {
    return estado.botines.map(function (b) {
      return {
        id: b.id, tipo: b.tipo,
        x: Math.round(b.x), y: Math.round(b.y),
        vida: b.vida, opacidad: opacidadBotin(b)
      };
    });
  }

  function efectosActivos() {
    var salida = [];
    if (estado.efectos.cadencia > 0) {
      salida.push({ clave: 'cadencia', segundos: estado.efectos.cadencia });
    }
    if (estado.efectos.perforante > 0) {
      salida.push({ clave: 'perforante', segundos: estado.efectos.perforante });
    }
    if (estado.efectos.escudo > 0) {
      salida.push({ clave: 'escudo', segundos: estado.efectos.escudo });
    }
    return salida;
  }

  function sembrarRoca(tam, x, y) {
    if (!RADIO[tam]) {
      throw new Error('Tamano de roca desconocido: "' + tam +
                      '". Valen 4, 3, 2 y 1.');
    }
    var r = crearRoca(tam, x, y, Math.random() * Math.PI * 2, estado.ronda);
    estado.rocas.push(r);
    return r.id;
  }

  /* Las salidas de cada nivel de arma, en grados y en unidades de lado. */
  function separacionesCanon(nivel) {
    return salidasCanon(nivel === undefined ? estado.arma : nivel).map(function (s) {
      return { angulo: s.angulo * 180 / Math.PI, lado: s.lado };
    });
  }

  /* La velocidad base que tiene una roca de un tamano en una ronda. Sirve
     para comprobar que el lema de la ronda 2 se cumple de verdad. */
  function velocidadRoca(tam, ronda) {
    return VELOCIDAD_POR_TAMANO[tam] * Math.pow(VELOCIDAD_RONDA, ronda);
  }

  function constantes() {
    return {
      cadencia: CADENCIA,
      cadenciaBotin: CADENCIA_BOTIN,
      vidaBala: VIDA_BALA,
      velocidadBala: VELOCIDAD_BALA,
      topeBalasPorCanon: MAX_BALAS_POR_CANON,
      nivelArmaMax: NIVEL_ARMA_MAX,
      separacionCanon: SEPARACION_CANON,
      abanicoCanon: ABANICO_CANON * 180 / Math.PI,
      bocaCanon: BOCA_CANON,
      vidaBotin: VIDA_BOTIN,
      parpadeoBotin: PARPADEO_BOTIN,
      desvaneceBotin: DESVANE_BOTIN,
      radioBotin: RADIO_BOTIN,
      recogerBotin: RECOGER_BOTIN,
      duracionCadencia: TIPOS_BOTIN.cadencia.duracion,
      duracionPerforante: TIPOS_BOTIN.perforante.duracion,
      duracionEscudo: TIPOS_BOTIN.escudo.duracion,
      avisoEfecto: AVISO_EFECTO,
      ventanaRacha: VENTANA_RACHA,
      multiplicadorMax: MULTIPLICADOR_MAX,
      platilloPuntos: PLATILLO_PUNTOS,
      platilloRadio: RADIO_PLATILLO,
      platilloDisparo: DISPARO_PLATILLO,
      platilloVelocidadBala: VELOCIDAD_DISPARO_PLATILLO,
      platilloPausa: PAUSA_PLATILLO,
      velocidadRonda: VELOCIDAD_RONDA,
      velocidadPorTamano: VELOCIDAD_POR_TAMANO,
      escudoNacer: ESCUDO,
      probabilidadBotin: PROBABILIDAD_BOTIN,
      pesosBotin: PESOS_BOTIN,
      probabilidadPlatillo: [RONDAS[0].platillo, RONDAS[1].platillo, RONDAS[2].platillo, RONDAS[3] ? RONDAS[3].platillo : 0, RONDAS[4] ? RONDAS[4].platillo : 0]
    };
  }

  /* La superficie de pruebas. Lo de antes se queda igual, y se anaden las
     cuatro cosas que hacen falta para comprobar lo de esta vuelta: como
     esta el fondo, cuantos objetos de pintura hay en el campo, como se
     calculo el bitmap y que patron haptico lleva cada evento. */
  function capaFondo() {
    var salida = [];
    for (var i = 0; i < fx.capas.length; i++) {
      salida.push({
        indice: i,
        factor: FACTOR_PARALAJE[i],
        estrellas: fx.capas[i].estrellas.length,
        dx: +fx.capas[i].dx.toFixed(3),
        dy: +fx.capas[i].dy.toFixed(3)
      });
    }
    return {
      capas: salida,
      relojFondo: +fx.relojFondo.toFixed(3),
      estrellas: TOPE_ESTRELAS,
      mosaico: !!fondoPatron
    };
  }

  function pinturaEnPantalla() {
    return {
      rocas: estado.rocas.length,
      balas: estado.balas.length,
      chispas: estado.chispas.length,
      botines: estado.botines.length,
      estela: fx.estela.length,
      estallidos: fx.estallidos.length,
      fogonazos: fx.fogonazos.length,
      destellos: fx.destellos.length,
      cometas: estado.cometas ? estado.cometas.length : 0,
      total: estado.rocas.length + estado.balas.length + estado.chispas.length +
             estado.botines.length + fx.estela.length + fx.estallidos.length +
             fx.fogonazos.length + fx.destellos.length +
             (estado.cometas ? estado.cometas.length : 0),
      topes: {
        estela: TOPE_ESTELA, estallidos: TOPE_ESTALLIDOS,
        fogonazos: TOPE_FOGONAZOS, destellos: TOPE_DESTELLOS,
        estrellas: TOPE_ESTRELAS
      },
      sacudidas: fx.sacudidas,
      vibraciones: fx.vibraciones,
      vibracionFallos: fx.vibracionFallos,
      fotogramas: fx.fotogramas
    };
  }

  function bitmap() {
    return {
      bitmapAncho: lienzo.width,
      bitmapAlto: lienzo.height,
      area: lienzo.width * lienzo.height,
      campoAncho: ancho,
      campoAlto: alto,
      mostradoAncho: Math.round(ancho * escala),
      mostradoAlto: Math.round(alto * escala),
      escala: escala,
      dpr: dpr,
      dprBitmap: dprBitmap,
      dprDispositivo: window.devicePixelRatio || 1,
      areaTope: TOPE_AREA_BITMAP,
      reconstrucciones: lienzoReconstrucciones
    };
  }

  window.asteroides = {
    estado: estado,
    RONDAS: RONDAS,
    LADO: LADO,
    puntosDe: puntosDe,
    partir: partir,
    crearRoca: crearRoca,
    contarRocas: contarRocas,
    disparar: disparar,
    abrirRonda: abrirRonda,
    abrirPartida: abrirPartida,
    reiniciar: reiniciar,
    alternarPausa: alternarPausa,
    pausar: pausar,
    seguir: seguir,
    estaPausado: function () { return pausado; },
    pedazosDe: pedazosDe,
    pedirPista: pedirPista,
    medir: medir,
    medidas: function () { return { ancho: ancho, alto: alto, dpr: dpr, escala: escala }; },

    /* Superficie de pruebas. */
    forzarBotin: forzarBotin,
    recogerBotin: recogerBotin,
    invocarPlatillo: invocarPlatillo,
    forzarCometa: forzarCometa,
    estadoJefe: estadoJefe,
    danarJefe: danarJefe,
    forzarPatron: forzarPatron,
    abrirNucleo: abrirNucleo,
    cometas: function () { return estado.cometas || []; },
    mostrarAvisoFase: mostrarAvisoFase,
    avisoFaseVisible: function () { return !!nodos.avisoFase && !nodos.avisoFase.hidden; },
    botinesVivos: botinesVivos,
    efectosActivos: efectosActivos,
    opacidadBotin: opacidadBotin,
    separacionesCanon: separacionesCanon,
    salidasCanon: salidasCanon,
    topesBalas: topeBalas,
    velocidadRoca: velocidadRoca,
    sembrarRoca: sembrarRoca,
    perderVida: perderVida,
    estaTerminado: function () { return estado.terminado; },
    reconstrucciones: function () { return lienzoReconstrucciones; },
    rocasListas: function () { return rocasListas; },
    RADIO: RADIO,
    TIPOS_BOTIN: TIPOS_BOTIN,
    constantes: constantes,

    /* Lo anadido en la vuelta de pintura. */
    fx: fx,
    capaFondo: capaFondo,
    pinturaEnPantalla: pinturaEnPantalla,
    bitmap: bitmap,
    dprEfectivo: dprEfectivo,
    sinAnimacion: sinAnimacion,
    sacudir: sacudir,
    sacudiendo: function () { return fx.sacudidaFin > 0 && lienzo.style.transform !== ''; },
    limpiarSacudida: limpiarSacudida,
    vibrar: vibrar,
    patrones: function () { return PATRONES; },
    /* El sonido y la hapticidad, con su propia superficie de pruebas: el
       estado del audio, los nombres de los efectos, el interruptor de
       silencio y el de vibracion. */
    sonido: {
      estado: estadoAudio,
      nombres: function () { return audio.nombres.slice(); },
      sonar: sonar,
      abrir: abrirAudio,
      soporta: soportaAudio,
      alternarMudo: alternarMudo,
      mudo: function () { return audio.mudo; },
      ganancia: function () { return audio.maestro ? audio.maestro.gain.value : null; },
      contexto: function () { return audio.ctx; },
      rendir: rendirEfecto
    },
    vibracion: {
      activa: function () { return vibracionActiva; },
      apagada: function () { return fx.vibracionApagada; },
      cambiar: function (activa) { vibracionActiva = !!activa; return vibracionActiva; }
    },
    hudVisible: function () {
      return !!nodosMarco.hud && !nodosMarco.hud.hidden;
    },
    /* PANTALLA COMPLETA, MENU Y FIN. Solo para comprobar desde las pruebas:
       activar la clase a mano, saber que capa esta a la vista y arrancar sin
       pasar por la API del navegador. */
    pantallaCompleta: function () { return esPantallaCompleta(); },
    soportaPantallaCompleta: soportaCompleta,
    aplicarPantallaCompleta: aplicarCompleta,
    /* El manejador real de fullscreenchange, para poder probar la pausa al
       salir sin depender de que el navegador sin cabeza deje entrar en
       pantalla completa. Se le pasa activa a mano. */
    cambiarPantallaCompleta: resolverCompleta,
    menuVisible: function () { return !!nodosMarco.menu && !nodosMarco.menu.hidden; },
    finVisible: function () { return !!nodosMarco.fin && !nodosMarco.fin.hidden; },
    partidaEmpezada: function () { return partidaEmpezada; },
    empezar: empezar,
    volverAlMenu: volverAlMenu,
    movimientoReducido: sinAnimacion,
    literales: function () {
      return {
        destelloRoca: DESTELLO_ROCA,
        duracionSacudida: DURACION_SACUDIDA,
        sacudidaRoca: SACUDIDA_ROCA,
        sacudidaPlatillo: SACUDIDA_PLATILLO,
        sacudidaVida: SACUDIDA_VIDA,
        sacudidaRonda: SACUDIDA_RONDA,
        sacudidaMaxima: SACUDIDA_MAXIMA,
        escalaRoca: ESCALA_ROCA,
        estelaBala: ESTELA_BALA,
        paralaje: FACTOR_PARALAJE
      };
    }
  };
}());
