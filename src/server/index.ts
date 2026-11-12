// Arranque de Offside: un proceso con el motor, la API y la interfaz web.
//
//   pnpm start                 usa la base existente (retoma un partido en curso)
//   pnpm start -- --nuevo      archiva la base anterior y empieza un partido nuevo
//   pnpm start -- --simulacro  fuerza un bloqueo equivocado para mostrar los reclamos (solo demo)

import { existsSync } from "node:fs";
import { networkInterfaces } from "node:os";
import { serve } from "@hono/node-server";
import { crearApi } from "./api.ts";
import { Auditoria } from "./auditoria.ts";
import { cargarConfig, cargarJueces } from "./config.ts";
import { crearContexto, restaurarEstado } from "./contexto.ts";
import { abrirDb, leerKv } from "./db.ts";
import { Motor } from "./motor.ts";
import { instalarReclamos } from "./reclamos.ts";
import { archivarBase as archivar } from "./reinicio.ts";
import { Sesiones } from "./sesiones.ts";
import { SimuladorHttp } from "./simulador.ts";

const config = cargarConfig();
const { jueces, operadores } = cargarJueces(config.juecesRuta);

const nuevo = process.argv.includes("--nuevo") || process.env.OFFSIDE_NUEVO === "1";
function archivarBase(motivo: string): void {
  const destino = archivar(config.dbRuta, "anterior");
  if (destino) console.log(`${motivo} Base anterior archivada como ${destino}`);
}

const sim = new SimuladorHttp(config.simuladorUrl);
const habiaBase = config.dbRuta !== ":memory:" && existsSync(config.dbRuta);
// Con --nuevo siempre se empieza limpio.
if (nuevo && habiaBase) archivarBase("Partido nuevo.");
let db = abrirDb(config.dbRuta);

// Si la base es de otro partido (otro id, o el reloj del simulador está por detrás
// de lo último que vimos), se archiva sola y se empieza limpio. Evita arrancar el
// partido final sobre los restos de un ensayo.
if (!nuevo && habiaBase) {
  const ultimoMinuto = Number(leerKv(db, "ultimo_minuto") ?? "-1000000000");
  const partidoGuardado = leerKv(db, "partido");
  try {
    const estado = await sim.estado();
    const otroPartido = partidoGuardado !== null && (JSON.parse(partidoGuardado) as { id?: string }).id !== estado.partido;
    if (otroPartido || ultimoMinuto - estado.minuto_actual > 1) {
      db.close();
      archivarBase("La base guardada es de otro partido.");
      db = abrirDb(config.dbRuta);
    }
  } catch {
    // El simulador todavía no responde: se sigue con la base que hay y el motor avisa si no corresponde.
  }
}

const ctx = crearContexto({
  db,
  sim,
  auditoria: new Auditoria(db),
  jueces,
  config,
});
restaurarEstado(ctx);
// Las sesiones siguen a ctx.db: si el simulador se reinicia, la base nueva no tiene sesiones.
const sesiones = new Sesiones(ctx, jueces, operadores);
const { app } = crearApi(ctx, sesiones, { raizWeb: "dist" });
const motor = new Motor(ctx);
instalarReclamos(motor);

ctx.auditoria.registrar({
  minuto: null,
  actor: "sistema",
  tipo: "arranque",
  datos: { simulador: config.simuladorUrl, simulacro: config.simulacro, base_nueva: nuevo },
});

const servidor = serve({ fetch: app.fetch, port: config.puerto, hostname: config.host }, () => {
  console.log(`Offside en http://localhost:${config.puerto} (escucha en ${config.host})`);
  if (config.host === "0.0.0.0" || config.host === "::") {
    for (const lista of Object.values(networkInterfaces())) {
      for (const red of lista ?? []) {
        if (red.family === "IPv4" && !red.internal) console.log(`  En la red local: http://${red.address}:${config.puerto}`);
      }
    }
  }
  if (config.juecesRuta.endsWith("jueces.demo.json")) {
    console.log("  Usuarios de demostración (contraseñas públicas). Para el partido final: pnpm jueces-locales.");
  }
  console.log(`Simulador: ${config.simuladorUrl}`);
  if (config.simulacro) console.log("SIMULACRO ACTIVO: se va a forzar un bloqueo equivocado para mostrar los reclamos.");
});

motor.iniciar(config.intervaloMs);

let ultimoAviso = "";
setInterval(() => {
  const aviso = ctx.estado.conectado ? "conectado" : `sin conexión con el simulador (${ctx.estado.ultimo_error ?? "sin detalle"})`;
  if (aviso !== ultimoAviso) console.log(`[motor] ${aviso}`);
  ultimoAviso = aviso;
}, 2000).unref();

function apagar(): void {
  motor.detener();
  servidor.close();
  ctx.db.close();
  process.exit(0);
}
process.on("SIGINT", apagar);
process.on("SIGTERM", apagar);
