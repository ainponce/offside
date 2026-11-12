// El motor: un ciclo que consulta al simulador y mantiene al día expedientes,
// medidas y órdenes (sección 6 del diseño). Nunca firma ni decide: eso lo hace
// el juez desde decisiones.ts.

import { type Contexto, alertar, nombreProveedor } from "./contexto.ts";
import { reiniciarBase } from "./reinicio.ts";
import { guardarKv, leerKv } from "./db.ts";
import { crearOrden, enviarOrden, impedimentoDeEnvio, pedirRatificacion } from "./despacho.ts";
import { analizarCaptura, huella, sha256Hex } from "./evidencia.ts";
import { type EvidenciaItem, instantaneaBloqueo, sellos } from "./instantanea.ts";
import {
  type FilaExpediente,
  type FilaMedida,
  type FilaOrden,
  type FilaServidor,
  ejecutar,
  enTransaccion,
  idExpediente,
  idMedida,
  medidaPorId,
  siguienteN,
  todas,
  una,
} from "./repositorio.ts";
import { claveExpediente, evaluarRiesgo, planPorProveedor, veredicto } from "./reglas.ts";
import { type Deteccion, type EstadoSim, esErrorDeRed } from "./simulador.ts";
import { minuto, objetivoTexto } from "./texto.ts";

/** Paso adicional del ciclo (los reclamos se enchufan acá). */
export type PasoExtra = (ctx: Contexto, estado: EstadoSim) => Promise<void>;

