// Arranque de Offside: un proceso con el motor, la API y la interfaz web.
//
//   pnpm start                 usa la base existente (retoma un partido en curso)
//   pnpm start -- --nuevo      archiva la base anterior y empieza un partido nuevo

import { existsSync, renameSync } from "node:fs";
import { networkInterfaces } from "node:os";
import { serve } from "@hono/node-server";
import { crearApi } from "./api.ts";
import { Auditoria } from "./auditoria.ts";
import { cargarConfig, cargarJueces } from "./config.ts";
import { crearContexto } from "./contexto.ts";
import { abrirDb } from "./db.ts";
import { Motor } from "./motor.ts";
import { Sesiones } from "./sesiones.ts";
import { SimuladorHttp } from "./simulador.ts";

const config = cargarConfig();
const { jueces, operadores } = cargarJueces(config.juecesRuta);

const nuevo = process.argv.includes("--nuevo") || process.env.OFFSIDE_NUEVO === "1";
if (nuevo && config.dbRuta !== ":memory:" && existsSync(config.dbRuta)) {
  const sello = new Date().toISOString().replace(/[:.]/g, "-");
  for (const sufijo of ["", "-wal", "-shm"]) {
    if (existsSync(config.dbRuta + sufijo)) renameSync(config.dbRuta + sufijo, `${config.dbRuta}.${sello}${sufijo}`);
  }
  console.log(`Base anterior archivada como ${config.dbRuta}.${sello}`);
}

const db = abrirDb(config.dbRuta);
const ctx = crearContexto({
  db,
  sim: new SimuladorHttp(config.simuladorUrl),
  auditoria: new Auditoria(db),
  jueces,
  config,
});
const sesiones = new Sesiones(db, jueces, operadores);
const { app } = crearApi(ctx, sesiones, { raizWeb: "dist" });
const motor = new Motor(ctx);

ctx.auditoria.registrar({
  minuto: null,
  actor: "sistema",
  tipo: "arranque",
  datos: { simulador: config.simuladorUrl, simulacro: config.simulacro, base_nueva: nuevo },
});

const servidor = serve({ fetch: app.fetch, port: config.puerto, hostname: "0.0.0.0" }, () => {
  console.log(`Offside en http://localhost:${config.puerto}`);
  for (const lista of Object.values(networkInterfaces())) {
    for (const red of lista ?? []) {
      if (red.family === "IPv4" && !red.internal) console.log(`  En la red local: http://${red.address}:${config.puerto}`);
    }
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
  db.close();
  process.exit(0);
}
process.on("SIGINT", apagar);
process.on("SIGTERM", apagar);
