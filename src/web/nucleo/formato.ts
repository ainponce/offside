// Formatos y rótulos compartidos por las pantallas. Los textos de fondo
// (verificaciones, pedido, resúmenes de auditoría) los escribe el servidor y no se tocan.

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

/** Minuto de un hecho: 23,42 -> "23,4". */
export function minuto(m: number | null | undefined): string {
  return m == null ? "—" : dec1.format(m);
}

/** Minuto entero, para marcas de la escala: 37,5 -> "37". */
export function minutoEntero(m: number): string {
  return entero.format(Math.floor(m + 1e-6));
}

export function numero(n: number | null | undefined, decimales: 0 | 1 | 2 = 0): string {
  if (n == null) return "—";
  return decimales === 0 ? entero.format(n) : decimales === 1 ? dec1.format(n) : dec2.format(n);
}

/** Porcentaje con un decimal salvo en 0 y 100: "96,2", "100". */
export function porcentaje(n: number | null | undefined): string {
  if (n == null) return "—";
  if (n <= 0) return "0";
  if (n >= 100) return "100";
  return dec1.format(n);
}

/** Tiempo real que representan `min` minutos de partido, como "0:06" o "2:14". */
export function tiempoReal(min: number, acelerar: number): string {
  const seg = Math.max(0, Math.floor((min * 60) / (acelerar > 0 ? acelerar : 1)));
  return `${Math.floor(seg / 60)}:${String(seg % 60).padStart(2, "0")}`;
}

/** Espera en tiempo real, para la cabeza de la tarjeta: "hace 24 s", "hace 1:05". */
export function haceReal(min: number, acelerar: number): string {
  const seg = Math.max(0, Math.floor((min * 60) / (acelerar > 0 ? acelerar : 1)));
  if (seg < 60) return `hace ${seg} s`;
  return `hace ${Math.floor(seg / 60)}:${String(seg % 60).padStart(2, "0")}`;
}

export function clientes(n: number): string {
  if (n >= 1_000_000) return `${dec1.format(n / 1_000_000)} M`;
  if (n >= 1000) return `${entero.format(n / 1000)} mil`;
  return entero.format(n);
}

/** Millones con un decimal, sin unidad: 5 040 000 -> "5,0". */
export function millones(n: number): string {
  return dec1.format(n / 1_000_000);
}

export function horaLocal(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
}

export function fechaLocal(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("es-AR", { day: "numeric", month: "long", year: "numeric" });
}

/** Una huella en grupos de cuatro: "5200 1c2c ce78". `caracteres` 0 = completa. */
export function enGrupos(huella: string | null | undefined, caracteres = 0): string {
  const h = (huella ?? "").toLowerCase();
  const parte = caracteres > 0 ? h.slice(0, caracteres) : h;
  return parte.replace(/(.{4})(?=.)/g, "$1 ");
}

/** Los datos del simulador llevan "(ficticio)" en cada nombre; se omite y se aclara una vez por pantalla. */
export function sinFicticio(nombre: string | null | undefined): string {
  return (nombre ?? "").replace(/\s*\(fictici[oa]s?\)/gi, "").trim();
}

/** Nombre del proveedor para filas: "Cooperativa Cumbre Conecta (ficticio)" -> "Cumbre Conecta". */
export function nombreProveedor(nombre: string): string {
  return sinFicticio(nombre).replace(/^cooperativa\s+/i, "");
}

/** Nombre de una palabra para columnas angostas: "Conectividad Aurora" -> "Aurora". */
export function nombreBreve(nombre: string): string {
  const limpio = sinFicticio(nombre);
  const genericas = /^(conectividad|red|cooperativa|telecom|coop\.?|conecta|internet|servicios)$/i;
  const propias = limpio.split(/\s+/).filter((p) => !genericas.test(p));
  return propias[0] ?? limpio;
}

/** "Juzgado de Garantías N.º 3 (ficticio) — Distrito Judicial Centro" -> "Juzgado de Garantías N.º 3, Distrito Judicial Centro". */
export function juzgadoBreve(nombre: string | null | undefined): string {
  return sinFicticio(nombre)
    .split(/\s+—\s+/)
    .join(", ")
    .trim();
}

