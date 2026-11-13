// El expediente completo, como foja: carátula, la escala del partido como columna
// vertebral, cada medida como un acto con su sello, y la cadena de auditoría.
// Pensado para que lo lea un juez en pantalla y para imprimirse en A4.

import { useLayoutEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import type { ExpedienteDTO, MedidaDTO, OrdenDTO, SalidaDTO } from "../../compartido/tipos.ts";
import { Cargando, Cortes, HashCompleto, IconoExportar, IconoImprimir, IconoVolver, Luz, Tilde, useFondo, useTitulo } from "../componentes/comunes.tsx";
import { MarcasRegla, TrazoFiltracion, fraccion, useAncho } from "../componentes/Escala.tsx";
import { DominioPartido, HostPartido, Levantamiento, OrdenId, Promocion, QueCambio, Ratificacion, Verificaciones } from "../componentes/Medida.tsx";
import {
  CLASE_ACTO,
  ESTADO_EXPEDIENTE,
  ESTADO_ORDEN,
  TIPO,
  enGrupos,
  fechaLocal,
  horaLocal,
  nombreProveedor,
  partidoBreve,
  reloj,
  sinFicticio,
} from "../nucleo/formato.ts";
import { inicioDe, useSesion } from "../nucleo/sesion.ts";
import { sincronizarReloj } from "../nucleo/reloj.ts";
import { useVivo } from "../nucleo/vivo.ts";

/** Pie de cada página impresa, con el número del expediente. */
function usePieImpreso(id: string): void {
  useLayoutEffect(() => {
    const estilo = document.createElement("style");
    const texto = `${id}. Verificable con herramientas/verificar_expediente.py.`.replace(/["\\]/g, "");
    estilo.textContent = `@page { @bottom-left { content: "${texto}"; font: 9pt "Archivo Variable", sans-serif; color: #5a5f69; } @bottom-right { content: counter(page) " de " counter(pages); font: 9pt "Archivo Variable", sans-serif; color: #5a5f69; } }`;
    document.head.appendChild(estilo);
    return () => estilo.remove();
  }, [id]);
}

function exportar(e: ExpedienteDTO): void {
  const blob = new Blob([JSON.stringify(e, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${e.id}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function Expediente() {
  useFondo("aluminio");
  const { id = "" } = useParams();
  useTitulo(`Offside, ${id}`);
  usePieImpreso(id);
  const sesion = useSesion();
  const navegar = useNavigate();
  const { datos: e, error, sinServidor } = useVivo<ExpedienteDTO>(id ? `/api/expedientes/${encodeURIComponent(id)}` : null, {
    alRecibir: (d) => {
      if (d.estado_general) sincronizarReloj(d.estado_general);
    },
  });

  const inicio = sesion ? inicioDe(sesion.usuario.rol) : "/";
  const volver = () => {
    const hayHistorial = (window.history.state as { idx?: number } | null)?.idx;
    if (hayHistorial && hayHistorial > 0) navegar(-1);
    else navegar(inicio === "/juez" ? "/juez" : "/tablero");
  };

  return (
    <div className="expediente">
      <div className="exp-barra no-imprimir">
        <button type="button" className="boton boton-porcelana boton-44" onClick={volver}>
          <IconoVolver tam={18} />
          <span>{inicio === "/juez" ? "Volver" : "Volver al tablero"}</span>
        </button>
        <span className="exp-barra-hueco" />
        <button type="button" className="boton boton-porcelana boton-44" onClick={() => window.print()} disabled={!e}>
          <IconoImprimir tam={18} />
          <span>Imprimir</span>
        </button>
        <button type="button" className="boton boton-porcelana boton-44" onClick={() => e && exportar(e)} disabled={!e}>
          <IconoExportar tam={18} />
          <span>Exportar</span>
        </button>
      </div>
      <div className="no-imprimir">
        <Cortes estado={e?.estado_general ?? null} sinServidor={sinServidor} />
      </div>
      {!e ? (
        <Cargando texto={error?.codigo === 404 ? `No existe el expediente ${id}.` : error && error.codigo !== 0 ? error.message : "Conectando con Offside…"} />
      ) : (
        <Foja e={e} />
      )}
    </div>
  );
}

/** Nombre legible de cada actor de la cadena, armado con los datos del propio expediente. */
function nombresDeActores(e: ExpedienteDTO): Map<string, string> {
  const nombres = new Map<string, string>([
    ["sistema", "Offside"],
    ["fiscalia", "Fiscalía"],
  ]);
  for (const m of e.medidas) {
    if (m.decision?.juez_id && m.decision.juez_nombre) nombres.set(m.decision.juez_id, sinFicticio(m.decision.juez_nombre));
    if (m.ratificacion?.juez_original_id && m.ratificacion.juez_original_nombre) {
      nombres.set(m.ratificacion.juez_original_id, sinFicticio(m.ratificacion.juez_original_nombre));
    }
    for (const o of m.ordenes) nombres.set(o.proveedor_id, nombreProveedor(o.proveedor_nombre));
    for (const p of m.plan) if (!nombres.has(p.proveedor_id)) nombres.set(p.proveedor_id, nombreProveedor(p.proveedor_nombre));
  }
  const general = e.estado_general;
  for (const j of general?.jueces_de_turno ?? []) if (!nombres.has(j.id)) nombres.set(j.id, sinFicticio(j.nombre));
  for (const t of general?.turnos ?? []) if (!nombres.has(t.juez_id)) nombres.set(t.juez_id, sinFicticio(t.nombre));
  return nombres;
}

function Foja({ e }: { e: ExpedienteDTO }) {
  const fin = e.estado_general?.fin_min ?? e.medidas[0]?.vence_min ?? 105;
  const ultima = e.auditoria[e.auditoria.length - 1];
  const actores = nombresDeActores(e);
  return (
    <article className="foja" aria-label={`Expediente ${e.id}`}>
      <header className="caratula">
        <p className="caratula-rotulo">Expediente</p>
        <h1 className="caratula-id num">{e.id}</h1>
        <dl className="caratula-datos">
          <div>
            <dt>Partido</dt>
            <dd>{partidoBreve(e.partido?.nombre) || "—"}</dd>
          </div>
          <div>
            <dt>Titular de derechos</dt>
            <dd>{sinFicticio(e.partido?.titular_derechos) || "—"}</dd>
          </div>
          <div>
            <dt>Marca de agua</dt>
            <dd className="huella">{e.marca}</dd>
          </div>
          <div>
            <dt>Prefijo y origen</dt>
            <dd>
              <span className="huella">{e.prefijo}</span>
              {e.origen_prefijo ? `, ${sinFicticio(e.origen_prefijo)}` : ""}
            </dd>
          </div>
          <div>
            <dt>Abierto</dt>
            <dd className="num">a los {reloj(e.abierto_min)} del partido</dd>
          </div>
          <div>
            <dt>Estado</dt>
            <dd>{ESTADO_EXPEDIENTE[e.estado]}</dd>
          </div>
        </dl>
      </header>

      <ColumnaVertebral e={e} fin={fin} />

      {e.medidas.map((m) => (
        <Acto key={m.id} m={m} />
      ))}

      <section className="foja-seccion">
        <h2 className="foja-titulo">Detecciones</h2>
        <div className="tabla-envoltura">
          <table className="tabla">
            <thead>
              <tr>
                <th>Detección</th>
                <th>Minuto</th>
                <th>Servidor</th>
                <th>SHA-256 de la detección</th>
                <th>SHA-256 de la captura</th>
              </tr>
            </thead>
            <tbody>
              {e.detecciones.map((d) => (
                <tr key={d.id}>
                  <td className="num">{d.id}</td>
                  <td className="num">{reloj(d.minuto)}</td>
                  <td>
                    {d.host}
                    <small className="num">{d.ip}</small>
                  </td>
                  <td className="huella tabla-hash">{enGrupos(d.sha256, 16)}</td>
                  <td className="huella tabla-hash">{d.captura_sha256 ? enGrupos(d.captura_sha256, 16) : "sin captura"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="foja-seccion">
        <h2 className="foja-titulo">Más allá de los proveedores</h2>
        <p className="foja-nota">
          Pedidos listos para enviar a quienes también pueden cortar la filtración: el titular de la señal, la CDN, el hosting y cada
          plataforma donde se promocionó el enlace. El simulador del desafío no modela a estos destinatarios: Offside los arma, pero no los
          envía.
        </p>
        <ol className="salidas">
          {e.salidas.map((s) => (
            <Salida key={s.id} s={s} expediente={e.id} />
          ))}
        </ol>
      </section>

      <section className="foja-seccion">
        <h2 className="foja-titulo">Cadena de auditoría</h2>
        <div className="tabla-envoltura">
          <table className="tabla tabla-auditoria">
            <thead>
              <tr>
                <th>Entrada</th>
                <th>Minuto</th>
                <th>Actor</th>
                <th>Qué pasó</th>
                <th>Hash</th>
              </tr>
            </thead>
            <tbody>
              {e.auditoria.map((a) => (
                <tr key={a.seq}>
                  <td className="num">{a.seq}</td>
                  <td className="num">{a.minuto != null ? reloj(a.minuto) : "—"}</td>
                  <td className="tabla-actor">{actores.get(a.actor) ?? sinFicticio(a.actor)}</td>
                  <td>{sinFicticio(a.resumen)}</td>
                  <td className="huella">{a.hash.slice(0, 8)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {ultima && (
          <div className="bloque-hash">
            <p>
              <b>Hash de la última entrada del expediente</b>
              <span className="num">entrada {ultima.seq}</span>
            </p>
            <HashCompleto valor={ultima.hash} />
          </div>
        )}
      </section>
    </article>
  );
}

/** La escala del partido a todo el ancho, con los servidores del expediente y cada medida colgada de su minuto. */
function ColumnaVertebral({ e, fin }: { e: ExpedienteDTO; fin: number }) {
  const [ref, ancho] = useAncho<HTMLDivElement>();
  const angosta = ancho > 0 && ancho < 420;
  const fila = 36;
  const general = e.estado_general;
  const registrado = Math.max(...e.medidas.map((m) => m.decision?.minuto ?? m.creada_min), ...e.detecciones.map((d) => d.minuto), e.abierto_min);
  // Si el partido sigue, la fuga llega hasta el minuto actual; si terminó, hasta el vencimiento.
  const ahora = general ? (general.finalizado ? fin : Math.min(Math.max(general.minuto, registrado), fin)) : registrado;
  const cerrado = !general && e.estado === "cerrado";
  return (
    <section className="foja-seccion columna" aria-label="El expediente sobre la escala del partido">
      <h2 className="foja-titulo">Recorrido de la filtración</h2>
      <div className="columna-grilla">
        <span />
        <div className="columna-regla">
          <MarcasRegla fin={fin} cada={angosta ? 30 : 15} />
        </div>
        <div className="columna-hosts">
          {e.servidores.map((s) => (
            <p key={s.id} style={{ height: fila }}>
              <span>
                <HostPartido texto={s.host} />
              </span>
              <small className="num">{s.ip}</small>
            </p>
          ))}
        </div>
        <div ref={ref} className="columna-escala" style={{ height: e.servidores.length * fila }}>
          <TrazoFiltracion servidores={e.servidores} g={{ ancho, fila, fin, ahora: cerrado ? fin : ahora }} sinAnimar />
          <span className="columna-vence" />
        </div>
        <span />
        <div className="columna-medidas">
          {e.medidas.map((m) => (
            <span key={m.id} className="columna-medida num" style={{ left: `${fraccion(m.creada_min, fin) * 100}%` }}>
              {m.id}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}

function Sello({ m, vencen = null }: { m: MedidaDTO; vencen?: number | null }) {
  const d = m.decision;
  if (!d) {
    return (
      <p className="sello sello-pendiente">
        <span>Espera la firma del juez de turno.</span>
      </p>
    );
  }
  const verbo = d.resultado === "aprobada" ? "Aprobada" : d.resultado === "rechazada" ? "Rechazada" : "Sin efecto";
  return (
    <div className="sello">
      <Tilde tam={18} />
      <p>
        {verbo}
        {d.juez_nombre ? ` por ${d.juez_nombre}` : ""}
        {d.minuto != null ? ` a los ${reloj(d.minuto)} del partido` : ""}
        {d.hora_iso ? ` (${horaLocal(d.hora_iso)}, hora local, ${fechaLocal(d.hora_iso)})` : ""}.
        {d.motivo && <small>Motivo: {sinFicticio(d.motivo)}</small>}
        {vencen != null && <small className="num">Las órdenes vencen a los {reloj(vencen)}.</small>}
      </p>
    </div>
  );
}

function EstadoOrden({ o }: { o: OrdenDTO }) {
  const e = ESTADO_ORDEN[o.estado];
  return (
    <span className="estado-orden" data-tinta={e.tinta}>
      <Luz tono={e.luz} />
      <span>
        {e.rotulo}
        {o.intento > 1 ? <small className="num">, intento {o.intento}</small> : null}
      </span>
    </span>
  );
}

function Acto({ m }: { m: MedidaDTO }) {
  const s = m.servidor;
  // Si todas las órdenes vencen en el mismo minuto, se dice una vez en el sello y no en cada fila.
  const vences = new Set(m.ordenes.map((o) => o.vence_min));
  const venceComun = m.ordenes.length > 0 && vences.size === 1 ? m.ordenes[0]!.vence_min : null;
  return (
    <section className="foja-seccion acto" aria-label={`${m.id}, ${CLASE_ACTO[m.clase]}`}>
      <header className="acto-cabeza">
        <h2>
          {m.id}, {CLASE_ACTO[m.clase]}
          {m.simulacro ? ", simulacro" : ""}
        </h2>
        <span className="num">minuto {reloj(m.creada_min)}</span>
      </header>
      <p className="acto-pedido">{sinFicticio(m.pedido)}</p>
      {s && (
        <p className="acto-servidor">
          {s.host}, <span className="num">{s.ip}</span>
          {s.asn != null ? `, AS${s.asn}` : ""}
          {s.organizacion ? ` ${sinFicticio(s.organizacion)}` : ""}
        </p>
      )}

      {m.clase === "ampliacion" && (
        <div className="grupo-hundido acto-grupo">
          <QueCambio medida={m} />
        </div>
      )}
      {m.clase === "ratificacion" && <Ratificacion medida={m} />}
      {m.clase === "levantamiento" && <Levantamiento medida={m} />}

      <Verificaciones items={m.verificaciones} />

      {m.evidencia.length > 0 && (
        <div className="tabla-envoltura">
          <table className="tabla tabla-evidencia">
            <thead>
              <tr>
                <th>Evidencia</th>
                <th>Minuto</th>
                <th>SHA-256 de la detección</th>
                <th>SHA-256 de la captura</th>
              </tr>
            </thead>
            <tbody>
              {m.evidencia.map((ev) => (
                <tr key={ev.deteccion_id}>
                  <td className="num">{ev.deteccion_id}</td>
                  <td className="num">{reloj(ev.minuto)}</td>
                  <td className="huella tabla-hash">{enGrupos(ev.deteccion_sha256)}</td>
                  <td className="huella tabla-hash">{ev.captura_sha256 ? enGrupos(ev.captura_sha256) : "sin captura"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Promocion items={m.promocion} />

      <div className="acto-firma">
        <div className="bloque-hash bloque-huella">
          <p>
            <b>Huella de lo que vio el juez</b>
            <span>viaja en cada orden</span>
          </p>
          <HashCompleto valor={m.huella} />
        </div>

        <Sello m={m} vencen={venceComun} />

        {m.ordenes.length > 0 && (
          <div className="tabla-envoltura">
            <table className="tabla tabla-ordenes">
              <thead>
                <tr>
                  <th>Proveedor</th>
                  <th>Objetivo</th>
                  <th>Orden</th>
                  <th>Estado</th>
                  <th>Enviada</th>
                  <th>Aplicada</th>
                  {venceComun == null && <th>Vence</th>}
                </tr>
              </thead>
              <tbody>
                {m.ordenes.map((o) => (
                  <tr key={o.orden_id}>
                    <td className="tabla-proveedor">{nombreProveedor(o.proveedor_nombre)}</td>
                    <td className="tabla-objetivo">
                      {TIPO[o.tipo]}{" "}
                      <span className="num">
                        <DominioPartido texto={o.objetivo} />
                      </span>
                    </td>
                    <td className="huella tabla-id">
                      <OrdenId id={o.orden_id} />
                    </td>
                    <td>
                      <EstadoOrden o={o} />
                    </td>
                    <td className="num">{o.enviada_min != null ? reloj(o.enviada_min) : "—"}</td>
                    <td className="num">{o.aplicada_min != null ? reloj(o.aplicada_min) : "—"}</td>
                    {venceComun == null && <td className="num">{reloj(o.vence_min)}</td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {m.ordenes.length === 0 && m.estado === "aprobada" && <p className="foja-nota">Todavía no salió ninguna orden.</p>}
      </div>
    </section>
  );
}

// --- salidas más allá de los proveedores -----------------------------------------------------------

const ESTADO_SALIDA: Record<SalidaDTO["estado"], string> = {
  lista: "Lista para enviar",
  espera_firma: "Espera la firma del juez",
  sin_orden: "Sin orden firmada",
};

function copiarTexto(texto: string): Promise<void> {
  if (navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(texto);
  // En la red local por http no hay portapapeles moderno: se copia a la vieja usanza.
  return new Promise((resolver, rechazar) => {
    const area = document.createElement("textarea");
    area.value = texto;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand("copy");
    area.remove();
    if (ok) resolver();
    else rechazar(new Error("No se pudo copiar"));
  });
}

function Salida({ s, expediente }: { s: SalidaDTO; expediente: string }) {
  const [copia, setCopia] = useState<"" | "ok" | "error">("");
  const copiar = () => {
    copiarTexto(s.texto)
      .then(() => setCopia("ok"))
      .catch(() => setCopia("error"))
      .finally(() => window.setTimeout(() => setCopia(""), 1800));
  };
  const descargar = () => {
    const url = URL.createObjectURL(new Blob([`${s.texto}\n`], { type: "text/plain;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `${expediente}-${s.id}.txt`;
    a.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  return (
    <li className="salida" data-tipo={s.tipo}>
      <div className="salida-cabeza">
        <p className="salida-destino">{s.destinatario}</p>
        <span className="salida-estado" data-estado={s.estado}>
          {ESTADO_SALIDA[s.estado]}
        </span>
      </div>
      <p className="salida-pedido">{s.pedido}</p>
      <div className="aviso-titular salida-texto">
        {s.texto.split("\n").map((l, i) => (l.trim() ? <p key={i}>{l}</p> : <span key={i} className="salida-hueco" aria-hidden="true" />))}
      </div>
      <div className="salida-acciones no-imprimir">
        <button type="button" className="boton-texto" onClick={copiar}>
          {copia === "ok" ? "Copiado" : copia === "error" ? "No se pudo copiar" : "Copiar el texto"}
        </button>
        <button type="button" className="boton-texto" onClick={descargar}>
          Descargar .txt
        </button>
      </div>
    </li>
  );
}
