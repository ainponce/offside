import assert from "node:assert/strict";
import { test } from "node:test";
import { dominioRegistrable, esMismoOSubdominio } from "../src/server/dominio.ts";
import { claveExpediente, evaluarRiesgo, planPorProveedor, veredicto } from "../src/server/reglas.ts";
import type { Deteccion, DnsIp, Partido, Proveedor } from "../src/server/simulador.ts";

const TERMINOS = ["cdn", "compartido", "shared", "cloud"];

const partido: Partido = {
  id: "prueba-01",
  nombre: "Partido de prueba",
  fin_min: 105,
  marcas_de_agua_validas: [
    { prefijo: "TX26-OFI", origen: "Señal oficial" },
    { prefijo: "TX26-LIC-SUR", origen: "Licenciatario Canal Sur" },
  ],
  licenciatarios: [
    { nombre: "Canal Sur", prefijo_marca: "TX26-LIC-SUR", dominios_autorizados: ["canalsur.test"] },
  ],
};

function det(parcial: Partial<Deteccion>): Deteccion {
  return {
    id: "D-1",
    minuto: 3,
    host_stream: "s1.pelota.test",
    ip_servidor: "203.0.113.5",
    asn: 64600,
    marca_de_agua_extraida: "TX26-OFI-S000111",
    ...parcial,
  };
}

function dns(dominios: string[], organizacion = "Bruma Hosting Dedicado", asn = 64600): DnsIp {
  return { ip: "203.0.113.5", asn, organizacion, dominios };
}

const dnsHost = { dominio: "s1.pelota.test", ips: [{ ip: "203.0.113.5", asn: 64600, organizacion: "x" }] };

// --- dominio ---------------------------------------------------------------

test("dominioRegistrable toma las dos últimas etiquetas", () => {
  assert.equal(dominioRegistrable("s1.pelota.test"), "pelota.test");
  assert.equal(dominioRegistrable("pelota.test"), "pelota.test");
});

test("dominioRegistrable reconoce sufijos de dos niveles", () => {
  assert.equal(dominioRegistrable("a.b.com.ar"), "b.com.ar");
});

test("dominioRegistrable ignora mayúsculas y punto final", () => {
  assert.equal(dominioRegistrable("S1.Pelota.TEST."), "pelota.test");
});

test("esMismoOSubdominio acepta el dominio y sus subdominios, no los parecidos", () => {
  assert.equal(esMismoOSubdominio("canalsur.test", "canalsur.test"), true);
  assert.equal(esMismoOSubdominio("vivo.canalsur.test", "canalsur.test"), true);
  assert.equal(esMismoOSubdominio("micanalsur.test", "canalsur.test"), false);
  assert.equal(esMismoOSubdominio("canalsur.test.pirata.test", "canalsur.test"), false);
});

// --- veredicto ---------------------------------------------------------------

test("sin marca no es la señal del partido", () => {
  assert.equal(veredicto(det({ marca_de_agua_extraida: null }), partido).clase, "no_es_la_senal");
  assert.equal(veredicto(det({ marca_de_agua_extraida: "" }), partido).clase, "no_es_la_senal");
  assert.equal(veredicto(det({ marca_de_agua_extraida: undefined }), partido).clase, "no_es_la_senal");
});

test("marca de otro evento no es la señal del partido", () => {
  assert.equal(veredicto(det({ marca_de_agua_extraida: "TX25-F03-OFI-S1" }), partido).clase, "no_es_la_senal");
});

test("señal oficial en un host ajeno es pirata", () => {
  const v = veredicto(det({}), partido);
  assert.equal(v.clase, "pirata");
  assert.equal(v.prefijo, "TX26-OFI");
});

test("licenciatario en su dominio o subdominio está autorizado", () => {
  const marca = "TX26-LIC-SUR";
  assert.equal(
    veredicto(det({ marca_de_agua_extraida: marca, host_stream: "canalsur.test" }), partido).clase,
    "licenciatario_autorizado",
  );
  assert.equal(
    veredicto(det({ marca_de_agua_extraida: marca, host_stream: "vivo.canalsur.test" }), partido).clase,
    "licenciatario_autorizado",
  );
});

test("señal de licenciatario en un host ajeno es pirata", () => {
  const v = veredicto(det({ marca_de_agua_extraida: "TX26-LIC-SUR", host_stream: "roba.test" }), partido);
  assert.equal(v.clase, "pirata");
  assert.equal(v.prefijo, "TX26-LIC-SUR");
});

test("dominio que solo se parece al del licenciatario es pirata", () => {
  const v = veredicto(
    det({ marca_de_agua_extraida: "TX26-LIC-SUR", host_stream: "canalsur.test.pirata.test" }),
    partido,
  );
  assert.equal(v.clase, "pirata");
});

test("señal oficial en un dominio de licenciatario es una anomalía, nunca pirata", () => {
  assert.equal(veredicto(det({ host_stream: "vivo.canalsur.test" }), partido).clase, "anomalia");
});

test("host de licenciatario sin marca es una anomalía, nunca pirata", () => {
  assert.equal(
    veredicto(det({ marca_de_agua_extraida: null, host_stream: "canalsur.test" }), partido).clase,
    "anomalia",
  );
});

