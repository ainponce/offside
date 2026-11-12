# Expediente EXP-2026-000001

**Partido:** Partido de práctica — Club Ficticio del Norte vs. Deportivo Ejemplo · Titular de derechos: Liga Profesional Ficticia

**Filtración:** marca de agua `LP26-PRA-OFI-S048211` (prefijo LP26-PRA-OFI, Señal oficial del titular (plataforma propia)).

Abierto en el minuto 2 del partido. Los tiempos de este documento son minutos de partido.

## Servidores

| Servidor | IP | Organización | Primera detección | Detecciones | Bloqueo propuesto | Primer bloqueo confirmado | Sitios ajenos en la IP |
| --- | --- | --- | --- | --- | --- | --- | --- |
| s1.pelotaya.test | 203.0.113.10 | Bruma Hosting Dedicado (ficticio) | 2 | 4 | por IP | a los 1,42 min | 0 |
| s2.pelotaya.test | 203.0.113.11 | Bruma Hosting Dedicado (ficticio) | 37,5 | 4 | por IP | a los 1,56 min | 0 |
| s3.pelotaya.test | 198.51.100.77 | Servidores Litoral (ficticio) | 71 | 4 | por IP | a los 1,53 min | 0 |

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

**Huella de lo que vio el juez:** `3c48dc75ec6e9052174634e00e480586737e553d716dda1996078ea1fcf9006d`

**Decisión:** Aprobada por Dra. Laura Ficticia, minuto 3 del partido (2026-11-12T01:36:53.016Z).

**Órdenes**

| Proveedor | Tipo | Objetivo | Intento | Estado | Enviada | Aplicada | Fin | Vence | Identificador |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Red Andina Telecom (ficticio) | IP | 203.0.113.10 | 1 | vencida | 3,01 | 5,54 | 105 | 105 | `OFS-000001-0001-andina-1-3c48dc75ec6e9052` |
| Conectividad Aurora (ficticio) | IP | 203.0.113.10 | 1 | vencida | 3,01 | 3,42 | 105 | 105 | `OFS-000001-0001-aurora-1-3c48dc75ec6e9052` |
| Cooperativa Cumbre Conecta (ficticio) | IP | 203.0.113.10 | 1 | fallida | 3,01 | — | — | 105 | `OFS-000001-0001-cumbre-1-3c48dc75ec6e9052` |
| Cooperativa Cumbre Conecta (ficticio) | IP | 203.0.113.10 | 2 | vencida | 5,64 | 8,56 | 105 | 105 | `OFS-000001-0001-cumbre-2-3c48dc75ec6e9052` |
| FibraValle (ficticio) | dominio | s1.pelotaya.test | 1 | vencida | 3,01 | 8,72 | 105 | 105 | `OFS-000001-0001-valle-1-3c48dc75ec6e9052` |

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
| D-0014 | 37,5 | 022711219693e7dbc86bc37fd6e3477f95e9ffea3f5b7310cc277da9871af8f9 | f27a4a5fba9cfc873c9750f4186c354c253b9dcb696de7b8c2bc789e0217ebe7 |

