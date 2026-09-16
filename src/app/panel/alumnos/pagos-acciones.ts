'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/db'
import { requierePermiso } from '@/lib/sesion'
import { registrarPago, refrescarEstadoDelCargo } from '@/lib/servicios/pagos'
import { generarCargosDelPeriodo } from '@/lib/servicios/periodos'
import { periodoActual } from '@/lib/periodo-actual'
import { ETIQUETA_METODO } from '@/lib/metodos-pago'
import { colorDeEstado, ETIQUETA_ESTADO } from '@/lib/servicios/estado-cuenta'
import {
  METODOS_PARA_ANOTAR, pideReferencia, loEscribioLaPasarela, sePuedeCorregir,
} from '@/lib/pagos-a-mano'
import { descuentoCubreElMes, conValor } from '@/lib/descuentos'
import { faltaUnMesAntes } from '@/lib/cargos'
import { alcanzoElTope } from '@/lib/cobros'
import { nombreMes } from '@/lib/formato'
import { MetodoPago, EstadoPago, EstadoCargo } from '@prisma/client'
import type { Resultado } from '../admin/catalogo/tipos'

const texto = (datos: FormData, campo: string) => String(datos.get(campo) ?? '').trim()
const no = (mensaje: string): Resultado => ({ ok: false, mensaje })

/** Lo confirmado de un cargo: lo que en revisión aún puede rechazarse. */
const yaPagado = (pagos: Array<{ estado: EstadoPago; montoNeto: number }>) =>
  pagos.filter((p) => p.estado === EstadoPago.CONFIRMADO).reduce((s, p) => s + p.montoNeto, 0)

/**
 * Los meses de una inscripción con lo que falta en cada uno, para poder
 * preguntarle al orden de pago.
 *
 * Se arma en el servidor y no se confía en lo que diga el navegador: la
 * ventana ya esconde el botón del mes adelantado, pero el formulario puede
 * llegar de cualquier lado.
 */
async function mesesConSuSaldo(inscripcionId: string) {
  const cargos = await prisma.cargo.findMany({
    where: { inscripcionId },
    include: { periodo: { select: { mes: true } }, pagos: true },
  })

  const porMes = new Map<number, Array<{ cubierto: boolean }>>()
  for (const c of cargos) {
    const lista = porMes.get(c.periodo.mes) ?? []
    // Un cargo cancelado no se debe, así que no detiene los meses de
    // adelante.
    lista.push({ cubierto: c.estado === 'CANCELADO' || yaPagado(c.pagos) >= c.montoNeto })
    porMes.set(c.periodo.mes, lista)
  }

  return [...porMes.entries()].map(([mes, cargos]) => ({ mes, cargos }))
}

/** El aviso cuando se intenta saltar un mes. Nombra cuál hay que saldar. */
const saldaAntes = (mesQueFalta: number) =>
  `Antes hay que saldar ${nombreMes(mesQueFalta)}: los meses se pagan en orden.`

/**
 * Los meses del alumno: desde el que entró hasta que se acaba el año.
 *
 * Todos, no solo el que corre. Quien llega al mostrador a preguntar "¿qué
 * debo?" rara vez debe únicamente este mes, y el que se inscribió en
 * septiembre no tiene por qué ver enero a agosto: no se le cobraron.
 *
 * Los meses que todavía no tienen cargo también salen, y desde ahí se pueden
 * adelantar: quien quiere dejar pagados tres meses de una vez no debería
 * tener que volver en octubre.
 *
 * Las formas de pago que se devuelven dependen de quién pregunta: el
 * mostrador recibe efectivo, transferencia y OXXO; tarjeta y SPEI solo las
 * ve Administrador o Root.
 */
