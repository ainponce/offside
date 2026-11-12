// Reinicio del simulador con Offside en marcha (el reloj vuelve atrás, cambia el
// partido o un proveedor deja de conocer nuestras órdenes): la base es de otro
// partido. Se archiva, se abre una limpia en el mismo proceso y se avisa fuerte.
// Los jueces vuelven a ingresar porque las sesiones viven en la base.

import { existsSync, renameSync } from "node:fs";
import { Auditoria } from "./auditoria.ts";
import { type Contexto, alertar } from "./contexto.ts";
import { abrirDb } from "./db.ts";

/** Archiva la base (y sus archivos -wal y -shm) con un sello de tiempo. Devuelve la ruta nueva. */
export function archivarBase(ruta: string, prefijo: string): string | null {
  if (ruta === ":memory:" || !existsSync(ruta)) return null;
  const sello = new Date().toISOString().replace(/[:.]/g, "-");
  const destino = `${ruta}.${prefijo}-${sello}`;
  for (const sufijo of ["", "-wal", "-shm"]) {
    if (existsSync(ruta + sufijo)) renameSync(ruta + sufijo, destino + sufijo);
  }
  return destino;
}

export function reiniciarBase(ctx: Contexto, motivo: string, datos: Record<string, unknown>): void {
  // Queda constancia en la base que se cierra y en la nueva.
  try {
    ctx.auditoria.registrar({ minuto: ctx.estado.minuto, actor: "sistema", tipo: "simulador_reiniciado", datos: { ...datos, motivo } });
  } catch {
    // La base vieja puede estar rota; lo importante es la nueva.
  }
  const ruta = ctx.config.dbRuta;
  try {
    ctx.db.close();
  } catch {
    // ya cerrada
  }
  const archivo = archivarBase(ruta, "reinicio");
  const nueva = abrirDb(ruta);
  ctx.db = nueva;
  ctx.auditoria = new Auditoria(nueva);
  ctx.enVuelo.clear();
  ctx.estado.partido = null;
  ctx.estado.proveedores = [];
  ctx.estado.turnos = [];
  ctx.estado.jueces_de_turno = [];
  ctx.estado.minuto = 0;
  ctx.estado.finalizado = false;
  ctx.estado.alertas = [];
  alertar(ctx, `El simulador se reinició (${motivo}). Offside empezó una base nueva${archivo ? `; la anterior quedó en ${archivo}` : ""}. Los jueces tienen que volver a ingresar.`);

  ctx.auditoria.registrar({ minuto: null, actor: "sistema", tipo: "simulador_reiniciado", datos: { ...datos, motivo } });
  ctx.auditoria.registrar({ minuto: null, actor: "sistema", tipo: "base_reiniciada", datos: { archivo, motivo } });

  const linea = "=".repeat(78);
  ctx.consola(
    [
      "",
      linea,
      "  SIMULADOR REINICIADO: Offside empezó una base nueva, sin cerrar el proceso.",
      `  Motivo: ${motivo}.`,
      archivo ? `  Base anterior archivada en ${archivo}` : "  La base anterior era en memoria: no se archivó.",
      "  Los jueces y la fiscalía tienen que volver a ingresar.",
      linea,
      "",
    ].join("\n"),
  );
  ctx.alCambiar();
}
