# Expediente EXP-2026-000002

**Partido:** Partido final — Club Ficticio del Sur vs. Atlético Demostración · Titular de derechos: Liga Profesional Ficticia

**Filtración:** marca de agua `LP26-FIN-OFI-S055120` (prefijo LP26-FIN-OFI, Señal oficial del titular (plataforma propia)).

Abierto en el minuto 52,6 del partido. Los tiempos de este documento son minutos de partido.

## Servidores

| Servidor | IP | Organización | Primera detección | Detecciones | Bloqueo propuesto | Primer bloqueo confirmado | Sitios ajenos en la IP |
| --- | --- | --- | --- | --- | --- | --- | --- |
| play.estadio-libre.test | 198.51.100.140 | NubeRápida CDN (ficticia) | 4 | 11 | por dominio | a los 73,38 min | 9 |

## Medidas

### M-0002 · Medida inicial

**Pedido:** Bloquear el dominio play.estadio-libre.test en todos los proveedores hasta el final del partido.

**Servidor:** play.estadio-libre.test · 198.51.100.140 · AS64610 NubeRápida CDN (ficticia)

**Verificaciones**

- ✔ **Es la señal oficial del partido.** La marca LP26-FIN-OFI-S055120 lleva el prefijo LP26-FIN-OFI (Señal oficial del titular (plataforma propia)).
- ✔ **No es un licenciatario en su dominio.** play.estadio-libre.test no es un dominio autorizado. Señal oficial del partido en un sitio sin autorización.
- ✔ **Servidor identificado.** play.estadio-libre.test · 198.51.100.140 · AS64610 NubeRápida CDN (ficticia).
- ✔ **IP compartida: se bloquea solo el dominio.** La IP aloja 9 sitios ajenos (diario-salteno-ejemplo.example, farmacia-central-ejemplo.test, bodega-valle-calchaqui.example y 6 más). Ninguno queda afectado.

**Sitios ajenos en la misma IP (no se bloquean):** diario-salteno-ejemplo.example, farmacia-central-ejemplo.test, bodega-valle-calchaqui.example, gimnasio-ejemplo.test, agencia-de-viajes-norte.test, colegio-san-ejemplo.test, tienda-de-ponchos.example, cooperativa-agua-ejemplo.test, hotel-plaza-ejemplo.test

**Evidencia**

| Detección | Minuto | SHA-256 de la detección | SHA-256 de la captura |
| --- | --- | --- | --- |
| D-0003 | 4 | 72438fb9393a2e6141190474dfbefd473b260bbbfeaa762fa7c3988e8f832cae | 8c706aa5bb28a95aef2ec9d2c8e6902159d1cae74299cd60da75be2b77cb9fad |

