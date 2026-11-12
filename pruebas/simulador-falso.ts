// Simulador en memoria para las pruebas. Imita lo que hace el simulador oficial
// en lo que a Offside le importa: valida la firma y el tipo de bloqueo, anota si
// el juez estaba de turno al recibir la orden, y hace avanzar las órdenes.

import { createHmac } from "node:crypto";
import {
  type Deteccion,
  type DnsDominio,
  type DnsIp,
  ErrorDeRed,
  type EstadoOrdenProveedor,
  type EstadoOrdenSim,
  type EstadoSim,
  type JuzgadosSim,
  type OrdenSim,
  type Partido,
  type Proveedor,
  type ReclamoSim,
  type RespuestaEnvio,
  type Simulador,
} from "../src/server/simulador.ts";

export const CLAVES: Record<string, string> = { "jueza-a": "clave-a", "juez-b": "clave-b" };

export interface OrdenRecibida extends OrdenSim {
  proveedor: string;
  estado: EstadoOrdenProveedor;
  recibida_min: number;
  aplica_min: number;
  aplicada_min?: number;
  finalizada_min?: number;
  juez_de_turno: boolean;
  falla: boolean;
}

export class SimuladorFalso implements Simulador {
  minuto = 0;
  fin_min = 105;
  caido = false;
  turnos = [
    { juez_id: "jueza-a", desde_min: -60, hasta_min: 50 },
    { juez_id: "juez-b", desde_min: 50, hasta_min: 240 },
  ];
  partidoDatos: Partido = {
    id: "falso-01",
    nombre: "Partido de prueba",
    titular_derechos: "Liga de prueba",
    inicio_iso: "2026-11-12T18:00:00-03:00",
    fin_min: 105,
    marcas_de_agua_validas: [
      { prefijo: "TX26-OFI", origen: "Señal oficial" },
      { prefijo: "TX26-LIC-SUR", origen: "Licenciatario Canal Sur" },
    ],
    licenciatarios: [
      { nombre: "Canal Sur", prefijo_marca: "TX26-LIC-SUR", dominios_autorizados: ["canalsur.test"] },
    ],
  };
  proveedoresLista: Proveedor[] = [
    { id: "grande", nombre: "Grande", clientes: 1000, capacidades: ["ip", "dominio"] },
    { id: "solo-dominio", nombre: "Solo dominio", clientes: 100, capacidades: ["dominio"] },
    { id: "inestable", nombre: "Inestable", clientes: 10, capacidades: ["ip", "dominio"] },
  ];
  dns: Record<string, { asn: number; organizacion: string; dominios: string[] }> = {
    "203.0.113.5": { asn: 64600, organizacion: "Bruma Hosting Dedicado", dominios: ["s1.pelota.test"] },
    "203.0.113.6": { asn: 64600, organizacion: "Bruma Hosting Dedicado", dominios: ["s2.pelota.test"] },
    "198.51.100.20": {
      asn: 64610,
      organizacion: "NubeRápida CDN",
      dominios: ["vivo.gol.test", "panaderia.test", "escuela.test"],
    },
    "192.0.2.10": { asn: 64640, organizacion: "Canal Sur", dominios: ["canalsur.test"] },
  };

  private publicadas: { det: unknown; minuto: number }[] = [];
  private reclamosEmitidos: ReclamoSim[] = [];
  readonly libro = new Map<string, Map<string, OrdenRecibida>>();
  /** Proveedores cuya próxima orden va a fallar al aplicarse. */
  readonly fallasPendientes = new Map<string, number>();
  /** Cantidad de envíos que se pierden antes de llegar (corte de red). */
  cortesAntes = 0;
  /** Cantidad de envíos que llegan pero cuya respuesta se pierde. */
  cortesDespues = 0;
  llamadasEnvio = 0;
  levantamientos: { proveedor: string; orden_id: string; juez_id: string; motivo: string }[] = [];

  // --- control desde las pruebas -------------------------------------------------

  publicar(det: Deteccion): void {
    this.publicadas.push({ det, minuto: det.minuto });
  }

  /** Publica cualquier cosa (null, números, objetos rotos) como si fuera una detección del minuto dado. */
  publicarCrudo(det: unknown, minuto: number): void {
    this.publicadas.push({ det, minuto });
  }

