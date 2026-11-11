// Acceso a datos: filas tipadas y las consultas que usan el motor, las decisiones y las vistas.

import type { Db } from "./db.ts";
import type { ItemPlan, Riesgo } from "./reglas.ts";
import type { TipoBloqueo } from "./simulador.ts";

export type ClaseMedida = "inicial" | "ampliacion" | "ratificacion" | "levantamiento";
export type EstadoMedida = "pendiente" | "aprobando" | "aprobada" | "rechazada" | "sin_efecto";
export type EstadoOrden =
  | "por_enviar"
  | "recibida"
  | "aplicada"
  | "fallida"
  | "vencida"
  | "levantada"
  | "rechazada"
  | "no_enviada";

export interface FilaExpediente {
  id: string;
  n: number;
  clave: string;
  marca: string;
  prefijo: string;
  origen_prefijo: string | null;
  abierto_min: number;
}

export interface FilaServidor {
  id: number;
  expediente_id: string;
  host: string;
  ip: string;
  asn: number | null;
  organizacion: string | null;
  riesgo: string;
  primera_deteccion_min: number;
}

export interface FilaMedida {
  id: string;
  n: number;
  expediente_id: string;
  servidor_id: number | null;
  clase: ClaseMedida;
  estado: EstadoMedida;
  creada_min: number;
  creada_iso: string;
  instantanea: string;
  huella: string;
  plan: string;
  vence_min: number;
  juez_id: string | null;
  decidida_min: number | null;
  decidida_iso: string | null;
  motivo: string | null;
  origen_medida_id: string | null;
  reclamo_id: string | null;
}

export interface FilaOrden {
  orden_id: string;
  medida_id: string;
  expediente_id: string;
  servidor_id: number | null;
  proveedor_id: string;
  tipo: TipoBloqueo;
  objetivo: string;
  vence_min: number;
  juez_id: string;
  juzgado_id: string;
  firma: string;
  intento: number;
  estado: EstadoOrden;
  creada_min: number;
  enviada_min: number | null;
  aplicada_min: number | null;
  finalizada_min: number | null;
  error: string | null;
  atendida: number;
}

export interface FilaDeteccion {
  id: string;
  minuto: number;
  crudo: string;
  sha256: string;
  captura_sha256: string | null;
  captura_bytes: number;
  formato_ok: number;
  veredicto: string;
  motivo: string;
  host: string;
  ip: string;
  marca: string | null;
  expediente_id: string | null;
  servidor_id: number | null;
  recibida_min: number;
  recibida_iso: string;
}

export interface FilaReclamo {
  id: string;
  minuto: number;
  dominio: string;
  proveedor_id: string;
  mensaje: string;
  estado: "verificado" | "no_verificado" | "resuelto";
  medida_id: string | null;
  detalle: string | null;
}

type Parametro = string | number | null;

export function todas<T>(db: Db, sql: string, ...p: Parametro[]): T[] {
  return db.prepare(sql).all(...p) as unknown as T[];
}

export function una<T>(db: Db, sql: string, ...p: Parametro[]): T | undefined {
  return db.prepare(sql).get(...p) as unknown as T | undefined;
}

export function ejecutar(db: Db, sql: string, ...p: Parametro[]): number {
  return Number(db.prepare(sql).run(...p).changes);
}

/** Ejecuta `fn` dentro de una transacción; si lanza, deshace. */
export function enTransaccion<T>(db: Db, fn: () => T): T {
  db.exec("BEGIN");
  try {
    const r = fn();
    db.exec("COMMIT");
    return r;
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }
}

export const medidaPorId = (db: Db, id: string) => una<FilaMedida>(db, "SELECT * FROM medidas WHERE id = ?", id);
export const ordenPorId = (db: Db, id: string) => una<FilaOrden>(db, "SELECT * FROM ordenes WHERE orden_id = ?", id);
export const expedientePorId = (db: Db, id: string) =>
  una<FilaExpediente>(db, "SELECT * FROM expedientes WHERE id = ?", id);
export const servidorPorId = (db: Db, id: number) => una<FilaServidor>(db, "SELECT * FROM servidores WHERE id = ?", id);

export function siguienteN(db: Db, tabla: "expedientes" | "medidas"): number {
  const fila = una<{ n: number | null }>(db, `SELECT MAX(n) AS n FROM ${tabla}`);
  return Number(fila?.n ?? 0) + 1;
}

export function idExpediente(anio: number, n: number): string {
  return `EXP-${anio}-${String(n).padStart(6, "0")}`;
}

export function idMedida(n: number): string {
  return `M-${String(n).padStart(4, "0")}`;
}

export function planDe(m: Pick<FilaMedida, "plan">): ItemPlan[] {
  return JSON.parse(m.plan) as ItemPlan[];
}

export function riesgoDe(s: Pick<FilaServidor, "riesgo">): Riesgo & { simulacro?: boolean } {
  return JSON.parse(s.riesgo) as Riesgo & { simulacro?: boolean };
}

export const ESTADOS_ORDEN_ACTIVA: EstadoOrden[] = ["recibida", "aplicada"];
