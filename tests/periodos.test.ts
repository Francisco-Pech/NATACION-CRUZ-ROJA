import { describe, it, expect, beforeEach, afterAll } from 'vitest'
import { prisma } from '@/lib/db'
import { nuevoHash } from '@/lib/ids'
import { generarCargosDelPeriodo, aplicarRecargosVencidos } from '@/lib/servicios/periodos'
import { Categoria, EstadoCargo, EstadoInscripcion, TipoDescuento } from '@prisma/client'

const ANIO = 2097
const vigenciaDelAnio = {
  vigenciaDesde: new Date(ANIO, 0, 1),
  vigenciaHasta: new Date(ANIO, 11, 31, 23, 59, 59),
}
let cicloId = ''
let periodoId = ''

async function limpiar() {
  const ciclo = await prisma.cicloAnual.findUnique({ where: { anio: ANIO } })
  if (!ciclo) return
  await prisma.costo.deleteMany({
    where: { vigenciaDesde: { gte: new Date(ANIO, 0, 1), lt: new Date(ANIO + 1, 0, 1) } },
  })
  const insc = await prisma.inscripcion.findMany({ where: { cicloAnualId: ciclo.id }, select: { alumnoId: true } })
  await prisma.cicloAnual.delete({ where: { id: ciclo.id } })
  await prisma.alumno.deleteMany({ where: { id: { in: insc.map((i) => i.alumnoId) } } })
  await prisma.locker.deleteMany({ where: { numero: { gte: 9000 } } })
  await prisma.descuento.deleteMany({ where: { nombre: 'Prueba 50' } })
  // Va al final: sus sesiones no se sueltan hasta que el ciclo se lleva las
  // inscripciones que las nombran.
  await prisma.tipoCurso.deleteMany({ where: { clave: CLAVE_UNICO } })
}

/**
 * Deja el curso en modo recurrente antes de usarlo.
 *
 * Las pruebas comparten base con la aplicación, y desde el panel se le
 * puede cambiar la repetición a un curso. Si alguien lo deja en Único, su
 * temporada deja de cubrir el año de estas pruebas y no se genera ningún
 * cargo: veintitantas pruebas se caen por algo que no tiene que ver con lo
 * que están probando. Así se parte siempre del mismo sitio.
 */
async function cursoDisponibleTodoElAno(clave: string) {
  const curso = await prisma.tipoCurso.findUniqueOrThrow({ where: { clave } })
  if (curso.modoFecha === 'RECURRENTE') return curso
  return prisma.tipoCurso.update({
    where: { id: curso.id },
    data: { modoFecha: 'RECURRENTE' },
  })
}

const CLAVE_UNICO = 'PRUEBA_PAGO_UNICO'

/**
 * Un curso con una sesión propia, para las pruebas de cobro que necesitan
 * uno que se pague de una sola vez. Se crea aquí y no se toma del seeder:
 * lo que el seeder siembra cambia conforme la delegación define horarios,
 * y una prueba no debería romperse por eso.
 */
async function cursoDePagoUnico() {
  const curso = await prisma.tipoCurso.upsert({
    where: { clave: CLAVE_UNICO },
    // Se resetea: si una prueba anterior le puso temporada, no debe
    // arrastrarse a la siguiente.
    update: { modoFecha: 'RECURRENTE', temporadas: { deleteMany: {} } },
    create: { hash: nuevoHash(), clave: CLAVE_UNICO, nombre: 'Curso de prueba, pago único' },
  })
  const horario = await prisma.horario.findFirstOrThrow({ where: { activo: true } })
  await prisma.sesion.upsert({
    where: {
      tipoCursoId_horarioId_diaSemana: { tipoCursoId: curso.id, horarioId: horario.id, diaSemana: 6 },
    },
    update: { activo: true },
    create: { hash: nuevoHash(), tipoCursoId: curso.id, horarioId: horario.id, diaSemana: 6, cupoMaximo: 15 },
  })
  return curso
}

/**
 * Inscribe y además lo apunta a una sesión del curso que le toca: sin
 * sesión no hay curso, y sin curso el motor no le genera cargo.
 */
