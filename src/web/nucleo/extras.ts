// Turnos y cobertura máxima. El contrato los trae (`estado.turnos`, `cobertura_max_pct`);
// si un servidor viejo no los manda, cada pantalla cae a lo que sí viene, sin inventar datos.

import type { AuditoriaItemDTO, EstadoDTO, TableroDTO, TurnoDTO } from "../../compartido/tipos.ts";

/** Turnos del partido, si el estado los trae. */
export function turnosDe(estado: EstadoDTO | null | undefined): TurnoDTO[] | null {
  const t = estado?.turnos;
  if (!Array.isArray(t) || t.length === 0) return null;
  return [...t].sort((a, b) => a.desde_min - b.desde_min);
}

/** Minutos de cambio de turno dentro del partido: de `estado.turnos` o, si no vienen, de la auditoría (traspaso_turno). */
export function cambiosDeTurno(estado: EstadoDTO | null | undefined, auditoria: AuditoriaItemDTO[] = []): number[] {
  const fin = estado?.fin_min ?? Infinity;
  const turnos = turnosDe(estado);
  if (turnos) return [...new Set(turnos.map((t) => t.desde_min).filter((m) => m > 0 && m < fin))].sort((a, b) => a - b);
  return [...new Set(auditoria.filter((a) => a.tipo === "traspaso_turno" && a.minuto != null).map((a) => a.minuto as number))].sort((a, b) => a - b);
}

/** Desde qué minuto está de turno este juez, si se sabe y fue dentro del partido. */
export function desdeTurno(estado: EstadoDTO | null | undefined, juezId: string | null | undefined): number | null {
  const turnos = turnosDe(estado);
  if (!turnos || !estado) return null;
  const ahora = estado.minuto;
  const vigente = turnos.find((t) => t.desde_min <= ahora && ahora < t.hasta_min && (!juezId || t.juez_id === juezId));
  return vigente && vigente.desde_min > 0 ? vigente.desde_min : null;
}

/** Hasta qué minuto dura el turno de este juez, si termina antes del final del partido. */
export function hastaTurno(estado: EstadoDTO | null | undefined, juezId: string | null | undefined): number | null {
  const turnos = turnosDe(estado);
  if (!turnos || !estado || !juezId) return null;
  const ahora = estado.minuto;
  const vigente = turnos.find((t) => t.juez_id === juezId && t.desde_min <= ahora && ahora < t.hasta_min);
  return vigente && vigente.hasta_min < estado.fin_min ? vigente.hasta_min : null;
}

/**
 * Margen antes del fin de un turno en el que el servidor ya no acepta la firma del saliente
 * (la firma el entrante). Si el estado lo trae (`margen_turno_min`), vale ese; si no, el
 * mismo cálculo del servidor con su configuración por defecto: medio minuto o dos segundos reales.
 */
export function margenTurno(estado: EstadoDTO | null | undefined): number {
  const informado = (estado as (EstadoDTO & { margen_turno_min?: unknown }) | null | undefined)?.margen_turno_min;
  if (typeof informado === "number" && Number.isFinite(informado) && informado >= 0) return informado;
  const acelerar = estado?.acelerar && estado.acelerar > 0 ? estado.acelerar : 1;
  return Math.max(0.5, (acelerar * 2) / 60);
}

/** Quién toma el turno cuando termina el de este juez, y desde qué minuto. */
export function turnoEntrante(estado: EstadoDTO | null | undefined, juezId: string | null | undefined): TurnoDTO | null {
  const hasta = hastaTurno(estado, juezId);
  const turnos = turnosDe(estado);
  if (hasta == null || !turnos) return null;
  return turnos.find((t) => t.juez_id !== juezId && t.desde_min <= hasta && hasta < t.hasta_min) ?? null;
}

/** El próximo turno de este juez, si todavía no empezó. */
export function proximoTurno(estado: EstadoDTO | null | undefined, juezId: string | null | undefined): TurnoDTO | null {
  const turnos = turnosDe(estado);
  if (!turnos || !estado || !juezId) return null;
  return turnos.find((t) => t.juez_id === juezId && t.desde_min > estado.minuto && t.desde_min < estado.fin_min) ?? null;
}

/** Cobertura máxima alcanzada en el partido, si el servidor la informa. */
export function coberturaMaxima(t: TableroDTO): number | null {
  const v = t.metricas.cobertura_max_pct;
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}
