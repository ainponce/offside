import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { test } from "node:test";
import { Auditoria } from "../src/server/auditoria.ts";
import { crearContexto, restaurarEstado } from "../src/server/contexto.ts";
import { aprobarMedida } from "../src/server/decisiones.ts";
import { exportar } from "../src/server/exportar.ts";
import { JUECES, armar, deteccion, filas, publicarYProcesar } from "./ayuda.ts";
import { SimuladorFalso } from "./simulador-falso.ts";

const VERIFICADOR = resolve(import.meta.dirname, "..", "herramientas", "verificar_expediente.py");

/** Un partido corto: una filtración con salto de servidor, una CDN compartida y un licenciatario. */
async function partidoExportado() {
  const a = armar();
  a.sim.fallasPendientes.set("inestable", 1);
  await publicarYProcesar(a, deteccion({ id: "D-1", minuto: 2 }));
  await aprobarMedida(a.ctx, "M-0001", "jueza-a");
  await publicarYProcesar(
    a,
    deteccion({ id: "D-2", minuto: 6, host_stream: "vivo.gol.test", ip_servidor: "198.51.100.20", asn: 64610, marca_de_agua_extraida: "TX26-OFI-S000222" }),
  );
  await aprobarMedida(a.ctx, "M-0002", "jueza-a");
  await publicarYProcesar(
    a,
    deteccion({ id: "D-3", minuto: 9, host_stream: "canalsur.test", ip_servidor: "192.0.2.10", asn: 64640, marca_de_agua_extraida: "TX26-LIC-SUR" }),
  );
  await publicarYProcesar(a, deteccion({ id: "D-4", minuto: 37, host_stream: "s2.pelota.test", ip_servidor: "203.0.113.6" }));
  await aprobarMedida(a.ctx, "M-0003", "jueza-a");
  a.sim.avanzar(40);
  await a.motor.tick();
  a.sim.avanzar(106);
  await a.motor.tick();

  const carpeta = mkdtempSync(join(tmpdir(), "offside-export-"));
  const resultado = exportar(a.ctx, carpeta);
  const juzgados = join(carpeta, "..", `jueces-${Date.now()}-${Math.random().toString(16).slice(2)}.json`);
  writeFileSync(juzgados, JSON.stringify({ jueces: JUECES }));
  return { a, carpeta, resultado, juzgados };
}

function verificar(carpeta: string, juzgados: string, extra: string[] = []) {
  const r = spawnSync("python3", ["-I", VERIFICADOR, carpeta, "--juzgados", juzgados, ...extra], { encoding: "utf8" });
  return { estado: r.status, salida: r.stdout + r.stderr };
}

function alterar(ruta: string, cambio: (texto: string) => string): void {
  const original = readFileSync(ruta, "utf8");
  const nuevo = cambio(original);
  assert.notEqual(nuevo, original, "la alteración no cambió nada");
  writeFileSync(ruta, nuevo);
}

test("la exportación escribe un expediente por filtración, la auditoría y el manifiesto", async () => {
  const { carpeta, resultado } = await partidoExportado();
  const archivos = readdirSync(carpeta).sort();
  assert.deepEqual(archivos, [
    "auditoria.jsonl",
    "detecciones-archivadas.json",
    "expediente-EXP-2026-000001.json",
    "expediente-EXP-2026-000001.md",
    "expediente-EXP-2026-000002.json",
    "expediente-EXP-2026-000002.md",
    "manifiesto.json",
  ]);
  assert.equal(resultado.archivos.length, 7);

  const exp = JSON.parse(readFileSync(join(carpeta, "expediente-EXP-2026-000001.json"), "utf8"));
  assert.equal(exp.expediente.marca, "TX26-OFI-S000111");
  assert.equal(exp.detecciones.length, 2);
  assert.equal(exp.medidas.length, 2);
  assert.equal(exp.medidas[1].clase, "ampliacion");
  assert.equal(typeof exp.medidas[0].instantanea, "string");
  assert.ok(exp.medidas[0].ordenes.length >= 3);
  assert.match(exp.aviso_titular, /TX26-OFI-S000111/);

  const legible = readFileSync(join(carpeta, "expediente-EXP-2026-000001.md"), "utf8");
  assert.match(legible, /EXP-2026-000001/);
  assert.match(legible, /Dra\. A/);
  assert.match(legible, /s2\.pelota\.test/);

  const archivadas = JSON.parse(readFileSync(join(carpeta, "detecciones-archivadas.json"), "utf8"));
  assert.equal(archivadas.detecciones[0].veredicto, "licenciatario_autorizado");
});

test("la exportación no incluye claves de firma ni contraseñas", async () => {
  const { carpeta } = await partidoExportado();
  for (const archivo of readdirSync(carpeta)) {
    const texto = readFileSync(join(carpeta, archivo), "utf8");
    for (const secreto of ["clave-a", "clave-b", "clave-de-a", "clave-de-b"]) {
      assert.equal(texto.includes(secreto), false, `${archivo} expone ${secreto}`);
    }
  }
});

