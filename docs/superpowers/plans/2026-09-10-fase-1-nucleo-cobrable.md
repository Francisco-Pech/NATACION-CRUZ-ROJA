# Fase 1 — Núcleo Cobrable · Plan de Implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que la delegación pueda dar de alta alumnos, entregarles una credencial con QR, generar los cargos del mes, registrar pagos en efectivo y transferencia, y que un profesor sepa en la puerta si alguien está al corriente.

**Architecture:** Next.js App Router como aplicación única (páginas y API en el mismo proyecto), Prisma sobre PostgreSQL. La lógica de negocio vive en módulos puros bajo `src/lib/` —sin acceso a base de datos ni a React— para poder probarla directamente con Vitest. Las rutas y componentes solo orquestan: leen, llaman a la lógica pura y escriben.

**Tech Stack:** Next.js 16 (App Router, TypeScript), Prisma 7, PostgreSQL 16 en Docker, MUI 9, Vitest 5, bcryptjs, `qrcode`, `html5-qrcode`.

**Spec:** `docs/superpowers/specs/2026-09-10-sistema-natacion-cruz-roja-design.md`

## Global Constraints

- **Costo cero permanente.** Ninguna dependencia de servicios de pago o con periodo de prueba. En local, los comprobantes se guardan en disco.
- **Moneda:** todos los montos en **centavos, como enteros**. Nunca `float` para dinero.
- **Zona horaria:** `America/Cancun` (UTC-5, sin horario de verano) para todo cálculo de fechas límite.
- **Idioma:** toda la interfaz y los mensajes en **español de México**. Los identificadores del código también en español (`calcularFechaLimite`, `montoNeto`), para que coincidan con el dominio.
- **Sin notificaciones salientes.** Nada de correo, WhatsApp ni SMS.
- **El profesor nunca ve importes, teléfonos, domicilios ni datos fiscales.**
- **Token del QR:** 32 bytes aleatorios, en base64url. Jamás derivado del folio.
- **Formato de folio:** `CRM-{anio}-{consecutivo de 4 dígitos}` → `CRM-2026-0042`.
- **Usuario administrador de pruebas:** `«el de ADMIN_EMAIL»`.

---

### Task 1: Andamiaje del proyecto

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.ts`, `vitest.config.ts`
- Create: `compose.yaml`, `.env.example`, `.env`
- Create: `src/app/layout.tsx`, `src/app/page.tsx`
- Test: `tests/andamiaje.test.ts`

**Interfaces:**
- Consumes: nada
- Produces: scripts `npm run dev`, `npm test`, `npm run db:up`. El cliente Prisma se crea en la Tarea 6, junto con el esquema.

- [ ] **Step 1: Crear el proyecto Next.js**

```bash
npx create-next-app@latest . --typescript --app --no-tailwind --no-eslint --src-dir --import-alias "@/*" --use-npm --yes
npm install @prisma/client @mui/material @emotion/react @emotion/styled @mui/icons-material bcryptjs qrcode
npm install -D prisma vitest @types/bcryptjs @types/qrcode tsx
```

- [ ] **Step 2: Definir PostgreSQL en Docker**

`compose.yaml`:
```yaml
services:
  db:
    image: postgres:16-alpine
    container_name: natacion-db
    environment:
      POSTGRES_USER: natacion
      POSTGRES_PASSWORD: natacion_local
      POSTGRES_DB: natacion
    ports:
      - "5433:5432"
    volumes:
      - natacion_pgdata:/var/lib/postgresql/data
volumes:
  natacion_pgdata:
```

Se usa el puerto **5433** para no chocar con un PostgreSQL que ya estuviera corriendo en el 5432.

`.env.example` (y copiar a `.env`):
```
DATABASE_URL="postgresql://natacion:natacion_local@localhost:5433/natacion"
SESSION_SECRET="cambiar-en-produccion"
TZ="America/Cancun"
```

- [ ] **Step 3: Configurar Vitest**

`vitest.config.ts`:
```typescript
import { defineConfig } from 'vitest/config'
import path from 'node:path'

export default defineConfig({
  test: { environment: 'node', include: ['tests/**/*.test.ts'] },
  resolve: { alias: { '@': path.resolve(__dirname, 'src') } },
})
```

Agregar a `package.json`:
```json
"scripts": {
  "dev": "next dev",
  "build": "next build",
  "start": "next start",
  "test": "vitest run",
  "db:up": "docker compose up -d",
  "db:migrate": "prisma migrate dev",
  "db:seed": "tsx prisma/seed.ts"
}
```

- [ ] **Step 4: Escribir la prueba de humo**

`tests/andamiaje.test.ts`:
```typescript
import { describe, it, expect } from 'vitest'

describe('andamiaje', () => {
  it('corre en zona horaria de Cancún', () => {
    expect(process.env.TZ).toBe('America/Cancun')
  })
})
```

- [ ] **Step 5: Verificar que todo levanta**

```bash
npm run db:up && docker compose ps
npm test
```
Esperado: contenedor `natacion-db` arriba y la prueba en verde.

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "chore: andamiaje Next.js, Prisma, Postgres y Vitest"
```

---

### Task 2: Cálculo de la fecha límite (días hábiles)

Es la regla de negocio más delicada de todo el sistema: define quién es moroso. Se implementa como función pura, sin base de datos.

**Files:**
- Create: `src/lib/dias-habiles.ts`
- Test: `tests/dias-habiles.test.ts`

**Interfaces:**
- Consumes: nada
- Produces:
  - `esDiaHabil(fecha: Date, festivos: Date[]): boolean`
  - `calcularFechaLimite(anio: number, mes: number, diasHabiles: number, festivos: Date[]): Date` — `mes` de 1 a 12; devuelve el último instante (23:59:59) del n-ésimo día hábil

- [ ] **Step 1: Escribir las pruebas que fallan**

`tests/dias-habiles.test.ts`:
```typescript
import { describe, it, expect } from 'vitest'
import { esDiaHabil, calcularFechaLimite } from '@/lib/dias-habiles'

const f = (s: string) => new Date(`${s}T12:00:00`)

describe('esDiaHabil', () => {
  it('reconoce un lunes como hábil', () => {
    expect(esDiaHabil(f('2026-03-02'), [])).toBe(true)
  })
  it('descarta sábado y domingo', () => {
    expect(esDiaHabil(f('2026-03-07'), [])).toBe(false)
    expect(esDiaHabil(f('2026-03-08'), [])).toBe(false)
  })
  it('descarta un día festivo del catálogo', () => {
    expect(esDiaHabil(f('2026-03-16'), [f('2026-03-16')])).toBe(false)
  })
})

describe('calcularFechaLimite', () => {
  it('marzo 2026 sin festivos: 1=dom, hábiles 2,3,4,5,6 -> 6 de marzo', () => {
    const limite = calcularFechaLimite(2026, 3, 5, [])
    expect(limite.getFullYear()).toBe(2026)
    expect(limite.getMonth()).toBe(2)
    expect(limite.getDate()).toBe(6)
  })

  it('recorre la fecha cuando hay un festivo de por medio', () => {
    const limite = calcularFechaLimite(2026, 3, 5, [f('2026-03-04')])
    expect(limite.getDate()).toBe(9)
  })

  it('el límite termina al final del día', () => {
    const limite = calcularFechaLimite(2026, 3, 5, [])
    expect(limite.getHours()).toBe(23)
    expect(limite.getMinutes()).toBe(59)
  })

  it('enero 2026: 1=jue festivo, 2=vie, hábiles 2,5,6,7,8 -> 8 de enero', () => {
    const limite = calcularFechaLimite(2026, 1, 5, [f('2026-01-01')])
    expect(limite.getDate()).toBe(8)
  })
})
```

- [ ] **Step 2: Verificar que fallan**

Run: `npx vitest run tests/dias-habiles.test.ts`
Esperado: FAIL, "Failed to resolve import @/lib/dias-habiles"

- [ ] **Step 3: Implementar**

`src/lib/dias-habiles.ts`:
```typescript
const mismoDia = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate()

export function esDiaHabil(fecha: Date, festivos: Date[]): boolean {
  const dia = fecha.getDay()
  if (dia === 0 || dia === 6) return false
  return !festivos.some((festivo) => mismoDia(festivo, fecha))
}

export function calcularFechaLimite(
  anio: number,
  mes: number,
  diasHabiles: number,
  festivos: Date[],
): Date {
  let contados = 0
  const cursor = new Date(anio, mes - 1, 1, 23, 59, 59, 999)

  while (true) {
    if (esDiaHabil(cursor, festivos)) {
      contados++
      if (contados === diasHabiles) return cursor
    }
    cursor.setDate(cursor.getDate() + 1)
  }
}
```

- [ ] **Step 4: Verificar que pasan**

Run: `npx vitest run tests/dias-habiles.test.ts`
Esperado: PASS, 7 pruebas

- [ ] **Step 5: Commit**

```bash
git add src/lib/dias-habiles.ts tests/dias-habiles.test.ts
git commit -m "feat: cálculo de la fecha límite por días hábiles"
```

---

### Task 3: Cálculo del cargo mensual

Función pura que arma el estado de cuenta de un alumno en un mes.

**Files:**
- Create: `src/lib/cargos.ts`
- Test: `tests/cargos.test.ts`

**Interfaces:**
- Consumes: nada
- Produces:
  - `type Descuento = { tipo: 'PORCENTAJE' | 'MONTO_FIJO'; valor: number }`
  - `type EntradaCargo = { tarifa: number; lockers: number; precioLocker: number; descuento?: Descuento | null; recargo?: number }`
  - `type ResultadoCargo = { montoMensualidad, montoLockers, montoDescuento, montoRecargo, montoNeto }` — todos `number`, en centavos
  - `calcularCargo(entrada: EntradaCargo): ResultadoCargo`

- [ ] **Step 1: Escribir las pruebas que fallan**

