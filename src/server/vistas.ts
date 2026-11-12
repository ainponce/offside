// Arma las respuestas de la API (los DTO de src/compartido/tipos.ts) a partir de la base.
// Acá vive todo el texto que lee el juez: verificaciones, pedido y resúmenes.

import type {
  AuditoriaItemDTO,
  ColaDTO,
  EstadoCelda,
  EstadoDTO,
  EstadoMedida,
  ExpedienteDTO,
  ExpedienteResumenDTO,
  MedidaDTO,
  OrdenDTO,
  PlanItemDTO,
  ServidorDTO,
  TableroDTO,
  TransparenciaDTO,
  UsuarioDTO,
  VerificacionDTO,
} from "../compartido/tipos.ts";
import { type Contexto, nombreProveedor } from "./contexto.ts";
import {
  type FilaDeteccion,
  type FilaExpediente,
  type FilaMedida,
  type FilaOrden,
  type FilaReclamo,
  type FilaServidor,
  expedientePorId,
  planDe,
  riesgoDe,
  todas,
  una,
} from "./repositorio.ts";
import type { ItemPlan } from "./reglas.ts";
import type { UsuarioBase } from "./sesiones.ts";
import { deObjetivo, lista, minuto, objetivoTexto, plural, tipoTexto } from "./texto.ts";

const redondear = (n: number, decimales = 2) => {
  const f = 10 ** decimales;
  return Math.round(n * f) / f;
};
const corta = (huella: string | null | undefined) => (huella ? huella.slice(0, 12) : "sin huella");
const CLASE_TEXTO: Record<string, string> = {
  inicial: "medida inicial",
  ampliacion: "ampliación",
  ratificacion: "ratificación",
  levantamiento: "levantamiento por reclamo",
};

function nombreJuez(ctx: Contexto, id: string | null | undefined): string | null {
  if (!id) return null;
  return ctx.jueces.find((j) => j.id === id)?.nombre ?? id;
}



// --- estado y usuario --------------------------------------------------------------------

export function estadoDTO(ctx: Contexto, seq: number): EstadoDTO {
  const e = ctx.estado;
  return {
    conectado: e.conectado,
    ultimo_error: e.ultimo_error,
    partido: e.partido
      ? { id: e.partido.id, nombre: e.partido.nombre, titular_derechos: e.partido.titular_derechos ?? null }
      : null,
    minuto: redondear(e.minuto),
    fin_min: e.fin_min,
    finalizado: e.finalizado,
    acelerar: e.acelerar,
    jueces_de_turno: e.jueces_de_turno.map((id) => {
      const j = ctx.jueces.find((x) => x.id === id);
      return { id, nombre: j?.nombre ?? id, juzgado_nombre: j?.juzgado_nombre ?? "" };
    }),
    turnos: e.turnos.map((t) => ({ juez_id: t.juez_id, nombre: t.nombre, desde_min: t.desde_min, hasta_min: t.hasta_min })),
    alertas: e.alertas,
    simulacro: ctx.config.simulacro,
    seq,
  };
}

export function usuarioDTO(ctx: Contexto, u: UsuarioBase): UsuarioDTO {
  return { ...u, de_turno: u.juez_id != null && ctx.estado.jueces_de_turno.includes(u.juez_id) };
}

// --- medidas --------------------------------------------------------------------------------

function ordenDTO(ctx: Contexto, o: FilaOrden): OrdenDTO {
  return {
    orden_id: o.orden_id,
    proveedor_id: o.proveedor_id,
    proveedor_nombre: nombreProveedor(ctx, o.proveedor_id),
    tipo: o.tipo,
    objetivo: o.objetivo,
    vence_min: o.vence_min,
    juez_id: o.juez_id,
    intento: o.intento,
    estado: o.estado,
    enviada_min: o.enviada_min,
    aplicada_min: o.aplicada_min,
    finalizada_min: o.finalizada_min,
    error: o.error,
  };
}

function planDTO(ctx: Contexto, plan: ItemPlan[]): PlanItemDTO[] {
  const total = ctx.estado.proveedores.reduce((a, p) => a + p.clientes, 0);
  return plan.map((item) => {
    const p = ctx.estado.proveedores.find((x) => x.id === item.proveedor_id);
    const clientes = p?.clientes ?? 0;
    const base = {
      proveedor_id: item.proveedor_id,
      proveedor_nombre: p?.nombre ?? item.proveedor_id,
      clientes,
      clientes_pct: total > 0 ? redondear((100 * clientes) / total, 1) : 0,
    };
    return "tipo" in item
      ? { ...base, tipo: item.tipo, objetivo: item.objetivo, sin_cobertura: null }
      : { ...base, tipo: null, objetivo: null, sin_cobertura: item.sin_cobertura };
  });
}

