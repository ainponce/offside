# Offside — diseño de la plataforma

- Fecha: 2026-11-11
- Evento: Hackathon Argentina Space 2026, track QualyData Streaming ("Desafío Fútbol")
- Material oficial: https://github.com/qualydata-org/desafio-futbol (simulador, verificador, datos, reglas). Es la fuente de verdad de la API; este documento no la repite.
- Estado: aprobado para construir (Ain pidió avanzar con todo el 2026-11-11); revisado por un lector independiente

## 1. Qué es y por qué

Offside es el MVP de una plataforma federal de órdenes de bloqueo en vivo contra transmisiones ilegales. Corre el circuito completo del desafío contra el simulador oficial: detección, expediente con evidencia verificable, juez de turno, orden a cada proveedor, confirmación y vencimiento al terminar el partido.

**La idea que la distingue: perseguir la filtración, no el servidor.** La marca de agua extraída de cada stream se mantiene igual cuando el sitio pirata cambia de servidor (comprobado en las 43 detecciones del escenario de práctica). Offside abre un expediente por filtración, identificada por el código de marca, y cada servidor nuevo es una ampliación de ese expediente que el juez firma con un toque. No afirmamos qué identifica el sufijo de la marca; lo tratamos como la huella de la filtración.

El objetivo es ganar el primer puesto del track. Ain decidió que se gana con una idea innovadora, un buen pitch y una buena demo; el circuito completo funcionando es la condición de entrada (el desafío dice que los extras no compensan un núcleo que no corre).

Lo construye una sola persona con Claude Code entre el miércoles 11 a la noche y el viernes 13 a la mañana.

## 2. Cómo responde a la rúbrica

| Criterio | Peso | Respuesta de Offside |
|---|---|---|
| Circuito completo | 25 | Núcleo de punta a punta, ensayado en automático contra el simulador hasta que el verificador oficial salga limpio. |
| Validez e integridad de la evidencia | 25 | La firma del juez queda atada a la evidencia; registro encadenado por hashes; verificador independiente que detecta cualquier alteración. |
| Control de daño colateral | 20 | Regla conservadora entre IP y dominio, guardia final antes de cada envío, reclamos. |
| Velocidad | 15 | Pantalla de juez pensada para decidir en menos de 10 segundos; ampliaciones de un toque. |
| Claridad y propuesta normativa | 15 | Tarjeta del juez con cuatro verificaciones en lenguaje llano; propuesta normativa de una página. |

## 3. Objetivos, no objetivos y anti-objetivos

**Objetivos**

1. Correr el circuito completo durante el partido final, con una persona real firmando como juez.
2. Salida del verificador oficial sin daño colateral, sin falsos positivos, sin órdenes fuera de turno, sin bloqueos por IP después del partido y con todas las fases piratas bloqueadas.
3. Tres momentos de demo: el juez firma desde el celular y los proveedores confirman; un salto de servidor se resuelve con un toque; se altera un byte del expediente y el verificador lo detecta.
4. Entregables del día 3 completos (sección 13).

**No objetivos**

- Firma biométrica, anclaje en blockchain, app nativa, varios partidos a la vez, varios idiomas.
- Integración real con equipos de proveedores. El canal estándar para proveedores chicos va solo en la propuesta normativa.
- IA en el camino de decisión. Las reglas son deterministas y auditables.
- Bloqueo preventivo de servidores sin detección: sin evidencia no hay medida.

**Anti-objetivos** (hacen fracasar el proyecto aunque funcione)

- Una orden enviada sin la aprobación de un juez con sesión iniciada y de turno.
- Un bloqueo que alcance a un sitio legítimo o al licenciatario.
- Un bloqueo por IP vivo después del final del partido.
- Depender de un servicio externo que pueda fallar en la sede.
- Tocar cualquier sistema que no sea el simulador.

## 4. Restricciones

- Reglas del desafío: trabajo original hecho en el evento, repositorio público, sin claves reales (las claves de firma del simulador y los usuarios de demostración de jueces sí pueden estar), nada ofensivo.
- En el partido final la organización corre una instancia del simulador por equipo, posiblemente acelerada, y Offside se conecta a la dirección asignada. La URL del simulador es configuración.
- El código de la organización no se copia al repositorio. Para ensayar se clona aparte.
- Máquina de desarrollo: macOS, Node 24, pnpm 10, Python 3.9.6, git, gh. Sin túneles instalados.
- Cierre en Hacki: viernes 13 a las 10:00 según la página (sin confirmar).

