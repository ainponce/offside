// Geolocalización de servidores, en cualquier país.
//
// Para una IP pública, la ubicación sale de una base GeoIP local en formato MaxMind (.mmdb):
// por defecto la de DB-IP (IP to City Lite, CC BY 4.0), que baja `pnpm geoip`; también sirve una
// GeoLite2 City, con OFFSIDE_GEOIP=<ruta>. Es local a propósito: no manda las IPs a un tercero y
// funciona sin internet durante el partido.
//
// Las IPs del simulador son de documentación (RFC 5737) y no existen en ninguna base: no tienen
// ubicación real. Para esas, y solo para esas, hay una ubicación simulada y determinista: cada
// organización cae siempre en el mismo centro de datos ficticio, en el país o en el exterior,
// según su nombre o su ASN. La interfaz dice cuál es cuál.
//
// La ubicación es orientativa: no forma parte de la instantánea que ve el juez ni de lo que se
// firma, así que no cambia ninguna huella ni ningún orden_id.

import { existsSync, readFileSync } from "node:fs";
import { BlockList, isIP } from "node:net";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { type CityResponse, Reader } from "mmdb-lib";
import type { GeoEstadoDTO, UbicacionDTO } from "../compartido/tipos.ts";

const RUTA_POR_DEFECTO = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "datos", "geoip", "dbip-city-lite.mmdb");

const NOMBRE_PAIS = new Intl.DisplayNames(["es"], { type: "region" });
function nombrePais(iso: string): string {
  try {
    return NOMBRE_PAIS.of(iso) ?? iso;
  } catch {
    return iso;
  }
}

// --- rangos que no tienen ubicación ---------------------------------------------------------------

const DOCUMENTACION = new BlockList();
DOCUMENTACION.addSubnet("192.0.2.0", 24, "ipv4");
DOCUMENTACION.addSubnet("198.51.100.0", 24, "ipv4");
DOCUMENTACION.addSubnet("203.0.113.0", 24, "ipv4");
DOCUMENTACION.addSubnet("2001:db8::", 32, "ipv6");

const RESERVADAS = new BlockList();
for (const [red, prefijo] of [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["224.0.0.0", 4],
  ["240.0.0.0", 4],
] as const) {
  RESERVADAS.addSubnet(red, prefijo, "ipv4");
}
for (const [red, prefijo] of [
  ["::", 127],
  ["fc00::", 7],
  ["fe80::", 10],
  ["ff00::", 8],
] as const) {
  RESERVADAS.addSubnet(red, prefijo, "ipv6");
}

export type ClaseIp = "publica" | "documentacion" | "reservada" | "invalida";

export function claseIp(ip: string): ClaseIp {
  const v = isIP(ip);
  if (v === 0) return "invalida";
  const familia = v === 4 ? "ipv4" : "ipv6";
  if (DOCUMENTACION.check(ip, familia)) return "documentacion";
  if (RESERVADAS.check(ip, familia)) return "reservada";
  return "publica";
}

// --- base GeoIP ----------------------------------------------------------------------------------

interface Base {
  lector: Reader<CityResponse>;
  nombre: string;
  atribucion: string | null;
}

let base: Base | null | undefined;

/** Carga la base GeoIP una sola vez. Devuelve su nombre, o null si no hay base. */
export function cargarGeoIP(ruta = process.env.OFFSIDE_GEOIP || RUTA_POR_DEFECTO): string | null {
  if (base !== undefined) return base?.nombre ?? null;
  base = null;
  if (!existsSync(ruta)) return null;
  try {
    const lector = new Reader<CityResponse>(readFileSync(ruta));
    const m = lector.metadata;
    const fecha = m.buildEpoch instanceof Date ? m.buildEpoch.toISOString().slice(0, 7) : "";
    const tipo = m.databaseType || "GeoIP";
    const esDbip = /dbip/i.test(tipo);
    base = {
      lector,
      nombre: `${esDbip ? `DB-IP ${tipo.replace(/^DBIP-/i, "").replace(/-/g, " ")}` : tipo}${fecha ? ` (${fecha})` : ""}`,
      atribucion: esDbip ? "IP Geolocation by DB-IP" : null,
    };
    cache.clear();
  } catch (e) {
    console.error(`[geo] no se pudo abrir la base GeoIP ${ruta}:`, e instanceof Error ? e.message : e);
    base = null;
  }
  return base?.nombre ?? null;
}

/** Para pruebas: olvida la base cargada. */
export function reiniciarGeoIP(): void {
  base = undefined;
  cache.clear();
}

export function estadoGeo(): GeoEstadoDTO {
  cargarGeoIP();
  return { base: base?.nombre ?? null, atribucion: base?.atribucion ?? null };
}

