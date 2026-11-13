// HENAR Lite - app.js
//
// Qué hace esta app:
//   1. Dibuja entre 24 y 33 pads grandes en pantalla.
//   2. Cada pad se activa al tocarlo O al pulsar su tecla (el dispositivo HENAR se
//      comporta como un teclado normal; las teclas están en docs/protocolo.md).
//   3. Un pad puede ser de NOTA (suena) o de FUNCIÓN (volumen, octava, instrumento...).
//   4. En Ajustes se cambia todo: instrumento, escala, qué hace cada pad y su tecla.
//      Los ajustes se guardan en el propio dispositivo.
//
// El sonido lo produce motor.js; este archivo solo le dice qué tocar.

// ---------------------------------------------------------------------------
// 1. Datos básicos
// ---------------------------------------------------------------------------

const PADS_MAXIMO = 33;      // el protocolo define 33 teclas
const PADS_MINIMO = 24;      // diseño mínimo del dispositivo
const CLAVE_GUARDADO = "henar-lite-ajustes-v2";

// La tecla de cada pad (posición física). Es la tabla de docs/protocolo.md.
// Si cambias algo aquí, cambia también el protocolo y el firmware.
const TECLAS_PROTOCOLO = [
  "Digit1", "Digit2", "Digit3", "Digit4", "Digit5", "Digit6", "Digit7", "Digit8", "Digit9", "Digit0",
  "KeyQ", "KeyW", "KeyE", "KeyR", "KeyT", "KeyY", "KeyU", "KeyI", "KeyO", "KeyP",
  "KeyA", "KeyS", "KeyD", "KeyF", "KeyG", "KeyH", "KeyJ", "KeyK", "KeyL",
  "KeyZ", "KeyX", "KeyC", "KeyV",
];

// Rango de notas permitido (MIDI 36 = Do2, 96 = Do7) e intensidad de las notas.
// Se leen de instrumentos/instrumentos.json porque los instrumentos están recortados a ese rango.
let RANGO_MIN = 36;
let RANGO_MAX = 96;
let VELOCIDAD = 100;

const NOTA_BASE = 48;        // primera nota por defecto: Do3 (MIDI 48)

// ---------------------------------------------------------------------------
// 2. Funciones de los pads
// ---------------------------------------------------------------------------

// "corto" es el texto que se ve dentro del pad.
const FUNCIONES = {
  "ninguna":       { nombre: "Ninguna",               corto: "—" },
  "volumen-":      { nombre: "Volumen −",             corto: "VOL −" },
  "volumen+":      { nombre: "Volumen +",             corto: "VOL +" },
  "octava-":       { nombre: "Octava −",              corto: "OCT −" },
  "octava+":       { nombre: "Octava +",              corto: "OCT +" },
  "instrumento-":  { nombre: "Instrumento anterior",  corto: "◀ INSTR." },
  "instrumento+":  { nombre: "Instrumento siguiente", corto: "INSTR. ▶" },
  "escala-":       { nombre: "Escala anterior",       corto: "◀ ESCALA" },
  "escala+":       { nombre: "Escala siguiente",      corto: "ESCALA ▶" },
};

// Funciones por defecto de los pads 17 a 24 (los pads 1 a 16 son notas)
const FUNCIONES_POR_DEFECTO = {
  16: "volumen-", 17: "volumen+",
  18: "octava-",  19: "octava+",
  20: "instrumento-", 21: "instrumento+",
  22: "escala+",  23: "ninguna",
};

const OCTAVA_MINIMA = -1;
const OCTAVA_MAXIMA = 1;

// ---------------------------------------------------------------------------
// 3. Escalas y nombres de notas
// ---------------------------------------------------------------------------

// Intervalos en semitonos desde la nota raíz
const ESCALAS = [
  { id: "pentatonica-mayor", nombre: "Pentatónica mayor", intervalos: [0, 2, 4, 7, 9] },
  { id: "pentatonica-menor", nombre: "Pentatónica menor", intervalos: [0, 3, 5, 7, 10] },
  { id: "mayor",             nombre: "Mayor",             intervalos: [0, 2, 4, 5, 7, 9, 11] },
  { id: "menor",             nombre: "Menor",             intervalos: [0, 2, 3, 5, 7, 8, 10] },
  { id: "cromatica",         nombre: "Cromática",         intervalos: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11] },
];

