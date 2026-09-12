import { prisma } from '@/lib/db'
import { EstadoCargo, EstadoPago, MetodoPago } from '@prisma/client'

const SIN_COMISION: MetodoPago[] = [MetodoPago.EFECTIVO, MetodoPago.TRANSFERENCIA]

export type DatosPago = {
  cargoId: string
  metodo: MetodoPago
  montoCobrado: number
  montoComision?: number
  referencia?: string
  comprobanteUrl?: string
  registradoPorId?: string
  estado?: EstadoPago
}

export async function registrarPago(datos: DatosPago) {
  const comision = SIN_COMISION.includes(datos.metodo) ? 0 : datos.montoComision ?? 0

  const pago = await prisma.pago.create({
    data: {
      cargoId: datos.cargoId,
      metodo: datos.metodo,
      montoCobrado: datos.montoCobrado,
      montoComision: comision,
      montoNeto: datos.montoCobrado - comision,
      referencia: datos.referencia,
      comprobanteUrl: datos.comprobanteUrl,
      registradoPorId: datos.registradoPorId,
      estado: datos.estado ?? EstadoPago.CONFIRMADO,
    },
  })

  await refrescarEstadoDelCargo(datos.cargoId)
  return pago
}

export async function validarPago(
  pagoId: string,
  validadoPorId: string,
  aprobado: boolean,
) {
  const pago = await prisma.pago.update({
    where: { id: pagoId },
    data: {
      estado: aprobado ? EstadoPago.CONFIRMADO : EstadoPago.RECHAZADO,
      validadoPorId,
    },
  })
  await refrescarEstadoDelCargo(pago.cargoId)
  return pago
}

/**
 * El estado del cargo se deriva de sus pagos, nunca se fija a mano:
 * así no puede quedar marcado como pagado sin dinero que lo respalde.
 */
export async function refrescarEstadoDelCargo(cargoId: string) {
  const cargo = await prisma.cargo.findUniqueOrThrow({
    where: { id: cargoId },
    include: { pagos: true, periodo: true },
  })
  if (cargo.estado === EstadoCargo.CANCELADO) return

  const confirmado = cargo.pagos
    .filter((p) => p.estado === EstadoPago.CONFIRMADO)
    .reduce((suma, p) => suma + p.montoNeto, 0)

  const hayRevision = cargo.pagos.some((p) => p.estado === EstadoPago.EN_REVISION)

  let estado: EstadoCargo
  if (confirmado >= cargo.montoNeto) estado = EstadoCargo.PAGADO
  else if (hayRevision) estado = EstadoCargo.EN_REVISION
  else if (new Date() > cargo.periodo.fechaLimite) estado = EstadoCargo.VENCIDO
  else estado = EstadoCargo.PENDIENTE

  if (estado !== cargo.estado) {
    await prisma.cargo.update({ where: { id: cargoId }, data: { estado } })
  }
}

export async function totalPagado(cargoId: string): Promise<number> {
  const suma = await prisma.pago.aggregate({
    where: { cargoId, estado: EstadoPago.CONFIRMADO },
    _sum: { montoNeto: true },
  })
  return suma._sum.montoNeto ?? 0
}
