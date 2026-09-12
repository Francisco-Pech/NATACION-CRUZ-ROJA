'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/db'
import { nuevoHash } from '@/lib/ids'
import { LARGO_NOMBRE } from '@/lib/validaciones'
import { fechaDeTexto } from '@/lib/dias-inhabiles'
import { seEnciman, mesesQueCorre, type ModoFecha } from '@/lib/temporadas'
import { exigirAdministrador, exigirRoot, falla, texto } from '../guardas'
import type { Resultado } from '../guardas'

/**
 * Las temporadas de un curso: los tramos del año en que corre.
 *
 * El año que se captura importa solo en el modo Único. En Recurrente y
 * Mixto lo que cuenta es el día y el mes, porque se repiten; el año se
 * guarda igual para no inventar un formato aparte.
 */
const NO_EXISTE: Resultado = {
  ok: false,
  mensaje: 'Esa temporada ya no existe, o el enlace no es válido. Recarga la página.',
}

/**
 * ¿Le cabe otra temporada a este curso?
 *
 * Recurrente y Único son un solo tramo por definición: el primero lo repite
 * cada año y el segundo ocurre una vez. Para varios está Mixto.
 */
/**
 * ¿Esta temporada haría que el curso se encime con otro que se llama igual?
 *
 * Dos cursos pueden llamarse igual mientras no corran a la vez. Aquí es
 * donde de verdad se decide: al crear el curso todavía no tiene fechas, así
 * que no hay con qué comparar; es al ponérselas cuando se sabe.
 *
 * `salvo` es la temporada que se está editando: no debe contarse con sus
 * fechas viejas.
 */
async function seEncimaConOtroIgual(
  curso: { id: string; nombre: string; modoFecha: string },
  nuevas: Array<{ desde: Date; hasta: Date }>,
): Promise<Resultado> {
  const gemelos = (
    await prisma.tipoCurso.findMany({
      where: { activo: true, id: { not: curso.id } },
      include: { temporadas: { select: { desde: true, hasta: true } } },
    })
  ).filter(
    (c) =>
      c.nombre.trim().toLocaleLowerCase('es') === curso.nombre.trim().toLocaleLowerCase('es'),
  )
  if (gemelos.length === 0) return null

  const anio = new Date().getFullYear()
  for (const otro of gemelos) {
    if (
      seEnciman(anio, nuevas, curso.modoFecha as ModoFecha, otro.temporadas, otro.modoFecha as ModoFecha)
    ) {
      const suyos = mesesQueCorre(anio, otro.temporadas, otro.modoFecha as ModoFecha)
      return {
        ok: false,
        mensaje:
          `Ya hay otro "${otro.nombre}" corriendo en ${enMeses(suyos)}. ` +
          'Dos cursos pueden llamarse igual, pero no correr a la vez: ponle fechas que no se encimen.',
      }
    }
  }
  return null
}

const NOMBRE_MES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
]
const enMeses = (meses: number[]) =>
  meses.length === 0
    ? 'todo el año'
    : meses.length === 1
      ? NOMBRE_MES[meses[0] - 1]
      : `${NOMBRE_MES[meses[0] - 1]}–${NOMBRE_MES[meses[meses.length - 1] - 1]}`

type Modo = 'RECURRENTE' | 'UNICO' | 'MIXTO'
const MODOS: Modo[] = ['RECURRENTE', 'UNICO', 'MIXTO']

/** El modo que pide el formulario. En blanco, el que ya tenía. */
function modoPedido(datos: FormData, actual: string): Modo | null {
  const bruto = texto(datos, 'modoFecha')
  if (!bruto) return actual as Modo
  return MODOS.includes(bruto as Modo) ? (bruto as Modo) : null
}

/** Cómo nombrar una temporada en un aviso. Sin nombre, por sus fechas. */
function comoSeLlame(nombre: string | null, desde: Date, hasta: Date): string {
  if (nombre) return nombre
  const corto = (d: Date) => `${d.getDate()} ${NOMBRE_MES[d.getMonth()].slice(0, 3)}`
  return `La temporada del ${corto(desde)} al ${corto(hasta)}`
}

/** El nombre del modo como lo lee la gente. */
const comoSeLlama = (modo: string) =>
  modo === 'UNICO' ? 'Único' : modo === 'MIXTO' ? 'Mixto' : 'Recurrente'

async function cupoDeTemporadas(
  tipoCursoId: string,
  nombre: string,
  modo: string,
  /** Cuántas de las que ya tiene son la misma que se está guardando. */
  yaContada = 0,
): Promise<Resultado> {
  if (modo === 'MIXTO') return null
  const cuantas = (await prisma.temporadaCurso.count({ where: { tipoCursoId } })) - yaContada
  if (cuantas === 0) return null

  return {
    ok: false,
    mensaje: `${nombre} en modo ${comoSeLlama(modo)} admite una sola temporada. Escoge Mixto para ponerle varias.`,
  }
}

