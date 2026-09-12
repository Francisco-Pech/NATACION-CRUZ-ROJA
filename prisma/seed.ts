import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import { hashPassword } from '../src/lib/auth.ts'
import { calcularFechaLimite } from '../src/lib/dias-habiles.ts'
import { nuevoHash } from '../src/lib/ids.ts'
import { festivosQueCuentan, vacacionesDeFinDeAnio } from '../src/lib/dias-inhabiles.ts'

/** Una fecha como la escribe el calendario: 2026-12-14. */
const comoTexto = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

/** El mediodía, para que el cambio de huso no corra la fecha un día. */
const alMediodia = (fecha: string) => new Date(`${fecha}T12:00:00`)

const prisma = new PrismaClient()

const ANIO = 2026
const PRECIO_LOCKER = 10000 // $100.00
const RECARGO = 5000 // $50.00

/**
 * El calendario de días que no se trabaja, 2026 y 2027.
 *
 * Todo es un rango: `desde` y `hasta` iguales es un solo día. Solo los de
 * tipo `DIA_INHABIL` corren la fecha límite de pago; vacaciones y
 * excepciones cierran la alberca sin tocar la cobranza.
 *
 * Los años anteriores al actual se ignoran: no se siembran ni estorban.
 * Para agregar un año nuevo basta con seguir la lista.
 */
type Inhabil = {
  tipo: 'DIA_INHABIL' | 'PERIODO_VACACIONAL' | 'EXCEPCION'
  nombre: string
  desde: string
  hasta?: string
  descripcion?: string
  /** Mismas fechas todos los años: se captura una vez y vale siempre. */
  cadaAnio?: boolean
}

/** Festivo de fecha fija: el mismo día todos los años. */
const fijo = (nombre: string, diaYMes: string): Inhabil => ({
  tipo: 'DIA_INHABIL', nombre, desde: `${ANIO}-${diaYMes}`, cadaAnio: true,
})

/** Festivo que se mueve: hay que decir de qué año es. */
const movible = (nombre: string, fecha: string): Inhabil => ({
  tipo: 'DIA_INHABIL', nombre, desde: fecha,
})

const CALENDARIO: Inhabil[] = [
  // ---- De fecha fija: se siembran una vez y valen todos los años ------
  fijo('Año Nuevo', '01-01'),
  fijo('Día del Trabajo', '05-01'),
  fijo('Independencia de México', '09-16'),
  fijo('Navidad', '12-25'),

  // ---- Los que se mueven: van año por año -----------------------------
  // Constitución, Juárez y Revolución caen en lunes de puente, y ese lunes
  // cambia de fecha cada año. No se pueden repetir a ciegas.
  movible('Día de la Constitución', '2026-02-02'),
  movible('Natalicio de Benito Juárez', '2026-03-16'),
  movible('Revolución Mexicana', '2026-11-16'),
  movible('Día de la Constitución', '2027-02-01'),
  movible('Natalicio de Benito Juárez', '2027-03-15'),
  movible('Revolución Mexicana', '2027-11-15'),

  // ---- Temporadas en que la alberca cierra ----------------------------
  // Son rangos a propósito: un renglón en vez de siete. No mueven el cobro.
  {
    tipo: 'PERIODO_VACACIONAL', nombre: 'Semana Santa 2026',
    desde: '2026-03-30', hasta: '2026-04-05',
    descripcion: 'La mensualidad se cobra completa.',
  },

  {
    tipo: 'PERIODO_VACACIONAL', nombre: 'Semana Santa 2027',
    desde: '2027-03-22', hasta: '2027-03-28',
    descripcion: 'La mensualidad se cobra completa.',
  },
  // Las de fin de año se calculan: caen distinto cada año porque arrancan
  // el lunes de la semana anterior a Navidad y terminan el primer viernes
  // pasado el 6 de enero. En 2026 Navidad es viernes y en 2028 es lunes.
  ...[2026, 2027].map((anio): Inhabil => {
    const v = vacacionesDeFinDeAnio(anio)
    return {
      tipo: 'PERIODO_VACACIONAL',
      nombre: `Vacaciones de fin de año ${anio}`,
      desde: comoTexto(v.desde),
      hasta: comoTexto(v.hasta),
      descripcion: 'Del lunes anterior a Navidad al primer viernes pasado el 6 de enero. La mensualidad se cobra completa.',
    }
  }),
]

