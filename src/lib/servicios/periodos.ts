import { prisma } from '@/lib/db'
import { calcularCargo, leTocaRecargo } from '@/lib/cargos'
import { descuentoCubreElMes } from '@/lib/descuentos'
import { tocaCobrar, alcanzoElTope } from '@/lib/cobros'
import { cursoCorreEnElMes, type ModoFecha } from '@/lib/temporadas'
import { vigenteEn } from '@/lib/costos'
import { EstadoCargo, EstadoInscripcion, type ConceptoCosto } from '@prisma/client'

type TarifaConCatalogos = {
  tipoCursoId: string
  monto: number
  tipoPago: { clave: string; activo: boolean }
  frecuencia: { meses: number; activo: boolean } | null
}

type Vigente = { vigenciaDesde: Date; vigenciaHasta: Date }

/**
 * Qué tarifa le toca a un curso.
 *
 * Si tiene varias formas de cobro se desempata primero por la clave del
 * tipo de pago —RECURRENTE antes que UNICO— y luego por los meses que cubre
 * la recurrencia, de menos a más: gana la mensual sobre la anual. Así al
 * alumno se le cobra el mes en curso y no el año entero de golpe.
 *
 * Lo importante es que sea siempre la misma: si el empate se resolviera al
 * azar, el mismo alumno pagaría distinto según el día en que corra el cobro.
 */
function tarifaDelCurso<T extends TarifaConCatalogos & Vigente>(
  tarifas: T[],
  tipoCursoId: string,
  /** El día del mes que se está generando: es lo que decide qué precio rige. */
  fecha: Date,
): T | null {
  const candidatas = tarifas.filter(
    (t) =>
      t.tipoCursoId === tipoCursoId &&
      t.tipoPago.activo &&
      (t.frecuencia?.activo ?? true) &&
      t.vigenciaDesde <= fecha &&
      t.vigenciaHasta >= fecha,
  )
  if (candidatas.length === 0) return null

  return [...candidatas].sort(
    (a, b) =>
      a.tipoPago.clave.localeCompare(b.tipoPago.clave) ||
      (a.frecuencia?.meses ?? 0) - (b.frecuencia?.meses ?? 0),
  )[0]
}

/**
 * Cuánto vale un concepto en esa fecha.
 *
 * Cero cuando no hay nada capturado: no se inventa un precio. Un locker sin
 * precio no se cobra, y se nota; cobrar un número que nadie autorizó no se
 * notaría hasta que alguien reclame.
 */
async function montoVigente(concepto: ConceptoCosto, fecha: Date): Promise<number> {
  const filas = await prisma.costo.findMany({
    where: { concepto, vigenciaDesde: { lte: fecha }, vigenciaHasta: { gte: fecha } },
  })
  return vigenteEn(
    filas.map((f) => ({ desde: f.vigenciaDesde, hasta: f.vigenciaHasta, monto: f.monto })),
    fecha,
  )?.monto ?? 0
}

/**
 * Crea los cargos del mes para las inscripciones activas del ciclo.
 *
 * Ya no le cobra a todos por igual: pregunta qué cursos lleva cada alumno
 * —por las sesiones a las que está apuntado— y qué forma de cobro tiene
 * cada curso. Un Salvavidas de pago único no recibe cargo cada mes.
 *
 * Sigue siendo idempotente: el cargo es único por (inscripción, periodo,
 * curso), así que el cron puede llamarlo a diario sin miedo.
 */