// --- ubicación simulada (solo IPs de documentación) -----------------------------------------------

interface Sitio {
  id: string;
  ciudad: string;
  provincia: string;
  pais: string;
  lat: number;
  lon: number;
}

export const SITIOS_SIMULADOS: readonly Sitio[] = [
  { id: "caba", ciudad: "Buenos Aires", provincia: "Ciudad Autónoma de Buenos Aires", pais: "AR", lat: -34.603, lon: -58.381 },
  { id: "cordoba", ciudad: "Córdoba", provincia: "Córdoba", pais: "AR", lat: -31.42, lon: -64.188 },
  { id: "rosario", ciudad: "Rosario", provincia: "Santa Fe", pais: "AR", lat: -32.947, lon: -60.63 },
  { id: "mendoza", ciudad: "Mendoza", provincia: "Mendoza", pais: "AR", lat: -32.889, lon: -68.845 },
  { id: "salta", ciudad: "Salta", provincia: "Salta", pais: "AR", lat: -24.782, lon: -65.423 },
  { id: "tucuman", ciudad: "San Miguel de Tucumán", provincia: "Tucumán", pais: "AR", lat: -26.808, lon: -65.217 },
  { id: "neuquen", ciudad: "Neuquén", provincia: "Neuquén", pais: "AR", lat: -38.952, lon: -68.059 },
  { id: "santa-rosa", ciudad: "Santa Rosa", provincia: "La Pampa", pais: "AR", lat: -36.62, lon: -64.29 },
  { id: "mar-del-plata", ciudad: "Mar del Plata", provincia: "Buenos Aires", pais: "AR", lat: -38.005, lon: -57.543 },
  { id: "comodoro", ciudad: "Comodoro Rivadavia", provincia: "Chubut", pais: "AR", lat: -45.865, lon: -67.497 },
  { id: "posadas", ciudad: "Posadas", provincia: "Misiones", pais: "AR", lat: -27.367, lon: -55.896 },
  { id: "amsterdam", ciudad: "Ámsterdam", provincia: "Holanda Septentrional", pais: "NL", lat: 52.37, lon: 4.895 },
  { id: "francfort", ciudad: "Fráncfort", provincia: "Hesse", pais: "DE", lat: 50.11, lon: 8.682 },
  { id: "madrid", ciudad: "Madrid", provincia: "Comunidad de Madrid", pais: "ES", lat: 40.417, lon: -3.704 },
  { id: "miami", ciudad: "Miami", provincia: "Florida", pais: "US", lat: 25.762, lon: -80.192 },
  { id: "san-pablo", ciudad: "San Pablo", provincia: "San Pablo", pais: "BR", lat: -23.551, lon: -46.633 },
  { id: "santiago", ciudad: "Santiago", provincia: "Región Metropolitana", pais: "CL", lat: -33.449, lon: -70.669 },
];

/** Palabras del nombre de la organización que sugieren dónde está. La primera que coincide gana. */
const PISTAS: readonly [RegExp, string][] = [
  [/bruma|offshore|bulletproof/i, "amsterdam"],
  [/litoral/i, "rosario"],
  [/andin|cuyo/i, "mendoza"],
  [/austral|patag/i, "comodoro"],
  [/\bsur\b/i, "neuquen"],
  [/pampa/i, "santa-rosa"],
  [/norte/i, "salta"],
  [/cdn|nube|borde/i, "caba"],
];