## 5. Conceptos

- **Detección:** un ítem del feed del simulador.
- **Expediente:** una filtración. Agrupa todas las detecciones con el mismo código de marca. Identificador `EXP-2026-NNNNNN`.
- **Servidor:** par (host del stream, IP) dentro de un expediente.
- **Medida:** unidad de decisión judicial, una por servidor. Clases: `inicial` (primer servidor de un expediente sin medidas aprobadas), `ampliacion` (servidor nuevo de un expediente ya aprobado), `ratificacion` (reenvío que necesita la firma del juez entrante) y `levantamiento` (reclamo).
- **Orden:** lo que se envía a un proveedor. Una medida aprobada genera una orden por proveedor.
- **Instantánea y huella:** el contenido exacto que vio el juez al decidir, congelado como texto, y su SHA-256.

## 6. Circuito

1. **Ingesta.** Sondeo de detecciones, estado, órdenes pendientes y reclamos cada 500 ms reales o menos. Todo el tiempo de negocio se mide en minutos de partido según el simulador.
2. **Análisis** de cada detección con las reglas de la sección 7. Las que no son piratas se archivan solas con su motivo y se ven en el tablero; no llegan al juez.
3. **Expediente.** Se crea o se amplía, se congela la instantánea de la medida y se calcula la huella.
4. **Juez.** La medida aparece en la cola del juez de turno con aviso sonoro. Aprueba o rechaza.
5. **Despacho.** Al aprobar, se firma y envía una orden por proveedor en el tipo que cada uno admite. Se sigue el estado hasta `aplicada`; si queda `fallida`, se reintenta con un `orden_id` nuevo.
6. **Vencimiento.** Las órdenes vencen solas al final del partido; Offside lo comprueba, lo registra y alerta si algo sigue activo.
7. **Auditoría** de cada paso, encadenada por hashes.

## 7. Reglas de decisión

**7.1 Veredicto de la detección**, en este orden:

1. Sin marca, o marca que no empieza con ningún prefijo de `marcas_de_agua_validas`: `no_es_la_senal`. Se archiva.
2. Se toma el prefijo válido más largo que coincide. Si es de un licenciatario y el host del stream es un dominio autorizado de ese licenciatario (igual o subdominio): `licenciatario_autorizado`. Se archiva.
3. Prefijo de licenciatario en un host que no es suyo: `pirata` (retransmisión de la señal del licenciatario).
4. Prefijo de la señal oficial: `pirata`.
5. Salvaguarda: si el host es un dominio autorizado de cualquier licenciatario, nunca es `pirata`. Se marca `anomalia`, se archiva y se avisa en el tablero.

**7.2 Clave del expediente.** Si la marca tiene sufijo propio después del prefijo, la clave es la marca completa. Si la marca es exactamente un prefijo, la clave es la marca más el dominio registrable del host.

**7.3 Servidor.** Se contrasta con el DNS pasivo en los dos sentidos (la IP lista el host, el host lista la IP, el ASN coincide). Una discrepancia o la falta de datos no frena la medida: se muestra al juez como advertencia y fuerza la recomendación por dominio.

**7.4 Riesgo colateral y tipo de bloqueo.**

- Co-inquilinos: los dominios que el DNS pasivo ve en esa IP, sin contar el host.
- "Del mismo operador": comparte dominio registrable con el host.
- Se recomienda `ip` solo si se cumplen todas: hay respuesta del DNS pasivo; todos los co-inquilinos son del mismo operador; ninguno es dominio de un licenciatario; y el nombre de la organización del ASN no sugiere infraestructura compartida (lista configurable de términos como cdn, compartido, shared, cloud).
- En cualquier otro caso se recomienda `dominio`, con el host del stream como objetivo.
- Los terceros que habrían quedado afectados se guardan con nombre. Los ve el juez y alimentan el contador de daño evitado.