const NOMBRES_NOTA = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

// 60 -> "C4", 66 -> "F#4"
function nombreNota(midi) {
  return NOMBRES_NOTA[midi % 12] + (Math.floor(midi / 12) - 1);
}

// Un color por nota (Do rojo, Re naranja...), igual en todas las octavas
function colorNota(midi) {
  return "hsl(" + (midi % 12) * 30 + " 85% 72%)";
}

// Si una nota se sale del rango de los instrumentos, se sube o baja una octava hasta entrar
function ajustarRango(midi) {
  while (midi > RANGO_MAX) midi -= 12;
  while (midi < RANGO_MIN) midi += 12;
  return midi;
}

// ---------------------------------------------------------------------------
// 4. Guardar y cargar ajustes
// ---------------------------------------------------------------------------

function ajustesPorDefecto() {
  const pads = [];
  for (let i = 0; i < PADS_MAXIMO; i++) {
    pads.push({
      tecla: TECLAS_PROTOCOLO[i],
      fn: FUNCIONES_POR_DEFECTO[i] || null,  // null = es un pad de nota
      nota: null,                            // null = la nota la decide la escala
    });
  }
  return {
    version: 2,
    numPads: PADS_MINIMO,
    instrumento: "piano",
    escala: "pentatonica-mayor",
    raiz: 0,            // 0 = Do, 1 = Do#, ... 11 = Si
    volumen: 80,        // de 0 a 100
    pads,
  };
}

function esEntero(valor, minimo, maximo) {
  return Number.isInteger(valor) && valor >= minimo && valor <= maximo;
}

function ajustesValidos(d) {
  if (!d || typeof d !== "object") return false;
  if (!esEntero(d.numPads, PADS_MINIMO, PADS_MAXIMO)) return false;
  if (typeof d.instrumento !== "string") return false;
  if (!ESCALAS.some((e) => e.id === d.escala)) return false;
  if (!esEntero(d.raiz, 0, 11)) return false;
  if (!esEntero(d.volumen, 0, 100)) return false;
  if (!Array.isArray(d.pads) || d.pads.length !== PADS_MAXIMO) return false;
  return d.pads.every(
    (p) =>
      p &&
      typeof p.tecla === "string" && p.tecla !== "" &&
      (p.fn === null || Object.prototype.hasOwnProperty.call(FUNCIONES, p.fn)) &&
      (p.nota === null || Number.isInteger(p.nota))
  );
}

function cargarAjustes() {
  try {
    const texto = localStorage.getItem(CLAVE_GUARDADO);
    if (texto) {
      const datos = JSON.parse(texto);
      if (ajustesValidos(datos)) return datos;
    }
  } catch (e) {
    // Si algo falla al leer, se usan los ajustes por defecto
  }
  return ajustesPorDefecto();
}

function guardarAjustes() {
  try {
    localStorage.setItem(CLAVE_GUARDADO, JSON.stringify(ajustes));
  } catch (e) {
    // Si no se puede guardar (modo privado, etc.), la app sigue funcionando
  }
}

let ajustes = cargarAjustes();

// Cosas que no se guardan: se pierden al cerrar la app
const estado = { octava: 0 };

// ---------------------------------------------------------------------------
// 5. Instrumentos
// ---------------------------------------------------------------------------

// Se rellena con instrumentos/instrumentos.json. Si no se puede leer, queda solo el tono básico.
let instrumentos = [{ id: "tono", nombre: "Tono básico", programa: 0, archivo: null }];

