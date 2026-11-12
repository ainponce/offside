// Graba el video de demostración de Offside de punta a punta, sin intervención.
//
//   pnpm build && pnpm video
//
// Levanta el simulador oficial y Offside con bases nuevas: un partido de práctica
// completo y, en paralelo, una corrida corta con el simulacro de reclamos. Maneja la
// interfaz real en un Chrome sin ventana (las firmas son toques en la pantalla del
// juez), captura la pantalla y arma el video con subtítulos quemados. Al terminar el
// partido corre de verdad el verificador oficial, la exportación y el verificador
// independiente, y muestra lo que imprimen. Todo queda en salida/video/:
//
//   offside-demo.mp4        el video, sin sonido: los subtítulos llevan la narración
//   fotogramas.png          hoja de contacto con los momentos clave
//   partido/  simulacro/    base, registro del simulador y logs de cada corrida
//   exportacion/            la exportación que se verifica en el video
//   exportacion-alterada/   la copia con un carácter cambiado
//   salidas/                la salida completa de cada comando que aparece en pantalla
//
// Tarda lo que el partido a x6: unos 20 minutos. Opciones:
//   --voz <nombre>   además, offside-demo-narrado.mp4 con la voz de `say`. Vale la pena
//                    solo con una voz natural (una "Mejorada" o "Premium" de Ajustes >
//                    Accesibilidad > Contenido leído); las compactas suenan a robot.
//   --acelerar <n>   ritmo del partido (6). Más rápido solo para ensayar el guion.
//   --conservar      no borra los cuadros sueltos de salida/video/tmp.
//
// Requiere ffmpeg y Google Chrome (OFFSIDE_CHROME cambia la ruta del ejecutable).

import { type ChildProcess, execFile, execFileSync, spawn, spawnSync } from "node:child_process";
import { cpSync, createWriteStream, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createServer as servidorHttp } from "node:http";
import { createServer as servidorTcp } from "node:net";
import { join, resolve } from "node:path";
import { promisify } from "node:util";
import { type CDPSession, type Frame, type Page, chromium } from "playwright-core";
import type { ColaDTO, RespuestaIngreso } from "../src/compartido/tipos.ts";

const RAIZ = resolve(import.meta.dirname, "..");
const OFICIAL = join(RAIZ, ".simulador", "desafio-futbol");
const SALIDA_REL = join("salida", "video");
const SALIDA = join(RAIZ, SALIDA_REL);
const TMP = join(SALIDA, "tmp");
const CUADROS = join(TMP, "cuadros");
const CHROME = process.env.OFFSIDE_CHROME ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