**Dónde se promocionó:** x (https://x.example/futbolya_ok/status/1001)

**Huella de lo que vio el juez:** `de2b0530cf9177e6366f68174f358ef4efffa36c2770f880ce6561b22bdac6b1`

**Decisión:** Aprobada por Dra. Laura Ficticia, minuto 38,5 del partido (2026-11-12T01:42:48.089Z).

**Órdenes**

| Proveedor | Tipo | Objetivo | Intento | Estado | Enviada | Aplicada | Fin | Vence | Identificador |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Red Andina Telecom (ficticio) | IP | 203.0.113.11 | 1 | vencida | 38,52 | 40,21 | 105 | 105 | `OFS-000001-0004-andina-1-de2b0530cf9177e6` |
| Conectividad Aurora (ficticio) | IP | 203.0.113.11 | 1 | vencida | 38,52 | 39,06 | 105 | 105 | `OFS-000001-0004-aurora-1-de2b0530cf9177e6` |
| Cooperativa Cumbre Conecta (ficticio) | IP | 203.0.113.11 | 1 | vencida | 38,52 | 41,52 | 105 | 105 | `OFS-000001-0004-cumbre-1-de2b0530cf9177e6` |
| FibraValle (ficticio) | dominio | s2.pelotaya.test | 1 | vencida | 38,52 | 43,5 | 105 | 105 | `OFS-000001-0004-valle-1-de2b0530cf9177e6` |

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

**Huella de lo que vio el juez:** `498454cce4e11b6f0896d7caa0fbe63f28d6bc486625300b29b963082e373a4e`

**Decisión:** Aprobada por Dr. Martín Ejemplo, minuto 72 del partido (2026-11-12T01:48:23.063Z).

**Órdenes**

| Proveedor | Tipo | Objetivo | Intento | Estado | Enviada | Aplicada | Fin | Vence | Identificador |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Red Andina Telecom (ficticio) | IP | 198.51.100.77 | 1 | vencida | 72,01 | 74,19 | 105 | 105 | `OFS-000001-0006-andina-1-498454cce4e11b6f` |
| Conectividad Aurora (ficticio) | IP | 198.51.100.77 | 1 | vencida | 72,01 | 72,53 | 105 | 105 | `OFS-000001-0006-aurora-1-498454cce4e11b6f` |
| Cooperativa Cumbre Conecta (ficticio) | IP | 198.51.100.77 | 1 | fallida | 72,01 | — | — | 105 | `OFS-000001-0006-cumbre-1-498454cce4e11b6f` |
| Cooperativa Cumbre Conecta (ficticio) | IP | 198.51.100.77 | 2 | vencida | 75,06 | 78,05 | 105 | 105 | `OFS-000001-0006-cumbre-2-498454cce4e11b6f` |
| FibraValle (ficticio) | dominio | s3.pelotaya.test | 1 | vencida | 72,01 | 79,04 | 105 | 105 | `OFS-000001-0006-valle-1-498454cce4e11b6f` |

## Aviso al titular

Aviso al titular de los derechos (Liga Profesional Ficticia) — Expediente EXP-2026-000001.
La señal con marca de agua LP26-PRA-OFI-S048211 se está retransmitiendo sin autorización desde 3 servidores: s1.pelotaya.test (IP 203.0.113.10), s2.pelotaya.test (IP 203.0.113.11) y s3.pelotaya.test (IP 198.51.100.77).
Esa marca identifica de dónde sale la filtración. Se solicita ubicar la fuente asociada y cortarla: es la única medida que el operador no esquiva cambiando de servidor y que no puede afectar a terceros.
Nota: el simulador del desafío no modela este paso; el aviso se genera pero no tiene a quién enviarse.

## Registro de auditoría de este expediente

| Sec. | Minuto | Actor | Evento | Hash |
| --- | --- | --- | --- | --- |
| 5 | 2 | sistema | Se abrió EXP-2026-000001 por la marca LP26-PRA-OFI-S048211. | `02962747631ab706…` |
| 6 | 2 | sistema | Se presentó al juez de turno la medida inicial M-0001: bloquear la IP 203.0.113.10. | `76aac7f6819c7878…` |
| 7 | 3,01 | jueza-laura-ficticia | Dra. Laura Ficticia aprobó la medida M-0001. | `fcc7b1a129d955a6…` |
| 8 | 3,01 | jueza-laura-ficticia | Dra. Laura Ficticia firmó la orden para Conectividad Aurora (ficticio): bloquear la IP 203.0.113.10. | `bd36ef4319e65a51…` |
| 9 | 3,01 | jueza-laura-ficticia | Dra. Laura Ficticia firmó la orden para Red Andina Telecom (ficticio): bloquear la IP 203.0.113.10. | `c376046d0e8c8897…` |
| 10 | 3,01 | jueza-laura-ficticia | Dra. Laura Ficticia firmó la orden para FibraValle (ficticio): bloquear el dominio s1.pelotaya.test. | `89475cba7c552ae4…` |
| 11 | 3,01 | jueza-laura-ficticia | Dra. Laura Ficticia firmó la orden para Cooperativa Cumbre Conecta (ficticio): bloquear la IP 203.0.113.10. | `ef5bc6423e8190a8…` |
| 12 | 3,01 | sistema | Orden enviada a FibraValle (ficticio): bloquear el dominio s1.pelotaya.test. | `845d23179a25704a…` |
| 13 | 3,01 | sistema | Orden enviada a Conectividad Aurora (ficticio): bloquear la IP 203.0.113.10. | `e53549b1268e82f0…` |
| 14 | 3,01 | sistema | Orden enviada a Red Andina Telecom (ficticio): bloquear la IP 203.0.113.10. | `1ef26ba7d3b0c042…` |
| 15 | 3,01 | sistema | Orden enviada a Cooperativa Cumbre Conecta (ficticio): bloquear la IP 203.0.113.10. | `922ac4ed98f1f322…` |
| 16 | 3,42 | aurora | Conectividad Aurora (ficticio) aplicó el bloqueo de la IP 203.0.113.10. | `64072c0eaf4b0f2f…` |
| 18 | 5,54 | andina | Red Andina Telecom (ficticio) aplicó el bloqueo de la IP 203.0.113.10. | `f501feb534bbad3a…` |
| 19 | 5,64 | cumbre | Cooperativa Cumbre Conecta (ficticio) no pudo aplicar el bloqueo de la IP 203.0.113.10. | `8677f5522cd742ff…` |
| 20 | 5,64 | jueza-laura-ficticia | Dra. Laura Ficticia firmó la orden para Cooperativa Cumbre Conecta (ficticio): bloquear la IP 203.0.113.10 (intento 2). | `1799a0f385d857b8…` |
| 21 | 5,64 | sistema | Reenvío a Cooperativa Cumbre Conecta (ficticio) con una orden nueva tras la falla. | `d6265f986873bb83…` |
| 22 | 5,64 | sistema | Orden enviada a Cooperativa Cumbre Conecta (ficticio): bloquear la IP 203.0.113.10 (intento 2). | `1c29cb0149456cb1…` |
| 35 | 8,56 | cumbre | Cooperativa Cumbre Conecta (ficticio) aplicó el bloqueo de la IP 203.0.113.10. | `fccbc2be2aad5fbf…` |
| 36 | 8,72 | valle | FibraValle (ficticio) aplicó el bloqueo del dominio s1.pelotaya.test. | `691ea60848453d62…` |
| 52 | 12,01 | sistema | Nueva evidencia en EXP-2026-000001: detección D-0005. | `21de3e79cf2d7b0e…` |
| 59 | 22 | sistema | Nueva evidencia en EXP-2026-000001: detección D-0009. | `358319fee29dd53c…` |
| 62 | 32,01 | sistema | Nueva evidencia en EXP-2026-000001: detección D-0012. | `2eeff95d3690a2e8…` |
| 64 | 37,51 | sistema | Se presentó al juez de turno la ampliación M-0004: bloquear la IP 203.0.113.11. | `a04f029b90a73a18…` |
| 65 | 38,51 | jueza-laura-ficticia | Dra. Laura Ficticia aprobó la medida M-0004. | `03779779dacf98c9…` |
| 66 | 38,51 | jueza-laura-ficticia | Dra. Laura Ficticia firmó la orden para Conectividad Aurora (ficticio): bloquear la IP 203.0.113.11. | `076fb4575daeda0d…` |
| 67 | 38,51 | jueza-laura-ficticia | Dra. Laura Ficticia firmó la orden para Red Andina Telecom (ficticio): bloquear la IP 203.0.113.11. | `93da18425cca6cce…` |
| 68 | 38,51 | jueza-laura-ficticia | Dra. Laura Ficticia firmó la orden para FibraValle (ficticio): bloquear el dominio s2.pelotaya.test. | `d6be036d35a62688…` |
| 69 | 38,51 | jueza-laura-ficticia | Dra. Laura Ficticia firmó la orden para Cooperativa Cumbre Conecta (ficticio): bloquear la IP 203.0.113.11. | `c5f43189bb1a8dc3…` |
| 70 | 38,52 | sistema | Orden enviada a FibraValle (ficticio): bloquear el dominio s2.pelotaya.test. | `dd13bc28d56663e5…` |
| 71 | 38,52 | sistema | Orden enviada a Conectividad Aurora (ficticio): bloquear la IP 203.0.113.11. | `9ebb65d5dfb0a7b3…` |
| 72 | 38,52 | sistema | Orden enviada a Red Andina Telecom (ficticio): bloquear la IP 203.0.113.11. | `cf26fdd3460c97c3…` |
| 73 | 38,52 | sistema | Orden enviada a Cooperativa Cumbre Conecta (ficticio): bloquear la IP 203.0.113.11. | `47372e5271389042…` |
| 75 | 39,06 | aurora | Conectividad Aurora (ficticio) aplicó el bloqueo de la IP 203.0.113.11. | `98d806fc70040687…` |
| 76 | 40,21 | andina | Red Andina Telecom (ficticio) aplicó el bloqueo de la IP 203.0.113.11. | `cfc4c611df6a9432…` |
| 77 | 41,52 | cumbre | Cooperativa Cumbre Conecta (ficticio) aplicó el bloqueo de la IP 203.0.113.11. | `b0a6a4cbe31d23b6…` |
| 78 | 43,5 | valle | FibraValle (ficticio) aplicó el bloqueo del dominio s2.pelotaya.test. | `fb06f7b0134f44de…` |
| 81 | 47,5 | sistema | Nueva evidencia en EXP-2026-000001: detección D-0018. | `61c81bccfa53eac8…` |
| 99 | 57,51 | sistema | Nueva evidencia en EXP-2026-000001: detección D-0023. | `b2b82379356fdc86…` |
| 113 | 67,51 | sistema | Nueva evidencia en EXP-2026-000001: detección D-0027. | `35e7bccbaed5f8c6…` |
| 115 | 71,01 | sistema | Se presentó al juez de turno la ampliación M-0006: bloquear la IP 198.51.100.77. | `4e1b60f431913f2c…` |
| 116 | 72,01 | juez-martin-ejemplo | Dr. Martín Ejemplo aprobó la medida M-0006. | `bbf4568695fa74ed…` |
| 117 | 72,01 | juez-martin-ejemplo | Dr. Martín Ejemplo firmó la orden para Conectividad Aurora (ficticio): bloquear la IP 198.51.100.77. | `bc09424a432df3d1…` |
| 118 | 72,01 | juez-martin-ejemplo | Dr. Martín Ejemplo firmó la orden para Red Andina Telecom (ficticio): bloquear la IP 198.51.100.77. | `1982e80c266f0e90…` |
| 119 | 72,01 | juez-martin-ejemplo | Dr. Martín Ejemplo firmó la orden para FibraValle (ficticio): bloquear el dominio s3.pelotaya.test. | `2937221f81c05ef3…` |
| 120 | 72,01 | juez-martin-ejemplo | Dr. Martín Ejemplo firmó la orden para Cooperativa Cumbre Conecta (ficticio): bloquear la IP 198.51.100.77. | `2b2c67a2fc262969…` |
| 121 | 72,01 | sistema | Orden enviada a FibraValle (ficticio): bloquear el dominio s3.pelotaya.test. | `63e26b527b34f2fa…` |
| 122 | 72,01 | sistema | Orden enviada a Conectividad Aurora (ficticio): bloquear la IP 198.51.100.77. | `b763065c3af2cff4…` |
| 123 | 72,01 | sistema | Orden enviada a Cooperativa Cumbre Conecta (ficticio): bloquear la IP 198.51.100.77. | `6e1fcd13bae635e5…` |
| 124 | 72,01 | sistema | Orden enviada a Red Andina Telecom (ficticio): bloquear la IP 198.51.100.77. | `de2f3e397f01994c…` |
| 125 | 72,53 | aurora | Conectividad Aurora (ficticio) aplicó el bloqueo de la IP 198.51.100.77. | `05bf88355bef35fa…` |
| 126 | 74,19 | andina | Red Andina Telecom (ficticio) aplicó el bloqueo de la IP 198.51.100.77. | `2f4104743c44d995…` |
| 128 | 75,06 | cumbre | Cooperativa Cumbre Conecta (ficticio) no pudo aplicar el bloqueo de la IP 198.51.100.77. | `2168964bf89c6a9a…` |
| 129 | 75,06 | juez-martin-ejemplo | Dr. Martín Ejemplo firmó la orden para Cooperativa Cumbre Conecta (ficticio): bloquear la IP 198.51.100.77 (intento 2). | `307a5474723e2598…` |
| 130 | 75,06 | sistema | Reenvío a Cooperativa Cumbre Conecta (ficticio) con una orden nueva tras la falla. | `5b201a324402f9a0…` |
| 131 | 75,06 | sistema | Orden enviada a Cooperativa Cumbre Conecta (ficticio): bloquear la IP 198.51.100.77 (intento 2). | `e8660248e586b3df…` |
| 133 | 78,05 | cumbre | Cooperativa Cumbre Conecta (ficticio) aplicó el bloqueo de la IP 198.51.100.77. | `49eefd2fdffcab37…` |
| 135 | 79,04 | valle | FibraValle (ficticio) aplicó el bloqueo del dominio s3.pelotaya.test. | `651fa32b2eb9fe84…` |
| 136 | 81 | sistema | Nueva evidencia en EXP-2026-000001: detección D-0033. | `2f82e24860abd06f…` |
| 154 | 91,01 | sistema | Nueva evidencia en EXP-2026-000001: detección D-0038. | `58752dcaf110d222…` |
| 158 | 101 | sistema | Nueva evidencia en EXP-2026-000001: detección D-0042. | `2df7505f8a7aa150…` |
| 160 | 105 | aurora | Venció el bloqueo de la IP 203.0.113.10 en Conectividad Aurora (ficticio). | `f29491b8bc84a800…` |
| 161 | 105 | andina | Venció el bloqueo de la IP 203.0.113.10 en Red Andina Telecom (ficticio). | `5dda2b2c92ff796f…` |
| 162 | 105 | valle | Venció el bloqueo del dominio s1.pelotaya.test en FibraValle (ficticio). | `8cf1c4a9fe7fc64d…` |
| 163 | 105 | cumbre | Venció el bloqueo de la IP 203.0.113.10 en Cooperativa Cumbre Conecta (ficticio). | `0ef7884a7ed99582…` |
| 172 | 105 | aurora | Venció el bloqueo de la IP 203.0.113.11 en Conectividad Aurora (ficticio). | `6dc10995765746da…` |
| 173 | 105 | andina | Venció el bloqueo de la IP 203.0.113.11 en Red Andina Telecom (ficticio). | `929811c928d04fd7…` |
| 174 | 105 | valle | Venció el bloqueo del dominio s2.pelotaya.test en FibraValle (ficticio). | `94f3d22a36c682f4…` |
| 175 | 105 | cumbre | Venció el bloqueo de la IP 203.0.113.11 en Cooperativa Cumbre Conecta (ficticio). | `e3cff64ca339db4f…` |
| 180 | 105 | aurora | Venció el bloqueo de la IP 198.51.100.77 en Conectividad Aurora (ficticio). | `67658ecc1afeda97…` |
| 181 | 105 | andina | Venció el bloqueo de la IP 198.51.100.77 en Red Andina Telecom (ficticio). | `8e3b7892a2cff731…` |
| 182 | 105 | valle | Venció el bloqueo del dominio s3.pelotaya.test en FibraValle (ficticio). | `8bff545bd64b3862…` |
| 183 | 105 | cumbre | Venció el bloqueo de la IP 198.51.100.77 en Cooperativa Cumbre Conecta (ficticio). | `de981f3d30c41173…` |

La integridad de este expediente se comprueba con `python3 herramientas/verificar_expediente.py <carpeta> --juzgados <claves> --registro <registro del simulador>`. Sin el registro del simulador, el verificador solo prueba que la carpeta es coherente consigo misma.
