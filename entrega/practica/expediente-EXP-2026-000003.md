# Expediente EXP-2026-000003

**Partido:** Partido de práctica — Club Ficticio del Norte vs. Deportivo Ejemplo · Titular de derechos: Liga Profesional Ficticia

**Filtración:** marca de agua `LP26-PRA-OFI-S010457` (prefijo LP26-PRA-OFI, Señal oficial del titular (plataforma propia)).

Abierto en el minuto 9 del partido. Los tiempos de este documento son minutos de partido.

## Servidores

| Servidor | IP | Organización | Primera detección | Detecciones | Bloqueo propuesto | Primer bloqueo confirmado | Sitios ajenos en la IP |
| --- | --- | --- | --- | --- | --- | --- | --- |
| tv.verpartido-hd.test | 192.0.2.50 | Pampa Web Hosting Compartido (ficticio) | 9 | 10 | por dominio | a los 1,43 min | 4 |

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

**Huella de lo que vio el juez:** `7179b359b18c68c3aa62b4e2de965120216eb7bec5bcafa1c12134a5ba2a0b60`

**Decisión:** Aprobada por Dra. Laura Ficticia, minuto 10 del partido (2026-11-12T01:38:03.086Z).

**Órdenes**

| Proveedor | Tipo | Objetivo | Intento | Estado | Enviada | Aplicada | Fin | Vence | Identificador |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Red Andina Telecom (ficticio) | dominio | tv.verpartido-hd.test | 1 | vencida | 10,01 | 11,85 | 105 | 105 | `OFS-000003-0003-andina-1-7179b359b18c68c3` |
| Conectividad Aurora (ficticio) | dominio | tv.verpartido-hd.test | 1 | vencida | 10,01 | 10,43 | 105 | 105 | `OFS-000003-0003-aurora-1-7179b359b18c68c3` |
| Cooperativa Cumbre Conecta (ficticio) | dominio | tv.verpartido-hd.test | 1 | vencida | 10,01 | 12,18 | 105 | 105 | `OFS-000003-0003-cumbre-1-7179b359b18c68c3` |
| FibraValle (ficticio) | dominio | tv.verpartido-hd.test | 1 | vencida | 10,01 | 15,31 | 105 | 105 | `OFS-000003-0003-valle-1-7179b359b18c68c3` |

## Aviso al titular

Aviso al titular de los derechos (Liga Profesional Ficticia) — Expediente EXP-2026-000003.
La señal con marca de agua LP26-PRA-OFI-S010457 se está retransmitiendo sin autorización desde 1 servidor: tv.verpartido-hd.test (IP 192.0.2.50).
Esa marca identifica de dónde sale la filtración. Se solicita ubicar la fuente asociada y cortarla: es la única medida que el operador no esquiva cambiando de servidor y que no puede afectar a terceros.
Nota: el simulador del desafío no modela este paso; el aviso se genera pero no tiene a quién enviarse.

## Registro de auditoría de este expediente

