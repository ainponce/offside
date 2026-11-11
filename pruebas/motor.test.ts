import assert from "node:assert/strict";
import { test } from "node:test";
import { aprobarMedida, rechazarMedida, reconsiderarMedida } from "../src/server/decisiones.ts";
import { sha256Hex } from "../src/server/evidencia.ts";
import { Motor } from "../src/server/motor.ts";
import { armar, deteccion, eventos, filas, publicarYProcesar } from "./ayuda.ts";

interface Medida {
  id: string;
  n: number;
  expediente_id: string;
  clase: string;
  estado: string;
  instantanea: string;
  huella: string;
  plan: string;
  vence_min: number;
  juez_id: string | null;
}

const medidas = (a: ReturnType<typeof armar>) => filas<Medida>(a.db, "SELECT * FROM medidas ORDER BY n");

// --- ingesta y expedientes -------------------------------------------------------

test("una detección pirata abre expediente, servidor y medida inicial pendiente", async () => {
  const a = armar();
  await publicarYProcesar(a, deteccion({ id: "D-1", minuto: 2 }));

  const expedientes = filas(a.db, "SELECT * FROM expedientes");
  assert.equal(expedientes.length, 1);
  assert.equal(expedientes[0]!.id, "EXP-2026-000001");
  assert.equal(expedientes[0]!.marca, "TX26-OFI-S000111");
  assert.equal(filas(a.db, "SELECT * FROM servidores").length, 1);

  const [m] = medidas(a);
  assert.equal(m!.clase, "inicial");
  assert.equal(m!.estado, "pendiente");
  assert.equal(m!.vence_min, 105);
  assert.equal(m!.huella, sha256Hex(m!.instantanea));
  const plan = JSON.parse(m!.plan);
  assert.deepEqual(plan[0], { proveedor_id: "grande", tipo: "ip", objetivo: "203.0.113.5" });
  assert.deepEqual(plan[1], { proveedor_id: "solo-dominio", tipo: "dominio", objetivo: "s1.pelota.test" });
});

test("la instantánea congela marca, servidor, riesgo, evidencia y plan", async () => {
  const a = armar();
  await publicarYProcesar(a, deteccion({ id: "D-1", minuto: 2 }));
  const inst = JSON.parse(medidas(a)[0]!.instantanea);
  assert.equal(inst.expediente_id, "EXP-2026-000001");
  assert.equal(inst.filtracion.marca, "TX26-OFI-S000111");
  assert.equal(inst.servidor.host, "s1.pelota.test");
  assert.equal(inst.servidor.ip, "203.0.113.5");
  assert.equal(inst.riesgo.tipo_recomendado, "ip");
  assert.equal(inst.evidencia[0].deteccion_id, "D-1");
  assert.match(inst.evidencia[0].captura_sha256, /^[0-9a-f]{64}$/);
  assert.equal(inst.vence_min, 105);
  assert.equal(inst.plan.length, 3);
});

test("otra detección del mismo servidor suma evidencia sin crear otra medida", async () => {
  const a = armar();
  await publicarYProcesar(a, deteccion({ id: "D-1", minuto: 2 }));
  await publicarYProcesar(a, deteccion({ id: "D-2", minuto: 12 }));
  assert.equal(medidas(a).length, 1);
  assert.equal(filas(a.db, "SELECT * FROM detecciones WHERE expediente_id = 'EXP-2026-000001'").length, 2);
});

test("la misma marca en otro servidor, con la primera aprobada, es una ampliación", async () => {
  const a = armar();
  await publicarYProcesar(a, deteccion({ id: "D-1", minuto: 2 }));
  assert.deepEqual(await aprobarMedida(a.ctx, medidas(a)[0]!.id, "jueza-a"), { ok: true });
  await publicarYProcesar(
    a,
    deteccion({ id: "D-3", minuto: 37, host_stream: "s2.pelota.test", ip_servidor: "203.0.113.6" }),
  );
  const ms = medidas(a);
  assert.equal(ms.length, 2);
  assert.equal(ms[1]!.clase, "ampliacion");
  assert.equal(ms[1]!.expediente_id, "EXP-2026-000001");
  assert.equal(filas(a.db, "SELECT * FROM expedientes").length, 1);
});