/**
 * Los cuatro cursos. La clave es la que manda: el nombre se puede editar
 * desde el panel sin que este seeder cree duplicados al volver a correr.
 */
const TIPOS_CURSO: Array<{
  clave: string
  nombre: string
  descripcion: string
  /** Cómo se repiten sus fechas. Sin esto, las mismas todos los años. */
  modoFecha?: 'RECURRENTE' | 'UNICO' | 'MIXTO'
  /** Cuándo corre. Sin temporadas, el curso corre siempre. */
  temporadas?: Array<{ nombre?: string; desde: string; hasta: string }>
  /** Sin esto el curso se ofrece. En falso existe pero no está habilitado. */
  activo?: boolean
}> = [
  {
    clave: 'ADULTOS',
    temporadas: [{ desde: '01-01', hasta: '12-31' }],
    nombre: 'Curso Adultos',
    descripcion: 'Para personas de 13 años en adelante.',
  },
  {
    clave: 'NINOS',
    temporadas: [{ desde: '01-01', hasta: '12-31' }],
    nombre: 'Curso Niños',
    descripcion: 'Para niños de 7 a 12 años.',
  },
  {
    clave: 'PERSONALIZADO',
    temporadas: [{ desde: '01-01', hasta: '12-31' }],
    nombre: 'Personalizado',
    descripcion:
      'Recomendado para niños de 4 a 6 años. Los adultos no están excluidos: ' +
      'también pueden tomarlo.',
  },
  {
    clave: 'SALVAVIDAS',
    // El nombre es lo que ve el alumno y se corrige libremente; la clave no
    // se toca, que es de lo que se agarran el motor de cobro y el seeder.
    nombre: 'Guardavidas',
    descripcion: 'Para quienes ya saben nadar y quieren certificarse.',
    // La excepción: se abre por temporada, no de continuo, y se paga de una
    // sola vez.
    modoFecha: 'UNICO',
    // No está habilitado todavía. El curso existe —se puede prender cuando
    // la delegación defina fechas de certificación— pero mientras tanto no
    // se ofrece, no se agenda y no aparece para cobrar. Al habilitarlo,
    // quítale esta línea al seeder o se volverá a apagar al sembrar.
    activo: false,
  },
]

/**
 * Los siete días. El número es el del calendario: domingo 0 … sábado 6.
 * Aquí solo se dice cuáles existen; cuáles se trabaja es otra cosa.
 */
const DIAS = [
  { clave: 'LUNES', nombre: 'Lunes', numero: 1 },
  { clave: 'MARTES', nombre: 'Martes', numero: 2 },
  { clave: 'MIERCOLES', nombre: 'Miércoles', numero: 3 },
  { clave: 'JUEVES', nombre: 'Jueves', numero: 4 },
  { clave: 'VIERNES', nombre: 'Viernes', numero: 5 },
  { clave: 'SABADO', nombre: 'Sábado', numero: 6 },
  { clave: 'DOMINGO', nombre: 'Domingo', numero: 0 },
]

/** "14:30" → 870 minutos, y de vuelta. Así se parten las franjas sin liarse. */
const enMinutos = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + m
}
const enReloj = (minutos: number) =>
  `${String(Math.floor(minutos / 60)).padStart(2, '0')}:${String(minutos % 60).padStart(2, '0')}`

/**
 * Parte una ventana en bloques de la duración que se pida. Si el último no
 * cabe completo, no se incluye: media clase no es una clase.
 */
