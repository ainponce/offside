// Datos en vivo: cada pantalla pide su ruta, vuelve a pedirla cuando el servidor
// avisa un `cambio` por el flujo de eventos y, por las dudas, cada dos segundos.

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { ErrorApi, pedirTexto } from "./api.ts";

const cambios = new Set<() => void>();
const oyentesFlujo = new Set<() => void>();
let fuente: EventSource | null = null;
let flujoAbierto = false;
let reintento: number | undefined;

function avisarFlujo(abierto: boolean): void {
  if (flujoAbierto === abierto) return;
  flujoAbierto = abierto;
  for (const oyente of [...oyentesFlujo]) oyente();
}

function abrirFlujo(): void {
  if (fuente || typeof EventSource === "undefined") return;
  const f = new EventSource("/api/eventos");
  fuente = f;
  f.onopen = () => avisarFlujo(true);
  f.addEventListener("cambio", () => {
    avisarFlujo(true);
    for (const oyente of [...cambios]) oyente();
  });
  f.addEventListener("latido", () => avisarFlujo(true));
  f.onerror = () => {
    avisarFlujo(false);
    // El navegador reconecta solo, salvo que haya dado el flujo por cerrado.
    if (f.readyState === EventSource.CLOSED && fuente === f) {
      fuente = null;
      window.clearTimeout(reintento);
      reintento = window.setTimeout(() => {
        if (cambios.size > 0) abrirFlujo();
      }, 2000);
    }
  };
}

function cerrarFlujoSiNadieEscucha(): void {
  if (cambios.size > 0 || !fuente) return;
  fuente.close();
  fuente = null;
  window.clearTimeout(reintento);
  avisarFlujo(false);
}

function suscribirCambios(oyente: () => void): () => void {
  cambios.add(oyente);
  abrirFlujo();
  return () => {
    cambios.delete(oyente);
    // Se espera un instante: al cambiar de pantalla la siguiente se suscribe enseguida.
    window.setTimeout(cerrarFlujoSiNadieEscucha, 500);
  };
}

/** ¿Está abierto el flujo de eventos del servidor? */
export function useFlujoAbierto(): boolean {
  return useSyncExternalStore(
    (oyente) => {
      oyentesFlujo.add(oyente);
      return () => oyentesFlujo.delete(oyente);
    },
    () => flujoAbierto,
    () => false,
  );
}

export interface Vivo<T> {
  datos: T | null;
  /** Último error de la ruta; se limpia con la siguiente respuesta buena. */
  error: ErrorApi | null;
  /** Verdadero cuando Offside dejó de responder (los datos en pantalla pueden estar viejos). */
  sinServidor: boolean;
  recargar: () => Promise<void>;
}

interface OpcionesVivo<T> {
  publica?: boolean;
  /** Se llama con cada respuesta buena, cambie o no el contenido. */
  alRecibir?: (datos: T) => void;
}

const INTERVALO_MS = 2000;
const ESPERA_CAMBIO_MS = 100;

export function useVivo<T>(ruta: string | null, opciones: OpcionesVivo<T> = {}): Vivo<T> {
  const [datos, setDatos] = useState<T | null>(null);
  const [error, setError] = useState<ErrorApi | null>(null);
  const [fallas, setFallas] = useState(0);

  const publica = opciones.publica ?? false;
  const alRecibir = useRef(opciones.alRecibir);
  alRecibir.current = opciones.alRecibir;

  const textoPrevio = useRef<string | null>(null);
  const enVuelo = useRef<Promise<void> | null>(null);
  const otraVez = useRef(false);
  const vigente = useRef(0);

  const cargar = useCallback(async (): Promise<void> => {
    if (!ruta) return;
    if (enVuelo.current) {
      // Hay un pedido en camino: al volver se pide de nuevo, para no perder el cambio.
      otraVez.current = true;
      return enVuelo.current;
    }
    const turno = vigente.current;
    const pedido = (async () => {
      do {
        otraVez.current = false;
        try {
          const texto = await pedirTexto(ruta, { publica });
          if (turno !== vigente.current) return;
          const leido = JSON.parse(texto) as T;
          if (texto !== textoPrevio.current) {
            textoPrevio.current = texto;
            setDatos(leido);
          }
          alRecibir.current?.(leido);
          setError(null);
          setFallas(0);
        } catch (causa) {
          if (turno !== vigente.current) return;
          const e = causa instanceof ErrorApi ? causa : new ErrorApi(0, "Offside contestó algo que no se pudo leer.");
          setError(e);
          if (e.codigo === 0 || e.codigo >= 500) setFallas((n) => n + 1);
        }
      } while (otraVez.current && turno === vigente.current);
    })();
    enVuelo.current = pedido;
    try {
      await pedido;
    } finally {
      if (enVuelo.current === pedido) enVuelo.current = null;
    }
  }, [ruta, publica]);

  useEffect(() => {
    if (!ruta) return;
    vigente.current += 1;
    textoPrevio.current = null;
    enVuelo.current = null;
    setDatos(null);
    setError(null);
    setFallas(0);

    void cargar();
    let espera: number | undefined;
    const alCambiar = () => {
      window.clearTimeout(espera);
      // En una pestaña en segundo plano el navegador demora los temporizadores:
      // ahí se pide de inmediato, para que el aviso de medida nueva no llegue tarde.
      if (document.hidden) void cargar();
      else espera = window.setTimeout(() => void cargar(), ESPERA_CAMBIO_MS);
    };
    const quitar = suscribirCambios(alCambiar);
    const intervalo = window.setInterval(() => void cargar(), INTERVALO_MS);
    const alVolver = () => {
      if (!document.hidden) void cargar();
    };
    document.addEventListener("visibilitychange", alVolver);
    window.addEventListener("online", alVolver);
    return () => {
      vigente.current += 1;
      quitar();
      window.clearTimeout(espera);
      window.clearInterval(intervalo);
      document.removeEventListener("visibilitychange", alVolver);
      window.removeEventListener("online", alVolver);
    };
  }, [ruta, cargar]);

  return { datos, error, sinServidor: fallas >= 2, recargar: cargar };
}
