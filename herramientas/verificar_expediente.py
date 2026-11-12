#!/usr/bin/env python3
"""Verificador independiente de una exportación de Offside (Python 3.9+, sin dependencias).

Qué comprueba, solo con los archivos de la carpeta:

  1. Auditoría: la cadena de hashes está completa y en orden, y termina con el
     cierre de esta exportación, que lista el hash de cada archivo exportado.
  2. Archivos: cada archivo exportado figura en el manifiesto y en ese cierre, y
     ninguno cambió.
  3. Detecciones: el hash de cada detección y de su captura coincide, y cada una
     figura en la auditoría con esos hashes, en los dos sentidos.
  4. Expedientes: marca y prefijo son los que registró la auditoría al abrirlos.
  5. Medidas: la huella es el SHA-256 de lo que vio el juez, la evidencia citada
     coincide, y huella, estado y decisión (juez, minuto, motivo) son los que
     registró la auditoría.
  6. Órdenes: cada orden lleva la huella de su medida y, con --juzgados, la firma
     del juez corresponde a su contenido; su firma, su estado y sus minutos son
     los que registró la auditoría, en los dos sentidos.
  7. Anclas: cada instantánea guarda la cabecera de la auditoría al crearse la
     medida, y esa cabecera coincide con la cadena.

Con --registro (el registro.jsonl del simulador, que Offside no controla):

  8. Cada orden que recibió un proveedor figura en un expediente con los mismos
     datos, firmada por un juez de turno, y cada orden enviada llegó. Como el
     orden_id lleva la huella y la huella cubre la cabecera de la auditoría, ese
     registro fija la auditoría hasta la última medida cuyas órdenes recibió el
     simulador.

Qué no prueba: que lo detectado sea cierto (solo que no cambió después); sin
--registro, una reescritura coherente de toda la carpeta (las claves de
demostración son públicas); y, aun con --registro, las entradas posteriores a la
última ancla (incluido el cierre de la exportación y los .md) dependen solo de
esta carpeta.

Uso:
    python3 herramientas/verificar_expediente.py entrega/practica --juzgados config/jueces.demo.json
    python3 herramientas/verificar_expediente.py entrega/practica --juzgados config/jueces.demo.json --registro entrega/practica/registro-simulador.jsonl

Termina con código 0 si todo coincide y con 1 si encuentra alguna diferencia.
Es un programa aparte de la plataforma a propósito: no comparte código con ella.
"""
import argparse
import base64
import binascii
import hashlib
import hmac
import json
import re
import sys
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

GENESIS = "0" * 64
# Archivos que escribe la exportación: todos tienen que estar en el manifiesto.
EXPORTADOS = re.compile(r"^(expediente-.+\.(json|md)|detecciones-archivadas\.json|auditoria\.jsonl)$")


def sha256(datos: bytes) -> str:
    return hashlib.sha256(datos).hexdigest()


def sha256_texto(texto: str) -> str:
    return sha256(texto.encode("utf-8"))


class Informe:
    def __init__(self) -> None:
        self.fallas: List[str] = []
        self.correctas: List[str] = []
        self.anclaje: List[str] = []
        self.notas: List[str] = []

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


# --- auditoría -----------------------------------------------------------------------------


class Auditoria:
    def __init__(self) -> None:
        self.entradas: List[dict] = []
        self.hashes: Dict[int, str] = {0: GENESIS}
        self.integra = False

    @property
    def cabecera(self) -> Optional[str]:
        return self.entradas[-1]["hash"] if self.entradas else None


