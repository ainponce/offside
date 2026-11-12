// Agrega una voz en off (ElevenLabs) a salida/video/offside-demo.mp4, sin regrabar el partido.
//
//   ELEVENLABS_API_KEY=... pnpm video:voz [-- --voz <voice_id>]
//
// 1. Lee del propio video cuándo está cada subtítulo en pantalla (la franja del subtítulo,
//    cuadro por cuadro): así los tiempos son los del archivo, no los de un guion aproximado.
// 2. Genera una frase hablada por subtítulo y la guarda en salida/video/voz/ con un nombre que
//    depende del texto, la voz y los ajustes: al repetir, solo se pide a la API lo que cambió.
// 3. Si una frase no entra en su subtítulo, la acelera hasta ×1,12; si ni así entra, falla y
//    dice cuál acortar.
// 4. Mezcla todo en salida/video/offside-demo-voz.mp4 (video copiado tal cual, AAC a -16 LUFS)
//    y comprueba con silencedetect que ninguna frase se pisa con otra ni sale de su subtítulo.

import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const RAIZ = resolve(import.meta.dirname, "..");
const SALIDA = join(RAIZ, "salida", "video");
const VIDEO = join(SALIDA, "offside-demo.mp4");
const FINAL = join(SALIDA, "offside-demo-voz.mp4");
const VOZ_DIR = join(SALIDA, "voz");

function argumento(nombre: string, porDefecto: string): string {
  const i = process.argv.indexOf(`--${nombre}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1]! : porDefecto;
}
const VOZ = argumento("voz", "nPczCjzI2devNBz1zQrb"); // Brian
const MODELO = "eleven_multilingual_v2";
const AJUSTES = { stability: 0.5, similarity_boost: 0.75 };
const TEMPO_MAX = 1.12;
const ENTRADA = 0.15; // la voz arranca un poco después de que aparece el subtítulo
const AIRE = 0.25; // y termina antes de que cambie

/** Una frase por subtítulo, en el orden del video (los subtítulos están en scripts/video.ts). */
const FRASES = [
  "Un partido dura dos horas. Un pirata cambia de servidor en minutos.",
  "Offside lee las detecciones del simulador y abre un expediente por cada filtración.",
  "La jueza de turno lo recibe en el celular, con el pedido y cuatro verificaciones.",
  "Firma, y sale una orden a cada proveedor, con el tipo de bloqueo que admite.",
  "Cada proveedor confirma por su cuenta. Si uno falla, se reintenta solo.",
  "Lo que no es pirata se archiva solo, como el licenciatario en su dominio.",
  "Este pirata comparte la IP con once sitios ajenos. Por eso se bloquea solo el dominio.",
  "Daño evitado: esos once sitios siguen en línea, y el tablero los nombra.",
  "La tarjeta marca el riesgo en rojo. Se firma igual: es el error a propósito.",
  "El bloqueo por IP se aplica, y los sitios que comparten esa IP dejan de cargar.",
  "Un sitio legítimo reclama. Offside lo verifica y propone levantar la orden.",
  "Se levanta en todos los proveedores y pasa a bloqueo por dominio. El pirata sigue bloqueado.",
  "Volvemos al partido en cámara rápida: confirman los proveedores lentos.",
  "Minuto treinta y siete: el pirata cambia de servidor. Misma marca: es una ampliación.",
  "Un toque. Perseguimos la filtración, no el servidor.",
  "Minuto cincuenta: cambia el turno. La jueza saliente ya no puede firmar; firma el entrante.",
  "Hasta el final, el juez de turno firma cada salto y cada filtración nueva.",
  "Pitazo final: a los ciento cinco minutos, todas las órdenes vencen solas.",
  "Qué se bloqueó, por orden de quién y hasta cuándo, a la vista de todos.",
  "La huella de lo que vio la jueza viaja dentro de cada orden firmada.",
  "Un verificador independiente recalcula todo y lo cruza con el registro del simulador.",
  "Cambiamos un solo carácter de la evidencia. El verificador lo detecta, y dice dónde.",
  "Verificador oficial, sobre este partido: siete de siete fases bloqueadas, cero daño colateral, cero falsos positivos y cero órdenes fuera de turno.",
  "Offside: rápido como Italia, con juez como Francia y sin daño colateral.",
];

const ff = (args: string[]) => execFileSync("ffmpeg", ["-hide_banner", "-y", ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], maxBuffer: 1 << 28 });
const duracion = (archivo: string) =>
  Number.parseFloat(execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", archivo], { encoding: "utf8" }));

/** Intervalos del subtítulo en pantalla: la franja de abajo, reducida a gris, cuadro por cuadro. */
function subtitulos(): { desde: number; hasta: number }[] {
  const W = 400, H = 34, N = W * H, FPS = 30;
  const crudo = execFileSync("ffmpeg", ["-v", "error", "-i", VIDEO, "-vf", `crop=1600:136:160:924,scale=${W}:${H}:flags=area,format=gray,fps=${FPS}`, "-f", "rawvideo", "-"], { maxBuffer: 1 << 28 });
  const n = Math.floor(crudo.length / N);
  const tramos: { desde: number; hasta: number }[] = [];
  let abierto: number | null = null;
  let previo: Buffer | null = null;
  for (let i = 0; i < n; i++) {
    const f = crudo.subarray(i * N, (i + 1) * N);
    let oscuros = 0, dif = 0;
    for (let k = 0; k < N; k++) {
      if (f[k]! < 140) oscuros++;
      if (previo) dif += Math.abs(f[k]! - previo[k]!);
    }
    dif /= N;
    previo = f;
    const t = i / FPS;
    const hayTexto = oscuros > 30;
    if (abierto === null && hayTexto) abierto = t;
    else if (abierto !== null && !hayTexto) {
      tramos.push({ desde: abierto, hasta: t });
      abierto = null;
    } else if (abierto !== null && dif > 5 && t - abierto > 1) {
      // El texto cambió de golpe: termina un subtítulo y empieza otro.
      tramos.push({ desde: abierto, hasta: t });
      abierto = t;
    }
  }
  if (abierto !== null) tramos.push({ desde: abierto, hasta: n / FPS });
  return tramos.filter((s) => s.hasta - s.desde > 1);
}

async function clip(texto: string, clave: string): Promise<string> {
  const mp3 = join(VOZ_DIR, `${clave}.mp3`);
  if (existsSync(mp3)) return mp3;
  const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${VOZ}?output_format=mp3_44100_128`, {
    method: "POST",
    headers: { "xi-api-key": process.env.ELEVENLABS_API_KEY!, "Content-Type": "application/json", Accept: "audio/mpeg" },
    body: JSON.stringify({ text: texto, model_id: MODELO, language_code: "es", voice_settings: AJUSTES }),
  });
  if (!r.ok) throw new Error(`ElevenLabs respondió ${r.status} para "${texto}": ${(await r.text()).slice(0, 300)}`);
  writeFileSync(mp3, Buffer.from(await r.arrayBuffer()));
  console.log(`  generada: ${texto}`);
  return mp3;
}

