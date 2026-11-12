// Registro público, sin ingreso: qué se bloqueó, desde cuándo, hasta cuándo,
// por orden de quién y con qué huella.

import { Link } from "react-router-dom";
import type { EstadoDTO, TransparenciaDTO } from "../../compartido/tipos.ts";
import { Cargando, Cortes, Huella, Luz, Marca, RelojPartido, useTema, useTitulo } from "../componentes/comunes.tsx";
import { TIPO, juzgadoBreve, minuto, numero, plural } from "../nucleo/formato.ts";
import { sincronizarReloj } from "../nucleo/reloj.ts";
import { inicioDe, useSesion } from "../nucleo/sesion.ts";
import { useVivo } from "../nucleo/vivo.ts";

type Bloqueo = TransparenciaDTO["bloqueos"][number];

const ESTADO: Record<Bloqueo["estado"], { rotulo: string; clase: string }> = {
  vigente: { rotulo: "Vigente", clase: "text-verde" },
  en_curso: { rotulo: "En curso", clase: "text-ambar" },
  vencido: { rotulo: "Vencido", clase: "text-tinta-2" },
  levantado: { rotulo: "Levantado", clase: "text-tinta-2" },
};

const ORDEN: Record<Bloqueo["estado"], number> = { vigente: 0, en_curso: 1, levantado: 2, vencido: 3 };

export function Transparencia() {
  useTema("papel");
  useTitulo("Offside · Registro público de bloqueos");
  const sesion = useSesion();
  const { datos: t, error, sinServidor } = useVivo<TransparenciaDTO>("/api/transparencia", { publica: true });
  const { datos: estado } = useVivo<EstadoDTO>("/api/estado", { publica: true, alRecibir: sincronizarReloj });

  const bloqueos = t ? [...t.bloqueos].sort((a, b) => ORDEN[a.estado] - ORDEN[b.estado] || (b.desde_min ?? 0) - (a.desde_min ?? 0)) : [];
  const vigentes = bloqueos.filter((b) => b.estado === "vigente" || b.estado === "en_curso").length;

  return (
    <div className="min-h-dvh pb-12">
      <header className="border-b-2 border-tinta bg-papel">
        <div className="mx-auto flex max-w-[1040px] items-center gap-3 px-4 py-2.5 sm:px-6">
          <Marca className="text-[1.5rem]" />
          <div className="flex-1" />
          {estado && (
            <p className="m-0 flex items-baseline gap-1.5 leading-none">
              <span className="text-[0.8125rem] font-medium text-tinta-2">{estado.finalizado ? "Final" : "Minuto"}</span>
              <RelojPartido estado={estado} className="angosta min-w-[4.2ch] text-right text-[1.625rem] font-extrabold" />
            </p>
          )}
          <Link to={sesion ? inicioDe(sesion.usuario.rol) : "/ingreso"} className="enlace ml-2 text-[0.9375rem] font-semibold">
            {sesion ? "Volver" : "Ingresar"}
          </Link>
        </div>
      </header>
      <Cortes estado={estado} sinServidor={sinServidor} />

      <main className="mx-auto max-w-[1040px] px-4 sm:px-6">
        <h1 className="m-0 mt-8 max-w-[22ch] font-serif text-[2rem] font-semibold leading-[1.1] sm:text-[2.75rem]">Registro público de bloqueos</h1>
        <p className="m-0 mt-3 max-w-[62ch] font-serif text-[1.125rem] leading-[1.5]">
          Qué está bloqueado, desde cuándo, hasta cuándo y por orden de qué juzgado. Se actualiza solo durante el partido y no pide usuario.
        </p>
        {t?.partido && (
          <p className="m-0 mt-3 text-[0.9375rem] leading-snug text-tinta-2">
            {t.partido.nombre}
            {t.partido.titular_derechos ? `. Titular de derechos: ${t.partido.titular_derechos}.` : ""}
          </p>
        )}

        {!t ? (
          <Cargando texto={error && error.codigo !== 0 ? error.message : "Cargando el registro…"} />
        ) : (
          <>
            <section className="mt-8" aria-label="Bloqueos">
              <h2 className="m-0 text-[1.25rem] font-extrabold leading-tight">
                {bloqueos.length === 0
                  ? "Todavía no hay bloqueos"
                  : t.finalizado
                    ? `Terminó el partido: ${plural(bloqueos.length, "bloqueo registrado", "bloqueos registrados")}, ninguno vigente`
                    : `${plural(vigentes, "bloqueo vigente", "bloqueos vigentes")} de ${bloqueos.length} en el registro`}
              </h2>
              {bloqueos.length === 0 ? (
                <p className="m-0 mt-2 max-w-[62ch] text-tinta-2">Cuando un juez firme una medida y un proveedor la aplique, aparece acá con su huella.</p>
              ) : (
                <ul className="m-0 mt-3 list-none border-b border-tinta p-0">
                  {bloqueos.map((b) => (
                    <FilaBloqueo key={`${b.expediente_id}|${b.tipo}|${b.objetivo}`} b={b} />
                  ))}
                </ul>
              )}
            </section>

            <div className="mt-10 grid gap-10 md:grid-cols-2">
              <section aria-label="Cómo reclamar">
                <h2 className="m-0 text-[1.25rem] font-extrabold leading-tight">Si tu sitio quedó bloqueado</h2>
                <p className="m-0 mt-2 max-w-[56ch] font-serif text-[1.0625rem] leading-[1.55]">{t.como_reclamar}</p>
              </section>
              <section aria-label="Auditoría">
                <h2 className="m-0 text-[1.25rem] font-extrabold leading-tight">Cómo comprobar este registro</h2>
                <p className="m-0 mt-2 max-w-[56ch] font-serif text-[1.0625rem] leading-[1.55]">
                  Cada paso queda en un registro encadenado de {plural(t.auditoria.entradas, "entrada", "entradas")}. Este es el hash de la última: si alguien
                  altera un dato anterior, deja de coincidir.
                </p>
                <p className="m-0 mt-2 break-all border-l-[3px] border-tinta bg-hundido px-3 py-2 font-mono text-[0.875rem] leading-snug">{t.auditoria.cabecera || "sin entradas"}</p>
              </section>
            </div>
          </>
        )}

        <p className="m-0 mt-12 border-t border-regla pt-4 text-[0.8125rem] leading-snug text-tinta-3">
          Hackathon Argentina Space 2026, Desafío Fútbol. Jueces, juzgados, proveedores y dominios son ficticios: los provee el simulador oficial.
        </p>
      </main>
    </div>
  );
}