function verificacionesBloqueo(inst: any): VerificacionDTO[] {
  const f = inst.filtracion ?? {};
  const s = inst.servidor ?? {};
  const r = inst.riesgo ?? {};
  const primera = (inst.evidencia ?? [])[0] ?? {};
  const terceros: string[] = r.terceros ?? [];
  const advertencias: string[] = [...(r.advertencias ?? [])];
  if (!primera.captura_sha256) advertencias.push("La detección no trae una captura válida.");
  else if (primera.formato_ok === false) advertencias.push("La captura no tiene el formato esperado.");

  const senal: VerificacionDTO = {
    clave: "senal",
    luz: "verde",
    titulo: "Es la señal oficial del partido",
    detalle: `La marca ${f.marca} lleva el prefijo ${f.prefijo}${f.origen_prefijo ? ` (${f.origen_prefijo})` : ""}.`,
  };
  const licenciatario: VerificacionDTO = {
    clave: "licenciatario",
    luz: "verde",
    titulo: "No es un licenciatario en su dominio",
    detalle: `${s.host} no es un dominio autorizado. ${f.motivo ?? ""}`.trim(),
  };
  const servidor: VerificacionDTO = {
    clave: "servidor",
    luz: advertencias.length ? "ambar" : "verde",
    titulo: advertencias.length ? "Servidor identificado, con advertencias" : "Servidor identificado",
    detalle: [
      `${s.host} · ${s.ip}${s.asn != null ? ` · AS${s.asn}` : ""}${s.organizacion ? ` ${s.organizacion}` : ""}.`,
      ...advertencias,
    ].join(" "),
  };

  let colateral: VerificacionDTO;
  if (r.simulacro) {
    colateral = {
      clave: "colateral",
      luz: "roja",
      titulo: "Simulacro: bloqueo por IP sobre una IP compartida",
      detalle: `Afectaría a ${plural(terceros.length, "sitio ajeno", "sitios ajenos")}: ${terceros.join(", ")}. Es un error forzado para mostrar los reclamos.`,
    };
  } else if (r.tipo_recomendado === "ip") {
    colateral = { clave: "colateral", luz: "verde", titulo: "IP exclusiva del operador", detalle: r.motivo ?? "" };
  } else if (terceros.length > 0) {
    const muestra = terceros.slice(0, 3).join(", ") + (terceros.length > 3 ? ` y ${terceros.length - 3} más` : "");
    colateral = {
      clave: "colateral",
      luz: "verde",
      titulo: "IP compartida: se bloquea solo el dominio",
      detalle: `La IP aloja ${plural(terceros.length, "sitio ajeno", "sitios ajenos")} (${muestra}). Ninguno queda afectado.`,
    };
  } else {
    colateral = { clave: "colateral", luz: "verde", titulo: "Se bloquea solo el dominio", detalle: r.motivo ?? "" };
  }
  return [senal, licenciatario, servidor, colateral];
}

function verificacionesRatificacion(ctx: Contexto, inst: any): VerificacionDTO[] {
  const o = inst.origen ?? {};
  const s = inst.servidor ?? {};
  return [
    {
      clave: "senal",
      luz: "verde",
      titulo: "Medida ya aprobada",
      detalle: `${nombreJuez(ctx, o.juez_id) ?? "El juez saliente"} aprobó la medida ${o.medida_id} en el ${minuto(o.decidida_min ?? 0)}. Huella ${corta(o.huella)}.`,
    },
    {
      clave: "licenciatario",
      luz: "verde",
      titulo: "Misma filtración",
      detalle: `Expediente ${inst.expediente_id}, marca ${inst.filtracion?.marca}.`,
    },
    {
      clave: "servidor",
      luz: "verde",
      titulo: "Mismo servidor y mismo objetivo",
      detalle: `${s.host} · ${s.ip}. Se reenvía exactamente lo aprobado.`,
    },
    {
      clave: "colateral",
      luz: "verde",
      titulo: "Sin cambios en el riesgo colateral",
      detalle: "El tipo de bloqueo y el objetivo son los de la medida original; la guardia final vuelve a comprobarlos antes de enviar.",
    },
  ];
}

function verificacionesLevantamiento(ctx: Contexto, inst: any): VerificacionDTO[] {
  const rc = inst.reclamo ?? {};
  const s = inst.servidor ?? {};
  const aLevantar: any[] = inst.ordenes_a_levantar ?? [];
  const reemplazo: any[] = (inst.plan ?? []).filter((i: any) => i.tipo);
  return [
    {
      clave: "senal",
      luz: "verde",
      titulo: "Reclamo verificado",
      detalle: inst.verificacion ?? `${rc.dominio} está detrás de un bloqueo nuestro.`,
    },
    {
      clave: "licenciatario",
      luz: "verde",
      titulo: "El reclamante no es el sitio pirata",
      detalle: `${rc.dominio} no pertenece al operador de ${s.host}.`,
    },
    {
      clave: "servidor",
      luz: "verde",
      titulo: `Se ${aLevantar.length === 1 ? "levanta 1 orden" : `levantan ${aLevantar.length} órdenes`}`,
      detalle: aLevantar.map((o) => `${nombreProveedor(ctx, o.proveedor_id)}: ${tipoTexto(o.tipo)} ${o.objetivo}`).join(" · "),
    },
    {
      clave: "colateral",
      luz: "verde",
      titulo: reemplazo.length ? "Se reemplaza por un bloqueo más preciso" : "No hace falta reemplazo",
      detalle: reemplazo.length
        ? `Bloqueo por dominio de ${reemplazo[0].objetivo} en ${plural(reemplazo.length, "proveedor", "proveedores")}: el sitio pirata sigue bloqueado y el reclamante deja de estarlo.`
        : "El sitio reclamante queda liberado.",
    },
  ];
}

