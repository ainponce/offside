// Reclamos de sitios afectados por un bloqueo (sección 11 del diseño).
//
// El simulador solo emite reclamos cuando un bloqueo alcanzó a un sitio legítimo,
// así que en una corrida correcta este circuito no se usa. Existe para cuando algo
// sale mal: se verifica el reclamo, y el juez de turno levanta la orden en todos
// los proveedores donde aplica y la reemplaza por un bloqueo más preciso.

import { type Contexto, alertar, juezPorId } from "./contexto.ts";
import { guardarKv, leerKv } from "./db.ts";
import { registrarEjecutor } from "./decisiones.ts";
import { type CacheDns, crearOrden, enviarOrden } from "./despacho.ts";
import { dominioRegistrable } from "./dominio.ts";
import { firmarLevantamiento, huella } from "./evidencia.ts";
import { instantaneaLevantamiento, sellos } from "./instantanea.ts";
import type { Motor } from "./motor.ts";
import {
  type FilaMedida,
  type FilaOrden,
  ejecutar,
  expedientePorId,
  idMedida,
  medidaPorId,
  ordenPorId,
  planDe,
  servidorPorId,
  siguienteN,
  todas,
  una,
} from "./repositorio.ts";
import type { ItemPlan } from "./reglas.ts";
import type { EstadoSim, ReclamoSim } from "./simulador.ts";

const dormir = (ms: number) => new Promise((ok) => setTimeout(ok, ms));

function guardarReclamo(
  ctx: Contexto,
  r: ReclamoSim,
  estado: "verificado" | "no_verificado" | "resuelto",
  medidaId: string | null,
  detalle: string,
): void {
  ejecutar(
    ctx.db,
    "INSERT INTO reclamos (id, minuto, dominio, proveedor_id, mensaje, estado, medida_id, detalle) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    r.id,
    r.minuto,
    r.dominio,
    r.proveedor,
    r.mensaje,
    estado,
    medidaId,
    detalle,
  );
  ctx.auditoria.registrar({
    minuto: r.minuto,
    actor: "sistema",
    tipo: "reclamo_recibido",
    datos: {
      reclamo_id: r.id,
      dominio: r.dominio,
      proveedor: r.proveedor,
      mensaje: r.mensaje,
      verificado: estado !== "no_verificado",
      estado,
      medida_id: medidaId,
      detalle,
    },
  });
}