function fnv1a(texto: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < texto.length; i++) {
    h ^= texto.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

function bloque(ip: string): string {
  const partes = ip.split(".");
  return partes.length === 4 ? partes.slice(0, 3).join(".") : ip.split(":").slice(0, 3).join(":");
}

function simulada(s: { ip: string; asn: number | null; organizacion: string | null }): UbicacionDTO {
  const pista = PISTAS.find(([re]) => re.test(s.organizacion ?? ""));
  const clave = s.asn != null ? `asn:${s.asn}` : `ip:${bloque(s.ip)}`;
  const sitio =
    (pista && SITIOS_SIMULADOS.find((x) => x.id === pista[1])) ?? SITIOS_SIMULADOS[fnv1a(clave) % SITIOS_SIMULADOS.length]!;
  return {
    sitio: `sim:${sitio.id}`,
    ciudad: sitio.ciudad,
    provincia: sitio.provincia,
    pais: sitio.pais,
    pais_nombre: nombrePais(sitio.pais),
    en_argentina: sitio.pais === "AR",
    lat: sitio.lat,
    lon: sitio.lon,
    precision_km: null,
    fuente: "simulada",
  };
}

// --- ubicación real ------------------------------------------------------------------------------

const cache = new Map<string, UbicacionDTO | null>();

function real(ip: string): UbicacionDTO | null {
  if (!base) return null;
  const r = base.lector.get(ip);
  const lat = r?.location?.latitude;
  const lon = r?.location?.longitude;
  const iso = r?.country?.iso_code ?? r?.registered_country?.iso_code;
  if (r == null || lat == null || lon == null || !iso) return null;
  // DB-IP agrega el barrio entre paréntesis («Buenos Aires (Monserrat)»): se agrupa por ciudad.
  const ciudadCompleta = r.city?.names?.es ?? r.city?.names?.en ?? null;
  const ciudad = ciudadCompleta?.replace(/\s*\(.*\)\s*$/, "") || null;
  const sub = r.subdivisions?.[0] as { names?: Record<string, string> } | Record<string, string> | undefined;
  const nombresSub = (sub && "names" in sub ? sub.names : sub) as Record<string, string> | undefined;
  return {
    sitio: `${iso}:${ciudad ?? `${lat.toFixed(1)},${lon.toFixed(1)}`}`,
    ciudad,
    provincia: nombresSub?.es ?? nombresSub?.en ?? null,
    pais: iso,
    pais_nombre: nombrePais(iso),
    en_argentina: iso === "AR",
    lat,
    lon,
    precision_km: r.location?.accuracy_radius ?? null,
    fuente: "geoip",
  };
}

/**
 * Dónde está el servidor. Una IP pública se busca en la base GeoIP; una de documentación tiene
 * ubicación simulada; una privada o reservada, o una que la base no conoce, no tiene ubicación.
 */
export function ubicarServidor(s: { ip: string; asn: number | null; organizacion: string | null }): UbicacionDTO | null {
  const clase = claseIp(s.ip);
  if (clase === "documentacion") return simulada(s);
  if (clase !== "publica") return null;
  cargarGeoIP();
  if (cache.has(s.ip)) return cache.get(s.ip)!;
  const u = real(s.ip);
  if (cache.size > 5000) cache.clear();
  cache.set(s.ip, u);
  return u;
}

// --- intermediarios ------------------------------------------------------------------------------

/**
 * Redes de borde que hacen de proxy inverso: la IP que se ve es la del borde, compartida con miles
 * de sitios, y el servidor de origen queda oculto detrás. La geolocalización de esa IP dice dónde
 * está el borde (suele estar cerca de quien mira), no dónde está el pirata.
 */
const ASN_PROXY: Record<number, string> = {
  13335: "Cloudflare",
  209242: "Cloudflare",
  20940: "Akamai",
  16625: "Akamai",
  54113: "Fastly",
  60068: "CDN77",
  19551: "Imperva",
  30148: "Sucuri",
  12989: "StackPath",
  22822: "Edgio",
  15133: "Edgecast",
  200325: "Bunny CDN",
  199524: "G-Core Labs",
};
const ORG_PROXY = /\bcdn\b|proxy|cloudflare|akamai|fastly|\bborde\b/i;

/** Si la IP es de una CDN o un proxy inverso, por qué; si no, null. */
export function intermediarioDe(s: { asn: number | null; organizacion: string | null }): string | null {
  const conocido = s.asn != null ? ASN_PROXY[s.asn] : undefined;
  const org = (s.organizacion ?? "").replace(/\s*\(fictici[oa]\)/i, "").trim();
  if (!conocido && !ORG_PROXY.test(org)) return null;
  const quien = conocido ? `AS${s.asn} es ${conocido}` : `${org} es una CDN`;
  return `${quien}, un proxy inverso: la IP es de un borde compartido y la ubicación es la de ese borde, no la del servidor de origen, que queda oculto.`;
}

/** Para la consulta manual de la fiscalía: la ubicación y, si no hay, por qué. */
export function consultarIp(ip: string): { ip: string; clase: ClaseIp; ubicacion: UbicacionDTO | null; motivo: string | null; base: string | null } {
  const clase = claseIp(ip);
  const ubicacion = clase === "documentacion" || clase === "publica" ? ubicarServidor({ ip, asn: null, organizacion: null }) : null;
  const nombreBase = estadoGeo().base;
  let motivo: string | null = null;
  if (clase === "invalida") motivo = "No es una dirección IP.";
  else if (clase === "reservada") motivo = "Es una IP privada o reservada: no está en internet.";
  else if (clase === "documentacion") motivo = "Es una IP de documentación (RFC 5737), como las del simulador: la ubicación es simulada.";
  else if (!ubicacion) motivo = nombreBase ? "La base GeoIP no tiene ubicación para esta IP." : "No hay base GeoIP cargada (pnpm geoip).";
  return { ip, clase, ubicacion, motivo, base: nombreBase };
}
