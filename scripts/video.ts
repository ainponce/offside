// Graba el video de demostración de Offside de punta a punta, sin intervención.
//
//   pnpm build && pnpm video
//
// Levanta el simulador oficial y Offside (un par por escena), maneja la interfaz
// real en un Chrome sin ventana, captura la pantalla y arma el video con
// subtítulos y una locución sintetizada. Salida, en salida/video/:
//
//   offside-demo.mp4           con locución (voz del sistema)
//   offside-demo-sin-voz.mp4   solo imagen y subtítulos, para grabarle tu voz encima
//
// Requiere macOS (usa `say` para la voz), ffmpeg y Google Chrome. Opciones:
//   --voz Paulina        voz de `say` (por defecto Paulina; `say -v '?'` las lista)
//   --sin-voz            no genera la locución
//   --entrega <carpeta>  exportación de un partido completo para las escenas de
//                        verificación (por defecto entrega/practica)
//
// Todo lo que se ve es la plataforma corriendo contra el simulador: las firmas
// las hace este script por la interfaz, como las haría un juez.

import { type ChildProcess, execFileSync, spawn } from "node:child_process";
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createServer } from "node:net";
import { join, resolve } from "node:path";
import { type CDPSession, type Frame, type Page, chromium } from "playwright-core";
import type { ColaDTO, RespuestaIngreso } from "../src/compartido/tipos.ts";

const RAIZ = resolve(import.meta.dirname, "..");
const OFICIAL = join(RAIZ, ".simulador", "desafio-futbol");
const SALIDA = join(RAIZ, "salida", "video");
const TMP = join(SALIDA, "tmp");
const CUADROS = join(TMP, "cuadros");