async function procesarReclamo(ctx: Contexto, r: ReclamoSim, estado: EstadoSim, cache: CacheDns): Promise<void> {
  // El reclamo no trae el orden_id: hay que encontrar cuál de nuestras órdenes en ese proveedor alcanza al dominio.
  const candidatas = todas<FilaOrden>(
    ctx.db,
    "SELECT * FROM ordenes WHERE proveedor_id = ? AND estado IN ('recibida', 'aplicada', 'levantada') ORDER BY creada_min DESC",
    r.proveedor,
  );
  let activa: FilaOrden | undefined;
  let yaLevantada: FilaOrden | undefined;
  for (const o of candidatas) {
    let alcanza = false;
    if (o.tipo === "dominio") {
      alcanza = o.objetivo.toLowerCase() === r.dominio.toLowerCase();
    } else {
      let consulta = cache.get(o.objetivo);
      if (!consulta) {
        consulta = ctx.sim.dnsIp(o.objetivo);
        cache.set(o.objetivo, consulta);
      }
      alcanza = ((await consulta)?.dominios ?? []).map((d) => d.toLowerCase()).includes(r.dominio.toLowerCase());
    }
    if (!alcanza) continue;
    if (o.estado === "levantada") yaLevantada ??= o;
    else activa ??= o;
  }

  if (!activa) {
    if (yaLevantada) guardarReclamo(ctx, r, "resuelto", null, `La orden ${yaLevantada.orden_id} ya había sido levantada.`);
    else guardarReclamo(ctx, r, "no_verificado", null, "Ninguna orden activa de Offside en ese proveedor alcanza a ese dominio.");
    return;
  }

  const servidor = activa.servidor_id != null ? servidorPorId(ctx.db, activa.servidor_id) : undefined;
  const expediente = expedientePorId(ctx.db, activa.expediente_id);
  if (!servidor || !expediente) {
    guardarReclamo(ctx, r, "no_verificado", null, "La orden no tiene un expediente asociado.");
    return;
  }
  if (dominioRegistrable(r.dominio) === dominioRegistrable(servidor.host)) {
    guardarReclamo(ctx, r, "no_verificado", null, "El reclamante es el sitio alcanzado por la medida, no un tercero.");
    return;
  }

  const pendiente = una<FilaMedida>(
    ctx.db,
    "SELECT * FROM medidas WHERE clase = 'levantamiento' AND estado = 'pendiente' AND servidor_id = ?",
    servidor.id,
  );
  if (pendiente) {
    guardarReclamo(ctx, r, "verificado", pendiente.id, `Se suma al levantamiento ${pendiente.id}, que espera al juez de turno.`);
    return;
  }

  // La misma orden afecta al reclamante en todos los proveedores donde está activa.
  const aLevantar = todas<FilaOrden>(
    ctx.db,
    `SELECT * FROM ordenes WHERE servidor_id = ? AND tipo = ? AND objetivo = ? AND estado IN ('recibida', 'aplicada')
     ORDER BY proveedor_id, intento`,
    servidor.id,
    activa.tipo,
    activa.objetivo,
  );
  const reemplazo: ItemPlan[] =
    activa.tipo === "ip"
      ? aLevantar
          .filter((o) => ctx.estado.proveedores.find((p) => p.id === o.proveedor_id)?.capacidades.includes("dominio"))
          .map((o) => ({ proveedor_id: o.proveedor_id, tipo: "dominio" as const, objetivo: servidor.host }))
      : [];
  const verificacion =
    activa.tipo === "ip"
      ? `${r.dominio} comparte la IP ${activa.objetivo} con el servidor ${servidor.host}. El bloqueo por IP lo dejó sin servicio en ${aLevantar.length} proveedor${aLevantar.length === 1 ? "" : "es"}.`
      : `${r.dominio} quedó bloqueado por dominio en ${aLevantar.length} proveedor${aLevantar.length === 1 ? "" : "es"} y no es el servidor de la filtración.`;

  const n = siguienteN(ctx.db, "medidas");
  const id = idMedida(n);
  const instantanea = instantaneaLevantamiento({
    medida_id: id,
    expediente,
    servidor: { host: servidor.host, ip: servidor.ip, asn: servidor.asn, organizacion: servidor.organizacion },
    reclamo: { id: r.id, minuto: r.minuto, dominio: r.dominio, proveedor_id: r.proveedor, mensaje: r.mensaje },
    ordenes_a_levantar: aLevantar.map((o) => ({ orden_id: o.orden_id, proveedor_id: o.proveedor_id, tipo: o.tipo, objetivo: o.objetivo })),
    reemplazo,
    verificacion,
    vence_min: activa.vence_min,
    sellos: sellos(ctx.estado.partido, estado.minuto_actual),
  });
  ejecutar(
    ctx.db,
    `INSERT INTO medidas (id, n, expediente_id, servidor_id, clase, estado, creada_min, creada_iso, instantanea, huella,
       plan, vence_min, reclamo_id)
     VALUES (?, ?, ?, ?, 'levantamiento', 'pendiente', ?, ?, ?, ?, ?, ?, ?)`,
    id,
    n,
    expediente.id,
    servidor.id,
    estado.minuto_actual,
    new Date().toISOString(),
    instantanea,
    huella(instantanea),
    JSON.stringify(reemplazo),
    activa.vence_min,
    r.id,
  );
  guardarReclamo(ctx, r, "verificado", id, verificacion);
}

async function ingerirReclamos(ctx: Contexto, estado: EstadoSim): Promise<void> {
  const desde = Number(leerKv(ctx.db, "cursor_reclamos") ?? "-1000000000");
  const lote = await ctx.sim.reclamos(desde);
  const cache: CacheDns = new Map();
  let huboCambios = false;
  for (const r of [...lote.reclamos].sort((a, b) => a.minuto - b.minuto)) {
    if (una(ctx.db, "SELECT id FROM reclamos WHERE id = ?", r.id)) continue;
    await procesarReclamo(ctx, r, estado, cache);
    huboCambios = true;
  }
  guardarKv(ctx.db, "cursor_reclamos", String(lote.minuto_actual));
  if (huboCambios) ctx.alCambiar();
}

