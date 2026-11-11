import assert from "node:assert/strict";
import { test } from "node:test";
import type {
  ColaDTO,
  EstadoDTO,
  ExpedienteDTO,
  RespuestaIngreso,
  TableroDTO,
  TransparenciaDTO,
} from "../src/compartido/tipos.ts";
import { crearApi } from "../src/server/api.ts";
import type { Operador } from "../src/server/contexto.ts";
import { Sesiones } from "../src/server/sesiones.ts";
import { JUECES, armar, deteccion, publicarYProcesar } from "./ayuda.ts";

const OPERADORES: Operador[] = [{ usuario: "fiscal", contrasena: "clave-fiscal", nombre: "Fiscalía", rol: "fiscalia" }];

function montar() {
  const a = armar();
  const sesiones = new Sesiones(a.db, JUECES, OPERADORES);
  const { app } = crearApi(a.ctx, sesiones);
  const pedir = async (ruta: string, opciones: { token?: string; cuerpo?: unknown; metodo?: string } = {}) => {
    const r = await app.request(ruta, {
      method: opciones.metodo ?? (opciones.cuerpo === undefined ? "GET" : "POST"),
      headers: {
        ...(opciones.token ? { Authorization: `Bearer ${opciones.token}` } : {}),
        ...(opciones.cuerpo === undefined ? {} : { "Content-Type": "application/json" }),
      },
      body: opciones.cuerpo === undefined ? undefined : JSON.stringify(opciones.cuerpo),
    });
    const texto = await r.text();
    return { estado: r.status, texto, datos: texto ? JSON.parse(texto) : null };
  };
  const ingresar = async (usuario: string, contrasena: string) =>
    ((await pedir("/api/ingreso", { cuerpo: { usuario, contrasena } })).datos as RespuestaIngreso).token;
  return { ...a, pedir, ingresar };
}

const cdn = () =>
  deteccion({
    id: "D-4",
    minuto: 6,
    host_stream: "vivo.gol.test",
    ip_servidor: "198.51.100.20",
    asn: 64610,
    marca_de_agua_extraida: "TX26-OFI-S000222",
  });

test("el ingreso rechaza una contraseña mala y entrega token con una buena", async () => {
  const m = montar();
  assert.equal((await m.pedir("/api/ingreso", { cuerpo: { usuario: "a", contrasena: "mala" } })).estado, 401);
  assert.equal((await m.pedir("/api/ingreso", { cuerpo: { usuario: "nadie", contrasena: "x" } })).estado, 401);
  const r = await m.pedir("/api/ingreso", { cuerpo: { usuario: "a", contrasena: "clave-de-a" } });
  assert.equal(r.estado, 200);
  assert.equal(r.datos.usuario.rol, "juez");
  assert.equal(r.datos.usuario.juez_id, "jueza-a");
  assert.match(r.datos.token, /^[0-9a-f]{64}$/);
});

test("la cola del juez exige sesión de juez", async () => {
  const m = montar();
  assert.equal((await m.pedir("/api/juez/cola")).estado, 401);
  assert.equal((await m.pedir("/api/juez/cola", { token: "inventado" })).estado, 401);
  const fiscal = await m.ingresar("fiscal", "clave-fiscal");
  assert.equal((await m.pedir("/api/juez/cola", { token: fiscal })).estado, 403);
});