function mensajeDe(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

function esTexto(v: unknown): v is string {
  return typeof v === "string" && v.trim().length > 0;
}

const esNumero = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const textoONulo = (v: unknown): string | null => (typeof v === "string" ? v : null);
const numeroONulo = (v: unknown): number | null => (esNumero(v) ? v : null);

type Reinicio = { motivo: string; datos: Record<string, unknown> };

export class Motor {
  private readonly ctx: Contexto;
  private enCurso = false;
  /** Falso hasta leer partido y proveedores del simulador en este arranque. */
  private datosFrescos = false;
  /** Cuándo se leyó (o se intentó leer) por última vez el horario de turnos, en ms reales. */
  private turnosLeidosMs = 0;
  private turnosOk = false;
  /** Ciclos seguidos en que un proveedor no conoce órdenes nuestras que había recibido. */
  private ciclosConOrdenesDesconocidas = 0;
  /** Reinicio del simulador detectado durante el ciclo; se aplica al terminar el paso. */
  private reinicio: Reinicio | null = null;
  /** Errores internos ya informados (para no repetir la alerta en cada ciclo). */
  private readonly erroresInformados = new Set<string>();
  private temporizador: ReturnType<typeof setInterval> | null = null;
  private readonly pasosExtra: { nombre: string; paso: PasoExtra }[] = [];

  constructor(ctx: Contexto) {
    this.ctx = ctx;
    // Si el proceso se cortó en medio de una aprobación, la medida vuelve a la cola: no llegó a firmarse.
    const colgadas = todas<{ id: string }>(ctx.db, "SELECT id FROM medidas WHERE estado = 'aprobando'");
    for (const m of colgadas) {
      ejecutar(ctx.db, "UPDATE medidas SET estado = 'pendiente' WHERE id = ?", m.id);
      ctx.auditoria.registrar({ minuto: null, actor: "sistema", tipo: "medida_recuperada", datos: { medida_id: m.id } });
    }
  }

  agregarPaso(paso: PasoExtra, nombre = "un paso adicional"): void {
    this.pasosExtra.push({ nombre, paso });
  }

  iniciar(intervaloMs: number): void {
    if (this.temporizador) return;
    this.temporizador = setInterval(() => void this.tick(), intervaloMs);
    void this.tick();
  }

  detener(): void {
    if (this.temporizador) clearInterval(this.temporizador);
    this.temporizador = null;
  }

  /**
   * Un ciclo completo. Nunca lanza. Si el simulador no responde, queda
   * `conectado: false`; cada paso corre aislado, así un dato mal formado o un
   * error interno en uno no frena a los demás (ni el seguimiento de órdenes).
   */
  async tick(): Promise<void> {
    if (this.enCurso) return;
    this.enCurso = true;
    const { ctx } = this;
    const estabaConectado = ctx.estado.conectado;
    try {
      let estado: EstadoSim;
      try {
        estado = await ctx.sim.estado();
        const reinicio = this.reinicioPorEstado(estado);
        if (reinicio) {
          this.reiniciar(reinicio);
          ctx.estado.conectado = true;
          ctx.estado.ultimo_error = null;
          return;
        }
        if (!ctx.estado.partido || !this.datosFrescos) {
          ctx.estado.partido = await ctx.sim.partido();
          ctx.estado.proveedores = await ctx.sim.proveedores();
          guardarKv(ctx.db, "partido", JSON.stringify(ctx.estado.partido));
          guardarKv(ctx.db, "proveedores", JSON.stringify(ctx.estado.proveedores));
          this.datosFrescos = true;
        }
      } catch (e) {
        ctx.estado.conectado = false;
        ctx.estado.ultimo_error = mensajeDe(e);
        if (!esErrorDeRed(e)) this.errorInterno("la lectura del estado", e);
        return;
      }
      await this.leerTurnos();

      const pasos: { nombre: string; correr: () => unknown }[] = [
        { nombre: "la actualización del estado", correr: () => this.actualizarEstado(estado) },
        { nombre: "la ingesta de detecciones", correr: () => this.ingerirDetecciones(estado) },
        { nombre: "el reenvío de órdenes cortadas", correr: () => this.reenviarPendientes(estado) },
        { nombre: "el seguimiento de órdenes", correr: () => this.seguirOrdenes(estado) },
        { nombre: "el reenvío de órdenes fallidas", correr: () => this.atenderFallidas(estado) },
        ...this.pasosExtra.map((p) => ({ nombre: p.nombre, correr: () => p.paso(ctx, estado) })),
        { nombre: "el cierre del partido", correr: () => this.controlarFinal(estado) },
      ];
      let corte: unknown = null;
      for (const paso of pasos) {
        try {
          await paso.correr();
        } catch (e) {
          if (esErrorDeRed(e)) corte ??= e;
          else this.errorInterno(paso.nombre, e);
        }
        if (this.reinicio) break;
      }
      if (this.reinicio) {
        this.reiniciar(this.reinicio);
        corte = null;
      }
      ctx.estado.conectado = corte == null;
      ctx.estado.ultimo_error = corte == null ? null : mensajeDe(corte);
    } finally {
      this.enCurso = false;
      if (estabaConectado !== ctx.estado.conectado) ctx.alCambiar();
    }
  }

  /** Un error que no es de red: se informa una vez por paso y mensaje, y el ciclo sigue. */
  private errorInterno(paso: string, e: unknown): void {
    const { ctx } = this;
    const mensaje = mensajeDe(e);
    const clave = `${paso}|${mensaje}`;
    if (this.erroresInformados.has(clave)) return;
    this.erroresInformados.add(clave);
    ctx.consola(`[motor] Error interno en ${paso}: ${e instanceof Error && e.stack ? e.stack : mensaje}`);
    alertar(ctx, `Error interno en ${paso}: ${mensaje}`);
    try {
      ctx.auditoria.registrar({ minuto: ctx.estado.minuto, actor: "sistema", tipo: "error_interno", datos: { paso, error: mensaje } });
    } catch {
      // Si ni la auditoría se puede escribir, alcanza con la alerta y la consola.
    }
    ctx.alCambiar();
  }

  // --- reinicio del simulador ----------------------------------------------------------

  /** El reloj volvió atrás o cambió el partido: la base es de otro partido. */
  private reinicioPorEstado(estado: EstadoSim): Reinicio | null {
    const { ctx } = this;
    const guardado = leerKv(ctx.db, "partido");
    const idGuardado = guardado ? ((JSON.parse(guardado) as { id?: string }).id ?? null) : null;
    if (idGuardado && esTexto(estado.partido) && estado.partido !== idGuardado) {
      return {
        motivo: `cambió el partido (${idGuardado} pasó a ${estado.partido})`,
        datos: { partido_anterior: idGuardado, partido_nuevo: estado.partido },
      };
    }
    const ultimo = Number(leerKv(ctx.db, "ultimo_minuto") ?? "-1000000000");
    if (ultimo - estado.minuto_actual > 1) {
      return {
        motivo: `el reloj volvió del ${minuto(ultimo)} al ${minuto(estado.minuto_actual)}`,
        datos: { minuto_anterior: ultimo, minuto_actual: estado.minuto_actual },
      };
    }
    return null;
  }

  private reiniciar(r: Reinicio): void {
    reiniciarBase(this.ctx, r.motivo, r.datos);
    this.reinicio = null;
    this.datosFrescos = false;
    this.turnosLeidosMs = 0;
    this.turnosOk = false;
    this.ciclosConOrdenesDesconocidas = 0;
    this.erroresInformados.clear();
  }

  // --- estado y turnos ---------------------------------------------------------------

  /**
   * Horario de turnos (GET /juzgados). Se relee cada 30 s; si el simulador no lo
   * publica, el motor sigue con lo último que tenga y vuelve a probar en 5 s.
   */
  private async leerTurnos(): Promise<void> {
    const { ctx } = this;
    const ahora = Date.now();
    if (ahora - this.turnosLeidosMs < (this.turnosOk ? 30_000 : 5_000)) return;
    this.turnosLeidosMs = ahora;
    try {
      const j = await ctx.sim.juzgados();
      const nombres = new Map(j.juzgados.flatMap((z) => z.jueces.map((x) => [x.id, x.nombre] as const)));
      ctx.estado.turnos = j.turnos.map((t) => ({
        juez_id: t.juez_id,
        nombre: nombres.get(t.juez_id) || ctx.jueces.find((x) => x.id === t.juez_id)?.nombre || t.juez_id,
        desde_min: t.desde_min,
        hasta_min: t.hasta_min,
      }));
      guardarKv(ctx.db, "turnos_horario", JSON.stringify(ctx.estado.turnos));
      this.turnosOk = true;
    } catch {
      this.turnosOk = false;
    }
  }

  private actualizarEstado(estado: EstadoSim): void {
    const { ctx } = this;
    const previo = leerKv(ctx.db, "turno");
    const actual = JSON.stringify([...estado.jueces_de_turno].sort());
    if (previo !== null && previo !== actual) {
      const salientes = JSON.parse(previo) as string[];
      const pendientes = todas<{ id: string }>(
        ctx.db,
        "SELECT id FROM medidas WHERE estado = 'pendiente' ORDER BY n",
      ).map((m) => m.id);
      ctx.auditoria.registrar({
        minuto: estado.minuto_actual,
        actor: "sistema",
        tipo: "traspaso_turno",
        datos: { salientes, entrantes: estado.jueces_de_turno, medidas_pendientes: pendientes },
      });
      ctx.alCambiar();
    }
    if (previo !== actual) guardarKv(ctx.db, "turno", actual);

    // El reloj que vuelve atrás se controla al principio del ciclo (reinicioPorEstado).
    const ultimo = Number(leerKv(ctx.db, "ultimo_minuto") ?? "-1000000000");
    if (estado.minuto_actual >= ultimo) guardarKv(ctx.db, "ultimo_minuto", String(estado.minuto_actual));

    const cambioFinal = ctx.estado.finalizado !== estado.finalizado;
    ctx.estado.minuto = estado.minuto_actual;
    ctx.estado.fin_min = estado.fin_min;
    ctx.estado.finalizado = estado.finalizado;
    ctx.estado.acelerar = estado.acelerar;
    ctx.estado.jueces_de_turno = estado.jueces_de_turno;
    if (cambioFinal) ctx.alCambiar();
  }

  // --- ingesta ---------------------------------------------------------------------------

  private async ingerirDetecciones(estado: EstadoSim): Promise<void> {
    const { ctx } = this;
    const desde = Number(leerKv(ctx.db, "cursor_detecciones") ?? "-1000000000");
    const lote = await ctx.sim.detecciones(desde);
    const crudas: unknown[] = Array.isArray(lote?.detecciones) ? lote.detecciones : [];
    const minutoDe = (d: unknown) => {
      const m = d !== null && typeof d === "object" ? (d as { minuto?: unknown }).minuto : undefined;
      return esNumero(m) ? m : estado.minuto_actual;
    };
    const nuevas = [...crudas].sort((a, b) => minutoDe(a) - minutoDe(b));
    let huboCambios = false;
    try {
      for (const det of nuevas) {
        const objeto = det !== null && typeof det === "object" && !Array.isArray(det) ? (det as Deteccion) : null;
        const id = esTexto(objeto?.id) ? objeto.id : `SIN-ID-${sha256Hex(JSON.stringify(det) ?? String(det)).slice(0, 12)}`;
        if (una(ctx.db, "SELECT id FROM detecciones WHERE id = ?", id)) continue;
        huboCambios = true;
        if (!objeto) {
          this.archivarInvalida(det, id, "La detección no es un objeto.", estado.minuto_actual);
          continue;
        }
        try {
          await this.procesarDeteccion({ ...objeto, id }, estado);
        } catch (e) {
          // Un error de red corta la ingesta sin mover el cursor: se reintenta en el próximo ciclo.
          if (esErrorDeRed(e)) throw e;
          // Cualquier otro es un dato que Offside no sabe tratar: se archiva y se sigue.
          this.archivarInvalida({ ...objeto, id }, id, `No se pudo procesar: ${mensajeDe(e)}`, estado.minuto_actual);
        }
      }
      if (esNumero(lote?.minuto_actual)) guardarKv(ctx.db, "cursor_detecciones", String(lote.minuto_actual));
    } finally {
      if (huboCambios) ctx.alCambiar();
    }
  }

  /** Archiva como inválida una detección que no se pudo tratar. Nunca lanza. */
  private archivarInvalida(det: unknown, id: string, motivo: string, minuto: number): void {
    try {
      if (una(this.ctx.db, "SELECT id FROM detecciones WHERE id = ?", id)) return;
      const objeto = det !== null && typeof det === "object" && !Array.isArray(det) ? (det as Deteccion) : null;
      const crudo = JSON.stringify(det) ?? String(det);
      this.archivar(objeto ? { ...objeto, id } : ({ id } as Deteccion), crudo, "invalida", motivo, minuto);
    } catch (e) {
      this.errorInterno("el archivo de una detección inválida", e);
    }
  }

  private guardarDeteccion(
    det: Deteccion,
    p: {
      crudo: string;
      captura: ReturnType<typeof analizarCaptura>;
      veredicto: string;
      motivo: string;
      expediente_id: string | null;
      servidor_id: number | null;
      minuto: number;
    },
  ): void {
    ejecutar(
      this.ctx.db,
      `INSERT INTO detecciones (id, minuto, crudo, sha256, captura_sha256, captura_bytes, formato_ok, veredicto, motivo,
         host, ip, marca, expediente_id, servidor_id, recibida_min, recibida_iso)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      det.id,
      esNumero(det.minuto) ? det.minuto : p.minuto,
      p.crudo,
      sha256Hex(p.crudo),
      p.captura.sha256,
      p.captura.bytes,
      p.captura.formato_ok ? 1 : 0,
      p.veredicto,
      p.motivo,
      esTexto(det.host_stream) ? det.host_stream : "",
      esTexto(det.ip_servidor) ? det.ip_servidor : "",
      textoONulo(det.marca_de_agua_extraida),
      p.expediente_id,
      p.servidor_id,
      p.minuto,
      new Date().toISOString(),
    );
  }

  private archivar(det: Deteccion, crudo: string, clase: string, motivo: string, minuto: number): void {
    const captura = analizarCaptura((det.captura as { contenido_b64?: unknown } | null | undefined)?.contenido_b64);
    this.guardarDeteccion(det, { crudo, captura, veredicto: clase, motivo, expediente_id: null, servidor_id: null, minuto });
    this.ctx.auditoria.registrar({
      minuto,
      actor: "sistema",
      tipo: "deteccion_archivada",
      datos: {
        deteccion_id: det.id,
        host: textoONulo(det.host_stream),
        ip: textoONulo(det.ip_servidor),
        marca: textoONulo(det.marca_de_agua_extraida),
        veredicto: clase,
        motivo,
        deteccion_sha256: sha256Hex(crudo),
        captura_sha256: captura.sha256,
      },
    });
  }

  private async procesarDeteccion(det: Deteccion, estado: EstadoSim): Promise<void> {
    const { ctx } = this;
    const partido = ctx.estado.partido!;
    const minuto = estado.minuto_actual;
    const crudo = JSON.stringify(det);

    if (!esTexto(det.host_stream) || !esTexto(det.ip_servidor)) {
      this.archivar(det, crudo, "invalida", "La detección no trae host o IP del servidor.", minuto);
      return;
    }
    if (!esNumero(det.minuto)) {
      this.archivar(det, crudo, "invalida", "La detección no trae el minuto en que se vio.", minuto);
      return;
    }
    if (det.marca_de_agua_extraida != null && typeof det.marca_de_agua_extraida !== "string") {
      this.archivar(det, crudo, "invalida", "La marca de agua de la detección no es texto.", minuto);
      return;
    }

    const v = veredicto(det, partido);
    if (v.clase !== "pirata") {
      this.archivar(det, crudo, v.clase, v.motivo, minuto);
      if (v.clase === "anomalia") alertar(ctx, `Anomalía en ${det.host_stream}: ${v.motivo}`);
      return;
    }
    if (estado.finalizado) {
      this.archivar(det, crudo, "pirata_fuera_de_partido", "El partido ya terminó: no corresponde una medida en vivo.", minuto);
      return;
    }

    const yaConocido = una<FilaServidor>(
      ctx.db,
      `SELECT s.* FROM servidores s JOIN expedientes e ON e.id = s.expediente_id
       WHERE e.clave = ? AND s.host = ? AND s.ip = ?`,
      claveExpediente(det, v.prefijo!),
      det.host_stream,
      det.ip_servidor,
    );
    // Las consultas de red van antes de escribir, así la escritura es atómica.
    const [dnsIp, dnsDominio] = yaConocido
      ? [null, null]
      : await Promise.all([ctx.sim.dnsIp(det.ip_servidor), ctx.sim.dnsDominio(det.host_stream)]);

    const datosCaptura = (det.captura !== null && typeof det.captura === "object" ? det.captura : {}) as Record<string, unknown>;
    const captura = analizarCaptura(datosCaptura.contenido_b64);
    const evidencia: EvidenciaItem = {
      deteccion_id: det.id,
      minuto: det.minuto,
      capturada_min: numeroONulo(datosCaptura.capturada_min),
      deteccion_sha256: sha256Hex(crudo),
      captura_sha256: captura.sha256,
      captura_bytes: captura.bytes,
      formato: textoONulo(datosCaptura.formato),
      formato_ok: captura.formato_ok,
      pagina: textoONulo(det.pagina),
      stream_url: textoONulo(det.stream_url),
      promocion: (Array.isArray(det.promocion) ? det.promocion : []).filter(
        (p): p is { red: string; url: string; minuto: number } => p !== null && typeof p === "object",
      ),
    };

    enTransaccion(ctx.db, () => {
      const clave = claveExpediente(det, v.prefijo!);
      let expediente = una<FilaExpediente>(ctx.db, "SELECT * FROM expedientes WHERE clave = ?", clave);
      if (!expediente) {
        const n = siguienteN(ctx.db, "expedientes");
        const inicio = partido.inicio_iso ? new Date(partido.inicio_iso) : new Date();
        const anio = Number.isNaN(inicio.getTime()) ? new Date().getFullYear() : inicio.getFullYear();
        expediente = {
          id: idExpediente(anio, n),
          n,
          clave,
          marca: (det.marca_de_agua_extraida ?? "").trim(),
          prefijo: v.prefijo!,
          origen_prefijo: v.origen_prefijo,
          abierto_min: minuto,
        };
        ejecutar(
          ctx.db,
          "INSERT INTO expedientes (id, n, clave, marca, prefijo, origen_prefijo, abierto_min) VALUES (?, ?, ?, ?, ?, ?, ?)",
          expediente.id,
          expediente.n,
          expediente.clave,
          expediente.marca,
          expediente.prefijo,
          expediente.origen_prefijo,
          expediente.abierto_min,
        );
        ctx.auditoria.registrar({
          minuto,
          actor: "sistema",
          tipo: "expediente_abierto",
          datos: { expediente_id: expediente.id, marca: expediente.marca, prefijo: expediente.prefijo, motivo: v.motivo },
        });
      }

      if (yaConocido) {
        this.guardarDeteccion(det, {
          crudo,
          captura,
          veredicto: "pirata",
          motivo: v.motivo,
          expediente_id: expediente.id,
          servidor_id: yaConocido.id,
          minuto,
        });
        ctx.auditoria.registrar({
          minuto,
          actor: "sistema",
          tipo: "evidencia_agregada",
          datos: { expediente_id: expediente.id, servidor: yaConocido.host, ...evidencia },
        });
        return;
      }

      const riesgo = evaluarRiesgo(det, dnsIp, dnsDominio, partido, ctx.config.terminosCompartida);
      const riesgoFinal = this.aplicarSimulacro(riesgo);
      ejecutar(
        ctx.db,
        `INSERT INTO servidores (expediente_id, host, ip, asn, organizacion, riesgo, primera_deteccion_min)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        expediente.id,
        det.host_stream,
        det.ip_servidor,
        dnsIp?.asn ?? det.asn ?? null,
        dnsIp?.organizacion ?? null,
        JSON.stringify(riesgoFinal),
        det.minuto,
      );
      const servidor = una<FilaServidor>(
        ctx.db,
        "SELECT * FROM servidores WHERE expediente_id = ? AND host = ? AND ip = ?",
        expediente.id,
        det.host_stream,
        det.ip_servidor,
      )!;
      this.guardarDeteccion(det, {
        crudo,
        captura,
        veredicto: "pirata",
        motivo: v.motivo,
        expediente_id: expediente.id,
        servidor_id: servidor.id,
        minuto,
      });

      const previos = todas<{ host: string; ip: string; medida_id: string | null; estado: string | null }>(
        ctx.db,
        `SELECT s.host, s.ip, m.id AS medida_id, m.estado
         FROM servidores s LEFT JOIN medidas m ON m.servidor_id = s.id AND m.clase IN ('inicial', 'ampliacion')
         WHERE s.expediente_id = ? AND s.id <> ? ORDER BY s.id`,
        expediente.id,
        servidor.id,
      );
      const clase = previos.some((p) => p.estado === "aprobada") ? "ampliacion" : "inicial";
      const plan = planPorProveedor(riesgoFinal, det, ctx.estado.proveedores);
      const n = siguienteN(ctx.db, "medidas");
      const medidaId = idMedida(n);
      const venceMin = Math.floor(estado.fin_min);
      const instantanea = instantaneaBloqueo({
        medida_id: medidaId,
        clase,
        partido,
        expediente,
        servidor: { host: servidor.host, ip: servidor.ip, asn: servidor.asn, organizacion: servidor.organizacion },
        veredicto_motivo: v.motivo,
        riesgo: riesgoFinal,
        evidencia: [evidencia],
        plan,
        vence_min: venceMin,
        servidores_previos: previos,
        sellos: sellos(partido, minuto),
        auditoria: ctx.auditoria.ancla(),
      });
      const h = huella(instantanea);
      ejecutar(
        ctx.db,
        `INSERT INTO medidas (id, n, expediente_id, servidor_id, clase, estado, creada_min, creada_iso, instantanea,
           huella, plan, vence_min)
         VALUES (?, ?, ?, ?, ?, 'pendiente', ?, ?, ?, ?, ?, ?)`,
        medidaId,
        n,
        expediente.id,
        servidor.id,
        clase,
        minuto,
        new Date().toISOString(),
        instantanea,
        h,
        JSON.stringify(plan),
        venceMin,
      );
      ctx.auditoria.registrar({
        minuto,
        actor: "sistema",
        tipo: "medida_presentada",
        datos: {
          medida_id: medidaId,
          clase,
          expediente_id: expediente.id,
          servidor: { host: servidor.host, ip: servidor.ip },
          tipo_recomendado: riesgoFinal.tipo_recomendado,
          terceros: riesgoFinal.terceros,
          huella: h,
          deteccion_id: det.id,
          deteccion_sha256: evidencia.deteccion_sha256,
          captura_sha256: evidencia.captura_sha256,
        },
      });
    });
  }

  /**
   * Solo con la bandera --simulacro: la primera IP compartida se propone por IP, a
   * sabiendas, para poder mostrar el circuito de reclamos. Queda rotulado.
   */
  private aplicarSimulacro<T extends { tipo_recomendado: string; terceros: string[]; motivo: string }>(
    riesgo: T,
  ): T & { simulacro?: boolean } {
    const { ctx } = this;
    if (!ctx.config.simulacro || riesgo.tipo_recomendado !== "dominio" || riesgo.terceros.length === 0) return riesgo;
    if (leerKv(ctx.db, "simulacro_usado")) return riesgo;
    guardarKv(ctx.db, "simulacro_usado", "1");
    return {
      ...riesgo,
      tipo_recomendado: "ip",
      simulacro: true,
      motivo: `SIMULACRO: se fuerza un bloqueo por IP sobre una IP compartida para mostrar el circuito de reclamos. Regla real: ${riesgo.motivo}`,
    };
  }

  // --- órdenes ----------------------------------------------------------------------------

  /** Reintenta, con el mismo `orden_id`, los envíos que quedaron a medias por un corte. */
  private async reenviarPendientes(estado: EstadoSim): Promise<void> {
    const pendientes = todas<FilaOrden>(this.ctx.db, "SELECT * FROM ordenes WHERE estado = 'por_enviar'");
    await Promise.all(pendientes.map((o) => enviarOrden(this.ctx, o.orden_id, estado)));
  }

  private async seguirOrdenes(estado: EstadoSim): Promise<void> {
    const { ctx } = this;
    const activas = todas<FilaOrden>(ctx.db, "SELECT * FROM ordenes WHERE estado IN ('recibida', 'aplicada')");
    if (activas.length === 0) return;
    const proveedores = [...new Set(activas.map((o) => o.proveedor_id))];
    const listas = await Promise.all(proveedores.map((p) => ctx.sim.ordenes(p)));
    const remotas = new Map<string, Awaited<ReturnType<typeof ctx.sim.ordenes>>[number]>();
    listas.forEach((lista, i) => {
      for (const o of lista) remotas.set(`${proveedores[i]}|${o.orden_id}`, o);
    });

    // Una orden que el proveedor recibió y ya no conoce: el simulador se reinició.
    // Dos ciclos seguidos, para no confundirlo con una respuesta incompleta.
    const desconocidas = activas.filter((o) => !remotas.has(`${o.proveedor_id}|${o.orden_id}`));
    this.ciclosConOrdenesDesconocidas = desconocidas.length > 0 ? this.ciclosConOrdenesDesconocidas + 1 : 0;
    if (this.ciclosConOrdenesDesconocidas >= 2) {
      const proveedores = [...new Set(desconocidas.map((o) => nombreProveedor(ctx, o.proveedor_id)))];
      this.reinicio = {
        motivo: `${proveedores.join(", ")} dejó de conocer ${desconocidas.length === 1 ? "una orden" : `${desconocidas.length} órdenes`} que había recibido`,
        datos: { ordenes_desconocidas: desconocidas.map((o) => ({ proveedor: o.proveedor_id, orden_id: o.orden_id })) },
      };
      return;
    }

    let huboCambios = false;
    for (const local of activas) {
      const remota = remotas.get(`${local.proveedor_id}|${local.orden_id}`);
      if (!remota || remota.estado === local.estado) continue;
      huboCambios = true;
      const base = { orden_id: local.orden_id, proveedor: local.proveedor_id, tipo: local.tipo, objetivo: local.objetivo };
      if (remota.estado === "aplicada") {
        const aplicada = remota.aplicada_min ?? estado.minuto_actual;
        ejecutar(ctx.db, "UPDATE ordenes SET estado = 'aplicada', aplicada_min = ? WHERE orden_id = ?", aplicada, local.orden_id);
        ctx.auditoria.registrar({
          minuto: aplicada,
          actor: local.proveedor_id,
          tipo: "orden_aplicada",
          datos: { ...base, aplicada_min: aplicada },
        });
      } else if (remota.estado === "fallida") {
        ejecutar(
          ctx.db,
          "UPDATE ordenes SET estado = 'fallida', error = ? WHERE orden_id = ?",
          remota.motivo ?? "El proveedor informó una falla.",
          local.orden_id,
        );
        ctx.auditoria.registrar({
          minuto: estado.minuto_actual,
          actor: local.proveedor_id,
          tipo: "orden_fallida",
          datos: { ...base, motivo: remota.motivo ?? null },
        });
      } else if (remota.estado === "vencida" || remota.estado === "levantada") {
        const aplicada = local.aplicada_min ?? remota.aplicada_min ?? null;
        const finalizada = remota.finalizada_min ?? estado.minuto_actual;
        ejecutar(
          ctx.db,
          "UPDATE ordenes SET estado = ?, aplicada_min = ?, finalizada_min = ? WHERE orden_id = ?",
          remota.estado,
          aplicada,
          finalizada,
          local.orden_id,
        );
        ctx.auditoria.registrar({
          minuto: finalizada,
          actor: local.proveedor_id,
          tipo: remota.estado === "vencida" ? "orden_vencida" : "orden_levantada_confirmada",
          datos: { ...base, aplicada_min: aplicada, finalizada_min: finalizada },
        });
      }
    }
    if (huboCambios) ctx.alCambiar();
  }

  /** Una orden fallida se reenvía sola si el juez sigue de turno; si no, la ratifica el entrante. */
  private async atenderFallidas(estado: EstadoSim): Promise<void> {
    const { ctx } = this;
    const fallidas = todas<FilaOrden>(ctx.db, "SELECT * FROM ordenes WHERE estado = 'fallida' AND atendida = 0");
    for (const orden of fallidas) {
      ejecutar(ctx.db, "UPDATE ordenes SET atendida = 1 WHERE orden_id = ?", orden.orden_id);
      if (estado.finalizado || orden.vence_min <= estado.minuto_actual) continue;
      if (orden.intento >= ctx.config.maxIntentos) {
        ctx.auditoria.registrar({
          minuto: estado.minuto_actual,
          actor: "sistema",
          tipo: "reintentos_agotados",
          datos: { orden_id: orden.orden_id, proveedor: orden.proveedor_id, intentos: orden.intento },
        });
        alertar(ctx, `${nombreProveedor(ctx, orden.proveedor_id)} falló ${orden.intento} veces para ${objetivoTexto(orden.tipo, orden.objetivo)}.`);
        continue;
      }
      const juez = ctx.jueces.find((j) => j.id === orden.juez_id);
      const medida = medidaPorId(ctx.db, orden.medida_id);
      const impedimento = impedimentoDeEnvio(ctx, orden, estado);
      if (juez && medida && !impedimento) {
        const nueva = crearOrden(ctx, {
          medida,
          proveedor_id: orden.proveedor_id,
          tipo: orden.tipo,
          objetivo: orden.objetivo,
          juez,
          minuto: estado.minuto_actual,
        });
        ctx.auditoria.registrar({
          minuto: estado.minuto_actual,
          actor: "sistema",
          tipo: "reintento",
          datos: { orden_fallida: orden.orden_id, orden_nueva: nueva, proveedor: orden.proveedor_id },
        });
        await enviarOrden(ctx, nueva, estado);
      } else {
        const motivo = impedimento?.ratificar
          ? `El proveedor falló y el juez que firmó no puede reenviarla: ${impedimento.motivo}`
          : "El proveedor falló y el juez que firmó ya no está de turno.";
        pedirRatificacion(ctx, orden, estado.minuto_actual, motivo);
        ctx.alCambiar();
      }
    }
  }

  // --- final del partido -------------------------------------------------------------------

  private controlarFinal(estado: EstadoSim): void {
    const { ctx } = this;
    if (!estado.finalizado) return;

    const pendientes = todas<FilaMedida>(ctx.db, "SELECT * FROM medidas WHERE estado = 'pendiente'");
    for (const m of pendientes) {
      ejecutar(
        ctx.db,
        "UPDATE medidas SET estado = 'sin_efecto', motivo = 'El partido terminó antes de la decisión.' WHERE id = ?",
        m.id,
      );
      ctx.auditoria.registrar({
        minuto: estado.minuto_actual,
        actor: "sistema",
        tipo: "medida_sin_efecto",
        datos: { medida_id: m.id, expediente_id: m.expediente_id, motivo: "El partido terminó antes de la decisión." },
      });
    }
    if (pendientes.length) ctx.alCambiar();

    // Los bloqueos por IP tienen que haber vencido con el partido.
    if (estado.minuto_actual >= estado.fin_min + 1) {
      const vivas = todas<FilaOrden>(ctx.db, "SELECT * FROM ordenes WHERE estado = 'aplicada' AND tipo = 'ip'");
      for (const o of vivas) alertar(ctx, `El bloqueo por IP ${o.objetivo} sigue activo en ${nombreProveedor(ctx, o.proveedor_id)} después del partido.`);
    }

    if (!leerKv(ctx.db, "partido_cerrado")) {
      const abiertas = una<{ n: number }>(
        ctx.db,
        "SELECT COUNT(*) AS n FROM ordenes WHERE estado IN ('por_enviar', 'recibida', 'aplicada')",
      );
      if (Number(abiertas?.n ?? 0) === 0) {
        const resumen = todas<{ estado: string; n: number }>(
          ctx.db,
          "SELECT estado, COUNT(*) AS n FROM ordenes GROUP BY estado",
        );
        ctx.auditoria.registrar({
          minuto: estado.minuto_actual,
          actor: "sistema",
          tipo: "partido_cerrado",
          datos: { ordenes: Object.fromEntries(resumen.map((r) => [r.estado, Number(r.n)])) },
        });
        guardarKv(ctx.db, "partido_cerrado", "1");
        ctx.alCambiar();
      }
    }
  }
}
