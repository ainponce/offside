// Tablero en vivo: se proyecta durante el pitch (1440 px). Una fila por servidor,
// agrupadas por filtración; una celda por proveedor. Los únicos colores son los estados.

import { Link } from "react-router-dom";
import type { EstadoCelda, EstadoDTO, ExpedienteResumenDTO, ServidorDTO, TableroDTO, TipoBloqueo } from "../../compartido/tipos.ts";
import { Cargando, Cortes, Huella, Marca, useTema, useTitulo } from "../componentes/comunes.tsx";
import {
  ESTADO_EXPEDIENTE,
  ESTADO_ORDEN,
  TIPO,
  VEREDICTO,
  clientes,
  juzgadoBreve,
  minuto,
  nombreBreve,
  numero,
  plural,
  reloj,
  sinFicticio,
} from "../nucleo/formato.ts";
import { sincronizarReloj, useMinuto } from "../nucleo/reloj.ts";
import { salir, useSesion } from "../nucleo/sesion.ts";
import { useFlujoAbierto, useVivo } from "../nucleo/vivo.ts";

type Proveedor = TableroDTO["proveedores"][number];

export function Tablero() {
  useTema("noche");
  useTitulo("Offside · Tablero");
  const sesion = useSesion();
  const flujo = useFlujoAbierto();
  const { datos: t, error, sinServidor } = useVivo<TableroDTO>("/api/tablero", { alRecibir: (d) => sincronizarReloj(d.estado) });

  if (!t) {
    return (
      <div className="min-h-dvh">
        <Cortes estado={null} sinServidor={sinServidor} />
        <Cargando texto={error && error.codigo !== 0 ? error.message : "Cargando el tablero…"} />
      </div>
    );
  }

  const enVivo = flujo && !sinServidor && t.estado.conectado;
  // La primera columna se achica un poco en proyectores de 1280 px para que la matriz entre sin desplazar.
  const columnas = `minmax(clamp(236px, 19vw, 280px), 1.25fr) repeat(${t.proveedores.length}, minmax(100px, 1fr)) 124px`;

  return (
    <div className="min-h-dvh pb-10">
      <header className="border-b border-regla">
        <div className="mx-auto flex max-w-[1760px] flex-wrap items-center gap-x-6 gap-y-2 px-6 py-3 3xl:px-10">
          <Marca className="text-[1.75rem]" />
          <p className="m-0 min-w-[12rem] flex-1 truncate text-tinta-2" title={t.estado.partido?.nombre ?? undefined}>
            {t.estado.partido?.nombre ?? "Sin partido"}
          </p>
          <Turno estado={t.estado} />
          <span className="flex flex-none items-center gap-2 font-semibold" role="status">
            <span aria-hidden="true" className={`inline-block size-2.5 rounded-full ${enVivo ? "animate-latir bg-firma" : "border-2 border-tinta-3"}`} />
            {enVivo ? "En vivo" : sinServidor ? "Sin conexión" : !t.estado.conectado ? "Sin simulador" : "Reconectando"}
          </span>
          <nav className="flex flex-none items-center gap-4 text-[0.9375rem]">
            {sesion?.usuario.rol === "juez" && (
              <Link to="/juez" className="enlace font-semibold">
                Mi cola
              </Link>
            )}
            <Link to="/transparencia" className="enlace font-semibold">
              Registro público
            </Link>
            <button type="button" className="boton boton-chico" onClick={() => void salir()}>
              Salir
            </button>
          </nav>
        </div>
      </header>
      <Cortes estado={t.estado} sinServidor={sinServidor} />

      <div className="mx-auto max-w-[1760px] px-6 3xl:px-10">
        <Marcador t={t} />
        {t.estado.alertas.length > 0 && <Alertas alertas={t.estado.alertas} />}

        <div className="mt-5 grid gap-x-10 gap-y-8 xl:grid-cols-[minmax(0,1fr)_360px] min-[1440px]:grid-cols-[minmax(0,1fr)_392px] 3xl:grid-cols-[minmax(0,1fr)_460px]">
          <div className="min-w-0">
            <section aria-label="Filtraciones y proveedores">
              <div className="overflow-x-auto">
                <div className="min-w-[780px]">
                  <div className="grid items-end gap-x-2 pb-2" style={{ gridTemplateColumns: columnas }}>
                    <h2 className="m-0 text-[1.25rem] font-extrabold leading-tight">
                      Filtraciones
                      <span className="ml-3 text-[0.9375rem] font-normal text-tinta-2">una fila por servidor, una celda por proveedor</span>
                    </h2>
                    {t.proveedores.map((p) => (
                      <EncabezadoProveedor key={p.id} p={p} total={t.proveedores.reduce((a, x) => a + x.clientes, 0)} />
                    ))}
                    <p className="m-0 text-right text-[0.8125rem] leading-tight text-tinta-2">Clientes cubiertos y demora del primer bloqueo</p>
                  </div>

                  {t.expedientes.length === 0 ? (
                    <p className="m-0 border-t border-regla py-10 text-[1.0625rem] text-tinta-2">
                      Todavía no se detectó ninguna filtración. Cuando aparezca una retransmisión, se abre su expediente acá.
                    </p>
                  ) : (
                    t.expedientes.map((e) => <Carril key={e.id} e={e} proveedores={t.proveedores} columnas={columnas} finalizado={t.estado.finalizado} />)
                  )}
                </div>
              </div>
              <Leyenda />
            </section>

            <div className="mt-10 grid gap-8 lg:grid-cols-2">
              <Archivadas t={t} />
              <Reclamos t={t} />
            </div>
          </div>

          <aside className="grid min-w-0 content-start gap-8">
            <DanoEvitado t={t} />
            <Auditoria t={t} />
          </aside>
        </div>

        <p className="m-0 mt-10 border-t border-regla pt-3 text-[0.8125rem] text-tinta-3">
          Jueces, juzgados, proveedores y dominios son ficticios: los provee el simulador oficial del Desafío Fútbol.
        </p>
      </div>
    </div>
  );
}