export function medidaDTO(ctx: Contexto, m: FilaMedida): MedidaDTO {
  const inst = JSON.parse(m.instantanea);
  const plan = planDTO(ctx, planDe(m));
  const ordenes = todas<FilaOrden>(
    ctx.db,
    "SELECT * FROM ordenes WHERE medida_id = ? ORDER BY proveedor_id, intento",
    m.id,
  ).map((o) => ordenDTO(ctx, o));
  const estado: EstadoMedida = m.estado === "aprobando" ? "aprobada" : m.estado;
  const s = inst.servidor ?? null;
  const conDestino = plan.filter((p) => p.tipo);

  let verificaciones: VerificacionDTO[];
  let pedido: string;
  if (m.clase === "ratificacion") {
    verificaciones = verificacionesRatificacion(ctx, inst);
    pedido = `Ratificar el reenvío a ${conDestino.map((p) => p.proveedor_nombre).join(", ")}. ${inst.motivo ?? ""}`.trim();
  } else if (m.clase === "levantamiento") {
    verificaciones = verificacionesLevantamiento(ctx, inst);
    pedido = `Levantar el bloqueo que afecta a ${inst.reclamo?.dominio}${conDestino.length ? " y reemplazarlo por uno más preciso" : ""}.`;
  } else {
    verificaciones = verificacionesBloqueo(inst);
    const tipo = inst.riesgo?.tipo_recomendado === "ip" ? objetivoTexto("ip", s?.ip) : objetivoTexto("dominio", s?.host);
    pedido =
      m.clase === "ampliacion"
        ? `Ampliar el expediente a un servidor nuevo de la misma filtración: bloquear ${tipo} hasta el final del partido.`
        : `Bloquear ${tipo} en todos los proveedores hasta el final del partido.`;
  }

  const decidida = estado !== "pendiente";
  return {
    id: m.id,
    expediente_id: m.expediente_id,
    clase: m.clase,
    estado,
    creada_min: redondear(m.creada_min),
    espera_min: decidida ? 0 : redondear(Math.max(0, ctx.estado.minuto - m.creada_min)),
    marca: inst.filtracion?.marca ?? "",
    servidor: s ? { host: s.host, ip: s.ip, asn: s.asn ?? null, organizacion: s.organizacion ?? null } : null,
    verificaciones,
    pedido,
    tipo_recomendado: inst.riesgo?.tipo_recomendado ?? null,
    terceros: inst.riesgo?.terceros ?? [],
    advertencias: inst.riesgo?.advertencias ?? [],
    plan,
    vence_min: m.vence_min,
    huella: m.huella,
    evidencia: (inst.evidencia ?? []).map((e: any) => ({
      deteccion_id: e.deteccion_id,
      minuto: e.minuto,
      deteccion_sha256: e.deteccion_sha256,
      captura_sha256: e.captura_sha256 ?? null,
      formato_ok: Boolean(e.formato_ok),
      pagina: e.pagina ?? null,
      stream_url: e.stream_url ?? null,
    })),
    promocion: (inst.evidencia ?? []).flatMap((e: any) => e.promocion ?? []),
    simulacro: Boolean(inst.riesgo?.simulacro),
    ampliacion:
      m.clase === "ampliacion"
        ? {
            servidores_previos: (inst.servidores_previos ?? []).map((p: any) => ({
              host: p.host,
              ip: p.ip,
              estado: p.estado ?? null,
            })),
          }
        : null,
    ratificacion:
      m.clase === "ratificacion"
        ? {
            origen_medida_id: inst.origen?.medida_id ?? m.origen_medida_id ?? "",
            juez_original_id: inst.origen?.juez_id ?? null,
            juez_original_nombre: nombreJuez(ctx, inst.origen?.juez_id),
            decidida_min: inst.origen?.decidida_min ?? null,
            motivo: inst.motivo ?? "",
          }
        : null,
    levantamiento:
      m.clase === "levantamiento"
        ? {
            reclamo_id: inst.reclamo?.id ?? m.reclamo_id ?? "",
            dominio: inst.reclamo?.dominio ?? "",
            proveedor_id: inst.reclamo?.proveedor_id ?? "",
            proveedor_nombre: nombreProveedor(ctx, inst.reclamo?.proveedor_id ?? ""),
            mensaje: inst.reclamo?.mensaje ?? "",
            verificacion: inst.verificacion ?? "",
            ordenes_a_levantar: (inst.ordenes_a_levantar ?? []).map((o: any) => ({
              orden_id: o.orden_id,
              proveedor_id: o.proveedor_id,
              proveedor_nombre: nombreProveedor(ctx, o.proveedor_id),
              tipo: o.tipo,
              objetivo: o.objetivo,
            })),
          }
        : null,
    decision: decidida
      ? {
          juez_id: m.juez_id,
          juez_nombre: nombreJuez(ctx, m.juez_id),
          minuto: m.decidida_min == null ? null : redondear(m.decidida_min),
          hora_iso: m.decidida_iso,
          resultado: estado as "aprobada" | "rechazada" | "sin_efecto",
          motivo: m.motivo,
        }
      : null,
    ordenes,
  };
}