test("el verificador independiente aprueba una exportación intacta", async () => {
  const { carpeta, juzgados } = await partidoExportado();
  const r = verificar(carpeta, juzgados);
  assert.equal(r.estado, 0, r.salida);
  assert.match(r.salida, /VERIFICACIÓN CORRECTA/);
});

test("cambiar un carácter de una captura se detecta y nombra el expediente", async () => {
  const { carpeta, juzgados } = await partidoExportado();
  alterar(join(carpeta, "expediente-EXP-2026-000001.json"), (t) => t.replace("RxAgMEA=", "RxAhMEA="));
  const r = verificar(carpeta, juzgados);
  assert.equal(r.estado, 1, r.salida);
  assert.match(r.salida, /EXP-2026-000001/);
  assert.match(r.salida, /captura/i);
});

test("cambiar el objetivo de una orden rompe la firma del juez", async () => {
  const { carpeta, juzgados } = await partidoExportado();
  alterar(join(carpeta, "expediente-EXP-2026-000002.json"), (t) => t.replace('"objetivo": "vivo.gol.test"', '"objetivo": "panaderia.test"'));
  const r = verificar(carpeta, juzgados);
  assert.equal(r.estado, 1, r.salida);
  assert.match(r.salida, /firma/i);
});

test("cambiar lo que vio el juez rompe la huella que viaja en las órdenes", async () => {
  const { carpeta, juzgados } = await partidoExportado();
  alterar(join(carpeta, "expediente-EXP-2026-000002.json"), (t) => t.replace(/\\"panaderia\.test\\"/, '\\"panaderia-otra.test\\"'));
  const r = verificar(carpeta, juzgados);
  assert.equal(r.estado, 1, r.salida);
  assert.match(r.salida, /huella/i);
});

test("alterar una entrada de la auditoría se detecta y nombra la secuencia", async () => {
  const { carpeta, juzgados } = await partidoExportado();
  alterar(join(carpeta, "auditoria.jsonl"), (t) => {
    const lineas = t.trimEnd().split("\n");
    lineas[4] = lineas[4]!.replace("sistema", "otro-actor");
    return lineas.join("\n") + "\n";
  });
  const r = verificar(carpeta, juzgados);
  assert.equal(r.estado, 1, r.salida);
  assert.match(r.salida, /secuencia 5/);
});

test("borrar una entrada de la auditoría se detecta", async () => {
  const { carpeta, juzgados } = await partidoExportado();
  alterar(join(carpeta, "auditoria.jsonl"), (t) => {
    const lineas = t.trimEnd().split("\n");
    lineas.splice(7, 1);
    return lineas.join("\n") + "\n";
  });
  assert.equal(verificar(carpeta, juzgados).estado, 1);
});

test("el verificador cruza las órdenes con el registro del simulador", async () => {
  const { a, carpeta, juzgados } = await partidoExportado();
  const registro = join(carpeta, "..", `registro-${Date.now()}-${Math.random().toString(16).slice(2)}.jsonl`);
  const lineas = a.sim.recibidas().map((o) =>
    JSON.stringify({
      min: o.recibida_min,
      evento: "orden_recibida",
      proveedor: o.proveedor,
      juez_de_turno: o.juez_de_turno,
      orden_id: o.orden_id,
      expediente_id: o.expediente_id,
      tipo: o.tipo,
      objetivo: o.objetivo,
      vence_min: o.vence_min,
      juzgado_id: o.juzgado_id,
      juez_id: o.juez_id,
    }),
  );
  writeFileSync(registro, lineas.join("\n") + "\n");
  assert.equal(verificar(carpeta, juzgados, ["--registro", registro]).estado, 0);

  // Una orden que el proveedor recibió y que no figura en ningún expediente.
  writeFileSync(
    registro,
    lineas.join("\n") +
      "\n" +
      JSON.stringify({ min: 50, evento: "orden_recibida", proveedor: "grande", juez_de_turno: true, orden_id: "OFS-000009-0009-grande-1-0000000000000000", expediente_id: "EXP-2026-000009", tipo: "ip", objetivo: "192.0.2.99", vence_min: 105, juzgado_id: "jg-1", juez_id: "jueza-a" }) +
      "\n",
  );
  const r = verificar(carpeta, juzgados, ["--registro", registro]);
  assert.equal(r.estado, 1, r.salida);
  assert.match(r.salida, /OFS-000009-0009-grande-1/);
});

test("el partido y los proveedores quedan guardados para exportar sin simulador", async () => {
  const a = armar();
  await publicarYProcesar(a, deteccion({ id: "D-1", minuto: 2 }));
  const sinSimulador = new SimuladorFalso();
  sinSimulador.caido = true;
  const ctx = crearContexto({ db: a.db, sim: sinSimulador, auditoria: new Auditoria(a.db), jueces: JUECES });
  restaurarEstado(ctx);
  assert.equal(ctx.estado.partido?.nombre, "Partido de prueba");
  assert.equal(ctx.estado.proveedores.length, 3);
  assert.equal(filas(a.db, "SELECT * FROM kv WHERE clave IN ('partido', 'proveedores')").length, 2);
});
