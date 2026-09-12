# Cursos, Horarios y Formas de Cobro

## Cruz Roja Mexicana, Delegación Cancún

**Fecha:** 11 de septiembre de 2026
**Estado:** Tramo 0 implementado. Tramos 1 a 3 pendientes.

> **Tramo 0 — hecho**, salvo un punto: *abrir y cerrar ciclos* no se construyó
> porque la función no existía y su comportamiento sigue sin definirse (ver
> Decisiones pendientes, punto 1). Los otros tres poderes de Root están puestos
> y probados.

---

## 1. Problema

El sistema de la Fase 1 supone que la escuela es una sola cosa: todos van de
lunes a viernes y todos pagan una mensualidad que depende de si son niños o
adultos. La realidad de la delegación no es esa.

Cuatro hechos que el sistema hoy no puede representar:

1. **Los sábados solo hay Salvavidas.** No existe manera de decir que un curso
   corre un día y otro no. La columna `Grupo.dias` existe, se escribe fija en
   `'L-V'` y **nadie la lee jamás** — es un campo muerto.
2. **Los horarios no se pueden armar por día.** Un curso tiene una sola hora de
   inicio y una de fin para toda la semana.
3. **No hay tipos de curso.** Hay una lista plana de grupos. No existen
   `Curso Adultos`, `Curso Niños`, `Personalizado` ni `Salvavidas`.
4. **Todo se cobra mensual.** Salvavidas es de pago único y no hay dónde decirlo.

Además hay dos cosas rotas que salieron al revisar:

- **Nadie puede asignarle un curso a un alumno.** `inscribirAlumno` nunca escribe
  `grupoId`; solo el seed lo hace. Todo alumno dado de alta desde el panel queda
  sin grupo.
- **El cupo es decorativo.** La pantalla afirma "El sistema no deja inscribir por
  encima del cupo" y nada lo valida.

---

## 2. Objetivos

1. Tipos de curso configurables, con estos cuatro de arranque: `Curso Adultos`,
   `Curso Niños`, `Personalizado`, `Salvavidas`.
2. Un catálogo de horarios independiente, que exista completo aunque algunas
   franjas no se ocupen.
3. Vincular día con horario por cada tipo de curso — una rejilla donde cada
   cruce marcado es una sesión real con su propio cupo.
4. Dos catálogos separados: **tipo de pago** (`Pago único`, `Pago recurrente`) y
   **frecuencia** (`Mensual`, `Trimestral`, `Semestral`, `Anual`).
5. Una tabla de costos donde se escoge el curso, el tipo de pago y la
   frecuencia, y se pone el precio.
6. Que el alumno se inscriba a sesiones concretas y que el cupo se respete.
7. Que el motor de cobro obedezca el tipo de pago y la frecuencia de cada curso.
8. Roles `ADMINISTRADOR`, `CAPTURISTA` y `PROFESOR`, más Root por correo.
9. **Todo el catálogo sembrado desde el seeder**, de forma reproducible.

---

## 3. No objetivos

Lo que este diseño **deja exactamente como está**:

- **Los días de curso no mueven la fecha límite de pago.** Que haya clase el
  sábado no vuelve hábil el sábado para efectos de cobro. El 5.º día hábil se
  sigue contando de lunes a viernes. Esto se discutió y se decidió así.
- **Los días inhábiles siguen siendo libres.** Cualquier fecha del calendario,
  a criterio del administrador, sin relación con los días de curso.
- **`Alumno.categoria` (`NINOS` / `GENERAL`) sobrevive como dato descriptivo**
  de la persona, pero pierde su trabajo de fijar el precio.
- **`Periodo.recargo` y `Periodo.precioLocker` siguen siendo por mes.**
- Los montos siguen en centavos, como enteros.
- La zona horaria sigue siendo `America/Cancun`.
- Fuera de alcance: Stripe real, subida de comprobantes, asistencia,
  facturación y reportes CSV.

---

## 4. Roles

Son tres roles guardados, más Root, que **no es un rol guardado**.

```
enum Rol {
  ADMINISTRADOR
  CAPTURISTA        // antes RECEPCION
  PROFESOR
}
```

`RECEPCION` se renombra a `CAPTURISTA`. Son 14 apariciones entre esquema,
migración, acciones, pantallas, seed y README; se cambian todas en el mismo
tramo para que no queden dos nombres para la misma cosa.

