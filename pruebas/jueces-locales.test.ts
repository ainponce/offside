import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { test } from "node:test";
import { cargarJueces } from "../src/server/config.ts";

const RAIZ = resolve(import.meta.dirname, "..");
const SCRIPT = join(RAIZ, "scripts", "jueces-locales.ts");
const TSX = join(RAIZ, "node_modules", ".bin", "tsx");
const correr = (args: string[]) => spawnSync(TSX, ["--disable-warning=ExperimentalWarning", SCRIPT, ...args], { encoding: "utf8", cwd: RAIZ });

test("jueces-locales copia jueces y claves de firma, sortea contraseñas nuevas y las muestra una vez", () => {
  const carpeta = mkdtempSync(join(tmpdir(), "offside-jueces-"));
  const salida = join(carpeta, "jueces.local.json");
  const r = correr(["--salida", salida]);
  assert.equal(r.status, 0, r.stderr);

  const demo = cargarJueces(join(RAIZ, "config", "jueces.demo.json"));
  const local = cargarJueces(salida);
  assert.deepEqual(
    local.jueces.map((j) => [j.id, j.usuario, j.clave_firma_demo, j.juzgado_id]),
    demo.jueces.map((j) => [j.id, j.usuario, j.clave_firma_demo, j.juzgado_id]),
  );
  for (const [i, j] of local.jueces.entries()) {
    assert.notEqual(j.contrasena, demo.jueces[i]!.contrasena);
    assert.ok(j.contrasena.length >= 16);
    assert.ok(r.stdout.includes(j.contrasena), "la contraseña se muestra al generarla");
  }
  assert.notEqual(local.operadores[0]!.contrasena, demo.operadores[0]!.contrasena);

  // No pisa un archivo existente sin --forzar.
  const otra = correr(["--salida", salida]);
  assert.notEqual(otra.status, 0);
  assert.deepEqual(cargarJueces(salida).jueces.map((j) => j.contrasena), local.jueces.map((j) => j.contrasena));
  assert.equal(correr(["--salida", salida, "--forzar"]).status, 0);
});

test("jueces-locales acepta otro archivo de origen", () => {
  const carpeta = mkdtempSync(join(tmpdir(), "offside-jueces-"));
  const origen = join(carpeta, "final.json");
  const base = JSON.parse(readFileSync(join(RAIZ, "config", "jueces.demo.json"), "utf8"));
  base.jueces[0].clave_firma_demo = "clave-de-la-final";
  writeFileSync(origen, JSON.stringify(base));
  const salida = join(carpeta, "local.json");
  assert.equal(correr(["--desde", origen, "--salida", salida]).status, 0);
  assert.equal(cargarJueces(salida).jueces[0]!.clave_firma_demo, "clave-de-la-final");
});

test("config/jueces.local.json no se sube al repositorio", () => {
  assert.match(readFileSync(join(RAIZ, ".gitignore"), "utf8"), /^config\/jueces\.local\.json$/m);
});