def verificar_auditoria(carpeta: Path, informe: Informe) -> Auditoria:
    a = Auditoria()
    ruta = carpeta / "auditoria.jsonl"
    if not ruta.exists():
        informe.falla("Falta auditoria.jsonl.")
        return a
    anterior = GENESIS
    esperada = 1
    for numero, linea in enumerate(ruta.read_text(encoding="utf-8").splitlines(), start=1):
        if not linea.strip():
            continue
        try:
            e = json.loads(linea)
            seq, contenido = int(e["seq"]), e["contenido"]
        except (ValueError, KeyError, TypeError):
            informe.falla(f"Auditoría: la línea {numero} no se puede leer (secuencia {esperada}).")
            return a
        if seq != esperada:
            informe.falla(f"Auditoría: se esperaba la secuencia {esperada} y aparece la {seq}: falta o sobra una entrada.")
            return a
        if e.get("hash_anterior") != anterior:
            informe.falla(f"Auditoría: la secuencia {seq} no encadena con la anterior.")
            return a
        calculado = sha256_texto(f"{anterior}\n{seq}\n{contenido}")
        if calculado != e.get("hash"):
            informe.falla(f"Auditoría: el contenido de la secuencia {seq} fue alterado (el hash no coincide).")
            return a
        try:
            datos = json.loads(contenido)
        except ValueError:
            informe.falla(f"Auditoría: el contenido de la secuencia {seq} no es JSON.")
            return a
        a.entradas.append(dict(datos, seq=seq, hash=calculado, datos=datos.get("datos") or {}))
        a.hashes[seq] = calculado
        anterior = calculado
        esperada += 1
    a.integra = True
    informe.bien(f"Auditoría: {esperada - 1} entradas encadenadas; cabecera {anterior[:16]}…")
    return a


# --- archivos: manifiesto y cierre de la exportación ----------------------------------------


def verificar_archivos(carpeta: Path, auditoria: Auditoria, informe: Informe) -> dict:
    ruta = carpeta / "manifiesto.json"
    if not ruta.exists():
        informe.falla("Falta manifiesto.json.")
        return {}
    try:
        manifiesto = json.loads(ruta.read_text(encoding="utf-8"))
    except ValueError:
        informe.falla("manifiesto.json: no es JSON válido.")
        return {}
    antes = len(informe.fallas)
    listados = {a.get("nombre"): a.get("sha256") for a in manifiesto.get("archivos", [])}

    for archivo in sorted(p.name for p in carpeta.iterdir() if p.is_file()):
        if archivo == "manifiesto.json":
            continue
        if EXPORTADOS.match(archivo):
            if archivo not in listados:
                informe.falla(f"Manifiesto: el archivo {archivo} está en la carpeta y no en el manifiesto.")
        else:
            informe.notas.append(f"{archivo} no es parte de la exportación: no se verificó.")
    for nombre, hash_declarado in listados.items():
        destino = carpeta / str(nombre)
        if not destino.exists():
            informe.falla(f"Manifiesto: falta el archivo {nombre}.")
        elif sha256(destino.read_bytes()) != hash_declarado:
            informe.falla(f"Manifiesto: el archivo {nombre} cambió después de la exportación.")

    declarada = (manifiesto.get("auditoria") or {}).get("cabecera")
    if auditoria.cabecera is not None and declarada != auditoria.cabecera:
        informe.falla("Manifiesto: la cabecera de la auditoría no es la que declara el manifiesto.")

    # El cierre de la exportación es la última entrada de la auditoría y lista cada archivo con su hash.
    if auditoria.integra and auditoria.entradas:
        cierre = auditoria.entradas[-1]
        if cierre.get("tipo") != "exportacion" or not isinstance(cierre["datos"].get("archivos"), list):
            informe.falla("Auditoría: no termina con el cierre de esta exportación (la lista de archivos con su hash).")
        else:
            registrados = {a.get("nombre"): a.get("sha256") for a in cierre["datos"]["archivos"]}
            sin_auditoria = {n: h for n, h in listados.items() if n != "auditoria.jsonl"}
            for nombre in sorted(set(registrados) | set(sin_auditoria)):
                if nombre not in sin_auditoria:
                    informe.falla(f"Manifiesto: falta {nombre}, que el cierre de la exportación registra en la auditoría.")
                elif nombre not in registrados:
                    informe.falla(f"Manifiesto: {nombre} no figura en el cierre de la exportación registrado en la auditoría.")
                elif registrados[nombre] != sin_auditoria[nombre]:
                    informe.falla(f"Manifiesto: el hash de {nombre} no es el que registró el cierre de la exportación en la auditoría.")
            if "auditoria.jsonl" not in listados:
                informe.falla("Manifiesto: falta auditoria.jsonl.")
    if len(informe.fallas) == antes:
        informe.bien(f"Archivos: los {len(listados)} archivos exportados están en el manifiesto y en el cierre de la auditoría, sin cambios.")
    return manifiesto


# --- registros de la auditoría, por objeto --------------------------------------------------