export function colaDTO(ctx: Contexto, u: UsuarioBase, seq: number): ColaDTO {
  // Un levantamiento va primero: hay un sitio legítimo caído ahora mismo.
  const pendientes = todas<FilaMedida>(
    ctx.db,
    "SELECT * FROM medidas WHERE estado = 'pendiente' ORDER BY CASE clase WHEN 'levantamiento' THEN 0 ELSE 1 END, n",
  );
  const recientes = todas<FilaMedida>(
    ctx.db,
    "SELECT * FROM medidas WHERE estado <> 'pendiente' ORDER BY COALESCE(decidida_min, creada_min) DESC, n DESC LIMIT 20",
  );
  return {
    estado: estadoDTO(ctx, seq),
    yo: usuarioDTO(ctx, u),
    pendientes: pendientes.map((m) => medidaDTO(ctx, m)),
    recientes: recientes.map((m) => medidaDTO(ctx, m)),
  };
}

// --- expedientes y tablero ---------------------------------------------------------------------

const PRIORIDAD: Record<string, number> = {
  aplicada: 8,
  recibida: 7,
  por_enviar: 6,
  levantada: 5,
  vencida: 4,
  fallida: 3,
  no_enviada: 2,
  rechazada: 1,
};

/**
 * El mayor porcentaje de clientes con el bloqueo aplicado a la vez. Cada orden
 * cuenta desde que el proveedor la aplicó hasta que venció o se levantó.
 */
function coberturaMaxima(ctx: Contexto, ordenes: FilaOrden[], total: number): number {
  if (total <= 0) return 0;
  const tramos = ordenes
    .filter((o) => o.aplicada_min != null)
    .map((o) => ({
      proveedor: o.proveedor_id,
      desde: o.aplicada_min!,
      hasta: o.finalizada_min ?? (o.estado === "aplicada" ? Number.POSITIVE_INFINITY : o.vence_min),
    }))
    .filter((t) => t.hasta > t.desde);
  let maximo = 0;
  for (const instante of new Set(tramos.map((t) => t.desde))) {
    const proveedores = new Set(tramos.filter((t) => t.desde <= instante && instante < t.hasta).map((t) => t.proveedor));
    const clientes = ctx.estado.proveedores.filter((p) => proveedores.has(p.id)).reduce((a, p) => a + p.clientes, 0);
    maximo = Math.max(maximo, clientes);
  }
  return redondear((100 * maximo) / total, 1);
}

function servidorDTO(ctx: Contexto, s: FilaServidor): ServidorDTO {
  const riesgo = riesgoDe(s);
  const medida = una<FilaMedida>(
    ctx.db,
    "SELECT * FROM medidas WHERE servidor_id = ? AND clase IN ('inicial', 'ampliacion') ORDER BY n DESC LIMIT 1",
    s.id,
  );
  const ordenes = todas<FilaOrden>(ctx.db, "SELECT * FROM ordenes WHERE servidor_id = ?", s.id);
  const detecciones = una<{ n: number }>(ctx.db, "SELECT COUNT(*) AS n FROM detecciones WHERE servidor_id = ?", s.id);
  const plan = medida ? planDe(medida) : [];
  const total = ctx.estado.proveedores.reduce((a, p) => a + p.clientes, 0);

  let cubiertos = 0;
  const porProveedor = ctx.estado.proveedores.map((p) => {
    const propias = ordenes.filter((o) => o.proveedor_id === p.id);
    const mejor = propias.sort((a, b) => (PRIORIDAD[b.estado] ?? 0) - (PRIORIDAD[a.estado] ?? 0) || b.intento - a.intento)[0];
    if (mejor) {
      if (mejor.estado === "aplicada") cubiertos += p.clientes;
      return { proveedor_id: p.id, estado: mejor.estado as EstadoCelda, tipo: mejor.tipo, intento: mejor.intento };
    }
    const item = plan.find((i) => i.proveedor_id === p.id);
    const sinCobertura = item && !("tipo" in item);
    return {
      proveedor_id: p.id,
      estado: (sinCobertura ? "sin_cobertura" : "sin_orden") as EstadoCelda,
      tipo: item && "tipo" in item ? item.tipo : null,
      intento: 0,
    };
  });

  const aplicadas = ordenes.map((o) => o.aplicada_min).filter((x): x is number => x != null);
  const actual = total > 0 ? redondear((100 * cubiertos) / total, 1) : 0;
  return {
    id: s.id,
    host: s.host,
    ip: s.ip,
    asn: s.asn,
    organizacion: s.organizacion,
    tipo_recomendado: riesgo.tipo_recomendado,
    terceros: riesgo.terceros,
    primera_deteccion_min: s.primera_deteccion_min,
    detecciones: Number(detecciones?.n ?? 0),
    medida_id: medida?.id ?? null,
    medida_clase: medida?.clase ?? null,
    medida_estado: medida ? (medida.estado === "aprobando" ? "aprobada" : medida.estado) : null,
    primer_bloqueo_min: aplicadas.length ? redondear(Math.max(0, Math.min(...aplicadas) - s.primera_deteccion_min)) : null,
    cobertura_pct: actual,
    cobertura_max_pct: Math.max(actual, coberturaMaxima(ctx, ordenes, total)),
    por_proveedor: porProveedor,
  };
}

