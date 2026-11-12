// La tarjeta de una medida en el teléfono del juez. Arriba la clase y la espera;
// después el pedido como titular, lo propio de cada clase, las luces y el plan.

import type { MedidaDTO } from "../../compartido/tipos.ts";
import { CLASE, CLASE_ACCESIBLE, haceReal, reloj, sinFicticio } from "../nucleo/formato.ts";
import { aceleracion, useMinuto } from "../nucleo/reloj.ts";
import { Tilde } from "./comunes.tsx";
import { AvisoSimulacro, Levantamiento, Plan, Promocion, QueCambio, Ratificacion, Recorrido, Titular, Verificaciones } from "./Medida.tsx";

/** Cuánto lleva esperando, en tiempo real ("hace 24 s"). */
function Espera({ medida }: { medida: MedidaDTO }) {
  const ahora = useMinuto(1000);
  const espera = Math.max(0, ahora - medida.creada_min);
  return <span className="tarjeta-espera num">{haceReal(espera, aceleracion())}</span>;
}

/** Firmada a los 72:01, y debajo a cuánto de presentada. */
export function SelloFirma({ medida: m, conDemora = false }: { medida: MedidaDTO; conDemora?: boolean }) {
  const d = m.decision;
  if (!d || d.minuto == null) return null;
  const verbo = m.estado === "rechazada" ? "Rechazada" : m.estado === "sin_efecto" ? "Sin efecto" : "Firmada";
  return (
    <span className="sello-firma">
      <span className="sello-linea">
        <Tilde />
        <span className="num">
          {verbo} a los {reloj(d.minuto)}
        </span>
      </span>
      {conDemora && <span className="sello-demora num">a {reloj(Math.max(0, d.minuto - m.creada_min))} de presentada</span>}
    </span>
  );
}

export function Tarjeta({
  medida: m,
  minutos,
  firmada = false,
  plegar = false,
  sale = false,
}: {
  medida: MedidaDTO;
  /** Minuto de aparición de cada servidor previo (del expediente), para el recorrido. */
  minutos: Map<string, number>;
  /** Ya firmada: se muestra compacta, con el sello en la cabeza. */
  firmada?: boolean;
  /** Recién firmada con el dedo: el detalle (luces, plan) se pliega en vez de desaparecer de golpe. */
  plegar?: boolean;
  /** Se está yendo después de decidir: se funde y sube 8 px en 200 ms. */
  sale?: boolean;
}) {
  const etiqueta = `${firmada ? "Firmada. " : ""}${CLASE_ACCESIBLE[m.clase]}${m.simulacro ? ", simulacro" : ""}: ${sinFicticio(m.pedido)}`;
  return (
    <article className="tarjeta" aria-label={etiqueta} data-sale={sale ? "" : undefined} data-firmada={firmada ? "" : undefined}>
      <header className="tarjeta-cabeza">
        <span className="tarjeta-clase">
          {CLASE[m.clase]}
          {m.simulacro ? ", simulacro" : ""}
        </span>
        {firmada ? <SelloFirma medida={m} conDemora /> : <Espera medida={m} />}
      </header>

      <Titular medida={m} />

      {m.clase === "ampliacion" && (
        <div className="grupo-hundido ampliacion">
          <Recorrido medida={m} minutos={minutos} />
          <QueCambio medida={m} />
        </div>
      )}

      {(!firmada || plegar) && (
        <div className="tarjeta-detalle" data-plega={firmada ? "" : undefined} aria-hidden={firmada ? true : undefined}>
          <div className="tarjeta-detalle-interior">
            {m.simulacro && <AvisoSimulacro />}
            {m.clase === "ratificacion" && <Ratificacion medida={m} />}
            {m.clase === "levantamiento" && <Levantamiento medida={m} compacto />}
            <Verificaciones items={m.verificaciones} resumible={m.clase === "ampliacion"} />
            {m.clase === "ratificacion" ? (
              <Plan medida={m} titulo="Se reenvía a" soloConDestino />
            ) : m.clase === "levantamiento" ? (
              <Plan medida={m} titulo="Se reemplaza por" soloConDestino />
            ) : (
              <Plan medida={m} />
            )}
            <Promocion items={m.promocion} />
          </div>
        </div>
      )}
    </article>
  );
}
