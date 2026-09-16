import { prisma } from '@/lib/db'
import { leerSesion } from '@/lib/sesion'
import Link from 'next/link'
import { tienePermiso, supervisaListas } from '@/lib/permisos'
import { mesEnCurso } from '@/lib/zona'
import { misGrupos, todosLosGrupos } from './profesor-acciones'
import ListaDelProfesor from './ListaDelProfesor'
import { notFound } from 'next/navigation'
import { colorDeEstado, ETIQUETA_ESTADO } from '@/lib/servicios/estado-cuenta'
import { DIAS_SEMANA } from '@/lib/dias-semana'
import FormularioAlumno from './FormularioAlumno'
import TablaAlumnos from './TablaAlumnos'
import { anioEnCurso } from '@/lib/zona'
import { periodoActual } from '@/lib/periodo-actual'
import { conValor } from '@/lib/descuentos'
import { pesos } from '@/lib/formato'

/**
 * Alumnos, en dos pestañas para quien ve las dos cosas.
 *
 * El mostrador y la lista de clase son dos trabajos distintos sobre la misma
 * gente: uno da de alta y cobra, el otro cuenta quién vino. Administrador y
 * Root hacen los dos, y verlos revueltos en una sola pantalla larga obliga a
 * buscar. El profesor no ve pestañas: para él solo existe la lista.
 *
 * Van como enlaces con `?tab=`, igual que en Costos: la pestaña se comparte,
 * se guarda en favoritos y el botón de atrás funciona.
 */
const PESTANAS = [
  { clave: 'alumnos', titulo: 'Alumnos' },
  { clave: 'asistencia', titulo: 'Asistencia' },
] as const

const dos = (n: number) => String(n).padStart(2, '0')

/**
 * El tramo con el que abre la lista: el mes que corre, en hora de Cancún.
 *
 * El día 0 del mes siguiente es el último de este: escribir 30 se rompe en
 * febrero.
 */
function mesEnCursoComoTramo() {
  const anio = anioEnCurso()
  const mes = mesEnCurso()
  const ultimo = new Date(anio, mes, 0).getDate()
  return {
    desde: `${anio}-${dos(mes)}-01`,
    hasta: `${anio}-${dos(mes)}-${dos(ultimo)}`,
  }
}