// --- cabecera y marcador ---------------------------------------------------------------------------

function Turno({ estado }: { estado: EstadoDTO }) {
  const jueces = estado.jueces_de_turno;
  return (
    <p className="m-0 flex-none text-right leading-tight">
      <span className="block text-[0.8125rem] text-tinta-2">{estado.finalizado ? "Partido terminado. Último turno" : "Juez de turno"}</span>
      {jueces.length > 0 ? (
        <span className="block font-bold">
          {jueces.map((j) => j.nombre).join(", ")}
          <span className="ml-2 font-normal text-tinta-2">{juzgadoBreve(jueces[0]!.juzgado_nombre)}</span>
        </span>
      ) : (
        <span className="block font-bold">Nadie de turno</span>
      )}
    </p>
  );
}

/** Una franja: reloj y avance del partido a la izquierda, cifras clave a la derecha. */
function Marcador({ t }: { t: TableroDTO }) {
  const m = t.metricas;
  return (
    <section className="grid items-end gap-x-10 gap-y-5 border-b border-regla pb-4 pt-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]" aria-label="Estado del partido">
      <RelojConAvance t={t} />
      <dl className="m-0 grid grid-cols-2 gap-y-4 sm:grid-cols-4">
        <Cifra
          rotulo="De la detección al primer bloqueo"
          valor={m.tiempo_medio_primer_bloqueo_min == null ? "—" : numero(m.tiempo_medio_primer_bloqueo_min, 1)}
          unidad={m.tiempo_medio_primer_bloqueo_min == null ? "" : "min"}
          nota="promedio, en minutos de partido"
        />
        {t.estado.finalizado ? (
          <Cifra rotulo="Cobertura media" valor="—" nota="los bloqueos vencieron con el final" />
        ) : (
          <Cifra
            rotulo="Cobertura media"
            valor={m.cobertura_media_pct == null ? "—" : numero(m.cobertura_media_pct, m.cobertura_media_pct % 1 === 0 ? 0 : 1)}
            unidad={m.cobertura_media_pct == null ? "" : "%"}
            nota="de los clientes, por servidor firmado"
          />
        )}
        <Cifra rotulo="Medidas pendientes" valor={numero(m.medidas_pendientes)} nota={m.medidas_pendientes === 1 ? "espera al juez de turno" : "esperan al juez de turno"} />
        <Cifra rotulo="Órdenes activas" valor={numero(m.ordenes_activas)} nota="recibidas o aplicadas ahora" />
      </dl>
      <p className="m-0 text-[0.9375rem] text-tinta-2 xl:col-span-2">
        {plural(m.detecciones, "detección", "detecciones")} en {plural(m.expedientes, "expediente", "expedientes")}.{" "}
        {plural(m.archivadas, "archivada", "archivadas")} sin llegar al juez. {plural(m.reclamos, "reclamo", "reclamos")}. Todo bloqueo vence en el minuto{" "}
        {numero(t.estado.fin_min)}.{t.estado.acelerar !== 1 ? ` Simulador a ${numero(t.estado.acelerar, t.estado.acelerar % 1 === 0 ? 0 : 1)}×.` : ""}
      </p>
    </section>
  );
}

