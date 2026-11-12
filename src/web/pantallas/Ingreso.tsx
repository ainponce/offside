// Ingreso con usuario y contraseña. La sesión queda en esta pestaña.

import { type FormEvent, useEffect, useState } from "react";
import { Link, Navigate, useLocation } from "react-router-dom";
import type { EstadoDTO, RespuestaIngreso } from "../../compartido/tipos.ts";
import { Marca, useTema, useTitulo } from "../componentes/comunes.tsx";
import { ErrorApi, guardarSesion, pedir } from "../nucleo/api.ts";
import { inicioDe, useSesion } from "../nucleo/sesion.ts";
import { prepararSonido } from "../nucleo/sonido.ts";

export function Ingreso() {
  useTema("papel");
  useTitulo("Offside · Ingreso");
  const sesion = useSesion();
  const ubicacion = useLocation();
  const [usuario, setUsuario] = useState("");
  const [contrasena, setContrasena] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [estado, setEstado] = useState<EstadoDTO | null>(null);

  useEffect(() => {
    prepararSonido();
    let vigente = true;
    pedir<EstadoDTO>("/api/estado", { publica: true })
      .then((e) => vigente && setEstado(e))
      .catch(() => {});
    return () => {
      vigente = false;
    };
  }, []);

  if (sesion) {
    const desde = (ubicacion.state as { desde?: string } | null)?.desde;
    const permitido = desde && (sesion.usuario.rol === "juez" || !desde.startsWith("/juez"));
    return <Navigate to={permitido ? desde : inicioDe(sesion.usuario.rol)} replace />;
  }

  const ingresar = async (e: FormEvent) => {
    e.preventDefault();
    if (enviando) return;
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
      setError(causa instanceof ErrorApi ? causa.message : "No se pudo ingresar.");
      setEnviando(false);
    }
  };

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[440px] flex-col px-5 pb-8 pt-[12vh]">
      <Marca className="text-[3.25rem]" />
      <p className="m-0 mt-4 font-serif text-[1.3125rem] leading-snug text-tinta">Órdenes de bloqueo en vivo, firmadas por el juez de turno.</p>
      {estado?.partido && <p className="m-0 mt-2 text-[0.9375rem] leading-snug text-tinta-2">{estado.partido.nombre}</p>}

      <form onSubmit={ingresar} className="mt-9 grid gap-4" noValidate>
        <label className="block">
          <span className="mb-1.5 block font-semibold">Usuario</span>
          <input
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
        </label>
        <label className="block">
          <span className="mb-1.5 block font-semibold">Contraseña</span>
          <input className="campo" name="contrasena" type="password" autoComplete="current-password" required value={contrasena} onChange={(e) => setContrasena(e.target.value)} />
        </label>
        {error && (
          <p role="alert" className="m-0 border-l-[3px] border-tinta bg-hundido px-3 py-2.5 font-semibold leading-snug">
            {error}
          </p>
        )}
        <button type="submit" className="boton boton-firma mt-1 h-[58px] text-[1.125rem]" disabled={enviando || !usuario.trim() || !contrasena}>
          {enviando ? "Ingresando…" : "Ingresar"}
        </button>
      </form>

      <p className="m-0 mt-8 text-[0.9375rem] leading-snug text-tinta-2">
        Sin usuario se puede consultar el{" "}
        <Link to="/transparencia" className="enlace font-semibold">
          registro público de bloqueos
        </Link>
        .
      </p>
      <div className="flex-1" />
      <p className="m-0 mt-10 text-[0.8125rem] leading-snug text-tinta-3">
        Hackathon Argentina Space 2026, Desafío Fútbol. Los datos son ficticios y vienen del simulador oficial. La sesión vale solo para esta pestaña.
      </p>
    </main>
  );
}