### Root no se guarda: se reconoce por correo

Root **no existe en el enum ni en ninguna columna**. Se resuelve comparando el
correo de la sesión contra un valor de entorno:

```
ROOT_EMAIL="«el de ADMIN_EMAIL»"
```

La razón es de seguridad y es buena: **si Root fuera un rol guardado, cualquiera
con acceso a la pantalla de usuarios podría asignárselo.** Al vivir fuera de la
base, no hay forma de otorgárselo desde el panel.

### El agujero que hay que tapar

La idea solo funciona si nadie puede **adoptar** el correo de Root. Hoy un
administrador puede dar de alta usuarios y editar sus datos; si pudiera crear un
usuario con el correo de Root, se volvería Root.

Reglas obligatorias, cada una con su prueba:

1. La pantalla de usuarios **rechaza crear o editar cualquier usuario cuyo
   correo sea igual a `ROOT_EMAIL`**, sin importar quién lo intente.
2. El usuario de Root **no se puede desactivar, ni cambiarle el rol, ni
   restablecerle la contraseña** desde el panel por alguien que no sea él.
3. Si `ROOT_EMAIL` no está definido, **no hay Root**. Falla cerrado: nunca se
   interpreta la ausencia como "todos son Root".
4. La comparación se hace normalizada — minúsculas y sin espacios — igual que
   en el inicio de sesión, para que `ROOT@Ejemplo.test ` no burle la regla.

### Igualdades exactas que hay que arreglar

Hoy existen tres comparaciones de **igualdad exacta** contra `ADMINISTRADOR`:

| Archivo | Línea |
|---|---|
| `src/app/panel/admin/acciones.ts` | 13 |
| `src/app/panel/admin/layout.tsx` | 9 |
| `src/app/panel/layout.tsx` | 17 |

Las tres pasan a una función única `esAdministrativo(usuario)`, que da verdadero
para `ADMINISTRADOR` y para Root. Con prueba que cubra los cuatro casos —
incluido Root, que es el que se queda fuera si esto se hace mal.

### Qué ve cada quien

| | Root | Administrador | Capturista | Profesor |
|---|---|---|---|---|
| Alumnos, cobros, lockers, credenciales | Sí | Sí | Sí | No |
| Escáner y semáforo | Sí | Sí | No | Sí |
| Cursos, horarios, rejilla, calendario | Sí | Sí | No | No |
| **Crear y quitar administradores** | Sí | No | No | No |
| **Editar precios, recargos y comisiones** | Sí | No | No | No |
| **Borrar de forma definitiva** | Sí | No | No | No |
| **Abrir y cerrar ciclos y periodos** | Sí | No | No | No |

### Los cuatro poderes exclusivos, en concreto

**Crear y quitar administradores.** El selector de rol de la pantalla de
usuarios se filtra según quién mira: un Administrador solo puede crear
`CAPTURISTA` y `PROFESOR`. La restricción va en la acción del servidor, no solo
en el `<select>` — un selector recortado no es una defensa.

**Editar precios, recargos y comisiones.** `/panel/admin/tarifas` pasa a solo
lectura para el Administrador. Afecta a `guardarTarifas`, `guardarComision`,
`guardarDescuento` y `alternarDescuento`.

**Borrar de forma definitiva.** La regla es general, no una lista de
excepciones:

> **El Administrador crea y edita. No borra. Root borra.**

El Administrador conserva **desactivar**, que es lo que el sistema ya hace hoy
con los cursos que tienen alumnos: el registro deja de usarse pero el histórico
no se pierde. Borrar de verdad —que sí destruye histórico— es de Root.

Hoy el Administrador borra en tres lugares, y los tres pasan a Root:
`eliminarGrupo` (cuando el curso no tiene alumnos), `eliminarDiaInhabil` y
`eliminarPeriodoSinClases`.

La regla aplica a lo que se construya de aquí en adelante: toda pantalla nueva
de este documento —tipos de curso, horarios, sesiones, tarifas— nace con
desactivar para el Administrador y borrar solo para Root. Ninguna acción de
borrado se escribe sin su guarda y su prueba.

