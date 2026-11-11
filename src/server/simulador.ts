// Tipos de lo que entrega el simulador oficial del Desafío Fútbol y la interfaz
// por la que Offside le habla. El motor solo conoce la interfaz `Simulador`;
// las pruebas la reemplazan por una implementación en memoria.

export type TipoBloqueo = "ip" | "dominio";

export interface Partido {
  id: string;
  nombre: string;
  titular_derechos?: string;
  inicio_iso?: string;
  fin_min: number;
  marcas_de_agua_validas: { prefijo: string; origen: string }[];
  licenciatarios: { nombre: string; prefijo_marca: string; dominios_autorizados: string[] }[];
}

export interface Deteccion {
  id: string;
  minuto: number;
  pagina?: string;
  stream_url?: string;
  host_stream: string;
  ip_servidor: string;
  asn?: number | null;
  marca_de_agua_extraida?: string | null;
  captura?: {
    capturada_min?: number;
    formato?: string;
    duracion_seg?: number;
    contenido_b64?: string;
  } | null;
  promocion?: { red: string; url: string; minuto: number }[];
}

export interface DnsIp {
  ip: string;
  asn: number | null;
  organizacion: string | null;
  dominios: string[];
}

export interface DnsDominio {
  dominio: string;
  ips: { ip: string; asn: number | null; organizacion: string | null }[];
}

export interface Proveedor {
  id: string;
  nombre: string;
  tamano?: string;
  clientes: number;
  capacidades: TipoBloqueo[];
}

export interface EstadoSim {
  partido: string;
  minuto_actual: number;
  fin_min: number;
  finalizado: boolean;
  acelerar: number;
  jueces_de_turno: string[];
}

/** Cuerpo de una orden tal como la espera el simulador. */
export interface OrdenSim {
  orden_id: string;
  expediente_id: string;
  tipo: TipoBloqueo;
  objetivo: string;
  vence_min: number;
  juzgado_id: string;
  juez_id: string;
  firma: string;
}

export type EstadoOrdenProveedor = "recibida" | "aplicada" | "fallida" | "vencida" | "levantada";

export interface EstadoOrdenSim {
  orden_id: string;
  estado: EstadoOrdenProveedor;
  recibida_min?: number;
  aplicada_min?: number;
  finalizada_min?: number;
  motivo?: string;
}

export interface ReclamoSim {
  id: string;
  minuto: number;
  dominio: string;
  proveedor: string;
  mensaje: string;
}

export type RespuestaEnvio = { ok: true } | { ok: false; estado: number; error: string };

export interface Simulador {
  estado(): Promise<EstadoSim>;
  partido(): Promise<Partido>;
  detecciones(desde: number): Promise<{ minuto_actual: number; detecciones: Deteccion[] }>;
  dnsIp(ip: string): Promise<DnsIp | null>;
  dnsDominio(dominio: string): Promise<DnsDominio | null>;
  proveedores(): Promise<Proveedor[]>;
  enviarOrden(proveedorId: string, orden: OrdenSim): Promise<RespuestaEnvio>;
  ordenes(proveedorId: string): Promise<EstadoOrdenSim[]>;
  levantar(
    proveedorId: string,
    ordenId: string,
    cuerpo: { juez_id: string; firma: string; motivo: string },
  ): Promise<RespuestaEnvio>;
  reclamos(desde: number): Promise<{ minuto_actual: number; reclamos: ReclamoSim[] }>;
}

// --- cliente HTTP ---------------------------------------------------------------------

/**
 * Cliente del simulador oficial. Un error de red o un tiempo agotado se propaga
 * como excepción (el motor lo trata como corte); una respuesta 4xx o 5xx del
 * simulador se devuelve como dato.
 */
export class SimuladorHttp implements Simulador {
  private readonly base: string;
  private readonly tiempoMs: number;

  constructor(base: string, tiempoMs = 4000) {
    this.base = base.replace(/\/+$/, "");
    this.tiempoMs = tiempoMs;
  }

