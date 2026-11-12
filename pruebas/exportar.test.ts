import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash, createHmac } from "node:crypto";
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
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
  // Evidencia que no cita ninguna instantánea: el mismo servidor, más tarde.
  await publicarYProcesar(a, deteccion({ id: "D-5", minuto: 10 }));
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

const sha = (texto: string) => createHash("sha256").update(texto).digest("hex");
const leer = (carpeta: string, nombre: string) => readFileSync(join(carpeta, nombre), "utf8");
const leerJson = (carpeta: string, nombre: string) => JSON.parse(leer(carpeta, nombre));
const escribirJson = (carpeta: string, nombre: string, datos: unknown) =>
  writeFileSync(join(carpeta, nombre), JSON.stringify(datos, null, 2) + "\n");

interface LineaAuditoria {
  seq: number;
  hash_anterior: string;
  hash: string;
  contenido: string;
}

/** Vuelve a numerar y encadenar la auditoría, como haría quien borra entradas a mano. */
function reencadenar(lineas: LineaAuditoria[]): LineaAuditoria[] {
  let anterior = "0".repeat(64);
  return lineas.map((l, i) => {
    const seq = i + 1;
    const hash = sha(`${anterior}\n${seq}\n${l.contenido}`);
    const nueva = { seq, hash_anterior: anterior, hash, contenido: l.contenido };
    anterior = hash;
    return nueva;
  });
}

/**
 * Alteración coherente del final de la carpeta: recalcula los hashes de los
 * archivos en el manifiesto y en el cierre de la exportación (la última entrada
 * de la auditoría), y vuelve a encadenar. Lo que quede por detectar lo tienen
 * que encontrar los cruces con la auditoría.
 */
function sellar(carpeta: string, cambiarAuditoria: (lineas: LineaAuditoria[]) => LineaAuditoria[] = (l) => l): void {
  const manifiesto = leerJson(carpeta, "manifiesto.json");
  let lineas = cambiarAuditoria(
    leer(carpeta, "auditoria.jsonl")
      .trimEnd()
      .split("\n")
      .map((l) => JSON.parse(l) as LineaAuditoria),
  );
  const archivos = (manifiesto.archivos as { nombre: string }[])
    .filter((a) => a.nombre !== "auditoria.jsonl" && readdirSync(carpeta).includes(a.nombre))
    .map((a) => ({ nombre: a.nombre, sha256: sha(leer(carpeta, a.nombre)) }));
  const cierre = JSON.parse(lineas.at(-1)!.contenido);
  cierre.datos.archivos = archivos;
  lineas.at(-1)!.contenido = JSON.stringify(cierre);
  lineas = reencadenar(lineas);
  const jsonl = lineas.map((l) => JSON.stringify(l)).join("\n") + "\n";
  writeFileSync(join(carpeta, "auditoria.jsonl"), jsonl);
  manifiesto.archivos = [...archivos, { nombre: "auditoria.jsonl", sha256: sha(jsonl) }];
  manifiesto.auditoria = { entradas: lineas.length, cabecera: lineas.at(-1)!.hash };
  escribirJson(carpeta, "manifiesto.json", manifiesto);
}

