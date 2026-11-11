#!/usr/bin/env python3
"""Verificador independiente de una exportación de Offside (Python 3.9+, sin dependencias).

Comprueba, solo con los archivos exportados, que nada fue alterado después:

  1. Auditoría: la cadena de hashes está completa y en orden.
  2. Detecciones: el hash de cada detección y de cada captura coincide.
  3. Medidas: la huella es el SHA-256 de lo que vio el juez, y la evidencia que
     cita existe y coincide.
  4. Órdenes: cada orden lleva la huella de su medida en el identificador y la
     firma del juez corresponde a ese identificador, tipo, objetivo y vencimiento.
  5. Manifiesto: los archivos son los que se exportaron.
  6. Opcional (--registro): cada orden que recibieron los proveedores según el
     registro del simulador figura en un expediente y fue firmada por un juez de turno.

Uso:
    python3 herramientas/verificar_expediente.py entrega/practica --juzgados config/jueces.demo.json
    python3 herramientas/verificar_expediente.py entrega/final --juzgados config/jueces.demo.json --registro salida/registro.jsonl

Termina con código 0 si todo coincide y con 1 si encuentra alguna diferencia.
Es un programa aparte de la plataforma a propósito: no comparte código con ella.
"""
import argparse
import base64
import binascii
import hashlib
import hmac
import json
import sys
from pathlib import Path
from typing import Dict, List, Optional

GENESIS = "0" * 64


def sha256(datos: bytes) -> str:
    return hashlib.sha256(datos).hexdigest()


def sha256_texto(texto: str) -> str:
    return sha256(texto.encode("utf-8"))


class Informe:
    def __init__(self) -> None:
        self.fallas: List[str] = []
        self.correctas: List[str] = []

    def falla(self, mensaje: str) -> None:
        self.fallas.append(mensaje)

    def bien(self, mensaje: str) -> None:
        self.correctas.append(mensaje)


def cargar_claves(ruta: Optional[Path]) -> Dict[str, str]:
    """Acepta el archivo de Offside ({jueces: [...]}) y el del simulador ({juzgados: [{jueces: [...]}]})."""
    if ruta is None:
        return {}
    datos = json.loads(ruta.read_text(encoding="utf-8"))
    jueces = list(datos.get("jueces", []))
    for juzgado in datos.get("juzgados", []):
        jueces.extend(juzgado.get("jueces", []))
    return {j["id"]: j["clave_firma_demo"] for j in jueces if "id" in j and "clave_firma_demo" in j}


def verificar_auditoria(carpeta: Path, informe: Informe) -> List[dict]:
    """Devuelve las entradas ya interpretadas (para cruzarlas con los expedientes)."""
    ruta = carpeta / "auditoria.jsonl"
    if not ruta.exists():
        informe.falla("Falta auditoria.jsonl.")
        return []
    entradas: List[dict] = []
    anterior = GENESIS
    esperada = 1
    rota = False
    for numero, linea in enumerate(ruta.read_text(encoding="utf-8").splitlines(), start=1):
        if not linea.strip():
            continue
        try:
            e = json.loads(linea)
            seq, contenido = int(e["seq"]), e["contenido"]
        except (ValueError, KeyError, TypeError):
            informe.falla(f"Auditoría: la línea {numero} no se puede leer (secuencia {esperada}).")
            rota = True
            break
        if seq != esperada:
            informe.falla(f"Auditoría: se esperaba la secuencia {esperada} y aparece la {seq}: falta o sobra una entrada.")
            rota = True
            break
        if e.get("hash_anterior") != anterior:
            informe.falla(f"Auditoría: la secuencia {seq} no encadena con la anterior.")
            rota = True
            break
        calculado = sha256_texto(f"{anterior}\n{seq}\n{contenido}")
        if calculado != e.get("hash"):
            informe.falla(f"Auditoría: el contenido de la secuencia {seq} fue alterado (el hash no coincide).")
            rota = True
            break
        try:
            entradas.append(dict(json.loads(contenido), seq=seq, hash=calculado))
        except ValueError:
            informe.falla(f"Auditoría: el contenido de la secuencia {seq} no es JSON.")
            rota = True
            break
        anterior = calculado
        esperada += 1
    if not rota:
        informe.bien(f"Auditoría: {esperada - 1} entradas encadenadas; cabecera {anterior[:16]}…")
    return entradas


def hash_de_captura(crudo: str) -> Optional[str]:
    """SHA-256 de los bytes de la captura que trae la detección, o None si no trae una válida."""
    try:
        captura = (json.loads(crudo).get("captura") or {}).get("contenido_b64")
        if not captura:
            return None
        return sha256(base64.b64decode("".join(captura.split()), validate=True))
    except (binascii.Error, ValueError, AttributeError):
        return None