function RelojConAvance({ t }: { t: TableroDTO }) {
  const e = t.estado;
  const ahora = useMinuto(200);
  const m = e.finalizado ? e.fin_min : ahora;
  const fin = e.fin_min > 0 ? e.fin_min : 1;
  const avance = Math.min(100, Math.max(0, (m / fin) * 100));
  const marcas: number[] = [];
  for (let x = 0; x <= fin; x += 15) marcas.push(x);
  const saltos = t.expedientes.flatMap((x) => x.servidores.map((s) => s.primera_deteccion_min));
  return (
    <div className="flex items-end gap-6">
      <p className="m-0 flex-none leading-none">
        <span className="block text-[0.8125rem] text-tinta-2">{e.finalizado ? "Final del partido" : "Minuto de partido"}</span>
        <span className="muy-angosta cifras mt-1 block min-w-[4.3ch] text-[4.5rem] font-extrabold leading-[0.9]" role="timer">
          {reloj(m)}
        </span>
      </p>
      <div className="min-w-0 flex-1 pb-1.5">
        <div className="relative h-9" aria-hidden="true">
          {saltos.map((s, i) => (
            <span key={`${s}|${i}`} className="absolute top-[7px] size-[7px] -translate-x-1/2 rounded-full border-[1.5px] border-tinta-2" style={{ left: `${Math.min(100, (s / fin) * 100)}%` }} />
          ))}
          <div className="absolute inset-x-0 bottom-0 h-[6px] bg-regla" />
          <div className="absolute bottom-0 left-0 h-[6px] bg-tinta" style={{ width: `${avance}%` }} />
          <div className="absolute bottom-[-5px] top-0 w-[3px] -translate-x-1/2 bg-firma" style={{ left: `${avance}%` }} />
        </div>
        <div className="relative mt-1.5 h-4 text-[0.75rem] text-tinta-3" aria-hidden="true">
          {marcas.map((x) => (
            <span key={x} className="cifras absolute -translate-x-1/2 first:translate-x-0" style={{ left: `${(x / fin) * 100}%` }}>
              {x}
            </span>
          ))}
          {marcas[marcas.length - 1] !== fin && <span className="cifras absolute right-0">{fin}</span>}
        </div>
        <p className="m-0 mt-1 text-[0.8125rem] text-tinta-3">Cada punto es un servidor nuevo detectado.</p>
      </div>
    </div>
  );
}

function Cifra(p: { rotulo: string; valor: string; unidad?: string; nota: string }) {
  return (
    <div className="row-span-3 grid min-w-0 grid-rows-subgrid gap-y-1 border-l border-regla pl-4 first:border-l-0 first:pl-0 max-sm:odd:border-l-0 max-sm:odd:pl-0">
      <dt className="self-end text-[0.8125rem] leading-tight text-tinta-2">{p.rotulo}</dt>
      <dd className="m-0 whitespace-nowrap leading-none">
        <span className="angosta cifras text-[2.75rem] font-extrabold leading-none">{p.valor}</span>
        {p.unidad && <span className="angosta ml-1.5 text-[1.25rem] font-bold">{p.unidad}</span>}
      </dd>
      <dd className="m-0 text-[0.8125rem] leading-tight text-tinta-3">{p.nota}</dd>
    </div>
  );
}