**Abrir y cerrar ciclos y periodos.** ⚠️ **Esto no es dar un permiso: es
construir la función.** `Periodo.estado` y `CicloAnual.estado` existen en el
esquema y se leen —`recalcularFechasLimite` solo toca los abiertos, y el
calendario muestra la etiqueta— pero **ninguna parte del sistema los pone en
`CERRADO`**. No hay pantalla ni acción. Hay que hacerlas, y definir qué implica
cerrar: si se congelan las fechas límite, si se bloquean cargos nuevos y si se
pueden seguir registrando pagos de un mes cerrado.

**Pendiente:** quedó marcada una quinta atribución sin especificar. Falta decir
cuál es.

---

## 5. Modelo de datos

### 5.1 TipoCurso

```
model TipoCurso {
  id      String  @id @default(cuid())
  clave   String  @unique     // ADULTOS | NINOS | PERSONALIZADO | SALVAVIDAS
  nombre  String               // "Curso Adultos", "Curso Niños", ...
  orden   Int     @default(0)
  activo  Boolean @default(true)

  sesiones Sesion[]
  tarifas  Tarifa[]
}
```

La `clave` existe para que el seeder sea idempotente **aunque el nombre se
edite desde el panel**. El seed actual busca los grupos por nombre
(`findFirst({ where: { nombre } })`), y eso se rompe en cuanto alguien
renombra un curso: vuelve a crearlo duplicado. Con clave estable, no.

### 5.2 Horario — el catálogo

```
model Horario {
  id         String  @id @default(cuid())
  horaInicio String              // "16:00", 24h, con cero a la izquierda
  horaFin    String              // "17:00"
  orden      Int     @default(0)
  activo     Boolean @default(true)

  sesiones Sesion[]

  @@unique([horaInicio, horaFin])
}
```

Vive aparte a propósito: el catálogo tiene todas las franjas posibles, y que
una franja no se ocupe ningún día es normal, no un error.

### 5.3 Sesion — el vínculo día × horario

```
model Sesion {
  id          String  @id @default(cuid())
  tipoCursoId String
  horarioId   String
  diaSemana   Int                 // 0=domingo … 6=sábado, igual que Date.getDay()
  cupoMaximo  Int
  activo      Boolean @default(true)

  tipoCurso TipoCurso @relation(fields: [tipoCursoId], references: [id], onDelete: Cascade)
  horario   Horario   @relation(fields: [horarioId],   references: [id], onDelete: Restrict)
  inscritos InscripcionSesion[]

  @@unique([tipoCursoId, horarioId, diaSemana])
}
```

Cada sesión es una celda marcada de la rejilla. El cupo vive aquí porque es lo
único que significa algo físico: cuánta gente cabe en la alberca **ese día a esa
hora**.

`diaSemana` usa la numeración de `Date.getDay()` (0 = domingo) y no la ISO
(1 = lunes), para que no haya conversiones en el código que la consulta.

### 5.4 Dos catálogos: tipo de pago y frecuencia

Son dos preguntas distintas y por eso son dos tablas, no un solo campo:

- **Tipo de pago** — ¿se cobra una vez o se repite?
- **Frecuencia** — si se repite, ¿cada cuánto?

Van como **tablas sembradas**, no como enums, para que se puedan agregar
opciones sin tocar código ni migrar.

```
model TipoPago {
  id     String  @id @default(cuid())
  clave  String  @unique     // UNICO | RECURRENTE
  nombre String               // "Pago único", "Pago recurrente"
  orden  Int     @default(0)
  activo Boolean @default(true)

  tarifas Tarifa[]
}

model FrecuenciaPago {
  id     String  @id @default(cuid())
  clave  String  @unique     // MENSUAL | TRIMESTRAL | SEMESTRAL | ANUAL
  nombre String               // "Mensual", "Trimestral", "Semestral", "Anual"
  meses  Int                  // 1 | 3 | 6 | 12
  orden  Int     @default(0)
  activo Boolean @default(true)

  tarifas Tarifa[]
}
```

El campo **`meses` es la pieza clave**: el motor de cobro no pregunta "¿es
trimestral?", pregunta "¿cuántos meses cubre?". Así, el día que quieran agregar
"Bimestral", se siembra una fila con `meses: 2` y funciona sin tocar una línea
de código.

La `clave` cumple lo mismo que en `TipoCurso`: el nombre se puede editar desde
el panel sin romper el seeder ni la lógica.

### 5.5 Tarifa — la tabla de costos

Se reemplaza la tarifa actual, que cuelga del mes y de la categoría del alumno.

