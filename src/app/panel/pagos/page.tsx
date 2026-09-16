import { prisma } from '@/lib/db'
import { requierePermiso } from '@/lib/sesion'
import { ETIQUETA_METODO } from '@/lib/metodos-pago'
import { ETIQUETA_PAGO, colorDePago } from '@/lib/estado-de-pago'
import { MetodoPago, EstadoPago } from '@prisma/client'
import { ZONA, anioEnCurso, mesEnCurso } from '@/lib/zona'
import TablaPagos, { type RenglonPago } from './TablaPagos'

const dos = (n: number) => String(n).padStart(2, '0')

/** "2026-09-15": el día con el que se compara el rango del filtro. */
const claveDeDia = (anio: number, mes: number, dia: number) => `${anio}-${dos(mes)}-${dos(dia)}`

/** El día y la hora como se leen en Cancún, no como los guarda la base. */
const EN_CANCUN = new Intl.DateTimeFormat('es-MX', {
  timeZone: ZONA,
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
})

/** El día de una fecha, en Cancún: "2026-09-15". */
const DIA_EN_CANCUN = new Intl.DateTimeFormat('en-CA', {
  timeZone: ZONA,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

/**
 * El historial de pagos.
 *
 * Solo para verlo: qué entró, de quién, cuándo y con qué. No se cobra ni se
 * corrige desde aquí —eso vive en la ventana de mensualidades del alumno,
 * donde se ve qué mes se está tocando—, así que esta pantalla no trae un
 * solo botón que mueva dinero.
 *
 * Todo el mes se cuenta en hora de Cancún. Un cobro de las 9 de la noche del
 * 30 de septiembre es del 1 de octubre en UTC, y quien cierra el mes en la
 * ventanilla no encontraría su propio cobro.
 */
export default async function Pagos() {
  await requierePermiso('COBRAR')

  // El mes que corre, en Cancún: es donde abre el rango. El día 0 del mes
  // siguiente es el último de este, sin tener que saberse cuántos trae
  // febrero.
  const anio = anioEnCurso()
  const mes = mesEnCurso()
  const ultimoDia = new Date(anio, mes, 0).getDate()

  // Los filtros se arman del catálogo, no de los pagos que haya: quien
  // revisa el historial necesita poder preguntar "¿entró algo con tarjeta?"
  // y que el sistema conteste que no.
  const [cursos, horarios] = await Promise.all([
    prisma.tipoCurso.findMany({ where: { activo: true }, orderBy: { nombre: 'asc' } }),
    prisma.horario.findMany({ orderBy: { horaInicio: 'asc' } }),
  ])

  const catalogos = {
    cursos: cursos.map((c) => c.nombre),
    horarios: horarios.map((h) => `${h.horaInicio}–${h.horaFin}`),
    metodos: Object.values(MetodoPago).map((m) => ETIQUETA_METODO[m] ?? m),
    estados: Object.values(EstadoPago).map((e) => ETIQUETA_PAGO[e]),
  }

  const pagos = await prisma.pago.findMany({
    include: {
      registradoPor: { select: { nombre: true } },
      cargo: {
        include: {
          tipoCurso: { select: { nombre: true } },
          inscripcion: {
            include: {
              alumno: { select: { nombreCompleto: true } },
              sesiones: { include: { sesion: { include: { horario: true } } } },
            },
          },
        },
      },
    },
    orderBy: { fechaPago: 'desc' },
  })

  const renglones: RenglonPago[] = pagos.map((p) => {
    // La franja, sin los días: van implícitos en el curso, y repetir la hora
    // una vez por día llenaría la columna de ruido.
    const horas = [
      ...new Set(
        p.cargo.inscripcion.sesiones
          .filter((s) => s.sesion.tipoCursoId === p.cargo.tipoCursoId)
          .map((s) => `${s.sesion.horario.horaInicio}–${s.sesion.horario.horaFin}`),
      ),
    ]

    return {
      id: p.id,
      fecha: EN_CANCUN.format(p.fechaPago),
      dia: DIA_EN_CANCUN.format(p.fechaPago),
      alumno: p.cargo.inscripcion.alumno.nombreCompleto,
      folio: p.cargo.inscripcion.folio,
      curso: p.cargo.tipoCurso.nombre,
      horario: horas.length === 0 ? '—' : horas.join(', '),
      metodo: ETIQUETA_METODO[p.metodo] ?? p.metodo,
      estado: ETIQUETA_PAGO[p.estado],
      color: colorDePago(p.estado),
      monto: p.montoCobrado,
      quien: p.registradoPor?.nombre ?? null,
    }
  })

  return (
    <>
      <h1>Pagos</h1>
      <p className="silencio" style={{ marginTop: '-.4rem' }}>
        El historial de lo que ha entrado. Abre en el mes que corre; para cobrar o corregir,
        entra al alumno.
      </p>

      <TablaPagos
        renglones={renglones}
        catalogos={catalogos}
        desdeHoy={claveDeDia(anio, mes, 1)}
        hastaHoy={claveDeDia(anio, mes, ultimoDia)}
      />
    </>
  )
}
