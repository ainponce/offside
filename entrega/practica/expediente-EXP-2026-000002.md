# Expediente EXP-2026-000002

**Partido:** Partido de práctica — Club Ficticio del Norte vs. Deportivo Ejemplo · Titular de derechos: Liga Profesional Ficticia

**Filtración:** marca de agua `LP26-PRA-OFI-S077310` (prefijo LP26-PRA-OFI, Señal oficial del titular (plataforma propia)).

Abierto en el minuto 6 del partido. Los tiempos de este documento son minutos de partido.

## Servidores

| Servidor | IP | Organización | Primera detección | Detecciones | Bloqueo propuesto | Primer bloqueo confirmado | Sitios ajenos en la IP |
| --- | --- | --- | --- | --- | --- | --- | --- |
| live.golazo-libre.test | 198.51.100.20 | NubeRápida CDN (ficticia) | 6 | 10 | por dominio | a los 1,61 min | 11 |

## Medidas

### M-0002 · Medida inicial

**Pedido:** Bloquear el dominio live.golazo-libre.test en todos los proveedores hasta el final del partido.

**Servidor:** live.golazo-libre.test · 198.51.100.20 · AS64610 NubeRápida CDN (ficticia)

**Verificaciones**

- ✔ **Es la señal oficial del partido.** La marca LP26-PRA-OFI-S077310 lleva el prefijo LP26-PRA-OFI (Señal oficial del titular (plataforma propia)).
- ✔ **No es un licenciatario en su dominio.** live.golazo-libre.test no es un dominio autorizado. Señal oficial del partido en un sitio sin autorización.
- ✔ **Servidor identificado.** live.golazo-libre.test · 198.51.100.20 · AS64610 NubeRápida CDN (ficticia).
- ✔ **IP compartida: se bloquea solo el dominio.** La IP aloja 11 sitios ajenos (tienda-mate-y-yerba.test, noticias-del-valle.test, turismo-cafayate.example y 8 más). Ninguno queda afectado.

**Sitios ajenos en la misma IP (no se bloquean):** tienda-mate-y-yerba.test, noticias-del-valle.test, turismo-cafayate.example, radio-comunitaria-fm.test, municipio-ejemplo.example, biblioteca-popular-norte.test, delivery-salta-ejemplo.test, clinica-veterinaria-sol.test, inmobiliaria-ejemplo.test, academia-de-ingles.test, feria-artesanal.example

**Evidencia**

| Detección | Minuto | SHA-256 de la detección | SHA-256 de la captura |
| --- | --- | --- | --- |
| D-0003 | 6 | fb5132088f7fadeaf2d3dd16133c6de9f234fa575e9251a52cf1ed12a02c94b9 | 485b937379e696ae00920a738d03b3062ef615309dda5a10b2eb90a001f6665e |

