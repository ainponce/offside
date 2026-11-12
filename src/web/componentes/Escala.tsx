// La escala del partido, de 0 a 105: la misma en el tablero, el expediente y transparencia.
// Una filtración es un carril; cada salto de servidor, un escalón con su minuto.

import { type ReactElement, type ReactNode, type RefObject, useEffect, useRef, useState } from "react";
import type { ServidorDTO } from "../../compartido/tipos.ts";
import { minutoEntero, reloj } from "../nucleo/formato.ts";

export function fraccion(m: number, fin: number): number {
  if (!(fin > 0)) return 0;
  return Math.min(1, Math.max(0, m / fin));
}

/** Ancho en px de un elemento, al día con cada cambio de tamaño. */
export function useAncho<T extends HTMLElement>(): [RefObject<T | null>, number] {
  const ref = useRef<T | null>(null);
  const [ancho, setAncho] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setAncho(el.getBoundingClientRect().width));
    ro.observe(el);
    setAncho(el.getBoundingClientRect().width);
    return () => ro.disconnect();
  }, []);
  return [ref, ancho];
}

/**
 * Dónde se apoya la ficha del ahora sobre su línea: centrada, salvo cerca de los bordes,
 * donde se corre para no salirse de la escala (cerca del 105′ queda a la izquierda de la línea).
 */
export function bordeFicha(f: number): "inicio" | "fin" | undefined {
  return f > 0.9 ? "fin" : f < 0.06 ? "inicio" : undefined;
}

/** Ancho aproximado de la ficha del ahora, en rem: cifras de 13 px a ancho 115 más el relleno. */
function anchoFichaRem(texto: string): number {
  return texto.length * 0.56 + 0.875;
}

/** Ancho aproximado de un número de la regla ("105′"), en rem. */
function anchoNumeroRem(texto: string): number {
  return texto.length * 0.5 + 0.1;
}

/** Marcas de la regla: números cada 15′, marcas mayores cada 15′ y menores cada 5′. */
export function MarcasRegla({
  fin,
  ahora,
  ocultarCerca = 0,
  conPrima = true,
  cada = 15,
  ancho = 0,
  rem = 16,
}: {
  fin: number;
  ahora?: number | null;
  /** Sin medidas de la escala: se ocultan los números a menos de esto (en minutos) del ahora. */
  ocultarCerca?: number;
  conPrima?: boolean;
  /** Cada cuántos minutos va un número (15, o 30 en pantallas angostas). */
  cada?: number;
  /** Ancho de la escala en px: con él, se ocultan solo los números que la ficha del ahora tapa de verdad. */
  ancho?: number;
  rem?: number;
}) {
  const marcas: { m: number; mayor: boolean; numero: boolean }[] = [];
  for (let m = 0; m <= fin + 1e-6; m += 5) marcas.push({ m, mayor: m % 15 === 0, numero: (m % cada === 0 && fin - m >= cada * 0.6) || m >= fin });

  // Lo que ocupa la ficha, como fracción de la escala, según dónde se apoya.
  let tapa: [number, number] | null = null;
  if (ahora != null && ancho > 0) {
    const f = fraccion(ahora, fin);
    const w = (anchoFichaRem(reloj(Math.min(ahora, fin))) * rem) / ancho;
    const holgura = (0.375 * rem) / ancho;
    const borde = bordeFicha(f);
    const [a, b] = borde === "fin" ? [f - w, f] : borde === "inicio" ? [f, f + w] : [f - w / 2, f + w / 2];
    tapa = [a - holgura, b + holgura];
  }

  return (
    <>
      {marcas.map(({ m, mayor }) => (
        <span key={`t${m}`} className={`regla-marca ${mayor ? "regla-mayor" : "regla-menor"}`} style={{ left: `${fraccion(m, fin) * 100}%` }} />
      ))}
      {marcas
        .filter((x) => x.numero)
        .map(({ m }) => {
          const texto = `${minutoEntero(m)}${conPrima ? "′" : ""}`;
          const borde = m === 0 ? "inicio" : m >= fin ? "fin" : undefined;
          let oculto = false;
          if (tapa) {
            const fm = fraccion(m, fin);
            const lw = (anchoNumeroRem(texto) * rem) / ancho;
            const [a, b] = borde === "inicio" ? [fm, fm + lw] : borde === "fin" ? [fm - lw, fm] : [fm - lw / 2, fm + lw / 2];
            oculto = a < tapa[1] && b > tapa[0];
          } else if (ahora != null && ocultarCerca > 0) {
            oculto = Math.abs(m - ahora) < ocultarCerca;
          }
          return (
            <span key={`n${m}`} className="regla-numero num" data-borde={borde} style={{ left: `${fraccion(m, fin) * 100}%`, opacity: oculto ? 0 : 1 }}>
              {texto}
            </span>
          );
        })}
    </>
  );
}

/** La ficha celeste con el reloj, que se desliza sobre la regla (transform lineal, igual al intervalo del reloj). */
export function FichaAhora({ minuto, fin, conLinea = true }: { minuto: number; fin: number; conLinea?: boolean }) {
  const f = fraccion(minuto, fin);
  return (
    <span className="ahora-capa" aria-hidden="true" style={{ transform: `translateX(${f * 100}%)` }}>
      <span className="ahora-ficha cifra" data-borde={bordeFicha(f)}>
        {reloj(Math.min(minuto, fin))}
      </span>
      {conLinea && <span className="ahora-linea" />}
    </span>
  );
}

