// Genera src/web/mapa/sudamerica.json: los países de Sudamérica, las Malvinas y las Georgias del
// Sur, de Natural Earth (dominio público) vía world-atlas. Se corre una vez y el resultado queda
// en el repositorio: el mapa no depende de internet ni de un servidor de mapas.
//
//   pnpm tsx scripts/geodatos.ts

import { readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { feature } from "topojson-client";
import type { Topology, GeometryCollection } from "topojson-specification";
import type { Feature, FeatureCollection, Geometry, Position } from "geojson";

const require = createRequire(import.meta.url);
const ruta = require.resolve("world-atlas/countries-10m.json");
const topo = JSON.parse(readFileSync(ruta, "utf8")) as Topology<{ countries: GeometryCollection<{ name: string }> }>;

// Códigos ISO 3166 numéricos. Las Malvinas (238) y las Georgias del Sur (239) se dibujan como
// territorio argentino, igual que en la cartografía oficial.
const NOMBRES: Record<string, string> = {
  "032": "Argentina",
  "238": "Islas Malvinas",
  "239": "Islas Georgias del Sur",
  "068": "Bolivia",
  "076": "Brasil",
  "152": "Chile",
  "170": "Colombia",
  "218": "Ecuador",
  "328": "Guyana",
  "600": "Paraguay",
  "604": "Perú",
  "740": "Surinam",
  "858": "Uruguay",
  "862": "Venezuela",
};
const ARGENTINA = new Set(["032", "238", "239"]);

// Argentina con más detalle que los vecinos: se ve de cerca.
const PASO = { argentina: 0.01, vecinos: 0.05 };
// Islotes que no se ven a la escala del mapa (en grados cuadrados del rectángulo que los encierra).
const AREA_MINIMA = { argentina: 0.004, vecinos: 0.08 };

function area(a: Position[]): number {
  const xs = a.map((p) => p[0]!);
  const ys = a.map((p) => p[1]!);
  return (Math.max(...xs) - Math.min(...xs)) * (Math.max(...ys) - Math.min(...ys));
}

function redondear(p: Position, paso: number): Position {
  return [Math.round(p[0]! / paso) * paso, Math.round(p[1]! / paso) * paso].map((x) => Number(x.toFixed(3)));
}

function anillo(a: Position[], paso: number): Position[] | null {
  const salida: Position[] = [];
  for (const p of a) {
    const r = redondear(p, paso);
    const u = salida[salida.length - 1];
    if (!u || u[0] !== r[0] || u[1] !== r[1]) salida.push(r);
  }
  if (salida.length < 4) return null;
  const [p0, pn] = [salida[0]!, salida[salida.length - 1]!];
  if (p0[0] !== pn[0] || p0[1] !== pn[1]) salida.push(p0);
  return salida;
}

function geometria(g: Geometry, paso: number, minima: number): Geometry | null {
  if (g.type === "Polygon") {
    const anillos = g.coordinates.map((a) => anillo(a, paso)).filter((a): a is Position[] => a !== null);
    return anillos.length ? { type: "Polygon", coordinates: anillos } : null;
  }
  if (g.type === "MultiPolygon") {
    const poligonos = g.coordinates
      .filter((p) => area(p[0]!) >= minima)
      .map((p) => p.map((a) => anillo(a, paso)).filter((a): a is Position[] => a !== null))
      .filter((p) => p.length > 0);
    return poligonos.length ? { type: "MultiPolygon", coordinates: poligonos } : null;
  }
  return null;
}

const todos = feature(topo, topo.objects.countries) as FeatureCollection<Geometry, { name: string }>;
const features: Feature[] = [];
for (const f of todos.features) {
  const id = String(f.id);
  const nombre = NOMBRES[id];
  if (!nombre) continue;
  const propia = ARGENTINA.has(id);
  const g = geometria(f.geometry, propia ? PASO.argentina : PASO.vecinos, propia ? AREA_MINIMA.argentina : AREA_MINIMA.vecinos);
  if (!g) continue;
  features.push({ type: "Feature", id, properties: { nombre, argentina: ARGENTINA.has(id) }, geometry: g });
}

const salida = {
  type: "FeatureCollection",
  fuente: "Natural Earth 1:10M (dominio público), vía world-atlas 2.0.2",
  features,
};
const destino = new URL("../src/web/mapa/sudamerica.json", import.meta.url);
writeFileSync(destino, JSON.stringify(salida));
console.log(`${features.length} países, ${(JSON.stringify(salida).length / 1024).toFixed(0)} KB`);
