// HENAR Lite - app.js (Con lienzo interactivo drag & drop)

// ---------------------------------------------------------------------------
// 1. Datos básicos
// ---------------------------------------------------------------------------

const CLAVE_GUARDADO = "henar-lite-ajustes-v2";
const COLORES = ["#ff6b6b", "#ffa94d", "#ffd43b", "#69db7c", "#4dabf7", "#b197fc"];
const NOTAS_POR_DEFECTO = [60, 62, 64, 65, 67, 69]; // C4 D4 E4 F4 G4 A4

function ajustesPorDefecto() {
  return [
    { id: "pad-1", tecla: "Digit1", nota: 60, x: 40, y: 100 },
    { id: "pad-2", tecla: "Digit2", nota: 62, x: 180, y: 100 },
    { id: "pad-3", tecla: "Digit3", nota: 64, x: 320, y: 100 },
    { id: "pad-4", tecla: "Digit4", nota: 65, x: 460, y: 100 },
    { id: "pad-5", tecla: "Digit5", nota: 67, x: 600, y: 100 },
    { id: "pad-6", tecla: "Digit6", nota: 69, x: 740, y: 100 },
  ];
}

// Modo edición para arrastrar / quitar teclas
let modoEdicion = true;

// ---------------------------------------------------------------------------
// 2. Notas musicales
// ---------------------------------------------------------------------------

const NOMBRES_NOTA = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const NOTA_MINIMA = 48; // C3
const NOTA_MAXIMA = 84; // C6

function nombreNota(midi) {
  return NOMBRES_NOTA[midi % 12] + (Math.floor(midi / 12) - 1);
}

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
      if (Array.isArray(datos) && datos.length > 0) return datos;
    }
  } catch (e) {}
  return ajustesPorDefecto();
}

function guardarAjustes() {
  try {
    localStorage.setItem(CLAVE_GUARDADO, JSON.stringify(ajustes));
  } catch (e) {}
}

let ajustes = cargarAjustes();

// ---------------------------------------------------------------------------
// 4. Sonido (Web Audio API)
// ---------------------------------------------------------------------------

let audio = null;
const sonando = {};

function obtenerAudio() {
  if (!audio) {
    audio = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (audio.state === "suspended") audio.resume();
  return audio;
}

function empezarSonido(i) {
  if (sonando[i] || !ajustes[i]) return;
  const ctx = obtenerAudio();

  const oscilador = ctx.createOscillator();
  oscilador.type = "triangle";
  oscilador.frequency.value = frecuencia(ajustes[i].nota);

  const volumen = ctx.createGain();
  volumen.gain.setValueAtTime(0, ctx.currentTime);
  volumen.gain.linearRampToValueAtTime(0.4, ctx.currentTime + 0.02);

  oscilador.connect(volumen);
  volumen.connect(ctx.destination);
  oscilador.start();

  sonando[i] = { oscilador, volumen };
}

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
// 5. Pads en pantalla y Arrastre (Drag & Drop)
// ---------------------------------------------------------------------------

const contenedorPads = document.getElementById("pads");
const botonesPads = [];

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

  ajustes.forEach((padData, i) => {
    const boton = document.createElement("button");
    boton.type = "button";
    boton.className = "pad";
    boton.style.setProperty("--color", COLORES[i % COLORES.length]);
    
    // Posicionamiento libre en el lienzo
    boton.style.position = "absolute";
    boton.style.left = `${padData.x || 50}px`;
    boton.style.top = `${padData.y || 50}px`;

    boton.innerHTML =
      '<span class="nota">' + nombreNota(padData.nota) + "</span>" +
      '<span class="tecla">' + etiquetaTecla(padData.tecla) + "</span>" +
      '<span class="btn-eliminar" title="Eliminar tecla">✕</span>';

    // Evento de eliminación en modo edición
    const btnEliminar = boton.querySelector(".btn-eliminar");
    btnEliminar.addEventListener("pointerdown", (e) => {
      e.stopPropagation();
      eliminarPad(i);
    });

    // Eventos de sonido táctil/ratón (solo en Modo Uso)
    boton.addEventListener("pointerdown", (e) => {
      if (modoEdicion) return;
      e.preventDefault();
      activarPad(i);
    });
    boton.addEventListener("pointerup", () => !modoEdicion && soltarPad(i));
    boton.addEventListener("pointercancel", () => !modoEdicion && soltarPad(i));
    boton.addEventListener("pointerleave", () => !modoEdicion && soltarPad(i));
    boton.addEventListener("contextmenu", (e) => e.preventDefault());

    // Hacer arrastrable
    hacerArrastrable(boton, i);

    contenedorPads.appendChild(boton);
    botonesPads.push(boton);
  });
}

