// Datos mal formados y reinicios del simulador: el motor nunca queda envenenado
// ni sigue con la base de otro partido.

import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { aprobarMedida } from "../src/server/decisiones.ts";
import { instalarReclamos } from "../src/server/reclamos.ts";
import { armar, deteccion, eventos, filas, montarApi, publicarYProcesar } from "./ayuda.ts";

const veredictoDe = (a: ReturnType<typeof armar>, id: string) =>
  filas<{ veredicto: string; motivo: string }>(a.ctx.db, "SELECT veredicto, motivo FROM detecciones WHERE id = ?", id)[0];

// --- datos mal formados ------------------------------------------------------------------

test("una detección con marca numérica, captura numérica o nula no deja al motor sin conexión", async () => {
  const a = armar();
  await publicarYProcesar(a, deteccion({ id: "D-1", minuto: 2 }));
  await aprobarMedida(a.ctx, "M-0001", "jueza-a");

  a.sim.publicar(deteccion({ id: "D-2", minuto: 3, marca_de_agua_extraida: 12345 as any }));
  a.sim.publicar(deteccion({ id: "D-3", minuto: 3, host_stream: "s9.otro.test", ip_servidor: "203.0.113.9", marca_de_agua_extraida: "TX26-OFI-S000555", captura: { contenido_b64: 987 as any } }));
  a.sim.publicarCrudo(null, 3);
  a.sim.publicarCrudo(42, 3);
  a.sim.publicar(deteccion({ id: "D-4", minuto: 3, host_stream: "s4.otro.test", ip_servidor: "203.0.113.44", marca_de_agua_extraida: "TX26-OFI-S000444" }));
  a.sim.avanzar(3);
  await a.motor.tick();

  assert.equal(a.ctx.estado.conectado, true, a.ctx.estado.ultimo_error ?? "");
  assert.equal(veredictoDe(a, "D-2")!.veredicto, "invalida");
  // Una captura ilegible no impide la medida: queda la advertencia para el juez.
  assert.equal(veredictoDe(a, "D-3")!.veredicto, "pirata");
  assert.equal(filas(a.ctx.db, "SELECT * FROM detecciones WHERE veredicto = 'invalida' AND id LIKE 'SIN-ID-%'").length, 2);
  assert.equal(veredictoDe(a, "D-4")!.veredicto, "pirata");
  // Y las órdenes se siguen.
  assert.ok(filas<{ estado: string }>(a.ctx.db, "SELECT estado FROM ordenes").every((o) => o.estado === "aplicada"));

  // Un ciclo más no repite ni se traba.
  await a.motor.tick();
  assert.equal(a.ctx.estado.conectado, true);
});

test("un error interno en un paso del ciclo no frena los demás ni corta la conexión", async () => {
  const a = armar();
  a.motor.agregarPaso(async () => {
    throw new TypeError("Cannot read properties of undefined (reading 'x')");
  }, "un paso de prueba");
  await publicarYProcesar(a, deteccion({ id: "D-1", minuto: 2 }));
  await aprobarMedida(a.ctx, "M-0001", "jueza-a");
  a.sim.avanzar(3);
  await a.motor.tick();
  await a.motor.tick();
  assert.equal(a.ctx.estado.conectado, true);
  assert.ok(filas<{ estado: string }>(a.ctx.db, "SELECT estado FROM ordenes").every((o) => o.estado === "aplicada"));
  assert.equal(a.ctx.estado.alertas.filter((x) => /un paso de prueba/.test(x)).length, 1);
  assert.equal(eventos(a.ctx.db, "error_interno").length, 1);
});

test("un corte de red en un paso no impide seguir las órdenes en los demás", async () => {
  const a = armar();
  await publicarYProcesar(a, deteccion({ id: "D-1", minuto: 2 }));
  await aprobarMedida(a.ctx, "M-0001", "jueza-a");
  const original = a.sim.detecciones.bind(a.sim);
  a.sim.detecciones = async () => {
    throw new (await import("../src/server/simulador.ts")).ErrorDeRed("fetch failed: ECONNRESET");
  };
  a.sim.avanzar(3);
  await a.motor.tick();
  assert.equal(a.ctx.estado.conectado, false);
  assert.ok(filas<{ estado: string }>(a.ctx.db, "SELECT estado FROM ordenes").every((o) => o.estado === "aplicada"));
  a.sim.detecciones = original;
  await a.motor.tick();
  assert.equal(a.ctx.estado.conectado, true);
});

