# Guía del partido final

Paso a paso para el viernes 13. Pensada para una sola persona que hace de los dos jueces.

## La noche anterior

1. Ensayo completo con el partido de práctica a la velocidad real del final (si la organización no la dijo, x6):

   ```bash
   pnpm demo
   ```

   Firmá vos como juez todo el partido, con las dos pestañas, incluido el cambio de turno del minuto 50. Al terminar:

   ```bash
   python3 .simulador/desafio-futbol/evaluacion/verificar.py --log salida/registro.jsonl
   ```

2. Ensayo automático, para confirmar que nada se rompió:

   ```bash
   pnpm test
   ```

   ```bash
   pnpm ensayo
   ```

3. Generá contraseñas propias para el final. Las de `config/jueces.demo.json` están publicadas en el repositorio:

   ```bash
   pnpm jueces-locales
   ```

   Escribe `config/jueces.local.json` (no se sube al repositorio) con los mismos jueces, juzgados y claves de firma, y una contraseña nueva por usuario. Las muestra **una sola vez**: anotalas en papel. Si la organización publica otro archivo de jueces para la final, partí de ese: `pnpm jueces-locales -- --desde RUTA --forzar`.
4. Cargá la batería de la laptop y llevá el cargador.

## Antes del partido (10 minutos)

1. Pedile a la organización la dirección del simulador de tu equipo y la velocidad del partido.
2. Comprobá que la laptop llega a esa dirección:

   ```bash
   curl -s http://DIRECCION:PUERTO/estado
   ```

   Tiene que responder con `minuto_actual`. Si no responde, avisá antes de que empiece.
3. Compilá la interfaz y arrancá Offside con una base nueva, apuntando a esa dirección, escuchando solo en la laptop y con las contraseñas propias:

   ```bash
   pnpm build
   ```

   ```bash
   OFFSIDE_HOST=127.0.0.1 OFFSIDE_JUECES=config/jueces.local.json SIMULADOR_URL=http://DIRECCION:PUERTO pnpm start -- --nuevo
   ```

   La consola tiene que decir `escucha en 127.0.0.1` y `[motor] conectado`, y **no** tiene que decir "Usuarios de demostración" ni "SIMULACRO". Con `127.0.0.1` nadie de la red puede entrar: el celular no se usa en el final.
4. Abrí tres pestañas en `http://localhost:3000`:
   - **Pestaña 1:** ingresá como la jueza del primer turno. Va a decir "De turno".
   - **Pestaña 2:** ingresá como el juez del segundo turno. Va a decir "Fuera de turno" hasta el minuto 50.
   - **Pestaña 3:** ingresá como fiscalía y abrí el tablero.
5. Activá el sonido en las pestañas de los jueces (un clic en la página alcanza).

## Durante el partido

- **Tu única tarea es firmar.** Cuando suena, mirá las cuatro verificaciones y tocá "Firmar y ordenar" (o Enter). Offside ya descartó lo que no es pirata y ya eligió IP o dominio.
- **Luz ámbar en "Servidor":** leé la advertencia. La medida ya quedó propuesta por dominio, que es la opción segura; se puede firmar.
- **No rechaces por las dudas.** Si rechazaste por error, en "Recientes" está "Reconsiderar".
- **Minuto 50, cambio de turno:** la pestaña 1 queda en solo lectura y la pestaña 2 pasa a "De turno". Seguí firmando en la pestaña 2. Si aparece una tarjeta "Ratificación", es un reenvío a un proveedor que falló: firmala.
- **Tarjeta "Reclamo":** no debería aparecer. Si aparece, firmala enseguida: levanta el bloqueo que afectó a un sitio legítimo y lo reemplaza por uno más preciso.
- **"Sin conexión con el simulador":** no reinicies. Offside reintenta solo y retoma donde estaba. Si cerraste el proceso sin querer, volvé a arrancarlo **sin** `--nuevo` (con las mismas variables): conserva expedientes, órdenes y sesiones.
- **"SIMULADOR REINICIADO" en la consola y una alerta en el tablero:** la organización reinició el simulador. Offside ya archivó la base vieja y empezó una limpia, sin cerrar el proceso. Volvé a ingresar en las tres pestañas y seguí firmando.
- **Tarjeta que llega cerca del minuto 50:** si a la jueza saliente le queda menos de medio minuto de turno, firmar responde "esta medida la firma el juez entrante". Es a propósito: una orden que sale sobre el cambio de turno llega con la firma de un juez que ya no está. Esperá al minuto 50 y firmala en la pestaña 2. Si un reintento o un envío cortado cae en ese margen, le llega al entrante como "Ratificación".

## Cuando termina (minuto 105 más 5 de gracia)

1. Esperá a que el tablero muestre el partido finalizado y ninguna orden activa.
2. Exportá y verificá:

   ```bash
   pnpm exportar -- --carpeta entrega/final --nota "Partido final"
   ```

   ```bash
   python3 herramientas/verificar_expediente.py entrega/final --juzgados config/jueces.local.json
   ```

   Tiene que terminar en "VERIFICACIÓN CORRECTA". Sin el registro del simulador, eso prueba que la carpeta es coherente consigo misma, no más (el verificador lo dice). Si la organización comparte el `registro.jsonl` del simulador, copialo a `entrega/final/registro-simulador.jsonl` y verificá también con `--registro entrega/final/registro-simulador.jsonl`: ahí la auditoría queda anclada al registro de los proveedores. No toques los archivos de `entrega/final` después de exportar: cualquier cambio, hasta en un `.md`, hace fallar la verificación.
3. Subí la entrega antes del cierre:

   ```bash
   git add entrega/final
   ```

   ```bash
   git commit -m "entrega: expedientes y auditoría del partido final"
   ```

   ```bash
   git push
   ```

4. Confirmá en Hacki que el proyecto tiene el link al repositorio y el video.

## Si algo falla

| Qué pasa | Qué hacer |
|---|---|
| La laptop no llega al simulador | Revisá la red (cable o la wifi que indique la organización). Probá con `curl`. Offside se reconecta solo cuando vuelve. |
| Una pestaña pide ingresar de nuevo | Ingresá otra vez; no se pierde nada. |
| El celular no llega a la laptop | Seguí con las pestañas de la laptop. El celular es para el video y el pitch. |
| Una orden queda "rechazada" o hay una alerta roja en el tablero | Anotá el texto de la alerta y seguí firmando; no afecta a las demás órdenes. |
| El partido final termina después del cierre del repositorio | Queda la exportación del partido de práctica en `entrega/practica`, ya subida. |