async function cargarIndiceInstrumentos() {
  try {
    const respuesta = await fetch("instrumentos/instrumentos.json");
    if (!respuesta.ok) throw new Error("HTTP " + respuesta.status);
    const datos = await respuesta.json();
    const lista = (datos.instrumentos || []).filter(
      (i) => i && typeof i.id === "string" && typeof i.archivo === "string" && Number.isInteger(i.programa)
    );
    if (lista.length === 0) throw new Error("lista vacía");
    // El sintetizador tiene 16 canales y el 10 (posición 9) es de percusión: caben 15 instrumentos
    instrumentos = lista.slice(0, 15);
    if (Array.isArray(datos.rango) && datos.rango.length === 2) {
      RANGO_MIN = datos.rango[0];
      RANGO_MAX = datos.rango[1];
    }
    if (Number.isInteger(datos.velocidad)) VELOCIDAD = datos.velocidad;
  } catch (e) {
    console.warn("No se pudo leer la lista de instrumentos; se usa el tono básico.", e);
  }
}

function indiceInstrumento() {
  const i = instrumentos.findIndex((x) => x.id === ajustes.instrumento);
  return i === -1 ? 0 : i;
}

function instrumentoActual() {
  return instrumentos[indiceInstrumento()];
}

// El canal 9 es el de percusión, así que los instrumentos lo saltan
function canalDe(indice) {
  return indice < 9 ? indice : indice + 1;
}

// Descarga el instrumento elegido (mientras tanto suena el tono básico)
function prepararInstrumento() {
  const indice = indiceInstrumento();
  const inst = instrumentos[indice];
  if (inst.archivo && typeof Motor !== "undefined") {
    Motor.cargar(inst, canalDe(indice)).then(actualizarEstado);
  }
}

// ---------------------------------------------------------------------------
// 6. Qué nota toca cada pad
// ---------------------------------------------------------------------------

function escalaActual() {
  return ESCALAS.find((e) => e.id === ajustes.escala) || ESCALAS[0];
}

// Devuelve la nota (número MIDI) del pad i, o null si es un pad de función
function notaDePad(i) {
  const cfg = ajustes.pads[i];
  if (cfg.fn) return null;

  let base;
  if (cfg.nota !== null) {
    base = cfg.nota;                               // nota fija elegida a mano
  } else {
    // Posición de este pad entre los pads de nota que siguen la escala
    let posicion = 0;
    for (let j = 0; j < i; j++) {
      if (!ajustes.pads[j].fn && ajustes.pads[j].nota === null) posicion++;
    }
    const intervalos = escalaActual().intervalos;
    const vuelta = Math.floor(posicion / intervalos.length);
    base = NOTA_BASE + ajustes.raiz + 12 * vuelta + intervalos[posicion % intervalos.length];
  }
  return ajustarRango(base + 12 * estado.octava);
}

// ---------------------------------------------------------------------------
// 7. Pads en pantalla
// ---------------------------------------------------------------------------

const contenedorPads = document.getElementById("pads");
const botonesPads = [];
const retrasos = [];     // tiempo entre pulsar y lanzar el sonido (para el diagnóstico)

// Convierte "KeyA" -> "A", "Digit1" -> "1"...
function etiquetaTecla(codigo) {
  if (!codigo) return "—";
  if (codigo === "Space") return "Espacio";
  return codigo
    .replace(/^Key/, "")
    .replace(/^Digit/, "")
    .replace(/^Numpad/, "Num ")
    .replace(/^Arrow/, "Flecha ");
}

// Elige cuántas columnas usar para que los pads queden lo más cuadrados y grandes posible
function elegirColumnas(cantidad, ancho, alto) {
  let mejor = 1;
  let mejorPuntos = Infinity;
  for (let columnas = 1; columnas <= cantidad; columnas++) {
    const filas = Math.ceil(cantidad / columnas);
    const proporcion = Math.log(ancho / columnas / (alto / filas)); // 0 = cuadrado
    const vacias = columnas * filas - cantidad;
    const puntos = Math.abs(proporcion) + 0.12 * vacias;
    if (puntos < mejorPuntos) {
      mejorPuntos = puntos;
      mejor = columnas;
    }
  }
  return mejor;
}