def detecciones_auditadas(auditoria: Auditoria, informe: Informe) -> Dict[str, dict]:
    registro: Dict[str, dict] = {}
    for e in auditoria.entradas:
        d, tipo = e["datos"], e.get("tipo")
        if tipo == "deteccion_archivada":
            lugar = None
        elif tipo == "evidencia_agregada" or (tipo == "medida_presentada" and d.get("deteccion_id")):
            lugar = d.get("expediente_id")
        else:
            continue
        did = d.get("deteccion_id")
        if did in registro:
            informe.falla(f"Auditoría: la detección {did} figura dos veces.")
        registro[did] = {
            "lugar": lugar,
            "sha256": d.get("deteccion_sha256"),
            "captura_sha256": d.get("captura_sha256"),
            "minuto": e.get("minuto"),
            "seq": e["seq"],
        }
    return registro


def medidas_auditadas(auditoria: Auditoria) -> Dict[str, dict]:
    medidas: Dict[str, dict] = {}
    for e in auditoria.entradas:
        d, tipo = e["datos"], e.get("tipo")
        mid = d.get("medida_id")
        if tipo in ("medida_presentada", "ratificacion_solicitada"):
            # Una ratificación pendiente se vuelve a presentar cada vez que suma un proveedor:
            # vale la última presentación (su huella y su ancla).
            m = medidas.setdefault(mid, {})
            m.update(
                estado="pendiente", huella=d.get("huella"), expediente=d.get("expediente_id"), juez=None, minuto=None, motivo=None,
                presentada_seq=e["seq"],
            )
        elif mid not in medidas:
            continue
        elif tipo == "decision":
            medidas[mid].update(
                estado=d.get("resultado"), juez=e.get("actor"), minuto=e.get("minuto"), motivo=d.get("motivo"), huella_decision=d.get("huella")
            )
        elif tipo == "reconsideracion":
            medidas[mid].update(estado="pendiente", juez=None, minuto=None, motivo=None)
        elif tipo == "medida_sin_efecto":
            medidas[mid].update(estado="sin_efecto")
        elif tipo == "medida_recuperada":
            medidas[mid].update(estado="pendiente")
    return medidas


ESTADO_POR_EVENTO = {
    "orden_enviada": "recibida",
    "orden_aplicada": "aplicada",
    "orden_fallida": "fallida",
    "orden_vencida": "vencida",
    "orden_levantada": "levantada",
    "orden_levantada_confirmada": "levantada",
    "orden_rechazada": "rechazada",
    "orden_no_enviada": "no_enviada",
}


def ordenes_auditadas(auditoria: Auditoria, informe: Informe) -> Dict[str, dict]:
    ordenes: Dict[str, dict] = {}
    for e in auditoria.entradas:
        d, tipo = e["datos"], e.get("tipo")
        oid = d.get("orden_id")
        if tipo == "orden_firmada":
            ordenes[oid] = {
                "firmada": d,
                "actor": e.get("actor"),
                "estado": "por_enviar",
                "enviada_min": None,
                "aplicada_min": None,
                "finalizada_min": None,
            }
        elif tipo in ESTADO_POR_EVENTO:
            o = ordenes.get(oid)
            if o is None:
                informe.falla(f"Auditoría: la secuencia {e['seq']} registra la orden {oid} sin que conste su firma.")
                continue
            o["estado"] = ESTADO_POR_EVENTO[tipo]
            if tipo == "orden_enviada":
                o["enviada_min"] = d.get("enviada_min", e.get("minuto"))
            elif tipo == "orden_aplicada":
                o["aplicada_min"] = d.get("aplicada_min", e.get("minuto"))
            elif tipo in ("orden_vencida", "orden_levantada", "orden_levantada_confirmada"):
                o["finalizada_min"] = d.get("finalizada_min", e.get("minuto"))
                if "aplicada_min" in d:
                    o["aplicada_min"] = d["aplicada_min"]
    return ordenes


# --- expedientes -------------------------------------------------------------------------


def hash_de_captura(crudo: str) -> Optional[str]:
    """SHA-256 de los bytes de la captura que trae la detección, o None si no trae una válida."""
    try:
        captura = (json.loads(crudo).get("captura") or {}).get("contenido_b64")
        if not isinstance(captura, str) or not captura:
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