`tests/cargos.test.ts`:
```typescript
import { describe, it, expect } from 'vitest'
import { calcularCargo } from '@/lib/cargos'

const MENSUALIDAD = 77000   // $770.00
const LOCKER = 10000        // $100.00

describe('calcularCargo', () => {
  it('sin lockers ni descuento cobra solo la mensualidad', () => {
    const r = calcularCargo({ tarifa: MENSUALIDAD, lockers: 0, precioLocker: LOCKER })
    expect(r.montoNeto).toBe(77000)
  })

  it('suma cada locker asignado', () => {
    const r = calcularCargo({ tarifa: MENSUALIDAD, lockers: 2, precioLocker: LOCKER })
    expect(r.montoLockers).toBe(20000)
    expect(r.montoNeto).toBe(97000)
  })

  it('aplica el descuento porcentual solo sobre la mensualidad', () => {
    const r = calcularCargo({
      tarifa: MENSUALIDAD, lockers: 1, precioLocker: LOCKER,
      descuento: { tipo: 'PORCENTAJE', valor: 10 },
    })
    expect(r.montoDescuento).toBe(7700)
    expect(r.montoNeto).toBe(77000 - 7700 + 10000)
  })

  it('aplica el descuento de monto fijo', () => {
    const r = calcularCargo({
      tarifa: MENSUALIDAD, lockers: 0, precioLocker: LOCKER,
      descuento: { tipo: 'MONTO_FIJO', valor: 5000 },
    })
    expect(r.montoNeto).toBe(72000)
  })

  it('nunca deja el descuento por encima de la mensualidad', () => {
    const r = calcularCargo({
      tarifa: MENSUALIDAD, lockers: 0, precioLocker: LOCKER,
      descuento: { tipo: 'MONTO_FIJO', valor: 999999 },
    })
    expect(r.montoDescuento).toBe(77000)
    expect(r.montoNeto).toBe(0)
  })

  it('suma el recargo por pago tardío', () => {
    const r = calcularCargo({
      tarifa: MENSUALIDAD, lockers: 0, precioLocker: LOCKER, recargo: 5000,
    })
    expect(r.montoNeto).toBe(82000)
  })

  it('el recargo no se descuenta', () => {
    const r = calcularCargo({
      tarifa: MENSUALIDAD, lockers: 0, precioLocker: LOCKER, recargo: 5000,
      descuento: { tipo: 'PORCENTAJE', valor: 50 },
    })
    expect(r.montoNeto).toBe(77000 - 38500 + 5000)
  })
})
```

- [ ] **Step 2: Verificar que fallan**

Run: `npx vitest run tests/cargos.test.ts`
Esperado: FAIL

- [ ] **Step 3: Implementar**

`src/lib/cargos.ts`:
```typescript
export type Descuento = { tipo: 'PORCENTAJE' | 'MONTO_FIJO'; valor: number }

export type EntradaCargo = {
  tarifa: number
  lockers: number
  precioLocker: number
  descuento?: Descuento | null
  recargo?: number
}

export type ResultadoCargo = {
  montoMensualidad: number
  montoLockers: number
  montoDescuento: number
  montoRecargo: number
  montoNeto: number
}

export function calcularCargo(entrada: EntradaCargo): ResultadoCargo {
  const montoMensualidad = entrada.tarifa
  const montoLockers = entrada.lockers * entrada.precioLocker
  const montoRecargo = entrada.recargo ?? 0

  let montoDescuento = 0
  if (entrada.descuento) {
    montoDescuento =
      entrada.descuento.tipo === 'PORCENTAJE'
        ? Math.round((montoMensualidad * entrada.descuento.valor) / 100)
        : entrada.descuento.valor
    // El descuento aplica solo a la mensualidad y nunca la vuelve negativa.
    montoDescuento = Math.min(montoDescuento, montoMensualidad)
  }

  return {
    montoMensualidad,
    montoLockers,
    montoDescuento,
    montoRecargo,
    montoNeto: montoMensualidad - montoDescuento + montoLockers + montoRecargo,
  }
}
```

- [ ] **Step 4: Verificar que pasan**

Run: `npx vitest run tests/cargos.test.ts`
Esperado: PASS, 7 pruebas

- [ ] **Step 5: Commit**

```bash
git add src/lib/cargos.ts tests/cargos.test.ts
git commit -m "feat: cálculo del cargo mensual con lockers, descuentos y recargo"
```

---

### Task 4: Traslado de la comisión (cálculo inverso)

Aunque Stripe se conecta hasta la Fase 2, la página del alumno debe mostrar desde ya el precio diferenciado por método. La lógica es pura y barata de probar ahora.

**Files:**
- Create: `src/lib/comisiones.ts`
- Test: `tests/comisiones.test.ts`

**Interfaces:**
- Consumes: nada
- Produces:
  - `type ConfigComision = { porcentaje: number; montoFijo: number; iva: number }` — `porcentaje` e `iva` como fracción (0.036, 0.16); `montoFijo` en centavos
  - `calcularTotalConComision(neto: number, config: ConfigComision): { total: number; comision: number }` — `total` redondeado hacia arriba al peso

- [ ] **Step 1: Escribir las pruebas que fallan**

`tests/comisiones.test.ts`:
```typescript
import { describe, it, expect } from 'vitest'
import { calcularTotalConComision } from '@/lib/comisiones'

const TARJETA = { porcentaje: 0.036, montoFijo: 300, iva: 0.16 }
const SIN_COMISION = { porcentaje: 0, montoFijo: 0, iva: 0.16 }

describe('calcularTotalConComision', () => {
  it('cobra $808 para dejar $770 netos con tarjeta', () => {
    const { total } = calcularTotalConComision(77000, TARJETA)
    expect(total).toBe(80800)
  })

  it('después de la comisión, a la delegación le queda al menos el neto', () => {
    const { total } = calcularTotalConComision(77000, TARJETA)
    const comisionReal = Math.round((total * TARJETA.porcentaje + TARJETA.montoFijo) * (1 + TARJETA.iva))
    expect(total - comisionReal).toBeGreaterThanOrEqual(77000)
  })

  it('sin comisión el total es igual al neto', () => {
    const { total, comision } = calcularTotalConComision(77000, SIN_COMISION)
    expect(total).toBe(77000)
    expect(comision).toBe(0)
  })

  it('redondea hacia arriba al peso completo', () => {
    const { total } = calcularTotalConComision(77000, TARJETA)
    expect(total % 100).toBe(0)
  })

  it('un neto de cero no cobra nada', () => {
    expect(calcularTotalConComision(0, TARJETA).total).toBe(0)
  })
})
```

- [ ] **Step 2: Verificar que fallan**

Run: `npx vitest run tests/comisiones.test.ts`
Esperado: FAIL

- [ ] **Step 3: Implementar**

`src/lib/comisiones.ts`:
```typescript
export type ConfigComision = {
  porcentaje: number
  montoFijo: number
  iva: number
}

/**
 * Resuelve el problema inverso: dado el neto que Cruz Roja debe recibir,
 * cuánto hay que cobrarle a la persona para que la comisión no salga del neto.
 *
 *   neto = total - (total * p + f) * (1 + iva)
 *   total = (neto + f * (1 + iva)) / (1 - p * (1 + iva))
 *
 * El total se redondea hacia arriba al peso; la diferencia queda a favor
 * de la delegación.
 */
export function calcularTotalConComision(
  neto: number,
  config: ConfigComision,
): { total: number; comision: number } {
  if (neto <= 0) return { total: 0, comision: 0 }

  const factorIva = 1 + config.iva
  const divisor = 1 - config.porcentaje * factorIva
  if (divisor <= 0) {
    throw new Error('La comisión configurada consume el total del cobro')
  }

  const exacto = (neto + config.montoFijo * factorIva) / divisor
  const total = Math.ceil(exacto / 100) * 100

  return { total, comision: total - neto }
}
```

- [ ] **Step 4: Verificar que pasan**

Run: `npx vitest run tests/comisiones.test.ts`
Esperado: PASS, 5 pruebas

- [ ] **Step 5: Commit**

```bash
git add src/lib/comisiones.ts tests/comisiones.test.ts
git commit -m "feat: cálculo inverso de la comisión trasladada"
```

---

### Task 5: Folio y token del QR

**Files:**
- Create: `src/lib/folio.ts`
- Test: `tests/folio.test.ts`

**Interfaces:**
- Consumes: nada
- Produces:
  - `formatearFolio(anio: number, consecutivo: number): string` → `CRM-2026-0042`
  - `generarTokenQR(): string` — 32 bytes aleatorios en base64url

- [ ] **Step 1: Escribir las pruebas que fallan**

`tests/folio.test.ts`:
```typescript
import { describe, it, expect } from 'vitest'
import { formatearFolio, generarTokenQR } from '@/lib/folio'

describe('formatearFolio', () => {
  it('rellena el consecutivo a cuatro dígitos', () => {
    expect(formatearFolio(2026, 42)).toBe('CRM-2026-0042')
    expect(formatearFolio(2026, 1)).toBe('CRM-2026-0001')
  })
  it('no trunca consecutivos de más de cuatro dígitos', () => {
    expect(formatearFolio(2026, 12345)).toBe('CRM-2026-12345')
  })
})

describe('generarTokenQR', () => {
  it('produce un token largo', () => {
    expect(generarTokenQR().length).toBeGreaterThanOrEqual(43)
  })
  it('no repite tokens', () => {
    const tokens = new Set(Array.from({ length: 500 }, generarTokenQR))
    expect(tokens.size).toBe(500)
  })
  it('usa solo caracteres seguros para una URL', () => {
    expect(generarTokenQR()).toMatch(/^[A-Za-z0-9_-]+$/)
  })
})
```

- [ ] **Step 2: Verificar que fallan**

Run: `npx vitest run tests/folio.test.ts`
Esperado: FAIL