async function alumnoInscrito(
  nombre: string,
  categoria: Categoria,
  n: number,
  estado: EstadoInscripcion = EstadoInscripcion.ACTIVA,
  claveCurso = categoria === Categoria.NINOS ? 'NINOS' : 'ADULTOS',
) {
  const alumno = await prisma.alumno.create({ data: { nombreCompleto: nombre, categoria } })
  const sesion = await prisma.sesion.findFirstOrThrow({
    where: { activo: true, tipoCurso: { clave: claveCurso } },
  })
  return prisma.inscripcion.create({
    data: {
      alumnoId: alumno.id, cicloAnualId: cicloId, estado,
      folio: `CRM-${ANIO}-${String(n).padStart(4, '0')}`, tokenQR: `tok-${ANIO}-${n}`,
      sesiones: { create: { sesionId: sesion.id } },
    },
  })
}

beforeEach(async () => {
  await limpiar()
  const ciclo = await prisma.cicloAnual.create({ data: { anio: ANIO } })
  cicloId = ciclo.id
  // El locker y el recargo se leen de `Costo` según la fecha del mes, no
  // del periodo: es como los lee el motor desde que los precios tienen
  // vigencia.
  await prisma.costo.deleteMany({
    where: { vigenciaDesde: { gte: new Date(ANIO, 0, 1), lt: new Date(ANIO + 1, 0, 1) } },
  })
  await prisma.costo.createMany({
    data: [
      { hash: nuevoHash(), concepto: 'LOCKER', monto: 10000, ...vigenciaDelAnio },
      { hash: nuevoHash(), concepto: 'RECARGO', monto: 5000, ...vigenciaDelAnio },
    ],
  })

  const periodo = await prisma.periodo.create({
    data: {
      cicloAnualId: cicloId, mes: 3, clave: `${ANIO}-03`,
      fechaLimite: new Date(`${ANIO}-03-06T23:59:59`), recargo: 5000, precioLocker: 10000,
    },
  })
  periodoId = periodo.id
  // El precio ya no cuelga de la categoría del alumno sino del curso, y
  // la fila dice además cómo se cobra: recurrente, cada mes.
  const recurrente = await prisma.tipoPago.findUniqueOrThrow({ where: { clave: 'RECURRENTE' } })
  const mensual = await prisma.frecuenciaPago.findUniqueOrThrow({ where: { clave: 'MENSUAL' } })
  const adultos = await cursoDisponibleTodoElAno('ADULTOS')
  const ninos = await cursoDisponibleTodoElAno('NINOS')

  await prisma.tarifa.createMany({
    data: [
      { cicloAnualId: cicloId, tipoCursoId: adultos.id, tipoPagoId: recurrente.id, frecuenciaId: mensual.id, monto: 77000, hash: nuevoHash(), vigenciaDesde: new Date(ANIO, 0, 1), vigenciaHasta: new Date(ANIO, 11, 31, 23, 59, 59) },
      { cicloAnualId: cicloId, tipoCursoId: ninos.id, tipoPagoId: recurrente.id, frecuenciaId: mensual.id, monto: 65000, hash: nuevoHash(), vigenciaDesde: new Date(ANIO, 0, 1), vigenciaHasta: new Date(ANIO, 11, 31, 23, 59, 59) },
    ],
  })
})

afterAll(async () => { await limpiar(); await prisma.$disconnect() })