/** Los sitios legítimos que comparten IP con un servidor pirata y siguen en línea. Es el punto del pitch. */
function DanoEvitado({ t }: { t: TableroDTO }) {
  const { sitios, senales_legitimas: senales } = t.metricas.dano_evitado;
  const muchos = sitios.length > 18;
  return (
    <section className="flex min-w-0 gap-4" aria-label="Daño evitado">
      <span className="linea-offside" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <h2 className="m-0 flex items-end gap-3 leading-none">
          <span className="muy-angosta cifras text-[4.5rem] font-extrabold leading-[0.82] text-firma">{numero(sitios.length)}</span>
          <span className="pb-0.5 text-[1.5rem] font-extrabold leading-none">Daño evitado</span>
        </h2>
        <p className="m-0 mt-2 text-[0.9375rem] leading-snug text-tinta-2">
          {sitios.length === 1 ? "Sitio legítimo que habría caído" : "Sitios legítimos que habrían caído"} con un bloqueo automático por IP. Siguen en línea.
        </p>
        {sitios.length === 0 ? (
          <p className="m-0 mt-3 leading-snug text-tinta-2">Hasta ahora ningún servidor pirata comparte IP con sitios ajenos.</p>
        ) : (
          <ul className={`m-0 mt-3 list-none p-0 font-semibold ${muchos ? "columns-2 gap-x-5 text-[0.875rem] leading-[1.5]" : "text-[1.0625rem] leading-[1.45]"}`}>
            {sitios.map((s) => (
              <li key={s} className="truncate" title={s}>
                {s}
              </li>
            ))}
          </ul>
        )}
        {senales.length > 0 && (
          <p className="m-0 mt-3 text-[0.875rem] leading-snug text-tinta-2">
            {senales.length === 1 ? "Señal legítima reconocida y no tocada:" : "Señales legítimas reconocidas y no tocadas:"}{" "}
            <span className="font-semibold text-tinta wrap-anywhere">{senales.join(", ")}</span>
          </p>
        )}
      </div>
    </section>
  );
}

function Alertas({ alertas }: { alertas: string[] }) {
  return (
    <section role="alert" className="mt-5 flex items-stretch border-2 border-tinta" aria-label="Alertas">
      <span aria-hidden="true" className="rayado w-5 flex-none" />
      <ul className="m-0 flex-1 list-none px-4 py-2.5 text-[1.0625rem] font-semibold leading-snug">
        {alertas.map((a, i) => (
          <li key={`${a}|${i}`}>{a}</li>
        ))}
      </ul>
    </section>
  );
}

// --- matriz ---------------------------------------------------------------------------------------------

function EncabezadoProveedor({ p, total }: { p: Proveedor; total: number }) {
  const parte = total > 0 ? (100 * p.clientes) / total : 0;
  return (
    <div className="min-w-0 leading-tight" title={`${sinFicticio(p.nombre)}: ${clientes(p.clientes)} clientes`}>
      <p className="angosta m-0 truncate text-[1.0625rem] font-extrabold">{nombreBreve(p.nombre)}</p>
      <p className="cifras m-0 text-[0.8125rem] text-tinta-2">
        {numero(parte, parte < 10 ? 1 : 0)} % <span className="text-tinta-3">{p.capacidades.length === 1 ? `solo ${TIPO[p.capacidades[0]!].toLowerCase()}` : ""}</span>
      </p>
      <div className="mt-1 h-[3px] bg-regla" aria-hidden="true">
        <div className="h-full bg-tinta-2" style={{ width: `${Math.max(parte, 1.5)}%` }} />
      </div>
    </div>
  );
}

const ESTILO_LANE: Record<ExpedienteResumenDTO["estado"], string> = {
  activo: "text-tinta",
  pendiente: "text-firma",
  rechazado: "text-tinta-2",
  cerrado: "text-tinta-2",
};

/** Un expediente: la filtración (su marca) y los servidores por los que fue saltando. */
function Carril({ e, proveedores, columnas, finalizado }: { e: ExpedienteResumenDTO; proveedores: Proveedor[]; columnas: string; finalizado: boolean }) {
  return (
    <section className="border-t-2 border-tinta-3 pb-3 pt-2.5" aria-label={`Expediente ${e.id}`}>
      <header className="flex flex-wrap items-baseline gap-x-5 gap-y-1">
        <h3 className="m-0 font-mono text-[1.1875rem] font-semibold leading-tight">{e.marca}</h3>
        <Link to={`/expediente/${encodeURIComponent(e.id)}`} className="enlace huella text-[0.9375rem]">
          {e.id}
        </Link>
        <span className={`font-bold ${ESTILO_LANE[e.estado]}`}>{ESTADO_EXPEDIENTE[e.estado]}</span>
        <span className="text-[0.9375rem] text-tinta-2">
          {e.servidores.length === 1 ? "1 servidor" : `${e.servidores.length} servidores: saltó ${plural(e.servidores.length - 1, "vez", "veces")}`}
        </span>
        <span className="cifras ml-auto hidden text-[0.875rem] text-tinta-3 min-[1440px]:inline">abierto en el min {minuto(e.abierto_min)}</span>
      </header>
      <ol className="m-0 mt-2 list-none p-0">
        {e.servidores.map((s, i) => (
          <FilaServidor key={s.id} s={s} orden={i + 1} ultimo={i === e.servidores.length - 1} proveedores={proveedores} columnas={columnas} finalizado={finalizado} />
        ))}
      </ol>
    </section>
  );
}

