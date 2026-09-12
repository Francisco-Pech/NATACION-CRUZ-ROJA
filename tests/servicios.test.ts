import { describe, it, expect, beforeEach, afterAll } from 'vitest'
import { prisma } from '@/lib/db'
import { nuevoHash } from '@/lib/ids'
import { inscribirAlumno } from '@/lib/servicios/inscripciones'
import { lockersDisponibles, asignarLocker, liberarLocker } from '@/lib/servicios/lockers'
import { registrarPago, validarPago } from '@/lib/servicios/pagos'
import { obtenerEstadoCuenta, verificarAcceso, colorDeEstado } from '@/lib/servicios/estado-cuenta'
import { generarCargosDelPeriodo } from '@/lib/servicios/periodos'
import { Categoria, EstadoCargo, EstadoPago, MetodoPago } from '@prisma/client'

const ANIO = 2096
let cicloId = ''
let periodoId = ''

async function limpiar() {
  const ciclo = await prisma.cicloAnual.findUnique({ where: { anio: ANIO } })
  if (ciclo) {
    const insc = await prisma.inscripcion.findMany({
      where: { cicloAnualId: ciclo.id }, select: { alumnoId: true },
    })
    await prisma.cicloAnual.delete({ where: { id: ciclo.id } })
    await prisma.alumno.deleteMany({ where: { id: { in: insc.map((i) => i.alumnoId) } } })
  }
  await prisma.locker.deleteMany({ where: { numero: { gte: 9000 } } })
  // La sesión de prueba se borra después del ciclo: al irse las
  // inscripciones se van sus renglones y la sesión queda libre.
  await prisma.sesion.deleteMany({ where: { horario: { horaInicio: HORA_PRUEBA } } })
  await prisma.horario.deleteMany({ where: { horaInicio: HORA_PRUEBA } })
}

const HORA_PRUEBA = '23:15'

/** Inscribe y le da curso: sin curso no hay cargo que probar. */
async function inscritoConCurso(nombre: string) {
  const sesion = await sesionDePrueba(50)
  return inscribirAlumno(nombre, cicloId, Categoria.GENERAL, [sesion.id])
}

/** Una sesión propia de la prueba, para poder llenarla sin tocar la real. */
async function sesionDePrueba(cupoMaximo = 20) {
  // Se asegura de que el curso corra todo el año: desde el panel se le
  // puede cambiar la repetición, y con otra estas pruebas se caerían por
  // algo que no tiene que ver con lo que prueban.
  const curso = await prisma.tipoCurso.update({
    where: { clave: 'ADULTOS' },
    data: { modoFecha: 'RECURRENTE' },
  })
  const horario = await prisma.horario.upsert({
    where: { horaInicio_horaFin: { horaInicio: HORA_PRUEBA, horaFin: '23:45' } },
    update: {},
    create: { horaInicio: HORA_PRUEBA, horaFin: '23:45', hash: nuevoHash() },
  })
  return prisma.sesion.upsert({
    where: {
      tipoCursoId_horarioId_diaSemana: {
        tipoCursoId: curso.id, horarioId: horario.id, diaSemana: 0,
      },
    },
    update: { cupoMaximo, extras: 0 },
    create: { hash: nuevoHash(), tipoCursoId: curso.id, horarioId: horario.id, diaSemana: 0, cupoMaximo, extras: 0 },
  })
}

beforeEach(async () => {
  await limpiar()
  const ciclo = await prisma.cicloAnual.create({ data: { anio: ANIO } })
  cicloId = ciclo.id
  const periodo = await prisma.periodo.create({
    data: {
      cicloAnualId: cicloId, mes: 3, clave: `${ANIO}-03`,
      fechaLimite: new Date(`${ANIO}-03-06T23:59:59`), recargo: 5000, precioLocker: 10000,
    },
  })
  periodoId = periodo.id
  const recurrente = await prisma.tipoPago.findUniqueOrThrow({ where: { clave: "RECURRENTE" } })
  const mensual = await prisma.frecuenciaPago.findUniqueOrThrow({ where: { clave: "MENSUAL" } })
  const adultos = await prisma.tipoCurso.findUniqueOrThrow({ where: { clave: "ADULTOS" } })
  const ninos = await prisma.tipoCurso.findUniqueOrThrow({ where: { clave: "NINOS" } })
  await prisma.tarifa.createMany({
    data: [
      { cicloAnualId: cicloId, tipoCursoId: adultos.id, tipoPagoId: recurrente.id, frecuenciaId: mensual.id, monto: 77000, hash: nuevoHash(), vigenciaDesde: new Date(ANIO, 0, 1), vigenciaHasta: new Date(ANIO, 11, 31, 23, 59, 59) },
      { cicloAnualId: cicloId, tipoCursoId: ninos.id, tipoPagoId: recurrente.id, frecuenciaId: mensual.id, monto: 65000, hash: nuevoHash(), vigenciaDesde: new Date(ANIO, 0, 1), vigenciaHasta: new Date(ANIO, 11, 31, 23, 59, 59) },
    ],
  })
})

