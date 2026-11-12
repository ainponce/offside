// Mapa de filtraciones: dónde está cada servidor, en cualquier país, y por dónde saltó cada
// filtración.
//
// Cartografía propia (Natural Earth, empaquetada con la app): no usa tiles ni internet, así que
// funciona igual en la red del partido final. La ubicación de cada IP la resuelve el servidor
// (src/server/geo.ts): base GeoIP local para las IPs públicas, simulada para las de documentación
// del simulador, y el mapa dice cuál es cuál. Si la IP es de una CDN, dice que lo que se ve es el
// borde y no el origen.
//
// Lenguaje visual: grafito sobre porcelana. Verde, ámbar y rojo aparecen solo en los servidores,
// con el mismo significado que en los carriles. El anillo de cada servidor es la proporción de
// clientes del país que ya no lo pueden ver.

import type { Feature, FeatureCollection, Geometry } from "geojson";
import { geoDistance, geoGraticule, geoNaturalEarth1, geoPath } from "d3-geo";
import { select } from "d3-selection";
import "d3-transition";
import { type ZoomBehavior, type ZoomTransform, zoom as d3zoom, zoomIdentity } from "d3-zoom";
import { type FormEvent, type RefObject, useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { ExpedienteResumenDTO, ServidorDTO, TableroDTO, UbicacionDTO } from "../../compartido/tipos.ts";
import { pedir } from "../nucleo/api.ts";
import { ESTADO_EXPEDIENTE, minutoEntero, numero, plural, porcentaje, reloj } from "../nucleo/formato.ts";
import datos from "./mundo.json";

type PropsPais = { nombre: string; iso: string | null; argentina: boolean };
const PAISES = (datos as unknown as FeatureCollection<Geometry, PropsPais>).features;
const ARGENTINA = PAISES.filter((f) => f.properties.argentina);
const RESTO = PAISES.filter((f) => !f.properties.argentina);
/** Argentina continental y las Malvinas (las Georgias del Sur quedan lejos, al este). */
const ENCUADRE_AR: FeatureCollection = { type: "FeatureCollection", features: ARGENTINA.filter((f) => f.id !== "239") };
const ESFERA = { type: "Sphere" } as const;
const RETICULA = geoGraticule().step([15, 15])();

/** Ciudades argentinas de referencia. `rango` 1 se rotula de cerca; 2, más de cerca todavía. */
const CIUDADES: { nombre: string; lat: number; lon: number; rango: 1 | 2 }[] = [
  { nombre: "Buenos Aires", lat: -34.603, lon: -58.381, rango: 1 },
  { nombre: "Córdoba", lat: -31.42, lon: -64.188, rango: 1 },
  { nombre: "Rosario", lat: -32.947, lon: -60.63, rango: 1 },
  { nombre: "Mendoza", lat: -32.889, lon: -68.845, rango: 1 },
  { nombre: "Salta", lat: -24.782, lon: -65.423, rango: 1 },
  { nombre: "Neuquén", lat: -38.952, lon: -68.059, rango: 1 },
  { nombre: "Ushuaia", lat: -54.801, lon: -68.303, rango: 1 },
  { nombre: "Comodoro Rivadavia", lat: -45.865, lon: -67.497, rango: 1 },
  { nombre: "San Miguel de Tucumán", lat: -26.808, lon: -65.217, rango: 2 },
  { nombre: "Bahía Blanca", lat: -38.719, lon: -62.272, rango: 2 },
  { nombre: "Mar del Plata", lat: -38.005, lon: -57.543, rango: 2 },
  { nombre: "Posadas", lat: -27.367, lon: -55.896, rango: 2 },
  { nombre: "Resistencia", lat: -27.451, lon: -58.986, rango: 2 },
  { nombre: "Santa Rosa", lat: -36.62, lon: -64.29, rango: 2 },
  { nombre: "San Juan", lat: -31.537, lon: -68.525, rango: 2 },
  { nombre: "Paraná", lat: -31.732, lon: -60.529, rango: 2 },
  { nombre: "Río Gallegos", lat: -51.623, lon: -69.216, rango: 2 },
];

const RADIO_TIERRA_KM = 6371;
const ZOOM_MAX = 48;
const ANCHO_RUTAS_REM = 21;

// --- estado y textos de cada servidor ------------------------------------------------------------

type EstadoPunto = "espera" | "bloqueado" | "en_curso" | "fallo" | "vencido" | "rechazado" | "sin_orden";

const ROTULO_ESTADO: Record<EstadoPunto, string> = {
  espera: "Espera la firma del juez",
  bloqueado: "Bloqueado",
  en_curso: "Orden en curso",
  fallo: "Falló el envío",
  vencido: "Venció",
  rechazado: "Rechazado por el juez",
  sin_orden: "Sin orden",
};

function estadoDe(s: ServidorDTO): EstadoPunto {
  if (s.medida_estado === "pendiente") return "espera";
  if (s.medida_estado === "rechazada") return "rechazado";
  const celdas = s.por_proveedor.map((c) => c.estado);
  if (celdas.includes("aplicada")) return "bloqueado";
  if (celdas.some((c) => c === "recibida" || c === "por_enviar")) return "en_curso";
  if (celdas.includes("fallida")) return "fallo";
  if (celdas.some((c) => c === "vencida" || c === "levantada")) return "vencido";
  return "sin_orden";
}

const aplicadas = (s: ServidorDTO) => s.por_proveedor.filter((c) => c.estado === "aplicada").length;
const sinFicticio = (t: string) => t.replace(/\s*\(fictici[oa]\)/i, "");

function lugar(u: UbicacionDTO): string {
  return u.ciudad ?? u.provincia ?? u.pais_nombre;
}

/** Qué cambia según dónde está el servidor. Detrás de una CDN, el país del borde no dice nada. */
function jurisdiccion(u: UbicacionDTO, intermediario: string | null): string {
  if (intermediario) {
    return "Detrás de una CDN: el origen no se ve. Se bloquea el dominio, y el origen se le pide a la CDN con la orden judicial.";
  }
  if (u.en_argentina) return "En Argentina: además del bloqueo, la fiscalía puede pedir la baja al hosting.";
  return `En el exterior (${u.pais_nombre}): los proveedores argentinos lo bloquean igual. La baja del servidor necesita cooperación internacional o el contacto de abuso del hosting.`;
}

// --- geometría ----------------------------------------------------------------------------------

interface Punto {
  s: ServidorDTO;
  e: ExpedienteResumenDTO;
  u: UbicacionDTO;
  estado: EstadoPunto;
  /** Posición proyectada de su ciudad, sin zoom. */
  bx: number;
  by: number;
  /** Desplazamiento en pantalla dentro de su grupo (no escala con el zoom). */
  dx: number;
  dy: number;
}

/** Una ciudad (o un centro de datos simulado) con sus servidores. */
interface Lugar {
  id: string;
  u: UbicacionDTO;
  organizaciones: string[];
  cdn: boolean;
  bx: number;
  by: number;
  puntos: Punto[];
}

/** Lo que se dibuja junto: los lugares que, al zoom actual, caen demasiado cerca. */
interface Grupo {
  id: string;
  lugares: Lugar[];
  bx: number;
  by: number;
  radio: number;
  puntos: Punto[];
}

const PASO_GRUPO_PX = 32;
const RADIO_GRUPO_MIN_PX = 22;
const JUNTAR_PX = 40;

type Proyectar = (lonlat: [number, number]) => [number, number] | null;

function lugaresDe(expedientes: ExpedienteResumenDTO[], proyectar: Proyectar): { lugares: Lugar[]; sinUbicar: number } {
  const porId = new Map<string, Lugar>();
  let sinUbicar = 0;
  for (const e of expedientes) {
    for (const s of e.servidores) {
      const u = s.ubicacion;
      const xy = u ? proyectar([u.lon, u.lat]) : null;
      if (!u || !xy) {
        sinUbicar += 1;
        continue;
      }
      let l = porId.get(u.sitio);
      if (!l) {
        l = { id: u.sitio, u, organizaciones: [], cdn: false, bx: xy[0], by: xy[1], puntos: [] };
        porId.set(u.sitio, l);
      }
      if (s.organizacion && !l.organizaciones.includes(s.organizacion)) l.organizaciones.push(s.organizacion);
      if (s.intermediario) l.cdn = true;
      l.puntos.push({ s, e, u, estado: estadoDe(s), bx: xy[0], by: xy[1], dx: 0, dy: 0 });
    }
  }
  return { lugares: [...porId.values()], sinUbicar };
}

function agrupar(lugares: Lugar[], k: number): Grupo[] {
  const umbral = JUNTAR_PX / k;
  const grupos: Grupo[] = [];
  for (const l of [...lugares].sort((a, b) => b.puntos.length - a.puntos.length || a.id.localeCompare(b.id))) {
    const g = grupos.find((x) => Math.hypot(x.bx - l.bx, x.by - l.by) < umbral);
    if (g) {
      const n = g.puntos.length;
      g.lugares.push(l);
      g.bx = (g.bx * n + l.bx * l.puntos.length) / (n + l.puntos.length);
      g.by = (g.by * n + l.by * l.puntos.length) / (n + l.puntos.length);
      g.puntos.push(...l.puntos.map((p) => ({ ...p })));
    } else {
      grupos.push({ id: l.id, lugares: [l], bx: l.bx, by: l.by, radio: 0, puntos: l.puntos.map((p) => ({ ...p })) });
    }
  }
  for (const g of grupos) {
    g.id = g.lugares.map((l) => l.id).sort().join("|");
    const n = g.puntos.length;
    g.puntos.sort((a, b) => a.e.abierto_min - b.e.abierto_min || a.s.primera_deteccion_min - b.s.primera_deteccion_min);
    for (const p of g.puntos) {
      p.bx = g.bx;
      p.by = g.by;
    }
    if (n === 1) continue;
    g.radio = Math.max(RADIO_GRUPO_MIN_PX, (n * PASO_GRUPO_PX) / (2 * Math.PI));
    const inicio = -Math.PI / 2 - Math.PI / n;
    g.puntos.forEach((p, i) => {
      const a = inicio + (i * 2 * Math.PI) / n;
      p.dx = Math.cos(a) * g.radio;
      p.dy = Math.sin(a) * g.radio;
    });
  }
  return grupos;
}

function enPantalla(p: { bx: number; by: number; dx?: number; dy?: number }, t: ZoomTransform): [number, number] {
  return [p.bx * t.k + t.x + (p.dx ?? 0), p.by * t.k + t.y + (p.dy ?? 0)];
}

/** Curva de un salto: cuadrática, siempre hacia la izquierda del sentido de avance. */
function curva(a: [number, number], b: [number, number]): { d: string; medio: [number, number] } {
  const [ax, ay] = a;
  const [bx, by] = b;
  const dx = bx - ax;
  const dy = by - ay;
  const largo = Math.hypot(dx, dy) || 1;
  const comba = Math.min(110, Math.max(18, largo * 0.24));
  const cx = (ax + bx) / 2 + (dy / largo) * comba;
  const cy = (ay + by) / 2 - (dx / largo) * comba;
  const recorte = (px: number, py: number, qx: number, qy: number, r: number): [number, number] => {
    const l = Math.hypot(qx - px, qy - py) || 1;
    return [px + ((qx - px) / l) * r, py + ((qy - py) / l) * r];
  };
  const [sx, sy] = recorte(ax, ay, cx, cy, 12);
  const [ex, ey] = recorte(bx, by, cx, cy, 15);
  const medio: [number, number] = [0.25 * sx + 0.5 * cx + 0.25 * ex, 0.25 * sy + 0.5 * cy + 0.25 * ey];
  return { d: `M${sx.toFixed(1)},${sy.toFixed(1)}Q${cx.toFixed(1)},${cy.toFixed(1)} ${ex.toFixed(1)},${ey.toFixed(1)}`, medio };
}

/** Una longitud redonda que ocupe entre 60 y 130 píxeles. */
function escalaGrafica(kmPorPx: number): { km: number; px: number } {
  for (const km of [10, 20, 25, 50, 100, 200, 250, 500, 1000, 2000, 2500, 5000]) {
    const px = km / kmPorPx;
    if (px >= 60) return { km, px };
  }
  return { km: 5000, px: 5000 / kmPorPx };
}

interface Caja {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}
const solapan = (a: Caja, b: Caja) => a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;

type Margen = number | { arriba: number; abajo: number; lados: number };

function encuadre(caja: Caja, libre: number, alto: number, margen: Margen, kMax: number): ZoomTransform {
  const m = typeof margen === "number" ? { arriba: margen, abajo: margen, lados: margen } : margen;
  const w = Math.max(1, caja.x1 - caja.x0);
  const h = Math.max(1, caja.y1 - caja.y0);
  const altoUtil = Math.max(40, alto - m.arriba - m.abajo);
  const k = Math.max(1, Math.min(kMax, (libre - 2 * m.lados) / w, altoUtil / h));
  const cx = (caja.x0 + caja.x1) / 2;
  const cy = (caja.y0 + caja.y1) / 2;
  return zoomIdentity.translate(libre / 2 - cx * k, m.arriba + altoUtil / 2 - cy * k).scale(k);
}

/** Lo que tapan los controles flotantes, en coordenadas del mapa. */
function useTapas(caja: RefObject<HTMLElement | null>, elementos: RefObject<HTMLElement | null>[]): Caja[] {
  const [tapas, setTapas] = useState<Caja[]>([]);
  useLayoutEffect(() => {
    const raiz = caja.current;
    if (!raiz) return;
    const medir = () => {
      const r0 = raiz.getBoundingClientRect();
      const nuevas = elementos
        .map((e) => e.current?.getBoundingClientRect())
        .filter((r): r is DOMRect => !!r && r.width > 0)
        .map((r) => ({ x0: r.left - r0.left - 4, y0: r.top - r0.top - 4, x1: r.right - r0.left + 4, y1: r.bottom - r0.top + 4 }));
      setTapas((v) => (JSON.stringify(v) === JSON.stringify(nuevas) ? v : nuevas));
    };
    const ro = new ResizeObserver(medir);
    ro.observe(raiz);
    for (const e of elementos) if (e.current) ro.observe(e.current);
    medir();
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return tapas;
}

// --- rótulos sin choques -------------------------------------------------------------------------

interface Rotulo {
  dx: number;
  dy: number;
  ancla: "start" | "end" | "middle";
  segunda: boolean;
}

function textosGrupo(g: Grupo): [string, string] {
  if (g.lugares.length === 1) {
    const l = g.lugares[0]!;
    const org = l.organizaciones[0] ? sinFicticio(l.organizaciones[0]) : plural(l.puntos.length, "servidor", "servidores");
    const orgs = l.organizaciones.length > 1 ? `${org} y ${l.organizaciones.length - 1} más` : org;
    if (l.cdn) return [lugar(l.u), `${orgs} · borde de CDN`];
    return [lugar(l.u), l.u.en_argentina ? orgs : `${l.u.pais_nombre} · ${orgs}`];
  }
  const nombres = g.lugares.map((l) => lugar(l.u));
  const paises = [...new Set(g.lugares.map((l) => l.u.pais_nombre))];
  return [nombres.length > 2 ? `${nombres.slice(0, 2).join(" · ")} y ${nombres.length - 2} más` : nombres.join(" · "), paises.join(" · ")];
}

/**
 * Ubica el rótulo de cada grupo donde no tape otro rótulo ni un servidor: a la derecha, a la
 * izquierda, abajo o arriba. Si no entra con la segunda línea, prueba solo con la primera.
 */
function rotular(grupos: Grupo[], zt: ZoomTransform, libre: { ancho: number; alto: number }, rem: number, tapas: Caja[]) {
  const ocupadas: Caja[] = [...tapas];
  for (const g of grupos) {
    for (const p of g.puntos) {
      const [x, y] = enPantalla(p, zt);
      ocupadas.push({ x0: x - 13, y0: y - 13, x1: x + 13, y1: y + 13 });
    }
  }
  const px = { uno: 0.78125 * rem, dos: 0.65625 * rem };
  const rotulos = new Map<string, Rotulo>();
  for (const g of [...grupos].sort((a, b) => b.puntos.length - a.puntos.length || a.by - b.by)) {
    const [x, y] = enPantalla(g, zt);
    const [t1, t2] = textosGrupo(g);
    const off = g.radio + 17;
    const ancho1 = t1.length * px.uno * 0.58;
    const ancho2 = t2.length * px.dos * 0.54;
    const cerca = x > libre.ancho * 0.7;
    let elegido: { r: Rotulo; c: Caja } | null = null;
    for (const segunda of [true, false]) {
      const w = Math.max(ancho1, segunda ? ancho2 : 0);
      const alto = segunda ? 28 : 15;
      const candidatos: { r: Rotulo; c: Caja }[] = [
        { r: { dx: off, dy: -2, ancla: "start", segunda }, c: { x0: x + off, y0: y - 13, x1: x + off + w, y1: y - 13 + alto } },
        { r: { dx: -off, dy: -2, ancla: "end", segunda }, c: { x0: x - off - w, y0: y - 13, x1: x - off, y1: y - 13 + alto } },
        { r: { dx: 0, dy: off + 9, ancla: "middle", segunda }, c: { x0: x - w / 2, y0: y + off - 2, x1: x + w / 2, y1: y + off - 2 + alto } },
        { r: { dx: 0, dy: -off - (segunda ? 15 : 3), ancla: "middle", segunda }, c: { x0: x - w / 2, y0: y - off - alto, x1: x + w / 2, y1: y - off } },
      ];
      if (cerca) [candidatos[0], candidatos[1]] = [candidatos[1]!, candidatos[0]!];
      elegido =
        candidatos.find(
          ({ c }) => c.x0 >= 4 && c.y0 >= 4 && c.x1 <= libre.ancho - 4 && c.y1 <= libre.alto - 4 && !ocupadas.some((o) => solapan(o, c)),
        ) ?? null;
      if (elegido) break;
    }
    if (!elegido) {
      elegido = cerca
        ? { r: { dx: -off, dy: -2, ancla: "end", segunda: false }, c: { x0: x - off - ancho1, y0: y - 13, x1: x - off, y1: y + 2 } }
        : { r: { dx: off, dy: -2, ancla: "start", segunda: false }, c: { x0: x + off, y0: y - 13, x1: x + off + ancho1, y1: y + 2 } };
    }
    rotulos.set(g.id, elegido.r);
    ocupadas.push(elegido.c);
  }
  return { rotulos, ocupadas };
}

function useTamano<T extends HTMLElement>(): [RefObject<T | null>, { ancho: number; alto: number }] {
  const ref = useRef<T | null>(null);
  const [tam, setTam] = useState({ ancho: 0, alto: 0 });
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const medir = () => {
      const r = el.getBoundingClientRect();
      setTam((t) => (Math.abs(t.ancho - r.width) < 0.5 && Math.abs(t.alto - r.height) < 0.5 ? t : { ancho: r.width, alto: r.height }));
    };
    const ro = new ResizeObserver(medir);
    ro.observe(el);
    medir();
    return () => ro.disconnect();
  }, []);
  return [ref, tam];
}

function sinMovimiento(): boolean {
  return typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
}

// --- consulta de una IP --------------------------------------------------------------------------

interface ConsultaGeo {
  ip: string;
  clase: "publica" | "documentacion" | "reservada" | "invalida";
  ubicacion: UbicacionDTO | null;
  motivo: string | null;
  base: string | null;
}

// --- componente ---------------------------------------------------------------------------------

type Camara = "servidores" | "argentina" | "mundo" | "libre";

export function MapaFiltraciones({
  t: tablero,
  ahora,
  ampliado,
  onAmpliar,
}: {
  t: TableroDTO;
  ahora: number;
  ampliado: boolean;
  onAmpliar: (v: boolean) => void;
}) {
  const navegar = useNavigate();
  const idFlecha = useId().replace(/:/g, "");
  const [refCaja, { ancho, alto }] = useTamano<HTMLDivElement>();
  const refSvg = useRef<SVGSVGElement | null>(null);
  const refZoom = useRef<ZoomBehavior<SVGSVGElement, unknown> | null>(null);
  const [zt, setZt] = useState<ZoomTransform>(zoomIdentity);
  const [camara, setCamara] = useState<Camara>("servidores");
  const [seleccion, setSeleccion] = useState<string | null>(null);
  const [foco, setFoco] = useState<number | null>(null);
  const [sonda, setSonda] = useState<ConsultaGeo | null>(null);
  const refArriba = useRef<HTMLDivElement | null>(null);
  const refPie = useRef<HTMLDivElement | null>(null);
  const tapas = useTapas(refCaja, [refArriba, refPie]);

  const rem = useMemo(() => (typeof window === "undefined" ? 16 : parseFloat(getComputedStyle(document.documentElement).fontSize) || 16), [ancho]);
  const anchoRutas = Math.min(ANCHO_RUTAS_REM * rem, ancho * 0.42);
  const libre = Math.max(80, ancho - anchoRutas - 12);
  const finalizado = tablero.estado.finalizado;
  const expedientes = tablero.expedientes;
  const proveedores = tablero.proveedores.length;

  // El mundo entero entra, sin zoom, en lo que queda libre a la izquierda de las rutas.
  const proy = useMemo(() => {
    const p = geoNaturalEarth1().precision(0.3);
    if (ancho > 0 && alto > 0) {
      p.fitExtent(
        [
          [12, 12],
          [libre - 12, alto - 12],
        ],
        ESFERA,
      );
    }
    return p;
  }, [ancho, alto, libre]);
  const proyectar = useCallback<Proyectar>((ll) => proy(ll) as [number, number] | null, [proy]);

  const camino = useMemo(() => geoPath(proy), [proy]);
  const paisesConServidores = useMemo(() => {
    const isos = new Set<string>();
    for (const e of expedientes) for (const s of e.servidores) if (s.ubicacion && !s.intermediario) isos.add(s.ubicacion.pais);
    if (sonda?.ubicacion) isos.add(sonda.ubicacion.pais);
    return isos;
  }, [expedientes, sonda]);
  const base = useMemo(
    () => ({
      esfera: camino(ESFERA) ?? "",
      reticula: camino(RETICULA) ?? "",
      resto: RESTO.map((f) => ({ id: String(f.id), iso: f.properties.iso, d: camino(f as Feature) ?? "" })),
      argentina: ARGENTINA.map((f) => ({ id: String(f.id), d: camino(f as Feature) ?? "" })),
      cajaAR: (() => {
        const [[x0, y0], [x1, y1]] = camino.bounds(ENCUADRE_AR);
        return { x0, y0, x1, y1 };
      })(),
      ciudades: CIUDADES.map((c) => {
        const xy = proyectar([c.lon, c.lat]);
        return xy ? { ...c, bx: xy[0], by: xy[1] } : null;
      }).filter((c): c is NonNullable<typeof c> => c !== null),
    }),
    [camino, proyectar],
  );
  const kArgentina = useMemo(() => encuadre(base.cajaAR, libre, alto, 20, ZOOM_MAX).k, [base.cajaAR, libre, alto]);

  const { lugares, sinUbicar } = useMemo(() => lugaresDe(expedientes, proyectar), [expedientes, proyectar]);
  const grupos = useMemo(() => agrupar(lugares, zt.k), [lugares, zt.k]);
  const puntos = useMemo(() => {
    const m = new Map<number, Punto>();
    for (const g of grupos) for (const p of g.puntos) m.set(p.s.id, p);
    return m;
  }, [grupos]);
  const puntoSonda = useMemo(() => {
    const u = sonda?.ubicacion;
    const xy = u ? proyectar([u.lon, u.lat]) : null;
    return xy ? { bx: xy[0], by: xy[1] } : null;
  }, [sonda, proyectar]);

  // Zoom y arrastre. Si la persona mueve el mapa, la cámara deja de seguir a los servidores.
  useEffect(() => {
    const svg = refSvg.current;
    if (!svg) return;
    const z = d3zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.9, ZOOM_MAX])
      .on("zoom", (ev: { transform: ZoomTransform; sourceEvent: unknown }) => {
        setZt(ev.transform);
        if (ev.sourceEvent) setCamara("libre");
      });
    refZoom.current = z;
    select(svg).call(z).on("dblclick.zoom", null);
    return () => {
      select(svg).on(".zoom", null);
    };
  }, []);

  useEffect(() => {
    const z = refZoom.current;
    if (!z || ancho === 0) return;
    z.extent([
      [0, 0],
      [libre, alto],
    ]).translateExtent([
      [-libre * 0.4, -alto * 0.4],
      [libre * 1.4, alto * 1.4],
    ]);
  }, [libre, alto, ancho]);

  // Adónde mira cada cámara. «Servidores» encuadra Argentina y todo lo ubicado, y los sigue.
  const destino = useMemo((): ZoomTransform | null => {
    if (ancho === 0 || camara === "libre") return null;
    if (camara === "mundo") return zoomIdentity;
    if (camara === "argentina") return encuadre(base.cajaAR, libre, alto, 20, ZOOM_MAX);
    const caja = { ...base.cajaAR };
    const sumar = (x: number, y: number) => {
      caja.x0 = Math.min(caja.x0, x);
      caja.y0 = Math.min(caja.y0, y);
      caja.x1 = Math.max(caja.x1, x);
      caja.y1 = Math.max(caja.y1, y);
    };
    for (const l of lugares) sumar(l.bx, l.by);
    if (puntoSonda) sumar(puntoSonda.bx, puntoSonda.by);
    const fuera = caja.x1 - caja.x0 > (base.cajaAR.x1 - base.cajaAR.x0) * 1.05 || caja.y1 - caja.y0 > (base.cajaAR.y1 - base.cajaAR.y0) * 1.05;
    if (!fuera) return encuadre(caja, libre, alto, 20, ZOOM_MAX);
    const arriba = Math.max(70, ...tapas.filter((t) => t.y0 < alto / 2).map((t) => Math.min(t.y1, alto * 0.3)));
    const abajo = Math.max(40, ...tapas.filter((t) => t.y0 >= alto / 2).map((t) => Math.min(alto - t.y0, alto * 0.3)));
    return encuadre(caja, libre, alto, { arriba: arriba + 24, abajo: abajo + 24, lados: 90 }, ZOOM_MAX);
  }, [camara, base.cajaAR, lugares, puntoSonda, libre, alto, ancho, tapas]);

  const llevarA = useCallback((t: ZoomTransform, ms: number) => {
    const svg = refSvg.current;
    const z = refZoom.current;
    if (!svg || !z) return;
    const sel = select(svg);
    if (ms === 0 || sinMovimiento()) sel.interrupt().call(z.transform, t);
    else sel.transition().duration(ms).call(z.transform, t);
  }, []);

  const primerEncuadre = useRef(true);
  const claveDestino = destino ? `${destino.x.toFixed(0)},${destino.y.toFixed(0)},${destino.k.toFixed(3)}` : "";
  useEffect(() => {
    if (!destino) return;
    llevarA(destino, primerEncuadre.current ? 0 : 750);
    primerEncuadre.current = false;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [claveDestino]);

  const elegir = useCallback(
    (id: string | null, acercar = false) => {
      setSeleccion(id);
      if (!acercar || id == null) return;
      const e = expedientes.find((x) => x.id === id);
      const ps = e ? e.servidores.map((s) => puntos.get(s.id)).filter((p): p is Punto => !!p) : [];
      if (ps.length === 0) return;
      const caja = { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity };
      for (const p of ps) {
        const l = lugares.find((x) => x.puntos.some((q) => q.s.id === p.s.id));
        const bx = l?.bx ?? p.bx;
        const by = l?.by ?? p.by;
        caja.x0 = Math.min(caja.x0, bx);
        caja.y0 = Math.min(caja.y0, by);
        caja.x1 = Math.max(caja.x1, bx);
        caja.y1 = Math.max(caja.y1, by);
      }
      setCamara("libre");
      llevarA(encuadre(caja, libre, alto, 110, Math.max(kArgentina * 1.6, 4)), 750);
    },
    [expedientes, puntos, lugares, libre, alto, kArgentina, llevarA],
  );

  useEffect(() => {
    const alTeclear = (ev: KeyboardEvent) => {
      if (ev.key !== "Escape") return;
      if ((ev.target as HTMLElement | null)?.tagName === "INPUT") return;
      setSeleccion((s) => {
        if (s == null && ampliado) onAmpliar(false);
        return null;
      });
    };
    window.addEventListener("keydown", alTeclear);
    return () => window.removeEventListener("keydown", alTeclear);
  }, [ampliado, onAmpliar]);

  // Lo que ya estaba al abrir el mapa no se anima; lo nuevo, sí. Cada clave guarda cuándo apareció
  // y queda marcada como nueva un rato, para que la animación no se corte si llega otro dato.
  const vistos = useRef<Map<string, number> | null>(null);
  const ahoraMs = performance.now();
  {
    const claves: string[] = [];
    for (const e of expedientes) {
      claves.push(`e${e.id}`);
      for (const s of e.servidores) claves.push(`s${s.id}`);
    }
    if (vistos.current == null) vistos.current = new Map(claves.map((c) => [c, -Infinity]));
    else for (const c of claves) if (!vistos.current.has(c)) vistos.current.set(c, ahoraMs);
  }
  const nuevos = { has: (c: string) => ahoraMs - (vistos.current?.get(c) ?? -Infinity) < 1800 };

  // Escala gráfica medida en el centro de la vista: en un mapa del mundo cambia con la latitud.
  const regla = (() => {
    const cx = (libre / 2 - zt.x) / zt.k;
    const cy = (alto / 2 - zt.y) / zt.k;
    const a = proy.invert?.([cx - 50 / zt.k, cy]);
    const b = proy.invert?.([cx + 50 / zt.k, cy]);
    if (!a || !b || !Number.isFinite(a[0]) || !Number.isFinite(b[0])) return null;
    const km = (geoDistance(a, b) * RADIO_TIERRA_KM) / 100;
    return km > 0 ? escalaGrafica(km) : null;
  })();

  const rutas = expedientes.map((e) => {
    const orden = [...e.servidores].sort((a, b) => a.primera_deteccion_min - b.primera_deteccion_min || a.id - b.id);
    const saltos = [];
    for (let i = 1; i < orden.length; i++) {
      const pa = puntos.get(orden[i - 1]!.id);
      const pb = puntos.get(orden[i]!.id);
      if (!pa || !pb) continue;
      saltos.push({ clave: `${orden[i - 1]!.id}-${orden[i]!.id}`, hasta: orden[i]!, ...curva(enPantalla(pa, zt), enPantalla(pb, zt)) });
    }
    return { e, saltos };
  });

  const puntoFoco = foco != null ? puntos.get(foco) : undefined;
  const { rotulos, ocupadas } = rotular(grupos, zt, { ancho: libre, alto }, rem, tapas);
  const totalUbicados = puntos.size;
  const verCiudades = zt.k >= kArgentina * 0.55;

  return (
    <div className="mp" ref={refCaja}>
      <svg
        ref={refSvg}
        className="mp-lienzo"
        width={ancho}
        height={alto}
        role="img"
        aria-label={`Mapa del mundo con ${plural(totalUbicados, "servidor pirata ubicado", "servidores piratas ubicados")} y los saltos de cada filtración`}
        onClick={(ev) => {
          if (ev.target === ev.currentTarget || (ev.target as Element).classList?.contains("mp-fondo")) setSeleccion(null);
        }}
      >
        <defs>
          <marker id={`${idFlecha}-f`} viewBox="0 0 10 10" refX="7.5" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse" markerUnits="userSpaceOnUse">
            <path d="M1,1.2 L8.6,5 L1,8.8 L3,5 Z" className="mp-flecha" />
          </marker>
        </defs>

        <g transform={zt.toString()} className="mp-base">
          <path d={base.esfera} className="mp-mar mp-fondo" />
          <path d={base.reticula} className="mp-reticula" />
          {base.resto.map((p) => (
            <path key={p.id} d={p.d} className="mp-vecino" data-anfitrion={p.iso && paisesConServidores.has(p.iso) ? "" : undefined} />
          ))}
          {base.argentina.map((p) => (
            <path key={p.id} d={p.d} className="mp-argentina" />
          ))}
        </g>

        {verCiudades && (
          <g className="mp-ciudades" aria-hidden="true">
            {(() => {
              const tomadas = [...ocupadas];
              const px = 0.6875 * rem;
              return [...base.ciudades]
                .sort((a, b) => a.rango - b.rango)
                .map((c) => {
                  const [x, y] = enPantalla(c, zt);
                  if (x < -40 || y < -20 || x > libre || y > alto + 20) return null;
                  const punto: Caja = { x0: x - 3, y0: y - 3, x1: x + 3, y1: y + 3 };
                  if (tomadas.some((o) => solapan(o, punto))) return null;
                  const conNombre = c.rango === 1 ? zt.k >= kArgentina * 0.85 : zt.k >= kArgentina * 1.9;
                  const caja: Caja = { x0: x - 3, y0: y - 7, x1: x + 6 + c.nombre.length * px * 0.55, y1: y + 6 };
                  const conRotulo = conNombre && caja.x1 < libre - 4 && !tomadas.some((o) => solapan(o, caja));
                  tomadas.push(conRotulo ? caja : punto);
                  return (
                    <g key={c.nombre} transform={`translate(${x.toFixed(1)},${y.toFixed(1)})`}>
                      <circle r={1.9} className="mp-ciudad" />
                      {conRotulo && (
                        <text x={5} y={3.5} className="mp-ciudad-rotulo">
                          {c.nombre}
                        </text>
                      )}
                    </g>
                  );
                });
            })()}
          </g>
        )}

        <g className="mp-rutas">
          {rutas.map(({ e, saltos }) => {
            const atenuada = seleccion != null && seleccion !== e.id;
            const elegida = seleccion === e.id;
            return (
              <g key={e.id} data-atenuada={atenuada ? "" : undefined} data-elegida={elegida ? "" : undefined}>
                {saltos.map((s) => (
                  <g key={s.clave}>
                    <path d={s.d} pathLength={1} className="mp-salto" data-nuevo={nuevos.has(`s${s.hasta.id}`) ? "" : undefined} markerEnd={`url(#${idFlecha}-f)`} />
                    {elegida && (
                      <g transform={`translate(${s.medio[0].toFixed(1)},${s.medio[1].toFixed(1)})`} className="mp-salto-rotulo">
                        <rect x={-19} y={-8.5} width={38} height={17} rx={8.5} />
                        <text y={3.6} textAnchor="middle" className="num">
                          {minutoEntero(s.hasta.primera_deteccion_min)}′
                        </text>
                      </g>
                    )}
                  </g>
                ))}
              </g>
            );
          })}
        </g>

        <g className="mp-sitios">
          {grupos.map((g) => {
            const [x, y] = enPantalla(g, zt);
            const r = rotulos.get(g.id) ?? { dx: g.radio + 17, dy: -2, ancla: "start" as const, segunda: true };
            const [t1, t2] = textosGrupo(g);
            const atenuado = seleccion != null && !g.puntos.some((p) => p.e.id === seleccion);
            return (
              <g key={g.id} transform={`translate(${x.toFixed(1)},${y.toFixed(1)})`} className="mp-sitio" data-atenuado={atenuado ? "" : undefined}>
                {g.puntos.length > 1 && (
                  <>
                    <circle r={g.radio} className="mp-sitio-orbita" />
                    {g.puntos.map((p) => (
                      <line key={p.s.id} x1={0} y1={0} x2={p.dx * 0.62} y2={p.dy * 0.62} className="mp-sitio-radio" />
                    ))}
                  </>
                )}
                <rect x={-2.6} y={-2.6} width={5.2} height={5.2} className="mp-sitio-nodo" transform="rotate(45)" />
                <text x={r.dx} y={r.dy} textAnchor={r.ancla} className="mp-sitio-ciudad">
                  {t1}
                </text>
                {r.segunda && (
                  <text x={r.dx} y={r.dy + 13} textAnchor={r.ancla} className="mp-sitio-org">
                    {t2}
                  </text>
                )}
              </g>
            );
          })}
        </g>

        <g className="mp-servidores">
          {grupos.flatMap((g) =>
            g.puntos.map((p) => {
              const [x, y] = enPantalla(p, zt);
              const cobertura = finalizado ? p.s.cobertura_max_pct : p.s.cobertura_pct;
              const compartida = p.s.terceros.length > 0 || p.s.intermediario != null;
              const elegido = seleccion === p.e.id;
              const atenuado = seleccion != null && !elegido;
              const abrirOElegir = () => (seleccion === p.e.id ? navegar(`/expediente/${encodeURIComponent(p.e.id)}`) : elegir(p.e.id));
              return (
                <g
                  key={p.s.id}
                  className="mp-servidor"
                  transform={`translate(${x.toFixed(1)},${y.toFixed(1)})`}
                  data-estado={p.estado}
                  data-elegido={elegido ? "" : undefined}
                  data-atenuado={atenuado ? "" : undefined}
                  data-foco={foco === p.s.id ? "" : undefined}
                  data-nuevo={nuevos.has(`s${p.s.id}`) ? "" : undefined}
                  role="button"
                  tabIndex={0}
                  aria-label={`${p.s.host}, ${lugar(p.u)}, ${p.u.pais_nombre}. ${ROTULO_ESTADO[p.estado]}. Expediente ${p.e.id}.`}
                  onPointerEnter={() => setFoco(p.s.id)}
                  onPointerLeave={() => setFoco((f) => (f === p.s.id ? null : f))}
                  onFocus={() => setFoco(p.s.id)}
                  onBlur={() => setFoco((f) => (f === p.s.id ? null : f))}
                  onClick={(ev) => {
                    ev.stopPropagation();
                    abrirOElegir();
                  }}
                  onKeyDown={(ev) => {
                    if (ev.key === "Enter" || ev.key === " ") {
                      ev.preventDefault();
                      abrirOElegir();
                    }
                  }}
                >
                  <circle r={16} className="mp-blanco" />
                  <circle r={15.5} className="mp-seleccion" />
                  {p.estado === "espera" && <circle r={9} className="mp-pulso" />}
                  {compartida && <circle r={12.75} className="mp-halo" />}
                  <circle r={9.5} className="mp-pista" />
                  {cobertura > 0 && (
                    <circle
                      r={9.5}
                      className="mp-cobertura"
                      pathLength={100}
                      strokeDasharray={`${Math.max(2, Math.min(100, cobertura)).toFixed(1)} 100`}
                      transform="rotate(-90)"
                    />
                  )}
                  <circle r={4.6} className="mp-nucleo" />
                  {p.estado === "rechazado" && <line x1={-3.4} y1={3.4} x2={3.4} y2={-3.4} className="mp-tachado" />}
                </g>
              );
            }),
          )}
        </g>

        {puntoSonda && sonda && (
          <g className="mp-sonda" transform={`translate(${enPantalla(puntoSonda, zt).map((v) => v.toFixed(1)).join(",")})`} aria-hidden="true">
            <circle r={11} className="mp-sonda-aro" />
            <path d="M-15,0H-6M6,0H15M0,-15V-6M0,6V15" className="mp-sonda-cruz" />
            <circle r={2.6} className="mp-sonda-centro" />
            <text x={18} y={-6} className="mp-sitio-ciudad">
              {sonda.ip}
            </text>
          </g>
        )}
      </svg>

      {puntoFoco && <Ficha p={puntoFoco} zt={zt} ancho={libre} alto={alto} finalizado={finalizado} proveedores={proveedores} />}

      <div className="mp-arriba" ref={refArriba}>
        <div className="mp-controles" role="group" aria-label="Vista del mapa">
          <button type="button" className="mp-boton" aria-label="Acercar" onClick={() => refSvg.current && refZoom.current && select(refSvg.current).transition().duration(260).call(refZoom.current.scaleBy, 1.6)}>
            <svg viewBox="0 0 16 16" aria-hidden="true">
              <path d="M8 3.5v9M3.5 8h9" />
            </svg>
          </button>
          <button type="button" className="mp-boton" aria-label="Alejar" onClick={() => refSvg.current && refZoom.current && select(refSvg.current).transition().duration(260).call(refZoom.current.scaleBy, 1 / 1.6)}>
            <svg viewBox="0 0 16 16" aria-hidden="true">
              <path d="M3.5 8h9" />
            </svg>
          </button>
          <span className="mp-controles-sep" aria-hidden="true" />
          {(
            [
              ["servidores", "Servidores", "Encuadra Argentina y todos los servidores, y los sigue cuando aparecen nuevos"],
              ["argentina", "Argentina", "Encuadra Argentina"],
              ["mundo", "Mundo", "Muestra el mundo entero"],
            ] as const
          ).map(([c, rotulo, titulo]) => (
            <button key={c} type="button" className="mp-boton mp-boton-texto" aria-pressed={camara === c} title={titulo} onClick={() => setCamara(c)}>
              {rotulo}
            </button>
          ))}
          <span className="mp-controles-sep" aria-hidden="true" />
          <button
            type="button"
            className="mp-boton"
            aria-label={ampliado ? "Achicar el mapa" : "Ampliar el mapa"}
            aria-pressed={ampliado}
            title={ampliado ? "Achicar (Esc)" : "Ampliar"}
            onClick={() => onAmpliar(!ampliado)}
          >
            <svg viewBox="0 0 16 16" aria-hidden="true">
              {ampliado ? <path d="M6.5 2.5v4h-4M9.5 13.5v-4h4M6.5 6.5 2.5 2.5M9.5 9.5l4 4" /> : <path d="M2.5 6.5v-4h4M13.5 9.5v4h-4M2.5 2.5l4 4M13.5 13.5l-4-4" />}
            </svg>
          </button>
          {ampliado && (
            <span className="mp-reloj num" aria-label={`Minuto ${reloj(ahora)}`}>
              {reloj(ahora)}
            </span>
          )}
        </div>
        <Consulta
          sonda={sonda}
          onResultado={(r) => {
            setSonda(r);
            if (r?.ubicacion) setCamara("servidores");
          }}
        />
      </div>

      <div className="mp-pie" ref={refPie}>
        <ul className="mp-leyenda" aria-label="Qué muestra el mapa">
          <li>
            <span className="mp-ley-luz" data-estado="bloqueado" aria-hidden="true" /> Bloqueado
          </li>
          <li>
            <span className="mp-ley-luz" data-estado="en_curso" aria-hidden="true" /> Espera firma o en curso
          </li>
          <li>
            <span className="mp-ley-luz" data-estado="fallo" aria-hidden="true" /> Falló
          </li>
          <li>
            <span className="mp-ley-luz" data-estado="vencido" aria-hidden="true" /> Venció
          </li>
          <li>
            <span className="mp-leyenda-anillo" aria-hidden="true" /> Clientes con el bloqueo
          </li>
          <li>
            <span className="mp-leyenda-halo" aria-hidden="true" /> IP compartida o CDN: solo dominio
          </li>
        </ul>
        {regla && (
          <div className="mp-regla" aria-hidden="true">
            <span className="mp-regla-barra" style={{ width: `${regla.px.toFixed(1)}px` }} />
            <span className="num">{numero(regla.km)} km</span>
          </div>
        )}
      </div>

      <Rutas
        expedientes={expedientes}
        seleccion={seleccion}
        foco={foco}
        nuevos={nuevos}
        finalizado={finalizado}
        proveedores={proveedores}
        sinUbicar={sinUbicar}
        geo={tablero.geo}
        onElegir={(id) => elegir(seleccion === id ? null : id, seleccion !== id)}
        onFoco={setFoco}
        onAbrir={(id) => navegar(`/expediente/${encodeURIComponent(id)}`)}
      />
    </div>
  );
}

