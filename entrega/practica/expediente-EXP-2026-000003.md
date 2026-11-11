# Expediente EXP-2026-000003

**Filtración:** marca de agua `LP26-PRA-OFI-S010457` (prefijo LP26-PRA-OFI, Señal oficial del titular (plataforma propia)).

Abierto en el minuto 9 del partido. Los tiempos de este documento son minutos de partido.

## Servidores

| Servidor | IP | Organización | Primera detección | Detecciones | Bloqueo propuesto | Primer bloqueo confirmado | Sitios ajenos en la IP |
| --- | --- | --- | --- | --- | --- | --- | --- |
| tv.verpartido-hd.test | 192.0.2.50 | Pampa Web Hosting Compartido (ficticio) | 9 | 10 | dominio | a los 1.5 min | 4 |

## Medidas

### M-0003 · Medida inicial

**Pedido:** Bloquear el dominio tv.verpartido-hd.test en todos los proveedores hasta el final del partido.

**Servidor:** tv.verpartido-hd.test · 192.0.2.50 · AS64620 Pampa Web Hosting Compartido (ficticio)

**Verificaciones**

- ✔ **Es la señal oficial del partido.** La marca LP26-PRA-OFI-S010457 lleva el prefijo LP26-PRA-OFI (Señal oficial del titular (plataforma propia)).
- ✔ **No es un licenciatario en su dominio.** tv.verpartido-hd.test no es un dominio autorizado. Señal oficial del partido en un sitio sin autorización.
- ✔ **Servidor identificado.** tv.verpartido-hd.test · 192.0.2.50 · AS64620 Pampa Web Hosting Compartido (ficticio).
- ✔ **IP compartida: se bloquea solo el dominio.** La IP aloja 4 sitios ajenos (panaderia-la-espiga.test, club-atletico-barrio-norte.test, escuela-tecnica-12.test y 1 más). Ninguno queda afectado.

**Sitios ajenos en la misma IP (no se bloquean):** panaderia-la-espiga.test, club-atletico-barrio-norte.test, escuela-tecnica-12.test, estudio-contable-ruiz.test

**Evidencia**

| Detección | Minuto | SHA-256 de la detección | SHA-256 de la captura |
| --- | --- | --- | --- |
| D-0004 | 9 | b572e29708b081cbd452605a2a240b0659e52435d9585562d90b0d8c17882855 | b3e5dd0f6977847eea9f86d67cc43e2d8b9aa378b92a131fa358e10db718b796 |