  /** Simula un reinicio del simulador: mismas detecciones por publicar, reloj y órdenes desde cero. */
  reiniciar(minuto = 0): void {
    this.minuto = minuto;
    this.libro.clear();
    this.reclamosEmitidos = [];
  }

  emitirReclamo(r: ReclamoSim): void {
    this.reclamosEmitidos.push(r);
  }

  avanzar(minuto: number): void {
    this.minuto = minuto;
    for (const porProveedor of this.libro.values()) {
      for (const o of porProveedor.values()) {
        if (o.estado === "recibida" && minuto >= o.aplica_min) {
          if (o.falla) {
            o.estado = "fallida";
          } else {
            o.estado = "aplicada";
            o.aplicada_min = o.aplica_min;
          }
        }
        if (o.estado === "aplicada" && minuto >= o.vence_min) {
          o.estado = "vencida";
          o.finalizada_min = Math.max(o.vence_min, o.aplicada_min ?? o.vence_min);
        }
      }
    }
  }

  recibidas(proveedor?: string): OrdenRecibida[] {
    const todas = [...this.libro.values()].flatMap((m) => [...m.values()]);
    return proveedor ? todas.filter((o) => o.proveedor === proveedor) : todas;
  }

  private deTurno(): string[] {
    return this.turnos.filter((t) => t.desde_min <= this.minuto && this.minuto < t.hasta_min).map((t) => t.juez_id);
  }

  private exigirConexion(): void {
    if (this.caido) throw new ErrorDeRed("fetch failed: ECONNREFUSED");
  }

  // --- interfaz Simulador ----------------------------------------------------------

  async estado(): Promise<EstadoSim> {
    this.exigirConexion();
    return {
      partido: this.partidoDatos.id,
      minuto_actual: this.minuto,
      fin_min: this.fin_min,
      finalizado: this.minuto >= this.fin_min,
      acelerar: 6,
      jueces_de_turno: this.deTurno(),
    };
  }

  async partido(): Promise<Partido> {
    this.exigirConexion();
    return this.partidoDatos;
  }

  /** Falso si el simulador no publica GET /juzgados (para probar que Offside sigue sin el horario). */
  conJuzgados = true;
  llamadasJuzgados = 0;

  async juzgados(): Promise<JuzgadosSim> {
    this.exigirConexion();
    this.llamadasJuzgados += 1;
    if (!this.conJuzgados) throw new ErrorDeRed("El simulador respondió 404 en /juzgados: Ruta inexistente");
    return {
      juzgados: [
        { id: "jg-1", nombre: "Juzgado 1", jueces: [{ id: "jueza-a", nombre: "Dra. A" }] },
        { id: "jg-2", nombre: "Juzgado 2", jueces: [{ id: "juez-b", nombre: "Dr. B" }] },
      ],
      turnos: this.turnos.map((t) => ({ ...t })),
    };
  }

  async detecciones(desde: number): Promise<{ minuto_actual: number; detecciones: Deteccion[] }> {
    this.exigirConexion();
    return {
      minuto_actual: this.minuto,
      detecciones: this.publicadas.filter((d) => d.minuto > desde && d.minuto <= this.minuto).map((d) => d.det as Deteccion),
    };
  }

  /** Se llama al consultar el DNS pasivo por IP (por ejemplo, para mover el reloj durante la guardia). */
  alConsultarDns: (() => void) | null = null;

  async dnsIp(ip: string): Promise<DnsIp | null> {
    this.exigirConexion();
    this.alConsultarDns?.();
    const r = this.dns[ip];
    return r ? { ip, asn: r.asn, organizacion: r.organizacion, dominios: r.dominios } : null;
  }

  async dnsDominio(dominio: string): Promise<DnsDominio | null> {
    this.exigirConexion();
    const ips = Object.entries(this.dns)
      .filter(([, r]) => r.dominios.includes(dominio))
      .map(([ip, r]) => ({ ip, asn: r.asn, organizacion: r.organizacion }));
    return ips.length ? { dominio, ips } : null;
  }

  async proveedores(): Promise<Proveedor[]> {
    this.exigirConexion();
    return this.proveedoresLista;
  }