function colocarPads() {
  const ancho = contenedorPads.clientWidth || 800;
  const alto = contenedorPads.clientHeight || 400;
  const columnas = elegirColumnas(ajustes.numPads, ancho, alto);
  const filas = Math.ceil(ajustes.numPads / columnas);
  contenedorPads.style.gridTemplateColumns = "repeat(" + columnas + ", 1fr)";
  contenedorPads.style.gridTemplateRows = "repeat(" + filas + ", 1fr)";
}

function dibujarPads() {
  contenedorPads.innerHTML = "";
  botonesPads.length = 0;

  for (let i = 0; i < ajustes.numPads; i++) {
    const boton = document.createElement("button");
    boton.type = "button";
    boton.className = "pad";
    boton.dataset.pad = i + 1;
    boton.innerHTML = '<span class="nota"></span><span class="tecla"></span>';

    // Táctil o ratón: se activa al pulsar, se suelta al levantar
    boton.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      activarPad(i, e.timeStamp);
    });
    boton.addEventListener("pointerup", () => soltarPad(i));
    boton.addEventListener("pointercancel", () => soltarPad(i));
    boton.addEventListener("pointerleave", () => soltarPad(i));
    boton.addEventListener("contextmenu", (e) => e.preventDefault());

    contenedorPads.appendChild(boton);
    botonesPads.push(boton);
  }
  colocarPads();
  actualizarEtiquetas();
}

// Actualiza el texto y el color de los pads sin volver a crearlos
function actualizarEtiquetas() {
  botonesPads.forEach((boton, i) => {
    const cfg = ajustes.pads[i];
    const textoNota = boton.querySelector(".nota");
    const textoTecla = boton.querySelector(".tecla");
    if (cfg.fn) {
      boton.classList.add("funcion");
      boton.style.removeProperty("--color");
      textoNota.textContent = FUNCIONES[cfg.fn].corto;
    } else {
      const midi = notaDePad(i);
      boton.classList.remove("funcion");
      boton.style.setProperty("--color", colorNota(midi));
      textoNota.textContent = nombreNota(midi);
    }
    textoTecla.textContent = etiquetaTecla(cfg.tecla);
    boton.setAttribute(
      "aria-label",
      "Pad " + (i + 1) + ": " + (cfg.fn ? FUNCIONES[cfg.fn].nombre : nombreNota(notaDePad(i)))
    );
  });
}

function activarPad(i, tiempoEvento) {
  if (botonesPads[i]) botonesPads[i].classList.add("activo");
  const cfg = ajustes.pads[i];
  if (cfg.fn) {
    ejecutarFuncion(cfg.fn);
  } else {
    empezarSonido(i, tiempoEvento);
  }
}

function soltarPad(i) {
  if (botonesPads[i]) botonesPads[i].classList.remove("activo");
  if (typeof Motor !== "undefined") Motor.parar(i);
}

function soltarTodos() {
  for (let i = 0; i < ajustes.numPads; i++) soltarPad(i);
  if (typeof Motor !== "undefined") Motor.pararTodo();
}

// ---------------------------------------------------------------------------
// 8. Sonido
// ---------------------------------------------------------------------------

function empezarSonido(i, tiempoEvento) {
  if (typeof Motor === "undefined") return;
  const midi = notaDePad(i);
  Motor.tocar(i, midi, instrumentoActual().id, VELOCIDAD);

  // Para el diagnóstico: cuánto ha tardado la app desde que llegó la pulsación
  if (typeof tiempoEvento === "number") {
    const ms = performance.now() - tiempoEvento;
    if (ms >= 0 && ms < 1000) {
      retrasos.push(ms);
      if (retrasos.length > 20) retrasos.shift();
      if (!panel.hidden) dibujarDiagnostico();
    }
  }
}

// ---------------------------------------------------------------------------
// 9. Estado en pantalla y avisos
// ---------------------------------------------------------------------------

