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
