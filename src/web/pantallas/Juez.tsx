// Pantalla del juez de turno. Pensada para el celular (390 px) y para decidir
// cada medida en menos de diez segundos: el pedido, cuatro luces y dos botones.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import type { ColaDTO, EstadoDTO, MedidaDTO, UsuarioDTO } from "../../compartido/tipos.ts";
import { Cargando, Cortes, Dato, Huella, IconoCerrar, IconoSalir, IconoSilencio, IconoSonido, Marca, RelojPartido, useTema } from "../componentes/comunes.tsx";
import { BarraCobertura, DespachoAmplio, DespachoCompacto, aplicadasDe } from "../componentes/Despacho.tsx";
import { HojaRechazo } from "../componentes/HojaRechazo.tsx";
import {
  BandaSimulacro,
  DetalleReclamo,
  LucesBreves,
  MotivoRatificacion,
  NoSeTocan,
  PlanProveedores,
  Promocion,
  QueCambio,
  Verificaciones,
} from "../componentes/Medida.tsx";
import { ErrorApi, pedir } from "../nucleo/api.ts";
import { coberturaDe, enCurso, filasDespacho } from "../nucleo/despacho.ts";
import { CLASE, ESTADO_MEDIDA, juzgadoBreve, minuto, numero, plural, tiempoReal } from "../nucleo/formato.ts";
import { aceleracion, sincronizarReloj, useMinuto } from "../nucleo/reloj.ts";
import { salir, useSesion } from "../nucleo/sesion.ts";
import { detenerTitulo, fijarTitulo, prepararSonido, silbato, titilarTitulo, vibrar } from "../nucleo/sonido.ts";
import { useVivo } from "../nucleo/vivo.ts";

/** Tras cambiar la medida en despacho, los botones tardan esto en habilitarse:
 *  un segundo toque apurado no firma la medida siguiente. */
const ARMADO_MS = 550;
const CLAVE_SILENCIO = "offside.silencio";

interface Aviso {
  clave: number;
  texto: string;
  reintentar?: () => void;
}

function objetivoDe(m: MedidaDTO): string {
  if (m.levantamiento) return m.levantamiento.dominio;
  return m.servidor?.host ?? m.expediente_id;
}

