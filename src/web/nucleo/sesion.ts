import { useSyncExternalStore } from "react";
import type { Rol } from "../../compartido/tipos.ts";
import { type Sesion, guardarSesion, pedir, sesionActual, suscribirSesion } from "./api.ts";

export function useSesion(): Sesion | null {
  return useSyncExternalStore(suscribirSesion, sesionActual, sesionActual);
}

export function inicioDe(rol: Rol): string {
  return rol === "juez" ? "/juez" : "/tablero";
}

/** Cierra la sesión en el servidor y en esta pestaña. No falla si no hay red. */
export async function salir(): Promise<void> {
  try {
    await pedir("/api/salida", { metodo: "POST" });
  } catch {
    // La sesión local se borra igual.
  }
  guardarSesion(null);
}