```
model Tarifa {
  id           String  @id @default(cuid())
  cicloAnualId String
  tipoCursoId  String
  tipoPagoId   String
  frecuenciaId String?             // null cuando el tipo de pago es ÚNICO
  monto        Int                 // centavos

  ciclo      CicloAnual     @relation(fields: [cicloAnualId], references: [id], onDelete: Cascade)
  tipoCurso  TipoCurso      @relation(fields: [tipoCursoId],  references: [id], onDelete: Cascade)
  tipoPago   TipoPago       @relation(fields: [tipoPagoId],   references: [id], onDelete: Restrict)
  frecuencia FrecuenciaPago? @relation(fields: [frecuenciaId], references: [id], onDelete: Restrict)

  @@unique([cicloAnualId, tipoCursoId, tipoPagoId, frecuenciaId])
}
```

Se escoge el curso, se marca si es único o recurrente, se escoge cada cuánto, y
se pone el precio. Ejemplos de cómo se leen las filas:

| Curso | Tipo de pago | Frecuencia | Monto | Significa |
|---|---|---|---|---|
| Curso Niños | Recurrente | Mensual | $600 | $600 cada mes |
| Curso Niños | Recurrente | Semestral | $3,400 | $3,400 cada seis meses |
| Curso Adultos | Recurrente | Mensual | $770 | $770 cada mes |
| Salvavidas | Único | — | $2,500 | $2,500 una sola vez |

**Las formas de cobro de un curso son las filas que tiene.** Un curso con dos
filas se puede pagar de las dos maneras y el alumno escoge en ventanilla. Uno
con una sola fila no da opción. Todo eso se configura sin tocar código.

`frecuenciaId` es nulo únicamente cuando el tipo de pago es `ÚNICO`; la
validación lo exige en cualquier otro caso, para que no existan filas que no
digan cada cuánto se cobran.

#### Por qué el precio cuelga del ciclo y no del mes

Hoy `Tarifa` cuelga de `Periodo` — del mes — y hay doce filas por categoría al
año, todas con el mismo valor. Se propone colgarla del ciclo anual.

**Esto no quita el pago mensual.** Una fila `Recurrente / Mensual` se cobra cada
mes, igual que hoy. Lo que cambia es dónde se guarda el precio, no cada cuándo
se cobra.

**Tampoco impide cambiar el precio a media temporada.** Se edita la fila y de ahí
en adelante los cargos nuevos salen con el precio nuevo; los ya emitidos no se
mueven, porque `Cargo` guarda los montos calculados al generarse — es una
fotografía, no una consulta viva.

**Lo único que se pierde** es dejar *programado* por adelantado que septiembre
cueste $600 y octubre $650. Hoy se puede porque hay doce filas. Si la delegación
agenda cambios de precio con anticipación, hay que decirlo antes de migrar.

### 5.5 InscripcionSesion

```
model InscripcionSesion {
  id            String   @id @default(cuid())
  inscripcionId String
  sesionId      String
  creadoEn      DateTime @default(now())

  inscripcion Inscripcion @relation(fields: [inscripcionId], references: [id], onDelete: Cascade)
  sesion      Sesion      @relation(fields: [sesionId],      references: [id], onDelete: Restrict)

  @@unique([inscripcionId, sesionId])
}
```

Un alumno marca varias celdas: lunes 16:00, miércoles 16:00, viernes 16:00 son
tres renglones.

### 5.6 Cargo gana el curso

```
model Cargo {
  ...
  tipoCursoId String
  @@unique([inscripcionId, periodoId, tipoCursoId])   // antes: [inscripcionId, periodoId]
}
```

Con precios distintos por curso, un cargo **tiene que decir de qué curso es**.
Y así una persona puede llevar `Personalizado` y `Curso Niños` a la vez, cada
uno con su cobro. Sin este campo habría que prohibir que alguien esté en dos
cursos, y el nombre "Personalizado" sugiere que sí va a pasar.

El campo es obligatorio, así que los cargos que ya existen necesitan uno. La
migración se los pone a partir del curso de las sesiones que el alumno tenga
tras el Tramo 2. Un cargo cuyo alumno haya quedado sin sesiones se queda con el
curso que corresponda a su categoría actual — `Curso Niños` para `NINOS`,
`Curso Adultos` para `GENERAL` — para que ninguna fila quede huérfana.

### 5.7 Qué pasa con `Grupo`

