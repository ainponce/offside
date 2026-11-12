// Las partes de una medida tal como las lee el juez: el pedido como titular, el
// recorrido de la filtración, qué cambió, las cuatro verificaciones y el plan.
// Los textos de fondo (pedido, títulos y detalles) vienen del servidor tal cual:
// son parte de la instantánea que cubre la huella.

import { Fragment, type ReactNode, useId, useState } from "react";
import type { MedidaDTO, PlanItemDTO, VerificacionDTO } from "../../compartido/tipos.ts";
import {
  ESTADO_PREVIO,
  TIPO,
  clientes,
  hostCorto,
  lista,
  minutoEntero,
  nombreProveedor,
  nombreRed,
  reloj,
  sinFicticio,
} from "../nucleo/formato.ts";
import { IconoChevron, Luz } from "./comunes.tsx";

/** Lo que se bloquea: la IP o el host según el tipo recomendado; en un reclamo, el dominio. */
export function objetivoDe(m: MedidaDTO): string {
  if (m.levantamiento) return m.levantamiento.dominio;
  if (!m.servidor) return m.expediente_id;
  return m.tipo_recomendado === "ip" ? m.servidor.ip : m.servidor.host;
}

/** Un host largo se corta después de cada punto o guion, nunca en medio de una palabra ni antes de la terminación (".test"). */
export function HostPartido({ texto }: { texto: string }) {
  const partes = texto.split(/(?<=[.-])/);
  if (partes.length > 1 && !partes[partes.length - 1]!.includes("-")) partes.splice(-2, 2, partes[partes.length - 2]! + partes[partes.length - 1]!);
  return (
    <>
      {partes.map((p, i) => (
        <Fragment key={i}>
          {p}
          {i < partes.length - 1 && <wbr />}
        </Fragment>
      ))}
    </>
  );
}

function conDestino(m: MedidaDTO): PlanItemDTO[] {
  return m.plan.filter((p) => p.tipo);
}

function proveedoresTexto(n: number, total: number): string {
  if (n === total) return n === 1 ? "en el único proveedor" : `en los ${n} proveedores`;
  return `en ${n} de los ${total} proveedores`;
}

/** El pedido como titular: verbo chico, objeto grande, cola chica. */
export function Titular({ medida: m }: { medida: MedidaDTO }) {
  if (m.clase === "ratificacion" || m.clase === "levantamiento") {
    const objeto = m.clase === "levantamiento" ? (m.levantamiento?.dominio ?? "") : (m.servidor?.host ?? "");
    return (
      <div className="titular">
        <p className="titular-objeto">
          <HostPartido texto={objeto} />
        </p>
        <p className="titular-cola">{sinFicticio(m.pedido)}</p>
      </div>
    );
  }
  const ip = m.tipo_recomendado === "ip";
  const verbo = ip ? "Bloquear la IP" : "Bloquear el dominio";
  const destino = conDestino(m).length;
  return (
    <div className="titular">
      <p className="titular-verbo">{m.clase === "ampliacion" ? `Misma filtración, servidor nuevo. ${verbo}` : verbo}</p>
      <p className="titular-objeto">{ip ? m.servidor?.ip : <HostPartido texto={m.servidor?.host ?? ""} />}</p>
      <p className="titular-cola">{`${proveedoresTexto(destino, m.plan.length)} hasta el final del partido.`}</p>
    </div>
  );
}

/** Banda del simulacro: la medida es el error forzado a propósito. */
export function AvisoSimulacro() {
  return (
    <div className="grupo-hundido aviso-simulacro" role="note">
      <p className="grupo-titulo">Simulacro: error forzado a propósito</p>
      <p className="grupo-detalle">Bloquea por IP una IP compartida para mostrar el reclamo de un sitio legítimo. No es una medida real.</p>
    </div>
  );
}

// --- ampliación ------------------------------------------------------------------------------

