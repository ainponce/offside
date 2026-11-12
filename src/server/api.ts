// Rutas HTTP de Offside. El contrato está en src/compartido/tipos.ts.

import { existsSync, readFileSync, statSync } from "node:fs";
import { extname, join, normalize, resolve, sep } from "node:path";
import { type Context, Hono } from "hono";
import { streamSSE } from "hono/streaming";
import type { Rol } from "../compartido/tipos.ts";
import type { Contexto } from "./contexto.ts";
import { consultarIp } from "./geo.ts";
import { type Resultado, aprobarMedida, rechazarMedida, reconsiderarMedida } from "./decisiones.ts";
import type { Sesiones, UsuarioBase } from "./sesiones.ts";
import { colaDTO, estadoDTO, expedienteDTO, tableroDTO, transparenciaDTO, usuarioDTO } from "./vistas.ts";

/** Avisa a los navegadores conectados que algo cambió. */
export class Avisos {
  seq = 0;
  private readonly oyentes = new Set<() => void>();

  cambio(): void {
    this.seq += 1;
    for (const oyente of [...this.oyentes]) oyente();
  }

  /** Resuelve `true` cuando hay un cambio o `false` si pasaron `ms` sin novedades. */
  esperar(ms: number): Promise<boolean> {
    return new Promise((resolver) => {
      const oyente = () => {
        clearTimeout(reloj);
        this.oyentes.delete(oyente);
        resolver(true);
      };
      const reloj = setTimeout(() => {
        this.oyentes.delete(oyente);
        resolver(false);
      }, ms);
      this.oyentes.add(oyente);
    });
  }
}

const TIPOS_MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
  ".mp3": "audio/mpeg",
  ".webmanifest": "application/manifest+json",
};

const SIN_INTERFAZ = `<!doctype html><meta charset="utf-8"><title>Offside</title>
<body style="font-family:system-ui;max-width:40rem;margin:4rem auto;padding:0 1rem">
<h1>Offside</h1><p>La API está corriendo, pero la interfaz web todavía no se compiló.</p>
<p>Ejecutá <code>pnpm build</code> y recargá esta página.</p></body>`;

