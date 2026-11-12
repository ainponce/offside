// Lo que la interfaz necesita del contrato: turnos, estado en todas las vistas,
// cobertura máxima, resúmenes legibles y nombres de proveedor en los textos.

import assert from "node:assert/strict";
import { test } from "node:test";
import type { ColaDTO, EstadoDTO, ExpedienteDTO, TableroDTO, TransparenciaDTO } from "../src/compartido/tipos.ts";
import { aprobarMedida } from "../src/server/decisiones.ts";
import { instalarReclamos } from "../src/server/reclamos.ts";
import { deteccion, filas, montarApi, publicarYProcesar } from "./ayuda.ts";

const cdn = (id = "D-4", minuto = 6) =>
  deteccion({
    id,
    minuto,
    host_stream: "vivo.gol.test",
    ip_servidor: "198.51.100.20",
    asn: 64610,
    marca_de_agua_extraida: "TX26-OFI-S000222",
  });

test("el estado trae el horario de turnos que publica el simulador", async () => {
  const m = montarApi();
  await m.motor.tick();
  const e = (await m.pedir("/api/estado")).datos as EstadoDTO;
  assert.deepEqual(e.turnos, [
    { juez_id: "jueza-a", nombre: "Dra. A", desde_min: -60, hasta_min: 50 },
    { juez_id: "juez-b", nombre: "Dr. B", desde_min: 50, hasta_min: 240 },
  ]);
});

test("sin GET /juzgados el motor sigue conectado y el horario queda vacío", async () => {
  const m = montarApi();
  m.sim.conJuzgados = false;
  await m.motor.tick();
  const e = (await m.pedir("/api/estado")).datos as EstadoDTO;
  assert.equal(e.conectado, true);
  assert.deepEqual(e.turnos, []);
});

test("transparencia y expediente traen el estado completo", async () => {
  const m = montarApi();
  await publicarYProcesar(m, deteccion({ id: "D-1", minuto: 2 }));
  const t = (await m.pedir("/api/transparencia")).datos as TransparenciaDTO;
  assert.equal(t.estado.minuto, 2);
  assert.equal(t.estado.turnos.length, 2);
  assert.equal(t.estado.jueces_de_turno[0]!.id, "jueza-a");
  const token = await m.ingresar("a", "clave-de-a");
  const e = (await m.pedir("/api/expedientes/EXP-2026-000001", { token })).datos as ExpedienteDTO;
  assert.equal(e.estado, "pendiente");
  assert.equal(e.estado_general.minuto, 2);
  assert.equal(e.estado_general.partido!.id, "falso-01");
});

test("la cobertura máxima queda después del pitazo final, cuando la actual cae a 0", async () => {
  const m = montarApi();
  await publicarYProcesar(m, deteccion({ id: "D-1", minuto: 2 }));
  await aprobarMedida(m.ctx, "M-0001", "jueza-a");
  m.sim.avanzar(3);
  await m.motor.tick();
  const token = await m.ingresar("a", "clave-de-a");
  let t = (await m.pedir("/api/tablero", { token })).datos as TableroDTO;
  assert.equal(t.expedientes[0]!.servidores[0]!.cobertura_pct, 100);
  assert.equal(t.expedientes[0]!.servidores[0]!.cobertura_max_pct, 100);

  m.sim.avanzar(106);
  await m.motor.tick();
  t = (await m.pedir("/api/tablero", { token })).datos as TableroDTO;
  assert.equal(t.expedientes[0]!.servidores[0]!.cobertura_pct, 0);
  assert.equal(t.expedientes[0]!.servidores[0]!.cobertura_max_pct, 100);
  assert.equal(t.metricas.cobertura_media_pct, 0);
  assert.equal(t.metricas.cobertura_max_pct, 100);
});