`Grupo` queda reemplazado por `TipoCurso` + `Sesion`. Se retira en el Tramo 2:
los alumnos con `grupoId` se migran a `InscripcionSesion`, y después se elimina
la columna y la tabla. No se borra antes de migrar.

---

## 6. Reglas de negocio

**Cupo.** Al inscribir a una sesión se cuentan los `InscripcionSesion` activos
de esa sesión. Si llegó a `cupoMaximo`, se rechaza con un mensaje claro. Esto
convierte en verdad una frase que hoy la pantalla dice y no cumple.

**Forma de cobro.** Al generar los cargos del periodo:

| Forma | Comportamiento |
|---|---|
| `MENSUAL` | Un cargo cada mes, como hoy |
| `ANUAL` | Un solo cargo por ciclo, al inscribirse |
| `ÚNICO` | Un solo cargo, al inscribirse, y nunca más |

**Quien entra a media temporada paga completo.** Un `ANUAL` que se inscribe en
septiembre paga el año entero, no la parte que falta. No hay prorrateo. Es la
regla más simple y la más fácil de explicar en ventanilla; si la delegación
quiere prorratear, se decide antes del Tramo 3 porque cambia el cálculo.

`generarCargosDelPeriodo` deja de cobrarle a toda inscripción activa a ciegas:
pregunta primero qué cursos lleva el alumno y qué forma de cobro tiene cada uno.

**Precio.** Sale de `Tarifa` por (ciclo, tipo de curso, forma de cobro). Ya no de
la categoría del alumno.

**Sin tarifa no hay cargo.** Si un curso no tiene fila de tarifa, no se le genera
cargo a nadie y se avisa en el panel. Es preferible a inventar un precio.

---

## 7. Pantallas

Todas bajo `/panel/admin`, visibles para `SUPERADMIN` y `ADMINISTRADOR`.

**Tipos de curso.** Los cuatro, editables en nombre, orden y activo. La clave no
se edita.

**Catálogo de horarios.** Alta, baja y activación de franjas. Una franja usada
por alguna sesión no se borra: se desactiva.

**Rejilla por curso.** El corazón de la configuración:

```
CURSO NIÑOS
                  L     M     X     J     V     S     D
   15:00—16:00   [x]   [ ]   [x]   [ ]   [x]   [ ]   [ ]
   16:00—17:00   [x]   [x]   [x]   [x]   [x]   [ ]   [ ]
   17:00—18:00   [ ]   [ ]   [ ]   [ ]   [ ]   [ ]   [ ]   ← en catálogo, sin ocupar

SALVAVIDAS
                  L     M     X     J     V     S     D
   08:00—12:00   [ ]   [ ]   [ ]   [ ]   [ ]   [x]   [ ]
```

Cada celda marcada abre su campo de cupo.

**Costos.** Una tabla: curso, forma de cobro, precio. Con un aviso visible
mientras el Tramo 3 no esté hecho: *"La forma de cobro todavía no la obedece el
motor; por ahora todo se cobra mensual."* Se dice con todas sus letras y no se
deja mudo, que es justo el defecto de `Grupo.dias`.

---

## 8. Seeders

Requisito explícito: **nada se captura a mano.** Lo local es desechable y
producción se va a poblar desde aquí.

El seed actual se parte en dos, porque hoy mezcla el catálogo que producción
necesita con 32 alumnos inventados que producción no debe recibir jamás:

**`prisma/seed.ts` — base.** Lo que va a producción:

- Usuarios del personal
- Ciclo anual, periodos y días inhábiles
- **Los cuatro tipos de curso**, por clave
- **El catálogo de horarios**
- **Las sesiones** — la rejilla de arranque, con Salvavidas solo en sábado
- **Los tipos de pago** — `Pago único`, `Pago recurrente`
- **Las frecuencias** — Mensual (1), Trimestral (3), Semestral (6), Anual (12)
- **Las tarifas** por curso, tipo de pago y frecuencia
- Lockers, descuentos y comisiones

**`prisma/seed-demo.ts` — solo local.** Los 32 alumnos de ejemplo con sus cargos
y pagos. Nunca se corre en producción.

Ambos idempotentes por clave estable: correrlos dos veces no duplica nada.
`package.json` gana `db:seed:demo` junto al `db:seed` que ya existe.

### Un defecto del seeder actual que hay que arreglar aquí

