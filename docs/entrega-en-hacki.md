# Entrega en Hacki

Textos listos para pegar en [Hacki](https://hacki.crecimiento.build/h/competencia-argentina-space) y la lista de lo que exige el desafío.

## Datos del proyecto

**Nombre:** Offside

**Track:** Qualydata - Streaming

**Frase corta:**

> Bloqueo en vivo de transmisiones piratas con un juez firmando cada medida y sin tirar ningún sitio ajeno.

**Descripción:**

> Un partido dura dos horas y un sitio pirata cambia de servidor en minutos. Offside es una plataforma federal de órdenes de bloqueo en vivo que corre el circuito completo: arma el expediente de cada stream pirata con evidencia verificable, se lo presenta al juez de turno, envía la orden firmada a cada proveedor de internet en el tipo de bloqueo que admite, sigue la confirmación y hace vencer todo al terminar el partido.
>
> La idea que la distingue: perseguir la filtración, no el servidor. La marca de agua de la señal no cambia cuando el pirata se muda, así que hay un expediente por filtración; cada servidor nuevo es una ampliación que el juez firma con un toque desde el celular.
>
> Solo se bloquea una IP cuando es exclusiva del operador; si es compartida, se bloquea el dominio y nadie más cae. La huella de lo que vio el juez viaja dentro de cada orden firmada, y un verificador independiente detecta cualquier alteración posterior.
>
> Medido con el simulador y el verificador oficiales en el partido de práctica: 7 de 7 fases piratas bloqueadas, primer bloqueo cerca de un minuto después de la detección, 0 sitios legítimos afectados, 0 falsos positivos, 0 órdenes fuera de turno y 0 bloqueos por IP vivos después del partido.

**Tecnologías:** TypeScript, Node.js, SQLite, Hono, React, Vite, Tailwind CSS, Python.

**Repositorio:** https://github.com/ainponce/offside

**Video:** *(subir `salida/video/offside-demo.mp4`, 2:47, y pegar el link)*

## Lo que exige el desafío

| Requisito | Dónde está | Estado |
|---|---|---|
| Repositorio público con el código | https://github.com/ainponce/offside | Publicado |
| README: cómo correrlo, supuestos, qué existía antes | [README.md](../README.md) | Listo |
| La plataforma corre el circuito completo contra el simulador en el partido final | [Guía del partido final](guia-partido-final.md) | Se hace el viernes |
| Video de hasta 3 minutos con el circuito completo | `salida/video/offside-demo.mp4` (2:47); [guion](guion-video.md) | Grabado; falta subirlo |
| `entrega/`: un expediente y la auditoría del partido final | `entrega/final` (hoy hay un ejemplo en `entrega/practica`) | Se exporta el viernes |
| `entrega/`: propuesta normativa de una página | [entrega/propuesta-normativa.md](../entrega/propuesta-normativa.md) | Lista |
| Pitch ante el jurado | [Pitch](pitch.md) | Listo para ensayar |
| Nada ofensivo; solo contra el simulador | Offside solo habla con la dirección del simulador | Cumple |
| Sin datos personales ni claves reales | Solo claves y usuarios de demostración | Cumple |
| Trabajo original hecho en el evento | Sección "Qué existía antes del evento" del README | Cumple |

## Dudas para confirmar con la organización

- **Hora de cierre.** Hacki marca el cierre el viernes 13 a las 10:00, pero el partido final es ese mismo viernes. Si el partido termina después del cierre, queda la exportación de práctica en `entrega/practica`.
- **Velocidad del partido final** ("posiblemente acelerado") y dirección del simulador de tu equipo.
- **Licencia.** El desafío de Big Data propone MIT o Apache 2.0; este repositorio usa MIT.