Con estas reglas el escenario de práctica da exactamente el `bloqueo_recomendado` de la verdad oficial en las siete fases piratas.

**7.5 Por proveedor.** Si admite el tipo recomendado, se usa ese. Si se recomienda `ip` y solo admite `dominio`, se envía por dominio. Si se recomienda `dominio` y solo admite `ip`, no se envía y queda registrado "sin cobertura por seguridad".

**7.6 Vencimiento.** Toda orden lleva `vence_min` igual al `fin_min` del partido, también las de dominio. No se envían órdenes cuando el partido terminó.

**7.7 Guardia final.** Justo antes de cada envío el despachador vuelve a comprobar: que el juez firmante está de turno ahora según el simulador; que el objetivo no es un dominio de licenciatario; y, si es una IP, que sus co-inquilinos siguen siendo todos del mismo operador. Si algo falla no envía, y lo registra.

**7.8 Detecciones repetidas.** Mismo servidor ya presente en el expediente: se agrega como evidencia y no genera tarjeta nueva. Servidor nuevo: medida nueva.

## 8. Juez: ingreso, turno y firma

- **Usuarios de demostración:** uno por juez del archivo de juzgados, con usuario y contraseña en un archivo de semilla del repositorio. Las contraseñas se guardan con hash. Las claves de firma viven solo en el servidor.
- **Sesión por pestaña**, no por navegador, para poder tener a los dos jueces abiertos a la vez durante el partido final.
- **Cola:** las medidas pendientes las ve y las firma quien esté de turno según el simulador. Fuera de turno, la pantalla queda en solo lectura con un cartel.
- **Traspaso:** cuando cambia el juez de turno, lo pendiente pasa al entrante sin intervención y el traspaso queda en la auditoría con la lista de medidas.
- **Decisión:** aprobar o rechazar, con motivo opcional de una lista corta. Aprobar hace que el servidor firme una orden por proveedor con la clave de ese juez.
- **Reintentos:** la aprobación cubre los reenvíos por falla de un proveedor mientras ese juez siga de turno. Si la falla aparece con otro juez de turno, se crea una medida `ratificacion` para el entrante, que la firma con un toque. Motivo: el simulador evalúa el turno en el momento en que el proveedor recibe la orden.
- **Reconsiderar:** el juez de turno puede reabrir una medida rechazada desde el historial. Protege contra un toque equivocado en el partido final.

## 9. Evidencia e integridad

- **Al recibir una detección** se guarda el JSON tal como llegó (como texto) con su SHA-256, los bytes de la captura decodificados con su SHA-256, un control informativo de formato (en MPEG-TS el primer byte es 0x47) y tres sellos de tiempo: minuto de partido, hora del partido según el simulador y hora local.
- **Instantánea:** al crear cada medida se congela, como texto, todo lo que verá el juez. La huella es el SHA-256 de ese texto.
- **La firma cubre la prueba:** `orden_id = OFS-<expediente>-<medida>-<proveedor>-<intento>-<16 primeros caracteres de la huella>`. El simulador incluye `orden_id` en el texto que firma el juez, así que la firma queda atada a la instantánea, y el identificador queda también en el registro del simulador, que no controlamos.
- **Límite en los levantamientos:** el simulador firma `LEVANTAR|orden_id|juez_id`, así que ahí la firma no cubre la huella ni el simulador evalúa el turno. Offside exige igual que firme el juez de turno, guarda la huella en la auditoría y la envía dentro del `motivo`, que el simulador sí deja en su registro.
- **Auditoría:** tabla de solo agregado. Cada entrada tiene número de secuencia, hora local, minuto de partido, actor, tipo, contenido (texto JSON), hash anterior y hash propio calculado sobre el hash anterior, la secuencia y el contenido. Se exporta como JSONL.
- **Verificador independiente:** `herramientas/verificar_expediente.py`, un solo archivo en Python 3.9 sin dependencias, igual que las herramientas oficiales. Recibe una carpeta de exportación y, opcionalmente, el registro del simulador. Comprueba la cadena de auditoría, los hashes de las capturas, las huellas, que cada orden lleve la huella de su instantánea, las firmas y, si recibe el registro del simulador, que cada orden recibida por un proveedor figure en el expediente y haya sido firmada por un juez de turno. Si algo no coincide termina con error y dice qué. Trabaja sobre los textos exportados, sin volver a serializar JSON.