const textoEstado = {
  instrumento: document.getElementById("est-instrumento"),
  escala: document.getElementById("est-escala"),
  volumen: document.getElementById("est-volumen"),
  octava: document.getElementById("est-octava"),
};
const cajaAviso = document.getElementById("aviso");
let temporizadorAviso = null;

function textoOctava() {
  return "Oct " + (estado.octava > 0 ? "+" : "") + estado.octava;
}

function actualizarEstado() {
  const inst = instrumentoActual();
  let nombre = inst.nombre;
  if (inst.archivo && typeof Motor !== "undefined") {
    const e = Motor.estado(inst.id);
    if (e === "cargando" || e === "pendiente") nombre += " …";
    if (e === "error") nombre += " (tono básico)";
  }
  textoEstado.instrumento.textContent = nombre;
  textoEstado.escala.textContent = escalaActual().nombre;
  textoEstado.volumen.textContent = "Vol " + ajustes.volumen + "%";
  textoEstado.octava.textContent = textoOctava();
  if (!panel.hidden) dibujarAjustesGenerales();
}

function aviso(texto) {
  cajaAviso.textContent = texto;
  cajaAviso.classList.add("visible");
  clearTimeout(temporizadorAviso);
  temporizadorAviso = setTimeout(() => cajaAviso.classList.remove("visible"), 1500);
}

// ---------------------------------------------------------------------------
// 10. Cambios de volumen, octava, instrumento y escala
// ---------------------------------------------------------------------------

function ponerVolumen(valor) {
  ajustes.volumen = Math.max(0, Math.min(100, Math.round(valor / 10) * 10));
  if (typeof Motor !== "undefined") Motor.volumen(ajustes.volumen / 100);
  guardarAjustes();
  actualizarEstado();
}

function ponerOctava(valor) {
  estado.octava = Math.max(OCTAVA_MINIMA, Math.min(OCTAVA_MAXIMA, valor));
  actualizarEtiquetas();
  actualizarEstado();
}

function ponerInstrumento(id) {
  ajustes.instrumento = id;
  guardarAjustes();
  prepararInstrumento();
  actualizarEstado();
}

function ponerEscala(id) {
  ajustes.escala = id;
  guardarAjustes();
  actualizarEtiquetas();
  actualizarEstado();
}

function ejecutarFuncion(id) {
  switch (id) {
    case "volumen-":
    case "volumen+": {
      ponerVolumen(ajustes.volumen + (id === "volumen+" ? 10 : -10));
      aviso("Volumen " + ajustes.volumen + "%");
      break;
    }
    case "octava-":
    case "octava+": {
      ponerOctava(estado.octava + (id === "octava+" ? 1 : -1));
      aviso("Octava " + (estado.octava > 0 ? "+" : "") + estado.octava);
      break;
    }
    case "instrumento-":
    case "instrumento+": {
      const paso = id === "instrumento+" ? 1 : -1;
      const nuevo = (indiceInstrumento() + paso + instrumentos.length) % instrumentos.length;
      ponerInstrumento(instrumentos[nuevo].id);
      aviso("Instrumento: " + instrumentos[nuevo].nombre);
      break;
    }
    case "escala-":
    case "escala+": {
      const paso = id === "escala+" ? 1 : -1;
      const actual = ESCALAS.findIndex((e) => e.id === ajustes.escala);
      const nueva = ESCALAS[(actual + paso + ESCALAS.length) % ESCALAS.length];
      ponerEscala(nueva.id);
      aviso("Escala: " + nueva.nombre);
      break;
    }
    default:
      break; // "ninguna"
  }
}

// ---------------------------------------------------------------------------
// 11. Teclado
// ---------------------------------------------------------------------------

let padEsperandoTecla = null; // pad al que se le está asignando una tecla (o null)

// Número del pad (0, 1, 2...) de una tecla, entre los pads que están activos. -1 si ninguno.
function padDeTecla(codigo) {
  for (let i = 0; i < ajustes.numPads; i++) {
    if (ajustes.pads[i].tecla === codigo) return i;
  }
  return -1;
}

