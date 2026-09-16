import { prisma } from '@/lib/db'
import { generarFolio, generarTokenQR } from '@/lib/folio'
import { mesesAlInscribir } from '@/lib/cobros'
import { hoyEnCancun } from '@/lib/zona'
import { generarCargosDelPeriodo } from '@/lib/servicios/periodos'

/** Lo que recepción captura al dar de alta a alguien. */
export type Alta = {
  nombreCompleto: string
  cicloAnualId: string
  /** A qué días y horarios va. Sin ninguno no se le genera cargo. */
  sesionIds?: string[]
  /** El descuento que le toca, si le toca alguno. */
  descuentoId?: string | null
  /**
   * Desde y hasta cuándo se le reconoce ese descuento.
   *
   * Las dos en nulo quieren decir "sin límite", que es lo normal en INAPAM.
   * Una cortesía se pone del día al mismo día y cubre solo ese mes.
   */
  descuentoDesde?: Date | null
  descuentoHasta?: Date | null
  /** El locker que se lleva, si pidió uno. Se le cobra con su mensualidad. */
  locker?: { id: string; periodoId: string } | null
  /** Sus datos de facturación, si pide factura. */
  factura?: Factura | null
}

/** Lo que hace falta para facturarle. Se guarda en el alumno, no en la inscripción. */
export type Factura = {
  rfc: string
  razonSocial: string
  codigoPostal: string
  regimenFiscal: string
  usoCfdi: string
  /** A dónde se le manda el CFDI. Vacío se acepta: no se envía desde aquí. */
  correo?: string | null
  constanciaPdf?: Uint8Array<ArrayBuffer> | null
  constanciaNombre?: string | null
}

/**
 * Da de alta a alguien y lo inscribe en el ciclo.
 *
 * El año del folio es el del ciclo, y el ciclo es el del curso al que se
 * apunta: un alumno que entra al curso de 2027 lleva un folio `CR2027…`
 * aunque se capture en diciembre de 2026.
 *
 * Todo va en una transacción. Si una sesión está llena, no debe quedar un
 * alumno huérfano ni un folio quemado: o entra completo, o no entra.
 */
export async function inscribirAlumno(alta: Alta) {
  const ciclo = await prisma.cicloAnual.findUniqueOrThrow({ where: { id: alta.cicloAnualId } })

  const inscripcion = await prisma.$transaction(async (tx) => {
    const alumno = await tx.alumno.create({
      data: {
        nombreCompleto: alta.nombreCompleto,
        factura: Boolean(alta.factura),
        ...(alta.factura
          ? {
              rfc: alta.factura.rfc,
              razonSocial: alta.factura.razonSocial,
              codigoPostal: alta.factura.codigoPostal,
              regimenFiscal: alta.factura.regimenFiscal,
              usoCfdi: alta.factura.usoCfdi,
              ...(alta.factura.correo ? { email: alta.factura.correo } : {}),
              constanciaPdf: alta.factura.constanciaPdf ?? null,
              constanciaNombre: alta.factura.constanciaNombre ?? null,
              constanciaSubidaEn: alta.factura.constanciaPdf ? new Date() : null,
            }
          : {}),
      },
    })

    const inscripcion = await tx.inscripcion.create({
      data: {
        alumnoId: alumno.id,
        cicloAnualId: alta.cicloAnualId,
        folio: await folioLibre(tx, ciclo.anio),
        tokenQR: generarTokenQR(),
        descuentoId: alta.descuentoId ?? null,
        descuentoDesde: alta.descuentoDesde ?? null,
        descuentoHasta: alta.descuentoHasta ?? null,
      },
      include: { alumno: true },
    })

    for (const sesionId of [...new Set(alta.sesionIds ?? [])]) {
      await apuntarASesion(tx, inscripcion.id, sesionId)
    }

    // El locker va dentro de la misma transacción: si alguien más lo tomó
    // entre que se pintó la pantalla y se apretó el botón, la llave única
    // de (locker, periodo) revienta aquí y no queda ni el alumno a medias
    // ni un folio quemado. No hay que recalcular ningún cargo: el alumno
    // acaba de nacer y todavía no tiene ninguno; cuando se generen, el
    // locker ya estará contado.
    if (alta.locker) {
      await tx.asignacionLocker.create({
        data: {
          lockerId: alta.locker.id,
          inscripcionId: inscripcion.id,
          periodoId: alta.locker.periodoId,
        },
      })
    }

    return inscripcion
  })

  await generarSusMeses(inscripcion.id, ciclo)
  return inscripcion
}

