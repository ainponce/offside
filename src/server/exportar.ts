// Exportación para la carpeta entrega/: un expediente por filtración (JSON para
// verificar y Markdown para leer), el registro de auditoría y un manifiesto.
//
// Los textos que se hashean (detección cruda, instantánea, contenido de auditoría)
// se exportan como texto, tal cual se guardaron: el verificador independiente
// recalcula los hashes sin volver a serializar nada.
//
// La exportación se cierra con una entrada de auditoría que lista el hash de cada
// archivo exportado; después se escribe auditoria.jsonl (que termina en esa
// entrada) y al final el manifiesto.

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { MedidaDTO } from "../compartido/tipos.ts";
import type { Contexto } from "./contexto.ts";
import { sha256Hex } from "./evidencia.ts";
import { minuto, num, tipoTexto } from "./texto.ts";
import {
  type FilaDeteccion,
  type FilaExpediente,
  type FilaMedida,
  type FilaOrden,
  type FilaServidor,
  riesgoDe,
  todas,
} from "./repositorio.ts";
import { expedienteDTO } from "./vistas.ts";

const LUZ: Record<string, string> = { verde: "✔", ambar: "▲", roja: "✖" };
const CLASE: Record<string, string> = {
  inicial: "Medida inicial",
  ampliacion: "Ampliación",
  ratificacion: "Ratificación",
  levantamiento: "Levantamiento por reclamo",
};

function fila(celdas: (string | number | null | undefined)[]): string {
  return `| ${celdas.map((c) => (c == null || c === "" ? "—" : String(c).replaceAll("|", "\\|"))).join(" | ")} |`;
}

function medidaLegible(m: MedidaDTO): string {
  const lineas: string[] = [];
  lineas.push(`### ${m.id} · ${CLASE[m.clase] ?? m.clase}`, "");
  lineas.push(`**Pedido:** ${m.pedido}`, "");
  if (m.servidor) lineas.push(`**Servidor:** ${m.servidor.host} · ${m.servidor.ip}${m.servidor.asn != null ? ` · AS${m.servidor.asn}` : ""}${m.servidor.organizacion ? ` ${m.servidor.organizacion}` : ""}`, "");
  lineas.push("**Verificaciones**", "");
  for (const v of m.verificaciones) lineas.push(`- ${LUZ[v.luz] ?? "·"} **${v.titulo}.** ${v.detalle}`);
  lineas.push("");
  if (m.terceros.length) lineas.push(`**Sitios ajenos en la misma IP (no se bloquean):** ${m.terceros.join(", ")}`, "");
  if (m.evidencia.length) {
    lineas.push("**Evidencia**", "", fila(["Detección", "Minuto", "SHA-256 de la detección", "SHA-256 de la captura"]), fila(["---", "---", "---", "---"]));
    for (const e of m.evidencia) lineas.push(fila([e.deteccion_id, num(e.minuto, 2), e.deteccion_sha256, e.captura_sha256]));
    lineas.push("");
  }
  if (m.promocion.length) lineas.push(`**Dónde se promocionó:** ${m.promocion.map((p) => `${p.red} (${p.url})`).join(", ")}`, "");
  lineas.push(`**Huella de lo que vio el juez:** \`${m.huella}\``, "");
  if (m.decision) {
    const quien = m.decision.juez_nombre ?? "—";
    const resultado = { aprobada: "Aprobada", rechazada: "Rechazada", sin_efecto: "Sin efecto" }[m.decision.resultado];
    lineas.push(`**Decisión:** ${resultado}${m.decision.juez_nombre ? ` por ${quien}` : ""}${m.decision.minuto != null ? `, ${minuto(m.decision.minuto)} del partido` : ""}${m.decision.hora_iso ? ` (${m.decision.hora_iso})` : ""}.${m.decision.motivo ? ` Motivo: ${m.decision.motivo}` : ""}`, "");
  } else {
    lineas.push("**Decisión:** pendiente.", "");
  }
  if (m.ordenes.length) {
    lineas.push("**Órdenes**", "", fila(["Proveedor", "Tipo", "Objetivo", "Intento", "Estado", "Enviada", "Aplicada", "Fin", "Vence", "Identificador"]), fila(Array(10).fill("---")));
    for (const o of m.ordenes) {
      lineas.push(fila([o.proveedor_nombre, tipoTexto(o.tipo), o.objetivo, o.intento, o.estado.replaceAll("_", " "), num(o.enviada_min, 2), num(o.aplicada_min, 2), num(o.finalizada_min, 2), o.vence_min, `\`${o.orden_id}\``]));
    }
    lineas.push("");
  }
  return lineas.join("\n");
}

