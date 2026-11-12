// Registro público de bloqueos: sin ingreso. Qué se bloqueó, desde cuándo, quién
// lo ordenó y hasta cuándo; todos vencen solos con el final del partido.

import { Link } from "react-router-dom";
import type { TipoBloqueo, TransparenciaDTO } from "../../compartido/tipos.ts";
import { Cargando, Cortes, HashCompleto, Huella, Luz, Marca, RelojPartido, useFondo, useTitulo } from "../componentes/comunes.tsx";
import { MarcasRegla, fraccion, useAncho } from "../componentes/Escala.tsx";
import { type TonoLuz, type TintaEstado, TIPO, juzgadoBreve, minutoEntero, partidoBreve, plural, reloj, sinFicticio } from "../nucleo/formato.ts";
import { sincronizarReloj, useMinuto } from "../nucleo/reloj.ts";
import { useSesion } from "../nucleo/sesion.ts";
import { useVivo } from "../nucleo/vivo.ts";

type Bloqueo = TransparenciaDTO["bloqueos"][number] & {
  /** Minuto en que se levantó, si el servidor lo informa. */
  levantado_min?: number | null;
};

const ESTADO: Record<Bloqueo["estado"], { rotulo: string; luz: TonoLuz; tinta: TintaEstado }> = {
  vigente: { rotulo: "Vigente", luz: "verde", tinta: "verde" },
  en_curso: { rotulo: "En curso", luz: "ambar", tinta: "ambar" },
  vencido: { rotulo: "Venció", luz: "apagada", tinta: "neutra" },
  levantado: { rotulo: "Levantado", luz: "anillo", tinta: "neutra" },
};

/** Una fila del registro: un bloqueo, o la IP y el dominio de una misma medida juntos. */
interface Fila {
  clave: string;
  tipo: TipoBloqueo;
  objetivo: string;
  /** Qué más bloquea la misma medida ("dominio s1.pelotaya.test en 1 proveedor"). */
  ademas: string | null;
  desde_min: number | null;
  hasta_min: number;
  levantado_min: number | null;
  estado: Bloqueo["estado"];
  juzgado: string | null;
  juez: string | null;
  huella: string;
  confirmados: number;
  total: number;
}

const PRIORIDAD: Record<Bloqueo["estado"], number> = { en_curso: 3, vigente: 2, vencido: 1, levantado: 0 };

/**
 * Una medida que bloquea la IP en unos proveedores y el dominio en otro (el que solo admite
 * dominio) es un solo bloqueo para el ciudadano: va en una fila, con todos sus proveedores.
 * Un bloqueo levantado nunca se une: se muestra solo, con su estado.
 */
function unir(bloqueos: Bloqueo[]): Fila[] {
  const filas: Fila[] = [];
  const porMedida = new Map<string, { fila: Fila; tipos: Set<TipoBloqueo> }>();
  for (const b of bloqueos) {
    const previa = porMedida.get(b.medida_id);
    if (previa && b.estado !== "levantado" && previa.fila.estado !== "levantado" && !previa.tipos.has(b.tipo) && previa.fila.ademas == null) {
      const f = previa.fila;
      f.ademas = `${TIPO[f.tipo]} en ${plural(f.total, "proveedor", "proveedores")}; ${TIPO[b.tipo].toLowerCase()} ${b.objetivo} en ${plural(b.proveedores_total, "proveedor", "proveedores")}`;
      f.desde_min = f.desde_min == null ? b.desde_min : b.desde_min == null ? f.desde_min : Math.min(f.desde_min, b.desde_min);
      f.hasta_min = Math.max(f.hasta_min, b.hasta_min);
      f.estado = PRIORIDAD[b.estado] > PRIORIDAD[f.estado] ? b.estado : f.estado;
      f.confirmados += b.proveedores_confirmados;
      f.total += b.proveedores_total;
      previa.tipos.add(b.tipo);
      continue;
    }
    const fila: Fila = {
      clave: `${b.medida_id}-${b.tipo}-${b.objetivo}`,
      tipo: b.tipo,
      objetivo: b.objetivo,
      ademas: null,
      desde_min: b.desde_min,
      hasta_min: b.hasta_min,
      levantado_min: typeof b.levantado_min === "number" ? b.levantado_min : null,
      estado: b.estado,
      juzgado: b.juzgado,
      juez: b.juez,
      huella: b.huella,
      confirmados: b.proveedores_confirmados,
      total: b.proveedores_total,
    };
    filas.push(fila);
    if (!previa) porMedida.set(b.medida_id, { fila, tipos: new Set([b.tipo]) });
  }
  return filas;
}

