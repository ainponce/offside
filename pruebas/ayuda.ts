// Armado común de las pruebas del motor: base en memoria, simulador falso y dos jueces.

import { Auditoria } from "../src/server/auditoria.ts";
import { type Config, type Contexto, type Juez, crearContexto } from "../src/server/contexto.ts";
import { type Db, abrirDb } from "../src/server/db.ts";
import { Motor } from "../src/server/motor.ts";
import type { Deteccion } from "../src/server/simulador.ts";
import { SimuladorFalso } from "./simulador-falso.ts";

export const JUECES: Juez[] = [
  {
    id: "jueza-a",
    nombre: "Dra. A",
    juzgado_id: "jg-1",
    juzgado_nombre: "Juzgado 1",
    clave_firma_demo: "clave-a",
    usuario: "a",
    contrasena: "clave-de-a",
  },
  {
    id: "juez-b",
    nombre: "Dr. B",
    juzgado_id: "jg-2",
    juzgado_nombre: "Juzgado 2",
    clave_firma_demo: "clave-b",
    usuario: "b",
    contrasena: "clave-de-b",
  },
];

export interface Armado {
  db: Db;
  sim: SimuladorFalso;
  ctx: Contexto;
  motor: Motor;
  cambios: { n: number };
}

export function armar(config: Partial<Config> = {}): Armado {
  const db = abrirDb(":memory:");
  const sim = new SimuladorFalso();
  const cambios = { n: 0 };
  const ctx = crearContexto({
    db,
    sim,
    auditoria: new Auditoria(db),
    jueces: JUECES,
    config,
    alCambiar: () => {
      cambios.n += 1;
    },
  });
  return { db, sim, ctx, motor: new Motor(ctx), cambios };
}

export function filas<T = Record<string, unknown>>(db: Db, sql: string, ...parametros: (string | number | null)[]): T[] {
  return db.prepare(sql).all(...parametros) as unknown as T[];
}

export function eventos(db: Db, tipo: string): { minuto: number | null; actor: string; tipo: string; datos: any }[] {
  return filas<{ contenido: string }>(db, "SELECT contenido FROM auditoria ORDER BY seq")
    .map((f) => JSON.parse(f.contenido))
    .filter((e) => e.tipo === tipo);
}

const CAPTURA = Buffer.from([0x47, 0x10, 0x20, 0x30, 0x40]).toString("base64");

export function deteccion(parcial: Partial<Deteccion> & { id: string; minuto: number }): Deteccion {
  return {
    pagina: "https://pelota.test/en-vivo",
    stream_url: "https://s1.pelota.test/hls/index.m3u8",
    host_stream: "s1.pelota.test",
    ip_servidor: "203.0.113.5",
    asn: 64600,
    marca_de_agua_extraida: "TX26-OFI-S000111",
    captura: { capturada_min: parcial.minuto, formato: "mpegts", duracion_seg: 6, contenido_b64: CAPTURA },
    promocion: [{ red: "x", url: "https://x.example/pelota/status/1", minuto: parcial.minuto - 1 }],
    ...parcial,
  };
}

/** Publica la detección, lleva el reloj a ese minuto y corre un ciclo del motor. */
export async function publicarYProcesar(a: Armado, det: Deteccion): Promise<void> {
  a.sim.publicar(det);
  if (a.sim.minuto < det.minuto) a.sim.avanzar(det.minuto);
  await a.motor.tick();
}