function argumento(nombre: string, porDefecto: string): string {
  const i = process.argv.indexOf(`--${nombre}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1]! : porDefecto;
}
const VOZ = argumento("voz", "");
const ACELERAR = Number(argumento("acelerar", "6"));
const CONSERVAR = process.argv.includes("--conservar");

const dormir = (ms: number) => new Promise<void>((ok) => setTimeout(ok, ms));
const escapar = (s: string) => s.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");

async function esperarHasta<T>(descripcion: string, listo: () => Promise<T | null | undefined | false>, segundos = 30): Promise<T> {
  const limite = Date.now() + segundos * 1000;
  let ultimo: unknown = null;
  while (Date.now() < limite) {
    try {
      const v = await listo();
      if (v) return v;
    } catch (e) {
      ultimo = e;
    }
    await dormir(120);
  }
  throw new Error(`No se logró ${descripcion} en ${segundos} s.${ultimo ? ` Último error: ${String(ultimo)}` : ""}`);
}

function puertoLibre(): Promise<number> {
  return new Promise((ok, mal) => {
    const s = servidorTcp();
    s.once("error", mal);
    s.listen(0, "127.0.0.1", () => {
      const { port } = s.address() as { port: number };
      s.close(() => ok(port));
    });
  });
}

async function json<T>(url: string, opciones: { token?: string; cuerpo?: unknown } = {}): Promise<{ estado: number; datos: T }> {
  const r = await fetch(url, {
    method: opciones.cuerpo === undefined ? "GET" : "POST",
    headers: {
      ...(opciones.token ? { Authorization: `Bearer ${opciones.token}` } : {}),
      ...(opciones.cuerpo === undefined ? {} : { "Content-Type": "application/json" }),
    },
    body: opciones.cuerpo === undefined ? undefined : JSON.stringify(opciones.cuerpo),
    signal: AbortSignal.timeout(8000),
  });
  return { estado: r.status, datos: (await r.json()) as T };
}

/** Corre un comando desde la raíz y devuelve lo que imprimió (también si termina con error). */
function correr(comando: string, args: string[], archivo: string): { texto: string; codigo: number } {
  const r = spawnSync(comando, args, { cwd: RAIZ, encoding: "utf8", env: { ...process.env, FORCE_COLOR: "0", NO_COLOR: "1" } });
  const texto = `${r.stdout ?? ""}${r.stderr ? r.stderr : ""}`.replace(/\s+$/, "");
  writeFileSync(join(SALIDA, "salidas", archivo), `$ ${[comando, ...args].join(" ")}\n${texto}\n`);
  return { texto, codigo: r.status ?? 1 };
}

// --- corridas del simulador y de Offside -------------------------------------------------

const hijos: ChildProcess[] = [];
function terminarTodo(): void {
  for (const h of hijos) if (h.exitCode === null && h.signalCode === null) h.kill("SIGTERM");
}
process.on("exit", terminarTodo);
for (const senal of ["SIGINT", "SIGTERM"] as const) {
  process.on(senal, () => {
    terminarTodo();
    process.exit(130);
  });
}

interface Corrida {
  nombre: string;
  /** Carpeta relativa a la raíz (así se escribe en los comandos que se muestran). */
  rel: string;
  registroRel: string;
  dbRel: string;
  simulador: string;
  puerto: number;
  procesos: ChildProcess[];
}

async function levantar(nombre: string, opciones: { inicioMin: number; simulacro?: boolean }): Promise<Corrida> {
  const rel = join(SALIDA_REL, nombre);
  const carpeta = join(RAIZ, rel);
  rmSync(carpeta, { recursive: true, force: true });
  mkdirSync(carpeta, { recursive: true });
  const [puertoSim, puerto] = [await puertoLibre(), await puertoLibre()];
  const simulador = `http://127.0.0.1:${puertoSim}`;
  const registroRel = join(rel, "registro.jsonl");
  const dbRel = join(rel, "offside.db");
  const sim = spawn(
    "python3",
    [
      "-I",
      join(OFICIAL, "simulador", "servidor.py"),
      "--acelerar",
      String(ACELERAR),
      "--inicio-min",
      String(opciones.inicioMin),
      "--puerto",
      String(puertoSim),
      "--log",
      join(RAIZ, registroRel),
    ],
    { cwd: RAIZ, stdio: ["ignore", "pipe", "pipe"] },
  );
  const logSim = createWriteStream(join(carpeta, "simulador.log"));
  sim.stdout!.pipe(logSim);
  sim.stderr!.pipe(logSim);
  hijos.push(sim);
  await esperarHasta(`levantar el simulador (${nombre})`, async () => (await json(`${simulador}/estado`)).estado === 200);
  const app = spawn(
    join(RAIZ, "node_modules", ".bin", "tsx"),
    ["--disable-warning=ExperimentalWarning", join(RAIZ, "src", "server", "index.ts"), "--nuevo", ...(opciones.simulacro ? ["--simulacro"] : [])],
    {
      cwd: RAIZ,
      stdio: ["ignore", "pipe", "pipe"],
      env: {
        ...process.env,
        SIMULADOR_URL: simulador,
        PUERTO: String(puerto),
        OFFSIDE_HOST: "127.0.0.1",
        OFFSIDE_DB: join(RAIZ, dbRel),
        OFFSIDE_JUECES: join(RAIZ, "config", "jueces.demo.json"),
      },
    },
  );
  const logApp = createWriteStream(join(carpeta, "offside.log"));
  app.stdout!.pipe(logApp);
  app.stderr!.pipe(logApp);
  hijos.push(app);
  await esperarHasta(`conectar Offside (${nombre})`, async () => (await json<{ conectado: boolean }>(`http://127.0.0.1:${puerto}/api/estado`)).datos.conectado, 40);
  return { nombre, rel, registroRel, dbRel, simulador, puerto, procesos: [sim, app] };
}

function apagar(c: Corrida): void {
  for (const p of c.procesos) if (p.exitCode === null && p.signalCode === null) p.kill("SIGTERM");
}

async function minutoDe(c: Corrida): Promise<number> {
  return (await json<{ minuto_actual: number }>(`${c.simulador}/estado`)).datos.minuto_actual;
}

async function esperarMinuto(c: Corrida, minuto: number, segundos = 120): Promise<void> {
  await esperarHasta(`el minuto ${minuto} (${c.nombre})`, async () => (await minutoDe(c)) >= minuto, segundos);
}

const CONFIG = JSON.parse(readFileSync(join(RAIZ, "config", "jueces.demo.json"), "utf8")) as {
  jueces: { id: string; nombre: string; usuario: string; contrasena: string }[];
  operadores: { usuario: string; contrasena: string }[];
};
const LAURA = CONFIG.jueces.find((j) => j.usuario === "laura")!;
const MARTIN = CONFIG.jueces.find((j) => j.usuario === "martin")!;
const FISCALIA = CONFIG.operadores[0]!;

async function token(c: Corrida, u: { usuario: string; contrasena: string }): Promise<string> {
  return (await json<RespuestaIngreso>(`http://127.0.0.1:${c.puerto}/api/ingreso`, { cuerpo: { usuario: u.usuario, contrasena: u.contrasena } })).datos.token;
}

async function cola(c: Corrida, t: string): Promise<ColaDTO> {
  return (await json<ColaDTO>(`http://127.0.0.1:${c.puerto}/api/juez/cola`, { token: t })).datos;
}

// --- el escenario: una página que encuadra la interfaz real ------------------------------

const ANCHO = 1920;
const ALTO = 1080;
/** Zona de las pantallas (arriba quedan la marca y los rótulos; abajo, el subtítulo). */
const ZONA = { x: 0, y: 92, w: ANCHO, h: 816 };
/** Ventana por la que mira la cámara. */
const VISTA = { x: 40, y: 58, h: 856 };

const ESCENARIO = `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Offside, video</title><style>
@font-face { font-family: "Archivo Variable"; src: url(/fuentes/archivo.woff2) format("woff2"); font-weight: 100 900; font-stretch: 62% 125%; }
@font-face { font-family: "IBM Plex Mono"; src: url(/fuentes/plex-400.woff2) format("woff2"); font-weight: 400; }
@font-face { font-family: "IBM Plex Mono"; src: url(/fuentes/plex-500.woff2) format("woff2"); font-weight: 500 700; }
:root { --grafito: #15171C; --tinta-2: #5A5F69; --tinta-3: #6B707A; --aluminio: #ECEEF1; --fondo: #E1E4E9;
  --salida: cubic-bezier(.23, 1, .32, 1); --mueve: cubic-bezier(.77, 0, .175, 1);
  --sombra: 0 0 0 1px rgb(21 23 28/.06), 0 1px 1px rgb(21 23 28/.04), 0 18px 44px -20px rgb(21 23 28/.30); }
* { box-sizing: border-box; }
html, body { margin: 0; }
body { width: ${ANCHO}px; height: ${ALTO}px; overflow: hidden; background: var(--fondo); color: var(--grafito);
  font-family: "Archivo Variable", system-ui, sans-serif; -webkit-font-smoothing: antialiased; }
#marca { position: absolute; left: 92px; top: 26px; display: flex; align-items: center; gap: 12px; font-size: 26px; font-weight: 700; letter-spacing: -0.02em; z-index: 6; }
#marca i, .telon-marca i { display: block; width: 4px; height: 26px; background: var(--grafito); border-radius: 1px; }
#contexto { position: absolute; right: 92px; top: 30px; display: flex; align-items: center; gap: 14px; font-size: 19px; color: var(--tinta-2); z-index: 6; }
#rapido { display: none; padding: 5px 12px 6px; border-radius: 999px; background: var(--grafito); color: #fff; font-size: 16px; font-weight: 600; font-variant-numeric: tabular-nums; }
#rapido.visible { display: inline-block; }
/* La cámara se mueve dentro de una ventana fija: al acercarse no tapa la marca ni el subtítulo. */
#vista { position: absolute; left: ${VISTA.x}px; top: ${VISTA.y}px; width: ${ANCHO - 2 * VISTA.x}px; height: ${VISTA.h}px; overflow: hidden; border-radius: 22px; }
#camara { position: absolute; left: -${VISTA.x}px; top: -${VISTA.y}px; width: ${ANCHO}px; height: ${ALTO}px; transform-origin: 0 0; transition: transform 950ms var(--mueve); }
/* Oculto también para el mouse: un marco escondido no se queda con los toques del que se ve. */
.marco { position: absolute; opacity: 0; visibility: hidden; transition: opacity 360ms ease, visibility 0s linear 360ms; }
.marco.visible { opacity: 1; visibility: visible; transition: opacity 360ms ease, visibility 0s; }
.ventana { position: relative; overflow: hidden; background: var(--aluminio); }
.marco.pantalla .ventana { border-radius: 14px; box-shadow: var(--sombra); }
.marco.telefono { background: var(--grafito); border-radius: 50px; box-shadow: 0 24px 50px -24px rgb(21 23 28/.55), inset 0 0 0 1.5px #2b2e35; }
.marco.telefono .ventana { border-radius: 41px; }
.ventana iframe { position: absolute; left: 0; top: 0; border: 0; transform-origin: 0 0; display: block; background: var(--aluminio); }
.rotulo { position: absolute; margin: 0; font-size: 17px; line-height: 22px; color: var(--tinta-2); white-space: nowrap; opacity: 0; transition: opacity 360ms ease; }
.rotulo.visible { opacity: 1; }
.foco { position: absolute; border-radius: 14px; box-shadow: 0 0 0 3px var(--grafito), 0 0 0 9px rgb(21 23 28/.10); opacity: 0; transition: opacity 260ms ease; pointer-events: none; }
.foco.visible { opacity: 1; }
.toque { position: absolute; width: 56px; height: 56px; margin: -28px 0 0 -28px; border-radius: 50%; background: rgb(21 23 28/.22); box-shadow: 0 0 0 2px rgb(255 255 255/.9);
  animation: toque 700ms var(--salida) forwards; pointer-events: none; }
@keyframes toque { from { transform: scale(.55); opacity: 1; } to { transform: scale(1.35); opacity: 0; } }
#terminal { position: absolute; left: 100px; top: 84px; width: 1720px; height: 818px; border-radius: 24px; background: #15171C; color: #C9CDD4;
  box-shadow: 0 30px 60px -30px rgb(21 23 28/.6); opacity: 0; transition: opacity 360ms ease; overflow: hidden; z-index: 4; }
#terminal.visible { opacity: 1; }
#terminal-barra { height: 46px; display: flex; align-items: center; padding: 0 28px; gap: 10px; border-bottom: 1px solid rgb(255 255 255/.08); font-size: 15px; color: #8B919C; }
#terminal-barra b { color: #E6E8EC; font-weight: 600; }
#terminal-cuerpo { position: absolute; left: 0; right: 0; top: 46px; bottom: 0; overflow: hidden; }
#terminal-texto { position: absolute; left: 0; right: 0; top: 0; padding: 18px 36px 24px; font: 400 16px/23px "IBM Plex Mono", ui-monospace, monospace; white-space: pre; transition: transform 1600ms var(--mueve); }
#terminal-texto .cmd { color: #FFFFFF; font-weight: 500; }
#terminal-texto .cmd::before { content: "$ "; color: #8FA6BE; }
#terminal-texto .com { color: #8B919C; }
#terminal-texto .bien { color: #79D59D; }
#terminal-texto .mal { color: #FF8F82; }
#terminal-texto .clave { color: #FFFFFF; font-weight: 600; }
#terminal-texto .veredicto-bien { color: #79D59D; font-weight: 600; }
#terminal-texto .veredicto-mal { color: #FF8F82; font-weight: 600; }
#subtitulo { position: absolute; left: 160px; right: 160px; top: 924px; height: 136px; display: flex; align-items: center; justify-content: center; text-align: center;
  font-size: 35px; line-height: 46px; font-weight: 560; letter-spacing: -0.012em; text-wrap: balance; z-index: 9; transition: opacity 180ms ease; }
#subtitulo.oculto { opacity: 0; }
#telon { position: absolute; inset: 0; background: var(--aluminio); display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 28px;
  z-index: 8; opacity: 1; transition: opacity 500ms ease; text-align: center; }
#telon.oculto { opacity: 0; pointer-events: none; }
.telon-marca { display: flex; align-items: center; gap: 26px; font-size: 128px; font-weight: 700; letter-spacing: -0.035em; line-height: 1; }
.telon-marca i { width: 12px; height: 118px; border-radius: 3px; }
#telon h2 { margin: 0; max-width: 1320px; font-size: 46px; line-height: 1.2; font-weight: 600; letter-spacing: -0.02em; text-wrap: balance; }
#telon p { margin: 0; max-width: 1200px; font-size: 24px; line-height: 1.4; color: var(--tinta-2); text-wrap: balance; }
#telon[data-tipo="seccion"] .telon-marca { display: none; }
#telon[data-tipo="seccion"] h2 { font-size: 72px; letter-spacing: -0.03em; }
#telon[data-tipo="seccion"] p { font-size: 30px; max-width: 1100px; }
#velo { position: absolute; inset: 0; background: var(--fondo); opacity: 0; z-index: 7; pointer-events: none; transition: opacity 260ms ease; }
#velo.visible { opacity: 1; }
#tic { position: absolute; right: 0; bottom: 0; width: 2px; height: 2px; }
/* Todo lo que se superpone es solo imagen: los toques llegan a la interfaz de abajo. */
#marca, #contexto, #terminal, #subtitulo, #telon, #velo, #focos, .rotulo, #tic { pointer-events: none; }
</style></head><body>
<div id="vista"><div id="camara"><div id="marcos"></div><div id="focos"></div></div></div>
<div id="marca"><i></i>Offside</div>
<div id="contexto"><span id="contexto-texto"></span><span id="rapido"></span></div>
<div id="terminal"><div id="terminal-barra"><b>Terminal</b><span id="terminal-ruta"></span></div><div id="terminal-cuerpo"><div id="terminal-texto"></div></div></div>
<div id="subtitulo" class="oculto"></div>
<div id="velo"></div>
<div id="telon"><div class="telon-marca"><i></i>Offside</div><h2 id="telon-titulo"></h2><p id="telon-pie"></p></div>
<div id="tic"></div>
<script>
  const el = (id) => document.getElementById(id);
  // Un píxel que cambia en cada cuadro: la captura recibe cuadros parejos aunque nada se mueva.
  let par = false;
  (function latir() { par = !par; el("tic").style.background = par ? "#e1e4e9" : "#e1e4ea"; requestAnimationFrame(latir); })();
  window.E = {
    marco(id, telefono) {
      if (el("m-" + id)) return;
      const m = document.createElement("div");
      m.id = "m-" + id; m.className = "marco " + (telefono ? "telefono" : "pantalla");
      m.innerHTML = '<div class="ventana"><iframe id="f-' + id + '" name="' + id + '" allow="autoplay"></iframe></div>';
      const r = document.createElement("p"); r.id = "r-" + id; r.className = "rotulo";
      el("marcos").append(m, r);
    },
    ubicar(id, x, y, ancho, alto, escala, borde, rotulo) {
      const m = el("m-" + id), f = el("f-" + id), v = m.firstChild, r = el("r-" + id);
      m.style.left = x + "px"; m.style.top = y + "px"; m.style.padding = borde + "px";
      v.style.width = ancho * escala + "px"; v.style.height = alto * escala + "px";
      f.style.width = ancho + "px"; f.style.height = alto + "px"; f.style.transform = "scale(" + escala + ")";
      r.textContent = rotulo || ""; r.style.left = (x + 6) + "px"; r.style.top = (y - 29) + "px";
    },
    mostrar(ids) {
      for (const m of document.querySelectorAll(".marco")) m.classList.toggle("visible", ids.includes(m.id.slice(2)));
      for (const r of document.querySelectorAll(".rotulo")) r.classList.toggle("visible", ids.includes(r.id.slice(2)) && r.textContent !== "");
    },
    cargar(id, url) { el("f-" + id).src = url; },
    camara(tx, ty, s) { el("camara").style.transform = "translate(" + tx + "px," + ty + "px) scale(" + s + ")"; },
    focos(lista) {
      const capa = el("focos");
      for (const f of capa.children) { f.classList.remove("visible"); setTimeout(() => f.remove(), 300); }
      for (const r of lista) {
        const f = document.createElement("div"); f.className = "foco";
        f.style.left = r.x + "px"; f.style.top = r.y + "px"; f.style.width = r.w + "px"; f.style.height = r.h + "px";
        if (r.radio != null) f.style.borderRadius = r.radio + "px";
        capa.append(f); requestAnimationFrame(() => requestAnimationFrame(() => f.classList.add("visible")));
      }
    },
    toque(x, y) {
      const t = document.createElement("div"); t.className = "toque"; t.style.left = x + "px"; t.style.top = y + "px";
      el("focos").append(t); setTimeout(() => t.remove(), 800);
    },
    subtitulo(texto) {
      const s = el("subtitulo");
      if (!texto) { s.classList.add("oculto"); return; }
      s.textContent = texto; s.classList.remove("oculto");
    },
    contexto(texto) { el("contexto-texto").textContent = texto || ""; },
    rapido(texto) { const r = el("rapido"); r.textContent = texto || ""; r.classList.toggle("visible", Boolean(texto)); },
    telon(visible, tipo, titulo, pie) {
      const t = el("telon");
      if (tipo) t.dataset.tipo = tipo;
      if (titulo !== undefined) el("telon-titulo").textContent = titulo;
      if (pie !== undefined) el("telon-pie").textContent = pie;
      t.classList.toggle("oculto", !visible);
    },
    velo(visible) { el("velo").classList.toggle("visible", visible); },
    terminal(visible, ruta, html) {
      if (html !== undefined) { el("terminal-texto").innerHTML = html; el("terminal-texto").style.transform = "translateY(0)"; }
      if (ruta !== undefined) el("terminal-ruta").textContent = ruta;
      el("terminal").classList.toggle("visible", visible);
    },
    /** Desplaza la terminal para que se vea la última línea. Devuelve cuánto se movió. */
    terminalAlFinal() {
      const t = el("terminal-texto"), caja = el("terminal-cuerpo");
      const sobra = t.scrollHeight - caja.clientHeight;
      if (sobra > 0) t.style.transform = "translateY(" + (-sobra) + "px)";
      return Math.max(0, sobra);
    },
  };
</script></body></html>`;

/** Página de la hoja de contacto: una grilla de cuadros con el tiempo y el momento. */
function paginaFotogramas(cuadros: { archivo: string; tiempo: string; etiqueta: string }[], duracion: string): string {
  const celdas = cuadros
    .map((c) => `<figure><img src="/cuadro/${c.archivo}"><figcaption><b>${c.tiempo}</b> ${escapar(c.etiqueta)}</figcaption></figure>`)
    .join("");
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><style>
@font-face { font-family: "Archivo Variable"; src: url(/fuentes/archivo.woff2) format("woff2"); font-weight: 100 900; font-stretch: 62% 125%; }
body { margin: 0; padding: 40px 44px 44px; background: #ECEEF1; color: #15171C; font-family: "Archivo Variable", sans-serif; width: 2112px; }
h1 { margin: 0 0 6px; font-size: 30px; font-weight: 700; letter-spacing: -0.02em; } p { margin: 0 0 26px; font-size: 18px; color: #5A5F69; }
main { display: grid; grid-template-columns: repeat(4, 1fr); gap: 22px; }
figure { margin: 0; background: #fff; border-radius: 14px; overflow: hidden; box-shadow: 0 0 0 1px rgb(21 23 28/.06), 0 12px 28px -18px rgb(21 23 28/.3); }
img { display: block; width: 100%; aspect-ratio: 16 / 9; }
figcaption { padding: 10px 14px 12px; font-size: 17px; line-height: 1.3; color: #5A5F69; } figcaption b { color: #15171C; font-variant-numeric: tabular-nums; margin-right: 6px; }
</style></head><body><h1>Offside, video de demostración</h1><p>Cuadros del video final (${duracion}), en el orden en que aparecen.</p><main>${celdas}</main></body></html>`;
}

function servirEscenario(): Promise<{ url: string; cerrar: () => void; pagina: (html: string) => void }> {
  const fuentes: Record<string, string> = {
    "/fuentes/archivo.woff2": join(RAIZ, "node_modules", "@fontsource-variable", "archivo", "files", "archivo-latin-wdth-normal.woff2"),
    "/fuentes/plex-400.woff2": join(RAIZ, "node_modules", "@fontsource", "ibm-plex-mono", "files", "ibm-plex-mono-latin-400-normal.woff2"),
    "/fuentes/plex-500.woff2": join(RAIZ, "node_modules", "@fontsource", "ibm-plex-mono", "files", "ibm-plex-mono-latin-500-normal.woff2"),
  };
  let extra = "";
  return new Promise((ok) => {
    const s = servidorHttp((req, res) => {
      const ruta = (req.url ?? "/").split("?")[0]!;
      if (ruta === "/") {
        res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
        res.end(ESCENARIO);
      } else if (ruta === "/hoja") {
        res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
        res.end(extra);
      } else if (fuentes[ruta]) {
        res.writeHead(200, { "Content-Type": "font/woff2" });
        res.end(readFileSync(fuentes[ruta]!));
      } else if (ruta.startsWith("/cuadro/") && /^[\w.-]+$/.test(ruta.slice(8))) {
        res.writeHead(200, { "Content-Type": "image/png" });
        res.end(readFileSync(join(TMP, "hoja", ruta.slice(8))));
      } else {
        res.writeHead(404);
        res.end();
      }
    });
    s.listen(0, "127.0.0.1", () => {
      const { port } = s.address() as { port: number };
      ok({ url: `http://localhost:${port}`, cerrar: () => s.close(), pagina: (html) => (extra = html) });
    });
  });
}

// --- la grabación ------------------------------------------------------------------------

/**
 * Cuadros del screencast con un reloj de salida propio: en cámara normal avanza con el
 * tiempo real, en cámara rápida más despacio, y en pausa no avanza (un corte).
 */
class Grabador {
  readonly cuadros: { archivo: string; t: number }[] = [];
  readonly marcas: { t: number; etiqueta: string }[] = [];
  readonly voces: { t: number; archivo: string }[] = [];
  t = 0;
  private velocidadActual = 1;
  private grabando = false;
  private ultimoReal = 0;
  private ultimoGuardado = -1;
  private cdp: CDPSession | null = null;

  async empezar(pagina: Page): Promise<void> {
    mkdirSync(CUADROS, { recursive: true });
    const cdp = await pagina.context().newCDPSession(pagina);
    this.cdp = cdp;
    cdp.on("Page.screencastFrame", (e: { data: string; sessionId: number; metadata: { timestamp?: number } }) => {
      void cdp.send("Page.screencastFrameAck", { sessionId: e.sessionId }).catch(() => {});
      const real = e.metadata.timestamp ?? Date.now() / 1000;
      const dt = this.ultimoReal === 0 ? 0 : Math.max(0, real - this.ultimoReal);
      this.ultimoReal = real;
      if (!this.grabando) return;
      this.t += dt / this.velocidadActual;
      if (this.ultimoGuardado >= 0 && this.t - this.ultimoGuardado < 1 / 30 - 1e-4) return;
      const archivo = `c${String(this.cuadros.length + 1).padStart(6, "0")}.jpg`;
      writeFileSync(join(CUADROS, archivo), Buffer.from(e.data, "base64"));
      this.cuadros.push({ archivo, t: this.t });
      this.ultimoGuardado = this.t;
    });
    await cdp.send("Page.startScreencast", { format: "jpeg", quality: 90, maxWidth: ANCHO, maxHeight: ALTO, everyNthFrame: 1 });
  }

  seguir(): void {
    this.grabando = true;
  }
  pausar(): void {
    this.grabando = false;
  }
  velocidad(v: number): void {
    this.velocidadActual = v;
  }
  marcar(etiqueta: string): void {
    this.marcas.push({ t: this.t, etiqueta });
  }
  /** Espera hasta que el video avanzó `segundos` (en tiempo de salida). */
  async esperar(segundos: number): Promise<void> {
    const fin = this.t + segundos;
    while (this.t < fin) await dormir(25);
  }
  async parar(): Promise<void> {
    this.grabando = false;
    await this.cdp?.send("Page.stopScreencast").catch(() => {});
  }
}

// --- locución opcional ---------------------------------------------------------------------

/** Cómo se pronuncia lo que `say` lee mal. */
function paraVoz(texto: string): string {
  return texto
    .replaceAll("Offside", "Ofsáid")
    .replace(/\bIPs?\b/g, (m) => (m === "IP" ? "I P" : "I Pes"))
    .replaceAll("105′", "ciento cinco")
    .replace(/(\d+)′/g, "$1")
    .replaceAll("×", "por ");
}

const ejecutar = promisify(execFile);
let nVoz = 0;
/** Sin bloquear el proceso: mientras `say` trabaja, la captura sigue recibiendo cuadros. */
async function generarVoz(texto: string): Promise<{ archivo: string; segundos: number } | null> {
  if (!VOZ) return null;
  const archivo = join(TMP, "voz", `v${String(++nVoz).padStart(3, "0")}.aiff`);
  mkdirSync(join(TMP, "voz"), { recursive: true });
  await ejecutar("say", ["-v", VOZ, "-r", "182", "-o", archivo, paraVoz(texto)]);
  const { stdout } = await ejecutar("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", archivo]);
  return { archivo, segundos: Number.parseFloat(stdout.trim()) };
}

