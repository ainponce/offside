# Expediente EXP-2026-000001

**Partido:** Partido final — Club Ficticio del Sur vs. Atlético Demostración · Titular de derechos: Liga Profesional Ficticia

**Filtración:** marca de agua `LP26-FIN-OFI-S020318` (prefijo LP26-FIN-OFI, Señal oficial del titular (plataforma propia)).

Abierto en el minuto 52,6 del partido. Los tiempos de este documento son minutos de partido.

## Servidores

| Servidor | IP | Organización | Primera detección | Detecciones | Bloqueo propuesto | Primer bloqueo confirmado | Sitios ajenos en la IP |
| --- | --- | --- | --- | --- | --- | --- | --- |
| sa.futbolpasion.test | 203.0.113.60 | Bruma Hosting Dedicado (ficticio) | 2 | 3 | por IP | a los 74,64 min | 0 |
| sb.futbolpasion.test | 203.0.113.61 | Bruma Hosting Dedicado (ficticio) | 26 | 4 | por IP | a los 53,19 min | 0 |
| sc.futbolpasion.test | 198.51.100.160 | Servidores Litoral (ficticio) | 59 | 5 | por IP | a los 23,23 min | 0 |

## Medidas

### M-0001 · Medida inicial

**Pedido:** Bloquear la IP 203.0.113.60 en todos los proveedores hasta el final del partido.

**Servidor:** sa.futbolpasion.test · 203.0.113.60 · AS64600 Bruma Hosting Dedicado (ficticio)

**Verificaciones**

- ✔ **Es la señal oficial del partido.** La marca LP26-FIN-OFI-S020318 lleva el prefijo LP26-FIN-OFI (Señal oficial del titular (plataforma propia)).
- ✔ **No es un licenciatario en su dominio.** sa.futbolpasion.test no es un dominio autorizado. Señal oficial del partido en un sitio sin autorización.
- ✔ **Servidor identificado.** sa.futbolpasion.test · 203.0.113.60 · AS64600 Bruma Hosting Dedicado (ficticio).
- ✔ **IP exclusiva del operador.** La IP solo aloja este servidor: se bloquea la IP.

**Evidencia**

| Detección | Minuto | SHA-256 de la detección | SHA-256 de la captura |
| --- | --- | --- | --- |
| D-0001 | 2 | 1fde211239932164e68f8f886595e0affb99df04e6811bf2d4b0767e9b66fba5 | c60104faf76e511083ffea258f135c53fd3a8a0b6a6cba7f0353d605cc959ef8 |

