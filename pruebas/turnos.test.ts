// El turno se comprueba con el horario de GET /juzgados, con margen, y con el
// estado recién leído antes de cada envío.

import assert from "node:assert/strict";
import { test } from "node:test";
import { aprobarMedida } from "../src/server/decisiones.ts";
import { armar, deteccion, eventos, filas, publicarYProcesar } from "./ayuda.ts";

const medidas = (a: ReturnType<typeof armar>) =>
  filas<{ id: string; clase: string; estado: string }>(a.db, "SELECT id, clase, estado FROM medidas ORDER BY n");
const estados = (a: ReturnType<typeof armar>) =>
  filas<{ estado: string }>(a.db, "SELECT estado FROM ordenes ORDER BY proveedor_id").map((o) => o.estado);

test("dentro del margen antes del fin del turno, la medida la firma el juez entrante", async () => {
  const a = armar();
  await publicarYProcesar(a, deteccion({ id: "D-1", minuto: 49.7 }));
  const r = await aprobarMedida(a.ctx, "M-0001", "jueza-a");
  assert.deepEqual(r, { ok: false, codigo: 409, error: "Faltan 0,3 minutos para el fin de tu turno: esta medida la firma el juez entrante." });
  assert.equal(a.sim.recibidas().length, 0);
  assert.equal(filas(a.db, "SELECT * FROM ordenes").length, 0);
  assert.deepEqual(medidas(a).map((m) => [m.clase, m.estado]), [["inicial", "pendiente"]]);

  a.sim.avanzar(50.1);
  await a.motor.tick();
  assert.deepEqual(await aprobarMedida(a.ctx, "M-0001", "juez-b"), { ok: true });
  assert.equal(a.sim.recibidas().length, 3);
  assert.ok(a.sim.recibidas().every((o) => o.juez_id === "juez-b" && o.juez_de_turno));
});

test("una ratificación pedida dentro del margen no la puede firmar el juez saliente: no hay ratificaciones en cadena", async () => {
  const a = armar();
  a.sim.fallasPendientes.set("inestable", 1);
  await publicarYProcesar(a, deteccion({ id: "D-1", minuto: 48.9 }));
  await aprobarMedida(a.ctx, "M-0001", "jueza-a");
  a.sim.avanzar(49.6);
  await a.motor.tick();
  const ratificacion = medidas(a).find((m) => m.clase === "ratificacion")!;
  const r = await aprobarMedida(a.ctx, ratificacion.id, "jueza-a");
  assert.equal(!r.ok && r.codigo, 409);
  assert.equal(medidas(a).filter((m) => m.clase === "ratificacion").length, 1);
  a.sim.avanzar(50.1);
  await a.motor.tick();
  assert.deepEqual(await aprobarMedida(a.ctx, ratificacion.id, "juez-b"), { ok: true });
  assert.equal(a.sim.recibidas("inestable").length, 2);
  assert.ok(a.sim.recibidas().every((o) => o.juez_de_turno));
});

test("si el reloj cruza el cambio de turno durante la guardia de DNS, la orden no sale con la firma vencida", async () => {
  const a = armar();
  await publicarYProcesar(a, deteccion({ id: "D-1", minuto: 49 }));
  a.sim.alConsultarDns = () => {
    a.sim.avanzar(50.2);
  };
  await aprobarMedida(a.ctx, "M-0001", "jueza-a");
  a.sim.alConsultarDns = null;
  assert.ok(a.sim.recibidas().every((o) => o.juez_de_turno), "salió una orden con el juez fuera de turno");
  assert.equal(a.sim.recibidas().length, 0);
  assert.ok(medidas(a).some((m) => m.clase === "ratificacion" && m.estado === "pendiente"));
});

test("tras una respuesta perdida y un cambio de turno, Offside pregunta al proveedor antes y no pide ratificación", async () => {
  const a = armar();
  await publicarYProcesar(a, deteccion({ id: "D-1", minuto: 49 }));
  a.sim.cortesDespues = 1; // la primera orden llega, pero la respuesta se pierde
  await aprobarMedida(a.ctx, "M-0001", "jueza-a");
  assert.equal(a.sim.recibidas().length, 3);
  const envios = a.sim.llamadasEnvio;

  a.sim.avanzar(50.3);
  await a.motor.tick();
  assert.equal(a.sim.llamadasEnvio, envios);
  assert.ok(estados(a).every((e) => e === "recibida" || e === "aplicada"), estados(a).join(", "));
  assert.equal(eventos(a.db, "orden_no_enviada").length, 0);
  assert.equal(medidas(a).filter((m) => m.clase === "ratificacion").length, 0);
});

test("sin el horario de turnos no hay margen: vale el estado leído antes del envío", async () => {
  const a = armar();
  a.sim.conJuzgados = false;
  await publicarYProcesar(a, deteccion({ id: "D-1", minuto: 49.7 }));
  await aprobarMedida(a.ctx, "M-0001", "jueza-a");
  assert.equal(a.sim.recibidas().length, 3);
  assert.ok(a.sim.recibidas().every((o) => o.juez_de_turno));
});

test("una orden fallida dentro del margen va directo a ratificación, sin crear un reintento que no sale", async () => {
  const a = armar();
  a.sim.fallasPendientes.set("inestable", 1);
  await publicarYProcesar(a, deteccion({ id: "D-1", minuto: 48.9 }));
  await aprobarMedida(a.ctx, "M-0001", "jueza-a");
  a.sim.avanzar(49.6);
  await a.motor.tick();
  assert.equal(a.sim.recibidas("inestable").length, 1);
  assert.equal(filas(a.db, "SELECT * FROM ordenes WHERE proveedor_id = 'inestable'").length, 1);
  assert.ok(medidas(a).some((m) => m.clase === "ratificacion"));
});