test("el juez de turno ve la medida pendiente con cuatro verificaciones y el plan por proveedor", async () => {
  const m = montar();
  await publicarYProcesar(m, deteccion({ id: "D-1", minuto: 2 }));
  const token = await m.ingresar("a", "clave-de-a");
  const cola = (await m.pedir("/api/juez/cola", { token })).datos as ColaDTO;

  assert.equal(cola.yo.de_turno, true);
  assert.equal(cola.pendientes.length, 1);
  const medida = cola.pendientes[0]!;
  assert.equal(medida.clase, "inicial");
  assert.equal(medida.estado, "pendiente");
  assert.deepEqual(
    medida.verificaciones.map((v) => v.clave),
    ["senal", "licenciatario", "servidor", "colateral"],
  );
  assert.ok(medida.verificaciones.every((v) => v.luz === "verde"));
  assert.equal(medida.tipo_recomendado, "ip");
  assert.equal(medida.plan.length, 3);
  assert.equal(medida.plan[0]!.proveedor_nombre, "Grande");
  assert.equal(medida.plan[1]!.tipo, "dominio");
  assert.equal(medida.evidencia[0]!.deteccion_id, "D-1");
  assert.equal(medida.promocion[0]!.red, "x");
  assert.match(medida.huella, /^[0-9a-f]{64}$/);
  assert.ok(medida.pedido.length > 0);
});

test("una IP compartida muestra los terceros y propone dominio", async () => {
  const m = montar();
  await publicarYProcesar(m, cdn());
  const token = await m.ingresar("a", "clave-de-a");
  const medida = ((await m.pedir("/api/juez/cola", { token })).datos as ColaDTO).pendientes[0]!;
  assert.equal(medida.tipo_recomendado, "dominio");
  assert.deepEqual(medida.terceros, ["panaderia.test", "escuela.test"]);
  assert.equal(medida.verificaciones[3]!.luz, "verde");
  assert.match(medida.verificaciones[3]!.detalle, /2 sitios/);
});

test("el juez fuera de turno ve la cola en solo lectura y no puede firmar", async () => {
  const m = montar();
  await publicarYProcesar(m, deteccion({ id: "D-1", minuto: 2 }));
  const token = await m.ingresar("b", "clave-de-b");
  const cola = (await m.pedir("/api/juez/cola", { token })).datos as ColaDTO;
  assert.equal(cola.yo.de_turno, false);
  assert.equal(cola.pendientes.length, 1);
  const r = await m.pedir(`/api/juez/medidas/${cola.pendientes[0]!.id}/aprobar`, { token, metodo: "POST" });
  assert.equal(r.estado, 403);
  assert.equal(m.sim.recibidas().length, 0);
});

test("aprobar por la API envía las órdenes y un segundo intento responde 409", async () => {
  const m = montar();
  await publicarYProcesar(m, deteccion({ id: "D-1", minuto: 2 }));
  const token = await m.ingresar("a", "clave-de-a");
  const id = ((await m.pedir("/api/juez/cola", { token })).datos as ColaDTO).pendientes[0]!.id;

  const r = await m.pedir(`/api/juez/medidas/${id}/aprobar`, { token, metodo: "POST" });
  assert.equal(r.estado, 200);
  assert.deepEqual(r.datos, { ok: true });
  assert.equal(m.sim.recibidas().length, 3);
  assert.equal((await m.pedir(`/api/juez/medidas/${id}/aprobar`, { token, metodo: "POST" })).estado, 409);

  const cola = (await m.pedir("/api/juez/cola", { token })).datos as ColaDTO;
  assert.equal(cola.pendientes.length, 0);
  assert.equal(cola.recientes[0]!.decision!.resultado, "aprobada");
  assert.equal(cola.recientes[0]!.decision!.juez_nombre, "Dra. A");
  assert.equal(cola.recientes[0]!.ordenes.length, 3);
});

test("rechazar y reconsiderar por la API", async () => {
  const m = montar();
  await publicarYProcesar(m, deteccion({ id: "D-1", minuto: 2 }));
  const token = await m.ingresar("a", "clave-de-a");
  const id = ((await m.pedir("/api/juez/cola", { token })).datos as ColaDTO).pendientes[0]!.id;
  assert.equal((await m.pedir(`/api/juez/medidas/${id}/rechazar`, { token, cuerpo: { motivo: "Falta evidencia" } })).estado, 200);
  let cola = (await m.pedir("/api/juez/cola", { token })).datos as ColaDTO;
  assert.equal(cola.recientes[0]!.decision!.motivo, "Falta evidencia");
  assert.equal((await m.pedir(`/api/juez/medidas/${id}/reconsiderar`, { token, metodo: "POST" })).estado, 200);
  cola = (await m.pedir("/api/juez/cola", { token })).datos as ColaDTO;
  assert.equal(cola.pendientes.length, 1);
  assert.equal((await m.pedir("/api/juez/medidas/M-9999/aprobar", { token, metodo: "POST" })).estado, 404);
});

