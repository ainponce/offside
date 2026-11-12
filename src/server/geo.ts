// Geolocalización de servidores, simulada.
//
// Las IPs del desafío son de documentación (RFC 5737) y los ASN son privados: no tienen ubicación
// real. Para que el mapa funcione con cualquier escenario, cada organización cae en un centro de
// datos ficticio de una ciudad argentina, siempre el mismo:
//   1. si el nombre de la organización sugiere una región (Litoral, Andino, Pampa…), en esa región;
//   2. si no, uno fijo elegido por el ASN (o por el bloque /24 de la IP si no hay ASN).
// En producción esto lo resolvería una base GeoIP (por ejemplo, GeoLite2 City) con la IP real.
//
// La ubicación es orientativa: no forma parte de la instantánea que ve el juez ni de lo que se
// firma, así que no cambia ninguna huella ni ningún orden_id.

import type { UbicacionDTO } from "../compartido/tipos.ts";

interface Sitio {
  id: string;
  ciudad: string;
  provincia: string;
  lat: number;
  lon: number;
}

export const SITIOS: readonly Sitio[] = [
  { id: "caba", ciudad: "Buenos Aires", provincia: "Ciudad Autónoma de Buenos Aires", lat: -34.603, lon: -58.381 },
  { id: "cordoba", ciudad: "Córdoba", provincia: "Córdoba", lat: -31.42, lon: -64.188 },
  { id: "rosario", ciudad: "Rosario", provincia: "Santa Fe", lat: -32.947, lon: -60.63 },
  { id: "mendoza", ciudad: "Mendoza", provincia: "Mendoza", lat: -32.889, lon: -68.845 },
  { id: "salta", ciudad: "Salta", provincia: "Salta", lat: -24.782, lon: -65.423 },
  { id: "tucuman", ciudad: "San Miguel de Tucumán", provincia: "Tucumán", lat: -26.808, lon: -65.217 },
  { id: "neuquen", ciudad: "Neuquén", provincia: "Neuquén", lat: -38.952, lon: -68.059 },
  { id: "santa-rosa", ciudad: "Santa Rosa", provincia: "La Pampa", lat: -36.62, lon: -64.29 },
  { id: "mar-del-plata", ciudad: "Mar del Plata", provincia: "Buenos Aires", lat: -38.005, lon: -57.543 },
  { id: "bahia-blanca", ciudad: "Bahía Blanca", provincia: "Buenos Aires", lat: -38.719, lon: -62.272 },
  { id: "comodoro", ciudad: "Comodoro Rivadavia", provincia: "Chubut", lat: -45.865, lon: -67.497 },
  { id: "posadas", ciudad: "Posadas", provincia: "Misiones", lat: -27.367, lon: -55.896 },
  { id: "resistencia", ciudad: "Resistencia", provincia: "Chaco", lat: -27.451, lon: -58.986 },
  { id: "parana", ciudad: "Paraná", provincia: "Entre Ríos", lat: -31.732, lon: -60.529 },
  { id: "san-juan", ciudad: "San Juan", provincia: "San Juan", lat: -31.537, lon: -68.525 },
];

/** Palabras del nombre de la organización que sugieren una región. La primera que coincide gana. */
const PISTAS: readonly [RegExp, string][] = [
  [/litoral/i, "rosario"],
  [/andin|cuyo/i, "mendoza"],
  [/austral|patag/i, "comodoro"],
  [/\bsur\b/i, "neuquen"],
  [/pampa/i, "santa-rosa"],
  [/norte/i, "salta"],
  [/cdn|global|nube|borde/i, "caba"],
  [/bruma/i, "cordoba"],
];

function fnv1a(texto: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < texto.length; i++) {
    h ^= texto.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

function bloque24(ip: string): string {
  const partes = ip.split(".");
  return partes.length === 4 ? partes.slice(0, 3).join(".") : ip;
}

export function ubicarServidor(s: { ip: string; asn: number | null; organizacion: string | null }): UbicacionDTO {
  const nombre = s.organizacion ?? "";
  const pista = PISTAS.find(([re]) => re.test(nombre));
  const porPista = pista ? SITIOS.find((x) => x.id === pista[1]) : undefined;
  const clave = s.asn != null ? `asn:${s.asn}` : `ip:${bloque24(s.ip)}`;
  const sitio = porPista ?? SITIOS[fnv1a(clave) % SITIOS.length]!;
  return {
    sitio: sitio.id,
    ciudad: sitio.ciudad,
    provincia: sitio.provincia,
    lat: sitio.lat,
    lon: sitio.lon,
    fuente: "simulada",
  };
}
