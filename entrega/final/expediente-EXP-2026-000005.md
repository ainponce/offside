# Expediente EXP-2026-000005

**Partido:** Partido final — Club Ficticio del Sur vs. Atlético Demostración · Titular de derechos: Liga Profesional Ficticia

**Filtración:** marca de agua `LP26-FIN-OFI-S088004` (prefijo LP26-FIN-OFI, Señal oficial del titular (plataforma propia)).

Abierto en el minuto 70 del partido. Los tiempos de este documento son minutos de partido.

## Servidores

| Servidor | IP | Organización | Primera detección | Detecciones | Bloqueo propuesto | Primer bloqueo confirmado | Sitios ajenos en la IP |
| --- | --- | --- | --- | --- | --- | --- | --- |
| a1.canalpirata-hd.test | 203.0.113.95 | Bruma Hosting Dedicado (ficticio) | 70 | 2 | por IP | a los 13,49 min | 0 |
| a2.canalpirata-hd.test | 203.0.113.96 | Bruma Hosting Dedicado (ficticio) | 88 | 2 | por IP | a los 2,09 min | 0 |

## Medidas

### M-0007 · Medida inicial

**Pedido:** Bloquear la IP 203.0.113.95 en todos los proveedores hasta el final del partido.

**Servidor:** a1.canalpirata-hd.test · 203.0.113.95 · AS64600 Bruma Hosting Dedicado (ficticio)

**Verificaciones**

- ✔ **Es la señal oficial del partido.** La marca LP26-FIN-OFI-S088004 lleva el prefijo LP26-FIN-OFI (Señal oficial del titular (plataforma propia)).
- ✔ **No es un licenciatario en su dominio.** a1.canalpirata-hd.test no es un dominio autorizado. Señal oficial del partido en un sitio sin autorización.
- ✔ **Servidor identificado.** a1.canalpirata-hd.test · 203.0.113.95 · AS64600 Bruma Hosting Dedicado (ficticio).
- ✔ **IP exclusiva del operador.** La IP solo aloja este servidor: se bloquea la IP.

**Evidencia**

| Detección | Minuto | SHA-256 de la detección | SHA-256 de la captura |
| --- | --- | --- | --- |
| D-0031 | 70 | 88b457a5fa5b47138b5d0b02d27696253f1c7fdd54837358316282040e36af76 | 98e1a7c709f4d6b304ed5cdf8a9083f0b93468de62187909c7891fa07c7f4a2a |

