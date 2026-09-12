import Link from 'next/link'
import { prisma } from '@/lib/db'
import Catalogo from '../catalogo/Catalogo'
import type { Campo, Filtro } from '../catalogo/tipos'
import { guardarSesion, desactivarSesion } from './acciones'

/** Lunes primero, como los lee la gente: domingo es 0 en el calendario. */
const deLunesADomingo = (n: number) => (n + 6) % 7

const corto = (d: Date) =>
  d.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' }).replace('.', '')

/**
 * Cómo se lee una temporada en el selector.
 *
 * El año siempre va. Sin él, dos temporadas del mismo curso capturadas en
 * años distintos se leen idénticas y no hay manera de saber cuál se está
 * escogiendo.
 */
function comoSeLee(t: { desde: Date; hasta: Date; tipoCurso: { nombre: string } }) {
  const aniosDistintos = t.hasta.getFullYear() > t.desde.getFullYear()
  const tramo = aniosDistintos
    ? `${corto(t.desde)} ${t.desde.getFullYear()} a ${corto(t.hasta)} ${t.hasta.getFullYear()}`
    : `${corto(t.desde)} a ${corto(t.hasta)} ${t.desde.getFullYear()}`
  return `${t.tipoCurso.nombre} · ${tramo}`
}

export default async function DiasYHorarios() {
  const [temporadas, franjas] = await Promise.all([
    prisma.temporadaCurso.findMany({
      where: { tipoCurso: { activo: true } },
      include: { tipoCurso: true },
      orderBy: [{ tipoCurso: { nombre: 'asc' } }, { desde: 'asc' }],
    }),
    prisma.franjaLaboral.findMany({
      where: { activo: true, diaSemana: { activo: true }, horario: { activo: true } },
      include: { diaSemana: true, horario: true },
    }),
  ])

  const ordenadas = [...franjas].sort(
    (a, b) =>
      deLunesADomingo(a.diaSemana.numero) - deLunesADomingo(b.diaSemana.numero) ||
      a.horario.horaInicio.localeCompare(b.horario.horaInicio),
  )

  const CAMPOS: Campo[] = [
    {
      nombre: 'temporada', etiqueta: 'Fechas por curso', tipo: 'lista', ancho: 260,
      opciones: temporadas.map((t) => ({ valor: t.hash, etiqueta: comoSeLee(t) })),
    },
    {
      nombre: 'franja', etiqueta: 'Día laboral', tipo: 'lista', ancho: 220,
      opciones: ordenadas.map((f) => ({
        valor: f.hash,
        etiqueta: `${f.diaSemana.nombre} ${f.horario.horaInicio}–${f.horario.horaFin}`,
      })),
    },
    // Llegan escritos: casi siempre valen esto y solo se cambian cuando la
    // franja de verdad acepta otra cosa.
    {
      nombre: 'cupoMaximo', etiqueta: 'Cupo', tipo: 'numero', ancho: 100,
      min: 1, max: 999, predeterminado: 35,
    },
    {
      nombre: 'extras', etiqueta: 'Extras', tipo: 'numero', ancho: 100,
      min: 0, max: 999, opcional: true, predeterminado: 10,
    },
    {
      nombre: 'descripcion', etiqueta: 'Descripción', tipo: 'texto', ancho: 200,
      opcional: true, placeholder: 'Nota para ustedes',
    },
    { nombre: 'activo', etiqueta: 'Activo', tipo: 'casilla', ancho: 90 },
  ]

  // Los cuatro salen de lo que existe, no de una lista escrita a mano: si
  // se cierra un horario, deja de ofrecerse aquí solo.
  const cursos = [...new Map(temporadas.map((t) => [t.tipoCurso.id, t.tipoCurso])).values()]
  const horas = [...new Map(ordenadas.map((f) => [f.horario.hash, f.horario])).values()]
    .sort((a, b) => a.horaInicio.localeCompare(b.horaInicio))
  const dias = [...new Map(ordenadas.map((f) => [f.diaSemana.numero, f.diaSemana])).values()]
    .sort((a, b) => deLunesADomingo(a.numero) - deLunesADomingo(b.numero))

  const FILTROS: Filtro[] = [
    {
      nombre: 'horario', etiqueta: 'Horario',
      opciones: horas.map((h) => ({
        valor: h.hash, etiqueta: `${h.horaInicio}–${h.horaFin}`,
      })),
    },
    {
      nombre: 'dia', etiqueta: 'Día',
      opciones: dias.map((d) => ({ valor: String(d.numero), etiqueta: d.nombre })),
    },
    {
      nombre: 'curso', etiqueta: 'Curso',
      opciones: cursos.map((c) => ({ valor: c.hash, etiqueta: c.nombre })),
    },
    {
      nombre: 'activo', etiqueta: 'Estado',
      opciones: [
        { valor: 'true', etiqueta: 'Activos' },
        { valor: 'false', etiqueta: 'Desactivados' },
      ],
    },
  ]

  const sesiones = await prisma.sesion.findMany({
    include: {
      tipoCurso: true, horario: true, temporada: true, franja: true,
    },
    orderBy: [{ tipoCurso: { nombre: 'asc' } }, { diaSemana: 'asc' }, { horario: { horaInicio: 'asc' } }],
  })

  const renglones = sesiones.map((s) => ({
    hash: s.hash,
    // Nunca se borra, solo se apaga: sus inscritos y sus cargos lo siguen
    // nombrando, y con el renglón fuera nadie podría reconstruir quién iba
    // ese día a esa hora.
    soloDesactivar: true,
    valores: {
      temporada: s.temporada?.hash ?? '',
      franja: s.franja?.hash ?? '',
      cupoMaximo: s.cupoMaximo,
      extras: s.extras,
      descripcion: s.descripcion ?? '',
      activo: s.activo,
    },
    // El renglón enseña la temporada y la franja; se filtra por el curso, el
    // día y la hora, que van adentro de esas dos.
    filtros: {
      horario: s.horario.hash,
      dia: String(s.diaSemana),
      curso: s.tipoCurso.hash,
    },
  }))

  return (
    <>
      <nav className="subbarra">
        <Link href="/panel/admin">← Panel de control</Link>
      </nav>

      <h1>Días y horarios por curso</h1>
      <p className="silencio">
        Qué curso corre en qué día y horario, y para cuántos. Se arma cruzando{' '}
        <Link href="/panel/admin/temporadas">Fechas por curso</Link> con{' '}
        <Link href="/panel/admin/dias-laborales">Días laborales</Link>: aquí solo se
        puede escoger lo que exista en esas dos pantallas.
      </p>

      {(temporadas.length === 0 || franjas.length === 0) && (
        <div className="aviso">
          {temporadas.length === 0 ? (
            <>
              Todavía no hay fechas capturadas. Ponlas primero en{' '}
              <Link href="/panel/admin/temporadas">Fechas por curso</Link>.
            </>
          ) : (
            <>
              Todavía no hay días laborales. Ábrelos primero en{' '}
              <Link href="/panel/admin/dias-laborales">Días laborales</Link>.
            </>
          )}
        </div>
      )}

      <Catalogo
        campos={CAMPOS}
        renglones={renglones}
        guardar={guardarSesion}
        eliminar={desactivarSesion}
        filtros={FILTROS}
        tituloAlta="Agregar un día y horario"
        botonAlta="Agregar"
        vacio="Todavía no hay ningún día y horario capturado."
      />

      <p className="silencio" style={{ fontSize: '.85rem' }}>
        El <strong>cupo</strong> es cuántos alumnos acepta esa clase, y se cuenta al
        inscribir: pasado el tope el sistema ya no deja. Los <strong>extras</strong> son
        tolerancia sobre el cupo — del cupo a cupo más extras se sigue pudiendo
        inscribir, pero avisando que va de más. En cero, el cupo es una pared.
        Un renglón <strong>no se borra, solo se desactiva</strong>: sus inscritos y sus
        cargos lo siguen nombrando, y sin él nadie podría reconstruir quién iba ese día
        a esa hora. Desactivado deja de ofrecerse al inscribir.
      </p>
    </>
  )
}
