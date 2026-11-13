// Teléfono del juez de turno (390 px). El pedido, cuatro luces y la firma bajo el
// pulgar: el camino para decidir en menos de diez segundos.

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { Link, Navigate } from "react-router-dom";
import type { ColaDTO, EstadoDTO, ExpedienteDTO, MedidaDTO, UsuarioDTO } from "../../compartido/tipos.ts";
import {
  Cargando,
  Cortes,
  IconoCampana,
  IconoCampanaApagada,
  IconoCerrar,
  IconoSilencio,
  IconoSonido,
  PildoraTurno,
  RelojPartido,
  movimientoReducido,
  useFondo,
} from "../componentes/comunes.tsx";
import { type Guardia, activarGuardia, apagarGuardia, avisarMedidas, cerrarAvisosSalvo, mantenerPantalla, useGuardia } from "../nucleo/avisos.ts";
import { Despacho, LucesOrdenes, aplicadasDe } from "../componentes/Despacho.tsx";
import { HojaRechazo, RESORTE, SALIDA } from "../componentes/HojaRechazo.tsx";
import { objetivoDe } from "../componentes/Medida.tsx";
import { Tarjeta } from "../componentes/Tarjeta.tsx";
import { ErrorApi, pedir } from "../nucleo/api.ts";
import { enCurso, filasDespacho } from "../nucleo/despacho.ts";
import { desdeTurno, hastaTurno, margenTurno, proximoTurno, turnoEntrante } from "../nucleo/extras.ts";
import { CLASE, enGrupos, haceReal, juzgadoBreve, lista, minutoEntero, plural, reloj } from "../nucleo/formato.ts";
import { aceleracion, minutoAhora, sincronizarReloj, useCondicionMinuto, useMinuto } from "../nucleo/reloj.ts";
import { salir, useSesion } from "../nucleo/sesion.ts";
import {
  ACTIVA_SONIDO,
  activarSonido,
  audioListo,
  detenerTitulo,
  fijarTitulo,
  prepararSonido,
  puedeVibrar,
  silbato,
  suscribirAudio,
  titilarTitulo,
  vibrar,
} from "../nucleo/sonido.ts";
import { useVivo } from "../nucleo/vivo.ts";

/** Tras cambiar la medida al frente, el botón tarda esto en armarse: un segundo toque apurado no firma la siguiente. */
const ARMADO_MS = 550;
/** Con más medidas en la cola, el despacho se pliega cuando se aplicaron todas las órdenes (y se vieron) o, a lo sumo, a esto de la firma. */
const PLIEGUE_TOPE_MS = 12_000;
/** Cuánto quedan a la vista las cuatro luces en verde antes de plegar. */
const PLIEGUE_VERDE_MS = 1200;
/** Salida de la tarjeta decidida y de la hoja: más rápida que la entrada. */
const SALE_MS = 200;
const CLAVE_SILENCIO = "offside.silencio";

interface Aviso {
  clave: number;
  texto: string;
  reintentar?: () => void;
}

interface Firmada {
  medida: MedidaDTO;
  /** Cuántas veces se firmó en esta pestaña (para reiniciar el despacho). */
  n: number;
  /** performance.now() de la firma; 0 si se recuperó al recargar. */
  en: number;
  /** Minuto local del momento de la firma, hasta que llega la decisión del servidor. */
  minuto: number;
  /** Se firmó con Enter: nada se anima más allá del cambio de estado. */
  teclado: boolean;
}

/** Minuto de aparición de cada servidor de un expediente, para el recorrido de una ampliación. */
const cacheMinutos = new Map<string, Map<string, number>>();
function useMinutosServidores(medida: MedidaDTO | null): Map<string, number> {
  const id = medida?.clase === "ampliacion" ? medida.expediente_id : null;
  const previos = medida?.ampliacion?.servidores_previos.length ?? 0;
  const [mapa, setMapa] = useState<Map<string, number>>(() => (id ? (cacheMinutos.get(id) ?? new Map()) : new Map()));
  useEffect(() => {
    if (!id) return;
    const guardado = cacheMinutos.get(id);
    if (guardado && guardado.size >= previos) {
      setMapa(guardado);
      return;
    }
    let vigente = true;
    pedir<ExpedienteDTO>(`/api/expedientes/${encodeURIComponent(id)}`)
      .then((e) => {
        const m = new Map(e.servidores.map((s) => [s.host, s.primera_deteccion_min]));
        cacheMinutos.set(id, m);
        if (vigente) setMapa(m);
      })
      .catch(() => {});
    return () => {
      vigente = false;
    };
  }, [id, previos]);
  return mapa;
}

/** Alto de un elemento fijo, para reservarle lugar al pie del contenido. */
function useAlto<T extends HTMLElement>(): [(el: T | null) => void, number] {
  const [alto, setAlto] = useState(0);
  const observador = useRef<ResizeObserver | null>(null);
  const ref = useCallback((el: T | null) => {
    observador.current?.disconnect();
    if (!el) {
      setAlto(0);
      return;
    }
    const ro = new ResizeObserver(() => setAlto(el.offsetHeight));
    ro.observe(el);
    observador.current = ro;
    setAlto(el.offsetHeight);
  }, []);
  return [ref, alto];
}

function useAudioListo(): boolean {
  return useSyncExternalStore(suscribirAudio, audioListo, () => false);
}

/** ¿El 409 dice que la medida ya no espera decisión? Solo entonces se saca de la vista. */
function yaNoPendiente(e: ErrorApi): boolean {
  return e.codigo === 409 && e.motivo !== "fin_de_turno" && /no está pendiente|quedó sin efecto/i.test(e.message);
}