/** Primer rótulo del host, para el recorrido: "s2.pelotaya.test" -> "s2". */
export function hostCorto(host: string): string {
  return host.split(".")[0] ?? host;
}

/** El nombre del partido sin el prefijo del simulador. */
export function partidoBreve(nombre: string | null | undefined): string {
  return sinFicticio(nombre).replace(/^partido de práctica\s+—\s+/i, "");
}

export function plural(n: number, uno: string, muchos: string): string {
  return `${entero.format(n)} ${n === 1 ? uno : muchos}`;
}

/** Une una lista con comas y una "y" final. */
export function lista(items: string[]): string {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")} y ${items[items.length - 1]}`;
}

export const CLASE: Record<ClaseMedida, string> = {
  inicial: "Nueva filtración",
  ampliacion: "Ampliación",
  ratificacion: "Ratificación",
  levantamiento: "Levantamiento",
};

/** Comienzo del nombre accesible de cada tarjeta. */
export const CLASE_ACCESIBLE: Record<ClaseMedida, string> = {
  inicial: "Nueva filtración",
  ampliacion: "Ampliación",
  ratificacion: "Ratificación",
  levantamiento: "Reclamo",
};

export const CLASE_ACTO: Record<ClaseMedida, string> = {
  inicial: "medida inicial",
  ampliacion: "ampliación",
  ratificacion: "ratificación",
  levantamiento: "levantamiento",
};

export const ESTADO_MEDIDA: Record<EstadoMedida, string> = {
  pendiente: "Espera firma",
  aprobada: "Firmada",
  rechazada: "Rechazada",
  sin_efecto: "Sin efecto",
};

export const TIPO: Record<TipoBloqueo, string> = { ip: "IP", dominio: "Dominio" };
export const TIPO_CELDA: Record<TipoBloqueo, string> = { ip: "IP", dominio: "Dom." };

/** Luz de un estado: los tres colores, un anillo, una luz apagada o nada. */
export type TonoLuz = "verde" | "ambar" | "roja" | "anillo" | "apagada" | "ninguna";
export type TintaEstado = "verde" | "ambar" | "roja" | "neutra";

/** Rótulo y luz de cada estado de orden. Verde, ámbar y rojo solo se usan acá y en las verificaciones. */
export const ESTADO_ORDEN: Record<EstadoCelda, { rotulo: string; luz: TonoLuz; tinta: TintaEstado }> = {
  por_enviar: { rotulo: "Por enviar", luz: "anillo", tinta: "neutra" },
  recibida: { rotulo: "Recibida", luz: "ambar", tinta: "ambar" },
  aplicada: { rotulo: "Aplicada", luz: "verde", tinta: "verde" },
  fallida: { rotulo: "Falló", luz: "roja", tinta: "roja" },
  rechazada: { rotulo: "Rechazada", luz: "roja", tinta: "roja" },
  vencida: { rotulo: "Venció", luz: "apagada", tinta: "neutra" },
  levantada: { rotulo: "Levantada", luz: "anillo", tinta: "neutra" },
  no_enviada: { rotulo: "No enviada", luz: "ninguna", tinta: "neutra" },
  sin_orden: { rotulo: "Sin orden", luz: "ninguna", tinta: "neutra" },
  sin_cobertura: { rotulo: "Sin cobertura", luz: "ninguna", tinta: "neutra" },
};

export const ESTADO_EXPEDIENTE: Record<"pendiente" | "activo" | "rechazado" | "cerrado", string> = {
  pendiente: "Espera al juez",
  activo: "Bloqueos vigentes",
  rechazado: "Rechazado",
  cerrado: "Cerrado",
};

/** Estado de un servidor previo, dicho en masculino ("contra s2, aprobado"). */
export const ESTADO_PREVIO: Record<string, string> = {
  aprobada: "aprobado",
  pendiente: "sin firmar todavía",
  rechazada: "rechazado",
  sin_efecto: "sin efecto",
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
