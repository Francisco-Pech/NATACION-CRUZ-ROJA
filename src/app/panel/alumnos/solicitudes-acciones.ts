'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/db'
import { requierePermiso } from '@/lib/sesion'
import { inscribirAlumno } from '@/lib/servicios/inscripciones'
import { periodoActual } from '@/lib/periodo-actual'
import { hoyEnCancun } from '@/lib/zona'
import type { Resultado } from '../admin/catalogo/tipos'

const texto = (datos: FormData, campo: string) => String(datos.get(campo) ?? '').trim()
const no = (mensaje: string): Resultado => ({ ok: false, mensaje })

/** La solicitud que se va a atender, si existe y nadie la atendió ya. */
async function sinAtender(hash: string) {
  if (!hash) return null
  return prisma.solicitudDeRegistro.findFirst({
    where: { hash, atendidaEn: null },
    include: { tipoCurso: true, horario: true, locker: true },
  })
}

/**
 * Convierte una solicitud en alumno.
 *
 * Es el único camino por el que alguien que se registró solo entra al
 * sistema: hasta aquí no había folio, ni meses, ni nada que cobrar. Quien
 * aprieta este botón está diciendo "esta persona existe y vino".
 *
 * Se le apunta a todos los días en que su curso corre a esa hora, que es
 * como se inscribe desde la ventanilla: no se escoge día por día.
 *
 * El locker que pidió puede haberse ocupado mientras tanto —su solicitud no
 * lo aparta— y en ese caso se le da de alta sin locker y se avisa. Es
 * preferible a no poder inscribirlo por una llave.
 */
export async function darDeAltaSolicitud(_previo: Resultado, datos: FormData): Promise<Resultado> {
  try {
    const usuario = await requierePermiso('ALUMNOS')

    const solicitud = await sinAtender(texto(datos, 'hash'))
    if (!solicitud) return no('Esa solicitud ya no está pendiente. Recarga la página.')

    const anio = Number(hoyEnCancun().slice(0, 4))
    const ciclo = await prisma.cicloAnual.findUnique({ where: { anio } })
    if (!ciclo) return no(`No hay ciclo de ${anio}. Ábrelo antes de dar de alta a nadie.`)

    const sesiones = await prisma.sesion.findMany({
      where: {
        activo: true,
        tipoCursoId: solicitud.tipoCursoId,
        horarioId: solicitud.horarioId,
      },
      select: { id: true },
    })
    if (sesiones.length === 0) {
      return no('Ese curso ya no se da a esa hora. Dalo de alta desde el formulario normal.')
    }

    // El locker se revisa ahora, no cuando lo pidió: pudo ocuparse.
    const actual = await periodoActual()
    let locker: { id: string; periodoId: string } | undefined
    let seLeFue = false
    if (solicitud.lockerId && actual) {
      const libre = await prisma.asignacionLocker.findFirst({
        where: { lockerId: solicitud.lockerId, periodoId: actual.periodo.id },
        select: { id: true },
      })
      if (libre) seLeFue = true
      else locker = { id: solicitud.lockerId, periodoId: actual.periodo.id }
    }

    const inscripcion = await inscribirAlumno({
      nombreCompleto: solicitud.nombreCompleto,
      cicloAnualId: ciclo.id,
      sesionIds: sesiones.map((s) => s.id),
      ...(locker ? { locker } : {}),
    })

    await prisma.solicitudDeRegistro.update({
      where: { id: solicitud.id },
      data: {
        atendidaEn: new Date(),
        atendidaPorId: usuario.id,
        inscripcionId: inscripcion.id,
      },
    })

    revalidatePath('/panel/alumnos')
    return {
      ok: true,
      mensaje:
        `${solicitud.nombreCompleto} quedó inscrito con el folio ${inscripcion.folio}.` +
        (seLeFue ? ' El locker que pidió ya estaba ocupado: se dio de alta sin locker.' : ''),
    }
  } catch (e) {
    return no(e instanceof Error ? e.message : 'No se pudo dar de alta.')
  }
}

/**
 * Descarta una solicitud sin crear a nadie.
 *
 * Para los duplicados —alguien que ya estaba inscrito y volvió a llenar el
 * formulario— y para la basura que llega a cualquier formulario abierto.
 *
 * No se borra: queda con su fecha y con quién la descartó. Una solicitud
 * que desaparece sin rastro es una que nadie puede reclamar después.
 */
export async function descartarSolicitud(_previo: Resultado, datos: FormData): Promise<Resultado> {
  try {
    const usuario = await requierePermiso('ALUMNOS')

    const solicitud = await sinAtender(texto(datos, 'hash'))
    if (!solicitud) return no('Esa solicitud ya no está pendiente. Recarga la página.')

    await prisma.solicitudDeRegistro.update({
      where: { id: solicitud.id },
      data: { atendidaEn: new Date(), atendidaPorId: usuario.id },
    })

    revalidatePath('/panel/alumnos')
    return { ok: true, mensaje: `Se descartó la solicitud de ${solicitud.nombreCompleto}.` }
  } catch (e) {
    return no(e instanceof Error ? e.message : 'No se pudo descartar.')
  }
}