// --- clave del expediente ----------------------------------------------------

test("la clave es la marca completa cuando tiene sufijo propio", () => {
  assert.equal(claveExpediente(det({}), "TX26-OFI"), "TX26-OFI-S000111");
});

test("la clave suma el dominio registrable cuando la marca es solo el prefijo", () => {
  assert.equal(
    claveExpediente(det({ marca_de_agua_extraida: "TX26-LIC-SUR", host_stream: "a.roba.test" }), "TX26-LIC-SUR"),
    "TX26-LIC-SUR@roba.test",
  );
});

// --- riesgo colateral ----------------------------------------------------------

test("IP con un solo host en hosting dedicado se bloquea por IP", () => {
  const r = evaluarRiesgo(det({}), dns(["s1.pelota.test"]), dnsHost, partido, TERMINOS);
  assert.equal(r.tipo_recomendado, "ip");
  assert.deepEqual(r.terceros, []);
});

test("IP con hermanos del mismo dominio registrable se bloquea por IP", () => {
  const r = evaluarRiesgo(det({}), dns(["s1.pelota.test", "respaldo.pelota.test"]), dnsHost, partido, TERMINOS);
  assert.equal(r.tipo_recomendado, "ip");
  assert.deepEqual(r.cotenants, ["respaldo.pelota.test"]);
});

test("IP con un tercero se bloquea por dominio y nombra al tercero", () => {
  const r = evaluarRiesgo(
    det({}),
    dns(["s1.pelota.test", "panaderia.test", "respaldo.pelota.test"]),
    dnsHost,
    partido,
    TERMINOS,
  );
  assert.equal(r.tipo_recomendado, "dominio");
  assert.deepEqual(r.terceros, ["panaderia.test"]);
});

test("organización que parece infraestructura compartida fuerza dominio", () => {
  const r = evaluarRiesgo(det({}), dns(["s1.pelota.test"], "NubeRápida CDN"), dnsHost, partido, TERMINOS);
  assert.equal(r.tipo_recomendado, "dominio");
});

test("sin registros de DNS pasivo para la IP se bloquea por dominio", () => {
  const r = evaluarRiesgo(det({}), null, null, partido, TERMINOS);
  assert.equal(r.tipo_recomendado, "dominio");
  assert.ok(r.advertencias.length > 0);
});

test("si el DNS pasivo no ve el host en esa IP, advierte y bloquea por dominio", () => {
  const r = evaluarRiesgo(det({}), dns(["otro.pelota.test"]), dnsHost, partido, TERMINOS);
  assert.equal(r.tipo_recomendado, "dominio");
  assert.ok(r.advertencias.length > 0);
});

test("ASN informado distinto al del DNS pasivo advierte y bloquea por dominio", () => {
  const r = evaluarRiesgo(det({ asn: 64999 }), dns(["s1.pelota.test"]), dnsHost, partido, TERMINOS);
  assert.equal(r.tipo_recomendado, "dominio");
  assert.ok(r.advertencias.length > 0);
});

test("un dominio de licenciatario en la IP cuenta como tercero", () => {
  const r = evaluarRiesgo(
    det({ host_stream: "x.canalsur.test.pirata.test" }),
    dns(["x.canalsur.test.pirata.test", "canalsur.test"]),
    null,
    partido,
    TERMINOS,
  );
  assert.equal(r.tipo_recomendado, "dominio");
  assert.ok(r.terceros.includes("canalsur.test"));
});

// --- plan por proveedor --------------------------------------------------------

const proveedores: Proveedor[] = [
  { id: "ambos", nombre: "Ambos", clientes: 100, capacidades: ["ip", "dominio"] },
  { id: "solo-dominio", nombre: "Solo dominio", clientes: 10, capacidades: ["dominio"] },
  { id: "solo-ip", nombre: "Solo IP", clientes: 5, capacidades: ["ip"] },
];

test("con recomendación IP, el proveedor solo-dominio recibe el host", () => {
  const riesgo = evaluarRiesgo(det({}), dns(["s1.pelota.test"]), dnsHost, partido, TERMINOS);
  const plan = planPorProveedor(riesgo, det({}), proveedores);
  assert.deepEqual(plan[0], { proveedor_id: "ambos", tipo: "ip", objetivo: "203.0.113.5" });
  assert.deepEqual(plan[1], { proveedor_id: "solo-dominio", tipo: "dominio", objetivo: "s1.pelota.test" });
  assert.deepEqual(plan[2], { proveedor_id: "solo-ip", tipo: "ip", objetivo: "203.0.113.5" });
});

test("con recomendación dominio, el proveedor solo-IP queda sin cobertura", () => {
  const riesgo = evaluarRiesgo(det({}), dns(["s1.pelota.test", "panaderia.test"]), dnsHost, partido, TERMINOS);
  const plan = planPorProveedor(riesgo, det({}), proveedores);
  assert.deepEqual(plan[0], { proveedor_id: "ambos", tipo: "dominio", objetivo: "s1.pelota.test" });
  assert.deepEqual(plan[1], { proveedor_id: "solo-dominio", tipo: "dominio", objetivo: "s1.pelota.test" });
  assert.equal("sin_cobertura" in plan[2], true);
});