function esFinDeTurno(e: ErrorApi): boolean {
  return e.codigo === 423 || e.motivo === "fin_de_turno" || /fin de tu turno/i.test(e.message);
}

export function Juez() {
  useFondo("lienzo");
  const sesion = useSesion();
  const { datos: cola, error, sinServidor, recargar } = useVivo<ColaDTO>("/api/juez/cola", {
    alRecibir: (c) => sincronizarReloj(c.estado),
  });

  const [elegida, setElegida] = useState<string | null>(null);
  const [ocultas, setOcultas] = useState<ReadonlySet<string>>(new Set());
  const [enVuelo, setEnVuelo] = useState<{ id: string; accion: "firmar" | "rechazar" | "reconsiderar" } | null>(null);
  const [rechazando, setRechazando] = useState<MedidaDTO | null>(null);
  const [aviso, setAviso] = useState<Aviso | null>(null);
  const [nota, setNota] = useState<string | null>(null);
  const [firmada, setFirmada] = useState<Firmada | null>(null);
  const [plegada, setPlegada] = useState(false);
  const [plegando, setPlegando] = useState(false);
  /** El juez volvió a abrir el despacho desde la fila de firmadas: no se pliega solo. */
  const [aMano, setAMano] = useState(false);
  /** La tarjeta recién rechazada, que se queda 200 ms mientras se va. */
  const [saliente, setSaliente] = useState<MedidaDTO | null>(null);
  const [descartadas, setDescartadas] = useState<ReadonlySet<string>>(new Set());
  const [silencio, setSilencio] = useState<boolean>(() => {
    try {
      return sessionStorage.getItem(CLAVE_SILENCIO) === "1";
    } catch {
      return false;
    }
  });
  const sonidoListo = useAudioListo();
  const guardia = useGuardia();
  const altoBarra = useRef(0);

  useEffect(() => {
    prepararSonido();
    return () => detenerTitulo();
  }, []);

  // --- cola visible ----------------------------------------------------------------------

  const pendientes = useMemo(() => (cola?.pendientes ?? []).filter((m) => !ocultas.has(m.id)), [cola, ocultas]);
  const activa = pendientes.find((m) => m.id === elegida) ?? pendientes[0] ?? null;
  const resto = pendientes.filter((m) => m.id !== activa?.id);
  const yo: UsuarioDTO | null = cola?.yo ?? sesion?.usuario ?? null;
  const deTurno = Boolean(cola?.yo.de_turno);
  const finalizado = Boolean(cola?.estado.finalizado);
  const conectado = cola?.estado.conectado !== false;

  // Una medida decidida acá se oculta al instante; cuando el servidor confirma que
  // ya no está pendiente se olvida, para que una reconsideración la vuelva a mostrar.
  useEffect(() => {
    if (!cola || ocultas.size === 0) return;
    const siguen = new Set([...ocultas].filter((id) => cola.pendientes.some((m) => m.id === id)));
    if (siguen.size !== ocultas.size) setOcultas(siguen);
  }, [cola, ocultas]);

  // Si la página se recargó (o firmó desde otro dispositivo), se recupera la última medida
  // suya que todavía está saliendo hacia los proveedores, para seguirla en vivo.
  useEffect(() => {
    if (firmada || !cola) return;
    const enCamino = cola.recientes.find(
      (m) => m.estado === "aprobada" && !descartadas.has(m.id) && m.decision?.juez_id === cola.yo.juez_id && enCurso(filasDespacho(m)),
    );
    if (enCamino) {
      setFirmada({ medida: enCamino, n: 0, en: 0, minuto: enCamino.decision?.minuto ?? minutoAhora(), teclado: false });
      setPlegada(false);
    }
  }, [cola, firmada, descartadas]);

  // La medida firmada, al día con lo que informa el servidor (las órdenes cambian solas).
  const medidaFirmada = firmada ? (cola?.recientes.find((m) => m.id === firmada.medida.id) ?? firmada.medida) : null;
  const { aplicadas, total } = medidaFirmada ? aplicadasDe(filasDespacho(medidaFirmada)) : { aplicadas: 0, total: 0 };
  const todasAplicadas = total > 0 && aplicadas === total;

  // --- pliegue del despacho -----------------------------------------------------------------

  const plegandoRef = useRef(false);
  const plegar = useCallback(() => {
    if (plegandoRef.current) return;
    plegandoRef.current = true;
    setPlegando(true);
    window.setTimeout(() => {
      plegandoRef.current = false;
      setPlegando(false);
      setPlegada(true);
      setAMano(false);
    }, SALE_MS);
  }, []);

  // Con más medidas en la cola, el despacho se pliega cuando las cuatro luces ya se vieron
  // en verde, o a los 12 s de la firma si alguna orden tarda.
  const hayPendientes = pendientes.length > 0;
  const todasDesde = useRef<{ n: number; t: number } | null>(null);
  if (firmada && todasAplicadas && todasDesde.current?.n !== firmada.n) todasDesde.current = { n: firmada.n, t: performance.now() };
  useEffect(() => {
    if (!firmada || plegada || plegando || !hayPendientes || aMano) return;
    if (firmada.en === 0) {
      plegar();
      return;
    }
    const ahora = performance.now();
    const tope = firmada.en + PLIEGUE_TOPE_MS;
    const verde = todasAplicadas && todasDesde.current?.n === firmada.n ? todasDesde.current.t + PLIEGUE_VERDE_MS : Infinity;
    const id = window.setTimeout(plegar, Math.max(0, Math.min(tope, verde) - ahora));
    return () => window.clearTimeout(id);
  }, [firmada, plegada, plegando, hayPendientes, aMano, todasAplicadas, plegar]);
  const hojaAbierta = Boolean(firmada) && !plegada;

  // --- fin de turno --------------------------------------------------------------------------

  // En el último tramo del turno el servidor ya no acepta la firma del saliente: los botones
  // se cambian por quién firma, antes del toque. El colchón cubre la demora de la red.
  const hasta = hastaTurno(cola?.estado, yo?.juez_id);
  const entrante = turnoEntrante(cola?.estado, yo?.juez_id);
  const margen = margenTurno(cola?.estado) + (aceleracion() * 1.5) / 60;
  const finDeTurno = useCondicionMinuto((min) => deTurno && hasta != null && hasta - min <= margen, 250);

  // --- armado del botón ------------------------------------------------------------------

  const activaId = hojaAbierta ? null : (activa?.id ?? null);
  const [armadaPara, setArmadaPara] = useState<string | null>(null);
  useEffect(() => {
    if (!activaId) return;
    const id = window.setTimeout(() => setArmadaPara(activaId), ARMADO_MS);
    return () => window.clearTimeout(id);
  }, [activaId]);
  const armada = activaId != null && armadaPara === activaId;
  const puedeDecidir = deTurno && !finalizado && conectado && !sinServidor && !finDeTurno && armada && !enVuelo && !rechazando && !saliente;

  // --- avisos de medida nueva y de cambio de turno -----------------------------------------

  const conocidas = useRef<Set<string> | null>(null);
  const turnoPrevio = useRef<boolean | null>(null);
  const silencioRef = useRef(silencio);
  silencioRef.current = silencio;

  useEffect(() => {
    if (!cola) return;
    const ids = cola.pendientes.map((m) => m.id);
    const primera = conocidas.current === null;
    const vistas = conocidas.current ?? new Set<string>();
    const nuevas = ids.filter((id) => !vistas.has(id));
    for (const id of ids) vistas.add(id);
    conocidas.current = vistas;

    const antes = turnoPrevio.current;
    turnoPrevio.current = cola.yo.de_turno;
    const entro = antes === false && cola.yo.de_turno;
    const salio = antes === true && !cola.yo.de_turno;
    if (entro) {
      setNota(ids.length > 0 ? `Entraste de turno: ${plural(ids.length, "pendiente", "pendientes")}` : "Entraste de turno: no hay pendientes");
    } else if (salio) {
      setNota(null);
    }

    const hayNovedad = !primera && cola.yo.de_turno && ((nuevas.length > 0 && !entro) || (entro && ids.length > 0));
    if (hayNovedad) {
      // Silenciado, no suena ni vibra: queda la tarjeta y el título que titila.
      if (!silencioRef.current) {
        silbato();
        vibrar([90, 60, 180]);
      }
      const cuantas = entro ? ids.length : nuevas.length;
      titilarTitulo(`● ${plural(cuantas, "medida nueva", "medidas nuevas")}`, document.hidden ? 60_000 : 5000);
      // Con la guardia activa y la pestaña fuera de vista, además avisa el sistema operativo.
      avisarMedidas(entro ? cola.pendientes : cola.pendientes.filter((m) => nuevas.includes(m.id)));
    }
    cerrarAvisosSalvo(new Set(cola.yo.de_turno ? ids : []));
  }, [cola]);

  // Mientras está de turno y el partido sigue, la pantalla no se apaga (si la guardia está activa).
  const hayCola = Boolean(cola);
  useEffect(() => {
    void mantenerPantalla(hayCola && deTurno && !finalizado);
  }, [hayCola, deTurno, finalizado]);
  useEffect(() => () => void mantenerPantalla(false), []);

  useEffect(() => {
    const n = deTurno ? pendientes.length : 0;
    fijarTitulo(n > 0 ? `(${n}) Offside, juez` : "Offside, juez");
  }, [pendientes.length, deTurno]);

  useEffect(() => {
    const alVolver = () => {
      if (!document.hidden) window.setTimeout(detenerTitulo, 1500);
    };
    document.addEventListener("visibilitychange", alVolver);
    return () => document.removeEventListener("visibilitychange", alVolver);
  }, []);

  useEffect(() => {
    if (!nota) return;
    const id = window.setTimeout(() => setNota(null), 9000);
    return () => window.clearTimeout(id);
  }, [nota]);

  useEffect(() => {
    if (!aviso || aviso.reintentar) return;
    const id = window.setTimeout(() => setAviso((a) => (a?.clave === aviso.clave ? null : a)), 9000);
    return () => window.clearTimeout(id);
  }, [aviso]);

  // --- acciones ----------------------------------------------------------------------------

  const hastaRef = useRef({ hasta, entrante });
  hastaRef.current = { hasta, entrante };

  const mostrarError = useCallback((prefijo: string, causa: unknown, reintentar?: () => void) => {
    const e = causa instanceof ErrorApi ? causa : new ErrorApi(0, "No se pudo completar la acción.");
    if (e.codigo === 401) return;
    let texto = e.message;
    if (esFinDeTurno(e)) {
      const { hasta: h, entrante: t } = hastaRef.current;
      texto =
        h != null
          ? `tu turno termina en el minuto ${minutoEntero(h)}. Esta medida la firma ${t ? t.nombre : "el juez entrante"}.`
          : "tu turno está por terminar. Esta medida la firma el juez entrante.";
    }
    // 503: no se pudo confirmar el turno con el simulador. 0: Offside no respondió. Los dos se reintentan.
    const reintentable = e.codigo === 503 || e.codigo === 0;
    setAviso({ clave: Date.now(), texto: `${prefijo}: ${texto}`, reintentar: reintentable ? reintentar : undefined });
  }, []);

  const ocultar = useCallback((id: string) => setOcultas((previas) => new Set([...previas, id])), []);

  const firmar = useCallback(
    async (m: MedidaDTO, opciones: { teclado?: boolean } = {}) => {
      setEnVuelo({ id: m.id, accion: "firmar" });
      setAviso(null);
      try {
        await pedir(`/api/juez/medidas/${encodeURIComponent(m.id)}/aprobar`, { metodo: "POST", cuerpo: { huella: m.huella } });
        ocultar(m.id);
        setFirmada((previa) => ({ medida: m, n: (previa?.n ?? 0) + 1, en: performance.now(), minuto: minutoAhora(), teclado: Boolean(opciones.teclado) }));
        setPlegada(false);
        setAMano(false);
        setElegida(null);
        if (!silencioRef.current) vibrar(40);
      } catch (causa) {
        if (causa instanceof ErrorApi && yaNoPendiente(causa)) ocultar(m.id);
        mostrarError("No se firmó", causa, () => void firmar(m, opciones));
      } finally {
        setEnVuelo(null);
        void recargar();
      }
    },
    [mostrarError, ocultar, recargar],
  );

  const rechazar = useCallback(
    async (m: MedidaDTO, motivo: string) => {
      setEnVuelo({ id: m.id, accion: "rechazar" });
      setAviso(null);
      try {
        await pedir(`/api/juez/medidas/${encodeURIComponent(m.id)}/rechazar`, { metodo: "POST", cuerpo: { motivo } });
        setRechazando(null);
        // La tarjeta se va en 200 ms antes de que entre la siguiente.
        setSaliente(m);
        ocultar(m.id);
        setElegida(null);
        window.setTimeout(() => setSaliente((s) => (s?.id === m.id ? null : s)), SALE_MS);
      } catch (causa) {
        if (causa instanceof ErrorApi && yaNoPendiente(causa)) ocultar(m.id);
        setRechazando(null);
        mostrarError("No se rechazó", causa, () => void rechazar(m, motivo));
      } finally {
        setEnVuelo(null);
        void recargar();
      }
    },
    [mostrarError, ocultar, recargar],
  );

  const reconsiderar = useCallback(
    async (m: MedidaDTO) => {
      setEnVuelo({ id: m.id, accion: "reconsiderar" });
      setAviso(null);
      try {
        await pedir(`/api/juez/medidas/${encodeURIComponent(m.id)}/reconsiderar`, { metodo: "POST" });
        setOcultas((previas) => new Set([...previas].filter((id) => id !== m.id)));
        setElegida(m.id);
        setPlegada(true);
        window.scrollTo({ top: 0, behavior: movimientoReducido() ? "auto" : "smooth" });
      } catch (causa) {
        mostrarError("No se reabrió", causa, () => void reconsiderar(m));
      } finally {
        setEnVuelo(null);
        void recargar();
      }
    },
    [mostrarError, recargar],
  );

  // Enter firma la medida al frente (escritorio). No actúa dentro de campos, botones o diálogos.
  const firmarActiva = useRef<() => void>(() => {});
  firmarActiva.current = () => {
    if (activa && puedeDecidir && !hojaAbierta) void firmar(activa, { teclado: true });
  };
  useEffect(() => {
    const alTeclear = (e: KeyboardEvent) => {
      if (e.key !== "Enter" || e.repeat || e.isComposing || e.metaKey || e.ctrlKey || e.altKey || e.shiftKey) return;
      const el = e.target instanceof Element ? e.target : null;
      if (el?.closest("input, textarea, select, button, a, summary, dialog, [contenteditable]")) return;
      if (document.querySelector("dialog[open]")) return;
      e.preventDefault();
      firmarActiva.current();
    };
    window.addEventListener("keydown", alTeclear);
    return () => window.removeEventListener("keydown", alTeclear);
  }, []);

  const alternarSilencio = () => {
    // Antes del primer toque el navegador no deja sonar: este toque lo habilita y suena el silbato.
    if (!audioListo()) {
      if (silencio) guardarSilencio(false);
      void activarSonido();
      return;
    }
    guardarSilencio(!silencio);
    if (silencio) window.setTimeout(silbato, 60);
  };
  const guardarSilencio = (nuevo: boolean) => {
    setSilencio(nuevo);
    try {
      sessionStorage.setItem(CLAVE_SILENCIO, nuevo ? "1" : "0");
    } catch {
      // Sin almacenamiento la preferencia dura lo que dure la página.
    }
  };

  const minutos = useMinutosServidores(hojaAbierta ? (firmada?.medida ?? null) : activa);
  const [refPie, altoPie] = useAlto<HTMLDivElement>();
  const refBarra = useCallback(
    (el: HTMLDivElement | null) => {
      refPie(el);
      if (el) altoBarra.current = el.offsetHeight;
    },
    [refPie],
  );

  // --- render ------------------------------------------------------------------------------

  if (!sesion) return <Navigate to="/ingreso" replace />;
  if (sesion.usuario.rol !== "juez" || error?.codigo === 403) return <Navigate to="/tablero" replace />;

  const conSello: MedidaDTO | null = medidaFirmada
    ? medidaFirmada.decision
      ? medidaFirmada
      : {
          ...medidaFirmada,
          estado: "aprobada",
          decision: { juez_id: yo?.juez_id ?? null, juez_nombre: yo?.nombre ?? null, minuto: firmada!.minuto, hora_iso: null, resultado: "aprobada", motivo: null },
        }
    : null;
  const cerrarFirmada = () => {
    if (firmada) setDescartadas((previas) => new Set([...previas, firmada.medida.id]));
    setFirmada(null);
  };
  const hayBarra = !hojaAbierta && !saliente && Boolean(activa) && !finalizado;
  const quienFirma = cola?.estado.jueces_de_turno ?? [];
  // Recién firmada con el dedo: el detalle de la tarjeta se pliega y la hoja sube desde la barra.
  const conMovimiento = Boolean(firmada && firmada.en > 0 && !firmada.teclado);
  const plegarDetalle = conMovimiento && performance.now() - (firmada?.en ?? 0) < 1000;
  const filaFirmada = firmada && plegada && conSello ? conSello : null;

  // Una sola línea de estado bajo el reloj, en 13: la entrada de turno, el simulacro y el aviso sonoro.
  // Si la tarjeta al frente es la del simulacro, ella ya lo dice: no se repite arriba.
  const alFrente = saliente ?? (hojaAbierta ? conSello : activa);
  const notaCabeza = nota ?? (cola?.estado.simulacro && !alFrente?.simulacro ? "Simulacro de reclamos activo" : null);
  const notaSecundaria = !nota && notaCabeza != null;

  return (
    <div className="juez" style={{ ["--pie" as string]: `${altoPie}px` }}>
      <CabezaJuez
        estado={cola?.estado ?? null}
        yo={yo}
        deTurno={deTurno}
        silencio={silencio}
        sonidoListo={sonidoListo}
        nota={notaCabeza}
        notaSecundaria={notaSecundaria}
        alSilenciar={alternarSilencio}
        alActivarSonido={() => void activarSonido()}
        guardia={guardia}
        alAlternarGuardia={() => void (guardia.activa ? apagarGuardia() : activarGuardia())}
        sinServidor={sinServidor}
      />

      {!cola ? (
        <Cargando texto={error && error.codigo !== 0 ? error.message : "Conectando con Offside…"} />
      ) : (
        <main className="juez-cuerpo">
          {!deTurno && !finalizado && !hojaAbierta && <FueraDeTurno estado={cola.estado} yo={yo} />}
          {aviso && !hayBarra && <AvisoSuelto aviso={aviso} alCerrar={() => setAviso(null)} />}

          {filaFirmada && (
            <FilaFirmada
              medida={filaFirmada}
              alAbrir={() => {
                setPlegada(false);
                setAMano(true);
                window.scrollTo({ top: 0, behavior: "auto" });
              }}
            />
          )}

          {saliente ? (
            <Tarjeta key={saliente.id} medida={saliente} minutos={minutos} sale />
          ) : hojaAbierta && conSello ? (
            <Tarjeta key={conSello.id} medida={conSello} minutos={minutos} firmada plegar={plegarDetalle} sale={plegando} />
          ) : activa ? (
            <Tarjeta key={activa.id} medida={activa} minutos={minutos} />
          ) : (
            <ColaVacia estado={cola.estado} deTurno={deTurno} silencio={silencio} sonidoListo={sonidoListo} />
          )}

          {!hojaAbierta && !saliente && resto.length > 0 && (
            <MasEnCola
              medidas={resto}
              alElegir={(m) => {
                setElegida(m.id);
                window.scrollTo({ top: 0, behavior: movimientoReducido() ? "auto" : "smooth" });
              }}
            />
          )}

          {!hojaAbierta && (
            <>
              <Decididas
                medidas={cola.recientes.filter((m) => m.id !== filaFirmada?.id)}
                puedeReconsiderar={deTurno && !finalizado && !enVuelo}
                enVuelo={enVuelo?.accion === "reconsiderar" ? enVuelo.id : null}
                alReconsiderar={(m) => void reconsiderar(m)}
              />
              <PieJuez />
            </>
          )}
        </main>
      )}

      {cola && hojaAbierta && conSello && (
        <HojaDespacho
          ref={refPie}
          key={`${conSello.id}-${firmada?.n ?? 0}-${aMano ? "a" : "s"}`}
          medida={conSello}
          desdeAlto={altoBarra.current}
          recien={conMovimiento && !aMano}
          sale={plegando}
          siguientes={pendientes.length}
          alSiguiente={plegar}
          alCerrar={cerrarFirmada}
        />
      )}
      {cola && hayBarra && activa && (
        <BarraAccion
          ref={refBarra}
          medida={activa}
          deTurno={deTurno}
          finDeTurno={finDeTurno}
          hasta={hasta}
          entrante={entrante?.nombre ?? null}
          conectado={conectado}
          sinServidor={sinServidor}
          quienFirma={quienFirma.map((j) => j.nombre)}
          armada={armada}
          habilitada={puedeDecidir}
          firmando={enVuelo?.accion === "firmar"}
          aviso={aviso}
          alCerrarAviso={() => setAviso(null)}
          alFirmar={() => void firmar(activa)}
          alRechazar={() => setRechazando(activa)}
        />
      )}

      {rechazando && (
        <HojaRechazo
          medida={rechazando}
          enviando={enVuelo?.accion === "rechazar"}
          alCancelar={() => setRechazando(null)}
          alConfirmar={(motivo) => void rechazar(rechazando, motivo)}
        />
      )}
    </div>
  );
}

