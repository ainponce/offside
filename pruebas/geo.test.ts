import assert from "node:assert/strict";
import { test } from "node:test";
import { SITIOS, ubicarServidor } from "../src/server/geo.ts";

test("la misma organización cae siempre en el mismo centro de datos", () => {
  const a = ubicarServidor({ ip: "203.0.113.10", asn: 64999, organizacion: "Hosting Sin Pistas (ficticio)" });
  const b = ubicarServidor({ ip: "203.0.113.77", asn: 64999, organizacion: "Hosting Sin Pistas (ficticio)" });
  assert.deepEqual(a, b);
  assert.equal(a.fuente, "simulada");
});

test("el nombre de la organización ubica la región cuando la sugiere", () => {
  assert.equal(ubicarServidor({ ip: "198.51.100.77", asn: 64630, organizacion: "Servidores Litoral (ficticio)" }).ciudad, "Rosario");
  assert.equal(ubicarServidor({ ip: "192.0.2.50", asn: 64620, organizacion: "Pampa Web Hosting Compartido (ficticio)" }).provincia, "La Pampa");
  assert.equal(ubicarServidor({ ip: "198.51.100.20", asn: 64610, organizacion: "NubeRápida CDN (ficticia)" }).ciudad, "Buenos Aires");
  assert.equal(ubicarServidor({ ip: "192.0.2.10", asn: 64640, organizacion: "Canal Norte TV (ficticio)" }).ciudad, "Salta");
  assert.equal(ubicarServidor({ ip: "10.0.0.1", asn: 1, organizacion: "Datacenter Andino (ficticio)" }).ciudad, "Mendoza");
});

test("sin ASN ni organización, ubica por el bloque /24 de la IP", () => {
  const a = ubicarServidor({ ip: "203.0.113.10", asn: null, organizacion: null });
  const b = ubicarServidor({ ip: "203.0.113.200", asn: null, organizacion: null });
  assert.equal(a.sitio, b.sitio);
});

test("todos los centros de datos están dentro de Argentina continental", () => {
  for (const s of SITIOS) {
    assert.ok(s.lat < -21.7 && s.lat > -55.1, `${s.id}: latitud ${s.lat}`);
    assert.ok(s.lon < -53.6 && s.lon > -73.6, `${s.id}: longitud ${s.lon}`);
  }
  assert.equal(new Set(SITIOS.map((s) => s.id)).size, SITIOS.length);
});
