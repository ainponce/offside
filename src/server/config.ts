// Configuración por variables de entorno.
//
//   SIMULADOR_URL         Dirección del simulador (por defecto http://localhost:8080).
//                         En el partido final, la que asigne la organización.
//   PUERTO                Puerto de Offside (3000). Escucha en todas las interfaces.
//   OFFSIDE_DB            Ruta de la base local (datos/offside.db). Se crea sola.
//   OFFSIDE_JUECES        Jueces, claves y usuarios de demostración (config/jueces.demo.json).
//   OFFSIDE_INTERVALO_MS  Cada cuánto se consulta al simulador, en ms reales (300).
//   OFFSIDE_SIMULACRO=1   Solo para el video: fuerza un bloqueo equivocado para
//                         mostrar el circuito de reclamos.

import { readFileSync } from "node:fs";
import { CONFIG_BASE, type Config, type Juez, type Operador } from "./contexto.ts";

type Entorno = Record<string, string | undefined>;

function entero(valor: string | undefined, porDefecto: number): number {
  const n = Number.parseInt(valor ?? "", 10);
  return Number.isFinite(n) && n > 0 ? n : porDefecto;
}

export function cargarConfig(env: Entorno = process.env): Config {
  return {
    ...CONFIG_BASE,
    simuladorUrl: (env.SIMULADOR_URL ?? CONFIG_BASE.simuladorUrl).replace(/\/+$/, ""),
    puerto: entero(env.PUERTO, CONFIG_BASE.puerto),
    dbRuta: env.OFFSIDE_DB ?? CONFIG_BASE.dbRuta,
    juecesRuta: env.OFFSIDE_JUECES ?? CONFIG_BASE.juecesRuta,
    intervaloMs: entero(env.OFFSIDE_INTERVALO_MS, CONFIG_BASE.intervaloMs),
    simulacro: env.OFFSIDE_SIMULACRO === "1" || env.OFFSIDE_SIMULACRO === "true",
  };
}

const CAMPOS_JUEZ: (keyof Juez)[] = [
  "id",
  "nombre",
  "juzgado_id",
  "juzgado_nombre",
  "clave_firma_demo",
  "usuario",
  "contrasena",
];

export function cargarJueces(ruta: string): { jueces: Juez[]; operadores: Operador[] } {
  const datos = JSON.parse(readFileSync(ruta, "utf8")) as { jueces?: Juez[]; operadores?: Operador[] };
  const jueces = datos.jueces ?? [];
  for (const j of jueces) {
    const faltan = CAMPOS_JUEZ.filter((campo) => typeof j[campo] !== "string" || !j[campo]);
    if (faltan.length > 0) {
      throw new Error(`${ruta}: al juez ${j.id ?? "(sin id)"} le faltan campos: ${faltan.join(", ")}`);
    }
  }
  return { jueces, operadores: datos.operadores ?? [] };
}
