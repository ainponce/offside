import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { SITIOS_SIMULADOS, cargarGeoIP, claseIp, consultarIp, intermediarioDe, reiniciarGeoIP, ubicarServidor } from "../src/server/geo.ts";

const BASE = fileURLToPath(new URL("../datos/geoip/dbip-city-lite.mmdb", import.meta.url));
const HAY_BASE = existsSync(BASE);

function sinBase(): void {
  reiniciarGeoIP();
  cargarGeoIP("/no/existe.mmdb");
}

test("distingue IPs públicas, de documentación, reservadas e inválidas", () => {
  assert.equal(claseIp("203.0.113.10"), "documentacion");
  assert.equal(claseIp("198.51.100.77"), "documentacion");
  assert.equal(claseIp("192.0.2.50"), "documentacion");
  assert.equal(claseIp("2001:db8::1"), "documentacion");
  assert.equal(claseIp("10.1.2.3"), "reservada");
  assert.equal(claseIp("192.168.0.1"), "reservada");
  assert.equal(claseIp("127.0.0.1"), "reservada");
  assert.equal(claseIp("::1"), "reservada");
  assert.equal(claseIp("8.8.8.8"), "publica");
  assert.equal(claseIp("2a00:1450:4001::1"), "publica");
  assert.equal(claseIp("no-es-ip"), "invalida");
});

test("las IPs del simulador tienen ubicación simulada y siempre la misma", () => {
  const a = ubicarServidor({ ip: "203.0.113.10", asn: 64999, organizacion: "Hosting Sin Pistas (ficticio)" });
  const b = ubicarServidor({ ip: "203.0.113.77", asn: 64999, organizacion: "Hosting Sin Pistas (ficticio)" });
  assert.ok(a && b);
  assert.deepEqual(a, b);
  assert.equal(a.fuente, "simulada");
});

test("la ubicación simulada puede caer en el exterior, y lo dice", () => {
  const bruma = ubicarServidor({ ip: "203.0.113.10", asn: 64600, organizacion: "Bruma Hosting Dedicado (ficticio)" });
  assert.equal(bruma?.pais, "NL");
  assert.equal(bruma?.pais_nombre, "Países Bajos");
  assert.equal(bruma?.en_argentina, false);
  const litoral = ubicarServidor({ ip: "198.51.100.77", asn: 64630, organizacion: "Servidores Litoral (ficticio)" });
  assert.equal(litoral?.ciudad, "Rosario");
  assert.equal(litoral?.en_argentina, true);
  assert.ok(SITIOS_SIMULADOS.some((s) => s.pais !== "AR"));
  assert.equal(new Set(SITIOS_SIMULADOS.map((s) => s.id)).size, SITIOS_SIMULADOS.length);
});

test("una IP privada no tiene ubicación, ni siquiera simulada", () => {
  assert.equal(ubicarServidor({ ip: "10.0.0.5", asn: null, organizacion: null }), null);
});

test("sin base GeoIP, una IP pública queda sin ubicación y se explica por qué", () => {
  sinBase();
  assert.equal(ubicarServidor({ ip: "8.8.8.8", asn: 15169, organizacion: "Google" }), null);
  assert.match(consultarIp("8.8.8.8").motivo ?? "", /pnpm geoip/);
  reiniciarGeoIP();
});

test("con la base de DB-IP, ubica IPs reales en su país", { skip: HAY_BASE ? false : "falta datos/geoip (pnpm geoip)" }, () => {
  reiniciarGeoIP();
  assert.ok(cargarGeoIP(BASE));
  const google = ubicarServidor({ ip: "8.8.8.8", asn: null, organizacion: null });
  assert.equal(google?.pais, "US");
  assert.equal(google?.en_argentina, false);
  assert.equal(google?.fuente, "geoip");
  const local = ubicarServidor({ ip: "181.30.0.1", asn: null, organizacion: null });
  assert.equal(local?.pais, "AR");
  assert.equal(local?.en_argentina, true);
  assert.ok(local && local.lat < -20 && local.lon < -50);
  const v6 = ubicarServidor({ ip: "2a00:1450:4001::1", asn: null, organizacion: null });
  assert.equal(v6?.pais, "DE");
  // Las del simulador siguen simuladas aunque haya base: no existen en internet.
  assert.equal(ubicarServidor({ ip: "203.0.113.10", asn: null, organizacion: null })?.fuente, "simulada");
  reiniciarGeoIP();
});

test("reconoce CDN y proxies inversos por ASN o por nombre, y no a un hosting común", () => {
  assert.match(intermediarioDe({ asn: 13335, organizacion: null }) ?? "", /Cloudflare/);
  assert.match(intermediarioDe({ asn: 64610, organizacion: "NubeRápida CDN (ficticia)" }) ?? "", /NubeRápida CDN es una CDN/);
  assert.match(intermediarioDe({ asn: 64700, organizacion: "Borde Global CDN (ficticio)" }) ?? "", /origen/);
  assert.equal(intermediarioDe({ asn: 64600, organizacion: "Bruma Hosting Dedicado (ficticio)" }), null);
  assert.equal(intermediarioDe({ asn: 64620, organizacion: "Pampa Web Hosting Compartido (ficticio)" }), null);
});