// --- cabecera ---------------------------------------------------------------------------------

function CabezaJuez(p: {
  estado: EstadoDTO | null;
  yo: UsuarioDTO | null;
  deTurno: boolean;
  silencio: boolean;
  sonidoListo: boolean;
  nota: string | null;
  /** La nota es el aviso permanente del simulacro: en un teléfono angosto cede su lugar al pedido de activar el sonido. */
  notaSecundaria: boolean;
  alSilenciar: () => void;
  alActivarSonido: () => void;
  guardia: Guardia;
  alAlternarGuardia: () => void;
  sinServidor: boolean;
}) {
  const e = p.estado;
  const apagado = p.silencio || !p.sonidoListo;
  const pedirToque = !p.silencio && !p.sonidoListo && !e?.finalizado;
  // Silenciar apaga también la vibración; donde no hay vibración (iPhone), no se nombra.
  const aviso = puedeVibrar() ? "el aviso (sonido y vibración)" : "el aviso sonoro";
  const rotulo = !p.sonidoListo ? "Activar el aviso sonoro" : p.silencio ? `Activar ${aviso}` : `Silenciar ${aviso}`;
  const ayuda = !p.sonidoListo
    ? "El aviso sonoro todavía no está activo"
    : p.silencio
      ? puedeVibrar()
        ? "Aviso apagado: sin sonido ni vibración"
        : "Aviso sonoro apagado"
      : puedeVibrar()
        ? "Aviso encendido: sonido y vibración"
        : "Aviso sonoro encendido";
  const g = p.guardia;
  const partesGuardia = [
    g.avisos === "granted" ? "avisos del sistema" : g.avisos === "denied" ? "avisos bloqueados por el navegador" : null,
    g.pantalla === "prendida" ? "pantalla siempre prendida" : g.pantalla === "libre" && p.deTurno ? "la pantalla se prende al volver a la pestaña" : null,
  ].filter(Boolean);
  const ayudaGuardia = g.activa
    ? `Guardia activa${partesGuardia.length ? `: ${partesGuardia.join(", ")}` : ""}. Tocá para apagarla.`
    : "Guardia apagada. Tocá para recibir avisos del sistema con la pestaña en segundo plano y mantener la pantalla prendida durante el turno.";
  return (
    <header className="cabeza-juez">
      <div className="cabeza-juez-interior">
        <div className="cabeza-fila">
          <p className="cabeza-nombre">{p.yo?.nombre ?? "Juez"}</p>
          {p.yo && e && <PildoraTurno deTurno={p.deTurno} />}
        </div>
        <p className="cabeza-juzgado">{juzgadoBreve(p.yo?.juzgado_nombre)}</p>
        {e && (
          <div className="cabeza-reloj" data-guardia={g.disponible ? "" : undefined}>
            <RelojPartido estado={e} className="cabeza-cifra" />
            <ReglaChica estado={e} />
            <span className="cabeza-fin num">de {minutoEntero(e.fin_min || 105)}′</span>
            <button
              type="button"
              className="boton-icono"
              onClick={p.alSilenciar}
              aria-pressed={p.silencio}
              aria-label={rotulo}
              title={ayuda}
              data-apagado={apagado ? "" : undefined}
              {...{ [ACTIVA_SONIDO]: "" }}
            >
              {apagado ? <IconoSilencio /> : <IconoSonido />}
            </button>
            {g.disponible && (
              <button
                type="button"
                className="boton-icono"
                onClick={p.alAlternarGuardia}
                aria-pressed={g.activa}
                aria-label={g.activa ? "Apagar la guardia: avisos del sistema y pantalla prendida" : "Activar la guardia: avisos del sistema y pantalla prendida"}
                title={ayudaGuardia}
                data-apagado={g.activa ? undefined : ""}
                data-guardia-activa={g.activa ? "" : undefined}
              >
                {g.activa ? <IconoCampana /> : <IconoCampanaApagada />}
              </button>
            )}
          </div>
        )}
        {e?.finalizado ? (
          <p className="cabeza-final">Partido terminado. Todo venció a los {minutoEntero(e.fin_min)}′.</p>
        ) : (
          (p.nota || pedirToque) && (
            <div className="cabeza-estado" data-ambos={p.nota && pedirToque ? "" : undefined}>
              {p.nota ? (
                <p role="status" className="cabeza-nota" data-secundaria={p.notaSecundaria ? "" : undefined}>
                  {p.nota}
                </p>
              ) : (
                <span />
              )}
              {pedirToque && (
                <button type="button" className="cabeza-activar" onClick={p.alActivarSonido} {...{ [ACTIVA_SONIDO]: "" }}>
                  Tocá para activar el aviso
                </button>
              )}
            </div>
          )
        )}
      </div>
      <Cortes estado={e} sinServidor={p.sinServidor} />
    </header>
  );
}

