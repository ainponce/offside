// El pirata también puede servir por IPv6. El escenario oficial usa solo IPv4, así que esto se
// prueba aparte: el circuito completo con direcciones de documentación IPv6 (2001:db8::/32).

import assert from "node:assert/strict";
import { test } from "node:test";
import { aprobarMedida } from "../src/server/decisiones.ts";
import { tableroDTO } from "../src/server/vistas.ts";
import { armar, deteccion, filas, publicarYProcesar } from "./ayuda.ts";

const EXCLUSIVA = "2001:db8:5::10";
const COMPARTIDA = "2001:db8:6::20";

function armarConV6() {
  const a = armar();
  a.sim.dns[EXCLUSIVA] = { asn: 64600, organizacion: "Bruma Hosting Dedicado", dominios: ["s6.pelota.test", "s6-respaldo.pelota.test"] };
  a.sim.dns[COMPARTIDA] = {
    asn: 64620,
    organizacion: "Pampa Web Hosting Compartido",
    dominios: ["v6.verpartido.test", "panaderia-v6.test", "escuela-v6.test"],
  };
  return a;
}

test("IPv6 exclusiva: se propone bloqueo por IP y la orden sale, se aplica y vence con la dirección v6", async () => {
  const a = armarConV6();
  await publicarYProcesar(a, deteccion({ id: "D-6", minuto: 2, host_stream: "s6.pelota.test", ip_servidor: EXCLUSIVA }));

  const [m] = filas<{ id: string; plan: string; estado: string }>(a.db, "SELECT * FROM medidas");
  assert.equal(m!.estado, "pendiente");
  const plan = JSON.parse(m!.plan);
  assert.deepEqual(plan[0], { proveedor_id: "grande", tipo: "ip", objetivo: EXCLUSIVA });
  // El proveedor que solo bloquea por dominio recibe el dominio, como con IPv4.
  assert.deepEqual(plan[1], { proveedor_id: "solo-dominio", tipo: "dominio", objetivo: "s6.pelota.test" });

  assert.deepEqual(await aprobarMedida(a.ctx, m!.id, "jueza-a"), { ok: true });
  const ip = a.sim.recibidas("grande")[0]!;
  assert.equal(ip.tipo, "ip");
  assert.equal(ip.objetivo, EXCLUSIVA);

  a.sim.avanzar(3);
  await a.motor.tick();
  assert.ok(filas<{ estado: string }>(a.db, "SELECT estado FROM ordenes").every((o) => o.estado === "aplicada"));
  a.sim.avanzar(106);
  await a.motor.tick();
  assert.ok(filas<{ estado: string }>(a.db, "SELECT estado FROM ordenes").every((o) => o.estado === "vencida"));
});

test("IPv6 compartida: se propone dominio y se nombra a los sitios que habrían caído", async () => {
  const a = armarConV6();
  await publicarYProcesar(a, deteccion({ id: "D-7", minuto: 2, host_stream: "v6.verpartido.test", ip_servidor: COMPARTIDA }));
  const [m] = filas<{ plan: string }>(a.db, "SELECT * FROM medidas");
  const plan = JSON.parse(m!.plan) as { tipo?: string; objetivo?: string }[];
  assert.ok(plan.every((p) => p.tipo !== "ip"), "ninguna orden por IP sobre una IPv6 compartida");
  assert.ok(plan.some((p) => p.tipo === "dominio" && p.objetivo === "v6.verpartido.test"));

  const t = tableroDTO(a.ctx, 0);
  const s = t.expedientes[0]!.servidores[0]!;
  assert.equal(s.ip, COMPARTIDA);
  assert.deepEqual([...s.terceros].sort(), ["escuela-v6.test", "panaderia-v6.test"]);
  // Dirección de documentación: ubicación simulada, como las IPv4 del simulador.
  assert.equal(s.ubicacion?.fuente, "simulada");
});