/** Recorrido de la filtración: un nodo por servidor, igual de separados (es una secuencia). */
export function Recorrido({ medida: m, minutos }: { medida: MedidaDTO; minutos: Map<string, number> }) {
  const previos = m.ampliacion?.servidores_previos ?? [];
  const todos = [...previos.map((s) => ({ host: s.host, actual: false })), { host: m.servidor?.host ?? "", actual: true }];
  const visibles = todos.slice(-3);
  const ocultos = todos.length - visibles.length;
  const minutoActual = m.evidencia[0]?.minuto ?? m.creada_min;
  return (
    <ol
      className="recorrido"
      aria-label="Recorrido de la filtración"
      data-mas={ocultos > 0 ? "" : undefined}
      style={{ gridTemplateColumns: `repeat(${visibles.length}, minmax(0, 1fr))` }}
    >
      {ocultos > 0 && (
        <li className="recorrido-mas" aria-label={`y ${ocultos} servidores antes`}>
          +{ocultos}
        </li>
      )}
      {visibles.map((s, i) => {
        const min = s.actual ? minutoActual : minutos.get(s.host);
        return (
          <li key={`${s.host}-${i}`} className="recorrido-paso" data-actual={s.actual ? "" : undefined}>
            <span className="recorrido-nodo" aria-hidden="true" />
            <span className="recorrido-host">{s.actual ? `${hostCorto(s.host)}, este` : hostCorto(s.host)}</span>
            {min != null && <span className="recorrido-min">minuto {minutoEntero(min)}</span>}
          </li>
        );
      })}
    </ol>
  );
}

/** Divide `nuevo` en lo que comparte con `previo` al principio y al final, y lo que cambió en el medio. */
function diferencia(previo: string, nuevo: string): [string, string, string] {
  let a = 0;
  while (a < previo.length && a < nuevo.length && previo[a] === nuevo[a]) a += 1;
  let z = 0;
  while (z < previo.length - a && z < nuevo.length - a && previo[previo.length - 1 - z] === nuevo[nuevo.length - 1 - z]) z += 1;
  return [nuevo.slice(0, a), nuevo.slice(a, nuevo.length - z), nuevo.slice(nuevo.length - z)];
}

function Cambio({ rotulo, previo, nuevo }: { rotulo: string; previo: string; nuevo: string }) {
  const [inicio, medio, fin] = diferencia(previo, nuevo);
  return (
    <div className="cambio-fila">
      <dt>{rotulo}</dt>
      <dd>
        <span className="cambio-nuevo">
          {inicio}
          {medio && <span className="cambio-marca">{medio}</span>}
          {fin}
        </span>
        <span className="cambio-previo">
          antes <s>{previo}</s>
        </span>
      </dd>
    </div>
  );
}

/** Qué cambió contra el último servidor de la misma filtración. */
export function QueCambio({ medida: m }: { medida: MedidaDTO }) {
  const previos = m.ampliacion?.servidores_previos ?? [];
  const ultimo = previos[previos.length - 1];
  if (!ultimo || !m.servidor) return null;
  const tipo = m.tipo_recomendado === "ip" ? "bloqueo por IP" : "bloqueo por dominio";
  return (
    <section className="que-cambio" aria-label="Qué cambió">
      <header className="grupo-cabeza">
        <span className="grupo-titulo-chico">Qué cambió</span>
        <span className="grupo-meta">
          contra {hostCorto(ultimo.host)}
          {ultimo.estado ? `, ${ESTADO_PREVIO[ultimo.estado] ?? ultimo.estado}` : ""}
        </span>
      </header>
      <dl>
        {ultimo.host !== m.servidor.host && <Cambio rotulo="Servidor" previo={ultimo.host} nuevo={m.servidor.host} />}
        {ultimo.ip !== m.servidor.ip && <Cambio rotulo="IP" previo={ultimo.ip} nuevo={m.servidor.ip} />}
      </dl>
      <p className="que-cambio-igual">
        <b>Igual:</b> marca, {tipo} y vencimiento.
      </p>
    </section>
  );
}

// --- verificaciones ----------------------------------------------------------------------------

/** Una fila: luz alineada con la primera línea del título y el detalle debajo. */
function FilaVerificacion({ v }: { v: VerificacionDTO }) {
  return (
    <li className="verif" data-luz={v.luz}>
      <Luz tono={v.luz} etiqueta={sinFicticio(v.titulo)} className="verif-luz" />
      <div>
        <p className="verif-titulo">{sinFicticio(v.titulo)}</p>
        {v.detalle && <p className="verif-detalle">{sinFicticio(v.detalle)}</p>}
      </div>
    </li>
  );
}

/**
 * Las cuatro verificaciones, siempre en el mismo orden. En una ampliación con las
 * cuatro en verde se resumen en una línea que se despliega.
 */
