// Usuarios con contraseñas propias para el partido final. Las de
// config/jueces.demo.json son públicas (están en el repositorio).
//
//   pnpm jueces-locales                         escribe config/jueces.local.json
//   pnpm jueces-locales -- --desde otro.json    parte de otro archivo de jueces (por ejemplo, el de la final)
//   pnpm jueces-locales -- --forzar             reemplaza un archivo existente
//
// Copia jueces, juzgados y claves de firma (las publica la organización y el
// simulador las exige) y sortea una contraseña nueva para cada usuario. Las
// contraseñas se muestran una sola vez, acá. El archivo no se sube al repositorio.
// Después: OFFSIDE_JUECES=config/jueces.local.json pnpm start

import { randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { cargarJueces } from "../src/server/config.ts";

const RAIZ = resolve(import.meta.dirname, "..");

function argumento(nombre: string, porDefecto: string): string {
  const i = process.argv.indexOf(`--${nombre}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1]! : porDefecto;
}

const desde = resolve(argumento("desde", resolve(RAIZ, "config", "jueces.demo.json")));
const salida = resolve(argumento("salida", resolve(RAIZ, "config", "jueces.local.json")));

if (existsSync(salida) && !process.argv.includes("--forzar")) {
  console.error(`Ya existe ${salida}. Para reemplazarlo (y cambiar todas las contraseñas): pnpm jueces-locales -- --forzar`);
  process.exit(1);
}

// Valida el origen con las mismas reglas que el servidor.
const { jueces, operadores } = cargarJueces(desde);
const origen = JSON.parse(readFileSync(desde, "utf8")) as Record<string, unknown>;

/** 20 caracteres sin ambiguos (sin 0/O, 1/l/I), en grupos de cinco para dictarlos. */
function contrasena(): string {
  const letras = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = randomBytes(20);
  const c = [...bytes].map((b) => letras[b % letras.length]).join("");
  return c.match(/.{5}/g)!.join("-");
}

const nuevos = {
  ...origen,
  aviso:
    "Usuarios del partido final con contraseñas propias, generadas por pnpm jueces-locales. No subir al repositorio. Jueces, juzgados y claves de firma son los del archivo de origen.",
  jueces: jueces.map((j) => ({ ...j, contrasena: contrasena() })),
  operadores: operadores.map((o) => ({ ...o, contrasena: contrasena() })),
};

mkdirSync(dirname(salida), { recursive: true });
writeFileSync(salida, JSON.stringify(nuevos, null, 2) + "\n", { encoding: "utf8", mode: 0o600 });

console.log(`Escrito ${salida} (a partir de ${desde}).`);
console.log("Contraseñas nuevas. Se muestran solo esta vez: anotalas y entregalas en mano.\n");
for (const u of [...nuevos.jueces, ...nuevos.operadores]) {
  console.log(`  ${u.usuario.padEnd(12)} ${u.contrasena}   ${u.nombre}`);
}
console.log(`\nPara usarlas: OFFSIDE_HOST=127.0.0.1 OFFSIDE_JUECES=${salida.startsWith(RAIZ) ? salida.slice(RAIZ.length + 1) : salida} pnpm start`);