function bloques(desde: string, hasta: string, minutos: number): Array<[string, string]> {
  const salida: Array<[string, string]> = []
  for (let t = enMinutos(desde); t + minutos <= enMinutos(hasta); t += minutos) {
    salida.push([enReloj(t), enReloj(t + minutos)])
  }
  return salida
}

/**
 * El catálogo de franjas.
 *
 * Las 24 horas del día de hora en hora, más las franjas cortas que ocupa el
 * curso Personalizado: media hora los lunes, miércoles y viernes, y tres
 * cuartos los martes y jueves. Que se encimen con las horas enteras es
 * normal: no es el mismo grupo ni el mismo carril.
 *
 * Las de la madrugada —de las 10 de la noche a las 6 de la mañana— se
 * siembran desactivadas: existen por si algún día hacen falta, pero no
 * aparecen para agendar. Ninguna se borra nunca, solo se prende o se apaga.
 */
const ABRE = 6
const CIERRA = 22
const hh = (h: number) => `${String(h).padStart(2, '0')}:00`

/** La ventana del curso Personalizado. */
const PERSONALIZADO_DESDE = '14:00'
const PERSONALIZADO_HASTA = '16:30'
const MEDIA_HORA = bloques(PERSONALIZADO_DESDE, PERSONALIZADO_HASTA, 30)
const TRES_CUARTOS = bloques(PERSONALIZADO_DESDE, PERSONALIZADO_HASTA, 45)

const HORARIOS: Array<{ horaInicio: string; horaFin: string; activo: boolean }> = [
  ...Array.from({ length: 24 }, (_, h) => ({
    horaInicio: hh(h),
    // La última termina a las 24:00, que es la medianoche del cierre.
    horaFin: hh(h + 1),
    activo: h >= ABRE && h < CIERRA,
  })),
  ...[...MEDIA_HORA, ...TRES_CUARTOS].map(([horaInicio, horaFin]) => ({
    horaInicio, horaFin, activo: true,
  })),
]

// Días con la numeración de Date.getDay(): 0 domingo … 6 sábado.
const L = 1, M = 2, X = 3, J = 4, V = 5
const ENTRE_SEMANA = [L, M, X, J, V]

/**
 * La rejilla: qué curso corre qué día y en qué franja.
 *
 * Es como opera la delegación:
 *   · Adultos     — mixto, de 6 a 11 y de 16 a 22, de lunes a viernes.
 *   · Niños       — una sola clase, lunes, miércoles y viernes de 15 a 16.
 *   · Personalizado — de 14:00 a 16:30; media hora L/X/V, tres cuartos M/J.
 *   · Guardavidas — no se siembra. Va por temporada: cuando toque, se
 *     agenda desde el panel. El sábado se deja abierto en el marco para
 *     que quepa sin tocar nada.
 *
 * Esta lista manda: al sembrar, las sesiones que no estén aquí se apagan.
 * No se borran, para no perder quién estuvo apuntado.
 */
// El cupo y la tolerancia son de cada renglón: la alberca no tiene por qué
// aceptar lo mismo a las seis de la mañana que a las diez.
type Sesion = {
  curso: string
  horario: [string, string]
  dias: number[]
  cupo: number
  extras?: number
}

const SESIONES: Sesion[] = [
  ...bloques('06:00', '11:00', 60).map((horario): Sesion => ({
    curso: 'ADULTOS', horario, dias: ENTRE_SEMANA, cupo: 35,
  })),
  ...bloques('16:00', '22:00', 60).map((horario): Sesion => ({
    curso: 'ADULTOS', horario, dias: ENTRE_SEMANA, cupo: 35,
  })),

  { curso: 'NINOS', horario: ['15:00', '16:00'], dias: [L, X, V], cupo: 25 },

  // El cupo del Personalizado es provisional: se avisa al terminar. Va sin
  // tolerancia porque son bloques individuales: no hay dónde meter a uno más.
  ...MEDIA_HORA.map((horario): Sesion => ({
    curso: 'PERSONALIZADO', horario, dias: [L, X, V], cupo: 5, extras: 0,
  })),
  ...TRES_CUARTOS.map((horario): Sesion => ({
    curso: 'PERSONALIZADO', horario, dias: [M, J], cupo: 5, extras: 0,
  })),

  // Guardavidas no se siembra: va por temporada y se agenda a mano desde
  // el panel cuando toque certificación. El curso existe, su horario no.
]