function FilaServidor(p: { s: ServidorDTO; orden: number; ultimo: boolean; proveedores: Proveedor[]; columnas: string; finalizado: boolean }) {
  const { s } = p;
  const celdas = new Map(s.por_proveedor.map((c) => [c.proveedor_id, c]));
  const firmada = s.medida_estado === "aprobada";
  // Terminado el partido la cobertura vuelve a cero porque todo venció: se dice eso, no "0 %".
  const vencido = p.finalizado && s.cobertura_pct === 0 && s.por_proveedor.some((c) => c.estado === "vencida");
  return (
    <li className="grid items-stretch gap-x-2" style={{ gridTemplateColumns: p.columnas }}>
      <div className="relative flex min-w-0 gap-3 py-1.5">
        {!p.ultimo && <span aria-hidden="true" className="absolute bottom-[-6px] left-[12px] top-[30px] w-[2px] bg-tinta-3" />}
        <span
          aria-hidden="true"
          className={`cifras relative mt-[3px] grid size-[26px] flex-none place-items-center rounded-full text-[0.8125rem] font-bold ${
            firmada ? "bg-tinta text-mesa" : "border-2 border-tinta-3 text-tinta-2"
          }`}
        >
          {p.orden}
        </span>
        <div className="min-w-0 flex-1 leading-tight">
          <p className="m-0 truncate text-[1.0625rem] font-bold" title={s.host}>
            {s.host}
          </p>
          <p className="m-0 mt-0.5 truncate text-[0.8125rem] text-tinta-2">
            <span className="huella">{s.ip}</span>
            <span className="cifras ml-2.5">min {minuto(s.primera_deteccion_min)}</span>
            <span className="ml-2.5 hidden min-[1440px]:inline">{plural(s.detecciones, "detección", "detecciones")}</span>
          </p>
          {s.terceros.length > 0 && (
            <p className="m-0 mt-0.5 truncate text-[0.8125rem] font-semibold text-firma" title={s.terceros.join(", ")}>
              {s.tipo_recomendado === "dominio"
                ? `${plural(s.terceros.length, "sitio ajeno", "sitios ajenos")} a salvo`
                : `${plural(s.terceros.length, "sitio ajeno", "sitios ajenos")} en la IP`}
            </p>
          )}
        </div>
      </div>

      {p.proveedores.map((prov) => {
        const c = celdas.get(prov.id);
        return <Celda key={prov.id} estado={c?.estado ?? "sin_orden"} tipo={c?.tipo ?? null} intento={c?.intento ?? 0} medida={s.medida_estado} />;
      })}

      <div className="flex flex-col items-end justify-center py-1.5 leading-tight">
        {firmada ? (
          <>
            <span className={`angosta cifras text-[1.5rem] font-extrabold leading-none ${vencido ? "text-tinta-2" : ""}`}>
              {vencido ? "Venció" : `${numero(s.cobertura_pct, s.cobertura_pct % 1 === 0 ? 0 : 1)} %`}
            </span>
            <span className="cifras mt-1 text-[0.8125rem] text-tinta-2">
              {s.primer_bloqueo_min == null ? "sin bloqueo todavía" : `demora ${numero(s.primer_bloqueo_min, 1)} min`}
            </span>
          </>
        ) : (
          <span className={`text-[0.9375rem] font-bold ${s.medida_estado === "pendiente" ? "text-firma" : "text-tinta-2"}`}>
            {s.medida_estado === "pendiente" ? "Espera la firma" : s.medida_estado === "rechazada" ? "Rechazada" : s.medida_estado === "sin_efecto" ? "Sin efecto" : "Sin medida"}
          </span>
        )}
      </div>
    </li>
  );
}

