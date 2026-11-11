// El motor: un ciclo que consulta al simulador y mantiene al día expedientes,
// medidas y órdenes (sección 6 del diseño). Nunca firma ni decide: eso lo hace
// el juez desde decisiones.ts.

import { type Contexto, alertar } from "./contexto.ts";
import { guardarKv, leerKv } from "./db.ts";
import { crearOrden, enviarOrden, pedirRatificacion } from "./despacho.ts";
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
import type { Deteccion, EstadoSim } from "./simulador.ts";

/** Paso adicional del ciclo (los reclamos se enchufan acá). */
export type PasoExtra = (ctx: Contexto, estado: EstadoSim) => Promise<void>;

function mensajeDe(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

function esTexto(v: unknown): v is string {
  return typeof v === "string" && v.trim().length > 0;
}

export class Motor {
  private readonly ctx: Contexto;
  private enCurso = false;
  /** Falso hasta leer partido y proveedores del simulador en este arranque. */
  private datosFrescos = false;
  private reinicioAvisado = false;
  private temporizador: ReturnType<typeof setInterval> | null = null;
  private readonly pasosExtra: PasoExtra[] = [];

  constructor(ctx: Contexto) {
    this.ctx = ctx;
  }

  agregarPaso(paso: PasoExtra): void {
    this.pasosExtra.push(paso);
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

  /** Un ciclo completo. Nunca lanza: si el simulador no responde, queda `conectado: false`. */
  async tick(): Promise<void> {
    if (this.enCurso) return;
    this.enCurso = true;
    const { ctx } = this;
    const estabaConectado = ctx.estado.conectado;
    try {
      const estado = await ctx.sim.estado();
      if (!ctx.estado.partido || !this.datosFrescos) {
        ctx.estado.partido = await ctx.sim.partido();
        ctx.estado.proveedores = await ctx.sim.proveedores();
        guardarKv(ctx.db, "partido", JSON.stringify(ctx.estado.partido));
        guardarKv(ctx.db, "proveedores", JSON.stringify(ctx.estado.proveedores));
        this.datosFrescos = true;
      }
      this.actualizarEstado(estado);

      await this.ingerirDetecciones(estado);
      await this.reenviarPendientes(estado);
      await this.seguirOrdenes(estado);
      await this.atenderFallidas(estado);
      for (const paso of this.pasosExtra) await paso(ctx, estado);
      this.controlarFinal(estado);

      ctx.estado.conectado = true;
      ctx.estado.ultimo_error = null;
    } catch (e) {
      ctx.estado.conectado = false;
      ctx.estado.ultimo_error = mensajeDe(e);
    } finally {
      this.enCurso = false;
      if (estabaConectado !== ctx.estado.conectado) ctx.alCambiar();
    }
  }

  // --- estado y turnos ---------------------------------------------------------------

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

    // Si el reloj vuelve atrás, el simulador se reinició: esta base es de otro partido.
    const ultimo = Number(leerKv(ctx.db, "ultimo_minuto") ?? "-1000000000");
    if (ultimo - estado.minuto_actual > 1 && !this.reinicioAvisado) {
      this.reinicioAvisado = true;
      ctx.auditoria.registrar({
        minuto: estado.minuto_actual,
        actor: "sistema",
        tipo: "simulador_reiniciado",
        datos: { minuto_anterior: ultimo, minuto_actual: estado.minuto_actual },
      });
      alertar(ctx, "El simulador se reinició (el reloj volvió atrás). Esta base es de otro partido: reiniciá Offside con --nuevo.");
      ctx.alCambiar();
    }
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
    const nuevas = [...lote.detecciones].sort((a, b) => (a.minuto ?? 0) - (b.minuto ?? 0));
    let huboCambios = false;
    for (const det of nuevas) {
      const id = esTexto(det?.id) ? det.id : `SIN-ID-${sha256Hex(JSON.stringify(det)).slice(0, 12)}`;
      if (una(ctx.db, "SELECT id FROM detecciones WHERE id = ?", id)) continue;
      // Un error de red acá corta el ciclo sin mover el cursor: se reintenta en el próximo.
      await this.procesarDeteccion({ ...det, id }, estado);
      huboCambios = true;
    }
    guardarKv(ctx.db, "cursor_detecciones", String(lote.minuto_actual));
    if (huboCambios) ctx.alCambiar();
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
      typeof det.minuto === "number" ? det.minuto : p.minuto,
      p.crudo,
      sha256Hex(p.crudo),
      p.captura.sha256,
      p.captura.bytes,
      p.captura.formato_ok ? 1 : 0,
      p.veredicto,
      p.motivo,
      esTexto(det.host_stream) ? det.host_stream : "",
      esTexto(det.ip_servidor) ? det.ip_servidor : "",
      det.marca_de_agua_extraida ?? null,
      p.expediente_id,
      p.servidor_id,
      p.minuto,
      new Date().toISOString(),
    );
  }

  private archivar(det: Deteccion, crudo: string, clase: string, motivo: string, minuto: number): void {
    const captura = analizarCaptura(det.captura?.contenido_b64);
    this.guardarDeteccion(det, { crudo, captura, veredicto: clase, motivo, expediente_id: null, servidor_id: null, minuto });
    this.ctx.auditoria.registrar({
      minuto,
      actor: "sistema",
      tipo: "deteccion_archivada",
      datos: {
        deteccion_id: det.id,
        host: det.host_stream ?? null,
        ip: det.ip_servidor ?? null,
        marca: det.marca_de_agua_extraida ?? null,
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

    const captura = analizarCaptura(det.captura?.contenido_b64);
    const evidencia: EvidenciaItem = {
      deteccion_id: det.id,
      minuto: det.minuto,
      capturada_min: det.captura?.capturada_min ?? null,
      deteccion_sha256: sha256Hex(crudo),
      captura_sha256: captura.sha256,
      captura_bytes: captura.bytes,
      formato: det.captura?.formato ?? null,
      formato_ok: captura.formato_ok,
      pagina: det.pagina ?? null,
      stream_url: det.stream_url ?? null,
      promocion: det.promocion ?? [],
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
   * Solo con OFFSIDE_SIMULACRO: la primera IP compartida se propone por IP, a
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

    let huboCambios = false;
    for (const local of activas) {
      const remota = remotas.get(`${local.proveedor_id}|${local.orden_id}`);
      if (!remota || remota.estado === local.estado) continue;
      huboCambios = true;
      const base = { orden_id: local.orden_id, proveedor: local.proveedor_id, tipo: local.tipo, objetivo: local.objetivo };
      if (remota.estado === "aplicada") {
        ejecutar(
          ctx.db,
          "UPDATE ordenes SET estado = 'aplicada', aplicada_min = ? WHERE orden_id = ?",
          remota.aplicada_min ?? estado.minuto_actual,
          local.orden_id,
        );
        ctx.auditoria.registrar({
          minuto: remota.aplicada_min ?? estado.minuto_actual,
          actor: local.proveedor_id,
          tipo: "orden_aplicada",
          datos: base,
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
        ejecutar(
          ctx.db,
          "UPDATE ordenes SET estado = ?, aplicada_min = COALESCE(aplicada_min, ?), finalizada_min = ? WHERE orden_id = ?",
          remota.estado,
          remota.aplicada_min ?? null,
          remota.finalizada_min ?? estado.minuto_actual,
          local.orden_id,
        );
        ctx.auditoria.registrar({
          minuto: remota.finalizada_min ?? estado.minuto_actual,
          actor: local.proveedor_id,
          tipo: remota.estado === "vencida" ? "orden_vencida" : "orden_levantada_confirmada",
          datos: base,
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
        alertar(ctx, `${orden.proveedor_id} falló ${orden.intento} veces para ${orden.objetivo}.`);
        continue;
      }
      const juez = ctx.jueces.find((j) => j.id === orden.juez_id);
      const medida = medidaPorId(ctx.db, orden.medida_id);
      if (juez && medida && estado.jueces_de_turno.includes(juez.id)) {
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
        pedirRatificacion(ctx, orden, estado.minuto_actual, "El proveedor falló y el juez que firmó ya no está de turno.");
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
      for (const o of vivas) alertar(ctx, `El bloqueo por IP ${o.objetivo} sigue activo en ${o.proveedor_id} después del partido.`);
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