test("un reclamo mal formado no frena a los siguientes", async () => {
  const a = armar({ simulacro: true });
  instalarReclamos(a.motor);
  await publicarYProcesar(
    a,
    deteccion({ id: "D-1", minuto: 6, host_stream: "vivo.gol.test", ip_servidor: "198.51.100.20", asn: 64610, marca_de_agua_extraida: "TX26-OFI-S000222" }),
  );
  await aprobarMedida(a.ctx, "M-0001", "jueza-a");
  a.sim.avanzar(7);
  await a.motor.tick();
  a.sim.emitirReclamo(null as any);
  a.sim.emitirReclamo({ id: "R-001", minuto: 7.5, dominio: 5 as any, proveedor: "grande", mensaje: "?" });
  a.sim.emitirReclamo({ id: "R-002", minuto: 7.6, dominio: "panaderia.test", proveedor: "grande", mensaje: "No carga." });
  a.sim.avanzar(8);
  await a.motor.tick();
  assert.equal(a.ctx.estado.conectado, true);
  const reclamos = filas<{ id: string; estado: string }>(a.ctx.db, "SELECT id, estado FROM reclamos ORDER BY id");
  assert.deepEqual(
    reclamos.map((r) => [r.id, r.estado]),
    [
      ["R-001", "no_verificado"],
      ["R-002", "verificado"],
    ],
  );
});

// --- reinicio del simulador ----------------------------------------------------------------

async function partidoEnCurso(dbRuta?: string) {
  const m = montarApi(dbRuta ? { dbRuta } : {});
  await publicarYProcesar(m, deteccion({ id: "D-1", minuto: 30 }));
  await aprobarMedida(m.ctx, "M-0001", "jueza-a");
  m.sim.avanzar(31);
  await m.motor.tick();
  const token = await m.ingresar("a", "clave-de-a");
  return { m, token };
}

test("si el reloj del simulador vuelve atrás, Offside archiva la base, empieza limpio y lo dice fuerte", async () => {
  const carpeta = mkdtempSync(join(tmpdir(), "offside-reinicio-"));
  const ruta = join(carpeta, "offside.db");
  const { m, token } = await partidoEnCurso(ruta);
  const vieja = m.ctx.db;

  // El simulador se reinició: mismo partido, reloj en el minuto 2, y vuelve a publicar D-1.
  m.sim.reiniciar(2);
  await m.motor.tick();
  await m.motor.tick();
  m.sim.avanzar(30);
  await m.motor.tick();

  assert.notEqual(m.ctx.db, vieja);
  assert.ok(readdirSync(carpeta).some((n) => /^offside\.db\.reinicio-.+$/.test(n) && !n.endsWith("-wal") && !n.endsWith("-shm")));
  assert.ok(existsSync(ruta));
  // La base nueva arranca con el reinicio registrado y vuelve a ingerir D-1, que ya no se descarta.
  assert.equal(eventos(m.ctx.db, "simulador_reiniciado").length, 1);
  assert.equal(eventos(m.ctx.db, "base_reiniciada").length, 1);
  assert.equal(filas(m.ctx.db, "SELECT * FROM detecciones WHERE id = 'D-1'").length, 1);
  assert.equal(filas<{ estado: string }>(m.ctx.db, "SELECT estado FROM medidas")[0]!.estado, "pendiente");
  // Los jueces vuelven a ingresar.
  assert.equal((await m.pedir("/api/juez/cola", { token })).estado, 401);
  assert.ok(m.consola.some((l) => /SIMULADOR REINICIADO/.test(l)));
  assert.ok(m.ctx.estado.alertas.some((x) => /reinici/.test(x)));
  assert.equal(m.ctx.estado.conectado, true);
});

test("si cambia el partido del simulador, Offside empieza una base nueva", async () => {
  const { m } = await partidoEnCurso();
  m.sim.partidoDatos = { ...m.sim.partidoDatos, id: "falso-02", nombre: "Otro partido" };
  await m.motor.tick();
  await m.motor.tick();
  // La base nueva vuelve a ingerir lo que publica el simulador, sin la firma ni las órdenes del partido anterior.
  assert.deepEqual(
    filas<{ estado: string }>(m.ctx.db, "SELECT estado FROM medidas").map((x) => x.estado),
    ["pendiente"],
  );
  assert.equal(filas(m.ctx.db, "SELECT * FROM ordenes").length, 0);
  assert.equal(m.ctx.estado.partido?.id, "falso-02");
  assert.equal(eventos(m.ctx.db, "simulador_reiniciado")[0]!.datos.partido_nuevo, "falso-02");
});

test("si un proveedor deja de conocer nuestras órdenes activas, Offside lo toma como un reinicio", async () => {
  const { m } = await partidoEnCurso();
  m.sim.libro.clear(); // el simulador perdió las órdenes, el reloj sigue igual
  await m.motor.tick();
  assert.equal(filas(m.ctx.db, "SELECT * FROM ordenes").length, 3, "un solo ciclo no alcanza para reiniciar");
  await m.motor.tick();
  assert.equal(filas(m.ctx.db, "SELECT * FROM ordenes").length, 0);
  assert.equal(eventos(m.ctx.db, "simulador_reiniciado").length, 1);
});