def verificar_deteccion(d: dict, donde: str, informe: Informe) -> None:
    crudo = d.get("crudo", "")
    captura_ok = hash_de_captura(crudo) == d.get("captura_sha256")
    if sha256_texto(crudo) != d.get("sha256"):
        detalle = "la captura no coincide con su hash" if not captura_ok else "cambió algún dato de la detección"
        informe.falla(f"{donde}: la detección {d.get('id')} fue alterada: {detalle}.")
    elif not captura_ok:
        informe.falla(f"{donde}: la captura de la detección {d.get('id')} no coincide con su hash.")


def verificar_expediente(ruta: Path, claves: Dict[str, str], auditoria: List[dict], informe: Informe) -> List[dict]:
    """Devuelve las órdenes del expediente (para el cruce con el registro del simulador)."""
    try:
        exp = json.loads(ruta.read_text(encoding="utf-8"))
    except ValueError:
        informe.falla(f"{ruta.name}: no es JSON válido.")
        return []
    eid = exp.get("expediente", {}).get("id", ruta.stem)
    antes = len(informe.fallas)

    detecciones = {d.get("id"): d for d in exp.get("detecciones", [])}
    for d in detecciones.values():
        verificar_deteccion(d, eid, informe)

    decisiones = {(e.get("datos") or {}).get("medida_id"): e for e in auditoria if e.get("tipo") == "decision"}
    enviadas = {(e.get("datos") or {}).get("orden_id") for e in auditoria if e.get("tipo") == "orden_enviada"}
    ordenes: List[dict] = []

    for m in exp.get("medidas", []):
        mid = m.get("id")
        instantanea = m.get("instantanea", "")
        huella = m.get("huella", "")
        if sha256_texto(instantanea) != huella:
            informe.falla(f"{eid}: lo que vio el juez en la medida {mid} fue alterado (la huella no coincide).")
            continue
        try:
            vista = json.loads(instantanea)
        except ValueError:
            informe.falla(f"{eid}: la instantánea de la medida {mid} no es JSON.")
            continue
        for ev in vista.get("evidencia", []) or []:
            d = detecciones.get(ev.get("deteccion_id"))
            if d is None:
                informe.falla(f"{eid}: la medida {mid} cita la detección {ev.get('deteccion_id')}, que no está en el expediente.")
            elif d.get("sha256") != ev.get("deteccion_sha256") or d.get("captura_sha256") != ev.get("captura_sha256"):
                informe.falla(f"{eid}: la evidencia que vio el juez en {mid} no coincide con la detección {d.get('id')}.")

        decision = m.get("decision")
        if m.get("estado") == "aprobada" and auditoria:
            registro = decisiones.get(mid)
            if registro is None or (registro.get("datos") or {}).get("huella") != huella:
                informe.falla(f"{eid}: la aprobación de la medida {mid} no figura en la auditoría con esa huella.")
            elif decision and registro.get("actor") != decision.get("juez_id"):
                informe.falla(f"{eid}: la auditoría atribuye la medida {mid} a otro juez.")

        for o in m.get("ordenes", []):
            oid = o.get("orden_id", "")
            ordenes.append(dict(o, expediente_id=eid, medida_id=mid))
            if not oid.endswith("-" + huella[:16]):
                informe.falla(f"{eid}: la orden {oid} no lleva la huella de la medida {mid}.")
            if decision and o.get("juez_id") != decision.get("juez_id"):
                informe.falla(f"{eid}: la orden {oid} está firmada por un juez distinto del que aprobó la medida {mid}.")
            clave = claves.get(o.get("juez_id"))
            if clave is not None:
                mensaje = f"{oid}|{o.get('tipo')}|{o.get('objetivo')}|{o.get('vence_min')}|{o.get('juez_id')}"
                esperada = hmac.new(clave.encode("utf-8"), mensaje.encode("utf-8"), hashlib.sha256).hexdigest()
                if not hmac.compare_digest(esperada, str(o.get("firma"))):
                    informe.falla(f"{eid}: la firma de la orden {oid} no corresponde a su contenido.")
            elif claves:
                informe.falla(f"{eid}: no hay clave de verificación para el juez {o.get('juez_id')} (orden {oid}).")
            if auditoria and o.get("enviada_min") is not None and oid not in enviadas:
                informe.falla(f"{eid}: el envío de la orden {oid} no figura en la auditoría.")

    if len(informe.fallas) == antes:
        informe.bien(
            f"{eid}: {len(detecciones)} detecciones, {len(exp.get('medidas', []))} medidas y {len(ordenes)} órdenes coinciden."
        )
    return ordenes


def verificar_archivadas(carpeta: Path, informe: Informe) -> None:
    ruta = carpeta / "detecciones-archivadas.json"
    if not ruta.exists():
        return
    try:
        datos = json.loads(ruta.read_text(encoding="utf-8"))
    except ValueError:
        informe.falla("detecciones-archivadas.json: no es JSON válido.")
        return
    antes = len(informe.fallas)
    for d in datos.get("detecciones", []):
        verificar_deteccion(d, "Archivadas", informe)
    if len(informe.fallas) == antes:
        informe.bien(f"Archivadas: {len(datos.get('detecciones', []))} detecciones sin medida coinciden.")


