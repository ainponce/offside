// Lo que comparten el motor, las decisiones, el despacho y la API.

import type { Auditoria } from "./auditoria.ts";
import { type Db, leerKv } from "./db.ts";
import type { Partido, Proveedor, Simulador } from "./simulador.ts";

export interface Juez {
  id: string;
  nombre: string;
  juzgado_id: string;
  juzgado_nombre: string;
  clave_firma_demo: string;
  usuario: string;
  contrasena: string;
}

export interface Operador {
  usuario: string;
  contrasena: string;
  nombre: string;
  rol: "fiscalia";
}

export interface Config {
  simuladorUrl: string;
  puerto: number;
  /** Interfaz donde escucha: 0.0.0.0 (toda la red local, para el teléfono en una demo) o 127.0.0.1. */
  host: string;
  dbRuta: string;
  juecesRuta: string;
  intervaloMs: number;
  /** Términos que, en el nombre de la organización del ASN, sugieren infraestructura compartida. */
  terminosCompartida: string[];
  /** Solo para el video: fuerza un bloqueo equivocado para mostrar el circuito de reclamos. */
  simulacro: boolean;
  maxIntentos: number;
  /**
   * No se envía una orden si al turno del juez que la firmó le queda menos que
   * esto: va a ratificación del entrante. Es el mayor entre los minutos de
   * partido y los segundos reales convertidos con la aceleración del simulador.
   */
  margenTurnoMin: number;
  margenTurnoSeg: number;
}

export const CONFIG_BASE: Config = {
  simuladorUrl: "http://localhost:8080",
  puerto: 3000,
  host: "0.0.0.0",
  dbRuta: "datos/offside.db",
  juecesRuta: "config/jueces.demo.json",
  intervaloMs: 300,
  terminosCompartida: ["cdn", "compartido", "compartida", "shared", "cloud"],
  simulacro: false,
  // Un proveedor que falla se sigue reintentando todo el partido: cada falla tarda
  // lo que el proveedor demora en aplicar, así que no hay ráfagas.
  maxIntentos: 1000,
  margenTurnoMin: 0.5,
  margenTurnoSeg: 2,
};

/** Un turno del horario que publica el simulador en GET /juzgados. */
export interface Turno {
  juez_id: string;
  nombre: string;
  desde_min: number;
  hasta_min: number;
}

/** Última foto del simulador que tiene el motor. Vive en memoria. */
export interface EstadoMotor {
  conectado: boolean;
  ultimo_error: string | null;
  minuto: number;
  fin_min: number;
  finalizado: boolean;
  acelerar: number;
  jueces_de_turno: string[];
  partido: Partido | null;
  proveedores: Proveedor[];
  /** Horario de turnos según GET /juzgados; vacío si el simulador no lo publica. */
  turnos: Turno[];
  alertas: string[];
}

export interface Contexto {
  db: Db;
  sim: Simulador;
  auditoria: Auditoria;
  config: Config;
  jueces: Juez[];
  estado: EstadoMotor;
  /** Órdenes con un envío en curso, para no mandar dos veces la misma. */
  enVuelo: Set<string>;
  /** Avisa a la interfaz que algo cambió. */
  alCambiar: () => void;
  /** Mensajes para quien opera Offside (la consola del servidor). */
  consola: (texto: string) => void;
}

export function crearContexto(p: {
  db: Db;
  sim: Simulador;
  auditoria: Auditoria;
  jueces: Juez[];
  config?: Partial<Config>;
  alCambiar?: () => void;
  consola?: (texto: string) => void;
}): Contexto {
  return {
    db: p.db,
    sim: p.sim,
    auditoria: p.auditoria,
    config: { ...CONFIG_BASE, ...p.config },
    jueces: p.jueces,
    estado: {
      conectado: false,
      ultimo_error: null,
      minuto: 0,
      fin_min: 0,
      finalizado: false,
      acelerar: 1,
      jueces_de_turno: [],
      partido: null,
      proveedores: [],
      turnos: [],
      alertas: [],
    },
    enVuelo: new Set(),
    alCambiar: p.alCambiar ?? (() => {}),
    consola: p.consola ?? ((texto) => console.error(texto)),
  };
}

export function juezPorId(ctx: Contexto, id: string): Juez | undefined {
  return ctx.jueces.find((j) => j.id === id);
}

/** Nombre del proveedor para los textos; el id si todavía no se conoce. */
export function nombreProveedor(ctx: Pick<Contexto, "estado">, id: string): string {
  return ctx.estado.proveedores.find((p) => p.id === id)?.nombre ?? id;
}

export function alertar(ctx: Contexto, mensaje: string): void {
  if (!ctx.estado.alertas.includes(mensaje)) ctx.estado.alertas.push(mensaje);
}

/** Recupera el partido y los proveedores guardados, para mostrar o exportar sin el simulador. */
export function restaurarEstado(ctx: Contexto): void {
  const partido = leerKv(ctx.db, "partido");
  const proveedores = leerKv(ctx.db, "proveedores");
  const turnos = leerKv(ctx.db, "turnos_horario");
  if (partido && !ctx.estado.partido) ctx.estado.partido = JSON.parse(partido) as Partido;
  if (proveedores && ctx.estado.proveedores.length === 0) ctx.estado.proveedores = JSON.parse(proveedores) as Proveedor[];
  if (turnos && ctx.estado.turnos.length === 0) ctx.estado.turnos = JSON.parse(turnos) as Turno[];
  if (ctx.estado.partido && ctx.estado.fin_min === 0) ctx.estado.fin_min = ctx.estado.partido.fin_min;
}
