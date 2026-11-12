// Mapa de filtraciones: dónde está cada servidor y por dónde saltó cada filtración.
//
// Cartografía propia (Natural Earth, empaquetada con la app): no usa tiles ni internet, así que
// funciona igual en la red del partido final. Las ubicaciones son simuladas porque las IPs del
// desafío son de documentación (ver src/server/geo.ts); el mapa lo dice en pantalla.
//
// Lenguaje visual: el mapa es grafito sobre porcelana. Verde, ámbar y rojo aparecen solo en los
// servidores, con el mismo significado que en los carriles. El anillo de cada servidor es la
// proporción de clientes del país que ya no lo pueden ver.

import type { Feature, FeatureCollection, Geometry } from "geojson";
import { geoGraticule10, geoOrthographic, geoPath, type GeoProjection } from "d3-geo";
import { select } from "d3-selection";
import "d3-transition";
import { type ZoomBehavior, type ZoomTransform, zoom as d3zoom, zoomIdentity } from "d3-zoom";
import { type RefObject, useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { ExpedienteResumenDTO, ServidorDTO, TableroDTO } from "../../compartido/tipos.ts";
import { ESTADO_EXPEDIENTE, minutoEntero, numero, plural, porcentaje, reloj } from "../nucleo/formato.ts";
import datos from "./sudamerica.json";

type PropsPais = { nombre: string; argentina: boolean };
const PAISES = (datos as unknown as FeatureCollection<Geometry, PropsPais>).features;
const ARGENTINA = PAISES.filter((f) => f.properties.argentina);
const VECINOS = PAISES.filter((f) => !f.properties.argentina);
/** Lo que se encuadra al abrir: el continente y las Malvinas (las Georgias del Sur quedan al este). */
const ENCUADRE: FeatureCollection = { type: "FeatureCollection", features: ARGENTINA.filter((f) => f.id !== "239") };
const RETICULA = geoGraticule10();

/** Ciudades de referencia. `rango` 1 se rotula siempre; 2, solo de cerca. */
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
const ZOOM_MAX = 14;
const ANCHO_RUTAS_REM = 21;

// --- estado de cada servidor ----------------------------------------------------------------------

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

function aplicadas(s: ServidorDTO): number {
  return s.por_proveedor.filter((c) => c.estado === "aplicada").length;
}

// --- geometría en pantalla ------------------------------------------------------------------------

interface Punto {
  s: ServidorDTO;
  e: ExpedienteResumenDTO;
  estado: EstadoPunto;
  /** Posición del centro de datos, proyectada y sin zoom. */
  bx: number;
  by: number;
  /** Desplazamiento en pantalla dentro del grupo del centro de datos (no escala con el zoom). */
  dx: number;
  dy: number;
}

interface Sitio {
  id: string;
  ciudad: string;
  provincia: string;
  organizaciones: string[];
  bx: number;
  by: number;
  radio: number;
  puntos: Punto[];
}

const PASO_GRUPO_PX = 32;
const RADIO_GRUPO_MIN_PX = 22;

function agrupar(expedientes: ExpedienteResumenDTO[], proy: GeoProjection): Sitio[] {
  const porSitio = new Map<string, Sitio>();
  for (const e of expedientes) {
    for (const s of e.servidores) {
      const u = s.ubicacion;
      const xy = proy([u.lon, u.lat]);
      if (!xy) continue;
      let sitio = porSitio.get(u.sitio);
      if (!sitio) {
        sitio = { id: u.sitio, ciudad: u.ciudad, provincia: u.provincia, organizaciones: [], bx: xy[0], by: xy[1], radio: 0, puntos: [] };
        porSitio.set(u.sitio, sitio);
      }
      if (s.organizacion && !sitio.organizaciones.includes(s.organizacion)) sitio.organizaciones.push(s.organizacion);
      sitio.puntos.push({ s, e, estado: estadoDe(s), bx: xy[0], by: xy[1], dx: 0, dy: 0 });
    }
  }
  for (const sitio of porSitio.values()) {
    const n = sitio.puntos.length;
    sitio.puntos.sort((a, b) => a.e.abierto_min - b.e.abierto_min || a.s.primera_deteccion_min - b.s.primera_deteccion_min);
    if (n === 1) continue;
    sitio.radio = Math.max(RADIO_GRUPO_MIN_PX, (n * PASO_GRUPO_PX) / (2 * Math.PI));
    const inicio = -Math.PI / 2 - Math.PI / n;
    sitio.puntos.forEach((p, i) => {
      const a = inicio + (i * 2 * Math.PI) / n;
      p.dx = Math.cos(a) * sitio.radio;
      p.dy = Math.sin(a) * sitio.radio;
    });
  }
  return [...porSitio.values()];
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
  const comba = Math.min(90, Math.max(18, largo * 0.28));
  const cx = (ax + bx) / 2 + (dy / largo) * comba;
  const cy = (ay + by) / 2 - (dx / largo) * comba;
  // Recorta los extremos para que la flecha llegue al borde del anillo y no al centro.
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
  const opciones = [10, 20, 25, 50, 100, 200, 250, 500, 1000];
  for (const km of opciones) {
    const px = km / kmPorPx;
    if (px >= 60) return { km, px };
  }
  return { km: 1000, px: 1000 / kmPorPx };
}

// --- rótulos sin choques -------------------------------------------------------------------------

interface Caja {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}
interface Rotulo {
  dx: number;
  dy: number;
  ancla: "start" | "end" | "middle";
  org: boolean;
}

const solapan = (a: Caja, b: Caja) => a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;

function textoOrg(sitio: Sitio): string {
  if (sitio.organizaciones.length === 0) return plural(sitio.puntos.length, "servidor", "servidores");
  const primera = sitio.organizaciones[0]!.replace(/\s*\(fictici[oa]\)/i, "");
  return sitio.organizaciones.length > 1 ? `${primera} y ${sitio.organizaciones.length - 1} más` : primera;
}

/**
 * Ubica el rótulo de cada centro de datos donde no tape otro rótulo ni un servidor: a la derecha,
 * a la izquierda, abajo o arriba. Si no entra con la organización, prueba solo con la ciudad.
 * Devuelve también las cajas ocupadas, para que las ciudades de referencia se aparten.
 */
function rotular(sitios: Sitio[], zt: ZoomTransform, libre: { ancho: number; alto: number }, rem: number) {
  const ocupadas: Caja[] = [];
  for (const sitio of sitios) {
    for (const p of sitio.puntos) {
      const [x, y] = enPantalla(p, zt);
      ocupadas.push({ x0: x - 13, y0: y - 13, x1: x + 13, y1: y + 13 });
    }
  }
  const px = { ciudad: 0.78125 * rem, org: 0.65625 * rem };
  const rotulos = new Map<string, Rotulo>();
  const orden = [...sitios].sort((a, b) => b.puntos.length - a.puntos.length || a.by - b.by);
  for (const sitio of orden) {
    const [x, y] = enPantalla(sitio, zt);
    const off = sitio.radio + 17;
    const anchoCiudad = sitio.ciudad.length * px.ciudad * 0.58;
    const anchoOrg = textoOrg(sitio).length * px.org * 0.54;
    const cerca = x > libre.ancho * 0.7;
    let elegido: { r: Rotulo; c: Caja } | null = null;
    for (const org of [true, false]) {
      const w = Math.max(anchoCiudad, org ? anchoOrg : 0);
      const alto = org ? 28 : 15;
      const candidatos: { r: Rotulo; c: Caja }[] = [
        { r: { dx: off, dy: -2, ancla: "start", org }, c: { x0: x + off, y0: y - 13, x1: x + off + w, y1: y - 13 + alto } },
        { r: { dx: -off, dy: -2, ancla: "end", org }, c: { x0: x - off - w, y0: y - 13, x1: x - off, y1: y - 13 + alto } },
        { r: { dx: 0, dy: off + 9, ancla: "middle", org }, c: { x0: x - w / 2, y0: y + off - 2, x1: x + w / 2, y1: y + off - 2 + alto } },
        { r: { dx: 0, dy: -off - (org ? 15 : 3), ancla: "middle", org }, c: { x0: x - w / 2, y0: y - off - alto, x1: x + w / 2, y1: y - off } },
      ];
      if (cerca) [candidatos[0], candidatos[1]] = [candidatos[1]!, candidatos[0]!];
      elegido =
        candidatos.find(
          ({ c }) => c.x0 >= 4 && c.y0 >= 4 && c.x1 <= libre.ancho - 4 && c.y1 <= libre.alto - 4 && !ocupadas.some((o) => solapan(o, c)),
        ) ?? null;
      if (elegido) break;
    }
    if (!elegido) {
      const w = anchoCiudad;
      elegido = cerca
        ? { r: { dx: -off, dy: -2, ancla: "end", org: false }, c: { x0: x - off - w, y0: y - 13, x1: x - off, y1: y + 2 } }
        : { r: { dx: off, dy: -2, ancla: "start", org: false }, c: { x0: x + off, y0: y - 13, x1: x + off + w, y1: y + 2 } };
    }
    rotulos.set(sitio.id, elegido.r);
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

// --- componente ---------------------------------------------------------------------------------

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
  const [seleccion, setSeleccion] = useState<string | null>(null);
  const [foco, setFoco] = useState<number | null>(null);

  const rem = useMemo(() => (typeof window === "undefined" ? 16 : parseFloat(getComputedStyle(document.documentElement).fontSize) || 16), [ancho]);
  const anchoRutas = Math.min(ANCHO_RUTAS_REM * rem, ancho * 0.42);
  const finalizado = tablero.estado.finalizado;
  const expedientes = tablero.expedientes;
  const proveedores = tablero.proveedores.length;

  // La proyección encuadra Argentina en lo que queda libre a la izquierda de las rutas.
  const proy = useMemo(() => {
    const p = geoOrthographic().rotate([64, 38.5]).clipAngle(90).precision(0.2);
    if (ancho > 0 && alto > 0) {
      const margen = Math.max(18, alto * 0.04);
      p.fitExtent(
        [
          [margen, margen],
          [Math.max(margen * 2 + 40, ancho - anchoRutas - margen * 2), alto - margen],
        ],
        ENCUADRE,
      );
    }
    return p;
  }, [ancho, alto, anchoRutas]);

  const camino = useMemo(() => geoPath(proy), [proy]);
  const base = useMemo(
    () => ({
      esfera: camino({ type: "Sphere" }) ?? "",
      reticula: camino(RETICULA) ?? "",
      vecinos: VECINOS.map((f) => ({ id: String(f.id), d: camino(f as Feature) ?? "" })),
      argentina: ARGENTINA.map((f) => ({ id: String(f.id), d: camino(f as Feature) ?? "" })),
      ciudades: CIUDADES.map((c) => {
        const xy = proy([c.lon, c.lat]);
        return xy ? { ...c, bx: xy[0], by: xy[1] } : null;
      }).filter((c): c is NonNullable<typeof c> => c !== null),
    }),
    [camino, proy],
  );

  const sitios = useMemo(() => agrupar(expedientes, proy), [expedientes, proy]);
  const puntos = useMemo(() => {
    const m = new Map<number, Punto>();
    for (const s of sitios) for (const p of s.puntos) m.set(p.s.id, p);
    return m;
  }, [sitios]);

  // Zoom y arrastre. d3-zoom maneja rueda, arrastre, pellizco y doble clic.
  useEffect(() => {
    const svg = refSvg.current;
    if (!svg) return;
    const z = d3zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.7, ZOOM_MAX])
      .on("zoom", (ev: { transform: ZoomTransform }) => setZt(ev.transform));
    refZoom.current = z;
    select(svg).call(z);
    return () => {
      select(svg).on(".zoom", null);
    };
  }, []);

  useEffect(() => {
    const z = refZoom.current;
    if (!z || ancho === 0) return;
    z.translateExtent([
      [-ancho * 0.6, -alto * 0.6],
      [ancho * 1.6, alto * 1.6],
    ]).extent([
      [0, 0],
      [ancho, alto],
    ]);
    // La proyección se reencuadra con el tamaño: el zoom anterior ya no corresponde.
    if (refSvg.current) select(refSvg.current).call(z.transform, zoomIdentity);
  }, [ancho, alto]);

  const llevarA = useCallback(
    (destino: ZoomTransform) => {
      const svg = refSvg.current;
      const z = refZoom.current;
      if (!svg || !z) return;
      const sel = select(svg);
      if (sinMovimiento()) sel.call(z.transform, destino);
      else sel.transition().duration(720).call(z.transform, destino);
    },
    [],
  );

  /** Encuadra un conjunto de puntos proyectados en la zona libre del mapa. */
  const encuadrar = useCallback(
    (ps: { bx: number; by: number }[], kMax = 5) => {
      if (ps.length === 0 || ancho === 0) return llevarA(zoomIdentity);
      const xs = ps.map((p) => p.bx);
      const ys = ps.map((p) => p.by);
      const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
      const libreAncho = ancho - anchoRutas;
      const margen = 110;
      const k = Math.max(1, Math.min(kMax, (libreAncho - margen * 2) / Math.max(1, x1 - x0), (alto - margen * 2) / Math.max(1, y1 - y0)));
      const cx = (x0 + x1) / 2;
      const cy = (y0 + y1) / 2;
      llevarA(zoomIdentity.translate(libreAncho / 2 - cx * k, alto / 2 - cy * k).scale(k));
    },
    [ancho, alto, anchoRutas, llevarA],
  );

  const elegir = useCallback(
    (id: string | null, acercar = false) => {
      setSeleccion(id);
      if (!acercar) return;
      if (id == null) return llevarA(zoomIdentity);
      const e = expedientes.find((x) => x.id === id);
      const ps = e ? e.servidores.map((s) => puntos.get(s.id)).filter((p): p is Punto => !!p) : [];
      encuadrar(ps, 4.5);
    },
    [expedientes, puntos, encuadrar, llevarA],
  );

  useEffect(() => {
    const alTeclear = (ev: KeyboardEvent) => {
      if (ev.key !== "Escape") return;
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
  const nuevos = {
    has: (c: string) => ahoraMs - (vistos.current?.get(c) ?? -Infinity) < 1800,
  };

  const kmPorPx = RADIO_TIERRA_KM / (proy.scale() * zt.k);
  const regla = escalaGrafica(kmPorPx);

  const rutas = expedientes.map((e) => {
    const orden = [...e.servidores].sort((a, b) => a.primera_deteccion_min - b.primera_deteccion_min || a.id - b.id);
    const saltos = [];
    for (let i = 1; i < orden.length; i++) {
      const pa = puntos.get(orden[i - 1]!.id);
      const pb = puntos.get(orden[i]!.id);
      if (!pa || !pb) continue;
      saltos.push({ clave: `${orden[i - 1]!.id}-${orden[i]!.id}`, desde: orden[i - 1]!, hasta: orden[i]!, ...curva(enPantalla(pa, zt), enPantalla(pb, zt)) });
    }
    return { e, saltos };
  });

  const puntoFoco = foco != null ? puntos.get(foco) : undefined;
  const { rotulos, ocupadas } = rotular(sitios, zt, { ancho: ancho - anchoRutas, alto }, rem);
  const totalServidores = puntos.size;

  return (
    <div className="mp" ref={refCaja}>
      <svg
        ref={refSvg}
        className="mp-lienzo"
        width={ancho}
        height={alto}
        role="img"
        aria-label={`Mapa de Argentina con ${plural(totalServidores, "servidor pirata", "servidores piratas")} en su ciudad y los saltos de cada filtración`}
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
          {base.vecinos.map((p) => (
            <path key={p.id} d={p.d} className="mp-vecino" />
          ))}
          {base.argentina.map((p) => (
            <path key={p.id} d={p.d} className="mp-argentina" />
          ))}
        </g>

        <g className="mp-ciudades" aria-hidden="true">
          {(() => {
            const tomadas = [...ocupadas];
            const px = 0.6875 * rem;
            return [...base.ciudades]
              .sort((a, b) => a.rango - b.rango)
              .map((c) => {
                const [x, y] = enPantalla(c, zt);
                if (x < -40 || y < -20 || x > ancho + 40 || y > alto + 20) return null;
                const punto: Caja = { x0: x - 3, y0: y - 3, x1: x + 3, y1: y + 3 };
                if (tomadas.some((o) => solapan(o, punto))) return null;
                const rotular = c.rango === 1 ? zt.k >= 0.9 : zt.k >= 2.2;
                const caja: Caja = { x0: x - 3, y0: y - 7, x1: x + 6 + c.nombre.length * px * 0.55, y1: y + 6 };
                const conRotulo = rotular && x < ancho - anchoRutas - 8 && !tomadas.some((o) => solapan(o, caja));
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

        <g className="mp-rutas">
          {rutas.map(({ e, saltos }) => {
            const atenuada = seleccion != null && seleccion !== e.id;
            const elegida = seleccion === e.id;
            return (
              <g key={e.id} data-atenuada={atenuada ? "" : undefined} data-elegida={elegida ? "" : undefined}>
                {saltos.map((s) => (
                  <g key={s.clave}>
                    <path
                      d={s.d}
                      pathLength={1}
                      className="mp-salto"
                      data-nuevo={nuevos.has(`s${s.hasta.id}`) ? "" : undefined}
                      markerEnd={`url(#${idFlecha}-f)`}
                    />
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
          {sitios.map((sitio) => {
            const [x, y] = enPantalla(sitio, zt);
            const r = rotulos.get(sitio.id) ?? { dx: sitio.radio + 17, dy: -2, ancla: "start" as const, org: true };
            const atenuado = seleccion != null && !sitio.puntos.some((p) => p.e.id === seleccion);
            return (
              <g key={sitio.id} transform={`translate(${x.toFixed(1)},${y.toFixed(1)})`} className="mp-sitio" data-atenuado={atenuado ? "" : undefined}>
                {sitio.puntos.length > 1 && (
                  <>
                    <circle r={sitio.radio} className="mp-sitio-orbita" />
                    {sitio.puntos.map((p) => (
                      <line key={p.s.id} x1={0} y1={0} x2={p.dx * 0.62} y2={p.dy * 0.62} className="mp-sitio-radio" />
                    ))}
                  </>
                )}
                <rect x={-2.6} y={-2.6} width={5.2} height={5.2} className="mp-sitio-nodo" transform="rotate(45)" />
                <text x={r.dx} y={r.dy} textAnchor={r.ancla} className="mp-sitio-ciudad">
                  {sitio.ciudad}
                </text>
                {r.org && (
                  <text x={r.dx} y={r.dy + 13} textAnchor={r.ancla} className="mp-sitio-org">
                    {textoOrg(sitio)}
                  </text>
                )}
              </g>
            );
          })}
        </g>

        <g className="mp-servidores">
          {sitios.flatMap((sitio) =>
            sitio.puntos.map((p) => {
              const [x, y] = enPantalla(p, zt);
              const cobertura = finalizado ? p.s.cobertura_max_pct : p.s.cobertura_pct;
              const compartida = p.s.terceros.length > 0;
              const elegido = seleccion === p.e.id;
              const atenuado = seleccion != null && !elegido;
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
                  aria-label={`${p.s.host}, ${p.s.ubicacion.ciudad}. ${ROTULO_ESTADO[p.estado]}. Expediente ${p.e.id}.`}
                  onPointerEnter={() => setFoco(p.s.id)}
                  onPointerLeave={() => setFoco((f) => (f === p.s.id ? null : f))}
                  onFocus={() => setFoco(p.s.id)}
                  onBlur={() => setFoco((f) => (f === p.s.id ? null : f))}
                  onClick={(ev) => {
                    ev.stopPropagation();
                    if (seleccion === p.e.id) navegar(`/expediente/${encodeURIComponent(p.e.id)}`);
                    else elegir(p.e.id);
                  }}
                  onKeyDown={(ev) => {
                    if (ev.key === "Enter" || ev.key === " ") {
                      ev.preventDefault();
                      if (seleccion === p.e.id) navegar(`/expediente/${encodeURIComponent(p.e.id)}`);
                      else elegir(p.e.id);
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
      </svg>

      {puntoFoco && <Ficha p={puntoFoco} zt={zt} ancho={ancho - anchoRutas} alto={alto} finalizado={finalizado} proveedores={proveedores} />}

      <div className="mp-controles" role="group" aria-label="Zoom del mapa">
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
        <button type="button" className="mp-boton mp-boton-texto" onClick={() => encuadrar([...puntos.values()])} disabled={totalServidores === 0}>
          Servidores
        </button>
        <button type="button" className="mp-boton mp-boton-texto" onClick={() => elegir(null, true)}>
          País
        </button>
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

      <div className="mp-pie">
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
            <span className="mp-leyenda-halo" aria-hidden="true" /> IP compartida: solo dominio
          </li>
        </ul>
        <div className="mp-regla" aria-hidden="true">
          <span className="mp-regla-barra" style={{ width: `${regla.px.toFixed(1)}px` }} />
          <span className="num">{numero(regla.km)} km</span>
        </div>
      </div>

      <Rutas
        expedientes={expedientes}
        seleccion={seleccion}
        foco={foco}
        nuevos={nuevos}
        finalizado={finalizado}
        proveedores={proveedores}
        onElegir={(id) => elegir(seleccion === id ? null : id, true)}
        onFoco={setFoco}
        onAbrir={(id) => navegar(`/expediente/${encodeURIComponent(id)}`)}
      />
    </div>
  );
}

// --- ficha flotante -----------------------------------------------------------------------------

function Ficha({
  p,
  zt,
  ancho,
  alto,
  finalizado,
  proveedores,
}: {
  p: Punto;
  zt: ZoomTransform;
  ancho: number;
  alto: number;
  finalizado: boolean;
  proveedores: number;
}) {
  const [x, y] = enPantalla(p, zt);
  const izquierda = x > ancho * 0.58;
  const arriba = y > alto * 0.62;
  const s = p.s;
  const cobertura = finalizado ? s.cobertura_max_pct : s.cobertura_pct;
  const org = s.organizacion?.replace(/\s*\(fictici[oa]\)/i, "");
  return (
    <div
      className="mp-ficha"
      role="tooltip"
      data-estado={p.estado}
      style={{
        left: `${x}px`,
        top: `${y}px`,
        transform: `translate(${izquierda ? "calc(-100% - 22px)" : "22px"}, ${arriba ? "calc(-100% + 14px)" : "-14px"})`,
      }}
    >
      <p className="mp-ficha-host">{s.host}</p>
      <p className="mp-ficha-red">
        <span className="num">{s.ip}</span>
        {s.asn != null && <span className="num"> · AS{s.asn}</span>}
        {org && <span> · {org}</span>}
      </p>
      <p className="mp-ficha-lugar">
        {s.ubicacion.ciudad}, {s.ubicacion.provincia} <small>simulada</small>
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
      {s.terceros.length > 0 && (
        <p className="mp-ficha-terceros">
          IP compartida con {plural(s.terceros.length, "sitio legítimo", "sitios legítimos")}: se bloquea solo el dominio.
        </p>
      )}
      <p className="mp-ficha-exp">
        {p.e.id} · {p.e.servidores.length > 1 ? `salto ${[...p.e.servidores].sort((a, b) => a.primera_deteccion_min - b.primera_deteccion_min).findIndex((x) => x.id === s.id) + 1} de ${p.e.servidores.length}` : "servidor único"}
      </p>
    </div>
  );
}

// --- rutas por expediente -----------------------------------------------------------------------

function Rutas({
  expedientes,
  seleccion,
  foco,
  nuevos,
  finalizado,
  proveedores,
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
        <p className="mp-rutas-sub">Un expediente por marca de agua; cada salto, una ampliación.</p>
      </header>
      {ordenados.length === 0 ? (
        <p className="mp-rutas-vacio">Sin filtraciones todavía. Cada servidor aparece en su ciudad apenas se detecta.</p>
      ) : (
        <ol className="mp-rutas-lista" ref={lista}>
          {ordenados.map((e) => {
            const servidores = [...e.servidores].sort((a, b) => a.primera_deteccion_min - b.primera_deteccion_min || a.id - b.id);
            const elegida = seleccion === e.id;
            return (
              <li key={e.id} data-exp={e.id} className="mp-ruta" data-elegida={elegida ? "" : undefined} data-atenuada={seleccion != null && !elegida ? "" : undefined} data-nuevo={nuevos.has(`e${e.id}`) ? "" : undefined}>
                <button type="button" className="mp-ruta-cabeza" aria-pressed={elegida} onClick={() => onElegir(e.id)}>
                  <span className="mp-ruta-id num">{e.id.replace(/^EXP-\d{4}-/, "EXP-")}</span>
                  <span className="mp-ruta-estado" data-estado={e.estado}>
                    {ESTADO_EXPEDIENTE[e.estado]}
                  </span>
                  <span className="mp-ruta-marca">{e.marca}</span>
                </button>
                <ol className="mp-saltos">
                  {servidores.map((s, i) => {
                    const estado = estadoDe(s);
                    return (
                      <li
                        key={s.id}
                        className="mp-paso"
                        data-foco={foco === s.id ? "" : undefined}
                        onPointerEnter={() => onFoco(s.id)}
                        onPointerLeave={() => onFoco(null)}
                      >
                        <span className="mp-paso-n num" aria-hidden="true">
                          {i + 1}
                        </span>
                        <span className="mp-paso-min num">{minutoEntero(s.primera_deteccion_min)}′</span>
                        <span className="mp-paso-host" title={`${s.host} · ${s.ip}`}>
                          {s.host}
                        </span>
                        <span className="mp-paso-ciudad">{s.ubicacion.ciudad}</span>
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
        <p>Ubicación simulada, a nivel de ciudad: las IPs del desafío son de documentación (RFC 5737). No es parte de lo que firma el juez.</p>
      </footer>
    </aside>
  );
}

export default MapaFiltraciones;