function FilaBloqueo({ b }: { b: Bloqueo }) {
  const estado = ESTADO[b.estado];
  return (
    <li className="grid gap-x-8 gap-y-2 border-t border-tinta py-4 md:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
      <div className="min-w-0">
        <p className="m-0 flex items-center gap-2 leading-tight">
          {b.estado === "vigente" && <Luz luz="verde" tam={18} />}
          {b.estado === "en_curso" && <Luz luz="ambar" tam={18} />}
          <span className={`font-extrabold ${estado.clase}`}>{estado.rotulo}</span>
          <span className="text-[0.9375rem] text-tinta-2">Bloqueo por {TIPO[b.tipo] === "IP" ? "IP" : "dominio"}</span>
        </p>
        <p className="m-0 mt-1 wrap-anywhere text-[1.375rem] font-bold leading-tight">{b.objetivo}</p>
        <p className="cifras m-0 mt-1.5 leading-snug">
          {b.desde_min == null ? "Todavía sin aplicar" : `Desde el minuto ${minuto(b.desde_min)}`}
          {b.estado === "vencido" ? `. Venció en el minuto ${numero(b.hasta_min)}` : b.estado === "levantado" ? ". Levantado por orden del juez" : `. Vence en el minuto ${numero(b.hasta_min)}`}
          .
        </p>
        <p className="m-0 text-[0.9375rem] leading-snug text-tinta-2">
          {b.proveedores_confirmados} de {plural(b.proveedores_total, "proveedor lo confirmó", "proveedores lo confirmaron")}.
        </p>
      </div>
      <dl className="m-0 grid content-start gap-y-1.5 text-[0.9375rem] leading-snug">
        <div>
          <dt className="text-[0.8125rem] font-medium text-tinta-2">Por orden de</dt>
          <dd className="m-0">
            <span className="font-semibold">{b.juez ?? "Sin datos del juez"}</span>
            {b.juzgado && <span className="block text-tinta-2">{juzgadoBreve(b.juzgado)}</span>}
          </dd>
        </div>
        <div>
          <dt className="text-[0.8125rem] font-medium text-tinta-2">Expediente y huella de la medida</dt>
          <dd className="m-0">
            <span className="huella font-semibold">{b.expediente_id}</span> <span className="huella text-tinta-2">{b.medida_id}</span>
            <Huella valor={b.huella} largo={32} className="block text-tinta-2" />
          </dd>
        </div>
      </dl>
    </li>
  );
}
