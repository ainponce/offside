// Contrato entre el servidor y la interfaz web. Todo lo que devuelve la API está
// descrito acá; la interfaz no necesita conocer nada más del servidor.
//
// Rutas (JSON; autenticación con `Authorization: Bearer <token>`):
//
//   POST /api/ingreso  {usuario, contrasena}      público   -> RespuestaIngreso | 401 ErrorDTO
//   POST /api/salida                              cualquiera-> {ok: true}
//   GET  /api/yo                                  cualquiera-> UsuarioDTO
//   GET  /api/estado                              público   -> EstadoDTO
//   GET  /api/eventos                             público   -> SSE: evento `cambio` con {seq}; `latido` cada 5 s
//   GET  /api/juez/cola                           juez      -> ColaDTO
//   POST /api/juez/medidas/:id/aprobar  {huella?}  juez      -> {ok: true} | 403 | 409 | 503 ErrorDTO
//        (con `huella`, 409 "La medida cambió: revisala de nuevo" si no es la huella actual de la medida)
//   POST /api/juez/medidas/:id/rechazar {motivo}  juez      -> {ok: true} | 403 | 409 ErrorDTO
//   POST /api/juez/medidas/:id/reconsiderar       juez      -> {ok: true} | 403 | 409 ErrorDTO
//   GET  /api/tablero                             juez o fiscalía -> TableroDTO
//   GET  /api/expedientes/:id                     juez o fiscalía -> ExpedienteDTO | 404
//   GET  /api/transparencia                       público   -> TransparenciaDTO
//
// Los tiempos son minutos de partido según el simulador (número con decimales).
// Los textos que escribe el servidor usan coma decimal ("minuto 37,5") e "IP" en mayúsculas.

export type Rol = "juez" | "fiscalia";
export type TipoBloqueo = "ip" | "dominio";
export type Luz = "verde" | "ambar" | "roja";
export type ClaseMedida = "inicial" | "ampliacion" | "ratificacion" | "levantamiento";
export type EstadoMedida = "pendiente" | "aprobada" | "rechazada" | "sin_efecto";
export type EstadoOrden =
  | "por_enviar"
  | "recibida"
  | "aplicada"
  | "fallida"
  | "vencida"
  | "levantada"
  | "rechazada"
  | "no_enviada";

export interface ErrorDTO {
  error: string;
}

export interface UsuarioDTO {
  usuario: string;
  nombre: string;
  rol: Rol;
  juez_id: string | null;
  juzgado_nombre: string | null;
  /** Solo tiene sentido para jueces: ¿está de turno ahora según el simulador? */
  de_turno: boolean;
}

export interface RespuestaIngreso {
  token: string;
  usuario: UsuarioDTO;
}

export interface EstadoDTO {
  /** Falso si el simulador no responde. */
  conectado: boolean;
  ultimo_error: string | null;
  partido: { id: string; nombre: string; titular_derechos: string | null } | null;
  minuto: number;
  fin_min: number;
  finalizado: boolean;
  /** Minutos de partido por minuto real. */
  acelerar: number;
  jueces_de_turno: { id: string; nombre: string; juzgado_nombre: string }[];
  /**
   * Horario de turnos según GET /juzgados del simulador, en el orden en que lo publica.
   * Vacío si el simulador no lo publica (entonces solo vale `jueces_de_turno`).
   */
  turnos: TurnoDTO[];
  alertas: string[];
  /** Verdadero si el servidor corre con el simulacro de reclamos activado. */
  simulacro: boolean;
  /** Contador de cambios; coincide con el `seq` del último evento `cambio`. */
  seq: number;
}

export interface TurnoDTO {
  juez_id: string;
  nombre: string;
  /** De turno desde este minuto (incluido) hasta `hasta_min` (excluido). */
  desde_min: number;
  hasta_min: number;
}

/** Una de las cuatro verificaciones que ve el juez en la tarjeta. */
export interface VerificacionDTO {
  clave: "senal" | "licenciatario" | "servidor" | "colateral";
  luz: Luz;
  /** Frase corta, pensada para leerse de un vistazo. */
  titulo: string;
  detalle: string;
}

export interface PlanItemDTO {
  proveedor_id: string;
  proveedor_nombre: string;
  clientes: number;
  /** Clientes del proveedor sobre el total de clientes de todos los proveedores (0 a 100, un decimal). */
  clientes_pct: number;
  /** null cuando no se envía a ese proveedor. */
  tipo: TipoBloqueo | null;
  objetivo: string | null;
  sin_cobertura: string | null;
}

