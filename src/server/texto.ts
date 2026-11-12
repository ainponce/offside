// Formato de lo que el servidor escribe para personas: números con coma decimal
// (castellano de Argentina), "IP" en mayúsculas y plurales.

const formatos = new Map<number, Intl.NumberFormat>();

/** 37.5 -> "37,5"; 3800000 -> "3.800.000". */
export function num(n: number | null | undefined, decimales = 1): string {
  if (n == null || !Number.isFinite(n)) return "—";
  let f = formatos.get(decimales);
  if (!f) {
    f = new Intl.NumberFormat("es-AR", { maximumFractionDigits: decimales });
    formatos.set(decimales, f);
  }
  const texto = f.format(n);
  return texto === "-0" ? "0" : texto;
}

/** Minuto de partido con un decimal: "minuto 37,5". */
export const minuto = (n: number | null | undefined) => `minuto ${num(n, 1)}`;

/** "ip" -> "IP"; "dominio" -> "dominio". */
export function tipoTexto(tipo: string | null | undefined): string {
  return tipo === "ip" ? "IP" : (tipo ?? "");
}

/** "bloqueo por IP" / "bloqueo por dominio". */
export const porTipo = (tipo: string | null | undefined) => `por ${tipoTexto(tipo)}`;

/** "la IP 203.0.113.5" / "el dominio s1.x.test". */
export const objetivoTexto = (tipo: string | null | undefined, objetivo: string) =>
  tipo === "ip" ? `la IP ${objetivo}` : `el dominio ${objetivo}`;

/** "de la IP 203.0.113.5" / "del dominio s1.x.test" (nunca "de el"). */
export const deObjetivo = (tipo: string | null | undefined, objetivo: string) =>
  tipo === "ip" ? `de la IP ${objetivo}` : `del dominio ${objetivo}`;

export const plural = (n: number, uno: string, muchos: string) => `${n} ${n === 1 ? uno : muchos}`;

/** Une una lista en castellano: "a", "a y b", "a, b y c". */
export function lista(items: string[]): string {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")} y ${items.at(-1)}`;
}