function Vigencia({ f, fin, ahora, finalizado }: { f: Fila; fin: number; ahora: number; finalizado: boolean }) {
  const desde = f.desde_min;
  const levantado = f.estado === "levantado";
  // Un bloqueo levantado no dura hasta el final: la barra llega hasta que se levantó (si se sabe) y va apagada.
  const enCurso = Math.min(f.hasta_min, finalizado ? f.hasta_min : Math.max(ahora, desde ?? 0));
  const hasta = levantado ? Math.min(f.levantado_min ?? f.hasta_min, enCurso) : enCurso;
  const texto =
    desde == null
      ? `vence a los ${minutoEntero(f.hasta_min)}′`
      : levantado
        ? f.levantado_min != null
          ? `${minutoEntero(desde)}′ a ${minutoEntero(f.levantado_min)}′, levantado`
          : `desde ${minutoEntero(desde)}′, levantado`
        : `${minutoEntero(desde)}′ a ${minutoEntero(f.hasta_min)}′`;
  return (
    <span className="tr-vigencia" aria-label={desde != null ? texto : "Todavía sin aplicar"}>
      <span className="tr-via">
        {desde != null && (
          <i
            data-estado={levantado ? "levantado" : undefined}
            style={{
              left: `${fraccion(desde, fin) * 100}%`,
              width: `${Math.max(0.6, (fraccion(hasta, fin) - fraccion(desde, fin)) * 100)}%`,
            }}
          />
        )}
        {!finalizado && <b style={{ left: `${fraccion(ahora, fin) * 100}%` }} />}
      </span>
      <small className="num">{texto}</small>
    </span>
  );
}

/** "Juzgado de Garantías N.º 3, Dra. Laura Ficticia": sin el distrito, que se repetiría en cada fila. El nombre no se parte. */
function Ordeno({ f }: { f: Fila }) {
  if (!f.juzgado && !f.juez) return <>—</>;
  const juzgado = f.juzgado ? juzgadoBreve(f.juzgado).split(/,\s*Distrito/i)[0]!.trim() : "";
  const juez = f.juez ? sinFicticio(f.juez) : "";
  return (
    <>
      {juzgado}
      {juzgado && juez ? ", " : ""}
      {juez && <span className="sin-corte">{juez}</span>}
    </>
  );
}

/** Sin bloqueos todavía: la escala del partido con el ahora, y lo que va a aparecer. */
function SinBloqueos({ fin, ahora, finalizado }: { fin: number; ahora: number; finalizado: boolean }) {
  const [ref, ancho] = useAncho<HTMLDivElement>();
  return (
    <div className="tr-vacio">
      <div ref={ref} className="tr-vacio-regla" aria-hidden="true">
        <span className="tr-via">{!finalizado && <b style={{ left: `${fraccion(ahora, fin) * 100}%` }} />}</span>
        <MarcasRegla fin={fin} ancho={ancho} cada={ancho > 0 && ancho < 420 ? 30 : 15} />
      </div>
      <p>{finalizado ? "No se ordenó ningún bloqueo en este partido." : "Todavía no se ordenó ningún bloqueo. Cada bloqueo que ordene un juez aparece acá, con su vigencia."}</p>
    </div>
  );
}

