// Ingreso con usuario y contraseña. Los usuarios salen del archivo de jueces de
// demostración; las contraseñas se comparan contra un hash scrypt y los tokens
// de sesión se guardan hasheados, así un reinicio no cierra las sesiones.

import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import type { Rol } from "../compartido/tipos.ts";
import type { Juez, Operador } from "./contexto.ts";
import type { Db } from "./db.ts";
import { sha256Hex } from "./evidencia.ts";

export interface UsuarioBase {
  usuario: string;
  nombre: string;
  rol: Rol;
  juez_id: string | null;
  juzgado_nombre: string | null;
}

interface Registro {
  base: UsuarioBase;
  sal: Buffer;
  hash: Buffer;
}

function derivar(contrasena: string, sal: Buffer): Buffer {
  return scryptSync(contrasena, sal, 32, { N: 4096 });
}

export class Sesiones {
  private readonly db: Db;
  private readonly usuarios = new Map<string, Registro>();

  constructor(db: Db, jueces: Juez[], operadores: Operador[]) {
    this.db = db;
    for (const j of jueces) {
      this.registrar(
        { usuario: j.usuario, nombre: j.nombre, rol: "juez", juez_id: j.id, juzgado_nombre: j.juzgado_nombre },
        j.contrasena,
      );
    }
    for (const o of operadores) {
      this.registrar({ usuario: o.usuario, nombre: o.nombre, rol: o.rol, juez_id: null, juzgado_nombre: null }, o.contrasena);
    }
  }

  private registrar(base: UsuarioBase, contrasena: string): void {
    const sal = randomBytes(16);
    this.usuarios.set(base.usuario.toLowerCase(), { base, sal, hash: derivar(contrasena, sal) });
  }

  ingresar(usuario: unknown, contrasena: unknown): { token: string; usuario: UsuarioBase } | null {
    if (typeof usuario !== "string" || typeof contrasena !== "string") return null;
    const registro = this.usuarios.get(usuario.trim().toLowerCase());
    if (!registro) return null;
    if (!timingSafeEqual(derivar(contrasena, registro.sal), registro.hash)) return null;
    const token = randomBytes(32).toString("hex");
    this.db
      .prepare("INSERT INTO sesiones (token_hash, usuario, creada_iso) VALUES (?, ?, ?)")
      .run(sha256Hex(token), registro.base.usuario, new Date().toISOString());
    return { token, usuario: registro.base };
  }

  porToken(token: string | null | undefined): UsuarioBase | null {
    if (!token) return null;
    const fila = this.db.prepare("SELECT usuario FROM sesiones WHERE token_hash = ?").get(sha256Hex(token)) as
      | { usuario: string }
      | undefined;
    if (!fila) return null;
    return this.usuarios.get(fila.usuario.toLowerCase())?.base ?? null;
  }

  salir(token: string | null | undefined): void {
    if (token) this.db.prepare("DELETE FROM sesiones WHERE token_hash = ?").run(sha256Hex(token));
  }
}
