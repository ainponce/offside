import assert from "node:assert/strict";
import { createHash, createHmac } from "node:crypto";
import { test } from "node:test";
import { Auditoria } from "../src/server/auditoria.ts";
import { abrirDb } from "../src/server/db.ts";
import {
  analizarCaptura,
  firmarLevantamiento,
  firmarOrden,
  huella,
  ordenId,
  sha256Hex,
} from "../src/server/evidencia.ts";

// --- evidencia -------------------------------------------------------------------

test("sha256Hex coincide con node:crypto para texto y para bytes", () => {
  const esperado = createHash("sha256").update("hola").digest("hex");
  assert.equal(sha256Hex("hola"), esperado);
  assert.equal(sha256Hex(new TextEncoder().encode("hola")), esperado);
});

test("firmarOrden firma orden_id|tipo|objetivo|vence_min|juez_id", () => {
  const esperado = createHmac("sha256", "demo-clave").update("o1|ip|203.0.113.10|105|j1").digest("hex");
  assert.equal(
    firmarOrden("demo-clave", { orden_id: "o1", tipo: "ip", objetivo: "203.0.113.10", vence_min: 105, juez_id: "j1" }),
    esperado,
  );
});

test("firmarLevantamiento firma LEVANTAR|orden_id|juez_id", () => {
  const esperado = createHmac("sha256", "demo-clave").update("LEVANTAR|o1|j1").digest("hex");
  assert.equal(firmarLevantamiento("demo-clave", "o1", "j1"), esperado);
});

test("ordenId lleva expediente, medida, proveedor, intento y 16 caracteres de la huella", () => {
  assert.equal(ordenId(1, 2, "aurora", 1, "ab".repeat(32)), "OFS-000001-0002-aurora-1-abababababababab");
});

test("huella es el SHA-256 del texto de la instantánea", () => {
  assert.equal(huella('{"a":1}'), createHash("sha256").update('{"a":1}').digest("hex"));
});

test("analizarCaptura calcula el hash de los bytes y reconoce MPEG-TS", () => {
  const bytes = Buffer.from([0x47, 1, 2, 3]);
  const r = analizarCaptura(bytes.toString("base64"));
  assert.equal(r.sha256, createHash("sha256").update(bytes).digest("hex"));
  assert.equal(r.bytes, 4);
  assert.equal(r.formato_ok, true);
});

test("analizarCaptura marca formato dudoso si no empieza con 0x47", () => {
  const r = analizarCaptura(Buffer.from([0x00, 1, 2]).toString("base64"));
  assert.equal(r.formato_ok, false);
  assert.notEqual(r.sha256, null);
});

test("analizarCaptura sin captura o con base64 inválido no inventa un hash", () => {
  assert.deepEqual(analizarCaptura(undefined), { sha256: null, bytes: 0, formato_ok: false });
  assert.deepEqual(analizarCaptura(""), { sha256: null, bytes: 0, formato_ok: false });
  assert.deepEqual(analizarCaptura("esto no es base64 !!"), { sha256: null, bytes: 0, formato_ok: false });
});

// --- auditoría ---------------------------------------------------------------------

function auditoriaNueva() {
  const db = abrirDb(":memory:");
  return { db, auditoria: new Auditoria(db) };
}

test("la auditoría encadena cada entrada con la anterior", () => {
  const { auditoria } = auditoriaNueva();
  const a = auditoria.registrar({ minuto: 1, actor: "sistema", tipo: "uno", datos: { x: 1 } });
  const b = auditoria.registrar({ minuto: 2, actor: "sistema", tipo: "dos", datos: { x: 2 } });
  assert.equal(a.seq, 1);
  assert.equal(b.seq, 2);
  assert.notEqual(a.hash, b.hash);
  assert.deepEqual(auditoria.cabecera(), b);
  assert.deepEqual(auditoria.verificar(), { ok: true });
});

test("alterar una entrada guardada rompe la verificación en esa secuencia", () => {
  const { db, auditoria } = auditoriaNueva();
  auditoria.registrar({ minuto: 1, actor: "sistema", tipo: "uno", datos: {} });
  auditoria.registrar({ minuto: 2, actor: "jueza", tipo: "decision", datos: { resultado: "aprobada" } });
  auditoria.registrar({ minuto: 3, actor: "sistema", tipo: "tres", datos: {} });
  db.prepare("UPDATE auditoria SET contenido = replace(contenido, 'aprobada', 'rechazada') WHERE seq = 2").run();
  assert.deepEqual(auditoria.verificar(), { ok: false, falla_en: 2 });
});

test("la exportación trae una línea por entrada con contenido, hash anterior y hash", () => {
  const { auditoria } = auditoriaNueva();
  auditoria.registrar({ minuto: 1.5, actor: "sistema", tipo: "uno", datos: { x: "ñ" } });
  auditoria.registrar({ minuto: null, actor: "sistema", tipo: "dos", datos: {} });
  const lineas = auditoria.exportarJsonl().trim().split("\n").map((l) => JSON.parse(l));
  assert.equal(lineas.length, 2);
  assert.equal(lineas[0].seq, 1);
  assert.equal(lineas[0].hash_anterior, "0".repeat(64));
  assert.equal(lineas[1].hash_anterior, lineas[0].hash);
  const contenido = JSON.parse(lineas[0].contenido);
  assert.equal(contenido.actor, "sistema");
  assert.equal(contenido.tipo, "uno");
  assert.equal(contenido.minuto, 1.5);
  assert.deepEqual(contenido.datos, { x: "ñ" });
  // El hash se puede recalcular solo con lo exportado.
  assert.equal(
    lineas[0].hash,
    createHash("sha256").update(`${lineas[0].hash_anterior}\n1\n${lineas[0].contenido}`).digest("hex"),
  );
});

test("una auditoría reabierta sobre la misma base continúa la cadena", () => {
  const { db, auditoria } = auditoriaNueva();
  const a = auditoria.registrar({ minuto: 1, actor: "sistema", tipo: "uno", datos: {} });
  const otra = new Auditoria(db);
  const b = otra.registrar({ minuto: 2, actor: "sistema", tipo: "dos", datos: {} });
  assert.equal(b.seq, a.seq + 1);
  assert.deepEqual(otra.verificar(), { ok: true });
});
