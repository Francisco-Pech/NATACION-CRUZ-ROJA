'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/db'
import { requierePermiso } from '@/lib/sesion'
import { asignarLocker, liberarLocker } from '@/lib/servicios/lockers'
import { validarEntero } from '@/lib/validaciones'
import type { Resultado } from '../admin/catalogo/tipos'

const RUTA = '/panel/lockers'
const texto = (datos: FormData, campo: string) => String(datos.get(campo) ?? '').trim()
const no = (mensaje: string): Resultado => ({ ok: false, mensaje })

/** El tope es del edificio, no del sistema: nadie tiene mil lockers. */
const MAXIMO = 999

/**
 * Busca al alumno por su folio y revisa que pueda recibir un locker.
 *
 * Por folio y no por una lista de nombres: quien llega al mostrador trae su
 * credencial, y en una escuela con cientos de inscritos buscar "Ana" no
 * distingue a cuál de las nueve.
 */
async function alumnoDelFolio(folio: string, periodoId: string) {
  const inscripcion = await prisma.inscripcion.findUnique({
    where: { folio },
    include: { alumno: true },
  })
  if (!inscripcion) return { mal: `No hay ninguna inscripción con el folio ${folio}.` }
  if (inscripcion.estado !== 'ACTIVA') {
    return { mal: `${inscripcion.alumno.nombreCompleto} ya no está activo.` }
  }

  // Uno por alumno y por mes: dos lockers a la misma persona es un error de
  // captura mucho más seguido que una petición de verdad.
  const yaTiene = await prisma.asignacionLocker.findFirst({
    where: { inscripcionId: inscripcion.id, periodoId },
    include: { locker: true },
  })
  if (yaTiene) {
    return {
      mal: `${inscripcion.alumno.nombreCompleto} ya tiene el locker ${yaTiene.locker.numero} este mes.`,
    }
  }
  return { inscripcion }
}

/** Busca al profesor y revisa que de verdad lo sea. */
async function profesorDeId(usuarioId: string) {
  const usuario = await prisma.usuario.findUnique({
    where: { id: usuarioId },
    include: { rol: true },
  })
  if (!usuario || !usuario.activo) return { mal: 'Escoge un profesor de la lista.' }
  if (usuario.rol.clave !== 'PROFESOR') return { mal: `${usuario.nombre} no es profesor.` }
  return { usuario }
}

/**
 * Agrega un locker a la lista, y de una vez se lo da a quien ya se sabe que
 * lo va a usar.
 *
 * Quién lo ocupa es opcional: casi siempre se dan de alta vacíos, al poner
 * una fila nueva. Pero cuando alguien está esperando ese locker, pedirle a
 * quien captura que lo cree y después lo busque entre sesenta tarjetas es
 * hacerle dar una vuelta de más.
 *
 * Si el número ya existió y lo habían apagado, se vuelve a prender en vez
 * de crear otro: el locker de la pared es el mismo, y un duplicado partiría
 * en dos su historia de quién lo ha ocupado.
 */
export async function crearLocker(_previo: Resultado, datos: FormData): Promise<Resultado> {
  try {
    await requierePermiso('LOCKERS')

    const bruto = texto(datos, 'numero')
    const numero = Number(bruto)
    const mal = validarEntero(numero, { min: 1, max: MAXIMO, campo: 'El número', bruto })
    if (mal) return no(mal)

    const existente = await prisma.locker.findUnique({
      where: { numero },
      include: { deProfesor: true },
    })
    if (existente?.activo) return no(`El locker ${numero} ya está en la lista.`)

    // ---- a quién se le da, si es que a alguien ----
    const folio = texto(datos, 'folio').toUpperCase()
    const usuarioId = texto(datos, 'usuarioId')
    const periodoId = texto(datos, 'periodoId')

    if (folio && usuarioId) {
      return no('Escoge al alumno o al profesor, no a los dos.')
    }
    if (existente?.deProfesor && (folio || usuarioId)) {
      return no(`El locker ${numero} ya está apartado para un profesor.`)
    }

    // Se resuelve antes de crear nada: un folio mal tecleado no debe dejar
    // un locker recién creado a medio asignar.
    const alumno = folio ? await alumnoDelFolio(folio, periodoId) : null
    if (alumno?.mal) return no(alumno.mal)

    const profesor = usuarioId ? await profesorDeId(usuarioId) : null
    if (profesor?.mal) return no(profesor.mal)

    // ---- ahora sí ----
    const locker = existente
      ? await prisma.locker.update({ where: { id: existente.id }, data: { activo: true } })
      : await prisma.locker.create({ data: { numero } })

    if (alumno?.inscripcion) {
      await asignarLocker(locker.id, alumno.inscripcion.id, periodoId)
      revalidatePath(RUTA)
      revalidatePath('/panel/alumnos')
      return {
        ok: true,
        mensaje: `El locker ${numero} quedó agregado y es de ${alumno.inscripcion.alumno.nombreCompleto} este mes.`,
      }
    }

    if (profesor?.usuario) {
      await prisma.lockerDeProfesor.create({
        data: { lockerId: locker.id, usuarioId: profesor.usuario.id },
      })
      revalidatePath(RUTA)
      return {
        ok: true,
        mensaje: `El locker ${numero} quedó agregado y apartado para ${profesor.usuario.nombre}. No se cobra.`,
      }
    }

    revalidatePath(RUTA)
    return {
      ok: true,
      mensaje: existente
        ? `El locker ${numero} volvió a la lista.`
        : `El locker ${numero} quedó agregado.`,
    }
  } catch (e) {
    return no(e instanceof Error ? e.message : 'No se pudo agregar.')
  }
}