- [ ] **Step 3: Implementar**

`src/lib/folio.ts`:
```typescript
import { randomBytes } from 'node:crypto'

export function formatearFolio(anio: number, consecutivo: number): string {
  return `CRM-${anio}-${String(consecutivo).padStart(4, '0')}`
}

/** Token aleatorio, nunca derivado del folio: el folio es adivinable. */
export function generarTokenQR(): string {
  return randomBytes(32).toString('base64url')
}
```

- [ ] **Step 4: Verificar que pasan**

Run: `npx vitest run tests/folio.test.ts`
Esperado: PASS, 5 pruebas

- [ ] **Step 5: Commit**

```bash
git add src/lib/folio.ts tests/folio.test.ts
git commit -m "feat: generación de folio anual y token del QR"
```

---

### Task 6: Esquema de base de datos

**Files:**
- Create: `prisma/schema.prisma`
- Create: `src/lib/db.ts`
- Test: `tests/esquema.test.ts`

**Interfaces:**
- Consumes: `DATABASE_URL` del `.env`
- Produces: cliente `prisma` desde `@/lib/db`; modelos `Usuario`, `Alumno`, `CicloAnual`, `Inscripcion`, `Periodo`, `DiaInhabil`, `Tarifa`, `Descuento`, `Grupo`, `Locker`, `AsignacionLocker`, `Cargo`, `Pago`, `SolicitudFactura`, `Asistencia`, `ConfigComision`

- [ ] **Step 1: Escribir el esquema**

`prisma/schema.prisma` — enums y modelos completos según el spec:

```prisma
generator client { provider = "prisma-client-js" }
datasource db { provider = "postgresql"; url = env("DATABASE_URL") }

enum Rol           { ADMINISTRADOR RECEPCION PROFESOR }
enum Categoria     { NINOS GENERAL }
enum EstadoCiclo   { ABIERTO CERRADO }
enum EstadoInscripcion { ACTIVA BAJA }
enum EstadoCargo   { PENDIENTE EN_REVISION PAGADO VENCIDO CANCELADO }
enum MetodoPago    { EFECTIVO TRANSFERENCIA TARJETA SPEI OXXO }
enum EstadoPago    { EN_REVISION CONFIRMADO RECHAZADO }
enum EstadoFactura { SOLICITADA EN_PROCESO FACTURADA CANCELADA }
enum TipoDescuento { PORCENTAJE MONTO_FIJO }

model Usuario {
  id           String   @id @default(cuid())
  nombre       String
  email        String   @unique
  passwordHash String
  rol          Rol
  activo       Boolean  @default(true)
  creadoEn     DateTime @default(now())
  pagosRegistrados Pago[] @relation("PagoRegistradoPor")
  pagosValidados   Pago[] @relation("PagoValidadoPor")
  asistencias      Asistencia[]
  facturasAtendidas SolicitudFactura[]
}

model Alumno {
  id                        String    @id @default(cuid())
  nombreCompleto            String
  fechaNacimiento           DateTime?
  telefono                  String?
  email                     String?
  direccion                 String?
  contactoEmergenciaNombre  String?
  contactoEmergenciaTelefono String?
  condicionesMedicas        String?
  categoria                 Categoria @default(GENERAL)
  fotoUrl                   String?
  rfc                       String?
  razonSocial               String?
  codigoPostal              String?
  regimenFiscal             String?
  usoCfdi                   String?
  datosCompletos            Boolean   @default(false)
  creadoEn                  DateTime  @default(now())
  inscripciones             Inscripcion[]
}

model CicloAnual {
  id            String       @id @default(cuid())
  anio          Int          @unique
  estado        EstadoCiclo  @default(ABIERTO)
  diasHabilesLimite Int      @default(5)
  inscripciones Inscripcion[]
  periodos      Periodo[]
}

model Inscripcion {
  id           String   @id @default(cuid())
  alumnoId     String
  cicloAnualId String
  grupoId      String?
  descuentoId  String?
  folio        String   @unique
  tokenQR      String   @unique
  estado       EstadoInscripcion @default(ACTIVA)
  creadoEn     DateTime @default(now())
  alumno       Alumno     @relation(fields: [alumnoId], references: [id])
  ciclo        CicloAnual @relation(fields: [cicloAnualId], references: [id])
  grupo        Grupo?     @relation(fields: [grupoId], references: [id])
  descuento    Descuento? @relation(fields: [descuentoId], references: [id])
  cargos       Cargo[]
  lockers      AsignacionLocker[]
  asistencias  Asistencia[]
  @@unique([alumnoId, cicloAnualId])
}

model Periodo {
  id           String   @id @default(cuid())
  cicloAnualId String
  mes          Int
  clave        String   @unique
  fechaLimite  DateTime
  recargo      Int      @default(5000)
  precioLocker Int      @default(10000)
  estado       EstadoCiclo @default(ABIERTO)
  cargosGenerados Boolean @default(false)
  ciclo        CicloAnual @relation(fields: [cicloAnualId], references: [id])
  tarifas      Tarifa[]
  cargos       Cargo[]
  lockers      AsignacionLocker[]
  @@unique([cicloAnualId, mes])
}

model DiaInhabil {
  id          String   @id @default(cuid())
  fecha       DateTime @unique
  descripcion String
}

model Tarifa {
  id        String    @id @default(cuid())
  periodoId String
  categoria Categoria
  monto     Int
  periodo   Periodo   @relation(fields: [periodoId], references: [id])
  @@unique([periodoId, categoria])
}

model Descuento {
  id            String        @id @default(cuid())
  nombre        String
  tipo          TipoDescuento
  valor         Int
  vigenciaDesde DateTime?
  vigenciaHasta DateTime?
  activo        Boolean       @default(true)
  inscripciones Inscripcion[]
}

model Grupo {
  id         String @id @default(cuid())
  nombre     String
  dias       String
  horaInicio String
  horaFin    String
  cupoMaximo Int
  activo     Boolean @default(true)
  inscripciones Inscripcion[]
}

model Locker {
  id      String  @id @default(cuid())
  numero  Int     @unique
  activo  Boolean @default(true)
  asignaciones AsignacionLocker[]
}

model AsignacionLocker {
  id            String @id @default(cuid())
  lockerId      String
  inscripcionId String
  periodoId     String
  locker        Locker      @relation(fields: [lockerId], references: [id])
  inscripcion   Inscripcion @relation(fields: [inscripcionId], references: [id])
  periodo       Periodo     @relation(fields: [periodoId], references: [id])
  @@unique([lockerId, periodoId])
}

model Cargo {
  id               String      @id @default(cuid())
  inscripcionId    String
  periodoId        String
  montoMensualidad Int
  montoLockers     Int         @default(0)
  montoDescuento   Int         @default(0)
  montoRecargo     Int         @default(0)
  montoNeto        Int
  estado           EstadoCargo @default(PENDIENTE)
  recargoAplicadoEn DateTime?
  creadoEn         DateTime    @default(now())
  inscripcion      Inscripcion @relation(fields: [inscripcionId], references: [id])
  periodo          Periodo     @relation(fields: [periodoId], references: [id])
  pagos            Pago[]
  solicitudFactura SolicitudFactura?
  @@unique([inscripcionId, periodoId])
}

model Pago {
  id                    String     @id @default(cuid())
  cargoId               String
  metodo                MetodoPago
  montoCobrado          Int
  montoComision         Int        @default(0)
  montoNeto             Int
  referencia            String?
  comprobanteUrl        String?
  stripePaymentIntentId String?
  estado                EstadoPago @default(CONFIRMADO)
  registradoPorId       String?
  validadoPorId         String?
  fechaPago             DateTime   @default(now())
  cargo                 Cargo    @relation(fields: [cargoId], references: [id])
  registradoPor         Usuario? @relation("PagoRegistradoPor", fields: [registradoPorId], references: [id])
  validadoPor           Usuario? @relation("PagoValidadoPor", fields: [validadoPorId], references: [id])
}

model SolicitudFactura {
  id           String        @id @default(cuid())
  cargoId      String        @unique
  rfc          String
  razonSocial  String
  codigoPostal String
  regimenFiscal String
  usoCfdi      String
  estado       EstadoFactura @default(SOLICITADA)
  notas        String?
  atendidaPorId String?
  creadoEn     DateTime      @default(now())
  cargo        Cargo    @relation(fields: [cargoId], references: [id])
  atendidaPor  Usuario? @relation(fields: [atendidaPorId], references: [id])
}

model Asistencia {
  id             String   @id @default(cuid())
  inscripcionId  String
  fecha          DateTime
  registradaPorId String
  inscripcion    Inscripcion @relation(fields: [inscripcionId], references: [id])
  registradaPor  Usuario     @relation(fields: [registradaPorId], references: [id])
  @@unique([inscripcionId, fecha])
}

model ConfigComision {
  id         String     @id @default(cuid())
  metodo     MetodoPago @unique
  porcentaje Float      @default(0)
  montoFijo  Int        @default(0)
  iva        Float      @default(0.16)
  activo     Boolean    @default(true)
  diasCorteAntesDeVencimiento Int @default(0)
}
```

- [ ] **Step 2: Crear el cliente Prisma**

`src/lib/db.ts`:
```typescript
import { PrismaClient } from '@prisma/client'

const globalParaPrisma = globalThis as unknown as { prisma?: PrismaClient }

export const prisma = globalParaPrisma.prisma ?? new PrismaClient()

if (process.env.NODE_ENV !== 'production') globalParaPrisma.prisma = prisma
```

- [ ] **Step 3: Migrar**

```bash
npm run db:up
npx prisma migrate dev --name esquema_inicial
```
Esperado: migración aplicada y cliente generado.

- [ ] **Step 4: Probar que el esquema responde**

