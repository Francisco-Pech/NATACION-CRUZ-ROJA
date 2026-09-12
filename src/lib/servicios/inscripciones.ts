import { prisma } from '@/lib/db'
import { cabeUnoMas } from '@/lib/cupos'
import { formatearFolio, generarTokenQR } from '@/lib/folio'
import { Categoria } from '@prisma/client'

export async function siguienteConsecutivo(cicloAnualId: string): Promise<number> {
  return (await prisma.inscripcion.count({ where: { cicloAnualId } })) + 1
}

/**
 * Alta mínima: basta el nombre completo. El resto de los datos los llena
 * el propio alumno al abrir su QR, así recepción no se traba capturando.
 *
 * Las sesiones son opcionales, pero sin ellas el alumno no tiene curso y
 * **no se le genera cargo**: la pantalla lo señala.
 *
 * Todo va en una transacción. Si una sesión está llena, no debe quedar un
 * alumno huérfano ni un folio quemado: o entra completo, o no entra.
 */
export async function inscribirAlumno(
  nombreCompleto: string,
  cicloAnualId: string,
  categoria: Categoria = Categoria.GENERAL,
  sesionIds: string[] = [],
) {
  const ciclo = await prisma.cicloAnual.findUniqueOrThrow({ where: { id: cicloAnualId } })

  return prisma.$transaction(async (tx) => {
    const consecutivo = (await tx.inscripcion.count({ where: { cicloAnualId } })) + 1
    const alumno = await tx.alumno.create({ data: { nombreCompleto, categoria } })

    const inscripcion = await tx.inscripcion.create({
      data: {
        alumnoId: alumno.id,
        cicloAnualId,
        folio: formatearFolio(ciclo.anio, consecutivo),
        tokenQR: generarTokenQR(),
      },
      include: { alumno: true },
    })

    for (const sesionId of [...new Set(sesionIds)]) {
      await apuntarASesion(tx, inscripcion.id, sesionId)
    }

    return inscripcion
  })
}

type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0]

/**
 * Apunta una inscripción a una sesión respetando el cupo.
 *
 * El cupo se cuenta aquí, en el servidor, y no solo en la pantalla: la
 * pantalla puede venir de un formulario viejo o de alguien que la saltó.
 */
async function apuntarASesion(tx: Tx, inscripcionId: string, sesionId: string) {
  const sesion = await tx.sesion.findUnique({
    where: { id: sesionId },
    include: { horario: true, tipoCurso: true, _count: { select: { inscritos: true } } },
  })
  if (!sesion) throw new Error('Esa sesión no existe')
  if (!sesion.activo) throw new Error('Esa sesión está cerrada')

  // El cupo es del curso; la sesión solo trae el suyo cuando de verdad es
  // distinto. Los extras dejan entrar a alguien más allá del tope antes de
  // mandarlo a la calle.
  if (cabeUnoMas(sesion._count.inscritos, sesion.cupoMaximo, sesion.extras) === 'lleno') {
    throw new Error(
      `Sin cupo en ${sesion.tipoCurso.nombre} de ${sesion.horario.horaInicio}: ` +
        `${sesion._count.inscritos} de ${sesion.cupoMaximo}`,
    )
  }

  await tx.inscripcionSesion.create({ data: { inscripcionId, sesionId } })
}

/** Cambia las sesiones de un alumno ya inscrito, respetando el cupo. */
export async function cambiarSesiones(inscripcionId: string, sesionIds: string[]) {
  return prisma.$transaction(async (tx) => {
    const deseadas = [...new Set(sesionIds)]
    const actuales = await tx.inscripcionSesion.findMany({ where: { inscripcionId } })

    const quitar = actuales.filter((a) => !deseadas.includes(a.sesionId))
    const agregar = deseadas.filter((id) => !actuales.some((a) => a.sesionId === id))

    // Primero se quitan: si alguien se mueve de un horario a otro dentro
    // del mismo cupo, liberar antes evita un falso "sin cupo".
    if (quitar.length > 0) {
      await tx.inscripcionSesion.deleteMany({ where: { id: { in: quitar.map((q) => q.id) } } })
    }
    for (const sesionId of agregar) {
      await apuntarASesion(tx, inscripcionId, sesionId)
    }
  })
}