/**
 * Quita un locker de la lista.
 *
 * Uno que nunca se ocupó se borra. Uno con historia solo se apaga: sus
 * asignaciones dicen quién lo tuvo y en qué mes se le cobró, y borrarlo
 * dejaría cargos hablando de un locker que ya no existe.
 */
export async function quitarLocker(_previo: Resultado, datos: FormData): Promise<Resultado> {
  try {
    await requierePermiso('LOCKERS')

    const locker = await prisma.locker.findUnique({
      where: { id: texto(datos, 'lockerId') },
      include: { _count: { select: { asignaciones: true } }, deProfesor: true },
    })
    if (!locker) return no('Ese locker ya no existe.')

    if (locker.deProfesor) {
      return no(`El locker ${locker.numero} está apartado para un profesor. Libéralo primero.`)
    }

    if (locker._count.asignaciones === 0) {
      await prisma.locker.delete({ where: { id: locker.id } })
      revalidatePath(RUTA)
      return { ok: true, mensaje: `El locker ${locker.numero} se quitó.` }
    }

    if (!locker.activo) return { ok: true, mensaje: `El locker ${locker.numero} ya estaba fuera.` }

    await prisma.locker.update({ where: { id: locker.id }, data: { activo: false } })
    revalidatePath(RUTA)
    return {
      ok: true,
      mensaje: `El locker ${locker.numero} queda fuera de uso. Su historial se conserva.`,
    }
  } catch (e) {
    return no(e instanceof Error ? e.message : 'No se pudo quitar.')
  }
}

/** Le da un locker a un alumno, buscándolo por su folio. */
export async function apartarParaAlumno(_previo: Resultado, datos: FormData): Promise<Resultado> {
  try {
    await requierePermiso('LOCKERS')

    const folio = texto(datos, 'folio').toUpperCase()
    if (!folio) return no('Escribe el folio del alumno.')

    const locker = await prisma.locker.findUnique({ where: { id: texto(datos, 'lockerId') } })
    if (!locker) return no('Ese locker ya no existe.')

    const periodoId = texto(datos, 'periodoId')
    const { inscripcion, mal } = await alumnoDelFolio(folio, periodoId)
    if (mal || !inscripcion) return no(mal ?? 'No se pudo asignar.')

    await asignarLocker(locker.id, inscripcion.id, periodoId)
    revalidatePath(RUTA)
    revalidatePath('/panel/alumnos')
    return {
      ok: true,
      mensaje: `El locker ${locker.numero} es de ${inscripcion.alumno.nombreCompleto} este mes.`,
    }
  } catch (e) {
    return no(e instanceof Error ? e.message : 'No se pudo asignar.')
  }
}

/**
 * Aparta un locker para un profesor. No se cobra.
 *
 * No cuelga de ningún mes: se queda apartado hasta que alguien lo libere,
 * para que nadie tenga que reasignarlo el día 1 de cada mes.
 */
export async function apartarParaProfesor(_previo: Resultado, datos: FormData): Promise<Resultado> {
  try {
    await requierePermiso('LOCKERS')

    const locker = await prisma.locker.findUnique({
      where: { id: texto(datos, 'lockerId') },
      include: { deProfesor: true },
    })
    if (!locker) return no('Ese locker ya no existe.')
    if (locker.deProfesor) return no(`El locker ${locker.numero} ya es de un profesor.`)

    const { usuario, mal } = await profesorDeId(texto(datos, 'usuarioId'))
    if (mal || !usuario) return no(mal ?? 'No se pudo apartar.')

    // Ocupado este mes por un alumno: liberarlo por debajo le quitaría el
    // locker a alguien que ya lo pagó.
    const delMes = await prisma.asignacionLocker.findFirst({
      where: { lockerId: locker.id, periodoId: texto(datos, 'periodoId') },
      include: { inscripcion: { include: { alumno: true } } },
    })
    if (delMes) {
      return no(
        `El locker ${locker.numero} lo tiene ${delMes.inscripcion.alumno.nombreCompleto} ` +
          'este mes. Libéralo primero.',
      )
    }

    await prisma.lockerDeProfesor.create({ data: { lockerId: locker.id, usuarioId: usuario.id } })
    revalidatePath(RUTA)
    return { ok: true, mensaje: `El locker ${locker.numero} queda para ${usuario.nombre}. No se cobra.` }
  } catch (e) {
    return no(e instanceof Error ? e.message : 'No se pudo apartar.')
  }
}

/** Libera un locker, sea del alumno de este mes o del profesor que lo tenía. */
export async function liberar(_previo: Resultado, datos: FormData): Promise<Resultado> {
  try {
    await requierePermiso('LOCKERS')

    const locker = await prisma.locker.findUnique({
      where: { id: texto(datos, 'lockerId') },
      include: { deProfesor: true },
    })
    if (!locker) return no('Ese locker ya no existe.')

    if (locker.deProfesor) {
      await prisma.lockerDeProfesor.delete({ where: { id: locker.deProfesor.id } })
      revalidatePath(RUTA)
      return { ok: true, mensaje: `El locker ${locker.numero} quedó libre.` }
    }

    const asignacion = await prisma.asignacionLocker.findFirst({
      where: { lockerId: locker.id, periodoId: texto(datos, 'periodoId') },
    })
    if (!asignacion) return { ok: true, mensaje: `El locker ${locker.numero} ya estaba libre.` }

    // Se recalcula el cargo del mes: al quitarle el locker deja de deberlo,
    // salvo que ya lo haya pagado.
    await liberarLocker(asignacion.id)
    revalidatePath(RUTA)
    revalidatePath('/panel/alumnos')
    return { ok: true, mensaje: `El locker ${locker.numero} quedó libre.` }
  } catch (e) {
    return no(e instanceof Error ? e.message : 'No se pudo liberar.')
  }
}
