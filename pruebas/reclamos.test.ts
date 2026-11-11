import assert from "node:assert/strict";
import { test } from "node:test";
import { aprobarMedida } from "../src/server/decisiones.ts";
import { instalarReclamos } from "../src/server/reclamos.ts";
import { medidaPorId } from "../src/server/repositorio.ts";
import { medidaDTO } from "../src/server/vistas.ts";
import { type Armado, armar, deteccion, eventos, filas, publicarYProcesar } from "./ayuda.ts";

const cdn = (id = "D-1", minuto = 6) =>
  deteccion({
    id,
    minuto,
    host_stream: "vivo.gol.test",
    ip_servidor: "198.51.100.20",
    asn: 64610,
    marca_de_agua_extraida: "TX26-OFI-S000222",
  });

interface Medida {
  id: string;
  clase: string;
  estado: string;
  instantanea: string;
  plan: string;
  reclamo_id: string | null;
}
const medidas = (a: Armado) => filas<Medida>(a.db, "SELECT * FROM medidas ORDER BY n");
const reclamos = (a: Armado) => filas<{ id: string; estado: string; medida_id: string | null }>(a.db, "SELECT * FROM reclamos ORDER BY id");

/** Simulacro: se bloquea por IP una IP compartida, se aplica, y la panadería reclama. */
async function bloqueoEquivocado(): Promise<Armado> {
  const a = armar({ simulacro: true });
  instalarReclamos(a.motor);
  await publicarYProcesar(a, cdn());
  await aprobarMedida(a.ctx, "M-0001", "jueza-a");
  a.sim.avanzar(7);
  await a.motor.tick();
  return a;
}

function reclamar(a: Armado, id: string, dominio: string, proveedor = "grande", minuto = a.sim.minuto + 1): void {
  a.sim.avanzar(minuto);
  a.sim.emitirReclamo({ id, minuto, dominio, proveedor, mensaje: `${dominio}: nuestro sitio dejó de cargar.` });
}

test("con el simulacro activo, la primera IP compartida se propone por IP y queda rotulada", async () => {
  const a = armar({ simulacro: true });
  a.sim.dns["198.51.100.30"] = { asn: 64620, organizacion: "Pampa Hosting Compartido", dominios: ["tv.otro.test", "club.test"] };
  await publicarYProcesar(a, cdn());
  await publicarYProcesar(
    a,
    deteccion({ id: "D-2", minuto: 9, host_stream: "tv.otro.test", ip_servidor: "198.51.100.30", asn: 64620, marca_de_agua_extraida: "TX26-OFI-S000333" }),
  );
  const [primera, segunda] = medidas(a);
  const inst = JSON.parse(primera!.instantanea);
  assert.equal(inst.riesgo.simulacro, true);
  assert.equal(inst.riesgo.tipo_recomendado, "ip");
  assert.match(inst.riesgo.motivo, /SIMULACRO/);
  assert.deepEqual(JSON.parse(primera!.plan)[0], { proveedor_id: "grande", tipo: "ip", objetivo: "198.51.100.20" });

  const dto = medidaDTO(a.ctx, medidaPorId(a.db, primera!.id)!);
  assert.equal(dto.simulacro, true);
  assert.equal(dto.verificaciones[3]!.luz, "roja");

  // El simulacro se usa una sola vez: la siguiente IP compartida sigue la regla real.
  assert.equal(JSON.parse(segunda!.instantanea).riesgo.tipo_recomendado, "dominio");
  assert.equal(JSON.parse(segunda!.instantanea).riesgo.simulacro, undefined);
});

test("sin el simulacro, una IP compartida nunca se bloquea por IP", async () => {
  const a = armar();
  await publicarYProcesar(a, cdn());
  await aprobarMedida(a.ctx, "M-0001", "jueza-a");
  assert.ok(a.sim.recibidas().every((o) => o.tipo === "dominio"));
});

test("un reclamo por un sitio detrás de un bloqueo por IP nuestro crea una medida de levantamiento", async () => {
  const a = await bloqueoEquivocado();
  reclamar(a, "R-001", "panaderia.test");
  await a.motor.tick();

  assert.deepEqual(
    reclamos(a).map((r) => [r.id, r.estado, r.medida_id]),
    [["R-001", "verificado", "M-0002"]],
  );
  const m = medidas(a)[1]!;
  assert.equal(m.clase, "levantamiento");
  assert.equal(m.estado, "pendiente");
  assert.equal(m.reclamo_id, "R-001");
  const inst = JSON.parse(m.instantanea);
  assert.deepEqual(
    inst.ordenes_a_levantar.map((o: any) => [o.proveedor_id, o.tipo, o.objetivo]),
    [
      ["grande", "ip", "198.51.100.20"],
      ["inestable", "ip", "198.51.100.20"],
    ],
  );
  assert.deepEqual(JSON.parse(m.plan), [
    { proveedor_id: "grande", tipo: "dominio", objetivo: "vivo.gol.test" },
    { proveedor_id: "inestable", tipo: "dominio", objetivo: "vivo.gol.test" },
  ]);
  assert.equal(eventos(a.db, "reclamo_recibido")[0]!.datos.verificado, true);

  const dto = medidaDTO(a.ctx, medidaPorId(a.db, m.id)!);
  assert.equal(dto.levantamiento!.dominio, "panaderia.test");
  assert.equal(dto.levantamiento!.ordenes_a_levantar.length, 2);
  assert.equal(dto.verificaciones.length, 4);
  assert.match(dto.pedido, /panaderia\.test/);
});