/** La escala del partido en chico: el relleno celeste avanza con el reloj. */
function ReglaChica({ estado }: { estado: EstadoDTO }) {
  const m = useMinuto(200);
  const fin = estado.fin_min || 105;
  const avance = Math.min(1, Math.max(0, (estado.finalizado ? fin : m) / fin));
  return (
    <span className="regla-chica" aria-hidden="true">
      <i style={{ transform: `scaleX(${avance})` }} />
    </span>
  );
}

function FueraDeTurno({ estado, yo }: { estado: EstadoDTO; yo: UsuarioDTO | null }) {
  const jueces = estado.jueces_de_turno;
  const desde = jueces[0] ? desdeTurno(estado, jueces[0].id) : null;
  const proximo = proximoTurno(estado, yo?.juez_id);
  const quien = lista(jueces.map((j) => j.nombre));
  let detalle: string;
  if (proximo) {
    detalle = `Tu turno empieza en el minuto ${minutoEntero(proximo.desde_min)}.${jueces.length > 0 ? ` Hasta entonces firma ${quien}.` : ""}`;
  } else if (jueces.length > 0) {
    detalle = `De turno: ${quien}${desde != null ? `, desde el minuto ${minutoEntero(desde)}` : ""}. Podés leer la cola, pero no firmar.`;
  } else {
    detalle = "Ahora no hay ningún juez de turno.";
  }
  return (
    <section role="status" className="grupo-hundido fuera-turno">
      <p className="grupo-titulo">Fuera de turno</p>
      <p className="grupo-detalle-15">{detalle}</p>
    </section>
  );
}