`tests/esquema.test.ts`:
```typescript
import { describe, it, expect, afterAll } from 'vitest'
import { prisma } from '@/lib/db'

describe('esquema', () => {
  it('conecta y consulta usuarios', async () => {
    await expect(prisma.usuario.count()).resolves.toBeTypeOf('number')
  })

  it('impide dos inscripciones con el mismo folio', async () => {
    const ciclo = await prisma.cicloAnual.upsert({
      where: { anio: 2099 }, update: {}, create: { anio: 2099 },
    })
    const alumnoA = await prisma.alumno.create({ data: { nombreCompleto: 'Prueba A' } })
    const alumnoB = await prisma.alumno.create({ data: { nombreCompleto: 'Prueba B' } })
    await prisma.inscripcion.create({
      data: { alumnoId: alumnoA.id, cicloAnualId: ciclo.id, folio: 'CRM-2099-0001', tokenQR: 'tok-a' },
    })
    await expect(
      prisma.inscripcion.create({
        data: { alumnoId: alumnoB.id, cicloAnualId: ciclo.id, folio: 'CRM-2099-0001', tokenQR: 'tok-b' },
      }),
    ).rejects.toThrow()

    await prisma.inscripcion.deleteMany({ where: { cicloAnualId: ciclo.id } })
    await prisma.alumno.deleteMany({ where: { id: { in: [alumnoA.id, alumnoB.id] } } })
    await prisma.cicloAnual.delete({ where: { id: ciclo.id } })
  })

  afterAll(() => prisma.$disconnect())
})
```

Run: `npx vitest run tests/esquema.test.ts`
Esperado: PASS

- [ ] **Step 5: Commit**

```bash
git add prisma src/lib/db.ts tests/esquema.test.ts
git commit -m "feat: esquema de base de datos y cliente Prisma"
```

---

### Task 7: Autenticación del personal y datos de arranque

**Files:**
- Create: `src/lib/auth.ts`, `src/lib/sesion.ts`
- Create: `prisma/seed.ts`
- Create: `src/app/ingresar/page.tsx`, `src/app/api/sesion/route.ts`
- Test: `tests/auth.test.ts`

**Interfaces:**
- Consumes: `prisma` de `@/lib/db`, `calcularFechaLimite` de `@/lib/dias-habiles`, `formatearFolio`/`generarTokenQR` de `@/lib/folio`
- Produces:
  - `hashPassword(plano: string): Promise<string>`
  - `verificarPassword(plano: string, hash: string): Promise<boolean>`
  - `crearSesion(usuarioId: string): Promise<void>` / `leerSesion(): Promise<{ id, rol, nombre } | null>` / `cerrarSesion(): Promise<void>`
  - `requiereRol(...roles: Rol[])` — lanza si el usuario en sesión no tiene el rol

- [ ] **Step 1: Escribir las pruebas que fallan**

`tests/auth.test.ts`:
```typescript
import { describe, it, expect } from 'vitest'
import { hashPassword, verificarPassword } from '@/lib/auth'

describe('contraseñas', () => {
  it('el hash no revela la contraseña', async () => {
    const hash = await hashPassword('secreta123')
    expect(hash).not.toContain('secreta123')
  })
  it('acepta la contraseña correcta', async () => {
    const hash = await hashPassword('secreta123')
    await expect(verificarPassword('secreta123', hash)).resolves.toBe(true)
  })
  it('rechaza la incorrecta', async () => {
    const hash = await hashPassword('secreta123')
    await expect(verificarPassword('otra', hash)).resolves.toBe(false)
  })
})
```

- [ ] **Step 2: Verificar que fallan**

Run: `npx vitest run tests/auth.test.ts`
Esperado: FAIL

- [ ] **Step 3: Implementar auth y sesión**

`src/lib/auth.ts`:
```typescript
import bcrypt from 'bcryptjs'

export const hashPassword = (plano: string) => bcrypt.hash(plano, 10)
export const verificarPassword = (plano: string, hash: string) => bcrypt.compare(plano, hash)
```

`src/lib/sesion.ts` — cookie firmada HttpOnly con el id del usuario, leída por las páginas del panel. Expira a los 8 días. `requiereRol` consulta la sesión y lanza `Error('No autorizado')` si el rol no coincide.

- [ ] **Step 4: Escribir el seed**

`prisma/seed.ts` debe crear, de forma idempotente (`upsert`):
- **Usuario administrador:** `«el de ADMIN_EMAIL»`, nombre "Francisco Pech", rol `ADMINISTRADOR`, contraseña `«la de ADMIN_PASSWORD»`
- Usuario recepción de ejemplo: `recepcion@cruzrojacancun.org`, misma contraseña
- Usuario profesor de ejemplo: `profesor@cruzrojacancun.org`, misma contraseña
- **Ciclo 2026** abierto
- **Los 12 periodos de 2026**, con `fechaLimite` calculada por `calcularFechaLimite`, recargo $50 y precio de locker $100
- **Tarifas:** `GENERAL` $770 y `NINOS` $650 en cada periodo
- **Días inhábiles 2026:** 1 ene, 2 feb, 16 mar, 1 may, 16 sep, 17 nov, 25 dic
- **Descuentos:** "INAPAM" 20%, "Beca" 50%
- **40 lockers** numerados del 1 al 40
- **Grupos** de 7:00 a 22:00 en bloques de una hora, cupo 20
- **12 alumnos de ejemplo** con inscripción, folio y token en el ciclo 2026, algunos con lockers

- [ ] **Step 5: Ejecutar y verificar**

```bash
npm run db:seed
npx vitest run tests/auth.test.ts
```
Esperado: seed sin errores y pruebas en verde.

- [ ] **Step 6: Commit**

```bash
git add src/lib/auth.ts src/lib/sesion.ts prisma/seed.ts src/app/ingresar src/app/api/sesion tests/auth.test.ts
git commit -m "feat: autenticación del personal y datos de arranque"
```

---

### Task 8: Generación de cargos del periodo

**Files:**
- Create: `src/lib/servicios/periodos.ts`
- Test: `tests/periodos.test.ts`

**Interfaces:**
- Consumes: `prisma`, `calcularCargo`
- Produces:
  - `generarCargosDelPeriodo(periodoId: string): Promise<{ creados: number }>` — idempotente
  - `aplicarRecargosVencidos(periodoId: string, ahora?: Date): Promise<{ actualizados: number }>`

- [ ] **Step 1: Escribir las pruebas que fallan**

`tests/periodos.test.ts` debe cubrir:
```typescript
it('crea un cargo por cada inscripción activa', ...)
it('no duplica cargos si se ejecuta dos veces', ...)          // idempotencia
it('omite las inscripciones dadas de baja', ...)
it('usa la tarifa de NINOS para alumnos de esa categoría', ...)
it('suma los lockers asignados en ese periodo', ...)
it('no aplica recargo antes de la fecha límite', ...)
it('aplica el recargo y marca VENCIDO al pasar la fecha límite', ...)
it('no aplica recargo a un cargo ya PAGADO', ...)
it('no aplica el recargo dos veces', ...)
```
Cada prueba levanta su propio ciclo de prueba (año 2098) y lo borra al final.

- [ ] **Step 2: Verificar que fallan**

Run: `npx vitest run tests/periodos.test.ts`
Esperado: FAIL

- [ ] **Step 3: Implementar el servicio**

`generarCargosDelPeriodo`: recorre las inscripciones `ACTIVA` del ciclo del periodo, cuenta sus `AsignacionLocker` de ese periodo, resuelve la tarifa por categoría y el descuento, llama a `calcularCargo` y hace `createMany` con `skipDuplicates: true`. Al terminar marca `periodo.cargosGenerados = true`.

`aplicarRecargosVencidos`: si `ahora > periodo.fechaLimite`, toma los cargos en `PENDIENTE` con `recargoAplicadoEn: null`, les suma `periodo.recargo` a `montoRecargo` y `montoNeto`, los pasa a `VENCIDO` y sella `recargoAplicadoEn`. **Nunca toca cargos `PAGADO`, `CANCELADO` ni con recargo ya aplicado.**

- [ ] **Step 4: Verificar que pasan**