// --- consulta manual de una IP -------------------------------------------------------------------

function Consulta({ sonda, onResultado }: { sonda: ConsultaGeo | null; onResultado: (r: ConsultaGeo | null) => void }) {
  const [texto, setTexto] = useState("");
  const [buscando, setBuscando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const buscar = async (ev: FormEvent) => {
    ev.preventDefault();
    const ip = texto.trim();
    if (!ip) return;
    setBuscando(true);
    setError(null);
    try {
      onResultado(await pedir<ConsultaGeo>(`/api/geo?ip=${encodeURIComponent(ip)}`));
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo consultar.");
    } finally {
      setBuscando(false);
    }
  };

  const u = sonda?.ubicacion;
  const quitar = () => {
    setTexto("");
    setError(null);
    onResultado(null);
  };
  return (
    <div className="mp-consulta-caja">
      <form className="mp-consulta" onSubmit={(ev) => void buscar(ev)} role="search" aria-label="Ubicar una IP">
        <svg viewBox="0 0 16 16" aria-hidden="true">
          <circle cx="7" cy="7" r="4.25" />
          <path d="m10.25 10.25 3 3" />
        </svg>
        <input
          type="text"
          autoComplete="off"
          spellCheck={false}
          placeholder="Ubicar una IP real"
          aria-label="IP a ubicar"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape") quitar();
          }}
        />
        {(sonda || error) && (
          <button type="button" className="mp-boton" aria-label="Quitar la IP consultada" onClick={quitar}>
            <svg viewBox="0 0 16 16" aria-hidden="true">
              <path d="M4.5 4.5l7 7M11.5 4.5l-7 7" />
            </svg>
          </button>
        )}
        <button type="submit" className="mp-boton mp-boton-texto" disabled={buscando || texto.trim() === ""}>
          {buscando ? "…" : "Ubicar"}
        </button>
      </form>
      {(sonda || error) && (
        <div className="mp-consulta-resultado" role="status">
          {error ? (
            <p>{error}</p>
          ) : sonda && u ? (
            <>
              <p className="mp-consulta-lugar">
                {[u.ciudad, u.pais_nombre].filter(Boolean).join(", ")}
                <small>{u.fuente === "simulada" ? "simulada" : u.precision_km ? `±${numero(u.precision_km)} km` : "GeoIP"}</small>
              </p>
              <p className="mp-consulta-nota">
                {u.fuente === "simulada"
                  ? "IP de documentación, como las del simulador."
                  : u.en_argentina
                    ? "En Argentina: además del bloqueo, se puede pedir la baja al hosting."
                    : "En el exterior: se bloquea igual en los proveedores argentinos."}
              </p>
            </>
          ) : sonda ? (
            <p className="mp-consulta-nota">{sonda.motivo}</p>
          ) : null}
        </div>
      )}
    </div>
  );
}

