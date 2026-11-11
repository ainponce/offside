# Expediente EXP-2026-000001

**Filtración:** marca de agua `LP26-PRA-OFI-S048211` (prefijo LP26-PRA-OFI, Señal oficial del titular (plataforma propia)).

Abierto en el minuto 2 del partido. Los tiempos de este documento son minutos de partido.

## Servidores

| Servidor | IP | Organización | Primera detección | Detecciones | Bloqueo propuesto | Primer bloqueo confirmado | Sitios ajenos en la IP |
| --- | --- | --- | --- | --- | --- | --- | --- |
| s1.pelotaya.test | 203.0.113.10 | Bruma Hosting Dedicado (ficticio) | 2 | 4 | ip | a los 1.46 min | 0 |
| s2.pelotaya.test | 203.0.113.11 | Bruma Hosting Dedicado (ficticio) | 37.5 | 4 | ip | a los 1.55 min | 0 |
| s3.pelotaya.test | 198.51.100.77 | Servidores Litoral (ficticio) | 71 | 4 | ip | a los 1.37 min | 0 |

## Medidas

### M-0001 · Medida inicial

**Pedido:** Bloquear la IP 203.0.113.10 en todos los proveedores hasta el final del partido.

**Servidor:** s1.pelotaya.test · 203.0.113.10 · AS64600 Bruma Hosting Dedicado (ficticio)

**Verificaciones**

- ✔ **Es la señal oficial del partido.** La marca LP26-PRA-OFI-S048211 lleva el prefijo LP26-PRA-OFI (Señal oficial del titular (plataforma propia)).
- ✔ **No es un licenciatario en su dominio.** s1.pelotaya.test no es un dominio autorizado. Señal oficial del partido en un sitio sin autorización.
- ✔ **Servidor identificado.** s1.pelotaya.test · 203.0.113.10 · AS64600 Bruma Hosting Dedicado (ficticio).
- ✔ **IP exclusiva del operador.** La IP solo aloja dominios del mismo operador (pelotaya.test): se bloquea la IP.

**Evidencia**

| Detección | Minuto | SHA-256 de la detección | SHA-256 de la captura |
| --- | --- | --- | --- |
| D-0001 | 2 | 6db4afccf99d4958f7b3098a599c4c4ab361e5add13ed3c616041a02e8d4ad01 | 77b14ea8874ef8bbbf99cc292fd820a9e8df09fa4d4c00ebaeb9003e6b9bfbe1 |