async function principal(): Promise<void> {
  if (!process.env.ELEVENLABS_API_KEY) {
    console.error("Falta ELEVENLABS_API_KEY en el entorno (la clave de ElevenLabs no se guarda en el repositorio).");
    process.exit(2);
  }
  if (!existsSync(VIDEO)) throw new Error(`Falta ${VIDEO} (pnpm video).`);
  mkdirSync(VOZ_DIR, { recursive: true });

  const segs = subtitulos();
  if (segs.length !== FRASES.length) {
    throw new Error(`El video tiene ${segs.length} subtítulos y hay ${FRASES.length} frases: revisá FRASES en scripts/narrar.ts.`);
  }

  const total = duracion(VIDEO);
  const colocadas: { desde: number; hasta: number; wav: string; seg: { desde: number; hasta: number }; tempo: number }[] = [];
  const largas: string[] = [];
  for (const [i, texto] of FRASES.entries()) {
    const seg = segs[i]!;
    const clave = createHash("sha256").update(JSON.stringify({ texto, VOZ, MODELO, AJUSTES })).digest("hex").slice(0, 16);
    const mp3 = await clip(texto, clave);
    // Sin silencio al principio ni al final: se mide lo que se oye.
    const recorte = "silenceremove=start_periods=1:start_threshold=-45dB,areverse,silenceremove=start_periods=1:start_threshold=-45dB,areverse";
    const limpio = join(VOZ_DIR, `${clave}.wav`);
    if (!existsSync(limpio)) ff(["-v", "error", "-i", mp3, "-af", `${recorte},aresample=48000`, "-ac", "1", limpio]);
    const habla = duracion(limpio);
    const lugar = seg.hasta - seg.desde - ENTRADA - AIRE;
    let tempo = 1;
    let wav = limpio;
    if (habla > lugar) {
      tempo = Math.min(TEMPO_MAX, habla / lugar);
      wav = join(VOZ_DIR, `${clave}-x${tempo.toFixed(3)}.wav`);
      if (!existsSync(wav)) ff(["-v", "error", "-i", limpio, "-af", `atempo=${tempo.toFixed(4)}`, wav]);
    }
    const dura = duracion(wav);
    const desde = seg.desde + ENTRADA;
    if (desde + dura > seg.hasta - AIRE + 0.01) largas.push(`#${i + 1} (${dura.toFixed(2)} s en ${lugar.toFixed(2)} s): ${texto}`);
    colocadas.push({ desde, hasta: desde + dura, wav, seg, tempo });
    console.log(`#${String(i + 1).padStart(2)} ${seg.desde.toFixed(2)}-${seg.hasta.toFixed(2)}  voz ${habla.toFixed(2)} s${tempo > 1 ? ` ×${tempo.toFixed(3)} → ${dura.toFixed(2)} s` : ""}`);
  }
  if (largas.length) throw new Error(`Estas frases no entran ni a ×${TEMPO_MAX}; acortalas:\n${largas.join("\n")}`);

  // Mezcla: cada frase en su lugar, normalizada a -16 LUFS, del largo exacto del video.
  const entradas = colocadas.flatMap((c) => ["-i", c.wav]);
  const filtros = colocadas.map((c, i) => `[${i + 1}:a]adelay=${Math.round(c.desde * 1000)}:all=1[a${i}]`);
  const mezcla = `${filtros.join(";")};${colocadas.map((_, i) => `[a${i}]`).join("")}amix=inputs=${colocadas.length}:normalize=0,apad,atrim=0:${total.toFixed(3)},loudnorm=I=-16:TP=-1.5:LRA=11,aresample=48000[a]`;
  ff(["-v", "error", "-i", VIDEO, ...entradas, "-filter_complex", mezcla, "-map", "0:v", "-map", "[a]", "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-ar", "48000", "-movflags", "+faststart", FINAL]);

  // Comprobación: intervalos con voz en el archivo final.
  const det = execFileSync("sh", ["-c", `ffmpeg -hide_banner -i "$0" -af silencedetect=noise=-40dB:d=0.35 -f null - 2>&1`, FINAL], { encoding: "utf8" });
  const ini = [...det.matchAll(/silence_start: ([\d.]+)/g)].map((m) => Number(m[1]));
  const fin = [...det.matchAll(/silence_end: ([\d.]+)/g)].map((m) => Number(m[1]));
  const hablas: { desde: number; hasta: number }[] = [];
  let cursor = 0;
  for (let k = 0; k < ini.length; k++) {
    if (ini[k]! > cursor + 0.05) hablas.push({ desde: cursor, hasta: ini[k]! });
    cursor = fin[k] ?? total;
  }
  if (cursor < total - 0.05) hablas.push({ desde: cursor, hasta: total });
  const voz = hablas.filter((h) => h.desde > 0.05 || h.hasta - h.desde > 0.2);
  const problemas: string[] = [];
  colocadas.forEach((c, i) => {
    const suyas = voz.filter((h) => h.hasta > c.desde - 0.1 && h.desde < c.hasta + 0.1);
    if (!suyas.length) return problemas.push(`#${i + 1}: no se detecta voz`);
    const a = Math.min(...suyas.map((h) => h.desde));
    const b = Math.max(...suyas.map((h) => h.hasta));
    if (a < c.seg.desde || a > c.seg.hasta) problemas.push(`#${i + 1}: arranca en ${a.toFixed(2)}, fuera de su subtítulo`);
    if (b > c.seg.hasta + 0.05) problemas.push(`#${i + 1}: termina en ${b.toFixed(2)}, después de su subtítulo (${c.seg.hasta.toFixed(2)})`);
    const siguiente = colocadas[i + 1];
    if (siguiente && b > siguiente.desde) problemas.push(`#${i + 1} se pisa con #${i + 2}`);
  });
  const final = duracion(FINAL);
  console.log(`\n${FINAL.slice(RAIZ.length + 1)}: ${Math.floor(final / 60)}:${(final % 60).toFixed(1).padStart(4, "0")}`);
  console.log(`Aceleradas: ${colocadas.filter((c) => c.tempo > 1).length} de ${colocadas.length}.`);
  if (final >= 180) problemas.push("dura 3:00 o más");
  if (problemas.length) {
    console.error(`Problemas:\n  ${problemas.join("\n  ")}`);
    process.exit(1);
  }
  console.log("Comprobado: ninguna frase se pisa y cada una arranca y termina dentro de su subtítulo.");
}

principal().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
