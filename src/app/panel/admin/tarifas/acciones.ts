'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/db'
import { nuevoHash } from '@/lib/ids'
import { fechaDeTexto } from '@/lib/dias-inhabiles'
import { seEncimanRangos } from '@/lib/costos'
import { validarEntero } from '@/lib/validaciones'
import { exigirRoot, falla, texto, numero } from '../guardas'
import type { Resultado } from '../guardas'
import { ConceptoCosto } from '@prisma/client'

/**
 * Los costos: cuánto vale cada curso, el locker y el recargo.
 *
 * Cada monto trae el tramo de fechas en el que rige. Cambiar un precio no
 * altera lo ya cobrado: `Cargo` guarda los montos calculados al generarse.
 *
 * Solo Root: es el dinero. El Administrador configura la escuela; mover
 * precios es otra cosa.
 */

const RUTA = '/panel/admin/tarifas'
const MAXIMO = 500_000 // 5 000 pesos, en centavos, para un solo concepto

const esAlta = (datos: FormData) => texto(datos, 'alta') === '1'

const corto = (d: Date) =>
  d.toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })

/** Lee el rango de vigencia del formulario, o el mensaje de por qué no. */
function rangoDe(datos: FormData): { desde: Date; hasta: Date } | string {
  const brutoDesde = texto(datos, 'vigenciaDesde')
  const brutoHasta = texto(datos, 'vigenciaHasta')
  if (!brutoDesde || !brutoHasta) return 'Pon desde y hasta cuándo rige este precio.'

  const desde = fechaDeTexto(brutoDesde)
  const hasta = fechaDeTexto(brutoHasta)
  if (!desde) return `Esa fecha no existe en el calendario: ${brutoDesde}`
  if (!hasta) return `Esa fecha no existe en el calendario: ${brutoHasta}`
  if (hasta < desde) return 'La vigencia termina antes de empezar.'
  // Hasta el último instante del día: un precio que vale "hasta el 31 de
  // diciembre" tiene que cubrir ese 31 completo.
  hasta.setHours(23, 59, 59, 999)
  return { desde, hasta }
}

/** El monto en pesos que se captura, en centavos que es como se guarda. */
function montoDe(datos: FormData): number | string {
  const pesos = numero(datos, 'monto')
  const mal = validarEntero(pesos, {
    min: 1, max: MAXIMO / 100, campo: 'El monto', bruto: texto(datos, 'monto'),
  })
  return mal ?? pesos * 100
}

// ---------------------------------------------------------------- cursos

export async function guardarTarifa(_previo: Resultado, datos: FormData): Promise<Resultado> {
  try {
    await exigirRoot()

    const curso = await prisma.tipoCurso.findUnique({ where: { hash: texto(datos, 'curso') } })
    if (!curso) return { ok: false, mensaje: 'Escoge a qué curso es el precio.' }

    const tipoPago = await prisma.tipoPago.findUnique({ where: { hash: texto(datos, 'tipoPago') } })
    if (!tipoPago) return { ok: false, mensaje: 'Escoge la forma de cobro.' }

    // Solo el pago único puede ir sin recurrencia. Lo demás tiene que decir
    // cada cuánto se cobra, o el motor no sabría qué hacer con la fila.
    const hashFrecuencia = texto(datos, 'frecuencia')
    const frecuencia = hashFrecuencia
      ? await prisma.frecuenciaPago.findUnique({ where: { hash: hashFrecuencia } })
      : null
    if (tipoPago.clave !== 'UNICO' && !frecuencia) {
      return { ok: false, mensaje: `Un ${tipoPago.nombre.toLowerCase()} necesita una recurrencia.` }
    }
    const frecuenciaId = tipoPago.clave === 'UNICO' ? null : frecuencia!.id

    const rango = rangoDe(datos)
    if (typeof rango === 'string') return { ok: false, mensaje: rango }
    const monto = montoDe(datos)
    if (typeof monto === 'string') return { ok: false, mensaje: monto }

    // Dos precios del mismo curso y la misma forma de cobro no pueden cubrir
    // el mismo día: ahí no habría manera de saber cuál cobrar.
    const hermanas = await prisma.tarifa.findMany({
      where: {
        tipoCursoId: curso.id,
        tipoPagoId: tipoPago.id,
        frecuenciaId,
        ...(esAlta(datos) ? {} : { NOT: { hash: texto(datos, 'hash') } }),
      },
    })
    const encimada = hermanas.find((h) =>
      seEncimanRangos(
        { desde: h.vigenciaDesde, hasta: h.vigenciaHasta },
        { desde: rango.desde, hasta: rango.hasta },
      ),
    )
    if (encimada) {
      return {
        ok: false,
        mensaje:
          `${curso.nombre} ya tiene un precio del ${corto(encimada.vigenciaDesde)} ` +
          `al ${corto(encimada.vigenciaHasta)}, y se encima con este.`,
      }
    }

    // El ciclo se guarda si existe, pero no se exige: lo que decide cuándo
    // rige el precio es su tramo de fechas. Exigirlo impedía justo aquello
    // para lo que se hizo el tramo — capturar hoy el precio del año que
    // entra, antes de que ese año exista.
    const ciclo = await prisma.cicloAnual.findFirst({
      where: { anio: rango.desde.getFullYear() },
    })

    const comun = {
      cicloAnualId: ciclo?.id ?? null,
      tipoCursoId: curso.id,
      tipoPagoId: tipoPago.id,
      frecuenciaId,
      monto,
      vigenciaDesde: rango.desde,
      vigenciaHasta: rango.hasta,
    }

    if (esAlta(datos)) {
      await prisma.tarifa.create({ data: { ...comun, hash: nuevoHash() } })
    } else {
      const actual = await prisma.tarifa.findUnique({ where: { hash: texto(datos, 'hash') } })
      if (!actual) return { ok: false, mensaje: 'Ese precio ya no existe.' }
      await prisma.tarifa.update({ where: { id: actual.id }, data: comun })
    }

    revalidatePath(RUTA)
    return {
      ok: true,
      mensaje:
        `${curso.nombre}: $${(monto / 100).toLocaleString('es-MX')} ` +
        `del ${corto(rango.desde)} al ${corto(rango.hasta)}.`,
    }
  } catch (e) {
    return falla(e)
  }
}

