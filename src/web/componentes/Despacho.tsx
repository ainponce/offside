// El despacho de una medida firmada: una fila por proveedor que cambia sola
// (por enviar, recibida, aplicada, falló, reintento) y la cobertura en clientes.

import type { MedidaDTO, OrdenDTO } from "../../compartido/tipos.ts";
import { type FilaDespacho, coberturaDe, filasDespacho } from "../nucleo/despacho.ts";
import { ESTADO_ORDEN, TIPO, enGrupos, millones, nombreProveedor, porcentaje, reloj } from "../nucleo/formato.ts";
import { Luz } from "./comunes.tsx";

/** Minuto del último cambio de una orden. */
function minutoDe(o: OrdenDTO | null): number | null {
  if (!o) return null;
  return o.finalizada_min ?? o.aplicada_min ?? o.enviada_min ?? null;
}

export function aplicadasDe(filas: FilaDespacho[]): { aplicadas: number; total: number } {
  const conDestino = filas.filter((f) => f.tipo);
  return {
    aplicadas: conDestino.filter((f) => f.orden?.estado === "aplicada").length,
    total: conDestino.length,
  };
}

/** Estado de una fila: palabra, luz y tinta. Sin orden todavía, "Por enviar". */
function estadoFila(f: FilaDespacho) {
  if (!f.tipo) return { ...ESTADO_ORDEN.sin_cobertura, clave: "sin_cobertura" as const };
  const clave = f.orden?.estado ?? "por_enviar";
  return { ...ESTADO_ORDEN[clave], clave };
}

export function FilaOrden({ fila: f, indice, entra }: { fila: FilaDespacho; indice: number; entra: boolean }) {
  const e = estadoFila(f);
  const min = minutoDe(f.orden);
  const reintento = f.orden && f.orden.intento > 1 && (f.orden.estado === "por_enviar" || f.orden.estado === "recibida");
  const objetivo = f.tipo ? `${TIPO[f.tipo]} ${f.objetivo ?? ""}` : (f.sin_cobertura ?? "Sin cobertura por seguridad");
  const debajo = reintento ? `${f.orden!.intento}.º intento` : f.orden?.estado === "fallida" ? "reintenta" : min != null ? reloj(min) : "";
  return (
    <li className="orden-fila" data-entra={entra ? "" : undefined} style={entra ? { animationDelay: `${90 + indice * 40}ms` } : undefined}>
      <span className="orden-prov">
        <span className="orden-nombre" title={nombreProveedor(f.nombre)}>
          {nombreProveedor(f.nombre)}
        </span>
        <span className="orden-obj" title={objetivo}>
          {objetivo}
        </span>
      </span>
      <span className="orden-estado" data-tinta={e.tinta}>
        <Luz tono={e.luz} />
        <span className="orden-estado-texto">
          <span className="orden-palabra">{e.rotulo}</span>
          {debajo && <span className="orden-min num">{debajo}</span>}
        </span>
      </span>
    </li>
  );
}

/** La cabeza, la barra de cobertura, las filas y el pie con la huella. */
export function Despacho({ medida: m, entra = false }: { medida: MedidaDTO; entra?: boolean }) {
  const filas = filasDespacho(m);
  const { aplicadas, total } = aplicadasDe(filas);
  const aTodos = m.clase === "inicial" || m.clase === "ampliacion";
  const cobertura = coberturaDe(filas.filter((f) => f.tipo));
  const clientesTotal = filas.filter((f) => f.tipo).reduce((a, f) => a + f.clientes, 0);
  const cubiertos = filas.reduce((a, f) => a + (f.orden?.estado === "aplicada" ? f.clientes : 0), 0);
  const completo = total > 0 && aplicadas === total;
  const vencidas = filas.length > 0 && filas.every((f) => !f.tipo || f.orden?.estado === "vencida" || f.orden?.estado === "levantada");
  const titulo = vencidas
    ? "Las órdenes ya vencieron"
    : completo
      ? total === 1
        ? "Bloqueo aplicado en el proveedor"
        : `Bloqueo aplicado en los ${total} proveedores`
      : "Órdenes en curso";

  return (
    <div className="despacho">
      <header className="despacho-cabeza">
        <h2>{titulo}</h2>
        {!completo && !vencidas && (
          <span className="num">
            {aplicadas} de {total} aplicadas
          </span>
        )}
      </header>
      {aTodos && clientesTotal > 0 && (
        <div className="cobertura">
          <div className="cobertura-barra" aria-hidden="true">
            <i style={{ transform: `scaleX(${cobertura / 100})` }} />
          </div>
          <p className="num">
            <span>{porcentaje(cobertura)} % de los clientes ya con el bloqueo</span>
            <span>
              {millones(cubiertos)} de {millones(clientesTotal)} M
            </span>
          </p>
        </div>
      )}
      {filas.length > 0 ? (
        <ol className="ordenes" aria-live="polite">
          {filas.map((f, i) => (
            <FilaOrden key={f.proveedor_id} fila={f} indice={i} entra={entra} />
          ))}
        </ol>
      ) : (
        <p className="despacho-vacio">El reclamo levanta las órdenes indicadas. Queda registrado en el expediente.</p>
      )}
      <p className="despacho-pie">
        {total === 1 ? "La orden lleva" : `Las ${total} llevan`} la huella <span className="huella">{enGrupos(m.huella, 12)}</span>
      </p>
    </div>
  );
}

/** Cuatro luces de 8 px: el estado de cada orden, para las filas compactas. */
export function LucesOrdenes({ medida }: { medida: MedidaDTO }) {
  const filas = filasDespacho(medida).filter((f) => f.tipo);
  const { aplicadas, total } = aplicadasDe(filas);
  return (
    <span className="luces-breves" role="img" aria-label={`${aplicadas} de ${total} órdenes aplicadas`}>
      {filas.map((f) => (
        <Luz key={f.proveedor_id} tono={estadoFila(f).luz} tam="chica" />
      ))}
    </span>
  );
}