/**
 * Le crea al recién inscrito los meses que le quedan del ciclo.
 *
 * Va fuera de la transacción del alta a propósito: si algo fallara al
 * generar —una tarifa sin capturar, un mes que no existe— el alumno ya
 * quedó inscrito con su folio, y sus meses se pueden crear después desde
 * su ficha. Al revés se perdería el alta entera por un precio que nadie
 * puso.
 *
 * Qué se cobra de cada mes lo sigue decidiendo el motor de siempre: la
 * temporada del curso, su tarifa, cada cuánto se cobra y cuántos meses
 * dura. Esto solo dice qué meses se le intentan.
 */
async function generarSusMeses(inscripcionId: string, ciclo: { id: string; anio: number }) {
  const meses = mesesAlInscribir(ciclo.anio, hoyEnCancun())
  if (meses.length === 0) return

  const periodos = await prisma.periodo.findMany({
    where: { cicloAnualId: ciclo.id, mes: { in: meses } },
    orderBy: { mes: 'asc' },
    select: { id: true },
  })

  // En orden y de uno en uno: una frecuencia trimestral necesita ver el
  // cargo del mes anterior para saber si le toca cobrar este.
  for (const periodo of periodos) {
    await generarCargosDelPeriodo(periodo.id, inscripcionId)
  }
}

/**
 * Un folio que nadie tenga.
 *
 * Con ocho caracteres al azar de 32 símbolos, dos iguales es cosa de una
 * en mil millones. Pero "casi nunca" no es "nunca", y chocar sería tirarle
 * el alta en la cara a quien está capturando: se vuelve a intentar.
 */
async function folioLibre(tx: Tx, anio: number, intentos = 5): Promise<string> {
  for (let i = 0; i < intentos; i++) {
    const folio = generarFolio(anio)
    if (!(await tx.inscripcion.findUnique({ where: { folio } }))) return folio
  }
  throw new Error('No se pudo generar un folio libre')
}

type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0]

/**
 * Apunta una inscripción a una sesión.
 *
 * No hay tope: la alberca acepta a quien llega, y quien captura no tiene
 * por qué pelear con un número que alguien puso hace meses. Lo que sí se
 * revisa es que la sesión exista y esté abierta.
 */
async function apuntarASesion(tx: Tx, inscripcionId: string, sesionId: string) {
  const sesion = await tx.sesion.findUnique({ where: { id: sesionId } })
  if (!sesion) throw new Error('Esa sesión no existe')
  if (!sesion.activo) throw new Error('Esa sesión está cerrada')

  await tx.inscripcionSesion.create({ data: { inscripcionId, sesionId } })
}

/** Cambia los días y horarios de un alumno ya inscrito. */
export async function cambiarSesiones(inscripcionId: string, sesionIds: string[]) {
  return prisma.$transaction(async (tx) => {
    const deseadas = [...new Set(sesionIds)]
    const actuales = await tx.inscripcionSesion.findMany({ where: { inscripcionId } })

    const quitar = actuales.filter((a) => !deseadas.includes(a.sesionId))
    const agregar = deseadas.filter((id) => !actuales.some((a) => a.sesionId === id))

    if (quitar.length > 0) {
      await tx.inscripcionSesion.deleteMany({ where: { id: { in: quitar.map((q) => q.id) } } })
    }
    for (const sesionId of agregar) {
      await apuntarASesion(tx, inscripcionId, sesionId)
    }
  })
}