**Dónde se promocionó:** x (https://x.example/futbolya_ok/status/1001)

**Huella de lo que vio el juez:** `087da1639e7d1d406ae5e48b006a8efd5b4d4d20903b5106797e5ab33a86d69a`

**Decisión:** Aprobada por Dra. Laura Ficticia, minuto 3 del partido (2026-11-11T23:06:55.077Z).

**Órdenes**

| Proveedor | Tipo | Objetivo | Intento | Estado | Enviada | Aplicada | Fin | Vence | Identificador |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| andina | ip | 203.0.113.10 | 1 | vencida | 3 | 5.395 | 105 | 105 | `OFS-000001-0001-andina-1-087da1639e7d1d40` |
| aurora | ip | 203.0.113.10 | 1 | vencida | 3 | 3.455 | 105 | 105 | `OFS-000001-0001-aurora-1-087da1639e7d1d40` |
| cumbre | ip | 203.0.113.10 | 1 | vencida | 3 | 6.673 | 105 | 105 | `OFS-000001-0001-cumbre-1-087da1639e7d1d40` |
| valle | dominio | s1.pelotaya.test | 1 | vencida | 3 | 7.472 | 105 | 105 | `OFS-000001-0001-valle-1-087da1639e7d1d40` |

### M-0004 · Ampliación

**Pedido:** Ampliar el expediente a un servidor nuevo de la misma filtración: bloquear la IP 203.0.113.11 hasta el final del partido.

**Servidor:** s2.pelotaya.test · 203.0.113.11 · AS64600 Bruma Hosting Dedicado (ficticio)

**Verificaciones**

- ✔ **Es la señal oficial del partido.** La marca LP26-PRA-OFI-S048211 lleva el prefijo LP26-PRA-OFI (Señal oficial del titular (plataforma propia)).
- ✔ **No es un licenciatario en su dominio.** s2.pelotaya.test no es un dominio autorizado. Señal oficial del partido en un sitio sin autorización.
- ✔ **Servidor identificado.** s2.pelotaya.test · 203.0.113.11 · AS64600 Bruma Hosting Dedicado (ficticio).
- ✔ **IP exclusiva del operador.** La IP solo aloja este servidor: se bloquea la IP.

**Evidencia**

| Detección | Minuto | SHA-256 de la detección | SHA-256 de la captura |
| --- | --- | --- | --- |
| D-0014 | 37.5 | 022711219693e7dbc86bc37fd6e3477f95e9ffea3f5b7310cc277da9871af8f9 | f27a4a5fba9cfc873c9750f4186c354c253b9dcb696de7b8c2bc789e0217ebe7 |

**Dónde se promocionó:** x (https://x.example/futbolya_ok/status/1001)

**Huella de lo que vio el juez:** `34857af1926ab31044731cd3bd48be86286343be6c9a044e415293442f505fa2`

**Decisión:** Aprobada por Dra. Laura Ficticia, minuto 38.5 del partido (2026-11-11T23:12:50.139Z).

**Órdenes**

| Proveedor | Tipo | Objetivo | Intento | Estado | Enviada | Aplicada | Fin | Vence | Identificador |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| andina | ip | 203.0.113.11 | 1 | vencida | 38.5 | 40.84 | 105 | 105 | `OFS-000001-0004-andina-1-34857af1926ab310` |
| aurora | ip | 203.0.113.11 | 1 | vencida | 38.5 | 39.049 | 105 | 105 | `OFS-000001-0004-aurora-1-34857af1926ab310` |
| cumbre | ip | 203.0.113.11 | 1 | vencida | 38.5 | 40.931 | 105 | 105 | `OFS-000001-0004-cumbre-1-34857af1926ab310` |
| valle | dominio | s2.pelotaya.test | 1 | vencida | 38.5 | 44.333 | 105 | 105 | `OFS-000001-0004-valle-1-34857af1926ab310` |

### M-0006 · Ampliación

**Pedido:** Ampliar el expediente a un servidor nuevo de la misma filtración: bloquear la IP 198.51.100.77 hasta el final del partido.

**Servidor:** s3.pelotaya.test · 198.51.100.77 · AS64630 Servidores Litoral (ficticio)

**Verificaciones**

- ✔ **Es la señal oficial del partido.** La marca LP26-PRA-OFI-S048211 lleva el prefijo LP26-PRA-OFI (Señal oficial del titular (plataforma propia)).
- ✔ **No es un licenciatario en su dominio.** s3.pelotaya.test no es un dominio autorizado. Señal oficial del partido en un sitio sin autorización.
- ✔ **Servidor identificado.** s3.pelotaya.test · 198.51.100.77 · AS64630 Servidores Litoral (ficticio).
- ✔ **IP exclusiva del operador.** La IP solo aloja dominios del mismo operador (pelotaya.test): se bloquea la IP.

**Evidencia**

| Detección | Minuto | SHA-256 de la detección | SHA-256 de la captura |
| --- | --- | --- | --- |
| D-0029 | 71 | 4e234ee930b094613bb93fc8ea2f76a70f422e911b78d2768c5ffec1a904c074 | d34e0c24d029af9fd4e51398efa7a3f96d8b96fc6f67cb145f9b285968d8e227 |

**Dónde se promocionó:** x (https://x.example/futbolya_ok/status/1001)

**Huella de lo que vio el juez:** `bab071ab3913e373e39621d8ba982659097f9e64cc52bb2562aabff88c1f09ce`

**Decisión:** Aprobada por Dr. Martín Ejemplo, minuto 72.02 del partido (2026-11-11T23:18:25.270Z).

**Órdenes**

| Proveedor | Tipo | Objetivo | Intento | Estado | Enviada | Aplicada | Fin | Vence | Identificador |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| andina | ip | 198.51.100.77 | 1 | vencida | 72.02 | 74.426 | 105 | 105 | `OFS-000001-0006-andina-1-bab071ab3913e373` |
| aurora | ip | 198.51.100.77 | 1 | vencida | 72.02 | 72.374 | 105 | 105 | `OFS-000001-0006-aurora-1-bab071ab3913e373` |
| cumbre | ip | 198.51.100.77 | 1 | fallida | 72.02 | — | — | 105 | `OFS-000001-0006-cumbre-1-bab071ab3913e373` |
| cumbre | ip | 198.51.100.77 | 2 | fallida | 75.7 | — | — | 105 | `OFS-000001-0006-cumbre-2-bab071ab3913e373` |
| cumbre | ip | 198.51.100.77 | 3 | vencida | 79.02 | 82.065 | 105 | 105 | `OFS-000001-0006-cumbre-3-bab071ab3913e373` |
| valle | dominio | s3.pelotaya.test | 1 | vencida | 72.02 | 77.131 | 105 | 105 | `OFS-000001-0006-valle-1-bab071ab3913e373` |

## Aviso al titular

Aviso al titular de derechos — Expediente EXP-2026-000001.
La señal con marca de agua LP26-PRA-OFI-S048211 se está retransmitiendo sin autorización desde 3 servidores: s1.pelotaya.test (203.0.113.10), s2.pelotaya.test (203.0.113.11), s3.pelotaya.test (198.51.100.77).
Esa marca identifica de dónde sale la filtración. Se solicita ubicar la fuente asociada y cortarla: es la única medida que el operador no esquiva cambiando de servidor y que no puede afectar a terceros.
Nota: el simulador del desafío no modela este paso; el aviso se genera pero no tiene a quién enviarse.

## Registro de auditoría de este expediente

| Sec. | Minuto | Actor | Evento | Hash |
| --- | --- | --- | --- | --- |
| 5 | 2 | sistema | Se abrió EXP-2026-000001 por la marca LP26-PRA-OFI-S048211. | `950033dcda0f5e12…` |
| 6 | 2 | sistema | Medida M-0001 (inicial) presentada al juez de turno: s1.pelotaya.test por ip. | `0d90501b9bfb5079…` |
| 7 | 3 | jueza-laura-ficticia | Dra. Laura Ficticia aprobó la medida M-0001. | `33dff4e62bc0a816…` |
| 8 | 3 | sistema | Orden enviada a valle: dominio s1.pelotaya.test. | `10e3dc3eff2ac55c…` |
| 9 | 3 | sistema | Orden enviada a aurora: ip 203.0.113.10. | `d85d25f3df2d5bec…` |
| 10 | 3 | sistema | Orden enviada a andina: ip 203.0.113.10. | `4c540ad19a758919…` |
| 11 | 3 | sistema | Orden enviada a cumbre: ip 203.0.113.10. | `9470195388e414b7…` |
| 12 | 3.46 | aurora | aurora confirmó el bloqueo de 203.0.113.10. | `e9bbf06bc70a2022…` |
| 14 | 5.4 | andina | andina confirmó el bloqueo de 203.0.113.10. | `7a12825662035d97…` |
| 17 | 6.67 | cumbre | cumbre confirmó el bloqueo de 203.0.113.10. | `4dbabf14719b7904…` |
| 23 | 7.47 | valle | valle confirmó el bloqueo de s1.pelotaya.test. | `58ec6326a5fcda38…` |
| 36 | 12 | sistema | Nueva evidencia en EXP-2026-000001: detección D-0005. | `3c8043092b39567a…` |
| 43 | 22.01 | sistema | Nueva evidencia en EXP-2026-000001: detección D-0009. | `d1314eba14b7e422…` |
| 46 | 32.01 | sistema | Nueva evidencia en EXP-2026-000001: detección D-0012. | `e529038c80c9ccf3…` |
| 48 | 37.5 | sistema | Medida M-0004 (ampliacion) presentada al juez de turno: s2.pelotaya.test por ip. | `27dbfe8f9cf3c56b…` |
| 49 | 38.5 | jueza-laura-ficticia | Dra. Laura Ficticia aprobó la medida M-0004. | `da705d251b6fc731…` |
| 50 | 38.5 | sistema | Orden enviada a valle: dominio s2.pelotaya.test. | `ba1af97acb7178fd…` |
| 51 | 38.5 | sistema | Orden enviada a aurora: ip 203.0.113.11. | `9879050aecae4d98…` |
| 52 | 38.5 | sistema | Orden enviada a cumbre: ip 203.0.113.11. | `261541106abf12bd…` |
| 53 | 38.5 | sistema | Orden enviada a andina: ip 203.0.113.11. | `1ec4f2de0562ef45…` |
| 55 | 39.05 | aurora | aurora confirmó el bloqueo de 203.0.113.11. | `34e5714835394eaf…` |
| 56 | 40.84 | andina | andina confirmó el bloqueo de 203.0.113.11. | `af1e2b3aa37e1c34…` |
| 57 | 40.93 | cumbre | cumbre confirmó el bloqueo de 203.0.113.11. | `168cebdbbf772f1a…` |
| 59 | 44.33 | valle | valle confirmó el bloqueo de s2.pelotaya.test. | `f71ef1a5f372ad3d…` |
| 61 | 47.5 | sistema | Nueva evidencia en EXP-2026-000001: detección D-0018. | `f33e73c85957dc6c…` |
| 74 | 57.51 | sistema | Nueva evidencia en EXP-2026-000001: detección D-0023. | `eb11cc1a7d8f1819…` |
| 81 | 67.51 | sistema | Nueva evidencia en EXP-2026-000001: detección D-0027. | `7b421f71d1b553bb…` |
| 83 | 71.01 | sistema | Medida M-0006 (ampliacion) presentada al juez de turno: s3.pelotaya.test por ip. | `066933766383f9c7…` |
| 84 | 72.02 | juez-martin-ejemplo | Dr. Martín Ejemplo aprobó la medida M-0006. | `4e32b0d1bea331a9…` |
| 85 | 72.02 | sistema | Orden enviada a valle: dominio s3.pelotaya.test. | `16903bc38d1f8421…` |
| 86 | 72.02 | sistema | Orden enviada a aurora: ip 198.51.100.77. | `a61af0014e01351a…` |
| 87 | 72.02 | sistema | Orden enviada a andina: ip 198.51.100.77. | `b6d8564555c8df5d…` |
| 88 | 72.02 | sistema | Orden enviada a cumbre: ip 198.51.100.77. | `4638bd28b044e9b2…` |
| 89 | 72.37 | aurora | aurora confirmó el bloqueo de 198.51.100.77. | `c99fdbbf25f3c036…` |
| 90 | 74.43 | andina | andina confirmó el bloqueo de 198.51.100.77. | `36785676ef7ebcf8…` |
| 92 | 75.7 | cumbre | cumbre falló al aplicar el bloqueo de 198.51.100.77. | `15bbd0b5d5aa38ec…` |
| 93 | 75.7 | sistema | Reenvío a cumbre con una orden nueva tras la falla. | `ced30fffd9678bcc…` |
| 94 | 75.7 | sistema | Orden enviada a cumbre: ip 198.51.100.77 (intento 2). | `4419c57eddf01f9a…` |
| 96 | 77.13 | valle | valle confirmó el bloqueo de s3.pelotaya.test. | `452bf047032d0bf8…` |
| 98 | 79.02 | cumbre | cumbre falló al aplicar el bloqueo de 198.51.100.77. | `9a798a81fb7a98ba…` |
| 99 | 79.02 | sistema | Reenvío a cumbre con una orden nueva tras la falla. | `cef660151b7484a2…` |
| 100 | 79.02 | sistema | Orden enviada a cumbre: ip 198.51.100.77 (intento 3). | `82784e79c48ff651…` |
| 101 | 81.01 | sistema | Nueva evidencia en EXP-2026-000001: detección D-0033. | `179648a7565cc192…` |
| 103 | 82.07 | cumbre | cumbre confirmó el bloqueo de 198.51.100.77. | `02a5fd8f8b5f3e55…` |
| 116 | 91 | sistema | Nueva evidencia en EXP-2026-000001: detección D-0038. | `61ec791c1fa60ed8…` |
| 120 | 101.01 | sistema | Nueva evidencia en EXP-2026-000001: detección D-0042. | `e45a33b897bdae47…` |
| 122 | 105 | aurora | Venció el bloqueo de 203.0.113.10 en aurora. | `a83dccc832434342…` |
| 123 | 105 | andina | Venció el bloqueo de 203.0.113.10 en andina. | `e3e20506c20d530d…` |
| 124 | 105 | valle | Venció el bloqueo de s1.pelotaya.test en valle. | `285738b36d5c5a0a…` |
| 125 | 105 | cumbre | Venció el bloqueo de 203.0.113.10 en cumbre. | `a27ff0610c421998…` |
| 134 | 105 | aurora | Venció el bloqueo de 203.0.113.11 en aurora. | `97c3966e0d26d60c…` |
| 135 | 105 | andina | Venció el bloqueo de 203.0.113.11 en andina. | `0f2c297d76798965…` |
| 136 | 105 | valle | Venció el bloqueo de s2.pelotaya.test en valle. | `00cef81745af0e11…` |
| 137 | 105 | cumbre | Venció el bloqueo de 203.0.113.11 en cumbre. | `abadcde66bc52f90…` |
| 142 | 105 | aurora | Venció el bloqueo de 198.51.100.77 en aurora. | `54a97005d84c7ab6…` |
| 143 | 105 | andina | Venció el bloqueo de 198.51.100.77 en andina. | `11df29f42a4f06a0…` |
| 144 | 105 | valle | Venció el bloqueo de s3.pelotaya.test en valle. | `9fdb0c6917c292b8…` |
| 145 | 105 | cumbre | Venció el bloqueo de 198.51.100.77 en cumbre. | `2a44e41bdcf278a0…` |
| 151 | 110.61 | sistema | Exportación a entrega/practica. | `920d4719407dab2d…` |

La integridad de este expediente se comprueba con `python3 herramientas/verificar_expediente.py <carpeta>`.
