// Partido de práctica para probar a mano: levanta el simulador oficial y Offside
// con una base nueva, y los deja corriendo hasta Ctrl+C.
//
//   pnpm demo                          partido de práctica x6 (17,5 minutos reales)
//   pnpm demo -- --acelerar 2          más lento, para grabar el video
//   pnpm demo -- --inicio-min 40       arranca en el minuto 40 (cambio de turno en el 50)
//   pnpm demo -- --simulacro           fuerza un bloqueo equivocado para mostrar los reclamos
//   pnpm demo -- --carpeta salida/esc  escenario propio (ver herramientas/generar_escenario.py)
//
// Simulador en http://localhost:8080 y Offside en http://localhost:3000.

import { type ChildProcess, spawn } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import { join, resolve } from "node:path";

const RAIZ = resolve(import.meta.dirname, "..");
const OFICIAL = join(RAIZ, ".simulador", "desafio-futbol");

function argumento(nombre: string, porDefecto: string): string {
  const i = process.argv.indexOf(`--${nombre}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1]! : porDefecto;
}

const carpeta = argumento("carpeta", "");
const acelerar = argumento("acelerar", "6");
const inicioMin = argumento("inicio-min", "0");
const puertoSim = argumento("puerto-simulador", "8080");
const puertoApp = argumento("puerto", "3000");
const datos = resolve(carpeta || join(OFICIAL, "datos"));
const escenario = resolve(carpeta ? join(carpeta, "escenario.json") : join(OFICIAL, "datos", "escenario_practica.json"));
const jueces = resolve(carpeta ? join(carpeta, "jueces.demo.json") : join(RAIZ, "config", "jueces.demo.json"));

if (!existsSync(join(OFICIAL, "simulador", "servidor.py"))) {
  console.error("Falta el material oficial. Ejecutá: bash scripts/traer-simulador.sh");
  process.exit(2);
}
mkdirSync(join(RAIZ, "salida"), { recursive: true });

const hijos: ChildProcess[] = [];
function terminar(): void {
  for (const h of hijos) if (h.exitCode === null) h.kill("SIGINT");
}
process.on("SIGINT", () => {
  terminar();
  setTimeout(() => process.exit(0), 400);
});
process.on("SIGTERM", () => {
  terminar();
  process.exit(0);
});

hijos.push(
  spawn(
    "python3",
    ["-I", join(OFICIAL, "simulador", "servidor.py"), "--escenario", escenario, "--datos", datos, "--acelerar", acelerar, "--inicio-min", inicioMin, "--puerto", puertoSim, "--log", join(RAIZ, "salida", "registro.jsonl")],
    { cwd: RAIZ, stdio: "inherit" },
  ),
);

setTimeout(() => {
  hijos.push(
    spawn(
      join(RAIZ, "node_modules", ".bin", "tsx"),
      [
        "--disable-warning=ExperimentalWarning",
        join(RAIZ, "src", "server", "index.ts"),
        "--nuevo",
        ...(process.argv.includes("--simulacro") ? ["--simulacro"] : []),
      ],
      {
        cwd: RAIZ,
        stdio: "inherit",
        env: {
          ...process.env,
          SIMULADOR_URL: `http://localhost:${puertoSim}`,
          PUERTO: puertoApp,
          OFFSIDE_JUECES: jueces,
        },
      },
    ),
  );
}, 700);

for (const h of hijos) h.on("exit", () => terminar());
