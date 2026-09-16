import Link from 'next/link'
import { prisma } from '@/lib/db'
import Catalogo from '../catalogo/Catalogo'
import type { Campo } from '../catalogo/tipos'
import { guardarTipoCurso, eliminarTipoCurso } from '../catalogos'

const CAMPOS: Campo[] = [
  { nombre: 'nombre', etiqueta: 'Nombre', tipo: 'texto', ancho: 240, placeholder: 'Acondicionamiento' },
  { nombre: 'descripcion', etiqueta: 'Descripción', tipo: 'texto', opcional: true, placeholder: 'Para qué es este curso' },
  {
    nombre: 'modoFecha', etiqueta: 'Repetición', tipo: 'lista', ancho: 160,
    opciones: [
      { valor: 'RECURRENTE', etiqueta: 'Recurrente' },
      { valor: 'UNICO', etiqueta: 'Único' },
      { valor: 'MIXTO', etiqueta: 'Mixto' },
    ],
  },
  // Vacío quiere decir sin tope, como estuvo el sistema hasta hoy.
  {
    nombre: 'maxMeses', etiqueta: 'Máx. meses', tipo: 'numero', ancho: 120,
    min: 1, max: 120, opcional: true, predeterminado: 3, placeholder: 'Sin tope',
  },
  { nombre: 'activo', etiqueta: 'Activo', tipo: 'casilla', ancho: 90 },
]

export default async function TiposDeCurso() {
  const cursos = await prisma.tipoCurso.findMany({
    orderBy: [{ activo: 'desc' }, { nombre: 'asc' }],
  })

  return (
    <>
      <nav className="subbarra">
        <Link href="/panel/admin">← Panel de control</Link>
      </nav>

      <h1>Tipo de Curso</h1>
      <p className="silencio">Los cursos que ofrece la escuela.</p>

      <Catalogo
        campos={CAMPOS}
        guardar={guardarTipoCurso}
        eliminar={eliminarTipoCurso}
        tituloAlta="Crear un curso"
        botonAlta="Crear"
        vacio="Ninguno todavía."
        renglones={cursos.map((c) => ({
          hash: c.hash,
          // Un curso nunca se borra: el botón solo desactiva.
          soloDesactivar: true,
          valores: {
            nombre: c.nombre,
            descripcion: c.descripcion ?? '',
            modoFecha: c.modoFecha,
            maxMeses: c.maxMeses ?? '',
            activo: c.activo,
          },
        }))}
      />

      <p className="silencio" style={{ fontSize: '.82rem' }}>
        El <strong>Nombre</strong> es lo que ve el alumno en su estado de cuenta, y se
        puede cambiar cuando quieras. La <strong>Descripción</strong> es una nota para
        ustedes: el alumno no la ve. <strong>Repetición</strong> dice si el curso vuelve cada año o no:
        <strong> Recurrente</strong> para los de siempre, <strong>Único</strong> para algo
        que se abre una sola vez —una competencia, un curso intensivo de verano— y
        <strong> Mixto</strong> para los que se abren varias veces al año. Las fechas en sí
        se capturan en <Link href="/panel/admin/temporadas">Fechas por curso</Link>.
        <strong> Máx. meses</strong> es cuántos meses se le cobra el curso a un alumno:
        con 3, después de su tercer mes ya no se le generan cargos de este curso, aunque
        siga corriendo en el calendario. Se cuenta sobre todo lo que esa persona haya
        pagado del curso, de cualquier año, y los meses cancelados no gastan. Déjalo en
        blanco para los cursos que se cobran mientras el alumno siga viniendo.
        <strong> Activo</strong> es si el curso se ofrece hoy: uno
        desactivado deja de aparecer al inscribir, al agendar y al cobrar, pero conserva
        todo su historial. Un curso <strong>nunca se borra</strong>, solo se desactiva —
        sus cargos y sus inscritos lo nombran—. Y al desactivarlo su nombre queda libre,
        por si quieren crear otro que lo reemplace.
      </p>
    </>
  )
}