afterAll(async () => { await limpiar(); await prisma.$disconnect() })

describe('inscribirAlumno', () => {
  it('da de alta con solo el nombre completo', async () => {
    const i = await inscribirAlumno('Solo Nombre', cicloId)
    expect(i.alumno.nombreCompleto).toBe('Solo Nombre')
    expect(i.alumno.datosCompletos).toBe(false)
  })

  it('asigna folios consecutivos dentro del mismo ciclo', async () => {
    const a = await inscribirAlumno('Primero', cicloId)
    const b = await inscribirAlumno('Segundo', cicloId)
    expect(a.folio).toBe(`CRM-${ANIO}-0001`)
    expect(b.folio).toBe(`CRM-${ANIO}-0002`)
  })

  it('asigna un token distinto a cada inscripción', async () => {
    const a = await inscribirAlumno('Uno', cicloId)
    const b = await inscribirAlumno('Dos', cicloId)
    expect(a.tokenQR).not.toBe(b.tokenQR)
    expect(a.tokenQR.length).toBeGreaterThanOrEqual(43)
  })

  it('el token no contiene el folio', async () => {
    const i = await inscribirAlumno('Seguro', cicloId)
    expect(i.tokenQR).not.toContain('CRM')
    expect(i.tokenQR).not.toContain('0001')
  })

  it('apunta al alumno a las sesiones que se le indiquen', async () => {
    const sesion = await sesionDePrueba(5)
    const i = await inscribirAlumno('Con horario', cicloId, Categoria.GENERAL, [sesion.id])
    expect(await prisma.inscripcionSesion.count({ where: { inscripcionId: i.id } })).toBe(1)
  })

  // La pantalla decía "El sistema no deja inscribir por encima del cupo" y
  // no lo cumplía. Ahora sí, y del lado del servidor.
  it('no deja inscribir por encima del cupo de la sesión', async () => {
    const sesion = await sesionDePrueba(1)
    await inscribirAlumno('Primero', cicloId, Categoria.GENERAL, [sesion.id])
    await expect(
      inscribirAlumno('Segundo', cicloId, Categoria.GENERAL, [sesion.id]),
    ).rejects.toThrow(/cupo/i)
  })

  // Si el cupo revienta, no debe quedar un alumno huérfano ni un folio
  // quemado: o entra completo, o no entra.
  it('si la sesión está llena no deja al alumno a medias', async () => {
    const sesion = await sesionDePrueba(1)
    await inscribirAlumno('Primero', cicloId, Categoria.GENERAL, [sesion.id])
    await expect(
      inscribirAlumno('Segundo', cicloId, Categoria.GENERAL, [sesion.id]),
    ).rejects.toThrow()
    expect(await prisma.alumno.findFirst({ where: { nombreCompleto: 'Segundo' } })).toBeNull()
  })

  it('rechaza una sesión que no existe', async () => {
    await expect(
      inscribirAlumno('Fantasma', cicloId, Categoria.GENERAL, ['no-existe']),
    ).rejects.toThrow()
  })
})

