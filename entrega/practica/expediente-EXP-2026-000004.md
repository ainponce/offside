# Expediente EXP-2026-000004

**Partido:** Partido de práctica — Club Ficticio del Norte vs. Deportivo Ejemplo · Titular de derechos: Liga Profesional Ficticia

**Filtración:** marca de agua `LP26-PRA-OFI-S063002` (prefijo LP26-PRA-OFI, Señal oficial del titular (plataforma propia)).

Abierto en el minuto 55 del partido. Los tiempos de este documento son minutos de partido.

## Servidores

| Servidor | IP | Organización | Primera detección | Detecciones | Bloqueo propuesto | Primer bloqueo confirmado | Sitios ajenos en la IP |
| --- | --- | --- | --- | --- | --- | --- | --- |
| x9.tribuna-pirata.test | 203.0.113.40 | Bruma Hosting Dedicado (ficticio) | 55 | 3 | por IP | a los 1,61 min | 0 |
| x10.tribuna-pirata.test | 203.0.113.41 | Bruma Hosting Dedicado (ficticio) | 82 | 3 | por IP | a los 1,55 min | 0 |

## Medidas

### M-0005 · Medida inicial

**Pedido:** Bloquear la IP 203.0.113.40 en todos los proveedores hasta el final del partido.

**Servidor:** x9.tribuna-pirata.test · 203.0.113.40 · AS64600 Bruma Hosting Dedicado (ficticio)

**Verificaciones**

- ✔ **Es la señal oficial del partido.** La marca LP26-PRA-OFI-S063002 lleva el prefijo LP26-PRA-OFI (Señal oficial del titular (plataforma propia)).
- ✔ **No es un licenciatario en su dominio.** x9.tribuna-pirata.test no es un dominio autorizado. Señal oficial del partido en un sitio sin autorización.
- ✔ **Servidor identificado.** x9.tribuna-pirata.test · 203.0.113.40 · AS64600 Bruma Hosting Dedicado (ficticio).
- ✔ **IP exclusiva del operador.** La IP solo aloja este servidor: se bloquea la IP.

**Evidencia**

| Detección | Minuto | SHA-256 de la detección | SHA-256 de la captura |
| --- | --- | --- | --- |
| D-0021 | 55 | c85dd42e2e6f9bd4bbdcb4c509f6f72f9c1d77222d429ce4c17d745778c2ce00 | 5e3d43564f3ab28fd6d042ea219ea19c302093798435a7d197b3f64092d6a6e6 |

