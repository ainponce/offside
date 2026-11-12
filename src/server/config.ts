// Configuración por variables de entorno.
//
//   SIMULADOR_URL         Dirección del simulador (por defecto http://localhost:8080).
//                         En el partido final, la que asigne la organización.
//   PUERTO                Puerto de Offside (3000).
//   OFFSIDE_HOST          Interfaz donde escucha (0.0.0.0: toda la red local, para abrir
//                         la vista del juez desde un teléfono). En el partido final, 127.0.0.1.
//   OFFSIDE_DB            Ruta de la base local (datos/offside.db). Se crea sola.
//   OFFSIDE_JUECES        Jueces, claves y usuarios (config/jueces.demo.json, públicos).
//                         En el partido final, config/jueces.local.json (pnpm jueces-locales).
//   OFFSIDE_INTERVALO_MS  Cada cuánto se consulta al simulador, en ms reales (300).
//
// El simulacro (un bloqueo equivocado a propósito, para mostrar los reclamos) solo
// se activa con la bandera --simulacro en la línea de comandos, nunca por entorno:
// así no puede quedar prendido por una variable olvidada en el partido final.

import { readFileSync } from "node:fs";
import { CONFIG_BASE, type Config, type Juez, type Operador } from "./contexto.ts";

type Entorno = Record<string, string | undefined>;

function entero(valor: string | undefined, porDefecto: number): number {
  const n = Number.parseInt(valor ?? "", 10);
  return Number.isFinite(n) && n > 0 ? n : porDefecto;
}

export function cargarConfig(env: Entorno = process.env, argv: string[] = process.argv): Config {
  return {
    ...CONFIG_BASE,
    simuladorUrl: (env.SIMULADOR_URL ?? CONFIG_BASE.simuladorUrl).replace(/\/+$/, ""),
    puerto: entero(env.PUERTO, CONFIG_BASE.puerto),
    host: env.OFFSIDE_HOST?.trim() || CONFIG_BASE.host,
    dbRuta: env.OFFSIDE_DB ?? CONFIG_BASE.dbRuta,
    juecesRuta: env.OFFSIDE_JUECES ?? CONFIG_BASE.juecesRuta,
    intervaloMs: entero(env.OFFSIDE_INTERVALO_MS, CONFIG_BASE.intervaloMs),
    simulacro: argv.includes("--simulacro"),
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