Run: `npx vitest run tests/periodos.test.ts`
Esperado: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/servicios/periodos.ts tests/periodos.test.ts
git commit -m "feat: generación de cargos mensuales y recargo por vencimiento"
```

---

### Task 9: Panel — padrón de alumnos y credencial imprimible

**Files:**
- Create: `src/app/panel/layout.tsx`, `src/app/panel/page.tsx`
- Create: `src/app/panel/alumnos/page.tsx`, `src/app/panel/alumnos/[id]/page.tsx`
- Create: `src/app/panel/alumnos/[id]/credencial/page.tsx`
- Create: `src/lib/servicios/inscripciones.ts`
- Create: `src/components/CodigoQR.tsx`
- Test: `tests/inscripciones.test.ts`

**Interfaces:**
- Consumes: `prisma`, `formatearFolio`, `generarTokenQR`, `requiereRol`
- Produces:
  - `inscribirAlumno(nombreCompleto: string, cicloAnualId: string, categoria?: Categoria): Promise<Inscripcion>` — crea alumno e inscripción con folio consecutivo y token
  - `siguienteConsecutivo(cicloAnualId: string): Promise<number>`

- [ ] **Step 1: Escribir las pruebas que fallan**

`tests/inscripciones.test.ts`:
```typescript
it('da de alta con solo el nombre completo', ...)
it('asigna folios consecutivos dentro del mismo ciclo', ...)   // 0001, 0002, 0003
it('reinicia el consecutivo en un ciclo distinto', ...)
it('asigna un token distinto a cada inscripción', ...)
it('marca datosCompletos en falso al dar de alta', ...)
it('impide inscribir dos veces al mismo alumno en un ciclo', ...)
```

- [ ] **Step 2: Verificar que fallan**

Run: `npx vitest run tests/inscripciones.test.ts`
Esperado: FAIL

- [ ] **Step 3: Implementar servicio y pantallas**

`inscribirAlumno` corre dentro de una transacción: calcula el consecutivo (`count` de inscripciones del ciclo + 1), formatea el folio, genera el token y crea alumno e inscripción juntos.

Pantallas:
- **Padrón** (`/panel/alumnos`): tabla con folio, nombre, categoría, grupo y estado del mes en curso. Buscador por nombre o folio. Botón "Alta rápida" que pide **solo el nombre completo**.
- **Ficha** (`/panel/alumnos/[id]`): datos del alumno, historial de cargos y pagos, lockers asignados, y botón "Imprimir credencial".
- **Credencial** (`/panel/alumnos/[id]/credencial`): hoja tamaño tarjeta con logo, nombre, folio, ciclo y el QR apuntando a `/q/{tokenQR}`. Con `@media print` para que salga limpia. Reimprimible sin cambiar el token.

`src/components/CodigoQR.tsx` genera el QR como data URL con la librería `qrcode`.

- [ ] **Step 4: Verificar que pasan**

Run: `npx vitest run tests/inscripciones.test.ts`
Esperado: PASS

- [ ] **Step 5: Commit**

```bash
git add src/app/panel src/lib/servicios/inscripciones.ts src/components/CodigoQR.tsx tests/inscripciones.test.ts
git commit -m "feat: padrón de alumnos, alta rápida y credencial imprimible"
```

---

### Task 10: Página del alumno

**Files:**
- Create: `src/app/q/[token]/page.tsx`
- Create: `src/app/q/[token]/datos/page.tsx`
- Create: `src/app/api/q/[token]/datos/route.ts`
- Create: `src/lib/servicios/estado-cuenta.ts`
- Create: `src/components/Semaforo.tsx`
- Test: `tests/estado-cuenta.test.ts`

**Interfaces:**
- Consumes: `prisma`, `calcularTotalConComision`
- Produces:
  - `obtenerEstadoCuenta(token: string): Promise<EstadoCuenta | null>` — devuelve inscripción, cargo del mes en curso con desglose, precios por método e historial
  - `type ColorSemaforo = 'VERDE' | 'AMARILLO' | 'AZUL' | 'ROJO' | 'GRIS'`
  - `colorDeEstado(estado: EstadoCargo): ColorSemaforo`

- [ ] **Step 1: Escribir las pruebas que fallan**

`tests/estado-cuenta.test.ts`:
```typescript
it('devuelve null con un token inexistente', ...)
it('no filtra datos de otras inscripciones', ...)
it('PAGADO es verde y VENCIDO es rojo', ...)
it('PENDIENTE es amarillo y EN_REVISION es azul', ...)
it('calcula el precio en línea por encima del precio en efectivo', ...)
```

- [ ] **Step 2: Verificar que fallan**

Run: `npx vitest run tests/estado-cuenta.test.ts`
Esperado: FAIL

- [ ] **Step 3: Implementar**

`obtenerEstadoCuenta` busca la inscripción **por token exacto**; si no existe devuelve `null` (nunca un error que revele si el token es parcialmente válido).

La página `/q/[token]`, pensada para celular:
- Semáforo grande con el estado del mes, nombre y folio
- Aviso "Completa tus datos" si `datosCompletos` es falso, con enlace al formulario. **No bloquea nada más**
- Desglose del mes: mensualidad, lockers, descuento, recargo y total
- **Precios por método**: "Efectivo o transferencia: $770 · Pago en línea: $808". En Fase 1 el botón de pago en línea aparece deshabilitado con la leyenda "Disponible próximamente"
- Historial de meses anteriores del ciclo

El formulario de datos (`/q/[token]/datos`) captura contacto, emergencia, condiciones médicas y datos fiscales, con **aviso de privacidad y casilla de consentimiento**. Al guardar marca `datosCompletos`.

- [ ] **Step 4: Verificar que pasan**

Run: `npx vitest run tests/estado-cuenta.test.ts`
Esperado: PASS

- [ ] **Step 5: Commit**

```bash
git add src/app/q src/app/api/q src/lib/servicios/estado-cuenta.ts src/components/Semaforo.tsx tests/estado-cuenta.test.ts
git commit -m "feat: página del alumno con semáforo, estado de cuenta y captura de datos"
```

---

### Task 11: Registro manual de pagos

**Files:**
- Create: `src/lib/servicios/pagos.ts`
- Create: `src/lib/almacenamiento.ts`
- Create: `src/app/panel/pagos/page.tsx`
- Create: `src/app/api/pagos/route.ts`
- Test: `tests/pagos.test.ts`

**Interfaces:**
- Consumes: `prisma`, `requiereRol`
- Produces:
  - `registrarPago(datos: { cargoId, metodo, montoCobrado, referencia?, comprobanteUrl?, registradoPorId }): Promise<Pago>`
  - `validarPago(pagoId: string, validadoPorId: string, aprobado: boolean): Promise<Pago>`
  - `guardarComprobante(archivo: File): Promise<string>` — en local escribe en `storage/comprobantes/`; en producción se cambia por Cloudinary sin tocar a quien lo llama

- [ ] **Step 1: Escribir las pruebas que fallan**

`tests/pagos.test.ts`:
```typescript
it('un pago en efectivo por el total deja el cargo PAGADO', ...)
it('efectivo y transferencia no llevan comisión: neto igual a cobrado', ...)
it('un pago parcial deja el cargo pendiente', ...)
it('varios pagos parciales que suman el total lo dejan PAGADO', ...)
it('un comprobante subido por el alumno queda EN_REVISION', ...)
it('validar un pago EN_REVISION lo confirma y paga el cargo', ...)
it('rechazar un pago devuelve el cargo a su estado anterior', ...)
it('guarda quién registró y quién validó cada pago', ...)
```

- [ ] **Step 2: Verificar que fallan**

Run: `npx vitest run tests/pagos.test.ts`
Esperado: FAIL

- [ ] **Step 3: Implementar**

`registrarPago` crea el pago y recalcula el estado del cargo: si la suma de pagos `CONFIRMADO` alcanza `montoNeto`, pasa a `PAGADO`. Para `EFECTIVO` y `TRANSFERENCIA`, `montoComision = 0` y `montoNeto = montoCobrado`.

Pantalla `/panel/pagos`: bandeja con dos secciones — **por validar** (comprobantes `EN_REVISION`, con la imagen a la vista y botones Aprobar/Rechazar) y **registro manual** (elegir alumno, método, monto, referencia y comprobante opcional).

- [ ] **Step 4: Verificar que pasan**

Run: `npx vitest run tests/pagos.test.ts`
Esperado: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/servicios/pagos.ts src/lib/almacenamiento.ts src/app/panel/pagos src/app/api/pagos tests/pagos.test.ts
git commit -m "feat: registro y validación de pagos en efectivo y transferencia"
```

---

### Task 12: Lockers

**Files:**
- Create: `src/lib/servicios/lockers.ts`
- Create: `src/app/panel/lockers/page.tsx`
- Test: `tests/lockers.test.ts`

**Interfaces:**
- Consumes: `prisma`
- Produces:
  - `lockersDisponibles(periodoId: string): Promise<Locker[]>`
  - `asignarLocker(lockerId: string, inscripcionId: string, periodoId: string): Promise<AsignacionLocker>`
  - `liberarLocker(asignacionId: string): Promise<void>`

- [ ] **Step 1: Escribir las pruebas que fallan**

`tests/lockers.test.ts`:
```typescript
it('lista como disponibles los lockers sin asignar en el periodo', ...)
it('asignar un locker lo saca de la lista de disponibles', ...)
it('rechaza asignar un locker ya ocupado en ese periodo', ...)
it('el mismo locker puede asignarse en periodos distintos', ...)
it('un alumno puede tener varios lockers', ...)
it('liberar un locker lo devuelve a disponibles', ...)
it('excluye los lockers marcados como inactivos', ...)
```

- [ ] **Step 2: Verificar que fallan**

Run: `npx vitest run tests/lockers.test.ts`
Esperado: FAIL

- [ ] **Step 3: Implementar**

`asignarLocker` se apoya en la restricción única `(lockerId, periodoId)` de la base de datos y traduce el error de duplicado a un mensaje claro: "El locker N ya está asignado en este periodo". Al asignar o liberar, **recalcula el cargo del alumno en ese periodo** si aún no está pagado.

Pantalla `/panel/lockers`: cuadrícula de los 40 lockers para el periodo elegido, en verde los libres y en gris los ocupados con el nombre de quien lo tiene. Clic para asignar o liberar.

- [ ] **Step 4: Verificar que pasan**