**Dónde se promocionó:** discord (https://discord.example/invite/estadio-libre)

**Huella de lo que vio el juez:** `74bd6cbd82d5d708f5fcb3fb5e5b26b28812a01ecc8288eaabeabd5c3e6aafbd`

**Decisión:** Aprobada por Dr. Martín Ejemplo, minuto 76,9 del partido (2026-11-13T14:35:40.202Z).

**Órdenes**

| Proveedor | Tipo | Objetivo | Intento | Estado | Enviada | Aplicada | Fin | Vence | Identificador |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Red Andina Telecom (ficticio) | dominio | play.estadio-libre.test | 1 | vencida | 76,88 | 79,17 | 105 | 105 | `OFS-000002-0002-andina-1-74bd6cbd82d5d708` |
| Conectividad Aurora (ficticio) | dominio | play.estadio-libre.test | 1 | vencida | 76,88 | 77,38 | 105 | 105 | `OFS-000002-0002-aurora-1-74bd6cbd82d5d708` |
| Cooperativa Cumbre Conecta (ficticio) | dominio | play.estadio-libre.test | 1 | vencida | 76,9 | 79,52 | 105 | 105 | `OFS-000002-0002-cumbre-1-74bd6cbd82d5d708` |
| FibraValle (ficticio) | dominio | play.estadio-libre.test | 1 | vencida | 76,88 | 82,56 | 105 | 105 | `OFS-000002-0002-valle-1-74bd6cbd82d5d708` |

## Aviso al titular

Aviso al titular de los derechos (Liga Profesional Ficticia) — Expediente EXP-2026-000002.
La señal con marca de agua LP26-FIN-OFI-S055120 se está retransmitiendo sin autorización desde 1 servidor: play.estadio-libre.test (IP 198.51.100.140).
Esa marca identifica de dónde sale la filtración. Se solicita ubicar la fuente asociada y cortarla: es la única medida que el operador no esquiva cambiando de servidor y que no puede afectar a terceros.
Nota: el simulador del desafío no modela este paso; el aviso se genera pero no tiene a quién enviarse.

## Registro de auditoría de este expediente

| Sec. | Minuto | Actor | Evento | Hash |
| --- | --- | --- | --- | --- |
| 5 | 52,58 | sistema | Se abrió EXP-2026-000002 por la marca LP26-FIN-OFI-S055120. | `da4969ed692c293e…` |
| 6 | 52,58 | sistema | Se presentó al juez de turno la medida inicial M-0002: bloquear el dominio play.estadio-libre.test. | `55f03c85c3203e5e…` |
| 10 | 52,58 | sistema | Nueva evidencia en EXP-2026-000002: detección D-0006. | `67a59f0afd13edee…` |
| 14 | 52,58 | sistema | Nueva evidencia en EXP-2026-000002: detección D-0010. | `767536684f3892b8…` |
| 19 | 52,58 | sistema | Nueva evidencia en EXP-2026-000002: detección D-0014. | `0dc294a00a66c64b…` |
| 24 | 52,58 | sistema | Nueva evidencia en EXP-2026-000002: detección D-0019. | `cab85d8a3ea70366…` |
| 29 | 54,03 | sistema | Nueva evidencia en EXP-2026-000002: detección D-0024. | `ddcb70c8ee67b41a…` |
| 35 | 64,02 | sistema | Nueva evidencia en EXP-2026-000002: detección D-0029. | `e7870df0b673418f…` |
| 41 | 73,99 | sistema | Nueva evidencia en EXP-2026-000002: detección D-0034. | `556068ed79e524c4…` |
| 52 | 76,87 | juez-martin-ejemplo | Dr. Martín Ejemplo aprobó la medida M-0002. | `d88a187da56d2b27…` |
| 53 | 76,87 | juez-martin-ejemplo | Dr. Martín Ejemplo firmó la orden para Conectividad Aurora (ficticio): bloquear el dominio play.estadio-libre.test. | `3e85e3904c191a6f…` |
| 54 | 76,87 | juez-martin-ejemplo | Dr. Martín Ejemplo firmó la orden para Red Andina Telecom (ficticio): bloquear el dominio play.estadio-libre.test. | `b4b65447d05880aa…` |
| 55 | 76,87 | juez-martin-ejemplo | Dr. Martín Ejemplo firmó la orden para FibraValle (ficticio): bloquear el dominio play.estadio-libre.test. | `f3637226e46cfb4e…` |
| 56 | 76,87 | juez-martin-ejemplo | Dr. Martín Ejemplo firmó la orden para Cooperativa Cumbre Conecta (ficticio): bloquear el dominio play.estadio-libre.test. | `f70d1ec3bdc1d6c2…` |
| 57 | 76,88 | sistema | Orden enviada a Red Andina Telecom (ficticio): bloquear el dominio play.estadio-libre.test. | `edf76b6db403dea1…` |
| 58 | 76,88 | sistema | Orden enviada a FibraValle (ficticio): bloquear el dominio play.estadio-libre.test. | `7b1dec97c21a12fe…` |
| 59 | 76,88 | sistema | Orden enviada a Conectividad Aurora (ficticio): bloquear el dominio play.estadio-libre.test. | `7c4997d8dcc77090…` |
| 60 | 76,9 | sistema | Orden enviada a Cooperativa Cumbre Conecta (ficticio): bloquear el dominio play.estadio-libre.test. | `a2d522bde358a3e3…` |
| 61 | 77,38 | aurora | Conectividad Aurora (ficticio) aplicó el bloqueo del dominio play.estadio-libre.test. | `4278f00b805efbfb…` |
| 84 | 79,17 | andina | Red Andina Telecom (ficticio) aplicó el bloqueo del dominio play.estadio-libre.test. | `e1cce6defce8edaa…` |
| 86 | 79,52 | cumbre | Cooperativa Cumbre Conecta (ficticio) aplicó el bloqueo del dominio play.estadio-libre.test. | `559d391c7d4e334d…` |
| 119 | 82,56 | valle | FibraValle (ficticio) aplicó el bloqueo del dominio play.estadio-libre.test. | `35ef419a80069431…` |
| 136 | 84,02 | sistema | Nueva evidencia en EXP-2026-000002: detección D-0040. | `1affa2e733becf41…` |
| 167 | 93,99 | sistema | Nueva evidencia en EXP-2026-000002: detección D-0045. | `9fed7967c19a521b…` |
| 173 | 104 | sistema | Nueva evidencia en EXP-2026-000002: detección D-0050. | `c2313aa5795552fa…` |
| 178 | 105 | aurora | Venció el bloqueo del dominio play.estadio-libre.test en Conectividad Aurora (ficticio). | `790bfbeb7639c54c…` |
| 179 | 105 | andina | Venció el bloqueo del dominio play.estadio-libre.test en Red Andina Telecom (ficticio). | `5410f1cd84bfcf0b…` |
| 180 | 105 | valle | Venció el bloqueo del dominio play.estadio-libre.test en FibraValle (ficticio). | `c3f34967dd152573…` |
| 181 | 105 | cumbre | Venció el bloqueo del dominio play.estadio-libre.test en Cooperativa Cumbre Conecta (ficticio). | `1677a02c804aa454…` |

La integridad de este expediente se comprueba con `python3 herramientas/verificar_expediente.py <carpeta> --juzgados <claves> --registro <registro del simulador>`. Sin el registro del simulador, el verificador solo prueba que la carpeta es coherente consigo misma.