def verificar_manifiesto(carpeta: Path, cabecera: Optional[str], informe: Informe) -> None:
    ruta = carpeta / "manifiesto.json"
    if not ruta.exists():
        informe.falla("Falta manifiesto.json.")
        return
    try:
        manifiesto = json.loads(ruta.read_text(encoding="utf-8"))
    except ValueError:
        informe.falla("manifiesto.json: no es JSON válido.")
        return
    antes = len(informe.fallas)
    for archivo in manifiesto.get("archivos", []):
        destino = carpeta / archivo["nombre"]
        if not destino.exists():
            informe.falla(f"Manifiesto: falta el archivo {archivo['nombre']}.")
        elif sha256(destino.read_bytes()) != archivo["sha256"]:
            informe.falla(f"Manifiesto: el archivo {archivo['nombre']} cambió después de la exportación.")
    declarada = (manifiesto.get("auditoria") or {}).get("cabecera")
    if cabecera is not None and declarada != cabecera:
        informe.falla("Manifiesto: la cabecera de la auditoría no es la que declara el manifiesto.")
    if len(informe.fallas) == antes:
        informe.bien(f"Manifiesto: {len(manifiesto.get('archivos', []))} archivos sin cambios.")


def verificar_registro(ruta: Path, ordenes: List[dict], informe: Informe) -> None:
    """Cruza las órdenes exportadas con lo que el simulador anotó que recibieron los proveedores."""
    propias = {(o.get("proveedor_id"), o.get("orden_id")): o for o in ordenes}
    recibidas = 0
    antes = len(informe.fallas)
    vistas = set()
    for linea in ruta.read_text(encoding="utf-8").splitlines():
        if not linea.strip():
            continue
        e = json.loads(linea)
        if e.get("evento") != "orden_recibida":
            continue
        recibidas += 1
        clave = (e.get("proveedor"), e.get("orden_id"))
        vistas.add(clave)
        o = propias.get(clave)
        if o is None:
            informe.falla(f"Registro del simulador: {e.get('proveedor')} recibió la orden {e.get('orden_id')}, que no figura en ningún expediente.")
            continue
        for campo in ("tipo", "objetivo", "vence_min", "juez_id"):
            if o.get(campo) != e.get(campo):
                informe.falla(f"Registro del simulador: la orden {e.get('orden_id')} difiere en {campo}.")
        if not e.get("juez_de_turno", True):
            informe.falla(f"Registro del simulador: la orden {e.get('orden_id')} fue firmada por un juez fuera de turno.")
    for clave, o in propias.items():
        if o.get("enviada_min") is not None and clave not in vistas:
            informe.falla(f"Registro del simulador: la orden {o.get('orden_id')} figura como enviada y el simulador no la recibió.")
    if len(informe.fallas) == antes:
        informe.bien(f"Registro del simulador: las {recibidas} órdenes recibidas por los proveedores figuran en los expedientes, todas firmadas por un juez de turno.")


def main() -> int:
    parser = argparse.ArgumentParser(description="Verifica una exportación de Offside")
    parser.add_argument("carpeta", type=Path, help="carpeta con la exportación")
    parser.add_argument("--juzgados", type=Path, help="archivo con las claves de verificación de los jueces")
    parser.add_argument("--registro", type=Path, help="registro.jsonl del simulador, para cruzar las órdenes")
    args = parser.parse_args()

    if not args.carpeta.is_dir():
        print(f"No existe la carpeta {args.carpeta}")
        return 1

    informe = Informe()
    claves = cargar_claves(args.juzgados)
    auditoria = verificar_auditoria(args.carpeta, informe)
    cabecera = auditoria[-1]["hash"] if auditoria else None

    ordenes: List[dict] = []
    expedientes = sorted(args.carpeta.glob("expediente-*.json"))
    if not expedientes:
        informe.falla("No hay expedientes en la carpeta.")
    for ruta in expedientes:
        ordenes.extend(verificar_expediente(ruta, claves, auditoria, informe))
    verificar_archivadas(args.carpeta, informe)
    verificar_manifiesto(args.carpeta, cabecera, informe)
    if args.registro:
        if args.registro.exists():
            verificar_registro(args.registro, ordenes, informe)
        else:
            informe.falla(f"No existe el registro {args.registro}.")

    for linea in informe.correctas:
        print(f"  ✔ {linea}")
    if not claves:
        print("  · Sin --juzgados no se comprobaron las firmas.")
    if informe.fallas:
        for linea in informe.fallas:
            print(f"  ✖ {linea}")
        print(f"\nVERIFICACIÓN FALLIDA: {len(informe.fallas)} diferencia(s).")
        return 1
    print("\nVERIFICACIÓN CORRECTA: nada fue alterado.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