def cruzar_deteccion(d: dict, lugar: Optional[str], donde: str, auditadas: Dict[str, dict], vistas: set, informe: Informe) -> None:
    did = d.get("id")
    vistas.add(did)
    r = auditadas.get(did)
    if r is None:
        informe.falla(f"{donde}: la detección {did} no figura en la auditoría.")
        return
    if r["sha256"] != d.get("sha256") or r["captura_sha256"] != d.get("captura_sha256"):
        informe.falla(f"{donde}: la detección {did} no es la que registró la auditoría (secuencia {r['seq']}).")
    if r["lugar"] != lugar:
        informe.falla(f"{donde}: la detección {did} figura en otro lugar del que registró la auditoría.")
    if "recibida_min" in d and r["minuto"] is not None and d.get("recibida_min") != r["minuto"]:
        informe.falla(f"{donde}: el minuto en que se recibió la detección {did} no es el que registró la auditoría.")


class Contexto:
    def __init__(self, claves: Dict[str, str], auditoria: Auditoria, informe: Informe) -> None:
        self.claves = claves
        self.auditoria = auditoria
        self.informe = informe
        self.cruzar = auditoria.integra
        self.detecciones = detecciones_auditadas(auditoria, informe) if self.cruzar else {}
        self.medidas = medidas_auditadas(auditoria) if self.cruzar else {}
        self.ordenes = ordenes_auditadas(auditoria, informe) if self.cruzar else {}
        self.abiertos = {e["datos"].get("expediente_id"): e["datos"] for e in auditoria.entradas if e.get("tipo") == "expediente_abierto"}
        self.detecciones_vistas: set = set()
        self.medidas_vistas: set = set()
        self.ordenes_vistas: set = set()
        self.anclas: Dict[str, int] = {}
        self.huellas: Dict[str, str] = {}