export async function guardarTemporada(_previo: Resultado, datos: FormData): Promise<Resultado> {
  try {
    await exigirAdministrador()
    const hash = texto(datos, 'hash')
    const esAlta = texto(datos, 'alta') === '1'
    // El nombre es una nota opcional: las fechas y la repetición ya dicen
    // lo que hay que saber. Si viene, solo se le exige que quepa.
    const nombre = texto(datos, 'nombre') || null
    if (nombre && nombre.length > LARGO_NOMBRE.max) {
      return { ok: false, mensaje: `El nombre es muy largo: máximo ${LARGO_NOMBRE.max} letras.` }
    }

    const desde = fechaDeTexto(texto(datos, 'desde'))
    if (!desde) {
      return {
        ok: false,
        mensaje: texto(datos, 'desde')
          ? `Esa fecha de inicio no existe en el calendario: ${texto(datos, 'desde')}`
          : 'Falta la fecha de inicio.',
      }
    }
    const hasta = fechaDeTexto(texto(datos, 'hasta') || texto(datos, 'desde'))
    if (!hasta) {
      return { ok: false, mensaje: `Esa fecha de fin no existe en el calendario: ${texto(datos, 'hasta')}` }
    }
    // Se permite que termine en otro año: una temporada de diciembre a enero
    // es normal. Lo que no se permite es que termine antes de empezar.
    if (hasta < desde) return { ok: false, mensaje: 'La temporada termina antes de empezar.' }

    const cursoHash = texto(datos, 'curso')
    const curso = cursoHash
      ? await prisma.tipoCurso.findUnique({ where: { hash: cursoHash } })
      : null
    if (!curso) return { ok: false, mensaje: 'Escoge a qué curso pertenece.' }

    const modo = modoPedido(datos, curso.modoFecha)
    if (modo === null) return { ok: false, mensaje: 'Esa repetición no existe.' }

    if (!esAlta) {
      const actual = await prisma.temporadaCurso.findUnique({ where: { hash } })
      if (!actual) return NO_EXISTE

      // La temporada se puede mover a otro curso desde la misma tabla, y el
      // curso puede cambiar de repetición aquí mismo. Las dos cosas pueden
      // dejar al destino con más temporadas de las que su modo admite.
      const cambiaDeCurso = actual.tipoCursoId !== curso.id
      if (cambiaDeCurso || modo !== curso.modoFecha) {
        const estorbo = await cupoDeTemporadas(
          curso.id, curso.nombre, modo,
          // Si ya es de este curso, no se cuenta dos veces a sí misma.
          cambiaDeCurso ? 0 : 1,
        )
        if (estorbo) return estorbo
      }

      // Cómo quedarían las temporadas del curso con este cambio aplicado.
      const otras = await prisma.temporadaCurso.findMany({
        where: { tipoCursoId: curso.id, hash: { not: hash } },
        select: { desde: true, hasta: true },
      })
      const encimado = await seEncimaConOtroIgual(
        { id: curso.id, nombre: curso.nombre, modoFecha: modo },
        [...otras, { desde, hasta }],
      )
      if (encimado) return encimado

      await prisma.temporadaCurso.update({
        where: { hash },
        data: { tipoCursoId: curso.id, nombre, desde, hasta },
      })

      if (modo !== curso.modoFecha) {
        await prisma.tipoCurso.update({ where: { id: curso.id }, data: { modoFecha: modo } })
        revalidatePath('/panel/admin/temporadas')
        revalidatePath('/panel/admin/cursos')
        return {
          ok: true,
          mensaje: `${comoSeLlame(nombre, desde, hasta)} quedó guardada, y ${curso.nombre} pasó a ${comoSeLlama(modo)}.`,
        }
      }
    } else {
      const estorbo = await cupoDeTemporadas(curso.id, curso.nombre, modo)
      if (estorbo) return estorbo

      const yaTiene = await prisma.temporadaCurso.findMany({
        where: { tipoCursoId: curso.id },
        select: { desde: true, hasta: true },
      })
      const encimado = await seEncimaConOtroIgual(
        { id: curso.id, nombre: curso.nombre, modoFecha: modo },
        [...yaTiene, { desde, hasta }],
      )
      if (encimado) return encimado

      await prisma.temporadaCurso.create({
        data: { hash: nuevoHash(), tipoCursoId: curso.id, nombre, desde, hasta },
      })

      if (modo !== curso.modoFecha) {
        await prisma.tipoCurso.update({ where: { id: curso.id }, data: { modoFecha: modo } })
        revalidatePath('/panel/admin/temporadas')
        revalidatePath('/panel/admin/cursos')
        return {
          ok: true,
          mensaje: `${comoSeLlame(nombre, desde, hasta)} quedó guardada, y ${curso.nombre} pasó a ${comoSeLlama(modo)}.`,
        }
      }
    }

    revalidatePath('/panel/admin/temporadas')
    return { ok: true, mensaje: `${comoSeLlame(nombre, desde, hasta)} quedó guardada.` }
  } catch (e) {
    return falla(e)
  }
}

export async function eliminarTemporada(_previo: Resultado, datos: FormData): Promise<Resultado> {
  try {
    // Quitar una temporada cambia a quién se le cobra y cuándo: es de Root.
    await exigirRoot()
    const hash = texto(datos, 'hash')
    const actual = hash ? await prisma.temporadaCurso.findUnique({ where: { hash } }) : null
    if (!actual) return NO_EXISTE

    await prisma.temporadaCurso.delete({ where: { hash } })
    revalidatePath('/panel/admin/temporadas')
    return {
      ok: true,
      mensaje: `${comoSeLlame(actual.nombre, actual.desde, actual.hasta)} se eliminó.`,
    }
  } catch (e) {
    return falla(e)
  }
}
