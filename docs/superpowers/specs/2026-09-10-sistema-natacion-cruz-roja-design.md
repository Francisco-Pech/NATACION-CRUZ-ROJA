# Sistema de Control de Pagos — Natación
## Cruz Roja Mexicana, Delegación Cancún

**Fecha:** 2026-09-10
**Estado:** Diseño aprobado, pendiente de plan de implementación
**Naturaleza:** Obra de caridad. Sin presupuesto de operación.

---

## 1. Problema

La escuela de natación de la delegación cobra una mensualidad y renta lockers,
pero no tiene forma de saber quién pagó. La cobranza se lleva de memoria y en
papel. Nadie puede responder con certeza tres preguntas básicas:

1. ¿Esta persona que va a entrar a la alberca está al corriente?
2. ¿Cuánto se cobró este mes y cuánto falta?
3. ¿Quién pidió factura y ya se la hicieron?

Además, los únicos métodos de pago son efectivo y transferencia, lo que obliga
a la gente a ir a la delegación o a mandar comprobantes por mensaje.

## 2. Objetivos

- Que cada alumno tenga un **folio y un código QR** que respondan al instante
  si está al corriente.
- Que se pueda **pagar en línea**, sin que la delegación absorba la comisión.
- Que Recepción vea **en un tablero** cómo va la cobranza del mes.
- Que las **solicitudes de factura** dejen de perderse.
- Que los **profesores** puedan dar o negar el paso a la alberca, y llevar
  asistencia.

## 3. No objetivos

Se excluyen deliberadamente, para mantener el sistema pequeño y mantenible:

- **Timbrado de CFDI.** El sistema registra solicitudes y su estatus; el
  timbrado lo sigue haciendo contabilidad en su sistema actual.
- **Notificaciones salientes.** No se manda correo, WhatsApp, SMS ni
  recordatorios. Toda la información se consulta: el alumno abre su QR,
  Recepción abre el panel.
- **Cobranza automática.** No hay domiciliación ni cargos recurrentes.
- **Gestión de instructores.** No se asignan profesores a grupos ni se lleva
  su nómina u horario laboral.
- **Contabilidad.** El sistema informa lo cobrado; no lleva libros ni concilia
  contra el estado de cuenta bancario.

## 4. Restricciones

| Restricción | Consecuencia de diseño |
|---|---|
| **Costo cero permanente**, también en producción | Todo vive en planes gratuitos que no expiran. Nada de servicios con periodo de prueba |
| La cámara del celular debe leer QRs | **HTTPS obligatorio**. Sin él los navegadores bloquean la cámara |
| Operado por personal no técnico | Sin instalaciones ni apps. Todo desde el navegador |
| Se manejan datos de menores de edad | Aviso de privacidad y visibilidad limitada por rol (LFPDPPP) |

## 5. Infraestructura

| Pieza | Servicio | Plan |
|---|---|---|
| Aplicación web y API | **Next.js en Vercel** | Gratuito permanente, HTTPS y dominio incluidos |
| Base de datos | **PostgreSQL en Neon** | Gratuito permanente |
| Comprobantes de pago (imágenes) | **Cloudinary** | Gratuito |
| Generación de cargos mensuales | **Vercel Cron** | Gratuito |
| Cobros en línea | **Stripe** | Sin renta; cobra por transacción |

**Dominio inicial:** `natacion-cruzroja-cancun.vercel.app`. Si la delegación
consigue uno propio, se apunta sin cambiar nada del sistema.

**Stack:** Next.js (App Router) con TypeScript, Prisma como ORM, MUI para la
interfaz. Autenticación propia por sesión para el personal; los alumnos no
tienen cuenta.

## 6. Roles

| Rol | Alcance |
|---|---|
| **Administrador** | Todo lo de Recepción, más tarifas, descuentos, periodos, días festivos, configuración de comisiones, usuarios y reportes |
| **Recepción** | Alta de alumnos, credenciales, registro y validación de pagos, lockers, grupos, estatus de facturación |
| **Profesor** | Escaneo de QR (semáforo) y asistencia. **No ve importes, teléfonos ni domicilios** |
| **Alumno** | Sin cuenta. Accede solo por el token de su QR, y solo a lo suyo |