export async function generarCargosDelPeriodo(
  periodoId: string,
  /**
   * Una sola inscripción, en vez de todas.
   *
   * Es lo que deja pagar por adelantado: quien llega en septiembre y quiere
   * dejar pagado octubre necesita que el cargo de octubre exista hoy, y
   * correr la cobranza completa de octubre le crearía el cargo también a
   * todos los demás, semanas antes de que les toque.
   */
  soloInscripcionId?: string,
): Promise<{ creados: number }> {
  const periodo = await prisma.periodo.findUniqueOrThrow({
    where: { id: periodoId },
    include: { ciclo: true },
  })

  // El primer día del mes que se está generando: contra esa fecha se busca
  // qué precio rige. Un precio que cambia a mitad de año no vuelve a cobrar
  // lo ya cobrado, porque `Cargo` guarda los montos al generarse.
  const delMes = new Date(periodo.ciclo.anio, periodo.mes - 1, 1, 12, 0, 0)

  const tarifas = await prisma.tarifa.findMany({
    where: { vigenciaDesde: { lte: delMes }, vigenciaHasta: { gte: delMes } },
    include: { tipoPago: true, frecuencia: true },
  })
  const precioLocker = await montoVigente('LOCKER', delMes)

  // Cuándo corre cada curso. Uno fuera de temporada no genera cargo este
  // mes: cobrarle a alguien por un curso que no se está dando sería
  // cobrarle por nada.
  const cursosDelCatalogo = await prisma.tipoCurso.findMany({
    select: {
      id: true, modoFecha: true, maxMeses: true,
      temporadas: { select: { desde: true, hasta: true } },
    },
  })
  /** Cuántos meses dura cada curso. Vacío: sin tope. */
  const topeDelCurso = new Map(cursosDelCatalogo.map((c) => [c.id, c.maxMeses]))
  const enTemporada = new Set(
    cursosDelCatalogo
      .filter((c) =>
        cursoCorreEnElMes(periodo.ciclo.anio, periodo.mes, c.temporadas, c.modoFecha as ModoFecha),
      )
      .map((c) => c.id),
  )

  const inscripciones = await prisma.inscripcion.findMany({
    where: {
      cicloAnualId: periodo.cicloAnualId,
      estado: EstadoInscripcion.ACTIVA,
      ...(soloInscripcionId ? { id: soloInscripcionId } : {}),
    },
    include: {
      descuento: true,
      lockers: { where: { periodoId } },
      sesiones: { include: { sesion: { select: { tipoCursoId: true, activo: true } } } },
      cargos: { include: { periodo: { select: { mes: true } } } },
    },
  })

  /**
   * Qué cursos ya se le cobraron a cada alumno, y cuántas veces.
   *
   * Por alumno y no por inscripción: el tope de meses es la duración del
   * curso, así que quien se reinscribe al año siguiente sigue arrastrando
   * los meses que ya pagó. Se piden aparte porque `inscripcion.cargos`
   * solo trae los de ese folio.
   */
  const historial = await prisma.cargo.findMany({
    where: { inscripcion: { alumnoId: { in: inscripciones.map((i) => i.alumnoId) } } },
    select: { tipoCursoId: true, estado: true, inscripcion: { select: { alumnoId: true } } },
  })
  const cobradosDe = (alumnoId: string, tipoCursoId: string) =>
    historial
      .filter((c) => c.inscripcion.alumnoId === alumnoId && c.tipoCursoId === tipoCursoId)
      .map((c) => ({ cancelado: c.estado === EstadoCargo.CANCELADO }))

  let creados = 0

  for (const inscripcion of inscripciones) {
    // Varias sesiones del mismo curso son un solo cobro: quien va lunes,
    // miércoles y viernes al curso de Niños paga una mensualidad, no tres.
    const cursos = [
      ...new Set(
        inscripcion.sesiones.filter((s) => s.sesion.activo).map((s) => s.sesion.tipoCursoId),
      ),
    ]

    // Los lockers y el descuento van una sola vez por inscripción y mes,
    // aunque lleve dos cursos: el locker no se renta dos veces.
    let yaHayCargoDelMes = inscripcion.cargos.some((c) => c.periodoId === periodoId)

    for (const tipoCursoId of cursos) {
      const yaEstaEsteCurso = inscripcion.cargos.some(
        (c) => c.periodoId === periodoId && c.tipoCursoId === tipoCursoId,
      )
      if (yaEstaEsteCurso) continue
      if (!enTemporada.has(tipoCursoId)) continue

      // El curso dura lo que dura: cumplidos sus meses ya no se le cobra a
      // esa persona, aunque el curso siga corriendo en el calendario.
      if (alcanzoElTope(
        cobradosDe(inscripcion.alumnoId, tipoCursoId),
        topeDelCurso.get(tipoCursoId) ?? null,
      )) continue

      // Sin tarifa no se inventa un precio: el curso simplemente no se cobra
      // y queda a la vista que le falta configuración.
      const tarifa = tarifaDelCurso(tarifas, tipoCursoId, delMes)
      if (!tarifa) continue

      const meses = tarifa.tipoPago.clave === 'UNICO' ? null : (tarifa.frecuencia?.meses ?? null)
      const previos = inscripcion.cargos
        .filter((c) => c.tipoCursoId === tipoCursoId)
        .map((c) => ({ mes: c.periodo.mes }))

      if (!tocaCobrar(periodo.mes, previos, meses)) continue

      // El descuento solo si su vigencia alcanza este mes: una cortesía de
      // septiembre no debe seguir rebajando la mensualidad de octubre.
      const leTocaDescuento =
        !yaHayCargoDelMes &&
        inscripcion.descuento !== null &&
        descuentoCubreElMes(
          { desde: inscripcion.descuentoDesde, hasta: inscripcion.descuentoHasta },
          periodo.ciclo.anio,
          periodo.mes,
        )

      const montos = calcularCargo({
        tarifa: tarifa.monto,
        lockers: yaHayCargoDelMes ? 0 : inscripcion.lockers.length,
        precioLocker,
        descuento:
          leTocaDescuento && inscripcion.descuento
            ? { tipo: inscripcion.descuento.tipo, valor: inscripcion.descuento.valor }
            : null,
      })

      await prisma.cargo.create({
        data: { inscripcionId: inscripcion.id, periodoId, tipoCursoId, ...montos },
      })
      creados++
      yaHayCargoDelMes = true
    }
  }

  // Solo cuando se corrió para todos: un adelanto de una sola persona no
  // deja el mes por cobrado, o los demás se quedarían sin su cargo.
  if (!soloInscripcionId && !periodo.cargosGenerados) {
    await prisma.periodo.update({
      where: { id: periodoId },
      data: { cargosGenerados: true },
    })
  }

  return { creados }
}

