// Las partes de una medida tal como las lee el juez. Se usan en la tarjeta de la
// cola y en el expediente. Los textos de fondo (pedido, verificaciones) vienen del servidor.

import { useState } from "react";
import type { MedidaDTO, PlanItemDTO, VerificacionDTO } from "../../compartido/tipos.ts";
import { TIPO, clientes, minuto, nombreBreve, nombreRed, numero, plural, sinFicticio } from "../nucleo/formato.ts";
import { Huella, Luz } from "./comunes.tsx";

const FONDO_LUZ: Record<VerificacionDTO["luz"], string> = {
  verde: "",
  ambar: "bg-ambar-suave",
  roja: "bg-roja-suave",
};

/**
 * Las cuatro verificaciones, siempre en el mismo orden.
 * Con `resumida`, en pantallas angostas el detalle de las luces verdes se corta a dos
 * renglones para que las cuatro entren sin desplazar; un toque lo muestra entero.
 * Ámbar y roja siempre se leen completas.
 */
export function Verificaciones({ items, compacta = false, resumida = false }: { items: VerificacionDTO[]; compacta?: boolean; resumida?: boolean }) {
  const [abiertas, setAbiertas] = useState(false);
  const cortar = resumida && !abiertas;
  return (
    <ul className="m-0 list-none p-0" aria-label="Verificaciones" onClick={resumida ? () => setAbiertas(true) : undefined}>
      {items.map((v) => (
        <li key={v.clave} className={`flex gap-3 border-t border-regla px-4 ${compacta ? "py-2" : "py-2.5"} ${FONDO_LUZ[v.luz]}`}>
          <Luz luz={v.luz} tam={compacta ? 18 : 24} className="mt-[1px]" />
          <div className="min-w-0">
            <p className={`m-0 font-bold leading-snug ${compacta ? "text-[0.9375rem]" : "text-[1.0625rem]"}`}>{v.titulo}</p>
            <p
              className={`m-0 break-words text-tinta-2 ${compacta ? "text-[0.8125rem] leading-snug" : "text-[0.9375rem] leading-[1.3]"} ${
                cortar && v.luz === "verde" ? "line-clamp-2 lg:line-clamp-none" : ""
              }`}
            >
              {v.detalle}
            </p>
          </div>
        </li>
      ))}
    </ul>
  );
}

/** Solo las cuatro luces, para las filas resumidas. */
export function LucesBreves({ items }: { items: VerificacionDTO[] }) {
  return (
    <span className="inline-flex items-center gap-1" aria-label={`Verificaciones: ${items.map((v) => v.luz).join(", ")}`}>
      {items.map((v) => (
        <Luz key={v.clave} luz={v.luz} tam={14} />
      ))}
    </span>
  );
}

const ESTADO_PREVIO: Record<string, string> = {
  aprobada: "Bloqueo firmado",
  pendiente: "Espera firma",
  rechazada: "Rechazado",
  sin_efecto: "Sin efecto",
};

/** Ampliación: la misma filtración (misma marca) saltó a un servidor nuevo. */
export function QueCambio({ medida }: { medida: MedidaDTO }) {
  const previos = medida.ampliacion?.servidores_previos ?? [];
  const nuevo = medida.servidor;
  return (
    <section className="px-4 py-3" aria-label="Qué cambió">
      <h3 className="m-0 text-[1.0625rem] font-bold leading-snug">Cambió el servidor. La filtración es la misma.</h3>
      <p className="m-0 mt-0.5 text-[0.9375rem] leading-snug text-tinta-2">
        Misma marca en la señal: <span className="huella font-semibold text-tinta">{medida.marca}</span>
      </p>
      <ol className="m-0 mt-3 list-none p-0">
        {previos.map((s, i) => (
          <li key={`${s.host}|${s.ip}|${i}`} className="relative flex gap-3 pb-2.5">
            <span aria-hidden="true" className="absolute left-[6px] top-[14px] h-full w-[2px] bg-tinta" />
            <span aria-hidden="true" className="relative mt-[5px] size-[14px] flex-none rounded-full border-2 border-tinta bg-papel" />
            <div className="min-w-0 flex-1 text-[0.9375rem] leading-snug text-tinta-2">
              <span className="wrap-anywhere">{s.host}</span> <span className="huella">{s.ip}</span>
              {s.estado && <span className="ml-2 whitespace-nowrap text-[0.8125rem]">{ESTADO_PREVIO[s.estado] ?? s.estado}</span>}
            </div>
          </li>
        ))}
        {nuevo && (
          <li className="relative flex gap-3">
            <span aria-hidden="true" className="relative mt-[5px] size-[14px] flex-none rounded-full bg-tinta" />
            <div className="min-w-0 flex-1 leading-snug">
              <span className="font-bold wrap-anywhere">{nuevo.host}</span> <span className="huella">{nuevo.ip}</span>
              <span className="ml-2 inline-block whitespace-nowrap rounded-[3px] bg-tinta px-1.5 py-[1px] text-[0.75rem] font-bold text-papel">
                Servidor nuevo
              </span>
            </div>
          </li>
        )}
      </ol>
    </section>
  );
}