// --- ficha flotante -----------------------------------------------------------------------------

function Ficha({ p, zt, ancho, alto, finalizado, proveedores }: { p: Punto; zt: ZoomTransform; ancho: number; alto: number; finalizado: boolean; proveedores: number }) {
  const [x, y] = enPantalla(p, zt);
  const izquierda = x > ancho * 0.58;
  const s = p.s;
  const u = p.u;
  // Se mide al dibujarse y se corre en vertical para no salirse del mapa.
  const ref = useRef<HTMLDivElement | null>(null);
  const [alturaFicha, setAlturaFicha] = useState(0);
  useLayoutEffect(() => {
    const h = ref.current?.offsetHeight ?? 0;
    if (Math.abs(h - alturaFicha) > 1) setAlturaFicha(h);
  });
  const top = Math.max(8, Math.min(y - 24, alto - alturaFicha - 8));
  const cobertura = finalizado ? s.cobertura_max_pct : s.cobertura_pct;
  const org = s.organizacion ? sinFicticio(s.organizacion) : null;
  const orden = [...p.e.servidores].sort((a, b) => a.primera_deteccion_min - b.primera_deteccion_min);
  return (
    <div
      ref={ref}
      className="mp-ficha"
      role="tooltip"
      data-estado={p.estado}
      style={{
        left: `${x}px`,
        top: `${top}px`,
        transform: `translateX(${izquierda ? "calc(-100% - 22px)" : "22px"})`,
        visibility: alturaFicha === 0 ? "hidden" : undefined,
      }}
    >
      <p className="mp-ficha-host">{s.host}</p>
      <p className="mp-ficha-red">
        <span className="num">{s.ip}</span>
        {s.asn != null && <span className="num"> · AS{s.asn}</span>}
        {org && <span> · {org}</span>}
      </p>
      <p className="mp-ficha-lugar">
        {[u.ciudad, u.en_argentina ? u.provincia : null, u.pais_nombre].filter(Boolean).join(", ")}
        <small>{u.fuente === "simulada" ? "simulada" : u.precision_km ? `GeoIP ±${numero(u.precision_km)} km` : "GeoIP"}</small>
      </p>
      <p className="mp-ficha-jurisdiccion" data-exterior={!u.en_argentina && !s.intermediario ? "" : undefined} data-cdn={s.intermediario ? "" : undefined}>
        {jurisdiccion(u, s.intermediario)}
      </p>
      <dl className="mp-ficha-datos">
        <div>
          <dt>Estado</dt>
          <dd data-estado={p.estado}>
            {ROTULO_ESTADO[p.estado]}
            {(p.estado === "bloqueado" || p.estado === "en_curso") && (
              <span className="num">
                {" "}
                · {aplicadas(s)} de {proveedores}
              </span>
            )}
          </dd>
        </div>
        <div>
          <dt>{finalizado ? "Clientes cubiertos (máx.)" : "Clientes cubiertos"}</dt>
          <dd className="num">{porcentaje(cobertura)} %</dd>
        </div>
        <div>
          <dt>Detectado</dt>
          <dd className="num">min {minutoEntero(s.primera_deteccion_min)}</dd>
        </div>
        <div>
          <dt>Primer bloqueo</dt>
          <dd className="num">{s.primer_bloqueo_min == null ? "—" : `+${numero(s.primer_bloqueo_min, 1)} min`}</dd>
        </div>
      </dl>
      {s.intermediario ? (
        <p className="mp-ficha-terceros">{s.intermediario}</p>
      ) : (
        s.terceros.length > 0 && (
          <p className="mp-ficha-terceros">IP compartida con {plural(s.terceros.length, "sitio legítimo", "sitios legítimos")}: se bloquea solo el dominio.</p>
        )
      )}
      <p className="mp-ficha-exp">
        {p.e.id} · {orden.length > 1 ? `salto ${orden.findIndex((x) => x.id === s.id) + 1} de ${orden.length}` : "servidor único"}
      </p>
    </div>
  );
}

