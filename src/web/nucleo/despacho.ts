// Estado de una medida firmada, proveedor por proveedor, a partir de su plan y de sus órdenes.

import type { MedidaDTO, OrdenDTO, TipoBloqueo } from "../../compartido/tipos.ts";

export interface FilaDespacho {
  proveedor_id: string;
  nombre: string;
  clientes: number;
  tipo: TipoBloqueo | null;
  objetivo: string | null;
  sin_cobertura: string | null;
  /** La orden del último intento; null si todavía no salió ninguna. */
  orden: OrdenDTO | null;
  /** 0 sin orden · 1 por enviar · 2 recibida · 3 aplicada (o ya cerrada: vencida, levantada). */
  paso: 0 | 1 | 2 | 3;
}

function pasoDe(orden: OrdenDTO | null): 0 | 1 | 2 | 3 {
  switch (orden?.estado) {
    case "por_enviar":
      return 1;
    case "recibida":
      return 2;
    case "aplicada":
    case "vencida":
    case "levantada":
      return 3;
    default:
      return 0;
  }
}

export function filasDespacho(m: MedidaDTO): FilaDespacho[] {
  const ultima = new Map<string, OrdenDTO>();
  for (const o of m.ordenes) {
    const previa = ultima.get(o.proveedor_id);
    if (!previa || o.intento >= previa.intento) ultima.set(o.proveedor_id, o);
  }
  const filas: FilaDespacho[] = m.plan.map((p) => {
    const orden = ultima.get(p.proveedor_id) ?? null;
    return {
      proveedor_id: p.proveedor_id,
      nombre: p.proveedor_nombre,
      clientes: p.clientes,
      tipo: orden?.tipo ?? p.tipo,
      objetivo: orden?.objetivo ?? p.objetivo,
      sin_cobertura: p.sin_cobertura,
      orden,
      paso: pasoDe(orden),
    };
  });
  // Una orden de un proveedor que no figura en el plan no debería existir; si existe, se muestra.
  for (const [id, orden] of ultima) {
    if (filas.some((f) => f.proveedor_id === id)) continue;
    filas.push({
      proveedor_id: id,
      nombre: orden.proveedor_nombre,
      clientes: 0,
      tipo: orden.tipo,
      objetivo: orden.objetivo,
      sin_cobertura: null,
      orden,
      paso: pasoDe(orden),
    });
  }
  return filas;
}

/** Porcentaje de clientes del plan con el bloqueo aplicado ahora. */
export function coberturaDe(filas: FilaDespacho[]): number {
  const total = filas.reduce((a, f) => a + f.clientes, 0);
  if (total <= 0) return 0;
  const cubiertos = filas.reduce((a, f) => a + (f.orden?.estado === "aplicada" ? f.clientes : 0), 0);
  return (100 * cubiertos) / total;
}

/** ¿Queda alguna orden en camino (por enviar o recibida sin aplicar)? */
export function enCurso(filas: FilaDespacho[]): boolean {
  return filas.some((f) => f.orden?.estado === "por_enviar" || f.orden?.estado === "recibida");
}
