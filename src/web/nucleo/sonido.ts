// Aviso de medida nueva: un silbato corto sintetizado (sin archivos de audio),
// vibración si el dispositivo la tiene y el título de la pestaña titilando.
// El navegador solo deja sonar después de que la persona tocó algo.

type ConWebkit = typeof globalThis & { webkitAudioContext?: typeof AudioContext };

let contexto: AudioContext | null = null;
let preparado = false;
let toco = false;

function despertar(): void {
  toco = true;
  try {
    if (!contexto) {
      const Clase = globalThis.AudioContext ?? (globalThis as ConWebkit).webkitAudioContext;
      if (!Clase) return;
      contexto = new Clase();
    }
    if (contexto.state === "suspended") void contexto.resume();
  } catch {
    contexto = null;
  }
}

/** Engancha el primer toque o tecla para habilitar el audio. Se puede llamar varias veces. */
export function prepararSonido(): void {
  if (preparado || typeof window === "undefined") return;
  preparado = true;
  const alTocar = () => despertar();
  window.addEventListener("pointerdown", alTocar, { passive: true });
  window.addEventListener("keydown", alTocar);
}

function pitido(ctx: AudioContext, inicio: number, duracion: number): void {
  const salida = ctx.createGain();
  salida.gain.setValueAtTime(0.0001, inicio);
  salida.gain.exponentialRampToValueAtTime(0.16, inicio + 0.012);
  salida.gain.setValueAtTime(0.16, inicio + duracion - 0.04);
  salida.gain.exponentialRampToValueAtTime(0.0001, inicio + duracion);
  salida.connect(ctx.destination);

  // Dos tonos muy cercanos baten entre sí: es lo que le da el trino al silbato.
  for (const frecuencia of [2380, 2460]) {
    const tono = ctx.createOscillator();
    tono.type = "sine";
    tono.frequency.setValueAtTime(frecuencia * 0.97, inicio);
    tono.frequency.linearRampToValueAtTime(frecuencia, inicio + 0.03);
    tono.connect(salida);
    tono.start(inicio);
    tono.stop(inicio + duracion + 0.02);
  }
}

/** Silbato de dos toques. No hace nada si el audio todavía no está habilitado. */
export function silbato(): void {
  const ctx = contexto;
  if (!ctx || ctx.state !== "running") return;
  try {
    const t = ctx.currentTime + 0.02;
    pitido(ctx, t, 0.11);
    pitido(ctx, t + 0.17, 0.24);
  } catch {
    // Sin audio no pasa nada: quedan la vibración y el título.
  }
}

export function vibrar(patron: number | number[]): void {
  try {
    if (typeof navigator === "undefined" || typeof navigator.vibrate !== "function") return;
    // Sin un toque previo el navegador lo bloquea (y lo anota como error en la consola).
    if (!(navigator.userActivation?.hasBeenActive ?? toco)) return;
    navigator.vibrate(patron);
  } catch {
    // Sin vibración quedan el silbato y el título.
  }
}

let titilando: number | undefined;
let tituloBase = "";

/** Alterna el título de la pestaña con `aviso` durante `ms` (o hasta `detenerTitulo`). */
export function titilarTitulo(aviso: string, ms = 12_000): void {
  detenerTitulo();
  tituloBase = document.title;
  let encendido = false;
  const fin = Date.now() + ms;
  titilando = window.setInterval(() => {
    if (Date.now() > fin) {
      detenerTitulo();
      return;
    }
    encendido = !encendido;
    document.title = encendido ? aviso : tituloBase;
  }, 700);
}

export function detenerTitulo(): void {
  if (titilando === undefined) return;
  window.clearInterval(titilando);
  titilando = undefined;
  document.title = tituloBase;
}

/** Cambia el título de fondo sin cortar un titileo en curso. */
export function fijarTitulo(titulo: string): void {
  if (titilando === undefined) document.title = titulo;
  tituloBase = titulo;
}