// Si se está escribiendo en un desplegable o un deslizador de Ajustes, las teclas son suyas
function enControlDeAjustes(e) {
  return !panel.hidden && e.target && e.target.matches && e.target.matches("select, input");
}

window.addEventListener("keydown", (e) => {
  // Si estamos en Ajustes esperando una tecla nueva, esa pulsación es la elegida
  if (padEsperandoTecla !== null) {
    e.preventDefault();
    if (e.code !== "Escape") asignarTecla(padEsperandoTecla, e.code);
    padEsperandoTecla = null;
    dibujarFilasPads();
    return;
  }
  if (e.ctrlKey || e.metaKey || e.altKey || enControlDeAjustes(e)) return;

  const i = padDeTecla(e.code);
  if (i === -1) return;          // esa tecla no es de ningún pad
  e.preventDefault();
  if (e.repeat) return;          // ignorar la repetición automática al mantener pulsada
  activarPad(i, e.timeStamp);
});

window.addEventListener("keyup", (e) => {
  if (enControlDeAjustes(e)) return;
  const i = padDeTecla(e.code);
  if (i !== -1) soltarPad(i);
});

// Si la ventana pierde el foco o se oculta, se paran todos los sonidos (evita notas "pegadas")
window.addEventListener("blur", soltarTodos);
document.addEventListener("visibilitychange", () => {
  if (document.hidden) soltarTodos();
});
window.addEventListener("resize", colocarPads);

// ---------------------------------------------------------------------------
// 12. Panel de ajustes
// ---------------------------------------------------------------------------

const panel = document.getElementById("panel");
const contenedorFilas = document.getElementById("filas");
const selectorInstrumento = document.getElementById("aj-instrumento");
const selectorEscala = document.getElementById("aj-escala");
const selectorRaiz = document.getElementById("aj-raiz");
const deslizadorVolumen = document.getElementById("aj-volumen");
const textoVolumen = document.getElementById("aj-volumen-texto");
const selectorNumPads = document.getElementById("aj-numpads");
const cajaDiagnostico = document.getElementById("diagnostico");

function opcion(valor, texto, seleccionada) {
  const o = document.createElement("option");
  o.value = valor;
  o.textContent = texto;
  if (seleccionada) o.selected = true;
  return o;
}

// Los controles de "ajustes generales" (instrumento, escala, raíz, volumen, número de pads)
function dibujarAjustesGenerales() {
  selectorInstrumento.innerHTML = "";
  instrumentos.forEach((inst) =>
    selectorInstrumento.appendChild(opcion(inst.id, inst.nombre, inst.id === instrumentoActual().id))
  );

  selectorEscala.innerHTML = "";
  ESCALAS.forEach((e) => selectorEscala.appendChild(opcion(e.id, e.nombre, e.id === ajustes.escala)));

  selectorRaiz.innerHTML = "";
  NOMBRES_NOTA.forEach((n, i) => selectorRaiz.appendChild(opcion(i, n, i === ajustes.raiz)));

  deslizadorVolumen.value = ajustes.volumen;
  textoVolumen.textContent = ajustes.volumen + "%";

  selectorNumPads.innerHTML = "";
  for (let n = PADS_MINIMO; n <= PADS_MAXIMO; n++) {
    selectorNumPads.appendChild(opcion(n, n + " pads", n === ajustes.numPads));
  }
}

selectorInstrumento.addEventListener("change", () => ponerInstrumento(selectorInstrumento.value));
selectorEscala.addEventListener("change", () => ponerEscala(selectorEscala.value));
selectorRaiz.addEventListener("change", () => {
  ajustes.raiz = Number(selectorRaiz.value);
  guardarAjustes();
  actualizarEtiquetas();
});
deslizadorVolumen.addEventListener("input", () => ponerVolumen(Number(deslizadorVolumen.value)));
selectorNumPads.addEventListener("change", () => {
  ajustes.numPads = Number(selectorNumPads.value);
  guardarAjustes();
  soltarTodos();
  dibujarPads();
  dibujarFilasPads();
});

