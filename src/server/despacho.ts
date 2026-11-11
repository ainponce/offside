// Despacho de órdenes a los proveedores: creación firmada, guardia final antes de
// cada envío (sección 7.7 del diseño), envío, y pedido de ratificación cuando el
// juez que firmó ya no está de turno.

import { type Contexto, type Juez, alertar } from "./contexto.ts";
import { esMismoOSubdominio } from "./dominio.ts";
import { firmarOrden, huella, ordenId } from "./evidencia.ts";
import { instantaneaRatificacion, sellos } from "./instantanea.ts";
import {
  type FilaMedida,
  type FilaOrden,
  ejecutar,
  expedientePorId,
  idMedida,
  medidaPorId,
  ordenPorId,
  planDe,
  riesgoDe,
  servidorPorId,
  siguienteN,
  una,
} from "./repositorio.ts";
import { type ItemPlan, evaluarRiesgo } from "./reglas.ts";
import type { DnsIp, EstadoSim, TipoBloqueo } from "./simulador.ts";

export type CacheDns = Map<string, Promise<DnsIp | null>>;

function mensajeDe(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

/** Próximo número de intento para ese servidor en ese proveedor. */
export function siguienteIntento(ctx: Contexto, servidorId: number | null, proveedorId: string): number {
  const fila = una<{ n: number | null }>(
    ctx.db,
    "SELECT MAX(intento) AS n FROM ordenes WHERE servidor_id IS ? AND proveedor_id = ?",
    servidorId,
    proveedorId,
  );
  return Number(fila?.n ?? 0) + 1;
}

/** Crea la orden firmada por el juez que aprobó la medida. Queda lista para enviar. */
export function crearOrden(
  ctx: Contexto,
  p: {
    medida: FilaMedida;
    proveedor_id: string;
    tipo: TipoBloqueo;
    objetivo: string;
    juez: Juez;
    minuto: number;
  },
): string {
  const expediente = expedientePorId(ctx.db, p.medida.expediente_id)!;
  const intento = siguienteIntento(ctx, p.medida.servidor_id, p.proveedor_id);
  const id = ordenId(expediente.n, p.medida.n, p.proveedor_id, intento, p.medida.huella);
  const firma = firmarOrden(p.juez.clave_firma_demo, {
    orden_id: id,
    tipo: p.tipo,
    objetivo: p.objetivo,
    vence_min: p.medida.vence_min,
    juez_id: p.juez.id,
  });
  ejecutar(
    ctx.db,
    `INSERT INTO ordenes (orden_id, medida_id, expediente_id, servidor_id, proveedor_id, tipo, objetivo, vence_min,
       juez_id, juzgado_id, firma, intento, estado, creada_min)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'por_enviar', ?)`,
    id,
    p.medida.id,
    p.medida.expediente_id,
    p.medida.servidor_id,
    p.proveedor_id,
    p.tipo,
    p.objetivo,
    p.medida.vence_min,
    p.juez.id,
    p.juez.juzgado_id,
    firma,
    intento,
    p.minuto,
  );
  return id;
}

/** 7.7 — Última comprobación del objetivo. Devuelve el motivo si NO hay que enviar. */
async function guardiaObjetivo(ctx: Contexto, orden: FilaOrden, cache: CacheDns): Promise<string | null> {
  const partido = ctx.estado.partido;
  if (!partido) return "Todavía no se conocen los datos del partido.";
  const dominiosLic = partido.licenciatarios.flatMap((l) => l.dominios_autorizados);

  if (orden.tipo === "dominio") {
    return dominiosLic.some((d) => esMismoOSubdominio(orden.objetivo, d))
      ? `El objetivo ${orden.objetivo} es un dominio autorizado de un licenciatario.`
      : null;
  }

  const servidor = orden.servidor_id != null ? servidorPorId(ctx.db, orden.servidor_id) : undefined;
  if (!servidor) return "La orden por IP no tiene un servidor asociado.";
  if (riesgoDe(servidor).simulacro) return null; // Error forzado y rotulado, solo para el video.

  let consulta = cache.get(orden.objetivo);
  if (!consulta) {
    consulta = ctx.sim.dnsIp(orden.objetivo);
    cache.set(orden.objetivo, consulta);
  }
  const dnsIp = await consulta;
  const riesgo = evaluarRiesgo(
    { id: "", minuto: 0, host_stream: servidor.host, ip_servidor: orden.objetivo, asn: servidor.asn },
    dnsIp,
    null,
    partido,
    ctx.config.terminosCompartida,
  );
  return riesgo.tipo_recomendado === "ip" ? null : riesgo.motivo;
}

function noEnviar(ctx: Contexto, orden: FilaOrden, minuto: number, motivo: string): void {
  ejecutar(ctx.db, "UPDATE ordenes SET estado = 'no_enviada', error = ? WHERE orden_id = ?", motivo, orden.orden_id);
  ctx.auditoria.registrar({
    minuto,
    actor: "sistema",
    tipo: "orden_no_enviada",
    datos: { orden_id: orden.orden_id, proveedor: orden.proveedor_id, motivo },
  });
}

function anotarCorte(ctx: Contexto, orden: FilaOrden, minuto: number, error: string): void {
  ejecutar(ctx.db, "UPDATE ordenes SET error = ? WHERE orden_id = ?", error, orden.orden_id);
  if (orden.error == null) {
    ctx.auditoria.registrar({
      minuto,
      actor: "sistema",
      tipo: "envio_con_corte",
      datos: { orden_id: orden.orden_id, proveedor: orden.proveedor_id, error },
    });
  }
}

function marcarRecibida(ctx: Contexto, orden: FilaOrden, minuto: number, yaRecibida: boolean): void {
  ejecutar(
    ctx.db,
    "UPDATE ordenes SET estado = 'recibida', enviada_min = ?, error = NULL WHERE orden_id = ?",
    minuto,
    orden.orden_id,
  );
  ctx.auditoria.registrar({
    minuto,
    actor: "sistema",
    tipo: "orden_enviada",
    datos: {
      orden_id: orden.orden_id,
      medida_id: orden.medida_id,
      expediente_id: orden.expediente_id,
      proveedor: orden.proveedor_id,
      tipo: orden.tipo,
      objetivo: orden.objetivo,
      vence_min: orden.vence_min,
      juez_id: orden.juez_id,
      intento: orden.intento,
      ya_recibida: yaRecibida,
    },
  });
}

/**
 * Envía una orden que está `por_enviar`. Un corte de red la deja `por_enviar`
 * para que el motor la reintente con el mismo `orden_id`; un 409 significa que el
 * proveedor ya la tenía.
 */
export async function enviarOrden(
  ctx: Contexto,
  id: string,
  fresco?: EstadoSim,
  cache: CacheDns = new Map(),
): Promise<void> {
  if (ctx.enVuelo.has(id)) return;
  ctx.enVuelo.add(id);
  try {
    const orden = ordenPorId(ctx.db, id);
    if (!orden || orden.estado !== "por_enviar") return;

    let estado = fresco;
    if (!estado) {
      try {
        estado = await ctx.sim.estado();
      } catch (e) {
        anotarCorte(ctx, orden, ctx.estado.minuto, mensajeDe(e));
        return;
      }
    }
    const minuto = estado.minuto_actual;

    if (estado.finalizado || orden.vence_min <= minuto) {
      noEnviar(ctx, orden, minuto, "El partido terminó antes del envío.");
      return;
    }
    if (!estado.jueces_de_turno.includes(orden.juez_id)) {
      noEnviar(ctx, orden, minuto, "El juez que firmó ya no está de turno.");
      pedirRatificacion(ctx, orden, minuto, "El envío quedó pendiente al cambiar el turno.");
      return;
    }

    let motivo: string | null;
    try {
      motivo = await guardiaObjetivo(ctx, orden, cache);
    } catch (e) {
      anotarCorte(ctx, orden, minuto, mensajeDe(e));
      return;
    }
    if (motivo) {
      noEnviar(ctx, orden, minuto, `Guardia final: ${motivo}`);
      alertar(ctx, `No se envió ${orden.orden_id}: ${motivo}`);
      return;
    }

    // Si un intento anterior terminó en un corte, puede que la orden haya llegado igual.
    // Se le pregunta al proveedor antes de reenviar: un duplicado quedaría como rechazo en su registro.
    if (orden.error != null) {
      let yaLlego = false;
      try {
        yaLlego = (await ctx.sim.ordenes(orden.proveedor_id)).some((o) => o.orden_id === orden.orden_id);
      } catch (e) {
        anotarCorte(ctx, orden, minuto, mensajeDe(e));
        return;
      }
      if (yaLlego) {
        marcarRecibida(ctx, orden, minuto, true);
        return;
      }
    }

    let respuesta;
    try {
      respuesta = await ctx.sim.enviarOrden(orden.proveedor_id, {
        orden_id: orden.orden_id,
        expediente_id: orden.expediente_id,
        tipo: orden.tipo,
        objetivo: orden.objetivo,
        vence_min: orden.vence_min,
        juzgado_id: orden.juzgado_id,
        juez_id: orden.juez_id,
        firma: orden.firma,
      });
    } catch (e) {
      anotarCorte(ctx, orden, minuto, mensajeDe(e));
      return;
    }

    if (respuesta.ok || respuesta.estado === 409) {
      marcarRecibida(ctx, orden, minuto, !respuesta.ok);
    } else if (respuesta.estado >= 500) {
      anotarCorte(ctx, orden, minuto, `${respuesta.estado}: ${respuesta.error}`);
    } else {
      ejecutar(
        ctx.db,
        "UPDATE ordenes SET estado = 'rechazada', error = ? WHERE orden_id = ?",
        respuesta.error,
        orden.orden_id,
      );
      ctx.auditoria.registrar({
        minuto,
        actor: orden.proveedor_id,
        tipo: "orden_rechazada",
        datos: { orden_id: orden.orden_id, estado: respuesta.estado, error: respuesta.error },
      });
      alertar(ctx, `El proveedor ${orden.proveedor_id} rechazó ${orden.orden_id}: ${respuesta.error}`);
    }
  } finally {
    ctx.enVuelo.delete(id);
    ctx.alCambiar();
  }
}

/** Medida original que ejecuta una orden (salta las ratificaciones intermedias). */
function medidaOrigen(ctx: Contexto, medidaId: string): FilaMedida {
  let m = medidaPorId(ctx.db, medidaId)!;
  while (m.clase === "ratificacion" && m.origen_medida_id) {
    const anterior = medidaPorId(ctx.db, m.origen_medida_id);
    if (!anterior) break;
    m = anterior;
  }
  return m;
}

/**
 * El juez que firmó ya no está de turno: la orden no puede salir con su firma.
 * Se crea (o se amplía) una medida de ratificación para el juez entrante.
 */
export function pedirRatificacion(ctx: Contexto, orden: FilaOrden, minuto: number, motivo: string): void {
  if (orden.servidor_id == null) return;
  const servidor = servidorPorId(ctx.db, orden.servidor_id)!;
  const expediente = expedientePorId(ctx.db, orden.expediente_id)!;
  const origen = medidaOrigen(ctx, orden.medida_id);
  const item: ItemPlan = { proveedor_id: orden.proveedor_id, tipo: orden.tipo, objetivo: orden.objetivo };

  const pendiente = una<FilaMedida>(
    ctx.db,
    "SELECT * FROM medidas WHERE clase = 'ratificacion' AND estado = 'pendiente' AND servidor_id = ?",
    orden.servidor_id,
  );
  const plan = pendiente ? planDe(pendiente) : [];
  if (plan.some((i) => i.proveedor_id === item.proveedor_id)) return;
  plan.push(item);

  const n = pendiente ? pendiente.n : siguienteN(ctx.db, "medidas");
  const id = pendiente ? pendiente.id : idMedida(n);
  const instantanea = instantaneaRatificacion({
    medida_id: id,
    expediente,
    servidor: { host: servidor.host, ip: servidor.ip, asn: servidor.asn, organizacion: servidor.organizacion },
    origen,
    plan,
    motivo,
    vence_min: orden.vence_min,
    sellos: sellos(ctx.estado.partido, minuto),
  });
  const h = huella(instantanea);

  if (pendiente) {
    ejecutar(
      ctx.db,
      "UPDATE medidas SET instantanea = ?, huella = ?, plan = ? WHERE id = ?",
      instantanea,
      h,
      JSON.stringify(plan),
      id,
    );
  } else {
    ejecutar(
      ctx.db,
      `INSERT INTO medidas (id, n, expediente_id, servidor_id, clase, estado, creada_min, creada_iso, instantanea,
         huella, plan, vence_min, origen_medida_id)
       VALUES (?, ?, ?, ?, 'ratificacion', 'pendiente', ?, ?, ?, ?, ?, ?, ?)`,
      id,
      n,
      expediente.id,
      orden.servidor_id,
      minuto,
      new Date().toISOString(),
      instantanea,
      h,
      JSON.stringify(plan),
      orden.vence_min,
      origen.id,
    );
  }
  ctx.auditoria.registrar({
    minuto,
    actor: "sistema",
    tipo: "ratificacion_solicitada",
    datos: {
      medida_id: id,
      origen_medida_id: origen.id,
      expediente_id: expediente.id,
      proveedor: orden.proveedor_id,
      orden_sin_efecto: orden.orden_id,
      huella: h,
      motivo,
    },
  });
}
