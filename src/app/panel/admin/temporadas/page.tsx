import Link from 'next/link'
import { prisma } from '@/lib/db'
import { cursoCorreEnElMes, type ModoFecha } from '@/lib/temporadas'
import Catalogo from '../catalogo/Catalogo'
import type { Campo } from '../catalogo/tipos'
import { guardarTemporada, eliminarTemporada } from './acciones'

/** Una letra por mes: la tira tiene que caber en un renglón de tabla. */
const MODO: Record<ModoFecha, string> = {
  RECURRENTE: 'Recurrente',
  UNICO: 'Único',
  MIXTO: 'Mixto',
}

const MESES = ['E', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D']
const NOMBRE_MES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
]

const enFormulario = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

export default async function Temporadas() {
  const anio = new Date().getFullYear()
  const cursos = await prisma.tipoCurso.findMany({
    where: { activo: true },
    orderBy: { nombre: 'asc' },
    include: { temporadas: { orderBy: { desde: 'asc' } } },
  })

  const opciones = cursos.map((c) => ({ valor: c.hash, etiqueta: c.nombre }))

  const CAMPOS: Campo[] = [
    { nombre: 'curso', etiqueta: 'Curso', tipo: 'lista', ancho: 190, opciones },
    // Se decide aquí, al crear y al editar: si no, habría que dar de alta la
    // temporada y luego ir a otra pantalla a cambiarle el modo al curso, que
    // es la misma decisión partida en dos pasos. Es del curso, no de la
    // temporada, así que moverlo en un renglón mueve todos los de ese curso.
    {
      nombre: 'modoFecha', etiqueta: 'Repetición', tipo: 'lista', ancho: 160,
      opciones: [
        { valor: 'RECURRENTE', etiqueta: 'Recurrente' },
        { valor: 'UNICO', etiqueta: 'Único' },
        { valor: 'MIXTO', etiqueta: 'Mixto' },
      ],
    },
    {
      nombre: 'nombre', etiqueta: 'Temporada', tipo: 'texto', ancho: 200,
      opcional: true, placeholder: 'Verano (opcional)',
    },
    { nombre: 'desde', etiqueta: 'Desde', tipo: 'fecha', ancho: 170 },
    { nombre: 'hasta', etiqueta: 'Hasta', tipo: 'fecha', ancho: 170 },
  ]

  // Todas las temporadas en una sola lista, no una tabla por curso.
  const renglones = cursos.flatMap((c) =>
    c.temporadas.map((t) => ({
      hash: t.hash,
      soloDesactivar: false,
      valores: {
        curso: c.hash,
        modoFecha: c.modoFecha,
        nombre: t.nombre ?? '',
        desde: enFormulario(t.desde),
        hasta: enFormulario(t.hasta),
      },
    })),
  )

  return (
    <>
      <nav className="subbarra">
        <Link href="/panel/admin">← Panel de control</Link>
      </nav>

      <h1>Fechas por curso</h1>
      <p className="silencio">
        Cuándo corre cada curso a lo largo del año. A un curso fuera de temporada{' '}
        <strong>no se le genera cobro</strong> ese mes. Cómo se repite se escoge en{' '}
        <Link href="/panel/admin/cursos">Tipo de Curso</Link> o en la tabla de abajo.
        Esta de aquí es solo para ver. Solo salen los cursos habilitados.
      </p>

      <div className="tarjeta">
        <h2>En qué meses corre cada curso</h2>
        <div className="tabla-ancha">
          <table>
            <thead>
              <tr>
                <th style={{ width: 200 }}>Curso</th>
                <th style={{ width: 170 }}>Repetición</th>
                <th>Meses de {anio}</th>
              </tr>
            </thead>
            <tbody>
              {cursos.map((c) => {
                const modo = c.modoFecha as ModoFecha
                return (
                  <tr key={c.hash}>
                    <td>{c.nombre}</td>
                    <td className="silencio" style={{ fontSize: '.85rem' }}>{MODO[modo]}</td>
                    <td>
                      <div className="tira-meses">
                        {MESES.map((letra, i) => {
                          const corre = cursoCorreEnElMes(anio, i + 1, c.temporadas, modo)
                          return (
                            <span
                              key={i}
                              className={`mes ${corre ? 'si' : 'no'}`}
                              title={`${NOMBRE_MES[i]}: ${corre ? 'corre' : 'no corre'}`}
                            >
                              {letra}
                            </span>
                          )
                        })}
                        {c.temporadas.length === 0 && (
                          <span className="insignia AMARILLO" style={{ marginLeft: '.4rem' }}>
                            sin fechas · corre todo el año
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <p className="silencio" style={{ fontSize: '.82rem', margin: '.7rem 0 0' }}>
          Un curso <strong>sin fechas capturadas corre todos los meses</strong>: lo que
          nadie ha definido no debe dejar de cobrarse de golpe.
        </p>
      </div>

      <Catalogo
        campos={CAMPOS}
        guardar={guardarTemporada}
        eliminar={eliminarTemporada}
        tituloAlta="Agregar una temporada"
        botonAlta="Agregar"
        vacio="Ninguna temporada capturada."
        renglones={renglones}
      />

      <p className="silencio" style={{ fontSize: '.82rem' }}>
        <strong>Temporada</strong> es una nota opcional —"Verano",
        "Certificación"—: lo que identifica a una temporada son sus fechas, y la
        repetición ya dice de qué clase es.{' '}
        <strong>Repetición</strong> es del curso, no de la temporada: cambiarla en un
        renglón la cambia para todas las temporadas de ese curso.
        En <strong>Recurrente</strong> y <strong>Mixto</strong> el año que captures da
        igual: lo que cuenta es el día y el mes, porque se repiten. En{' '}
        <strong>Único</strong> el año sí manda. Una temporada puede cruzar el fin de año
        —de diciembre a enero— y se cuenta bien. Borrar una es de Root, porque cambia a
        quién se le cobra.
      </p>
    </>
  )
}
