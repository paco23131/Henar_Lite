// HENAR Lite - app.js
//
// Qué hace esta app:
//   1. Dibuja unos pads grandes en pantalla.
//   2. Cada pad suena cuando lo tocas O cuando pulsas su tecla del teclado
//      (el dispositivo HENAR se comportará como un teclado normal).
//   3. En Ajustes se elige qué tecla y qué nota tiene cada pad.
//      Los ajustes se guardan en el propio dispositivo.

// ---------------------------------------------------------------------------
// 1. Datos básicos
// ---------------------------------------------------------------------------

// Cuántos pads hay. Cambia este número para tener más o menos.
const NUM_PADS = 6;

// Nombre con el que se guardan los ajustes en el dispositivo.
const CLAVE_GUARDADO = "henar-lite-ajustes-v1";

// Un color para cada pad (si hay más pads que colores, se repiten).
const COLORES = ["#ff6b6b", "#ffa94d", "#ffd43b", "#69db7c", "#4dabf7", "#b197fc"];

// Ajustes por defecto: pad 1 = tecla 1 = Do (C4), pad 2 = tecla 2 = Re (D4)...
// Los números de nota siguen el estándar MIDI: 60 = C4, 61 = C#4, 62 = D4...
const NOTAS_POR_DEFECTO = [60, 62, 64, 65, 67, 69]; // C4 D4 E4 F4 G4 A4

function ajustesPorDefecto() {
  const lista = [];
  for (let i = 0; i < NUM_PADS; i++) {
    lista.push({
      tecla: "Digit" + (i + 1),                       // tecla física: 1, 2, 3...
      nota: NOTAS_POR_DEFECTO[i % NOTAS_POR_DEFECTO.length],
    });
  }
  return lista;
}

// ---------------------------------------------------------------------------
// 2. Notas musicales
// ---------------------------------------------------------------------------

const NOMBRES_NOTA = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const NOTA_MINIMA = 48; // C3
const NOTA_MAXIMA = 84; // C6

// 60 -> "C4", 66 -> "F#4"
function nombreNota(midi) {
  return NOMBRES_NOTA[midi % 12] + (Math.floor(midi / 12) - 1);
}

