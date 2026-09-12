import { prisma } from '@/lib/db'
import {
  calcularTotalConComision, comisionesDelEntorno, type MetodoConComision,
} from '@/lib/comisiones'
import { refrescarEstadoDelCargo } from '@/lib/servicios/pagos'
import { pasarelaActiva } from '@/lib/pasarela'
import { EstadoCargo, EstadoPago, MetodoPago } from '@prisma/client'

/**
 * Arranca un cobro en línea para el mes en curso del alumno.
 *
 * Crea el Pago en estado INICIADO con el monto que realmente se le cobra
 * (neto + comisión trasladada) y lo manda a la pasarela. El cargo NO se
 * toca todavía: solo la confirmación de la pasarela puede darlo por pagado.
 */
export async function iniciarCobro(
  token: string,
  metodo: MetodoPago,
  urlRetorno: string,
  ahora: Date = new Date(),
) {
  const inscripcion = await prisma.inscripcion.findUnique({
    where: { tokenQR: token },
    include: { alumno: true },
  })
  if (!inscripcion) throw new Error('Credencial no encontrada')

  const mes = ahora.getMonth() + 1
  const cargo = await prisma.cargo.findFirst({
    where: { inscripcionId: inscripcion.id, periodo: { mes } },
    include: { periodo: true, pagos: true },
  })
  if (!cargo) throw new Error('No hay un cargo para este mes')
  if (cargo.estado === EstadoCargo.PAGADO) throw new Error('Este mes ya está pagado')
  if (cargo.estado === EstadoCargo.CANCELADO) throw new Error('Este cargo está cancelado')

  const yaPagado = cargo.pagos
    .filter((p) => p.estado === EstadoPago.CONFIRMADO)
    .reduce((suma, p) => suma + p.montoNeto, 0)
  const porCobrar = cargo.montoNeto - yaPagado
  if (porCobrar <= 0) throw new Error('Este mes ya está cubierto')

  const config = comisionesDelEntorno()[metodo as MetodoConComision]
  if (!config || !config.activo) throw new Error(`El método ${metodo} no está disponible`)

  const { total, comision } = calcularTotalConComision(porCobrar, config)

  // Un cobro anterior que quedó a medias se descarta: solo puede haber un
  // intento vivo por cargo, o el alumno vería varios pagos fantasma.
  await prisma.pago.updateMany({
    where: { cargoId: cargo.id, estado: EstadoPago.INICIADO },
    data: { estado: EstadoPago.RECHAZADO },
  })

  const pagoInicial = await prisma.pago.create({
    data: {
      cargoId: cargo.id,
      metodo,
      montoCobrado: total,
      montoComision: comision,
      montoNeto: porCobrar,
      estado: EstadoPago.INICIADO,
    },
  })

  const pasarela = pasarelaActiva()
  const intento = await pasarela.crearIntento({
    pagoId: pagoInicial.id,
    monto: total,
    metodo,
    descripcion: `Natación ${cargo.periodo.clave} · ${inscripcion.folio}`,
    urlRetorno,
  })

  const pago = await prisma.pago.update({
    where: { id: pagoInicial.id },
    data: { stripePaymentIntentId: intento.referencia },
  })

  return { pago, urlPago: intento.urlPago, cargo }
}

/**
 * Da por bueno un cobro. La llaman tanto el webhook de Stripe como la
 * pantalla de la pasarela simulada.
 *
 * Es idempotente a propósito: las pasarelas reintentan sus avisos, y
 * confirmar dos veces no debe duplicar el pago ni alterar nada.
 */
export async function confirmarCobro(referencia: string) {
  const pago = await prisma.pago.findFirst({
    where: { stripePaymentIntentId: referencia },
  })
  if (!pago) return null
  if (pago.estado === EstadoPago.CONFIRMADO) return pago

  const confirmado = await prisma.pago.update({
    where: { id: pago.id },
    data: { estado: EstadoPago.CONFIRMADO, fechaPago: new Date() },
  })
  await refrescarEstadoDelCargo(pago.cargoId)
  return confirmado
}

/** Marca el intento como fallido. El cargo queda como estaba. */
export async function rechazarCobro(referencia: string) {
  const pago = await prisma.pago.findFirst({
    where: { stripePaymentIntentId: referencia },
  })
  if (!pago) return null
  if (pago.estado === EstadoPago.CONFIRMADO) return pago

  const rechazado = await prisma.pago.update({
    where: { id: pago.id },
    data: { estado: EstadoPago.RECHAZADO },
  })
  await refrescarEstadoDelCargo(pago.cargoId)
  return rechazado
}