function expedienteResumen(ctx: Contexto, e: FilaExpediente): ExpedienteResumenDTO {
  const servidores = todas<FilaServidor>(ctx.db, "SELECT * FROM servidores WHERE expediente_id = ? ORDER BY id", e.id).map(
    (s) => servidorDTO(ctx, s),
  );
  const celdas = servidores.flatMap((s) => s.por_proveedor.map((c) => c.estado));
  const estados = servidores.map((s) => s.medida_estado);
  let estado: ExpedienteResumenDTO["estado"];
  if (celdas.some((c) => c === "aplicada" || c === "recibida" || c === "por_enviar")) estado = "activo";
  else if (estados.includes("pendiente")) estado = "pendiente";
  else if (estados.length > 0 && estados.every((x) => x === "rechazada")) estado = "rechazado";
  else estado = "cerrado";
  return {
    id: e.id,
    marca: e.marca,
    prefijo: e.prefijo,
    origen_prefijo: e.origen_prefijo,
    abierto_min: redondear(e.abierto_min),
    estado,
    servidores,
  };
}

function resumirEvento(ctx: Contexto, tipo: string, actor: string, d: any): string {
  const prov = (id: string | null | undefined) => (id ? nombreProveedor(ctx, id) : "un proveedor");
  const juez = (id: string | null | undefined) => nombreJuez(ctx, id) ?? id ?? "Un juez";
  const quien = () => {
    if (actor === "sistema") return "Offside";
    const j = ctx.jueces.find((x) => x.id === actor || x.usuario === actor);
    if (j) return j.nombre;
    const p = ctx.estado.proveedores.find((x) => x.id === actor);
    return p?.nombre ?? actor;
  };
  const bloqueo = (t: string | null | undefined, objetivo: string | null | undefined) =>
    objetivo ? objetivoTexto(t, objetivo) : "el objetivo";
  const elBloqueo = (t: string | null | undefined, objetivo: string | null | undefined) =>
    objetivo ? `el bloqueo ${deObjetivo(t, objetivo)}` : "el bloqueo";
  const conPunto = (texto: string | null | undefined) => {
    const t = (texto ?? "").trim();
    return !t ? "" : /[.!?]$/.test(t) ? t : `${t}.`;
  };
  switch (tipo) {
    case "arranque":
      return `Offside arrancó${d.base_nueva ? " con una base nueva" : ""}${d.simulacro ? ", con el simulacro de reclamos activo" : ""}.`;
    case "ingreso": {
      const rol = d.rol === "juez" ? "como juez" : d.rol === "fiscalia" ? "como fiscalía" : "";
      return `${d.nombre ?? quien()} ingresó${rol ? ` ${rol}` : ""}.`;
    }
    case "medida_recuperada":
      return `La medida ${d.medida_id} había quedado a medio aprobar por un corte de Offside: volvió a la cola sin firmar.`;
    case "simulador_reiniciado":
      return d.minuto_anterior != null
        ? `El simulador se reinició: el reloj volvió del ${minuto(d.minuto_anterior)} al ${minuto(d.minuto_actual)}.`
        : `El simulador se reinició: ${conPunto(d.motivo) || "cambió el partido."}`;
    case "base_reiniciada":
      return `Base nueva tras el reinicio del simulador${d.archivo ? `; la anterior quedó archivada en ${d.archivo}` : ""}. Los jueces tienen que volver a ingresar.`;
    case "deteccion_archivada":
      return `Detección ${d.deteccion_id} archivada: ${conPunto(d.motivo)}`;
    case "expediente_abierto":
      return `Se abrió ${d.expediente_id} por la marca ${d.marca}.`;
    case "evidencia_agregada":
      return `Nueva evidencia en ${d.expediente_id}: detección ${d.deteccion_id}.`;
    case "medida_presentada": {
      const objetivo = d.tipo_recomendado === "ip" ? d.servidor?.ip : d.servidor?.host;
      if (d.clase === "levantamiento") {
        return `Se presentó al juez de turno el levantamiento ${d.medida_id}${d.reclamo_id ? ` por el reclamo ${d.reclamo_id}` : ""}.`;
      }
      return `Se presentó al juez de turno la ${CLASE_TEXTO[d.clase] ?? "medida"} ${d.medida_id}: bloquear ${bloqueo(d.tipo_recomendado, objetivo)}.`;
    }
    case "decision":
      return d.resultado === "aprobada"
        ? `${juez(actor)} aprobó la medida ${d.medida_id}.`
        : `${juez(actor)} rechazó la medida ${d.medida_id}${d.motivo ? `: ${conPunto(d.motivo)}` : "."}`;
    case "reconsideracion":
      return `${juez(actor)} reabrió la medida ${d.medida_id}.`;
    case "orden_firmada":
      return `${juez(d.juez_id ?? actor)} firmó la orden para ${prov(d.proveedor)}: bloquear ${bloqueo(d.tipo, d.objetivo)}${d.intento > 1 ? ` (intento ${d.intento})` : ""}.`;
    case "orden_enviada":
      return `Orden ${d.ya_recibida ? "confirmada" : "enviada"} a ${prov(d.proveedor)}: bloquear ${bloqueo(d.tipo, d.objetivo)}${d.intento > 1 ? ` (intento ${d.intento})` : ""}.`;
    case "orden_aplicada":
      return `${prov(d.proveedor)} aplicó ${elBloqueo(d.tipo, d.objetivo)}.`;
    case "orden_fallida":
      return `${prov(d.proveedor)} no pudo aplicar ${elBloqueo(d.tipo, d.objetivo)}.`;
    case "orden_vencida":
      return `Venció ${elBloqueo(d.tipo, d.objetivo)} en ${prov(d.proveedor)}.`;
    case "orden_levantada":
    case "orden_levantada_confirmada":
      return `Se levantó ${elBloqueo(d.tipo, d.objetivo)} en ${prov(d.proveedor)}.`;
    case "orden_rechazada":
      return `${prov(d.proveedor)} rechazó la orden ${d.orden_id}: ${conPunto(d.error)}`;
    case "orden_no_enviada":
      return `No se envió la orden a ${prov(d.proveedor)}: ${conPunto(d.motivo)}`;
    case "envio_con_corte":
      return `Se cortó la comunicación al enviar a ${prov(d.proveedor)}; se reintenta con la misma orden.`;
    case "reintento":
      return `Reenvío a ${prov(d.proveedor)} con una orden nueva tras la falla.`;
    case "reintentos_agotados":
      return `${prov(d.proveedor)} falló ${plural(d.intentos ?? 0, "vez", "veces")}: Offside dejó de reintentar.`;
    case "ratificacion_solicitada":
      return `Se pidió al juez de turno que ratifique el envío a ${prov(d.proveedor)} (${d.medida_id}).`;
    case "traspaso_turno": {
      const salen = lista((d.salientes ?? []).map((j: string) => juez(j)));
      const entran = lista((d.entrantes ?? []).map((j: string) => juez(j)));
      const pendientes = plural((d.medidas_pendientes ?? []).length, "medida pendiente", "medidas pendientes");
      return `Cambio de turno: ${salen || "nadie"} entrega a ${entran || "nadie"}, con ${pendientes}.`;
    }
    case "medida_sin_efecto":
      return `La medida ${d.medida_id} quedó sin efecto: ${conPunto(d.motivo)}`;
    case "reclamo_recibido":
      return `Reclamo ${d.reclamo_id} de ${d.dominio} en ${prov(d.proveedor)}: ${
        d.estado === "resuelto" ? "ya estaba resuelto" : d.verificado ? "verificado" : "no corresponde a un bloqueo de Offside"
      }.`;
    case "levantamiento":
      return `Levantamiento por el reclamo ${d.reclamo_id}: ${plural(d.ordenes_levantadas?.length ?? 0, "orden levantada", "órdenes levantadas")}${
        d.ordenes_de_reemplazo?.length ? ` y ${plural(d.ordenes_de_reemplazo.length, "bloqueo de reemplazo", "bloqueos de reemplazo")}` : ""
      }.`;
    case "levantamiento_fallido":
      return `No se pudo levantar la orden en ${prov(d.proveedor)}: ${conPunto(d.error)}`;
    case "partido_cerrado":
      return "Partido cerrado: no quedan órdenes activas.";
    case "exportacion":
      return `Exportación de los expedientes a ${d.carpeta}${d.archivos?.length ? ` (${plural(d.archivos.length, "archivo", "archivos")})` : ""}.`;
    case "error_interno":
      return `Error interno en ${d.paso ?? "el motor"}: ${conPunto(d.error)}`;
    default: {
      const t = String(tipo).replaceAll("_", " ");
      return `${t.charAt(0).toUpperCase()}${t.slice(1)}.`;
    }
  }
}

