// Piezas chicas que comparten todas las pantallas.

import { type ReactNode, useEffect } from "react";
import type { EstadoDTO, Luz as TipoLuz } from "../../compartido/tipos.ts";
import { type TonoEstado, huellaCorta, reloj } from "../nucleo/formato.ts";
import { useMinuto } from "../nucleo/reloj.ts";

export type Tema = "papel" | "noche";

const COLOR_BARRA: Record<Tema, string> = { papel: "#e8eaef", noche: "#0b1533" };

/** Aplica el tema a toda la página (también al fondo que se ve al rebotar el scroll). */
export function useTema(tema: Tema): void {
  useEffect(() => {
    const raiz = document.documentElement;
    const previo = raiz.dataset.tema;
    raiz.dataset.tema = tema;
    const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
    const colorPrevio = meta?.content;
    if (meta) meta.content = COLOR_BARRA[tema];
    return () => {
      if (previo) raiz.dataset.tema = previo;
      else delete raiz.dataset.tema;
      if (meta && colorPrevio) meta.content = colorPrevio;
    };
  }, [tema]);
}

export function useTitulo(titulo: string): void {
  useEffect(() => {
    document.title = titulo;
  }, [titulo]);
}

/** El nombre con la línea de offside: la misma línea que separa lo que se bloquea de lo que no. */
export function Marca({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center font-extrabold leading-none tracking-[-0.01em] ${className}`} aria-label="Offside">
      <span aria-hidden="true">Off</span>
      <span aria-hidden="true" className="mx-[0.14em] inline-block h-[1.5em] w-[0.11em] min-w-[2px] bg-firma" />
      <span aria-hidden="true">side</span>
    </span>
  );
}

const NOMBRE_LUZ: Record<TipoLuz, string> = { verde: "Verde", ambar: "Ámbar", roja: "Roja" };

/** Luz de una verificación. Cada color tiene además su forma, para no depender del color. */
export function Luz({ luz, tam = 22, className = "" }: { luz: TipoLuz; tam?: number; className?: string }) {
  return (
    <svg
      role="img"
      aria-label={`Luz ${NOMBRE_LUZ[luz].toLowerCase()}`}
      viewBox="0 0 24 24"
      width={tam}
      height={tam}
      className={`flex-none ${className}`}
    >
      {luz === "verde" && (
        <>
          <circle cx="12" cy="12" r="11" fill="var(--verde-luz)" />
          <path d="M6.8 12.6l3.4 3.4 7-7.6" fill="none" stroke="var(--papel)" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
        </>
      )}
      {luz === "ambar" && (
        <>
          <path d="M12 1.8 23 21.4H1z" fill="var(--ambar-luz)" stroke="var(--ambar-luz)" strokeWidth="1.6" strokeLinejoin="round" />
          <path d="M12 8.6v6" stroke="#231700" strokeWidth="2.6" strokeLinecap="round" />
          <circle cx="12" cy="18" r="1.5" fill="#231700" />
        </>
      )}
      {luz === "roja" && (
        <>
          <path d="M7.4 1h9.2L23 7.4v9.2L16.6 23H7.4L1 16.6V7.4z" fill="var(--roja-luz)" />
          <path d="M8 8l8 8M16 8l-8 8" stroke="var(--papel)" strokeWidth="2.6" strokeLinecap="round" />
        </>
      )}
    </svg>
  );
}

/** Tres tramos (por enviar, recibida, aplicada) que se van llenando. */
export function Pasos({ paso, tono, grande = false }: { paso: 0 | 1 | 2 | 3; tono: TonoEstado; grande?: boolean }) {
  return (
    <span className={`pasos ${grande ? "pasos-grande" : ""}`} data-tono={tono} aria-hidden="true">
      {[1, 2, 3].map((n) => (
        <i key={n} data-lleno={paso >= n ? "" : undefined} />
      ))}
    </span>
  );
}

export function Huella({ valor, largo = 16, className = "" }: { valor: string | null | undefined; largo?: number; className?: string }) {
  const completa = valor ?? "";
  const recortada = largo > 0 && completa.length > largo;
  return (
    <span className={`huella ${className}`} title={recortada ? completa : undefined}>
      {largo > 0 ? huellaCorta(completa, largo) : completa || "sin huella"}
      {recortada ? "…" : ""}
    </span>
  );
}

const ES_IP = /^(\d{1,3}(\.\d{1,3}){3}|[0-9a-f:]*:[0-9a-f:.]*)$/i;

/** Lo que se bloquea, en monoespaciada. Una IP nunca se parte en dos renglones; un dominio largo, sí. */
export function Objetivo({ valor, className = "" }: { valor: string | null | undefined; className?: string }) {
  if (!valor) return null;
  return <span className={`huella ${ES_IP.test(valor) ? "whitespace-nowrap" : ""} ${className}`}>{valor}</span>;
}

/** Reloj del partido, interpolado entre un dato del servidor y el siguiente. */
export function RelojPartido({ estado, className = "" }: { estado: EstadoDTO; className?: string }) {
  const m = useMinuto(200);
  return (
    <span className={`cifras ${className}`} role="timer" aria-label={`Minuto ${Math.floor(m)} del partido`}>
      {reloj(estado.finalizado ? estado.fin_min : m)}
    </span>
  );
}

/** Avisos de corte: con Offside o con el simulador. En tinta, sin colores de estado. */
export function Cortes({ estado, sinServidor }: { estado: EstadoDTO | null; sinServidor: boolean }) {
  let titulo: string | null = null;
  let detalle: string | null = null;
  let tecnico: string | null = null;
  if (sinServidor) {
    titulo = "Sin conexión con Offside";
    detalle = "Lo que ves puede estar desactualizado. Se reintenta solo.";
  } else if (estado && !estado.conectado) {
    titulo = "Sin conexión con el simulador";
    detalle = "No se puede firmar ni enviar órdenes hasta que vuelva. Se reintenta solo.";
    tecnico = estado.ultimo_error;
  }
  if (!titulo) return null;
  return (
    <div role="alert" className="flex items-stretch bg-tinta text-papel">
      <span aria-hidden="true" className="rayado w-3 flex-none bg-papel" />
      <div className="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-3 gap-y-0.5 px-4 py-2.5">
        <strong className="flex items-center gap-2 font-bold">
          <span aria-hidden="true" className="inline-block size-2.5 animate-latir rounded-full bg-papel" />
          {titulo}
        </strong>
        <span className="min-w-0 text-[0.9375rem] opacity-85">{detalle}</span>
        {tecnico && <span className="huella hidden min-w-0 opacity-60 sm:inline">{tecnico}</span>}
      </div>
    </div>
  );
}

export function Cargando({ texto = "Cargando…" }: { texto?: string }) {
  return (
    <p className="px-4 py-16 text-center text-tinta-2" role="status">
      {texto}
    </p>
  );
}

/** Par rótulo y valor para datos de ficha. */
export function Dato({ rotulo, children, className = "" }: { rotulo: string; children: ReactNode; className?: string }) {
  return (
    <div className={`min-w-0 ${className}`}>
      <dt className="text-[0.8125rem] font-medium text-tinta-2">{rotulo}</dt>
      <dd className="m-0 min-w-0 break-words">{children}</dd>
    </div>
  );
}

// --- íconos (trazo, 24 px) ---------------------------------------------------------------

function Icono({ children, tam = 22 }: { children: ReactNode; tam?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={tam} height={tam} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="flex-none">
      {children}
    </svg>
  );
}

export const IconoSonido = ({ tam }: { tam?: number }) => (
  <Icono tam={tam}>
    <path d="M4 9.5v5h3.5L12 18.5v-13L7.5 9.5z" />
    <path d="M15.5 9a4.2 4.2 0 010 6M18 6.5a7.8 7.8 0 010 11" />
  </Icono>
);
export const IconoSilencio = ({ tam }: { tam?: number }) => (
  <Icono tam={tam}>
    <path d="M4 9.5v5h3.5L12 18.5v-13L7.5 9.5z" />
    <path d="M16 9.5l5 5M21 9.5l-5 5" />
  </Icono>
);
export const IconoSalir = ({ tam }: { tam?: number }) => (
  <Icono tam={tam}>
    <path d="M10 4H5.5A1.5 1.5 0 004 5.5v13A1.5 1.5 0 005.5 20H10" />
    <path d="M15 8l4 4-4 4M19 12H9.5" />
  </Icono>
);
export const IconoVolver = ({ tam }: { tam?: number }) => (
  <Icono tam={tam}>
    <path d="M19 12H5M10.5 6.5L5 12l5.5 5.5" />
  </Icono>
);
export const IconoImprimir = ({ tam }: { tam?: number }) => (
  <Icono tam={tam}>
    <path d="M7 9V4h10v5M7 17H5a1 1 0 01-1-1v-5a2 2 0 012-2h12a2 2 0 012 2v5a1 1 0 01-1 1h-2" />
    <path d="M7 14h10v6H7z" />
  </Icono>
);
export const IconoCerrar = ({ tam }: { tam?: number }) => (
  <Icono tam={tam}>
    <path d="M6 6l12 12M18 6L6 18" />
  </Icono>
);
