// Llamadas a la API de Offside y sesión por pestaña.
//
// La sesión vive en sessionStorage a propósito: en el partido final hay dos
// jueces abiertos en dos pestañas del mismo navegador.

import type { ErrorDTO, UsuarioDTO } from "../../compartido/tipos.ts";

export interface Sesion {
  token: string;
  usuario: UsuarioDTO;
}

/** `codigo` 0 significa que Offside no respondió (red caída o servidor apagado). */
export class ErrorApi extends Error {
  readonly codigo: number;
  constructor(codigo: number, mensaje: string) {
    super(mensaje);
    this.codigo = codigo;
  }
}

const CLAVE = "offside.sesion";

function leer(): Sesion | null {
  try {
    const texto = sessionStorage.getItem(CLAVE);
    if (!texto) return null;
    const s = JSON.parse(texto) as Sesion;
    return s && typeof s.token === "string" && s.usuario ? s : null;
  } catch {
    return null;
  }
}

let sesion: Sesion | null = leer();
const oyentes = new Set<() => void>();

export function sesionActual(): Sesion | null {
  return sesion;
}

export function guardarSesion(nueva: Sesion | null): void {
  sesion = nueva;
  try {
    if (nueva) sessionStorage.setItem(CLAVE, JSON.stringify(nueva));
    else sessionStorage.removeItem(CLAVE);
  } catch {
    // Sin almacenamiento la sesión dura lo que dure la página.
  }
  for (const oyente of [...oyentes]) oyente();
}

export function suscribirSesion(oyente: () => void): () => void {
  oyentes.add(oyente);
  return () => oyentes.delete(oyente);
}

interface Opciones {
  metodo?: "GET" | "POST";
  cuerpo?: unknown;
  /** Las rutas públicas no mandan token ni cierran la sesión ante un 401. */
  publica?: boolean;
}

/**
 * Tiempo máximo de espera. Con la red de una sede, un pedido puede quedar colgado
 * sin fallar: se corta para que la pantalla siga pidiendo datos nuevos.
 */
const LIMITE_MS = { GET: 8000, POST: 20_000 } as const;

/** Devuelve el cuerpo como texto; lanza ErrorApi con el `error` que escribió el servidor. */
export async function pedirTexto(ruta: string, opciones: Opciones = {}): Promise<string> {
  const cabeceras: Record<string, string> = { Accept: "application/json" };
  const token = opciones.publica ? null : sesion?.token;
  if (token) cabeceras.Authorization = `Bearer ${token}`;
  const metodo = opciones.metodo ?? "GET";
  if (metodo === "POST") cabeceras["Content-Type"] = "application/json";

  const corte = new AbortController();
  let vencio = false;
  const reloj = setTimeout(() => {
    vencio = true;
    corte.abort();
  }, LIMITE_MS[metodo]);

  let respuesta: Response;
  let texto: string;
  try {
    respuesta = await fetch(ruta, {
      method: metodo,
      headers: cabeceras,
      body: metodo === "POST" ? JSON.stringify(opciones.cuerpo ?? {}) : undefined,
      signal: corte.signal,
      cache: "no-store",
    });
    texto = await respuesta.text();
  } catch {
    throw new ErrorApi(0, vencio ? "Offside tardó demasiado en responder." : "Sin conexión con Offside.");
  } finally {
    clearTimeout(reloj);
  }
  if (respuesta.ok) return texto;

  let mensaje = "";
  try {
    mensaje = (JSON.parse(texto) as ErrorDTO).error ?? "";
  } catch {
    // Un proxy o un servidor caído pueden contestar algo que no es JSON.
  }
  if (respuesta.status === 401 && !opciones.publica && token && sesion?.token === token) guardarSesion(null);
  // Un 502 o 504 sin mensaje propio es el camino hasta Offside, no Offside.
  const sinServidor = !mensaje && respuesta.status >= 502;
  throw new ErrorApi(
    sinServidor ? 0 : respuesta.status,
    mensaje || (sinServidor ? "Sin conexión con Offside." : `Offside respondió con un error (${respuesta.status}).`),
  );
}

export async function pedir<T>(ruta: string, opciones: Opciones = {}): Promise<T> {
  const texto = await pedirTexto(ruta, opciones);
  try {
    return JSON.parse(texto) as T;
  } catch {
    throw new ErrorApi(0, "Offside contestó algo que no se pudo leer.");
  }
}