export function Verificaciones({ items, resumible = false }: { items: VerificacionDTO[]; resumible?: boolean }) {
  const [abiertas, setAbiertas] = useState(false);
  const id = useId();
  const todasVerdes = items.length > 0 && items.every((v) => v.luz === "verde");
  if (resumible && todasVerdes) {
    return (
      <div className="verifs verifs-resumen">
        <button type="button" className="verifs-linea" aria-expanded={abiertas} aria-controls={id} onClick={() => setAbiertas((a) => !a)}>
          <span className="verifs-luces" aria-hidden="true">
            {items.map((v) => (
              <Luz key={v.clave} tono={v.luz} tam="chica" />
            ))}
          </span>
          <span>Las cuatro verificaciones, en verde</span>
          <span className="verifs-chevron" data-abierto={abiertas ? "" : undefined}>
            <IconoChevron tam={18} />
          </span>
        </button>
        <ul id={id} className="verifs-lista" hidden={!abiertas}>
          {items.map((v) => (
            <FilaVerificacion key={v.clave} v={v} />
          ))}
        </ul>
      </div>
    );
  }
  return (
    <ul className="verifs verifs-lista" aria-label="Verificaciones">
      {items.map((v) => (
        <FilaVerificacion key={v.clave} v={v} />
      ))}
    </ul>
  );
}

/** Solo las luces, para filas compactas. */
export function LucesBreves({ items }: { items: VerificacionDTO[] }) {
  return (
    <span className="luces-breves" role="img" aria-label={`Verificaciones: ${items.map((v) => v.luz).join(", ")}`}>
      {items.map((v) => (
        <Luz key={v.clave} tono={v.luz} tam="chica" />
      ))}
    </span>
  );
}

// --- plan por proveedor ----------------------------------------------------------------------

function notaTipo(p: PlanItemDTO, recomendado: MedidaDTO["tipo_recomendado"]): string | null {
  if (!p.tipo || !recomendado || p.tipo === recomendado) return null;
  return p.tipo === "dominio" ? "Por dominio: solo admite dominio" : "Por IP";
}

