// El expediente completo de una filtración, legible para un juez y pensado para imprimirse.

import type { ReactNode } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import type { ExpedienteDTO, MedidaDTO, OrdenDTO } from "../../compartido/tipos.ts";
import { Cargando, Cortes, IconoImprimir, IconoVolver, Marca, Objetivo, useTema, useTitulo } from "../componentes/comunes.tsx";
import { BandaSimulacro, DetalleReclamo, MotivoRatificacion, NoSeTocan, PlanProveedores, Promocion, QueCambio, Verificaciones } from "../componentes/Medida.tsx";
import {
  CLASE,
  ESTADO_EXPEDIENTE,
  ESTADO_MEDIDA,
  ESTADO_ORDEN,
  TIPO,
  type TonoEstado,
  fechaHoraLocal,
  horaLocal,
  minuto,
  numero,
  plural,
  sinFicticio,
} from "../nucleo/formato.ts";
import { inicioDe, useSesion } from "../nucleo/sesion.ts";
import { useVivo } from "../nucleo/vivo.ts";

const TEXTO_TONO: Record<TonoEstado, string> = {
  verde: "text-verde",
  ambar: "text-ambar",
  roja: "text-roja",
  neutro: "text-tinta-2",
  vacio: "text-tinta-2",
};

export function Expediente() {
  useTema("papel");
  const { id = "" } = useParams();
  useTitulo(`Offside · ${id}`);
  const sesion = useSesion();
  const navegar = useNavigate();
  const { datos: e, error, sinServidor } = useVivo<ExpedienteDTO>(id ? `/api/expedientes/${encodeURIComponent(id)}` : null);

  const inicio = sesion ? inicioDe(sesion.usuario.rol) : "/";
  const volver = () => {
    // Si se llegó desde otra pantalla de Offside se vuelve a ella; si no, al inicio del rol.
    const hayHistorial = (window.history.state as { idx?: number } | null)?.idx;
    if (hayHistorial && hayHistorial > 0) navegar(-1);
    else navegar(inicio);
  };

  return (
    <div className="min-h-dvh pb-12">
      <div className="no-imprimir sticky top-0 z-20 border-b-2 border-tinta bg-papel">
        <div className="mx-auto flex max-w-[980px] items-center gap-2 px-3 py-2 sm:px-6">
          <button type="button" className="boton boton-chico boton-plano -ml-2" onClick={volver}>
            <IconoVolver tam={20} /> Volver
          </button>
          <div className="flex-1" />
          <button type="button" className="boton boton-chico" onClick={() => window.print()} disabled={!e}>
            <IconoImprimir tam={20} /> Imprimir
          </button>
        </div>
      </div>
      <div className="no-imprimir">
        <Cortes estado={null} sinServidor={sinServidor} />
      </div>

      {!e ? (
        error && error.codigo === 404 ? (
          <div className="mx-auto max-w-[980px] px-4 py-16">
            <h1 className="m-0 font-serif text-[1.75rem] font-semibold">El expediente {id} no existe.</h1>
            <p className="mt-3">
              <Link to={inicio} className="enlace font-semibold">
                Volver al inicio
              </Link>
            </p>
          </div>
        ) : (
          <Cargando texto={error && error.codigo !== 0 ? error.message : "Cargando el expediente…"} />
        )
      ) : (
        <Hoja e={e} />
      )}
    </div>
  );
}