  private async pedir(ruta: string, cuerpo?: unknown): Promise<{ estado: number; datos: any }> {
    const respuesta = await fetch(this.base + ruta, {
      method: cuerpo === undefined ? "GET" : "POST",
      headers: cuerpo === undefined ? undefined : { "Content-Type": "application/json" },
      body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
      signal: AbortSignal.timeout(this.tiempoMs),
    });
    const texto = await respuesta.text();
    let datos: any = null;
    try {
      datos = texto ? JSON.parse(texto) : null;
    } catch {
      datos = { error: texto.slice(0, 200) };
    }
    return { estado: respuesta.status, datos };
  }

  private async leer<T>(ruta: string): Promise<T> {
    const { estado, datos } = await this.pedir(ruta);
    if (estado < 200 || estado >= 300) throw new Error(`El simulador respondió ${estado} en ${ruta}: ${datos?.error ?? ""}`);
    return datos as T;
  }

  private async leerOpcional<T>(ruta: string): Promise<T | null> {
    const { estado, datos } = await this.pedir(ruta);
    if (estado === 404) return null;
    if (estado < 200 || estado >= 300) throw new Error(`El simulador respondió ${estado} en ${ruta}: ${datos?.error ?? ""}`);
    return datos as T;
  }

  private async escribir(ruta: string, cuerpo: unknown): Promise<RespuestaEnvio> {
    const { estado, datos } = await this.pedir(ruta, cuerpo);
    if (estado >= 200 && estado < 300) return { ok: true };
    return { ok: false, estado, error: String(datos?.error ?? `Respuesta ${estado}`) };
  }

  estado(): Promise<EstadoSim> {
    return this.leer<EstadoSim>("/estado");
  }

  partido(): Promise<Partido> {
    return this.leer<Partido>("/partido");
  }

  detecciones(desde: number): Promise<{ minuto_actual: number; detecciones: Deteccion[] }> {
    return this.leer(`/detecciones?desde=${encodeURIComponent(String(desde))}`);
  }

  dnsIp(ip: string): Promise<DnsIp | null> {
    return this.leerOpcional<DnsIp>(`/dns-pasivo?ip=${encodeURIComponent(ip)}`);
  }

  dnsDominio(dominio: string): Promise<DnsDominio | null> {
    return this.leerOpcional<DnsDominio>(`/dns-pasivo?dominio=${encodeURIComponent(dominio)}`);
  }

  async proveedores(): Promise<Proveedor[]> {
    const lista = await this.leer<any[]>("/proveedores");
    return lista.map((p) => ({
      id: String(p.id),
      nombre: String(p.nombre ?? p.id),
      tamano: p.tamano,
      clientes: Number(p.clientes ?? 0),
      capacidades: Array.isArray(p.capacidades) ? p.capacidades : [],
    }));
  }

  enviarOrden(proveedorId: string, orden: OrdenSim): Promise<RespuestaEnvio> {
    return this.escribir(`/proveedores/${encodeURIComponent(proveedorId)}/ordenes`, orden);
  }

  async ordenes(proveedorId: string): Promise<EstadoOrdenSim[]> {
    const lista = await this.leer<any[]>(`/proveedores/${encodeURIComponent(proveedorId)}/ordenes`);
    return lista.map((o) => ({
      orden_id: String(o.orden_id),
      estado: o.estado,
      recibida_min: o.recibida_min,
      aplicada_min: o.aplicada_min,
      finalizada_min: o.finalizada_min,
      motivo: o.motivo,
    }));
  }

  levantar(
    proveedorId: string,
    ordenId: string,
    cuerpo: { juez_id: string; firma: string; motivo: string },
  ): Promise<RespuestaEnvio> {
    return this.escribir(
      `/proveedores/${encodeURIComponent(proveedorId)}/ordenes/${encodeURIComponent(ordenId)}/levantar`,
      cuerpo,
    );
  }

  reclamos(desde: number): Promise<{ minuto_actual: number; reclamos: ReclamoSim[] }> {
    return this.leer(`/reclamos?desde=${encodeURIComponent(String(desde))}`);
  }
}