test("un servidor en CDN compartida se propone por dominio y nombra a los terceros", async () => {
  const a = armar();
  await publicarYProcesar(
    a,
    deteccion({
      id: "D-4",
      minuto: 6,
      host_stream: "vivo.gol.test",
      ip_servidor: "198.51.100.20",
      asn: 64610,
      marca_de_agua_extraida: "TX26-OFI-S000222",
    }),
  );
  const inst = JSON.parse(medidas(a)[0]!.instantanea);
  assert.equal(inst.riesgo.tipo_recomendado, "dominio");
  assert.deepEqual(inst.riesgo.terceros, ["panaderia.test", "escuela.test"]);
  for (const item of JSON.parse(medidas(a)[0]!.plan)) {
    assert.equal(item.tipo, "dominio");
    assert.equal(item.objetivo, "vivo.gol.test");
  }
});

test("licenciatario y otra señal se archivan sin medida", async () => {
  const a = armar();
  await publicarYProcesar(
    a,
    deteccion({
      id: "D-5",
      minuto: 4,
      host_stream: "canalsur.test",
      ip_servidor: "192.0.2.10",
      asn: 64640,
      marca_de_agua_extraida: "TX26-LIC-SUR",
    }),
  );
  await publicarYProcesar(
    a,
    deteccion({ id: "D-6", minuto: 8, host_stream: "vod.viejo.test", ip_servidor: "198.51.100.90", marca_de_agua_extraida: "TX25-F03-OFI-S9" }),
  );
  assert.equal(medidas(a).length, 0);
  const veredictos = filas<{ id: string; veredicto: string }>(a.db, "SELECT id, veredicto FROM detecciones ORDER BY id");
  assert.deepEqual(
    veredictos.map((v) => v.veredicto),
    ["licenciatario_autorizado", "no_es_la_senal"],
  );
  assert.equal(eventos(a.db, "deteccion_archivada").length, 2);
});

test("detección sin captura y con IP desconocida para el DNS pasivo recomienda dominio", async () => {
  const a = armar();
  await publicarYProcesar(
    a,
    deteccion({ id: "D-7", minuto: 3, host_stream: "x.raro.test", ip_servidor: "198.51.100.200", captura: null }),
  );
  const [m] = medidas(a);
  assert.equal(JSON.parse(m!.instantanea).riesgo.tipo_recomendado, "dominio");
  assert.equal(JSON.parse(m!.instantanea).evidencia[0].captura_sha256, null);
});

test("una detección mal formada no frena a las siguientes", async () => {
  const a = armar();
  a.sim.publicar({ id: "D-8", minuto: 1 } as any);
  a.sim.publicar(deteccion({ id: "D-9", minuto: 2 }));
  a.sim.avanzar(2);
  await a.motor.tick();
  assert.equal(medidas(a).length, 1);
  const mala = filas<{ veredicto: string }>(a.db, "SELECT veredicto FROM detecciones WHERE id = 'D-8'");
  assert.equal(mala[0]!.veredicto, "invalida");
});

// --- decisión y despacho -----------------------------------------------------------

test("aprobar envía una orden por proveedor, firmada, que vence al final y lleva la huella", async () => {
  const a = armar();
  await publicarYProcesar(a, deteccion({ id: "D-1", minuto: 2 }));
  const [m] = medidas(a);
  assert.deepEqual(await aprobarMedida(a.ctx, m!.id, "jueza-a"), { ok: true });

  const recibidas = a.sim.recibidas();
  assert.equal(recibidas.length, 3);
  for (const o of recibidas) {
    assert.equal(o.vence_min, 105);
    assert.equal(o.juez_id, "jueza-a");
    assert.equal(o.juzgado_id, "jg-1");
    assert.equal(o.expediente_id, "EXP-2026-000001");
    assert.equal(o.juez_de_turno, true);
    assert.ok(o.orden_id.endsWith(m!.huella.slice(0, 16)), o.orden_id);
  }
  assert.equal(a.sim.recibidas("grande")[0]!.tipo, "ip");
  assert.equal(a.sim.recibidas("solo-dominio")[0]!.tipo, "dominio");
  assert.equal(medidas(a)[0]!.estado, "aprobada");
  assert.equal(eventos(a.db, "decision")[0]!.datos.resultado, "aprobada");
  assert.equal(eventos(a.db, "decision")[0]!.actor, "jueza-a");
});

