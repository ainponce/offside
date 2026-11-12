// Aviso de medida nueva: un silbato corto sintetizado (sin archivos de audio),
// vibración si el dispositivo la tiene y el título de la pestaña titilando.
// El navegador solo deja sonar después de que la persona tocó algo. Silenciar
// (en Juez.tsx) apaga el silbato y la vibración; el título sigue titilando.

type ConWebkit = typeof globalThis & { webkitAudioContext?: typeof AudioContext };

let contexto: AudioContext | null = null;
let preparado = false;
let toco = false;
let desbloqueado = false;
const oyentesAudio = new Set<() => void>();

function avisarAudio(): void {
  for (const o of [...oyentesAudio]) o();
}

/** iOS solo deja sonar un contexto que reprodujo algo dentro de un toque: una muestra de silencio alcanza. */
function silencioDeUnaMuestra(ctx: AudioContext): void {
  try {
    const buffer = ctx.createBuffer(1, 1, 22_050);
    const fuente = ctx.createBufferSource();
    fuente.buffer = buffer;
    fuente.connect(ctx.destination);
    fuente.start(0);
    desbloqueado = true;
  } catch {
    // Sin este paso, en algunos navegadores el primer aviso no suena; no rompe nada.
  }
}

function despertar(): Promise<void> {
  toco = true;
  try {
    if (!contexto) {
      const Clase = globalThis.AudioContext ?? (globalThis as ConWebkit).webkitAudioContext;
      if (!Clase) return Promise.resolve();
      contexto = new Clase();
      contexto.addEventListener("statechange", avisarAudio);
      avisarAudio();
    }
    if (!desbloqueado) silencioDeUnaMuestra(contexto);
    if (contexto.state !== "running") return contexto.resume().then(avisarAudio, avisarAudio);
  } catch {
    contexto = null;
  }
  return Promise.resolve();
}

/**
 * Marca de los controles que activan el aviso ellos mismos, en su `click`. El toque
 * sobre ellos no lo habilita antes: si se habilitara al apoyar el dedo, el control
 * cambiaría (o desaparecería) antes de soltarlo y su `click` no llegaría, y entonces
 * no sonaría el silbato que confirma la activación.
 */
export const ACTIVA_SONIDO = "data-activa-sonido";

/** Engancha el primer toque o tecla para habilitar el audio. Se puede llamar varias veces. */
export function prepararSonido(): void {
  if (preparado || typeof window === "undefined") return;
  preparado = true;
  const alTocar = (e: Event) => {
    if (e.target instanceof Element && e.target.closest(`[${ACTIVA_SONIDO}]`)) return;
    void despertar();
  };
  // Safari desbloquea el audio en touchend o click, no en pointerdown: se escuchan los cuatro.
  window.addEventListener("pointerdown", alTocar, { passive: true });
  window.addEventListener("touchend", alTocar, { passive: true });
  window.addEventListener("click", alTocar, { passive: true });
  window.addEventListener("keydown", alTocar);
}

/** ¿El navegador ya deja sonar el aviso? Hasta el primer toque, no. */
export function audioListo(): boolean {
  return contexto?.state === "running";
}

/** Avisa cada vez que cambia `audioListo()`. Devuelve la función para dejar de escuchar. */
export function suscribirAudio(oyente: () => void): () => void {
  oyentesAudio.add(oyente);
  return () => oyentesAudio.delete(oyente);
}

/** Habilita el audio desde un toque explícito y hace sonar el silbato para confirmarlo. */
export async function activarSonido(): Promise<boolean> {
  await despertar();
  if (audioListo()) silbato();
  return audioListo();
}

/** ¿El dispositivo puede vibrar? En iPhone, no. */
export function puedeVibrar(): boolean {
  return typeof navigator !== "undefined" && typeof navigator.vibrate === "function";
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