/** Lo que pasa cuando el juez de turno aprueba un levantamiento. */
async function ejecutarLevantamiento(ctx: Contexto, medidaId: string, juezId: string, fresco: EstadoSim): Promise<void> {
  const medida = medidaPorId(ctx.db, medidaId)!;
  const juez = juezPorId(ctx, juezId)!;
  const inst = JSON.parse(medida.instantanea) as {
    reclamo: { id: string; dominio: string };
    ordenes_a_levantar: { orden_id: string; proveedor_id: string }[];
  };
  // El simulador no firma el motivo, pero lo deja en su registro: ahí viaja la huella.
  const motivo = `Reclamo ${inst.reclamo.id} de ${inst.reclamo.dominio} · medida ${medida.id} · huella ${medida.huella.slice(0, 16)}`;

  const levantadas: string[] = [];
  for (const item of inst.ordenes_a_levantar) {
    const local = ordenPorId(ctx.db, item.orden_id);
    if (!local || (local.estado !== "recibida" && local.estado !== "aplicada")) continue;
    const firma = firmarLevantamiento(juez.clave_firma_demo, local.orden_id, juez.id);
    let respuesta: Awaited<ReturnType<typeof ctx.sim.levantar>> | null = null;
    for (let intento = 1; intento <= 3 && !respuesta; intento += 1) {
      try {
        respuesta = await ctx.sim.levantar(local.proveedor_id, local.orden_id, { juez_id: juez.id, firma, motivo });
      } catch {
        await dormir(150);
      }
    }
    if (respuesta && (respuesta.ok || respuesta.estado === 409)) {
      ejecutar(
        ctx.db,
        "UPDATE ordenes SET estado = 'levantada', finalizada_min = ? WHERE orden_id = ?",
        fresco.minuto_actual,
        local.orden_id,
      );
      ctx.auditoria.registrar({
        minuto: fresco.minuto_actual,
        actor: juez.id,
        tipo: "orden_levantada",
        datos: {
          orden_id: local.orden_id,
          proveedor: local.proveedor_id,
          tipo: local.tipo,
          objetivo: local.objetivo,
          reclamo_id: inst.reclamo.id,
          medida_id: medida.id,
          huella: medida.huella,
        },
      });
      levantadas.push(local.orden_id);
    } else {
      const error = respuesta && !respuesta.ok ? respuesta.error : "sin respuesta del proveedor";
      ctx.auditoria.registrar({
        minuto: fresco.minuto_actual,
        actor: "sistema",
        tipo: "levantamiento_fallido",
        datos: { orden_id: local.orden_id, proveedor: local.proveedor_id, error },
      });
      alertar(ctx, `No se pudo levantar ${local.orden_id} en ${local.proveedor_id}: ${error}`);
    }
  }

  const reemplazos: string[] = [];
  for (const item of planDe(medida)) {
    if (!("tipo" in item)) continue;
    reemplazos.push(
      crearOrden(ctx, {
        medida,
        proveedor_id: item.proveedor_id,
        tipo: item.tipo,
        objetivo: item.objetivo,
        juez,
        minuto: fresco.minuto_actual,
      }),
    );
  }
  const cache: CacheDns = new Map();
  await Promise.all(reemplazos.map((id) => enviarOrden(ctx, id, fresco, cache)));

  ejecutar(ctx.db, "UPDATE reclamos SET estado = 'resuelto' WHERE medida_id = ?", medida.id);
  ctx.auditoria.registrar({
    minuto: fresco.minuto_actual,
    actor: juez.id,
    tipo: "levantamiento",
    datos: {
      reclamo_id: inst.reclamo.id,
      medida_id: medida.id,
      huella: medida.huella,
      ordenes_levantadas: levantadas,
      ordenes_de_reemplazo: reemplazos,
    },
  });
}

/** Enchufa los reclamos al motor y registra qué hace aprobar un levantamiento. */
export function instalarReclamos(motor: Motor): void {
  motor.agregarPaso(ingerirReclamos);
  registrarEjecutor("levantamiento", ejecutarLevantamiento);
}