describe('generarCargosDelPeriodo', () => {
  it('crea un cargo por cada inscripción activa', async () => {
    await alumnoInscrito('Uno', Categoria.GENERAL, 1)
    await alumnoInscrito('Dos', Categoria.GENERAL, 2)
    const { creados } = await generarCargosDelPeriodo(periodoId)
    expect(creados).toBe(2)
  })

  it('no duplica cargos si se ejecuta dos veces', async () => {
    await alumnoInscrito('Uno', Categoria.GENERAL, 1)
    await generarCargosDelPeriodo(periodoId)
    const segunda = await generarCargosDelPeriodo(periodoId)
    expect(segunda.creados).toBe(0)
    expect(await prisma.cargo.count({ where: { periodoId } })).toBe(1)
  })

  it('omite las inscripciones dadas de baja', async () => {
    await alumnoInscrito('Activo', Categoria.GENERAL, 1)
    await alumnoInscrito('Baja', Categoria.GENERAL, 2, EstadoInscripcion.BAJA)
    const { creados } = await generarCargosDelPeriodo(periodoId)
    expect(creados).toBe(1)
  })

  it('usa la tarifa del curso al que está apuntado', async () => {
    const i = await alumnoInscrito('Niña', Categoria.NINOS, 1)
    await generarCargosDelPeriodo(periodoId)
    const cargo = await prisma.cargo.findFirst({ where: { inscripcionId: i.id } })
    expect(cargo!.montoMensualidad).toBe(65000)
  })

  it('con dos formas de cobro escoge siempre la misma, no una al azar', async () => {
    // Adultos ya tiene su fila recurrente mensual. Se le agrega una de pago
    // único: ahora hay empate, y el motor tiene que resolverlo igual todas
    // las veces o el mismo alumno pagaría distinto según el día.
    const adultos = await prisma.tipoCurso.findUniqueOrThrow({ where: { clave: 'ADULTOS' } })
    const unico = await prisma.tipoPago.findUniqueOrThrow({ where: { clave: 'UNICO' } })
    await prisma.tarifa.create({
      data: {
        cicloAnualId: cicloId, tipoCursoId: adultos.id, tipoPagoId: unico.id,
        frecuenciaId: null, monto: 250000,
        hash: nuevoHash(),
        vigenciaDesde: new Date(ANIO, 0, 1),
        vigenciaHasta: new Date(ANIO, 11, 31, 23, 59, 59),
      },
    })

    const i = await alumnoInscrito('Con dos formas', Categoria.GENERAL, 1)
    await generarCargosDelPeriodo(periodoId)
    const cargo = await prisma.cargo.findFirst({ where: { inscripcionId: i.id } })

    // Gana el pago recurrente: es el que se cobra mes con mes.
    expect(cargo!.montoMensualidad).toBe(77000)
  })

  it('con dos recurrencias escoge la más seguida, no una al azar', async () => {
    // Adultos ya tiene su fila mensual. Se le agrega una anual, las dos
    // recurrentes: el empate lo resuelve la recurrencia, y tiene que ganar
    // la mensual —la que se cobra este mes— o el alumno recibiría un cargo
    // de todo el año sin haberlo pedido.
    const adultos = await prisma.tipoCurso.findUniqueOrThrow({ where: { clave: 'ADULTOS' } })
    const recurrente = await prisma.tipoPago.findUniqueOrThrow({ where: { clave: 'RECURRENTE' } })
    const anual = await prisma.frecuenciaPago.findUniqueOrThrow({ where: { clave: 'ANUAL' } })
    await prisma.tarifa.create({
      data: {
        cicloAnualId: cicloId, tipoCursoId: adultos.id, tipoPagoId: recurrente.id,
        frecuenciaId: anual.id, monto: 800000,
        hash: nuevoHash(),
        vigenciaDesde: new Date(ANIO, 0, 1),
        vigenciaHasta: new Date(ANIO, 11, 31, 23, 59, 59),
      },
    })

    const i = await alumnoInscrito('Con dos recurrencias', Categoria.GENERAL, 1)
    await generarCargosDelPeriodo(periodoId)
    const cargo = await prisma.cargo.findFirst({ where: { inscripcionId: i.id } })

    expect(cargo!.montoMensualidad).toBe(77000)
  })

  it('no se le cobra a quien lleva un curso de pago único ya pagado', async () => {
    // El curso lo arma la prueba: así no depende de qué haya sembrado el
    // seeder, que cambia según lo que la delegación vaya definiendo.
    const curso = await cursoDePagoUnico()
    const i = await alumnoInscrito('De pago único', Categoria.GENERAL, 1, EstadoInscripcion.ACTIVA, CLAVE_UNICO)
    const unico = await prisma.tipoPago.findUniqueOrThrow({ where: { clave: 'UNICO' } })
    await prisma.tarifa.create({
      data: {
        cicloAnualId: cicloId, tipoCursoId: curso.id, tipoPagoId: unico.id,
        frecuenciaId: null, monto: 250000,
        hash: nuevoHash(),
        vigenciaDesde: new Date(ANIO, 0, 1),
        vigenciaHasta: new Date(ANIO, 11, 31, 23, 59, 59),
      },
    })

    await generarCargosDelPeriodo(periodoId)
    expect(await prisma.cargo.count({ where: { inscripcionId: i.id } })).toBe(1)

    // Un segundo mes no le vuelve a cobrar: el pago único es una sola vez.
    const abril = await prisma.periodo.create({
      data: {
        cicloAnualId: cicloId, mes: 4, clave: `${ANIO}-04`,
        fechaLimite: new Date(`${ANIO}-04-06T23:59:59`), recargo: 5000, precioLocker: 10000,
      },
    })
    await generarCargosDelPeriodo(abril.id)
    expect(await prisma.cargo.count({ where: { inscripcionId: i.id } })).toBe(1)
  })

  it('no le cobra a un curso que está fuera de temporada ese mes', async () => {
    // El periodo de estas pruebas es marzo. Se le pone al curso una
    // temporada de julio y agosto: en marzo no corre, así que no hay cargo.
    const curso = await cursoDePagoUnico()
    await prisma.tipoCurso.update({
      where: { id: curso.id },
      data: {
        modoFecha: 'RECURRENTE',
        temporadas: {
          create: {
            hash: nuevoHash(), nombre: 'Verano',
            desde: new Date(`${ANIO}-07-01T12:00:00`),
            hasta: new Date(`${ANIO}-08-31T12:00:00`),
          },
        },
      },
    })
    const unico = await prisma.tipoPago.findUniqueOrThrow({ where: { clave: 'UNICO' } })
    await prisma.tarifa.create({
      data: {
        cicloAnualId: cicloId, tipoCursoId: curso.id, tipoPagoId: unico.id,
        frecuenciaId: null, monto: 250000,
        hash: nuevoHash(),
        vigenciaDesde: new Date(ANIO, 0, 1),
        vigenciaHasta: new Date(ANIO, 11, 31, 23, 59, 59),
      },
    })

    const i = await alumnoInscrito('Fuera de temporada', Categoria.GENERAL, 1, EstadoInscripcion.ACTIVA, CLAVE_UNICO)
    await generarCargosDelPeriodo(periodoId)
    expect(await prisma.cargo.count({ where: { inscripcionId: i.id } })).toBe(0)
  })

  it('sí le cobra en un mes que cae dentro de su temporada', async () => {
    const curso = await cursoDePagoUnico()
    await prisma.tipoCurso.update({
      where: { id: curso.id },
      data: {
        modoFecha: 'RECURRENTE',
        temporadas: {
          create: {
            hash: nuevoHash(), nombre: 'Marzo y abril',
            desde: new Date(`${ANIO}-03-01T12:00:00`),
            hasta: new Date(`${ANIO}-04-30T12:00:00`),
          },
        },
      },
    })
    const unico = await prisma.tipoPago.findUniqueOrThrow({ where: { clave: 'UNICO' } })
    await prisma.tarifa.create({
      data: {
        cicloAnualId: cicloId, tipoCursoId: curso.id, tipoPagoId: unico.id,
        frecuenciaId: null, monto: 250000,
        hash: nuevoHash(),
        vigenciaDesde: new Date(ANIO, 0, 1),
        vigenciaHasta: new Date(ANIO, 11, 31, 23, 59, 59),
      },
    })

    const i = await alumnoInscrito('En temporada', Categoria.GENERAL, 1, EstadoInscripcion.ACTIVA, CLAVE_UNICO)
    await generarCargosDelPeriodo(periodoId)
    const cargo = await prisma.cargo.findFirst({ where: { inscripcionId: i.id } })
    expect(cargo?.montoMensualidad).toBe(250000)
  })

  it('suma los lockers asignados en ese periodo', async () => {
    const i = await alumnoInscrito('Con lockers', Categoria.GENERAL, 1)
    const l1 = await prisma.locker.create({ data: { numero: 9001 } })
    const l2 = await prisma.locker.create({ data: { numero: 9002 } })
    await prisma.asignacionLocker.createMany({
      data: [
        { lockerId: l1.id, inscripcionId: i.id, periodoId },
        { lockerId: l2.id, inscripcionId: i.id, periodoId },
      ],
    })
    await generarCargosDelPeriodo(periodoId)
    const cargo = await prisma.cargo.findFirst({ where: { inscripcionId: i.id } })
    expect(cargo!.montoLockers).toBe(20000)
    expect(cargo!.montoNeto).toBe(97000)
  })

  it('aplica el descuento de la inscripción', async () => {
    const descuento = await prisma.descuento.create({
      data: {
        hash: nuevoHash(), clave: `PRUEBA_${Date.now()}`,
        nombre: 'Prueba 50', tipo: TipoDescuento.PORCENTAJE, valor: 50,
      },
    })
    const i = await alumnoInscrito('Becado', Categoria.GENERAL, 1)
    await prisma.inscripcion.update({ where: { id: i.id }, data: { descuentoId: descuento.id } })
    await generarCargosDelPeriodo(periodoId)
    const cargo = await prisma.cargo.findFirst({ where: { inscripcionId: i.id } })
    expect(cargo!.montoDescuento).toBe(38500)
    expect(cargo!.montoNeto).toBe(38500)
  })
})

