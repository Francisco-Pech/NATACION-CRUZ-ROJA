import { prisma } from '@/lib/db'

export async function lockersDisponibles(periodoId: string) {
  return prisma.locker.findMany({
    where: { activo: true, asignaciones: { none: { periodoId } } },
    orderBy: { numero: 'asc' },
  })
}

export async function asignarLocker(
  lockerId: string,
  inscripcionId: string,
  periodoId: string,
) {
  const locker = await prisma.locker.findUniqueOrThrow({ where: { id: lockerId } })

  const ocupado = await prisma.asignacionLocker.findUnique({
    where: { lockerId_periodoId: { lockerId, periodoId } },
  })
  if (ocupado) {
    throw new Error(`El locker ${locker.numero} ya está asignado en este periodo`)
  }

  const asignacion = await prisma.asignacionLocker.create({
    data: { lockerId, inscripcionId, periodoId },
  })
  await recalcularCargo(inscripcionId, periodoId)
  return asignacion
}

export async function liberarLocker(asignacionId: string) {
  const asignacion = await prisma.asignacionLocker.delete({ where: { id: asignacionId } })
  await recalcularCargo(asignacion.inscripcionId, asignacion.periodoId)
}

/** Al mover lockers cambia lo que debe el alumno, salvo que ya haya pagado. */
async function recalcularCargo(inscripcionId: string, periodoId: string) {
  // Quien lleva dos cursos tiene dos cargos ese mes, pero un solo locker.
  // Se busca el cargo que ya lo trae; si ninguno, va al primero que nació.
  const cargos = await prisma.cargo.findMany({
    where: { inscripcionId, periodoId },
    orderBy: { creadoEn: 'asc' },
  })
  const cargo = cargos.find((c) => c.montoLockers > 0) ?? cargos[0]
  if (!cargo || cargo.estado === 'PAGADO' || cargo.estado === 'CANCELADO') return

  const periodo = await prisma.periodo.findUniqueOrThrow({ where: { id: periodoId } })
  const lockers = await prisma.asignacionLocker.count({ where: { inscripcionId, periodoId } })
  const montoLockers = lockers * periodo.precioLocker

  await prisma.cargo.update({
    where: { id: cargo.id },
    data: {
      montoLockers,
      montoNeto:
        cargo.montoMensualidad - cargo.montoDescuento + montoLockers + cargo.montoRecargo,
    },
  })
}