**Dónde se promocionó:** telegram (https://t.example/verpartidohd)

**Huella de lo que vio el juez:** `f51a6de8f70b2ab0f102c3f37bcbd0a25d402c23c05e0453964ecb21a167f69b`

**Decisión:** Aprobada por Dra. Laura Ficticia, minuto 10.01 del partido (2026-11-11T23:08:05.099Z).

**Órdenes**

| Proveedor | Tipo | Objetivo | Intento | Estado | Enviada | Aplicada | Fin | Vence | Identificador |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| andina | dominio | tv.verpartido-hd.test | 1 | vencida | 10.01 | 11.763 | 105 | 105 | `OFS-000003-0003-andina-1-f51a6de8f70b2ab0` |
| aurora | dominio | tv.verpartido-hd.test | 1 | vencida | 10.01 | 10.496 | 105 | 105 | `OFS-000003-0003-aurora-1-f51a6de8f70b2ab0` |
| cumbre | dominio | tv.verpartido-hd.test | 1 | vencida | 10.01 | 13.122 | 105 | 105 | `OFS-000003-0003-cumbre-1-f51a6de8f70b2ab0` |
| valle | dominio | tv.verpartido-hd.test | 1 | vencida | 10.01 | 17.299 | 105 | 105 | `OFS-000003-0003-valle-1-f51a6de8f70b2ab0` |

## Aviso al titular

Aviso al titular de derechos — Expediente EXP-2026-000003.
La señal con marca de agua LP26-PRA-OFI-S010457 se está retransmitiendo sin autorización desde 1 servidor: tv.verpartido-hd.test (192.0.2.50).
Esa marca identifica de dónde sale la filtración. Se solicita ubicar la fuente asociada y cortarla: es la única medida que el operador no esquiva cambiando de servidor y que no puede afectar a terceros.
Nota: el simulador del desafío no modela este paso; el aviso se genera pero no tiene a quién enviarse.

## Registro de auditoría de este expediente

| Sec. | Minuto | Actor | Evento | Hash |
| --- | --- | --- | --- | --- |
| 25 | 9 | sistema | Se abrió EXP-2026-000003 por la marca LP26-PRA-OFI-S010457. | `2c21fe342ec0ef7d…` |
| 26 | 9 | sistema | Medida M-0003 (inicial) presentada al juez de turno: tv.verpartido-hd.test por dominio. | `633bcbd43eed67aa…` |
| 29 | 10.01 | jueza-laura-ficticia | Dra. Laura Ficticia aprobó la medida M-0003. | `8fbb46fdb8283ea3…` |
| 30 | 10.01 | sistema | Orden enviada a aurora: dominio tv.verpartido-hd.test. | `ac2530a0d09a0bcb…` |
| 31 | 10.01 | sistema | Orden enviada a valle: dominio tv.verpartido-hd.test. | `3043cdf8c52fcdb9…` |
| 32 | 10.01 | sistema | Orden enviada a cumbre: dominio tv.verpartido-hd.test. | `97b756ee655fc2b8…` |
| 33 | 10.01 | sistema | Orden enviada a andina: dominio tv.verpartido-hd.test. | `3d3daf5039b8b771…` |
| 34 | 10.5 | aurora | aurora confirmó el bloqueo de tv.verpartido-hd.test. | `11e476cf0c49124f…` |
| 35 | 11.76 | andina | andina confirmó el bloqueo de tv.verpartido-hd.test. | `2be9787bf20e5b0b…` |
| 37 | 13.12 | cumbre | cumbre confirmó el bloqueo de tv.verpartido-hd.test. | `2d1eabf4552e45b0…` |
| 40 | 17.3 | valle | valle confirmó el bloqueo de tv.verpartido-hd.test. | `a49b3d248c01ad37…` |
| 41 | 19 | sistema | Nueva evidencia en EXP-2026-000003: detección D-0007. | `401b9ccdd60e514b…` |
| 45 | 29.01 | sistema | Nueva evidencia en EXP-2026-000003: detección D-0011. | `e840a12ea3985078…` |
| 54 | 39.01 | sistema | Nueva evidencia en EXP-2026-000003: detección D-0015. | `95c92e5d8cad65e8…` |
| 62 | 49.01 | sistema | Nueva evidencia en EXP-2026-000003: detección D-0019. | `00e3d040955f0fb6…` |
| 76 | 59 | sistema | Nueva evidencia en EXP-2026-000003: detección D-0024. | `ea557f3e4ab04b4c…` |
| 82 | 69 | sistema | Nueva evidencia en EXP-2026-000003: detección D-0028. | `01fba4124b716fbe…` |
| 97 | 79.01 | sistema | Nueva evidencia en EXP-2026-000003: detección D-0032. | `849025c52e2ca957…` |
| 114 | 89.01 | sistema | Nueva evidencia en EXP-2026-000003: detección D-0037. | `9bfae5a9b3be78c7…` |
| 119 | 99 | sistema | Nueva evidencia en EXP-2026-000003: detección D-0041. | `b51625fbea495fee…` |
| 130 | 105 | aurora | Venció el bloqueo de tv.verpartido-hd.test en aurora. | `f4db3b431ee71cce…` |
| 131 | 105 | andina | Venció el bloqueo de tv.verpartido-hd.test en andina. | `e65ba3fa43fd1094…` |
| 132 | 105 | valle | Venció el bloqueo de tv.verpartido-hd.test en valle. | `db22b84ad66cf3c7…` |
| 133 | 105 | cumbre | Venció el bloqueo de tv.verpartido-hd.test en cumbre. | `50079ffd009cf68d…` |
| 151 | 110.61 | sistema | Exportación a entrega/practica. | `920d4719407dab2d…` |

La integridad de este expediente se comprueba con `python3 herramientas/verificar_expediente.py <carpeta>`.