Run: `npx vitest run tests/lockers.test.ts`
Esperado: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/servicios/lockers.ts src/app/panel/lockers tests/lockers.test.ts
git commit -m "feat: catálogo y asignación de lockers por periodo"
```

---

### Task 13: Vista del profesor

**Files:**
- Create: `src/app/profesor/page.tsx`
- Create: `src/app/profesor/escanear/page.tsx`
- Create: `src/app/api/profesor/verificar/[token]/route.ts`
- Test: `tests/verificacion-acceso.test.ts`

**Interfaces:**
- Consumes: `prisma`, `requiereRol`, `colorDeEstado`
- Produces:
  - `verificarAcceso(token: string): Promise<{ nombre, folio, fotoUrl, alCorriente: boolean, mes: string } | null>`

- [ ] **Step 1: Escribir las pruebas que fallan**

`tests/verificacion-acceso.test.ts`:
```typescript
it('un cargo PAGADO da acceso', ...)                          // alCorriente = true
it('un cargo VENCIDO niega el acceso', ...)
it('un cargo PENDIENTE niega el acceso', ...)                 // aún no paga
it('nunca devuelve importes ni teléfono ni domicilio', ...)    // clave de privacidad
it('devuelve null con un token inválido', ...)
```

La cuarta prueba es la más importante del bloque:
```typescript
const resultado = await verificarAcceso(token)
expect(Object.keys(resultado!)).toEqual(['nombre', 'folio', 'fotoUrl', 'alCorriente', 'mes'])
```

- [ ] **Step 2: Verificar que fallan**

Run: `npx vitest run tests/verificacion-acceso.test.ts`
Esperado: FAIL

- [ ] **Step 3: Implementar**

`verificarAcceso` devuelve **exactamente esos cinco campos**, nunca la entidad completa.

Pantalla `/profesor/escanear`: abre la cámara con `html5-qrcode`, y al leer un QR muestra **pantalla completa en verde o rojo** con la foto, el nombre y el mes. Un toque la limpia para el siguiente. Incluye buscador por folio o nombre como respaldo cuando el QR no lee.

Pantalla `/profesor`: lista de alumnos del ciclo con su semáforo, sin importes.

- [ ] **Step 4: Verificar que pasan**

Run: `npx vitest run tests/verificacion-acceso.test.ts`
Esperado: PASS

- [ ] **Step 5: Verificación completa y commit**

```bash
npm test && npm run build
git add src/app/profesor src/app/api/profesor tests/verificacion-acceso.test.ts
git commit -m "feat: escáner de QR y semáforo de acceso para profesores"
```

---

## Verificación final de la Fase 1

Con la base sembrada y `npm run dev` corriendo:

1. Entrar como `«el de ADMIN_EMAIL»` y llegar al panel
2. Dar de alta un alumno con **solo su nombre** → obtiene folio `CRM-2026-XXXX`
3. Imprimir su credencial → el QR aparece y es legible
4. Abrir `/q/{token}` en el celular → semáforo y estado de cuenta
5. Completar los datos desde esa página → deja de pedirlo
6. Asignar dos lockers → el cargo sube $200
7. Registrar el pago en efectivo → el semáforo se pone **verde**
8. Entrar como profesor y escanear ese QR → **pantalla verde**
9. Escanear el QR de un alumno sin pagar → **pantalla roja**
10. `npm test` en verde y `npm run build` sin errores

## Fuera del alcance de esta fase

Van en las fases 2 y 3, tal como quedó en el spec: Stripe (tarjeta, SPEI, OXXO) con su corte y webhooks, subida de comprobantes por el propio alumno, grupos con cupo, asistencia, descuentos aplicados desde el panel, solicitudes de facturación con estatus, y los tres reportes con exportación.

---

### Task 6: Esquema de base de datos

Traduce la sección 7 del spec a Prisma. Es la tarea que fija los nombres que usará todo lo demás.

**Files:**
- Create: `prisma/schema.prisma`
- Create: `src/lib/db.ts`
- Test: `tests/esquema.test.ts`

**Interfaces:**
- Consumes: nada
- Produces: cliente `prisma` desde `@/lib/db`; modelos `Alumno`, `CicloAnual`, `Inscripcion`, `Periodo`, `DiaInhabil`, `Tarifa`, `Descuento`, `Grupo`, `Locker`, `AsignacionLocker`, `Cargo`, `Pago`, `Usuario`, `ConfigComision`

- [ ] **Step 1: Escribir el esquema**

`prisma/schema.prisma`:
```prisma
generator client {
  provider = "prisma-client"
  output   = "../src/generated/prisma"
}

datasource db {
  provider = "postgresql"
}

// Prisma 7: la URL ya no va en el schema, sino en prisma7.config.ts.
// Los valores de cada enum deben ir en líneas separadas.

enum Categoria      { NINOS GENERAL }
enum EstadoCiclo    { ABIERTO CERRADO }
enum EstadoInscripcion { ACTIVA BAJA }
enum TipoDescuento  { PORCENTAJE MONTO_FIJO }
enum EstadoCargo    { PENDIENTE EN_REVISION PAGADO VENCIDO CANCELADO }
enum MetodoPago     { EFECTIVO TRANSFERENCIA TARJETA SPEI OXXO }
enum EstadoPago     { EN_REVISION CONFIRMADO RECHAZADO }
enum Rol            { ADMINISTRADOR RECEPCION PROFESOR }

model Alumno {
  id                        String   @id @default(cuid())
  nombreCompleto            String
  fechaNacimiento           DateTime?
  telefono                  String?
  email                     String?
  direccion                 String?
  contactoEmergenciaNombre  String?
  contactoEmergenciaTelefono String?
  condicionesMedicas        String?
  categoria                 Categoria @default(GENERAL)
  fotoUrl                   String?
  datosCompletos            Boolean  @default(false)
  rfc                       String?
  razonSocial               String?
  codigoPostal              String?
  regimenFiscal             String?
  usoCfdi                   String?
  creadoEn                  DateTime @default(now())
  inscripciones             Inscripcion[]
}

model CicloAnual {
  id            String       @id @default(cuid())
  anio          Int          @unique
  estado        EstadoCiclo  @default(ABIERTO)
  inscripciones Inscripcion[]
  periodos      Periodo[]
}

model Inscripcion {
  id           String            @id @default(cuid())
  alumno       Alumno            @relation(fields: [alumnoId], references: [id])
  alumnoId     String
  ciclo        CicloAnual        @relation(fields: [cicloAnualId], references: [id])
  cicloAnualId String
  grupo        Grupo?            @relation(fields: [grupoId], references: [id])
  grupoId      String?
  descuento    Descuento?        @relation(fields: [descuentoId], references: [id])
  descuentoId  String?
  folio        String            @unique
  tokenQR      String            @unique
  estado       EstadoInscripcion @default(ACTIVA)
  creadaEn     DateTime          @default(now())
  cargos       Cargo[]
  lockers      AsignacionLocker[]

  @@unique([alumnoId, cicloAnualId])
}

model Periodo {
  id           String     @id @default(cuid())
  ciclo        CicloAnual @relation(fields: [cicloAnualId], references: [id])
  cicloAnualId String
  mes          Int
  clave        String     @unique   // "2026-03"
  fechaLimite  DateTime
  recargo      Int        @default(5000)   // centavos
  precioLocker Int        @default(10000)  // centavos
  estado       EstadoCiclo @default(ABIERTO)
  cargosGenerados Boolean @default(false)
  tarifas      Tarifa[]
  cargos       Cargo[]
  asignaciones AsignacionLocker[]

  @@unique([cicloAnualId, mes])
}

model DiaInhabil {
  id          String   @id @default(cuid())
  fecha       DateTime @unique
  descripcion String
}

model Tarifa {
  id        String    @id @default(cuid())
  periodo   Periodo   @relation(fields: [periodoId], references: [id])
  periodoId String
  categoria Categoria
  monto     Int       // centavos

  @@unique([periodoId, categoria])
}

model Descuento {
  id            String        @id @default(cuid())
  nombre        String
  tipo          TipoDescuento
  valor         Int           // porcentaje entero, o centavos
  vigenciaDesde DateTime?
  vigenciaHasta DateTime?
  activo        Boolean       @default(true)
  inscripciones Inscripcion[]
}

model Grupo {
  id            String        @id @default(cuid())
  nombre        String
  dias          String        // "L-V"
  horaInicio    String        // "07:00"
  horaFin       String        // "08:00"
  cupoMaximo    Int
  activo        Boolean       @default(true)
  inscripciones Inscripcion[]
}

model Locker {
  id           String             @id @default(cuid())
  numero       Int                @unique
  activo       Boolean            @default(true)
  asignaciones AsignacionLocker[]
}

model AsignacionLocker {
  id            String      @id @default(cuid())
  locker        Locker      @relation(fields: [lockerId], references: [id])
  lockerId      String
  inscripcion   Inscripcion @relation(fields: [inscripcionId], references: [id])
  inscripcionId String
  periodo       Periodo     @relation(fields: [periodoId], references: [id])
  periodoId     String

  @@unique([lockerId, periodoId])
}

model Cargo {
  id                String      @id @default(cuid())
  inscripcion       Inscripcion @relation(fields: [inscripcionId], references: [id])
  inscripcionId     String
  periodo           Periodo     @relation(fields: [periodoId], references: [id])
  periodoId         String
  montoMensualidad  Int
  montoLockers      Int         @default(0)
  montoDescuento    Int         @default(0)
  montoRecargo      Int         @default(0)
  montoNeto         Int
  estado            EstadoCargo @default(PENDIENTE)
  recargoAplicadoEn DateTime?
  creadoEn          DateTime    @default(now())
  pagos             Pago[]
  factura           SolicitudFactura?

  @@unique([inscripcionId, periodoId])
}

model Pago {
  id                    String     @id @default(cuid())
  cargo                 Cargo      @relation(fields: [cargoId], references: [id])
  cargoId               String
  metodo                MetodoPago
  montoCobrado          Int
  montoComision         Int        @default(0)
  montoNeto             Int
  referencia            String?
  comprobanteUrl        String?
  stripePaymentIntentId String?
  estado                EstadoPago @default(CONFIRMADO)
  registradoPor         Usuario?   @relation("PagoRegistrado", fields: [registradoPorId], references: [id])
  registradoPorId       String?
  validadoPor           Usuario?   @relation("PagoValidado", fields: [validadoPorId], references: [id])
  validadoPorId         String?
  fechaPago             DateTime   @default(now())
}

enum EstadoFactura { SOLICITADA EN_PROCESO FACTURADA CANCELADA }

model SolicitudFactura {
  id            String        @id @default(cuid())
  cargo         Cargo         @relation(fields: [cargoId], references: [id])
  cargoId       String        @unique
  rfc           String
  razonSocial   String
  codigoPostal  String
  regimenFiscal String
  usoCfdi       String
  estado        EstadoFactura @default(SOLICITADA)
  notas         String?
  solicitadaEn  DateTime      @default(now())
}

