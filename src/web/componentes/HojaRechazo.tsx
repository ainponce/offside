// Rechazo: tres motivos rápidos y texto libre, en una hoja que sube desde abajo.
// Se cierra con el velo, con Esc o arrastrándola hacia abajo.

import { type PointerEvent as EventoPuntero, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { MedidaDTO } from "../../compartido/tipos.ts";
import { CLASE } from "../nucleo/formato.ts";
import { movimientoReducido } from "./comunes.tsx";
import { objetivoDe } from "./Medida.tsx";

const MOTIVOS = ["La evidencia no alcanza", "Riesgo para terceros", "El objetivo no es el correcto"];
const MAXIMO = 300;

/** Resorte críticamente amortiguado (respuesta 0,38 s): asienta en 512 ms, sin rebote. */
export const RESORTE = "linear(0, 0.081, 0.242, 0.412, 0.561, 0.681, 0.773, 0.84, 0.889, 0.924, 0.948, 0.965, 0.976, 0.984, 0.99, 0.993, 0.995, 0.997, 1)";
export const SALIDA = "cubic-bezier(0.23, 1, 0.32, 1)";

/** Lo que el dedo arrastra más allá del tope se frena progresivamente. */
function resistencia(exceso: number, dimension: number, k = 0.55): number {
  return (exceso * dimension * k) / (dimension + k * Math.abs(exceso));
}

export function HojaRechazo(p: { medida: MedidaDTO; enviando: boolean; alCancelar: () => void; alConfirmar: (motivo: string) => void }) {
  const dialogo = useRef<HTMLDialogElement>(null);
  const hoja = useRef<HTMLDivElement>(null);
  const velo = useRef<HTMLDivElement>(null);
  const [opcion, setOpcion] = useState<string | null>(null);
  const [texto, setTexto] = useState("");
  const cerrando = useRef(false);
  const arrastre = useRef<{ id: number; y0: number; dy: number; t: number; v: number } | null>(null);
  const enviando = useRef(p.enviando);
  enviando.current = p.enviando;
  const alCancelar = useRef(p.alCancelar);
  alCancelar.current = p.alCancelar;

  useLayoutEffect(() => {
    const d = dialogo.current;
    if (d && !d.open) d.showModal();
    const reducido = movimientoReducido();
    hoja.current?.animate(
      reducido ? [{ opacity: 0 }, { opacity: 1 }] : [{ transform: "translateY(100%)" }, { transform: "translateY(0)" }],
      { duration: reducido ? 160 : 512, easing: reducido ? "ease" : RESORTE },
    );
    velo.current?.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 200, easing: "ease" });
    return () => {
      if (d?.open) d.close();
    };
  }, []);

  const cerrar = (velocidad = 0) => {
    if (enviando.current || cerrando.current) return;
    cerrando.current = true;
    const h = hoja.current;
    const reducido = movimientoReducido();
    const actual = h ? getComputedStyle(h).transform : "none";
    const duracion = velocidad > 0 ? Math.max(120, Math.min(200, (h?.offsetHeight ?? 400) / velocidad)) : 200;
    velo.current?.animate([{ opacity: 1 }, { opacity: 0 }], { duration: duracion, easing: "ease", fill: "forwards" });
    const a = h?.animate(
      reducido ? [{ opacity: 1 }, { opacity: 0 }] : [{ transform: actual === "none" ? "translateY(0)" : actual }, { transform: "translateY(100%)" }],
      { duration: reducido ? 160 : duracion, easing: SALIDA, fill: "forwards" },
    );
    if (a) a.onfinish = () => alCancelar.current();
    else alCancelar.current();
  };

  useEffect(() => {
    const d = dialogo.current;
    if (!d) return;
    const alCancelarDialogo = (e: Event) => {
      e.preventDefault();
      cerrar();
    };
    d.addEventListener("cancel", alCancelarDialogo);
    return () => d.removeEventListener("cancel", alCancelarDialogo);
  });

  // --- arrastre hacia abajo ---------------------------------------------------------------
  const alApoyar = (e: EventoPuntero<HTMLDivElement>) => {
    if (arrastre.current || p.enviando) return;
    const destino = e.target as HTMLElement;
    if (destino.closest("button, textarea, input, label")) return;
    arrastre.current = { id: e.pointerId, y0: e.clientY, dy: 0, t: performance.now(), v: 0 };
    e.currentTarget.setPointerCapture(e.pointerId);
    hoja.current?.getAnimations().forEach((a) => a.cancel());
  };
  const alMover = (e: EventoPuntero<HTMLDivElement>) => {
    const a = arrastre.current;
    const h = hoja.current;
    if (!a || a.id !== e.pointerId || !h) return;
    const dy = e.clientY - a.y0;
    const ahora = performance.now();
    a.v = (dy - a.dy) / Math.max(1, ahora - a.t);
    a.dy = dy;
    a.t = ahora;
    const y = dy >= 0 ? dy : resistencia(dy, h.offsetHeight);
    h.style.transform = `translateY(${y}px)`;
  };
  const alSoltar = (e: EventoPuntero<HTMLDivElement>) => {
    const a = arrastre.current;
    const h = hoja.current;
    if (!a || a.id !== e.pointerId || !h) return;
    arrastre.current = null;
    if (a.dy > 120 || a.v > 0.5) {
      cerrar(Math.max(a.v, 0.8));
      return;
    }
    const desde = h.style.transform || "translateY(0)";
    h.style.transform = "";
    h.animate([{ transform: desde }, { transform: "translateY(0)" }], { duration: 400, easing: RESORTE });
  };

  const motivo = [opcion, texto.trim()].filter(Boolean).join(". ").slice(0, MAXIMO);
  // El botón queda activo: si falta el motivo, el toque lo dice en vez de no hacer nada.
  const [falta, setFalta] = useState(false);
  useEffect(() => {
    if (motivo) setFalta(false);
  }, [motivo]);

  return (
    <dialog ref={dialogo} className="dialogo-hoja" aria-labelledby="titulo-rechazo">
      <div ref={velo} className="velo" onClick={() => cerrar()} aria-hidden="true" />
      <div ref={hoja} className="hoja hoja-rechazo" onPointerDown={alApoyar} onPointerMove={alMover} onPointerUp={alSoltar} onPointerCancel={alSoltar}>
        <span className="hoja-agarre" aria-hidden="true" />
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (p.enviando) return;
            if (!motivo) {
              setFalta(true);
              return;
            }
            p.alConfirmar(motivo);
          }}
        >
          <h2 id="titulo-rechazo" className="hoja-titulo">
            Rechazar la medida
          </h2>
          <p className="hoja-sub">
            {CLASE[p.medida.clase]}, {objetivoDe(p.medida)}
          </p>

          <fieldset className="motivos">
            <legend className="sr-only">Motivo</legend>
            {MOTIVOS.map((m) => {
              const elegido = opcion === m;
              return (
                <button key={m} type="button" role="radio" aria-checked={elegido} className="motivo" onClick={() => setOpcion(elegido ? null : m)}>
                  <span className="motivo-marca" aria-hidden="true" />
                  {m}
                </button>
              );
            })}
          </fieldset>

          <label className="campo-rotulo" htmlFor="aclaracion">
            Aclaración, si hace falta
          </label>
          <textarea id="aclaracion" className="campo campo-texto" rows={2} maxLength={MAXIMO} value={texto} onChange={(e) => setTexto(e.target.value)} />
          <p className="hoja-nota">Queda en el expediente y en la cadena de auditoría.</p>

          <button type="submit" className="boton boton-grafito boton-ancho" aria-disabled={p.enviando || undefined} aria-describedby={falta ? "falta-motivo" : undefined}>
            <span>{p.enviando ? "Rechazando…" : "Rechazar"}</span>
          </button>
          {falta && (
            <p id="falta-motivo" className="hoja-falta" role="alert">
              Elegí un motivo o escribí una aclaración.
            </p>
          )}
          <button type="button" className="boton-texto" onClick={() => cerrar()} disabled={p.enviando}>
            Cancelar
          </button>
        </form>
      </div>
    </dialog>
  );
}