/** Qué recibe cada proveedor, con una barra de su peso en clientes. */
export function Plan({ medida: m, titulo, soloConDestino = false }: { medida: MedidaDTO; titulo?: string; soloConDestino?: boolean }) {
  const filas = soloConDestino ? conDestino(m) : m.plan;
  if (filas.length === 0) return null;
  const total = m.plan.reduce((a, p) => a + p.clientes, 0);
  return (
    <section className="grupo-hundido plan" aria-label="Plan por proveedor">
      <header className="grupo-cabeza">
        <span className="grupo-titulo">{titulo ?? "Clientes por proveedor"}</span>
        <span className="grupo-meta-15">{soloConDestino ? "hasta el final" : `${clientes(total)} en total`}</span>
      </header>
      <ol>
        {filas.map((p) => {
          const nota = notaTipo(p, m.tipo_recomendado);
          const parte = typeof p.clientes_pct === "number" ? p.clientes_pct / 100 : total > 0 ? p.clientes / total : 0;
          return (
            <li key={p.proveedor_id} className="plan-fila">
              <span className="plan-nombre">
                <span className="plan-nombre-texto">{nombreProveedor(p.proveedor_nombre)}</span>
                {nota && <small>{nota}</small>}
                {p.sin_cobertura && (
                  <small>
                    Sin cobertura por seguridad. {p.sin_cobertura}
                  </small>
                )}
              </span>
              {p.sin_cobertura ? (
                <span />
              ) : (
                <span className="plan-peso" aria-hidden="true">
                  <i style={{ transform: `scaleX(${Math.max(parte, 0.04)})` }} />
                </span>
              )}
              <span className="plan-clientes num">{clientes(p.clientes)}</span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

/** "Promocionado en X desde el minuto 4 y en Discord desde el minuto 5". */
export function Promocion({ items }: { items: MedidaDTO["promocion"] }) {
  if (items.length === 0) return null;
  const vistas = new Map<string, number>();
  for (const p of items) {
    const red = nombreRed(p.red);
    vistas.set(red, Math.min(vistas.get(red) ?? Infinity, p.minuto));
  }
  const partes = [...vistas].map(([red, min]) => `en ${red} desde el minuto ${minutoEntero(min)}`);
  return <p className="promocion">Promocionado {lista(partes)}.</p>;
}

// --- ratificación y levantamiento ----------------------------------------------------------------

/** Ratificación: quién firmó la medida original y por qué hace falta otra firma. */
export function Ratificacion({ medida: m }: { medida: MedidaDTO }) {
  const r = m.ratificacion;
  if (!r) return null;
  return (
    <section className="grupo-hundido" aria-label="Por qué se pide ratificar">
      <p className="grupo-titulo">Ya estaba firmada</p>
      <p className="grupo-detalle">
        {r.juez_original_nombre ?? "El juez saliente"} firmó {r.origen_medida_id}
        {r.decidida_min != null ? ` a los ${reloj(r.decidida_min)}` : ""}. Se reenvía lo mismo con la firma de quien está de turno.
      </p>
      {r.motivo && !m.pedido.includes(r.motivo) && <p className="grupo-detalle">{sinFicticio(r.motivo)}</p>}
    </section>
  );
}

/** Un `orden_id` sin cortes en medio: solo puede pasar de renglón antes del sufijo de hash. */
export function OrdenId({ id }: { id: string }) {
  const corte = id.lastIndexOf("-");
  if (corte <= 0 || corte === id.length - 1) return <span className="sin-corte">{id}</span>;
  return (
    <>
      <span className="sin-corte">{id.slice(0, corte + 1)}</span>
      <wbr />
      <span className="sin-corte">{id.slice(corte + 1)}</span>
    </>
  );
}

/** Un dominio que solo puede pasar de renglón después de un punto: nunca en un guion ni en medio de una palabra. */
export function DominioPartido({ texto }: { texto: string }) {
  const partes = texto.split(/(?<=\.)/);
  return (
    <>
      {partes.map((p, i) => (
        <Fragment key={i}>
          <span className="sin-corte">{p}</span>
          {i < partes.length - 1 && <wbr />}
        </Fragment>
      ))}
    </>
  );
}

/**
 * Levantamiento. En el teléfono, solo la cita del reclamante: la verificación del
 * reclamo y las órdenes que se levantan ya están en las cuatro luces. En el expediente
 * (no compacto) se listan además las órdenes, para la foja.
 */
export function Levantamiento({ medida: m, compacto = false }: { medida: MedidaDTO; compacto?: boolean }) {
  const l = m.levantamiento;
  if (!l) return null;
  const nombre = (o: { proveedor_id: string; proveedor_nombre?: string }) => {
    const n = o.proveedor_nombre ?? m.plan.find((p) => p.proveedor_id === o.proveedor_id)?.proveedor_nombre;
    return n ? nombreProveedor(n) : o.proveedor_id.charAt(0).toUpperCase() + o.proveedor_id.slice(1);
  };
  if (compacto) {
    if (!l.mensaje) return null;
    return (
      <figure className="reclamo-cita" aria-label="Lo que dice el reclamo">
        <blockquote className="reclamo-mensaje">{sinFicticio(l.mensaje)}</blockquote>
      </figure>
    );
  }
  return (
    <section className="grupo-hundido reclamo" aria-label="Reclamo">
      <p className="grupo-titulo-chico">Reclamo de {l.dominio}</p>
      {l.mensaje && <blockquote className="reclamo-mensaje">{sinFicticio(l.mensaje)}</blockquote>}
      {l.ordenes_a_levantar.length > 0 && (
        <>
          <p className="grupo-titulo-chico reclamo-sub">
            {l.ordenes_a_levantar.length === 1 ? "Se levanta esta orden" : `Se levantan estas ${l.ordenes_a_levantar.length} órdenes`}
          </p>
          <ul className="reclamo-ordenes">
            {l.ordenes_a_levantar.map((o) => (
              <li key={o.orden_id}>
                <span className="reclamo-prov">{nombre(o)}</span>
                <span className="reclamo-obj">
                  {TIPO[o.tipo]} {o.objetivo}
                </span>
                <span className="huella reclamo-id">
                  <OrdenId id={o.orden_id} />
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

/** Contenedor con título chico, para el expediente. */
export function Bloque({ titulo, children, className = "" }: { titulo: string; children: ReactNode; className?: string }) {
  return (
    <section className={className}>
      <h4 className="bloque-titulo">{titulo}</h4>
      {children}
    </section>
  );
}
