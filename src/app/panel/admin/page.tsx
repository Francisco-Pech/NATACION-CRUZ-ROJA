import Link from 'next/link'

/**
 * Panel de control. Es solo un índice: cada tarjeta lleva a su propia
 * pantalla. No se configura nada aquí.
 *
 * Va en grupos porque una lista de doce tarjetas iguales no se lee: hay que
 * recorrerla entera para hallar una. Los grupos siguen el orden en que se
 * llena el sistema — primero lo que existe, luego cuándo, luego cuánto
 * cuesta, y al final quién entra.
 *
 * El acceso ya está resuelto en el layout de esta sección: solo entran
 * Administrador y Root.
 */
const GRUPOS: Array<{
  titulo: string
  detalle: string
  secciones: Array<{ href: string; titulo: string; detalle: string }>
}> = [
  {
    titulo: 'Qué se ofrece',
    detalle: 'Los catálogos base. Casi nunca cambian.',
    secciones: [
      {
        href: '/panel/admin/cursos',
        titulo: 'Tipo de Curso',
        detalle: 'Los cursos que ofrece la escuela.',
      },
      {
        href: '/panel/admin/dias',
        titulo: 'Días',
        detalle: 'Los días de la semana que existen.',
      },
      {
        href: '/panel/admin/horarios',
        titulo: 'Horarios',
        detalle: 'Las franjas horarias que existen, se ocupen o no.',
      },
    ],
  },
  {
    titulo: 'Cuándo se da',
    detalle: 'El calendario de la escuela: qué corre, qué días y a qué hora.',
    secciones: [
      {
        href: '/panel/admin/temporadas',
        titulo: 'Fechas por curso',
        detalle: 'Entre qué fechas corre cada curso. Fuera de temporada no se cobra.',
      },
      {
        href: '/panel/admin/dias-laborales',
        titulo: 'Días laborales',
        detalle: 'Qué días abre la alberca y en qué horario.',
      },
      {
        href: '/panel/admin/rejilla',
        titulo: 'Días y horarios por curso',
        detalle: 'Qué curso corre en qué día y horario, con su cupo.',
      },
      {
        href: '/panel/admin/calendario',
        titulo: 'Días inhábiles',
        detalle: 'Festivos, periodos vacacionales y excepciones.',
      },
    ],
  },
  {
    titulo: 'Cuánto cuesta',
    detalle: 'El dinero. Cambiarlo no altera lo ya cobrado.',
    secciones: [
      {
        href: '/panel/admin/tipos-pago',
        titulo: 'Tipo de Pago',
        detalle: 'Si el cobro se hace una sola vez o se repite.',
      },
      {
        href: '/panel/admin/recurrencias',
        titulo: 'Recurrencia de Pago',
        detalle: 'Cada cuánto se repite un cobro: mensual, trimestral, anual.',
      },
      {
        href: '/panel/admin/tarifas',
        titulo: 'Costos y comisiones',
        detalle: 'Precio de cada curso, forma de cobro y comisiones del cobro en línea.',
      },
      {
        href: '/panel/admin/descuentos',
        titulo: 'Descuentos',
        detalle: 'Lo que se le puede rebajar a una inscripción.',
      },
    ],
  },
  {
    titulo: 'Quién entra',
    detalle: 'El acceso al sistema.',
    secciones: [
      {
        href: '/panel/admin/roles',
        titulo: 'Roles',
        detalle: 'Qué puede hacer cada grupo de personas. Se crean los que hagan falta.',
      },
      {
        href: '/panel/admin/usuarios',
        titulo: 'Usuarios',
        detalle: 'Quién tiene acceso al sistema y con qué rol.',
      },
    ],
  },
]

export default function PanelDeControl() {
  return (
    <>
      <h1>Panel de control</h1>
      <p className="silencio">
        La configuración de la escuela. Solo el Administrador y Root ven esta sección.
      </p>

      {GRUPOS.map((g) => (
        <section className="grupo-panel" key={g.titulo}>
          <div className="grupo-titulo">
            <h2>{g.titulo}</h2>
            <p className="silencio">{g.detalle}</p>
          </div>

          <div className="rejilla">
            {g.secciones.map((s) => (
              <Link key={s.href} href={s.href} className="tarjeta tarjeta-enlace">
                <strong>{s.titulo}</strong>
                <span className="silencio" style={{ fontSize: '.85rem' }}>{s.detalle}</span>
              </Link>
            ))}
          </div>
        </section>
      ))}
    </>
  )
}