function asignarTecla(i, codigo) {
  // Si otro pad ya usaba esa tecla, se intercambian para que no haya repetidas
  const otro = ajustes.pads.findIndex((p, j) => j !== i && p.tecla === codigo);
  if (otro !== -1) ajustes.pads[otro].tecla = ajustes.pads[i].tecla;
  ajustes.pads[i].tecla = codigo;
  guardarAjustes();
  actualizarEtiquetas();
}

// Una fila por pad: número, tecla y qué hace (nota de la escala, función o nota fija)
function dibujarFilasPads() {
  contenedorFilas.innerHTML = "";

  for (let i = 0; i < ajustes.numPads; i++) {
    const cfg = ajustes.pads[i];
    const fila = document.createElement("div");
    fila.className = "fila";

    const numero = document.createElement("div");
    numero.className = "numero";
    numero.textContent = i + 1;

    const botonTecla = document.createElement("button");
    botonTecla.type = "button";
    if (padEsperandoTecla === i) {
      botonTecla.textContent = "Pulsa una tecla…";
      botonTecla.className = "esperando";
    } else {
      botonTecla.textContent = "Tecla: " + etiquetaTecla(cfg.tecla);
    }
    botonTecla.addEventListener("click", () => {
      padEsperandoTecla = i;
      dibujarFilasPads();
    });

    const selector = document.createElement("select");
    selector.setAttribute("aria-label", "Qué hace el pad " + (i + 1));
    const valorActual = cfg.fn ? "fn:" + cfg.fn : cfg.nota !== null ? "nota:" + cfg.nota : "auto";

    selector.appendChild(opcion("auto", "Nota de la escala", valorActual === "auto"));

    const grupoFunciones = document.createElement("optgroup");
    grupoFunciones.label = "Función";
    Object.keys(FUNCIONES).forEach((id) =>
      grupoFunciones.appendChild(opcion("fn:" + id, FUNCIONES[id].nombre, valorActual === "fn:" + id))
    );
    selector.appendChild(grupoFunciones);

    const grupoNotas = document.createElement("optgroup");
    grupoNotas.label = "Nota fija";
    for (let n = RANGO_MIN; n <= RANGO_MAX; n++) {
      grupoNotas.appendChild(opcion("nota:" + n, nombreNota(n), valorActual === "nota:" + n));
    }
    selector.appendChild(grupoNotas);

    selector.addEventListener("change", () => {
      const v = selector.value;
      if (v === "auto") {
        cfg.fn = null;
        cfg.nota = null;
      } else if (v.startsWith("fn:")) {
        cfg.fn = v.slice(3);
        cfg.nota = null;
      } else {
        cfg.fn = null;
        cfg.nota = Number(v.slice(5));
      }
      guardarAjustes();
      actualizarEtiquetas(); // las notas automáticas de los demás pads pueden cambiar
    });

    fila.append(numero, botonTecla, selector);
    contenedorFilas.appendChild(fila);
  }
}

// ---------------------------------------------------------------------------
// 13. Diagnóstico de latencia
// ---------------------------------------------------------------------------

function milisegundos(segundos) {
  return typeof segundos === "number" && isFinite(segundos) ? Math.round(segundos * 1000) : null;
}

function dibujarDiagnostico() {
  const lineas = [];
  const info = typeof Motor !== "undefined" ? Motor.latencia() : null;

  if (!info) {
    lineas.push("El audio todavía no está activo. Toca un pad y vuelve a mirar.");
  } else {
    lineas.push("Audio: " + (info.estado === "running" ? "activo" : info.estado));
    const base = milisegundos(info.base);
    const salida = milisegundos(info.salida);
    lineas.push("Latencia base del navegador: " + (base === null ? "no disponible" : base + " ms"));
    lineas.push("Latencia de salida del sistema: " + (salida === null ? "no disponible" : salida + " ms"));
  }

  let procesamiento = null;
  if (retrasos.length > 0) {
    const media = retrasos.reduce((a, b) => a + b, 0) / retrasos.length;
    const maximo = Math.max.apply(null, retrasos);
    procesamiento = media;
    lineas.push(
      "Retraso de la app (pulsación → sonido lanzado): " +
        media.toFixed(1) + " ms de media, " + maximo.toFixed(1) + " ms como máximo (" + retrasos.length + " pulsaciones)"
    );
  } else {
    lineas.push("Retraso de la app: toca algún pad para medirlo.");
  }

  if (info && procesamiento !== null) {
    const total = procesamiento + (milisegundos(info.base) || 0) + (milisegundos(info.salida) || 0);
    lineas.push("Total estimado: unos " + Math.round(total) + " ms");
  }
  lineas.push("No incluye el retardo del propio dispositivo (por Bluetooth suele ser pequeño) ni el del audio si sale por altavoces o auriculares Bluetooth, que puede ser grande.");

  cajaDiagnostico.textContent = lineas.join("\n");
}