export function Juez() {
  useTema("papel");
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
  const [firmada, setFirmada] = useState<{ medida: MedidaDTO; n: number } | null>(null);
  const [descartadas, setDescartadas] = useState<ReadonlySet<string>>(new Set());
  const [silencio, setSilencio] = useState<boolean>(() => {
    try {
      return sessionStorage.getItem(CLAVE_SILENCIO) === "1";
    } catch {
      return false;
    }
  });

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

  // Una medida decidida acá se oculta al instante; cuando el servidor confirma que
  // ya no está pendiente se olvida, para que una reconsideración la vuelva a mostrar.
  useEffect(() => {
    if (!cola || ocultas.size === 0) return;
    const siguen = new Set([...ocultas].filter((id) => cola.pendientes.some((m) => m.id === id)));
    if (siguen.size !== ocultas.size) setOcultas(siguen);
  }, [cola, ocultas]);

  // Si la página se recargó (o el juez firmó desde otro dispositivo), se recupera la última
  // medida suya que todavía está saliendo hacia los proveedores, para seguirla en vivo.
  useEffect(() => {
    if (firmada || !cola) return;
    const enCamino = cola.recientes.find(
      (m) => m.estado === "aprobada" && !descartadas.has(m.id) && m.decision?.juez_id === cola.yo.juez_id && enCurso(filasDespacho(m)),
    );
    if (enCamino) setFirmada({ medida: enCamino, n: 0 });
  }, [cola, firmada, descartadas]);

  // --- armado de los botones ---------------------------------------------------------------

  const activaId = activa?.id ?? null;
  const [armadaPara, setArmadaPara] = useState<string | null>(null);
  useEffect(() => {
    if (!activaId) return;
    const id = window.setTimeout(() => setArmadaPara(activaId), ARMADO_MS);
    return () => window.clearTimeout(id);
  }, [activaId]);
  const armada = activaId != null && armadaPara === activaId;
  const puedeDecidir = deTurno && !finalizado && armada && !enVuelo && !rechazando;

  // --- avisos de medida nueva y de cambio de turno -------------------------------------------

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
      setNota(
        ids.length > 0
          ? `Entraste de turno. Recibís ${plural(ids.length, "medida pendiente", "medidas pendientes")}.`
          : "Entraste de turno. No hay medidas pendientes.",
      );
    } else if (salio) {
      // El cartel de "fuera de turno" ya dice quién firma ahora.
      setNota(null);
    }

    const hayNovedad = !primera && cola.yo.de_turno && ((nuevas.length > 0 && !entro) || (entro && ids.length > 0));
    if (hayNovedad) {
      if (!silencioRef.current) silbato();
      vibrar([90, 60, 180]);
      const cuantas = entro ? ids.length : nuevas.length;
      titilarTitulo(`● ${plural(cuantas, "medida nueva", "medidas nuevas")}`, document.hidden ? 60_000 : 5000);
    }
  }, [cola]);

  useEffect(() => {
    const n = deTurno ? pendientes.length : 0;
    fijarTitulo(n > 0 ? `(${n}) Offside · Juez` : "Offside · Juez");
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
    const id = window.setTimeout(() => setAviso((a) => (a?.clave === aviso.clave ? null : a)), 8000);
    return () => window.clearTimeout(id);
  }, [aviso]);

  // --- acciones ------------------------------------------------------------------------------

  const mostrarError = useCallback((causa: unknown, reintentar?: () => void) => {
    const e = causa instanceof ErrorApi ? causa : new ErrorApi(0, "No se pudo completar la acción.");
    if (e.codigo === 401) return;
    // 503: no se pudo confirmar el turno con el simulador. 0: Offside no respondió. En los dos casos se puede reintentar.
    const reintentable = e.codigo === 503 || e.codigo === 0;
    setAviso({ clave: Date.now(), texto: e.message, reintentar: reintentable ? reintentar : undefined });
  }, []);

  const ocultar = useCallback((id: string) => setOcultas((previas) => new Set([...previas, id])), []);

  const firmar = useCallback(
    async (m: MedidaDTO) => {
      setEnVuelo({ id: m.id, accion: "firmar" });
      setAviso(null);
      try {
        await pedir(`/api/juez/medidas/${encodeURIComponent(m.id)}/aprobar`, { metodo: "POST" });
        ocultar(m.id);
        setFirmada((previa) => ({ medida: m, n: (previa?.n ?? 0) + 1 }));
        setElegida(null);
        vibrar(40);
      } catch (causa) {
        if (causa instanceof ErrorApi && causa.codigo === 409) ocultar(m.id);
        mostrarError(causa, () => void firmar(m));
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
        ocultar(m.id);
        setRechazando(null);
        setElegida(null);
      } catch (causa) {
        if (causa instanceof ErrorApi && causa.codigo === 409) ocultar(m.id);
        setRechazando(null);
        mostrarError(causa, () => void rechazar(m, motivo));
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
        window.scrollTo({ top: 0, behavior: "smooth" });
      } catch (causa) {
        mostrarError(causa, () => void reconsiderar(m));
      } finally {
        setEnVuelo(null);
        void recargar();
      }
    },
    [mostrarError, recargar],
  );

  // Enter firma la medida en despacho (escritorio). No actúa dentro de campos, botones o diálogos.
  const firmarActiva = useRef<() => void>(() => {});
  firmarActiva.current = () => {
    if (activa && puedeDecidir) void firmar(activa);
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
    setSilencio((s) => {
      const nuevo = !s;
      try {
        sessionStorage.setItem(CLAVE_SILENCIO, nuevo ? "1" : "0");
      } catch {
        // Sin almacenamiento la preferencia dura lo que dure la página.
      }
      if (!nuevo) window.setTimeout(silbato, 60);
      return nuevo;
    });
  };

  // --- render ----------------------------------------------------------------------------------

  if (!sesion) return <Navigate to="/ingreso" replace />;
  if (sesion.usuario.rol !== "juez" || error?.codigo === 403) return <Navigate to="/tablero" replace />;

  // La medida recién firmada se sigue en vivo hasta que el juez la cierra o firma otra.
  const medidaFirmada = firmada ? (cola?.recientes.find((m) => m.id === firmada.medida.id) ?? firmada.medida) : null;
  const claveFirmada = firmada ? `${firmada.medida.id}-${firmada.n}` : "";
  const cerrarFirmada = () => {
    if (firmada) setDescartadas((previas) => new Set([...previas, firmada.medida.id]));
    setFirmada(null);
  };
  const hayBarra = Boolean(activa) && !finalizado;

  return (
    <div className="min-h-dvh">
      <Cabecera
        estado={cola?.estado ?? null}
        yo={yo}
        deTurno={deTurno}
        enCola={finalizado ? 0 : pendientes.length}
        silencio={silencio}
        alSilenciar={alternarSilencio}
      />
      <Cortes estado={cola?.estado ?? null} sinServidor={sinServidor} />

      {!cola ? (
        <Cargando texto={error && error.codigo !== 0 ? error.message : "Cargando la cola…"} />
      ) : (
        <main
          className={`mx-auto w-full max-w-[1180px] px-3 pt-3 xs:px-4 lg:grid lg:grid-cols-[minmax(0,620px)_minmax(0,1fr)] lg:gap-10 lg:px-6 lg:pt-6 ${
            hayBarra ? "pb-[calc(env(safe-area-inset-bottom)+132px)]" : "pb-10"
          }`}
        >
          <div className="min-w-0">
            {nota && (
              <p role="status" className="m-0 mb-3 animate-aparecer border-l-[3px] border-firma bg-firma-suave px-3 py-2.5 font-semibold leading-snug">
                {nota}
              </p>
            )}
            <AvisoTurno cola={cola} hayPendientes={pendientes.length > 0} />

            {medidaFirmada && (
              <div className="mb-4 lg:hidden">
                <Firmada key={claveFirmada} medida={medidaFirmada} replegada={pendientes.length > 0} alCerrar={cerrarFirmada} />
              </div>
            )}

            <TituloCola cola={cola} cantidad={pendientes.length} />

            {activa ? (
              <Tarjeta key={activa.id} medida={activa} posicion={pendientes.indexOf(activa) + 1} total={pendientes.length} />
            ) : (
              <ColaVacia estado={cola.estado} deTurno={deTurno} silencio={silencio} />
            )}

            {resto.length > 0 && (
              <section className="mt-5" aria-label="Siguen en la cola">
                <h2 className="m-0 mb-1 text-[1.0625rem] font-bold">Siguen en la cola</h2>
                <ul className="m-0 list-none p-0">
                  {resto.map((m) => (
                    <li key={m.id}>
                      <button
                        type="button"
                        onClick={() => {
                          setElegida(m.id);
                          window.scrollTo({ top: 0, behavior: "smooth" });
                        }}
                        className="grid min-h-[60px] w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 border-0 border-t border-regla bg-transparent px-1 py-2 text-left text-tinta hover:bg-papel"
                      >
                        <span className="min-w-0">
                          <span className="block text-[0.8125rem] font-medium text-tinta-2">
                            {CLASE[m.clase]}
                            {m.simulacro ? ", simulacro" : ""}
                          </span>
                          <span className="block truncate font-bold">{objetivoDe(m)}</span>
                        </span>
                        <span className="flex flex-col items-end gap-1">
                          <LucesBreves items={m.verificaciones} />
                          <Espera medida={m} className="text-[0.8125rem] text-tinta-2" />
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>

          <aside className="mt-8 min-w-0 lg:mt-0">
            {medidaFirmada && (
              <div className="mb-6 hidden lg:block">
                <Firmada key={claveFirmada} medida={medidaFirmada} replegada={false} alCerrar={cerrarFirmada} />
              </div>
            )}
            <Recientes
              medidas={cola.recientes}
              puedeReconsiderar={deTurno && !finalizado && !enVuelo}
              enVuelo={enVuelo?.accion === "reconsiderar" ? enVuelo.id : null}
              alReconsiderar={(m) => void reconsiderar(m)}
            />
            <p className="m-0 mt-8 text-[0.8125rem] leading-snug text-tinta-3">
              Jueces, juzgados, proveedores y dominios son ficticios: los provee el simulador del Desafío Fútbol.{" "}
              <Link to="/transparencia" className="enlace">
                Registro público de bloqueos
              </Link>
            </p>
          </aside>
        </main>
      )}

      {aviso && (
        <div
          role="alert"
          className={`fixed inset-x-0 z-40 px-3 ${hayBarra ? "bottom-[calc(env(safe-area-inset-bottom)+124px)]" : "bottom-[calc(env(safe-area-inset-bottom)+16px)]"}`}
        >
          <div className="mx-auto flex max-w-[620px] animate-subir items-center gap-3 rounded-[8px] bg-tinta py-2 pl-4 pr-2 text-papel shadow-[0_6px_24px_rgba(19,23,34,0.35)]">
            <p className="m-0 min-w-0 flex-1 font-semibold leading-snug">{aviso.texto}</p>
            {aviso.reintentar && (
              <button
                type="button"
                className="boton boton-chico flex-none border-papel bg-papel text-tinta"
                onClick={() => {
                  const otraVez = aviso.reintentar!;
                  setAviso(null);
                  otraVez();
                }}
              >
                Reintentar
              </button>
            )}
            <button type="button" aria-label="Cerrar el aviso" className="grid size-11 flex-none place-items-center border-0 bg-transparent text-papel" onClick={() => setAviso(null)}>
              <IconoCerrar />
            </button>
          </div>
        </div>
      )}

      {cola && activa && hayBarra && (
        <BarraAcciones
          medida={activa}
          estado={cola.estado}
          deTurno={deTurno}
          armada={armada}
          habilitada={puedeDecidir}
          firmando={enVuelo?.accion === "firmar"}
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

// --- cabecera ------------------------------------------------------------------------------------

function Cabecera(p: { estado: EstadoDTO | null; yo: UsuarioDTO | null; deTurno: boolean; enCola: number; silencio: boolean; alSilenciar: () => void }) {
  return (
    <header className="sticky top-0 z-30 border-b-2 border-tinta bg-papel">
      <div className="mx-auto flex max-w-[1180px] items-center gap-2 px-3 pt-2 xs:px-4 lg:px-6">
        <Marca className="text-[1.5rem]" />
        {p.estado?.simulacro && (
          <span className="rayado-suave ml-1 rounded-[3px] px-1.5 py-0.5 text-[0.75rem] font-bold" title="El servidor corre con el simulacro de reclamos activado">
            Simulacro
          </span>
        )}
        <div className="flex-1" />
        {p.estado && (
          <p className="m-0 flex items-baseline gap-1.5 leading-none" title={p.estado.partido?.nombre ?? undefined}>
            <span className="text-[0.8125rem] font-medium text-tinta-2">{p.estado.finalizado ? "Final" : "Minuto"}</span>
            <RelojPartido estado={p.estado} className="angosta min-w-[4.2ch] text-right text-[1.875rem] font-extrabold" />
          </p>
        )}
        <button
          type="button"
          onClick={p.alSilenciar}
          aria-pressed={p.silencio}
          aria-label={p.silencio ? "Activar el silbato de aviso" : "Silenciar el silbato de aviso"}
          title={p.silencio ? "Silbato apagado" : "Silbato encendido"}
          className={`ml-1 grid size-12 flex-none place-items-center rounded-[6px] border-0 bg-transparent ${p.silencio ? "text-tinta-3" : "text-tinta"}`}
        >
          {p.silencio ? <IconoSilencio /> : <IconoSonido />}
        </button>
        <button type="button" onClick={() => void salir()} aria-label="Cerrar sesión" title="Cerrar sesión" className="-mr-2 grid size-12 flex-none place-items-center rounded-[6px] border-0 bg-transparent text-tinta">
          <IconoSalir />
        </button>
      </div>
      <div className="mx-auto flex max-w-[1180px] items-center gap-2.5 px-3 pb-2 xs:px-4 lg:px-6">
        {p.yo && (
          <>
            <span
              className={`flex-none whitespace-nowrap rounded-full px-2.5 py-[3px] text-[0.875rem] font-bold leading-tight ${
                p.deTurno ? "bg-firma text-sobre-firma" : "border-[1.5px] border-tinta text-tinta"
              }`}
            >
              {p.deTurno ? "De turno" : "Fuera de turno"}
            </span>
            <p className="m-0 min-w-0 truncate leading-tight">
              <span className="font-bold">{p.yo.nombre}</span>
              <span className="ml-2 hidden text-[0.875rem] text-tinta-2 xs:inline">{juzgadoBreve(p.yo.juzgado_nombre)}</span>
            </p>
            <div className="flex-1" />
            {p.enCola > 0 && (
              <span className="cifras flex-none whitespace-nowrap text-[0.9375rem] font-bold leading-tight lg:hidden" aria-hidden="true">
                {p.deTurno ? (p.enCola === 1 ? "1 espera firma" : `${p.enCola} esperan firma`) : `${p.enCola} en la cola`}
              </span>
            )}
            <Link to="/tablero" className="enlace hidden flex-none text-[0.9375rem] font-semibold lg:inline">
              Tablero
            </Link>
          </>
        )}
      </div>
    </header>
  );
}

// --- estados de la cola ----------------------------------------------------------------------------

function AvisoTurno({ cola, hayPendientes }: { cola: ColaDTO; hayPendientes: boolean }) {
  if (cola.yo.de_turno || cola.estado.finalizado) return null;
  const deTurno = cola.estado.jueces_de_turno;
  return (
    <div role="status" className="mb-4 flex items-stretch border-2 border-tinta bg-papel">
      <span aria-hidden="true" className="rayado w-4 flex-none" />
      <div className="px-3 py-2.5 leading-snug">
        <p className="m-0 text-[1.0625rem] font-extrabold">Estás fuera de turno: solo lectura</p>
        <p className="m-0 text-[0.9375rem] text-tinta-2">
          {deTurno.length > 0 ? `Firma ${deTurno.map((j) => j.nombre).join(", ")}.` : "Ahora no hay ningún juez de turno."}{" "}
          {hayPendientes ? "Podés leer la cola, pero no decidir." : ""}
        </p>
      </div>
    </div>
  );
}

function TituloCola({ cola, cantidad }: { cola: ColaDTO; cantidad: number }) {
  if (cola.estado.finalizado || cantidad === 0) return null;
  const texto = cola.yo.de_turno
    ? cantidad === 1
      ? "1 medida espera tu firma"
      : `${cantidad} medidas esperan tu firma`
    : plural(cantidad, "medida en la cola", "medidas en la cola");
  // En el celular la cuenta va en la cabecera, para que la tarjeta empiece más arriba.
  return <h1 className="sr-only m-0 text-[1.25rem] font-extrabold leading-tight lg:not-sr-only lg:mb-2">{texto}</h1>;
}

function ColaVacia({ estado, deTurno, silencio }: { estado: EstadoDTO; deTurno: boolean; silencio: boolean }) {
  if (estado.finalizado) {
    return (
      <section className="rounded-[10px] border border-regla bg-papel px-4 py-8">
        <h1 className="m-0 font-serif text-[1.5rem] font-semibold leading-tight">Terminó el partido.</h1>
        <p className="m-0 mt-2 text-tinta-2">Todas las órdenes vencieron con el final. No quedan medidas por decidir.</p>
      </section>
    );
  }
  return (
    <section className="rounded-[10px] border border-dashed border-tinta-3 px-4 py-8">
      <h1 className="m-0 font-serif text-[1.5rem] font-semibold leading-tight">No hay medidas pendientes.</h1>
      <p className="m-0 mt-2 text-tinta-2">
        {deTurno
          ? silencio
            ? "Las nuevas aparecen acá solas. El silbato está apagado."
            : "Las nuevas aparecen acá solas, con un silbato."
          : "Cuando entres de turno, las medidas pendientes aparecen acá."}
      </p>
    </section>
  );
}

/** Tiempo real que lleva esperando una medida. */
function Espera({ medida, className = "" }: { medida: MedidaDTO; className?: string }) {
  const ahora = useMinuto(500);
  const espera = Math.max(0, ahora - medida.creada_min);
  return (
    <span className={`cifras whitespace-nowrap ${className}`} title={`Presentada en el minuto ${minuto(medida.creada_min)}`}>
      espera {tiempoReal(espera, aceleracion())}
    </span>
  );
}

// --- la tarjeta ----------------------------------------------------------------------------------------

function Tarjeta({ medida: m, posicion, total }: { medida: MedidaDTO; posicion: number; total: number }) {
  const captura = m.evidencia.find((e) => e.captura_sha256);
  return (
    <article className="animate-aparecer overflow-hidden rounded-[10px] border border-tinta bg-papel" aria-label={`${CLASE[m.clase]}, expediente ${m.expediente_id}`}>
      {m.simulacro && <BandaSimulacro />}

      <header className="flex items-start justify-between gap-3 px-4 pt-3.5">
        <div className="min-w-0">
          <p className="m-0 text-[1.125rem] font-extrabold leading-tight">{CLASE[m.clase]}</p>
          <p className="m-0 mt-0.5 leading-tight">
            <Link to={`/expediente/${encodeURIComponent(m.expediente_id)}`} className="huella enlace text-[0.875rem]">
              {m.expediente_id}
            </Link>
          </p>
        </div>
        <div className="flex-none text-right leading-tight">
          <Espera medida={m} className="text-[0.9375rem] font-bold" />
          {total > 1 && (
            <p className="m-0 text-[0.8125rem] text-tinta-2">
              {posicion} de {total}
            </p>
          )}
        </div>
      </header>

      <p className="m-0 px-4 pb-3.5 pt-2 font-serif text-[1.4375rem] font-semibold leading-[1.2] tracking-[-0.005em] lg:text-[1.625rem]">{m.pedido}</p>

      {m.clase === "ampliacion" && (
        <div className="border-t border-regla bg-hundido">
          <QueCambio medida={m} />
        </div>
      )}
      {m.clase === "ratificacion" && (
        <div className="border-t border-regla bg-hundido">
          <MotivoRatificacion medida={m} />
        </div>
      )}
      {m.clase === "levantamiento" && (
        <div className="border-t border-regla bg-hundido">
          <DetalleReclamo medida={m} />
        </div>
      )}

      <Verificaciones items={m.verificaciones} resumida />
      <NoSeTocan medida={m} />

      <section className="border-t border-regla px-4 pb-1 pt-3">
        <h3 className="m-0 mb-1 text-[0.8125rem] font-medium text-tinta-2">
          {m.clase === "inicial" || m.clase === "ampliacion" ? "Qué bloquea cada proveedor, con su parte de los clientes" : "A qué proveedores se envía"}
        </h3>
        <PlanProveedores plan={m.plan} parcial={m.clase !== "inicial" && m.clase !== "ampliacion"} />
      </section>

      <dl className="m-0 grid grid-cols-2 gap-x-4 gap-y-3 border-t border-regla px-4 py-3 text-[0.9375rem] leading-snug">
        <Dato rotulo="Vence">
          Al final del partido <span className="cifras whitespace-nowrap text-tinta-2">(min {numero(m.vence_min)})</span>
        </Dato>
        <Dato rotulo="Huella de lo que firmás">
          <Huella valor={m.huella} />
        </Dato>
        <Dato rotulo="Dónde se promocionó">
          <Promocion items={m.promocion} />
        </Dato>
        <Dato rotulo="Evidencia">
          {plural(m.evidencia.length, "detección", "detecciones")}
          {captura ? (
            <span className="block text-tinta-2">
              captura <Huella valor={captura.captura_sha256} largo={10} />
            </span>
          ) : (
            <span className="block text-tinta-2">sin captura válida</span>
          )}
        </Dato>
      </dl>
    </article>
  );
}

// --- firmar y rechazar ------------------------------------------------------------------------------------

function BarraAcciones(p: {
  medida: MedidaDTO;
  estado: EstadoDTO;
  deTurno: boolean;
  armada: boolean;
  habilitada: boolean;
  firmando: boolean;
  alFirmar: () => void;
  alRechazar: () => void;
}) {
  const quien = p.estado.jueces_de_turno.map((j) => j.nombre).join(", ");
  return (
    <div className="fixed inset-x-0 bottom-0 z-30 border-t-2 border-tinta bg-papel pb-[env(safe-area-inset-bottom)]">
      <div className="mx-auto max-w-[1180px] px-3 xs:px-4 lg:px-6">
        <div className="lg:max-w-[620px]">
          <p className="m-0 truncate pt-2 text-[0.875rem] leading-tight text-tinta-2">
            {p.deTurno ? (
              <>
                {CLASE[p.medida.clase]}: <span className="font-semibold text-tinta">{objetivoDe(p.medida)}</span>
              </>
            ) : (
              <span className="font-semibold text-tinta">{quien ? `Solo firma ${quien}.` : "No hay juez de turno."}</span>
            )}
          </p>
          <div className="flex gap-2.5 pb-3 pt-2">
            <button type="button" className="boton h-[60px] w-[34%] flex-none text-[1.0625rem]" disabled={!p.habilitada} onClick={p.alRechazar}>
              Rechazar
            </button>
            <button
              type="button"
              className="boton boton-firma relative h-[60px] min-w-0 flex-1 overflow-hidden text-[1.1875rem]"
              disabled={!p.habilitada}
              onClick={p.alFirmar}
            >
              {p.deTurno && !p.armada && !p.firmando && (
                <span aria-hidden="true" className="absolute inset-y-0 left-0 w-full origin-left animate-llenar bg-firma opacity-25" style={{ animationDuration: `${ARMADO_MS}ms` }} />
              )}
              <span className="relative">{p.firmando ? "Firmando…" : "Firmar y ordenar"}</span>
              {!p.firmando && (
                <kbd className="relative hidden rounded-[4px] border border-current px-1.5 py-0.5 font-sans text-[0.75rem] font-semibold opacity-80 lg:inline">Enter</kbd>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// --- después de firmar -------------------------------------------------------------------------------------

/** La medida recién firmada: el sello y cada proveedor confirmando en vivo. */
function Firmada({ medida: m, replegada, alCerrar }: { medida: MedidaDTO; replegada: boolean; alCerrar: () => void }) {
  const [abierta, setAbierta] = useState<boolean | null>(null);
  const filas = filasDespacho(m);
  const amplia = abierta ?? !replegada;
  const juez = m.decision?.juez_nombre;
  // Una medida nueva va a todos los proveedores y se mide en clientes cubiertos;
  // una ratificación o un reclamo van a algunos, y se cuentan proveedores.
  const aTodos = m.clase === "inicial" || m.clase === "ampliacion";
  const cobertura = coberturaDe(filas);
  const { aplicadas, total } = aplicadasDe(filas);
  const avance = aTodos ? `${numero(cobertura, cobertura > 0 && cobertura < 100 ? 1 : 0)} %` : `${aplicadas} de ${total}`;

  if (!amplia) {
    return (
      <button
        type="button"
        onClick={() => setAbierta(true)}
        className="grid min-h-[56px] w-full animate-aparecer grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 rounded-[10px] border-2 border-firma bg-papel px-3 py-2 text-left text-tinta"
        aria-label="Ver el estado de la medida recién firmada"
      >
        <span className="min-w-0">
          <span className="block truncate text-[0.875rem] leading-tight">
            <span className="font-bold text-firma">Firmada</span> <span className="font-semibold">{objetivoDe(m)}</span>
          </span>
          <BarraCobertura filas={filas} className="mt-1.5 !h-2" />
        </span>
        <span className="angosta cifras text-[1.375rem] font-extrabold leading-none">{avance}</span>
      </button>
    );
  }

  return (
    <section className="rounded-[10px] border-2 border-firma bg-papel px-4 pb-2 pt-4" aria-label="Medida recién firmada">
      <div className="flex items-start justify-between gap-3">
        <div className="sello animate-sellar">
          <span className="text-[0.8125rem] font-bold">Firmado y ordenado</span>
          <span className="font-serif text-[1.1875rem] font-semibold italic">{juez ?? "Juez de turno"}</span>
          <span className="huella">
            {m.decision?.minuto != null ? `min ${minuto(m.decision.minuto)} ` : ""}
            {m.huella.slice(0, 16)}
          </span>
        </div>
        <button type="button" aria-label="Ocultar la medida firmada" className="-mr-2 -mt-2 grid size-11 flex-none place-items-center border-0 bg-transparent text-tinta-2" onClick={alCerrar}>
          <IconoCerrar />
        </button>
      </div>
      <p className="m-0 mt-3 leading-snug">
        <span className="text-[0.8125rem] font-medium text-tinta-2">{CLASE[m.clase]}</span>
        <span className="block wrap-anywhere font-bold">{objetivoDe(m)}</span>
      </p>
      <div className="mt-3">
        {!aTodos && total > 0 && (
          <p className="m-0 mb-2 flex items-baseline justify-between gap-3">
            <span className="text-[0.9375rem] text-tinta-2">Proveedores que ya la aplicaron</span>
            <span className="angosta cifras text-[1.75rem] font-extrabold leading-none">{avance}</span>
          </p>
        )}
        <DespachoAmplio medida={m} conCobertura={aTodos} saliendo />
      </div>
      {replegada && (
        <button type="button" className="enlace mb-1 min-h-[40px] border-0 bg-transparent p-0 text-[0.9375rem] font-semibold" onClick={() => setAbierta(false)}>
          Replegar
        </button>
      )}
    </section>
  );
}

function Recientes(p: { medidas: MedidaDTO[]; puedeReconsiderar: boolean; enVuelo: string | null; alReconsiderar: (m: MedidaDTO) => void }) {
  if (p.medidas.length === 0) return null;
  return (
    <section aria-label="Medidas decididas">
      <h2 className="m-0 text-[1.0625rem] font-bold">Decididas</h2>
      <ul className="m-0 mt-1 list-none p-0">
        {p.medidas.map((m) => {
          const d = m.decision;
          return (
            <li key={m.id} className="border-t border-regla py-3">
              <div className="flex items-baseline justify-between gap-3">
                <p className="m-0 min-w-0 leading-tight">
                  <span className={`font-extrabold ${m.estado === "aprobada" ? "text-firma" : m.estado === "sin_efecto" ? "text-tinta-2" : "text-tinta"}`}>
                    {ESTADO_MEDIDA[m.estado]}
                  </span>
                  <span className="ml-2 text-[0.875rem] text-tinta-2">{CLASE[m.clase]}</span>
                </p>
                <Link to={`/expediente/${encodeURIComponent(m.expediente_id)}`} className="huella enlace flex-none text-[0.8125rem]">
                  {m.expediente_id}
                </Link>
              </div>
              <p className="m-0 mt-0.5 wrap-anywhere font-semibold leading-snug">{objetivoDe(m)}</p>
              <p className="m-0 text-[0.8125rem] leading-snug text-tinta-2">
                {[[d?.juez_nombre, d?.minuto != null ? `min ${minuto(d.minuto)}` : null].filter(Boolean).join(", "), d?.motivo].filter(Boolean).join(". ")}
              </p>
              {m.estado === "aprobada" && <DespachoCompacto medida={m} className="mt-2" />}
              {m.estado === "rechazada" && (
                <button type="button" className="boton boton-chico mt-2" disabled={!p.puedeReconsiderar} onClick={() => p.alReconsiderar(m)}>
                  {p.enVuelo === m.id ? "Reabriendo…" : "Reconsiderar"}
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