function hacerArrastrable(elemento, index) {
  let isDragging = false;
  let startX, startY, initialLeft, initialTop;

  function onPointerDown(e) {
    if (!modoEdicion || e.target.classList.contains("btn-eliminar")) return;
    isDragging = true;

    startX = e.clientX;
    startY = e.clientY;
    initialLeft = elemento.offsetLeft;
    initialTop = elemento.offsetTop;

    elemento.setPointerCapture(e.pointerId);
    elemento.addEventListener("pointermove", onPointerMove);
    elemento.addEventListener("pointerup", onPointerUp);
    elemento.addEventListener("pointercancel", onPointerUp);
  }

  function onPointerMove(e) {
    if (!isDragging) return;
    const deltaX = e.clientX - startX;
    const deltaY = e.clientY - startY;

    ajustes[index].x = initialLeft + deltaX;
    ajustes[index].y = initialTop + deltaY;

    elemento.style.left = `${ajustes[index].x}px`;
    elemento.style.top = `${ajustes[index].y}px`;
  }

  function onPointerUp(e) {
    if (!isDragging) return;
    isDragging = false;
    guardarAjustes();
    elemento.releasePointerCapture(e.pointerId);
    elemento.removeEventListener("pointermove", onPointerMove);
    elemento.removeEventListener("pointerup", onPointerUp);
    elemento.removeEventListener("pointercancel", onPointerUp);
  }

  elemento.addEventListener("pointerdown", onPointerDown);
}

function activarPad(i) {
  if (botonesPads[i]) {
    botonesPads[i].classList.add("activo");
    empezarSonido(i);
  }
}

function soltarPad(i) {
  if (botonesPads[i]) {
    botonesPads[i].classList.remove("activo");
    pararSonido(i);
  }
}

function soltarTodos() {
  for (let i = 0; i < ajustes.length; i++) soltarPad(i);
}

function añadirPad() {
  const i = ajustes.length;
  ajustes.push({
    id: "pad-" + Date.now(),
    tecla: "Key" + String.fromCharCode(65 + (i % 26)), // Asigna teclas A, B, C...
    nota: NOTAS_POR_DEFECTO[i % NOTAS_POR_DEFECTO.length],
    x: 80 + (i % 5) * 120,
    y: 120 + Math.floor(i / 5) * 120,
  });
  guardarAjustes();
  dibujarPads();
  dibujarFilas();
}

function eliminarPad(i) {
  soltarPad(i);
  ajustes.splice(i, 1);
  guardarAjustes();
  dibujarPads();
  dibujarFilas();
}

// ---------------------------------------------------------------------------
// 6. Teclado
// ---------------------------------------------------------------------------

let padEsperandoTecla = null;

function padDeTecla(codigo) {
  return ajustes.findIndex((a) => a.tecla === codigo);
}

window.addEventListener("keydown", (e) => {
  if (padEsperandoTecla !== null) {
    e.preventDefault();
    if (e.code !== "Escape") asignarTecla(padEsperandoTecla, e.code);
    padEsperandoTecla = null;
    dibujarFilas();
    return;
  }

  const i = padDeTecla(e.code);
  if (i === -1) return;
  e.preventDefault();
  if (e.repeat) return;
  activarPad(i);
});

window.addEventListener("keyup", (e) => {
  const i = padDeTecla(e.code);
  if (i !== -1) soltarPad(i);
});

window.addEventListener("blur", soltarTodos);

// ---------------------------------------------------------------------------
// 7. Panel de ajustes
// ---------------------------------------------------------------------------

const panel = document.getElementById("panel");
const contenedorFilas = document.getElementById("filas");

function asignarTecla(i, codigo) {
  const otro = padDeTecla(codigo);
  if (otro !== -1 && otro !== i) ajustes[otro].tecla = ajustes[i].tecla;
  ajustes[i].tecla = codigo;
  guardarAjustes();
  dibujarPads();
}

function dibujarFilas() {
  contenedorFilas.innerHTML = "";

  ajustes.forEach((pad, i) => {
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
      botonTecla.textContent = "Tecla: " + etiquetaTecla(pad.tecla);
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
      if (n === pad.nota) opcion.selected = true;
      selectorNota.appendChild(opcion);
    }
    selectorNota.addEventListener("change", () => {
      ajustes[i].nota = Number(selectorNota.value);
      guardarAjustes();
      dibujarPads();
    });

    fila.append(numero, botonTecla, selectorNota);
    contenedorFilas.appendChild(fila);
  });
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

// Botones de control
document.getElementById("btn-ajustes").addEventListener("click", abrirPanel);
document.getElementById("btn-cerrar").addEventListener("click", cerrarPanel);
document.getElementById("btn-restablecer").addEventListener("click", () => {
  ajustes = ajustesPorDefecto();
  guardarAjustes();
  padEsperandoTecla = null;
  dibujarPads();
  dibujarFilas();
});

// Botón para añadir teclas (si existe en tu HTML)
const btnAdd = document.getElementById("btn-anadir");
if (btnAdd) btnAdd.addEventListener("click", añadirPad);

// Botón para cambiar Modo Edición / Modo Uso (si existe en tu HTML)
const btnModo = document.getElementById("btn-modo");
if (btnModo) {
  btnModo.addEventListener("click", () => {
    modoEdicion = !modoEdicion;
    document.body.classList.toggle("modo-edicion", modoEdicion);
    btnModo.textContent = modoEdicion ? "Modo: Edición" : "Modo: Uso";
  });
}

// ---------------------------------------------------------------------------
// 8. Arranque
// ---------------------------------------------------------------------------

document.body.classList.toggle("modo-edicion", modoEdicion);
dibujarPads();