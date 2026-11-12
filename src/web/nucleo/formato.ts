// Formatos y rótulos compartidos por las pantallas. Los textos de fondo
// (verificaciones, pedido, resúmenes de auditoría) los escribe el servidor.

import type { ClaseMedida, EstadoCelda, EstadoMedida, TipoBloqueo } from "../../compartido/tipos.ts";

const dec1 = new Intl.NumberFormat("es-AR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const dec2 = new Intl.NumberFormat("es-AR", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
const entero = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 0 });

/** Reloj de partido: 67,4 -> "67:24". */
export function reloj(minuto: number): string {
  const total = Math.max(0, Math.floor(minuto * 60 + 1e-6));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

/** Minuto de un hecho: 23,42 -> "23,4". Va acompañado de la palabra "min" o del signo ′. */
export function minuto(m: number | null | undefined): string {
  return m == null ? "—" : dec1.format(m);
}

export function numero(n: number | null | undefined, decimales: 0 | 1 | 2 = 0): string {
  if (n == null) return "—";
  return decimales === 0 ? entero.format(n) : decimales === 1 ? dec1.format(n) : dec2.format(n);
}

/** Tiempo real que representan `min` minutos de partido, como "0:06" o "2:14". */
export function tiempoReal(min: number, acelerar: number): string {
  const seg = Math.max(0, Math.floor((min * 60) / (acelerar > 0 ? acelerar : 1)));
  return `${Math.floor(seg / 60)}:${String(seg % 60).padStart(2, "0")}`;
}

export function clientes(n: number): string {
  if (n >= 1_000_000) return `${dec1.format(n / 1_000_000)} M`;
  if (n >= 1000) return `${entero.format(n / 1000)} mil`;
  return entero.format(n);
}

export function horaLocal(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
}

export function fechaHoraLocal(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return `${d.toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" })} ${horaLocal(iso)}`;
}

export function huellaCorta(huella: string | null | undefined, largo = 16): string {
  return huella ? huella.slice(0, largo) : "sin huella";
}

/** Los datos del simulador llevan "(ficticio)" en cada nombre; en los lugares chicos se omite. */
export function sinFicticio(nombre: string | null | undefined): string {
  return (nombre ?? "").replace(/\s*\(fictici[oa]s?\)/gi, "").trim();
}

/** Nombre de una palabra para columnas angostas: "Conectividad Aurora" -> "Aurora". */
export function nombreBreve(nombre: string): string {
  const limpio = sinFicticio(nombre);
  const genericas = /^(conectividad|red|cooperativa|telecom|coop\.?|conecta|internet|servicios)$/i;
  const propias = limpio.split(/\s+/).filter((p) => !genericas.test(p));
  return propias[0] ?? limpio;
}

export function juzgadoBreve(nombre: string | null | undefined): string {
  return sinFicticio(nombre).split("—")[0]!.trim();
}

export function plural(n: number, uno: string, muchos: string): string {
  return `${entero.format(n)} ${n === 1 ? uno : muchos}`;
}

export const CLASE: Record<ClaseMedida, string> = {
  inicial: "Nueva filtración",
  ampliacion: "Ampliación",
  ratificacion: "Ratificación",
  levantamiento: "Reclamo",
};

export const ESTADO_MEDIDA: Record<EstadoMedida, string> = {
  pendiente: "Espera firma",
  aprobada: "Firmada",
  rechazada: "Rechazada",
  sin_efecto: "Sin efecto",
};

export const TIPO: Record<TipoBloqueo, string> = { ip: "IP", dominio: "Dominio" };

export type TonoEstado = "verde" | "ambar" | "roja" | "neutro" | "vacio";

/** Rótulo y luz de cada estado de orden. Verde, ámbar y rojo solo se usan acá y en las verificaciones. */
export const ESTADO_ORDEN: Record<EstadoCelda, { rotulo: string; tono: TonoEstado }> = {
  por_enviar: { rotulo: "Por enviar", tono: "ambar" },
  recibida: { rotulo: "Recibida", tono: "ambar" },
  aplicada: { rotulo: "Aplicada", tono: "verde" },
  fallida: { rotulo: "Falló", tono: "roja" },
  vencida: { rotulo: "Vencida", tono: "neutro" },
  levantada: { rotulo: "Levantada", tono: "neutro" },
  rechazada: { rotulo: "Rechazada", tono: "roja" },
  no_enviada: { rotulo: "No enviada", tono: "roja" },
  sin_orden: { rotulo: "Sin orden", tono: "vacio" },
  sin_cobertura: { rotulo: "Sin cobertura", tono: "vacio" },
};

export const ESTADO_EXPEDIENTE: Record<"pendiente" | "activo" | "rechazado" | "cerrado", string> = {
  pendiente: "Espera al juez",
  activo: "Bloqueos vigentes",
  rechazado: "Rechazado",
  cerrado: "Cerrado",
};

export const VEREDICTO: Record<string, string> = {
  licenciatario_autorizado: "Licenciatario autorizado",
  no_es_la_senal: "No es la señal",
  anomalia: "Anomalía",
  pirata: "Pirata",
};

export const RED: Record<string, string> = {
  x: "X",
  telegram: "Telegram",
  facebook: "Facebook",
  instagram: "Instagram",
  whatsapp: "WhatsApp",
  tiktok: "TikTok",
  youtube: "YouTube",
  discord: "Discord",
  reddit: "Reddit",
};

export function nombreRed(red: string): string {
  return RED[red.toLowerCase()] ?? red.charAt(0).toUpperCase() + red.slice(1);
}