/**
 * Borra un precio, si nunca se cobró con él.
 *
 * Con un cargo encima no se borra: el precio es parte de lo que explica ese
 * cobro, y sin él un estado de cuenta viejo no se podría sostener.
 */
export async function eliminarTarifa(_previo: Resultado, datos: FormData): Promise<Resultado> {
  try {
    await exigirRoot()
    const tarifa = await prisma.tarifa.findUnique({
      where: { hash: texto(datos, 'hash') },
      include: { tipoCurso: true },
    })
    if (!tarifa) return { ok: false, mensaje: 'Ese precio ya no existe.' }

    const cobrados = await prisma.cargo.count({
      where: {
        tipoCursoId: tarifa.tipoCursoId,
        periodo: {
          ciclo: { anio: tarifa.vigenciaDesde.getFullYear() },
        },
      },
    })
    if (cobrados > 0) {
      return {
        ok: false,
        mensaje:
          `No se puede borrar: con este precio se generaron ${cobrados} cargos. ` +
          'Captura el precio nuevo con su propia vigencia.',
      }
    }

    await prisma.tarifa.delete({ where: { id: tarifa.id } })
    revalidatePath(RUTA)
    return { ok: true, mensaje: `Se borró el precio de ${tarifa.tipoCurso.nombre}.` }
  } catch (e) {
    return falla(e)
  }
}

// ---------------------------------------------------- locker y recargo

export async function guardarCosto(_previo: Resultado, datos: FormData): Promise<Resultado> {
  try {
    await exigirRoot()

    const concepto = texto(datos, 'concepto') as ConceptoCosto
    if (!Object.values(ConceptoCosto).includes(concepto)) {
      return { ok: false, mensaje: 'Escoge si es el locker o el recargo.' }
    }

    const rango = rangoDe(datos)
    if (typeof rango === 'string') return { ok: false, mensaje: rango }
    const monto = montoDe(datos)
    if (typeof monto === 'string') return { ok: false, mensaje: monto }

    const hermanos = await prisma.costo.findMany({
      where: {
        concepto,
        ...(esAlta(datos) ? {} : { NOT: { hash: texto(datos, 'hash') } }),
      },
    })
    const encimado = hermanos.find((h) =>
      seEncimanRangos(
        { desde: h.vigenciaDesde, hasta: h.vigenciaHasta },
        { desde: rango.desde, hasta: rango.hasta },
      ),
    )
    if (encimado) {
      return {
        ok: false,
        mensaje:
          `Ya hay un monto del ${corto(encimado.vigenciaDesde)} al ` +
          `${corto(encimado.vigenciaHasta)}, y se encima con este.`,
      }
    }

    const comun = { concepto, monto, vigenciaDesde: rango.desde, vigenciaHasta: rango.hasta }

    if (esAlta(datos)) {
      await prisma.costo.create({ data: { ...comun, hash: nuevoHash() } })
    } else {
      const actual = await prisma.costo.findUnique({ where: { hash: texto(datos, 'hash') } })
      if (!actual) return { ok: false, mensaje: 'Ese monto ya no existe.' }
      await prisma.costo.update({ where: { id: actual.id }, data: comun })
    }

    revalidatePath(RUTA)
    return {
      ok: true,
      mensaje:
        `${concepto === 'LOCKER' ? 'Locker' : 'Recargo'}: ` +
        `$${(monto / 100).toLocaleString('es-MX')} del ${corto(rango.desde)} al ${corto(rango.hasta)}.`,
    }
  } catch (e) {
    return falla(e)
  }
}

export async function eliminarCosto(_previo: Resultado, datos: FormData): Promise<Resultado> {
  try {
    await exigirRoot()
    const costo = await prisma.costo.findUnique({ where: { hash: texto(datos, 'hash') } })
    if (!costo) return { ok: false, mensaje: 'Ese monto ya no existe.' }

    await prisma.costo.delete({ where: { id: costo.id } })
    revalidatePath(RUTA)
    return { ok: true, mensaje: 'Se borró el monto.' }
  } catch (e) {
    return falla(e)
  }
}
