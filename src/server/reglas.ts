// Reglas de decisión de Offside (sección 7 del diseño). Son funciones puras:
// reciben lo que dijo el simulador y devuelven qué hacer, sin tocar red ni base.

import { dominioRegistrable, esMismoOSubdominio } from "./dominio.ts";
import type { Deteccion, DnsDominio, DnsIp, Partido, Proveedor, TipoBloqueo } from "./simulador.ts";

export type ClaseVeredicto = "pirata" | "licenciatario_autorizado" | "no_es_la_senal" | "anomalia";

export interface Veredicto {
  clase: ClaseVeredicto;
  prefijo: string | null;
  origen_prefijo: string | null;
  motivo: string;
}

export interface Riesgo {
  tipo_recomendado: TipoBloqueo;
  /** Otros dominios que el DNS pasivo ve en la misma IP. */
  cotenants: string[];
  /** Co-inquilinos que no son del operador: caerían con un bloqueo por IP. */
  terceros: string[];
  motivo: string;
  advertencias: string[];
}

export type ItemPlan =
  | { proveedor_id: string; tipo: TipoBloqueo; objetivo: string }
  | { proveedor_id: string; sin_cobertura: string };

function marcaDe(det: Deteccion): string {
  const marca: unknown = det.marca_de_agua_extraida;
  return typeof marca === "string" ? marca.trim() : "";
}

function prefijoMasLargo(marca: string, partido: Partido): { prefijo: string; origen: string } | null {
  let mejor: { prefijo: string; origen: string } | null = null;
  for (const m of partido.marcas_de_agua_validas) {
    if (m.prefijo && marca.startsWith(m.prefijo) && (!mejor || m.prefijo.length > mejor.prefijo.length)) {
      mejor = m;
    }
  }
  return mejor;
}

/** 7.1 — ¿Es la señal del partido, y está donde no debe? */
export function veredicto(det: Deteccion, partido: Partido): Veredicto {
  const marca = marcaDe(det);
  const host = det.host_stream;
  const valido = marca ? prefijoMasLargo(marca, partido) : null;
  const duenoDelHost = partido.licenciatarios.find((l) =>
    l.dominios_autorizados.some((d) => esMismoOSubdominio(host, d)),
  );

  if (duenoDelHost) {
    if (valido && valido.prefijo === duenoDelHost.prefijo_marca) {
      return {
        clase: "licenciatario_autorizado",
        prefijo: valido.prefijo,
        origen_prefijo: valido.origen,
        motivo: `${duenoDelHost.nombre} retransmite con licencia en un dominio autorizado.`,
      };
    }
    return {
      clase: "anomalia",
      prefijo: valido?.prefijo ?? null,
      origen_prefijo: valido?.origen ?? null,
      motivo: `El host pertenece a ${duenoDelHost.nombre}, pero la marca no es la de su licencia. No se bloquea; se avisa a la fiscalía.`,
    };
  }

  if (!marca) {
    return { clase: "no_es_la_senal", prefijo: null, origen_prefijo: null, motivo: "La captura no trae marca de agua." };
  }
  if (!valido) {
    return {
      clase: "no_es_la_senal",
      prefijo: null,
      origen_prefijo: null,
      motivo: `La marca ${marca} no corresponde a este partido.`,
    };
  }

  const licenciatario = partido.licenciatarios.find((l) => l.prefijo_marca === valido.prefijo);
  return {
    clase: "pirata",
    prefijo: valido.prefijo,
    origen_prefijo: valido.origen,
    motivo: licenciatario
      ? `Señal de ${licenciatario.nombre} retransmitida fuera de sus dominios autorizados.`
      : "Señal oficial del partido en un sitio sin autorización.",
  };
}

/** 7.2 — Una filtración, un expediente. */
export function claveExpediente(det: Deteccion, prefijo: string): string {
  const marca = marcaDe(det);
  if (marca.length > prefijo.length) return marca;
  return `${marca}@${dominioRegistrable(det.host_stream)}`;
}

