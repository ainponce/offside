# Guion del video (hasta 3 minutos)

El desafío pide un video de hasta 3 minutos que muestre el circuito completo (carga, juez, proveedores, confirmación, vencimiento), un reclamo resuelto si se implementaron, y que termine con la salida del verificador oficial.

El video se graba solo y se puede repetir: `pnpm video` levanta el simulador oficial y Offside con bases nuevas, maneja la interfaz real en un Chrome sin ventana y arma el archivo. Este documento describe lo que graba.

## Cómo se graba

```bash
pnpm build
```

```bash
pnpm video
```

Tarda lo que dura el partido de práctica a x6: unos 20 minutos. Necesita ffmpeg y Google Chrome, y la computadora despierta y enchufada: si se duerme, el reloj del simulador se frena y la grabación falla (el grabador usa `caffeinate`, pero a batería macOS puede dormirse igual). Deja en `salida/video/`:

| Archivo | Qué es |
|---|---|
| `offside-demo.mp4` | El video, 1920 x 1080, sin sonido: los subtítulos llevan la narración |
| `fotogramas.png` | Hoja de contacto con los momentos clave, para revisarlo de un vistazo |
| `partido/`, `simulacro/` | Base, registro del simulador y logs de las dos corridas grabadas |
| `exportacion/`, `exportacion-alterada/` | La exportación que se verifica en el video y la copia con un carácter cambiado |
| `salidas/` | La salida completa de cada comando que aparece en pantalla |