function AvisoSuelto({ aviso, alCerrar }: { aviso: Aviso; alCerrar: () => void }) {
  return (
    <div role="alert" className="grupo-hundido aviso-suelto">
      <p>{aviso.texto}</p>
      {aviso.reintentar ? (
        <button
          type="button"
          className="boton-texto"
          onClick={() => {
            const otraVez = aviso.reintentar!;
            alCerrar();
            otraVez();
          }}
        >
          Reintentar
        </button>
      ) : (
        <button type="button" className="boton-icono" aria-label="Cerrar el aviso" onClick={alCerrar}>
          <IconoCerrar />
        </button>
      )}
    </div>
  );
}

// --- estados de la cola ---------------------------------------------------------------------

function ColaVacia({ estado, deTurno, silencio, sonidoListo }: { estado: EstadoDTO; deTurno: boolean; silencio: boolean; sonidoListo: boolean }) {
  const [titulo, detalle] = estado.finalizado
    ? ["Terminó el partido", `Todas las órdenes vencieron a los ${minutoEntero(estado.fin_min)}′. No quedan medidas por decidir.`]
    : !deTurno
      ? ["No hay medidas en la cola", "Cuando entres de turno, las medidas pendientes aparecen acá."]
      : silencio
        ? ["No hay medidas en la cola", `El aviso está apagado: la próxima aparece acá, sin sonido${puedeVibrar() ? " ni vibración" : ""}.`]
        : !sonidoListo
          ? ["No hay medidas en la cola", "Tocá el parlante de arriba para que suene un aviso con la próxima."]
          : ["No hay medidas en la cola", "Suena un aviso cuando llegue la próxima."];
  return (
    <section className="cola-vacia" role="status">
      <h1>{titulo}</h1>
      <p>{detalle}</p>
    </section>
  );
}

