# Pitch de Offside

Tres versiones según el tiempo que den, la coreografía de la demo y las preguntas que conviene tener respondidas. Los números salen de los ensayos (ver el README); antes de presentar, reemplazalos por los del partido final si son distintos.

## En una frase

Offside bloquea en vivo las transmisiones piratas con un juez firmando cada medida, sin tirar ningún sitio ajeno, porque persigue la filtración y no el servidor.

## Versión de 3 minutos

**El problema (30 s)**

> Un partido dura dos horas. Un sitio pirata cambia de servidor en minutos.
>
> Para el último Superclásico se pidió bloquear 182 dominios. Y hoy el mundo elige entre dos males. Italia bloquea en media hora desde una plataforma, sin juez, y terminó tirando sitios legítimos. Francia y el Reino Unido pasan por un juez, pero solo al principio. En Argentina todo depende de una fiscalía y un juzgado, y los proveedores chicos no llegan a reaccionar.

**La idea (30 s)**

> En el fútbol hay dos formas de marcar: en zona o al hombre. Italia marca en zona: bloquea direcciones y se lleva puesto al que pasa.
>
> Offside hace marca personal. Cada señal pirata lleva una marca de agua, y esa marca no cambia cuando el pirata se muda de servidor. Nosotros no perseguimos servidores: perseguimos la filtración.

**La demo (80 s)** — ver la coreografía más abajo

> Esto es un partido en vivo contra el simulador del desafío. Aparece un stream pirata. Offside ya comprobó cuatro cosas: que es la señal oficial, que no es un licenciatario, qué servidor la emite y qué más hay en esa IP.
>
> La jueza de turno lo ve en su celular. Firma. *(pausa: los proveedores se ponen en verde)* Y la orden llegó a todos los proveedores del país, a cada uno en el tipo de bloqueo que admite.
>
> Ahora el pirata se muda. Mismo expediente, misma marca, servidor nuevo: es una ampliación. Un toque.
>
> Y miren esto: este otro pirata está en una IP compartida. Si bloqueábamos la IP, caían la panadería, la escuela y el municipio. Offside bloquea solo el dominio. Daño colateral: cero.

**La prueba (25 s)**

> La firma de la jueza cubre la evidencia: la huella de lo que vio viaja dentro de la orden. Si alguien cambia un byte del expediente después… *(correr el verificador)* …salta.
>
> En los ensayos, con el verificador oficial: todas las fases piratas bloqueadas, el primer bloqueo cerca de un minuto después de la detección, cero sitios legítimos afectados, cero órdenes fuera de turno y cero bloqueos vivos después del partido.

**El cierre (15 s)**

> Todo vence con el pitazo final. Y la propuesta normativa dice en una página qué hace falta para llevarlo a todo el país: orden marco antes del partido, registro federal de proveedores y dominio antes que IP.
>
> Offside: rápido como Italia, con juez como Francia, y sin daño colateral.

## Versión de 1 minuto

> Un partido dura dos horas y un sitio pirata cambia de servidor en minutos. Italia bloquea rápido y sin juez, y tiró sitios legítimos. Otros países pasan por un juez y llegan tarde.
>
> Offside persigue la filtración, no el servidor. La marca de agua de la señal no cambia cuando el pirata se muda, así que hay un expediente por filtración. El juez de turno lo firma desde el celular con cuatro verificaciones a la vista, y cada salto de servidor es una ampliación de un toque.
>
> Solo bloqueamos una IP cuando es exclusiva del pirata; si es compartida, bloqueamos el dominio y nadie más cae. La firma del juez cubre la evidencia y todo vence con el pitazo final.
>
> Contra el simulador del desafío: todas las fases piratas bloqueadas, cero sitios legítimos afectados, cero órdenes fuera de turno.

## Coreografía de la demo

Preparación, diez minutos antes:

1. `pnpm demo -- --inicio-min 35` en una terminal. Arranca en el minuto 35: las filtraciones ya están detectadas y a los 25 segundos el primer pirata salta de servidor.
2. Laptop: pestaña del tablero (fiscalía), proyectada.
3. Celular en la misma red, en la dirección "En la red local" que imprime la consola, con la sesión de la jueza del primer turno ya iniciada. Si la red no deja, usá una segunda pestaña angosta en la laptop.
4. En otra terminal, dejá escrita y sin ejecutar la línea del verificador (paso 5).

En vivo:

| Momento | Qué hacés | Qué decís |
|---|---|---|
| 1. La cola | Mostrás el celular con las medidas pendientes | "Esto le llega a la jueza de turno" |
| 2. La firma | Le das el celular a alguien del jurado: "usted es la jueza de turno, firme" | Mientras firma: "cuatro verificaciones, una firma" |
| 3. Los proveedores | Señalás el tablero: las celdas pasan a verde | "Cada proveedor confirma; el chico tarda más, el inestable falla y se reintenta solo" |
| 4. El salto | Aparece la tarjeta de ampliación; la firmás vos | "Se mudó. Mismo expediente. Un toque" |
| 5. La IP compartida | Señalás "Daño evitado" en el tablero | "Si bloqueábamos esta IP caían estos sitios. Cayeron cero" |
| 6. La alteración | Editás un carácter de un expediente exportado y corrés el verificador | "La firma cubre la prueba" |

Para el momento 6, con una exportación ya hecha en `entrega/practica`:

```bash
python3 herramientas/verificar_expediente.py entrega/practica --juzgados config/jueces.demo.json
```

Plan B: si algo no anda en vivo, mostrás el video. Tené el archivo abierto en otra ventana.

## Preguntas probables

**¿Por qué no firman automáticamente los saltos de servidor?**
Porque el control judicial de cada pedido es lo que este desafío propone y lo que ningún país tiene. Medimos que no frena: una ampliación es un toque. La orden marco que habilite ampliaciones automáticas con aviso y revocación está en la propuesta normativa como paso siguiente, y es una decisión del legislador, no nuestra.

**¿Y si el juez tarda?**
Cada minuto de demora es un minuto de señal visible; el tablero lo muestra. Por eso la tarjeta se lee en segundos, avisa con sonido, y al cambiar el turno lo pendiente pasa solo al juez entrante.

**¿Cómo saben que la marca identifica al que filtra?**
No afirmamos qué identifica. En los datos, cada operación mantiene la misma marca al cambiar de servidor, y el titular, que la emitió, sabe a qué corresponde. Si un pirata cambiara de marca, cada servidor sería un expediente propio y el circuito seguiría funcionando igual.

**¿Qué pasa si el DNS pasivo está incompleto?**
Ante la duda, dominio. Solo proponemos IP si todos los dominios de esa IP son del mismo operador, la organización no parece compartida y los datos coinciden. Y antes de cada envío se vuelve a comprobar.

**¿Por qué bloquear por IP alguna vez?**
Porque en una IP exclusiva el pirata suele tener dominios de respaldo; el bloqueo por IP los cubre a todos. Coincide con el bloqueo recomendado por la organización en las siete fases del partido de práctica.

**¿Qué tan inalterable es el registro?**
Cada entrada lleva el hash de la anterior, y un verificador independiente lo recalcula. Además la huella de cada expediente queda en el identificador de la orden, que guarda el proveedor: para reescribir la historia habría que alterar también los registros de todos los proveedores. En producción sumaríamos un sello de tiempo de un tercero.

**¿Qué pasa si un proveedor falla justo cuando cambia el turno?**
El reenvío no sale con la firma del juez saliente: le aparece al entrante como ratificación y la firma con un toque. El simulador mira el turno cuando el proveedor recibe la orden, y en los ensayos no hubo ninguna orden fuera de turno.

**¿Y si Offside se equivoca?**
El sitio afectado reclama, el reclamo se verifica contra las órdenes vigentes y el juez de turno levanta la orden en todos los proveedores y la reemplaza por una más precisa. Lo probamos forzando un error a propósito: el primer sitio afectado reclamó, la orden se levantó en menos de un minuto de partido en todos los proveedores, y los demás sitios ni llegaron a reclamar.

**¿Usa inteligencia artificial?**
Para decidir, no: son reglas deterministas que cualquiera puede leer y auditar. Sí la usamos para escribir el código durante el hackathon, y está dicho en el README.

**¿Escala a todo el país?**
El MVP es un proceso y una base local por partido, que alcanza para un partido con decenas de proveedores. Las reglas no guardan estado. Para producción cambiarían la base, la firma (firma digital real) y el canal hacia los proveedores, que es lo que pide la propuesta normativa.

**¿Sirve para otros deportes?**
Sirve para cualquier evento en vivo con principio y fin: una pelea, una carrera, un recital. El vencimiento es "cuando termina el evento".

**¿Qué no hace?**
No extrae la marca de agua del video (la toma del feed), no se integra con equipos reales de proveedores y el aviso al titular para cortar la fuente se genera pero el simulador no lo modela.