function auditoriaItems(ctx: Contexto, filas: { seq: number; contenido: string; hash: string }[]): AuditoriaItemDTO[] {
  return filas.map((f) => {
    const c = JSON.parse(f.contenido);
    return {
      seq: Number(f.seq),
      minuto: c.minuto == null ? null : redondear(c.minuto),
      hora_iso: c.hora_iso,
      actor: c.actor,
      tipo: c.tipo,
      resumen: resumirEvento(ctx, c.tipo, c.actor, c.datos ?? {}),
      hash: f.hash,
    };
  });
}

const VEREDICTOS_LEGITIMOS = ["licenciatario_autorizado", "no_es_la_senal", "anomalia"];

export function tableroDTO(ctx: Contexto, seq: number): TableroDTO {
  const expedientes = todas<FilaExpediente>(ctx.db, "SELECT * FROM expedientes ORDER BY n").map((e) =>
    expedienteResumen(ctx, e),
  );
  const servidores = expedientes.flatMap((e) => e.servidores);
  const tiempos = servidores.map((s) => s.primer_bloqueo_min).filter((x): x is number => x != null);
  const aprobados = servidores.filter((s) => s.medida_estado === "aprobada");
  const archivadas = todas<FilaDeteccion>(
    ctx.db,
    "SELECT * FROM detecciones WHERE expediente_id IS NULL ORDER BY minuto DESC, id DESC",
  );
  const filasServidor = todas<FilaServidor>(ctx.db, "SELECT * FROM servidores ORDER BY id");
  const sitios: string[] = [];
  for (const s of filasServidor) {
    const r = riesgoDe(s);
    if (r.tipo_recomendado !== "dominio") continue;
    for (const t of r.terceros) if (!sitios.includes(t)) sitios.push(t);
  }
  const senales: string[] = [];
  for (const d of [...archivadas].reverse()) {
    if (VEREDICTOS_LEGITIMOS.includes(d.veredicto) && d.host && !senales.includes(d.host)) senales.push(d.host);
  }
  const cuenta = (sql: string) => Number(una<{ n: number }>(ctx.db, sql)?.n ?? 0);
  const cabecera = ctx.auditoria.cabecera();
  const ultimas = todas<{ seq: number; contenido: string; hash: string }>(
    ctx.db,
    "SELECT seq, contenido, hash FROM auditoria ORDER BY seq DESC LIMIT 40",
  );

  return {
    estado: estadoDTO(ctx, seq),
    metricas: {
      expedientes: expedientes.length,
      medidas_pendientes: cuenta("SELECT COUNT(*) AS n FROM medidas WHERE estado = 'pendiente'"),
      detecciones: cuenta("SELECT COUNT(*) AS n FROM detecciones"),
      archivadas: archivadas.length,
      ordenes_activas: cuenta("SELECT COUNT(*) AS n FROM ordenes WHERE estado IN ('recibida', 'aplicada')"),
      tiempo_medio_primer_bloqueo_min: tiempos.length ? redondear(tiempos.reduce((a, b) => a + b, 0) / tiempos.length) : null,
      cobertura_media_pct: aprobados.length
        ? redondear(aprobados.reduce((a, s) => a + s.cobertura_pct, 0) / aprobados.length, 1)
        : null,
      cobertura_max_pct: aprobados.length
        ? redondear(aprobados.reduce((a, s) => a + s.cobertura_max_pct, 0) / aprobados.length, 1)
        : null,
      reclamos: cuenta("SELECT COUNT(*) AS n FROM reclamos"),
      dano_evitado: { sitios, senales_legitimas: senales },
    },
    proveedores: ctx.estado.proveedores.map((p) => ({
      id: p.id,
      nombre: p.nombre,
      clientes: p.clientes,
      capacidades: p.capacidades,
    })),
    expedientes,
    archivadas: archivadas.map((d) => ({
      deteccion_id: d.id,
      minuto: d.minuto,
      host: d.host,
      ip: d.ip,
      marca: d.marca,
      veredicto: d.veredicto,
      motivo: d.motivo,
    })),
    reclamos: todas<FilaReclamo>(ctx.db, "SELECT * FROM reclamos ORDER BY minuto DESC").map((r) => ({
      id: r.id,
      minuto: r.minuto,
      dominio: r.dominio,
      proveedor_id: r.proveedor_id,
      proveedor_nombre: nombreProveedor(ctx, r.proveedor_id),
      mensaje: r.mensaje,
      estado: r.estado,
      medida_id: r.medida_id,
    })),
    auditoria: { entradas: cabecera.seq, cabecera: cabecera.hash, ultimas: auditoriaItems(ctx, ultimas) },
  };
}

