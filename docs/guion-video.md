# Guion del video (hasta 3 minutos)

El desafío pide un video que muestre el circuito completo (carga, juez, proveedores, confirmación, vencimiento) y, si se implementaron reclamos, uno resuelto. Puede grabarse sobre un partido de práctica y terminar con la salida del verificador oficial.

Se graba en tres tomas cortas y se unen. Grabá la pantalla de la laptop con el tablero a la izquierda y la vista del juez angosta (como celular) a la derecha; si podés, filmá además el celular real en la toma 1.

## Antes de grabar

```bash
pnpm build
```

Usuarios de demostración: `config/jueces.demo.json`. Cerrá notificaciones y agrandá la letra de la terminal.

## Toma 1 · El circuito y el salto de servidor (unos 75 s)

```bash
pnpm demo -- --inicio-min 35
```

Arranca en el minuto 35. A x6, un minuto de partido son diez segundos reales: el pirata salta de servidor a los 25 segundos y el turno cambia a los dos minutos y medio.

| Tiempo | En pantalla | Voz |
|---|---|---|
| 0:00 | Título: "Offside · bloqueo en vivo con juez, sin daño colateral" | "Un partido dura dos horas. Un sitio pirata cambia de servidor en minutos." |
| 0:07 | Tablero: llegan las detecciones; algunas van a "Descartadas" | "Offside lee las detecciones del simulador. Las que no son piratas se descartan solas: el licenciatario en su dominio, un resumen de otro partido." |
| 0:17 | Vista del juez: una tarjeta con las cuatro verificaciones | "Por cada filtración arma un expediente. La jueza de turno ve cuatro verificaciones: es la señal oficial, no es un licenciatario, este es el servidor, y qué más hay en esa IP." |
| 0:30 | Toca "Firmar y ordenar". En el tablero, las celdas de proveedores pasan a verde una por una | "Firma. La orden sale a cada proveedor en el tipo de bloqueo que admite. Cada uno confirma; el que falla se reintenta solo." |
| 0:45 | Llega la tarjeta "Ampliación" | "El pirata se mudó de servidor. La marca de agua es la misma: es el mismo expediente. Un toque." |
| 0:55 | Tablero: el expediente con sus dos servidores | "Perseguimos la filtración, no el servidor." |
| 1:02 | Otra tarjeta, por dominio, con la lista de sitios ajenos; después "Daño evitado" en el tablero | "Este otro está en una IP compartida. Bloquear la IP tiraba la panadería y la escuela. Offside bloquea solo el dominio." |
| 1:12 | La pestaña de la jueza queda "Fuera de turno"; la del juez entrante, "De turno" | "Minuto 50: cambia el turno. Lo pendiente pasa al juez entrante, y el saliente ya no puede firmar." |

## Toma 2 · Un reclamo resuelto (unos 35 s)

```bash
pnpm demo -- --simulacro
```

El simulacro fuerza, una sola vez, un bloqueo por IP sobre una IP compartida. La tarjeta lo rotula en rojo. Firmala igual: es el error a propósito. A los 40 o 50 segundos llega el reclamo.

| Tiempo | En pantalla | Voz |
|---|---|---|
| 1:20 | Tarjeta con la verificación en rojo "Simulacro" | "¿Y si algo sale mal? Forzamos un error: un bloqueo por IP sobre una IP compartida." |
| 1:28 | Tarjeta "Reclamo" de un sitio legítimo | "Un sitio legítimo reclama. Offside verifica que está detrás de esa orden y le propone al juez levantarla." |
| 1:40 | Firma. En el tablero la IP se levanta y aparece el bloqueo por dominio | "Un toque: se levanta en todos los proveedores y se reemplaza por el dominio. El pirata sigue bloqueado; el sitio legítimo, no." |

## Toma 3 · Vencimiento, verificador y evidencia (unos 60 s)

```bash
pnpm demo -- --inicio-min 99
```

Firmá lo pendiente enseguida. En un minuto termina el partido. Cuando el tablero marque el partido finalizado y pasen los cinco minutos de gracia (50 segundos más), corré en otra terminal:

```bash
python3 .simulador/desafio-futbol/evaluacion/verificar.py --log salida/registro.jsonl
```

```bash
pnpm exportar -- --carpeta salida/video
```

```bash
python3 herramientas/verificar_expediente.py salida/video --juzgados config/jueces.demo.json --registro salida/registro.jsonl
```

| Tiempo | En pantalla | Voz |
|---|---|---|
| 1:55 | Tablero: minuto 105, las órdenes pasan a "vencida" | "Pitazo final. Todos los bloqueos vencen solos." |
| 2:03 | Terminal: salida del verificador oficial | "El verificador oficial: fases piratas bloqueadas, daño colateral cero, falsos positivos cero, órdenes fuera de turno cero." |
| 2:18 | Expediente en pantalla; se resalta la huella y el identificador de una orden | "La huella de lo que vio el juez viaja dentro de cada orden, y la orden está firmada. La firma cubre la prueba." |
| 2:30 | Terminal: verificador independiente, "VERIFICACIÓN CORRECTA" y la línea "anclada hasta la secuencia" | "Un verificador independiente recalcula todo y lo cruza con el registro de los proveedores, que no controlamos: ese registro ancla la auditoría." |
| 2:38 | Se edita un carácter del expediente y se vuelve a correr: "VERIFICACIÓN FALLIDA" | "Cambiamos un carácter de la evidencia. Salta." |
| 2:48 | Página de transparencia y cierre con el nombre | "Qué se bloqueó, por orden de quién y hasta cuándo, a la vista de todos. Offside: rápido como Italia, con juez como Francia, y sin daño colateral." |

## Para la alteración de la toma 3

Abrí `salida/video/expediente-EXP-2026-000001.json`, buscá `contenido_b64` y cambiá una letra del medio de ese texto por otra. Guardá y volvé a correr el verificador independiente. Va a decir qué detección cambió y que el archivo ya no es el que registró el cierre de la exportación.

## Si te pasás de los 3 minutos

Recortá primero el cambio de turno de la toma 1 y después la página de transparencia del cierre. No recortes la firma, el salto, el reclamo ni el verificador oficial: son lo que pide el desafío.