test("el estado es público y nombra al juez de turno", async () => {
  const m = montar();
  await m.motor.tick();
  const e = (await m.pedir("/api/estado")).datos as EstadoDTO;
  assert.equal(e.conectado, true);
  assert.equal(e.partido!.nombre, "Partido de prueba");
  assert.deepEqual(e.jueces_de_turno, [{ id: "jueza-a", nombre: "Dra. A", juzgado_nombre: "Juzgado 1" }]);
});

test("el tablero resume expedientes, proveedores, archivadas y daño evitado", async () => {
  const m = montar();
  await publicarYProcesar(m, deteccion({ id: "D-1", minuto: 2 }));
  await publicarYProcesar(
    m,
    deteccion({ id: "D-5", minuto: 4, host_stream: "canalsur.test", ip_servidor: "192.0.2.10", asn: 64640, marca_de_agua_extraida: "TX26-LIC-SUR" }),
  );
  await publicarYProcesar(m, cdn());
  assert.equal((await m.pedir("/api/tablero")).estado, 401);
  const juez = await m.ingresar("a", "clave-de-a");
  const cola = (await m.pedir("/api/juez/cola", { token: juez })).datos as ColaDTO;
  const primera = cola.pendientes.find((p) => p.servidor!.host === "s1.pelota.test")!;
  await m.pedir(`/api/juez/medidas/${primera.id}/aprobar`, { token: juez, metodo: "POST" });
  m.sim.avanzar(7);
  await m.motor.tick();

  const fiscal = await m.ingresar("fiscal", "clave-fiscal");
  const t = (await m.pedir("/api/tablero", { token: fiscal })).datos as TableroDTO;
  assert.equal(t.metricas.expedientes, 2);
  assert.equal(t.metricas.medidas_pendientes, 1);
  assert.equal(t.metricas.archivadas, 1);
  assert.deepEqual(t.metricas.dano_evitado.sitios, ["panaderia.test", "escuela.test"]);
  assert.deepEqual(t.metricas.dano_evitado.senales_legitimas, ["canalsur.test"]);
  assert.equal(t.proveedores.length, 3);
  assert.equal(t.archivadas[0]!.veredicto, "licenciatario_autorizado");

  const exp = t.expedientes.find((e) => e.marca === "TX26-OFI-S000111")!;
  assert.equal(exp.estado, "activo");
  const servidor = exp.servidores[0]!;
  assert.equal(servidor.medida_estado, "aprobada");
  assert.deepEqual(
    servidor.por_proveedor.map((c) => c.estado),
    ["aplicada", "aplicada", "aplicada"],
  );
  assert.equal(servidor.cobertura_pct, 100);
  // Detectado en el minuto 2, firmado en el 6 (cuando la jueza abrió la cola) y aplicado medio minuto después.
  assert.equal(servidor.primer_bloqueo_min, 4.5);
  assert.equal(t.metricas.tiempo_medio_primer_bloqueo_min, 4.5);
  assert.ok(t.auditoria.entradas > 0);
  assert.match(t.auditoria.cabecera, /^[0-9a-f]{64}$/);
  assert.ok(t.auditoria.ultimas[0]!.resumen.length > 0);
});