test("un juez fuera de turno no puede aprobar", async () => {
  const a = armar();
  await publicarYProcesar(a, deteccion({ id: "D-1", minuto: 2 }));
  const r = await aprobarMedida(a.ctx, medidas(a)[0]!.id, "juez-b");
  assert.equal(r.ok, false);
  assert.equal(!r.ok && r.codigo, 403);
  assert.equal(a.sim.recibidas().length, 0);
  assert.equal(medidas(a)[0]!.estado, "pendiente");
});

test("una segunda aprobación simultánea responde 409 y no envía dos veces", async () => {
  const a = armar();
  await publicarYProcesar(a, deteccion({ id: "D-1", minuto: 2 }));
  const id = medidas(a)[0]!.id;
  const [uno, dos] = await Promise.all([aprobarMedida(a.ctx, id, "jueza-a"), aprobarMedida(a.ctx, id, "jueza-a")]);
  assert.deepEqual([uno.ok, dos.ok].sort(), [false, true]);
  const rechazo = uno.ok ? dos : uno;
  assert.equal(!rechazo.ok && rechazo.codigo, 409);
  assert.equal(a.sim.recibidas().length, 3);
});

test("rechazar archiva la medida y reconsiderar la devuelve a la cola", async () => {
  const a = armar();
  await publicarYProcesar(a, deteccion({ id: "D-1", minuto: 2 }));
  const id = medidas(a)[0]!.id;
  assert.deepEqual(await rechazarMedida(a.ctx, id, "jueza-a", "Evidencia insuficiente"), { ok: true });
  assert.equal(medidas(a)[0]!.estado, "rechazada");
  assert.equal(a.sim.recibidas().length, 0);
  assert.deepEqual(await reconsiderarMedida(a.ctx, id, "jueza-a"), { ok: true });
  assert.equal(medidas(a)[0]!.estado, "pendiente");
  assert.equal(eventos(a.db, "reconsideracion").length, 1);
});

// --- seguimiento, reintentos y turnos -------------------------------------------------

test("las órdenes pasan a aplicadas y vencen cuando termina el partido", async () => {
  const a = armar();
  await publicarYProcesar(a, deteccion({ id: "D-1", minuto: 2 }));
  await aprobarMedida(a.ctx, medidas(a)[0]!.id, "jueza-a");
  a.sim.avanzar(3);
  await a.motor.tick();
  assert.deepEqual(
    filas<{ estado: string }>(a.db, "SELECT estado FROM ordenes").map((o) => o.estado),
    ["aplicada", "aplicada", "aplicada"],
  );
  a.sim.avanzar(106);
  await a.motor.tick();
  assert.deepEqual(
    filas<{ estado: string }>(a.db, "SELECT estado FROM ordenes").map((o) => o.estado),
    ["vencida", "vencida", "vencida"],
  );
  assert.equal(eventos(a.db, "orden_vencida").length, 3);
});

test("una orden fallida se reenvía con otro orden_id mientras el mismo juez sigue de turno", async () => {
  const a = armar();
  a.sim.fallasPendientes.set("inestable", 1);
  await publicarYProcesar(a, deteccion({ id: "D-1", minuto: 2 }));
  await aprobarMedida(a.ctx, medidas(a)[0]!.id, "jueza-a");
  a.sim.avanzar(3);
  await a.motor.tick();

  const intentos = a.sim.recibidas("inestable");
  assert.equal(intentos.length, 2);
  assert.notEqual(intentos[0]!.orden_id, intentos[1]!.orden_id);
  assert.match(intentos[1]!.orden_id, /-inestable-2-/);
  assert.equal(intentos[1]!.juez_de_turno, true);
  assert.equal(medidas(a).length, 1);
});

