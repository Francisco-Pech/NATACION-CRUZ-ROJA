'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/db'
import { nuevoHash } from '@/lib/ids'
import { validarEntero, LARGO_DESCRIPCION } from '@/lib/validaciones'
import { exigirAdministrador, falla, texto, numero, casilla } from '../guardas'
import type { Resultado } from '../guardas'

/**
 * Un renglón de "Días y horarios por curso": una fecha por curso cruzada con
 * un día laboral, más su cupo.
 *
 * Aquí no viaja ningún id de la base: lo que entra por el formulario es el
 * hash, y de él se resuelve el registro. Con el id, quien viera el 6 sabría
 * que existe el 5 y podría pedirlo.
 */

const RUTA = '/panel/admin/rejilla'

/** El alta se anuncia; cualquier otra cosa tiene que resolver un hash que exista. */
const esAlta = (datos: FormData) => texto(datos, 'alta') === '1'

const comoSeLlama = (curso: string, dia: string, hora: string) => `${curso}, ${dia} ${hora}`

export async function guardarSesion(_previo: Resultado, datos: FormData): Promise<Resultado> {
  try {
    await exigirAdministrador()

    const temporada = await prisma.temporadaCurso.findUnique({
      where: { hash: texto(datos, 'temporada') },
      include: { tipoCurso: true },
    })
    if (!temporada) return { ok: false, mensaje: 'Escoge a qué curso y temporada pertenece.' }

    const franja = await prisma.franjaLaboral.findUnique({
      where: { hash: texto(datos, 'franja') },
      include: { diaSemana: true, horario: true },
    })
    if (!franja) return { ok: false, mensaje: 'Escoge en qué día y horario corre.' }
    if (!franja.activo) {
      return { ok: false, mensaje: 'La alberca ya no abre en ese día y horario.' }
    }

    // Se pasa también lo que se escribió: así "muchos" se responde con
    // «"muchos" no es un número» y no con «falta el número», que suena a
    // que se dejó en blanco y manda a buscar en el lugar equivocado.
    const cupoMaximo = numero(datos, 'cupoMaximo')
    const malCupo = validarEntero(cupoMaximo, {
      min: 1, max: 999, campo: 'El cupo', bruto: texto(datos, 'cupoMaximo'),
    })
    if (malCupo) return { ok: false, mensaje: malCupo }

    // Sin tolerancia es una respuesta válida, no un campo en blanco: hay
    // clases donde no hay dónde meter a uno más.
    const brutoExtras = texto(datos, 'extras')
    const extras = brutoExtras === '' ? 0 : numero(datos, 'extras')
    const malExtras = validarEntero(extras, {
      min: 0, max: 999, campo: 'Los extras', bruto: brutoExtras,
    })
    if (malExtras) return { ok: false, mensaje: malExtras }

    if (texto(datos, 'descripcion').length > LARGO_DESCRIPCION.max) {
      return { ok: false, mensaje: `La descripción es muy larga: máximo ${LARGO_DESCRIPCION.max} letras.` }
    }

    const nombre = comoSeLlama(
      temporada.tipoCurso.nombre, franja.diaSemana.nombre, franja.horario.horaInicio,
    )
    const comun = {
      temporadaCursoId: temporada.id,
      franjaLaboralId: franja.id,
      tipoCursoId: temporada.tipoCursoId,
      horarioId: franja.horarioId,
      diaSemana: franja.diaSemana.numero,
      cupoMaximo,
      extras,
      // En blanco se guarda como nada, no como cadena vacía: así "sin nota"
      // es un solo valor y no dos que se ven igual.
      descripcion: texto(datos, 'descripcion') || null,
      activo: casilla(datos, 'activo'),
    }

    if (esAlta(datos)) {
      const repetida = await prisma.sesion.findUnique({
        where: {
          tipoCursoId_horarioId_diaSemana: {
            tipoCursoId: comun.tipoCursoId, horarioId: comun.horarioId, diaSemana: comun.diaSemana,
          },
        },
      })
      if (repetida) return { ok: false, mensaje: `${nombre} ya está en la lista.` }

      await prisma.sesion.create({ data: { ...comun, hash: nuevoHash() } })
      revalidatePath(RUTA)
      return { ok: true, mensaje: `${nombre} quedó agregado.` }
    }

    const actual = await prisma.sesion.findUnique({ where: { hash: texto(datos, 'hash') } })
    if (!actual) return { ok: false, mensaje: 'Ese renglón ya no existe.' }

    // Mover un renglón a un día u hora que ya ocupa otro del mismo curso
    // dejaría dos iguales, y al inscribir no habría manera de saber a cuál.
    const choca = await prisma.sesion.findUnique({
      where: {
        tipoCursoId_horarioId_diaSemana: {
          tipoCursoId: comun.tipoCursoId, horarioId: comun.horarioId, diaSemana: comun.diaSemana,
        },
      },
    })
    if (choca && choca.id !== actual.id) {
      return { ok: false, mensaje: `${nombre} ya está en otro renglón.` }
    }

    await prisma.sesion.update({ where: { id: actual.id }, data: comun })
    revalidatePath(RUTA)
    revalidatePath('/panel/alumnos')
    return { ok: true, mensaje: `${nombre} quedó guardado.` }
  } catch (e) {
    return falla(e)
  }
}

/**
 * Apaga un renglón. Nunca lo borra.
 *
 * Sus inscritos y sus cargos lo siguen nombrando: sin el renglón nadie
 * podría reconstruir quién iba ese día a esa hora, que es justo lo que hace
 * falta cuando alguien reclama. Apagado deja de ofrecerse al inscribir, y
 * eso es todo lo que hace falta.
 */
export async function desactivarSesion(_previo: Resultado, datos: FormData): Promise<Resultado> {
  try {
    await exigirAdministrador()
    const sesion = await prisma.sesion.findUnique({
      where: { hash: texto(datos, 'hash') },
      include: { tipoCurso: true, horario: true, franja: { include: { diaSemana: true } } },
    })
    if (!sesion) return { ok: false, mensaje: 'Ese renglón ya no existe.' }

    const nombre = comoSeLlama(
      sesion.tipoCurso.nombre,
      sesion.franja?.diaSemana.nombre ?? 'ese día',
      sesion.horario.horaInicio,
    )
    if (!sesion.activo) return { ok: true, mensaje: `${nombre} ya estaba desactivado.` }

    await prisma.sesion.update({ where: { id: sesion.id }, data: { activo: false } })
    revalidatePath(RUTA)
    revalidatePath('/panel/alumnos')
    return { ok: true, mensaje: `${nombre} se desactivó.` }
  } catch (e) {
    return falla(e)
  }
}