describe('lockers', () => {
  it('asignar un locker lo saca de la lista de disponibles', async () => {
    const i = await inscritoConCurso('Con locker')
    const locker = await prisma.locker.create({ data: { numero: 9001 } })
    expect((await lockersDisponibles(periodoId)).some((l) => l.id === locker.id)).toBe(true)
    await asignarLocker(locker.id, i.id, periodoId)
    expect((await lockersDisponibles(periodoId)).some((l) => l.id === locker.id)).toBe(false)
  })

  it('rechaza asignar un locker ya ocupado en ese periodo', async () => {
    const a = await inscritoConCurso('Primero')
    const b = await inscritoConCurso('Segundo')
    const locker = await prisma.locker.create({ data: { numero: 9002 } })
    await asignarLocker(locker.id, a.id, periodoId)
    await expect(asignarLocker(locker.id, b.id, periodoId)).rejects.toThrow(/ya está asignado/)
  })

  it('un alumno puede tener varios lockers', async () => {
    const i = await inscritoConCurso('Varios')
    const l1 = await prisma.locker.create({ data: { numero: 9003 } })
    const l2 = await prisma.locker.create({ data: { numero: 9004 } })
    await asignarLocker(l1.id, i.id, periodoId)
    await asignarLocker(l2.id, i.id, periodoId)
    expect(await prisma.asignacionLocker.count({ where: { inscripcionId: i.id } })).toBe(2)
  })

  it('asignar un locker sube el cargo del mes', async () => {
    const i = await inscritoConCurso('Sube cargo')
    await generarCargosDelPeriodo(periodoId)
    const locker = await prisma.locker.create({ data: { numero: 9005 } })
    await asignarLocker(locker.id, i.id, periodoId)
    const cargo = await prisma.cargo.findFirst({ where: { inscripcionId: i.id } })
    expect(cargo!.montoNeto).toBe(87000)
  })

  it('liberar un locker lo devuelve a disponibles y baja el cargo', async () => {
    const i = await inscritoConCurso('Libera')
    await generarCargosDelPeriodo(periodoId)
    const locker = await prisma.locker.create({ data: { numero: 9006 } })
    const asignacion = await asignarLocker(locker.id, i.id, periodoId)
    await liberarLocker(asignacion.id)
    const cargo = await prisma.cargo.findFirst({ where: { inscripcionId: i.id } })
    expect(cargo!.montoNeto).toBe(77000)
  })
})

describe('pagos', () => {
  async function cargoDe(nombre: string) {
    const i = await inscritoConCurso(nombre)
    await generarCargosDelPeriodo(periodoId)
    const cargo = await prisma.cargo.findFirstOrThrow({ where: { inscripcionId: i.id } })
    return { inscripcion: i, cargo }
  }

  it('un pago en efectivo por el total deja el cargo PAGADO', async () => {
    const { cargo } = await cargoDe('Paga completo')
    await registrarPago({ cargoId: cargo.id, metodo: MetodoPago.EFECTIVO, montoCobrado: 77000 })
    const actualizado = await prisma.cargo.findUniqueOrThrow({ where: { id: cargo.id } })
    expect(actualizado.estado).toBe(EstadoCargo.PAGADO)
  })

  it('efectivo y transferencia no llevan comisión', async () => {
    const { cargo } = await cargoDe('Sin comision')
    const pago = await registrarPago({
      cargoId: cargo.id, metodo: MetodoPago.TRANSFERENCIA, montoCobrado: 77000,
    })
    expect(pago.montoComision).toBe(0)
    expect(pago.montoNeto).toBe(77000)
  })

  it('un pago parcial no marca el cargo como pagado', async () => {
    const { cargo } = await cargoDe('Parcial')
    await registrarPago({ cargoId: cargo.id, metodo: MetodoPago.EFECTIVO, montoCobrado: 40000 })
    const actualizado = await prisma.cargo.findUniqueOrThrow({ where: { id: cargo.id } })
    expect(actualizado.estado).not.toBe(EstadoCargo.PAGADO)
  })

  it('varios pagos parciales que suman el total lo dejan PAGADO', async () => {
    const { cargo } = await cargoDe('Dos partes')
    await registrarPago({ cargoId: cargo.id, metodo: MetodoPago.EFECTIVO, montoCobrado: 40000 })
    await registrarPago({ cargoId: cargo.id, metodo: MetodoPago.EFECTIVO, montoCobrado: 37000 })
    const actualizado = await prisma.cargo.findUniqueOrThrow({ where: { id: cargo.id } })
    expect(actualizado.estado).toBe(EstadoCargo.PAGADO)
  })

  it('un comprobante en revisión no da por pagado el cargo', async () => {
    const { cargo } = await cargoDe('En revision')
    await registrarPago({
      cargoId: cargo.id, metodo: MetodoPago.TRANSFERENCIA, montoCobrado: 77000,
      estado: EstadoPago.EN_REVISION, comprobanteUrl: '/comprobantes/x.jpg',
    })
    const actualizado = await prisma.cargo.findUniqueOrThrow({ where: { id: cargo.id } })
    expect(actualizado.estado).toBe(EstadoCargo.EN_REVISION)
  })

  it('validar un pago en revisión lo confirma y paga el cargo', async () => {
    const { cargo } = await cargoDe('Validado')
    const admin = await prisma.usuario.findFirstOrThrow()
    const pago = await registrarPago({
      cargoId: cargo.id, metodo: MetodoPago.TRANSFERENCIA, montoCobrado: 77000,
      estado: EstadoPago.EN_REVISION,
    })
    await validarPago(pago.id, admin.id, true)
    const actualizado = await prisma.cargo.findUniqueOrThrow({ where: { id: cargo.id } })
    expect(actualizado.estado).toBe(EstadoCargo.PAGADO)
  })

  it('rechazar un comprobante no deja el cargo pagado', async () => {
    const { cargo } = await cargoDe('Rechazado')
    const admin = await prisma.usuario.findFirstOrThrow()
    const pago = await registrarPago({
      cargoId: cargo.id, metodo: MetodoPago.TRANSFERENCIA, montoCobrado: 77000,
      estado: EstadoPago.EN_REVISION,
    })
    await validarPago(pago.id, admin.id, false)
    const actualizado = await prisma.cargo.findUniqueOrThrow({ where: { id: cargo.id } })
    expect(actualizado.estado).not.toBe(EstadoCargo.PAGADO)
  })

  it('guarda quién registró y quién validó cada pago', async () => {
    const { cargo } = await cargoDe('Bitacora')
    const admin = await prisma.usuario.findFirstOrThrow()
    const pago = await registrarPago({
      cargoId: cargo.id, metodo: MetodoPago.EFECTIVO, montoCobrado: 77000,
      registradoPorId: admin.id, estado: EstadoPago.EN_REVISION,
    })
    const validado = await validarPago(pago.id, admin.id, true)
    expect(validado.registradoPorId).toBe(admin.id)
    expect(validado.validadoPorId).toBe(admin.id)
  })
})

