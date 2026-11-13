# Expediente EXP-2026-000004

**Partido:** Partido final — Club Ficticio del Sur vs. Atlético Demostración · Titular de derechos: Liga Profesional Ficticia

**Filtración:** marca de agua `LP26-FIN-LIC-SUR` (prefijo LP26-FIN-LIC-SUR, Licenciatario autorizado: Canal Sur Andino (ficticio)).

Abierto en el minuto 52,6 del partido. Los tiempos de este documento son minutos de partido.

## Servidores

| Servidor | IP | Organización | Primera detección | Detecciones | Bloqueo propuesto | Primer bloqueo confirmado | Sitios ajenos en la IP |
| --- | --- | --- | --- | --- | --- | --- | --- |
| relay.tvgol-gratis.test | 203.0.113.90 | Bruma Hosting Dedicado (ficticio) | 30 | 8 | por IP | a los 50,98 min | 0 |

## Medidas

### M-0005 · Medida inicial

**Pedido:** Bloquear la IP 203.0.113.90 en todos los proveedores hasta el final del partido.

**Servidor:** relay.tvgol-gratis.test · 203.0.113.90 · AS64600 Bruma Hosting Dedicado (ficticio)

**Verificaciones**

- ✔ **Es la señal oficial del partido.** La marca LP26-FIN-LIC-SUR lleva el prefijo LP26-FIN-LIC-SUR (Licenciatario autorizado: Canal Sur Andino (ficticio)).
- ✔ **No es un licenciatario en su dominio.** relay.tvgol-gratis.test no es un dominio autorizado. Señal de Canal Sur Andino (ficticio) retransmitida fuera de sus dominios autorizados.
- ✔ **Servidor identificado.** relay.tvgol-gratis.test · 203.0.113.90 · AS64600 Bruma Hosting Dedicado (ficticio).
- ✔ **IP exclusiva del operador.** La IP solo aloja este servidor: se bloquea la IP.

**Evidencia**

| Detección | Minuto | SHA-256 de la detección | SHA-256 de la captura |
| --- | --- | --- | --- |
| D-0012 | 30 | fdee455ee7a3822b8a96790c3a7b612efd5a381400fd9a40dae05edac4b2b5ee | ec5e5c35d592401d51396ca710242d53473f5c87d17ac01558316524db75a855 |