**Dónde se promocionó:** x (https://x.example/golazolibre/status/2207), discord (https://discord.example/invite/golazo-hoy)

**Huella de lo que vio el juez:** `35a64e43c621089c275de5e8e19cfdef7f8775a49512f333de25c6a20e0cec73`

**Decisión:** Aprobada por Dra. Laura Ficticia, minuto 7 del partido (2026-11-12T01:37:33.045Z).

**Órdenes**

| Proveedor | Tipo | Objetivo | Intento | Estado | Enviada | Aplicada | Fin | Vence | Identificador |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Red Andina Telecom (ficticio) | dominio | live.golazo-libre.test | 1 | vencida | 7,01 | 9,61 | 105 | 105 | `OFS-000002-0002-andina-1-35a64e43c621089c` |
| Conectividad Aurora (ficticio) | dominio | live.golazo-libre.test | 1 | vencida | 7,01 | 7,61 | 105 | 105 | `OFS-000002-0002-aurora-1-35a64e43c621089c` |
| Cooperativa Cumbre Conecta (ficticio) | dominio | live.golazo-libre.test | 1 | vencida | 7,01 | 10,72 | 105 | 105 | `OFS-000002-0002-cumbre-1-35a64e43c621089c` |
| FibraValle (ficticio) | dominio | live.golazo-libre.test | 1 | vencida | 7,01 | 12,54 | 105 | 105 | `OFS-000002-0002-valle-1-35a64e43c621089c` |

## Aviso al titular

Aviso al titular de los derechos (Liga Profesional Ficticia) — Expediente EXP-2026-000002.
La señal con marca de agua LP26-PRA-OFI-S077310 se está retransmitiendo sin autorización desde 1 servidor: live.golazo-libre.test (IP 198.51.100.20).
Esa marca identifica de dónde sale la filtración. Se solicita ubicar la fuente asociada y cortarla: es la única medida que el operador no esquiva cambiando de servidor y que no puede afectar a terceros.
Nota: el simulador del desafío no modela este paso; el aviso se genera pero no tiene a quién enviarse.

## Registro de auditoría de este expediente

| Sec. | Minuto | Actor | Evento | Hash |
| --- | --- | --- | --- | --- |
| 23 | 6 | sistema | Se abrió EXP-2026-000002 por la marca LP26-PRA-OFI-S077310. | `9f48d170474f5ba1…` |
| 24 | 6 | sistema | Se presentó al juez de turno la medida inicial M-0002: bloquear el dominio live.golazo-libre.test. | `3cb6b7ecaed2de59…` |
| 25 | 7,01 | jueza-laura-ficticia | Dra. Laura Ficticia aprobó la medida M-0002. | `848f3a7b7c3e5efd…` |
| 26 | 7,01 | jueza-laura-ficticia | Dra. Laura Ficticia firmó la orden para Conectividad Aurora (ficticio): bloquear el dominio live.golazo-libre.test. | `ac3bca7948cfc827…` |
| 27 | 7,01 | jueza-laura-ficticia | Dra. Laura Ficticia firmó la orden para Red Andina Telecom (ficticio): bloquear el dominio live.golazo-libre.test. | `b9fcce2d42be0a90…` |
| 28 | 7,01 | jueza-laura-ficticia | Dra. Laura Ficticia firmó la orden para FibraValle (ficticio): bloquear el dominio live.golazo-libre.test. | `3297a902e2c103c6…` |
| 29 | 7,01 | jueza-laura-ficticia | Dra. Laura Ficticia firmó la orden para Cooperativa Cumbre Conecta (ficticio): bloquear el dominio live.golazo-libre.test. | `a80fd062b1c7fd40…` |
| 30 | 7,01 | sistema | Orden enviada a Conectividad Aurora (ficticio): bloquear el dominio live.golazo-libre.test. | `2ff840adf214d664…` |
| 31 | 7,01 | sistema | Orden enviada a Red Andina Telecom (ficticio): bloquear el dominio live.golazo-libre.test. | `58e1ff671f3552f1…` |
| 32 | 7,01 | sistema | Orden enviada a FibraValle (ficticio): bloquear el dominio live.golazo-libre.test. | `307a45157087d0d2…` |
| 33 | 7,01 | sistema | Orden enviada a Cooperativa Cumbre Conecta (ficticio): bloquear el dominio live.golazo-libre.test. | `44173d439c92cc84…` |
| 34 | 7,61 | aurora | Conectividad Aurora (ficticio) aplicó el bloqueo del dominio live.golazo-libre.test. | `7246ddf669bc3891…` |
| 39 | 9,61 | andina | Red Andina Telecom (ficticio) aplicó el bloqueo del dominio live.golazo-libre.test. | `c423201921afbea1…` |
| 50 | 10,72 | cumbre | Cooperativa Cumbre Conecta (ficticio) aplicó el bloqueo del dominio live.golazo-libre.test. | `261dddfd4c1dee90…` |
| 54 | 12,54 | valle | FibraValle (ficticio) aplicó el bloqueo del dominio live.golazo-libre.test. | `ff326793e01462ff…` |
| 56 | 16,01 | sistema | Nueva evidencia en EXP-2026-000002: detección D-0006. | `a08040840abe6c52…` |
| 60 | 26 | sistema | Nueva evidencia en EXP-2026-000002: detección D-0010. | `562a7a46336fa989…` |
| 63 | 36,01 | sistema | Nueva evidencia en EXP-2026-000002: detección D-0013. | `9d37b4a8cbaf4b74…` |
| 80 | 46 | sistema | Nueva evidencia en EXP-2026-000002: detección D-0017. | `4c3e2d304dbe7103…` |
| 87 | 56,01 | sistema | Nueva evidencia en EXP-2026-000002: detección D-0022. | `9bfd700d8d0469cc…` |
| 112 | 66,01 | sistema | Nueva evidencia en EXP-2026-000002: detección D-0026. | `30cd2e19a5815805…` |
| 132 | 76,01 | sistema | Nueva evidencia en EXP-2026-000002: detección D-0031. | `7abf246b606ad2b8…` |
| 150 | 86 | sistema | Nueva evidencia en EXP-2026-000002: detección D-0036. | `54f163e510d794aa…` |
| 156 | 96,01 | sistema | Nueva evidencia en EXP-2026-000002: detección D-0040. | `e8c2fa6d75e5b648…` |
| 164 | 105 | aurora | Venció el bloqueo del dominio live.golazo-libre.test en Conectividad Aurora (ficticio). | `c6f1865cea3a7853…` |
| 165 | 105 | andina | Venció el bloqueo del dominio live.golazo-libre.test en Red Andina Telecom (ficticio). | `ac546901ab233449…` |
| 166 | 105 | valle | Venció el bloqueo del dominio live.golazo-libre.test en FibraValle (ficticio). | `098c1dc3bf96004c…` |
| 167 | 105 | cumbre | Venció el bloqueo del dominio live.golazo-libre.test en Cooperativa Cumbre Conecta (ficticio). | `9bd6a06fff5e3b62…` |

La integridad de este expediente se comprueba con `python3 herramientas/verificar_expediente.py <carpeta> --juzgados <claves> --registro <registro del simulador>`. Sin el registro del simulador, el verificador solo prueba que la carpeta es coherente consigo misma.