def verificar_medida(eid: str, m: dict, detecciones: Dict[str, dict], c: Contexto) -> List[dict]:
    informe = c.informe
    mid = m.get("id")
    c.medidas_vistas.add(mid)
    instantanea = m.get("instantanea", "")
    huella = m.get("huella", "")
    if sha256_texto(instantanea) != huella:
        informe.falla(f"{eid}: lo que vio el juez en la medida {mid} fue alterado (la huella no coincide).")
        return []
    try:
        vista = json.loads(instantanea)
    except ValueError:
        informe.falla(f"{eid}: la instantánea de la medida {mid} no es JSON.")
        return []
    c.huellas[mid] = huella
    for ev in vista.get("evidencia", []) or []:
        d = detecciones.get(ev.get("deteccion_id"))
        if d is None:
            informe.falla(f"{eid}: la medida {mid} cita la detección {ev.get('deteccion_id')}, que no está en el expediente.")
        elif d.get("sha256") != ev.get("deteccion_sha256") or d.get("captura_sha256") != ev.get("captura_sha256"):
            informe.falla(f"{eid}: la evidencia que vio el juez en {mid} no coincide con la detección {d.get('id')}.")
    marca_vista = (vista.get("filtracion") or {}).get("marca")
    if eid in c.abiertos and marca_vista is not None and marca_vista != c.abiertos[eid].get("marca"):
        informe.falla(f"{eid}: la marca que vio el juez en {mid} no es la del expediente.")

    # Ancla: la cabecera de la auditoría cuando se creó la medida.
    ancla = vista.get("auditoria")
    if not isinstance(ancla, dict) or not isinstance(ancla.get("seq"), int):
        informe.falla(f"{eid}: la medida {mid} no guarda la cabecera de la auditoría (ancla).")
    elif c.cruzar:
        if c.auditoria.hashes.get(ancla["seq"]) != ancla.get("cabecera"):
            informe.falla(f"{eid}: el ancla de la medida {mid} no coincide con la auditoría en la secuencia {ancla['seq']}: la cadena fue rehecha.")
        else:
            c.anclas[mid] = ancla["seq"]

    decision = m.get("decision")
    if c.cruzar:
        r = c.medidas.get(mid)
        if r is None:
            informe.falla(f"{eid}: la medida {mid} no figura en la auditoría.")
        else:
            if r.get("huella") != huella:
                informe.falla(f"{eid}: la huella de la medida {mid} no es la que registró la auditoría al presentarla.")
            if r.get("expediente") not in (None, eid):
                informe.falla(f"{eid}: la auditoría registra la medida {mid} en otro expediente.")
            if isinstance(ancla, dict) and isinstance(ancla.get("seq"), int) and ancla["seq"] >= r["presentada_seq"]:
                informe.falla(f"{eid}: el ancla de la medida {mid} es posterior a su presentación.")
            if r.get("estado") != m.get("estado"):
                informe.falla(f"{eid}: el estado de la medida {mid} ({m.get('estado')}) no es el que registró la auditoría ({r.get('estado')}).")
            elif m.get("estado") in ("aprobada", "rechazada"):
                if not decision:
                    informe.falla(f"{eid}: la medida {mid} figura {m.get('estado')} sin decisión.")
                else:
                    if decision.get("juez_id") != r.get("juez"):
                        informe.falla(f"{eid}: la auditoría atribuye la decisión de la medida {mid} a otro juez.")
                    if decision.get("decidida_min") != r.get("minuto"):
                        informe.falla(f"{eid}: el minuto de la decisión de la medida {mid} no es el que registró la auditoría.")
                    if m.get("estado") == "rechazada" and (decision.get("motivo") or None) != (r.get("motivo") or None):
                        informe.falla(f"{eid}: el motivo del rechazo de la medida {mid} no es el que registró la auditoría.")
                    if r.get("huella_decision") != huella:
                        informe.falla(f"{eid}: la decisión de la medida {mid} no figura en la auditoría con esa huella.")

    ordenes: List[dict] = []
    for o in m.get("ordenes", []):
        oid = o.get("orden_id", "")
        ordenes.append(dict(o, expediente_id=eid, medida_id=mid))
        if not oid.endswith("-" + huella[:16]):
            informe.falla(f"{eid}: la orden {oid} no lleva la huella de la medida {mid}.")
        if decision and o.get("juez_id") != decision.get("juez_id"):
            informe.falla(f"{eid}: la orden {oid} está firmada por un juez distinto del que aprobó la medida {mid}.")
        clave = c.claves.get(o.get("juez_id"))
        if clave is not None:
            mensaje = f"{oid}|{o.get('tipo')}|{o.get('objetivo')}|{o.get('vence_min')}|{o.get('juez_id')}"
            esperada = hmac.new(clave.encode("utf-8"), mensaje.encode("utf-8"), hashlib.sha256).hexdigest()
            if not hmac.compare_digest(esperada, str(o.get("firma"))):
                informe.falla(f"{eid}: la firma de la orden {oid} no corresponde a su contenido.")
        elif c.claves:
            informe.falla(f"{eid}: no hay clave de verificación para el juez {o.get('juez_id')} (orden {oid}).")
        if c.cruzar:
            cruzar_orden(eid, mid, o, c)
    return ordenes


def cruzar_orden(eid: str, mid: str, o: dict, c: Contexto) -> None:
    informe = c.informe
    oid = o.get("orden_id")
    c.ordenes_vistas.add(oid)
    r = c.ordenes.get(oid)
    if r is None:
        informe.falla(f"{eid}: la orden {oid} no figura en la auditoría.")
        return
    f = r["firmada"]
    pares = {
        "medida": (mid, f.get("medida_id")),
        "proveedor": (o.get("proveedor_id"), f.get("proveedor")),
        "tipo": (o.get("tipo"), f.get("tipo")),
        "objetivo": (o.get("objetivo"), f.get("objetivo")),
        "vencimiento": (o.get("vence_min"), f.get("vence_min")),
        "juez": (o.get("juez_id"), f.get("juez_id")),
        "intento": (o.get("intento"), f.get("intento")),
        "estado": (o.get("estado"), r["estado"]),
        "minuto de envío": (o.get("enviada_min"), r["enviada_min"]),
        "minuto de aplicación": (o.get("aplicada_min"), r["aplicada_min"]),
        "minuto de fin": (o.get("finalizada_min"), r["finalizada_min"]),
    }
    for campo, (exportado, auditado) in pares.items():
        if exportado != auditado:
            informe.falla(f"{eid}: la orden {oid} no coincide con la auditoría en {campo} ({exportado} en el expediente, {auditado} en la auditoría).")