export interface GeometriaCarril {
  /** Ancho de la escala en px. */
  ancho: number;
  /** Alto de cada fila de servidor en px. */
  fila: number;
  fin: number;
  /** Minuto actual (o el final, si terminó). */
  ahora: number;
}

let montajes = 0;
/** La primera vez que se dibujan los carriles no se anima nada; después, cada salto nuevo se traza. */
export function usePrimerDibujo(): boolean {
  const [primero] = useState(() => {
    montajes += 1;
    return montajes === 1;
  });
  const [listo, setListo] = useState(false);
  useEffect(() => {
    const id = window.setTimeout(() => setListo(true), 600);
    return () => window.clearTimeout(id);
  }, []);
  return primero && !listo;
}

/**
 * Trazo de una filtración sobre la escala: el riel del bloqueo vigente, la fuga en grafito,
 * el codo de cada salto con su minuto, y los nodos de detección (abierto) y bloqueo (lleno).
 */
export function TrazoFiltracion({
  servidores,
  g,
  sinAnimar,
  filaDe = (i) => i,
  filas,
}: {
  servidores: ServidorDTO[];
  g: GeometriaCarril;
  sinAnimar: boolean;
  /** Renglón de cada servidor. Con un expediente plegado, los saltos del medio comparten un renglón. */
  filaDe?: (i: number) => number;
  /** Cuántos renglones tiene el carril (por defecto, uno por servidor). */
  filas?: number;
}) {
  if (g.ancho <= 0) return null;
  const x = (m: number) => fraccion(m, g.fin) * g.ancho;
  const yDe = (i: number) => filaDe(i) * g.fila + g.fila / 2;
  const r = 6;
  const alto = (filas ?? servidores.length) * g.fila;
  const elementos: ReactNode[] = [];

  servidores.forEach((s, i) => {
    const y = yDe(i);
    const desde = s.primera_deteccion_min;
    const bloqueo = s.primer_bloqueo_min != null ? desde + s.primer_bloqueo_min : null;
    const siguiente = servidores[i + 1];
    const hasta = siguiente ? Math.min(siguiente.primera_deteccion_min, g.ahora) : g.ahora;
    const x0 = x(desde);
    const x1 = Math.max(x0, x(Math.max(desde, hasta)));

    // Riel del bloqueo vigente: desde el primer bloqueo confirmado hasta el final.
    if (bloqueo != null && bloqueo <= g.ahora) {
      elementos.push(<line key={`riel${s.id}`} className="trazo-riel" x1={x(bloqueo)} y1={y} x2={x(g.fin)} y2={y} />);
    }

    // La fuga: de la detección al salto siguiente (codo incluido) o al ahora.
    if (siguiente && siguiente.primera_deteccion_min <= g.ahora && yDe(i + 1) === y) {
      // Saltos plegados en un mismo renglón: la fuga sigue de largo, sin codo ni minuto.
      const xs = x(siguiente.primera_deteccion_min);
      if (xs - x0 > 0.5) elementos.push(<line key={`fuga${s.id}`} className="trazo-fuga" x1={x0} y1={y} x2={xs} y2={y} />);
    } else if (siguiente && siguiente.primera_deteccion_min <= g.ahora) {
      const xs = x(siguiente.primera_deteccion_min);
      const yn = yDe(i + 1);
      const radio = Math.min(r, Math.max(0, xs - x0));
      const d = `M ${x0} ${y} L ${xs - radio} ${y} Q ${xs} ${y} ${xs} ${y + radio} L ${xs} ${yn - r} Q ${xs} ${yn} ${xs + r} ${yn}`;
      elementos.push(
        <path key={`fuga${s.id}`} className="trazo-fuga" d={d} pathLength={1} data-traza={sinAnimar ? undefined : ""} />,
        <text key={`min${s.id}`} className="trazo-minuto num" x={xs - 6} y={(y + yn) / 2 + 4} textAnchor="end">
          {minutoEntero(siguiente.primera_deteccion_min)}′
        </text>,
      );
    } else if (x1 - x0 > 0.5) {
      elementos.push(<line key={`fuga${s.id}`} className="trazo-fuga" x1={x0} y1={y} x2={x1} y2={y} />);
    }

    // Nodos: abierto en la detección, lleno en el bloqueo.
    elementos.push(<circle key={`det${s.id}`} className="trazo-nodo-abierto" cx={x0} cy={y} r={4} />);
    if (bloqueo != null && bloqueo <= g.ahora) {
      elementos.push(<circle key={`blq${s.id}`} className="trazo-nodo-lleno" cx={x(bloqueo)} cy={y} r={4} />);
    }
  });

  // Los nodos van encima de las líneas.
  const lineas = elementos.filter((e) => (e as ReactElement).type !== "circle");
  const nodos = elementos.filter((e) => (e as ReactElement).type === "circle");
  return (
    <svg className="trazo" width={g.ancho} height={alto} viewBox={`0 0 ${g.ancho} ${alto}`} aria-hidden="true">
      {lineas}
      {nodos}
    </svg>
  );
}