export function Transparencia() {
  useFondo("aluminio");
  useTitulo("Offside, registro público de bloqueos");
  const sesion = useSesion();
  const { datos: t, error, sinServidor } = useVivo<TransparenciaDTO>("/api/transparencia", {
    publica: true,
    alRecibir: (d) => {
      if (d.estado) sincronizarReloj(d.estado);
    },
  });
  const estado = t?.estado ?? null;
  const minuto = useMinuto(200);

  if (!t) {
    return (
      <div className="transparencia">
        <Cortes estado={null} sinServidor={sinServidor} />
        <Cargando texto={error && error.codigo !== 0 ? error.message : "Conectando con Offside…"} />
      </div>
    );
  }
  const fin = t.fin_min || 105;
  const ahora = t.finalizado ? fin : Math.min(estado ? minuto : t.minuto, fin);
  const filas = unir(t.bloqueos as Bloqueo[]);

  return (
    <div className="transparencia">
      <header className="tr-cabeza">
        <div className="tr-cabeza-izq">
          <Marca />
          <span className="tb-sep" aria-hidden="true" />
          <p className="tb-partido">
            <b>{partidoBreve(t.partido?.nombre) || "Sin partido"}</b>
            {t.partido?.titular_derechos && <span>{sinFicticio(t.partido.titular_derechos)}</span>}
          </p>
        </div>
        <p className="tr-minuto">
          {estado ? <RelojPartido estado={estado} minuto={ahora} /> : <span className="cifra">{reloj(t.finalizado ? fin : t.minuto)}</span>}
          <small>de {minutoEntero(fin)}′</small>
        </p>
      </header>
      <Cortes estado={null} sinServidor={sinServidor} />

      <main className="tr-cuerpo">
        <div className="tr-titular">
          <h1>Bloqueos ordenados durante el partido</h1>
          <p>
            {t.finalizado ? `El partido terminó: todos vencieron a los ${minutoEntero(fin)}′.` : `Todos vencen solos a los ${minutoEntero(fin)}′.`}
          </p>
        </div>

        <section className="tr-panel" aria-label="Bloqueos">
          {filas.length === 0 ? (
            <SinBloqueos fin={fin} ahora={ahora} finalizado={t.finalizado} />
          ) : (
            <table className="tr-tabla">
              <thead>
                <tr>
                  <th>Objetivo</th>
                  <th>Vigencia</th>
                  <th>Estado</th>
                  <th>Ordenó</th>
                  <th>Huella</th>
                  <th>Proveedores</th>
                </tr>
              </thead>
              <tbody>
                {filas.map((f) => {
                  const e = ESTADO[f.estado];
                  return (
                    <tr key={f.clave} data-estado={f.estado}>
                      <td className="tr-objetivo">
                        <b>{f.objetivo}</b>
                        <small>{f.ademas ?? TIPO[f.tipo]}</small>
                      </td>
                      <td>
                        <Vigencia f={f} fin={fin} ahora={ahora} finalizado={t.finalizado} />
                      </td>
                      <td>
                        <span className="estado-orden" data-tinta={e.tinta}>
                          <Luz tono={e.luz} />
                          {e.rotulo}
                        </span>
                      </td>
                      <td className="tr-ordeno">
                        <Ordeno f={f} />
                      </td>
                      <td>
                        <Huella valor={f.huella} caracteres={16} className="tr-huella" />
                      </td>
                      <td className="tr-prov num">
                        {f.confirmados} de {f.total}
                        <span className="tr-solo-movil"> {f.total === 1 ? "proveedor" : "proveedores"}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </section>

        <footer className="tr-pie">
          <div className="tr-cadena">
            <p>
              Registro encadenado: <span className="num">{plural(t.auditoria.entradas, "entrada", "entradas")}</span>. Cabecera
            </p>
            <HashCompleto valor={t.auditoria.cabecera} />
          </div>
          <p>{t.como_reclamar}</p>
          <p className="tr-ficticio">
            Nombres, IPs y juzgados ficticios del simulador oficial del desafío.{" "}
            {sesion ? <Link to="/">Volver a Offside</Link> : <Link to="/ingreso">Ingreso de jueces y fiscalía</Link>}
          </p>
        </footer>
      </main>
    </div>
  );
}
