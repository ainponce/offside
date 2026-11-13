// Piezas chicas que comparten todas las pantallas.

import { type ReactNode, useEffect, useRef, useState } from "react";
import type { EstadoDTO, Luz as LuzVerificacion } from "../../compartido/tipos.ts";
import { type TonoLuz, enGrupos, reloj } from "../nucleo/formato.ts";
import { useMinuto } from "../nucleo/reloj.ts";

export type Fondo = "aluminio" | "lienzo";
const COLOR: Record<Fondo, string> = { aluminio: "#ECEEF1", lienzo: "#F1F2F4" };

/** Fondo de toda la página (también el que se ve al rebotar el desplazamiento) y color de la barra del navegador. */
export function useFondo(fondo: Fondo): void {
  useEffect(() => {
    const raiz = document.documentElement;
    raiz.dataset.fondo = fondo;
    const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
    if (meta) meta.content = COLOR[fondo];
  }, [fondo]);
}

export function useTitulo(titulo: string): void {
  useEffect(() => {
    document.title = titulo;
  }, [titulo]);
}

/** ¿El sistema pide movimiento reducido? */
export function movimientoReducido(): boolean {
  return typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;
}

/** La marca: una raya grafito (la línea del offside) y el nombre. */
export function Marca({ className = "" }: { className?: string }) {
  return (
    <span className={`marca ${className}`}>
      <span className="marca-raya" aria-hidden="true" />
      Offside
    </span>
  );
}

const LUZ_VERIFICACION: Record<LuzVerificacion, TonoLuz> = { verde: "verde", ambar: "ambar", roja: "roja" };
const NOMBRE_TONO: Record<TonoLuz, string> = {
  verde: "verde",
  ambar: "ámbar",
  roja: "roja",
  anillo: "sin encender",
  apagada: "apagada",
  ninguna: "",
};

/**
 * Luz de estado. Es el único ícono de estado: sin tildes ni cruces de colores.
 * Cuando cambia de tono hace un solo pulso de halo, nunca en bucle.
 */
export function Luz({
  tono,
  tam = "normal",
  etiqueta,
  className = "",
}: {
  tono: TonoLuz | LuzVerificacion;
  tam?: "chica" | "normal" | "grande";
  /** Nombre accesible; sin él la luz es decorativa (el texto de al lado ya dice el estado). */
  etiqueta?: string;
  className?: string;
}) {
  const t: TonoLuz = tono in LUZ_VERIFICACION ? LUZ_VERIFICACION[tono as LuzVerificacion] : (tono as TonoLuz);
  const previo = useRef(t);
  const [pulsos, setPulsos] = useState(0);
  useEffect(() => {
    if (previo.current !== t) {
      previo.current = t;
      if (t === "verde" || t === "ambar" || t === "roja") setPulsos((n) => n + 1);
    }
  }, [t]);
  if (t === "ninguna") return <span className={`luz luz-${tam} ${className}`} data-tono="ninguna" aria-hidden="true" />;
  return (
    <span
      className={`luz luz-${tam} ${className}`}
      data-tono={t}
      role={etiqueta ? "img" : undefined}
      aria-label={etiqueta ? `${etiqueta}: luz ${NOMBRE_TONO[t]}` : undefined}
      aria-hidden={etiqueta ? undefined : true}
    >
      {pulsos > 0 && <span key={pulsos} className="luz-pulso" />}
    </span>
  );
}

/** Huella o hash en Plex Mono, en grupos de cuatro. `caracteres` 0 = completa. */
export function Huella({ valor, caracteres = 12, className = "" }: { valor: string | null | undefined; caracteres?: number; className?: string }) {
  if (!valor) return <span className={`huella ${className}`}>sin huella</span>;
  return (
    <span className={`huella ${className}`} title={caracteres > 0 && valor.length > caracteres ? enGrupos(valor) : undefined}>
      {enGrupos(valor, caracteres)}
    </span>
  );
}

/** Hash completo en dos renglones de ocho grupos, sin cortar un grupo. */
export function HashCompleto({ valor, className = "" }: { valor: string; className?: string }) {
  const grupos = enGrupos(valor).split(" ");
  const mitad = Math.ceil(grupos.length / 2);
  return (
    <span className={`huella hash-completo ${className}`}>
      <span>{grupos.slice(0, mitad).join(" ")}</span>
      <span>{grupos.slice(mitad).join(" ")}</span>
    </span>
  );
}

/**
 * Reloj del partido, interpolado entre un dato del servidor y el siguiente. Las cifras no ruedan.
 * Con `minuto`, muestra ese valor (el tic que ya tiene la pantalla): dos relojes no se contradicen.
 */
export function RelojPartido({ estado, minuto, className = "" }: { estado: EstadoDTO; minuto?: number; className?: string }) {
  const tic = useMinuto(200);
  const m = minuto ?? tic;
  const valor = estado.finalizado ? estado.fin_min : Math.min(m, estado.fin_min || Infinity);
  return (
    <span className={`cifra ${className}`} role="timer" aria-label={`Minuto ${Math.floor(valor)} del partido`}>
      {reloj(valor)}
    </span>
  );
}

