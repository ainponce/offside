// Tablero en vivo: se proyecta en el pitch (1440 y 1920). Una sola pantalla, sin
// desplazamiento. La escala de 0 a 105 ordena el reloj, los carriles y el vencimiento.

import { Fragment, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import type { AuditoriaItemDTO, EstadoCelda, EstadoDTO, ExpedienteResumenDTO, ServidorDTO, TableroDTO, TipoBloqueo } from "../../compartido/tipos.ts";
import { Cargando, Cortes, HashCompleto, Luz, Marca, PildoraTurno, RelojPartido, useFondo, useTitulo } from "../componentes/comunes.tsx";
import { FichaAhora, MarcasRegla, TrazoFiltracion, fraccion, useAncho, usePrimerDibujo } from "../componentes/Escala.tsx";
import { HostPartido } from "../componentes/Medida.tsx";
import { cambiosDeTurno, coberturaMaxima } from "../nucleo/extras.ts";
import {
  ESTADO_ORDEN,
  TIPO_CELDA,
  clientes,
  juzgadoBreve,
  lista,
  minutoEntero,
  nombreBreve,
  numero,
  partidoBreve,
  plural,
  porcentaje,
  reloj,
  sinFicticio,
} from "../nucleo/formato.ts";
import { sincronizarReloj, useMinuto } from "../nucleo/reloj.ts";
import { salir, useSesion } from "../nucleo/sesion.ts";
import { useVivo } from "../nucleo/vivo.ts";

type Proveedor = TableroDTO["proveedores"][number];

/** El tablero fija su propia escala: 1rem = 16 px a 1440 x 900 y crece con la pantalla. */
function useEscalaTablero(): void {
  useLayoutEffect(() => {
    const raiz = document.documentElement;
    raiz.dataset.pantalla = "tablero";
    return () => {
      delete raiz.dataset.pantalla;
    };
  }, []);
}

/** Tamaño de 1rem en px, al día con cada cambio de tamaño de la ventana. */
function useRem(): number {
  const [rem, setRem] = useState(16);
  useLayoutEffect(() => {
    const medir = () => setRem(parseFloat(getComputedStyle(document.documentElement).fontSize) || 16);
    medir();
    window.addEventListener("resize", medir);
    return () => window.removeEventListener("resize", medir);
  }, []);
  return rem;
}

/** Cobertura al pitazo final, si el servidor no informa la máxima: la parte de los clientes con el bloqueo vigente al vencer. */
function coberturaAlFinal(t: TableroDTO): number | null {
  const total = t.proveedores.reduce((a, p) => a + p.clientes, 0);
  const servidores = t.expedientes.flatMap((e) => e.servidores).filter((s) => s.medida_estado === "aprobada");
  if (!servidores.length || total <= 0) return null;
  const porServidor = servidores.map((s) => {
    const cubiertos = s.por_proveedor.reduce((a, c) => {
      const p = t.proveedores.find((x) => x.id === c.proveedor_id);
      return a + (c.estado === "vencida" || c.estado === "aplicada" ? (p?.clientes ?? 0) : 0);
    }, 0);
    return (100 * cubiertos) / total;
  });
  return porServidor.reduce((a, b) => a + b, 0) / porServidor.length;
}

export function Tablero() {
  useFondo("aluminio");
  useEscalaTablero();
  useTitulo("Offside, tablero");
  const sesion = useSesion();
  const { datos: t, error, sinServidor } = useVivo<TableroDTO>("/api/tablero", { alRecibir: (d) => sincronizarReloj(d.estado) });
  // Un solo tic para toda la pantalla: el reloj grande, la ficha de la regla y los carriles marcan lo mismo.
  const minuto = useMinuto(200);

  // La auditoría trae las últimas 40 entradas: los traspasos de turno vistos se recuerdan.
  const traspasos = useRef(new Map<number, AuditoriaItemDTO>());
  const pico = useRef<number | null>(null);
  if (t) {
    for (const a of t.auditoria.ultimas) if (a.tipo === "traspaso_turno") traspasos.current.set(a.seq, a);
    const c = t.metricas.cobertura_media_pct;
    if (!t.estado.finalizado && c != null) pico.current = Math.max(pico.current ?? 0, c);
  }

  if (!t) {
    return (
      <div className="tablero tablero-cargando">
        <Cortes estado={null} sinServidor={sinServidor} />
        <Cargando texto={error && error.codigo !== 0 ? error.message : "Conectando con Offside…"} />
      </div>
    );
  }

  const cambios = cambiosDeTurno(t.estado, [...traspasos.current.values()]);
  const cobertura = t.estado.finalizado ? (coberturaMaxima(t) ?? pico.current ?? coberturaAlFinal(t)) : t.metricas.cobertura_media_pct;
  const fin = t.estado.fin_min || 105;
  const ahora = t.estado.finalizado ? fin : Math.min(minuto, fin);

  return (
    <div className="tablero">
      <CabezaTablero t={t} sinServidor={sinServidor} />
      <Cortes estado={t.estado} sinServidor={sinServidor} />
      {(t.estado.alertas.length > 0 || t.estado.simulacro) && <Avisos estado={t.estado} />}

      <div className="tb-cuerpo">
        <div className="tb-izquierda">
          <section className="tb-franja" aria-label="Minuto y cifras del partido">
            <BloqueReloj estado={t.estado} cambios={cambios} ahora={ahora} />
            <Cifras t={t} cobertura={cobertura} />
          </section>
          <Filtraciones t={t} ahora={ahora} />
        </div>
        <div className="tb-derecha">
          <DanoEvitado t={t} />
          <Registro t={t} />
        </div>
      </div>

      <footer className="tb-pie">
        <p>Nombres, IPs y juzgados ficticios del simulador oficial del desafío.</p>
        <nav className="tb-nav" aria-label="Navegación">
          {sesion?.usuario.rol === "juez" && <Link to="/juez">Mi cola</Link>}
          <Link to="/transparencia">Registro público</Link>
          <button type="button" className="boton-texto" onClick={() => void salir()}>
            Salir
          </button>
        </nav>
      </footer>
    </div>
  );
}

// --- cabecera ------------------------------------------------------------------------------------

function CabezaTablero({ t, sinServidor }: { t: TableroDTO; sinServidor: boolean }) {
  const e = t.estado;
  const juez = e.jueces_de_turno[0] ?? null;
  const simulador = sinServidor ? "Sin conexión con Offside" : e.conectado ? "Simulador conectado" : "Sin conexión con el simulador";
  const partido = partidoBreve(e.partido?.nombre) || "Sin partido";
  const titular = sinFicticio(e.partido?.titular_derechos);
  return (
    <header className="tb-cabeza">
      <div className="tb-cabeza-izq">
        <Marca />
        <span className="tb-sep" aria-hidden="true" />
        <p className="tb-partido" title={titular ? `${partido}. ${titular}` : partido}>
          <b>{partido}</b>
          {titular && <span>{titular}</span>}
        </p>
      </div>
      <div className="tb-cabeza-der">
        <p className="tb-simulador">
          <b>{simulador}</b>
          <span className="num">tiempo ×{numero(e.acelerar, 2)}</span>
        </p>
        <span className="tb-sep" aria-hidden="true" />
        {juez ? (
          <>
            <PildoraTurno deTurno texto={e.finalizado ? "Último turno" : "De turno"} />
            <p className="tb-juez">
              <b>{lista(e.jueces_de_turno.map((j) => j.nombre))}</b>
              <span>{juzgadoBreve(juez.juzgado_nombre)}</span>
            </p>
          </>
        ) : (
          <p className="tb-juez">
            <b>Sin juez de turno</b>
          </p>
        )}
      </div>
    </header>
  );
}

function Avisos({ estado }: { estado: EstadoDTO }) {
  return (
    <div className="tb-avisos">
      {estado.alertas.map((a, i) => (
        <p key={`${i}-${a}`} className="tb-aviso" role="status">
          <Luz tono="ambar" />
          {a}
        </p>
      ))}
      {estado.simulacro && <p className="tb-aviso">Simulacro de reclamos activo: hay un bloqueo equivocado a propósito.</p>}
    </div>
  );
}

// --- reloj y cifras ----------------------------------------------------------------------------------

function BloqueReloj({ estado, cambios, ahora }: { estado: EstadoDTO; cambios: number[]; ahora: number }) {
  const fin = estado.fin_min || 105;
  return (
    <div className="tb-reloj">
      <p className="tb-rotulo">Minuto de partido</p>
      <RelojPartido estado={estado} minuto={ahora} className="tb-reloj-cifra" />
      <div className="tb-reloj-regla" aria-hidden="true">
        <span className="tb-via">
          <i style={{ transform: `scaleX(${fraccion(ahora, fin)})` }} />
        </span>
        {cambios.map((c) => (
          <span key={c} className="tb-turno-marca" style={{ left: `${fraccion(c, fin) * 100}%` }} />
        ))}
        <span className="tb-via-numeros">
          {[0, 15, 30, 45, 60, 75, 90, 105]
            .filter((x) => x <= fin && !cambios.some((c) => Math.abs(c - x) < 7))
            .map((x) => (
              <span key={x} className="num" style={{ left: `${fraccion(x, fin) * 100}%` }} data-borde={x === 0 ? "inicio" : x >= fin ? "fin" : undefined}>
                {x}
              </span>
            ))}
          {cambios.map((c) => (
            <span key={`t${c}`} className="tb-turno-rotulo" style={{ left: `${fraccion(c, fin) * 100}%` }}>
              turno
            </span>
          ))}
        </span>
      </div>
      <p className="tb-reloj-pie">
        {estado.finalizado ? (
          <span>Partido terminado. Todo venció a los {minutoEntero(fin)}′.</span>
        ) : (
          <>
            <span>
              Faltan <b className="num">{reloj(Math.max(0, fin - ahora))}</b>
            </span>
            <span>A los {minutoEntero(fin)}′ vence todo</span>
          </>
        )}
      </p>
    </div>
  );
}

function Cifra({ rotulo, valor, unidad, pie }: { rotulo: string; valor: string; unidad?: string; pie: string }) {
  return (
    <div className="tb-cifra">
      <p className="tb-rotulo">{rotulo}</p>
      <p className="tb-cifra-valor">
        <span className="cifra">{valor}</span>
        {unidad && valor !== "—" && <small>{unidad}</small>}
      </p>
      <p className="tb-cifra-pie">{pie}</p>
    </div>
  );
}

function Cifras({ t, cobertura }: { t: TableroDTO; cobertura: number | null }) {
  const m = t.metricas;
  const total = t.proveedores.reduce((a, p) => a + p.clientes, 0);
  const conOrdenes = new Set(
    t.expedientes.flatMap((e) => e.servidores.flatMap((s) => s.por_proveedor.filter((c) => c.estado === "aplicada" || c.estado === "recibida").map((c) => c.proveedor_id))),
  ).size;
  const fin = t.estado.finalizado;
  return (
    <div className="tb-cifras">
      <Cifra
        rotulo="Primer bloqueo"
        valor={m.tiempo_medio_primer_bloqueo_min == null ? "—" : reloj(m.tiempo_medio_primer_bloqueo_min)}
        pie="promedio, desde la detección"
      />
      <Cifra
        rotulo={fin ? "Cobertura máxima" : "Cobertura"}
        valor={cobertura == null ? "—" : porcentaje(cobertura)}
        unidad="%"
        pie={total > 0 ? `de ${clientes(total)} de clientes` : "sin proveedores registrados"}
      />
      <Cifra
        rotulo="Esperan firma"
        valor={numero(m.medidas_pendientes)}
        pie={m.medidas_pendientes === 0 ? (fin ? "no quedan medidas" : "nada espera al juez") : "medidas, del juez de turno"}
      />
      <Cifra
        rotulo="Órdenes vigentes"
        valor={numero(m.ordenes_activas)}
        pie={fin ? `vencieron a los ${minutoEntero(t.estado.fin_min)}′` : m.ordenes_activas === 0 ? "ningún bloqueo activo" : `en ${plural(conOrdenes, "proveedor", "proveedores")}`}
      />
    </div>
  );
}

// --- daño evitado ------------------------------------------------------------------------------------

function DanoEvitado({ t }: { t: TableroDTO }) {
  const grupos = useMemo(() => {
    const porIp = new Map<string, { ip: string; organizacion: string | null; sitios: string[] }>();
    for (const e of t.expedientes) {
      for (const s of e.servidores) {
        if (s.tipo_recomendado !== "dominio" || s.terceros.length === 0) continue;
        const g = porIp.get(s.ip) ?? { ip: s.ip, organizacion: s.organizacion, sitios: [] };
        for (const x of s.terceros) if (!g.sitios.includes(x)) g.sitios.push(x);
        porIp.set(s.ip, g);
      }
    }
    return [...porIp.values()];
  }, [t.expedientes]);
  const total = t.metricas.dano_evitado.sitios.length || grupos.reduce((a, g) => a + g.sitios.length, 0);
  if (total === 0) {
    return (
      <section className="tb-panel tb-dano" aria-label="Daño evitado" data-vacio="">
        <p className="tb-rotulo">Daño evitado</p>
        <p className="tb-dano-titulo">Ningún sitio legítimo en riesgo todavía</p>
        <p className="tb-dano-texto">Si un pirata comparte la IP con sitios legítimos, se bloquea solo su dominio y esos sitios aparecen acá, en línea.</p>
      </section>
    );
  }
  return (
    <section className="tb-panel tb-dano" aria-label="Daño evitado">
      <div className="tb-dano-cabeza">
        <span className="tb-dano-cifra cifra">{numero(total)}</span>
        <div>
          <p className="tb-rotulo">Daño evitado</p>
          <p className="tb-dano-titulo">{total === 1 ? "sitio legítimo sigue en línea" : "sitios legítimos siguen en línea"}</p>
        </div>
      </div>
      <p className="tb-dano-texto">Compartían la IP con un sitio pirata. Un bloqueo automático por IP los habría tirado; se bloqueó solo el dominio.</p>
      {grupos.map((g) => (
        <div key={g.ip} className="tb-dano-grupo">
          <p className="tb-dano-ip">
            <b className="num">{g.ip}</b>
            {g.organizacion && <span>{sinFicticio(g.organizacion)}</span>}
          </p>
          <p className="tb-dano-sitios">
            {g.sitios.map((x, i) => (
              <Fragment key={x}>
                <span>
                  <HostPartido texto={x} />
                  {i < g.sitios.length - 1 ? "," : ""}
                </span>
                {i < g.sitios.length - 1 ? " " : ""}
              </Fragment>
            ))}
          </p>
        </div>
      ))}
    </section>
  );
}

// --- filtraciones --------------------------------------------------------------------------------------

const ARCHIVO: Record<string, string> = {
  licenciatario_autorizado: "licenciatario en su dominio",
  no_es_la_senal: "marca de otro partido",
  anomalia: "anomalía en la marca",
};

function resumenExpediente(e: ExpedienteResumenDTO): string {
  const s = e.servidores[e.servidores.length - 1];
  const saltos = e.servidores.length - 1;
  if (!s) return "";
  if (s.terceros.length > 0) {
    return `IP compartida, ${plural(s.terceros.length, "sitio", "sitios")}${s.tipo_recomendado === "ip" ? ", bloqueo por IP" : ""}`;
  }
  return `IP exclusiva${saltos > 0 ? `, ${plural(saltos, "salto", "saltos")}` : ""}`;
}

// Altos de cada parte del panel, en rem. Tienen que coincidir con estilos.css.
const CABEZA_REM = 1.75;
const BORDE_REM = 0.0625;
const REGLA_REM = 3.0625;
const OCULTOS_REM = 1.75;
/** Escalones de compactación: primero se achican las filas; por debajo de 2rem la IP pasa al título del host. */
const FILAS: { fila: number; compacto: boolean }[] = [
  { fila: 2.5, compacto: false },
  { fila: 2.25, compacto: false },
  { fila: 2.125, compacto: false },
  { fila: 2, compacto: false },
  { fila: 1.75, compacto: true },
  { fila: 1.625, compacto: true },
];
/** Un expediente de más servidores que esto se pliega en el primero, una fila "+N saltos" y los dos últimos. */
const MAX_SIN_PLEGAR = 3;

function altoPie(lineas: number): number {
  return lineas === 0 ? 0 : 1.3125 + lineas * 1.375 + (lineas - 1) * 0.25;
}

function renglones(e: ExpedienteResumenDTO, plegar: boolean): number {
  const n = e.servidores.length;
  return plegar && n > MAX_SIN_PLEGAR ? 4 : n;
}

interface Distribucion {
  fila: number;
  compacto: boolean;
  plegar: boolean;
  /** Renglones del pie (no llegaron al juez, reclamos). */
  pie: number;
  visibles: ExpedienteResumenDTO[];
  ocultos: ExpedienteResumenDTO[];
}

/**
 * Qué entra en el panel y cómo. En orden: achicar las filas, plegar los expedientes de muchos
 * saltos, reducir el pie a un renglón y después sacarlo, y recién entonces ocultar expedientes:
 * primero los de un solo servidor, del más viejo al más nuevo. Nunca se oculta uno que espera
 * la firma ni el que más saltó (es el que cuenta "seguir la filtración").
 */
function distribuir(expedientes: ExpedienteResumenDTO[], disponible: number, pieNatural: number): Distribucion {
  const alto = (lista: ExpedienteResumenDTO[], fila: number, plegar: boolean) =>
    lista.reduce((a, e) => a + CABEZA_REM + renglones(e, plegar) * fila + BORDE_REM, 0);
  const entra = (lista: ExpedienteResumenDTO[], fila: number, plegar: boolean, pie: number, conOcultos: boolean) =>
    alto(lista, fila, plegar) + altoPie(pie) + (conOcultos ? OCULTOS_REM : 0) <= disponible + 0.01;

  for (const f of FILAS) {
    if (entra(expedientes, f.fila, false, pieNatural, false)) return { ...f, plegar: false, pie: pieNatural, visibles: expedientes, ocultos: [] };
  }
  const chica = FILAS[FILAS.length - 1]!;
  for (const pie of [...new Set([pieNatural, Math.min(1, pieNatural), 0])]) {
    if (entra(expedientes, chica.fila, true, pie, false)) return { ...chica, plegar: true, pie, visibles: expedientes, ocultos: [] };
  }

  const masSaltos = expedientes.reduce<ExpedienteResumenDTO | null>(
    (mejor, e) => (e.servidores.length > 1 && (!mejor || e.servidores.length >= mejor.servidores.length) ? e : mejor),
    null,
  );
  const cerrado = (e: ExpedienteResumenDTO) => e.estado === "cerrado" || e.estado === "rechazado";
  const protegido = (e: ExpedienteResumenDTO) => e === masSaltos || e.estado === "pendiente" || e.servidores.some((s) => s.medida_estado === "pendiente");
  const candidatos = expedientes
    .filter((e) => !protegido(e))
    .sort(
      (a, b) =>
        Number(a.servidores.length > 1) - Number(b.servidores.length > 1) ||
        Number(!cerrado(a)) - Number(!cerrado(b)) ||
        Number(a.servidores.some((s) => s.terceros.length > 0)) - Number(b.servidores.some((s) => s.terceros.length > 0)) ||
        a.abierto_min - b.abierto_min,
    );
  const fuera = new Set<string>();
  let visibles = expedientes;
  for (const c of candidatos) {
    if (entra(visibles, chica.fila, true, 0, fuera.size > 0)) break;
    fuera.add(c.id);
    visibles = expedientes.filter((e) => !fuera.has(e.id));
  }
  return { ...chica, plegar: true, pie: 0, visibles, ocultos: expedientes.filter((e) => fuera.has(e.id)) };
}

function Filtraciones({ t, ahora }: { t: TableroDTO; ahora: number }) {
  const servidores = t.expedientes.reduce((a, e) => a + e.servidores.length, 0);
  const marcas = new Set(t.expedientes.map((e) => e.marca)).size;
  const rem = useRem();
  const zona = useRef<HTMLDivElement | null>(null);
  const [disponible, setDisponible] = useState(0);
  useEffect(() => {
    const el = zona.current;
    if (!el) return;
    const medir = () => setDisponible(el.getBoundingClientRect().height);
    const ro = new ResizeObserver(medir);
    ro.observe(el);
    medir();
    return () => ro.disconnect();
  }, []);

  const archivadas = useMemo(() => {
    const porHost = new Map<string, { host: string; motivo: string; veces: number }>();
    for (const a of t.archivadas) {
      const previo = porHost.get(a.host);
      if (previo) previo.veces += 1;
      else porHost.set(a.host, { host: a.host, motivo: ARCHIVO[a.veredicto] ?? sinFicticio(a.motivo), veces: 1 });
    }
    return [...porHost.values()];
  }, [t.archivadas]);
  const pieNatural = (archivadas.length > 0 ? 1 : 0) + (t.reclamos.length > 0 ? 1 : 0);
  const d: Distribucion =
    disponible > 0
      ? distribuir(t.expedientes, disponible / rem - REGLA_REM, pieNatural)
      : { fila: 2.5, compacto: false, plegar: false, pie: pieNatural, visibles: t.expedientes, ocultos: [] };

  return (
    <section className="tb-panel tb-filtraciones" aria-label="Filtraciones">
      <header className="tb-panel-cabeza">
        <h2>
          Filtraciones
          <span>
            {servidores === 0
              ? "Sin filtraciones todavía"
              : `${plural(marcas, "marca", "marcas")}, ${plural(servidores, "servidor", "servidores")}, ${plural(t.metricas.detecciones, "detección", "detecciones")}`}
          </span>
        </h2>
        <ul className="tb-leyenda" aria-label="Estados de las órdenes">
          <li>
            <Luz tono="verde" /> Aplicada
          </li>
          <li>
            <Luz tono="ambar" /> Recibida
          </li>
          <li>
            <Luz tono="roja" /> Falló
          </li>
          <li>
            <Luz tono="apagada" /> Venció
          </li>
          <li>2.º reenvío</li>
        </ul>
      </header>
      <div ref={zona} className="tb-zona">
        <Matriz t={t} d={d} rem={rem} ahora={ahora} />
        <PieFiltraciones t={t} archivadas={archivadas} lineas={d.pie} />
      </div>
    </section>
  );
}

function Matriz({ t, d, rem, ahora }: { t: TableroDTO; d: Distribucion; rem: number; ahora: number }) {
  const [refEscala, ancho] = useAncho<HTMLDivElement>();
  const fin = t.estado.fin_min || 105;
  const sinAnimar = usePrimerDibujo();
  const total = t.proveedores.reduce((a, p) => a + p.clientes, 0);
  const enVivo = !t.estado.finalizado;

  return (
    <div className="tb-matriz" style={{ ["--fila" as string]: `${d.fila}rem` }} data-compacto={d.compacto ? "" : undefined}>
      <div className="tb-grilla tb-regla">
        <p className="tb-col-cab">
          Servidor<small>e IP</small>
        </p>
        <div ref={refEscala} className="tb-regla-escala">
          <MarcasRegla fin={fin} ahora={enVivo ? ahora : null} ocultarCerca={11} ancho={ancho} rem={rem} />
        </div>
        <div className="tb-celdas tb-prov-cab">
          {t.proveedores.map((p) => (
            <Encabezado key={p.id} p={p} total={total} />
          ))}
        </div>
        <p className="tb-col-cab tb-col-demora">
          Demora<small>a bloquear</small>
        </p>
      </div>

      <div className="tb-carriles">
        {t.expedientes.length === 0 ? (
          <p className="tb-vacio">Todavía no se detectó ninguna filtración. Cuando aparezca una retransmisión pirata, se abre su expediente acá.</p>
        ) : (
          d.visibles.map((e) => (
            <BloqueExpediente key={e.id} e={e} proveedores={t.proveedores} ancho={ancho} d={d} rem={rem} fin={fin} ahora={ahora} sinAnimar={sinAnimar} />
          ))
        )}
        {d.ocultos.length > 0 && (
          <p className="tb-ocultos">
            {d.ocultos.every((e) => e.estado === "cerrado" || e.estado === "rechazado") ? "No entran en pantalla, ya cerrados: " : "No entran en pantalla: "}
            {d.ocultos.map((e, i) => (
              <Fragment key={e.id}>
                {i > 0 ? ", " : ""}
                <Link to={`/expediente/${encodeURIComponent(e.id)}`}>{e.id}</Link>
              </Fragment>
            ))}
          </p>
        )}
      </div>

      <div className="tb-capa-escala" aria-hidden="true">
        <span className="tb-vence" />
        {enVivo && <FichaAhora minuto={ahora} fin={fin} />}
      </div>
    </div>
  );
}

function Encabezado({ p, total }: { p: Proveedor; total: number }) {
  return (
    <p className="tb-prov" title={`${sinFicticio(p.nombre)}: ${clientes(p.clientes)} de clientes (${porcentaje((100 * p.clientes) / Math.max(1, total))} %)`}>
      {nombreBreve(p.nombre)}
      <small className="num">{clientes(p.clientes)}</small>
    </p>
  );
}

/** Renglones de un carril: un servidor cada uno, o una fila "+N saltos" con los del medio de un expediente plegado. */
type Renglon = { tipo: "servidor"; s: ServidorDTO } | { tipo: "saltos"; servidores: ServidorDTO[] };

function BloqueExpediente(p: {
  e: ExpedienteResumenDTO;
  proveedores: Proveedor[];
  ancho: number;
  d: Distribucion;
  rem: number;
  fin: number;
  ahora: number;
  sinAnimar: boolean;
}) {
  const { e, d } = p;
  const n = e.servidores.length;
  const plegado = d.plegar && n > MAX_SIN_PLEGAR;
  const filas: Renglon[] = plegado
    ? [
        { tipo: "servidor", s: e.servidores[0]! },
        { tipo: "saltos", servidores: e.servidores.slice(1, n - 2) },
        { tipo: "servidor", s: e.servidores[n - 2]! },
        { tipo: "servidor", s: e.servidores[n - 1]! },
      ]
    : e.servidores.map((s) => ({ tipo: "servidor", s }));
  // Con el carril plegado, los servidores del medio comparten el segundo renglón.
  const filaDe = plegado ? (i: number) => (i === 0 ? 0 : i >= n - 2 ? i - (n - 4) : 1) : undefined;
  return (
    <div className="tb-expediente" data-estado={e.estado}>
      <p className="tb-exp-cabeza">
        <Link to={`/expediente/${encodeURIComponent(e.id)}`} className="tb-exp-id num">
          {e.id}
        </Link>
        <span className="huella tb-exp-marca">{e.marca}</span>
        <span className="tb-exp-resumen">
          {resumenExpediente(e)}
          {e.estado === "pendiente" ? ", espera firma" : e.estado === "rechazado" ? ", rechazado" : ""}
        </span>
      </p>
      <div className="tb-exp-filas">
        {filas.map((f) =>
          f.tipo === "servidor" ? (
            <FilaServidor key={f.s.id} s={f.s} proveedores={p.proveedores} compacto={d.compacto} anchoHost={11.5 * p.rem} rem={p.rem} />
          ) : (
            <FilaSaltos key="saltos" servidores={f.servidores} />
          ),
        )}
        <div className="tb-exp-trazo">
          <TrazoFiltracion
            servidores={e.servidores}
            g={{ ancho: p.ancho, fila: d.fila * p.rem, fin: p.fin, ahora: p.ahora }}
            sinAnimar={p.sinAnimar}
            filaDe={filaDe}
            filas={filas.length}
          />
        </div>
      </div>
    </div>
  );
}

// --- host recortado por el medio ------------------------------------------------------------------

let lienzo: CanvasRenderingContext2D | null | undefined;
function anchoTexto(texto: string, fuente: string): number {
  if (lienzo === undefined) lienzo = typeof document !== "undefined" ? document.createElement("canvas").getContext("2d") : null;
  if (!lienzo) return texto.length * 9;
  lienzo.font = fuente;
  return lienzo.measureText(texto).width;
}

/**
 * Un host largo se recorta por el medio: el primer rótulo, "…" y el dominio registrable
 * ("cdn-edge-04…verpartido.test"), que es lo que lo identifica. El host completo va en el título.
 */
function hostAlMedio(host: string, anchoPx: number, fuente: string): string {
  if (anchoPx <= 0 || anchoTexto(host, fuente) <= anchoPx) return host;
  const rotulos = host.split(".");
  if (rotulos.length > 2) {
    const dominio = rotulos.slice(-2).join(".");
    const primero = rotulos[0]!;
    for (let k = primero.length; k >= 3; k -= 1) {
      const c = `${primero.slice(0, k)}…${dominio}`;
      if (anchoTexto(c, fuente) <= anchoPx) return c;
    }
  }
  for (let quedan = host.length - 1; quedan > 6; quedan -= 1) {
    const atras = Math.ceil(quedan * 0.6);
    const c = `${host.slice(0, quedan - atras)}…${host.slice(-atras)}`;
    if (anchoTexto(c, fuente) <= anchoPx) return c;
  }
  return host;
}

function FilaServidor({ s, proveedores, compacto, anchoHost, rem }: { s: ServidorDTO; proveedores: Proveedor[]; compacto: boolean; anchoHost: number; rem: number }) {
  const pendiente = s.medida_estado === "pendiente";
  const visible = hostAlMedio(s.host, anchoHost, `560 ${rem}px "Archivo Variable", system-ui, sans-serif`);
  return (
    <div className="tb-grilla tb-servidor">
      <p className="tb-host" title={compacto || visible !== s.host ? `${s.host}, ${s.ip}` : undefined}>
        <span>{visible}</span>
        {!compacto && <small className="num">{s.ip}</small>}
      </p>
      <span />
      <div className="tb-celdas">
        {proveedores.map((p) => {
          const c = s.por_proveedor.find((x) => x.proveedor_id === p.id);
          const estado: EstadoCelda = !c ? "sin_orden" : pendiente && c.estado === "sin_orden" ? "por_enviar" : c.estado;
          return <Celda key={p.id} estado={estado} tipo={c?.tipo ?? s.tipo_recomendado} intento={c?.intento ?? 0} proveedor={sinFicticio(p.nombre)} />;
        })}
      </div>
      <p className="tb-demora">
        {s.primer_bloqueo_min != null ? (
          <span className="cifra">{reloj(s.primer_bloqueo_min)}</span>
        ) : pendiente ? (
          <small>espera</small>
        ) : s.medida_estado === "rechazada" ? (
          <small>rechazada</small>
        ) : (
          <small>—</small>
        )}
      </p>
    </div>
  );
}

/** La fila que resume los saltos del medio de un expediente plegado; el trazo sigue por ella. */
function FilaSaltos({ servidores }: { servidores: ServidorDTO[] }) {
  const n = servidores.length;
  return (
    <div className="tb-grilla tb-servidor tb-saltos">
      <p className="tb-host" title={servidores.map((s) => s.host).join(", ")}>
        <span>+{plural(n, "salto", "saltos")}</span>
      </p>
      <span />
      <span />
      <span />
    </div>
  );
}

/** Celda sólida por proveedor; al cambiar de estado el color nuevo barre de izquierda a derecha. */
function Celda({ estado, tipo, intento, proveedor }: { estado: EstadoCelda; tipo: TipoBloqueo | null; intento: number; proveedor: string }) {
  const clave = `${estado}|${tipo}|${intento}`;
  const [capas, setCapas] = useState<{ debajo: string | null; arriba: string }>({ debajo: null, arriba: clave });
  useEffect(() => {
    setCapas((c) => (c.arriba === clave ? c : { debajo: c.arriba, arriba: clave }));
  }, [clave]);

  if (estado === "sin_orden") return <span className="celda celda-vacia" />;
  if (estado === "sin_cobertura") {
    return (
      <span className="celda celda-raya" title="Sin cobertura por seguridad">
        —
      </span>
    );
  }
  const titulo = `${proveedor}: ${ESTADO_ORDEN[estado].rotulo}${intento > 1 ? `, intento ${intento}` : ""}`;
  const capa = (k: string, barre: boolean) => {
    const [e, ti, i] = k.split("|") as [EstadoCelda, string, string];
    const n = Number(i);
    if (e === "sin_orden" || e === "sin_cobertura") return <span key={`v${k}`} className="celda-capa" data-estado="vacia" />;
    return (
      <span key={k} className="celda-capa" data-estado={e} data-barre={barre ? "" : undefined} onAnimationEnd={barre ? () => setCapas({ debajo: null, arriba: k }) : undefined}>
        {ti === "ip" || ti === "dominio" ? TIPO_CELDA[ti as TipoBloqueo] : "—"}
        {n > 1 && <sup className="num">{n}.º</sup>}
      </span>
    );
  };
  return (
    <span className="celda" title={titulo} aria-label={titulo} role="img">
      {capas.debajo && capa(capas.debajo, false)}
      {capa(capas.arriba, capas.debajo != null)}
    </span>
  );
}

function PieFiltraciones({ t, archivadas, lineas }: { t: TableroDTO; archivadas: { host: string; motivo: string; veces: number }[]; lineas: number }) {
  if (lineas === 0 || (archivadas.length === 0 && t.reclamos.length === 0)) return null;
  const grupoArchivadas = archivadas.length > 0 && (
    <>
      <b>No llegaron al juez</b>
      {archivadas.map((a) => (
        <span key={a.host} className="tb-archivada">
          <em>{a.host}</em>, {a.motivo}
          {a.veces > 1 ? `, ${a.veces} veces` : ""}
        </span>
      ))}
    </>
  );
  const grupoReclamos = t.reclamos.length > 0 && (
    <>
      <b>Reclamos</b>
      {t.reclamos.map((r) => (
        <span key={r.id} className="tb-archivada">
          <em>{r.dominio}</em>, a los {minutoEntero(r.minuto)}′, {r.estado === "verificado" ? "verificado" : r.estado === "resuelto" ? "resuelto" : "no corresponde"}
          {r.medida_id ? `, ${r.medida_id}` : ""}
        </span>
      ))}
    </>
  );
  return (
    <footer className="tb-pie-panel">
      {lineas >= 2 ? (
        <>
          <p>{grupoArchivadas}</p>
          <p>{grupoReclamos}</p>
        </>
      ) : (
        <p>
          {grupoArchivadas}
          {grupoReclamos}
        </p>
      )}
    </footer>
  );
}

// --- registro encadenado -----------------------------------------------------------------------------------

/** Ingresos y salidas siguen en la cadena, pero no se listan: no son hechos del partido. */
const NO_SE_LISTAN = new Set(["ingreso", "salida"]);

function Registro({ t }: { t: TableroDTO }) {
  const a = t.auditoria;
  const fin = t.estado.fin_min || 105;
  const listadas = a.ultimas.filter((x) => !NO_SE_LISTAN.has(x.tipo));
  const primera = useRef(true);
  const vistas = useRef(new Set<number>());
  const nuevas = new Set<number>();
  for (const x of listadas) {
    if (!vistas.current.has(x.seq)) {
      if (!primera.current) nuevas.add(x.seq);
      vistas.current.add(x.seq);
    }
  }
  primera.current = false;
  const masNueva = listadas[0]?.seq;
  return (
    <section className="tb-panel tb-registro" aria-label="Registro encadenado">
      <header className="tb-panel-cabeza">
        <h2>
          Registro encadenado
          <span className="num">{plural(a.entradas, "entrada", "entradas")}</span>
        </h2>
      </header>
      <div className="tb-cabecera-cadena">
        <p>
          <b>Hash de cabecera</b>
          <span className="num">entrada {numero(a.entradas)}</span>
        </p>
        <HashCompleto key={a.cabecera} valor={a.cabecera} className="tb-hash" />
      </div>
      <ol className="tb-eventos">
        {listadas.slice(0, 14).map((x) => (
          <li key={x.seq} className="tb-evento" data-nuevo={x.seq === masNueva ? "" : undefined} data-entra={nuevas.has(x.seq) ? "" : undefined}>
            <span className="tb-evento-nodo" aria-hidden="true" />
            <p className="tb-evento-meta">
              <span className="num">
                {x.seq}
                {x.minuto == null ? "" : x.minuto > fin + 0.5 ? ", después del partido" : `, minuto ${reloj(Math.min(x.minuto, fin))}`}
              </span>
              <span className="huella">{x.hash.slice(0, 8)}</span>
            </p>
            <p className="tb-evento-texto">{sinFicticio(x.resumen)}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}
