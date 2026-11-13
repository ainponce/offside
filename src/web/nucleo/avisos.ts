// Guardia del juez: avisos del sistema y pantalla siempre prendida.
//
// Con la pestaña del juez en segundo plano (en la laptop del partido final hay tres pestañas
// abiertas) el silbato no alcanza: un aviso del sistema operativo dice qué medida llegó y, al
// tocarlo, trae la pestaña al frente. Mientras el juez está de turno, además, la pantalla no se
// apaga sola.
//
// Las dos cosas las da el navegador solo en un contexto seguro: https o localhost. En la red local
// por http (el celular de la demo) no existen, y el control no aparece.

import { useSyncExternalStore } from "react";
import type { ClaseMedida, MedidaDTO } from "../../compartido/tipos.ts";

const CLAVE = "offside.juez.guardia";

export interface Guardia {
  /** El navegador ofrece al menos una de las dos cosas. */
  disponible: boolean;
  /** El juez la encendió. */
  activa: boolean;
  avisos: NotificationPermission | "no_disponible";
  pantalla: "prendida" | "libre" | "no_disponible";
}

interface Candado {
  release(): Promise<void>;
  addEventListener(tipo: "release", oyente: () => void): void;
}
type ConWakeLock = Navigator & { wakeLock?: { request(tipo: "screen"): Promise<Candado> } };

const hayVentana = typeof window !== "undefined";

export function avisosPosibles(): boolean {
  return hayVentana && window.isSecureContext && "Notification" in window;
}

export function pantallaPosible(): boolean {
  return hayVentana && window.isSecureContext && "wakeLock" in navigator;
}

function preferencia(): boolean {
  try {
    return localStorage.getItem(CLAVE) === "1";
  } catch {
    return false;
  }
}

function guardar(activa: boolean): void {
  try {
    localStorage.setItem(CLAVE, activa ? "1" : "0");
  } catch {
    // Sin almacenamiento, vale lo que dure la pestaña.
  }
}

// --- estado compartido ---------------------------------------------------------------------------

let activaEnMemoria = preferencia();
let candado: Candado | null = null;
let pidiendo = false;
let otraVez = false;
let quiere = false;

function calcular(): Guardia {
  return {
    disponible: avisosPosibles() || pantallaPosible(),
    activa: activaEnMemoria,
    avisos: avisosPosibles() ? Notification.permission : "no_disponible",
    pantalla: !pantallaPosible() ? "no_disponible" : candado ? "prendida" : "libre",
  };
}

let instantanea = calcular();
const oyentes = new Set<() => void>();

function publicar(): void {
  const nuevo = calcular();
  if (
    nuevo.disponible !== instantanea.disponible ||
    nuevo.activa !== instantanea.activa ||
    nuevo.avisos !== instantanea.avisos ||
    nuevo.pantalla !== instantanea.pantalla
  ) {
    instantanea = nuevo;
    for (const f of oyentes) f();
  }
}

export function useGuardia(): Guardia {
  return useSyncExternalStore(
    (f) => {
      oyentes.add(f);
      return () => oyentes.delete(f);
    },
    () => instantanea,
    () => instantanea,
  );
}

export async function activarGuardia(): Promise<void> {
  activaEnMemoria = true;
  guardar(true);
  if (avisosPosibles() && Notification.permission === "default") {
    try {
      await Notification.requestPermission();
    } catch {
      // Navegadores viejos piden el permiso con un callback; si falla, quedan solo los sonidos.
    }
  }
  publicar();
  await sincronizarPantalla();
}

export async function apagarGuardia(): Promise<void> {
  activaEnMemoria = false;
  guardar(false);
  publicar();
  await sincronizarPantalla();
}

// --- pantalla siempre prendida -------------------------------------------------------------------

/** La pantalla del juez la quiere prendida mientras está de turno y el partido sigue. */
export async function mantenerPantalla(querer: boolean): Promise<void> {
  quiere = querer;
  await sincronizarPantalla();
}

async function sincronizarPantalla(): Promise<void> {
  if (!pantallaPosible()) return;
  if (pidiendo) {
    // Hay un pedido en curso: al terminar, se vuelve a mirar qué corresponde.
    otraVez = true;
    return;
  }
  const debe = quiere && activaEnMemoria && document.visibilityState === "visible";
  pidiendo = true;
  try {
    if (debe && !candado) {
      const c = await (navigator as ConWakeLock).wakeLock!.request("screen");
      candado = c;
      c.addEventListener("release", () => {
        if (candado === c) candado = null;
        publicar();
      });
    } else if (!debe && candado) {
      const c = candado;
      candado = null;
      await c.release();
    }
  } catch {
    // El sistema puede negarlo (batería baja, por ejemplo): se reintenta al volver a la pestaña.
    candado = null;
  } finally {
    pidiendo = false;
    publicar();
  }
  if (otraVez) {
    otraVez = false;
    await sincronizarPantalla();
  }
}

if (hayVentana) {
  // El navegador suelta el candado cuando la pestaña se oculta: se vuelve a pedir al volver.
  document.addEventListener("visibilitychange", () => void sincronizarPantalla());
}

// --- avisos del sistema --------------------------------------------------------------------------

const TITULO: Record<ClaseMedida, string> = {
  inicial: "Nueva filtración: falta tu firma",
  ampliacion: "El pirata saltó de servidor: ampliación",
  ratificacion: "Una orden espera tu ratificación",
  levantamiento: "Reclamo: un sitio legítimo está caído",
};

const abiertos = new Map<string, Notification>();

/** Avisa las medidas nuevas, solo si la pestaña no está a la vista. Tocar el aviso la trae al frente. */
export function avisarMedidas(medidas: MedidaDTO[]): void {
  if (!activaEnMemoria || !avisosPosibles() || Notification.permission !== "granted" || medidas.length === 0) return;
  if (document.visibilityState === "visible" && document.hasFocus()) return;
  // El reclamo primero: hay un sitio legítimo caído ahora.
  const orden = [...medidas].sort((a, b) => Number(b.clase === "levantamiento") - Number(a.clase === "levantamiento"));
  const m = orden[0]!;
  const mas = orden.length > 1 ? ` (y ${orden.length - 1} más)` : "";
  try {
    const n = new Notification(`${TITULO[m.clase]}${mas}`, {
      body: `${m.pedido}\n${m.expediente_id}`,
      tag: `offside-${m.id}`,
      requireInteraction: m.clase === "levantamiento" || m.clase === "ratificacion",
      lang: "es",
    });
    n.onclick = () => {
      window.focus();
      n.close();
    };
    n.onclose = () => abiertos.delete(m.id);
    abiertos.set(m.id, n);
  } catch {
    // En algunos teléfonos solo se puede avisar desde un service worker: quedan el sonido y el título.
  }
}

/** Cierra los avisos de medidas que ya no esperan firma (firmadas acá, en otra pestaña o traspasadas). */
export function cerrarAvisosSalvo(pendientes: ReadonlySet<string>): void {
  for (const [id, n] of abiertos) {
    if (!pendientes.has(id)) {
      n.close();
      abiertos.delete(id);
    }
  }
}