const MAX_TERCEROS = 6;

/** La línea de offside: de un lado lo que se bloquea, del otro los sitios ajenos que no se tocan. */
export function NoSeTocan({ medida }: { medida: MedidaDTO }) {
  const [todos, setTodos] = useState(false);
  const terceros = medida.terceros;
  if (terceros.length === 0) return null;
  const porIp = medida.tipo_recomendado === "ip";
  const visibles = todos || terceros.length <= MAX_TERCEROS + 1 ? terceros : terceros.slice(0, MAX_TERCEROS);
  const resto = terceros.length - visibles.length;
  return (
    <section className={`border-t border-regla px-4 py-3 sm:flex sm:gap-4 ${porIp ? "bg-roja-suave" : ""}`} aria-label="Sitios ajenos en la misma IP">
      <div className="min-w-0 sm:w-[36%] sm:flex-none">
        <p className="m-0 text-[0.8125rem] font-medium text-tinta-2">{porIp ? "Se bloquea toda la IP" : "Se bloquea solo este dominio"}</p>
        <p className="m-0 text-[1.0625rem] font-bold leading-snug wrap-anywhere">{porIp ? medida.servidor?.ip : medida.servidor?.host}</p>
      </div>
      {/* La línea de offside: horizontal en el celular, vertical cuando hay lugar. */}
      <span className="my-2.5 block h-[3px] bg-firma sm:my-0 sm:h-auto sm:w-[3px] sm:flex-none" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <p className="m-0 text-[0.8125rem] font-medium text-tinta-2">
          {porIp
            ? `Quedarían bloqueados ${plural(terceros.length, "sitio ajeno", "sitios ajenos")}`
            : `No se ${terceros.length === 1 ? "toca" : "tocan"}: ${plural(terceros.length, "sitio ajeno", "sitios ajenos")} en la misma IP`}
        </p>
        <ul className="m-0 mt-1 list-none p-0 text-[1rem] leading-[1.4]">
          {visibles.map((t) => (
            <li key={t} className="font-semibold wrap-anywhere">
              {t}
            </li>
          ))}
        </ul>
        {resto > 0 && (
          <button type="button" className="enlace mt-1 min-h-[32px] bg-transparent p-0 text-[0.9375rem] font-semibold" onClick={() => setTodos(true)}>
            y {resto} más
          </button>
        )}
      </div>
    </section>
  );
}

/**
 * Qué recibe cada proveedor, agrupado por lo que se bloquea: quiénes bloquean la IP,
 * quiénes el dominio y quiénes quedan sin cobertura. Al lado de cada uno, su parte de los clientes.
 */
export function PlanProveedores({ plan, parcial = false }: { plan: PlanItemDTO[]; parcial?: boolean }) {
  // Una ratificación o un reclamo no van a todos los proveedores: ahí un porcentaje
  // sobre el plan engañaría, así que se muestra la cantidad de clientes.
  const total = parcial ? 0 : plan.reduce((a, p) => a + p.clientes, 0);
  const grupos = new Map<string, PlanItemDTO[]>();
  for (const p of plan) {
    const clave = p.tipo ? `${p.tipo}|${p.objetivo ?? ""}` : `sin|${p.sin_cobertura ?? ""}`;
    grupos.set(clave, [...(grupos.get(clave) ?? []), p]);
  }
  // Los que no reciben nada van al final.
  const ordenados = [...grupos.values()].sort((a, b) => Number(!a[0]!.tipo) - Number(!b[0]!.tipo));
  return (
    <ul className="m-0 list-none p-0" aria-label="Plan por proveedor">
      {ordenados.map((grupo) => {
        const cabeza = grupo[0]!;
        return (
          <li key={`${cabeza.tipo}|${cabeza.objetivo}|${cabeza.sin_cobertura}`} className="border-t border-regla py-2 leading-snug first:border-t-0">
            {cabeza.tipo ? (
              <p className="m-0">
                <span className="font-bold">{cabeza.tipo === "ip" ? "Por IP" : "Por dominio"}</span> <span className="huella text-tinta-2">{cabeza.objetivo}</span>
              </p>
            ) : (
              <p className="m-0">
                <span className="rayado-suave rounded-[3px] px-1.5 font-bold">Sin cobertura</span>
                {cabeza.sin_cobertura && <span className="mt-0.5 block text-[0.8125rem] text-tinta-2">{cabeza.sin_cobertura}</span>}
              </p>
            )}
            <ul className="m-0 mt-0.5 flex list-none flex-wrap gap-x-4 gap-y-0.5 p-0">
              {grupo.map((p) => {
                const parte = total > 0 ? (100 * p.clientes) / total : 0;
                return (
                  <li key={p.proveedor_id} className="whitespace-nowrap" title={sinFicticio(p.proveedor_nombre)}>
                    <span className="font-semibold sm:hidden">{nombreBreve(p.proveedor_nombre)}</span>
                    <span className="hidden font-semibold sm:inline">{sinFicticio(p.proveedor_nombre)}</span>
                    {total > 0 ? (
                      <span className="cifras ml-1.5 text-[0.8125rem] text-tinta-2">{numero(parte, parte > 0 && parte < 1 ? 1 : 0)} %</span>
                    ) : (
                      p.clientes > 0 && <span className="cifras ml-1.5 text-[0.8125rem] text-tinta-2">{clientes(p.clientes)} clientes</span>
                    )}
                  </li>
                );
              })}
            </ul>
          </li>
        );
      })}
    </ul>
  );
}

