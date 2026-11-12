// Reloj del partido. El servidor informa el minuto cada tanto; entre un dato y
// otro se interpola con la aceleración del simulador (minutos de partido por minuto real).

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
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

// Un solo tic por intervalo para toda la página: todos los relojes que piden el mismo
// intervalo leen el mismo valor, tomado en el mismo instante. Dos relojes en una pantalla
// nunca marcan horas distintas.
interface Tic {
  valor: number;
  oyentes: Set<() => void>;
  id: number | undefined;
}
const tics = new Map<number, Tic>();

function ticDe(ms: number): Tic {
  let t = tics.get(ms);
  if (!t) {
    t = { valor: minutoAhora(), oyentes: new Set(), id: undefined };
    tics.set(ms, t);
  }
  return t;
}

const suscriptores = new Map<number, (oyente: () => void) => () => void>();
function suscriptorDe(ms: number): (oyente: () => void) => () => void {
  let s = suscriptores.get(ms);
  if (!s) {
    s = (oyente) => {
      const t = ticDe(ms);
      t.oyentes.add(oyente);
      if (t.id === undefined) {
        t.valor = minutoAhora();
        t.id = window.setInterval(() => {
          t.valor = minutoAhora();
          for (const o of [...t.oyentes]) o();
        }, ms);
      }
      return () => {
        t.oyentes.delete(oyente);
        if (t.oyentes.size === 0 && t.id !== undefined) {
          window.clearInterval(t.id);
          t.id = undefined;
        }
      };
    };
    suscriptores.set(ms, s);
  }
  return s;
}

/** Vuelve a dibujar el componente cada `ms` y devuelve el minuto interpolado, el mismo para todos. */
export function useMinuto(ms = 250): number {
  return useSyncExternalStore(suscriptorDe(ms), () => ticDe(ms).valor);
}

/** Verdadero mientras `condicion(minutoAhora())` se cumpla; se revisa cada `ms`, sin redibujar si no cambia. */
export function useCondicionMinuto(condicion: (minuto: number) => boolean, ms = 250): boolean {
  const [valor, setValor] = useState(() => condicion(minutoAhora()));
  const ref = useRef(condicion);
  ref.current = condicion;
  useEffect(() => {
    const revisar = () => setValor(ref.current(minutoAhora()));
    revisar();
    const id = window.setInterval(revisar, ms);
    return () => window.clearInterval(id);
  }, [ms]);
  return valor;
}
