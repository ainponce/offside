// Baja la base GeoIP gratuita de DB-IP (IP to City Lite, licencia CC BY 4.0) a datos/geoip/.
// Con ella, Offside ubica en el mapa cualquier IP pública del mundo, a nivel de ciudad.
// Sin ella, Offside funciona igual: las IPs reales quedan «sin ubicación» y las del simulador
// (de documentación, RFC 5737) siguen con su ubicación simulada.
//
//   pnpm geoip
//
// DB-IP publica una base por mes; si la del mes todavía no salió, baja la del mes anterior.
// Atribución obligatoria: «IP Geolocation by DB-IP» (https://db-ip.com), que el mapa muestra.

import { createWriteStream, existsSync, mkdirSync, renameSync, rmSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { fileURLToPath } from "node:url";
import { createGunzip } from "node:zlib";

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..");
const DESTINO = join(RAIZ, "datos", "geoip", "dbip-city-lite.mmdb");

function mes(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

async function bajar(m: string): Promise<boolean> {
  const url = `https://download.db-ip.com/free/dbip-city-lite-${m}.mmdb.gz`;
  const r = await fetch(url, { headers: { "user-agent": "offside-geoip/1.0" } });
  if (!r.ok || !r.body) {
    console.log(`No está ${url} (${r.status}).`);
    return false;
  }
  const total = Number(r.headers.get("content-length") ?? 0);
  console.log(`Bajando ${url}${total ? ` (${(total / 1e6).toFixed(0)} MB)` : ""}…`);
  const temporal = `${DESTINO}.parcial`;
  await pipeline(Readable.fromWeb(r.body as never), createGunzip(), createWriteStream(temporal));
  renameSync(temporal, DESTINO);
  return true;
}

mkdirSync(dirname(DESTINO), { recursive: true });
const ahora = new Date();
const anterior = new Date(Date.UTC(ahora.getUTCFullYear(), ahora.getUTCMonth() - 1, 1));
try {
  if (!(await bajar(mes(ahora))) && !(await bajar(mes(anterior)))) {
    console.error("No se pudo bajar la base de DB-IP. Offside sigue funcionando sin ubicación real.");
    process.exit(1);
  }
} catch (e) {
  rmSync(`${DESTINO}.parcial`, { force: true });
  throw e;
}
console.log(`Listo: ${DESTINO} (${(statSync(DESTINO).size / 1e6).toFixed(0)} MB). Reiniciá Offside para usarla.`);
if (!existsSync(DESTINO)) process.exit(1);