/** 7.3 y 7.4 — ¿Qué más hay en esa IP y qué conviene bloquear? */
export function evaluarRiesgo(
  det: Deteccion,
  dnsIp: DnsIp | null,
  dnsDominio: DnsDominio | null,
  partido: Partido,
  terminos: string[],
): Riesgo {
  const host = det.host_stream.toLowerCase();
  const advertencias: string[] = [];

  if (!dnsIp) {
    return {
      tipo_recomendado: "dominio",
      cotenants: [],
      terceros: [],
      motivo: "No hay registros de DNS pasivo para la IP: no se puede descartar que sea compartida.",
      advertencias: ["Sin registros de DNS pasivo para la IP del servidor."],
    };
  }

  const dominios = dnsIp.dominios.map((d) => d.toLowerCase());
  const cotenants = dominios.filter((d) => d !== host);
  if (!dominios.includes(host)) advertencias.push("El DNS pasivo no ve este host en la IP informada.");
  if (dnsDominio && !dnsDominio.ips.some((i) => i.ip === det.ip_servidor)) {
    advertencias.push("El DNS pasivo no asocia este host a la IP informada.");
  }
  if (det.asn != null && dnsIp.asn != null && det.asn !== dnsIp.asn) {
    advertencias.push(`El ASN informado (${det.asn}) no coincide con el del DNS pasivo (${dnsIp.asn}).`);
  }

  const dominiosLicenciatarios = partido.licenciatarios.flatMap((l) => l.dominios_autorizados);
  const registrable = dominioRegistrable(host);
  const terceros = cotenants.filter(
    (d) => dominioRegistrable(d) !== registrable || dominiosLicenciatarios.some((l) => esMismoOSubdominio(d, l)),
  );

  const organizacion = (dnsIp.organizacion ?? "").toLowerCase();
  const compartida = terminos.some((t) => t && organizacion.includes(t.toLowerCase()));

  if (terceros.length > 0) {
    return {
      tipo_recomendado: "dominio",
      cotenants,
      terceros,
      motivo: `La IP aloja ${terceros.length} sitio${terceros.length === 1 ? "" : "s"} ajeno${terceros.length === 1 ? "" : "s"} al operador: se bloquea solo el dominio.`,
      advertencias,
    };
  }
  if (compartida) {
    return {
      tipo_recomendado: "dominio",
      cotenants,
      terceros,
      motivo: `El servidor está en infraestructura compartida (${dnsIp.organizacion}): se bloquea solo el dominio.`,
      advertencias,
    };
  }
  if (advertencias.length > 0) {
    return {
      tipo_recomendado: "dominio",
      cotenants,
      terceros,
      motivo: "Los datos del servidor no coinciden con el DNS pasivo: se bloquea solo el dominio.",
      advertencias,
    };
  }
  return {
    tipo_recomendado: "ip",
    cotenants,
    terceros,
    motivo:
      cotenants.length === 0
        ? "La IP solo aloja este servidor: se bloquea la IP."
        : `La IP solo aloja dominios del mismo operador (${registrable}): se bloquea la IP.`,
    advertencias,
  };
}

/** 7.5 — La misma medida, en el tipo de bloqueo que admite cada proveedor. */
export function planPorProveedor(
  riesgo: Pick<Riesgo, "tipo_recomendado">,
  det: Pick<Deteccion, "host_stream" | "ip_servidor">,
  proveedores: Proveedor[],
): ItemPlan[] {
  return proveedores.map((p): ItemPlan => {
    if (p.capacidades.includes(riesgo.tipo_recomendado)) {
      return {
        proveedor_id: p.id,
        tipo: riesgo.tipo_recomendado,
        objetivo: riesgo.tipo_recomendado === "ip" ? det.ip_servidor : det.host_stream,
      };
    }
    if (riesgo.tipo_recomendado === "ip" && p.capacidades.includes("dominio")) {
      return { proveedor_id: p.id, tipo: "dominio", objetivo: det.host_stream };
    }
    return {
      proveedor_id: p.id,
      sin_cobertura: "El proveedor solo bloquea por IP y esta IP es compartida: no se envía para no afectar a terceros.",
    };
  });
}