const TIPOS_PAGO = [
  { clave: 'RECURRENTE', nombre: 'Pago recurrente' },
  { clave: 'UNICO', nombre: 'Pago único' },
]

/** Se ordenan por los meses que cubren, así que no llevan campo de orden. */
const FRECUENCIAS = [
  { clave: 'MENSUAL', nombre: 'Mensual', meses: 1, descripcion: 'Se cobra cada mes.' },
  { clave: 'TRIMESTRAL', nombre: 'Trimestral', meses: 3, descripcion: 'Se cobra cada tres meses.' },
  { clave: 'SEMESTRAL', nombre: 'Semestral', meses: 6, descripcion: 'Se cobra dos veces al año.' },
  { clave: 'ANUAL', nombre: 'Anual', meses: 12, descripcion: 'Se cobra una vez al año.' },
]

/**
 * Precios de arranque. Los de Adultos y Niños son los que la delegación ya
 * cobra. Los otros dos están **pendientes de confirmar** y se avisan al
 * terminar: se siembran para que el sistema no quede sin precio, no porque
 * sean el precio real.
 */
/** El año completo: del 1 de enero al 31 de diciembre. */
const vigenciaDelAnio = (anio: number) => ({
  vigenciaDesde: new Date(anio, 0, 1, 0, 0, 0),
  vigenciaHasta: new Date(anio, 11, 31, 23, 59, 59),
})

const TARIFAS: Array<{
  curso: string
  tipoPago: string
  frecuencia: string | null
  monto: number
  confirmado: boolean
}> = [
  { curso: 'ADULTOS', tipoPago: 'RECURRENTE', frecuencia: 'MENSUAL', monto: 77000, confirmado: true },
  { curso: 'NINOS', tipoPago: 'RECURRENTE', frecuencia: 'MENSUAL', monto: 70000, confirmado: true },
  { curso: 'PERSONALIZADO', tipoPago: 'RECURRENTE', frecuencia: 'MENSUAL', monto: 70000, confirmado: true },
  // Guardavidas no lleva precio: el curso existe pero está apagado, y no
  // hay nada que cobrar mientras no se abra. Se le pone cuando se abra.
]