export interface OrdenDTO {
  orden_id: string;
  proveedor_id: string;
  proveedor_nombre: string;
  tipo: TipoBloqueo;
  objetivo: string;
  vence_min: number;
  juez_id: string;
  intento: number;
  estado: EstadoOrden;
  enviada_min: number | null;
  aplicada_min: number | null;
  finalizada_min: number | null;
  error: string | null;
}

export interface EvidenciaDTO {
  deteccion_id: string;
  minuto: number;
  deteccion_sha256: string;
  captura_sha256: string | null;
  formato_ok: boolean;
  pagina: string | null;
  stream_url: string | null;
}

export interface DecisionDTO {
  juez_id: string | null;
  juez_nombre: string | null;
  minuto: number | null;
  hora_iso: string | null;
  resultado: "aprobada" | "rechazada" | "sin_efecto";
  motivo: string | null;
}

export interface MedidaDTO {
  id: string;
  expediente_id: string;
  clase: ClaseMedida;
  estado: EstadoMedida;
  creada_min: number;
  /** Minutos de partido que lleva esperando (0 si ya se decidió). */
  espera_min: number;
  marca: string;
  servidor: { host: string; ip: string; asn: number | null; organizacion: string | null } | null;
  /** Siempre cuatro, en este orden: senal, licenciatario, servidor, colateral. */
  verificaciones: VerificacionDTO[];
  /** Una línea que resume lo que se le pide al juez. */
  pedido: string;
  tipo_recomendado: TipoBloqueo | null;
  /** Sitios ajenos que comparten la IP (los que caerían con un bloqueo por IP). */
  terceros: string[];
  advertencias: string[];
  plan: PlanItemDTO[];
  vence_min: number;
  huella: string;
  evidencia: EvidenciaDTO[];
  promocion: { red: string; url: string; minuto: number }[];
  /** Verdadero si la medida es el error forzado del simulacro. */
  simulacro: boolean;
  /** Solo en ampliaciones: los servidores de la misma filtración ya presentados. */
  ampliacion: { servidores_previos: { host: string; ip: string; estado: string | null }[] } | null;
  /** Solo en ratificaciones: quién aprobó la medida original y por qué hay que reenviar. */
  ratificacion: {
    origen_medida_id: string;
    juez_original_id: string | null;
    juez_original_nombre: string | null;
    decidida_min: number | null;
    motivo: string;
  } | null;
  /** Solo en levantamientos: el reclamo y las órdenes que se levantan. */
  levantamiento: {
    reclamo_id: string;
    dominio: string;
    proveedor_id: string;
    proveedor_nombre: string;
    mensaje: string;
    verificacion: string;
    ordenes_a_levantar: { orden_id: string; proveedor_id: string; proveedor_nombre: string; tipo: TipoBloqueo; objetivo: string }[];
  } | null;
  decision: DecisionDTO | null;
  ordenes: OrdenDTO[];
}

export interface ColaDTO {
  estado: EstadoDTO;
  yo: UsuarioDTO;
  /**
   * Medidas que esperan decisión. Un juez fuera de turno las ve pero no puede firmar.
   * Primero los levantamientos (hay un sitio legítimo caído ahora); después, en orden de llegada.
   */
  pendientes: MedidaDTO[];
  /** Últimas medidas decididas (cualquier juez), la más nueva primero. */
  recientes: MedidaDTO[];
}

export type EstadoCelda = EstadoOrden | "sin_orden" | "sin_cobertura";

/**
 * Dónde está el servidor, a nivel de ciudad (ver src/server/geo.ts). Orientativa: no es parte de lo
 * que firma el juez.
 * - `geoip`: una IP pública, buscada en la base GeoIP local.
 * - `simulada`: una IP de documentación (RFC 5737), como las del simulador, que no tiene ubicación real.
 */
export interface UbicacionDTO {
  /** Clave para agrupar: varios servidores pueden compartir centro de datos o ciudad. */
  sitio: string;
  ciudad: string | null;
  provincia: string | null;
  /** ISO 3166-1 alfa-2. */
  pais: string;
  pais_nombre: string;
  en_argentina: boolean;
  lat: number;
  lon: number;
  /** Radio de precisión que declara la base, si lo declara. */
  precision_km: number | null;
  fuente: "geoip" | "simulada";
}

/** Qué base GeoIP está cargada. Sin base, las IPs públicas quedan sin ubicación. */
export interface GeoEstadoDTO {
  base: string | null;
  /** Texto de atribución que pide la licencia de la base, si lo pide. */
  atribucion: string | null;
}