/** Píldora "De turno". El punto no late. */
export function PildoraTurno({ deTurno, texto }: { deTurno: boolean; texto?: string }) {
  return (
    <span className="pildora-turno" data-turno={deTurno ? "si" : "no"}>
      <span className="pildora-punto" aria-hidden="true" />
      {texto ?? (deTurno ? "De turno" : "Fuera de turno")}
    </span>
  );
}

/** Aviso de corte con Offside o con el simulador: una franja grafito, sin colores de estado. */
export function Cortes({ estado, sinServidor }: { estado: EstadoDTO | null; sinServidor: boolean }) {
  let titulo: string | null = null;
  let detalle: string | null = null;
  if (sinServidor) {
    titulo = "Sin conexión con Offside";
    detalle = "Lo que ves puede estar desactualizado. Se reintenta solo.";
  } else if (estado && !estado.conectado) {
    titulo = "Sin conexión con el simulador";
    detalle = "No se puede firmar ni enviar órdenes hasta que vuelva. Se reintenta solo.";
  }
  if (!titulo) return null;
  return (
    <div role="alert" className="corte">
      <span className="corte-circulo" aria-hidden="true" />
      <p>
        <strong>{titulo}</strong> <span>{detalle}</span>
      </p>
    </div>
  );
}

export function Cargando({ texto = "Conectando con Offside…" }: { texto?: string }) {
  return (
    <p className="cargando" role="status">
      {texto}
    </p>
  );
}

// --- íconos (trazo, 24 px) ---------------------------------------------------------------

function Icono({ children, tam = 20 }: { children: ReactNode; tam?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={tam} height={tam} fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="icono">
      {children}
    </svg>
  );
}

export const IconoSonido = ({ tam }: { tam?: number }) => (
  <Icono tam={tam}>
    <path d="M4.5 9.5v5h3.2l4.3 3.8V5.7L7.7 9.5z" />
    <path d="M15.6 9.2a4 4 0 0 1 0 5.6M18.2 6.6a7.6 7.6 0 0 1 0 10.8" />
  </Icono>
);
export const IconoSilencio = ({ tam }: { tam?: number }) => (
  <Icono tam={tam}>
    <path d="M4.5 9.5v5h3.2l4.3 3.8V5.7L7.7 9.5z" />
    <path d="M16 9.8l4.4 4.4M20.4 9.8L16 14.2" />
  </Icono>
);
export const IconoCampana = ({ tam }: { tam?: number }) => (
  <Icono tam={tam}>
    <path d="M6.2 16.4h11.6l-1.5-2.1V10.4a4.3 4.3 0 0 0-8.6 0v3.9z" />
    <path d="M10.3 19.2a1.9 1.9 0 0 0 3.4 0" />
  </Icono>
);
export const IconoCampanaApagada = ({ tam }: { tam?: number }) => (
  <Icono tam={tam}>
    <path d="M6.2 16.4h11.6l-1.5-2.1V10.4a4.3 4.3 0 0 0-8.6 0v3.9z" />
    <path d="M10.3 19.2a1.9 1.9 0 0 0 3.4 0" />
    <path d="M4.5 4.5l15 15" />
  </Icono>
);
export const IconoCerrar = ({ tam }: { tam?: number }) => (
  <Icono tam={tam}>
    <path d="M6.5 6.5l11 11M17.5 6.5l-11 11" />
  </Icono>
);
export const IconoVolver = ({ tam }: { tam?: number }) => (
  <Icono tam={tam}>
    <path d="M14.5 6l-6 6 6 6" />
  </Icono>
);
export const IconoChevron = ({ tam }: { tam?: number }) => (
  <Icono tam={tam}>
    <path d="M7 10l5 5 5-5" />
  </Icono>
);
export const IconoImprimir = ({ tam }: { tam?: number }) => (
  <Icono tam={tam}>
    <path d="M7 9V4.5h10V9M7 16.5H5.5A1.5 1.5 0 0 1 4 15v-4.5A1.5 1.5 0 0 1 5.5 9h13a1.5 1.5 0 0 1 1.5 1.5V15a1.5 1.5 0 0 1-1.5 1.5H17" />
    <path d="M7 13.5h10v6H7z" />
  </Icono>
);
export const IconoExportar = ({ tam }: { tam?: number }) => (
  <Icono tam={tam}>
    <path d="M12 4v11M7.5 10.5L12 15l4.5-4.5M5 19.5h14" />
  </Icono>
);

/** Tilde en un círculo grafito: decidido y firmado. */
export function Tilde({ tam = 16 }: { tam?: number }) {
  return (
    <svg viewBox="0 0 16 16" width={tam} height={tam} aria-hidden="true" className="tilde">
      <circle cx="8" cy="8" r="8" fill="currentColor" />
      <path d="M4.6 8.3l2.2 2.2 4.6-4.8" fill="none" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