**Dónde se promocionó:** x (https://x.example/tvgolgratis/status/9310)

**Huella de lo que vio el juez:** `97ed48b2f54e78dff6e417126fc11d995fcd7fd76568fa94269c2140477248a2`

**Decisión:** Aprobada por Dr. Martín Ejemplo, minuto 80,5 del partido (2026-11-13T14:36:51.911Z).

**Órdenes**

| Proveedor | Tipo | Objetivo | Intento | Estado | Enviada | Aplicada | Fin | Vence | Identificador |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Red Andina Telecom (ficticio) | IP | 203.0.113.90 | 1 | vencida | 80,48 | 83,07 | 105 | 105 | `OFS-000004-0005-andina-1-97ed48b2f54e78df` |
| Conectividad Aurora (ficticio) | IP | 203.0.113.90 | 1 | vencida | 80,48 | 80,98 | 105 | 105 | `OFS-000004-0005-aurora-1-97ed48b2f54e78df` |
| Cooperativa Cumbre Conecta (ficticio) | IP | 203.0.113.90 | 1 | fallida | 80,48 | — | — | 105 | `OFS-000004-0005-cumbre-1-97ed48b2f54e78df` |
| Cooperativa Cumbre Conecta (ficticio) | IP | 203.0.113.90 | 2 | fallida | 83,74 | — | — | 105 | `OFS-000004-0005-cumbre-2-97ed48b2f54e78df` |
| Cooperativa Cumbre Conecta (ficticio) | IP | 203.0.113.90 | 3 | vencida | 85,96 | 88,72 | 105 | 105 | `OFS-000004-0005-cumbre-3-97ed48b2f54e78df` |
| FibraValle (ficticio) | dominio | relay.tvgol-gratis.test | 1 | vencida | 80,49 | 87,35 | 105 | 105 | `OFS-000004-0005-valle-1-97ed48b2f54e78df` |

## Aviso al titular

Aviso al titular de los derechos (Liga Profesional Ficticia) — Expediente EXP-2026-000004.
La señal con marca de agua LP26-FIN-LIC-SUR se está retransmitiendo sin autorización desde 1 servidor: relay.tvgol-gratis.test (IP 203.0.113.90).
Esa marca identifica de dónde sale la filtración. Se solicita ubicar la fuente asociada y cortarla: es la única medida que el operador no esquiva cambiando de servidor y que no puede afectar a terceros.
Nota: el simulador del desafío no modela este paso; el aviso se genera pero no tiene a quién enviarse.

## Registro de auditoría de este expediente

| Sec. | Minuto | Actor | Evento | Hash |
| --- | --- | --- | --- | --- |
| 16 | 52,58 | sistema | Se abrió EXP-2026-000004 por la marca LP26-FIN-LIC-SUR. | `4f692f1274a9c398…` |
| 17 | 52,58 | sistema | Se presentó al juez de turno la medida inicial M-0005: bloquear la IP 203.0.113.90. | `0a469057e70e9cc3…` |
| 21 | 52,58 | sistema | Nueva evidencia en EXP-2026-000004: detección D-0016. | `a45101d614d1cd1d…` |
| 27 | 52,58 | sistema | Nueva evidencia en EXP-2026-000004: detección D-0022. | `b64703c3af88320c…` |
| 33 | 60 | sistema | Nueva evidencia en EXP-2026-000004: detección D-0027. | `14d274e39b1f4844…` |
| 39 | 70,03 | sistema | Nueva evidencia en EXP-2026-000004: detección D-0032. | `f6858ef3b919a9dd…` |
| 89 | 79,99 | sistema | Nueva evidencia en EXP-2026-000004: detección D-0037. | `3b1c8a06b2604e2d…` |
| 90 | 80,46 | juez-martin-ejemplo | Dr. Martín Ejemplo aprobó la medida M-0005. | `3b4e791d3e27735e…` |
| 91 | 80,46 | juez-martin-ejemplo | Dr. Martín Ejemplo firmó la orden para Conectividad Aurora (ficticio): bloquear la IP 203.0.113.90. | `80a79a624ee46007…` |
| 92 | 80,46 | juez-martin-ejemplo | Dr. Martín Ejemplo firmó la orden para Red Andina Telecom (ficticio): bloquear la IP 203.0.113.90. | `edab9ca071a64029…` |
| 93 | 80,46 | juez-martin-ejemplo | Dr. Martín Ejemplo firmó la orden para FibraValle (ficticio): bloquear el dominio relay.tvgol-gratis.test. | `9d90b7be19386e91…` |
| 94 | 80,46 | juez-martin-ejemplo | Dr. Martín Ejemplo firmó la orden para Cooperativa Cumbre Conecta (ficticio): bloquear la IP 203.0.113.90. | `6dcfeee436d8cb8a…` |
| 95 | 80,48 | sistema | Orden enviada a Conectividad Aurora (ficticio): bloquear la IP 203.0.113.90. | `d16634999ec7522d…` |
| 96 | 80,48 | sistema | Orden enviada a Cooperativa Cumbre Conecta (ficticio): bloquear la IP 203.0.113.90. | `a6aec78a4798bf4b…` |
| 97 | 80,48 | sistema | Orden enviada a Red Andina Telecom (ficticio): bloquear la IP 203.0.113.90. | `9cb70cd6a09f575d…` |
| 98 | 80,49 | sistema | Orden enviada a FibraValle (ficticio): bloquear el dominio relay.tvgol-gratis.test. | `942ecdf8c72f0843…` |
| 100 | 80,98 | aurora | Conectividad Aurora (ficticio) aplicó el bloqueo de la IP 203.0.113.90. | `eb4a2318dedc6689…` |
| 130 | 83,07 | andina | Red Andina Telecom (ficticio) aplicó el bloqueo de la IP 203.0.113.90. | `66fbbea15ff4b64a…` |
| 132 | 83,69 | cumbre | Cooperativa Cumbre Conecta (ficticio) no pudo aplicar el bloqueo de la IP 203.0.113.90. | `8087e398458d55a0…` |
| 133 | 83,69 | juez-martin-ejemplo | Dr. Martín Ejemplo firmó la orden para Cooperativa Cumbre Conecta (ficticio): bloquear la IP 203.0.113.90 (intento 2). | `cf1f6a60e47ecb93…` |
| 134 | 83,69 | sistema | Reenvío a Cooperativa Cumbre Conecta (ficticio) con una orden nueva tras la falla. | `47f23dd391c1d9bd…` |
| 135 | 83,74 | sistema | Orden enviada a Cooperativa Cumbre Conecta (ficticio): bloquear la IP 203.0.113.90 (intento 2). | `c18c24871ff990ac…` |
| 143 | 85,92 | cumbre | Cooperativa Cumbre Conecta (ficticio) no pudo aplicar el bloqueo de la IP 203.0.113.90. | `a4c72deb2d98e542…` |
| 144 | 85,92 | juez-martin-ejemplo | Dr. Martín Ejemplo firmó la orden para Cooperativa Cumbre Conecta (ficticio): bloquear la IP 203.0.113.90 (intento 3). | `03e2fe2adb43db38…` |
| 145 | 85,92 | sistema | Reenvío a Cooperativa Cumbre Conecta (ficticio) con una orden nueva tras la falla. | `85afbde7ece6b693…` |
| 146 | 85,96 | sistema | Orden enviada a Cooperativa Cumbre Conecta (ficticio): bloquear la IP 203.0.113.90 (intento 3). | `624c8aad7d119012…` |
| 147 | 87,35 | valle | FibraValle (ficticio) aplicó el bloqueo del dominio relay.tvgol-gratis.test. | `d8347ab4fd8c5d81…` |
| 149 | 88,72 | cumbre | Cooperativa Cumbre Conecta (ficticio) aplicó el bloqueo de la IP 203.0.113.90. | `315bb68f58d18af9…` |
| 162 | 90,01 | sistema | Nueva evidencia en EXP-2026-000004: detección D-0043. | `91c1c23eb355214d…` |
| 171 | 100 | sistema | Nueva evidencia en EXP-2026-000004: detección D-0048. | `c789b44535273c0b…` |
| 189 | 105 | aurora | Venció el bloqueo de la IP 203.0.113.90 en Conectividad Aurora (ficticio). | `abcb76d15ed4a80c…` |
| 190 | 105 | andina | Venció el bloqueo de la IP 203.0.113.90 en Red Andina Telecom (ficticio). | `93420935026f720d…` |
| 191 | 105 | valle | Venció el bloqueo del dominio relay.tvgol-gratis.test en FibraValle (ficticio). | `a586ecf8e6533aea…` |
| 201 | 105 | cumbre | Venció el bloqueo de la IP 203.0.113.90 en Cooperativa Cumbre Conecta (ficticio). | `6ef5057c0b7c526b…` |

La integridad de este expediente se comprueba con `python3 herramientas/verificar_expediente.py <carpeta> --juzgados <claves> --registro <registro del simulador>`. Sin el registro del simulador, el verificador solo prueba que la carpeta es coherente consigo misma.