**Dónde se promocionó:** x (https://x.example/futbolpasion_ar/status/9001)

**Huella de lo que vio el juez:** `eefa031157c4a76aef0570b20dbc31628d4ec8a889bd8e28c4c8976a7d1f9fb9`

**Decisión:** Aprobada por Dr. Martín Ejemplo, minuto 76 del partido (2026-11-13T14:35:22.824Z).

**Órdenes**

| Proveedor | Tipo | Objetivo | Intento | Estado | Enviada | Aplicada | Fin | Vence | Identificador |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Red Andina Telecom (ficticio) | IP | 203.0.113.60 | 1 | vencida | 76,05 | 78,38 | 105 | 105 | `OFS-000001-0001-andina-1-eefa031157c4a76a` |
| Conectividad Aurora (ficticio) | IP | 203.0.113.60 | 1 | vencida | 76,03 | 76,64 | 105 | 105 | `OFS-000001-0001-aurora-1-eefa031157c4a76a` |
| Cooperativa Cumbre Conecta (ficticio) | IP | 203.0.113.60 | 1 | vencida | 76,05 | 78,8 | 105 | 105 | `OFS-000001-0001-cumbre-1-eefa031157c4a76a` |
| FibraValle (ficticio) | dominio | sa.futbolpasion.test | 1 | vencida | 76,04 | 81,58 | 105 | 105 | `OFS-000001-0001-valle-1-eefa031157c4a76a` |

### M-0004 · Medida inicial

**Pedido:** Bloquear la IP 203.0.113.61 en todos los proveedores hasta el final del partido.

**Servidor:** sb.futbolpasion.test · 203.0.113.61 · AS64600 Bruma Hosting Dedicado (ficticio)

**Verificaciones**

- ✔ **Es la señal oficial del partido.** La marca LP26-FIN-OFI-S020318 lleva el prefijo LP26-FIN-OFI (Señal oficial del titular (plataforma propia)).
- ✔ **No es un licenciatario en su dominio.** sb.futbolpasion.test no es un dominio autorizado. Señal oficial del partido en un sitio sin autorización.
- ✔ **Servidor identificado.** sb.futbolpasion.test · 203.0.113.61 · AS64600 Bruma Hosting Dedicado (ficticio).
- ✔ **IP exclusiva del operador.** La IP solo aloja dominios del mismo operador (futbolpasion.test): se bloquea la IP.

**Evidencia**

| Detección | Minuto | SHA-256 de la detección | SHA-256 de la captura |
| --- | --- | --- | --- |
| D-0011 | 26 | 1b026e2354fd2b657d6594dcab8619b3be3c348fe743c3f881ba40baa77631c2 | 825351ab4ef10e5aa12add229f4f8eb50e8d06091c77f4998d114282c076bdd6 |

**Dónde se promocionó:** x (https://x.example/futbolpasion_ar/status/9001)

**Huella de lo que vio el juez:** `d9d897eff22aacdafbbe45e62d6cac9d96a3851bb9da956a698f896e53b9ec39`

**Decisión:** Aprobada por Dr. Martín Ejemplo, minuto 78,6 del partido (2026-11-13T14:36:13.774Z).

**Órdenes**

| Proveedor | Tipo | Objetivo | Intento | Estado | Enviada | Aplicada | Fin | Vence | Identificador |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Red Andina Telecom (ficticio) | IP | 203.0.113.61 | 1 | vencida | 78,57 | 80,77 | 105 | 105 | `OFS-000001-0004-andina-1-d9d897eff22aacda` |
| Conectividad Aurora (ficticio) | IP | 203.0.113.61 | 1 | vencida | 78,57 | 79,19 | 105 | 105 | `OFS-000001-0004-aurora-1-d9d897eff22aacda` |
| Cooperativa Cumbre Conecta (ficticio) | IP | 203.0.113.61 | 1 | vencida | 78,59 | 81,41 | 105 | 105 | `OFS-000001-0004-cumbre-1-d9d897eff22aacda` |
| FibraValle (ficticio) | dominio | sb.futbolpasion.test | 1 | vencida | 78,56 | 85,03 | 105 | 105 | `OFS-000001-0004-valle-1-d9d897eff22aacda` |

### M-0006 · Medida inicial

**Pedido:** Bloquear la IP 198.51.100.160 en todos los proveedores hasta el final del partido.

**Servidor:** sc.futbolpasion.test · 198.51.100.160 · AS64630 Servidores Litoral (ficticio)

**Verificaciones**

- ✔ **Es la señal oficial del partido.** La marca LP26-FIN-OFI-S020318 lleva el prefijo LP26-FIN-OFI (Señal oficial del titular (plataforma propia)).
- ✔ **No es un licenciatario en su dominio.** sc.futbolpasion.test no es un dominio autorizado. Señal oficial del partido en un sitio sin autorización.
- ✔ **Servidor identificado.** sc.futbolpasion.test · 198.51.100.160 · AS64630 Servidores Litoral (ficticio).
- ✔ **IP exclusiva del operador.** La IP solo aloja este servidor: se bloquea la IP.

**Evidencia**

| Detección | Minuto | SHA-256 de la detección | SHA-256 de la captura |
| --- | --- | --- | --- |
| D-0026 | 59 | 61e647685c11251013ffb1290f428531c75e8aedf2626f983d5b58b02859c51e | bd76872e48cdb6a12493be0263795f62a1c316df11b1d2a443a41a01b5bace5e |

**Dónde se promocionó:** x (https://x.example/futbolpasion_ar/status/9001)

**Huella de lo que vio el juez:** `f268d7bae7ef06efae22408639971599de3a4418564a533fe9168885ebdd66fd`

**Decisión:** Aprobada por Dr. Martín Ejemplo, minuto 81,8 del partido (2026-11-13T14:37:19.167Z).

**Órdenes**

| Proveedor | Tipo | Objetivo | Intento | Estado | Enviada | Aplicada | Fin | Vence | Identificador |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Red Andina Telecom (ficticio) | IP | 198.51.100.160 | 1 | vencida | 81,84 | 84,31 | 105 | 105 | `OFS-000001-0006-andina-1-f268d7bae7ef06ef` |
| Conectividad Aurora (ficticio) | IP | 198.51.100.160 | 1 | vencida | 81,84 | 82,23 | 105 | 105 | `OFS-000001-0006-aurora-1-f268d7bae7ef06ef` |
| Cooperativa Cumbre Conecta (ficticio) | IP | 198.51.100.160 | 1 | vencida | 81,86 | 84,56 | 105 | 105 | `OFS-000001-0006-cumbre-1-f268d7bae7ef06ef` |
| FibraValle (ficticio) | dominio | sc.futbolpasion.test | 1 | vencida | 81,83 | 89,64 | 105 | 105 | `OFS-000001-0006-valle-1-f268d7bae7ef06ef` |

## Aviso al titular

Aviso al titular de los derechos (Liga Profesional Ficticia) — Expediente EXP-2026-000001.
La señal con marca de agua LP26-FIN-OFI-S020318 se está retransmitiendo sin autorización desde 3 servidores: sa.futbolpasion.test (IP 203.0.113.60), sb.futbolpasion.test (IP 203.0.113.61) y sc.futbolpasion.test (IP 198.51.100.160).
Esa marca identifica de dónde sale la filtración. Se solicita ubicar la fuente asociada y cortarla: es la única medida que el operador no esquiva cambiando de servidor y que no puede afectar a terceros.
Nota: el simulador del desafío no modela este paso; el aviso se genera pero no tiene a quién enviarse.

## Registro de auditoría de este expediente

| Sec. | Minuto | Actor | Evento | Hash |
| --- | --- | --- | --- | --- |
| 2 | 52,58 | sistema | Se abrió EXP-2026-000001 por la marca LP26-FIN-OFI-S020318. | `35cb9c2fedd61cee…` |
| 3 | 52,58 | sistema | Se presentó al juez de turno la medida inicial M-0001: bloquear la IP 203.0.113.60. | `2e8c9ad1c7b109a3…` |
| 7 | 52,58 | sistema | Nueva evidencia en EXP-2026-000001: detección D-0004. | `c8bec9868e686981…` |
| 12 | 52,58 | sistema | Nueva evidencia en EXP-2026-000001: detección D-0008. | `9beddcf1eac5bb0e…` |
| 15 | 52,58 | sistema | Se presentó al juez de turno la medida inicial M-0004: bloquear la IP 203.0.113.61. | `d84a2ad1fcc75996…` |
| 20 | 52,58 | sistema | Nueva evidencia en EXP-2026-000001: detección D-0015. | `05778c59c1ed4b13…` |
| 26 | 52,58 | sistema | Nueva evidencia en EXP-2026-000001: detección D-0021. | `d149fa2f900a8c14…` |
| 31 | 56,03 | sistema | Nueva evidencia en EXP-2026-000001: detección D-0025. | `925438c21b058b07…` |
| 32 | 59,02 | sistema | Se presentó al juez de turno la medida inicial M-0006: bloquear la IP 198.51.100.160. | `f91350d393aea04b…` |
| 36 | 69 | sistema | Nueva evidencia en EXP-2026-000001: detección D-0030. | `9d0b758de9cc481f…` |
| 42 | 76 | juez-martin-ejemplo | Dr. Martín Ejemplo aprobó la medida M-0001. | `70b0180c5d49a7d4…` |
| 43 | 76 | juez-martin-ejemplo | Dr. Martín Ejemplo firmó la orden para Conectividad Aurora (ficticio): bloquear la IP 203.0.113.60. | `063871772d1744ee…` |
| 44 | 76 | juez-martin-ejemplo | Dr. Martín Ejemplo firmó la orden para Red Andina Telecom (ficticio): bloquear la IP 203.0.113.60. | `2becf014234c4ef2…` |
| 45 | 76 | juez-martin-ejemplo | Dr. Martín Ejemplo firmó la orden para FibraValle (ficticio): bloquear el dominio sa.futbolpasion.test. | `db2a9e1b21e7153f…` |
| 46 | 76 | juez-martin-ejemplo | Dr. Martín Ejemplo firmó la orden para Cooperativa Cumbre Conecta (ficticio): bloquear la IP 203.0.113.60. | `3e2e69c8ae71bd50…` |
| 47 | 76,03 | sistema | Orden enviada a Conectividad Aurora (ficticio): bloquear la IP 203.0.113.60. | `39accadf1afbd05f…` |
| 48 | 76,04 | sistema | Orden enviada a FibraValle (ficticio): bloquear el dominio sa.futbolpasion.test. | `c5fb03ad88962ac0…` |
| 49 | 76,05 | sistema | Orden enviada a Red Andina Telecom (ficticio): bloquear la IP 203.0.113.60. | `ebc551fae901c7ad…` |
| 50 | 76,05 | sistema | Orden enviada a Cooperativa Cumbre Conecta (ficticio): bloquear la IP 203.0.113.60. | `4eb8ab0a82ca0502…` |
| 51 | 76,64 | aurora | Conectividad Aurora (ficticio) aplicó el bloqueo de la IP 203.0.113.60. | `e28e1869623ac8e3…` |
| 72 | 78,38 | andina | Red Andina Telecom (ficticio) aplicó el bloqueo de la IP 203.0.113.60. | `80400e7069bf207f…` |
| 73 | 78,55 | juez-martin-ejemplo | Dr. Martín Ejemplo aprobó la medida M-0004. | `633256b613aa76cb…` |
| 74 | 78,55 | juez-martin-ejemplo | Dr. Martín Ejemplo firmó la orden para Conectividad Aurora (ficticio): bloquear la IP 203.0.113.61. | `3cdb64398602a48b…` |
| 75 | 78,55 | juez-martin-ejemplo | Dr. Martín Ejemplo firmó la orden para Red Andina Telecom (ficticio): bloquear la IP 203.0.113.61. | `5edc9908a7399237…` |
| 76 | 78,55 | juez-martin-ejemplo | Dr. Martín Ejemplo firmó la orden para FibraValle (ficticio): bloquear el dominio sb.futbolpasion.test. | `fe418e19d30b1f00…` |
| 77 | 78,55 | juez-martin-ejemplo | Dr. Martín Ejemplo firmó la orden para Cooperativa Cumbre Conecta (ficticio): bloquear la IP 203.0.113.61. | `2a1c4998ee50d1cb…` |
| 78 | 78,56 | sistema | Orden enviada a FibraValle (ficticio): bloquear el dominio sb.futbolpasion.test. | `19128eb707989887…` |
| 79 | 78,57 | sistema | Orden enviada a Red Andina Telecom (ficticio): bloquear la IP 203.0.113.61. | `e20b2f1bdfa53646…` |
| 80 | 78,57 | sistema | Orden enviada a Conectividad Aurora (ficticio): bloquear la IP 203.0.113.61. | `027f2266eec55d50…` |
| 81 | 78,59 | sistema | Orden enviada a Cooperativa Cumbre Conecta (ficticio): bloquear la IP 203.0.113.61. | `535a10b696f6317b…` |
| 82 | 78,8 | cumbre | Cooperativa Cumbre Conecta (ficticio) aplicó el bloqueo de la IP 203.0.113.60. | `dda4f56926142613…` |
| 83 | 79,03 | sistema | Nueva evidencia en EXP-2026-000001: detección D-0035. | `8d08caf3897f1e89…` |
| 85 | 79,19 | aurora | Conectividad Aurora (ficticio) aplicó el bloqueo de la IP 203.0.113.61. | `db60e1b3d3b7adc6…` |
| 99 | 80,77 | andina | Red Andina Telecom (ficticio) aplicó el bloqueo de la IP 203.0.113.61. | `a95168a61a2dc315…` |
| 102 | 81,41 | cumbre | Cooperativa Cumbre Conecta (ficticio) aplicó el bloqueo de la IP 203.0.113.61. | `4593dd7dc0e3d3be…` |
| 106 | 81,58 | valle | FibraValle (ficticio) aplicó el bloqueo del dominio sa.futbolpasion.test. | `531290ab67befb7b…` |
| 107 | 81,82 | juez-martin-ejemplo | Dr. Martín Ejemplo aprobó la medida M-0006. | `f48ff6a166f32e8f…` |
| 108 | 81,82 | juez-martin-ejemplo | Dr. Martín Ejemplo firmó la orden para Conectividad Aurora (ficticio): bloquear la IP 198.51.100.160. | `4cea16e298dfca19…` |
| 109 | 81,82 | juez-martin-ejemplo | Dr. Martín Ejemplo firmó la orden para Red Andina Telecom (ficticio): bloquear la IP 198.51.100.160. | `86c16c56d8f3839d…` |
| 110 | 81,82 | juez-martin-ejemplo | Dr. Martín Ejemplo firmó la orden para FibraValle (ficticio): bloquear el dominio sc.futbolpasion.test. | `34628b8c672c11aa…` |
| 111 | 81,82 | juez-martin-ejemplo | Dr. Martín Ejemplo firmó la orden para Cooperativa Cumbre Conecta (ficticio): bloquear la IP 198.51.100.160. | `1259bf677518e095…` |
| 112 | 81,83 | sistema | Orden enviada a FibraValle (ficticio): bloquear el dominio sc.futbolpasion.test. | `f8040e98e3d74083…` |
| 113 | 81,84 | sistema | Orden enviada a Red Andina Telecom (ficticio): bloquear la IP 198.51.100.160. | `fbc5ab62206fef1e…` |
| 114 | 81,84 | sistema | Orden enviada a Conectividad Aurora (ficticio): bloquear la IP 198.51.100.160. | `e32504b6652f5869…` |
| 115 | 81,86 | sistema | Orden enviada a Cooperativa Cumbre Conecta (ficticio): bloquear la IP 198.51.100.160. | `2d91d63fc7f87653…` |
| 118 | 82,23 | aurora | Conectividad Aurora (ficticio) aplicó el bloqueo de la IP 198.51.100.160. | `271825611b117cf7…` |
| 137 | 84,31 | andina | Red Andina Telecom (ficticio) aplicó el bloqueo de la IP 198.51.100.160. | `4d9e670185567152…` |
| 138 | 84,56 | cumbre | Cooperativa Cumbre Conecta (ficticio) aplicó el bloqueo de la IP 198.51.100.160. | `eff84971fac6c9ba…` |
| 141 | 85,03 | valle | FibraValle (ficticio) aplicó el bloqueo del dominio sb.futbolpasion.test. | `d20921c67c5663cf…` |
| 150 | 89,03 | sistema | Nueva evidencia en EXP-2026-000001: detección D-0042. | `2da792146ddc70ce…` |
| 161 | 89,64 | valle | FibraValle (ficticio) aplicó el bloqueo del dominio sc.futbolpasion.test. | `c13ed5bb13b0238f…` |
| 170 | 99,03 | sistema | Nueva evidencia en EXP-2026-000001: detección D-0047. | `ad09f30603214ad7…` |
| 174 | 105 | aurora | Venció el bloqueo de la IP 203.0.113.60 en Conectividad Aurora (ficticio). | `3cd02506ede8a0ae…` |
| 175 | 105 | andina | Venció el bloqueo de la IP 203.0.113.60 en Red Andina Telecom (ficticio). | `ed332bff50acf015…` |
| 176 | 105 | valle | Venció el bloqueo del dominio sa.futbolpasion.test en FibraValle (ficticio). | `1155b9a0e3c19bcc…` |
| 177 | 105 | cumbre | Venció el bloqueo de la IP 203.0.113.60 en Cooperativa Cumbre Conecta (ficticio). | `8b324dd53abee450…` |
| 185 | 105 | aurora | Venció el bloqueo de la IP 203.0.113.61 en Conectividad Aurora (ficticio). | `93054ccc1f350115…` |
| 186 | 105 | andina | Venció el bloqueo de la IP 203.0.113.61 en Red Andina Telecom (ficticio). | `3edac15c56030566…` |
| 187 | 105 | valle | Venció el bloqueo del dominio sb.futbolpasion.test en FibraValle (ficticio). | `e002304e7adc8c92…` |
| 188 | 105 | cumbre | Venció el bloqueo de la IP 203.0.113.61 en Cooperativa Cumbre Conecta (ficticio). | `833ce6ad4f836efb…` |
| 193 | 105 | aurora | Venció el bloqueo de la IP 198.51.100.160 en Conectividad Aurora (ficticio). | `b09b4c63f72640de…` |
| 194 | 105 | andina | Venció el bloqueo de la IP 198.51.100.160 en Red Andina Telecom (ficticio). | `e2a47e370161e987…` |
| 195 | 105 | valle | Venció el bloqueo del dominio sc.futbolpasion.test en FibraValle (ficticio). | `1d48efb51670ec7d…` |
| 196 | 105 | cumbre | Venció el bloqueo de la IP 198.51.100.160 en Cooperativa Cumbre Conecta (ficticio). | `72ae3a6ab811f116…` |

La integridad de este expediente se comprueba con `python3 herramientas/verificar_expediente.py <carpeta> --juzgados <claves> --registro <registro del simulador>`. Sin el registro del simulador, el verificador solo prueba que la carpeta es coherente consigo misma.