test("al aprobar el levantamiento se levantan las órdenes por IP y sale el bloqueo por dominio", async () => {
  const a = await bloqueoEquivocado();
  reclamar(a, "R-001", "panaderia.test");
  await a.motor.tick();
  const huella = filas<{ huella: string }>(a.db, "SELECT huella FROM medidas WHERE id = 'M-0002'")[0]!.huella;
  assert.deepEqual(await aprobarMedida(a.ctx, "M-0002", "jueza-a"), { ok: true });

  assert.deepEqual(a.sim.levantamientos.map((l) => l.proveedor).sort(), ["grande", "inestable"]);
  for (const l of a.sim.levantamientos) {
    assert.equal(l.juez_id, "jueza-a");
    assert.match(l.motivo, /R-001/);
    assert.ok(l.motivo.includes(huella.slice(0, 16)));
  }
  const porDominio = a.sim.recibidas().filter((o) => o.tipo === "dominio" && o.objetivo === "vivo.gol.test");
  assert.deepEqual(porDominio.map((o) => o.proveedor).sort(), ["grande", "inestable", "solo-dominio"]);
  assert.ok(a.sim.recibidas().filter((o) => o.tipo === "ip").every((o) => o.estado === "levantada"));

  assert.equal(reclamos(a)[0]!.estado, "resuelto");
  const locales = filas<{ estado: string }>(a.db, "SELECT estado FROM ordenes WHERE tipo = 'ip'").map((o) => o.estado);
  assert.deepEqual(locales, ["levantada", "levantada"]);
  assert.equal(eventos(a.db, "orden_levantada").length, 2);
  assert.equal(eventos(a.db, "levantamiento")[0]!.datos.reclamo_id, "R-001");
});

test("solo el juez de turno puede levantar una orden", async () => {
  const a = await bloqueoEquivocado();
  reclamar(a, "R-001", "panaderia.test");
  await a.motor.tick();
  const r = await aprobarMedida(a.ctx, "M-0002", "juez-b");
  assert.equal(!r.ok && r.codigo, 403);
  assert.equal(a.sim.levantamientos.length, 0);
});

test("un reclamo sobre un dominio que no bloqueamos queda sin verificar y no genera medida", async () => {
  const a = await bloqueoEquivocado();
  reclamar(a, "R-009", "nada-que-ver.test");
  await a.motor.tick();
  assert.equal(reclamos(a)[0]!.estado, "no_verificado");
  assert.equal(medidas(a).length, 1);
  assert.equal(eventos(a.db, "reclamo_recibido")[0]!.datos.verificado, false);
});

test("un segundo reclamo por el mismo bloqueo se suma a la medida pendiente", async () => {
  const a = await bloqueoEquivocado();
  reclamar(a, "R-001", "panaderia.test");
  await a.motor.tick();
  reclamar(a, "R-002", "escuela.test", "inestable");
  await a.motor.tick();
  assert.equal(medidas(a).length, 2);
  assert.deepEqual(
    reclamos(a).map((r) => [r.id, r.estado, r.medida_id]),
    [
      ["R-001", "verificado", "M-0002"],
      ["R-002", "verificado", "M-0002"],
    ],
  );
  await aprobarMedida(a.ctx, "M-0002", "jueza-a");
  assert.deepEqual(
    reclamos(a).map((r) => r.estado),
    ["resuelto", "resuelto"],
  );
});

test("un reclamo que llega cuando la orden ya fue levantada queda resuelto sin medida nueva", async () => {
  const a = await bloqueoEquivocado();
  reclamar(a, "R-001", "panaderia.test");
  await a.motor.tick();
  await aprobarMedida(a.ctx, "M-0002", "jueza-a");
  reclamar(a, "R-002", "escuela.test");
  await a.motor.tick();
  assert.equal(medidas(a).length, 2);
  assert.equal(reclamos(a)[1]!.estado, "resuelto");
});

test("el reclamo del propio sitio bloqueado no genera un levantamiento", async () => {
  const a = await bloqueoEquivocado();
  reclamar(a, "R-003", "vivo.gol.test", "solo-dominio");
  await a.motor.tick();
  assert.equal(reclamos(a)[0]!.estado, "no_verificado");
  assert.equal(medidas(a).length, 1);
});

test("un reclamo por un bloqueo de dominio a un sitio legítimo se levanta sin reemplazo", async () => {
  // Caso que las reglas no deberían producir; se arma a mano para probar el levantamiento sin reemplazo.
  const a = armar();
  instalarReclamos(a.motor);
  await publicarYProcesar(a, cdn());
  await aprobarMedida(a.ctx, "M-0001", "jueza-a");
  a.sim.avanzar(7);
  await a.motor.tick();
  a.db.prepare("UPDATE servidores SET host = 'otro-host.test'").run();
  reclamar(a, "R-004", "vivo.gol.test");
  await a.motor.tick();
  const m = medidas(a)[1]!;
  assert.equal(m.clase, "levantamiento");
  assert.deepEqual(JSON.parse(m.plan), []);
  await aprobarMedida(a.ctx, m.id, "jueza-a");
  assert.equal(a.sim.levantamientos.length, 3);
  assert.equal(a.sim.recibidas().filter((o) => o.estado === "recibida" || o.estado === "aplicada").length, 0);
});