test("una orden fallida después del cambio de turno espera la ratificación del juez entrante", async () => {
  const a = armar();
  a.sim.fallasPendientes.set("inestable", 1);
  await publicarYProcesar(a, deteccion({ id: "D-1", minuto: 49.4 }));
  await aprobarMedida(a.ctx, medidas(a)[0]!.id, "jueza-a");
  a.sim.avanzar(50.5);
  await a.motor.tick();

  assert.equal(a.sim.recibidas("inestable").length, 1);
  const ms = medidas(a);
  assert.equal(ms.length, 2);
  assert.equal(ms[1]!.clase, "ratificacion");
  assert.equal(ms[1]!.estado, "pendiente");

  assert.deepEqual(await aprobarMedida(a.ctx, ms[1]!.id, "juez-b"), { ok: true });
  const intentos = a.sim.recibidas("inestable");
  assert.equal(intentos.length, 2);
  assert.equal(intentos[1]!.juez_id, "juez-b");
  assert.equal(intentos[1]!.juez_de_turno, true);
  assert.ok(a.sim.recibidas().every((o) => o.juez_de_turno));
});

test("si el envío se corta y el turno cambia antes del reenvío, no sale con la firma del juez saliente", async () => {
  const a = armar();
  await publicarYProcesar(a, deteccion({ id: "D-1", minuto: 49.8 }));
  a.sim.cortesAntes = 3;
  await aprobarMedida(a.ctx, medidas(a)[0]!.id, "jueza-a");
  assert.equal(a.sim.recibidas().length, 0);

  a.sim.avanzar(50.2);
  await a.motor.tick();
  await a.motor.tick();
  assert.equal(a.sim.recibidas().length, 0);
  const ms = medidas(a);
  assert.equal(ms[ms.length - 1]!.clase, "ratificacion");

  await aprobarMedida(a.ctx, ms[ms.length - 1]!.id, "juez-b");
  assert.equal(a.sim.recibidas().length, 3);
  assert.ok(a.sim.recibidas().every((o) => o.juez_id === "juez-b" && o.juez_de_turno));
});

test("tras un corte de red, Offside pregunta al proveedor antes de reenviar y no duplica la orden", async () => {
  const a = armar();
  await publicarYProcesar(a, deteccion({ id: "D-1", minuto: 2 }));
  a.sim.cortesDespues = 1; // la orden llega al proveedor, pero la respuesta se pierde
  await aprobarMedida(a.ctx, medidas(a)[0]!.id, "jueza-a");
  assert.equal(a.sim.recibidas().length, 3);
  const envios = a.sim.llamadasEnvio;

  await a.motor.tick();
  // No hubo un segundo envío: un duplicado quedaría como "orden rechazada" en el registro del proveedor.
  assert.equal(a.sim.llamadasEnvio, envios);
  assert.equal(a.sim.recibidas().length, 3);
  const estados = filas<{ estado: string }>(a.db, "SELECT estado FROM ordenes").map((o) => o.estado);
  assert.deepEqual(estados, ["recibida", "recibida", "recibida"]);
});

test("tras un corte de red sin entrega, la orden se reenvía con el mismo identificador", async () => {
  const a = armar();
  await publicarYProcesar(a, deteccion({ id: "D-1", minuto: 2 }));
  a.sim.cortesAntes = 1; // la orden nunca llegó
  await aprobarMedida(a.ctx, medidas(a)[0]!.id, "jueza-a");
  assert.equal(a.sim.recibidas().length, 2);
  const pendiente = filas<{ orden_id: string }>(a.db, "SELECT orden_id FROM ordenes WHERE estado = 'por_enviar'")[0]!;

  await a.motor.tick();
  assert.equal(a.sim.recibidas().length, 3);
  assert.ok(a.sim.recibidas().some((o) => o.orden_id === pendiente.orden_id));
  assert.equal(filas(a.db, "SELECT * FROM ordenes").length, 3);
});