// Frecuencia en Hz de una nota (A4 = 440 Hz)
function frecuencia(midi) {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

// ---------------------------------------------------------------------------
// 3. Guardar y cargar ajustes
// ---------------------------------------------------------------------------

function cargarAjustes() {
  try {
    const texto = localStorage.getItem(CLAVE_GUARDADO);
    if (texto) {
      const datos = JSON.parse(texto);
      const valido =
        Array.isArray(datos) &&
        datos.length === NUM_PADS &&
        datos.every((d) => typeof d.tecla === "string" && Number.isInteger(d.nota));
      if (valido) return datos;
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

// ---------------------------------------------------------------------------
// 4. Sonido (Web Audio)
// ---------------------------------------------------------------------------

let audio = null;       // el "motor" de sonido del navegador
const sonando = {};     // pads que están sonando ahora mismo

// Los navegadores solo permiten sonido después de que la persona toque o pulse
// algo, así que el motor se crea la primera vez que hace falta.
function obtenerAudio() {
  if (!audio) {
    audio = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (audio.state === "suspended") audio.resume();
  return audio;
}

// Empieza a sonar la nota del pad i (suena mientras se mantiene pulsado)
function empezarSonido(i) {
  if (sonando[i]) return;
  const ctx = obtenerAudio();

  const oscilador = ctx.createOscillator();
  oscilador.type = "triangle";
  oscilador.frequency.value = frecuencia(ajustes[i].nota);

  const volumen = ctx.createGain();
  volumen.gain.setValueAtTime(0, ctx.currentTime);
  volumen.gain.linearRampToValueAtTime(0.4, ctx.currentTime + 0.02); // entrada suave

  oscilador.connect(volumen);
  volumen.connect(ctx.destination);
  oscilador.start();

  sonando[i] = { oscilador, volumen };
}

// Deja de sonar la nota del pad i (con una salida suave para evitar "clics")
function pararSonido(i) {
  const s = sonando[i];
  if (!s) return;
  const t = audio.currentTime;
  s.volumen.gain.cancelScheduledValues(t);
  s.volumen.gain.setValueAtTime(s.volumen.gain.value, t);
  s.volumen.gain.linearRampToValueAtTime(0, t + 0.12);
  s.oscilador.stop(t + 0.15);
  delete sonando[i];
}

// ---------------------------------------------------------------------------
// 5. Pads en pantalla
// ---------------------------------------------------------------------------

const contenedorPads = document.getElementById("pads");
const botonesPads = [];

// Convierte "KeyA" -> "A", "Digit1" -> "1", "Space" -> "Espacio"...
function etiquetaTecla(codigo) {
  if (!codigo) return "—";
  if (codigo === "Space") return "Espacio";
  return codigo
    .replace(/^Key/, "")
    .replace(/^Digit/, "")
    .replace(/^Numpad/, "Num ")
    .replace(/^Arrow/, "Flecha ");
}

function dibujarPads() {
  contenedorPads.innerHTML = "";
  botonesPads.length = 0;

  for (let i = 0; i < NUM_PADS; i++) {
    const boton = document.createElement("button");
    boton.type = "button";
    boton.className = "pad";
    boton.style.setProperty("--color", COLORES[i % COLORES.length]);
    boton.innerHTML =
      '<span class="nota">' + nombreNota(ajustes[i].nota) + "</span>" +
      '<span class="tecla">' + etiquetaTecla(ajustes[i].tecla) + "</span>";

    // Táctil o ratón: sonar al pulsar, parar al soltar
    boton.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      activarPad(i);
    });
    boton.addEventListener("pointerup", () => soltarPad(i));
    boton.addEventListener("pointercancel", () => soltarPad(i));
    boton.addEventListener("pointerleave", () => soltarPad(i));
    boton.addEventListener("contextmenu", (e) => e.preventDefault());

    contenedorPads.appendChild(boton);
    botonesPads.push(boton);
  }
}

function activarPad(i) {
  botonesPads[i].classList.add("activo");
  empezarSonido(i);
}

function soltarPad(i) {
  botonesPads[i].classList.remove("activo");
  pararSonido(i);
}

function soltarTodos() {
  for (let i = 0; i < NUM_PADS; i++) soltarPad(i);
}

// ---------------------------------------------------------------------------
// 6. Teclado
// ---------------------------------------------------------------------------

let padEsperandoTecla = null; // pad al que se le está asignando una tecla (o null)

function padDeTecla(codigo) {
  return ajustes.findIndex((a) => a.tecla === codigo);
}

window.addEventListener("keydown", (e) => {
  // Si estamos en Ajustes esperando una tecla nueva, esa pulsación es la elegida
  if (padEsperandoTecla !== null) {
    e.preventDefault();
    if (e.code !== "Escape") asignarTecla(padEsperandoTecla, e.code);
    padEsperandoTecla = null;
    dibujarFilas();
    return;
  }

  const i = padDeTecla(e.code);
  if (i === -1) return;          // esa tecla no es de ningún pad
  e.preventDefault();
  if (e.repeat) return;          // ignorar la repetición automática al mantener pulsada
  activarPad(i);
});

window.addEventListener("keyup", (e) => {
  const i = padDeTecla(e.code);
  if (i !== -1) soltarPad(i);
});

// Si la ventana pierde el foco, se paran todos los sonidos (evita notas "pegadas")
window.addEventListener("blur", soltarTodos);

// ---------------------------------------------------------------------------
// 7. Panel de ajustes
// ---------------------------------------------------------------------------

const panel = document.getElementById("panel");
const contenedorFilas = document.getElementById("filas");

function asignarTecla(i, codigo) {
  // Si otro pad ya usaba esa tecla, se intercambian para que no haya repetidas
  const otro = padDeTecla(codigo);
  if (otro !== -1 && otro !== i) ajustes[otro].tecla = ajustes[i].tecla;
  ajustes[i].tecla = codigo;
  guardarAjustes();
  dibujarPads();
}

function dibujarFilas() {
  contenedorFilas.innerHTML = "";

  for (let i = 0; i < NUM_PADS; i++) {
    const fila = document.createElement("div");
    fila.className = "fila";
    fila.style.setProperty("--color", COLORES[i % COLORES.length]);

    const numero = document.createElement("div");
    numero.className = "numero";
    numero.textContent = i + 1;

    const botonTecla = document.createElement("button");
    botonTecla.type = "button";
    if (padEsperandoTecla === i) {
      botonTecla.textContent = "Pulsa una tecla…";
      botonTecla.className = "esperando";
    } else {
      botonTecla.textContent = "Tecla: " + etiquetaTecla(ajustes[i].tecla);
    }
    botonTecla.addEventListener("click", () => {
      padEsperandoTecla = i;
      dibujarFilas();
    });

    const selectorNota = document.createElement("select");
    selectorNota.setAttribute("aria-label", "Nota del pad " + (i + 1));
    for (let n = NOTA_MINIMA; n <= NOTA_MAXIMA; n++) {
      const opcion = document.createElement("option");
      opcion.value = n;
      opcion.textContent = nombreNota(n);
      if (n === ajustes[i].nota) opcion.selected = true;
      selectorNota.appendChild(opcion);
    }
    selectorNota.addEventListener("change", () => {
      ajustes[i].nota = Number(selectorNota.value);
      guardarAjustes();
      dibujarPads();
    });

    fila.append(numero, botonTecla, selectorNota);
    contenedorFilas.appendChild(fila);
  }
}

function abrirPanel() {
  soltarTodos();
  padEsperandoTecla = null;
  dibujarFilas();
  panel.hidden = false;
}

function cerrarPanel() {
  padEsperandoTecla = null;
  panel.hidden = true;
}

document.getElementById("btn-ajustes").addEventListener("click", abrirPanel);
document.getElementById("btn-cerrar").addEventListener("click", cerrarPanel);
document.getElementById("btn-restablecer").addEventListener("click", () => {
  ajustes = ajustesPorDefecto();
  guardarAjustes();
  padEsperandoTecla = null;
  dibujarPads();
  dibujarFilas();
});

// ---------------------------------------------------------------------------
// 8. Arranque
// ---------------------------------------------------------------------------

dibujarPads();
