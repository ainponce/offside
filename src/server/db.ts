// Base embebida (SQLite incluido en Node). Todo el estado de Offside vive acá,
// así un reinicio retoma donde estaba.

import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { DatabaseSync } from "node:sqlite";

export type Db = DatabaseSync;

const ESQUEMA = `
CREATE TABLE IF NOT EXISTS kv (
  clave TEXT PRIMARY KEY,
  valor TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS detecciones (
  id TEXT PRIMARY KEY,
  minuto REAL NOT NULL,
  crudo TEXT NOT NULL,
  sha256 TEXT NOT NULL,
  captura_sha256 TEXT,
  captura_bytes INTEGER NOT NULL DEFAULT 0,
  formato_ok INTEGER NOT NULL DEFAULT 0,
  veredicto TEXT NOT NULL,
  motivo TEXT NOT NULL,
  host TEXT NOT NULL,
  ip TEXT NOT NULL,
  marca TEXT,
  expediente_id TEXT,
  servidor_id INTEGER,
  recibida_min REAL NOT NULL,
  recibida_iso TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS expedientes (
  id TEXT PRIMARY KEY,
  n INTEGER NOT NULL UNIQUE,
  clave TEXT NOT NULL UNIQUE,
  marca TEXT NOT NULL,
  prefijo TEXT NOT NULL,
  origen_prefijo TEXT,
  abierto_min REAL NOT NULL
);

CREATE TABLE IF NOT EXISTS servidores (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  expediente_id TEXT NOT NULL,
  host TEXT NOT NULL,
  ip TEXT NOT NULL,
  asn INTEGER,
  organizacion TEXT,
  riesgo TEXT NOT NULL,
  primera_deteccion_min REAL NOT NULL,
  UNIQUE (expediente_id, host, ip)
);

CREATE TABLE IF NOT EXISTS medidas (
  id TEXT PRIMARY KEY,
  n INTEGER NOT NULL UNIQUE,
  expediente_id TEXT NOT NULL,
  servidor_id INTEGER,
  clase TEXT NOT NULL,
  estado TEXT NOT NULL,
  creada_min REAL NOT NULL,
  creada_iso TEXT NOT NULL,
  instantanea TEXT NOT NULL,
  huella TEXT NOT NULL,
  plan TEXT NOT NULL,
  vence_min INTEGER NOT NULL,
  juez_id TEXT,
  decidida_min REAL,
  decidida_iso TEXT,
  motivo TEXT,
  origen_medida_id TEXT,
  reclamo_id TEXT
);

CREATE TABLE IF NOT EXISTS ordenes (
  orden_id TEXT PRIMARY KEY,
  medida_id TEXT NOT NULL,
  expediente_id TEXT NOT NULL,
  servidor_id INTEGER,
  proveedor_id TEXT NOT NULL,
  tipo TEXT NOT NULL,
  objetivo TEXT NOT NULL,
  vence_min INTEGER NOT NULL,
  juez_id TEXT NOT NULL,
  juzgado_id TEXT NOT NULL,
  firma TEXT NOT NULL,
  intento INTEGER NOT NULL,
  estado TEXT NOT NULL,
  creada_min REAL NOT NULL,
  enviada_min REAL,
  aplicada_min REAL,
  finalizada_min REAL,
  error TEXT,
  atendida INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS reclamos (
  id TEXT PRIMARY KEY,
  minuto REAL NOT NULL,
  dominio TEXT NOT NULL,
  proveedor_id TEXT NOT NULL,
  mensaje TEXT NOT NULL,
  estado TEXT NOT NULL,
  medida_id TEXT,
  detalle TEXT
);

CREATE TABLE IF NOT EXISTS auditoria (
  seq INTEGER PRIMARY KEY,
  contenido TEXT NOT NULL,
  hash_anterior TEXT NOT NULL,
  hash TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sesiones (
  token_hash TEXT PRIMARY KEY,
  usuario TEXT NOT NULL,
  creada_iso TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_medidas_estado ON medidas (estado);
CREATE INDEX IF NOT EXISTS idx_ordenes_estado ON ordenes (estado);
CREATE INDEX IF NOT EXISTS idx_ordenes_servidor ON ordenes (servidor_id);
`;

/** Abre (o crea) la base y asegura el esquema. `:memory:` sirve para las pruebas. */
export function abrirDb(ruta: string): Db {
  if (ruta !== ":memory:") mkdirSync(dirname(ruta), { recursive: true });
  const db = new DatabaseSync(ruta);
  if (ruta !== ":memory:") db.exec("PRAGMA journal_mode = WAL;");
  db.exec(ESQUEMA);
  return db;
}

export function leerKv(db: Db, clave: string): string | null {
  const fila = db.prepare("SELECT valor FROM kv WHERE clave = ?").get(clave) as { valor: string } | undefined;
  return fila ? fila.valor : null;
}

export function guardarKv(db: Db, clave: string, valor: string): void {
  db.prepare("INSERT INTO kv (clave, valor) VALUES (?, ?) ON CONFLICT (clave) DO UPDATE SET valor = excluded.valor").run(
    clave,
    valor,
  );
}