document.getElementById("btn-probar").addEventListener("click", () => {
  if (typeof Motor === "undefined") return;
  Motor.tocar("prueba", ajustarRango(72), instrumentoActual().id, VELOCIDAD);
  setTimeout(() => Motor.parar("prueba"), 700);
  setTimeout(dibujarDiagnostico, 100);
});

// ---------------------------------------------------------------------------
// 14. Abrir y cerrar Ajustes (el engranaje hay que mantenerlo pulsado)
// ---------------------------------------------------------------------------

const botonAjustes = document.getElementById("btn-ajustes");
const TIEMPO_ENGRANAJE = 1000; // milisegundos
let temporizadorEngranaje = null;

function abrirPanel() {
  soltarTodos();
  padEsperandoTecla = null;
  dibujarAjustesGenerales();
  dibujarFilasPads();
  dibujarDiagnostico();
  panel.hidden = false;
}

function cerrarPanel() {
  padEsperandoTecla = null;
  panel.hidden = true;
}

function cancelarEngranaje() {
  clearTimeout(temporizadorEngranaje);
  temporizadorEngranaje = null;
  botonAjustes.classList.remove("manteniendo");
}

botonAjustes.addEventListener("pointerdown", (e) => {
  e.preventDefault();
  botonAjustes.classList.add("manteniendo");
  temporizadorEngranaje = setTimeout(() => {
    cancelarEngranaje();
    abrirPanel();
  }, TIEMPO_ENGRANAJE);
});
botonAjustes.addEventListener("pointerup", () => {
  if (temporizadorEngranaje !== null) aviso("Mantén pulsado el engranaje para abrir los ajustes");
  cancelarEngranaje();
});
botonAjustes.addEventListener("pointerleave", cancelarEngranaje);
botonAjustes.addEventListener("pointercancel", cancelarEngranaje);
botonAjustes.addEventListener("contextmenu", (e) => e.preventDefault());
// Con teclado (Enter o Espacio sobre el engranaje) se abre directamente
botonAjustes.addEventListener("click", (e) => {
  if (e.detail === 0) abrirPanel();
});

document.getElementById("btn-cerrar").addEventListener("click", cerrarPanel);
document.getElementById("btn-restablecer").addEventListener("click", () => {
  const instrumentoAnterior = ajustes.instrumento;
  ajustes = ajustesPorDefecto();
  estado.octava = 0;
  guardarAjustes();
  padEsperandoTecla = null;
  if (typeof Motor !== "undefined") Motor.volumen(ajustes.volumen / 100);
  if (ajustes.instrumento !== instrumentoAnterior) prepararInstrumento();
  dibujarPads();
  actualizarEstado();
  dibujarAjustesGenerales();
  dibujarFilasPads();
});

// ---------------------------------------------------------------------------
// 15. Arranque
// ---------------------------------------------------------------------------

dibujarPads();
actualizarEstado();
if (typeof Motor !== "undefined") Motor.volumen(ajustes.volumen / 100);

cargarIndiceInstrumentos().then(() => {
  // Los pads pueden haber cambiado de nota si el rango de notas es distinto del de por defecto
  actualizarEtiquetas();
  prepararInstrumento();
  actualizarEstado();
});
