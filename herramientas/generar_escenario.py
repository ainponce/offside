#!/usr/bin/env python3
"""Genera un escenario propio para ensayar Offside (Python 3.9+, sin dependencias).

El partido final trae "las mismas situaciones, con otros sitios, otras IPs y otros
tiempos". Este generador produce partidos distintos al de práctica, con el mismo
formato que usa el simulador oficial, y agrega casos que la práctica no trae:

  - un pirata que retransmite la señal de un licenciatario fuera de sus dominios;
  - un pirata alojado en la misma IP que un licenciatario;
  - una detección sin marca de agua;
  - un dominio que imita al del licenciatario;
  - una filtración que salta de un servidor dedicado a un hosting compartido;
  - un proveedor que solo bloquea por IP;
  - otros jueces, más turnos y otro minuto de cambio de turno.

Uso:
    python3 herramientas/generar_escenario.py --semilla 7 --salida salida/escenario-7
    pnpm ensayo -- --carpeta salida/escenario-7

Escribe escenario.json, verdad.json, juzgados.json y proveedores.json (los cuatro
que leen el simulador y el verificador oficiales) y jueces.demo.json (los usuarios
de demostración para Offside). Todo es ficticio: dominios .test y .example, IPs de
documentación (RFC 5737) y ASN privados.
"""
import argparse
import base64
import json
import random
from pathlib import Path
from typing import Dict, List, Optional

NOMBRES_PIRATAS = ["futbolgratis", "verlapelota", "golenvivo", "tribunalibre", "pasegol", "canchaonline", "relatores-hd",
                   "partidazo", "lapelotanosemancha", "tirolibre"]
SITIOS_LEGITIMOS = ["panaderia-el-trigal.test", "club-social-norte.test", "escuela-rural-21.test", "ferreteria-don-luis.test",
                    "radio-fm-valle.test", "municipio-las-lomas.example", "biblioteca-popular.test", "veterinaria-patitas.test",
                    "diario-del-oeste.test", "cooperativa-electrica.example", "turismo-quebrada.example", "jardin-maternal.test",
                    "taller-mecanico-ruiz.test", "feria-de-productores.example", "consultorio-dental.test", "bomberos-voluntarios.test",
                    "inmobiliaria-centro.test", "academia-de-musica.test", "kiosco-la-esquina.test", "centro-vecinal.example"]
REDES = ["x", "telegram", "discord"]


