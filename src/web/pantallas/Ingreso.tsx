// Ingreso de jueces y fiscalía. La sesión queda en esta pestaña: dos jueces pueden
// estar abiertos en dos pestañas del mismo navegador.

import { type FormEvent, useEffect, useState } from "react";
import { Link, Navigate, useLocation } from "react-router-dom";
import type { EstadoDTO, RespuestaIngreso } from "../../compartido/tipos.ts";
import { Marca, RelojPartido, useFondo, useTitulo } from "../componentes/comunes.tsx";
import { ErrorApi, guardarSesion, pedir } from "../nucleo/api.ts";
import { partidoBreve } from "../nucleo/formato.ts";
import { sincronizarReloj } from "../nucleo/reloj.ts";
import { inicioDe, useSesion } from "../nucleo/sesion.ts";
import { prepararSonido } from "../nucleo/sonido.ts";
import { useVivo } from "../nucleo/vivo.ts";

export function Ingreso() {
  useFondo("aluminio");
  useTitulo("Offside, ingreso");
  const sesion = useSesion();
  const ubicacion = useLocation();
  const [usuario, setUsuario] = useState("");
  const [contrasena, setContrasena] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { datos: estado } = useVivo<EstadoDTO>(sesion ? null : "/api/estado", { publica: true, alRecibir: sincronizarReloj });

  useEffect(() => {
    prepararSonido();
  }, []);

  if (sesion) {
    const desde = (ubicacion.state as { desde?: string } | null)?.desde;
    const permitido = desde && (sesion.usuario.rol === "juez" || !desde.startsWith("/juez"));
    return <Navigate to={permitido ? desde : inicioDe(sesion.usuario.rol)} replace />;
  }

  const ingresar = async (e: FormEvent) => {
    e.preventDefault();
    if (enviando) return;
    if (!usuario.trim() || !contrasena) {
      setError(!usuario.trim() && !contrasena ? "Escribí tu usuario y tu contraseña." : !usuario.trim() ? "Escribí tu usuario." : "Escribí tu contraseña.");
      return;
    }
    setEnviando(true);
    setError(null);
    try {
      const r = await pedir<RespuestaIngreso>("/api/ingreso", {
        metodo: "POST",
        publica: true,
        cuerpo: { usuario: usuario.trim(), contrasena },
      });
      guardarSesion({ token: r.token, usuario: r.usuario });
    } catch (causa) {
      const codigo = causa instanceof ErrorApi ? causa.codigo : 0;
      setError(codigo === 401 ? "Usuario o contraseña incorrectos." : causa instanceof ErrorApi ? causa.message : "No se pudo ingresar.");
      setEnviando(false);
    }
  };

  return (
    <main className="ingreso">
      <section className="ingreso-tarjeta" aria-labelledby="titulo-ingreso">
        <h1 id="titulo-ingreso" className="sr-only">
          Ingreso a Offside
        </h1>
        <Marca />
        <p className="ingreso-sub">Ingreso de jueces y fiscalía</p>

        <form onSubmit={ingresar} noValidate>
          <label className="campo-rotulo" htmlFor="usuario">
            Usuario
          </label>
          <input
            id="usuario"
            className="campo"
            name="usuario"
            autoComplete="username"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            autoFocus
            required
            value={usuario}
            onChange={(e) => setUsuario(e.target.value)}
          />
          <label className="campo-rotulo" htmlFor="contrasena">
            Contraseña
          </label>
          <input
            id="contrasena"
            className="campo"
            name="contrasena"
            type="password"
            autoComplete="current-password"
            required
            value={contrasena}
            onChange={(e) => setContrasena(e.target.value)}
          />
          {error && (
            <p role="alert" className="ingreso-error">
              {error}
            </p>
          )}
          <button type="submit" className="boton boton-grafito" aria-disabled={enviando || undefined}>
            <span>{enviando ? "Ingresando…" : "Ingresar"}</span>
          </button>
        </form>

        {estado?.partido && (
          <p className="ingreso-partido">
            <span>{partidoBreve(estado.partido.nombre)}</span>
            <RelojPartido estado={estado} />
          </p>
        )}
      </section>
      <p className="ingreso-pie">
        Sin usuario se puede ver el <Link to="/transparencia">registro público de bloqueos</Link>.
        <small>La sesión vale solo para esta pestaña. Datos ficticios del simulador oficial del desafío.</small>
      </p>
    </main>
  );
}