function Hoja({ e }: { e: ExpedienteDTO }) {
  return (
    <article className="hoja mx-auto mt-4 max-w-[980px] border border-regla bg-papel px-4 py-8 sm:mt-8 sm:px-12 sm:py-12">
      <header className="border-b-2 border-tinta pb-5">
        <div className="flex items-baseline justify-between gap-4">
          <Marca className="text-[1.375rem]" />
          <p className="m-0 text-[0.9375rem] text-tinta-2">Expediente de medida de bloqueo</p>
        </div>
        <h1 className="m-0 mt-5 font-mono text-[1.75rem] font-semibold leading-tight sm:text-[2.25rem]">{e.id}</h1>
        <dl className="m-0 mt-4 grid gap-x-8 gap-y-2.5 text-[1rem] leading-snug sm:grid-cols-2">
          <Campo rotulo="Partido">{e.partido?.nombre ?? "Sin datos"}</Campo>
          <Campo rotulo="Titular de derechos">{e.partido?.titular_derechos ?? "Sin datos"}</Campo>
          <Campo rotulo="Estado">
            {ESTADO_EXPEDIENTE[e.estado]}. Abierto en el minuto {minuto(e.abierto_min)}.
          </Campo>
          <Campo rotulo="Contenido">
            {plural(e.servidores.length, "servidor", "servidores")}, {plural(e.medidas.length, "medida", "medidas")}, {plural(e.detecciones.length, "detección", "detecciones")}
          </Campo>
        </dl>
      </header>

      <Seccion titulo="La filtración">
        <p className="m-0 font-mono text-[1.25rem] font-semibold leading-tight sm:text-[1.5rem]">{e.marca}</p>
        <p className="m-0 mt-2 max-w-[68ch] font-serif text-[1.0625rem] leading-[1.55]">
          Es la marca de agua extraída de la señal retransmitida. Lleva el prefijo <span className="huella">{e.prefijo}</span>
          {e.origen_prefijo ? ` (${e.origen_prefijo})` : ""}. Todas las detecciones de este expediente llevan esa misma marca: se tratan como una sola
          filtración aunque el sitio cambie de servidor, y cada servidor nuevo es una ampliación.
        </p>
      </Seccion>

      <Seccion titulo="Servidores" nota="En el orden en que aparecieron. Los tiempos son minutos de partido.">
        <Tabla
          columnas={["N.º", "Servidor", "Primera detección", "Medida", "Clientes cubiertos"]}
          filas={e.servidores.map((s, i) => ({
            celdas: [
              <span key="n" className="cifras">
                {i + 1}
              </span>,
              <span key="s">
                <span className="font-semibold wrap-anywhere">{s.host}</span>
                <span className="block text-[0.8125rem] text-tinta-2">
                  <Objetivo valor={s.ip} /> {s.asn != null ? `AS${s.asn} ` : ""}
                  {sinFicticio(s.organizacion)}
                </span>
              </span>,
              <span key="p" className="cifras whitespace-nowrap">
                Minuto {minuto(s.primera_deteccion_min)}
                <span className="block text-[0.8125rem] text-tinta-2">{plural(s.detecciones, "detección", "detecciones")}</span>
              </span>,
              s.medida_id ? (
                <span key="m" className="whitespace-nowrap">
                  Bloqueo por {s.tipo_recomendado === "ip" ? "IP" : "dominio"}
                  <span className="block text-[0.8125rem] text-tinta-2">
                    <a href={`#${s.medida_id}`} className="huella enlace">
                      {s.medida_id}
                    </a>{" "}
                    {s.medida_estado ? ESTADO_MEDIDA[s.medida_estado].toLowerCase() : ""}
                  </span>
                </span>
              ) : (
                "Sin medida"
              ),
              <span key="c" className="cifras whitespace-nowrap">
                {numero(s.cobertura_pct, s.cobertura_pct % 1 === 0 ? 0 : 1)} %
                <span className="block text-[0.8125rem] text-tinta-2">
                  {s.primer_bloqueo_min != null ? `primer bloqueo a los ${numero(s.primer_bloqueo_min, 1)} min` : "sin bloqueo aplicado"}
                </span>
              </span>,
            ],
            pie:
              s.terceros.length > 0 ? (
                <>
                  <span className="font-semibold text-tinta">
                    {s.tipo_recomendado === "dominio" ? "Sitios ajenos en la misma IP, que no se tocan: " : "Sitios ajenos en la misma IP: "}
                  </span>
                  {s.terceros.join(", ")}
                </>
              ) : undefined,
          }))}
        />
      </Seccion>

      <Seccion titulo="Medidas" nota="Cada medida es una decisión del juez de turno sobre un servidor.">
        <div className="grid gap-8">
          {e.medidas.map((m) => (
            <Medida key={m.id} m={m} />
          ))}
        </div>
      </Seccion>

      <Seccion titulo="Detecciones" nota="Lo que llegó del feed, con el SHA-256 de cada registro y de su captura.">
        <Tabla
          columnas={["Detección", "Minuto", "Servidor", "Recibida"]}
          filas={e.detecciones.map((d) => ({
            celdas: [
              <span key="i" className="huella font-semibold">
                {d.id}
              </span>,
              <span key="m" className="cifras">
                {minuto(d.minuto)}
              </span>,
              <span key="s">
                <span className="wrap-anywhere">{d.host}</span> <Objetivo valor={d.ip} className="text-tinta-2" />
              </span>,
              <span key="r" className="cifras whitespace-nowrap">
                Minuto {minuto(d.recibida_min)} <span className="text-tinta-2">({horaLocal(d.recibida_iso)})</span>
              </span>,
            ],
            pie: (
              <span className="grid gap-x-3 sm:grid-cols-[4.2rem_minmax(0,1fr)]">
                <span>Registro</span>
                <span className="huella">{d.sha256}</span>
                <span>Captura</span>
                <span>
                  {d.captura_sha256 ? <span className="huella">{d.captura_sha256}</span> : "sin captura"}
                  {d.captura_sha256 && !d.formato_ok ? <span className="ml-2 font-semibold text-tinta">formato inesperado</span> : null}
                </span>
              </span>
            ),
          }))}
        />
      </Seccion>

      <Seccion titulo="Aviso al titular" nota="Para cortar la fuente de la filtración, que es lo único que el operador no esquiva cambiando de servidor.">
        <div className="no-cortar max-w-[72ch] whitespace-pre-line border-l-[3px] border-tinta bg-hundido px-5 py-4 font-serif text-[1.0625rem] leading-[1.55]">{e.aviso_titular}</div>
      </Seccion>

      <Seccion titulo="Registro de auditoría" nota="Cada entrada lleva el hash de la anterior: alterar una rompe la cadena desde ahí.">
        <Tabla
          columnas={["N.º", "Minuto", "Hora", "Quién", "Qué pasó"]}
          filas={e.auditoria.map((a) => ({
            celdas: [
              <span key="n" className="cifras">
                {a.seq}
              </span>,
              <span key="m" className="cifras">
                {a.minuto == null ? "—" : minuto(a.minuto)}
              </span>,
              <span key="h" className="cifras whitespace-nowrap">
                {horaLocal(a.hora_iso)}
              </span>,
              <span key="a" className="wrap-anywhere">
                {a.actor}
              </span>,
              a.resumen,
            ],
            pie: <span className="huella">{a.hash}</span>,
          }))}
        />
      </Seccion>

      <footer className="mt-10 border-t border-regla pt-4 text-[0.8125rem] leading-snug text-tinta-2">
        Generado por Offside el {fechaHoraLocal(new Date().toISOString())}. Jueces, juzgados, proveedores y dominios son ficticios: los provee el simulador del
        Desafío Fútbol. Las firmas son las de demostración del simulador.
      </footer>
    </article>
  );
}