function expedienteLegible(ctx: Contexto, id: string): string {
  const e = expedienteDTO(ctx, id)!;
  const lineas: string[] = [];
  lineas.push(`# Expediente ${e.id}`, "");
  if (e.partido) lineas.push(`**Partido:** ${e.partido.nombre}${e.partido.titular_derechos ? ` · Titular de derechos: ${e.partido.titular_derechos}` : ""}`, "");
  lineas.push(`**Filtración:** marca de agua \`${e.marca}\` (prefijo ${e.prefijo}${e.origen_prefijo ? `, ${e.origen_prefijo}` : ""}).`, "");
  lineas.push(`Abierto en el ${minuto(e.abierto_min)} del partido. Los tiempos de este documento son minutos de partido.`, "");
  lineas.push("## Servidores", "", fila(["Servidor", "IP", "Organización", "Primera detección", "Detecciones", "Bloqueo propuesto", "Primer bloqueo confirmado", "Sitios ajenos en la IP"]), fila(Array(8).fill("---")));
  for (const s of e.servidores) {
    lineas.push(fila([s.host, s.ip, s.organizacion, num(s.primera_deteccion_min, 2), s.detecciones, `por ${tipoTexto(s.tipo_recomendado)}`, s.primer_bloqueo_min == null ? null : `a los ${num(s.primer_bloqueo_min, 2)} min`, s.terceros.length]));
  }
  lineas.push("", "## Medidas", "");
  for (const m of e.medidas) lineas.push(medidaLegible(m));
  lineas.push("## Aviso al titular", "", e.aviso_titular, "");
  lineas.push("## Registro de auditoría de este expediente", "", fila(["Sec.", "Minuto", "Actor", "Evento", "Hash"]), fila(Array(5).fill("---")));
  for (const a of e.auditoria) lineas.push(fila([a.seq, num(a.minuto, 2), a.actor, a.resumen, `\`${a.hash.slice(0, 16)}…\``]));
  lineas.push(
    "",
    "La integridad de este expediente se comprueba con `python3 herramientas/verificar_expediente.py <carpeta> --juzgados <claves> --registro <registro del simulador>`. Sin el registro del simulador, el verificador solo prueba que la carpeta es coherente consigo misma.",
    "",
  );
  return lineas.join("\n");
}

function expedienteVerificable(ctx: Contexto, e: FilaExpediente): unknown {
  const detecciones = todas<FilaDeteccion>(ctx.db, "SELECT * FROM detecciones WHERE expediente_id = ? ORDER BY minuto, id", e.id);
  const servidores = todas<FilaServidor>(ctx.db, "SELECT * FROM servidores WHERE expediente_id = ? ORDER BY id", e.id);
  const medidas = todas<FilaMedida>(ctx.db, "SELECT * FROM medidas WHERE expediente_id = ? ORDER BY n", e.id);
  const p = ctx.estado.partido;
  return {
    formato: "offside-expediente-v1",
    expediente: { id: e.id, marca: e.marca, prefijo: e.prefijo, origen_prefijo: e.origen_prefijo, clave: e.clave, abierto_min: e.abierto_min },
    partido: p ? { id: p.id, nombre: p.nombre, titular_derechos: p.titular_derechos ?? null, fin_min: p.fin_min } : null,
    detecciones: detecciones.map((d) => ({
      id: d.id,
      minuto: d.minuto,
      veredicto: d.veredicto,
      motivo: d.motivo,
      crudo: d.crudo,
      sha256: d.sha256,
      captura_sha256: d.captura_sha256,
      recibida_min: d.recibida_min,
      recibida_iso: d.recibida_iso,
    })),
    servidores: servidores.map((s) => ({
      host: s.host,
      ip: s.ip,
      asn: s.asn,
      organizacion: s.organizacion,
      primera_deteccion_min: s.primera_deteccion_min,
      riesgo: riesgoDe(s),
    })),
    medidas: medidas.map((m) => {
      const juez = ctx.jueces.find((j) => j.id === m.juez_id);
      return {
        id: m.id,
        clase: m.clase,
        estado: m.estado === "aprobando" ? "aprobada" : m.estado,
        creada_min: m.creada_min,
        origen_medida_id: m.origen_medida_id,
        reclamo_id: m.reclamo_id,
        instantanea: m.instantanea,
        huella: m.huella,
        decision: m.juez_id
          ? {
              juez_id: m.juez_id,
              juez_nombre: juez?.nombre ?? null,
              juzgado_id: juez?.juzgado_id ?? null,
              juzgado_nombre: juez?.juzgado_nombre ?? null,
              decidida_min: m.decidida_min,
              decidida_iso: m.decidida_iso,
              motivo: m.motivo,
            }
          : null,
        ordenes: todas<FilaOrden>(ctx.db, "SELECT * FROM ordenes WHERE medida_id = ? ORDER BY proveedor_id, intento", m.id).map((o) => ({
          orden_id: o.orden_id,
          proveedor_id: o.proveedor_id,
          tipo: o.tipo,
          objetivo: o.objetivo,
          vence_min: o.vence_min,
          juez_id: o.juez_id,
          juzgado_id: o.juzgado_id,
          firma: o.firma,
          intento: o.intento,
          estado: o.estado,
          enviada_min: o.enviada_min,
          aplicada_min: o.aplicada_min,
          finalizada_min: o.finalizada_min,
          error: o.error,
        })),
      };
    }),
    aviso_titular: expedienteDTO(ctx, e.id)!.aviso_titular,
  };
}