export default async function Alumnos({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>
}) {
  const usuario = await leerSesion()

  /**
   * Dos pantallas en la misma puerta.
   *
   * El profesor entra a Alumnos, pero no ve la de siempre: él no da de alta
   * a nadie ni cobra. Enseñarle la tabla con la mitad de los botones
   * apagados sería enseñarle un formulario roto, así que ve la suya.
   */
  if (!tienePermiso(usuario, 'ALUMNOS')) {
    if (!tienePermiso(usuario, 'ASISTENCIA')) notFound()
    const grupos = await misGrupos()
    const tramo = mesEnCursoComoTramo()
    return (
      <>
        <h1>Mi lista</h1>
        <p className="silencio" style={{ marginTop: '-.4rem' }}>
          Los grupos que impartes. Pasa lista y pide la credencial al menos una vez al mes.
        </p>
        <ListaDelProfesor grupos={grupos} desdeHoy={tramo.desde} hastaHoy={tramo.hasta} />
      </>
    )
  }

  const supervisa = supervisaListas(usuario)
  const pedido = await searchParams
  const enAsistencia = supervisa && pedido.tab === 'asistencia'

  const pestanas = supervisa ? (
    <nav className="pestanas no-imprimir">
      {PESTANAS.map((p) => (
        <Link
          key={p.clave}
          href={`/panel/alumnos?tab=${p.clave}`}
          className={`pestana${(p.clave === 'asistencia') === enAsistencia ? ' activa' : ''}`}
        >
          {p.titulo}
        </Link>
      ))}
    </nav>
  ) : null

  // La pestaña de asistencia se responde aquí y no más abajo: lo del
  // mostrador —inscripciones, lockers, descuentos— son varias consultas que
  // no hacen falta para pasar lista.
  if (enAsistencia) {
    const grupos = await todosLosGrupos()
    const tramo = mesEnCursoComoTramo()
    return (
      <>
        <h1>Alumnos</h1>
        {pestanas}
        <p className="silencio" style={{ marginTop: '-.4rem' }}>
          Las listas de todos los grupos, como las llevan los profesores.
        </p>
        <ListaDelProfesor
          grupos={grupos} desdeHoy={tramo.desde} hastaHoy={tramo.hasta} supervisando
        />
      </>
    )
  }

  const mes = new Date().getMonth() + 1
  const actual = await periodoActual()

  const inscripciones = await prisma.inscripcion.findMany({
    include: {
      alumno: true,
      ciclo: true,
      descuento: true,
      // El locker es del mes, no del ciclo: se pide el de hoy.
      lockers: actual
        ? { where: { periodoId: actual.periodo.id }, include: { locker: true } }
        : { where: { periodoId: '' }, include: { locker: true } },
      sesiones: { include: { sesion: { include: { tipoCurso: true, horario: true } } } },
      cargos: { where: { periodo: { mes } }, include: { periodo: true, tipoCurso: true } },
    },
    orderBy: { creadoEn: 'desc' },
  })

  // Para el alta: solo los días y horarios abiertos y con lugar. Ofrecer
  // uno lleno sería prometer algo que el servidor va a rechazar.
  //
  // Los que van sobre el cupo sí se ofrecen mientras queden extras: el
  // servicio los acepta, así que esconderlos sería decirle que no a alguien
  // que sí cabe. Se marcan, eso sí.
  const ciclo = await prisma.cicloAnual.findFirst({
    where: { estado: 'ABIERTO' },
    orderBy: { anio: 'desc' },
  })

  // Solo el año que corre.
  //
  // La rejilla tiene armado también el año que entra, pero ofrecerlo aquí
  // sería tenderle una trampa a quien captura: dos renglones que se leen
  // casi igual y uno manda al alumno al ciclo equivocado. Cuando cambie el
  // año, cambia solo lo que se ofrece.
  const anio = anioEnCurso()

  // Los lockers que se pueden ofrecer hoy: encendidos, sin profesor que
  // los tenga apartado y sin nadie que los ocupe este mes. Ofrecer uno
  // tomado sería prometer algo que el servidor va a rechazar.
  const lockersLibres = actual
    ? await prisma.locker.findMany({
        where: {
          activo: true,
          deProfesor: null,
          asignaciones: { none: { periodoId: actual.periodo.id } },
        },
        orderBy: { numero: 'asc' },
        select: { id: true, numero: true },
      })
    : []

  const [sesionesAbiertas, descuentos] = await Promise.all([
    prisma.sesion.findMany({
      where: {
        activo: true,
        tipoCurso: { activo: true },
        temporada: {
          desde: { gte: new Date(`${anio}-01-01T00:00:00`) },
          hasta: { lte: new Date(`${anio}-12-31T23:59:59`) },
        },
      },
      include: { tipoCurso: true, horario: true },
      orderBy: [
        { tipoCurso: { nombre: 'asc' } },
        { horario: { horaInicio: 'asc' } },
        { diaSemana: 'asc' },
      ],
    }),
    prisma.descuento.findMany({ where: { activo: true }, orderBy: { nombre: 'asc' } }),
  ])

  // Cuántos van a cada renglón. Se cuentan inscripciones distintas y no
  // renglones: quien va lunes, miércoles y viernes es un alumno, no tres.
  const apuntados = await prisma.inscripcionSesion.findMany({
    where: { sesionId: { in: sesionesAbiertas.map((s) => s.id) } },
    select: { sesionId: true, inscripcionId: true },
  })

  /**
   * El curso a una hora, con todos sus días juntos.
   *
   * Al inscribir no se escoge día por día: se escoge el curso y la hora, y
   * el alumno queda apuntado a los días en que eso corre.
   */
  const porGrupo = new Map<string, {
    clave: string
    cursoHash: string
    cursoNombre: string
    horarioHash: string
    horario: string
    dias: number[]
    sesiones: string[]
    quienes: Set<string>
  }>()

  for (const s of sesionesAbiertas) {
    const clave = `${s.tipoCurso.hash}|${s.horario.hash}`
    const grupo = porGrupo.get(clave) ?? {
      clave,
      cursoHash: s.tipoCurso.hash,
      cursoNombre: s.tipoCurso.nombre,
      horarioHash: s.horario.hash,
      horario: `${s.horario.horaInicio}–${s.horario.horaFin}`,
      dias: [],
      sesiones: [],
      quienes: new Set<string>(),
    }
    grupo.dias.push(s.diaSemana)
    grupo.sesiones.push(s.hash)
    for (const a of apuntados) {
      if (a.sesionId === s.id) grupo.quienes.add(a.inscripcionId)
    }
    porGrupo.set(clave, grupo)
  }

  const grupos = [...porGrupo.values()].map((g) => ({
    clave: g.clave,
    cursoHash: g.cursoHash,
    cursoNombre: g.cursoNombre,
    horarioHash: g.horarioHash,
    horario: g.horario,
    dias: [...g.dias]
      .sort((a, b) => a - b)
      .map((n) => DIAS_SEMANA.find((d) => d.n === n)?.corto ?? '?')
      .join(', '),
    inscritos: g.quienes.size,
    sesiones: g.sesiones,
  }))

  return (
    <>
      <h1>Alumnos</h1>
      {pestanas}

      <div className="tarjeta">
        <h2>Dar de alta</h2>
        {ciclo ? (
          <FormularioAlumno
            grupos={grupos}
            descuentos={descuentos.map((d) => ({ hash: d.hash, nombre: conValor(d) }))}
            lockers={lockersLibres}
            precioLocker={actual ? pesos(actual.periodo.precioLocker) : ''}
          />
        ) : (
          <p className="silencio">
            No hay un ciclo abierto. Ábrelo antes de inscribir a nadie.
          </p>
        )}
      </div>

      <TablaAlumnos
        descuentos={descuentos.map((d) => ({ hash: d.hash, nombre: conValor(d) }))}
        renglones={inscripciones.map((i) => {
          // Quien lleva dos cursos debe dos cargos este mes: el semáforo
          // toma el peor de los dos.
          const cargo = i.cargos.find((c) => c.estado === 'VENCIDO') ?? i.cargos[0]

          return {
            id: i.id,
            folio: i.folio,
            nombre: i.alumno.nombreCompleto,
            anio: i.ciclo.anio,
            cursos: [...new Map(
              i.sesiones.map((s) => [s.sesion.tipoCursoId, s.sesion.tipoCurso.nombre]),
            ).values()],
            // La franja, sin los días: van implícitos en el curso, y
            // repetir la hora una vez por día llenaba la columna de ruido.
            horas: [...new Set(
              i.sesiones.map((s) => `${s.sesion.horario.horaInicio}–${s.sesion.horario.horaFin}`),
            )],
            descuento: i.descuento ? conValor(i.descuento) : null,
            locker: i.lockers[0]?.locker.numero ?? null,
            estado: cargo
              ? { etiqueta: ETIQUETA_ESTADO[cargo.estado], color: colorDeEstado(cargo.estado) }
              : null,
            cuantosCargos: i.cargos.length,
            factura: i.alumno.factura,
          }
        })}
      />

    </>
  )
}