test("el expediente trae medidas, detecciones, órdenes y el aviso al titular", async () => {
  const m = montar();
  await publicarYProcesar(m, deteccion({ id: "D-1", minuto: 2 }));
  const token = await m.ingresar("a", "clave-de-a");
  const id = ((await m.pedir("/api/juez/cola", { token })).datos as ColaDTO).pendientes[0]!.id;
  await m.pedir(`/api/juez/medidas/${id}/aprobar`, { token, metodo: "POST" });

  const e = (await m.pedir("/api/expedientes/EXP-2026-000001", { token })).datos as ExpedienteDTO;
  assert.equal(e.marca, "TX26-OFI-S000111");
  assert.equal(e.medidas.length, 1);
  assert.equal(e.medidas[0]!.ordenes.length, 3);
  assert.equal(e.detecciones[0]!.id, "D-1");
  assert.match(e.aviso_titular, /TX26-OFI-S000111/);
  assert.ok(e.auditoria.length >= 3);
  assert.equal((await m.pedir("/api/expedientes/EXP-2026-999999", { token })).estado, 404);
  assert.equal((await m.pedir("/api/expedientes/EXP-2026-000001")).estado, 401);
});

test("la transparencia es pública, lista los bloqueos y no expone secretos", async () => {
  const m = montar();
  await publicarYProcesar(m, deteccion({ id: "D-1", minuto: 2 }));
  const token = await m.ingresar("a", "clave-de-a");
  const id = ((await m.pedir("/api/juez/cola", { token })).datos as ColaDTO).pendientes[0]!.id;
  await m.pedir(`/api/juez/medidas/${id}/aprobar`, { token, metodo: "POST" });
  m.sim.avanzar(3);
  await m.motor.tick();

  const r = await m.pedir("/api/transparencia");
  assert.equal(r.estado, 200);
  const t = r.datos as TransparenciaDTO;
  const porIp = t.bloqueos.find((b) => b.tipo === "ip")!;
  assert.equal(porIp.objetivo, "203.0.113.5");
  assert.equal(porIp.estado, "vigente");
  assert.equal(porIp.hasta_min, 105);
  assert.equal(porIp.juez, "Dra. A");
  assert.equal(porIp.proveedores_confirmados, 2);
  for (const secreto of ["clave-a", "clave-b", "clave-de-a", "clave-fiscal", token]) {
    assert.equal(r.texto.includes(secreto), false, `la transparencia expone ${secreto}`);
  }
});

test("ninguna respuesta autenticada expone claves de firma ni contraseñas", async () => {
  const m = montar();
  await publicarYProcesar(m, deteccion({ id: "D-1", minuto: 2 }));
  const token = await m.ingresar("a", "clave-de-a");
  const id = ((await m.pedir("/api/juez/cola", { token })).datos as ColaDTO).pendientes[0]!.id;
  await m.pedir(`/api/juez/medidas/${id}/aprobar`, { token, metodo: "POST" });
  for (const ruta of ["/api/juez/cola", "/api/tablero", "/api/expedientes/EXP-2026-000001", "/api/yo", "/api/estado"]) {
    const r = await m.pedir(ruta, { token });
    assert.equal(r.estado, 200, ruta);
    for (const secreto of ["clave-a", "clave-b", "clave-de-a", "clave-de-b", "clave-fiscal"]) {
      assert.equal(r.texto.includes(secreto), false, `${ruta} expone ${secreto}`);
    }
  }
});

test("salir invalida el token", async () => {
  const m = montar();
  const token = await m.ingresar("a", "clave-de-a");
  assert.equal((await m.pedir("/api/yo", { token })).estado, 200);
  assert.equal((await m.pedir("/api/salida", { token, metodo: "POST" })).estado, 200);
  assert.equal((await m.pedir("/api/yo", { token })).estado, 401);
});

test("una sesión sobrevive a un reinicio del servidor", async () => {
  const m = montar();
  const token = await m.ingresar("a", "clave-de-a");
  const otras = new Sesiones(m.db, JUECES, OPERADORES);
  assert.equal(otras.porToken(token)?.usuario, "a");
});

test("una ruta de la API que no existe responde 404 en JSON", async () => {
  const m = montar();
  const r = await m.pedir("/api/no-existe");
  assert.equal(r.estado, 404);
  assert.ok(r.datos.error);
});