// --- rutas por expediente -----------------------------------------------------------------------

function paisesDeRuta(servidores: ServidorDTO[]): string {
  const paises: string[] = [];
  for (const s of servidores) {
    const p = !s.ubicacion ? "sin ubicar" : s.intermediario ? "CDN" : s.ubicacion.pais_nombre;
    if (paises[paises.length - 1] !== p) paises.push(p);
  }
  return paises.join(" → ");
}

function Rutas({
  expedientes,
  seleccion,
  foco,
  nuevos,
  finalizado,
  proveedores,
  sinUbicar,
  geo,
  onElegir,
  onFoco,
  onAbrir,
}: {
  expedientes: ExpedienteResumenDTO[];
  seleccion: string | null;
  foco: number | null;
  nuevos: { has: (clave: string) => boolean };
  finalizado: boolean;
  proveedores: number;
  sinUbicar: number;
  geo: TableroDTO["geo"];
  onElegir: (id: string) => void;
  onFoco: (id: number | null) => void;
  onAbrir: (id: string) => void;
}) {
  const lista = useRef<HTMLOListElement | null>(null);
  useEffect(() => {
    if (!seleccion || !lista.current) return;
    const el = lista.current.querySelector<HTMLElement>(`[data-exp="${CSS.escape(seleccion)}"]`);
    el?.scrollIntoView({ block: "nearest", behavior: sinMovimiento() ? "auto" : "smooth" });
  }, [seleccion]);

  const ordenados = [...expedientes].sort((a, b) => a.abierto_min - b.abierto_min);
  return (
    <aside className="mp-rutas-tarjeta" aria-label="Rutas de cada filtración">
      <header className="mp-rutas-cabeza">
        <p className="mp-rutas-titulo">Ruta de cada filtración</p>
        <p className="mp-rutas-sub">Un expediente por marca de agua; cada salto, una ampliación, esté donde esté el servidor.</p>
      </header>
      {ordenados.length === 0 ? (
        <p className="mp-rutas-vacio">Sin filtraciones todavía. Cada servidor aparece en su ciudad, en cualquier país, apenas se detecta.</p>
      ) : (
        <ol className="mp-rutas-lista" ref={lista}>
          {ordenados.map((e) => {
            const servidores = [...e.servidores].sort((a, b) => a.primera_deteccion_min - b.primera_deteccion_min || a.id - b.id);
            const elegida = seleccion === e.id;
            return (
              <li
                key={e.id}
                data-exp={e.id}
                className="mp-ruta"
                data-elegida={elegida ? "" : undefined}
                data-atenuada={seleccion != null && !elegida ? "" : undefined}
                data-nuevo={nuevos.has(`e${e.id}`) ? "" : undefined}
              >
                <button type="button" className="mp-ruta-cabeza" aria-pressed={elegida} onClick={() => onElegir(e.id)}>
                  <span className="mp-ruta-id num">{e.id.replace(/^EXP-\d{4}-/, "EXP-")}</span>
                  <span className="mp-ruta-estado" data-estado={e.estado}>
                    {ESTADO_EXPEDIENTE[e.estado]}
                  </span>
                  <span className="mp-ruta-marca">{e.marca}</span>
                  <span className="mp-ruta-paises">{paisesDeRuta(servidores)}</span>
                </button>
                <ol className="mp-saltos">
                  {servidores.map((s, i) => {
                    const estado = estadoDe(s);
                    const u = s.ubicacion;
                    return (
                      <li key={s.id} className="mp-paso" data-foco={foco === s.id ? "" : undefined} onPointerEnter={() => onFoco(s.id)} onPointerLeave={() => onFoco(null)}>
                        <span className="mp-paso-n num" aria-hidden="true">
                          {i + 1}
                        </span>
                        <span className="mp-paso-min num">{minutoEntero(s.primera_deteccion_min)}′</span>
                        <span className="mp-paso-host" title={`${s.host} · ${s.ip}`}>
                          {s.host}
                        </span>
                        <span className="mp-paso-ciudad" data-sin-ubicar={u ? undefined : ""}>
                          {u ? lugar(u) : "Sin ubicar"}
                          {u && (s.intermediario ? <abbr title={s.intermediario}>CDN</abbr> : !u.en_argentina && <abbr title={u.pais_nombre}>{u.pais}</abbr>)}
                        </span>
                        <span className="mp-paso-luz" data-estado={estado} title={`${ROTULO_ESTADO[estado]}${estado === "bloqueado" ? `: ${aplicadas(s)} de ${proveedores} proveedores` : ""}`}>
                          <span className="sr-only">{ROTULO_ESTADO[estado]}</span>
                        </span>
                      </li>
                    );
                  })}
                </ol>
                {elegida && (
                  <button type="button" className="mp-ruta-abrir" onClick={() => onAbrir(e.id)}>
                    Abrir expediente
                    <svg viewBox="0 0 16 16" aria-hidden="true">
                      <path d="M6 3.5 10.5 8 6 12.5" />
                    </svg>
                  </button>
                )}
              </li>
            );
          })}
        </ol>
      )}
      <footer className="mp-rutas-pie">
        {finalizado && <p>Partido terminado: las órdenes vencieron. Los anillos muestran la cobertura máxima.</p>}
        {sinUbicar > 0 && <p>{plural(sinUbicar, "servidor sin ubicación", "servidores sin ubicación")}: IP privada o que la base GeoIP no conoce. Se bloquean igual.</p>}
        <p>
          {geo.base ? (
            <>
              IPs públicas: base {geo.base}
              {geo.atribucion && (
                <>
                  {" "}
                  ·{" "}
                  <a href="https://db-ip.com" target="_blank" rel="noopener noreferrer">
                    {geo.atribucion}
                  </a>
                </>
              )}
              .{" "}
            </>
          ) : (
            "Sin base GeoIP: las IPs públicas quedan sin ubicación (pnpm geoip). "
          )}
          Las del simulador son de documentación (RFC 5737): su ubicación es simulada. Nada de esto entra en lo que firma el juez.
        </p>
      </footer>
    </aside>
  );
}

export default MapaFiltraciones;