/** Recalcula solo el hash de un archivo en el manifiesto. */
function rehacerManifiesto(carpeta: string, nombre: string): void {
  const manifiesto = leerJson(carpeta, "manifiesto.json");
  for (const a of manifiesto.archivos) if (a.nombre === nombre) a.sha256 = sha(leer(carpeta, nombre));
  escribirJson(carpeta, "manifiesto.json", manifiesto);
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
  assert.equal(exp.detecciones.length, 3);
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

test("una ratificación que suma proveedores después de presentarse sigue verificando", async () => {
  const a = armar();
  a.sim.fallasPendientes.set("inestable", 1);
  a.sim.fallasPendientes.set("grande", 1);
  await publicarYProcesar(a, deteccion({ id: "D-1", minuto: 49 }));
  await aprobarMedida(a.ctx, "M-0001", "jueza-a");
  a.sim.avanzar(50.2);
  await a.motor.tick(); // las dos fallas llegan después del cambio de turno: una ratificación con dos proveedores
  const ratificacion = filas<{ id: string; plan: string }>(a.db, "SELECT id, plan FROM medidas WHERE clase = 'ratificacion'");
  assert.equal(ratificacion.length, 1);
  assert.equal(JSON.parse(ratificacion[0]!.plan).length, 2);
  await aprobarMedida(a.ctx, ratificacion[0]!.id, "juez-b");
  a.sim.avanzar(106);
  await a.motor.tick();
  const carpeta = mkdtempSync(join(tmpdir(), "offside-export-"));
  exportar(a.ctx, carpeta);
  const juzgados = join(carpeta, "..", `jueces-${Date.now()}-${Math.random().toString(16).slice(2)}.json`);
  writeFileSync(juzgados, JSON.stringify({ jueces: JUECES }));
  const r = verificar(carpeta, juzgados);
  assert.equal(r.estado, 0, r.salida);
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
    lineas[4] = lineas[4]!.replace(/(\\"actor\\":\\")[^\\]+/, "$1otro-actor");
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
  const bien = verificar(carpeta, juzgados, ["--registro", registro]);
  assert.equal(bien.estado, 0, bien.salida);
  assert.match(bien.salida, /anclada hasta la secuencia \d+ de \d+/);

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

// --- alteraciones coherentes: cada una tiene que fallar ------------------------------------

test("cada instantánea guarda la cabecera de la auditoría y el verificador lo dice", async () => {
  const { carpeta, juzgados } = await partidoExportado();
  const exp = leerJson(carpeta, "expediente-EXP-2026-000001.json");
  const ancla = JSON.parse(exp.medidas[0].instantanea).auditoria;
  assert.equal(typeof ancla.seq, "number");
  assert.match(ancla.cabecera, /^[0-9a-f]{64}$/);
  const r = verificar(carpeta, juzgados);
  assert.equal(r.estado, 0, r.salida);
  assert.match(r.salida, /Sin --registro/);
});

test("editar un .md y recalcular su hash en el manifiesto se detecta", async () => {
  const { carpeta, juzgados } = await partidoExportado();
  alterar(join(carpeta, "expediente-EXP-2026-000001.md"), (t) => t.replace("Dra. A", "Dr. Z"));
  rehacerManifiesto(carpeta, "expediente-EXP-2026-000001.md");
  const r = verificar(carpeta, juzgados);
  assert.equal(r.estado, 1, r.salida);
  assert.match(r.salida, /expediente-EXP-2026-000001\.md/);
  assert.match(r.salida, /cierre de la exportación/);
});

test("sacar un .md del manifiesto se detecta, esté o no el archivo", async () => {
  for (const borrar of [false, true]) {
    const { carpeta, juzgados } = await partidoExportado();
    const manifiesto = leerJson(carpeta, "manifiesto.json");
    manifiesto.archivos = manifiesto.archivos.filter((a: { nombre: string }) => a.nombre !== "expediente-EXP-2026-000002.md");
    escribirJson(carpeta, "manifiesto.json", manifiesto);
    if (borrar) rmSync(join(carpeta, "expediente-EXP-2026-000002.md"));
    const r = verificar(carpeta, juzgados);
    assert.equal(r.estado, 1, r.salida);
    assert.match(r.salida, /expediente-EXP-2026-000002\.md/);
  }
});

test("reescribir con hashes nuevos una detección que ninguna instantánea cita se detecta", async () => {
  const { carpeta, juzgados } = await partidoExportado();
  const exp = leerJson(carpeta, "expediente-EXP-2026-000001.json");
  const d = exp.detecciones.find((x: { id: string }) => x.id === "D-5");
  const crudo = JSON.parse(d.crudo);
  crudo.pagina = "https://otra-pagina.test/vivo";
  d.crudo = JSON.stringify(crudo);
  d.sha256 = sha(d.crudo);
  escribirJson(carpeta, "expediente-EXP-2026-000001.json", exp);
  sellar(carpeta);
  const r = verificar(carpeta, juzgados);
  assert.equal(r.estado, 1, r.salida);
  assert.match(r.salida, /D-5.*auditoría/);
});

test("borrar una detección archivada se detecta", async () => {
  const { carpeta, juzgados } = await partidoExportado();
  const archivadas = leerJson(carpeta, "detecciones-archivadas.json");
  archivadas.detecciones = archivadas.detecciones.filter((x: { id: string }) => x.id !== "D-3");
  escribirJson(carpeta, "detecciones-archivadas.json", archivadas);
  sellar(carpeta);
  const r = verificar(carpeta, juzgados);
  assert.equal(r.estado, 1, r.salida);
  assert.match(r.salida, /D-3/);
});

test("pasar una orden de fallida a aplicada se detecta", async () => {
  const { carpeta, juzgados } = await partidoExportado();
  const exp = leerJson(carpeta, "expediente-EXP-2026-000001.json");
  const fallida = exp.medidas[0].ordenes.find((o: { estado: string }) => o.estado === "fallida");
  assert.ok(fallida, "el partido de prueba tiene que tener una orden fallida");
  fallida.estado = "aplicada";
  fallida.aplicada_min = 2.5;
  escribirJson(carpeta, "expediente-EXP-2026-000001.json", exp);
  sellar(carpeta);
  const r = verificar(carpeta, juzgados);
  assert.equal(r.estado, 1, r.salida);
  assert.match(r.salida, new RegExp(`${fallida.orden_id}.*estado`));
});

test("cambiar el minuto de una decisión se detecta", async () => {
  const { carpeta, juzgados } = await partidoExportado();
  const exp = leerJson(carpeta, "expediente-EXP-2026-000002.json");
  exp.medidas[0].decision.decidida_min = 6.5;
  escribirJson(carpeta, "expediente-EXP-2026-000002.json", exp);
  sellar(carpeta);
  const r = verificar(carpeta, juzgados);
  assert.equal(r.estado, 1, r.salida);
  assert.match(r.salida, /minuto de la decisión de la medida M-0002/);
});

test("cambiar la marca de un expediente se detecta", async () => {
  const { carpeta, juzgados } = await partidoExportado();
  const exp = leerJson(carpeta, "expediente-EXP-2026-000002.json");
  exp.expediente.marca = "TX26-OFI-S000999";
  escribirJson(carpeta, "expediente-EXP-2026-000002.json", exp);
  sellar(carpeta);
  const r = verificar(carpeta, juzgados);
  assert.equal(r.estado, 1, r.salida);
  assert.match(r.salida, /EXP-2026-000002.*marca/);
});

test("borrar entradas de la auditoría y volver a encadenarla rompe el ancla de las medidas", async () => {
  const { carpeta, juzgados } = await partidoExportado();
  // La entrada del reenvío tras la falla no la exige ningún cruce: solo la protege el ancla.
  sellar(carpeta, (lineas) => lineas.filter((l) => JSON.parse(l.contenido).tipo !== "reintento"));
  const r = verificar(carpeta, juzgados);
  assert.equal(r.estado, 1, r.salida);
  assert.match(r.salida, /ancla/i);
});

test("una reescritura completa y coherente pasa sin --registro pero el registro del simulador la delata", async () => {
  const { a, carpeta, juzgados } = await partidoExportado();
  // Quien reescribe tiene las claves de demostración (son públicas) y rehace todo:
  // borra una entrada, vuelve a encadenar, rehace anclas, huellas, órdenes y firmas.
  const claves = new Map(JUECES.map((j) => [j.id, j.clave_firma_demo]));
  let lineas = leer(carpeta, "auditoria.jsonl").trimEnd().split("\n").map((l) => JSON.parse(l) as LineaAuditoria);
  lineas = lineas.filter((l) => JSON.parse(l.contenido).tipo !== "reintento");
  const nombres = readdirSync(carpeta).filter((n) => n.startsWith("expediente-") && n.endsWith(".json"));
  const expedientes = new Map(nombres.map((n) => [n, leerJson(carpeta, n)]));
  const medidas = [...expedientes.values()].flatMap((e) => e.medidas).sort((x, y) => JSON.parse(x.instantanea).auditoria.seq - JSON.parse(y.instantanea).auditoria.seq);
  const reemplazar = (viejo: string, nuevo: string) => {
    lineas = lineas.map((l) => ({ ...l, contenido: l.contenido.replaceAll(viejo, nuevo) }));
    for (const [n, e] of expedientes) expedientes.set(n, JSON.parse(JSON.stringify(e).replaceAll(viejo, nuevo)));
  };
  for (const original of medidas) {
    lineas = reencadenar(lineas);
    const m = [...expedientes.values()].flatMap((e) => e.medidas).find((x) => x.id === original.id);
    const vista = JSON.parse(m.instantanea);
    // El ancla es la cabecera justo antes de la presentación de la medida.
    const seq = lineas.findIndex((l) => l.contenido.includes(`"medida_id":"${m.id}"`));
    vista.auditoria = { seq, cabecera: seq === 0 ? "0".repeat(64) : lineas[seq - 1]!.hash };
    const nueva = JSON.stringify(vista);
    reemplazar(m.huella, sha(nueva));
    reemplazar(m.huella.slice(0, 16), sha(nueva).slice(0, 16));
    reemplazar(JSON.stringify(m.instantanea).slice(1, -1), JSON.stringify(nueva).slice(1, -1));
  }
  for (const [n, e] of expedientes) {
    for (const m of e.medidas) {
      for (const o of m.ordenes) {
        o.firma = createHmac("sha256", claves.get(o.juez_id)!).update(`${o.orden_id}|${o.tipo}|${o.objetivo}|${o.vence_min}|${o.juez_id}`).digest("hex");
      }
    }
    escribirJson(carpeta, n, e);
  }
  sellar(carpeta, () => lineas);
  const sinRegistro = verificar(carpeta, juzgados);
  assert.equal(sinRegistro.estado, 0, sinRegistro.salida);

  const registro = join(carpeta, "..", `registro-${Date.now()}-${Math.random().toString(16).slice(2)}.jsonl`);
  writeFileSync(
    registro,
    a.sim
      .recibidas()
      .map((o) => JSON.stringify({ min: o.recibida_min, evento: "orden_recibida", proveedor: o.proveedor, juez_de_turno: o.juez_de_turno, orden_id: o.orden_id, tipo: o.tipo, objetivo: o.objetivo, vence_min: o.vence_min, juez_id: o.juez_id }))
      .join("\n") + "\n",
  );
  const conRegistro = verificar(carpeta, juzgados, ["--registro", registro]);
  assert.equal(conRegistro.estado, 1, conRegistro.salida);
  assert.match(conRegistro.salida, /no figura en ningún expediente/);
});