export function crearApi(
  ctx: Contexto,
  sesiones: Sesiones,
  opciones: { raizWeb?: string } = {},
): { app: Hono; avisos: Avisos } {
  const app = new Hono();
  const avisos = new Avisos();
  const previo = ctx.alCambiar;
  ctx.alCambiar = () => {
    previo();
    avisos.cambio();
  };

  const tokenDe = (c: Context): string | null => {
    const cabecera = c.req.header("Authorization") ?? "";
    return cabecera.startsWith("Bearer ") ? cabecera.slice(7).trim() : null;
  };

  /** Devuelve el usuario si tiene uno de los roles pedidos; si no, la respuesta de error. */
  const exigir = (c: Context, roles: Rol[]): UsuarioBase | Response => {
    const usuario = sesiones.porToken(tokenDe(c));
    if (!usuario) return c.json({ error: "Hace falta iniciar sesión." }, 401);
    if (!roles.includes(usuario.rol)) return c.json({ error: "Tu usuario no tiene acceso a esta función." }, 403);
    return usuario;
  };

  const responder = (c: Context, r: Resultado): Response =>
    r.ok ? c.json({ ok: true }) : c.json({ error: r.error }, r.codigo);

  // --- sesión -------------------------------------------------------------------------

  app.post("/api/ingreso", async (c) => {
    const cuerpo = (await c.req.json().catch(() => ({}))) as { usuario?: unknown; contrasena?: unknown };
    const sesion = sesiones.ingresar(cuerpo.usuario, cuerpo.contrasena);
    if (!sesion) return c.json({ error: "Usuario o contraseña incorrectos." }, 401);
    ctx.auditoria.registrar({
      minuto: ctx.estado.minuto,
      actor: sesion.usuario.juez_id ?? sesion.usuario.usuario,
      tipo: "ingreso",
      datos: { usuario: sesion.usuario.usuario, nombre: sesion.usuario.nombre, rol: sesion.usuario.rol },
    });
    return c.json({ token: sesion.token, usuario: usuarioDTO(ctx, sesion.usuario) });
  });

  app.post("/api/salida", (c) => {
    sesiones.salir(tokenDe(c));
    return c.json({ ok: true });
  });

  app.get("/api/yo", (c) => {
    const u = exigir(c, ["juez", "fiscalia"]);
    return u instanceof Response ? u : c.json(usuarioDTO(ctx, u));
  });

  // --- públicas -----------------------------------------------------------------------

  app.get("/api/estado", (c) => c.json(estadoDTO(ctx, avisos.seq)));
  app.get("/api/transparencia", (c) => c.json(transparenciaDTO(ctx, avisos.seq)));

  app.get("/api/eventos", (c) =>
    streamSSE(c, async (flujo) => {
      let abierto = true;
      flujo.onAbort(() => {
        abierto = false;
      });
      let visto = -1;
      while (abierto) {
        if (avisos.seq !== visto) {
          visto = avisos.seq;
          await flujo.writeSSE({ event: "cambio", data: JSON.stringify({ seq: visto }) });
        }
        const huboCambio = await avisos.esperar(5000);
        if (!huboCambio && abierto) await flujo.writeSSE({ event: "latido", data: "{}" });
      }
    }),
  );

  // --- juez ---------------------------------------------------------------------------

  app.get("/api/juez/cola", (c) => {
    const u = exigir(c, ["juez"]);
    return u instanceof Response ? u : c.json(colaDTO(ctx, u, avisos.seq));
  });

  app.post("/api/juez/medidas/:id/aprobar", async (c) => {
    const u = exigir(c, ["juez"]);
    if (u instanceof Response) return u;
    const cuerpo = (await c.req.json().catch(() => ({}))) as { huella?: unknown } | null;
    const huella = typeof cuerpo?.huella === "string" ? cuerpo.huella : undefined;
    return responder(c, await aprobarMedida(ctx, c.req.param("id"), u.juez_id!, huella));
  });

  app.post("/api/juez/medidas/:id/rechazar", async (c) => {
    const u = exigir(c, ["juez"]);
    if (u instanceof Response) return u;
    const cuerpo = (await c.req.json().catch(() => ({}))) as { motivo?: unknown };
    const motivo = typeof cuerpo.motivo === "string" ? cuerpo.motivo.slice(0, 300) : "";
    return responder(c, await rechazarMedida(ctx, c.req.param("id"), u.juez_id!, motivo));
  });

  app.post("/api/juez/medidas/:id/reconsiderar", async (c) => {
    const u = exigir(c, ["juez"]);
    if (u instanceof Response) return u;
    return responder(c, await reconsiderarMedida(ctx, c.req.param("id"), u.juez_id!));
  });

  // --- tablero y expedientes ------------------------------------------------------------

  // Consulta manual de la fiscalía: dónde está una IP cualquiera, con la misma base que el mapa.
  app.get("/api/geo", (c) => {
    const u = exigir(c, ["juez", "fiscalia"]);
    if (u instanceof Response) return u;
    const ip = (c.req.query("ip") ?? "").trim().slice(0, 64);
    return c.json(consultarIp(ip));
  });

  app.get("/api/tablero", (c) => {
    const u = exigir(c, ["juez", "fiscalia"]);
    return u instanceof Response ? u : c.json(tableroDTO(ctx, avisos.seq));
  });

  app.get("/api/expedientes/:id", (c) => {
    const u = exigir(c, ["juez", "fiscalia"]);
    if (u instanceof Response) return u;
    const expediente = expedienteDTO(ctx, c.req.param("id"), avisos.seq);
    return expediente ? c.json(expediente) : c.json({ error: "El expediente no existe." }, 404);
  });

  app.all("/api/*", (c) => c.json({ error: "Ruta inexistente." }, 404));

  // --- interfaz web ---------------------------------------------------------------------

  const raiz = opciones.raizWeb ? resolve(opciones.raizWeb) : null;
  app.get("*", (c) => {
    if (!raiz || !existsSync(join(raiz, "index.html"))) return c.html(SIN_INTERFAZ);
    const pedido = normalize(decodeURIComponent(new URL(c.req.url).pathname)).replace(/^([/\\])+/, "");
    let archivo = resolve(raiz, pedido);
    const adentro = archivo === raiz || archivo.startsWith(raiz + sep);
    if (!adentro || !existsSync(archivo) || !statSync(archivo).isFile()) archivo = join(raiz, "index.html");
    const tipo = TIPOS_MIME[extname(archivo)] ?? "application/octet-stream";
    const esIndice = archivo.endsWith("index.html");
    return c.body(new Uint8Array(readFileSync(archivo)), 200, {
      "Content-Type": tipo,
      "Cache-Control": esIndice ? "no-cache" : "public, max-age=31536000, immutable",
    });
  });

  app.onError((error, c) => {
    console.error("[api]", error);
    return c.json({ error: "Error interno." }, 500);
  });

  return { app, avisos };
}
