// Utilidades sobre nombres de host. No usa la lista pública de sufijos: alcanza
// con los TLD de un solo nivel y los sufijos de dos niveles más comunes
// (com.ar, gob.ar, co.uk, etc.).

const SEGUNDO_NIVEL = new Set(["com", "org", "net", "gob", "gov", "edu", "co", "mil", "int", "tur", "ac"]);

function normalizar(host: string): string {
  return host.trim().toLowerCase().replace(/\.$/, "");
}

/** Dominio registrable ("pelota.test" para "s1.pelota.test"). Una IP se devuelve tal cual. */
export function dominioRegistrable(host: string): string {
  const h = normalizar(host);
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(h)) return h;
  const etiquetas = h.split(".").filter(Boolean);
  if (etiquetas.length <= 2) return etiquetas.join(".");
  const ultima = etiquetas[etiquetas.length - 1]!;
  const anteultima = etiquetas[etiquetas.length - 2]!;
  const niveles = ultima.length === 2 && SEGUNDO_NIVEL.has(anteultima) ? 3 : 2;
  return etiquetas.slice(-niveles).join(".");
}

/** Verdadero si `host` es `dominio` o un subdominio suyo. */
export function esMismoOSubdominio(host: string, dominio: string): boolean {
  const h = normalizar(host);
  const d = normalizar(dominio);
  return d.length > 0 && (h === d || h.endsWith("." + d));
}