/** Escribe la exportación completa en `carpeta` y devuelve los archivos generados. */
export function exportar(ctx: Contexto, carpeta: string, opciones: { nota?: string } = {}): { archivos: string[] } {
  mkdirSync(carpeta, { recursive: true });
  const escritos: { nombre: string; sha256: string }[] = [];
  const escribir = (nombre: string, contenido: string) => {
    writeFileSync(join(carpeta, nombre), contenido, "utf8");
    escritos.push({ nombre, sha256: sha256Hex(contenido) });
  };

  const expedientes = todas<FilaExpediente>(ctx.db, "SELECT * FROM expedientes ORDER BY n");

  for (const e of expedientes) {
    escribir(`expediente-${e.id}.json`, JSON.stringify(expedienteVerificable(ctx, e), null, 2) + "\n");
    escribir(`expediente-${e.id}.md`, expedienteLegible(ctx, e.id));
  }

  const archivadas = todas<FilaDeteccion>(ctx.db, "SELECT * FROM detecciones WHERE expediente_id IS NULL ORDER BY minuto, id");
  escribir(
    "detecciones-archivadas.json",
    JSON.stringify(
      {
        formato: "offside-archivadas-v1",
        nota: "Detecciones que no dieron lugar a una medida, con su motivo. No se bloqueó nada por ellas.",
        detecciones: archivadas.map((d) => ({
          id: d.id,
          minuto: d.minuto,
          host: d.host,
          ip: d.ip,
          marca: d.marca,
          veredicto: d.veredicto,
          motivo: d.motivo,
          crudo: d.crudo,
          sha256: d.sha256,
          captura_sha256: d.captura_sha256,
        })),
      },
      null,
      2,
    ) + "\n",
  );

  // Cierre: la auditoría registra el hash de cada archivo antes de exportarse a sí misma.
  // Se exporta hasta el cierre: si Offside sigue en marcha y agrega entradas, quedan para la próxima.
  const cabecera = ctx.auditoria.registrar({
    minuto: ctx.estado.minuto,
    actor: "sistema",
    tipo: "exportacion",
    datos: { carpeta, expedientes: expedientes.map((e) => e.id), archivos: escritos.map((a) => ({ ...a })) },
  });
  escribir("auditoria.jsonl", ctx.auditoria.exportarJsonl(cabecera.seq));

  const p = ctx.estado.partido;
  const manifiesto = {
    formato: "offside-exportacion-v2",
    generado_iso: new Date().toISOString(),
    nota: opciones.nota ?? null,
    partido: p ? { id: p.id, nombre: p.nombre } : null,
    minuto_de_partido: ctx.estado.minuto,
    expedientes: expedientes.map((e) => e.id),
    auditoria: { entradas: cabecera.seq, cabecera: cabecera.hash },
    archivos: escritos,
    como_verificar: "python3 herramientas/verificar_expediente.py <esta carpeta> --juzgados config/jueces.demo.json",
  };
  writeFileSync(join(carpeta, "manifiesto.json"), JSON.stringify(manifiesto, null, 2) + "\n", "utf8");

  return { archivos: [...escritos.map((a) => a.nombre), "manifiesto.json"] };
}
