// Las salidas de un expediente que no van a los proveedores de internet.
//
// Bloquear en los proveedores corta la señal para quien mira en el país, pero el circuito completo
// tiene más destinatarios:
//   - el titular de los derechos, que con la marca de agua puede cortar la fuente de la filtración;
//   - la CDN, cuando el pirata está detrás de una: solo ella puede bloquear en su borde y sabe cuál
//     es el servidor de origen;
//   - el hosting: en el país, un pedido de baja; en el exterior, un aviso a su contacto de abuso;
//   - cada plataforma donde se promocionó el enlace, para que baje la publicación.
//
// Offside arma cada pedido con la orden firmada y la evidencia, listo para enviar. El simulador del
// desafío no modela a estos destinatarios, así que no se envía nada: se muestra y se copia.

import type { ExpedienteDTO, MedidaDTO, SalidaDTO, ServidorDTO } from "../compartido/tipos.ts";
import type { Contexto } from "./contexto.ts";

type Base = Omit<ExpedienteDTO, "salidas">;

const RED: Record<string, string> = {
  x: "X",
  twitter: "X",
  discord: "Discord",
  telegram: "Telegram",
  facebook: "Facebook",
  instagram: "Instagram",
  youtube: "YouTube",
  tiktok: "TikTok",
  whatsapp: "WhatsApp",
  reddit: "Reddit",
  twitch: "Twitch",
};

const sinFicticio = (t: string) => t.replace(/\s*\(fictici[oa]s?\)/gi, "").trim();
const min = (m: number | null | undefined) => (m == null ? "—" : String(Math.floor(m)));

/** La medida firmada que cubre a este servidor (la última, si hay varias). */
function firmadaPara(s: ServidorDTO, medidas: MedidaDTO[]): MedidaDTO | null {
  const deEste = medidas.filter((m) => m.servidor?.host === s.host && m.servidor?.ip === s.ip && m.clase !== "levantamiento");
  const firmadas = deEste.filter((m) => m.estado === "aprobada" && m.decision?.resultado === "aprobada");
  return firmadas[firmadas.length - 1] ?? null;
}

function pendientePara(s: ServidorDTO, medidas: MedidaDTO[]): boolean {
  return medidas.some((m) => m.servidor?.host === s.host && m.servidor?.ip === s.ip && m.estado === "pendiente");
}

/** «Por orden de la Dra. X, Juzgado…, orden OFS-…, firmada en el minuto N». */
function fundamento(ctx: Contexto, m: MedidaDTO): string {
  const juez = ctx.jueces.find((j) => j.id === m.decision?.juez_id);
  const quien = sinFicticio(m.decision?.juez_nombre ?? juez?.nombre ?? "el juez de turno");
  const juzgado = juez?.juzgado_nombre ? `, ${sinFicticio(juez.juzgado_nombre)}` : "";
  // Las órdenes de una medida comparten el comienzo: OFS-<expediente>-<medida>-<proveedor>-…
  const familia = m.ordenes[0]?.orden_id.split("-").slice(0, 3).join("-");
  const cita = familia ? ` (medida ${m.id}, órdenes ${familia}-…)` : ` (medida ${m.id})`;
  return `Por orden de ${quien}${juzgado}${cita}, firmada en el minuto ${min(m.decision?.minuto)} del partido`;
}

function estadoDe(firmada: MedidaDTO | null, pendiente: boolean): SalidaDTO["estado"] {
  return firmada ? "lista" : pendiente ? "espera_firma" : "sin_orden";
}

function evidencia(base: Base, s: ServidorDTO, firmada: MedidaDTO | null): string {
  const dets = base.detecciones.filter((d) => d.host === s.host && d.ip === s.ip);
  const partes = [`${dets.length === 1 ? "1 detección" : `${dets.length} detecciones`} con su SHA-256 y el de la captura`];
  if (firmada) partes.push(`huella de lo que vio el juez: ${firmada.huella}`);
  return `Evidencia del expediente ${base.id}: ${partes.join("; ")}.`;
}

