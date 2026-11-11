// Decisiones del juez: aprobar, rechazar y reconsiderar una medida (sección 8 del diseño).
//
// Regla central: nada se firma si el juez no está de turno según el simulador en
// ese momento. Aprobar consulta el estado al simulador antes de firmar.

import { type Contexto, juezPorId } from "./contexto.ts";
import { type CacheDns, crearOrden, enviarOrden } from "./despacho.ts";
import { ejecutar, medidaPorId, planDe } from "./repositorio.ts";
import type { EstadoSim } from "./simulador.ts";

export type Resultado = { ok: true } | { ok: false; codigo: 403 | 404 | 409 | 503; error: string };

/** Lo que cada clase de medida hace al aprobarse. Los levantamientos se registran desde reclamos.ts. */
export type Ejecutor = (ctx: Contexto, medidaId: string, juezId: string, fresco: EstadoSim) => Promise<void>;
const ejecutores = new Map<string, Ejecutor>();

export function registrarEjecutor(clase: string, ejecutor: Ejecutor): void {
  ejecutores.set(clase, ejecutor);
}

function falla(codigo: 403 | 404 | 409 | 503, error: string): Resultado {
  return { ok: false, codigo, error };
}

export async function aprobarMedida(ctx: Contexto, medidaId: string, juezId: string): Promise<Resultado> {
  const medida = medidaPorId(ctx.db, medidaId);
  if (!medida) return falla(404, "La medida no existe.");
  const juez = juezPorId(ctx, juezId);
  if (!juez) return falla(403, "Solo un juez del registro puede firmar.");

  // Se reserva la medida antes del primer `await`: un segundo toque encuentra otro estado.
  const reservada = ejecutar(
    ctx.db,
    "UPDATE medidas SET estado = 'aprobando' WHERE id = ? AND estado = 'pendiente'",
    medidaId,
  );
  if (reservada !== 1) return falla(409, "La medida ya no está pendiente.");
  const liberar = () => ejecutar(ctx.db, "UPDATE medidas SET estado = 'pendiente' WHERE id = ?", medidaId);

  let fresco: EstadoSim;
  try {
    fresco = await ctx.sim.estado();
  } catch {
    liberar();
    return falla(503, "No se pudo confirmar el turno con el simulador. Probá de nuevo.");
  }
  if (fresco.finalizado) {
    liberar();
    return falla(409, "El partido terminó: la medida quedó sin efecto.");
  }
  if (!fresco.jueces_de_turno.includes(juezId)) {
    liberar();
    return falla(403, "Solo firma el juez de turno.");
  }

  const minuto = fresco.minuto_actual;
  ejecutar(
    ctx.db,
    "UPDATE medidas SET estado = 'aprobada', juez_id = ?, decidida_min = ?, decidida_iso = ?, motivo = NULL WHERE id = ?",
    juezId,
    minuto,
    new Date().toISOString(),
    medidaId,
  );
  ctx.auditoria.registrar({
    minuto,
    actor: juezId,
    tipo: "decision",
    datos: {
      medida_id: medidaId,
      expediente_id: medida.expediente_id,
      clase: medida.clase,
      resultado: "aprobada",
      huella: medida.huella,
      juzgado_id: juez.juzgado_id,
    },
  });

  const ejecutor = ejecutores.get(medida.clase);
  if (ejecutor) {
    await ejecutor(ctx, medidaId, juezId, fresco);
  } else {
    // inicial, ampliación y ratificación: una orden por proveedor del plan.
    const aprobada = medidaPorId(ctx.db, medidaId)!;
    const ids: string[] = [];
    for (const item of planDe(aprobada)) {
      if (!("tipo" in item)) continue;
      ids.push(
        crearOrden(ctx, {
          medida: aprobada,
          proveedor_id: item.proveedor_id,
          tipo: item.tipo,
          objetivo: item.objetivo,
          juez,
          minuto,
        }),
      );
    }
    const cache: CacheDns = new Map();
    await Promise.all(ids.map((id) => enviarOrden(ctx, id, fresco, cache)));
  }
  ctx.alCambiar();
  return { ok: true };
}

function exigirTurno(ctx: Contexto, juezId: string): Resultado | null {
  if (!juezPorId(ctx, juezId)) return falla(403, "Solo un juez del registro puede decidir.");
  if (!ctx.estado.jueces_de_turno.includes(juezId)) return falla(403, "Solo decide el juez de turno.");
  return null;
}

export async function rechazarMedida(
  ctx: Contexto,
  medidaId: string,
  juezId: string,
  motivo: string,
): Promise<Resultado> {
  const medida = medidaPorId(ctx.db, medidaId);
  if (!medida) return falla(404, "La medida no existe.");
  const sinTurno = exigirTurno(ctx, juezId);
  if (sinTurno) return sinTurno;
  const cambiada = ejecutar(
    ctx.db,
    `UPDATE medidas SET estado = 'rechazada', juez_id = ?, decidida_min = ?, decidida_iso = ?, motivo = ?
     WHERE id = ? AND estado = 'pendiente'`,
    juezId,
    ctx.estado.minuto,
    new Date().toISOString(),
    motivo || null,
    medidaId,
  );
  if (cambiada !== 1) return falla(409, "La medida ya no está pendiente.");
  ctx.auditoria.registrar({
    minuto: ctx.estado.minuto,
    actor: juezId,
    tipo: "decision",
    datos: {
      medida_id: medidaId,
      expediente_id: medida.expediente_id,
      clase: medida.clase,
      resultado: "rechazada",
      huella: medida.huella,
      motivo: motivo || null,
    },
  });
  ctx.alCambiar();
  return { ok: true };
}

/** Devuelve a la cola una medida rechazada. Protege contra un toque equivocado. */
export async function reconsiderarMedida(ctx: Contexto, medidaId: string, juezId: string): Promise<Resultado> {
  const medida = medidaPorId(ctx.db, medidaId);
  if (!medida) return falla(404, "La medida no existe.");
  const sinTurno = exigirTurno(ctx, juezId);
  if (sinTurno) return sinTurno;
  if (ctx.estado.finalizado) return falla(409, "El partido terminó.");
  const cambiada = ejecutar(
    ctx.db,
    `UPDATE medidas SET estado = 'pendiente', juez_id = NULL, decidida_min = NULL, decidida_iso = NULL, motivo = NULL
     WHERE id = ? AND estado = 'rechazada'`,
    medidaId,
  );
  if (cambiada !== 1) return falla(409, "Solo se puede reconsiderar una medida rechazada.");
  ctx.auditoria.registrar({
    minuto: ctx.estado.minuto,
    actor: juezId,
    tipo: "reconsideracion",
    datos: { medida_id: medidaId, expediente_id: medida.expediente_id, huella: medida.huella },
  });
  ctx.alCambiar();
  return { ok: true };
}
