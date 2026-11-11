// Exporta los expedientes y la auditoría de la base a una carpeta.
//
//   pnpm exportar -- --carpeta entrega/final
//   pnpm exportar -- --carpeta entrega/practica --db salida/ensayo-x6/offside.db --nota "Partido de práctica"
//
// No necesita el simulador: usa lo que quedó guardado en la base. Se puede correr
// con Offside en marcha.

import { Auditoria } from "../src/server/auditoria.ts";
import { cargarConfig, cargarJueces } from "../src/server/config.ts";
import { crearContexto, restaurarEstado } from "../src/server/contexto.ts";
import { abrirDb, leerKv } from "../src/server/db.ts";
import { exportar } from "../src/server/exportar.ts";
import { SimuladorHttp } from "../src/server/simulador.ts";

function argumento(nombre: string): string | undefined {
  const i = process.argv.indexOf(`--${nombre}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

const config = cargarConfig();
const carpeta = argumento("carpeta") ?? "entrega/final";
const dbRuta = argumento("db") ?? config.dbRuta;
const { jueces } = cargarJueces(config.juecesRuta);

const db = abrirDb(dbRuta);
const ctx = crearContexto({ db, sim: new SimuladorHttp(config.simuladorUrl), auditoria: new Auditoria(db), jueces, config });
restaurarEstado(ctx);
// El último minuto conocido queda en el cursor de detecciones.
ctx.estado.minuto = Number(leerKv(db, "cursor_detecciones") ?? "0");

const { archivos } = exportar(ctx, carpeta, { nota: argumento("nota") });
db.close();
console.log(`Exportación en ${carpeta}:`);
for (const a of archivos) console.log(`  ${a}`);
console.log(`\nPara verificarla:\n  python3 herramientas/verificar_expediente.py ${carpeta} --juzgados ${config.juecesRuta}`);
