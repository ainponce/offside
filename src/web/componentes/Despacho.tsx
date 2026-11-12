// Estado de una medida firmada en cada proveedor: por enviar, recibida, aplicada.
// Es lo que el juez mira después de firmar.

import type { MedidaDTO } from "../../compartido/tipos.ts";
import { type FilaDespacho, coberturaDe, filasDespacho } from "../nucleo/despacho.ts";
import { ESTADO_ORDEN, TIPO, type TonoEstado, minuto, nombreBreve, numero, sinFicticio } from "../nucleo/formato.ts";
import { Pasos } from "./comunes.tsx";

const TEXTO_TONO: Record<TonoEstado, string> = {
  verde: "text-verde",
  ambar: "text-ambar",
  roja: "text-roja",
  neutro: "text-tinta-2",
  vacio: "text-tinta-2",
};

const FONDO_TONO: Record<TonoEstado, string> = {
  verde: "bg-verde-luz",
  ambar: "bg-ambar-luz",
  roja: "bg-roja-luz",
  neutro: "bg-tinta-3",
  vacio: "rayado-suave",
};

export function lecturaDe(f: FilaDespacho, saliendo = false): { rotulo: string; tono: TonoEstado; nota: string | null } {
  if (!f.orden) {
    if (f.sin_cobertura || !f.tipo) return { rotulo: "Sin cobertura", tono: "vacio", nota: f.sin_cobertura };
    // Recién firmada: la orden está saliendo aunque todavía no figure.
    if (saliendo) return { rotulo: "Por enviar", tono: "ambar", nota: null };
    return { rotulo: "Sin orden", tono: "vacio", nota: null };
  }
  const o = f.orden;
  const base = ESTADO_ORDEN[o.estado];
  const intento = o.intento > 1 ? `intento ${o.intento}` : null;
  let nota: string | null = intento;
  if (o.estado === "aplicada" && o.aplicada_min != null) nota = [`min ${minuto(o.aplicada_min)}`, intento].filter(Boolean).join(", ");
  if (o.estado === "fallida") nota = o.error ?? "se reenvía con una orden nueva";
  if (o.estado === "rechazada" || o.estado === "no_enviada") nota = o.error ?? intento;
  return { rotulo: base.rotulo, tono: base.tono, nota };
}

/** Con cuántos proveedores quedó aplicada: para medidas que no van a todos (ratificaciones, reclamos). */
export function aplicadasDe(filas: FilaDespacho[]): { aplicadas: number; total: number } {
  const conOrden = filas.filter((f) => f.tipo);
  return { aplicadas: conOrden.filter((f) => f.orden?.estado === "aplicada").length, total: conOrden.length };
}

/** Barra de cobertura: cada tramo es un proveedor y su ancho, su cantidad de clientes. */
export function BarraCobertura({ filas, className = "" }: { filas: FilaDespacho[]; className?: string }) {
  const total = filas.reduce((a, f) => a + f.clientes, 0);
  if (total <= 0) return null;
  return (
    <div className={`flex h-3 w-full gap-[2px] ${className}`} aria-hidden="true">
      {filas.map((f) => {
        const { tono } = lecturaDe(f);
        const aplicada = f.orden?.estado === "aplicada";
        return (
          <span
            key={f.proveedor_id}
            title={sinFicticio(f.nombre)}
            style={{ flexGrow: Math.max(f.clientes, total * 0.02), flexBasis: 0 }}
            className={`min-w-[5px] rounded-[1px] transition-colors duration-300 ${
              aplicada ? "bg-verde-luz" : tono === "vacio" || !f.orden ? "rayado-suave ring-1 ring-inset ring-regla" : FONDO_TONO[tono]
            } ${f.orden && !aplicada && tono === "ambar" ? "opacity-55" : ""}`}
          />
        );
      })}
    </div>
  );
}

/** Lista amplia: una fila por proveedor con sus tres tramos, rótulo y nota. */
export function DespachoAmplio({ medida, conCobertura = true, saliendo = false }: { medida: MedidaDTO; conCobertura?: boolean; saliendo?: boolean }) {
  const filas = filasDespacho(medida);
  const total = filas.reduce((a, f) => a + f.clientes, 0);
  const cobertura = coberturaDe(filas);
  return (
    <div>
      {conCobertura && total > 0 && (
        <div className="mb-3">
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-[0.9375rem] text-tinta-2">Clientes con el bloqueo aplicado</span>
            <span className="angosta cifras text-[1.75rem] font-extrabold leading-none" aria-live="polite">
              {numero(cobertura, cobertura > 0 && cobertura < 100 ? 1 : 0)} %
            </span>
          </div>
          <BarraCobertura filas={filas} className="mt-2" />
        </div>
      )}
      <ul className="m-0 list-none p-0">
        {filas.map((f) => {
          const { rotulo, tono, nota } = lecturaDe(f, saliendo);
          return (
            <li key={f.proveedor_id} className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-3 border-t border-regla py-2.5">
              <Pasos paso={f.paso} tono={tono} grande />
              <div className="min-w-0">
                <p className="m-0 truncate font-semibold leading-tight" title={sinFicticio(f.nombre)}>
                  <span className="xs:hidden">{nombreBreve(f.nombre)}</span>
                  <span className="hidden xs:inline">{sinFicticio(f.nombre)}</span>
                </p>
                {f.tipo && (
                  <p className="m-0 truncate text-[0.8125rem] leading-tight text-tinta-2">
                    {TIPO[f.tipo]} <span className="huella">{f.objetivo}</span>
                  </p>
                )}
              </div>
              <div className="max-w-[11.5rem] text-right">
                <p className={`m-0 font-bold leading-tight ${TEXTO_TONO[tono]}`}>{rotulo}</p>
                {nota && <p className="m-0 text-[0.8125rem] leading-tight text-tinta-2">{nota}</p>}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** Versión de una línea: tramos y nombre corto de cada proveedor. */
export function DespachoCompacto({ medida, className = "" }: { medida: MedidaDTO; className?: string }) {
  const filas = filasDespacho(medida);
  if (filas.length === 0) return null;
  return (
    <ul className={`m-0 flex list-none flex-wrap gap-x-4 gap-y-1.5 p-0 ${className}`}>
      {filas.map((f) => {
        const { rotulo, tono } = lecturaDe(f);
        return (
          <li key={f.proveedor_id} className="flex items-center gap-1.5 text-[0.8125rem]" title={`${sinFicticio(f.nombre)}: ${rotulo}`}>
            <Pasos paso={f.paso} tono={tono} />
            <span className="font-medium">{nombreBreve(f.nombre)}</span>
            <span className={`sr-only`}>{rotulo}</span>
            {(tono === "roja" || (f.orden && f.orden.intento > 1)) && (
              <span className={`${TEXTO_TONO[tono]} font-semibold`}>
                {tono === "roja" ? rotulo.toLowerCase() : `intento ${f.orden!.intento}`}
              </span>
            )}
          </li>
        );
      })}
    </ul>
  );
}
