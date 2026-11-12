import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { type Server, createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, test } from "node:test";
import { cargarConfig, cargarJueces } from "../src/server/config.ts";
import { SimuladorHttp } from "../src/server/simulador.ts";

let servidor: Server;
let base = "";
const recibidas: { ruta: string; cuerpo: any }[] = [];

before(async () => {
  servidor = createServer((req, res) => {
    const url = new URL(req.url ?? "/", "http://x");
    const responder = (estado: number, datos: unknown) => {
      res.writeHead(estado, { "Content-Type": "application/json; charset=utf-8" });
      res.end(JSON.stringify(datos));
    };
    let texto = "";
    req.on("data", (c) => (texto += c));
    req.on("end", () => {
      const cuerpo = texto ? JSON.parse(texto) : null;
      if (req.method === "POST") recibidas.push({ ruta: url.pathname, cuerpo });
      const ruta = url.pathname;
      if (ruta === "/estado") {
        return responder(200, { partido: "p", minuto_actual: 12.5, fin_min: 105, finalizado: false, acelerar: 6, jueces_de_turno: ["j1"] });
      }
      if (ruta === "/dns-pasivo" && url.searchParams.get("ip") === "203.0.113.5") {
        return responder(200, { ip: "203.0.113.5", asn: 64600, organizacion: "Org", dominios: ["a.test"] });
      }
      if (ruta === "/dns-pasivo" && url.searchParams.get("dominio") === "a.test") {
        return responder(200, { dominio: "a.test", ips: [{ ip: "203.0.113.5", asn: 64600, organizacion: "Org" }] });
      }
      if (ruta === "/dns-pasivo") return responder(404, { error: "Sin registros" });
      if (ruta === "/detecciones") {
        return responder(200, { minuto_actual: 12.5, detecciones: [{ id: `desde:${url.searchParams.get("desde")}` }] });
      }
      if (ruta === "/reclamos") return responder(200, { minuto_actual: 12.5, reclamos: [] });
      if (ruta === "/proveedores") {
        return responder(200, [{ id: "p1", nombre: "Uno", tamano: "chico", clientes: 5, capacidades: ["dominio"], ordenes: "/x" }]);
      }
      if (ruta === "/proveedores/p1/ordenes" && req.method === "POST") {
        return cuerpo.orden_id === "repetida"
          ? responder(409, { error: "Ya existe una orden con ese orden_id en este proveedor" })
          : responder(202, { orden_id: cuerpo.orden_id, estado: "recibida" });
      }
      if (ruta === "/proveedores/p2/ordenes" && req.method === "POST") {
        return responder(422, { error: "No aplica bloqueos por ip" });
      }
      if (ruta === "/proveedores/p1/ordenes") {
        return responder(200, [{ orden_id: "o1", estado: "aplicada", recibida_min: 1, aplicada_min: 1.5, tipo: "ip" }]);
      }
      if (ruta === "/proveedores/p1/ordenes/o1/levantar") return responder(200, { orden_id: "o1", estado: "levantada" });
      if (ruta === "/proveedores/p1/ordenes/o2/levantar") return responder(409, { error: "La orden ya no está activa" });
      responder(404, { error: "Ruta inexistente" });
    });
  });
  await new Promise<void>((ok) => servidor.listen(0, "127.0.0.1", ok));
  base = `http://127.0.0.1:${(servidor.address() as AddressInfo).port}`;
});

after(() => {
  servidor.close();
});

const orden = {
  orden_id: "o1",
  expediente_id: "EXP-1",
  tipo: "dominio" as const,
  objetivo: "a.test",
  vence_min: 105,
  juzgado_id: "jg",
  juez_id: "j1",
  firma: "ff",
};

test("el cliente lee el estado del simulador", async () => {
  const sim = new SimuladorHttp(base);
  const e = await sim.estado();
  assert.equal(e.minuto_actual, 12.5);
  assert.deepEqual(e.jueces_de_turno, ["j1"]);
});

test("el DNS pasivo sin registros se traduce en null, no en un error", async () => {
  const sim = new SimuladorHttp(base);
  assert.equal(await sim.dnsIp("198.51.100.1"), null);
  assert.equal(await sim.dnsDominio("nadie.test"), null);
  assert.deepEqual((await sim.dnsIp("203.0.113.5"))!.dominios, ["a.test"]);
  assert.equal((await sim.dnsDominio("a.test"))!.ips[0]!.ip, "203.0.113.5");
});

test("el cursor de detecciones viaja en la consulta", async () => {
  const sim = new SimuladorHttp(base);
  const lote = await sim.detecciones(7.25);
  assert.equal(lote.detecciones[0]!.id, "desde:7.25");
});