## 10. Pantallas

Web, en español, adaptable a celular.

1. **Juez (celular primero; la más importante).** Cola de tarjetas. Cada tarjeta muestra: clase de medida y expediente; cuatro verificaciones con luz verde, ámbar o roja (es la señal oficial del partido; no es un licenciatario en su dominio; servidor identificado; riesgo colateral y medida propuesta); el plan por proveedor; vencimiento; huella abreviada; dónde se promocionó el enlace. En una ampliación se destaca qué cambió respecto de lo ya aprobado. Dos acciones: "Firmar y ordenar" y "Rechazar". Aviso sonoro al llegar una medida. En escritorio, atajo de teclado para firmar.
2. **Tablero en vivo (escritorio, para la demo).** Reloj del partido y juez de turno; línea de tiempo de expedientes; matriz de proveedores por medida con su estado; tiempo de detección a primer bloqueo; cobertura de clientes; detecciones archivadas con su motivo; contador de daño evitado (sitios legítimos que habrían caído con bloqueo automático por IP, con nombre); hash de cabecera de la auditoría.
3. **Expediente.** Detalle completo, legible para un juez, con exportación.
4. **Transparencia pública (extra).** Sin ingreso: qué se bloqueó, cuándo, por orden de quién, hasta cuándo y con qué huella.
5. **Ingreso.**

## 11. Extras, en orden de prioridad

1. **Reclamos.** Se verifica que el dominio reclamado esté detrás de una orden activa nuestra en ese proveedor (el reclamo no trae el `orden_id`). Si es así se crea una medida `levantamiento` que propone levantar esa orden en todos los proveedores donde aplica y reemplazarla por un bloqueo por dominio del host pirata. La firma el juez de turno. En una corrida correcta no hay reclamos, así que hace falta un modo de simulacro, activable solo por línea de comandos, que fuerce un bloqueo equivocado para poder mostrarlo en el video.
2. **Transparencia pública.**
3. **Aviso al titular.** Documento dentro del expediente que le pide al titular cortar la fuente asociada a esa marca. El simulador no lo modela; se muestra como generado y se aclara.

## 12. Operación

- Un proceso y un comando para levantar todo. Configuración por variables de entorno: URL del simulador, puerto, ruta del archivo de juzgados.
- Estado en una base embebida. Si el proceso se reinicia retoma donde estaba y vuelve a sincronizar las órdenes con los proveedores.
- Sin servicios externos en tiempo de ejecución.
- **Ensayo automático:** un comando que levanta el simulador (clonado fuera del repositorio) con aceleración alta, levanta Offside y un "juez de ensayo" que entra por el mismo ingreso que un juez real y aprueba tras una demora configurable. El ensayo deja correr el simulador hasta el final del partido más los cinco minutos de gracia, porque antes el verificador no evalúa los bloqueos por IP posteriores al partido. Al terminar corre el verificador oficial y falla si no se cumplen los objetivos de la sección 3. Objetivo inicial de visibilidad residual promedio: 6 % o menos con medio minuto de partido de demora del juez; se ajusta con la primera medición. El juez de ensayo vive con las pruebas y no se usa en el partido final.
- **Escenarios propios:** un generador produce una carpeta completa (escenario, verdad, juzgados con claves de demostración y proveedores, porque el simulador lee los dos últimos de la carpeta de datos) con otros nombres, IPs, tiempos y turnos, y agrega casos que la práctica no trae: retransmisión pirata de la señal de un licenciatario, detección sin marca y un proveedor que solo admite IP.
- **Red en el partido final:** el servidor escucha en todas las interfaces, así que un celular en la misma red entra por la IP de la laptop. El plan principal para el partido final es firmar desde dos pestañas de la laptop (una por juez), que no depende de la red de la sede. El celular se usa para el video y para el pitch si la red lo permite. No se requieren túneles.

## 13. Entregables del día 3