function EsperaCorta({ medida }: { medida: MedidaDTO }) {
  const ahora = useMinuto(1000);
  return <>{haceReal(Math.max(0, ahora - medida.creada_min), aceleracion())}</>;
}

/** La medida firmada, plegada en una fila con sus cuatro luces en vivo. Tocarla vuelve a abrir el despacho. */
function FilaFirmada({ medida, alAbrir }: { medida: MedidaDTO; alAbrir: () => void }) {
  const d = medida.decision;
  return (
    <section className="fila-firmada-envoltura" aria-label="Firmada">
      <button type="button" className="fila-firmada" onClick={alAbrir} aria-label={`Ver el despacho de ${objetivoDe(medida)}`}>
        <span className="fila-firmada-texto">
          <span className="fila-objeto fila-firmada-objeto">{objetivoDe(medida)}</span>
          <span className="fila-meta num">{d?.minuto != null ? `firmada a los ${reloj(d.minuto)}` : "firmada"}</span>
        </span>
        <LucesOrdenes medida={medida} />
      </button>
    </section>
  );
}

function MasEnCola({ medidas, alElegir }: { medidas: MedidaDTO[]; alElegir: (m: MedidaDTO) => void }) {
  return (
    <section className="lista-juez" aria-label="Siguen en la cola">
      <h2 className="lista-titulo">{medidas.length === 1 ? "1 más en la cola" : `${medidas.length} más en la cola`}</h2>
      <ul className="grupo-filas">
        {medidas.map((m) => (
          <li key={m.id}>
            <button type="button" className="fila-cola" onClick={() => alElegir(m)}>
              <span className="fila-objeto">{objetivoDe(m)}</span>
              <span className="fila-meta num">
                {CLASE[m.clase]}
                {m.simulacro ? ", simulacro" : ""}, <EsperaCorta medida={m} />
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Decididas(p: { medidas: MedidaDTO[]; puedeReconsiderar: boolean; enVuelo: string | null; alReconsiderar: (m: MedidaDTO) => void }) {
  if (p.medidas.length === 0) return null;
  return (
    <section className="lista-juez" aria-label="Medidas decididas">
      <h2 className="lista-titulo">Decididas</h2>
      <ul className="grupo-filas">
        {p.medidas.map((m) => {
          const d = m.decision;
          const verbo = m.estado === "aprobada" ? "firmada" : m.estado === "rechazada" ? "rechazada" : "sin efecto";
          return (
            <li key={m.id} className="fila-decidida">
              <Link to={`/expediente/${encodeURIComponent(m.expediente_id)}`} className="fila-decidida-texto">
                <span className="fila-objeto">{objetivoDe(m)}</span>
                <span className="fila-meta num">
                  {CLASE[m.clase]}, {verbo}
                  {d?.minuto != null ? ` a los ${reloj(d.minuto)}` : ""}
                  {m.estado === "rechazada" && d?.motivo ? `. ${d.motivo}` : ""}
                </span>
              </Link>
              {m.estado === "aprobada" && <LucesOrdenes medida={m} />}
              {m.estado === "rechazada" && (
                <button type="button" className="boton boton-chico" disabled={!p.puedeReconsiderar} onClick={() => p.alReconsiderar(m)}>
                  <span>{p.enVuelo === m.id ? "Reabriendo…" : "Reconsiderar"}</span>
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function PieJuez() {
  return (
    <footer className="pie-juez">
      <nav>
        <Link to="/tablero">Tablero</Link>
        <Link to="/transparencia">Registro público</Link>
        <button type="button" className="boton-texto" onClick={() => void salir()}>
          Cerrar sesión
        </button>
      </nav>
      <p>Nombres, IPs y juzgados ficticios del simulador oficial del desafío.</p>
    </footer>
  );
}

// --- barra de acción y despacho -----------------------------------------------------------------

function BarraAccion(p: {
  ref: (el: HTMLDivElement | null) => void;
  medida: MedidaDTO;
  deTurno: boolean;
  /** Último tramo del turno: firma el entrante. */
  finDeTurno: boolean;
  hasta: number | null;
  entrante: string | null;
  conectado: boolean;
  sinServidor: boolean;
  quienFirma: string[];
  armada: boolean;
  habilitada: boolean;
  firmando: boolean;
  aviso: Aviso | null;
  alCerrarAviso: () => void;
  alFirmar: () => void;
  alRechazar: () => void;
}) {
  if (!p.deTurno || p.finDeTurno) {
    const texto = p.finDeTurno
      ? p.entrante
        ? `Firma el juez entrante: ${p.entrante}${p.hasta != null ? `, desde el minuto ${minutoEntero(p.hasta)}` : ""}.`
        : `Tu turno termina${p.hasta != null ? ` en el minuto ${minutoEntero(p.hasta)}` : ""}: esta medida la firma el juez entrante.`
      : p.quienFirma.length > 0
        ? `Firma quien está de turno: ${lista(p.quienFirma)}.`
        : "Ahora no hay ningún juez de turno.";
    return (
      <div ref={p.ref} className="barra-accion">
        <p className="barra-fuera" role="status">
          {texto}
        </p>
      </div>
    );
  }
  // Sin conexión, la segunda línea es una frase: va en la letra del texto, no en la de la huella
  // (en Plex Mono no entraba en el botón de un teléfono de 390 y se cortaba por los dos lados).
  const sinFirma = p.sinServidor || !p.conectado;
  const segunda = p.sinServidor
    ? "sin conexión, no se puede firmar"
    : !p.conectado
      ? "sin simulador, no se puede firmar"
      : `huella ${enGrupos(p.medida.huella, 12)}`;
  return (
    <div ref={p.ref} className="barra-accion">
      {p.aviso ? (
        <p className="barra-aviso" role="alert">
          {p.aviso.texto}
          {p.aviso.reintentar && (
            <>
              {" "}
              <button
                type="button"
                className="boton-texto boton-texto-linea"
                onClick={() => {
                  const otraVez = p.aviso!.reintentar!;
                  p.alCerrarAviso();
                  otraVez();
                }}
              >
                Reintentar
              </button>
            </>
          )}
        </p>
      ) : (
        <p className="barra-nota">Firmás lo que ves: esta huella viaja en cada orden.</p>
      )}
      <div className="barra-botones">
        <button type="button" className="boton boton-porcelana" disabled={!p.habilitada} onClick={p.alRechazar}>
          <span>Rechazar</span>
        </button>
        <button
          type="button"
          className="boton boton-firma"
          disabled={!p.habilitada}
          data-listo={p.habilitada || p.firmando ? "" : undefined}
          onClick={p.alFirmar}
        >
          <span className="firma-rotulos" data-estado={p.firmando ? "firmando" : "listo"}>
            <span className="firma-rotulo firma-listo">
              Firmar y ordenar
              <kbd className="tecla">Enter</kbd>
            </span>
            <span className="firma-rotulo firma-en-curso" aria-hidden={!p.firmando}>
              Firmando…
            </span>
          </span>
          <span className={sinFirma ? "firma-huella" : "firma-huella huella"}>{segunda}</span>
        </button>
      </div>
    </div>
  );
}

function HojaDespacho(p: {
  ref: (el: HTMLDivElement | null) => void;
  medida: MedidaDTO;
  desdeAlto: number;
  /** Recién firmada con el dedo: la hoja sube desde la barra. Con Enter, o al reabrirla, aparece en su lugar. */
  recien: boolean;
  /** Se pliega en la fila de firmadas: sube un poco y se funde. */
  sale: boolean;
  siguientes: number;
  alSiguiente: () => void;
  alCerrar: () => void;
}) {
  const hoja = useRef<HTMLDivElement | null>(null);
  const contenido = useRef<HTMLDivElement | null>(null);
  const { ref } = p;
  const unir = useCallback(
    (el: HTMLDivElement | null) => {
      hoja.current = el;
      ref(el);
    },
    [ref],
  );

  // La barra crece hasta ser el despacho: la hoja sube desde donde estaba la barra.
  useLayoutEffect(() => {
    const h = hoja.current;
    if (!h || !p.recien) return;
    if (movimientoReducido()) {
      h.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 160, easing: "ease" });
      return;
    }
    const desde = Math.max(0, h.offsetHeight - (p.desdeAlto || 132));
    h.animate([{ transform: `translateY(${desde}px)` }, { transform: "translateY(0)" }], { duration: 512, easing: RESORTE });
    contenido.current?.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 120, easing: "ease", delay: 40, fill: "backwards" });
    // Solo al montar: la hoja nace de la barra una vez por firma.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Al plegarse, la hoja se va hacia arriba, hacia la fila de firmadas, y se funde.
  useLayoutEffect(() => {
    const h = hoja.current;
    if (!h || !p.sale) return;
    const reducido = movimientoReducido();
    h.animate(
      reducido
        ? [{ opacity: 1 }, { opacity: 0 }]
        : [
            { opacity: 1, transform: "translateY(0)" },
            { opacity: 0, transform: "translateY(-32px)" },
          ],
      { duration: reducido ? 160 : SALE_MS, easing: SALIDA, fill: "forwards" },
    );
  }, [p.sale]);

  return (
    <div ref={unir} className="hoja-despacho" role="region" aria-label="Despacho de la medida firmada" data-sale={p.sale ? "" : undefined}>
      <div ref={contenido}>
        <Despacho medida={p.medida} entra={p.recien} />
        <div className="despacho-acciones">
          {p.siguientes > 0 ? (
            <button type="button" className="boton boton-porcelana boton-ancho" onClick={p.alSiguiente} disabled={p.sale}>
              <span>{p.siguientes === 1 ? "Ver la siguiente medida" : `Ver la siguiente, quedan ${p.siguientes}`}</span>
            </button>
          ) : (
            <button type="button" className="boton-texto" onClick={p.alCerrar}>
              Ocultar el despacho
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