model Usuario {
  id              String   @id @default(cuid())
  nombre          String
  email           String   @unique
  passwordHash    String
  rol             Rol
  activo          Boolean  @default(true)
  pagosRegistrados Pago[]  @relation("PagoRegistrado")
  pagosValidados   Pago[]  @relation("PagoValidado")
}

model ConfigComision {
  id                          String     @id @default(cuid())
  metodo                      MetodoPago @unique
  porcentaje                  Float      @default(0)
  montoFijo                   Int        @default(0)
  iva                         Float      @default(0.16)
  activo                      Boolean    @default(true)
  diasCorteAntesDeVencimiento Int        @default(0)
}
```

- [ ] **Step 2: Crear el cliente**

`src/lib/db.ts`:
```typescript
import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient }

export const prisma = globalForPrisma.prisma ?? new PrismaClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
```

- [ ] **Step 3: Migrar**

```bash
npm run db:up
npx prisma migrate dev --name esquema_inicial
```
Esperado: migración aplicada y cliente generado.

- [ ] **Step 4: Probar que el esquema funciona contra la base real**

`tests/esquema.test.ts`:
```typescript
import { describe, it, expect, afterAll } from 'vitest'
import { prisma } from '@/lib/db'

describe('esquema', () => {
  afterAll(async () => { await prisma.$disconnect() })

  it('crea un alumno con solo el nombre', async () => {
    const alumno = await prisma.alumno.create({
      data: { nombreCompleto: 'Prueba Esquema' },
    })
    expect(alumno.id).toBeTruthy()
    expect(alumno.datosCompletos).toBe(false)
    expect(alumno.categoria).toBe('GENERAL')
    await prisma.alumno.delete({ where: { id: alumno.id } })
  })

  it('impide asignar el mismo locker dos veces en un periodo', async () => {
    const ciclo = await prisma.cicloAnual.create({ data: { anio: 2099 } })
    const periodo = await prisma.periodo.create({
      data: { cicloAnualId: ciclo.id, mes: 1, clave: '2099-01', fechaLimite: new Date() },
    })
    const locker = await prisma.locker.create({ data: { numero: 9999 } })
    const alumnoA = await prisma.alumno.create({ data: { nombreCompleto: 'A' } })
    const alumnoB = await prisma.alumno.create({ data: { nombreCompleto: 'B' } })
    const insA = await prisma.inscripcion.create({
      data: { alumnoId: alumnoA.id, cicloAnualId: ciclo.id, folio: 'CRM-2099-0001', tokenQR: 'tok-a' },
    })
    const insB = await prisma.inscripcion.create({
      data: { alumnoId: alumnoB.id, cicloAnualId: ciclo.id, folio: 'CRM-2099-0002', tokenQR: 'tok-b' },
    })

    await prisma.asignacionLocker.create({
      data: { lockerId: locker.id, inscripcionId: insA.id, periodoId: periodo.id },
    })
    await expect(
      prisma.asignacionLocker.create({
        data: { lockerId: locker.id, inscripcionId: insB.id, periodoId: periodo.id },
      }),
    ).rejects.toThrow()

    await prisma.asignacionLocker.deleteMany({ where: { periodoId: periodo.id } })
    await prisma.inscripcion.deleteMany({ where: { cicloAnualId: ciclo.id } })
    await prisma.alumno.deleteMany({ where: { id: { in: [alumnoA.id, alumnoB.id] } } })
    await prisma.locker.delete({ where: { id: locker.id } })
    await prisma.periodo.delete({ where: { id: periodo.id } })
    await prisma.cicloAnual.delete({ where: { id: ciclo.id } })
  })
})
```

- [ ] **Step 5: Verificar**

Run: `npx vitest run tests/esquema.test.ts`
Esperado: PASS, 2 pruebas

- [ ] **Step 6: Commit**

```bash
git add prisma src/lib/db.ts tests/esquema.test.ts
git commit -m "feat: esquema de base de datos"
```

---

### Task 7: Autenticación del personal y datos iniciales

**Files:**
- Create: `src/lib/auth.ts`, `src/lib/sesion.ts`
- Create: `prisma/seed.ts`
- Create: `src/app/acceso/page.tsx`, `src/app/api/acceso/route.ts`, `src/app/api/salir/route.ts`
- Test: `tests/auth.test.ts`

**Interfaces:**
- Consumes: `prisma` de `@/lib/db`
- Produces:
  - `hashPassword(plano: string): Promise<string>`
  - `verificarPassword(plano: string, hash: string): Promise<boolean>`
  - `crearSesion(usuarioId: string): Promise<void>` / `leerSesion(): Promise<{ id, nombre, rol } | null>` / `cerrarSesion(): Promise<void>`
  - `exigirRol(...roles: Rol[])` — lanza si la sesión no cumple

- [ ] **Step 1: Escribir la prueba que falla**

`tests/auth.test.ts`:
```typescript
import { describe, it, expect } from 'vitest'
import { hashPassword, verificarPassword } from '@/lib/auth'

describe('contraseñas', () => {
  it('no guarda la contraseña en claro', async () => {
    const hash = await hashPassword('secreta123')
    expect(hash).not.toContain('secreta123')
  })
  it('acepta la contraseña correcta', async () => {
    const hash = await hashPassword('secreta123')
    expect(await verificarPassword('secreta123', hash)).toBe(true)
  })
  it('rechaza la incorrecta', async () => {
    const hash = await hashPassword('secreta123')
    expect(await verificarPassword('otra', hash)).toBe(false)
  })
})
```

- [ ] **Step 2: Verificar que falla**

Run: `npx vitest run tests/auth.test.ts` → FAIL

- [ ] **Step 3: Implementar**

`src/lib/auth.ts`:
```typescript
import bcrypt from 'bcryptjs'

export async function hashPassword(plano: string): Promise<string> {
  return bcrypt.hash(plano, 10)
}

export async function verificarPassword(plano: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plano, hash)
}
```

`src/lib/sesion.ts` usa cookies firmadas de Next (`cookies()` de `next/headers`), guardando `usuarioId` en una cookie `httpOnly`, `sameSite: 'lax'`, con vigencia de 8 horas. `leerSesion()` la lee y consulta el usuario; `exigirRol` lanza `Error('No autorizado')` si el rol no está en la lista.

- [ ] **Step 4: Escribir el seed**

`prisma/seed.ts` crea:
- Usuario **Administrador**: `«el de ADMIN_EMAIL»`, contraseña `«la de ADMIN_PASSWORD»`
- Usuario Recepción: `recepcion@demo.local`, contraseña `«la que se le ponga»`
- Usuario Profesor: `profesor@demo.local`, contraseña `«la que se le ponga»`
- Ciclo `2026` abierto
- Días inhábiles de 2026 (1 ene, 2 feb, 16 mar, 1 may, 16 sep, 17 nov, 25 dic)
- Periodos de los 12 meses de 2026, con `fechaLimite` calculada con `calcularFechaLimite(anio, mes, 5, festivos)`
- Tarifas por periodo: `GENERAL` 77000, `NINOS` 60000
- 40 lockers numerados del 1 al 40
- Grupos: `07:00-08:00`, `08:00-09:00`, `17:00-18:00`, `18:00-19:00`, `19:00-20:00`, `20:00-21:00`, cupo 25 cada uno
- Descuentos: `INAPAM` (PORCENTAJE, 20), `Beca` (PORCENTAJE, 50)
- `ConfigComision`: `EFECTIVO` y `TRANSFERENCIA` en ceros; `TARJETA` 0.036 + 300; `SPEI` 0.036 + 300; `OXXO` 0.036 + 1200 con `diasCorteAntesDeVencimiento: 3`
- **20 alumnos de ejemplo** con inscripción en 2026, repartidos entre grupos y categorías, para que la demo tenga datos

El seed es **idempotente**: usa `upsert` y no duplica al correrse dos veces.

- [ ] **Step 5: Correr el seed y verificar**

```bash
npm run db:seed
npx vitest run tests/auth.test.ts
```
Esperado: seed sin errores, 3 pruebas en verde.

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "feat: autenticación del personal y datos iniciales"
```

---

### Task 8: Generación de cargos y aplicación del recargo

**Files:**
- Create: `src/servicios/periodos.ts`
- Test: `tests/generacion-cargos.test.ts`

**Interfaces:**
- Consumes: `calcularCargo` de `@/lib/cargos`, `prisma` de `@/lib/db`
- Produces:
  - `generarCargosDePeriodo(periodoId: string): Promise<{ creados: number }>`
  - `aplicarRecargosVencidos(ahora?: Date): Promise<{ actualizados: number }>`
  - `estadoDelCargo(cargo, ahora): EstadoCargo` — puro, para el semáforo

- [ ] **Step 1: Escribir las pruebas que fallan**

Casos que deben quedar cubiertos:
- Genera un cargo por cada inscripción `ACTIVA`, y ninguno para las de `BAJA`
- El monto usa la tarifa de la **categoría del alumno**
- Suma los lockers asignados **de ese periodo**
- Correrlo dos veces **no duplica** cargos (`cargosGenerados` en el periodo y `@@unique`)
- `aplicarRecargosVencidos` pasa a `VENCIDO` y suma el recargo solo a los `PENDIENTE` cuya `fechaLimite` ya pasó
- Un cargo `PAGADO` **no** recibe recargo
- El recargo **no se aplica dos veces** al mismo cargo (`recargoAplicadoEn` no nulo)

- [ ] **Step 2: Verificar que fallan**

Run: `npx vitest run tests/generacion-cargos.test.ts` → FAIL

- [ ] **Step 3: Implementar `src/servicios/periodos.ts`**

`generarCargosDePeriodo` carga el periodo con sus tarifas, lista las inscripciones activas del ciclo con su descuento y sus asignaciones de locker del periodo, llama a `calcularCargo` por cada una, y hace un `createMany` con `skipDuplicates: true`. Al terminar marca `cargosGenerados: true`.