1. Repositorio público con licencia MIT y README: cómo correrlo, supuestos (sección 16) y qué existía antes del evento.
2. `entrega/`: un expediente y el registro de auditoría exportados del partido final, y la propuesta normativa de una página.
3. Video de hasta 3 minutos.
4. Proyecto cargado en Hacki.
5. Pitch.

La propuesta normativa, el video y el pitch se trabajan aparte de este diseño. La propuesta va a pedir, como mínimo: orden marco previa al partido, registro federal de proveedores con canal estándar, regla de proporcionalidad entre IP y dominio, vencimiento automático, plazo y trámite de reclamos, transparencia, y el corte en la fuente.

## 14. Niveles de alcance

No se empieza un nivel hasta que el ensayo automático del anterior pase.

1. **Núcleo:** secciones 6, 7 y 8 con el modelo de datos definitivo desde el principio (expediente por marca, medidas con sus clases, instantánea, huella y formato de `orden_id`), auditoría encadenada, exportación y ensayo automático. La interfaz del núcleo puede ser mínima.
2. **Diferenciales:** lo que se construye encima sin tocar el modelo: verificador independiente con la demo de alteración, tablero en vivo con daño evitado, pantalla del juez cuidada para celular con el resaltado de qué cambió en una ampliación.
3. **Extras:** sección 11 y escenarios propios.

`entrega/` lleva desde el jueves una exportación de un partido de práctica, rotulada como tal. Se reemplaza por la del partido final si ese partido termina antes del cierre del repositorio.

Orden tentativo: núcleo el miércoles a la noche; diferenciales y ensayos manuales el jueves a la mañana; extras, README y propuesta normativa el jueves a la tarde; video el jueves a la noche; partido final, exportación y entrega el viernes a la mañana.

## 15. Quién decidió qué

**Decidido por Ain**

- Track Streaming; nombre Offside.
- Idea central: perseguir la filtración, no el servidor.
- El juez firma siempre, también en cada salto de servidor, con un toque. La orden marco queda para la propuesta normativa.
- La marca se trata como huella de la filtración, sin afirmar que identifica a un abonado.
- Trabaja solo, con Claude Code; el stack le es indiferente.

**Decidido por Claude** (para revisar)

- Stack: TypeScript sobre Node 24 en un solo proceso (servidor web y motor juntos), base SQLite embebida, interfaz en React con actualizaciones en vivo desde el servidor. Python solo para el verificador y para correr el simulador.
- La fiscalía no hace clic: el expediente se arma y se presenta al juez en automático.
- Las detecciones que no son piratas no llegan al juez.
- Todo vence con el final del partido, también los bloqueos por dominio.
- Bloqueo por IP solo con las cuatro condiciones de 7.4; ante la duda, dominio.
- Un subdominio de un dominio autorizado del licenciatario cuenta como autorizado.
- Los reintentos dentro del mismo turno no piden una firma nueva; después de un cambio de turno, sí.
- Verificador independiente en Python, separado de la plataforma.
- El contador se llama "daño evitado" en pantalla; "modo Italia" queda para el pitch.
- En el partido final se firma desde dos pestañas de la laptop; el celular queda para el video y el pitch.
- El modelo de datos definitivo se construye de entrada, no en una segunda vuelta.
- Se mantiene el bloqueo por IP cuando la IP es exclusiva del operador, aunque el verificador cuente igual un bloqueo por dominio: muestra criterio ante el jurado y cubre los dominios de respaldo del mismo servidor.

**A criterio de quien construya**

- Estructura de carpetas, librerías concretas, esquema de tablas, formato del export legible y textos de la interfaz.
- Diseño visual, con esta dirección: sobrio e institucional, alto contraste, botones grandes para el pulgar, y verde, ámbar y rojo reservados a las verificaciones.
- Cómo calcular el dominio registrable (alcanza con cubrir `.test`, `.example` y los sufijos de dos niveles más comunes).

## 16. Supuestos para declarar en el README

- La marca de agua extraída que entrega el feed se toma como dada; Offside no la extrae del video.
- El DNS pasivo del simulador es la única fuente sobre qué dominios comparten una IP.
- La firma es la de demostración del simulador (HMAC); en la vida real sería la firma digital del juez.
- El aviso al titular y el canal para proveedores chicos no se pueden probar contra el simulador.