export async function obtenerMeses(inscripcionId: string) {
  await requierePermiso('COBRAR')

  const inscripcion = await prisma.inscripcion.findUnique({
    where: { id: inscripcionId },
    include: { alumno: true, ciclo: true, descuento: true },
  })
  if (!inscripcion) return null

  // Desde el mes en que se dio de alta. Si entró el año pasado —la
  // inscripción es de este ciclo pero se capturó antes—, desde enero.
  const alta = inscripcion.creadoEn
  const desde = alta.getFullYear() < inscripcion.ciclo.anio ? 1 : alta.getMonth() + 1

  const [periodos, cargos] = await Promise.all([
    prisma.periodo.findMany({
      where: { cicloAnualId: inscripcion.cicloAnualId, mes: { gte: desde } },
      orderBy: { mes: 'asc' },
    }),
    prisma.cargo.findMany({
      where: { inscripcionId },
      include: {
        tipoCurso: true,
        periodo: true,
        pagos: { orderBy: { fechaPago: 'asc' }, include: { registradoPor: true } },
      },
      orderBy: { creadoEn: 'asc' },
    }),
  ])

  const actual = await periodoActual()

  // Qué mes detiene a cuál. Se calcula sobre todos los cargos de la
  // inscripción, no solo los que se van a pintar.
  const saldos = cargos.map((c) => ({
    mes: c.periodo.mes,
    cargos: [{ cubierto: c.estado === 'CANCELADO' || yaPagado(c.pagos) >= c.montoNeto }],
  }))

  // El descuento que lleva, con su vigencia. Se manda aunque esté vencido:
  // quien atiende necesita poder decir "sí lo tenía, se le acabó en junio".
  const descuento = inscripcion.descuento
    ? {
        nombre: inscripcion.descuento.nombre,
        etiqueta: conValor(inscripcion.descuento),
        desde: inscripcion.descuentoDesde?.toISOString() ?? null,
        hasta: inscripcion.descuentoHasta?.toISOString() ?? null,
      }
    : null

  return {
    alumno: inscripcion.alumno.nombreCompleto,
    folio: inscripcion.folio,
    anio: inscripcion.ciclo.anio,
    descuento,
    /** Todas. Lo que da cuentas es quién marcó cada pago, no la lista corta. */
    metodos: METODOS_PARA_ANOTAR.map((m) => ({
      valor: m,
      etiqueta: ETIQUETA_METODO[m] ?? m,
      pideReferencia: pideReferencia(m),
    })),
    meses: periodos.map((periodo) => {
      const delMes = cargos.filter((c) => c.periodoId === periodo.id)
      return {
        mes: periodo.mes,
        periodoId: periodo.id,
        esElDeHoy: periodo.id === actual?.periodo.id,
        /** El mes anterior que falta saldar, si es que hay uno. */
        bloqueadoPor: faltaUnMesAntes(saldos, periodo.mes),
        fechaLimite: periodo.fechaLimite.toISOString(),
        /** Si el descuento del alumno alcanza este mes. */
        conDescuento:
          descuento !== null &&
          descuentoCubreElMes(
            { desde: inscripcion.descuentoDesde, hasta: inscripcion.descuentoHasta },
            inscripcion.ciclo.anio,
            periodo.mes,
          ),
        cargos: delMes.map((c) => {
          const pagado = yaPagado(c.pagos)
          return {
            id: c.id,
            curso: c.tipoCurso.nombre,
            montoNeto: c.montoNeto,
            montoMensualidad: c.montoMensualidad,
            montoLockers: c.montoLockers,
            montoDescuento: c.montoDescuento,
            montoRecargo: c.montoRecargo,
            estado: ETIQUETA_ESTADO[c.estado],
            color: colorDeEstado(c.estado),
            pagado,
            /** Ya no le falta nada: entonces nada de lo suyo se corrige. */
            cubierto: pagado >= c.montoNeto,
            /**
             * Lo que subió el alumno desde su página, si subió algo.
             *
             * Es la razón de que exista: sin él no se marca pagado nada que
             * no sea efectivo, porque no habría con qué respaldarlo.
             */
            comprobante: c.comprobanteImagen
              ? { tipo: c.comprobanteTipo, subidoEn: c.comprobanteSubidoEn?.toISOString() ?? null }
              : null,
            pagos: c.pagos.map((p) => ({
              id: p.id,
              metodo: p.metodo,
              etiquetaMetodo: ETIQUETA_METODO[p.metodo] ?? p.metodo,
              /** Se corrige solo si lo escribió una persona y aún falta dinero. */
              editable: sePuedeCorregir(p) && pagado < c.montoNeto,
              montoCobrado: p.montoCobrado,
              montoComision: p.montoComision,
              referencia: p.referencia,
              estado: p.estado,
              fechaPago: p.fechaPago.toISOString(),
              /**
               * Quién lo marcó, o nadie si lo cobró la pasarela.
               *
               * Es lo que queda en lugar de esconderle formas de pago a
               * nadie: si algo se cobró mal, el renglón dice a quién hay que
               * preguntarle, o que entró solo por internet.
               */
              registradoPor: p.registradoPor?.nombre ?? null,
              enLinea: loEscribioLaPasarela(p),
            })),
          }
        }),
      }
    }),
  }
}

