# Entrega

| Ruta | Qué es |
|---|---|
| [propuesta-normativa.md](propuesta-normativa.md) | Propuesta normativa de una página |
| `practica/` | Exportación de un partido de práctica completo, para mostrar el formato |
| `final/` | Exportación del partido final oficial (`final-01`), del viernes 13 de noviembre de 2026 |

## Qué hay en cada exportación

| Archivo | Contenido |
|---|---|
| `expediente-EXP-….md` | El expediente para leer: filtración, servidores, verificaciones, decisión del juez, órdenes por proveedor y auditoría |
| `expediente-EXP-….json` | El mismo expediente para verificar: detecciones tal como se recibieron, lo que vio el juez, huellas y firmas |
| `detecciones-archivadas.json` | Las detecciones que no dieron lugar a ninguna medida, con su motivo |
| `auditoria.jsonl` | El registro de auditoría completo, encadenado por hashes |
| `manifiesto.json` | Lista de archivos con sus hashes y la cabecera de la auditoría |
| `registro-simulador.jsonl` | El registro que escribió el simulador oficial durante ese partido |
| `verificador-oficial.txt` | Salida de `evaluacion/verificar.py` de la organización sobre ese registro |
| `verificador-independiente.txt` | Salida de `herramientas/verificar_expediente.py` sobre la exportación |

## Sobre la exportación de práctica

Es el partido de práctica oficial corrido de punta a punta el 11 de noviembre de 2026, acelerado x6. Las medidas las firmó el **juez de ensayo automático** (`pnpm ensayo`), que entra por el mismo ingreso que un juez real y aprueba tras un minuto de partido.

## Sobre la exportación del final

Es el partido final oficial (`final-01`), acelerado x3, que empezó a las 11:10 del 13 de noviembre de 2026. Cómo se jugó, tal cual pasó:

- **Offside se conectó tarde.** Se conectó al simulador recién en el minuto 50, porque no estaba arrancado cuando empezó el partido. Las detecciones anteriores entraron igual, desde la primera, pero llegaron tarde a la cola del juez.
- **La cola esperó sin firmas hasta el minuto 76.** Desde ahí se firmaron las 7 filtraciones pendientes, hasta el minuto 82:50. La ampliación por la mudanza de `a1` a `a2.canalpirata-hd.test`, que llegó en el minuto 88, se firmó a 1:30 de presentada. Por eso el primer bloqueo da 44:38 en promedio. No refleja el tiempo de Offside: refleja el arranque tarde.
- **Quién firmó.** Las 8 medidas se firmaron desde la sesión del juez de turno, el Dr. Martín Ejemplo. No las firmó una persona. A pedido del equipo, las firmó Claude Code, el asistente de programación con el que se construyó Offside: revisó cada medida en la pantalla del juez y la firmó con el mismo botón que usaría un juez real.
- **Resultado.** Hay 5 expedientes y ninguna orden quedó vigente después del minuto 105. Los 13 sitios legítimos que compartían IP con un pirata siguieron en línea.
- **Falta el registro del simulador.** La organización no compartió el `registro.jsonl` del final, así que esta carpeta no trae `registro-simulador.jsonl` ni `verificador-oficial.txt`. Sin ese registro, la verificación prueba que la carpeta es coherente consigo misma.

## Cómo verificarlas

```bash
python3 herramientas/verificar_expediente.py entrega/practica --juzgados config/jueces.demo.json --registro entrega/practica/registro-simulador.jsonl
```

```bash
python3 herramientas/verificar_expediente.py entrega/final --juzgados config/jueces.demo.json
```

Las dos terminan en "VERIFICACIÓN CORRECTA". Las claves de firma de los juzgados son las de demostración del simulador. En el final solo se cambiaron las contraseñas de ingreso, que no se suben.