test("la cobertura máxima cuenta solo los proveedores que tenían el bloqueo aplicado a la vez", async () => {
  const m = montarApi();
  await publicarYProcesar(m, deteccion({ id: "D-1", minuto: 2 }));
  await aprobarMedida(m.ctx, "M-0001", "jueza-a");
  // Grande deja de bloquear antes de que aplique el resto: nunca estuvieron los tres juntos.
  m.db.prepare("UPDATE ordenes SET estado = 'levantada', aplicada_min = 2.1, finalizada_min = 2.2 WHERE proveedor_id = 'grande'").run();
  m.db.prepare("UPDATE ordenes SET estado = 'aplicada', aplicada_min = 2.5 WHERE proveedor_id <> 'grande'").run();
  const token = await m.ingresar("a", "clave-de-a");
  const t = (await m.pedir("/api/tablero", { token })).datos as TableroDTO;
  const s = t.expedientes[0]!.servidores[0]!;
  // Grande solo: 1000 de 1110 (90,1 %); los otros dos juntos: 110 de 1110 (9,9 %).
  assert.equal(s.cobertura_max_pct, 90.1);
});

test("el plan trae la participación de cada proveedor en el total de clientes", async () => {
  const m = montarApi();
  await publicarYProcesar(m, deteccion({ id: "D-1", minuto: 2 }));
  const token = await m.ingresar("a", "clave-de-a");
  const medida = ((await m.pedir("/api/juez/cola", { token })).datos as ColaDTO).pendientes[0]!;
  assert.deepEqual(
    medida.plan.map((p) => p.clientes_pct),
    [90.1, 9, 0.9],
  );
});

test("los resúmenes de auditoría son frases legibles, con IP en mayúsculas y nombres de proveedor", async () => {
  const m = montarApi();
  m.ctx.auditoria.registrar({ minuto: null, actor: "sistema", tipo: "arranque", datos: { simulador: "http://sim", simulacro: false, base_nueva: true } });
  m.ctx.auditoria.registrar({ minuto: 1.25, actor: "sistema", tipo: "simulador_reiniciado", datos: { minuto_anterior: 30.5, minuto_actual: 1.25 } });
  m.ctx.auditoria.registrar({ minuto: null, actor: "sistema", tipo: "medida_recuperada", datos: { medida_id: "M-0007" } });
  m.ctx.auditoria.registrar({ minuto: 3, actor: "sistema", tipo: "un_evento_nuevo", datos: {} });
  await publicarYProcesar(m, deteccion({ id: "D-1", minuto: 2 }));
  const token = await m.ingresar("a", "clave-de-a");
  await m.pedir("/api/juez/medidas/M-0001/aprobar", { token, metodo: "POST" });
  m.sim.avanzar(3);
  await m.motor.tick();

  const fiscal = await m.ingresar("fiscal", "clave-fiscal");
  const t = (await m.pedir("/api/tablero", { token: fiscal })).datos as TableroDTO;
  const por = (tipo: string) => t.auditoria.ultimas.filter((a) => a.tipo === tipo).map((a) => a.resumen);
  assert.match(por("ingreso")[0]!, /^Fiscalía ingresó/);
  assert.match(por("ingreso").at(-1)!, /^Dra\. A ingresó/);
  assert.match(por("arranque")[0]!, /^Offside arrancó/);
  assert.match(por("simulador_reiniciado")[0]!, /30,5/);
  assert.match(por("medida_recuperada")[0]!, /M-0007/);
  assert.match(por("orden_enviada").join(" "), /IP 203\.0\.113\.5/);
  assert.match(por("orden_enviada").join(" "), /Solo dominio/);
  assert.match(por("orden_aplicada").join(" "), /aplicó el bloqueo del dominio s1\.pelota\.test/);
  for (const a of t.auditoria.ultimas) {
    assert.doesNotMatch(a.resumen, /\bde el\b/, `"de el": ${a.resumen}`);
    assert.doesNotMatch(a.resumen, /_/, `resumen con guion bajo: ${a.resumen}`);
    assert.doesNotMatch(a.resumen, /\bip\b/, `"ip" en minúsculas: ${a.resumen}`);
    assert.doesNotMatch(a.resumen, /\d\.\d+ (min|del)/, `decimal con punto: ${a.resumen}`);
    assert.match(a.resumen, /\.$/, `no termina como frase: ${a.resumen}`);
  }
});

