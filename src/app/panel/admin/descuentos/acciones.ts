'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/db'
import { nuevoHash } from '@/lib/ids'
import { validarCatalogo, validarEntero, normalizarClave } from '@/lib/validaciones'
import { fechaDeTexto } from '@/lib/dias-inhabiles'
import { validarVigencia, validarLimite, TOPES_DESCUENTO } from '@/lib/descuentos'
import { exigirAdministrador, falla, texto, numero, casilla } from '../guardas'
import type { Resultado } from '../guardas'
import { TipoDescuento } from '@prisma/client'

/**
 * Los descuentos que se le pueden aplicar a una inscripción.
 *
 * El valor se guarda entero: en porcentaje es el por ciento (20 = 20 %) y
 * en monto fijo son centavos, como todo el dinero del sistema.
 */

const RUTA = '/panel/admin/descuentos'

/** El alta se anuncia; cualquier otra cosa tiene que resolver un hash que exista. */
const esAlta = (datos: FormData) => texto(datos, 'alta') === '1'

export async function guardarDescuento(_previo: Resultado, datos: FormData): Promise<Resultado> {
  try {
    await exigirAdministrador()

    const nombre = texto(datos, 'nombre')
    const descripcion = texto(datos, 'descripcion')
    // El código solo se captura al crear. Al editar ni siquiera viaja en el
    // formulario —se dibuja como texto—, así que exigirlo ahí haría fallar
    // todo guardado. El que tiene se conserva: anda circulando en la calle.
    const clave = normalizarClave(texto(datos, 'clave'))
    const problema = esAlta(datos)
      ? validarCatalogo({ nombre, descripcion, clave })
      : validarCatalogo({ nombre, descripcion })
    if (problema) return { ok: false, mensaje: problema }

    const tipo = texto(datos, 'tipo') as TipoDescuento
    if (!Object.values(TipoDescuento).includes(tipo)) {
      return { ok: false, mensaje: 'Escoge si es porcentaje o monto fijo.' }
    }

    const valor = numero(datos, 'valor')
    const mal = validarEntero(valor, { ...TOPES_DESCUENTO[tipo], bruto: texto(datos, 'valor') })
    if (mal) return { ok: false, mensaje: mal }

    // El monto se captura en pesos y se guarda en centavos, como el resto
    // del dinero: así no hay dos unidades conviviendo en la misma columna.
    const guardado = tipo === 'PORCENTAJE' ? valor : valor * 100

    const brutoDesde = texto(datos, 'vigenciaDesde')
    const brutoHasta = texto(datos, 'vigenciaHasta')
    const vigenciaDesde = brutoDesde ? fechaDeTexto(brutoDesde) : null
    const vigenciaHasta = brutoHasta ? fechaDeTexto(brutoHasta) : null
    if (brutoDesde && !vigenciaDesde) {
      return { ok: false, mensaje: `Esa fecha no existe en el calendario: ${brutoDesde}` }
    }
    if (brutoHasta && !vigenciaHasta) {
      return { ok: false, mensaje: `Esa fecha no existe en el calendario: ${brutoHasta}` }
    }
    const malaVigencia = validarVigencia(vigenciaDesde, vigenciaHasta)
    if (malaVigencia) return { ok: false, mensaje: malaVigencia }

    // Vacío es "sin límite", que es como están todos los de hoy.
    const brutoLimite = texto(datos, 'limiteUsos')
    const limiteUsos = brutoLimite === '' ? null : numero(datos, 'limiteUsos')
    const entregados = esAlta(datos)
      ? 0
      : await prisma.inscripcion.count({
          where: { descuento: { hash: texto(datos, 'hash') } },
        })
    const malLimite = validarLimite(limiteUsos, entregados)
    if (malLimite) return { ok: false, mensaje: malLimite }

    const repetido = await prisma.descuento.findFirst({
      where: {
        nombre: { equals: nombre, mode: 'insensitive' },
        ...(esAlta(datos) ? {} : { NOT: { hash: texto(datos, 'hash') } }),
      },
    })
    if (repetido) return { ok: false, mensaje: `Ya hay un descuento llamado "${repetido.nombre}".` }

    const comun = {
      nombre,
      descripcion: descripcion || null,
      tipo,
      valor: guardado,
      vigenciaDesde,
      vigenciaHasta,
      limiteUsos,
      activo: casilla(datos, 'activo'),
    }

    if (esAlta(datos)) {
      const ocupada = await prisma.descuento.findUnique({ where: { clave } })
      if (ocupada) {
        return { ok: false, mensaje: `El código ${clave} ya lo usa "${ocupada.nombre}".` }
      }
      await prisma.descuento.create({ data: { ...comun, clave, hash: nuevoHash() } })
      revalidatePath(RUTA)
      return { ok: true, mensaje: `${nombre} quedó agregado.` }
    }

    const actual = await prisma.descuento.findUnique({ where: { hash: texto(datos, 'hash') } })
    if (!actual) return { ok: false, mensaje: 'Ese descuento ya no existe.' }

    await prisma.descuento.update({ where: { id: actual.id }, data: comun })
    revalidatePath(RUTA)
    return { ok: true, mensaje: `${nombre} quedó guardado.` }
  } catch (e) {
    return falla(e)
  }
}

/**
 * Apaga un descuento. Nunca lo borra.
 *
 * Las inscripciones que lo llevan lo siguen nombrando: sin él, un estado de
 * cuenta viejo no podría explicar por qué se cobró de menos. Apagado deja
 * de ofrecerse al inscribir, que es todo lo que hace falta.
 */
export async function desactivarDescuento(_previo: Resultado, datos: FormData): Promise<Resultado> {
  try {
    await exigirAdministrador()
    const d = await prisma.descuento.findUnique({ where: { hash: texto(datos, 'hash') } })
    if (!d) return { ok: false, mensaje: 'Ese descuento ya no existe.' }
    if (!d.activo) return { ok: true, mensaje: `${d.nombre} ya estaba desactivado.` }

    await prisma.descuento.update({ where: { id: d.id }, data: { activo: false } })
    revalidatePath(RUTA)
    return { ok: true, mensaje: `${d.nombre} se desactivó.` }
  } catch (e) {
    return falla(e)
  }
}