/** Dónde se promocionó el enlace pirata. */
export function Promocion({ items }: { items: MedidaDTO["promocion"] }) {
  if (items.length === 0) return <span className="text-tinta-2">Sin promoción detectada</span>;
  return (
    <ul className="m-0 list-none p-0">
      {items.map((p, i) => (
        <li key={`${p.url}|${i}`} className="leading-snug">
          <span className="font-semibold">{nombreRed(p.red)}</span>
          <span className="text-tinta-2">, min {minuto(p.minuto)}</span>
          <span className="huella block text-tinta-2">{p.url.replace(/^https?:\/\//, "")}</span>
        </li>
      ))}
    </ul>
  );
}

/** Ratificación: quién firmó la medida original y por qué hace falta otra firma. */
export function MotivoRatificacion({ medida }: { medida: MedidaDTO }) {
  const r = medida.ratificacion;
  if (!r) return null;
  return (
    <section className="px-4 py-3" aria-label="Por qué se pide ratificar">
      <h3 className="m-0 text-[1.0625rem] font-bold leading-snug">Ya estaba firmada. Se reenvía lo mismo, con la firma del juez entrante.</h3>
      <p className="m-0 mt-1 text-[0.9375rem] leading-snug text-tinta-2">
        {r.juez_original_nombre ?? "El juez saliente"} firmó la medida <span className="huella">{r.origen_medida_id}</span>
        {r.decidida_min != null ? ` en el minuto ${minuto(r.decidida_min)}` : ""}.{" "}
        {/* El pedido suele traer ya el motivo; se repite solo si dice algo más. */}
        {r.motivo && !medida.pedido.includes(r.motivo) ? r.motivo : ""}
      </p>
    </section>
  );
}

/** Reclamo: quién reclama, qué dijo y qué órdenes se levantan. */
export function DetalleReclamo({ medida }: { medida: MedidaDTO }) {
  const l = medida.levantamiento;
  if (!l) return null;
  const nombre = (id: string) => {
    const delPlan = medida.plan.find((p) => p.proveedor_id === id)?.proveedor_nombre ?? medida.ordenes.find((o) => o.proveedor_id === id)?.proveedor_nombre;
    return delPlan ? sinFicticio(delPlan) : id.charAt(0).toUpperCase() + id.slice(1);
  };
  return (
    <section className="px-4 py-3" aria-label="Reclamo">
      <h3 className="m-0 text-[1.0625rem] font-bold leading-snug">
        Reclama <span className="wrap-anywhere">{l.dominio}</span>
      </h3>
      {l.mensaje && (
        <blockquote className="m-0 mt-2 border-l-[3px] border-tinta pl-3 font-serif text-[1.0625rem] italic leading-snug">{l.mensaje}</blockquote>
      )}
      {l.verificacion && <p className="m-0 mt-2 text-[0.9375rem] leading-snug text-tinta-2">{l.verificacion}</p>}
      {l.ordenes_a_levantar.length > 0 && (
        <div className="mt-3">
          <p className="m-0 text-[0.8125rem] font-medium text-tinta-2">
            {l.ordenes_a_levantar.length === 1 ? "Se levanta esta orden" : `Se levantan estas ${l.ordenes_a_levantar.length} órdenes`}
          </p>
          <ul className="m-0 mt-1 list-none p-0">
            {l.ordenes_a_levantar.map((o) => (
              <li key={o.orden_id} className="flex flex-wrap items-baseline gap-x-2 border-t border-regla py-1.5 leading-snug">
                <span className="font-semibold">{nombre(o.proveedor_id)}</span>
                <span>
                  {TIPO[o.tipo]} <span className="huella">{o.objetivo}</span>
                </span>
                <Huella valor={o.orden_id} largo={0} className="w-full text-tinta-2" />
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

/** Banda rayada para la medida forzada del simulacro. */
export function BandaSimulacro() {
  return (
    <div className="flex items-stretch border-b-2 border-tinta" role="note">
      <span aria-hidden="true" className="rayado w-10 flex-none" />
      <p className="m-0 flex-1 px-3 py-2 leading-snug">
        <strong className="font-extrabold">Simulacro.</strong> <span className="text-[0.9375rem]">Error forzado para la demostración de reclamos. No es una medida real.</span>
      </p>
      <span aria-hidden="true" className="rayado w-10 flex-none" />
    </div>
  );
}
