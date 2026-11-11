# Expediente EXP-2026-000004

**Filtración:** marca de agua `LP26-PRA-OFI-S063002` (prefijo LP26-PRA-OFI, Señal oficial del titular (plataforma propia)).

Abierto en el minuto 55 del partido. Los tiempos de este documento son minutos de partido.

## Servidores

| Servidor | IP | Organización | Primera detección | Detecciones | Bloqueo propuesto | Primer bloqueo confirmado | Sitios ajenos en la IP |
| --- | --- | --- | --- | --- | --- | --- | --- |
| x9.tribuna-pirata.test | 203.0.113.40 | Bruma Hosting Dedicado (ficticio) | 55 | 3 | ip | a los 1.43 min | 0 |
| x10.tribuna-pirata.test | 203.0.113.41 | Bruma Hosting Dedicado (ficticio) | 82 | 3 | ip | a los 1.45 min | 0 |

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

**Huella de lo que vio el juez:** `c778a7e6ab8f68100b4cf99966005e5b0cbc67fd7bb343e0bf11262d54795c47`

**Decisión:** Aprobada por Dr. Martín Ejemplo, minuto 56.01 del partido (2026-11-11T23:15:45.149Z).

**Órdenes**

| Proveedor | Tipo | Objetivo | Intento | Estado | Enviada | Aplicada | Fin | Vence | Identificador |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| andina | ip | 203.0.113.40 | 1 | vencida | 56.01 | 58.105 | 105 | 105 | `OFS-000004-0005-andina-1-c778a7e6ab8f6810` |
| aurora | ip | 203.0.113.40 | 1 | vencida | 56.01 | 56.429 | 105 | 105 | `OFS-000004-0005-aurora-1-c778a7e6ab8f6810` |
| cumbre | ip | 203.0.113.40 | 1 | vencida | 56.01 | 59.4 | 105 | 105 | `OFS-000004-0005-cumbre-1-c778a7e6ab8f6810` |
| valle | dominio | x9.tribuna-pirata.test | 1 | vencida | 56.01 | 61.272 | 105 | 105 | `OFS-000004-0005-valle-1-c778a7e6ab8f6810` |

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

**Huella de lo que vio el juez:** `85c1fa5ebb33d46f49617cfbe20400743074cd9133809e5420fa5f117aa44dd0`

**Decisión:** Aprobada por Dr. Martín Ejemplo, minuto 83.01 del partido (2026-11-11T23:20:15.223Z).

**Órdenes**

| Proveedor | Tipo | Objetivo | Intento | Estado | Enviada | Aplicada | Fin | Vence | Identificador |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| andina | ip | 203.0.113.41 | 1 | vencida | 83.01 | 85.202 | 105 | 105 | `OFS-000004-0007-andina-1-85c1fa5ebb33d46f` |
| aurora | ip | 203.0.113.41 | 1 | vencida | 83.01 | 83.446 | 105 | 105 | `OFS-000004-0007-aurora-1-85c1fa5ebb33d46f` |
| cumbre | ip | 203.0.113.41 | 1 | vencida | 83.01 | 86.678 | 105 | 105 | `OFS-000004-0007-cumbre-1-85c1fa5ebb33d46f` |
| valle | dominio | x10.tribuna-pirata.test | 1 | vencida | 83.01 | 89.03 | 105 | 105 | `OFS-000004-0007-valle-1-85c1fa5ebb33d46f` |

## Aviso al titular

Aviso al titular de derechos — Expediente EXP-2026-000004.
La señal con marca de agua LP26-PRA-OFI-S063002 se está retransmitiendo sin autorización desde 2 servidores: x9.tribuna-pirata.test (203.0.113.40), x10.tribuna-pirata.test (203.0.113.41).
Esa marca identifica de dónde sale la filtración. Se solicita ubicar la fuente asociada y cortarla: es la única medida que el operador no esquiva cambiando de servidor y que no puede afectar a terceros.
Nota: el simulador del desafío no modela este paso; el aviso se genera pero no tiene a quién enviarse.

## Registro de auditoría de este expediente