test("una orden aceptada devuelve ok y manda el cuerpo completo", async () => {
  const sim = new SimuladorHttp(`${base}/`);
  assert.deepEqual(await sim.enviarOrden("p1", orden), { ok: true });
  const ultima = recibidas[recibidas.length - 1]!;
  assert.equal(ultima.ruta, "/proveedores/p1/ordenes");
  assert.deepEqual(ultima.cuerpo, orden);
});

test("un rechazo del proveedor devuelve el estado HTTP y el mensaje", async () => {
  const sim = new SimuladorHttp(base);
  assert.deepEqual(await sim.enviarOrden("p1", { ...orden, orden_id: "repetida" }), {
    ok: false,
    estado: 409,
    error: "Ya existe una orden con ese orden_id en este proveedor",
  });
  assert.deepEqual(await sim.enviarOrden("p2", orden), { ok: false, estado: 422, error: "No aplica bloqueos por ip" });
});

test("el cliente lista órdenes y proveedores con sus campos", async () => {
  const sim = new SimuladorHttp(base);
  assert.deepEqual((await sim.ordenes("p1"))[0], { orden_id: "o1", estado: "aplicada", recibida_min: 1, aplicada_min: 1.5, finalizada_min: undefined, motivo: undefined });
  assert.deepEqual(await sim.proveedores(), [{ id: "p1", nombre: "Uno", tamano: "chico", clientes: 5, capacidades: ["dominio"] }]);
});

test("levantar devuelve ok o el motivo del rechazo", async () => {
  const sim = new SimuladorHttp(base);
  const cuerpo = { juez_id: "j1", firma: "ff", motivo: "Reclamo R-001" };
  assert.deepEqual(await sim.levantar("p1", "o1", cuerpo), { ok: true });
  assert.deepEqual(await sim.levantar("p1", "o2", cuerpo), { ok: false, estado: 409, error: "La orden ya no está activa" });
});

test("si el simulador no está, el cliente lanza para que el motor lo trate como corte", async () => {
  const sim = new SimuladorHttp("http://127.0.0.1:9", 300);
  await assert.rejects(() => sim.estado());
  await assert.rejects(() => sim.enviarOrden("p1", orden));
});

// --- configuración ---------------------------------------------------------------------

test("cargarConfig usa valores por defecto y respeta las variables de entorno", () => {
  const porDefecto = cargarConfig({}, []);
  assert.equal(porDefecto.simuladorUrl, "http://localhost:8080");
  assert.equal(porDefecto.puerto, 3000);
  assert.equal(porDefecto.host, "0.0.0.0");
  assert.equal(porDefecto.simulacro, false);
  // Un proveedor que falla no se abandona por el resto del partido.
  assert.ok(porDefecto.maxIntentos >= 100);

  const c = cargarConfig(
    {
      SIMULADOR_URL: "http://10.0.0.5:9000/",
      PUERTO: "4000",
      OFFSIDE_HOST: "127.0.0.1",
      OFFSIDE_DB: "otra.db",
      OFFSIDE_INTERVALO_MS: "150",
    },
    [],
  );
  assert.equal(c.simuladorUrl, "http://10.0.0.5:9000");
  assert.equal(c.puerto, 4000);
  assert.equal(c.host, "127.0.0.1");
  assert.equal(c.dbRuta, "otra.db");
  assert.equal(c.intervaloMs, 150);
});

test("el simulacro solo se activa con la bandera --simulacro, nunca por una variable de entorno", () => {
  assert.equal(cargarConfig({ OFFSIDE_SIMULACRO: "1" }, []).simulacro, false);
  assert.equal(cargarConfig({ OFFSIDE_SIMULACRO: "true" }, ["node", "index.ts"]).simulacro, false);
  assert.equal(cargarConfig({}, ["node", "index.ts", "--simulacro"]).simulacro, true);
});

test("cargarJueces lee jueces y operadores y exige las claves de firma", () => {
  const carpeta = mkdtempSync(join(tmpdir(), "offside-"));
  const ruta = join(carpeta, "jueces.json");
  writeFileSync(
    ruta,
    JSON.stringify({
      jueces: [{ id: "j1", nombre: "J", juzgado_id: "jg", juzgado_nombre: "Juzgado", clave_firma_demo: "k", usuario: "j", contrasena: "c" }],
      operadores: [{ usuario: "f", contrasena: "c", nombre: "Fiscalía", rol: "fiscalia" }],
    }),
  );
  const { jueces, operadores } = cargarJueces(ruta);
  assert.equal(jueces[0]!.id, "j1");
  assert.equal(operadores[0]!.rol, "fiscalia");

  writeFileSync(ruta, JSON.stringify({ jueces: [{ id: "j1", nombre: "J" }], operadores: [] }));
  assert.throws(() => cargarJueces(ruta), /clave_firma_demo/);
});