const CELDA: Record<EstadoCelda, string> = {
  aplicada: "bg-verde-luz text-[#052814]",
  recibida: "bg-ambar-suave text-ambar ring-2 ring-inset ring-ambar-luz",
  por_enviar: "text-ambar border-2 border-dashed border-ambar-luz",
  fallida: "bg-roja-suave text-roja ring-2 ring-inset ring-roja-luz",
  rechazada: "bg-roja-suave text-roja ring-2 ring-inset ring-roja-luz",
  no_enviada: "bg-roja-suave text-roja ring-2 ring-inset ring-roja-luz",
  vencida: "text-tinta-2 ring-1 ring-inset ring-regla",
  levantada: "text-tinta-2 ring-1 ring-inset ring-regla",
  sin_cobertura: "rayado-suave text-tinta-2 ring-1 ring-inset ring-regla",
  sin_orden: "text-tinta-3 border border-dashed border-regla",
};

const INTENTO = "angosta cifras rounded-full border border-tinta-2 bg-mesa px-1.5 text-[0.75rem] font-bold leading-[1.35] text-tinta";

function Celda(p: { estado: EstadoCelda; tipo: TipoBloqueo | null; intento: number; medida: ServidorDTO["medida_estado"] }) {
  let rotulo = ESTADO_ORDEN[p.estado].rotulo;
  if (p.estado === "sin_orden") rotulo = p.medida === "pendiente" ? "Espera firma" : "Sin orden";
  const tipo = p.tipo ? (p.tipo === "ip" ? "por IP" : "por dominio") : null;
  return (
    <div className="relative py-1.5" title={p.intento > 1 ? `Intento ${p.intento}: la orden anterior falló y se reenvió con una nueva` : undefined}>
      <div className={`flex h-full min-h-[46px] flex-col justify-center rounded-[4px] px-2.5 leading-tight transition-colors duration-300 ${CELDA[p.estado]}`}>
        <span className="angosta truncate text-[1rem] font-extrabold">{rotulo}</span>
        {tipo && <span className="angosta truncate text-[0.8125rem] font-semibold opacity-85">{tipo}</span>}
      </div>
      {/* El número de intento va montado sobre la esquina, para no quitarle lugar al estado. */}
      {p.intento > 1 && <span className={`absolute right-[-3px] top-0 ${INTENTO}`}>{p.intento}.º</span>}
    </div>
  );
}

function Leyenda() {
  const items: { estado: EstadoCelda; texto: string }[] = [
    { estado: "por_enviar", texto: "firmada, saliendo" },
    { estado: "recibida", texto: "el proveedor la tiene" },
    { estado: "aplicada", texto: "bloqueo activo" },
    { estado: "fallida", texto: "se reenvía con una orden nueva" },
    { estado: "vencida", texto: "terminó con el partido" },
    { estado: "sin_cobertura", texto: "no se envía para no afectar a terceros" },
  ];
  return (
    <ul className="m-0 mt-3 flex list-none flex-wrap gap-x-6 gap-y-2 border-t border-regla p-0 pt-3 text-[0.8125rem] text-tinta-2">
      {items.map((i) => (
        <li key={i.estado} className="flex items-center gap-2">
          <span className={`angosta inline-block rounded-[3px] px-1.5 py-[1px] text-[0.8125rem] font-extrabold ${CELDA[i.estado]}`}>{ESTADO_ORDEN[i.estado].rotulo}</span>
          {i.texto}
        </li>
      ))}
      <li className="flex items-center gap-2">
        <span className={`inline-block ${INTENTO}`}>2.º</span>
        segundo intento, tras una falla
      </li>
    </ul>
  );
}

// --- paneles ------------------------------------------------------------------------------------------------