describe('aplicarRecargosVencidos', () => {
  it('no aplica recargo antes de la fecha límite', async () => {
    await alumnoInscrito('Puntual', Categoria.GENERAL, 1)
    await generarCargosDelPeriodo(periodoId)
    const { actualizados } = await aplicarRecargosVencidos(periodoId, new Date(`${ANIO}-03-05T10:00:00`))
    expect(actualizados).toBe(0)
  })

  it('aplica el recargo y marca VENCIDO al pasar la fecha límite', async () => {
    const i = await alumnoInscrito('Tarde', Categoria.GENERAL, 1)
    await generarCargosDelPeriodo(periodoId)
    await aplicarRecargosVencidos(periodoId, new Date(`${ANIO}-03-10T10:00:00`))
    const cargo = await prisma.cargo.findFirst({ where: { inscripcionId: i.id } })
    expect(cargo!.estado).toBe(EstadoCargo.VENCIDO)
    expect(cargo!.montoRecargo).toBe(5000)
    expect(cargo!.montoNeto).toBe(82000)
  })

  it('no aplica recargo a un cargo ya PAGADO', async () => {
    const i = await alumnoInscrito('Pagado', Categoria.GENERAL, 1)
    await generarCargosDelPeriodo(periodoId)
    await prisma.cargo.updateMany({ where: { inscripcionId: i.id }, data: { estado: EstadoCargo.PAGADO } })
    await aplicarRecargosVencidos(periodoId, new Date(`${ANIO}-03-10T10:00:00`))
    const cargo = await prisma.cargo.findFirst({ where: { inscripcionId: i.id } })
    expect(cargo!.montoRecargo).toBe(0)
    expect(cargo!.estado).toBe(EstadoCargo.PAGADO)
  })

  it('no castiga a quien subió su comprobante dentro del plazo', async () => {
    // Pagó a tiempo y está esperando que Recepción valide: cobrarle el
    // recargo por la tardanza de la delegación sería injusto.
    const i = await alumnoInscrito('En revisión', Categoria.GENERAL, 1)
    await generarCargosDelPeriodo(periodoId)
    await prisma.cargo.updateMany({
      where: { inscripcionId: i.id },
      data: { estado: EstadoCargo.EN_REVISION },
    })
    await aplicarRecargosVencidos(periodoId, new Date(`${ANIO}-03-10T10:00:00`))
    const cargo = await prisma.cargo.findFirst({ where: { inscripcionId: i.id } })
    expect(cargo!.montoRecargo).toBe(0)
    expect(cargo!.estado).toBe(EstadoCargo.EN_REVISION)
  })

  it('no aplica el recargo dos veces', async () => {
    const i = await alumnoInscrito('Muy tarde', Categoria.GENERAL, 1)
    await generarCargosDelPeriodo(periodoId)
    const tarde = new Date(`${ANIO}-03-10T10:00:00`)
    await aplicarRecargosVencidos(periodoId, tarde)
    const segunda = await aplicarRecargosVencidos(periodoId, tarde)
    expect(segunda.actualizados).toBe(0)
    const cargo = await prisma.cargo.findFirst({ where: { inscripcionId: i.id } })
    expect(cargo!.montoRecargo).toBe(5000)
  })
})
