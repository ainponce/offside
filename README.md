# Offside

Plataforma federal de órdenes de bloqueo en vivo contra transmisiones ilegales.
Hackathon Argentina Space 2026 · track QualyData Streaming · [Desafío Fútbol](https://github.com/qualydata-org/desafio-futbol).

> Todo corre contra el simulador oficial del desafío. No se bloquea nada real: proveedores, juzgados, jueces, dominios e IPs son ficticios.

## La idea: perseguir la filtración, no el servidor

Un partido dura dos horas y un sitio pirata cambia de servidor en minutos. Los modelos actuales bloquean direcciones, y el pirata cambia de dirección.

Lo que no cambia es la **marca de agua** de la señal: en los datos del desafío, cada operación pirata conserva la misma marca cuando salta de servidor. Offside abre **un expediente por filtración**, identificada por esa marca. El juez de turno lo aprueba una vez con toda la evidencia; cada servidor nuevo le llega como **ampliación** de algo que ya vio y la firma con un toque.

Tres consecuencias:

- **El juez firma cada medida y no frena.** Con medio minuto de partido para decidir, el primer proveedor confirma el bloqueo alrededor de un minuto después de la detección (ver [Resultados medidos](#resultados-medidos)).
- **Ningún sitio ajeno cae.** Solo se bloquea una IP cuando es exclusiva del operador; si es compartida, se bloquea el dominio. El tablero muestra con nombre los sitios legítimos que habrían caído con un bloqueo automático por IP.
- **La firma cubre la prueba.** La huella de lo que vio el juez viaja dentro del identificador de la orden, que es parte de lo que se firma. Cambiar un byte de la evidencia después rompe la verificación.

Además, cada expediente genera un aviso al titular para cortar la fuente que identifica la marca: la única medida que el operador no esquiva cambiando de servidor. El simulador no modela ese paso, así que el aviso se genera pero no se envía.

## El circuito

1. **Ingesta.** Offside consulta las detecciones del simulador y descarta sola las que no son piratas: licenciatario en su dominio, señal de otro partido, stream sin marca.
2. **Expediente.** Abre o amplía el expediente de esa filtración y congela lo que verá el juez (la *instantánea*); su SHA-256 es la *huella*.
3. **Juez.** El juez de turno ve una tarjeta con cuatro verificaciones y firma o rechaza. Entra con su usuario; fuera de turno, solo lectura. Al cambiar el turno, lo pendiente pasa al entrante.
4. **Despacho.** Sale una orden por proveedor, en el tipo de bloqueo que cada uno admite. Si un proveedor falla, se reintenta; si para entonces cambió el turno, el reenvío espera la ratificación del juez entrante.
5. **Vencimiento.** Todas las órdenes vencen con el final del partido.
6. **Auditoría.** Cada paso queda en un registro encadenado por hashes.
7. **Reclamos.** Si un sitio legítimo reclama, se verifica contra las órdenes vigentes y el juez de turno levanta la orden en todos los proveedores y la reemplaza por una más precisa.

## Cómo correrlo

Requisitos: Node 22.13 o superior (desarrollado en Node 24), pnpm y Python 3.9 o superior.

```bash
pnpm install
```

El material oficial del desafío no está copiado en este repositorio. Este script lo clona en `.simulador/`, que git ignora:

```bash
bash scripts/traer-simulador.sh
```

```bash
pnpm build
```

Un partido de práctica completo, con el simulador en el puerto 8080 y Offside en el 3000:

```bash
pnpm demo
```

Abrí `http://localhost:3000`. Los usuarios de demostración (dos jueces y la fiscalía) están en [config/jueces.demo.json](config/jueces.demo.json).

Contra un simulador que ya está corriendo en otra dirección, como en el partido final:

```bash
SIMULADOR_URL=http://DIRECCION:PUERTO pnpm start -- --nuevo
```

`--nuevo` archiva la base anterior y empieza un partido limpio. Sin esa opción, Offside retoma el partido donde estaba.

| Variable | Para qué | Por defecto |
|---|---|---|
| `SIMULADOR_URL` | Dirección del simulador | `http://localhost:8080` |
| `PUERTO` | Puerto de Offside (escucha en todas las interfaces) | `3000` |
| `OFFSIDE_DB` | Base local | `datos/offside.db` |
| `OFFSIDE_JUECES` | Jueces, claves de firma y usuarios de demostración | `config/jueces.demo.json` |
| `OFFSIDE_INTERVALO_MS` | Cada cuánto se consulta al simulador | `300` |
| `OFFSIDE_SIMULACRO=1` | Fuerza un bloqueo equivocado para mostrar los reclamos | apagado |

Opciones de `pnpm demo`: `-- --acelerar 2`, `-- --inicio-min 40` (el turno cambia en el minuto 50) y `-- --simulacro`.

## Pantallas

| Ruta | Para quién | Qué muestra |
|---|---|---|
| `/juez` | Juez (pensada para el celular) | La cola de medidas, cada una con cuatro verificaciones, el plan por proveedor y dos acciones: firmar o rechazar |
| `/tablero` | Fiscalía | El partido en vivo: expedientes, saltos de servidor, estado por proveedor, daño evitado y auditoría |
| `/expediente/:id` | Juez y fiscalía | El expediente completo, imprimible |
| `/transparencia` | Público | Qué está bloqueado, por orden de quién y hasta cuándo |

## Reglas de decisión

Son funciones puras y deterministas ([src/server/reglas.ts](src/server/reglas.ts)). No hay un modelo de IA decidiendo.

| Situación | Qué hace Offside |
|---|---|
| Sin marca de agua, o marca de otro partido | Archiva; no llega al juez |
| Marca de un licenciatario en un dominio suyo | Archiva |
| Marca de un licenciatario en un dominio ajeno | Pirata: es una retransmisión de su señal |
| Marca oficial en un dominio de licenciatario | Anomalía: no se bloquea, se avisa en el tablero |
| IP donde todos los dominios son del mismo operador y la organización no parece compartida | Propone bloqueo por IP |
| IP con algún sitio ajeno, organización tipo CDN o compartida, o datos que no coinciden con el DNS pasivo | Propone bloqueo por dominio |
| Proveedor que solo admite dominio y se propone IP | Le envía el dominio |
| Proveedor que solo admite IP y se propone dominio | No le envía nada: queda sin cobertura, por seguridad |
| Justo antes de cada envío | Vuelve a comprobar que el juez está de turno y que el objetivo no alcanza a terceros |

En el partido de práctica estas reglas dan el mismo tipo de bloqueo que la respuesta oficial en las siete fases piratas y clasifican bien las 43 detecciones.

## Evidencia e integridad

- De cada detección se guarda el texto recibido con su SHA-256 y el SHA-256 de los bytes de la captura.
- `orden_id = OFS-<expediente>-<medida>-<proveedor>-<intento>-<16 caracteres de la huella>`. El simulador firma `orden_id|tipo|objetivo|vence_min|juez_id`, así que la firma del juez queda atada a la instantánea. El identificador queda también en el registro del simulador, que Offside no controla.
- El registro de auditoría es de solo agregado; cada entrada lleva el hash de la anterior.
- En los levantamientos el simulador firma solo `LEVANTAR|orden_id|juez_id`; ahí la huella viaja en el motivo, que el simulador guarda sin firmar.

[herramientas/verificar_expediente.py](herramientas/verificar_expediente.py) es un verificador independiente: un archivo en Python sin dependencias que no comparte código con la plataforma. Recalcula la cadena de auditoría, los hashes, las huellas y las firmas, y puede cruzar las órdenes con el registro del simulador.

```bash
pnpm exportar -- --carpeta entrega/final
```

```bash
python3 herramientas/verificar_expediente.py entrega/final --juzgados config/jueces.demo.json --registro salida/registro.jsonl
```

Si se cambia un carácter de un expediente o de la auditoría, el verificador termina con error y dice dónde.

## Pruebas y ensayos

```bash
pnpm test
```

Pruebas unitarias de reglas, evidencia, auditoría, motor, API, exportación y reclamos, con un simulador en memoria.

```bash
pnpm ensayo
```

Corre un partido entero contra el simulador oficial con un juez de ensayo que entra por el mismo ingreso que un juez real, y lo evalúa con `evaluacion/verificar.py`. Falla si hay daño colateral, falsos positivos, órdenes fuera de turno, bloqueos por IP después del partido o alguna fase pirata sin bloquear. El juez de ensayo existe solo para ensayar: en el partido final firma una persona.

Para probar con partidos que nadie vio, [herramientas/generar_escenario.py](herramientas/generar_escenario.py) genera escenarios con otros sitios, IPs, tiempos, jueces y turnos, y agrega casos que la práctica no trae (retransmisión de la señal de un licenciatario, un imitador en la IP del licenciatario, un stream sin marca, un proveedor que solo bloquea por IP):

```bash
python3 herramientas/generar_escenario.py --semilla 7 --salida salida/escenario-7
```

```bash
pnpm ensayo -- --carpeta salida/escenario-7
```

### Resultados medidos

<!-- RESULTADOS -->

## Estructura

| Ruta | Contenido |
|---|---|
| `src/server/reglas.ts` | Reglas de decisión |
| `src/server/motor.ts` | Ciclo que consulta al simulador y mantiene expedientes, medidas y órdenes |
| `src/server/decisiones.ts`, `despacho.ts` | Firma del juez, guardia final y envío a proveedores |
| `src/server/reclamos.ts` | Reclamos y levantamientos |
| `src/server/evidencia.ts`, `auditoria.ts`, `exportar.ts` | Hashes, registro encadenado y exportación |
| `src/server/api.ts`, `vistas.ts`, `sesiones.ts` | API, textos que lee el juez e ingreso |
| `src/compartido/tipos.ts` | Contrato entre el servidor y la interfaz |
| `src/web/` | Interfaz (React) |
| `herramientas/` | Verificador independiente y generador de escenarios |
| `scripts/` | Ensayo, demostración y exportación |
| `pruebas/` | Pruebas unitarias |
| `entrega/` | Exportaciones y [propuesta normativa](entrega/propuesta-normativa.md) |
| `docs/` | Diseño, plan, pitch, guion del video y guía del partido final |

## Supuestos

- La marca de agua extraída que trae cada detección se toma como dada; Offside no la extrae del video.
- El DNS pasivo del simulador es la única fuente sobre qué dominios comparten una IP.
- La firma es la de demostración del simulador (HMAC con una clave por juez). En la vida real sería la firma digital del juez.
- La fiscalía no interviene a mano: el expediente se arma y se presenta al juez en automático, con reglas fijadas de antemano.
- Todo bloqueo vence con el final del partido, también los de dominio. Un bloqueo permanente requeriría otra decisión.
- Un subdominio de un dominio autorizado del licenciatario se considera autorizado.
- Los reintentos por falla de un proveedor no piden una firma nueva mientras el juez que aprobó sigue de turno; después de un cambio de turno, sí.
- La detección cruda se guarda como texto JSON compacto del objeto recibido; no es byte a byte la respuesta HTTP del simulador.
- El aviso al titular y el canal para proveedores chicos no se pueden probar contra el simulador.

## Qué existía antes del evento

Nada del código de este repositorio. Todo se escribió durante el hackathon, con asistencia de Claude Code.

Librerías y herramientas públicas: Node.js (incluido su SQLite), TypeScript, tsx, Hono, React, React Router, Vite, Tailwind CSS y Python. El simulador, el verificador y los datos son de la organización y se clonan aparte.

`config/jueces.demo.json` reproduce los jueces, juzgados y claves de firma de demostración que publica la organización en `datos/juzgados.json`, y agrega usuarios y contraseñas de demostración. No hay claves reales ni datos personales.

## Licencia

[MIT](LICENSE).