export interface ServidorDTO {
  id: number;
  host: string;
  ip: string;
  asn: number | null;
  organizacion: string | null;
  tipo_recomendado: TipoBloqueo;
  terceros: string[];
  primera_deteccion_min: number;
  detecciones: number;
  medida_id: string | null;
  medida_clase: ClaseMedida | null;
  medida_estado: EstadoMedida | null;
  /** Minutos desde la primera detección hasta el primer bloqueo confirmado. */
  primer_bloqueo_min: number | null;
  /** Porcentaje de clientes del país con el bloqueo aplicado ahora. */
  cobertura_pct: number;
  /** El mayor porcentaje de clientes con el bloqueo aplicado a la vez en algún momento (no cae a 0 al vencer). */
  cobertura_max_pct: number;
  /** Una celda por proveedor del registro, en el mismo orden que TableroDTO.proveedores. */
  por_proveedor: { proveedor_id: string; estado: EstadoCelda; tipo: TipoBloqueo | null; intento: number }[];
  /** null: IP privada o reservada, sin base GeoIP o que la base no conoce. */
  ubicacion: UbicacionDTO | null;
  /** Si la IP es de una CDN o un proxy inverso: la ubicación es la del borde, no la del origen. */
  intermediario: string | null;
}

export interface ExpedienteResumenDTO {
  id: string;
  marca: string;
  prefijo: string;
  origen_prefijo: string | null;
  abierto_min: number;
  /** pendiente: espera al juez · activo: hay bloqueos vigentes · rechazado · cerrado: todo venció o se levantó */
  estado: "pendiente" | "activo" | "rechazado" | "cerrado";
  servidores: ServidorDTO[];
}

export interface AuditoriaItemDTO {
  seq: number;
  minuto: number | null;
  hora_iso: string;
  actor: string;
  tipo: string;
  /** Frase legible del evento. */
  resumen: string;
  hash: string;
}

export interface TableroDTO {
  estado: EstadoDTO;
  metricas: {
    expedientes: number;
    medidas_pendientes: number;
    detecciones: number;
    archivadas: number;
    ordenes_activas: number;
    tiempo_medio_primer_bloqueo_min: number | null;
    cobertura_media_pct: number | null;
    /** Promedio de `cobertura_max_pct` de los servidores con medida aprobada: no cae a 0 después del pitazo final. */
    cobertura_max_pct: number | null;
    reclamos: number;
    /** Lo que habría caído con un bloqueo automático por IP. */
    dano_evitado: { sitios: string[]; senales_legitimas: string[] };
  };
  proveedores: { id: string; nombre: string; clientes: number; capacidades: TipoBloqueo[] }[];
  expedientes: ExpedienteResumenDTO[];
  archivadas: {
    deteccion_id: string;
    minuto: number;
    host: string;
    ip: string;
    marca: string | null;
    veredicto: string;
    motivo: string;
  }[];
  reclamos: {
    id: string;
    minuto: number;
    dominio: string;
    proveedor_id: string;
    proveedor_nombre: string;
    mensaje: string;
    estado: "verificado" | "no_verificado" | "resuelto";
    medida_id: string | null;
  }[];
  auditoria: { entradas: number; cabecera: string; ultimas: AuditoriaItemDTO[] };
  geo: GeoEstadoDTO;
}

export interface ExpedienteDTO extends ExpedienteResumenDTO {
  /** Lo mismo que GET /api/estado (`estado`, heredado del resumen, es el del expediente). */
  estado_general: EstadoDTO;
  partido: { id: string; nombre: string; titular_derechos: string | null } | null;
  medidas: MedidaDTO[];
  detecciones: {
    id: string;
    minuto: number;
    host: string;
    ip: string;
    sha256: string;
    captura_sha256: string | null;
    formato_ok: boolean;
    recibida_min: number;
    recibida_iso: string;
  }[];
  /** Texto del aviso al titular para cortar la fuente de la filtración. El simulador no lo modela. */
  aviso_titular: string;
  auditoria: AuditoriaItemDTO[];
}

export interface TransparenciaDTO {
  /** Lo mismo que GET /api/estado. */
  estado: EstadoDTO;
  partido: { id: string; nombre: string; titular_derechos: string | null } | null;
  minuto: number;
  fin_min: number;
  finalizado: boolean;
  bloqueos: {
    expediente_id: string;
    medida_id: string;
    tipo: TipoBloqueo;
    objetivo: string;
    desde_min: number | null;
    hasta_min: number;
    estado: "vigente" | "vencido" | "levantado" | "en_curso";
    juzgado: string | null;
    juez: string | null;
    huella: string;
    proveedores_confirmados: number;
    proveedores_total: number;
  }[];
  auditoria: { entradas: number; cabecera: string };
  como_reclamar: string;
}