test("una medida que quedó a medio aprobar por un corte del proceso vuelve a la cola al arrancar", async () => {
  const a = armar();
  await publicarYProcesar(a, deteccion({ id: "D-1", minuto: 2 }));
  a.db.prepare("UPDATE medidas SET estado = 'aprobando'").run();
  const reiniciado = new Motor(a.ctx);
  await reiniciado.tick();
  assert.equal(medidas(a)[0]!.estado, "pendiente");
  assert.deepEqual(await aprobarMedida(a.ctx, medidas(a)[0]!.id, "jueza-a"), { ok: true });
});

test("si el simulador no responde, el motor sigue y retoma sin repetir detecciones", async () => {
  const a = armar();
  a.sim.publicar(deteccion({ id: "D-1", minuto: 2 }));
  a.sim.avanzar(2);
  a.sim.caido = true;
  await a.motor.tick();
  assert.equal(a.ctx.estado.conectado, false);
  assert.equal(medidas(a).length, 0);

  a.sim.caido = false;
  await a.motor.tick();
  await a.motor.tick();
  assert.equal(a.ctx.estado.conectado, true);
  assert.equal(medidas(a).length, 1);
  assert.equal(filas(a.db, "SELECT * FROM detecciones").length, 1);
});

test("el cambio de juez de turno deja registrado el traspaso con las medidas pendientes", async () => {
  const a = armar();
  await publicarYProcesar(a, deteccion({ id: "D-1", minuto: 49 }));
  const id = medidas(a)[0]!.id;
  a.sim.avanzar(50.1);
  await a.motor.tick();
  const [traspaso] = eventos(a.db, "traspaso_turno");
  assert.deepEqual(traspaso!.datos.salientes, ["jueza-a"]);
  assert.deepEqual(traspaso!.datos.entrantes, ["juez-b"]);
  assert.deepEqual(traspaso!.datos.medidas_pendientes, [id]);
  // La pendiente la puede firmar el entrante y ya no el saliente.
  const saliente = await aprobarMedida(a.ctx, id, "jueza-a");
  assert.equal(!saliente.ok && saliente.codigo, 403);
  assert.deepEqual(await aprobarMedida(a.ctx, id, "juez-b"), { ok: true });
});

test("con el partido terminado no se crean medidas ni se envían órdenes", async () => {
  const a = armar();
  await publicarYProcesar(a, deteccion({ id: "D-1", minuto: 104 }));
  const id = medidas(a)[0]!.id;
  a.sim.avanzar(105.5);
  a.sim.publicar(deteccion({ id: "D-2", minuto: 105.2, host_stream: "s2.pelota.test", ip_servidor: "203.0.113.6" }));
  await a.motor.tick();

  assert.equal(medidas(a).length, 1);
  assert.equal(medidas(a)[0]!.estado, "sin_efecto");
  const r = await aprobarMedida(a.ctx, id, "juez-b");
  assert.equal(r.ok, false);
  assert.equal(a.sim.recibidas().length, 0);
});

test("cada cambio de estado avisa a la interfaz", async () => {
  const a = armar();
  await publicarYProcesar(a, deteccion({ id: "D-1", minuto: 2 }));
  assert.ok(a.cambios.n > 0);
  const antes = a.cambios.n;
  await aprobarMedida(a.ctx, medidas(a)[0]!.id, "jueza-a");
  assert.ok(a.cambios.n > antes);
});

test("si el reloj del simulador vuelve atrás, Offside avisa que hace falta una base nueva", async () => {
  const a = armar();
  await publicarYProcesar(a, deteccion({ id: "D-1", minuto: 30 }));
  assert.equal(a.ctx.estado.alertas.length, 0);

  // El simulador se reinició: mismo partido, reloj en el minuto 2.
  a.sim.minuto = 2;
  await a.motor.tick();
  await a.motor.tick();
  assert.equal(a.ctx.estado.alertas.length, 1);
  assert.match(a.ctx.estado.alertas[0]!, /--nuevo/);
  assert.equal(eventos(a.db, "simulador_reiniciado").length, 1);
});
