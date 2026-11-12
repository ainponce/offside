// Motivo del rechazo: tres opciones rápidas y texto libre. Hoja inferior en el
// celular, cuadro centrado en escritorio.

import { useEffect, useRef, useState } from "react";
import type { MedidaDTO } from "../../compartido/tipos.ts";
import { CLASE } from "../nucleo/formato.ts";

const MOTIVOS = ["La evidencia no alcanza", "Riesgo para terceros", "El objetivo no es el correcto"];
const MAXIMO = 300;

export function HojaRechazo(p: { medida: MedidaDTO; enviando: boolean; alCancelar: () => void; alConfirmar: (motivo: string) => void }) {
  const dialogo = useRef<HTMLDialogElement>(null);
  const [opcion, setOpcion] = useState<string | null>(null);
  const [texto, setTexto] = useState("");

  useEffect(() => {
    const d = dialogo.current;
    if (d && !d.open) d.showModal();
    return () => {
      if (d?.open) d.close();
    };
  }, []);

  const motivo = [opcion, texto.trim()].filter(Boolean).join(". ").slice(0, MAXIMO);
  const objetivo = p.medida.levantamiento?.dominio ?? p.medida.servidor?.host ?? p.medida.expediente_id;

  return (
    <dialog
      ref={dialogo}
      aria-labelledby="titulo-rechazo"
      onCancel={(e) => {
        e.preventDefault();
        if (!p.enviando) p.alCancelar();
      }}
      onClick={(e) => {
        if (e.target === dialogo.current && !p.enviando) p.alCancelar();
      }}
      className="m-0 mx-auto mt-auto w-full max-w-[560px] animate-subir rounded-t-[14px] border-2 border-b-0 border-tinta bg-papel p-0 text-tinta backdrop:bg-[rgba(19,23,34,0.55)] sm:my-auto sm:rounded-[12px] sm:border-b-2"
    >
      <form
        method="dialog"
        className="px-4 pb-[calc(env(safe-area-inset-bottom)+16px)] pt-4 sm:px-6 sm:pb-6 sm:pt-5"
        onSubmit={(e) => {
          e.preventDefault();
          if (!p.enviando) p.alConfirmar(motivo);
        }}
      >
        <h2 id="titulo-rechazo" className="m-0 text-[1.25rem] font-extrabold leading-tight">
          Rechazar la medida
        </h2>
        <p className="m-0 mt-1 wrap-anywhere text-[0.9375rem] leading-snug text-tinta-2">
          {CLASE[p.medida.clase]}: <span className="font-semibold text-tinta">{objetivo}</span>
        </p>

        <fieldset className="m-0 mt-4 border-0 p-0">
          <legend className="mb-2 p-0 text-[0.9375rem] font-semibold">Motivo</legend>
          <div className="grid gap-2">
            {MOTIVOS.map((m) => {
              const elegido = opcion === m;
              return (
                <button
                  key={m}
                  type="button"
                  role="radio"
                  aria-checked={elegido}
                  onClick={() => setOpcion(elegido ? null : m)}
                  className={`flex min-h-[52px] items-center gap-3 rounded-[6px] border-2 px-3 text-left text-[1.0625rem] font-semibold ${
                    elegido ? "border-tinta bg-tinta text-papel" : "border-regla bg-papel text-tinta hover:border-tinta"
                  }`}
                >
                  <span aria-hidden="true" className={`grid size-5 flex-none place-items-center rounded-full border-2 ${elegido ? "border-papel" : "border-tinta-3"}`}>
                    {elegido && <span className="size-2.5 rounded-full bg-papel" />}
                  </span>
                  {m}
                </button>
              );
            })}
          </div>
        </fieldset>

        <label className="mt-4 block">
          <span className="mb-1.5 block text-[0.9375rem] font-semibold">
            Aclaración <span className="font-normal text-tinta-2">(opcional)</span>
          </span>
          <textarea className="campo" rows={2} maxLength={MAXIMO} value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Queda en el expediente y en la auditoría" />
        </label>

        <div className="mt-4 flex gap-2.5">
          <button type="button" className="boton h-[56px] w-[34%] flex-none" onClick={p.alCancelar} disabled={p.enviando}>
            Volver
          </button>
          <button type="submit" className="boton h-[56px] min-w-0 flex-1 border-tinta bg-tinta text-[1.0625rem] text-papel hover:!bg-tinta-2" disabled={p.enviando}>
            {p.enviando ? "Rechazando…" : "Rechazar la medida"}
          </button>
        </div>
      </form>
    </dialog>
  );
}