// --- encuadre ----------------------------------------------------------------------------

interface Marco {
  id: string;
  telefono: boolean;
  ancho: number;
  alto: number;
  x: number;
  y: number;
  escala: number;
  borde: number;
  frame: Frame | null;
}
interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
  radio?: number;
}

const ESCALA_TABLERO = 0.9;
const ESCALA_TELEFONO = 0.935;
const BORDE_TELEFONO = 9;

class Escena {
  readonly marcos = new Map<string, Marco>();
  /** Dónde está la cámara, para llevar un punto del escenario a la pantalla (y tocarlo). */
  private cam = { tx: 0, ty: 0, s: 1, desde: 0 };
  constructor(
    readonly pagina: Page,
    readonly g: Grabador,
  ) {}

  E(fn: string, ...args: unknown[]): Promise<unknown> {
    return this.pagina.evaluate(([f, a]) => (window as unknown as { E: Record<string, (...x: unknown[]) => unknown> }).E[f as string]!(...(a as unknown[])), [fn, args] as const);
  }

  async marco(id: string, telefono: boolean): Promise<Marco> {
    await this.E("marco", id, telefono);
    const m: Marco = { id, telefono, ancho: telefono ? 390 : 1440, alto: telefono ? 844 : 900, x: 0, y: 0, escala: 1, borde: 0, frame: null };
    this.marcos.set(id, m);
    await this.ubicar(m, ZONA.x, ZONA.y, telefono ? ESCALA_TELEFONO : ESCALA_TABLERO, "");
    return m;
  }