**Dónde se promocionó:** discord (https://discord.example/invite/tribuna-vip), telegram (https://t.example/tribunapirata)

**Huella de lo que vio el juez:** `08c40c03efad5c3ca1b9f3d3e62be16bb4c0a6460092dca05fe25722e2e1bb44`

**Decisión:** Aprobada por Dr. Martín Ejemplo, minuto 56 del partido (2026-11-12T01:45:43.054Z).

**Órdenes**

| Proveedor | Tipo | Objetivo | Intento | Estado | Enviada | Aplicada | Fin | Vence | Identificador |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Red Andina Telecom (ficticio) | IP | 203.0.113.40 | 1 | vencida | 56,01 | 57,45 | 105 | 105 | `OFS-000004-0005-andina-1-08c40c03efad5c3c` |
| Conectividad Aurora (ficticio) | IP | 203.0.113.40 | 1 | vencida | 56,01 | 56,61 | 105 | 105 | `OFS-000004-0005-aurora-1-08c40c03efad5c3c` |
| Cooperativa Cumbre Conecta (ficticio) | IP | 203.0.113.40 | 1 | fallida | 56,01 | — | — | 105 | `OFS-000004-0005-cumbre-1-08c40c03efad5c3c` |
| Cooperativa Cumbre Conecta (ficticio) | IP | 203.0.113.40 | 2 | fallida | 59,56 | — | — | 105 | `OFS-000004-0005-cumbre-2-08c40c03efad5c3c` |
| Cooperativa Cumbre Conecta (ficticio) | IP | 203.0.113.40 | 3 | vencida | 61,82 | 63,95 | 105 | 105 | `OFS-000004-0005-cumbre-3-08c40c03efad5c3c` |
| FibraValle (ficticio) | dominio | x9.tribuna-pirata.test | 1 | vencida | 56,01 | 62,11 | 105 | 105 | `OFS-000004-0005-valle-1-08c40c03efad5c3c` |

### M-0007 · Ampliación

**Pedido:** Ampliar el expediente a un servidor nuevo de la misma filtración: bloquear la IP 203.0.113.41 hasta el final del partido.

**Servidor:** x10.tribuna-pirata.test · 203.0.113.41 · AS64600 Bruma Hosting Dedicado (ficticio)

**Verificaciones**

- ✔ **Es la señal oficial del partido.** La marca LP26-PRA-OFI-S063002 lleva el prefijo LP26-PRA-OFI (Señal oficial del titular (plataforma propia)).
- ✔ **No es un licenciatario en su dominio.** x10.tribuna-pirata.test no es un dominio autorizado. Señal oficial del partido en un sitio sin autorización.
- ✔ **Servidor identificado.** x10.tribuna-pirata.test · 203.0.113.41 · AS64600 Bruma Hosting Dedicado (ficticio).
- ✔ **IP exclusiva del operador.** La IP solo aloja este servidor: se bloquea la IP.

**Evidencia**

| Detección | Minuto | SHA-256 de la detección | SHA-256 de la captura |
| --- | --- | --- | --- |
| D-0034 | 82 | 9d7b6df4ef309a6ba2fd73d2ff123c8934d1f14a4f5a475fd58ef3db76b677fe | 767fccc3e8c85585c487925e6d3b8f51e3dd4d796d61cebb11fc2b6e9b2828ee |

**Dónde se promocionó:** discord (https://discord.example/invite/tribuna-vip), telegram (https://t.example/tribunapirata)

**Huella de lo que vio el juez:** `972a4b53ff1deef7bf549ecf981fac047a921590ab7be3f289dbf15968c49a3f`

**Decisión:** Aprobada por Dr. Martín Ejemplo, minuto 83 del partido (2026-11-12T01:50:13.007Z).

**Órdenes**

| Proveedor | Tipo | Objetivo | Intento | Estado | Enviada | Aplicada | Fin | Vence | Identificador |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Red Andina Telecom (ficticio) | IP | 203.0.113.41 | 1 | vencida | 83,01 | 84,48 | 105 | 105 | `OFS-000004-0007-andina-1-972a4b53ff1deef7` |
| Conectividad Aurora (ficticio) | IP | 203.0.113.41 | 1 | vencida | 83,01 | 83,55 | 105 | 105 | `OFS-000004-0007-aurora-1-972a4b53ff1deef7` |
| Cooperativa Cumbre Conecta (ficticio) | IP | 203.0.113.41 | 1 | vencida | 83,01 | 86,31 | 105 | 105 | `OFS-000004-0007-cumbre-1-972a4b53ff1deef7` |
| FibraValle (ficticio) | dominio | x10.tribuna-pirata.test | 1 | vencida | 83,01 | 88,06 | 105 | 105 | `OFS-000004-0007-valle-1-972a4b53ff1deef7` |

## Aviso al titular

Aviso al titular de los derechos (Liga Profesional Ficticia) — Expediente EXP-2026-000004.
La señal con marca de agua LP26-PRA-OFI-S063002 se está retransmitiendo sin autorización desde 2 servidores: x9.tribuna-pirata.test (IP 203.0.113.40) y x10.tribuna-pirata.test (IP 203.0.113.41).
Esa marca identifica de dónde sale la filtración. Se solicita ubicar la fuente asociada y cortarla: es la única medida que el operador no esquiva cambiando de servidor y que no puede afectar a terceros.
Nota: el simulador del desafío no modela este paso; el aviso se genera pero no tiene a quién enviarse.

## Registro de auditoría de este expediente

| Sec. | Minuto | Actor | Evento | Hash |
| --- | --- | --- | --- | --- |
| 85 | 55,01 | sistema | Se abrió EXP-2026-000004 por la marca LP26-PRA-OFI-S063002. | `dcb6ae4c67e9e2ab…` |
| 86 | 55,01 | sistema | Se presentó al juez de turno la medida inicial M-0005: bloquear la IP 203.0.113.40. | `9d18f7a0b1c2504d…` |
| 88 | 56,01 | juez-martin-ejemplo | Dr. Martín Ejemplo aprobó la medida M-0005. | `c85935e764803e92…` |
| 89 | 56,01 | juez-martin-ejemplo | Dr. Martín Ejemplo firmó la orden para Conectividad Aurora (ficticio): bloquear la IP 203.0.113.40. | `9a2803238f4097fa…` |
| 90 | 56,01 | juez-martin-ejemplo | Dr. Martín Ejemplo firmó la orden para Red Andina Telecom (ficticio): bloquear la IP 203.0.113.40. | `3154ef9026d3cb9f…` |
| 91 | 56,01 | juez-martin-ejemplo | Dr. Martín Ejemplo firmó la orden para FibraValle (ficticio): bloquear el dominio x9.tribuna-pirata.test. | `d463fc22d2892118…` |
| 92 | 56,01 | juez-martin-ejemplo | Dr. Martín Ejemplo firmó la orden para Cooperativa Cumbre Conecta (ficticio): bloquear la IP 203.0.113.40. | `d9547238adafd7a7…` |
| 93 | 56,01 | sistema | Orden enviada a FibraValle (ficticio): bloquear el dominio x9.tribuna-pirata.test. | `3389381ec2b8ebe0…` |
| 94 | 56,01 | sistema | Orden enviada a Conectividad Aurora (ficticio): bloquear la IP 203.0.113.40. | `1923d4ee75e31c76…` |
| 95 | 56,01 | sistema | Orden enviada a Red Andina Telecom (ficticio): bloquear la IP 203.0.113.40. | `b015b505593397f7…` |
| 96 | 56,01 | sistema | Orden enviada a Cooperativa Cumbre Conecta (ficticio): bloquear la IP 203.0.113.40. | `74b1ac4922e42c10…` |
| 97 | 56,61 | aurora | Conectividad Aurora (ficticio) aplicó el bloqueo de la IP 203.0.113.40. | `1171d17b97bc5ca5…` |
| 98 | 57,45 | andina | Red Andina Telecom (ficticio) aplicó el bloqueo de la IP 203.0.113.40. | `7308ccddfd042d56…` |
| 101 | 59,56 | cumbre | Cooperativa Cumbre Conecta (ficticio) no pudo aplicar el bloqueo de la IP 203.0.113.40. | `c9eab4d32a90b87f…` |
| 102 | 59,56 | juez-martin-ejemplo | Dr. Martín Ejemplo firmó la orden para Cooperativa Cumbre Conecta (ficticio): bloquear la IP 203.0.113.40 (intento 2). | `8d276907e3717b7e…` |
| 103 | 59,56 | sistema | Reenvío a Cooperativa Cumbre Conecta (ficticio) con una orden nueva tras la falla. | `ac0a1083b4d71fac…` |
| 104 | 59,56 | sistema | Orden enviada a Cooperativa Cumbre Conecta (ficticio): bloquear la IP 203.0.113.40 (intento 2). | `e1fa752f557a172f…` |
| 105 | 61,82 | cumbre | Cooperativa Cumbre Conecta (ficticio) no pudo aplicar el bloqueo de la IP 203.0.113.40. | `6045be40e7cfe858…` |
| 106 | 61,82 | juez-martin-ejemplo | Dr. Martín Ejemplo firmó la orden para Cooperativa Cumbre Conecta (ficticio): bloquear la IP 203.0.113.40 (intento 3). | `3e4513b8d3dadda9…` |
| 107 | 61,82 | sistema | Reenvío a Cooperativa Cumbre Conecta (ficticio) con una orden nueva tras la falla. | `6a4eab522675968c…` |
| 108 | 61,82 | sistema | Orden enviada a Cooperativa Cumbre Conecta (ficticio): bloquear la IP 203.0.113.40 (intento 3). | `2cf79e78e71ddd3e…` |
| 109 | 62,11 | valle | FibraValle (ficticio) aplicó el bloqueo del dominio x9.tribuna-pirata.test. | `26e9da302541e2cb…` |
| 110 | 63,95 | cumbre | Cooperativa Cumbre Conecta (ficticio) aplicó el bloqueo de la IP 203.0.113.40. | `b5a581e9fcdd3470…` |
| 111 | 65 | sistema | Nueva evidencia en EXP-2026-000004: detección D-0025. | `fcc1b5855e38c025…` |
| 127 | 75,01 | sistema | Nueva evidencia en EXP-2026-000004: detección D-0030. | `dc5ee99add25e84c…` |
| 137 | 82 | sistema | Se presentó al juez de turno la ampliación M-0007: bloquear la IP 203.0.113.41. | `2ff1caa826b188a1…` |
| 138 | 83,01 | juez-martin-ejemplo | Dr. Martín Ejemplo aprobó la medida M-0007. | `44a438fd6c3e9cab…` |
| 139 | 83,01 | juez-martin-ejemplo | Dr. Martín Ejemplo firmó la orden para Conectividad Aurora (ficticio): bloquear la IP 203.0.113.41. | `c923235b7d9033d9…` |
| 140 | 83,01 | juez-martin-ejemplo | Dr. Martín Ejemplo firmó la orden para Red Andina Telecom (ficticio): bloquear la IP 203.0.113.41. | `dfcd5f31c90067e2…` |
| 141 | 83,01 | juez-martin-ejemplo | Dr. Martín Ejemplo firmó la orden para FibraValle (ficticio): bloquear el dominio x10.tribuna-pirata.test. | `3066bb2bd5b3c131…` |
| 142 | 83,01 | juez-martin-ejemplo | Dr. Martín Ejemplo firmó la orden para Cooperativa Cumbre Conecta (ficticio): bloquear la IP 203.0.113.41. | `41aeb3bddea9f2a4…` |
| 143 | 83,01 | sistema | Orden enviada a FibraValle (ficticio): bloquear el dominio x10.tribuna-pirata.test. | `8b2326d1fd6fb555…` |
| 144 | 83,01 | sistema | Orden enviada a Red Andina Telecom (ficticio): bloquear la IP 203.0.113.41. | `68a15e423613ba7c…` |
| 145 | 83,01 | sistema | Orden enviada a Conectividad Aurora (ficticio): bloquear la IP 203.0.113.41. | `58b037fb9fc15b7c…` |
| 146 | 83,01 | sistema | Orden enviada a Cooperativa Cumbre Conecta (ficticio): bloquear la IP 203.0.113.41. | `4e556006b0a1553b…` |
| 147 | 83,55 | aurora | Conectividad Aurora (ficticio) aplicó el bloqueo de la IP 203.0.113.41. | `fc84e9e3ba4d3f37…` |
| 149 | 84,48 | andina | Red Andina Telecom (ficticio) aplicó el bloqueo de la IP 203.0.113.41. | `263243918365bc14…` |
| 151 | 86,31 | cumbre | Cooperativa Cumbre Conecta (ficticio) aplicó el bloqueo de la IP 203.0.113.41. | `cc88c9773b072586…` |
| 152 | 88,06 | valle | FibraValle (ficticio) aplicó el bloqueo del dominio x10.tribuna-pirata.test. | `b341c47f43318de2…` |
| 155 | 92,01 | sistema | Nueva evidencia en EXP-2026-000004: detección D-0039. | `a96e0053a965aa93…` |
| 159 | 102 | sistema | Nueva evidencia en EXP-2026-000004: detección D-0043. | `c0c424dbbcd677d5…` |
| 176 | 105 | aurora | Venció el bloqueo de la IP 203.0.113.40 en Conectividad Aurora (ficticio). | `12f1a63d7bc6032b…` |
| 177 | 105 | andina | Venció el bloqueo de la IP 203.0.113.40 en Red Andina Telecom (ficticio). | `00ae465643fbf999…` |
| 178 | 105 | valle | Venció el bloqueo del dominio x9.tribuna-pirata.test en FibraValle (ficticio). | `2f8b452ed49e2cf6…` |
| 179 | 105 | cumbre | Venció el bloqueo de la IP 203.0.113.40 en Cooperativa Cumbre Conecta (ficticio). | `6e29ce86232dcc19…` |
| 184 | 105 | aurora | Venció el bloqueo de la IP 203.0.113.41 en Conectividad Aurora (ficticio). | `649847a8b222a5e7…` |
| 185 | 105 | andina | Venció el bloqueo de la IP 203.0.113.41 en Red Andina Telecom (ficticio). | `ee88b15b06a5d68e…` |
| 186 | 105 | valle | Venció el bloqueo del dominio x10.tribuna-pirata.test en FibraValle (ficticio). | `289776345a4c9320…` |
| 187 | 105 | cumbre | Venció el bloqueo de la IP 203.0.113.41 en Cooperativa Cumbre Conecta (ficticio). | `48027c7ab5f381c3…` |

La integridad de este expediente se comprueba con `python3 herramientas/verificar_expediente.py <carpeta> --juzgados <claves> --registro <registro del simulador>`. Sin el registro del simulador, el verificador solo prueba que la carpeta es coherente consigo misma.