class Generador:
    def __init__(self, semilla: int) -> None:
        self.r = random.Random(semilla)
        self.semilla = semilla
        self.fin = self.r.choice([96, 105, 105, 110, 120])
        self.liga = f"{self.r.choice(['CP', 'LF', 'TN', 'SA'])}{self.r.randint(24, 27)}-{self.r.choice(['FIN', 'SEM', 'F07', 'CLA'])}"
        self.ips: List[str] = [f"{bloque}.{n}" for bloque in ("192.0.2", "198.51.100", "203.0.113") for n in range(5, 250)]
        self.r.shuffle(self.ips)
        self.asn: Dict[str, str] = {}
        self.ip_asn: Dict[str, int] = {}
        self.dns: Dict[str, List[str]] = {}
        self.legitimos = list(SITIOS_LEGITIMOS)
        self.r.shuffle(self.legitimos)
        self.nombres = list(NOMBRES_PIRATAS)
        self.r.shuffle(self.nombres)
        self.piratas: List[str] = []
        self.streams: List[dict] = []
        self.eventos: List[dict] = []  # detecciones todavía sin id
        self.reclamos: List[dict] = []
        self.sufijos = iter(self.r.sample(range(100000, 999999), 40))
        self.asn_n = 64600

    # --- piezas -----------------------------------------------------------------------

    def nuevo_asn(self, nombre: str) -> int:
        self.asn_n += self.r.randint(3, 11)
        self.asn[str(self.asn_n)] = f"{nombre} (ficticio)"
        return self.asn_n

    def nueva_ip(self, asn: int, dominios: List[str]) -> str:
        ip = self.ips.pop()
        self.ip_asn[ip] = asn
        self.dns[ip] = list(dominios)
        return ip

    def marca_oficial(self) -> str:
        return f"{self.liga}-OFI-S{next(self.sufijos):06d}"

    def captura(self) -> dict:
        datos = bytes([0x47]) + bytes(self.r.getrandbits(8) for _ in range(63))
        return {"formato": "mpegts", "duracion_seg": 6, "contenido_b64": base64.b64encode(datos).decode("ascii")}

    def detectar(self, stream_id: str, host: str, ip: str, marca: Optional[str], desde: float, hasta: float, pagina: str,
                 promo: List[dict]) -> List[dict]:
        """Una detección al empezar la fase y otra cada 8 a 12 minutos."""
        lista, minuto = [], desde
        while minuto < min(hasta, self.fin) - 1:
            d = {"minuto": round(minuto, 1), "pagina": f"https://{pagina}/en-vivo",
                 "stream_url": f"https://{host}/hls/en-vivo/index.m3u8", "host_stream": host, "ip_servidor": ip,
                 "asn": self.ip_asn[ip], "marca_de_agua_extraida": marca,
                 "captura": dict(self.captura(), capturada_min=round(minuto, 1)), "promocion": promo, "_stream": stream_id}
            lista.append(d)
            minuto += self.r.choice([8, 9, 10, 11, 12])
        self.eventos.extend(lista)
        return lista

    def promocion(self, nombre: str, minuto: float) -> List[dict]:
        return [{"red": red, "url": f"https://{red}.example/{nombre}/{self.r.randint(1000, 9999)}",
                 "minuto": round(max(0.0, minuto - self.r.choice([1, 2, 3])), 1)}
                for red in self.r.sample(REDES, self.r.choice([1, 1, 2]))]

    def agregar_stream(self, stream_id: str, clase: str, fases: List[dict]) -> None:
        self.streams.append({"id": stream_id, "clase": clase, "fases": fases})

    def fase(self, stream_id: str, host: str, ip: str, marca: Optional[str], desde: float, hasta: float, pagina: str,
             recomendado: Optional[str]) -> dict:
        dets = self.detectar(stream_id, host, ip, marca, desde, hasta, pagina, self.promocion(stream_id, desde))
        return {"host": host, "ip": ip, "desde_min": desde, "hasta_min": hasta, "bloqueo_recomendado": recomendado,
                "_dets": dets}

    def compartida(self, nombre_asn: str, propios: List[str], cantidad: int, con_reclamos: int) -> str:
        vecinos = [self.legitimos.pop() for _ in range(cantidad)]
        for dominio in vecinos[:con_reclamos]:
            self.reclamos.append({"dominio": dominio, "demora_min": self.r.choice([2, 3, 4, 5, 6]),
                                  "mensaje": f"{dominio}: nuestro sitio dejó de cargar para parte de los usuarios."})
        dominios = propios + vecinos
        self.r.shuffle(dominios)
        return self.nueva_ip(self.nuevo_asn(nombre_asn), dominios)

    # --- el partido -------------------------------------------------------------------

    def armar(self) -> None:
        r, fin = self.r, self.fin
        dedicado = self.nuevo_asn(r.choice(["Bruma Hosting Dedicado", "Servidores del Litoral", "Datacenter Andino", "Racks del Sur"]))
        lic_nombre = r.choice(["Canal Cordillera", "Tevé del Norte", "Señal Pampa"])
        lic_dom = lic_nombre.lower().replace(" ", "").replace("é", "e").replace("ñ", "n") + ".test"
        self.lic = {"nombre": f"{lic_nombre} (ficticio)", "prefijo_marca": f"{self.liga}-LIC-{lic_dom.split('.')[0][:6].upper()}",
                    "dominios_autorizados": [lic_dom, f"vivo.{lic_dom}"]}
        asn_lic = self.nuevo_asn(lic_nombre)

        # 1. Pirata que salta entre servidores dedicados, con un dominio de respaldo en alguna IP.
        p = self.nombres.pop()
        marca, t, fases = self.marca_oficial(), r.choice([1.5, 2.0, 3.0]), []
        saltos = r.choice([2, 3, 3, 4])
        for i in range(saltos):
            host = f"s{i + 1}.{p}.test"
            hermanos = [host] + ([f"respaldo{i + 1}.{p}.test"] if r.random() < 0.5 else [])
            ip = self.nueva_ip(dedicado, hermanos)
            self.piratas.extend(hermanos)
            hasta = fin if i == saltos - 1 else round(t + (fin - t) / (saltos - i) * r.uniform(0.7, 1.0), 1)
            fases.append(self.fase(p, host, ip, marca, t, hasta, f"{p}.test", "ip"))
            t = round(hasta + r.choice([1.0, 1.5]), 1)
        self.agregar_stream(p, "pirata", fases)

        # 2. Pirata detrás de una CDN compartida: solo el dominio.
        p = self.nombres.pop()
        host = f"live.{p}.test"
        ip = self.compartida(r.choice(["NubeRápida CDN", "Borde Global CDN"]), [host], r.randint(6, 9), 2)
        self.piratas.append(host)
        self.agregar_stream(p, "pirata", [self.fase(p, host, ip, self.marca_oficial(), r.choice([5.0, 6.0, 8.0]), fin, f"{p}.test", "dominio")])

        # 3. Hosting compartido cuyo nombre no dice que es compartido: solo los vecinos lo delatan.
        p = self.nombres.pop()
        host = f"tv.{p}.test"
        ip = self.compartida(r.choice(["Pampa Web", "Alojamientos del Centro"]), [host, f"{p}.test"], r.randint(3, 5), 2)
        self.piratas.extend([host, f"{p}.test"])
        self.agregar_stream(p, "pirata", [self.fase(p, host, ip, self.marca_oficial(), r.choice([9.0, 11.0, 14.0]), fin, f"{p}.test", "dominio")])

        # 4. Filtración que empieza en un servidor dedicado y salta a un hosting compartido.
        p = self.nombres.pop()
        marca, corte = self.marca_oficial(), round(r.uniform(0.55, 0.75) * fin, 1)
        h1, h2 = f"x1.{p}.test", f"x2.{p}.test"
        ip1 = self.nueva_ip(dedicado, [h1])
        ip2 = self.compartida("Hosting Compartido Austral", [h2], r.randint(2, 4), 1)
        self.piratas.extend([h1, h2])
        inicio = round(r.uniform(0.35, 0.5) * fin, 1)
        self.agregar_stream(p, "pirata", [self.fase(p, h1, ip1, marca, inicio, corte, f"{p}.test", "ip"),
                                         self.fase(p, h2, ip2, marca, round(corte + 1.0, 1), fin, f"{p}.test", "dominio")])

        # 5. Pirata que retransmite la señal del licenciatario fuera de sus dominios.
        p = self.nombres.pop()
        host = f"hd.{p}.test"
        ip = self.nueva_ip(dedicado, [host])
        self.piratas.append(host)
        self.agregar_stream(p, "pirata", [self.fase(p, host, ip, self.lic["prefijo_marca"], r.choice([12.0, 18.0, 25.0]), fin, f"{p}.test", "ip")])

        # 6. Pirata con un dominio que imita al licenciatario, en la misma IP que el licenciatario.
        imitador = f"{lic_dom.split('.')[0]}-gratis.test"
        ip_lic = self.nueva_ip(asn_lic, [lic_dom, f"vivo.{lic_dom}", imitador])
        self.piratas.append(imitador)
        self.reclamos.append({"dominio": lic_dom, "demora_min": 2,
                              "mensaje": f"{lic_nombre}: somos licenciatarios autorizados y nuestra transmisión fue bloqueada."})
        self.agregar_stream("imitador", "pirata", [self.fase("imitador", imitador, ip_lic, self.marca_oficial(), r.choice([30.0, 42.0, 55.0]), fin, imitador, "dominio")])

        # 7. El licenciatario, en su dominio: no se toca.
        self.agregar_stream("licenciatario", "licenciatario", [self.fase("licenciatario", f"vivo.{lic_dom}", ip_lic, self.lic["prefijo_marca"], 4.0, fin, lic_dom, None)])

        # 8. Resumen de otro partido: otra marca.
        vod = "vod.resumenes-de-la-fecha.test"
        ip = self.nueva_ip(dedicado, [vod, "resumenes-de-la-fecha.test"])
        self.agregar_stream("resumenes", "falso_positivo", [self.fase("resumenes", vod, ip, f"XX23-F02-OFI-S{r.randint(100000, 999999)}", 20.0, 60.0, "resumenes-de-la-fecha.test", None)])

        # 9. Un stream sin marca de agua.
        sin = "camara.cancha-del-barrio.test"
        ip = self.nueva_ip(dedicado, [sin])
        self.agregar_stream("sin-marca", "falso_positivo", [self.fase("sin-marca", sin, ip, None, 33.0, 50.0, "cancha-del-barrio.test", None)])

    def turnos(self) -> List[dict]:
        cortes = sorted(self.r.sample(range(25, self.fin - 15), self.r.choice([1, 2])))
        limites = [-60] + cortes + [240]
        return [{"juez_id": f"juez-{i + 1}-ficticio", "desde_min": limites[i], "hasta_min": limites[i + 1]} for i in range(len(limites) - 1)]

    def escribir(self, salida: Path) -> None:
        self.armar()
        salida.mkdir(parents=True, exist_ok=True)
        self.eventos.sort(key=lambda d: (d["minuto"], d["host_stream"]))
        for n, d in enumerate(self.eventos, start=1):
            d["id"] = f"D-{n:04d}"
        streams = []
        for s in self.streams:
            fases = [dict({k: v for k, v in f.items() if k != "_dets"}, detecciones=[d["id"] for d in f["_dets"]]) for f in s["fases"]]
            streams.append({"id": s["id"], "clase": s["clase"], "fases": fases})
        detecciones = [{k: d[k] for k in ("id", "minuto", "pagina", "stream_url", "host_stream", "ip_servidor", "asn",
                                         "marca_de_agua_extraida", "captura", "promocion")} for d in self.eventos]
        escenario_id = f"propio-{self.semilla}"
        partido = {"id": escenario_id, "nombre": f"Partido propio {self.semilla} — Club Ficticio A vs. Club Ficticio B",
                   "titular_derechos": "Liga Ficticia de Ensayo", "inicio_iso": "2026-11-12T18:00:00-03:00", "fin_min": self.fin,
                   "marcas_de_agua_validas": [{"prefijo": f"{self.liga}-OFI", "origen": "Señal oficial del titular (plataforma propia)"},
                                              {"prefijo": self.lic["prefijo_marca"], "origen": f"Licenciatario autorizado: {self.lic['nombre']}"}],
                   "licenciatarios": [self.lic]}
        turnos = self.turnos()
        jueces = [{"id": t["juez_id"], "nombre": f"Dr/a. Ficticio {i + 1}", "clave_firma_demo": f"demo-clave-{self.semilla}-{i + 1}"}
                  for i, t in enumerate(turnos)]
        juzgados = [{"id": f"jg-ensayo-{i + 1}", "nombre": f"Juzgado de Garantías N.º {i + 1} (ficticio)",
                     "jurisdiccion": "Provincia Ficticia de Ensayo", "jueces": [j]} for i, j in enumerate(jueces)]
        r = self.r
        proveedores = [
            {"id": "grande", "nombre": "Red Grande (ficticio)", "tamano": "grande", "clientes": r.randint(25, 45) * 100000, "capacidades": ["ip", "dominio"], "comportamiento": {"demora_min": 0.5, "tasa_falla": 0.0}},
            {"id": "mediano", "nombre": "Telecom Mediano (ficticio)", "tamano": "mediano", "clientes": r.randint(8, 15) * 100000, "capacidades": ["ip", "dominio"], "comportamiento": {"demora_min": r.choice([1.5, 2.0, 3.0]), "tasa_falla": 0.0}},
            {"id": "solo-dominio", "nombre": "Fibra Solo Dominio (ficticio)", "tamano": "chico", "clientes": r.randint(8, 20) * 10000, "capacidades": ["dominio"], "comportamiento": {"demora_min": r.choice([4.0, 6.0, 7.0]), "tasa_falla": 0.0}},
            {"id": "inestable", "nombre": "Cooperativa Inestable (ficticio)", "tamano": "chico", "clientes": r.randint(4, 9) * 10000, "capacidades": ["ip", "dominio"], "comportamiento": {"demora_min": 3.0, "tasa_falla": r.choice([0.3, 0.4, 0.5])}},
            {"id": "solo-ip", "nombre": "Cable Solo IP (ficticio)", "tamano": "chico", "clientes": r.randint(2, 6) * 10000, "capacidades": ["ip"], "comportamiento": {"demora_min": 2.0, "tasa_falla": 0.0}},
        ]
        aviso = "Escenario ficticio generado para ensayar. Dominios .test/.example, IPs de documentación (RFC 5737), ASN privados."

        def guardar(nombre: str, datos: dict) -> None:
            (salida / nombre).write_text(json.dumps(datos, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

        guardar("escenario.json", {"id": escenario_id, "aviso": aviso, "partido": partido, "asn": self.asn, "ip_asn": self.ip_asn,
                                   "dns_pasivo": self.dns, "reclamos_automaticos": self.reclamos, "detecciones": detecciones})
        guardar("verdad.json", {"escenario_id": escenario_id, "fin_min": self.fin, "gracia_min": 5,
                                "dominios_piratas": sorted(set(self.piratas)), "streams": streams})
        guardar("juzgados.json", {"aviso": aviso, "juzgados": juzgados, "turnos": turnos})
        guardar("proveedores.json", {"aviso": aviso, "proveedores": proveedores})
        guardar("jueces.demo.json", {
            "aviso": "Usuarios de demostración para ensayar con este escenario.",
            "jueces": [{"id": j["id"], "nombre": j["nombre"], "juzgado_id": juzgados[i]["id"], "juzgado_nombre": juzgados[i]["nombre"],
                        "clave_firma_demo": j["clave_firma_demo"], "usuario": f"juez{i + 1}", "contrasena": f"ensayo-juez{i + 1}"}
                       for i, j in enumerate(jueces)],
            "operadores": [{"usuario": "fiscalia", "contrasena": "ensayo-fiscalia", "nombre": "Fiscalía (ensayo)", "rol": "fiscalia"}]})
        piratas = sum(len(s["fases"]) for s in streams if s["clase"] == "pirata")
        print(f"Escenario {escenario_id} en {salida}: partido de {self.fin} min, {len(detecciones)} detecciones, "
              f"{piratas} fases piratas, {len(turnos)} turnos (cambios en {[t['desde_min'] for t in turnos[1:]]}), {len(proveedores)} proveedores.")


def main() -> None:
    parser = argparse.ArgumentParser(description="Genera un escenario propio para ensayar Offside")
    parser.add_argument("--semilla", type=int, default=1)
    parser.add_argument("--salida", type=Path, required=True)
    args = parser.parse_args()
    Generador(args.semilla).escribir(args.salida)


if __name__ == "__main__":
    main()
