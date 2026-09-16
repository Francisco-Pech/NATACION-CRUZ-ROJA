import { prisma } from '@/lib/db'
import { requierePermiso } from '@/lib/sesion'
import { ZONA, anioEnCurso, mesEnCurso } from '@/lib/zona'
import { ETIQUETA_METODO } from '@/lib/metodos-pago'
import { ETIQUETA_PAGO } from '@/lib/estado-de-pago'
import { MetodoPago, EstadoPago } from '@prisma/client'
import type { Apuntado, Grupo } from '@/lib/estadisticas'
import Tablero, { type CargoDelTablero } from './Tablero'

const dos = (n: number) => String(n).padStart(2, '0')
const claveDeDia = (anio: number, mes: number, dia: number) => `${anio}-${dos(mes)}-${dos(dia)}`

/** El día de un pago, en Cancún: es con lo que se compara el rango. */
const DIA_EN_CANCUN = new Intl.DateTimeFormat('en-CA', {
  timeZone: ZONA,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

/**
 * El tablero de la escuela.
 *
 * Estadísticas para mirar, no un reporte: cuántos pagaron, cuánto ha entrado
 * y qué grupos están llenos. Nada de lo que hay aquí mueve un peso — para
 * eso están Alumnos y su ventana de mensualidades.
 *
 * Lleva los mismos seis filtros que Cobranza, y eso decide de qué cuelgan
 * las gráficas: del **pago**, no del cargo. Filtrar por forma de pago o por
 * estado solo tiene sentido sobre el dinero que entró.
 *
 * Los datos se traen en crudo y se agrupan en el navegador porque los
 * filtros mueven las tres gráficas a la vez: ir al servidor por cada cambio
 * de horario haría que la pantalla parpadeara en cada clic.
 */
export default async function Panel() {
  await requierePermiso('VER_PANEL')

  const [cargos, inscripciones, cursos, horarios, sesiones] = await Promise.all([
    prisma.cargo.findMany({
      include: {
        pagos: true,
        periodo: { select: { mes: true } },
        tipoCurso: { select: { nombre: true } },
        inscripcion: {
          select: {
            id: true,
            ciclo: { select: { anio: true } },
            sesiones: { include: { sesion: { include: { horario: true } } } },
          },
        },
      },
    }),
    prisma.inscripcion.findMany({
      where: { estado: 'ACTIVA' },
      select: {
        id: true,
        sesiones: {
          // Solo lo que sigue abierto: un horario apagado ya no se llena, y
          // dejarlo en la gráfica compite por la vista con los que sí.
          where: { sesion: { activo: true, horario: { activo: true }, tipoCurso: { activo: true } } },
          include: { sesion: { include: { horario: true, tipoCurso: true } } },
        },
      },
    }),
    prisma.tipoCurso.findMany({ where: { activo: true }, orderBy: { nombre: 'asc' } }),
    prisma.horario.findMany({ where: { activo: true }, orderBy: { horaInicio: 'asc' } }),
    // Los grupos abiertos salen de la rejilla, no de quién está apuntado: un
    // grupo vacío es el dato más útil de la gráfica, porque enseña dónde hay
    // lugar. Armándolo con los alumnos, ese grupo no existiría.
    prisma.sesion.findMany({
      where: { activo: true, horario: { activo: true }, tipoCurso: { activo: true } },
      select: {
        tipoCurso: { select: { nombre: true } },
        horario: { select: { horaInicio: true, horaFin: true } },
      },
    }),
  ])

  /** La franja del curso que cobra ese cargo, sin los días. */
  const franja = (
    sesiones: Array<{
      sesion: { tipoCursoId: string; horario: { horaInicio: string; horaFin: string } }
    }>,
    tipoCursoId: string,
  ) =>
    sesiones
      .filter((s) => s.sesion.tipoCursoId === tipoCursoId)
      .map((s) => `${s.sesion.horario.horaInicio}–${s.sesion.horario.horaFin}`)[0] ?? '—'

  const paraElTablero: CargoDelTablero[] = cargos.map((c) => ({
    anio: c.inscripcion.ciclo.anio,
    mes: c.periodo.mes,
    inscripcionId: c.inscripcion.id,
    curso: c.tipoCurso.nombre,
    horario: franja(c.inscripcion.sesiones, c.tipoCursoId),
    montoNeto: c.estado === 'CANCELADO' ? 0 : c.montoNeto,
    pagos: c.pagos.map((p) => ({
      dia: DIA_EN_CANCUN.format(p.fechaPago),
      metodo: ETIQUETA_METODO[p.metodo] ?? p.metodo,
      estado: ETIQUETA_PAGO[p.estado],
      monto: p.montoNeto,
    })),
  }))

  const apuntados: Apuntado[] = inscripciones.flatMap((i) =>
    i.sesiones.map((s) => ({
      inscripcionId: i.id,
      curso: s.sesion.tipoCurso.nombre,
      horario: `${s.sesion.horario.horaInicio}–${s.sesion.horario.horaFin}`,
    })),
  )

  // Un grupo es un curso a una hora. La rejilla trae una sesión por día, así
  // que lunes, miércoles y viernes de Adultos a las 6 son un solo grupo.
  const grupos: Grupo[] = [
    ...new Map(
      sesiones.map((s) => {
        const g = {
          curso: s.tipoCurso.nombre,
          horario: `${s.horario.horaInicio}–${s.horario.horaFin}`,
        }
        return [`${g.curso}|${g.horario}`, g] as const
      }),
    ).values(),
  ]

  const anio = anioEnCurso()
  const mes = mesEnCurso()
  // El día 0 del mes siguiente es el último de este, sin saberse cuántos
  // trae febrero.
  const ultimoDia = new Date(anio, mes, 0).getDate()

  return (
    <>
      <h1>Tablero</h1>
      <p className="silencio" style={{ marginTop: '-.4rem' }}>
        Cómo va la escuela. Es informativo: para cobrar, entra al alumno.
      </p>

      <Tablero
        cargos={paraElTablero}
        apuntados={apuntados}
        grupos={grupos}
        catalogos={{
          cursos: cursos.map((c) => c.nombre),
          horarios: horarios.map((h) => `${h.horaInicio}–${h.horaFin}`),
          metodos: Object.values(MetodoPago).map((m) => ETIQUETA_METODO[m] ?? m),
          estados: Object.values(EstadoPago).map((e) => ETIQUETA_PAGO[e]),
        }}
        desdeHoy={claveDeDia(anio, mes, 1)}
        hastaHoy={claveDeDia(anio, mes, ultimoDia)}
      />
    </>
  )
}