export function avisoTitular(ctx: Contexto, e: FilaExpediente, servidores: { host: string; ip: string }[]): string {
  const titular = ctx.estado.partido?.titular_derechos?.trim();
  const servidoresTexto = lista(servidores.map((s) => `${s.host} (IP ${s.ip})`));
  return [
    `Aviso al titular de los derechos${titular ? ` (${titular})` : ""} — Expediente ${e.id}.`,
    `La señal con marca de agua ${e.marca} se está retransmitiendo sin autorización desde ${plural(servidores.length, "servidor", "servidores")}: ${servidoresTexto}.`,
    "Esa marca identifica de dónde sale la filtración. Se solicita ubicar la fuente asociada y cortarla: es la única medida que el operador no esquiva cambiando de servidor y que no puede afectar a terceros.",
    "Nota: el simulador del desafío no modela este paso; el aviso se genera pero no tiene a quién enviarse.",
  ].join("\n");
}

export function expedienteDTO(ctx: Contexto, id: string, seq = 0): ExpedienteDTO | null {
  const e = expedientePorId(ctx.db, id);
  if (!e) return null;
  const resumen = expedienteResumen(ctx, e);
  const medidas = todas<FilaMedida>(ctx.db, "SELECT * FROM medidas WHERE expediente_id = ? ORDER BY n", id);
  const detecciones = todas<FilaDeteccion>(ctx.db, "SELECT * FROM detecciones WHERE expediente_id = ? ORDER BY minuto", id);
  const agujas = [id, ...medidas.map((m) => `"${m.id}"`), `OFS-${String(e.n).padStart(6, "0")}-`];
  const propias = todas<{ seq: number; contenido: string; hash: string }>(
    ctx.db,
    "SELECT seq, contenido, hash FROM auditoria ORDER BY seq",
  ).filter((f) => agujas.some((a) => f.contenido.includes(a)));
  const p = ctx.estado.partido;
  return {
    ...resumen,
    estado_general: estadoDTO(ctx, seq),
    partido: p ? { id: p.id, nombre: p.nombre, titular_derechos: p.titular_derechos ?? null } : null,
    medidas: medidas.map((m) => medidaDTO(ctx, m)),
    detecciones: detecciones.map((d) => ({
      id: d.id,
      minuto: d.minuto,
      host: d.host,
      ip: d.ip,
      sha256: d.sha256,
      captura_sha256: d.captura_sha256,
      formato_ok: Boolean(d.formato_ok),
      recibida_min: redondear(d.recibida_min),
      recibida_iso: d.recibida_iso,
    })),
    aviso_titular: avisoTitular(ctx, e, resumen.servidores),
    auditoria: auditoriaItems(ctx, propias),
  };
}

