// La instantánea es el texto exacto que ve el juez al decidir una medida. Se
// congela al crear la medida y su SHA-256 es la huella que viaja en cada orden.

import type { FilaExpediente, FilaMedida, FilaServidor } from "./repositorio.ts";
import type { ItemPlan, Riesgo } from "./reglas.ts";
import type { Partido } from "./simulador.ts";

export interface EvidenciaItem {
  deteccion_id: string;
  minuto: number;
  capturada_min: number | null;
  deteccion_sha256: string;
  captura_sha256: string | null;
  captura_bytes: number;
  formato: string | null;
  formato_ok: boolean;
  pagina: string | null;
  stream_url: string | null;
  promocion: { red: string; url: string; minuto: number }[];
}

export interface Sellos {
  minuto_partido: number;
  hora_partido_iso: string | null;
  hora_local_iso: string;
}

export function sellos(partido: Partido | null, minuto: number, ahora: Date = new Date()): Sellos {
  let horaPartido: string | null = null;
  const inicio = partido?.inicio_iso ? Date.parse(partido.inicio_iso) : Number.NaN;
  if (!Number.isNaN(inicio)) horaPartido = new Date(inicio + minuto * 60_000).toISOString();
  return { minuto_partido: minuto, hora_partido_iso: horaPartido, hora_local_iso: ahora.toISOString() };
}

/** Medida inicial o ampliación: bloquear un servidor de una filtración. */
export function instantaneaBloqueo(p: {
  medida_id: string;
  clase: "inicial" | "ampliacion";
  partido: Partido;
  expediente: FilaExpediente;
  servidor: Pick<FilaServidor, "host" | "ip" | "asn" | "organizacion">;
  veredicto_motivo: string;
  riesgo: Riesgo & { simulacro?: boolean };
  evidencia: EvidenciaItem[];
  plan: ItemPlan[];
  vence_min: number;
  servidores_previos: { host: string; ip: string; medida_id: string | null; estado: string | null }[];
  sellos: Sellos;
}): string {
  return JSON.stringify({
    version: 1,
    medida_id: p.medida_id,
    clase: p.clase,
    expediente_id: p.expediente.id,
    partido: { id: p.partido.id, nombre: p.partido.nombre, titular_derechos: p.partido.titular_derechos ?? null },
    filtracion: {
      marca: p.expediente.marca,
      prefijo: p.expediente.prefijo,
      origen_prefijo: p.expediente.origen_prefijo,
      clave: p.expediente.clave,
      motivo: p.veredicto_motivo,
    },
    servidor: p.servidor,
    servidores_previos: p.servidores_previos,
    riesgo: p.riesgo,
    evidencia: p.evidencia,
    plan: p.plan,
    vence_min: p.vence_min,
    sellos: p.sellos,
  });
}

/** Ratificación: el juez entrante autoriza reenviar una medida ya aprobada por el saliente. */
export function instantaneaRatificacion(p: {
  medida_id: string;
  expediente: FilaExpediente;
  servidor: Pick<FilaServidor, "host" | "ip" | "asn" | "organizacion">;
  origen: Pick<FilaMedida, "id" | "huella" | "juez_id" | "decidida_min" | "clase">;
  plan: ItemPlan[];
  motivo: string;
  vence_min: number;
  sellos: Sellos;
}): string {
  return JSON.stringify({
    version: 1,
    medida_id: p.medida_id,
    clase: "ratificacion",
    expediente_id: p.expediente.id,
    filtracion: { marca: p.expediente.marca, clave: p.expediente.clave },
    servidor: p.servidor,
    origen: {
      medida_id: p.origen.id,
      clase: p.origen.clase,
      huella: p.origen.huella,
      juez_id: p.origen.juez_id,
      decidida_min: p.origen.decidida_min,
    },
    motivo: p.motivo,
    plan: p.plan,
    vence_min: p.vence_min,
    sellos: p.sellos,
  });
}

/** Levantamiento: un sitio legítimo reclamó y se propone levantar y reemplazar. */
export function instantaneaLevantamiento(p: {
  medida_id: string;
  expediente: FilaExpediente;
  servidor: Pick<FilaServidor, "host" | "ip" | "asn" | "organizacion">;
  reclamo: { id: string; minuto: number; dominio: string; proveedor_id: string; mensaje: string };
  ordenes_a_levantar: { orden_id: string; proveedor_id: string; tipo: string; objetivo: string }[];
  reemplazo: ItemPlan[];
  verificacion: string;
  vence_min: number;
  sellos: Sellos;
}): string {
  return JSON.stringify({
    version: 1,
    medida_id: p.medida_id,
    clase: "levantamiento",
    expediente_id: p.expediente.id,
    filtracion: { marca: p.expediente.marca, clave: p.expediente.clave },
    servidor: p.servidor,
    reclamo: p.reclamo,
    verificacion: p.verificacion,
    ordenes_a_levantar: p.ordenes_a_levantar,
    plan: p.reemplazo,
    vence_min: p.vence_min,
    sellos: p.sellos,
  });
}