---

## 7. Modelo de datos

La decisión estructural más importante es separar **la persona** de **su
inscripción de cada año**. La delegación rehace trámites al cerrar el año, y
el folio lleva el año dentro. Si el folio viviera en el alumno, cada renovación
destruiría el historial.

### Alumno
La persona. Nace con lo mínimo y se completa después.

- `nombreCompleto` — **único dato obligatorio al dar de alta**
- `fechaNacimiento`, `telefono`, `email`, `direccion`
- `contactoEmergenciaNombre`, `contactoEmergenciaTelefono`
- `condicionesMedicas` — texto libre, relevante en una alberca
- `categoria` — `NINOS` | `GENERAL`
- `datosFiscales` — RFC, razón social, CP, régimen, uso de CFDI. Se capturan
  una sola vez; en solicitudes posteriores se muestran para confirmar o editar
- `datosCompletos` — bandera; falso hasta que el alumno llena su información

### CicloAnual
- `anio` (2026, 2027…), `estado` (`ABIERTO` | `CERRADO`)
- Al cerrar un ciclo, sus inscripciones quedan históricas y de solo lectura

### Inscripcion
El alumno dentro de un ciclo. **Aquí viven el folio y el QR.**

- `alumnoId`, `cicloAnualId`, `grupoId`
- `folio` — formato `CRM-{anio}-{consecutivo}`, p. ej. `CRM-2026-0042`
- `tokenQR` — **cadena aleatoria de 32+ bytes**, no derivada del folio
- `descuentoId` — opcional
- `estado` — `ACTIVA` | `BAJA`

> El token es aleatorio a propósito. Si el QR codificara el folio, cualquiera
> podría cambiar un dígito y abrir el estado de cuenta de otra persona.

### Periodo
Un mes dentro de un ciclo.

- `cicloAnualId`, `mes` (1-12), `clave` (`2026-03`)
- `fechaLimite` — **calculada como el 5º día hábil del mes**, descontando fines
  de semana y el catálogo de días festivos. Editable manualmente por excepción
- `recargo` — monto por pago tardío. **$50 por defecto, configurable por periodo**
- `estado` — `ABIERTO` | `CERRADO`

### DiaInhabil
- `fecha`, `descripcion`
- Necesario porque el 5º día hábil de diciembre no cae igual que el de marzo

### Tarifa
- `periodoId`, `categoria` (`NINOS` | `GENERAL`), `monto`
- **Precio vigente por mes y por año.** Cambiar el precio nunca altera meses ya
  cobrados

### PrecioLocker
- `periodoId`, `monto` — $100 por defecto, variable por periodo

### Descuento
- `nombre` (INAPAM, Beca, Especial), `tipo` (`PORCENTAJE` | `MONTO_FIJO`)
- `valor`, `vigenciaDesde`, `vigenciaHasta`, `activo`
- Se asigna a la inscripción. Nuevos descuentos se dan de alta sin tocar código

### Grupo
- `nombre`, `dias` (L-V), `horaInicio`, `horaFin`, `cupoMaximo`
- El sistema **rechaza inscribir por encima del cupo**
- Horarios de 7:00 a 22:00, lunes a viernes

### Locker
- `numero`, `activo`
- Catálogo físico de lockers numerados

### AsignacionLocker
- `lockerId`, `inscripcionId`, `periodoId`
- **Un locker no puede asignarse dos veces en el mismo periodo.** Restricción
  única sobre (`lockerId`, `periodoId`)
- Un alumno puede tener varios, mientras haya disponibles

### Cargo
El estado de cuenta de un alumno en un mes. Es la entidad central.

- `inscripcionId`, `periodoId` — únicos en conjunto
- `montoMensualidad`, `montoLockers`, `montoDescuento`, `montoRecargo`
- `montoNeto` — lo que Cruz Roja debe recibir
- `estado` — ver máquina de estados
- `recargoAplicadoEn` — fecha en que se agregó el recargo

