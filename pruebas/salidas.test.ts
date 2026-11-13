import assert from "node:assert/strict";
import { test } from "node:test";
import { aprobarMedida } from "../src/server/decisiones.ts";
import { expedienteDTO } from "../src/server/vistas.ts";
import { armar, deteccion, filas, publicarYProcesar } from "./ayuda.ts";

const primeraMedida = (a: ReturnType<typeof armar>) => filas<{ id: string }>(a.db, "SELECT id FROM medidas ORDER BY n")[0]!.id;

test("un servidor dedicado en el exterior: titular, aviso de abuso y la plataforma donde se promocionó", async () => {
  const a = armar();
  await publicarYProcesar(a, deteccion({ id: "D-1", minuto: 2 }));
  let e = expedienteDTO(a.ctx, "EXP-2026-000001")!;
  assert.deepEqual(
    e.salidas.map((s) => s.tipo),
    ["titular", "hosting", "plataforma"],
  );
  const [titular, abuso, plataforma] = e.salidas;
  // El titular es quien emitió la señal: su aviso no espera la firma.
  assert.equal(titular!.estado, "lista");
  assert.match(titular!.texto, /TX26-OFI-S000111/);
  // Bruma Hosting cae en Ámsterdam (ubicación simulada): no hay baja local, hay aviso de abuso.
  assert.match(abuso!.destinatario, /Países Bajos/);
  assert.match(abuso!.texto, /cooperación internacional/);
  assert.equal(abuso!.estado, "espera_firma");
  assert.equal(plataforma!.destinatario, "Plataforma: X");
  assert.match(plataforma!.texto, /https:\/\/x\.example\/pelota\/status\/1/);
  assert.equal(plataforma!.estado, "espera_firma");

  await aprobarMedida(a.ctx, primeraMedida(a), "jueza-a");
  e = expedienteDTO(a.ctx, "EXP-2026-000001")!;
  const medida = e.medidas[0]!;
  const familia = medida.ordenes[0]!.orden_id.split("-").slice(0, 3).join("-");
  for (const s of e.salidas.slice(1)) {
    assert.equal(s.estado, "lista", s.id);
    assert.match(s.fundamento ?? "", /Dra\. A/);
    assert.ok(s.fundamento?.includes(`medida ${medida.id}`), `${s.id} cita la medida`);
    assert.ok(s.fundamento?.includes(`${familia}-…`), `${s.id} cita las órdenes ${familia}`);
  }
  assert.ok(e.salidas[1]!.texto.includes(e.medidas[0]!.huella), "el aviso lleva la huella de lo que vio el juez");
});

test("detrás de una CDN: el pedido va a la CDN, con el bloqueo en el borde y el origen", async () => {
  const a = armar();
  await publicarYProcesar(
    a,
    deteccion({ id: "D-1", minuto: 2, host_stream: "vivo.gol.test", ip_servidor: "198.51.100.20", asn: 64610, promocion: [] }),
  );
  await aprobarMedida(a.ctx, primeraMedida(a), "jueza-a");
  const e = expedienteDTO(a.ctx, "EXP-2026-000001")!;
  const cdn = e.salidas.find((s) => s.tipo === "cdn")!;
  assert.match(cdn.destinatario, /NubeRápida CDN \(AS64610\)/);
  assert.match(cdn.texto, /borde, para Argentina/);
  assert.match(cdn.texto, /servidor de origen/);
  assert.match(cdn.texto, /bloquean el dominio y no la IP/);
  assert.equal(cdn.estado, "lista");
  // Ni baja ni aviso de abuso a la CDN como si fuera un hosting común.
  assert.equal(e.salidas.filter((s) => s.tipo === "hosting").length, 0);
});

test("un servidor rechazado por el juez no tiene pedidos listos, salvo el aviso al titular", async () => {
  const a = armar();
  await publicarYProcesar(a, deteccion({ id: "D-1", minuto: 2 }));
  const { rechazarMedida } = await import("../src/server/decisiones.ts");
  await rechazarMedida(a.ctx, primeraMedida(a), "jueza-a", "Prueba");
  const e = expedienteDTO(a.ctx, "EXP-2026-000001")!;
  assert.equal(e.salidas[0]!.estado, "lista");
  assert.ok(e.salidas.slice(1).every((s) => s.estado === "sin_orden"));
});
