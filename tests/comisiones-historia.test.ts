import { describe, it, expect, beforeEach, afterAll } from 'vitest'
import { prisma } from '@/lib/db'
import { iniciarCobro, confirmarCobro } from '@/lib/servicios/cobro-en-linea'
import { Categoria, EstadoPago, MetodoPago } from '@prisma/client'

/**
 * Cambiar la comisión no reescribe la historia.
 *
 * Las comisiones viven en el entorno y cambian cuando cambia el contrato con
 * la pasarela. La duda razonable es si ese cambio alcanza a lo ya cobrado:
 * no debe. Cada pago guarda sus propios montos al crearse, y confirmarlo más
 * tarde solo cambia su estado y su fecha.
 */

const ANIO = 2094
const EN_MARZO = new Date(`${2094}-03-02T10:00:00`)
let cargoId = ''
let token = ''

async function limpiar() {
  const ciclo = await prisma.cicloAnual.findUnique({ where: { anio: ANIO } })
  if (!ciclo) return
  const insc = await prisma.inscripcion.findMany({
    where: { cicloAnualId: ciclo.id }, select: { alumnoId: true },
  })
  await prisma.cicloAnual.delete({ where: { id: ciclo.id } })
  await prisma.alumno.deleteMany({ where: { id: { in: insc.map((i) => i.alumnoId) } } })
}

/** Pone las variables que pide la prueba y devuelve cómo dejarlas como estaban. */
function conEntorno(vars: Record<string, string>) {
  const antes = Object.fromEntries(Object.keys(vars).map((k) => [k, process.env[k]]))
  Object.assign(process.env, vars)
  return () => {
    for (const [k, v] of Object.entries(antes)) {
      if (v === undefined) delete process.env[k]
      else process.env[k] = v
    }
  }
}

beforeEach(async () => {
  await limpiar()
  const ciclo = await prisma.cicloAnual.create({ data: { anio: ANIO } })
  const periodo = await prisma.periodo.create({
    data: {
      cicloAnualId: ciclo.id, mes: 3, clave: `${ANIO}-03`,
      fechaLimite: new Date(`${ANIO}-03-06T23:59:59`),
      recargo: 5000, precioLocker: 10000,
    },
  })
  const alumno = await prisma.alumno.create({
    data: { nombreCompleto: 'Pagador de historia', categoria: Categoria.GENERAL },
  })
  token = `tok-hist-${ANIO}`
  const inscripcion = await prisma.inscripcion.create({
    data: { alumnoId: alumno.id, cicloAnualId: ciclo.id, folio: `CRM-${ANIO}-0001`, tokenQR: token },
  })
  const adultos = await prisma.tipoCurso.findUniqueOrThrow({ where: { clave: 'ADULTOS' } })
  const cargo = await prisma.cargo.create({
    data: {
      inscripcionId: inscripcion.id, periodoId: periodo.id, tipoCursoId: adultos.id,
      montoMensualidad: 77000, montoNeto: 77000,
    },
  })
  cargoId = cargo.id
})

afterAll(async () => { await limpiar(); await prisma.$disconnect() })

describe('cambiar la comisión no toca lo ya cobrado', () => {
  it('un pago conserva sus montos aunque después suba la comisión', async () => {
    const restaurar = conEntorno({ COMISION_TARJETA_PORCENTAJE: '3.6', COMISION_TARJETA_FIJA: '3' })
    const { pago } = await iniciarCobro(token, MetodoPago.TARJETA, 'http://x', EN_MARZO)
    restaurar()

    const comoNacio = await prisma.pago.findUniqueOrThrow({ where: { id: pago.id } })

    // Sube la comisión: nuevo contrato, nuevo año, lo que sea.
    const restaurar2 = conEntorno({ COMISION_TARJETA_PORCENTAJE: '9', COMISION_TARJETA_FIJA: '50' })
    const despues = await prisma.pago.findUniqueOrThrow({ where: { id: pago.id } })
    restaurar2()

    expect(despues.montoCobrado).toBe(comoNacio.montoCobrado)
    expect(despues.montoComision).toBe(comoNacio.montoComision)
    expect(despues.montoNeto).toBe(comoNacio.montoNeto)
  })

  it('confirmar después del cambio no recalcula nada', async () => {
    const restaurar = conEntorno({ COMISION_TARJETA_PORCENTAJE: '3.6', COMISION_TARJETA_FIJA: '3' })
    const { pago } = await iniciarCobro(token, MetodoPago.TARJETA, 'http://x', EN_MARZO)
    const comoNacio = await prisma.pago.findUniqueOrThrow({ where: { id: pago.id } })
    restaurar()

    const restaurar2 = conEntorno({ COMISION_TARJETA_PORCENTAJE: '9', COMISION_TARJETA_FIJA: '50' })
    const confirmado = await confirmarCobro(comoNacio.stripePaymentIntentId!)
    restaurar2()

    expect(confirmado!.estado).toBe(EstadoPago.CONFIRMADO)
    expect(confirmado!.montoCobrado).toBe(comoNacio.montoCobrado)
    expect(confirmado!.montoComision).toBe(comoNacio.montoComision)
  })

  // Lo que sí tiene que cambiar: lo que se le ofrece a quien todavía no paga.
  it('un cobro nuevo sí usa la comisión nueva', async () => {
    const restaurar = conEntorno({ COMISION_TARJETA_PORCENTAJE: '3.6', COMISION_TARJETA_FIJA: '3' })
    const primero = await iniciarCobro(token, MetodoPago.TARJETA, 'http://x', EN_MARZO)
    restaurar()

    const restaurar2 = conEntorno({ COMISION_TARJETA_PORCENTAJE: '9', COMISION_TARJETA_FIJA: '50' })
    const segundo = await iniciarCobro(token, MetodoPago.TARJETA, 'http://x', EN_MARZO)
    restaurar2()

    expect(segundo.pago.montoCobrado).toBeGreaterThan(primero.pago.montoCobrado)
    expect(segundo.pago.montoNeto).toBe(primero.pago.montoNeto)
  })
})