test("las medidas por reclamo van primero en la cola: hay un sitio legítimo caído", async () => {
  const m = montarApi({ simulacro: true });
  instalarReclamos(m.motor);
  await publicarYProcesar(m, cdn());
  await aprobarMedida(m.ctx, "M-0001", "jueza-a");
  m.sim.avanzar(7);
  await m.motor.tick();
  await publicarYProcesar(m, deteccion({ id: "D-9", minuto: 8 }));
  m.sim.emitirReclamo({ id: "R-001", minuto: 8.5, dominio: "panaderia.test", proveedor: "solo-dominio", mensaje: "No carga." });
  m.sim.emitirReclamo({ id: "R-002", minuto: 8.5, dominio: "panaderia.test", proveedor: "grande", mensaje: "No carga." });
  m.sim.avanzar(9);
  await m.motor.tick();
  const token = await m.ingresar("a", "clave-de-a");
  const cola = (await m.pedir("/api/juez/cola", { token })).datos as ColaDTO;
  assert.deepEqual(
    cola.pendientes.map((p) => p.clase),
    ["levantamiento", "inicial"],
  );
  const lev = cola.pendientes[0]!;
  assert.equal(lev.levantamiento!.proveedor_nombre, "Grande");
  assert.deepEqual(
    lev.levantamiento!.ordenes_a_levantar.map((o) => o.proveedor_nombre),
    ["Grande", "Inestable"],
  );
  assert.match(lev.verificaciones[2]!.detalle, /^Grande: IP 198\.51\.100\.20/);
  assert.doesNotMatch(lev.verificaciones.map((v) => v.detalle).join(" "), /\bgrande\b|\binestable\b/);
  const tablero = (await m.pedir("/api/tablero", { token })).datos as TableroDTO;
  assert.ok(tablero.reclamos.every((r) => r.proveedor_nombre === (r.proveedor_id === "grande" ? "Grande" : "Solo dominio")));
});

test("el bloqueo por dominio que reemplaza a uno por IP levantado es el intento 1", async () => {
  const m = montarApi({ simulacro: true });
  instalarReclamos(m.motor);
  await publicarYProcesar(m, cdn());
  await aprobarMedida(m.ctx, "M-0001", "jueza-a");
  m.sim.avanzar(7);
  await m.motor.tick();
  m.sim.emitirReclamo({ id: "R-001", minuto: 7.5, dominio: "panaderia.test", proveedor: "grande", mensaje: "No carga." });
  m.sim.avanzar(8);
  await m.motor.tick();
  await aprobarMedida(m.ctx, "M-0002", "jueza-a");
  const porDominio = filas<{ proveedor_id: string; intento: number }>(
    m.db,
    "SELECT proveedor_id, intento FROM ordenes WHERE medida_id = 'M-0002' ORDER BY proveedor_id",
  );
  assert.deepEqual(
    porDominio.map((o) => [o.proveedor_id, o.intento]),
    [
      ["grande", 1],
      ["inestable", 1],
    ],
  );
});

test("el aviso al titular se lee bien con cualquier titular", async () => {
  const m = montarApi();
  m.sim.partidoDatos.titular_derechos = "Liga Profesional Ficticia";
  await publicarYProcesar(m, deteccion({ id: "D-1", minuto: 2 }));
  const token = await m.ingresar("a", "clave-de-a");
  const e = (await m.pedir("/api/expedientes/EXP-2026-000001", { token })).datos as ExpedienteDTO;
  assert.match(e.aviso_titular, /^Aviso al titular de los derechos \(Liga Profesional Ficticia\)/);
  assert.doesNotMatch(e.aviso_titular, /al Liga/);
});

test("los textos de la medida escriben IP en mayúsculas", async () => {
  const m = montarApi();
  await publicarYProcesar(m, deteccion({ id: "D-1", minuto: 2 }));
  await publicarYProcesar(m, cdn("D-2", 3));
  const token = await m.ingresar("a", "clave-de-a");
  const cola = (await m.pedir("/api/juez/cola", { token })).datos as ColaDTO;
  for (const medida of cola.pendientes) {
    const textos = [medida.pedido, ...medida.verificaciones.flatMap((v) => [v.titulo, v.detalle]), ...medida.plan.map((p) => p.sin_cobertura ?? "")];
    for (const t of textos) assert.doesNotMatch(t, /\bip\b/, t);
  }
});
