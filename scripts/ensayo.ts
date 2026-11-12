// Ensayo automático: corre un partido entero contra el simulador oficial y lo
// evalúa con el verificador oficial.
//
//   pnpm ensayo                                  partido de práctica, acelerado x60
//   pnpm ensayo -- --acelerar 6 --demora-juez 1  más parecido al partido final
//   pnpm ensayo -- --carpeta salida/escenario-7  escenario propio (ver herramientas/generar_escenario.py)
//   pnpm ensayo -- --simulacro --permitir-colateral  con el bloqueo equivocado a propósito: todo reclamo tiene que terminar en levantamiento
//
// El "juez de ensayo" entra por el mismo ingreso que un juez real y aprueba lo
// que le toca tras una demora. Existe solo para ensayar: en el partido final
// firma una persona.

import { type ChildProcess, spawn, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createServer } from "node:net";
import { join, resolve } from "node:path";
import type { ColaDTO, RespuestaIngreso, TableroDTO } from "../src/compartido/tipos.ts";

const RAIZ = resolve(import.meta.dirname, "..");
const OFICIAL = join(RAIZ, ".simulador", "desafio-futbol");

function argumento(nombre: string, porDefecto: string): string {
  const i = process.argv.indexOf(`--${nombre}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1]! : porDefecto;
}
const bandera = (nombre: string) => process.argv.includes(`--${nombre}`);

const carpeta = argumento("carpeta", "");
const acelerar = Number(argumento("acelerar", "60"));
const demoraJuez = Number(argumento("demora-juez", "0.5"));
const datos = resolve(argumento("datos", carpeta || join(OFICIAL, "datos")));
const escenario = resolve(argumento("escenario", carpeta ? join(carpeta, "escenario.json") : join(OFICIAL, "datos", "escenario_practica.json")));
const verdad = resolve(argumento("verdad", carpeta ? join(carpeta, "verdad.json") : join(OFICIAL, "evaluacion", "verdad_practica.json")));
const jueces = resolve(argumento("jueces", carpeta ? join(carpeta, "jueces.demo.json") : join(RAIZ, "config", "jueces.demo.json")));
const permitirColateral = bandera("permitir-colateral");
const simulacro = bandera("simulacro");
const exportar = bandera("exportar");
const umbralVisibilidad = Number(argumento("visibilidad-max", "100"));
const salida = resolve(argumento("salida", join(RAIZ, "salida", `ensayo-${new Date().toISOString().replace(/[:.]/g, "-")}`)));

const dormir = (ms: number) => new Promise((ok) => setTimeout(ok, ms));

function puertoLibre(): Promise<number> {
  return new Promise((ok, mal) => {
    const s = createServer();
    s.once("error", mal);
    s.listen(0, "127.0.0.1", () => {
      const { port } = s.address() as { port: number };
      s.close(() => ok(port));
    });
  });
}

async function json<T>(url: string, opciones: { token?: string; cuerpo?: unknown; metodo?: string } = {}): Promise<{ estado: number; datos: T }> {
  const r = await fetch(url, {
    method: opciones.metodo ?? (opciones.cuerpo === undefined ? "GET" : "POST"),
    headers: {
      ...(opciones.token ? { Authorization: `Bearer ${opciones.token}` } : {}),
      ...(opciones.cuerpo === undefined ? {} : { "Content-Type": "application/json" }),
    },
    body: opciones.cuerpo === undefined ? undefined : JSON.stringify(opciones.cuerpo),
    signal: AbortSignal.timeout(5000),
  });
  return { estado: r.status, datos: (await r.json()) as T };
}

async function esperar(descripcion: string, listo: () => Promise<boolean>, segundos = 30): Promise<void> {
  const limite = Date.now() + segundos * 1000;
  while (Date.now() < limite) {
    try {
      if (await listo()) return;
    } catch {
      // todavía no levantó
    }
    await dormir(150);
  }
  throw new Error(`No se pudo ${descripcion} en ${segundos} s.`);
}

const hijos: ChildProcess[] = [];
function terminar(): void {
  for (const h of hijos) if (h.exitCode === null) h.kill("SIGINT");
}
process.on("exit", terminar);
process.on("SIGINT", () => {
  terminar();
  process.exit(130);
});

async function principal(): Promise<number> {
  if (!existsSync(join(OFICIAL, "simulador", "servidor.py"))) {
    console.error("Falta el material oficial. Ejecutá: bash scripts/traer-simulador.sh");
    return 2;
  }
  mkdirSync(salida, { recursive: true });
  const registro = join(salida, "registro.jsonl");
  const [puertoSim, puertoApp] = [await puertoLibre(), await puertoLibre()];
  const sim = `http://127.0.0.1:${puertoSim}`;
  const app = `http://127.0.0.1:${puertoApp}`;

  console.log(`Ensayo x${acelerar} · demora del juez ${String(demoraJuez).replace(".", ",")} min de partido${simulacro ? " · con simulacro" : ""} · salida ${salida}`);

  hijos.push(
    spawn(
      "python3",
      ["-I", join(OFICIAL, "simulador", "servidor.py"), "--escenario", escenario, "--datos", datos, "--acelerar", String(acelerar), "--puerto", String(puertoSim), "--log", registro],
      { cwd: salida, stdio: ["ignore", "ignore", "inherit"] },
    ),
  );
  await esperar("levantar el simulador", async () => (await json(`${sim}/estado`)).estado === 200);

  hijos.push(
    spawn(join(RAIZ, "node_modules", ".bin", "tsx"), ["--disable-warning=ExperimentalWarning", join(RAIZ, "src", "server", "index.ts"), ...(simulacro ? ["--simulacro"] : [])], {
      cwd: RAIZ,
      stdio: ["ignore", "ignore", "inherit"],
      env: {
        ...process.env,
        SIMULADOR_URL: sim,
        PUERTO: String(puertoApp),
        OFFSIDE_DB: join(salida, "offside.db"),
        OFFSIDE_JUECES: jueces,
        OFFSIDE_INTERVALO_MS: process.env.OFFSIDE_INTERVALO_MS ?? "150",
      },
    }),
  );
  await esperar("conectar Offside con el simulador", async () => (await json<{ conectado: boolean }>(`${app}/api/estado`)).datos.conectado);

  const config = JSON.parse(readFileSync(jueces, "utf8")) as {
    jueces: { usuario: string; contrasena: string; id: string }[];
    operadores: { usuario: string; contrasena: string }[];
  };
  const ingresar = async (usuario: string, contrasena: string) =>
    (await json<RespuestaIngreso>(`${app}/api/ingreso`, { cuerpo: { usuario, contrasena } })).datos.token;
  const tokens = await Promise.all(config.jueces.map((j) => ingresar(j.usuario, j.contrasena)));
  const tokenFiscal = config.operadores[0] ? await ingresar(config.operadores[0].usuario, config.operadores[0].contrasena) : tokens[0]!;

  let aprobadas = 0;
  let finMin = 105;
  let ultimoMinuto = -1;
  for (;;) {
    const estado = (await json<{ minuto_actual: number; fin_min: number }>(`${sim}/estado`)).datos;
    finMin = estado.fin_min;
    if (Math.floor(estado.minuto_actual / 15) !== Math.floor(ultimoMinuto / 15)) {
      console.log(`  minuto ${estado.minuto_actual.toFixed(1).replace(".", ",")} · ${aprobadas} medidas firmadas`);
    }
    ultimoMinuto = estado.minuto_actual;
    // El verificador evalúa los bloqueos posteriores al partido recién después de los 5 minutos de gracia.
    if (estado.minuto_actual >= finMin + 5.6) break;

    for (const token of tokens) {
      const cola = (await json<ColaDTO>(`${app}/api/juez/cola`, { token })).datos;
      if (!cola.yo?.de_turno) continue;
      for (const medida of cola.pendientes) {
        if (medida.espera_min < demoraJuez) continue;
        const r = await json<{ ok?: boolean; error?: string }>(`${app}/api/juez/medidas/${medida.id}/aprobar`, { token, metodo: "POST" });
        if (r.estado === 200) aprobadas += 1;
        else if (r.estado !== 409 && r.estado !== 403) console.log(`  aprobar ${medida.id} respondió ${r.estado}: ${r.datos.error}`);
      }
    }
    await dormir(120);
  }

  const tablero = (await json<TableroDTO>(`${app}/api/tablero`, { token: tokenFiscal })).datos;
  writeFileSync(join(salida, "tablero-final.json"), JSON.stringify(tablero, null, 2));

  if (exportar) {
    const r = spawnSync(join(RAIZ, "node_modules", ".bin", "tsx"), ["--disable-warning=ExperimentalWarning", join(RAIZ, "scripts", "exportar.ts"), "--carpeta", join(salida, "entrega"), "--db", join(salida, "offside.db")], {
      cwd: RAIZ,
      stdio: "inherit",
      env: { ...process.env, OFFSIDE_JUECES: jueces },
    });
    if (r.status !== 0) console.log("  La exportación falló.");
  }

  terminar();
  await dormir(600);

  const v = spawnSync(
    "python3",
    ["-I", join(OFICIAL, "evaluacion", "verificar.py"), "--log", registro, "--escenario", escenario, "--verdad", verdad, "--datos", datos, "--json"],
    { encoding: "utf8" },
  );
  if (v.status !== 0) {
    console.error("El verificador oficial falló:\n" + v.stderr);
    return 2;
  }
  writeFileSync(join(salida, "verificacion.json"), v.stdout);
  const r = JSON.parse(v.stdout);
  const res = r.resumen as Record<string, any>;

  console.log("\nVerificador oficial");
  for (const [clave, valor] of Object.entries(res)) console.log(`  ${clave.replaceAll("_", " ")}: ${valor ?? "no evaluable"}`);
  console.log("\nFases piratas");
  for (const f of r.fases) {
    console.log(
      `  ${f.stream} fase ${f.fase} (${f.host}, recomendado ${f.bloqueo_recomendado}): primer bloqueo ${f.primer_bloqueo_min ?? "nunca"} min · cobertura ${f.clientes_cubiertos_pct} % · visibilidad residual ${f.visibilidad_residual_pct} %`,
    );
  }
  console.log(`\nOffside: ${tablero.metricas.expedientes} expedientes, ${aprobadas} medidas firmadas, ${tablero.auditoria.entradas} entradas de auditoría`);
  console.log(`Daño evitado: ${tablero.metricas.dano_evitado.sitios.length} sitios legítimos, ${tablero.metricas.dano_evitado.senales_legitimas.length} señales legítimas`);

  const [bloqueadas, total] = String(res.fases_piratas_bloqueadas).split(" de ").map(Number);
  const fallas: string[] = [];
  if (bloqueadas !== total) fallas.push(`fases piratas bloqueadas: ${res.fases_piratas_bloqueadas}`);
  if (!permitirColateral && res.bloqueos_con_dano_colateral !== 0) fallas.push(`bloqueos con daño colateral: ${res.bloqueos_con_dano_colateral}`);
  if (res.bloqueos_falsos_positivos !== 0) fallas.push(`falsos positivos: ${res.bloqueos_falsos_positivos}`);
  if (res.bloqueos_ip_activos_post_partido !== 0) fallas.push(`bloqueos por IP activos después del partido: ${res.bloqueos_ip_activos_post_partido ?? "no evaluable"}`);
  if (res.ordenes_firmadas_fuera_de_turno !== 0) fallas.push(`órdenes fuera de turno: ${res.ordenes_firmadas_fuera_de_turno}`);
  if (res.ordenes_rechazadas !== 0) fallas.push(`órdenes rechazadas: ${res.ordenes_rechazadas}`);
  if (res.reclamos !== res.reclamos_resueltos_por_levantamiento) fallas.push(`reclamos sin levantar: ${res.reclamos - res.reclamos_resueltos_por_levantamiento}`);
  if (res.visibilidad_residual_promedio_pct > umbralVisibilidad) fallas.push(`visibilidad residual promedio ${res.visibilidad_residual_promedio_pct} % (máximo ${umbralVisibilidad} %)`);
  if (tablero.estado.alertas.length) console.log(`Alertas de Offside: ${tablero.estado.alertas.join(" | ")}`);

  if (fallas.length) {
    console.log(`\nENSAYO FALLIDO\n  - ${fallas.join("\n  - ")}`);
    return 1;
  }
  console.log("\nENSAYO APROBADO");
  return 0;
}

principal()
  .then((codigo) => {
    terminar();
    process.exit(codigo);
  })
  .catch((e) => {
    console.error(e);
    terminar();
    process.exit(2);
  });
