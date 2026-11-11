// Hashes, huellas, identificadores de orden y firmas (sección 9 del diseño).

import { createHash, createHmac } from "node:crypto";

export function sha256Hex(data: string | Uint8Array): string {
  return createHash("sha256").update(data).digest("hex");
}

const BASE64 = /^[A-Za-z0-9+/]+={0,2}$/;

/** Hash de los bytes de la captura y control informativo de formato (MPEG-TS empieza con 0x47). */
export function analizarCaptura(b64: string | null | undefined): {
  sha256: string | null;
  bytes: number;
  formato_ok: boolean;
} {
  const limpio = (b64 ?? "").replace(/\s+/g, "");
  if (!limpio || limpio.length % 4 !== 0 || !BASE64.test(limpio)) {
    return { sha256: null, bytes: 0, formato_ok: false };
  }
  const bytes = Buffer.from(limpio, "base64");
  if (bytes.length === 0) return { sha256: null, bytes: 0, formato_ok: false };
  return { sha256: sha256Hex(bytes), bytes: bytes.length, formato_ok: bytes[0] === 0x47 };
}

/** Huella de una medida: SHA-256 del texto exacto que vio el juez. */
export function huella(instantanea: string): string {
  return sha256Hex(instantanea);
}

/**
 * Identificador de orden. Lleva los primeros 16 caracteres de la huella: como el
 * simulador incluye `orden_id` en el texto firmado, la firma del juez queda atada
 * a la evidencia que vio.
 */
export function ordenId(
  nExpediente: number,
  nMedida: number,
  proveedorId: string,
  intento: number,
  huellaMedida: string,
): string {
  const exp = String(nExpediente).padStart(6, "0");
  const med = String(nMedida).padStart(4, "0");
  return `OFS-${exp}-${med}-${proveedorId}-${intento}-${huellaMedida.slice(0, 16)}`;
}

function hmac(clave: string, mensaje: string): string {
  return createHmac("sha256", clave).update(mensaje, "utf8").digest("hex");
}

/** Firma de demostración del simulador: HMAC-SHA256 sobre `orden_id|tipo|objetivo|vence_min|juez_id`. */
export function firmarOrden(
  clave: string,
  o: { orden_id: string; tipo: string; objetivo: string; vence_min: number; juez_id: string },
): string {
  return hmac(clave, `${o.orden_id}|${o.tipo}|${o.objetivo}|${o.vence_min}|${o.juez_id}`);
}

/** Firma de un levantamiento: HMAC-SHA256 sobre `LEVANTAR|orden_id|juez_id`. */
export function firmarLevantamiento(clave: string, ordenIdALevantar: string, juezId: string): string {
  return hmac(clave, `LEVANTAR|${ordenIdALevantar}|${juezId}`);
}