  async ubicar(m: Marco, x: number, y: number, escala: number, rotulo: string): Promise<void> {
    Object.assign(m, { x, y, escala, borde: m.telefono ? BORDE_TELEFONO : 0 });
    await this.E("ubicar", m.id, x, y, m.ancho, m.alto, escala, m.borde, rotulo);
  }

  /** Tablero a la izquierda y el celular del juez a la derecha. */
  async tableroYJuez(tablero: Marco, juez: Marco, rotuloJuez: string): Promise<void> {
    const anchoT = tablero.ancho * ESCALA_TABLERO;
    const anchoJ = juez.ancho * ESCALA_TELEFONO + 2 * BORDE_TELEFONO;
    const x0 = Math.round((ANCHO - (anchoT + 56 + anchoJ)) / 2);
    await this.ubicar(tablero, x0, ZONA.y, ESCALA_TABLERO, "Tablero de la fiscalía, proyectado en la sala");
    await this.ubicar(juez, x0 + anchoT + 56, ZONA.y, ESCALA_TELEFONO, rotuloJuez);
    await this.E("mostrar", [tablero.id, juez.id]);
  }

  /** Dos celulares, para el cambio de turno. */
  async dosJueces(a: Marco, rotuloA: string, b: Marco, rotuloB: string): Promise<void> {
    const anchoJ = a.ancho * ESCALA_TELEFONO + 2 * BORDE_TELEFONO;
    const x0 = Math.round((ANCHO - (2 * anchoJ + 140)) / 2);
    await this.ubicar(a, x0, ZONA.y, ESCALA_TELEFONO, rotuloA);
    await this.ubicar(b, x0 + anchoJ + 140, ZONA.y, ESCALA_TELEFONO, rotuloB);
    await this.E("mostrar", [a.id, b.id]);
  }

  /** Una página ancha sola (expediente, transparencia). */
  async pagina1(m: Marco, rotulo: string): Promise<void> {
    await this.ubicar(m, Math.round((ANCHO - m.ancho * ESCALA_TABLERO) / 2), ZONA.y, ESCALA_TABLERO, rotulo);
    await this.E("mostrar", [m.id]);
  }

  /** Rectángulo de un elemento de la interfaz, en coordenadas del escenario. */
  async rect(m: Marco, selector: string, opciones: { n?: number; margen?: number; hasta?: string } = {}): Promise<Rect> {
    if (!m.frame) throw new Error(`El marco ${m.id} no tiene página.`);
    const r = await m.frame.evaluate(
      ([sel, n, hasta]) => {
        const todos = [...document.querySelectorAll(sel as string)];
        const a = todos[n as number];
        if (!a) return null;
        const b1 = a.getBoundingClientRect();
        let b2 = b1;
        if (hasta) {
          const z = [...document.querySelectorAll(hasta as string)].at(-1);
          if (z) b2 = z.getBoundingClientRect();
        }
        const x = Math.min(b1.left, b2.left);
        const y = Math.min(b1.top, b2.top);
        return { x, y, w: Math.max(b1.right, b2.right) - x, h: Math.max(b1.bottom, b2.bottom) - y };
      },
      [selector, opciones.n ?? 0, opciones.hasta ?? ""] as const,
    );
    if (!r) throw new Error(`No aparece ${selector} en ${m.id}.`);
    // Lo que queda fuera de la pantalla (debajo del pliegue) no se marca.
    const margen = opciones.margen ?? 8;
    const arriba = Math.max(r.y - margen, 2);
    const abajo = Math.min(r.y + r.h + margen, m.alto - 2);
    return {
      x: m.x + m.borde + (r.x - margen) * m.escala,
      y: m.y + m.borde + arriba * m.escala,
      w: (r.w + 2 * margen) * m.escala,
      h: Math.max(0, abajo - arriba) * m.escala,
    };
  }