function argumento(nombre: string, porDefecto: string): string {
  const i = process.argv.indexOf(`--${nombre}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1]! : porDefecto;
}
const VOZ = argumento("voz", "Paulina");
const SIN_VOZ = process.argv.includes("--sin-voz");
const CONSERVAR = process.argv.includes("--conservar");
const ENTREGA = resolve(argumento("entrega", join(RAIZ, "entrega", "practica")));

const dormir = (ms: number) => new Promise<void>((ok) => setTimeout(ok, ms));

// --- locución y subtítulos -------------------------------------------------------------

/** Cada parlamento: lo que se lee en pantalla y lo que dice la voz (con la pronunciación forzada donde hace falta). */
const PARLAMENTOS = {
  intro: {
    texto: "Un partido dura dos horas. Un sitio pirata cambia de servidor en minutos. Esto es Offside: bloqueo en vivo, con un juez firmando cada medida y sin dañar a terceros.",
    voz: "Un partido dura dos horas. Un sitio pirata cambia de servidor en minutos. Esto es Ofsáid: bloqueo en vivo, con un juez firmando cada medida, y sin dañar a terceros.",
  },
  descarte: {
    texto: "Offside lee las detecciones del simulador oficial. Las que no son piratas se descartan solas, como el licenciatario que transmite con licencia.",
    voz: "Ofsáid lee las detecciones del simulador oficial. Las que no son piratas se descartan solas, como el licenciatario que transmite con licencia.",
  },
  verificaciones: {
    texto: "Por cada filtración arma un expediente. La jueza de turno ve cuatro verificaciones: es la señal oficial, no es un licenciatario, cuál es el servidor y qué más hay en esa IP.",
    voz: "Por cada filtración arma un expediente. La jueza de turno ve cuatro verificaciones: es la señal oficial, no es un licenciatario, cuál es el servidor, y qué más hay en esa I P.",
  },
  firma: {
    texto: "Firma, y la orden sale a cada proveedor en el tipo de bloqueo que admite. Cada uno confirma; si alguno falla, se reintenta solo.",
    voz: "Firma, y la orden sale a cada proveedor, en el tipo de bloqueo que admite. Cada uno confirma. Si alguno falla, se reintenta solo.",
  },
  compartida: {
    texto: "Este otro servidor está en una IP compartida con once sitios ajenos. Offside propone bloquear solo el dominio: ninguno queda afectado.",
    voz: "Este otro servidor está en una I P compartida con once sitios ajenos. Ofsáid propone bloquear solo el dominio. Ninguno queda afectado.",
  },
  salto: {
    texto: "El pirata cambió de servidor. La marca de agua es la misma, así que es el mismo expediente: una ampliación, un toque.",
    voz: "El pirata cambió de servidor. La marca de agua es la misma, así que es el mismo expediente. Una ampliación, un toque.",
  },
  turno: {
    texto: "Minuto cincuenta: cambia el turno. La jueza saliente queda en solo lectura y lo pendiente pasa al juez entrante.",
    voz: "Minuto cincuenta: cambia el turno. La jueza saliente queda en solo lectura, y lo pendiente pasa al juez entrante.",
  },
  error: {
    texto: "¿Y si algo sale mal? Forzamos un error: un bloqueo por IP sobre una IP compartida.",
    voz: "¿Y si algo sale mal? Forzamos un error: un bloqueo por I P sobre una I P compartida.",
  },
  reclamo: {
    texto: "Un sitio legítimo reclama. Offside verifica que está detrás de esa orden y le propone al juez levantarla.",
    voz: "Un sitio legítimo reclama. Ofsáid verifica que está detrás de esa orden, y le propone al juez levantarla.",
  },
  levantamiento: {
    texto: "Con una firma se levanta en todos los proveedores y se reemplaza por el dominio. El pirata sigue bloqueado; el sitio legítimo, no.",
    voz: "Con una firma se levanta en todos los proveedores y se reemplaza por el dominio. El pirata sigue bloqueado. El sitio legítimo, no.",
  },
  final: {
    texto: "Final del partido: todos los bloqueos vencen solos.",
    voz: "Final del partido: todos los bloqueos vencen solos.",
  },
  oficial: {
    texto: "El verificador oficial, sobre un partido de práctica completo: todas las fases piratas bloqueadas, cero daño colateral, cero falsos positivos y cero órdenes fuera de turno.",
    voz: "El verificador oficial, sobre un partido de práctica completo: todas las fases piratas bloqueadas, cero daño colateral, cero falsos positivos, y cero órdenes fuera de turno.",
  },
  huella: {
    texto: "La huella de lo que vio el juez viaja dentro de cada orden firmada, y un verificador independiente recalcula todo.",
    voz: "La huella de lo que vio el juez viaja dentro de cada orden firmada, y un verificador independiente recalcula todo.",
  },
  alteracion: {
    texto: "Cambiamos un solo carácter de la evidencia. Lo detecta.",
    voz: "Cambiamos un solo carácter de la evidencia. Lo detecta.",
  },
  cierre: {
    texto: "Offside: rápido como Italia, con juez como Francia, y sin daño colateral.",
    voz: "Ofsáid: rápido como Italia, con juez como Francia, y sin daño colateral.",
  },
} as const;
type Clave = keyof typeof PARLAMENTOS;

/** Duración estimada si no hay voz: ritmo de lectura cómodo. */
function duracionLectura(texto: string): number {
  return Math.max(2.5, texto.length / 15.5);
}

function duracionAudio(ruta: string): number {
  const salida = execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", ruta], { encoding: "utf8" });
  return Number.parseFloat(salida.trim());
}

function generarLocucion(): Record<Clave, { archivo: string | null; segundos: number }> {
  const carpeta = join(TMP, "voz");
  mkdirSync(carpeta, { recursive: true });
  const resultado = {} as Record<Clave, { archivo: string | null; segundos: number }>;
  for (const clave of Object.keys(PARLAMENTOS) as Clave[]) {
    if (SIN_VOZ) {
      resultado[clave] = { archivo: null, segundos: duracionLectura(PARLAMENTOS[clave].texto) };
      continue;
    }
    const aiff = join(carpeta, `${clave}.aiff`);
    execFileSync("say", ["-v", VOZ, "-r", "178", "-o", aiff, PARLAMENTOS[clave].voz]);
    resultado[clave] = { archivo: aiff, segundos: duracionAudio(aiff) };
  }
  return resultado;
}

// --- instancias del simulador y de Offside -----------------------------------------------

function puertoLibre(): Promise<number> {
  return new Promise((ok, mal) => {
    const s = createServer();
    s.once("error", mal);
    s.listen(0, "127.0.0.1", () => {
      const { port } = s.address() as { port: number };
      s.close(() => ok(port));
    });
  });
}

const hijos: ChildProcess[] = [];
function terminarTodo(): void {
  for (const h of hijos) if (h.exitCode === null) h.kill("SIGTERM");
}
process.on("exit", terminarTodo);
process.on("SIGINT", () => {
  terminarTodo();
  process.exit(130);
});

interface Instancia {
  nombre: string;
  puerto: number;
  simulador: string;
  procesos: ChildProcess[];
}

async function json<T>(url: string, opciones: { token?: string; cuerpo?: unknown; metodo?: string } = {}): Promise<{ estado: number; datos: T }> {
  const r = await fetch(url, {
    method: opciones.metodo ?? (opciones.cuerpo === undefined ? "GET" : "POST"),
    headers: {
      ...(opciones.token ? { Authorization: `Bearer ${opciones.token}` } : {}),
      ...(opciones.cuerpo === undefined ? {} : { "Content-Type": "application/json" }),
    },
    body: opciones.cuerpo === undefined ? undefined : JSON.stringify(opciones.cuerpo),
    signal: AbortSignal.timeout(5000),
  });
  return { estado: r.status, datos: (await r.json()) as T };
}

async function esperarHasta(descripcion: string, listo: () => Promise<boolean>, segundos = 30): Promise<void> {
  const limite = Date.now() + segundos * 1000;
  while (Date.now() < limite) {
    try {
      if (await listo()) return;
    } catch {
      // todavía no
    }
    await dormir(120);
  }
  throw new Error(`No se logró ${descripcion} en ${segundos} s.`);
}

async function levantar(nombre: string, opciones: { acelerar: number; inicioMin: number; simulacro?: boolean }): Promise<Instancia> {
  const carpeta = join(TMP, nombre);
  mkdirSync(carpeta, { recursive: true });
  const [puertoSim, puerto] = [await puertoLibre(), await puertoLibre()];
  const simulador = `http://127.0.0.1:${puertoSim}`;
  const sim = spawn(
    "python3",
    ["-I", join(OFICIAL, "simulador", "servidor.py"), "--acelerar", String(opciones.acelerar), "--inicio-min", String(opciones.inicioMin), "--puerto", String(puertoSim), "--log", join(carpeta, "registro.jsonl")],
    { cwd: carpeta, stdio: ["ignore", "ignore", "inherit"] },
  );
  await esperarHasta(`levantar el simulador de ${nombre}`, async () => (await json(`${simulador}/estado`)).estado === 200);
  const app = spawn(join(RAIZ, "node_modules", ".bin", "tsx"), ["--disable-warning=ExperimentalWarning", join(RAIZ, "src", "server", "index.ts"), "--nuevo", ...(opciones.simulacro ? ["--simulacro"] : [])], {
    cwd: RAIZ,
    stdio: ["ignore", "ignore", "inherit"],
    env: {
      ...process.env,
      SIMULADOR_URL: simulador,
      PUERTO: String(puerto),
      OFFSIDE_DB: join(carpeta, "offside.db"),
      OFFSIDE_INTERVALO_MS: "150",
    },
  });
  hijos.push(sim, app);
  await esperarHasta(`conectar Offside de ${nombre}`, async () => (await json<{ conectado: boolean }>(`http://127.0.0.1:${puerto}/api/estado`)).datos.conectado);
  return { nombre, puerto, simulador, procesos: [sim, app] };
}

function apagar(instancia: Instancia): void {
  for (const p of instancia.procesos) if (p.exitCode === null) p.kill("SIGTERM");
}

const CONFIG = JSON.parse(readFileSync(join(RAIZ, "config", "jueces.demo.json"), "utf8")) as {
  jueces: { id: string; nombre: string; usuario: string; contrasena: string }[];
  operadores: { usuario: string; contrasena: string }[];
};
const [JUEZ_1, JUEZ_2] = CONFIG.jueces as [(typeof CONFIG.jueces)[number], (typeof CONFIG.jueces)[number]];
const FISCALIA = CONFIG.operadores[0]!;

async function minutoDe(instancia: Instancia): Promise<number> {
  return (await json<{ minuto_actual: number }>(`${instancia.simulador}/estado`)).datos.minuto_actual;
}

/** Firma por la API (lo que queda fuera de cuadro), con el mismo ingreso que usa la interfaz. */
async function firmarPorApi(instancia: Instancia, juez: { usuario: string; contrasena: string }, filtro: (m: ColaDTO["pendientes"][number]) => boolean): Promise<number> {
  const base = `http://127.0.0.1:${instancia.puerto}`;
  const token = (await json<RespuestaIngreso>(`${base}/api/ingreso`, { cuerpo: { usuario: juez.usuario, contrasena: juez.contrasena } })).datos.token;
  const cola = (await json<ColaDTO>(`${base}/api/juez/cola`, { token })).datos;
  let firmadas = 0;
  for (const m of cola.pendientes.filter(filtro)) {
    const r = await json(`${base}/api/juez/medidas/${m.id}/aprobar`, { token, metodo: "POST" });
    if (r.estado === 200) firmadas += 1;
  }
  return firmadas;
}

// --- el escenario: una página que encuadra la interfaz real ------------------------------

const ESCENARIO = `<!doctype html><html lang="es"><head><meta charset="utf-8"><style>
  * { box-sizing: border-box; }
  body { margin: 0; width: 1920px; height: 1080px; overflow: hidden; background: #0b111b; color: #eef1f6;
         font-family: -apple-system, "Helvetica Neue", Arial, sans-serif; }
  #marca { position: absolute; left: 60px; top: 26px; font-size: 30px; font-weight: 800; letter-spacing: -0.5px; }
  #marca i { display: inline-block; width: 5px; height: 34px; background: #3d5afe; margin: 0 5px -6px; }
  #escena { position: absolute; right: 60px; top: 32px; font-size: 23px; color: #9fb0c8; }
  .marco { position: absolute; top: 88px; background: #fff; border-radius: 14px; overflow: hidden;
           box-shadow: 0 18px 60px rgba(0,0,0,.55); opacity: 0; transition: opacity .45s; }
  .marco.visible { opacity: 1; }
  .marco iframe { border: 0; transform-origin: 0 0; display: block; }
  .rotulo { position: absolute; top: 60px; font-size: 19px; color: #9fb0c8; opacity: 0; transition: opacity .45s; }
  .rotulo.visible { opacity: 1; }
  #terminal { position: absolute; left: 150px; top: 100px; width: 1620px; height: 800px; background: #05080d; border: 1px solid #253247;
              border-radius: 12px; padding: 30px 36px; font: 24px/1.42 Menlo, Monaco, monospace; white-space: pre-wrap; overflow: hidden;
              opacity: 0; transition: opacity .45s; }
  #terminal.visible { opacity: 1; }
  #terminal .orden { color: #8ab4ff; } #terminal .bien { color: #6fdc8c; } #terminal .mal { color: #ff8d8d; } #terminal .gris { color: #8b98ab; }
  #subtitulo { position: absolute; left: 130px; right: 130px; bottom: 26px; height: 136px; display: flex; align-items: center; justify-content: center;
               text-align: center; font-size: 35px; line-height: 1.32; font-weight: 500; text-wrap: balance; }
  #telon { position: absolute; inset: 0; background: #0b111b; display: flex; flex-direction: column; align-items: center; justify-content: center;
           gap: 26px; z-index: 10; opacity: 1; transition: opacity .5s; text-align: center; }
  #telon.oculto { opacity: 0; pointer-events: none; }
  #telon h1 { margin: 0; font-size: 150px; font-weight: 800; letter-spacing: -4px; }
  #telon h1 i { display: inline-block; width: 16px; height: 150px; background: #3d5afe; margin: 0 14px -22px; }
  #telon h2 { margin: 0; font-size: 46px; font-weight: 500; color: #c9d3e2; max-width: 1400px; line-height: 1.25; }
  #telon p { margin: 0; font-size: 26px; color: #8b98ab; }
</style></head><body>
  <div id="marca">Off<i></i>side</div><div id="escena"></div>
  <div class="rotulo" id="rotulo-izq"></div><div class="rotulo" id="rotulo-der"></div>
  <div class="marco" id="marco-izq"><iframe id="izq"></iframe></div>
  <div class="marco" id="marco-der"><iframe id="der"></iframe></div>
  <pre id="terminal"></pre>
  <div id="subtitulo"></div>
  <div id="telon"><h1>Off<i></i>side</h1><h2 id="telon-titulo"></h2><p id="telon-pie"></p></div>
<script>
  const el = (id) => document.getElementById(id);
  function encuadrar(marco, iframe, x, ancho, alto, escala) {
    marco.style.left = x + "px"; marco.style.width = Math.round(ancho * escala) + "px"; marco.style.height = Math.round(alto * escala) + "px";
    iframe.style.width = ancho + "px"; iframe.style.height = alto + "px"; iframe.style.transform = "scale(" + escala + ")";
  }
  window.escenario = {
    // Tablero a la izquierda y celular del juez a la derecha.
    tableroYJuez() {
      encuadrar(el("marco-izq"), el("izq"), 60, 1440, 900, 0.9);
      encuadrar(el("marco-der"), el("der"), 1420, 390, 844, 0.96);
      el("rotulo-izq").style.left = "60px"; el("rotulo-der").style.left = "1420px";
    },
    // Dos celulares, para el cambio de turno.
    dosJueces() {
      encuadrar(el("marco-izq"), el("izq"), 500, 390, 844, 0.96);
      encuadrar(el("marco-der"), el("der"), 1046, 390, 844, 0.96);
      el("rotulo-izq").style.left = "500px"; el("rotulo-der").style.left = "1046px";
    },
    // Una sola página ancha (el expediente).
    unaPagina() {
      encuadrar(el("marco-izq"), el("izq"), 240, 1440, 900, 0.9);
      el("rotulo-izq").style.left = "240px";
    },
    rotulos(izq, der) { el("rotulo-izq").textContent = izq || ""; el("rotulo-der").textContent = der || ""; },
    mostrar(ids) {
      for (const id of ["marco-izq", "marco-der", "rotulo-izq", "rotulo-der", "terminal"]) el(id).classList.toggle("visible", ids.includes(id));
    },
    cargar(id, url) { el(id).src = url; },
    escena(texto) { el("escena").textContent = texto; },
    subtitulo(texto) { el("subtitulo").textContent = texto; },
    telon(visible, titulo, pie) {
      if (titulo !== undefined) el("telon-titulo").textContent = titulo;
      if (pie !== undefined) el("telon-pie").textContent = pie;
      el("telon").classList.toggle("oculto", !visible);
    },
    terminal(html) { el("terminal").innerHTML = html; },
  };
</script></body></html>`;

interface Grabacion {
  cdp: CDPSession;
  cuadros: { t: number; archivo: string }[];
  inicio: number;
  /** Momento, en segundos desde el primer cuadro, en que empieza cada parlamento. */
  marcas: { clave: Clave; segundo: number }[];
}

async function empezarGrabacion(pagina: Page): Promise<Grabacion> {
  mkdirSync(CUADROS, { recursive: true });
  const cdp = await pagina.context().newCDPSession(pagina);
  const g: Grabacion = { cdp, cuadros: [], inicio: 0, marcas: [] };
  cdp.on("Page.screencastFrame", (e: { data: string; sessionId: number; metadata: { timestamp?: number } }) => {
    const ahora = Date.now() / 1000;
    if (g.inicio === 0) g.inicio = ahora;
    const archivo = `c${String(g.cuadros.length + 1).padStart(6, "0")}.jpg`;
    writeFileSync(join(CUADROS, archivo), Buffer.from(e.data, "base64"));
    g.cuadros.push({ t: ahora - g.inicio, archivo });
    void cdp.send("Page.screencastFrameAck", { sessionId: e.sessionId }).catch(() => {});
  });
  await cdp.send("Page.startScreencast", { format: "jpeg", quality: 93, maxWidth: 1920, maxHeight: 1080, everyNthFrame: 1 });
  return g;
}

function ahoraEnGrabacion(g: Grabacion): number {
  return g.inicio === 0 ? 0 : Date.now() / 1000 - g.inicio;
}

// --- manejo de la interfaz real -----------------------------------------------------------

async function marcoListo(pagina: Page, id: "izq" | "der", contiene: string): Promise<Frame> {
  const elemento = await pagina.waitForSelector(`#${id}`);
  for (let i = 0; i < 150; i += 1) {
    const f = await elemento.contentFrame();
    if (f && f.url().includes(contiene)) return f;
    await dormir(80);
  }
  throw new Error(`El marco ${id} no llegó a cargar ${contiene}.`);
}

async function abrirConSesion(pagina: Page, id: "izq" | "der", origen: string, usuario: { usuario: string; contrasena: string }, destino: string): Promise<Frame> {
  await pagina.evaluate(([i, u]) => (window as any).escenario.cargar(i, u), [id, `${origen}/ingreso`] as const);
  const marco = await marcoListo(pagina, id, origen);
  await marco.locator('input[name="usuario"]').fill(usuario.usuario);
  await marco.locator('input[name="contrasena"]').fill(usuario.contrasena);
  await marco.getByRole("button", { name: "Ingresar" }).click();
  await marco.waitForURL((u) => !u.pathname.startsWith("/ingreso"), { timeout: 15000 });
  if (!marco.url().includes(destino)) await marco.goto(`${origen}${destino}`);
  return marco;
}

const botonFirmar = (marco: Frame) => marco.getByRole("button", { name: /Firmar y ordenar/ }).first();

async function esperarTarjeta(marco: Frame, clase: "Nueva filtración" | "Ampliación" | "Reclamo" | "Ratificación", segundos = 60): Promise<void> {
  await marco.locator(`article[aria-label^="${clase}"]`).first().waitFor({ state: "visible", timeout: segundos * 1000 });
}

async function firmarEnPantalla(marco: Frame): Promise<void> {
  const boton = botonFirmar(marco);
  await boton.waitFor({ state: "visible", timeout: 20000 });
  await boton.click({ timeout: 20000 });
}

// --- el guion ----------------------------------------------------------------------------

async function principal(): Promise<void> {
  for (const [que, ruta] of [
    ["el material oficial (bash scripts/traer-simulador.sh)", join(OFICIAL, "simulador", "servidor.py")],
    ["la interfaz compilada (pnpm build)", join(RAIZ, "dist", "index.html")],
    ["una exportación de un partido completo (pnpm ensayo -- --exportar)", join(ENTREGA, "manifiesto.json")],
  ] as const) {
    if (!existsSync(ruta)) throw new Error(`Falta ${que}.`);
  }
  rmSync(TMP, { recursive: true, force: true });
  mkdirSync(TMP, { recursive: true });

  console.log("Generando la locución…");
  const voz = generarLocucion();

  // Salidas reales de los verificadores, para las escenas de terminal.
  const registro = join(ENTREGA, "registro-simulador.jsonl");
  const oficial = existsSync(registro)
    ? execFileSync("python3", ["-I", join(OFICIAL, "evaluacion", "verificar.py"), "--log", registro], { encoding: "utf8" })
    : "";
  const copia = join(TMP, "entrega");
  cpSync(ENTREGA, copia, { recursive: true });
  const verificador = join(RAIZ, "herramientas", "verificar_expediente.py");
  const correr = (carpeta: string): string => {
    try {
      return execFileSync("python3", ["-I", verificador, carpeta, "--juzgados", join(RAIZ, "config", "jueces.demo.json")], { encoding: "utf8" });
    } catch (e) {
      return String((e as { stdout?: string }).stdout ?? e);
    }
  };
  const intacta = correr(copia);
  const expediente = join(copia, "expediente-EXP-2026-000001.json");
  const original = readFileSync(expediente, "utf8");
  const posicion = original.indexOf('contenido_b64\\":\\"') + 'contenido_b64\\":\\"'.length + 9;
  const letra = original[posicion]!;
  const otra = letra === "A" ? "B" : "A";
  writeFileSync(expediente, original.slice(0, posicion) + otra + original.slice(posicion + 1));
  const alterada = correr(copia);

  const navegador = await chromium.launch({ channel: "chrome", headless: true, args: ["--hide-scrollbars", "--force-device-scale-factor=1"] });
  const contexto = await navegador.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1, locale: "es-AR" });
  const pagina = await contexto.newPage();
  await pagina.setContent(ESCENARIO);
  const E = (fn: string, ...args: unknown[]) => pagina.evaluate(([f, a]) => (window as any).escenario[f as string](...(a as unknown[])), [fn, args] as const);

  const g = await empezarGrabacion(pagina);
  /** Muestra el subtítulo, marca dónde va la voz y devuelve una promesa que termina cuando termina el parlamento. */
  const decir = (clave: Clave): Promise<void> => {
    g.marcas.push({ clave, segundo: ahoraEnGrabacion(g) });
    void E("subtitulo", PARLAMENTOS[clave].texto);
    return dormir(voz[clave].segundos * 1000 + 350);
  };

  // --- Apertura ---
  await E("telon", true, "Bloqueo en vivo con juez, sin daño colateral", "Hackathon Argentina Space 2026 · Desafío Fútbol · todo corre contra el simulador oficial");
  const A = await levantar("a-circuito", { acelerar: 6, inicioMin: 32.6 });
  await E("tableroYJuez");
  await E("rotulos", "Tablero de la fiscalía", "Celular de la jueza de turno");
  const hablaIntro = decir("intro");
  const tablero = await abrirConSesion(pagina, "izq", `http://tablero.localhost:${A.puerto}`, FISCALIA, "/tablero");
  const jueza = await abrirConSesion(pagina, "der", `http://jueza.localhost:${A.puerto}`, JUEZ_1, "/juez");
  await hablaIntro;

  // --- Escena 1: el circuito y el salto de servidor ---
  await E("escena", "1 · El circuito completo");
  await E("mostrar", ["marco-izq", "marco-der", "rotulo-izq", "rotulo-der"]);
  await E("telon", false);
  await esperarTarjeta(jueza, "Nueva filtración");
  await decir("descarte");
  await decir("verificaciones");
  const hablaFirma = decir("firma");
  await dormir(700);
  await firmarEnPantalla(jueza);
  await hablaFirma;
  await esperarTarjeta(jueza, "Nueva filtración");
  const hablaCompartida = decir("compartida");
  await dormir(voz.compartida.segundos * 1000 - 1200);
  await firmarEnPantalla(jueza);
  await hablaCompartida;
  // La tercera filtración se firma sin comentario, para dejar la cola limpia antes del salto.
  await esperarTarjeta(jueza, "Nueva filtración", 20).then(() => firmarEnPantalla(jueza)).catch(() => {});
  await esperarTarjeta(jueza, "Ampliación", 90);
  const hablaSalto = decir("salto");
  await dormir(voz.salto.segundos * 1000 - 1500);
  await firmarEnPantalla(jueza);
  await hablaSalto;
  await dormir(1800);
  void tablero;

  // --- Escena 2: cambio de turno ---
  await E("telon", true, "Cambio de turno", "Minuto 50 del partido");
  await E("escena", "2 · Cambio de turno");
  const B = await levantar("b-turno", { acelerar: 6, inicioMin: 48.9 });
  apagar(A);
  await E("mostrar", []);
  await E("dosJueces");
  await E("rotulos", `${JUEZ_1.nombre} (turno hasta el minuto 50)`, `${JUEZ_2.nombre} (turno desde el minuto 50)`);
  const saliente = await abrirConSesion(pagina, "izq", `http://jueza.localhost:${B.puerto}`, JUEZ_1, "/juez");
  const entrante = await abrirConSesion(pagina, "der", `http://juez.localhost:${B.puerto}`, JUEZ_2, "/juez");
  await esperarTarjeta(saliente, "Nueva filtración");
  await E("mostrar", ["marco-izq", "marco-der", "rotulo-izq", "rotulo-der"]);
  await E("telon", false);
  const hablaTurno = decir("turno");
  await entrante.getByText("De turno", { exact: true }).first().waitFor({ timeout: 30000 });
  await esperarTarjeta(entrante, "Nueva filtración");
  await dormir(1200);
  await firmarEnPantalla(entrante);
  await hablaTurno;
  await dormir(2200);

  // --- Escena 3: un error forzado y el reclamo ---
  await E("telon", true, "¿Y si algo sale mal?", "Simulacro: se fuerza un bloqueo equivocado para mostrar los reclamos");
  await E("escena", "3 · Reclamo de un sitio legítimo (simulacro)");
  const C = await levantar("c-reclamo", { acelerar: 20, inicioMin: 5.0, simulacro: true });
  apagar(B);
  await E("mostrar", []);
  await E("tableroYJuez");
  await E("rotulos", "Tablero de la fiscalía", "Celular de la jueza de turno");
  await abrirConSesion(pagina, "izq", `http://tablero.localhost:${C.puerto}`, FISCALIA, "/tablero");
  const juezaC = await abrirConSesion(pagina, "der", `http://jueza.localhost:${C.puerto}`, JUEZ_1, "/juez");
  // La primera filtración (un servidor dedicado) se firma fuera de cuadro; queda a la vista la del simulacro.
  await esperarHasta("que aparezca la filtración del simulacro", async () => (await minutoDe(C)) >= 6.05, 30);
  await firmarPorApi(C, JUEZ_1, (m) => !m.simulacro);
  await juezaC.getByText("Simulacro: bloqueo por IP sobre una IP compartida").first().waitFor({ timeout: 20000 });
  await E("mostrar", ["marco-izq", "marco-der", "rotulo-izq", "rotulo-der"]);
  await E("telon", false);
  const hablaError = decir("error");
  await dormir(voz.error.segundos * 1000 - 900);
  await firmarEnPantalla(juezaC);
  await hablaError;
  await E("subtitulo", "El bloqueo por IP se aplica… y los sitios que comparten esa IP dejan de cargar.");
  await esperarTarjeta(juezaC, "Reclamo", 60);
  await decir("reclamo");
  const hablaLevantamiento = decir("levantamiento");
  await dormir(900);
  await firmarEnPantalla(juezaC);
  await hablaLevantamiento;
  await dormir(1500);

  // --- Escena 4: final del partido ---
  await E("telon", true, "Final del partido", "Los bloqueos no sobreviven al pitazo final");
  await E("escena", "4 · Vencimiento");
  const D = await levantar("d-final", { acelerar: 6, inicioMin: 103.55 });
  apagar(C);
  await E("mostrar", []);
  await E("rotulos", "Tablero de la fiscalía", "Celular del juez de turno");
  await abrirConSesion(pagina, "izq", `http://tablero.localhost:${D.puerto}`, FISCALIA, "/tablero");
  const juezD = await abrirConSesion(pagina, "der", `http://juez.localhost:${D.puerto}`, JUEZ_2, "/juez");
  await esperarTarjeta(juezD, "Nueva filtración");
  await firmarPorApi(D, JUEZ_2, () => true);
  await E("mostrar", ["marco-izq", "marco-der", "rotulo-izq", "rotulo-der"]);
  await E("telon", false);
  await E("subtitulo", "Últimos minutos: los bloqueos firmados siguen activos.");
  await esperarHasta("el final del partido", async () => (await minutoDe(D)) >= 105.05, 40);
  await decir("final");
  await dormir(2500);

  // --- Escena 5: el verificador oficial ---
  await E("telon", true, "El verificador oficial", "Partido de práctica completo");
  await E("escena", "5 · Verificador oficial");
  apagar(D);
  const escapar = (s: string) => s.replaceAll("&", "&amp;").replaceAll("<", "&lt;");
  const resumen = oficial.split("\n").slice(0, 16).map((l) => {
    const linea = escapar(l);
    return /: 0$|7 de 7|\d+ de \d+/.test(l) && !/recibidas|aplicadas|fallidas|reclamos/.test(l) ? `<span class="bien">${linea}</span>` : linea;
  });
  await E("terminal", `<span class="orden">$ python3 evaluacion/verificar.py --log salida/registro.jsonl</span>\n${resumen.join("\n")}`);
  await E("mostrar", ["terminal"]);
  await E("telon", false);
  await decir("oficial");

  // --- Escena 6: la firma cubre la prueba ---
  await E("escena", "6 · La firma cubre la prueba");
  const lineas = (texto: string) => texto.trimEnd().split("\n").map((l) => {
    const linea = escapar(l);
    if (l.includes("✖") || l.includes("FALLIDA")) return `<span class="mal">${linea}</span>`;
    if (l.includes("✔") || l.includes("CORRECTA")) return `<span class="bien">${linea}</span>`;
    return linea;
  }).join("\n");
  const orden = (JSON.parse(original) as { medidas: { ordenes: { orden_id: string }[] }[] }).medidas[0]!.ordenes[0]!.orden_id;
  await E("terminal", `<span class="gris"># Una orden firmada. Los últimos 16 caracteres son la huella de lo que vio el juez.</span>\n${escapar(orden)}\n\n<span class="orden">$ python3 herramientas/verificar_expediente.py entrega/practica --juzgados config/jueces.demo.json</span>\n${lineas(intacta)}`);
  await decir("huella");
  await E("terminal", `<span class="gris"># Se cambia un carácter de una captura: "${letra}" por "${otra}".</span>\n<span class="orden">$ python3 herramientas/verificar_expediente.py entrega/practica --juzgados config/jueces.demo.json</span>\n${lineas(alterada)}`);
  await decir("alteracion");
  await dormir(1200);

  // --- Cierre ---
  await E("subtitulo", "");
  await E("telon", true, "Rápido como Italia, con juez como Francia, y sin daño colateral.", "Qué se bloqueó, por orden de quién y hasta cuándo: a la vista de todos.");
  g.marcas.push({ clave: "cierre", segundo: ahoraEnGrabacion(g) });
  await dormir(voz.cierre.segundos * 1000 + 1500);

  const total = ahoraEnGrabacion(g);
  await g.cdp.send("Page.stopScreencast");
  await navegador.close();
  terminarTodo();

  // --- Montaje ---
  console.log(`Grabados ${g.cuadros.length} cuadros en ${total.toFixed(1)} s. Montando…`);
  const lista: string[] = [];
  g.cuadros.forEach((c, i) => {
    const hasta = i + 1 < g.cuadros.length ? g.cuadros[i + 1]!.t : total;
    lista.push(`file '${c.archivo}'`, `duration ${Math.max(0.001, hasta - c.t).toFixed(4)}`);
  });
  lista.push(`file '${g.cuadros[g.cuadros.length - 1]!.archivo}'`);
  writeFileSync(join(CUADROS, "lista.txt"), lista.join("\n") + "\n");
  const mudo = join(SALIDA, "offside-demo-sin-voz.mp4");
  execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", "lista.txt", "-vf", "fps=30,format=yuv420p", "-c:v", "libx264", "-preset", "medium", "-crf", "18", "-movflags", "+faststart", mudo], { cwd: CUADROS });

  if (!SIN_VOZ) {
    const entradas: string[] = [];
    const filtros: string[] = [];
    g.marcas.forEach((m, i) => {
      entradas.push("-i", voz[m.clave].archivo!);
      const ms = Math.round(m.segundo * 1000);
      filtros.push(`[${i + 1}:a]aresample=48000,adelay=${ms}|${ms}[a${i}]`);
    });
    const mezcla = `${filtros.join(";")};${g.marcas.map((_, i) => `[a${i}]`).join("")}amix=inputs=${g.marcas.length}:normalize=0,apad[a]`;
    execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-i", mudo, ...entradas, "-filter_complex", mezcla, "-map", "0:v", "-map", "[a]", "-c:v", "copy", "-c:a", "aac", "-b:a", "160k", "-shortest", "-movflags", "+faststart", join(SALIDA, "offside-demo.mp4")]);
  }
  if (!CONSERVAR) rmSync(TMP, { recursive: true, force: true });

  const minutos = `${Math.floor(total / 60)}:${String(Math.round(total % 60)).padStart(2, "0")}`;
  console.log(`\nVideo listo (${minutos}):`);
  if (!SIN_VOZ) console.log(`  ${join(SALIDA, "offside-demo.mp4")}`);
  console.log(`  ${mudo}`);
  if (total > 180) console.log("\nATENCIÓN: dura más de 3 minutos, que es el máximo del desafío.");
}

principal()
  .then(() => {
    terminarTodo();
    process.exit(0);
  })
  .catch((e) => {
    console.error(e);
    terminarTodo();
    process.exit(1);
  });
