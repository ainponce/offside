// Rutas de la interfaz. El servidor devuelve index.html para cualquier ruta que no sea /api.

import type { ReactNode } from "react";
import { BrowserRouter, Navigate, Route, Routes, useLocation } from "react-router-dom";
import type { Rol } from "../compartido/tipos.ts";
import { Red } from "./componentes/Red.tsx";
import { inicioDe, useSesion } from "./nucleo/sesion.ts";
import { Expediente } from "./pantallas/Expediente.tsx";
import { Ingreso } from "./pantallas/Ingreso.tsx";
import { Juez } from "./pantallas/Juez.tsx";
import { Tablero } from "./pantallas/Tablero.tsx";
import { Transparencia } from "./pantallas/Transparencia.tsx";

/** Sin sesión manda al ingreso (y recuerda adónde se iba); con otro rol, a la pantalla propia. */
function ConSesion({ roles, children }: { roles: Rol[]; children: ReactNode }) {
  const sesion = useSesion();
  const ubicacion = useLocation();
  if (!sesion) return <Navigate to="/ingreso" replace state={{ desde: ubicacion.pathname }} />;
  if (!roles.includes(sesion.usuario.rol)) return <Navigate to={inicioDe(sesion.usuario.rol)} replace />;
  return <>{children}</>;
}

function Inicio() {
  const sesion = useSesion();
  return <Navigate to={sesion ? inicioDe(sesion.usuario.rol) : "/ingreso"} replace />;
}

/** Una falla al dibujar una pantalla no deja la pestaña en blanco, y cambiar de ruta la limpia. */
function Contenida({ children }: { children: ReactNode }) {
  const ubicacion = useLocation();
  return <Red key={ubicacion.pathname}>{children}</Red>;
}

export function App() {
  return (
    <BrowserRouter>
      <Contenida>
      <Routes>
        <Route path="/ingreso" element={<Ingreso />} />
        <Route
          path="/juez"
          element={
            <ConSesion roles={["juez"]}>
              <Juez />
            </ConSesion>
          }
        />
        <Route
          path="/tablero"
          element={
            <ConSesion roles={["juez", "fiscalia"]}>
              <Tablero />
            </ConSesion>
          }
        />
        <Route
          path="/expediente/:id"
          element={
            <ConSesion roles={["juez", "fiscalia"]}>
              <Expediente />
            </ConSesion>
          }
        />
        <Route path="/transparencia" element={<Transparencia />} />
        <Route path="/" element={<Inicio />} />
        <Route path="*" element={<Inicio />} />
      </Routes>
      </Contenida>
    </BrowserRouter>
  );
}