describe('estado de cuenta y acceso', () => {
  it('devuelve null con un token inexistente', async () => {
    expect(await obtenerEstadoCuenta('token-que-no-existe')).toBeNull()
    expect(await verificarAcceso('token-que-no-existe')).toBeNull()
  })

  it('el semáforo traduce cada estado a su color', () => {
    expect(colorDeEstado(EstadoCargo.PAGADO)).toBe('VERDE')
    expect(colorDeEstado(EstadoCargo.VENCIDO)).toBe('ROJO')
    expect(colorDeEstado(EstadoCargo.PENDIENTE)).toBe('AMARILLO')
    expect(colorDeEstado(EstadoCargo.EN_REVISION)).toBe('AZUL')
    expect(colorDeEstado(EstadoCargo.CANCELADO)).toBe('GRIS')
  })

  it('un cargo PAGADO da acceso', async () => {
    const i = await inscritoConCurso('Con acceso')
    await generarCargosDelPeriodo(periodoId)
    const cargo = await prisma.cargo.findFirstOrThrow({ where: { inscripcionId: i.id } })
    await registrarPago({ cargoId: cargo.id, metodo: MetodoPago.EFECTIVO, montoCobrado: 77000 })
    const acceso = await verificarAcceso(i.tokenQR, 3)
    expect(acceso!.alCorriente).toBe(true)
  })

  it('un cargo sin pagar niega el acceso', async () => {
    const i = await inscritoConCurso('Sin acceso')
    await generarCargosDelPeriodo(periodoId)
    const acceso = await verificarAcceso(i.tokenQR, 3)
    expect(acceso!.alCorriente).toBe(false)
  })

  it('la verificación no expone importes ni datos personales', async () => {
    const i = await inscritoConCurso('Privado')
    await prisma.alumno.update({
      where: { id: i.alumnoId },
      data: { telefono: '9981234567', direccion: 'Calle Falsa 123', rfc: 'XAXX010101000' },
    })
    await generarCargosDelPeriodo(periodoId)
    const acceso = await verificarAcceso(i.tokenQR, 3)
    expect(Object.keys(acceso!).sort()).toEqual(
      ['alCorriente', 'folio', 'fotoUrl', 'mes', 'nombre'],
    )
    const serializado = JSON.stringify(acceso)
    expect(serializado).not.toContain('9981234567')
    expect(serializado).not.toContain('Calle Falsa')
    expect(serializado).not.toContain('XAXX010101000')
  })

  it('el estado de cuenta muestra el precio en línea por encima del de efectivo', async () => {
    // La comisión ya no se prepara aquí: viene del entorno, y sin variables
    // puestas rigen los valores de lista de Stripe —3.6 % + $3, IVA 16 %—,
    // que son justo los que esta prueba espera ver reflejados.
    const i = await inscritoConCurso('Precios')
    await generarCargosDelPeriodo(periodoId)
    const estado = await obtenerEstadoCuenta(i.tokenQR, 3)
    const efectivo = estado!.precios.find((p) => p.metodo === MetodoPago.EFECTIVO)!
    const tarjeta = estado!.precios.find((p) => p.metodo === MetodoPago.TARJETA)!
    expect(efectivo.total).toBe(77000)
    expect(tarjeta.total).toBe(80800)
  })
})