function Medida({ m }: { m: MedidaDTO }) {
  return (
    <section id={m.id} className="min-w-0 scroll-mt-20 border border-tinta" aria-label={`Medida ${m.id}`}>
      {m.simulacro && <BandaSimulacro />}
      <header className="no-cortar px-4 pt-3.5">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <h3 className="m-0 text-[1.1875rem] font-extrabold leading-tight">
            {CLASE[m.clase]} <span className="huella ml-1 font-semibold text-tinta-2">{m.id}</span>
          </h3>
          <p className="cifras m-0 text-[0.9375rem] text-tinta-2">
            Presentada en el minuto {minuto(m.creada_min)}. {ESTADO_MEDIDA[m.estado]}.
          </p>
        </div>
        <p className="m-0 pb-4 pt-2 font-serif text-[1.3125rem] font-semibold leading-[1.25]">{m.pedido}</p>
      </header>

      {m.clase === "ampliacion" && (
        <div className="no-cortar border-t border-regla bg-hundido">
          <QueCambio medida={m} />
        </div>
      )}
      {m.clase === "ratificacion" && (
        <div className="no-cortar border-t border-regla bg-hundido">
          <MotivoRatificacion medida={m} />
        </div>
      )}
      {m.clase === "levantamiento" && (
        <div className="no-cortar border-t border-regla bg-hundido">
          <DetalleReclamo medida={m} />
        </div>
      )}

      <div className="no-cortar">
        <Verificaciones items={m.verificaciones} compacta />
      </div>
      <div className="no-cortar">
        <NoSeTocan medida={m} />
      </div>

      <div className="grid gap-x-8 border-t border-regla px-4 py-3 sm:grid-cols-2">
        <div className="no-cortar min-w-0">
          <h4 className="m-0 mb-1 text-[0.8125rem] font-medium text-tinta-2">
            {m.clase === "inicial" || m.clase === "ampliacion" ? "Qué bloquea cada proveedor, con su parte de los clientes" : "A qué proveedores se envía"}
          </h4>
          <PlanProveedores plan={m.plan} parcial={m.clase !== "inicial" && m.clase !== "ampliacion"} />
        </div>
        <dl className="no-cortar m-0 mt-4 grid content-start gap-y-2.5 text-[0.9375rem] leading-snug sm:mt-0">
          <Campo rotulo="Vence">Al final del partido (minuto {numero(m.vence_min)})</Campo>
          <Campo rotulo="Dónde se promocionó">
            <Promocion items={m.promocion} />
          </Campo>
        </dl>
      </div>

      <div className="no-cortar border-t border-regla px-4 py-3">
        <h4 className="m-0 text-[0.8125rem] font-medium text-tinta-2">Huella: SHA-256 de lo que vio el juez al decidir. Los primeros 16 caracteres viajan en cada orden.</h4>
        <p className="m-0 mt-1 break-all font-mono text-[0.9375rem] font-semibold leading-snug">{m.huella}</p>
      </div>

      {m.evidencia.length > 0 && (
        <div className="border-t border-regla px-4 py-3">
          <h4 className="m-0 mb-1.5 text-[0.8125rem] font-medium text-tinta-2">Evidencia congelada con la medida</h4>
          <ul className="m-0 grid list-none gap-3 p-0">
            {m.evidencia.map((ev) => (
              <li key={ev.deteccion_id} className="no-cortar grid gap-x-6 gap-y-1 text-[0.9375rem] leading-snug sm:grid-cols-[7rem_minmax(0,1fr)]">
                <p className="m-0">
                  <span className="huella font-semibold">{ev.deteccion_id}</span>
                  <span className="cifras block text-[0.8125rem] text-tinta-2">minuto {minuto(ev.minuto)}</span>
                </p>
                <dl className="m-0 grid gap-y-1">
                  <Renglon rotulo="Registro">
                    <span className="huella">{ev.deteccion_sha256}</span>
                  </Renglon>
                  <Renglon rotulo="Captura">
                    {ev.captura_sha256 ? (
                      <>
                        <span className="huella">{ev.captura_sha256}</span>{" "}
                        <span className="whitespace-nowrap text-[0.8125rem] text-tinta-2">{ev.formato_ok ? "formato correcto" : "formato inesperado"}</span>
                      </>
                    ) : (
                      "Sin captura válida"
                    )}
                  </Renglon>
                  {ev.pagina && (
                    <Renglon rotulo="Página">
                      <span className="huella">{ev.pagina}</span>
                    </Renglon>
                  )}
                  {ev.stream_url && (
                    <Renglon rotulo="Stream">
                      <span className="huella">{ev.stream_url}</span>
                    </Renglon>
                  )}
                </dl>
              </li>
            ))}
          </ul>
        </div>
      )}

      <Decision m={m} />

      {m.ordenes.length > 0 && (
        <div className="border-t border-regla px-4 py-3">
          <h4 className="m-0 mb-1 text-[0.8125rem] font-medium text-tinta-2">Órdenes enviadas a los proveedores. Los tiempos son minutos de partido.</h4>
          <Tabla densa columnas={["Proveedor", "Bloqueo", "Intento", "Estado", "Enviada", "Aplicada", "Cerrada"]} filas={m.ordenes.map((o) => filaOrden(o))} />
        </div>
      )}
    </section>
  );
}

