'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/db'
import { nuevoHash } from '@/lib/ids'
import { validarCatalogo } from '@/lib/validaciones'
import { fechaDeTexto } from '@/lib/dias-inhabiles'
import { exigirAdministrador, exigirRoot, falla, texto } from '../guardas'
import type { Resultado } from '../guardas'
import { recalcularFechasLimite } from '../acciones'
import { TipoDiaInhabil } from '@prisma/client'

/**
 * El calendario de días que no se trabaja.
 *
 * Todo se guarda como rango: un solo día es `desde` y `hasta` iguales. El
 * tipo es lo que decide si el renglón corre la fecha límite de pago, así
 * que cualquier cambio la vuelve a calcular.
 */

const NO_EXISTE: Resultado = {
  ok: false,
  mensaje: 'Ese renglón ya no existe, o el enlace no es válido. Recarga la página.',
}

export async function guardarDiaInhabil(_previo: Resultado, datos: FormData): Promise<Resultado> {
  try {
    await exigirAdministrador()
    const hash = texto(datos, 'hash')
    const esAlta = texto(datos, 'alta') === '1'
    const nombre = texto(datos, 'nombre')
    const tipo = texto(datos, 'tipo') as TipoDiaInhabil
    const desdeBruto = texto(datos, 'desde')
    // Dejar el final en blanco es lo normal: son días sueltos.
    const hastaBruto = texto(datos, 'hasta') || desdeBruto

    const problema = validarCatalogo({ nombre, descripcion: texto(datos, 'descripcion') })
    if (problema) return { ok: false, mensaje: problema }
    if (!Object.values(TipoDiaInhabil).includes(tipo)) {
      return { ok: false, mensaje: 'Escoge de qué tipo es.' }
    }
    // `fechaDeTexto` rechaza los días que no existen: un 30 de febrero
    // guardado como 2 de marzo movería la fecha límite al día equivocado.
    const desde = fechaDeTexto(desdeBruto)
    if (!desde) {
      return {
        ok: false,
        mensaje: desdeBruto
          ? `Esa fecha de inicio no existe en el calendario: ${desdeBruto}`
          : 'Falta la fecha de inicio.',
      }
    }
    const hasta = fechaDeTexto(hastaBruto)
    if (!hasta) {
      return { ok: false, mensaje: `Esa fecha de fin no existe en el calendario: ${hastaBruto}` }
    }
    if (hasta < desde) return { ok: false, mensaje: 'El rango termina antes de empezar.' }

    // Los años pasados no se capturan: no sirven para nada y ensucian la
    // lista. Salvo los que se repiten, donde el año da igual porque lo que
    // cuenta es el día y el mes.
    const seRepite = texto(datos, 'cadaAnio') === 'on'
    if (!seRepite && desde.getFullYear() < new Date().getFullYear()) {
      return { ok: false, mensaje: 'Ese año ya pasó. Captura de este año en adelante.' }
    }

    const datosFila = {
      tipo, nombre, desde, hasta,
      cadaAnio: texto(datos, 'cadaAnio') === 'on',
      descripcion: texto(datos, 'descripcion') || null,
    }

    if (!esAlta) {
      if (!(await prisma.diaInhabil.findUnique({ where: { hash } }))) return NO_EXISTE
      await prisma.diaInhabil.update({ where: { hash }, data: datosFila })
    } else {
      await prisma.diaInhabil.create({ data: { ...datosFila, hash: nuevoHash() } })
    }

    await recalcularFechasLimite()
    revalidatePath('/panel/admin/calendario')
    return { ok: true, mensaje: `${nombre} quedó guardado.` }
  } catch (e) {
    return falla(e)
  }
}

export async function eliminarDiaInhabil(_previo: Resultado, datos: FormData): Promise<Resultado> {
  try {
    // Borrar del calendario mueve fechas límite hacia atrás, así que es de Root.
    await exigirRoot()
    const hash = texto(datos, 'hash')
    const actual = hash ? await prisma.diaInhabil.findUnique({ where: { hash } }) : null
    if (!actual) return NO_EXISTE

    await prisma.diaInhabil.delete({ where: { hash } })
    await recalcularFechasLimite()
    revalidatePath('/panel/admin/calendario')
    return { ok: true, mensaje: `${actual.nombre} se eliminó del calendario.` }
  } catch (e) {
    return falla(e)
  }
}