export function salidasDe(ctx: Contexto, base: Base): SalidaDTO[] {
  const salidas: SalidaDTO[] = [];
  const partido = sinFicticio(base.partido?.nombre ?? "el partido");
  const titular = base.partido?.titular_derechos ? sinFicticio(base.partido.titular_derechos) : null;
  const algunaFirmada = base.servidores.some((s) => firmadaPara(s, base.medidas));
  const servidoresTexto = base.servidores.map((s) => `${s.host} (IP ${s.ip})`).join(", ");

  // 1. El titular: cortar la fuente. No necesita una orden: es quien emitió la señal.
  salidas.push({
    id: "titular",
    tipo: "titular",
    destinatario: titular ? `Titular de los derechos: ${titular}` : "Titular de los derechos",
    pedido: `Cortar la señal que lleva la marca ${base.marca}.`,
    estado: "lista",
    fundamento: null,
    texto: [
      `Aviso al titular de los derechos${titular ? ` (${titular})` : ""}. Expediente ${base.id}.`,
      "",
      `La señal de ${partido} con marca de agua ${base.marca} se retransmite sin autorización desde ${base.servidores.length === 1 ? "este servidor" : `estos ${base.servidores.length} servidores`}: ${servidoresTexto}.`,
      "",
      "Esa marca identifica de qué señal suya sale la filtración. Se solicita ubicar esa fuente y cortarla: es la única medida que el operador no esquiva cambiando de servidor, y no afecta a terceros.",
      algunaFirmada ? "Los proveedores de internet del país ya tienen la orden de bloqueo firmada por el juez de turno." : "La orden de bloqueo espera la firma del juez de turno.",
    ].join("\n"),
  });

  for (const s of base.servidores) {
    const firmada = firmadaPara(s, base.medidas);
    const pendiente = pendientePara(s, base.medidas);
    const org = s.organizacion ? sinFicticio(s.organizacion) : "el proveedor de la IP";
    const asn = s.asn != null ? ` (AS${s.asn})` : "";
    const vence = firmada?.vence_min ?? base.medidas[0]?.vence_min ?? null;
    const por = firmada ? `${fundamento(ctx, firmada)}, se solicita:` : "Cuando el juez de turno firme la orden, se solicitará:";
    const u = s.ubicacion;

    if (s.intermediario) {
      // 2. CDN o proxy inverso: el bloqueo en el borde y el origen.
      salidas.push({
        id: `cdn-${s.id}`,
        tipo: "cdn",
        destinatario: `CDN: ${org}${asn}`,
        pedido: `Bloquear ${s.host} en su borde para Argentina e informar el servidor de origen.`,
        estado: estadoDe(firmada, pendiente),
        fundamento: firmada ? fundamento(ctx, firmada) : null,
        texto: [
          `Pedido a ${org}${asn}. Expediente ${base.id}.`,
          "",
          por,
          `1. Restringir en su borde, para Argentina, el acceso a ${s.host} hasta el minuto ${min(vence)} de ${partido}.`,
          `2. Informar la IP del servidor de origen que sirve ${s.host}, para completar el expediente.`,
          `3. Preservar los registros de la cuenta que configuró ${s.host}.`,
          "",
          `La IP ${s.ip} es de su red y la comparten otros sitios: por eso los proveedores del país bloquean el dominio y no la IP.`,
          evidencia(base, s, firmada),
        ].join("\n"),
      });
      continue;
    }

    const compartida = s.terceros.length > 0;
    const objeto = compartida
      ? `el sitio ${s.host}, alojado en la IP ${s.ip}. La IP la comparten ${s.terceros.length === 1 ? "otro sitio" : `otros ${s.terceros.length} sitios`}: no se pide dar de baja el servidor.`
      : `el servidor con IP ${s.ip} y los dominios del operador que apuntan a él (${s.host}).`;

    if (u?.en_argentina) {
      // 3a. Hosting en el país: pedido de baja.
      salidas.push({
        id: `hosting-${s.id}`,
        tipo: "hosting",
        destinatario: `Hosting en el país: ${org}${asn}`,
        pedido: `Suspender ${compartida ? `el sitio ${s.host}` : `el servidor ${s.ip}`} mientras dure el partido.`,
        estado: estadoDe(firmada, pendiente),
        fundamento: firmada ? fundamento(ctx, firmada) : null,
        texto: [
          `Pedido de baja a ${org}${asn}${u.ciudad ? `, ${u.ciudad}` : ""}. Expediente ${base.id}.`,
          "",
          por,
          `1. Suspender, hasta el minuto ${min(vence)} de ${partido}, ${objeto}`,
          "2. Preservar los registros de la cuenta que contrató el servicio.",
          "",
          evidencia(base, s, firmada),
          u.fuente === "simulada" ? "Nota: la ubicación de esta IP es simulada (IP de documentación del simulador)." : "",
        ]
          .join("\n")
          .trim(),
      });
    } else {
      // 3b. Hosting en el exterior (o sin ubicar): aviso al contacto de abuso.
      const donde = u ? `en ${u.pais_nombre}` : "de ubicación desconocida";
      salidas.push({
        id: `abuso-${s.id}`,
        tipo: "hosting",
        destinatario: `Hosting ${donde}: ${org}${asn}`,
        pedido: `Aviso a su contacto de abuso: el bloqueo rige en el país; la baja necesita cooperación internacional.`,
        estado: estadoDe(firmada, pendiente),
        fundamento: firmada ? fundamento(ctx, firmada) : null,
        texto: [
          `Aviso al contacto de abuso de ${org}${asn}. Expediente ${base.id}.`,
          "",
          `Desde ${compartida ? `el sitio ${s.host}, alojado en su IP ${s.ip},` : `su servidor con IP ${s.ip} (${s.host})`} se retransmite sin autorización la señal de ${partido}.`,
          firmada
            ? `${fundamento(ctx, firmada)}, los proveedores de internet de Argentina bloquean ese destino hasta el minuto ${min(vence)}.`
            : "La orden de bloqueo en Argentina espera la firma del juez de turno.",
          `Se solicita, según sus condiciones de uso, suspender ${compartida ? `el sitio ${s.host} (la IP la comparten otros sitios: no se pide dar de baja el servidor)` : "ese servicio"} y preservar los registros de la cuenta. Una orden de baja vinculante para un servidor en el exterior requiere cooperación internacional.`,
          "",
          evidencia(base, s, firmada),
          u?.fuente === "simulada" ? "Nota: la ubicación de esta IP es simulada (IP de documentación del simulador)." : "",
        ]
          .join("\n")
          .trim(),
      });
    }
  }

  // 4. Las plataformas donde se promocionó el enlace: una salida por publicación.
  const vistas = new Set<string>();
  for (const m of base.medidas) {
    if (m.clase === "levantamiento" || !m.servidor) continue;
    const s = base.servidores.find((x) => x.host === m.servidor!.host && x.ip === m.servidor!.ip);
    const firmada = s ? firmadaPara(s, base.medidas) : null;
    for (const p of m.promocion) {
      if (vistas.has(p.url)) continue;
      vistas.add(p.url);
      const red = RED[p.red.toLowerCase()] ?? p.red.charAt(0).toUpperCase() + p.red.slice(1);
      salidas.push({
        id: `plataforma-${vistas.size}`,
        tipo: "plataforma",
        destinatario: `Plataforma: ${red}`,
        pedido: `Bajar la publicación que promociona ${m.servidor.host}.`,
        estado: estadoDe(firmada, m.estado === "pendiente"),
        fundamento: firmada ? fundamento(ctx, firmada) : null,
        texto: [
          `Pedido de baja a ${red}. Expediente ${base.id}.`,
          "",
          `La publicación ${p.url} (minuto ${min(p.minuto)}) promociona la transmisión no autorizada de ${partido} en ${m.servidor.host}.`,
          firmada ? `${fundamento(ctx, firmada)}, se solicita:` : "Cuando el juez de turno firme la orden, se solicitará:",
          "1. Dar de baja la publicación.",
          "2. Preservar los datos de la cuenta que la publicó.",
          "",
          `Evidencia: expediente ${base.id}${firmada ? `, huella ${firmada.huella}` : ""}.`,
        ].join("\n"),
      });
    }
  }

  return salidas;
}
