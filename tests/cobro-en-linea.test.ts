import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest'
import { prisma } from '@/lib/db'
import { iniciarCobro, confirmarCobro, rechazarCobro } from '@/lib/servicios/cobro-en-linea'
import { Categoria, EstadoCargo, EstadoPago, MetodoPago } from '@prisma/client'

const ANIO = 2096
const EN_MARZO = new Date(`${2096}-03-02T10:00:00`)
let periodoId = ''
let cargoId = ''
let token = ''

async function limpiar() {
  const ciclo = await prisma.cicloAnual.findUnique({ where: { anio: ANIO } })
  if (!ciclo) return
  const insc = await prisma.inscripcion.findMany({
    where: { cicloAnualId: ciclo.id },
    select: { alumnoId: true },
  })
  await prisma.cicloAnual.delete({ where: { id: ciclo.id } })
  await prisma.alumno.deleteMany({ where: { id: { in: insc.map((i) => i.alumnoId) } } })
}

beforeEach(async () => {
  // Sin llaves de Stripe: estas pruebas son del servicio, no de la pasarela.
  // El .env del proyecto sí las trae, y sin apagarlas cada corrida crearía
  // intentos de pago de verdad en la cuenta de la delegación.
  vi.stubEnv('STRIPE_SECRET_KEY', '')

  await limpiar()
  const ciclo = await prisma.cicloAnual.create({ data: { anio: ANIO } })
  const periodo = await prisma.periodo.create({
    data: {
      cicloAnualId: ciclo.id, mes: 3, clave: `${ANIO}-03`,
      fechaLimite: new Date(`${ANIO}-03-06T23:59:59`),
      recargo: 5000, precioLocker: 10000,
    },
  })
  periodoId = periodo.id

  const alumno = await prisma.alumno.create({
    data: { nombreCompleto: 'Pagador en línea', categoria: Categoria.GENERAL },
  })
  token = `tok-linea-${ANIO}`
  const inscripcion = await prisma.inscripcion.create({
    data: {
      alumnoId: alumno.id, cicloAnualId: ciclo.id,
      folio: `CRM-${ANIO}-0001`, tokenQR: token,
    },
  })
  const adultos = await prisma.tipoCurso.findUniqueOrThrow({ where: { clave: "ADULTOS" } })
  const cargo = await prisma.cargo.create({
    data: {
      inscripcionId: inscripcion.id, periodoId, tipoCursoId: adultos.id,
      montoMensualidad: 77000, montoNeto: 77000,
    },
  })
  cargoId = cargo.id
})

afterAll(async () => {
  await limpiar()
  await prisma.$disconnect()
})

describe('iniciarCobro', () => {
  it('cobra el monto con la comisión trasladada, no el neto', async () => {
    const { pago } = await iniciarCobro(token, MetodoPago.TARJETA, 'http://x', EN_MARZO)
    // $770 netos con 3.6% + $3 + IVA se cobran como $808.
    expect(pago.montoCobrado).toBe(80800)
    expect(pago.montoNeto).toBe(77000)
    expect(pago.montoComision).toBe(3800)
  })

  it('deja el pago INICIADO y el cargo sin pagar', async () => {
    const { pago } = await iniciarCobro(token, MetodoPago.TARJETA, 'http://x', EN_MARZO)
    expect(pago.estado).toBe(EstadoPago.INICIADO)
    const cargo = await prisma.cargo.findUniqueOrThrow({ where: { id: cargoId } })
    expect(cargo.estado).not.toBe(EstadoCargo.PAGADO)
  })

  it('devuelve con qué sigue el alumno para terminar de pagar', async () => {
    const { siguiente } = await iniciarCobro(token, MetodoPago.TARJETA, 'http://x', EN_MARZO)
    expect(siguiente.tipo).toBeTruthy()
  })

  it('se niega a cobrar de nuevo un cargo ya pagado', async () => {
    await prisma.cargo.update({ where: { id: cargoId }, data: { estado: EstadoCargo.PAGADO } })
    await expect(iniciarCobro(token, MetodoPago.TARJETA, 'http://x', EN_MARZO)).rejects.toThrow()
  })

  it('rechaza un token que no existe', async () => {
    await expect(iniciarCobro('no-existe', MetodoPago.TARJETA, 'http://x', EN_MARZO)).rejects.toThrow()
  })
})

describe('confirmarCobro', () => {
  it('marca el pago confirmado y el cargo pagado', async () => {
    const { pago } = await iniciarCobro(token, MetodoPago.TARJETA, 'http://x', EN_MARZO)
    await confirmarCobro(pago.stripePaymentIntentId!)

    const actualizado = await prisma.pago.findUniqueOrThrow({ where: { id: pago.id } })
    expect(actualizado.estado).toBe(EstadoPago.CONFIRMADO)

    const cargo = await prisma.cargo.findUniqueOrThrow({ where: { id: cargoId } })
    expect(cargo.estado).toBe(EstadoCargo.PAGADO)
  })

  it('es idempotente: el mismo aviso dos veces no cobra doble', async () => {
    // Las pasarelas reintentan sus webhooks; confirmar dos veces debe ser inocuo.
    const { pago } = await iniciarCobro(token, MetodoPago.TARJETA, 'http://x', EN_MARZO)
    await confirmarCobro(pago.stripePaymentIntentId!)
    await confirmarCobro(pago.stripePaymentIntentId!)

    const pagos = await prisma.pago.findMany({ where: { cargoId } })
    expect(pagos).toHaveLength(1)
    expect(pagos[0].estado).toBe(EstadoPago.CONFIRMADO)
  })

  it('ignora una referencia desconocida sin reventar', async () => {
    await expect(confirmarCobro('sim_inexistente')).resolves.toBeNull()
  })
})

describe('rechazarCobro', () => {
  it('deja el cargo sin pagar', async () => {
    const { pago } = await iniciarCobro(token, MetodoPago.TARJETA, 'http://x', EN_MARZO)
    await rechazarCobro(pago.stripePaymentIntentId!)

    const actualizado = await prisma.pago.findUniqueOrThrow({ where: { id: pago.id } })
    expect(actualizado.estado).toBe(EstadoPago.RECHAZADO)

    const cargo = await prisma.cargo.findUniqueOrThrow({ where: { id: cargoId } })
    expect(cargo.estado).not.toBe(EstadoCargo.PAGADO)
  })
})