function filaOrden(o: OrdenDTO): Fila {
  const estado = ESTADO_ORDEN[o.estado];
  return {
    celdas: [
      <span key="p" className="font-semibold">
        {sinFicticio(o.proveedor_nombre)}
      </span>,
      <span key="b">
        {TIPO[o.tipo]} <Objetivo valor={o.objetivo} />
      </span>,
      <span key="i" className="cifras">
        {o.intento}
      </span>,
      <span key="e">
        <span className={`font-bold ${TEXTO_TONO[estado.tono]}`}>{estado.rotulo}</span>
        {o.error && <span className="block text-[0.8125rem] text-tinta-2">{o.error}</span>}
      </span>,
      <span key="en" className="cifras">
        {minuto(o.enviada_min)}
      </span>,
      <span key="ap" className="cifras">
        {minuto(o.aplicada_min)}
      </span>,
      <span key="fi" className="cifras">
        {minuto(o.finalizada_min)}
      </span>,
    ],
    pie: (
      <>
        Orden <span className="huella">{o.orden_id}</span>
      </>
    ),
  };
}

function Decision({ m }: { m: MedidaDTO }) {
  const d = m.decision;
  if (!d) {
    return (
      <div className="no-cortar border-t border-regla px-4 py-3">
        <h4 className="m-0 text-[0.8125rem] font-medium text-tinta-2">Decisión</h4>
        <p className="m-0 mt-1 font-semibold">Pendiente: espera al juez de turno.</p>
      </div>
    );
  }
  const aprobada = d.resultado === "aprobada";
  return (
    <div className="no-cortar border-t border-regla px-4 pb-4 pt-3">
      <h4 className="m-0 text-[0.8125rem] font-medium text-tinta-2">Decisión</h4>
      <div className="mt-2.5 flex flex-wrap items-center gap-x-8 gap-y-3">
        <div className={`sello ${aprobada ? "" : "sello-rechazo"}`}>
          <span className="text-[0.8125rem] font-bold">{aprobada ? "Firmado y ordenado" : d.resultado === "rechazada" ? "Rechazado" : "Sin efecto"}</span>
          <span className="font-serif text-[1.1875rem] font-semibold italic">{d.juez_nombre ?? "Sin intervención de un juez"}</span>
          <span className="huella">
            {d.minuto != null ? `min ${minuto(d.minuto)} ` : ""}
            {m.huella.slice(0, 16)}
          </span>
        </div>
        <dl className="m-0 grid gap-y-1 text-[0.9375rem] leading-snug">
          {d.juez_id && (
            <Renglon rotulo="Juez">
              <span className="huella">{d.juez_id}</span>
            </Renglon>
          )}
          <Renglon rotulo="Cuándo">
            {d.minuto != null ? `Minuto ${minuto(d.minuto)} del partido` : "Sin minuto"}
            {d.hora_iso ? `, ${fechaHoraLocal(d.hora_iso)}` : ""}
          </Renglon>
          {d.motivo && <Renglon rotulo="Motivo">{d.motivo}</Renglon>}
        </dl>
      </div>
    </div>
  );
}