**Dónde se promocionó:** telegram (https://t.example/canalpiratahd), discord (https://discord.example/invite/canalpirata)

**Huella de lo que vio el juez:** `c4e790bc7b06edb35c38378f0a428ae220c4e7cc3bb6bb79485e228cef6452f9`

**Decisión:** Aprobada por Dr. Martín Ejemplo, minuto 82,8 del partido (2026-11-13T14:37:39.616Z).

**Órdenes**

| Proveedor | Tipo | Objetivo | Intento | Estado | Enviada | Aplicada | Fin | Vence | Identificador |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Red Andina Telecom (ficticio) | IP | 203.0.113.95 | 1 | vencida | 82,88 | 84,75 | 105 | 105 | `OFS-000005-0007-andina-1-c4e790bc7b06edb3` |
| Conectividad Aurora (ficticio) | IP | 203.0.113.95 | 1 | vencida | 82,86 | 83,49 | 105 | 105 | `OFS-000005-0007-aurora-1-c4e790bc7b06edb3` |
| Cooperativa Cumbre Conecta (ficticio) | IP | 203.0.113.95 | 1 | vencida | 82,88 | 85,81 | 105 | 105 | `OFS-000005-0007-cumbre-1-c4e790bc7b06edb3` |
| FibraValle (ficticio) | dominio | a1.canalpirata-hd.test | 1 | vencida | 82,85 | 89,08 | 105 | 105 | `OFS-000005-0007-valle-1-c4e790bc7b06edb3` |

### M-0008 · Ampliación

**Pedido:** Ampliar el expediente a un servidor nuevo de la misma filtración: bloquear la IP 203.0.113.96 hasta el final del partido.

**Servidor:** a2.canalpirata-hd.test · 203.0.113.96 · AS64600 Bruma Hosting Dedicado (ficticio)

**Verificaciones**

- ✔ **Es la señal oficial del partido.** La marca LP26-FIN-OFI-S088004 lleva el prefijo LP26-FIN-OFI (Señal oficial del titular (plataforma propia)).
- ✔ **No es un licenciatario en su dominio.** a2.canalpirata-hd.test no es un dominio autorizado. Señal oficial del partido en un sitio sin autorización.
- ✔ **Servidor identificado.** a2.canalpirata-hd.test · 203.0.113.96 · AS64600 Bruma Hosting Dedicado (ficticio).
- ✔ **IP exclusiva del operador.** La IP solo aloja este servidor: se bloquea la IP.

**Evidencia**

| Detección | Minuto | SHA-256 de la detección | SHA-256 de la captura |
| --- | --- | --- | --- |
| D-0041 | 88 | bdf6a09e7a2b7e0d6ce16c6fcd18c0cbeaa67c252a155ffe0e2da6e17ba66bed | 437229b54a2ff81b92ae2f77d08edd569c937af3fcb285448492bf78e1f70bbd |

**Dónde se promocionó:** telegram (https://t.example/canalpiratahd), discord (https://discord.example/invite/canalpirata)

**Huella de lo que vio el juez:** `1430b62e99e3ba34bb02eedcdabcf4f6d4356b50454e5de3ad56b2f34c540dc5`

**Decisión:** Aprobada por Dr. Martín Ejemplo, minuto 89,5 del partido (2026-11-13T14:39:52.667Z).

**Órdenes**

| Proveedor | Tipo | Objetivo | Intento | Estado | Enviada | Aplicada | Fin | Vence | Identificador |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Red Andina Telecom (ficticio) | IP | 203.0.113.96 | 1 | vencida | 89,51 | 91,09 | 105 | 105 | `OFS-000005-0008-andina-1-1430b62e99e3ba34` |
| Conectividad Aurora (ficticio) | IP | 203.0.113.96 | 1 | vencida | 89,51 | 90,09 | 105 | 105 | `OFS-000005-0008-aurora-1-1430b62e99e3ba34` |
| Cooperativa Cumbre Conecta (ficticio) | IP | 203.0.113.96 | 1 | vencida | 89,54 | 92,76 | 105 | 105 | `OFS-000005-0008-cumbre-1-1430b62e99e3ba34` |
| FibraValle (ficticio) | dominio | a2.canalpirata-hd.test | 1 | vencida | 89,5 | 94,72 | 105 | 105 | `OFS-000005-0008-valle-1-1430b62e99e3ba34` |

## Aviso al titular

Aviso al titular de los derechos (Liga Profesional Ficticia) — Expediente EXP-2026-000005.
La señal con marca de agua LP26-FIN-OFI-S088004 se está retransmitiendo sin autorización desde 2 servidores: a1.canalpirata-hd.test (IP 203.0.113.95) y a2.canalpirata-hd.test (IP 203.0.113.96).
Esa marca identifica de dónde sale la filtración. Se solicita ubicar la fuente asociada y cortarla: es la única medida que el operador no esquiva cambiando de servidor y que no puede afectar a terceros.
Nota: el simulador del desafío no modela este paso; el aviso se genera pero no tiene a quién enviarse.

## Registro de auditoría de este expediente

| Sec. | Minuto | Actor | Evento | Hash |
| --- | --- | --- | --- | --- |
| 37 | 70,03 | sistema | Se abrió EXP-2026-000005 por la marca LP26-FIN-OFI-S088004. | `525959c920bec69d…` |
| 38 | 70,03 | sistema | Se presentó al juez de turno la medida inicial M-0007: bloquear la IP 203.0.113.95. | `6fd711a08679ef9d…` |
| 88 | 79,99 | sistema | Nueva evidencia en EXP-2026-000005: detección D-0036. | `a7ece3f385e5f9a1…` |
| 120 | 82,84 | juez-martin-ejemplo | Dr. Martín Ejemplo aprobó la medida M-0007. | `3f9dfb5fe97f136a…` |
| 121 | 82,84 | juez-martin-ejemplo | Dr. Martín Ejemplo firmó la orden para Conectividad Aurora (ficticio): bloquear la IP 203.0.113.95. | `cb029829032be243…` |
| 122 | 82,84 | juez-martin-ejemplo | Dr. Martín Ejemplo firmó la orden para Red Andina Telecom (ficticio): bloquear la IP 203.0.113.95. | `a61237da33878314…` |
| 123 | 82,84 | juez-martin-ejemplo | Dr. Martín Ejemplo firmó la orden para FibraValle (ficticio): bloquear el dominio a1.canalpirata-hd.test. | `4a664ee9257c3b9f…` |
| 124 | 82,84 | juez-martin-ejemplo | Dr. Martín Ejemplo firmó la orden para Cooperativa Cumbre Conecta (ficticio): bloquear la IP 203.0.113.95. | `1dddba69cf3277bb…` |
| 125 | 82,85 | sistema | Orden enviada a FibraValle (ficticio): bloquear el dominio a1.canalpirata-hd.test. | `12d7d4f9b4d48220…` |
| 126 | 82,86 | sistema | Orden enviada a Conectividad Aurora (ficticio): bloquear la IP 203.0.113.95. | `12b43e3638e0d8db…` |
| 127 | 82,88 | sistema | Orden enviada a Red Andina Telecom (ficticio): bloquear la IP 203.0.113.95. | `fb041e2b286150b7…` |
| 128 | 82,88 | sistema | Orden enviada a Cooperativa Cumbre Conecta (ficticio): bloquear la IP 203.0.113.95. | `199541d60ab07839…` |
| 131 | 83,49 | aurora | Conectividad Aurora (ficticio) aplicó el bloqueo de la IP 203.0.113.95. | `105e7dca01c3700b…` |
| 140 | 84,75 | andina | Red Andina Telecom (ficticio) aplicó el bloqueo de la IP 203.0.113.95. | `ea7f257095ff1be1…` |
| 142 | 85,81 | cumbre | Cooperativa Cumbre Conecta (ficticio) aplicó el bloqueo de la IP 203.0.113.95. | `5a0d2aa8a1975120…` |
| 148 | 87,99 | sistema | Se presentó al juez de turno la ampliación M-0008: bloquear la IP 203.0.113.96. | `a15398f6a091a2da…` |
| 151 | 89,08 | valle | FibraValle (ficticio) aplicó el bloqueo del dominio a1.canalpirata-hd.test. | `3df53d9b91aa3473…` |
| 152 | 89,49 | juez-martin-ejemplo | Dr. Martín Ejemplo aprobó la medida M-0008. | `3d2f6dcb5f5f684a…` |
| 153 | 89,49 | juez-martin-ejemplo | Dr. Martín Ejemplo firmó la orden para Conectividad Aurora (ficticio): bloquear la IP 203.0.113.96. | `0f801c718be1ddbc…` |
| 154 | 89,49 | juez-martin-ejemplo | Dr. Martín Ejemplo firmó la orden para Red Andina Telecom (ficticio): bloquear la IP 203.0.113.96. | `836a8007fc448856…` |
| 155 | 89,49 | juez-martin-ejemplo | Dr. Martín Ejemplo firmó la orden para FibraValle (ficticio): bloquear el dominio a2.canalpirata-hd.test. | `dc2899fcb58c4b66…` |
| 156 | 89,49 | juez-martin-ejemplo | Dr. Martín Ejemplo firmó la orden para Cooperativa Cumbre Conecta (ficticio): bloquear la IP 203.0.113.96. | `eb0e2fbc20ae3562…` |
| 157 | 89,5 | sistema | Orden enviada a FibraValle (ficticio): bloquear el dominio a2.canalpirata-hd.test. | `c1f8725748deeb1e…` |
| 158 | 89,51 | sistema | Orden enviada a Conectividad Aurora (ficticio): bloquear la IP 203.0.113.96. | `1fcdddcdc4c11bc6…` |
| 159 | 89,51 | sistema | Orden enviada a Red Andina Telecom (ficticio): bloquear la IP 203.0.113.96. | `c43ff28c5293c03b…` |
| 160 | 89,54 | sistema | Orden enviada a Cooperativa Cumbre Conecta (ficticio): bloquear la IP 203.0.113.96. | `f5b8d395175bd589…` |
| 163 | 90,09 | aurora | Conectividad Aurora (ficticio) aplicó el bloqueo de la IP 203.0.113.96. | `44b38b71626f8670…` |
| 164 | 91,09 | andina | Red Andina Telecom (ficticio) aplicó el bloqueo de la IP 203.0.113.96. | `6ab1b59f0300c53b…` |
| 166 | 92,76 | cumbre | Cooperativa Cumbre Conecta (ficticio) aplicó el bloqueo de la IP 203.0.113.96. | `439f66a3b1209900…` |
| 168 | 94,72 | valle | FibraValle (ficticio) aplicó el bloqueo del dominio a2.canalpirata-hd.test. | `a1389cf434204381…` |
| 169 | 98,03 | sistema | Nueva evidencia en EXP-2026-000005: detección D-0046. | `08ff569ceedf4604…` |
| 197 | 105 | aurora | Venció el bloqueo de la IP 203.0.113.95 en Conectividad Aurora (ficticio). | `0a259bf671d8b928…` |
| 198 | 105 | andina | Venció el bloqueo de la IP 203.0.113.95 en Red Andina Telecom (ficticio). | `51e976cb5f7b0a6b…` |
| 199 | 105 | valle | Venció el bloqueo del dominio a1.canalpirata-hd.test en FibraValle (ficticio). | `7351e5a9bafafeb9…` |
| 200 | 105 | cumbre | Venció el bloqueo de la IP 203.0.113.95 en Cooperativa Cumbre Conecta (ficticio). | `2eff9ecf8ad81c66…` |
| 202 | 105 | aurora | Venció el bloqueo de la IP 203.0.113.96 en Conectividad Aurora (ficticio). | `8f046aa2b117acbf…` |
| 203 | 105 | andina | Venció el bloqueo de la IP 203.0.113.96 en Red Andina Telecom (ficticio). | `bf93e54c60289eee…` |
| 204 | 105 | valle | Venció el bloqueo del dominio a2.canalpirata-hd.test en FibraValle (ficticio). | `3d4655503a039b66…` |
| 205 | 105 | cumbre | Venció el bloqueo de la IP 203.0.113.96 en Cooperativa Cumbre Conecta (ficticio). | `9e73a4f0c11d5d9b…` |

La integridad de este expediente se comprueba con `python3 herramientas/verificar_expediente.py <carpeta> --juzgados <claves> --registro <registro del simulador>`. Sin el registro del simulador, el verificador solo prueba que la carpeta es coherente consigo misma.
