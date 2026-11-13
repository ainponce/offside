# Expediente EXP-2026-000003

**Partido:** Partido final — Club Ficticio del Sur vs. Atlético Demostración · Titular de derechos: Liga Profesional Ficticia

**Filtración:** marca de agua `LP26-FIN-OFI-S031877` (prefijo LP26-FIN-OFI, Señal oficial del titular (plataforma propia)).

Abierto en el minuto 52,6 del partido. Los tiempos de este documento son minutos de partido.

## Servidores

| Servidor | IP | Organización | Primera detección | Detecciones | Bloqueo propuesto | Primer bloqueo confirmado | Sitios ajenos en la IP |
| --- | --- | --- | --- | --- | --- | --- | --- |
| hd.mirapartido.test | 192.0.2.120 | Pampa Web Hosting Compartido (ficticio) | 12 | 10 | por dominio | a los 66,11 min | 4 |

## Medidas

### M-0003 · Medida inicial

**Pedido:** Bloquear el dominio hd.mirapartido.test en todos los proveedores hasta el final del partido.

**Servidor:** hd.mirapartido.test · 192.0.2.120 · AS64620 Pampa Web Hosting Compartido (ficticio)

**Verificaciones**

- ✔ **Es la señal oficial del partido.** La marca LP26-FIN-OFI-S031877 lleva el prefijo LP26-FIN-OFI (Señal oficial del titular (plataforma propia)).
- ✔ **No es un licenciatario en su dominio.** hd.mirapartido.test no es un dominio autorizado. Señal oficial del partido en un sitio sin autorización.
- ✔ **Servidor identificado.** hd.mirapartido.test · 192.0.2.120 · AS64620 Pampa Web Hosting Compartido (ficticio).
- ✔ **IP compartida: se bloquea solo el dominio.** La IP aloja 4 sitios ajenos (ferreteria-central.test, jardin-de-infantes-7.test, consultorio-odontologico-sur.test y 1 más). Ninguno queda afectado.

**Sitios ajenos en la misma IP (no se bloquean):** ferreteria-central.test, jardin-de-infantes-7.test, consultorio-odontologico-sur.test, coro-municipal-ejemplo.test

**Evidencia**

| Detección | Minuto | SHA-256 de la detección | SHA-256 de la captura |
| --- | --- | --- | --- |
| D-0005 | 12 | 936436269d8019dce258f44f2056f0915d4f9b39b3f71ef6ade6d24a177c2f8a | 1f6515d22d26597cad963315282859d85f9d1567c78acc802603b376c6889326 |