async function main() {
  console.log('Sembrando catálogo base…')

  // ---- Usuario administrador -------------------------------------------
  //
  // Sale del entorno, nunca del código: una contraseña escrita aquí queda a
  // la vista de cualquiera que lea el repositorio, y esta cuenta puede todo
  // dentro del sistema. Sin las variables puestas no se crea ninguna cuenta
  // —falla cerrado— y el despliegue avisa qué falta.
  const admin = {
    nombre: process.env.ADMIN_NOMBRE?.trim() || 'Administrador',
    email: process.env.ADMIN_EMAIL?.trim().toLowerCase() ?? '',
    clave: process.env.ADMIN_PASSWORD ?? '',
  }

  if (!admin.email || admin.clave.length < 8) {
    console.log('  ⚠  Sin usuario administrador.')
    console.log('     Pon ADMIN_EMAIL y ADMIN_PASSWORD en el .env y vuelve a')
    console.log('     sembrar. La contraseña necesita al menos 8 caracteres.')
  } else {
    await prisma.usuario.upsert({
      where: { email: admin.email },
      // La contraseña no se reescribe al volver a sembrar: si ya la
      // cambiaron desde el panel, ese cambio manda sobre el .env.
      update: { nombre: admin.nombre, rol: 'ADMINISTRADOR', activo: true },
      create: {
        nombre: admin.nombre,
        email: admin.email,
        rol: 'ADMINISTRADOR',
        passwordHash: await hashPassword(admin.clave),
      },
    })
    console.log(`  1 administrador (${admin.email})`)
  }

  // ---- Calendario de días que no se trabaja -----------------------------
  // Se busca por nombre + fecha de inicio: así volver a correr el seeder no
  // duplica, y lo que la delegación agregue a mano se queda.
  for (const c of CALENDARIO) {
    const desde = alMediodia(c.desde)
    const hasta = alMediodia(c.hasta ?? c.desde)
    const existente = await prisma.diaInhabil.findFirst({ where: { nombre: c.nombre, desde } })
    const datos = {
      tipo: c.tipo, nombre: c.nombre, descripcion: c.descripcion ?? null,
      desde, hasta, cadaAnio: c.cadaAnio ?? false,
    }
    if (existente) {
      await prisma.diaInhabil.update({ where: { id: existente.id }, data: datos })
    } else {
      await prisma.diaInhabil.create({ data: { ...datos, hash: nuevoHash() } })
    }
  }
  const festivos = festivosQueCuentan(await prisma.diaInhabil.findMany(), ANIO)
  const inhabiles = CALENDARIO.filter((c) => c.tipo === 'DIA_INHABIL').length
  const repetidos = CALENDARIO.filter((c) => c.cadaAnio).length
  console.log(
    `  ${CALENDARIO.length} en el calendario · ${inhabiles} días inhábiles` +
      ` (${repetidos} de fecha fija, valen todos los años)` +
      ` · ${CALENDARIO.length - inhabiles} periodos` +
      ` · ${festivos.length} días que corren la fecha límite en ${ANIO}`,
  )

  // ---- Ciclo anual y periodos ------------------------------------------
  const ciclo = await prisma.cicloAnual.upsert({
    where: { anio: ANIO },
    update: {},
    create: { anio: ANIO },
  })

  for (let mes = 1; mes <= 12; mes++) {
    const clave = `${ANIO}-${String(mes).padStart(2, '0')}`
    const fechaLimite = calcularFechaLimite(ANIO, mes, 5, festivos)
    await prisma.periodo.upsert({
      where: { clave },
      update: { fechaLimite, recargo: RECARGO, precioLocker: PRECIO_LOCKER },
      create: { cicloAnualId: ciclo.id, mes, clave, fechaLimite, recargo: RECARGO, precioLocker: PRECIO_LOCKER },
    })
  }
  console.log('  12 periodos')

  // ---- Lockers ----------------------------------------------------------
  for (let numero = 1; numero <= 40; numero++) {
    await prisma.locker.upsert({ where: { numero }, update: {}, create: { numero } })
  }
  console.log('  40 lockers')

  // ---- Tipos de curso ---------------------------------------------------
  for (const t of TIPOS_CURSO) {
    // El nombre y la descripción sí se reescriben al volver a correr: este
    // archivo es de dónde salen. Si alguien los ajusta desde el panel y
    // quiere conservarlos, hay que traerlos aquí.
    const { temporadas, ...datos } = t
    const curso = await prisma.tipoCurso.upsert({
      where: { clave: t.clave },
      update: { ...datos, modoFecha: t.modoFecha ?? 'RECURRENTE', activo: t.activo ?? true },
      create: {
        ...datos, modoFecha: t.modoFecha ?? 'RECURRENTE',
        activo: t.activo ?? true, hash: nuevoHash(),
      },
    })

    // Las temporadas se reescriben completas: esta lista manda. El año que
    // se guarda da igual en los modos que se repiten; lo que cuenta es el
    // día y el mes.
    await prisma.temporadaCurso.deleteMany({ where: { tipoCursoId: curso.id } })
    for (const temp of temporadas ?? []) {
      await prisma.temporadaCurso.create({
        data: {
          hash: nuevoHash(),
          tipoCursoId: curso.id,
          nombre: temp.nombre ?? null,
          desde: new Date(`${ANIO}-${temp.desde}T12:00:00`),
          hasta: new Date(`${ANIO}-${temp.hasta}T12:00:00`),
        },
      })
    }
  }
  const habilitados = TIPOS_CURSO.filter((t) => t.activo !== false).length
  console.log(
    `  ${TIPOS_CURSO.length} tipos de curso · ${habilitados} habilitados` +
      ` · ${TIPOS_CURSO.length - habilitados} existe(n) pero sin habilitar`,
  )

  // ---- Días de la semana ------------------------------------------------
  for (const d of DIAS) {
    await prisma.diaSemana.upsert({
      where: { clave: d.clave },
      update: { nombre: d.nombre, numero: d.numero },
      create: { ...d, hash: nuevoHash() },
    })
  }
  console.log(`  ${DIAS.length} días de la semana`)

  // ---- Catálogo de horarios --------------------------------------------
  for (const h of HORARIOS) {
    // `activo` no se pisa al actualizar: si apagaron una franja desde el
    // panel, volver a correr el seeder no debe reabrirla.
    await prisma.horario.upsert({
      where: { horaInicio_horaFin: { horaInicio: h.horaInicio, horaFin: h.horaFin } },
      update: {},
      create: { ...h, hash: nuevoHash() },
    })
  }
  const cortas = MEDIA_HORA.length + TRES_CUARTOS.length
  const deHora = HORARIOS.length - cortas
  console.log(
    `  ${HORARIOS.length} horarios · ${deHora} de hora en hora ` +
      `(${deHora - 8} activos de ${hh(ABRE)} a ${hh(CIERRA)}, 8 apagados de madrugada) ` +
      `· ${cortas} cortos para Personalizado (${MEDIA_HORA.length} de 30 min, ${TRES_CUARTOS.length} de 45 min)`,
  )

  // ---- Días laborales: qué día abre la alberca y en qué franja ----------
  // Solo de lunes a viernes. El sábado y el domingo existen en el catálogo
  // de días —se pueden abrir desde el panel el día que haga falta— pero el
  // seeder no los abre. Es el marco: la rejilla de cursos se apega a esto.
  const diasAbiertos = await prisma.diaSemana.findMany({ where: { activo: true } })
  const franjasActivas = await prisma.horario.findMany({ where: { activo: true } })
  const vigenteLaboral = new Set<string>()
  let laborales = 0
  for (const dia of diasAbiertos.filter((d) => d.numero >= L && d.numero <= V)) {
    for (const franja of franjasActivas) {
      const fila = await prisma.franjaLaboral.upsert({
        where: { diaSemanaId_horarioId: { diaSemanaId: dia.id, horarioId: franja.id } },
        update: { activo: true },
        create: { hash: nuevoHash(), diaSemanaId: dia.id, horarioId: franja.id },
      })
      vigenteLaboral.add(fila.id)
      laborales++
    }
  }

  // Lo que quede fuera de la lista se apaga, igual que con las sesiones:
  // esta lista manda. No se borra, para que conserve su hash.
  const cerradas = await prisma.franjaLaboral.updateMany({
    where: { id: { notIn: [...vigenteLaboral] }, activo: true },
    data: { activo: false },
  })
  console.log(
    `  ${laborales} franjas laborales (lunes a viernes)` +
      (cerradas.count > 0 ? ` · ${cerradas.count} cerradas` : ''),
  )

  // ---- La rejilla: día × horario por curso ------------------------------
  const vigentes = new Set<string>()
  let sesiones = 0
  for (const s of SESIONES) {
    const curso = await prisma.tipoCurso.findUniqueOrThrow({ where: { clave: s.curso } })
    const horario = await prisma.horario.findUniqueOrThrow({
      where: { horaInicio_horaFin: { horaInicio: s.horario[0], horaFin: s.horario[1] } },
    })
    for (const diaSemana of s.dias) {
      const llave = { tipoCursoId: curso.id, horarioId: horario.id, diaSemana }
      const fila = await prisma.sesion.upsert({
        where: { tipoCursoId_horarioId_diaSemana: llave },
        // El cupo no se reescribe: es el número que el administrador
        // ajusta desde la pantalla, y pisarlo en cada despliegue volvería
        // mentira la pantalla — lo subes el lunes y regresa solo el martes.
        update: { activo: true },
        create: { ...llave, hash: nuevoHash(), cupoMaximo: s.cupo, extras: s.extras ?? 10 },
      })
      vigentes.add(fila.id)
      sesiones++
    }
  }

  // Lo que ya no está en la lista se apaga, no se borra: si se borrara se
  // perdería el registro de quién iba ese día a esa hora. Esta lista manda.
  const apagadas = await prisma.sesion.updateMany({
    where: { id: { notIn: [...vigentes] }, activo: true },
    data: { activo: false },
  })
  console.log(
    `  ${sesiones} sesiones en la rejilla` +
      (apagadas.count > 0 ? ` · ${apagadas.count} viejas apagadas` : ''),
  )

  // ---- Formas de cobro --------------------------------------------------
  for (const t of TIPOS_PAGO) {
    // `activo` no se pisa: si lo apagaron desde el panel, ahí se queda.
    await prisma.tipoPago.upsert({
      where: { clave: t.clave },
      update: { nombre: t.nombre },
      create: { ...t, hash: nuevoHash() },
    })
  }
  for (const f of FRECUENCIAS) {
    await prisma.frecuenciaPago.upsert({
      where: { clave: f.clave },
      update: { nombre: f.nombre, meses: f.meses, descripcion: f.descripcion },
      create: { ...f, hash: nuevoHash() },
    })
  }
  console.log(`  ${TIPOS_PAGO.length} tipos de pago · ${FRECUENCIAS.length} frecuencias`)

  // ---- Tabla de costos --------------------------------------------------
  const porConfirmar: string[] = []
  for (const t of TARIFAS) {
    const curso = await prisma.tipoCurso.findUniqueOrThrow({ where: { clave: t.curso } })
    const tipoPago = await prisma.tipoPago.findUniqueOrThrow({ where: { clave: t.tipoPago } })
    const frecuencia = t.frecuencia
      ? await prisma.frecuenciaPago.findUniqueOrThrow({ where: { clave: t.frecuencia } })
      : null

    // No se usa upsert: el índice único incluye frecuenciaId, y en Postgres
    // dos NULL no chocan entre sí, así que para el pago único no protegería.
    const existente = await prisma.tarifa.findFirst({
      where: {
        cicloAnualId: ciclo.id,
        tipoCursoId: curso.id,
        tipoPagoId: tipoPago.id,
        frecuenciaId: frecuencia?.id ?? null,
      },
    })

    if (existente) {
      await prisma.tarifa.update({ where: { id: existente.id }, data: { monto: t.monto } })
    } else {
      await prisma.tarifa.create({
        data: {
          cicloAnualId: ciclo.id,
          tipoCursoId: curso.id,
          tipoPagoId: tipoPago.id,
          frecuenciaId: frecuencia?.id ?? null,
          monto: t.monto,
          hash: nuevoHash(),
          // El año completo del ciclo. Cuando cambie el precio a media
          // marcha, se recorta este tramo y se captura el nuevo.
          ...vigenciaDelAnio(ciclo.anio),
        },
      })
    }
    if (!t.confirmado) porConfirmar.push(curso.nombre)
  }
  console.log(`  ${TARIFAS.length} tarifas`)

  // ---- Locker y recargo -------------------------------------------------
  //
  // No cuelgan del mes: es un solo renglón con su tramo de fechas. El
  // recargo se cobra una vez por cargo de curso vencido y no toca al locker.
  for (const c of [
    { concepto: 'LOCKER' as const, monto: 10000 },
    { concepto: 'RECARGO' as const, monto: 5000 },
  ]) {
    const vigencia = vigenciaDelAnio(ciclo.anio)
    // Se busca por año y no por el instante exacto: una diferencia de
    // horas —por la zona horaria o por cómo se capturó— haría creer que no
    // existe y sembraría un duplicado.
    const existente = await prisma.costo.findFirst({
      where: {
        concepto: c.concepto,
        vigenciaDesde: { gte: new Date(ciclo.anio, 0, 1), lt: new Date(ciclo.anio + 1, 0, 1) },
      },
    })
    // No se reescribe el monto de uno que ya existe: es dinero, y lo decide
    // quien administra desde la pantalla.
    if (!existente) {
      await prisma.costo.create({ data: { ...c, ...vigencia, hash: nuevoHash() } })
    }
  }
  console.log('  2 costos: locker y recargo')

  // ---- Descuentos -------------------------------------------------------
  //
  // La clave es de lo que se agarra el seeder y no se toca; el nombre es lo
  // que se ve y se puede corregir desde el panel. El valor no se reescribe
  // al volver a sembrar: es dinero, y lo decide quien administra.
  const DESCUENTOS: Array<{
    clave: string
    nombre: string
    tipo: 'PORCENTAJE' | 'MONTO_FIJO'
    valor: number
    descripcion?: string
    /** En falso existe pero no se ofrece al inscribir. */
    activo?: boolean
    /** Falso cuando el valor es una suposición y falta confirmarlo. */
    confirmado?: boolean
  }> = [
    {
      clave: 'INAPAM', nombre: 'INAPAM', tipo: 'PORCENTAJE', valor: 50,
      descripcion: 'Para quien presenta su credencial del INAPAM.',
      confirmado: true,
    },
    {
      clave: 'PERSONAL', nombre: 'Personal Cruz Roja', tipo: 'PORCENTAJE', valor: 100,
      descripcion: 'Para el personal de la Delegación.',
      confirmado: true,
    },
    {
      clave: 'CORTESIA', nombre: 'Cortesía', tipo: 'PORCENTAJE', valor: 100,
      descripcion: 'Se otorga sin costo por acuerdo de la Delegación.',
      confirmado: true,
    },
    {
      clave: 'ESPECIAL', nombre: 'Especial', tipo: 'PORCENTAJE', valor: 20,
      descripcion: 'Caso especial autorizado por la Delegación.',
      confirmado: true,
    },
  ]

  const descuentosPorConfirmar: string[] = []
  for (const d of DESCUENTOS) {
    const { confirmado, ...datos } = d
    await prisma.descuento.upsert({
      where: { clave: d.clave },
      // El valor y el estado no se pisan: quien administra ya pudo haberlos
      // ajustado desde la pantalla, y volverlos a su sitio en cada
      // despliegue haría mentir a la pantalla.
      update: { nombre: d.nombre, descripcion: d.descripcion ?? null },
      create: { ...datos, activo: d.activo ?? true, hash: nuevoHash() },
    })
    if (!confirmado) descuentosPorConfirmar.push(d.nombre)
  }
  console.log(`  ${DESCUENTOS.length} descuentos`)

  console.log('Listo.')
  if (porConfirmar.length > 0) {
    console.log('')
    console.log('  ⚠  Precios pendientes de confirmar con la delegación:')
    for (const nombre of porConfirmar) console.log(`     · ${nombre}`)
    console.log('     Se sembraron con un valor provisional para que el sistema')
    console.log('     no quede sin precio. Cámbialos en Panel → Costos.')
  }
  if (descuentosPorConfirmar.length > 0) {
    console.log('')
    console.log('  ⚠  Descuentos sin porcentaje definido, sembrados APAGADOS:')
    for (const nombre of descuentosPorConfirmar) console.log(`     · ${nombre}`)
    console.log('     Apagados no se ofrecen al inscribir: un porcentaje')
    console.log('     inventado cobraría de menos a alguien de verdad.')
    console.log('     Ponles el suyo y enciéndelos en Panel → Descuentos.')
  }
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