### Pago
- `cargoId`, `metodo` — `EFECTIVO` | `TRANSFERENCIA` | `TARJETA` | `SPEI` | `OXXO`
- `montoCobrado` — lo que pagó la persona (incluye la comisión trasladada)
- `montoComision` — lo que se llevó Stripe
- `montoNeto` — **lo que realmente llegó a Cruz Roja**
- `referencia`, `comprobanteUrl`, `stripePaymentIntentId`
- `estado` — `EN_REVISION` | `CONFIRMADO` | `RECHAZADO`
- `registradoPorId`, `validadoPorId`, `fechaPago`

> Guardar los tres montos por separado es lo que permite el reporte de
> cobranza: cuánto entró bruto, cuánto se fue en comisiones y cuánto quedó.

### SolicitudFactura
- `cargoId`, `datosFiscales` — **copia congelada** al momento de solicitar
- `estado` — `SOLICITADA` | `EN_PROCESO` | `FACTURADA` | `CANCELADA`
- `atendidaPorId`, `notas`

> Los datos fiscales se copian, no se referencian. Si el alumno corrige su RFC
> en marzo, la factura de enero debe conservar el RFC con el que se emitió.

### Asistencia
- `inscripcionId`, `fecha`, `registradaPorId`
- El profesor la marca a mano. **El mes en curso permanece siempre editable**
  para corregir días pasados; los meses cerrados no

### Usuario
- `nombre`, `email`, `passwordHash`, `rol`, `activo`

### ConfigComision
- `metodo`, `porcentaje`, `montoFijo`, `iva`, `activo`
- `diasCorteAntesDeVencimiento` — solo aplica a OXXO, **3 por defecto**

> Las tarifas de Stripe **no van en el código**. Cambian por contrato y por
> método, y deben poder ajustarse desde el panel.

---

## 8. Motor de cobro

### 8.1 Generación mensual

Un cron diario revisa si hay un periodo abierto sin cargos generados y, de
haberlo, crea un `Cargo` por cada inscripción activa:

```
montoNeto = tarifa(categoría, periodo)
          + (lockers asignados × precioLocker(periodo))
          − descuento
          + recargo (si ya venció)
```

El descuento se aplica sobre la mensualidad, no sobre los lockers.

### 8.2 Recargo por pago tardío

Al pasar `fechaLimite`, los cargos pendientes reciben el recargo ($50 por
defecto) y pasan a `VENCIDO`.

**La deuda no se arrastra.** Un mes no pagado queda marcado así para siempre en
el historial, pero **no afecta al mes siguiente**: cada periodo nace limpio.
Esto es una regla de negocio explícita de la delegación, no un descuido.

### 8.3 Traslado de la comisión

Cruz Roja necesita recibir sus $770 completos. Cobrar $770 con tarjeta le
dejaría ~$734. El sistema resuelve el problema inverso: dado un neto deseado,
¿cuánto hay que cobrar?

Partiendo de que la comisión es `total × porcentaje + fijo`, más IVA sobre esa
comisión:

```
neto = total − (total × p + f) × (1 + iva)
```

Despejando el total:

```
total = (neto + f × (1 + iva)) ÷ (1 − p × (1 + iva))
```

El resultado se **redondea hacia arriba al peso**, y la diferencia por redondeo
queda a favor de la delegación.

**Ejemplo** — $770 netos con tarjeta (3.6% + $3, IVA 16%):

```
total = (770 + 3 × 1.16) ÷ (1 − 0.036 × 1.16)
      = 773.48 ÷ 0.95824
      = 807.19  →  se cobran $808
```

Cruz Roja recibe sus $770. El sistema guarda los tres montos por separado.

> **Presentación al usuario:** en pantalla se muestran **precios por método**
> ("Efectivo o transferencia: $770 · Pago en línea: $808"), nunca como
> "770 + comisión". Las reglas de las marcas de tarjetas en México restringen
> el recargo explícito por pagar con tarjeta; el precio diferenciado es la
> forma aceptada y equivale a lo mismo.

**Efectivo y transferencia directa no llevan comisión:** se cobra el neto.

### 8.4 Corte de OXXO

El pago en OXXO tarda en confirmarse. Si alguien paga el mismo día del
vencimiento, el dinero no se refleja a tiempo y el sistema lo marcaría como
moroso injustamente.

