# Expediente EXP-2026-000002

**Filtración:** marca de agua `LP26-PRA-OFI-S077310` (prefijo LP26-PRA-OFI, Señal oficial del titular (plataforma propia)).

Abierto en el minuto 6 del partido. Los tiempos de este documento son minutos de partido.

## Servidores

| Servidor | IP | Organización | Primera detección | Detecciones | Bloqueo propuesto | Primer bloqueo confirmado | Sitios ajenos en la IP |
| --- | --- | --- | --- | --- | --- | --- | --- |
| live.golazo-libre.test | 198.51.100.20 | NubeRápida CDN (ficticia) | 6 | 10 | dominio | a los 1.51 min | 11 |

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

**Huella de lo que vio el juez:** `4d9f8da7a46d456f3dc3070969f670c60446c852b22757dd1bbd3d915ac08df0`

**Decisión:** Aprobada por Dra. Laura Ficticia, minuto 7 del partido (2026-11-11T23:07:35.031Z).

**Órdenes**

| Proveedor | Tipo | Objetivo | Intento | Estado | Enviada | Aplicada | Fin | Vence | Identificador |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| andina | dominio | live.golazo-libre.test | 1 | vencida | 7 | 9.222 | 105 | 105 | `OFS-000002-0002-andina-1-4d9f8da7a46d456f` |
| aurora | dominio | live.golazo-libre.test | 1 | vencida | 7 | 7.507 | 105 | 105 | `OFS-000002-0002-aurora-1-4d9f8da7a46d456f` |
| cumbre | dominio | live.golazo-libre.test | 1 | vencida | 7 | 9.321 | 105 | 105 | `OFS-000002-0002-cumbre-1-4d9f8da7a46d456f` |
| valle | dominio | live.golazo-libre.test | 1 | vencida | 7 | 13.613 | 105 | 105 | `OFS-000002-0002-valle-1-4d9f8da7a46d456f` |

## Aviso al titular

Aviso al titular de derechos — Expediente EXP-2026-000002.
La señal con marca de agua LP26-PRA-OFI-S077310 se está retransmitiendo sin autorización desde 1 servidor: live.golazo-libre.test (198.51.100.20).
Esa marca identifica de dónde sale la filtración. Se solicita ubicar la fuente asociada y cortarla: es la única medida que el operador no esquiva cambiando de servidor y que no puede afectar a terceros.
Nota: el simulador del desafío no modela este paso; el aviso se genera pero no tiene a quién enviarse.

## Registro de auditoría de este expediente

| Sec. | Minuto | Actor | Evento | Hash |
| --- | --- | --- | --- | --- |
| 15 | 6 | sistema | Se abrió EXP-2026-000002 por la marca LP26-PRA-OFI-S077310. | `66d60793d893230e…` |
| 16 | 6 | sistema | Medida M-0002 (inicial) presentada al juez de turno: live.golazo-libre.test por dominio. | `2dbc5897c217bb03…` |
| 18 | 7 | jueza-laura-ficticia | Dra. Laura Ficticia aprobó la medida M-0002. | `0e654baeca485264…` |
| 19 | 7 | sistema | Orden enviada a aurora: dominio live.golazo-libre.test. | `5cedf23363c118db…` |
| 20 | 7 | sistema | Orden enviada a andina: dominio live.golazo-libre.test. | `6bb69d76602193e2…` |
| 21 | 7 | sistema | Orden enviada a cumbre: dominio live.golazo-libre.test. | `e9eed4ed34018ff4…` |
| 22 | 7 | sistema | Orden enviada a valle: dominio live.golazo-libre.test. | `993ce61f1fcf1667…` |
| 24 | 7.51 | aurora | aurora confirmó el bloqueo de live.golazo-libre.test. | `83fa618e7c1182e1…` |
| 27 | 9.22 | andina | andina confirmó el bloqueo de live.golazo-libre.test. | `310fa0fe55263a3b…` |
| 28 | 9.32 | cumbre | cumbre confirmó el bloqueo de live.golazo-libre.test. | `cf7b8b97d10c8b50…` |
| 38 | 13.61 | valle | valle confirmó el bloqueo de live.golazo-libre.test. | `af7ac2462532233d…` |
| 39 | 16 | sistema | Nueva evidencia en EXP-2026-000002: detección D-0006. | `12cb5c9c06c678ed…` |
| 44 | 26.01 | sistema | Nueva evidencia en EXP-2026-000002: detección D-0010. | `50299a3b5c78b8a4…` |
| 47 | 36.01 | sistema | Nueva evidencia en EXP-2026-000002: detección D-0013. | `5bffe74e2d703561…` |
| 60 | 46.01 | sistema | Nueva evidencia en EXP-2026-000002: detección D-0017. | `31640f6e8120be30…` |
| 67 | 56 | sistema | Nueva evidencia en EXP-2026-000002: detección D-0022. | `ad8ac201b16a67d8…` |
| 80 | 66 | sistema | Nueva evidencia en EXP-2026-000002: detección D-0026. | `0e45eddf7cbaa3d0…` |
| 95 | 76 | sistema | Nueva evidencia en EXP-2026-000002: detección D-0031. | `b4fa7db58d52ca41…` |
| 112 | 86.01 | sistema | Nueva evidencia en EXP-2026-000002: detección D-0036. | `1180a3a5027bb6d2…` |
| 118 | 96.01 | sistema | Nueva evidencia en EXP-2026-000002: detección D-0040. | `70f0491cc1781c07…` |
| 126 | 105 | aurora | Venció el bloqueo de live.golazo-libre.test en aurora. | `935a05b4e79771ee…` |
| 127 | 105 | andina | Venció el bloqueo de live.golazo-libre.test en andina. | `8dda6bd4e4b709d2…` |
| 128 | 105 | valle | Venció el bloqueo de live.golazo-libre.test en valle. | `8604f8d6115b33e2…` |
| 129 | 105 | cumbre | Venció el bloqueo de live.golazo-libre.test en cumbre. | `410dacce5ee20cbc…` |
| 151 | 110.61 | sistema | Exportación a entrega/practica. | `920d4719407dab2d…` |

La integridad de este expediente se comprueba con `python3 herramientas/verificar_expediente.py <carpeta>`.