def verificar_expediente(ruta: Path, c: Contexto) -> Tuple[Optional[str], List[dict]]:
    informe = c.informe
    try:
        exp = json.loads(ruta.read_text(encoding="utf-8"))
    except ValueError:
        informe.falla(f"{ruta.name}: no es JSON válido.")
        return None, []
    cabecera = exp.get("expediente", {})
    eid = cabecera.get("id", ruta.stem)
    antes = len(informe.fallas)

    if c.cruzar:
        abierto = c.abiertos.get(eid)
        if abierto is None:
            informe.falla(f"{eid}: la apertura del expediente no figura en la auditoría.")
        else:
            if abierto.get("marca") != cabecera.get("marca"):
                informe.falla(f"{eid}: la marca del expediente ({cabecera.get('marca')}) no es la que registró la auditoría al abrirlo ({abierto.get('marca')}).")
            if abierto.get("prefijo") != cabecera.get("prefijo"):
                informe.falla(f"{eid}: el prefijo de la marca no es el que registró la auditoría al abrirlo.")

    detecciones = {d.get("id"): d for d in exp.get("detecciones", [])}
    for d in detecciones.values():
        verificar_deteccion(d, eid, informe)
        if c.cruzar:
            cruzar_deteccion(d, eid, eid, c.detecciones, c.detecciones_vistas, informe)

    ordenes: List[dict] = []
    for m in exp.get("medidas", []):
        ordenes.extend(verificar_medida(eid, m, detecciones, c))

    if len(informe.fallas) == antes:
        informe.bien(f"{eid}: {len(detecciones)} detecciones, {len(exp.get('medidas', []))} medidas y {len(ordenes)} órdenes coinciden con la auditoría.")
    return eid, ordenes


def verificar_archivadas(carpeta: Path, c: Contexto) -> None:
    informe = c.informe
    ruta = carpeta / "detecciones-archivadas.json"
    if not ruta.exists():
        informe.falla("Falta detecciones-archivadas.json.")
        return
    try:
        datos = json.loads(ruta.read_text(encoding="utf-8"))
    except ValueError:
        informe.falla("detecciones-archivadas.json: no es JSON válido.")
        return
    antes = len(informe.fallas)
    for d in datos.get("detecciones", []):
        verificar_deteccion(d, "Archivadas", informe)
        if c.cruzar:
            cruzar_deteccion(d, None, "Archivadas", c.detecciones, c.detecciones_vistas, informe)
    if len(informe.fallas) == antes:
        informe.bien(f"Archivadas: {len(datos.get('detecciones', []))} detecciones sin medida coinciden con la auditoría.")


def verificar_faltantes(c: Contexto, exportados: set, manifiesto: dict) -> None:
    """Lo que la auditoría registra y la exportación no trae."""
    informe = c.informe
    if not c.cruzar:
        informe.falla("No se cruzaron los expedientes con la auditoría porque la cadena está rota.")
        return
    for eid in sorted(set(c.abiertos) - exportados):
        informe.falla(f"La auditoría registra la apertura de {eid} y la exportación no trae ese expediente.")
    declarados = set(manifiesto.get("expedientes", []) or [])
    if manifiesto and declarados != exportados:
        informe.falla("Manifiesto: la lista de expedientes no es la de los archivos exportados.")
    for did, r in sorted(c.detecciones.items(), key=lambda x: x[1]["seq"]):
        if did not in c.detecciones_vistas:
            donde = "las archivadas" if r["lugar"] is None else r["lugar"]
            informe.falla(f"La auditoría registra la detección {did} (secuencia {r['seq']}) y falta en {donde}.")
    for mid in sorted(set(c.medidas) - c.medidas_vistas):
        informe.falla(f"La auditoría registra la medida {mid} y falta en la exportación.")
    for oid in sorted(set(c.ordenes) - c.ordenes_vistas):
        informe.falla(f"La auditoría registra la firma de la orden {oid} y falta en la exportación.")


# --- registro del simulador ------------------------------------------------------------------