// --- piezas del documento --------------------------------------------------------------------------

function Seccion({ titulo, nota, children }: { titulo: string; nota?: string; children: ReactNode }) {
  return (
    <section className="mt-9">
      <h2 className="m-0 text-[1.375rem] font-extrabold leading-tight">{titulo}</h2>
      {nota && <p className="m-0 mt-0.5 text-[0.9375rem] leading-snug text-tinta-2">{nota}</p>}
      <div className="mt-3">{children}</div>
    </section>
  );
}

function Campo({ rotulo, children }: { rotulo: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-[0.8125rem] font-medium text-tinta-2">{rotulo}</dt>
      <dd className="m-0 break-words">{children}</dd>
    </div>
  );
}

function Renglon({ rotulo, children }: { rotulo: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[4.2rem_minmax(0,1fr)] gap-x-2">
      <dt className="text-[0.8125rem] text-tinta-2">{rotulo}</dt>
      <dd className="m-0 min-w-0 break-words">{children}</dd>
    </div>
  );
}

interface Fila {
  celdas: ReactNode[];
  /** Renglón de ancho completo debajo de la fila: hashes e identificadores largos. */
  pie?: ReactNode;
}

function Tabla({ columnas, filas, densa = false }: { columnas: string[]; filas: Fila[]; densa?: boolean }) {
  if (filas.length === 0) return <p className="m-0 text-tinta-2">Sin registros.</p>;
  // En el celular cada fila se apila como una ficha (rótulo a la izquierda, valor a la derecha);
  // desde 640 px y al imprimir es una tabla común.
  return (
    <table className={`w-full border-collapse text-left leading-snug max-sm:block max-sm:border-t-2 max-sm:border-tinta ${densa ? "text-[0.875rem]" : "text-[0.9375rem]"}`}>
      <thead className="max-sm:hidden">
        <tr>
          {columnas.map((c) => (
            <th key={c} scope="col" className="border-b-2 border-tinta px-2 py-1.5 align-bottom text-[0.8125rem] font-semibold first:pl-0 last:pr-0">
              {c}
            </th>
          ))}
        </tr>
      </thead>
      {filas.map((fila, i) => (
        <tbody key={i} className="no-cortar border-b border-regla max-sm:block max-sm:py-2">
          <tr className="max-sm:block">
            {fila.celdas.map((celda, j) => (
              <td
                key={j}
                data-rotulo={columnas[j]}
                className={`px-2 pt-2 align-top first:pl-0 last:pr-0 max-sm:flex max-sm:justify-between max-sm:gap-4 max-sm:px-0 max-sm:py-0.5 max-sm:text-right max-sm:before:flex-none max-sm:before:text-left max-sm:before:text-[0.8125rem] max-sm:before:text-tinta-2 max-sm:before:content-[attr(data-rotulo)] ${
                  fila.pie ? "pb-0.5" : "pb-2"
                }`}
              >
                <span className="min-w-0">{celda}</span>
              </td>
            ))}
          </tr>
          {fila.pie && (
            <tr className="max-sm:block">
              <td colSpan={columnas.length} className="px-0 pb-2 text-[0.8125rem] leading-snug text-tinta-2 max-sm:block max-sm:pb-0 max-sm:pt-1">
                {fila.pie}
              </td>
            </tr>
          )}
        </tbody>
      ))}
    </table>
  );
}