/**
 * Crea el cargo de un mes que todavía no se ha cobrado, para pagarlo por
 * adelantado.
 *
 * Solo el de este alumno: correr la cobranza completa de octubre en
 * septiembre le crearía el cargo a todos los demás semanas antes de que les
 * toque, y el mes entero aparecería como cobrado.
 */
/**
 * Qué cursos del alumno ya cumplieron su máximo de meses.
 *
 * Se pregunta solo cuando no se generó ningún cargo, para poder decir por
 * qué. Sin esto el aviso mandaría a revisar la temporada y la tarifa, que
 * están bien: lo que pasa es que el curso ya se le pagó completo.
 */
async function cursosQueYaCumplieron(inscripcionId: string) {
  const inscripcion = await prisma.inscripcion.findUnique({
    where: { id: inscripcionId },
    select: {
      alumnoId: true,
      sesiones: {
        select: {
          sesion: {
            select: {
              activo: true,
              tipoCurso: { select: { id: true, nombre: true, maxMeses: true } },
            },
          },
        },
      },
    },
  })
  if (!inscripcion) return []

  // De todas sus inscripciones: el tope es la duración del curso, no una
  // cuota anual, igual que en el motor de cobro.
  const cargos = await prisma.cargo.findMany({
    where: { inscripcion: { alumnoId: inscripcion.alumnoId } },
    select: { tipoCursoId: true, estado: true },
  })

  const cursos = [
    ...new Map(
      inscripcion.sesiones
        .filter((s) => s.sesion.activo)
        .map((s) => [s.sesion.tipoCurso.id, s.sesion.tipoCurso]),
    ).values(),
  ]

  return cursos.filter((curso) =>
    alcanzoElTope(
      cargos
        .filter((c) => c.tipoCursoId === curso.id)
        .map((c) => ({ cancelado: c.estado === EstadoCargo.CANCELADO })),
      curso.maxMeses,
    ),
  )
}

export async function adelantarMes(_previo: Resultado, datos: FormData): Promise<Resultado> {
  try {
    await requierePermiso('COBRAR')

    const inscripcionId = texto(datos, 'inscripcionId')
    const periodoId = texto(datos, 'periodoId')

    const inscripcion = await prisma.inscripcion.findUnique({ where: { id: inscripcionId } })
    if (!inscripcion) return no('Esa inscripción ya no existe.')
    if (inscripcion.estado !== 'ACTIVA') return no('Ese alumno ya no está activo.')

    const periodo = await prisma.periodo.findUnique({ where: { id: periodoId } })
    if (!periodo) return no('Ese mes ya no existe.')

    const falta = faltaUnMesAntes(await mesesConSuSaldo(inscripcionId), periodo.mes)
    if (falta !== null) return no(saldaAntes(falta))

    const { creados } = await generarCargosDelPeriodo(periodoId, inscripcionId)
    if (creados === 0) {
      // Primero el tope: es la única razón que no se arregla configurando
      // nada, y mandar a revisar la temporada sería mandarlo en balde.
      const cumplidos = await cursosQueYaCumplieron(inscripcionId)
      if (cumplidos.length > 0) {
        return no(
          `Ya cubrió los meses de ${cumplidos.map((c) => `${c.nombre} (${c.maxMeses})`).join(' y ')}.`
            + ' Ese curso ya no genera más cargos.',
        )
      }
      // Pasa cuando el curso está fuera de temporada ese mes, o cuando no
      // hay tarifa capturada para el año. No se inventa un precio.
      return no('No hay nada que cobrar ese mes: revisa la temporada del curso y su tarifa.')
    }

    revalidatePath('/panel/alumnos')
    revalidatePath('/panel')
    return { ok: true, mensaje: 'El cargo del mes quedó listo para pagarse.' }
  } catch (e) {
    return no(e instanceof Error ? e.message : 'No se pudo adelantar el mes.')
  }
}

/**
 * Lee la forma de pago. Es lo único que se exige para cobrar.
 *
 * Se revisa aquí y no se confía en lo que mande el navegador: el formulario
 * puede traer cualquier cosa, y una forma de pago inventada quedaría escrita
 * en la base y saldría después en la factura.
 */
function formaDePago(datos: FormData): { metodo: MetodoPago } | { mal: string } {
  const bruto = texto(datos, 'metodo') as MetodoPago
  if (!bruto) return { mal: 'Escoge la forma de pago.' }
  if (!METODOS_PARA_ANOTAR.includes(bruto)) return { mal: `"${bruto}" no es una forma de pago.` }
  return { metodo: bruto }
}