`aplicarRecargosVencidos` busca cargos `PENDIENTE` de periodos cuya `fechaLimite < ahora` y con `recargoAplicadoEn: null`, y en una transacción les suma `periodo.recargo` a `montoRecargo` y `montoNeto`, los pasa a `VENCIDO` y sella `recargoAplicadoEn`.

> **La deuda no se arrastra:** ninguna de las dos funciones consulta periodos anteriores. Cada mes se calcula solo.

- [ ] **Step 4: Verificar que pasan**

Run: `npx vitest run tests/generacion-cargos.test.ts` → PASS

- [ ] **Step 5: Commit**

```bash
git add src/servicios/periodos.ts tests/generacion-cargos.test.ts
git commit -m "feat: generación de cargos mensuales y recargo por mora"
```

---

### Task 9: Panel — alumnos y credencial imprimible

**Files:**
- Create: `src/app/panel/layout.tsx`, `src/app/panel/page.tsx`
- Create: `src/app/panel/alumnos/page.tsx`, `src/app/panel/alumnos/[id]/page.tsx`
- Create: `src/app/panel/alumnos/[id]/credencial/page.tsx`
- Create: `src/servicios/alumnos.ts`
- Test: `tests/alta-alumno.test.ts`

**Interfaces:**
- Consumes: `formatearFolio`, `generarTokenQR`, `prisma`
- Produces: `darDeAltaAlumno({ nombreCompleto, categoria, cicloAnualId, grupoId? }): Promise<Inscripcion>`

- [ ] **Step 1: Escribir las pruebas que fallan**

- El alta **solo exige el nombre completo**
- Asigna folio con el **consecutivo siguiente del ciclo** (`CRM-2026-0001`, luego `0002`)
- El token del QR es **distinto en cada alta**
- **Rechaza** inscribir en un grupo que ya llegó a su `cupoMaximo`
- Un mismo alumno **no puede inscribirse dos veces** en el mismo ciclo

- [ ] **Step 2: Verificar que fallan** → FAIL

- [ ] **Step 3: Implementar**

`darDeAltaAlumno` corre en una transacción: cuenta las inscripciones del ciclo para el consecutivo, valida el cupo del grupo si viene, crea el alumno y su inscripción.

Las páginas: listado con búsqueda por nombre o folio y su semáforo del mes en curso; ficha con datos, cargos e historial; y la **credencial** —una vista con `@media print` que muestra nombre, folio y el QR generado con `qrcode` apuntando a `/q/{tokenQR}`, en tamaño de credencial.

- [ ] **Step 4: Verificar que pasan** → PASS

- [ ] **Step 5: Verificación manual**

Levantar `npm run dev`, entrar a `/panel/alumnos`, dar de alta a alguien, abrir su credencial e imprimir a PDF. El QR debe leerse con la cámara del celular.

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "feat: alta de alumnos y credencial imprimible con QR"
```

---

### Task 10: Página del alumno

**Files:**
- Create: `src/app/q/[token]/page.tsx`
- Create: `src/app/q/[token]/datos/page.tsx`
- Create: `src/app/api/q/[token]/datos/route.ts`
- Create: `src/componentes/Semaforo.tsx`
- Test: `tests/pagina-alumno.test.ts`

**Interfaces:**
- Consumes: `estadoDelCargo`, `calcularTotalConComision`, `prisma`
- Produces: `cargarEstadoDeCuenta(token: string)` desde `src/servicios/estado-cuenta.ts`

- [ ] **Step 1: Escribir las pruebas que fallan**

- Un token inexistente devuelve `null` (la página responde 404, **sin revelar si el folio existe**)
- Devuelve el cargo del mes en curso con su desglose
- Incluye el **precio por método**: efectivo/transferencia al neto, tarjeta y SPEI con la comisión trasladada
- **OXXO no aparece** dentro de los 3 días previos a la fecha límite
- El historial trae solo los cargos del ciclo de esa inscripción, **nunca los de otro alumno**

- [ ] **Step 2: Verificar que fallan** → FAIL

- [ ] **Step 3: Implementar**

La página es un Server Component: busca la inscripción por `tokenQR`, y si no existe llama a `notFound()`. Muestra el semáforo grande, el desglose del mes, los precios por método (deshabilitados con la nota «Disponible en la siguiente etapa», porque Stripe llega en la Fase 2), y el historial.

Si `datosCompletos` es falso, muestra arriba un aviso para completar la información, con el **aviso de privacidad** y su casilla de consentimiento. El formulario guarda por la ruta API, que valida que el token exista y solo permite escribir en **esa** inscripción.

- [ ] **Step 4: Verificar que pasan** → PASS

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: página del alumno con semáforo y captura de datos"
```

---

### Task 11: Registro de pagos y lockers

**Files:**
- Create: `src/servicios/pagos.ts`, `src/servicios/lockers.ts`
- Create: `src/app/panel/pagos/page.tsx`, `src/app/panel/lockers/page.tsx`
- Create: `src/lib/almacenamiento.ts`
- Test: `tests/pagos.test.ts`, `tests/lockers.test.ts`

**Interfaces:**
- Consumes: `prisma`, `calcularCargo`
- Produces:
  - `registrarPagoManual({ cargoId, metodo, montoCobrado, referencia?, comprobanteUrl?, usuarioId }): Promise<Pago>`
  - `lockersDisponibles(periodoId: string): Promise<Locker[]>`
  - `asignarLocker({ lockerId, inscripcionId, periodoId }): Promise<AsignacionLocker>`
  - `guardarComprobante(archivo: File): Promise<string>` — en local escribe en `storage/comprobantes/`; la interfaz permite cambiar a Cloudinary sin tocar a quien la llama

- [ ] **Step 1: Escribir las pruebas que fallan**

Pagos:
- Registrar un pago por el neto completo deja el cargo en `PAGADO`
- Un pago parcial **no** marca el cargo como pagado
- Efectivo y transferencia registran `montoComision: 0` y `montoNeto = montoCobrado`
- El pago queda ligado al usuario que lo registró
- **Rechaza** registrar un pago sobre un cargo `CANCELADO`

Lockers:
- `lockersDisponibles` excluye los ya asignados en ese periodo y los inactivos
- Asignar un locker ocupado **falla**
- El mismo locker **sí** puede asignarse a otra persona en un periodo distinto
- Asignar un locker **recalcula el `montoNeto` del cargo** de ese periodo

- [ ] **Step 2: Verificar que fallan** → FAIL

- [ ] **Step 3: Implementar**

Al asignar o liberar un locker se recalcula el cargo del periodo con `calcularCargo`, respetando el recargo ya aplicado. La bandeja de pagos lista los cargos del mes con su estado y permite registrar el pago; los comprobantes subidos se muestran para aprobar o rechazar.

- [ ] **Step 4: Verificar que pasan** → PASS

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: registro manual de pagos y asignación de lockers"
```

---

### Task 12: Vista del profesor

**Files:**
- Create: `src/app/profesor/page.tsx`, `src/app/profesor/escaner/page.tsx`
- Create: `src/app/api/profesor/consultar/[token]/route.ts`
- Test: `tests/vista-profesor.test.ts`

**Interfaces:**
- Consumes: `estadoDelCargo`, `exigirRol`, `prisma`
- Produces: `consultarParaProfesor(token: string)` → `{ nombreCompleto, folio, fotoUrl, alCorriente: boolean, mes: string }`

- [ ] **Step 1: Escribir las pruebas que fallan**

- **La respuesta no incluye importes, teléfono, domicilio ni datos fiscales.** Se comprueba con una lista explícita de llaves permitidas
- `alCorriente` es `true` solo cuando el cargo del mes está `PAGADO`
- `PENDIENTE`, `VENCIDO` y `EN_REVISION` dan `alCorriente: false`
- La ruta **exige sesión** con rol `PROFESOR`, `RECEPCION` o `ADMINISTRADOR`
- Un token inválido responde 404

- [ ] **Step 2: Verificar que fallan** → FAIL

- [ ] **Step 3: Implementar**

El escáner usa `html5-qrcode` contra la cámara trasera. Al leer el QR extrae el token de la URL, consulta la ruta API y pinta **una pantalla completa verde o roja** con el nombre en grande. Debajo, un buscador por folio o nombre como respaldo, y la lista de asistencia del mes con casilla por día, editable solo para el mes en curso.

> `html5-qrcode` necesita HTTPS o `localhost`. En local funciona; para probar desde un celular en la misma red hay que usar un túnel HTTPS.

- [ ] **Step 4: Verificar que pasan** → PASS

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: vista del profesor con escáner y semáforo"
```

---

### Task 13: Puesta en marcha local

**Files:**
- Create: `README.md`
- Modify: `package.json` (script `setup`)

- [ ] **Step 1: Escribir el README**

Requisitos, arranque en tres comandos, los tres usuarios de prueba con sus contraseñas, y las rutas principales (`/acceso`, `/panel`, `/profesor`, `/q/{token}`).

- [ ] **Step 2: Probar desde cero**

```bash
docker compose down -v
npm run db:up && npx prisma migrate deploy && npm run db:seed && npm test
npm run dev
```
Esperado: base recreada, **todas las pruebas en verde**, aplicación en `http://localhost:3000`.

- [ ] **Step 3: Recorrido manual**

Entrar como administrador, dar de alta un alumno, imprimir su credencial, generar los cargos del mes, registrar un pago en efectivo, y confirmar que el semáforo del profesor pasa de rojo a verde.

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "docs: instrucciones de puesta en marcha local"
```

---

## Fuera de alcance en esta fase

Van en Fase 2 y 3, ya especificadas en el diseño:

- Stripe: tarjeta, SPEI y OXXO, con webhooks y firma verificada
- Subida de comprobantes por el propio alumno, con bandeja de validación
- Solicitudes de facturación con su estatus
- Los tres reportes con exportación a CSV
- Asistencia completa (en Fase 1 solo queda la pantalla base)