| Sec. | Minuto | Actor | Evento | Hash |
| --- | --- | --- | --- | --- |
| 65 | 55 | sistema | Se abrió EXP-2026-000004 por la marca LP26-PRA-OFI-S063002. | `86a6403e31eabaf6…` |
| 66 | 55 | sistema | Medida M-0005 (inicial) presentada al juez de turno: x9.tribuna-pirata.test por ip. | `ba36cb8b758b48ea…` |
| 68 | 56.01 | juez-martin-ejemplo | Dr. Martín Ejemplo aprobó la medida M-0005. | `870c9156fbdaf755…` |
| 69 | 56.01 | sistema | Orden enviada a valle: dominio x9.tribuna-pirata.test. | `8dbabec3c722ef7f…` |
| 70 | 56.01 | sistema | Orden enviada a aurora: ip 203.0.113.40. | `b942fe775d2b4209…` |
| 71 | 56.01 | sistema | Orden enviada a andina: ip 203.0.113.40. | `f19847c641d2c129…` |
| 72 | 56.01 | sistema | Orden enviada a cumbre: ip 203.0.113.40. | `4250de7c984b3752…` |
| 73 | 56.43 | aurora | aurora confirmó el bloqueo de 203.0.113.40. | `0f95025017cf4c54…` |
| 75 | 58.11 | andina | andina confirmó el bloqueo de 203.0.113.40. | `41a8c4d3013e3e48…` |
| 77 | 59.4 | cumbre | cumbre confirmó el bloqueo de 203.0.113.40. | `182d91bcc0cd59b1…` |
| 78 | 61.27 | valle | valle confirmó el bloqueo de x9.tribuna-pirata.test. | `e4ad5334cfa57a9e…` |
| 79 | 65.01 | sistema | Nueva evidencia en EXP-2026-000004: detección D-0025. | `9648e68c37567aa2…` |
| 91 | 75.01 | sistema | Nueva evidencia en EXP-2026-000004: detección D-0030. | `1b1c8855b02eec6d…` |
| 102 | 82.01 | sistema | Medida M-0007 (ampliacion) presentada al juez de turno: x10.tribuna-pirata.test por ip. | `f00fb8520b3dd6f7…` |
| 104 | 83.01 | juez-martin-ejemplo | Dr. Martín Ejemplo aprobó la medida M-0007. | `6c9a14e17aa96394…` |
| 105 | 83.01 | sistema | Orden enviada a valle: dominio x10.tribuna-pirata.test. | `bb0882373560aa13…` |
| 106 | 83.01 | sistema | Orden enviada a aurora: ip 203.0.113.41. | `a9789e0cef6348ba…` |
| 107 | 83.01 | sistema | Orden enviada a andina: ip 203.0.113.41. | `da74d83639484c48…` |
| 108 | 83.01 | sistema | Orden enviada a cumbre: ip 203.0.113.41. | `4288f76b861fb838…` |
| 109 | 83.45 | aurora | aurora confirmó el bloqueo de 203.0.113.41. | `6ea231d48be25685…` |
| 111 | 85.2 | andina | andina confirmó el bloqueo de 203.0.113.41. | `42983827a6c9da51…` |
| 113 | 86.68 | cumbre | cumbre confirmó el bloqueo de 203.0.113.41. | `30e32011d3b57d64…` |
| 115 | 89.03 | valle | valle confirmó el bloqueo de x10.tribuna-pirata.test. | `2b6b8f93ef41ef52…` |
| 117 | 92.01 | sistema | Nueva evidencia en EXP-2026-000004: detección D-0039. | `6ab6098091b6ed29…` |
| 121 | 102 | sistema | Nueva evidencia en EXP-2026-000004: detección D-0043. | `d9605e8fd56be236…` |
| 138 | 105 | aurora | Venció el bloqueo de 203.0.113.40 en aurora. | `33f580a3d6eb5e13…` |
| 139 | 105 | andina | Venció el bloqueo de 203.0.113.40 en andina. | `236723b9da6210b8…` |
| 140 | 105 | valle | Venció el bloqueo de x9.tribuna-pirata.test en valle. | `e048139bddda62e0…` |
| 141 | 105 | cumbre | Venció el bloqueo de 203.0.113.40 en cumbre. | `95d7d7122480fa74…` |
| 146 | 105 | aurora | Venció el bloqueo de 203.0.113.41 en aurora. | `1457defa8e5ecbcb…` |
| 147 | 105 | andina | Venció el bloqueo de 203.0.113.41 en andina. | `45ee22c44a9e1ba7…` |
| 148 | 105 | valle | Venció el bloqueo de x10.tribuna-pirata.test en valle. | `a23abcf4b0716746…` |
| 149 | 105 | cumbre | Venció el bloqueo de 203.0.113.41 en cumbre. | `463ac44e763bd5fd…` |
| 151 | 110.61 | sistema | Exportación a entrega/practica. | `920d4719407dab2d…` |

La integridad de este expediente se comprueba con `python3 herramientas/verificar_expediente.py <carpeta>`.
