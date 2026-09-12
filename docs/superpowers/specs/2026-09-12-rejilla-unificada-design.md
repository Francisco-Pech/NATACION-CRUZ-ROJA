# Días y horarios por curso: una sola pantalla

Fecha: 2026-09-12

## El problema

La oferta de la escuela está repartida en cuatro pantallas que no se hablan:

- **Tipo de Curso** dice qué cursos hay.
- **Fechas por curso** dice entre qué fechas corre cada uno.
- **Días laborales** dice qué días y a qué horas abre la alberca.
- **Días y horarios por curso** (la rejilla) dice qué clases hay.

La rejilla no sabe nada de las otras tres. Deja abrir una clase el domingo a
las 3 de la mañana, cuando la alberca está cerrada, sin decir nada. Y el
cupo —que sí existe— vive al fondo de cada tarjeta, repartido en 79 campos
para mantener tres números distintos: por eso nadie lo encuentra.

## Qué se construye

La rejilla pasa a ser la pantalla donde queda asentada la oferta completa:
qué corre, cuándo, a qué hora y para cuántos.

### Un dueño por dato

Después del cambio, cada dato se captura en un solo lugar:

| Pantalla | Qué se edita ahí |
|---|---|
| Tipo de Curso | Nombre, descripción, activo |
| Fechas por curso | Desde, hasta, repetición, temporada |
| Días laborales | Qué día y a qué hora abre la alberca |
| Días inhábiles | Festivos, periodos vacacionales, excepciones |
| **Rejilla** | **Qué sesiones corre cada curso, el cupo y los extras** |

En la rejilla, las otras cuatro se ven pero no se tocan. Un dato editable en
dos lugares tarde o temprano queda distinto en cada uno.

Se quita **Repetición** de Tipo de Curso. El dato sigue existiendo y el motor
de cobro lo sigue usando, pero se captura en Fechas por curso, que es donde
corresponde.

### La tarjeta de cada curso

```
┌─────────────────────────────────────────────────────────────┐
│  Curso Adultos                  Alumnos [30]   Extras [10]  │
│  Del 1 de enero al 31 de diciembre · todos los años         │
├─────────────────────────────────────────────────────────────┤
│           L     M     X     J     V     S     D             │
│   06:00   ✓     ✓     ✓     ✓     ✓     ▨     ▨             │
│   15:00   ·     ·     ·     ·     ·     ▨     ▨             │
│                                                             │
│   ✓ abierta   · cerrada   ▨ la alberca no abre              │
├─────────────────────────────────────────────────────────────┤
│   Ver el año en calendario →                                │
└─────────────────────────────────────────────────────────────┘
```

Las casillas `▨` no se pueden marcar: son cruces de día y hora que no son
franja laboral. Si hace falta abrirlas, se abren en Días laborales.

La línea de fechas es texto, leído de Fechas por curso.

## Cupo y extras

El cupo pasa a ser del curso. Cada sesión guarda «usa el del curso» salvo que
se le ponga un número propio.

Esto resuelve una duda que hoy no hace falta contestar: no se sabe si la
capacidad varía según la hora. Con un número por curso, si nunca varía nunca
se toca nada más; y si algún día las seis de la mañana aguantan menos, se
ajusta esa casilla sola.

- `TipoCurso.cupoMaximo` — por defecto 35 para cursos nuevos.
- `TipoCurso.extras` — por defecto 10. Solo del curso, no por sesión.
- `Sesion.cupoMaximo` pasa a ser opcional. Vacío quiere decir «el del curso».

El cupo que manda al inscribir es el de la sesión si lo tiene, y el del curso
si no.

Los extras son tolerancia, no cupo: entre el cupo y cupo + extras el sistema
avisa que se va sobre el cupo pero deja pasar. Pasando los extras, no.

### La migración no cambia capacidades

Hoy: Adultos 30, Niños 25, Personalizado 5, parejo dentro de cada curso. La
migración copia ese número al curso y deja las sesiones en vacío.

El 35 es el valor de arranque para cursos nuevos, no un valor que se aplique
a los que ya existen. Subir Adultos a 35 es un cambio de una pantalla, y lo
hace quien decide, no la migración: una capacidad que cambia sola empieza a
aceptar alumnos de más sin que nadie lo haya pedido.

Personalizado se queda en 5 en cualquier caso. Son bloques individuales de 30
y 45 minutos: 35 ahí no es un número grande, es otro producto.

## El calendario

Un mes a la vez, con flechas para moverse. Sirve para ver cómo quedó lo que
se acaba de capturar.

Cada día muestra qué cursos corren ese día y, si es inhábil, su nombre. Al
tocar un día se abre el detalle: sus sesiones y su comentario, si tiene.

Un día corre para un curso cuando se cumplen las cuatro cosas: el curso tiene
una sesión ese día de la semana, esa sesión está abierta, la fecha cae dentro
de alguna temporada del curso, y la fecha no es inhábil.

## Los comentarios

Una nota por fecha. Opcional, informativa: sirve para dejar apuntado un
pendiente o algo que haga falta saber.

No afectan nada. No mueven la fecha límite, no cancelan clases, no quitan
cobros. Si un día no hay clase, eso se captura en Días inhábiles, que ya
existe y sí mueve la fecha límite.

Tabla nueva: fecha, texto, quién lo escribió y cuándo.

## Los identificadores

`Sesion` no tiene `hash`, y la rejilla pasa ids de la base en sus
formularios. Es la única pantalla que falta de esa regla. Como sus
formularios se rehacen de todas maneras, se corrige aquí.

## Lo que no incluye

- Página pública de horarios. Todo esto vive en Panel de control.
- Lista de espera.
- Comentarios por curso o por sesión: son por fecha.
- Extras por sesión: solo por curso.

## Cómo se prueba

La lógica vive en funciones puras, en `src/lib`, probadas antes de
escribirlas:

- `cupoEfectivo` — el de la sesión si tiene, el del curso si no.
- `cabeUnoMas` — dentro del cupo, dentro de los extras, o lleno.
- `diasQueCorre` — qué días de un mes corre un curso, cruzando sus sesiones
  con sus temporadas y con los días inhábiles.

Los casos que importan: una sesión sin cupo propio hereda el del curso; una
sesión con cupo propio manda sobre el del curso; el alumno número 31 de un
curso de 30 con 10 extras entra con aviso, y el 41 no entra; un día inhábil
no corre aunque haya sesión; un día fuera de temporada no corre aunque haya
sesión y sea laboral.