  async enviarOrden(proveedorId: string, orden: OrdenSim): Promise<RespuestaEnvio> {
    this.exigirConexion();
    this.llamadasEnvio += 1;
    if (this.cortesAntes > 0) {
      this.cortesAntes -= 1;
      throw new ErrorDeRed("fetch failed: socket hang up");
    }
    const proveedor = this.proveedoresLista.find((p) => p.id === proveedorId);
    if (!proveedor) return { ok: false, estado: 404, error: "Proveedor desconocido" };
    const propias = this.libro.get(proveedorId) ?? new Map<string, OrdenRecibida>();
    this.libro.set(proveedorId, propias);
    if (propias.has(orden.orden_id)) return { ok: false, estado: 409, error: "Ya existe una orden con ese orden_id" };
    if (!proveedor.capacidades.includes(orden.tipo)) {
      return { ok: false, estado: 422, error: `${proveedor.nombre} no aplica bloqueos por ${orden.tipo}` };
    }
    if (!Number.isInteger(orden.vence_min) || orden.vence_min <= this.minuto) {
      return { ok: false, estado: 422, error: "vence_min debe ser posterior al minuto actual" };
    }
    const clave = CLAVES[orden.juez_id];
    if (!clave) return { ok: false, estado: 403, error: "El juez no figura en el registro" };
    const esperada = createHmac("sha256", clave)
      .update(`${orden.orden_id}|${orden.tipo}|${orden.objetivo}|${orden.vence_min}|${orden.juez_id}`)
      .digest("hex");
    if (esperada !== orden.firma) return { ok: false, estado: 403, error: "Firma inválida" };

    const fallas = this.fallasPendientes.get(proveedorId) ?? 0;
    if (fallas > 0) this.fallasPendientes.set(proveedorId, fallas - 1);
    propias.set(orden.orden_id, {
      ...orden,
      proveedor: proveedorId,
      estado: "recibida",
      recibida_min: this.minuto,
      aplica_min: this.minuto + 0.5,
      juez_de_turno: this.deTurno().includes(orden.juez_id),
      falla: fallas > 0,
    });
    if (this.cortesDespues > 0) {
      this.cortesDespues -= 1;
      throw new ErrorDeRed("fetch failed: respuesta perdida");
    }
    return { ok: true };
  }

  async ordenes(proveedorId: string): Promise<EstadoOrdenSim[]> {
    this.exigirConexion();
    return this.ordenesDe(proveedorId);
  }

  private ordenesDe(proveedorId: string): EstadoOrdenSim[] {
    return [...(this.libro.get(proveedorId)?.values() ?? [])].map((o) => ({
      orden_id: o.orden_id,
      estado: o.estado,
      recibida_min: o.recibida_min,
      aplicada_min: o.aplicada_min,
      finalizada_min: o.finalizada_min,
    }));
  }

  async levantar(
    proveedorId: string,
    ordenId: string,
    cuerpo: { juez_id: string; firma: string; motivo: string },
  ): Promise<RespuestaEnvio> {
    this.exigirConexion();
    const orden = this.libro.get(proveedorId)?.get(ordenId);
    if (!orden) return { ok: false, estado: 404, error: "Orden inexistente" };
    const clave = CLAVES[cuerpo.juez_id];
    if (!clave) return { ok: false, estado: 403, error: "El juez no figura en el registro" };
    const esperada = createHmac("sha256", clave).update(`LEVANTAR|${ordenId}|${cuerpo.juez_id}`).digest("hex");
    if (esperada !== cuerpo.firma) return { ok: false, estado: 403, error: "Firma inválida" };
    if (orden.estado !== "recibida" && orden.estado !== "aplicada") {
      return { ok: false, estado: 409, error: "La orden ya no está activa" };
    }
    orden.estado = "levantada";
    orden.finalizada_min = this.minuto;
    this.levantamientos.push({ proveedor: proveedorId, orden_id: ordenId, juez_id: cuerpo.juez_id, motivo: cuerpo.motivo });
    return { ok: true };
  }

  async reclamos(desde: number): Promise<{ minuto_actual: number; reclamos: ReclamoSim[] }> {
    this.exigirConexion();
    return { minuto_actual: this.minuto, reclamos: this.reclamosEmitidos.filter((r) => r == null || r.minuto > desde) };
  }
}