/**
 * Da por pagado un cargo.
 *
 * No se teclea el monto: se cobra lo que falta, ni más ni menos. Preguntar
 * "¿cuánto se recibió?" cuando la cantidad ya está impresa en la pantalla
 * solo abre la puerta a que un dedo torcido deje un cargo saldado con un
 * peso, y nadie lo note hasta el corte.
 *
 * El comprobante no se exige. El alumno lo sube si quiere, y cuando está
 * sirve para que quien atiende vea con qué se respalda el cobro; pero un
 * billete entregado en la ventanilla no tiene nada que subir, y trabar el
 * cobro por eso dejaría al mostrador sin poder atender a quien llega con
 * efectivo.
 *
 * El estado del cargo no se toca a mano: se recalcula de sus pagos, así que
 * no puede quedar marcado como pagado sin dinero que lo respalde.
 */
export async function marcarPagado(_previo: Resultado, datos: FormData): Promise<Resultado> {
  try {
    const usuario = await requierePermiso('COBRAR')

    const cargo = await prisma.cargo.findUnique({
      where: { id: texto(datos, 'cargoId') },
      include: { tipoCurso: true, pagos: true, periodo: { select: { mes: true } } },
    })
    if (!cargo) return no('Ese cargo ya no existe.')
    if (cargo.estado === 'CANCELADO') return no('Ese cargo está cancelado.')

    const falta = cargo.montoNeto - yaPagado(cargo.pagos)
    if (falta <= 0) return no('Ese cargo ya está pagado.')

    // Los meses se pagan en orden: nada de dejar diciembre cubierto debiendo
    // octubre. La ventana ya esconde el botón, pero el formulario puede
    // llegar de cualquier lado.
    const pendiente = faltaUnMesAntes(
      await mesesConSuSaldo(cargo.inscripcionId),
      cargo.periodo.mes,
    )
    if (pendiente !== null) return no(saldaAntes(pendiente))

    const forma = formaDePago(datos)
    if ('mal' in forma) return no(forma.mal)

    await registrarPago({
      cargoId: cargo.id,
      metodo: forma.metodo,
      montoCobrado: falta,
      referencia: pideReferencia(forma.metodo)
        ? texto(datos, 'referencia') || undefined
        : undefined,
      registradoPorId: usuario.id,
    })

    revalidatePath('/panel/alumnos')
    revalidatePath('/panel')
    return { ok: true, mensaje: `${cargo.tipoCurso.nombre} quedó pagado.` }
  } catch (e) {
    return no(e instanceof Error ? e.message : 'No se pudo marcar pagado.')
  }
}

/**
 * Corrige un pago que capturó una persona.
 *
 * Dos candados. El primero: lo que ya comprobó la pasarela no se toca, y lo
 * que manda es de dónde vino el renglón, no con qué forma de pago —un OXXO
 * anotado a mano sí se corrige, porque lo escribió alguien que pudo
 * equivocarse—. El segundo: solo mientras al cargo le falte dinero. Uno ya
 * cubierto está cerrado; reabrirlo desde aquí dejaría el corte del mes
 * moviéndose después de cuadrado.
 *
 * El monto tampoco se teclea aquí: se corrige la forma de pago y su
 * referencia, que es donde de verdad se equivoca quien captura.
 */
export async function corregirPago(_previo: Resultado, datos: FormData): Promise<Resultado> {
  try {
    await requierePermiso('COBRAR')

    const pago = await prisma.pago.findUnique({
      where: { id: texto(datos, 'pagoId') },
      include: { cargo: { include: { pagos: true } } },
    })
    if (!pago) return no('Ese pago ya no existe.')

    if (!sePuedeCorregir(pago)) {
      return no(
        'Ese pago lo comprobó la pasarela y no se corrige aquí: lo que dice es lo que reportó.',
      )
    }

    const cubierto = yaPagado(pago.cargo.pagos) >= pago.cargo.montoNeto
    if (cubierto) {
      return no('Ese cargo ya quedó cubierto, así que su pago ya no se corrige.')
    }

    const forma = formaDePago(datos)
    if ('mal' in forma) return no(forma.mal)

    await prisma.pago.update({
      where: { id: pago.id },
      data: {
        metodo: forma.metodo,
        referencia: pideReferencia(forma.metodo) ? texto(datos, 'referencia') || null : null,
      },
    })

    await refrescarEstadoDelCargo(pago.cargoId)
    revalidatePath('/panel/alumnos')
    revalidatePath('/panel')
    return { ok: true, mensaje: 'El pago quedó corregido.' }
  } catch (e) {
    return no(e instanceof Error ? e.message : 'No se pudo corregir el pago.')
  }
}