function Archivadas({ t }: { t: TableroDTO }) {
  return (
    <section aria-label="Detecciones archivadas">
      <h2 className="m-0 text-[1.25rem] font-extrabold leading-tight">
        Archivadas sin llegar al juez <span className="cifras font-normal text-tinta-2">{t.archivadas.length}</span>
      </h2>
      {t.archivadas.length === 0 ? (
        <p className="m-0 mt-2 text-tinta-2">Las detecciones que no son piratas se archivan solas, con su motivo.</p>
      ) : (
        <ul className="panel-con-scroll m-0 mt-2 max-h-[320px] list-none p-0">
          {t.archivadas.map((a) => (
            <li key={a.deteccion_id} className="grid grid-cols-[3.2rem_minmax(0,1fr)] gap-x-3 border-t border-regla py-2 leading-snug">
              <span className="cifras text-[0.9375rem] text-tinta-2">{minuto(a.minuto)}′</span>
              <div className="min-w-0">
                <p className="m-0 truncate">
                  <span className="font-bold">{a.host}</span>
                  <span className="ml-2.5 text-[0.875rem] font-semibold text-firma">{VEREDICTO[a.veredicto] ?? a.veredicto}</span>
                </p>
                <p className="m-0 text-[0.875rem] text-tinta-2">{a.motivo}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

const ESTADO_RECLAMO: Record<TableroDTO["reclamos"][number]["estado"], string> = {
  verificado: "Verificado: va al juez",
  no_verificado: "No corresponde a un bloqueo nuestro",
  resuelto: "Resuelto",
};

function Reclamos({ t }: { t: TableroDTO }) {
  const nombre = (id: string) => nombreBreve(t.proveedores.find((p) => p.id === id)?.nombre ?? id);
  return (
    <section aria-label="Reclamos">
      <h2 className="m-0 text-[1.25rem] font-extrabold leading-tight">
        Reclamos <span className="cifras font-normal text-tinta-2">{t.reclamos.length}</span>
      </h2>
      {t.reclamos.length === 0 ? (
        <p className="m-0 mt-2 text-tinta-2">Ningún sitio reclamó por un bloqueo. Si llega un reclamo verificado, pasa al juez de turno como medida de levantamiento.</p>
      ) : (
        <ul className="panel-con-scroll m-0 mt-2 max-h-[320px] list-none p-0">
          {t.reclamos.map((r) => (
            <li key={r.id} className="grid grid-cols-[3.2rem_minmax(0,1fr)] gap-x-3 border-t border-regla py-2 leading-snug">
              <span className="cifras text-[0.9375rem] text-tinta-2">{minuto(r.minuto)}′</span>
              <div className="min-w-0">
                <p className="m-0">
                  <span className="wrap-anywhere font-bold">{r.dominio}</span>
                  <span className="ml-2.5 text-[0.875rem] text-tinta-2">ante {nombre(r.proveedor_id)}</span>
                </p>
                <p className="m-0 text-[0.875rem] font-semibold">{ESTADO_RECLAMO[r.estado]}</p>
                {r.mensaje && <p className="m-0 text-[0.875rem] text-tinta-2">{r.mensaje}</p>}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function Auditoria({ t }: { t: TableroDTO }) {
  const a = t.auditoria;
  return (
    <section className="min-w-0" aria-label="Auditoría">
      <h2 className="m-0 text-[1.25rem] font-extrabold leading-tight">
        Auditoría encadenada <span className="cifras font-normal text-tinta-2">{plural(a.entradas, "entrada", "entradas")}</span>
      </h2>
      <p className="m-0 mt-2 text-[0.8125rem] text-tinta-2">Hash de cabecera: cambia con cada hecho y delata cualquier alteración</p>
      <p className="m-0 mt-1 break-all rounded-[4px] bg-hundido px-3 py-2 font-mono text-[0.875rem] leading-snug text-firma ring-1 ring-inset ring-regla">{a.cabecera || "sin entradas"}</p>
      <ol className="panel-con-scroll m-0 mt-3 max-h-[520px] list-none p-0">
        {a.ultimas.map((x) => (
          <li key={x.seq} className="grid grid-cols-[3.2rem_minmax(0,1fr)] gap-x-3 border-t border-regla py-2 leading-snug">
            <span className="cifras text-[0.9375rem] text-tinta-2">{x.minuto == null ? "—" : `${minuto(x.minuto)}′`}</span>
            <div className="min-w-0">
              <p className="m-0 break-words text-[0.9375rem]">{x.resumen === x.tipo.replaceAll("_", " ") ? resumenLlano(x.tipo, x.actor) : sinFicticio(x.resumen)}</p>
              <p className="m-0 text-[0.75rem] text-tinta-3">
                <span className="cifras">n.º {x.seq}</span> <Huella valor={x.hash} largo={12} className="ml-1.5" />
              </p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

/** Para los pocos tipos de evento que el servidor no resume con una frase. */
function resumenLlano(tipo: string, actor: string): string {
  if (tipo === "ingreso") return `Ingreso de ${actor}.`;
  if (tipo === "arranque") return "Arranque de Offside.";
  const texto = tipo.replaceAll("_", " ");
  return `${texto.charAt(0).toUpperCase()}${texto.slice(1)}.`;
}