Por eso **OXXO deja de ofrecerse `diasCorteAntesDeVencimiento` días antes de la
fecha límite** (3 por defecto). Pasado ese corte, al alumno solo se le muestran
tarjeta y SPEI, con una nota explicando por qué, y la opción de subir un
comprobante.

---

## 9. Máquinas de estado

### Cargo

| Estado | Significado | Semáforo |
|---|---|---|
| `PENDIENTE` | Generado, dentro del plazo | Amarillo |
| `EN_REVISION` | Hay un comprobante esperando validación | Azul |
| `PAGADO` | Liquidado y confirmado | **Verde** |
| `VENCIDO` | Pasó la fecha límite sin pago. Lleva recargo | **Rojo** |
| `CANCELADO` | Anulado por Administrador, con motivo | Gris |

Transiciones válidas:

```
PENDIENTE  → EN_REVISION | PAGADO | VENCIDO | CANCELADO
EN_REVISION → PAGADO | PENDIENTE (rechazado) | VENCIDO
VENCIDO    → EN_REVISION | PAGADO | CANCELADO
PAGADO     → (terminal, salvo cancelación por Administrador con motivo)
```

**Para el profesor solo existen dos colores:** verde si está `PAGADO`, rojo en
cualquier otro caso. La decisión en la puerta es binaria.

### SolicitudFactura

```
SOLICITADA → EN_PROCESO → FACTURADA
          ↘ CANCELADA  ↙
```

Todas las transiciones son **manuales**, hechas por Recepción o Administrador.
El alumno ve el estatus en su página y sabe si ya quedó, sin preguntar.

---

## 10. Interfaces

El sistema tiene tres caras, con necesidades muy distintas.

### 10.1 Página del alumno — `/q/{tokenQR}`

Se abre escaneando el QR. **Sin contraseña.** Pensada para el celular, con
conexión mala y gente que no es técnica.

- **Encabezado:** nombre, folio, y el semáforo del mes en curso, grande
- **Primera visita:** formulario para completar sus datos. Se le pide una sola
  vez y no bloquea el pago
- **Estado de cuenta del mes:** desglose de mensualidad, lockers, descuento y
  recargo si aplica
- **Pagar:** precios diferenciados por método. Tarjeta y SPEI siempre; OXXO
  solo antes del corte
- **Subir comprobante:** para transferencia directa. Queda `EN_REVISION`
- **Pedir factura:** si ya tiene datos fiscales, se le muestran para confirmar
  o editar. Después ve el estatus de su solicitud
- **Historial:** meses anteriores del ciclo, con comprobantes imprimibles

### 10.2 Panel administrativo — Administrador y Recepción

- **Tablero:** cobranza del mes en curso de un vistazo
- **Alumnos:** padrón, alta rápida (solo nombre), ficha completa
- **Credencial imprimible:** nombre, folio y QR, lista para imprimir y entregar
  en mano. Reimprimible sin cambiar el token, así la credencial vieja sigue
  sirviendo
- **Pagos por validar:** bandeja de comprobantes subidos, con la imagen a la
  vista para aprobar o rechazar
- **Registro de pago manual:** efectivo o transferencia, con comprobante
- **Lockers:** mapa de ocupación del mes, asignar y liberar
- **Grupos:** horarios y cupo, con alerta al llenarse
- **Facturación:** bandeja de solicitudes con cambio de estatus
- **Solo Administrador:** tarifas por periodo, precio de lockers, descuentos,
  días festivos, configuración de comisiones, usuarios, cierre de ciclo

### 10.3 Vista del profesor

- **Escáner:** abre la cámara y lee el QR. Al leerlo, **pantalla completa con
  el semáforo**: foto si la hay, nombre, verde o rojo, y el mes al que
  corresponde. Nada más
- **Respaldo:** búsqueda por folio o nombre, para cuando el QR está borrado o
  la cámara falla
- **Asistencia:** lista de alumnos con casilla por día. **El mes en curso
  siempre editable**; los meses cerrados, de solo lectura

> El profesor **no ve importes, teléfonos, domicilios ni datos fiscales.** Para
> dejar pasar a alguien basta saber si está al corriente.

