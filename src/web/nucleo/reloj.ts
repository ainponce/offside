// Reloj del partido. El servidor informa el minuto cada tanto; entre un dato y
// otro se interpola con la aceleración del simulador (minutos de partido por minuto real).

import { useEffect, useState } from "react";
import type { EstadoDTO } from "../../compartido/tipos.ts";

interface Base {
  valido: boolean;
  minuto: number;
  /** performance.now() del momento en que llegó `minuto`. */
  t: number;
  acelerar: number;
  fin: number;
  finalizado: boolean;
  conectado: boolean;
}

let base: Base = { valido: false, minuto: 0, t: 0, acelerar: 1, fin: 0, finalizado: false, conectado: false };

/** Más allá de esto sin noticias del servidor, el reloj deja de avanzar solo. */
const MAX_SIN_DATOS_MS = 6000;

export function minutoAhora(): number {
  if (!base.valido) return 0;
  if (base.finalizado) return base.fin;
  if (!base.conectado) return Math.min(base.minuto, base.fin);
  const transcurrido = Math.min(performance.now() - base.t, MAX_SIN_DATOS_MS);
  return Math.min(base.minuto + (transcurrido / 60_000) * base.acelerar, base.fin);
}

export function sincronizarReloj(e: EstadoDTO): void {
  let minuto = e.minuto;
  if (base.valido && base.conectado && e.conectado && !e.finalizado && base.acelerar === e.acelerar) {
    // El dato del servidor llega con unos instantes de atraso: si la cuenta local
    // va apenas adelantada se conserva, para que el reloj no retroceda.
    const local = minutoAhora();
    const tolerancia = (e.acelerar * 1.5) / 60;
    if (local > minuto && local - minuto <= tolerancia) minuto = local;
  }
  base = {
    valido: true,
    minuto,
    t: performance.now(),
    acelerar: e.acelerar > 0 ? e.acelerar : 1,
    fin: e.fin_min,
    finalizado: e.finalizado,
    conectado: e.conectado,
  };
}

export function aceleracion(): number {
  return base.acelerar;
}

/** Vuelve a dibujar el componente cada `ms` y devuelve el minuto interpolado. */
export function useMinuto(ms = 250): number {
  const [, marcar] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => marcar((n) => (n + 1) % 1_000_000), ms);
    return () => window.clearInterval(id);
  }, [ms]);
  return minutoAhora();
}