// --- transparencia -------------------------------------------------------------------------------

export function transparenciaDTO(ctx: Contexto, seq = 0): TransparenciaDTO {
  const ordenes = todas<FilaOrden>(
    ctx.db,
    "SELECT * FROM ordenes WHERE estado IN ('recibida', 'aplicada', 'vencida', 'levantada') ORDER BY creada_min, orden_id",
  );
  const grupos = new Map<string, FilaOrden[]>();
  for (const o of ordenes) {
    const clave = `${o.expediente_id}|${o.tipo}|${o.objetivo}`;
    grupos.set(clave, [...(grupos.get(clave) ?? []), o]);
  }
  const bloqueos: TransparenciaDTO["bloqueos"] = [];
  for (const grupo of grupos.values()) {
    const primera = grupo[0]!;
    const medida = una<FilaMedida>(ctx.db, "SELECT * FROM medidas WHERE id = ?", primera.medida_id);
    const juez = ctx.jueces.find((j) => j.id === primera.juez_id);
    const estados = grupo.map((o) => o.estado);
    const aplicadas = grupo.map((o) => o.aplicada_min).filter((x): x is number => x != null);
    const estado = estados.includes("aplicada")
      ? "vigente"
      : estados.includes("recibida")
        ? "en_curso"
        : estados.includes("levantada")
          ? "levantado"
          : "vencido";
    bloqueos.push({
      expediente_id: primera.expediente_id,
      medida_id: primera.medida_id,
      tipo: primera.tipo,
      objetivo: primera.objetivo,
      desde_min: aplicadas.length ? redondear(Math.min(...aplicadas)) : null,
      hasta_min: primera.vence_min,
      estado,
      juzgado: juez?.juzgado_nombre ?? null,
      juez: juez?.nombre ?? null,
      huella: medida?.huella ?? "",
      proveedores_confirmados: new Set(grupo.filter((o) => o.aplicada_min != null).map((o) => o.proveedor_id)).size,
      proveedores_total: new Set(grupo.map((o) => o.proveedor_id)).size,
    });
  }
  const p = ctx.estado.partido;
  const cabecera = ctx.auditoria.cabecera();
  return {
    estado: estadoDTO(ctx, seq),
    partido: p ? { id: p.id, nombre: p.nombre, titular_derechos: p.titular_derechos ?? null } : null,
    minuto: redondear(ctx.estado.minuto),
    fin_min: ctx.estado.fin_min,
    finalizado: ctx.estado.finalizado,
    bloqueos,
    auditoria: { entradas: cabecera.seq, cabecera: cabecera.hash },
    como_reclamar:
      "Si tu sitio quedó bloqueado por error, el reclamo llega al juez de turno, que puede levantar la orden en minutos. Todos los bloqueos vencen solos cuando termina el partido.",
  };
}
