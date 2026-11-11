// Lo que comparten el motor, las decisiones, el despacho y la API.

import type { Auditoria } from "./auditoria.ts";
import type { Db } from "./db.ts";
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
  dbRuta: string;
  juecesRuta: string;
  intervaloMs: number;
  /** Términos que, en el nombre de la organización del ASN, sugieren infraestructura compartida. */
  terminosCompartida: string[];
  /** Solo para el video: fuerza un bloqueo equivocado para mostrar el circuito de reclamos. */
  simulacro: boolean;
  maxIntentos: number;
}

export const CONFIG_BASE: Config = {
  simuladorUrl: "http://localhost:8080",
  puerto: 3000,
  dbRuta: "datos/offside.db",
  juecesRuta: "config/jueces.demo.json",
  intervaloMs: 300,
  terminosCompartida: ["cdn", "compartido", "compartida", "shared", "cloud"],
  simulacro: false,
  maxIntentos: 8,
};

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
}

export function crearContexto(p: {
  db: Db;
  sim: Simulador;
  auditoria: Auditoria;
  jueces: Juez[];
  config?: Partial<Config>;
  alCambiar?: () => void;
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
      alertas: [],
    },
    enVuelo: new Set(),
    alCambiar: p.alCambiar ?? (() => {}),
  };
}

export function juezPorId(ctx: Contexto, id: string): Juez | undefined {
  return ctx.jueces.find((j) => j.id === id);
}

export function alertar(ctx: Contexto, mensaje: string): void {
  if (!ctx.estado.alertas.includes(mensaje)) ctx.estado.alertas.push(mensaje);
}
