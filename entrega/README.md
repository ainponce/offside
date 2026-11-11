# Entrega

| Ruta | Qué es |
|---|---|
| [propuesta-normativa.md](propuesta-normativa.md) | Propuesta normativa de una página |
| `practica/` | Exportación de un partido de práctica completo, para mostrar el formato |
| `final/` | Exportación del partido final (se agrega el viernes 13, al terminar el partido) |

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

Es el partido de práctica oficial corrido de punta a punta el 11 de noviembre de 2026, acelerado x6. Las medidas las firmó el **juez de ensayo automático** (`pnpm ensayo`), que entra por el mismo ingreso que un juez real y aprueba tras un minuto de partido. En el partido final firma una persona.

## Cómo verificarla

```bash
python3 herramientas/verificar_expediente.py entrega/practica --juzgados config/jueces.demo.json --registro entrega/practica/registro-simulador.jsonl
```
