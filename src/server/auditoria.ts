// Registro de auditoría de solo agregado, encadenado por hashes.
//
// Cada entrada guarda su contenido como texto JSON y un hash calculado sobre el
// hash anterior, el número de secuencia y ese texto. Cambiar, borrar o insertar
// una entrada rompe la cadena desde ese punto. La verificación se puede repetir
// solo con el archivo exportado (lo hace herramientas/verificar_expediente.py).

import type { Db } from "./db.ts";
import { sha256Hex } from "./evidencia.ts";

export const HASH_GENESIS = "0".repeat(64);

export interface EntradaAuditoria {
  minuto: number | null;
  actor: string;
  tipo: string;
  datos: unknown;
}

interface Fila {
  seq: number;
  contenido: string;
  hash_anterior: string;
  hash: string;
}

export function hashEntrada(hashAnterior: string, seq: number, contenido: string): string {
  return sha256Hex(`${hashAnterior}\n${seq}\n${contenido}`);
}

export class Auditoria {
  private readonly db: Db;
  private readonly reloj: () => string;

  constructor(db: Db, reloj: () => string = () => new Date().toISOString()) {
    this.db = db;
    this.reloj = reloj;
  }

  cabecera(): { seq: number; hash: string } {
    const fila = this.db.prepare("SELECT seq, hash FROM auditoria ORDER BY seq DESC LIMIT 1").get() as
      | { seq: number; hash: string }
      | undefined;
    return fila ? { seq: Number(fila.seq), hash: fila.hash } : { seq: 0, hash: HASH_GENESIS };
  }

  /** La cabecera tal como queda dentro de una instantánea (ver instantanea.ts, Ancla). */
  ancla(): { seq: number; cabecera: string } {
    const c = this.cabecera();
    return { seq: c.seq, cabecera: c.hash };
  }

  registrar(e: EntradaAuditoria): { seq: number; hash: string } {
    const anterior = this.cabecera();
    const seq = anterior.seq + 1;
    const contenido = JSON.stringify({
      hora_iso: this.reloj(),
      minuto: e.minuto,
      actor: e.actor,
      tipo: e.tipo,
      datos: e.datos ?? null,
    });
    const hash = hashEntrada(anterior.hash, seq, contenido);
    this.db
      .prepare("INSERT INTO auditoria (seq, contenido, hash_anterior, hash) VALUES (?, ?, ?, ?)")
      .run(seq, contenido, anterior.hash, hash);
    return { seq, hash };
  }

  private filas(hasta = Number.MAX_SAFE_INTEGER): Fila[] {
    return (
      this.db.prepare("SELECT seq, contenido, hash_anterior, hash FROM auditoria WHERE seq <= ? ORDER BY seq").all(hasta) as unknown as Fila[]
    ).map((f) => ({ ...f, seq: Number(f.seq) }));
  }

  /** Recorre la cadena completa. Devuelve la primera secuencia que no coincide. */
  verificar(): { ok: true } | { ok: false; falla_en: number } {
    let anterior = HASH_GENESIS;
    let esperada = 1;
    for (const f of this.filas()) {
      if (f.seq !== esperada || f.hash_anterior !== anterior || f.hash !== hashEntrada(anterior, f.seq, f.contenido)) {
        return { ok: false, falla_en: f.seq !== esperada ? esperada : f.seq };
      }
      anterior = f.hash;
      esperada += 1;
    }
    return { ok: true };
  }

  /** Últimas entradas, ya interpretadas, para mostrar en pantalla. */
  ultimas(limite: number): { seq: number; hash: string; hora_iso: string; minuto: number | null; actor: string; tipo: string; datos: unknown }[] {
    const filas = this.db
      .prepare("SELECT seq, contenido, hash FROM auditoria ORDER BY seq DESC LIMIT ?")
      .all(limite) as unknown as { seq: number; contenido: string; hash: string }[];
    return filas.map((f) => ({ seq: Number(f.seq), hash: f.hash, ...JSON.parse(f.contenido) }));
  }

  /** Una línea JSON por entrada: { seq, hash_anterior, hash, contenido }, hasta la secuencia `hasta` incluida. */
  exportarJsonl(hasta?: number): string {
    return this.filas(hasta)
      .map((f) => JSON.stringify({ seq: f.seq, hash_anterior: f.hash_anterior, hash: f.hash, contenido: f.contenido }))
      .join("\n")
      .concat("\n");
  }
}