Opciones: `-- --voz <nombre>` agrega `offside-demo-narrado.mp4` con la voz de `say` (ver [Narración](#narración)); `-- --acelerar 12` ensaya el guion en la mitad de tiempo (el video de entrega es a x6); `-- --conservar` deja los cuadros sueltos en `salida/video/tmp/`.

## Qué se ve y qué es real

- **Dos corridas del simulador oficial, con datos reales.** Un partido de práctica completo, del minuto 0,5 al 110, a x6; y, en paralelo, una corrida corta con `--simulacro` que arranca en el minuto 9,5, solo para el reclamo. El encabezado del video dice siempre de cuál corrida es lo que se ve.
- **Las firmas son toques en la pantalla de la jueza.** El grabador hace clic sobre el botón donde se ve, y se dibuja el toque. Lo que el video resume en cámara rápida (los saltos de servidor y filtraciones del minuto 55 en adelante, una filtración del minuto 9) lo firma el juez de turno por la misma pantalla, fuera de cámara. En la corrida del simulacro, las dos filtraciones que no son el error se firman antes de la escena, con el mismo ingreso de la jueza.
- **Cámara rápida, siempre rotulada.** Arriba a la derecha aparece "×N" mientras el tiempo está acelerado en el montaje. Los cortes son fundidos cortos.
- **Las terminales muestran la salida real**, capturada al terminar el partido: el verificador oficial sobre el registro que escribió el simulador en esta corrida, la exportación de esta base, el verificador independiente y `cmp` sobre la copia alterada. Nada se reescribe; solo se colorean las líneas.
- **Pantallas:** a la izquierda el tablero de la fiscalía (1440 x 900, como se proyecta) y a la derecha el celular del juez (390 x 844). En el cambio de turno, los dos celulares.

## El guion

Tiempos de `salida/video/offside-demo.mp4` (2:47). Ese archivo se grabó con `pnpm video -- --acelerar 12`: la Mac, a batería, se durmió en el medio de las grabaciones a x6 y el reloj del simulador se frenó. Por eso el encabezado del video dice "tiempo ×6". Una grabación a x6 dura unos segundos más; cada proveedor tarda lo que tarda.

| Tiempo | En pantalla | Subtítulo |
|---|---|---|
| 0:00 | Título: "Offside. Bloqueo en vivo de transmisiones piratas, con un juez firmando cada medida y sin daño colateral" | Un partido dura dos horas. Un sitio pirata cambia de servidor en minutos. |
| 0:05 | Tablero y celular. Llega la primera detección: se abre EXP-2026-000001 y la tarjeta entra en el celular | Offside lee las detecciones del simulador y abre un expediente por filtración. |
| 0:13 | Marca sobre el pedido y las cuatro luces de la tarjeta | La jueza de turno lo recibe en el celular: el pedido y cuatro verificaciones. |
| 0:18 | Toque en "Firmar y ordenar". La barra se vuelve el despacho; las celdas del tablero pasan a "Recibida" y la de Aurora a "Aplicada" | Firma. Sale una orden a cada proveedor, en el tipo de bloqueo que admite. |
| 0:23 | Acercamiento a los carriles, ×3: el resto de los proveedores confirma | Cada proveedor confirma por su cuenta; el que falla se reintenta solo. |
| 0:28 | Marca en "No llegaron al juez" | Lo que no es pirata se archiva solo, como el licenciatario en su dominio. |
| 0:35 | Segunda tarjeta: la cuarta verificación dice "IP compartida: se bloquea solo el dominio" | Este pirata comparte la IP con 11 sitios ajenos. Offside pide bloquear solo el dominio. |
| 0:40 | Firma. Acercamiento a "Daño evitado" | Daño evitado: esos 11 sitios legítimos siguen en línea, y el tablero los nombra. |
| 0:45 | Título de sección | ¿Y si algo sale mal? En otra corrida del simulador forzamos un error: bloquear por IP una IP compartida. |
| 0:50 | Corrida del simulacro. La tarjeta trae la verificación en rojo "Simulacro: error forzado a propósito" | La tarjeta marca el riesgo en rojo. Se firma igual: es el error a propósito. |
| 0:55 | Firma. Carriles en cámara rápida (×8) | El bloqueo por IP se aplica, y los sitios que comparten esa IP dejan de cargar. |
| 1:00 | Tarjeta "Levantamiento" de noticias-del-valle.test, con el reclamo y las órdenes a levantar | Un sitio legítimo reclama. Offside lo verifica y propone levantar la orden. |
| 1:05 | Firma. El expediente pasa a dominio en los cuatro proveedores y el pie dice "Reclamos: resuelto" | Se levanta en todos los proveedores y se reemplaza por el dominio. El pirata sigue bloqueado. |
| 1:11 | De vuelta al partido, en cámara rápida hasta el minuto 37 | Volvemos al partido, en cámara rápida: confirman los proveedores lentos. |
| 1:19 | Tarjeta "Ampliación": el recorrido s1, s2 y "Qué cambió" con el servidor y la IP subrayados | Minuto 37: el pirata cambia de servidor. Misma marca de agua: es una ampliación. |
| 1:25 | Firma. Acercamiento al escalón del carril en el minuto 37 | Un toque. Perseguimos la filtración, no el servidor. |
| 1:32 | Los dos celulares, cinco segundos antes del minuto 50: la píldora de la jueza pasa a "Fuera de turno" y la del juez entrante a "De turno" | Minuto 50: cambia el turno. La jueza saliente ya no puede firmar; firma el entrante. |
| 1:40 | Tablero y celular del juez, en cámara rápida hasta el minuto 104 | Hasta el final, el juez de turno firma cada salto y cada filtración nueva. |
| 1:48 | Minuto 105: las celdas pasan a "Venció"; el celular dice "Partido terminado. Todo venció a los 105′" | Pitazo final: a los 105′ todas las órdenes vencen solas. |
| 1:55 | Página pública de transparencia | Qué se bloqueó, por orden de quién y hasta cuándo, a la vista de todos. |
| 2:00 | Expediente EXP-2026-000001: la huella de M-0001 y, marcados, los últimos 16 caracteres del identificador de una orden | La huella de lo que vio la jueza viaja dentro de cada orden firmada. |
| 2:05 | Terminal: `pnpm -s exportar` y el verificador independiente con `--registro`: "VERIFICACIÓN CORRECTA" y "anclada hasta la secuencia" | Un verificador independiente recalcula todo y lo cruza con el registro del simulador. |
| 2:15 | Terminal: `cmp` muestra el único carácter cambiado en la copia; el verificador termina en "VERIFICACIÓN FALLIDA" y dice qué detección cambió | Cambiamos un solo carácter de la evidencia. El verificador lo detecta y dice dónde. |
| 2:21 | Terminal: el verificador oficial sobre el registro de esta corrida, completo | Verificador oficial, sobre este partido: 7 de 7 fases piratas bloqueadas, cero daño colateral, cero falsos positivos y cero órdenes fuera de turno. |
| 2:31 | La misma salida, hasta el final | Offside: rápido como Italia, con juez como Francia y sin daño colateral. |

El subtítulo del verificador oficial se arma con lo que el verificador devuelve en esa grabación (`--json`), no con un texto fijo.

## Narración

El video de entrega va sin voz: los subtítulos dicen todo. En esta máquina solo hay voces compactas de `say` en castellano (Mónica, Paulina), que suenan a máquina, así que no se generó una versión narrada.

Para tener una versión con voz:

- Bajá una voz natural en Ajustes del Sistema > Accesibilidad > Contenido leído > Voz del sistema > Administrar voces (por ejemplo, una "Mejorada" o "Premium" en castellano) y corré `pnpm video -- --voz "<nombre exacto>"`. Cada subtítulo espera lo que dura su frase.
- O grabá tu voz leyendo la columna de subtítulos sobre `offside-demo.mp4`. Los tiempos de arriba alcanzan para leer cada frase sin apuro.

### Voz en off con ElevenLabs

`offside-demo-voz.mp4` es el mismo video (sin regrabar, video copiado tal cual) con voz en off de ElevenLabs (voz Brian, `eleven_multilingual_v2`):

```bash
ELEVENLABS_API_KEY=... pnpm video:voz
```

`scripts/narrar.ts` lee del video cuándo está cada subtítulo en pantalla, genera una frase hablada por subtítulo (las frases están en el script), la acelera hasta ×1,12 si hace falta y falla diciendo cuál acortar si ni así entra. Mezcla a -16 LUFS y comprueba con `silencedetect` que ninguna frase se pisa ni sale de su subtítulo. Los clips quedan en `salida/video/voz/` con un nombre que depende del texto y la voz: al repetir, solo se piden las frases que cambiaron. `-- --voz <voice_id>` cambia la voz. La clave se pasa por el entorno; nunca va al repositorio. Si se regraba el video con otros números (sitios ajenos, fases), hay que ajustar las frases.

## Si te pasás de los 3 minutos

El grabador avisa al final si el video dura más de 3 minutos. Recortá primero la transparencia y el cambio de turno (en `scripts/video.ts`, sus `decir`). No recortes la firma, el salto, el reclamo, el vencimiento ni el verificador oficial: son lo que pide el desafío.

## Si hay que grabarlo a mano

Con `pnpm demo` (simulador oficial y Offside con una base nueva), en dos pestañas: el tablero (`/tablero`, usuario `fiscalia`) y la vista del juez angosta como un celular (`/juez`, usuaria `laura`; desde el minuto 50, `martin`). Usuarios en `config/jueces.demo.json`.

1. Primero el reclamo: `pnpm demo -- --simulacro --inicio-min 9.5`. Firmá las dos filtraciones que no están en rojo, después la tarjeta en rojo y, unos tres minutos de partido más tarde, el levantamiento. Cortalo con Ctrl+C.
2. Después el partido entero: `pnpm demo`. Firmá las tres primeras filtraciones (minutos 2, 6 y 9) y la ampliación del minuto 37, mirá el cambio de turno del minuto 50 y dejá correr hasta el minuto 110, firmando lo que llegue.
3. Con ese partido cerrado: `python3 .simulador/desafio-futbol/evaluacion/verificar.py --log salida/registro.jsonl`, `pnpm exportar -- --carpeta salida/a-mano`, el verificador independiente con `--registro salida/registro.jsonl`, y otra vez sobre una copia con un carácter cambiado en un `contenido_b64`.

Van en ese orden porque `pnpm demo` siempre escribe el registro del simulador en `salida/registro.jsonl`: la segunda corrida pisa el registro de la primera. Por eso `pnpm video` no usa `pnpm demo` y deja el registro de cada corrida en su carpeta.