  async foco(...rects: Rect[]): Promise<void> {
    await this.E("focos", rects);
  }
  async sinFoco(): Promise<void> {
    await this.E("focos", []);
  }

  /** Acerca la cámara a un rectángulo del escenario. */
  async enfocar(r: Rect, maximo = 1.7): Promise<void> {
    const s = Math.min(maximo, (ANCHO * 0.92) / r.w, (VISTA.h * 0.9) / r.h);
    const tx = ANCHO / 2 - s * (r.x + r.w / 2);
    const ty = VISTA.y + VISTA.h / 2 - s * (r.y + r.h / 2);
    this.cam = { tx, ty, s, desde: Date.now() };
    await this.E("camara", tx, ty, s);
  }
  async alejar(): Promise<void> {
    if (this.cam.s === 1 && this.cam.tx === 0 && this.cam.ty === 0) return;
    this.cam = { tx: 0, ty: 0, s: 1, desde: Date.now() };
    await this.E("camara", 0, 0, 1);
  }

  /**
   * Un toque de verdad: el mouse hace clic en el punto de la pantalla donde se ve el
   * elemento (a través de la escala del marco y de la cámara), y se dibuja el toque.
   */
  async tocar(m: Marco, selector: string): Promise<void> {
    const quieta = this.cam.desde + 1100 - Date.now();
    if (quieta > 0) await dormir(quieta);
    const r = await this.rect(m, selector, { margen: 0 });
    const x = r.x + r.w * 0.55;
    const y = r.y + r.h * 0.45;
    await this.E("toque", x, y);
    await this.pagina.mouse.click(this.cam.tx + this.cam.s * x, this.cam.ty + this.cam.s * y);
  }

  /** Subtítulo; termina cuando pasó el tiempo de lectura (o lo que dure la voz). */
  async decir(texto: string, opciones: { minimo?: number } = {}): Promise<void> {
    const voz = await generarVoz(texto);
    if (voz) this.g.voces.push({ t: this.g.t, archivo: voz.archivo });
    await this.E("subtitulo", texto);
    const lectura = Math.max(3.2, texto.length / 17 + 0.5, opciones.minimo ?? 0);
    await this.g.esperar(Math.max(lectura, voz ? voz.segundos + 0.45 : 0));
  }
  async callar(): Promise<void> {
    await this.E("subtitulo", "");
  }

  /** Un corte: funde a fondo, deja de grabar, hace lo que haga falta y vuelve. */
  async corte(cambio: () => Promise<void>): Promise<void> {
    await this.E("velo", true);
    await this.g.esperar(0.32);
    this.g.pausar();
    await cambio();
    await dormir(450);
    this.g.seguir();
    await this.E("velo", false);
    await this.g.esperar(0.3);
  }
}

// --- manejo de la interfaz real ----------------------------------------------------------

async function abrir(escena: Escena, m: Marco, url: string): Promise<Frame> {
  await escena.E("cargar", m.id, url);
  const iframe = await escena.pagina.waitForSelector(`#f-${m.id}`, { state: "attached" });
  for (let i = 0; i < 200; i += 1) {
    const f = await iframe.contentFrame();
    if (f && f.url().startsWith(url.split("/").slice(0, 3).join("/"))) {
      await f.waitForLoadState("domcontentloaded");
      m.frame = f;
      return f;
    }
    await dormir(60);
  }
  throw new Error(`El marco ${m.id} no cargó ${url}.`);
}

async function ingresar(escena: Escena, m: Marco, origen: string, u: { usuario: string; contrasena: string }, destino: string): Promise<Frame> {
  const f = await abrir(escena, m, `${origen}/ingreso`);
  await f.locator('input[name="usuario"]').fill(u.usuario);
  await f.locator('input[name="contrasena"]').fill(u.contrasena);
  // Enter en la contraseña envía el formulario (el marco está escalado: un clic calculado por
  // Playwright adentro del marco caería en otro lado).
  await f.locator('input[name="contrasena"]').press("Enter");
  await f.waitForURL((url) => !url.pathname.startsWith("/ingreso"), { timeout: 15000 });
  if (!f.url().includes(destino)) await f.goto(`${origen}${destino}`);
  return f;
}

function frameDe(m: Marco): Frame {
  if (!m.frame) throw new Error(`El marco ${m.id} no tiene página.`);
  return m.frame;
}

async function esperarTarjeta(m: Marco, clase: string, segundos = 90): Promise<void> {
  await frameDe(m).locator(`article.tarjeta[aria-label^="${clase}"]`).first().waitFor({ state: "visible", timeout: segundos * 1000 });
}

const botonFirma = (m: Marco) => frameDe(m).locator(".barra-accion .boton-firma");

/** Firma con un toque sobre el botón, a la vista: se dibuja el toque en el escenario. */
async function firmarAMano(escena: Escena, m: Marco): Promise<void> {
  const boton = botonFirma(m);
  await boton.waitFor({ state: "visible", timeout: 20000 });
  await esperarHasta("que el botón de firma se arme", async () => boton.isEnabled(), 20);
  await escena.tocar(m, ".barra-accion .boton-firma");
  await frameDe(m).locator(".hoja-despacho").waitFor({ timeout: 20000 });
}

/**
 * Juez de fondo: mientras la cámara no mira, firma por la misma pantalla lo que le llegue
 * al juez de turno (las firmas que el video resume en cámara rápida).
 */
class FirmaDeFondo {
  private readonly activos = new Set<Marco>();
  private vivo = true;
  firmadas = 0;
  constructor() {
    void this.ciclo();
  }
  activar(m: Marco): void {
    this.activos.add(m);
  }
  desactivar(m: Marco): void {
    this.activos.delete(m);
  }
  detener(): void {
    this.vivo = false;
  }
  private async ciclo(): Promise<void> {
    while (this.vivo) {
      for (const m of [...this.activos]) {
        const f = m.frame;
        if (!f) continue;
        try {
          // El marco puede estar oculto o debajo de otro: el clic se entrega al botón mismo.
          const siguiente = f.locator(".despacho-acciones .boton-ancho");
          if (await siguiente.isVisible()) {
            await siguiente.dispatchEvent("click");
            continue;
          }
          const b = f.locator(".barra-accion .boton-firma");
          if ((await b.isVisible()) && (await b.isEnabled())) {
            await b.dispatchEvent("click");
            this.firmadas += 1;
          }
        } catch {
          // La pantalla cambió en el medio: se vuelve a mirar en la próxima vuelta.
        }
      }
      await dormir(350);
    }
  }
}

// --- terminal ----------------------------------------------------------------------------

/** Líneas de una salida real, con color según lo que dicen (el texto no se toca). */
function colorear(texto: string, claves: RegExp | null = null): string {
  return texto
    .split("\n")
    .map((l) => {
      const e = escapar(l);
      if (/^VERIFICACIÓN CORRECTA/.test(l)) return `<span class="veredicto-bien">${e}</span>`;
      if (/^VERIFICACIÓN FALLIDA/.test(l)) return `<span class="veredicto-mal">${e}</span>`;
      if (l.includes("✖")) return `<span class="mal">${e}</span>`;
      if (l.includes("✔")) return `<span class="bien">${e}</span>`;
      if (claves?.test(l)) return `<span class="clave">${e}</span>`;
      return e;
    })
    .join("\n");
}
const comando = (c: string) => `<span class="cmd">${escapar(c)}</span>`;
const comentario = (c: string) => `<span class="com">${escapar(c)}</span>`;

// --- el guion ----------------------------------------------------------------------------

interface Resumen {
  resumen: Record<string, string | number | null>;
}