El seed siembra usuarios **buscando por correo**
(`prisma.usuario.upsert({ where: { email } })`). Eso no es idempotente cuando el
correo cambia: la base de desarrollo tiene hoy
`recepcion@cruzrojacancun.org` y `profesor@cruzrojacancun.org`, mientras el seed
ya dice `@demo.local`. **Correr `npm run db:seed` ahora no corrige esos dos
renglones: crea dos usuarios más y deja cinco.**

Es exactamente el problema que la `clave` estable resuelve en los catálogos. Los
usuarios del personal reciben el mismo tratamiento: una clave que no cambia
aunque cambien correo y nombre. El correo de Root queda fuera de esto — lo fija
`ROOT_EMAIL`, no el seeder.

---

## 9. Tramos de implementación

El orden **no es preferencia, es una cadena obligada**: el motor no puede cobrar
por curso hasta que se sepa en qué curso está cada alumno, y ese vínculo hoy no
existe.

| Tramo | Contenido | Toca dinero |
|---|---|---|
| **0. Roles** | Renombre a `CAPTURISTA`, Root por `ROOT_EMAIL`, `esAdministrativo`, candados contra suplantación de Root | No |
| **1. Configuración** | `TipoCurso`, `Horario`, `Sesion`, `TipoPago`, `FrecuenciaPago`, `Tarifa` nueva, las pantallas, seeders partidos | No |
| **2. Inscripción** | `InscripcionSesion`, cupo real, alta / padrón / ficha, retiro de `Grupo` | No |
| **3. Motor de cobro** | Tipo de pago y frecuencia obedecidos, `Cargo.tipoCursoId`, precio por curso | Sí |

El Tramo 0 se separa porque es corto, es de seguridad y no depende de nada más.
Conviene tenerlo cerrado antes de abrir pantallas nuevas de configuración.

Cada tramo lleva su propio plan de implementación y se hace con TDD: primero las
pruebas que fallan, después el código.

---

## 10. Riesgos

| Riesgo | Mitigación |
|---|---|
| **Alguien adopta el correo de Root y escala privilegios** | La pantalla de usuarios rechaza ese correo siempre; Root no se edita desde el panel |
| `ROOT_EMAIL` sin definir deja a todos como Root, o a nadie | Falla cerrado: sin la variable, no hay Root. Con prueba |
| Root bloqueado fuera del panel por las tres igualdades exactas | Función única `esAdministrativo` + prueba de los cuatro casos |
| El renombre `RECEPCION` → `CAPTURISTA` deja apariciones sueltas | Las 14 se cambian en el mismo tramo; el enum de Postgres obliga a migración explícita |
| El motor de cobro es lo único que maneja dinero y ya está probado | Va al final, en su propio tramo, con las 83 pruebas actuales corriendo |
| Perder el precio **programado** por mes al mover la tarifa al ciclo | Señalado arriba: hay que confirmarlo antes de migrar |
| Migrar los alumnos que hoy tienen `grupoId` | Se migran a `InscripcionSesion` **antes** de borrar nada |
| Confundir `TipoCurso` con `Categoria` y descomponer las tarifas | Son ejes distintos y así quedan: un Salvavidas es categoría `GENERAL` |
| El seeder duplica usuarios al cambiar un correo | Clave estable por usuario, como en los catálogos |

---

## 11. Decisiones pendientes

1. **¿Qué implica cerrar un periodo?** La función no existe y hay que definirla:
   si congela las fechas límite, si bloquea cargos nuevos, y si se pueden
   registrar pagos de un mes ya cerrado. Esa última es la que más pesa: en la
   vida real la gente paga tarde.
2. **¿Falta una quinta atribución de Root?** Quedó marcada como existente pero
   sin decir cuál.
3. ¿Se acepta perder el precio **programado por adelantado** para cada mes? El
   precio se sigue pudiendo cambiar cuando quieran, y los cargos ya emitidos
   nunca se mueven. Lo único que se va es dejar agendado hoy que octubre cueste
   distinto.
4. ¿Los precios y cupos reales de arranque, para sembrarlos? Mientras no los
   haya, el seeder usa los actuales — Niños $600, Adultos $770 — y deja
   `Personalizado` y `Salvavidas` marcados como pendientes de confirmar.
5. ¿`Personalizado` se cobra por sesión, o es una mensualidad como los demás con
   horario a la medida? El nombre admite las dos lecturas y cambia su tarifa.