**Dónde se promocionó:** telegram (https://t.example/mirapartido)

**Huella de lo que vio el juez:** `ee81800d15155b42a78a10929e471c0fb2e7c45e4cd1b8028c029c4e8130caab`

**Decisión:** Aprobada por Dr. Martín Ejemplo, minuto 77,7 del partido (2026-11-13T14:35:56.191Z).

**Órdenes**

| Proveedor | Tipo | Objetivo | Intento | Estado | Enviada | Aplicada | Fin | Vence | Identificador |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Red Andina Telecom (ficticio) | dominio | hd.mirapartido.test | 1 | vencida | 77,68 | 79,85 | 105 | 105 | `OFS-000003-0003-andina-1-ee81800d15155b42` |
| Conectividad Aurora (ficticio) | dominio | hd.mirapartido.test | 1 | vencida | 77,68 | 78,11 | 105 | 105 | `OFS-000003-0003-aurora-1-ee81800d15155b42` |
| Cooperativa Cumbre Conecta (ficticio) | dominio | hd.mirapartido.test | 1 | fallida | 77,7 | — | — | 105 | `OFS-000003-0003-cumbre-1-ee81800d15155b42` |
| Cooperativa Cumbre Conecta (ficticio) | dominio | hd.mirapartido.test | 2 | vencida | 81,48 | 84,73 | 105 | 105 | `OFS-000003-0003-cumbre-2-ee81800d15155b42` |
| FibraValle (ficticio) | dominio | hd.mirapartido.test | 1 | vencida | 77,68 | 81,89 | 105 | 105 | `OFS-000003-0003-valle-1-ee81800d15155b42` |

## Aviso al titular

Aviso al titular de los derechos (Liga Profesional Ficticia) — Expediente EXP-2026-000003.
La señal con marca de agua LP26-FIN-OFI-S031877 se está retransmitiendo sin autorización desde 1 servidor: hd.mirapartido.test (IP 192.0.2.120).
Esa marca identifica de dónde sale la filtración. Se solicita ubicar la fuente asociada y cortarla: es la única medida que el operador no esquiva cambiando de servidor y que no puede afectar a terceros.
Nota: el simulador del desafío no modela este paso; el aviso se genera pero no tiene a quién enviarse.

## Registro de auditoría de este expediente

| Sec. | Minuto | Actor | Evento | Hash |
| --- | --- | --- | --- | --- |
| 8 | 52,58 | sistema | Se abrió EXP-2026-000003 por la marca LP26-FIN-OFI-S031877. | `f2990aecfcc25e31…` |
| 9 | 52,58 | sistema | Se presentó al juez de turno la medida inicial M-0003: bloquear el dominio hd.mirapartido.test. | `40db42dc931dbe50…` |
| 13 | 52,58 | sistema | Nueva evidencia en EXP-2026-000003: detección D-0009. | `1e1793522371b5e6…` |
| 18 | 52,58 | sistema | Nueva evidencia en EXP-2026-000003: detección D-0013. | `e4a6ecade8d1c81b…` |
| 22 | 52,58 | sistema | Nueva evidencia en EXP-2026-000003: detección D-0017. | `70761ebf9bb3f7b7…` |
| 28 | 52,58 | sistema | Nueva evidencia en EXP-2026-000003: detección D-0023. | `c58110efd24582cd…` |
| 34 | 62,02 | sistema | Nueva evidencia en EXP-2026-000003: detección D-0028. | `a7226bef2de29dc9…` |
| 40 | 72 | sistema | Nueva evidencia en EXP-2026-000003: detección D-0033. | `a60cbc3f3abec0af…` |
| 62 | 77,67 | juez-martin-ejemplo | Dr. Martín Ejemplo aprobó la medida M-0003. | `7a946f625ab9b2e6…` |
| 63 | 77,67 | juez-martin-ejemplo | Dr. Martín Ejemplo firmó la orden para Conectividad Aurora (ficticio): bloquear el dominio hd.mirapartido.test. | `ca3e6566eb509455…` |
| 64 | 77,67 | juez-martin-ejemplo | Dr. Martín Ejemplo firmó la orden para Red Andina Telecom (ficticio): bloquear el dominio hd.mirapartido.test. | `34a86d304e9ccd87…` |
| 65 | 77,67 | juez-martin-ejemplo | Dr. Martín Ejemplo firmó la orden para FibraValle (ficticio): bloquear el dominio hd.mirapartido.test. | `5d43f198cfe1cd8b…` |
| 66 | 77,67 | juez-martin-ejemplo | Dr. Martín Ejemplo firmó la orden para Cooperativa Cumbre Conecta (ficticio): bloquear el dominio hd.mirapartido.test. | `3c04f0d2356f94e7…` |
| 67 | 77,68 | sistema | Orden enviada a Red Andina Telecom (ficticio): bloquear el dominio hd.mirapartido.test. | `956bb87a68ca6fba…` |
| 68 | 77,68 | sistema | Orden enviada a FibraValle (ficticio): bloquear el dominio hd.mirapartido.test. | `33f57b6c951715dd…` |
| 69 | 77,68 | sistema | Orden enviada a Conectividad Aurora (ficticio): bloquear el dominio hd.mirapartido.test. | `d77cd626e3d7db35…` |
| 70 | 77,7 | sistema | Orden enviada a Cooperativa Cumbre Conecta (ficticio): bloquear el dominio hd.mirapartido.test. | `a33f5fbb7a2ff604…` |
| 71 | 78,11 | aurora | Conectividad Aurora (ficticio) aplicó el bloqueo del dominio hd.mirapartido.test. | `cdec52d8ddd835ed…` |
| 87 | 79,85 | andina | Red Andina Telecom (ficticio) aplicó el bloqueo del dominio hd.mirapartido.test. | `98bf88055204b9db…` |
| 101 | 81,45 | cumbre | Cooperativa Cumbre Conecta (ficticio) no pudo aplicar el bloqueo del dominio hd.mirapartido.test. | `39d30f601efc18c1…` |
| 103 | 81,45 | juez-martin-ejemplo | Dr. Martín Ejemplo firmó la orden para Cooperativa Cumbre Conecta (ficticio): bloquear el dominio hd.mirapartido.test (intento 2). | `5eae6255630a55df…` |
| 104 | 81,45 | sistema | Reenvío a Cooperativa Cumbre Conecta (ficticio) con una orden nueva tras la falla. | `c19470267f0594b0…` |
| 105 | 81,48 | sistema | Orden enviada a Cooperativa Cumbre Conecta (ficticio): bloquear el dominio hd.mirapartido.test (intento 2). | `3f94fe03eb72d186…` |
| 116 | 81,89 | valle | FibraValle (ficticio) aplicó el bloqueo del dominio hd.mirapartido.test. | `3b16a3caa76e78ba…` |
| 117 | 81,99 | sistema | Nueva evidencia en EXP-2026-000003: detección D-0038. | `f77f76c30246e57a…` |
| 139 | 84,73 | cumbre | Cooperativa Cumbre Conecta (ficticio) aplicó el bloqueo del dominio hd.mirapartido.test. | `052aa907fa52c9e7…` |
| 165 | 92 | sistema | Nueva evidencia en EXP-2026-000003: detección D-0044. | `3c40e6ec53bd9a71…` |
| 172 | 102,04 | sistema | Nueva evidencia en EXP-2026-000003: detección D-0049. | `c888eb4fd17ee03e…` |
| 182 | 105 | aurora | Venció el bloqueo del dominio hd.mirapartido.test en Conectividad Aurora (ficticio). | `6d17e333cb926ec2…` |
| 183 | 105 | andina | Venció el bloqueo del dominio hd.mirapartido.test en Red Andina Telecom (ficticio). | `df78c2f9053a92dd…` |
| 184 | 105 | valle | Venció el bloqueo del dominio hd.mirapartido.test en FibraValle (ficticio). | `e901ae3d3fdb6955…` |
| 192 | 105 | cumbre | Venció el bloqueo del dominio hd.mirapartido.test en Cooperativa Cumbre Conecta (ficticio). | `89700d7fc75caa00…` |

La integridad de este expediente se comprueba con `python3 herramientas/verificar_expediente.py <carpeta> --juzgados <claves> --registro <registro del simulador>`. Sin el registro del simulador, el verificador solo prueba que la carpeta es coherente consigo misma.