---

## 11. Reportes

Los tres son exportables a CSV/Excel.

### Cobranza del mes
- Esperado vs cobrado vs faltante
- Desglose por método: efectivo, transferencia, tarjeta, SPEI, OXXO
- **Total pagado en comisiones** y neto real recibido
- Conteo de alumnos al corriente y morosos, con la lista de quién falta
- Recargos cobrados

### Solicitudes de facturación
- Del periodo elegido, con datos fiscales completos y monto
- Filtrable por estatus
- Exportable para que contabilidad timbre en su sistema

### Ocupación de lockers
- Ocupados, libres y porcentaje de ocupación del mes
- Quién tiene cuál
- Ingreso generado por lockers

---

## 12. Seguridad y privacidad

**Se manejan datos personales de menores de edad.** Esto obliga a cumplir la
Ley Federal de Protección de Datos Personales en Posesión de los Particulares.

- **Aviso de privacidad** visible en el formulario donde el alumno o su tutor
  captura los datos, con consentimiento explícito
- **Minimización por rol:** el profesor solo ve nombre, foto y semáforo. Los
  datos de contacto y fiscales quedan reservados a Recepción y Administrador
- **Token del QR:** aleatorio de 32+ bytes, imposible de adivinar o enumerar.
  Da acceso únicamente al estado de cuenta de esa inscripción, nunca al padrón
- **Sin datos de tarjeta en el sistema.** Todo lo procesa Stripe; el sistema
  solo guarda el identificador de la transacción
- **Contraseñas** con hash (bcrypt o argon2). Sesiones con expiración
- **Bitácora** de quién registró, validó o canceló cada pago
- **Webhooks de Stripe** con verificación de firma, para que nadie pueda
  simular un pago confirmado

---

## 13. Fases de entrega

### Fase 1 — Núcleo cobrable
Ciclos, periodos con cálculo de días hábiles, alta de alumnos, folio y QR,
credencial imprimible, tarifas, lockers, generación de cargos, recargo
automático, página del alumno, registro manual de pagos, y semáforo del
profesor.

*Al terminar esta fase el sistema ya resuelve el problema principal y es
demostrable ante la delegación, aun sin pagos en línea.*

### Fase 2 — Pagos en línea
Integración con Stripe (tarjeta, SPEI, OXXO), cálculo de comisión trasladada,
webhooks con verificación de firma, corte de OXXO, y subida de comprobantes
con bandeja de validación.

### Fase 3 — Operación completa
Grupos con cupo, asistencia, descuentos, solicitudes de facturación con
estatus, y los tres reportes con exportación.

---

## 14. Supuestos

Decisiones tomadas por ausencia de indicación contraria. Cualquiera puede
corregirse sin rediseñar:

1. **Tres roles**, fusionando "Cobros" dentro de Recepción. Si Profesor no se
   necesita, se desactiva sin afectar lo demás.
2. **Tarifas de Stripe:** se usan 3.6% + $3 MXN + IVA como referencia de
   cálculo. **Deben confirmarse contra el contrato real de la delegación** y
   ajustarse en el panel. No están escritas en el código.
3. **Categorías de alumno:** `NINOS` y `GENERAL`. Los descuentos (INAPAM,
   beca) se modelan aparte, como catálogo, porque aún no están confirmados.
4. **El descuento aplica sobre la mensualidad**, no sobre los lockers.
5. **Un alumno pertenece a un grupo** a la vez dentro de un ciclo.
6. **El horario no altera el precio.** Solo la categoría lo hace.
7. **La foto del alumno es opcional.** Si no hay, el semáforo muestra iniciales.

## 15. Dependencias externas

Fuera del control del desarrollo, conviene arrancarlas desde ya:

1. **Cuenta de Stripe** a nombre de la asociación, con RFC y datos bancarios.
   La verificación tarda y **bloquea la Fase 2**.
2. **Catálogo de lockers:** cuántos hay y cómo están numerados.
3. **Grupos y horarios reales**, con su cupo.
4. **Confirmación de descuentos** vigentes (INAPAM u otros).
5. **Padrón actual de alumnos**, si se quiere migrar en lugar de capturar.