def verificar_registro(ruta: Path, ordenes: List[dict], c: Contexto) -> None:
    """Cruza las órdenes exportadas con lo que el simulador anotó que recibieron los proveedores."""
    informe = c.informe
    propias = {(o.get("proveedor_id"), o.get("orden_id")): o for o in ordenes}
    recibidas = 0
    antes = len(informe.fallas)
    vistas = set()
    ancladas: Dict[str, int] = {}
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
        mid = o.get("medida_id")
        if mid in c.anclas:
            ancladas[mid] = c.anclas[mid]
    for clave, o in propias.items():
        if o.get("enviada_min") is not None and clave not in vistas:
            informe.falla(f"Registro del simulador: la orden {o.get('orden_id')} figura como enviada y el simulador no la recibió.")
    if len(informe.fallas) == antes:
        informe.bien(f"Registro del simulador: las {recibidas} órdenes que recibieron los proveedores figuran en los expedientes, todas firmadas por un juez de turno.")
        total = len(c.auditoria.entradas)
        if ancladas:
            hasta = max(ancladas.values())
            medida = max(ancladas, key=lambda m: ancladas[m])
            informe.anclaje.append(
                f"El registro del simulador ancla la auditoría: las órdenes de {len(ancladas)} medidas llevan su huella, "
                f"y la más reciente ({medida}) la deja anclada hasta la secuencia {hasta} de {total}."
            )
            informe.anclaje.append(f"Las entradas {hasta + 1} a {total} (incluido el cierre de la exportación) dependen solo de esta carpeta.")
        else:
            informe.anclaje.append("El registro del simulador no tiene órdenes de Offside: no ancla ninguna parte de la auditoría.")


# --- principal ---------------------------------------------------------------------------------


def main() -> int:
    parser = argparse.ArgumentParser(description="Verifica una exportación de Offside")
    parser.add_argument("carpeta", type=Path, help="carpeta con la exportación")
    parser.add_argument("--juzgados", type=Path, help="archivo con las claves de verificación de los jueces")
    parser.add_argument("--registro", type=Path, help="registro.jsonl del simulador, para cruzar las órdenes y anclar la auditoría")
    args = parser.parse_args()

    if not args.carpeta.is_dir():
        print(f"No existe la carpeta {args.carpeta}")
        return 1

    informe = Informe()
    claves = cargar_claves(args.juzgados)
    auditoria = verificar_auditoria(args.carpeta, informe)
    manifiesto = verificar_archivos(args.carpeta, auditoria, informe)
    c = Contexto(claves, auditoria, informe)

    ordenes: List[dict] = []
    exportados: set = set()
    expedientes = sorted(args.carpeta.glob("expediente-*.json"))
    if not expedientes:
        informe.falla("No hay expedientes en la carpeta.")
    for ruta in expedientes:
        eid, propias = verificar_expediente(ruta, c)
        if eid:
            exportados.add(eid)
        ordenes.extend(propias)
    verificar_archivadas(args.carpeta, c)
    verificar_faltantes(c, exportados, manifiesto)
    if c.anclas:
        informe.bien(f"Anclas: las {len(c.anclas)} medidas guardan una cabecera de la auditoría que coincide con la cadena.")

    if args.registro:
        if args.registro.exists():
            verificar_registro(args.registro, ordenes, c)
        else:
            informe.falla(f"No existe el registro {args.registro}.")
    else:
        informe.anclaje.append(
            "Sin --registro no hay ancla externa: la carpeta es coherente consigo misma, pero una reescritura "
            "coherente de toda la carpeta (las claves de demostración son públicas) no se puede descartar."
        )

    print("Qué se comprobó")
    for linea in informe.correctas:
        print(f"  ✔ {linea}")
    if not claves:
        print("  · Sin --juzgados no se comprobaron las firmas.")
    print("\nQué ancla la auditoría")
    for linea in informe.anclaje:
        print(f"  · {linea}")
    for linea in informe.notas:
        print(f"  · {linea}")
    if informe.fallas:
        print("\nDiferencias")
        for linea in informe.fallas:
            print(f"  ✖ {linea}")
        print(f"\nVERIFICACIÓN FALLIDA: {len(informe.fallas)} diferencia(s).")
        return 1
    if args.registro:
        print("\nVERIFICACIÓN CORRECTA: la carpeta es coherente y coincide con el registro del simulador hasta donde lo ancla.")
    else:
        print("\nVERIFICACIÓN CORRECTA: la carpeta es coherente consigo misma (sin ancla externa).")
    return 0


if __name__ == "__main__":
    sys.exit(main())