async function principal(): Promise<void> {
  for (const [que, ruta] of [
    ["el material oficial (bash scripts/traer-simulador.sh)", join(OFICIAL, "simulador", "servidor.py")],
    ["la interfaz compilada (pnpm build)", join(RAIZ, "dist", "index.html")],
  ] as const) {
    if (!existsSync(ruta)) throw new Error(`Falta ${que}.`);
  }
  try {
    execFileSync("ffmpeg", ["-version"], { stdio: "ignore" });
  } catch {
    throw new Error("Falta ffmpeg (brew install ffmpeg).");
  }
  if (VOZ) execFileSync("say", ["-v", VOZ, "-o", join(RAIZ, "salida", ".prueba-voz.aiff"), "hola"]);
  // Si la Mac se duerme, el reloj del simulador se frena y el guion se desarma: se la mantiene
  // despierta mientras dure la grabación (caffeinate termina solo con este proceso).
  if (process.platform === "darwin" && existsSync("/usr/bin/caffeinate")) {
    spawn("/usr/bin/caffeinate", ["-i", "-w", String(process.pid)], { stdio: "ignore" }).unref();
  }
  rmSync(TMP, { recursive: true, force: true });
  mkdirSync(join(SALIDA, "salidas"), { recursive: true });
  mkdirSync(CUADROS, { recursive: true });
  rmSync(join(RAIZ, "salida", ".prueba-voz.aiff"), { force: true });

  const escenario = await servirEscenario();
  const navegador = await chromium.launch({
    executablePath: existsSync(CHROME) ? CHROME : undefined,
    channel: existsSync(CHROME) ? undefined : "chrome",
    headless: true,
    args: ["--hide-scrollbars", "--force-color-profile=srgb"],
  });
  const contexto = await navegador.newContext({ viewport: { width: ANCHO, height: ALTO }, deviceScaleFactor: 1, locale: "es-AR", timezoneId: "America/Argentina/Buenos_Aires" });
  const pagina = await contexto.newPage();
  await pagina.goto(escenario.url);
  await pagina.evaluate(() => document.fonts.ready);
  const g = new Grabador();
  await g.empezar(pagina);
  const escena = new Escena(pagina, g);
  const fondo = new FirmaDeFondo();
  const tiempo = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
  const avance = (texto: string) => console.log(`[${tiempo(g.t)} de video] ${texto}`);

  // --- apertura: el partido arranca y los marcos se preparan detrás del título ---
  await escena.E(
    "telon",
    true,
    "titulo",
    "Bloqueo en vivo de transmisiones piratas, con un juez firmando cada medida y sin daño colateral",
    "Hackathon Argentina Space 2026, Desafío Fútbol. Todo corre contra el simulador oficial del desafío; nombres, IPs y juzgados son ficticios.",
  );
  avance("levantando el partido de práctica");
  const P = await levantar("partido", { inicioMin: 0.5 });
  const origen = (sub: string, c: Corrida) => `http://${sub}.localhost:${c.puerto}`;
  const ptab = await escena.marco("ptab", false);
  const plaura = await escena.marco("plaura", true);
  const pmartin = await escena.marco("pmartin", true);
  await escena.tableroYJuez(ptab, plaura, "Celular de la jueza de turno");
  await escena.E("mostrar", []);
  await ingresar(escena, ptab, origen("tablero", P), FISCALIA, "/tablero");
  await ingresar(escena, plaura, origen("jueza", P), LAURA, "/juez");
  await ingresar(escena, pmartin, origen("juez", P), MARTIN, "/juez");
  const tokenLaura = await token(P, LAURA);
  await escena.E("contexto", `Partido de práctica, simulador oficial, tiempo ×${ACELERAR}`);
  // El telón se abre un instante antes de la primera detección (minuto 2), para verla llegar;
  // el título se graba en los seis segundos anteriores.
  const revelar = 2 - (1.2 * ACELERAR) / 60;
  await esperarMinuto(P, revelar - (6.3 * ACELERAR) / 60);
  g.seguir();
  g.marcar("Título");
  await g.esperar(0.6);
  await escena.decir("Un partido dura dos horas. Un sitio pirata cambia de servidor en minutos.");
  await escena.callar();
  await esperarMinuto(P, revelar);
  await escena.tableroYJuez(ptab, plaura, "Celular de la jueza de turno");
  await escena.E("telon", false);
  await g.esperar(0.5);

  // --- 1. detección, expediente y firma ---
  avance("detección");
  const lee = escena.decir("Offside lee las detecciones del simulador y abre un expediente por filtración.", { minimo: 5.4 });
  await esperarTarjeta(plaura, "Nueva filtración", 60);
  await g.esperar(0.4);
  await escena.foco(await escena.rect(ptab, ".tb-expediente", { margen: 10 }));
  g.marcar("Detección y expediente");
  await lee;
  await g.esperar(0.6);
  await escena.foco(await escena.rect(plaura, ".tarjeta .titular", { hasta: ".tarjeta .verif", margen: 10 }));
  g.marcar("La tarjeta de la jueza");
  await escena.decir("La jueza de turno lo recibe en el celular: el pedido y cuatro verificaciones.");
  await escena.sinFoco();
  await firmarAMano(escena, plaura);
  g.marcar("Firma");
  // La barra se vuelve el despacho en el celular y las celdas del tablero cambian: las dos cosas a la vista.
  await g.esperar(0.7);
  await escena.foco(await escena.rect(plaura, ".hoja-despacho", { margen: 0 }), await escena.rect(ptab, ".tb-expediente .tb-celdas", { margen: 8 }));
  const aurora = frameDe(ptab).locator('.tb-servidor .celda[aria-label^="Conectividad Aurora: Aplicada"]').first();
  await Promise.all([escena.decir("Firma. Sale una orden a cada proveedor, en el tipo de bloqueo que admite."), aurora.waitFor({ timeout: 30000 })]);
  await escena.sinFoco();
  await escena.enfocar(await escena.rect(ptab, ".tb-regla", { hasta: ".tb-expediente", margen: 14 }), 1.6);
  g.marcar("Proveedores");
  g.velocidad(3);
  await escena.E("rapido", "×3");
  await escena.decir("Cada proveedor confirma por su cuenta; el que falla se reintenta solo.", { minimo: 2.4 });
  await esperarMinuto(P, 4.15);
  g.velocidad(1);
  await escena.E("rapido", null);
  await escena.alejar();
  await g.esperar(0.6);
  await escena.foco(await escena.rect(ptab, ".tb-pie-panel", { margen: 6 }));
  await escena.decir("Lo que no es pirata se archiva solo, como el licenciatario en su dominio.");
  await escena.sinFoco();
  await escena.callar();

  // --- 2. IP compartida: se bloquea el dominio ---
  avance("IP compartida");
  g.velocidad(4);
  await escena.E("rapido", "×4");
  await esperarHasta(
    "la filtración en IP compartida",
    async () => (await frameDe(plaura).locator('article.tarjeta[aria-label*="Bloquear el dominio"]').count()) > 0,
    90,
  );
  g.velocidad(1);
  await escena.E("rapido", null);
  const compartida = (await cola(P, tokenLaura)).pendientes.find((m) => m.terceros.length > 0);
  const terceros = compartida?.terceros.length ?? 0;
  await frameDe(plaura).evaluate(() => window.scrollTo({ top: 300, behavior: "smooth" }));
  await g.esperar(0.7);
  await escena.foco(await escena.rect(plaura, ".tarjeta .verif", { n: 3, margen: 6 }));
  g.marcar("IP compartida");
  await escena.decir(`Este pirata comparte la IP con ${terceros} sitios ajenos. Offside pide bloquear solo el dominio.`);
  await escena.sinFoco();
  await firmarAMano(escena, plaura);
  await escena.enfocar(await escena.rect(ptab, ".tb-dano", { margen: 12 }), 1.6);
  g.marcar("Daño evitado");
  await escena.decir(`Daño evitado: esos ${terceros} sitios legítimos siguen en línea, y el tablero los nombra.`);
  await escena.alejar();
  fondo.activar(plaura);

  // --- 3. simulacro: un error a propósito y el reclamo ---
  avance("simulacro");
  await escena.callar();
  await escena.E("telon", true, "seccion", "¿Y si algo sale mal?", "En otra corrida del simulador forzamos un error: bloquear por IP una IP compartida.");
  await g.esperar(3.6);
  g.pausar();
  const S = await levantar("simulacro", { inicioMin: 9.5, simulacro: true });
  const stab = await escena.marco("stab", false);
  const slaura = await escena.marco("slaura", true);
  const tokenS = await token(S, LAURA);
  // Las filtraciones que no son el error se firman fuera de cuadro, con el mismo ingreso.
  await esperarHasta("las filtraciones del simulacro", async () => (await cola(S, tokenS)).pendientes.length >= 3, 40);
  for (const m of (await cola(S, tokenS)).pendientes.filter((x) => !x.simulacro)) {
    await json(`http://127.0.0.1:${S.puerto}/api/juez/medidas/${encodeURIComponent(m.id)}/aprobar`, { token: tokenS, cuerpo: { huella: m.huella } });
  }
  await ingresar(escena, stab, origen("tablero", S), FISCALIA, "/tablero");
  await ingresar(escena, slaura, origen("jueza", S), LAURA, "/juez");
  await esperarTarjeta(slaura, "Nueva filtración, simulacro", 30);
  await escena.tableroYJuez(stab, slaura, "Celular de la jueza de turno");
  await escena.E("contexto", `Simulacro de reclamos, otra corrida del simulador oficial, tiempo ×${ACELERAR}`);
  await dormir(1500);
  g.seguir();
  await escena.E("telon", false);
  await g.esperar(0.6);
  await escena.foco(await escena.rect(slaura, ".tarjeta .aviso-simulacro", { margen: 6 }));
  g.marcar("Simulacro");
  await escena.decir("La tarjeta marca el riesgo en rojo. Se firma igual: es el error a propósito.");
  await escena.sinFoco();
  await firmarAMano(escena, slaura);
  await escena.enfocar(await escena.rect(stab, ".tb-regla", { hasta: ".tb-expediente", margen: 14 }), 1.5);
  // Hasta que llega el reclamo pasan unos tres minutos de partido: se ven en cámara rápida.
  g.velocidad(8);
  await escena.E("rapido", "×8");
  await escena.decir("El bloqueo por IP se aplica, y los sitios que comparten esa IP dejan de cargar.");
  await esperarTarjeta(slaura, "Reclamo", 120);
  g.velocidad(1);
  await escena.E("rapido", null);
  await escena.alejar();
  await g.esperar(0.5);
  await escena.foco(await escena.rect(slaura, ".tarjeta .titular", { hasta: ".tarjeta .verif", margen: 8 }));
  g.marcar("Reclamo");
  await escena.decir("Un sitio legítimo reclama. Offside lo verifica y propone levantar la orden.");
  await escena.sinFoco();
  await firmarAMano(escena, slaura);
  await escena.enfocar(await escena.rect(stab, ".tb-filtraciones", { margen: 4 }), 1.4);
  g.marcar("Levantamiento");
  await escena.decir("Se levanta en todos los proveedores y se reemplaza por el dominio. El pirata sigue bloqueado.", { minimo: 6 });
  await escena.alejar();
  await escena.callar();

  // --- 4. de vuelta al partido: el salto de servidor ---
  avance("salto de servidor");
  // La ampliación del minuto 37 se firma a la vista: el juez de fondo deja de mirar a la jueza
  // ya (hasta el 37 no le llega nada nuevo), así la cámara rápida no se la puede ganar.
  fondo.desactivar(plaura);
  await escena.corte(async () => {
    apagar(S);
    await escena.E("cargar", "stab", "about:blank");
    await escena.E("cargar", "slaura", "about:blank");
    await escena.tableroYJuez(ptab, plaura, "Celular de la jueza de turno");
    await escena.E("contexto", `Partido de práctica, simulador oficial, tiempo ×${ACELERAR}`);
  });
  const rapido1 = Math.max(4, Math.round(((36.8 - (await minutoDe(P))) * 60) / ACELERAR / 5.4));
  g.velocidad(rapido1);
  await escena.E("rapido", `×${rapido1}`);
  await escena.decir("Volvemos al partido, en cámara rápida: confirman los proveedores lentos.", { minimo: 2 });
  await esperarMinuto(P, 36.8, 400);
  g.velocidad(1);
  await escena.E("rapido", null);
  await escena.callar();
  await esperarTarjeta(plaura, "Ampliación", 60);
  await frameDe(plaura).evaluate(() => window.scrollTo({ top: 0 }));
  await g.esperar(0.4);
  await escena.foco(await escena.rect(plaura, ".tarjeta .recorrido", { hasta: ".tarjeta .que-cambio", margen: 10 }));
  g.marcar("Salto de servidor");
  await escena.decir("Minuto 37: el pirata cambia de servidor. Misma marca de agua: es una ampliación.");
  await escena.sinFoco();
  await firmarAMano(escena, plaura);
  await escena.enfocar(await escena.rect(ptab, ".tb-regla", { hasta: ".tb-expediente", margen: 14 }), 1.6);
  await escena.decir("Un toque. Perseguimos la filtración, no el servidor.");
  await escena.alejar();
  await escena.callar();

  // --- 5. cambio de turno ---
  avance("cambio de turno");
  fondo.activar(plaura);
  // Se llega al cambio unos cinco segundos antes del minuto 50, para ver las dos pantallas cambiar.
  const antesDelCambio = 50 - (5 * ACELERAR) / 60;
  const rapido2 = Math.max(4, Math.round(((antesDelCambio - (await minutoDe(P))) * 60) / ACELERAR / 3.5));
  g.velocidad(rapido2);
  await escena.E("rapido", `×${rapido2}`);
  await esperarMinuto(P, antesDelCambio, 300);
  fondo.desactivar(plaura);
  await escena.corte(async () => {
    g.velocidad(1);
    await escena.E("rapido", null);
    // El despacho de la última firma tapa el aviso de fuera de turno: se oculta, como haría la jueza.
    const ocultar = frameDe(plaura).getByRole("button", { name: "Ocultar el despacho" });
    if (await ocultar.isVisible()) await ocultar.dispatchEvent("click");
    await escena.dosJueces(plaura, `${LAURA.nombre}, de turno hasta el minuto 50`, pmartin, `${MARTIN.nombre}, desde el minuto 50`);
  });
  g.marcar("Cambio de turno");
  await escena.decir("Minuto 50: cambia el turno. La jueza saliente ya no puede firmar; firma el entrante.", { minimo: 5.5 });
  await esperarMinuto(P, 50.15, 30);
  await g.esperar(1.2);
  await escena.callar();
  fondo.activar(pmartin);

  // --- 6. hasta el pitazo final ---
  avance("hasta el final");
  await escena.corte(async () => {
    await escena.tableroYJuez(ptab, pmartin, "Celular del juez de turno");
  });
  const rapido3 = Math.max(4, Math.round(((104.55 - (await minutoDe(P))) * 60) / ACELERAR / 6.2));
  g.velocidad(rapido3);
  await escena.E("rapido", `×${rapido3}`);
  await escena.decir("Hasta el final, el juez de turno firma cada salto y cada filtración nueva.", { minimo: 2 });
  await esperarMinuto(P, 104.55, 900);
  g.velocidad(1);
  await escena.E("rapido", null);
  await escena.callar();
  await esperarMinuto(P, 104.9, 30);
  g.marcar("Pitazo final");
  const pitazo = escena.decir("Pitazo final: a los 105′ todas las órdenes vencen solas.", { minimo: 5.4 });
  await esperarHasta("que el juez vea el partido terminado", async () => frameDe(pmartin).locator(".cabeza-final").isVisible(), 30);
  await g.esperar(0.8);
  await escena.foco(await escena.rect(ptab, ".tb-reloj", { margen: 10 }), await escena.rect(pmartin, ".cabeza-final", { margen: 6 }));
  await pitazo;
  await g.esperar(1.2);
  await escena.sinFoco();
  await escena.callar();
  fondo.detener();

  // --- 7. verificadores: se corren de verdad, cuando el simulador cierra la ventana ---
  avance("verificadores");
  await escena.E("velo", true);
  await g.esperar(0.32);
  g.pausar();
  await esperarHasta(
    "que el simulador cierre la ventana posterior al partido",
    async () => readFileSync(join(RAIZ, P.registroRel), "utf8").includes('"ventana_cerrada"'),
    200,
  );
  await dormir(1500);
  const verificar = join(".simulador", "desafio-futbol", "evaluacion", "verificar.py");
  const oficial = correr("python3", [verificar, "--log", P.registroRel], "verificador-oficial.txt");
  const oficialJson = JSON.parse(execFileSync("python3", [verificar, "--log", P.registroRel, "--json"], { cwd: RAIZ, encoding: "utf8" })) as Resumen;
  const exportacion = join(SALIDA_REL, "exportacion");
  const alterada = join(SALIDA_REL, "exportacion-alterada");
  rmSync(join(RAIZ, exportacion), { recursive: true, force: true });
  rmSync(join(RAIZ, alterada), { recursive: true, force: true });
  const exportar = correr("pnpm", ["-s", "exportar", "--", "--carpeta", exportacion, "--db", P.dbRel, "--nota", "Partido de práctica del video"], "exportacion.txt");
  const independiente = ["herramientas/verificar_expediente.py", "--juzgados", "config/jueces.demo.json", "--registro", P.registroRel];
  const verifOk = correr("python3", [independiente[0]!, exportacion, ...independiente.slice(1)], "verificador-independiente.txt");
  // La alteración: una letra del medio de la captura de la primera detección, en una copia.
  cpSync(join(RAIZ, exportacion), join(RAIZ, alterada), { recursive: true });
  const archivoExp = "expediente-EXP-2026-000001.json";
  const textoExp = readFileSync(join(RAIZ, alterada, archivoExp), "utf8");
  const clave = 'contenido_b64\\":\\"';
  const posicion = textoExp.indexOf(clave) + clave.length + 24;
  if (posicion < clave.length + 24) throw new Error("No se encontró la captura en el expediente exportado.");
  const letra = textoExp[posicion]!;
  const otra = letra === "A" ? "B" : "A";
  writeFileSync(join(RAIZ, alterada, archivoExp), textoExp.slice(0, posicion) + otra + textoExp.slice(posicion + 1));
  const cmp = correr("cmp", [join(exportacion, archivoExp), join(alterada, archivoExp)], "cmp.txt");
  const verifMal = correr("python3", [independiente[0]!, alterada, ...independiente.slice(1)], "verificador-independiente-alterada.txt");
  if (verifMal.codigo === 0 || verifOk.codigo !== 0) throw new Error("El verificador independiente no dio lo esperado; ver salida/video/salidas.");

  // Primero la transparencia (el partido terminó y todo venció), después la prueba.
  await escena.E("contexto", "Registro público, sin ingreso");
  await frameDe(ptab).goto(`${origen("publico", P)}/transparencia`);
  await frameDe(ptab).locator(".tr-tabla").waitFor();
  await escena.pagina1(ptab, "Transparencia, abierta a cualquiera");
  await dormir(700);
  await escena.enfocar(await escena.rect(ptab, ".tr-titular", { hasta: ".tr-panel", margen: 16 }), 1.3);
  await dormir(1100);
  g.seguir();
  await escena.E("velo", false);
  await g.esperar(0.3);
  g.marcar("Transparencia");
  await escena.decir("Qué se bloqueó, por orden de quién y hasta cuándo, a la vista de todos.", { minimo: 4.2 });

  // El expediente: la huella de lo que vio la jueza, dentro del identificador de cada orden.
  await escena.corte(async () => {
    await escena.alejar();
    await escena.E("contexto", "Expediente EXP-2026-000001, en pantalla");
    const f = frameDe(ptab);
    await f.goto(`${origen("tablero", P)}/expediente/EXP-2026-000001`);
    await f.locator(".acto .bloque-huella").first().waitFor();
    await f.evaluate(() => {
      const b = document.querySelector(".acto .bloque-huella")!;
      window.scrollTo({ top: b.getBoundingClientRect().top + window.scrollY - 40 });
    });
    await escena.pagina1(ptab, "Expediente, tal como lo ve la fiscalía");
    await dormir(500);
    await escena.enfocar(await escena.rect(ptab, ".acto .bloque-huella", { hasta: ".acto .tabla-ordenes", margen: 14 }), 1.45);
    await dormir(1100);
  });
  const huella = await escena.rect(ptab, ".acto .bloque-huella", { margen: 6 });
  const sufijo = await escena.rect(ptab, ".acto .tabla-ordenes .tabla-id .sin-corte", { n: 1, margen: 5 });
  await escena.foco(huella, sufijo);
  g.marcar("La huella en la orden");
  await escena.decir("La huella de lo que vio la jueza viaja dentro de cada orden firmada.", { minimo: 4.6 });
  await escena.sinFoco();

  // Exportación y verificador independiente.
  const anclas = /ancla la auditoría:/;
  await escena.corte(async () => {
    await escena.alejar();
    await escena.E("mostrar", []);
    await escena.E(
      "terminal",
      true,
      "  offside",
      `${comando(`pnpm -s exportar -- --carpeta ${exportacion} --db ${P.dbRel} --nota "Partido de práctica del video"`)}\n${colorear(exportar.texto)}\n\n${comando(`python3 ${independiente[0]} ${exportacion} ${independiente.slice(1).join(" ")}`)}\n${colorear(verifOk.texto, anclas)}`,
    );
    await escena.E("contexto", "Verificador independiente, sin código compartido con Offside");
  });
  g.marcar("Verificador independiente");
  await escena.decir("Un verificador independiente recalcula todo y lo cruza con el registro del simulador.", { minimo: 3.2 });
  if ((await escena.E("terminalAlFinal")) as number) await g.esperar(3.2);

  // Un carácter cambiado.
  await escena.corte(async () => {
    await escena.E(
      "terminal",
      true,
      "  offside",
      `${comentario(`# En una copia de la exportación se cambia un carácter de la captura de D-0001: "${letra}" por "${otra}".`)}\n${comando(`cmp ${join(exportacion, archivoExp)} ${join(alterada, archivoExp)}`)}\n${escapar(cmp.texto)}\n\n${comando(`python3 ${independiente[0]} ${alterada} ${independiente.slice(1).join(" ")}`)}\n${colorear(verifMal.texto, anclas)}`,
    );
  });
  g.marcar("Un carácter alterado");
  await escena.decir("Cambiamos un solo carácter de la evidencia. El verificador lo detecta y dice dónde.", { minimo: 5.2 });

  // Cierre: la salida completa del verificador oficial, sobre este mismo partido.
  const r = oficialJson.resumen;
  const claves = /fases piratas bloqueadas|dano colateral|dominios legitimos afectados|falsos positivos|ip activos post partido|firmadas fuera de turno:|Ningún bloqueo afectó|Por ip \(deberían/;
  await escena.corte(async () => {
    await escena.E(
      "terminal",
      true,
      "  offside, sobre el registro que escribió el simulador en este partido",
      `${comando(`python3 ${verificar} --log ${P.registroRel}`)}\n${colorear(oficial.texto, claves)}`,
    );
    await escena.E("contexto", "Verificador oficial del desafío");
  });
  g.marcar("Verificador oficial");
  const cero = (v: unknown) => (v === 0 ? "cero" : String(v));
  const [bloqueadas, de] = String(r.fases_piratas_bloqueadas).split(" de ");
  await escena.decir(
    `Verificador oficial, sobre este partido: ${bloqueadas} de ${de} fases piratas bloqueadas, ${cero(r.bloqueos_con_dano_colateral)} daño colateral, ${cero(r.bloqueos_falsos_positivos)} falsos positivos y ${cero(r.ordenes_firmadas_fuera_de_turno)} órdenes fuera de turno.`,
    { minimo: 6 },
  );
  await escena.E("terminalAlFinal");
  await g.esperar(1.2);
  g.marcar("Cierre");
  await escena.decir("Offside: rápido como Italia, con juez como Francia y sin daño colateral.", { minimo: 4.2 });
  const total = g.t;
  await g.parar();
  apagar(P);

  // --- montaje ---
  console.log(`Grabados ${g.cuadros.length} cuadros, ${total.toFixed(1)} s de video. Montando…`);
  const lista: string[] = [];
  g.cuadros.forEach((c, i) => {
    const hasta = i + 1 < g.cuadros.length ? g.cuadros[i + 1]!.t : total;
    lista.push(`file '${c.archivo}'`, `duration ${Math.max(0.001, hasta - c.t).toFixed(4)}`);
  });
  lista.push(`file '${g.cuadros.at(-1)!.archivo}'`);
  writeFileSync(join(CUADROS, "lista.txt"), `${lista.join("\n")}\n`);
  const video = join(SALIDA, "offside-demo.mp4");
  execFileSync(
    "ffmpeg",
    ["-y", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", "lista.txt", "-vf", "fps=30,format=yuv420p", "-c:v", "libx264", "-preset", "slow", "-crf", "17", "-tune", "stillimage", "-movflags", "+faststart", video],
    { cwd: CUADROS },
  );

  if (VOZ && g.voces.length > 0) {
    const entradas: string[] = [];
    const filtros: string[] = [];
    g.voces.forEach((v, i) => {
      entradas.push("-i", v.archivo);
      const ms = Math.round(v.t * 1000);
      filtros.push(`[${i + 1}:a]aresample=48000,adelay=${ms}|${ms}[a${i}]`);
    });
    const mezcla = `${filtros.join(";")};${g.voces.map((_, i) => `[a${i}]`).join("")}amix=inputs=${g.voces.length}:normalize=0,apad[a]`;
    execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-i", video, ...entradas, "-filter_complex", mezcla, "-map", "0:v", "-map", "[a]", "-c:v", "copy", "-c:a", "aac", "-b:a", "160k", "-shortest", "-movflags", "+faststart", join(SALIDA, "offside-demo-narrado.mp4")]);
  }

  // --- hoja de contacto ---
  mkdirSync(join(TMP, "hoja"), { recursive: true });
  const cuadros = g.marcas.map((m, i) => {
    const archivo = `h${String(i + 1).padStart(2, "0")}.png`;
    const t = Math.min(total - 0.05, m.t + 1.1);
    execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-ss", t.toFixed(2), "-i", video, "-frames:v", "1", "-vf", "scale=960:-1", join(TMP, "hoja", archivo)]);
    return { archivo, tiempo: tiempo(t), etiqueta: m.etiqueta };
  });
  escenario.pagina(paginaFotogramas(cuadros, tiempo(total)));
  const hoja = await contexto.newPage();
  await hoja.setViewportSize({ width: 2200, height: 1200 });
  await hoja.goto(`${escenario.url}/hoja`);
  await hoja.evaluate(() => Promise.all([document.fonts.ready, ...[...document.images].map((i) => i.decode())]));
  await hoja.screenshot({ path: join(SALIDA, "fotogramas.png"), fullPage: true });
  await navegador.close();
  escenario.cerrar();
  terminarTodo();
  if (!CONSERVAR) rmSync(TMP, { recursive: true, force: true });

  console.log(`\nVideo listo, ${tiempo(total)}:`);
  console.log(`  ${join(SALIDA_REL, "offside-demo.mp4")}`);
  if (VOZ) console.log(`  ${join(SALIDA_REL, "offside-demo-narrado.mp4")}`);
  console.log(`  ${join(SALIDA_REL, "fotogramas.png")}`);
  console.log(`Firmas de fondo (en cámara rápida): ${fondo.firmadas}.`);
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