| Sec. | Minuto | Actor | Evento | Hash |
| --- | --- | --- | --- | --- |
| 37 | 9 | sistema | Se abrió EXP-2026-000003 por la marca LP26-PRA-OFI-S010457. | `d11463319adbd5a3…` |
| 38 | 9 | sistema | Se presentó al juez de turno la medida inicial M-0003: bloquear el dominio tv.verpartido-hd.test. | `216c072eafb728df…` |
| 40 | 10,01 | jueza-laura-ficticia | Dra. Laura Ficticia aprobó la medida M-0003. | `3c31e8acf31f0c50…` |
| 41 | 10,01 | jueza-laura-ficticia | Dra. Laura Ficticia firmó la orden para Conectividad Aurora (ficticio): bloquear el dominio tv.verpartido-hd.test. | `baa58792349cbd58…` |
| 42 | 10,01 | jueza-laura-ficticia | Dra. Laura Ficticia firmó la orden para Red Andina Telecom (ficticio): bloquear el dominio tv.verpartido-hd.test. | `a743977788d76f63…` |
| 43 | 10,01 | jueza-laura-ficticia | Dra. Laura Ficticia firmó la orden para FibraValle (ficticio): bloquear el dominio tv.verpartido-hd.test. | `086962a24090b617…` |
| 44 | 10,01 | jueza-laura-ficticia | Dra. Laura Ficticia firmó la orden para Cooperativa Cumbre Conecta (ficticio): bloquear el dominio tv.verpartido-hd.test. | `d1ee3c6b9da8a5c6…` |
| 45 | 10,01 | sistema | Orden enviada a Red Andina Telecom (ficticio): bloquear el dominio tv.verpartido-hd.test. | `1b7bdad1781ef9c6…` |
| 46 | 10,01 | sistema | Orden enviada a FibraValle (ficticio): bloquear el dominio tv.verpartido-hd.test. | `a57d6b49376c019f…` |
| 47 | 10,01 | sistema | Orden enviada a Conectividad Aurora (ficticio): bloquear el dominio tv.verpartido-hd.test. | `7dab9487e3d0db75…` |
| 48 | 10,01 | sistema | Orden enviada a Cooperativa Cumbre Conecta (ficticio): bloquear el dominio tv.verpartido-hd.test. | `92e88c60676d8fec…` |
| 49 | 10,43 | aurora | Conectividad Aurora (ficticio) aplicó el bloqueo del dominio tv.verpartido-hd.test. | `b271c670c0f39c76…` |
| 51 | 11,85 | andina | Red Andina Telecom (ficticio) aplicó el bloqueo del dominio tv.verpartido-hd.test. | `7580e2deb6563fbc…` |
| 53 | 12,18 | cumbre | Cooperativa Cumbre Conecta (ficticio) aplicó el bloqueo del dominio tv.verpartido-hd.test. | `948da00c1387978f…` |
| 55 | 15,31 | valle | FibraValle (ficticio) aplicó el bloqueo del dominio tv.verpartido-hd.test. | `5cc36d25525cf584…` |
| 57 | 19,01 | sistema | Nueva evidencia en EXP-2026-000003: detección D-0007. | `de034f83851abedd…` |
| 61 | 29 | sistema | Nueva evidencia en EXP-2026-000003: detección D-0011. | `3a0144792ad36200…` |
| 74 | 39,01 | sistema | Nueva evidencia en EXP-2026-000003: detección D-0015. | `b32bb3809d2e8043…` |
| 82 | 49,01 | sistema | Nueva evidencia en EXP-2026-000003: detección D-0019. | `0e534a6e0699f3b8…` |
| 100 | 59,01 | sistema | Nueva evidencia en EXP-2026-000003: detección D-0024. | `9acfb0c859caca1f…` |
| 114 | 69,01 | sistema | Nueva evidencia en EXP-2026-000003: detección D-0028. | `777ab6a1820b0d7b…` |
| 134 | 79,01 | sistema | Nueva evidencia en EXP-2026-000003: detección D-0032. | `1efbdd454781d386…` |
| 153 | 89,01 | sistema | Nueva evidencia en EXP-2026-000003: detección D-0037. | `a8f1602fed5dffa3…` |
| 157 | 99,01 | sistema | Nueva evidencia en EXP-2026-000003: detección D-0041. | `7bdddb4be9370f56…` |
| 168 | 105 | aurora | Venció el bloqueo del dominio tv.verpartido-hd.test en Conectividad Aurora (ficticio). | `3813a4a3be27a011…` |
| 169 | 105 | andina | Venció el bloqueo del dominio tv.verpartido-hd.test en Red Andina Telecom (ficticio). | `1fd2cc114d218e7a…` |
| 170 | 105 | valle | Venció el bloqueo del dominio tv.verpartido-hd.test en FibraValle (ficticio). | `685fb183fae7a506…` |
| 171 | 105 | cumbre | Venció el bloqueo del dominio tv.verpartido-hd.test en Cooperativa Cumbre Conecta (ficticio). | `2a997de4c9cb036e…` |

La integridad de este expediente se comprueba con `python3 herramientas/verificar_expediente.py <carpeta> --juzgados <claves> --registro <registro del simulador>`. Sin el registro del simulador, el verificador solo prueba que la carpeta es coherente consigo misma.