/**
 * Suma el recargo a los cargos que pasaron la fecha límite sin pagarse.
 * Nunca toca un cargo pagado, cancelado, en revisión, ni uno que ya lo
 * tenga: por eso se sella `recargoAplicadoEn`.
 */
export async function aplicarRecargosVencidos(
  periodoId: string,
  ahora: Date = new Date(),
): Promise<{ actualizados: number }> {
  const periodo = await prisma.periodo.findUniqueOrThrow({
    where: { id: periodoId },
    include: { ciclo: true },
  })
  if (ahora <= periodo.fechaLimite) return { actualizados: 0 }

  // El recargo que regía el mes del cargo, no el de hoy: subirlo en marzo no
  // debe encarecer lo que se venció en enero.
  const delMes = new Date(periodo.ciclo.anio, periodo.mes - 1, 1, 12, 0, 0)
  const recargo = await montoVigente('RECARGO', delMes)
  // Sin recargo capturado no se inventa uno, pero el cargo sí vence: lo que
  // no se pagó a tiempo no está al corriente por faltar un número.
  

  const pendientes = await prisma.cargo.findMany({
    where: {
      periodoId,
      // EN_REVISION queda fuera a propósito: quien ya subió su comprobante
      // dentro del plazo no debe pagar recargo porque Capturista tarde en
      // validarlo. Si se lo rechazan vuelve a PENDIENTE y ahí sí puede vencer.
      estado: EstadoCargo.PENDIENTE,
      recargoAplicadoEn: null,
    },
    include: { inscripcion: { select: { creadoEn: true } } },
  })

  for (const cargo of pendientes) {
    // Al que se dio de alta dentro de este mismo mes no se le suma: si lo
    // capturaron el 28, el 5.º día hábil quedó atrás semanas antes de que
    // su cargo existiera. El cargo sí vence —lo debe— pero sin multa.
    const toca = leTocaRecargo({
      altaDeLaInscripcion: cargo.inscripcion.creadoEn,
      anio: periodo.ciclo.anio,
      mes: periodo.mes,
    })
    const suma = toca ? recargo : 0

    await prisma.cargo.update({
      where: { id: cargo.id },
      data: {
        montoRecargo: cargo.montoRecargo + suma,
        montoNeto: cargo.montoNeto + suma,
        estado: EstadoCargo.VENCIDO,
        recargoAplicadoEn: ahora,
      },
    })
  }

  return { actualizados: pendientes.length }
}
