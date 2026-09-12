import Link from 'next/link'
import { prisma } from '@/lib/db'
import Catalogo from '../catalogo/Catalogo'
import type { Campo, Filtro } from '../catalogo/tipos'
import { guardarDescuento, desactivarDescuento } from './acciones'

const enFormulario = (d: Date | null) =>
  d
    ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    : ''

const CAMPOS: Campo[] = [
  // Es el código que se le da a la gente para que lo pida. Se escribe al
  // crear y ya no se toca: un código que anda circulando en la calle no
  // puede cambiar de significado desde el panel.
  { nombre: 'clave', etiqueta: 'Código', tipo: 'texto', ancho: 150, fijo: true, placeholder: 'INAPAM' },
  { nombre: 'nombre', etiqueta: 'Nombre', tipo: 'texto', ancho: 200, placeholder: 'INAPAM' },
  {
    nombre: 'descripcion', etiqueta: 'Descripción', tipo: 'texto', ancho: 240,
    opcional: true, placeholder: 'A quién le toca',
  },
  {
    nombre: 'tipo', etiqueta: 'Tipo', tipo: 'lista', ancho: 160,
    opciones: [
      { valor: 'PORCENTAJE', etiqueta: 'Porcentaje' },
      { valor: 'MONTO_FIJO', etiqueta: 'Monto fijo' },
    ],
  },
  {
    nombre: 'valor', etiqueta: 'Valor', tipo: 'numero', ancho: 110,
    min: 1, max: 100_000, predeterminado: 10,
  },
  // Las tres opcionales: vacías quieren decir "sin límite", que es como
  // están todos los de hoy.
  { nombre: 'vigenciaDesde', etiqueta: 'Vale desde', tipo: 'fecha', ancho: 170, opcional: true },
  { nombre: 'vigenciaHasta', etiqueta: 'Vale hasta', tipo: 'fecha', ancho: 170, opcional: true },
  {
    nombre: 'limiteUsos', etiqueta: 'Cuántos', tipo: 'numero', ancho: 110,
    min: 1, max: 100_000, opcional: true, placeholder: 'Sin límite',
  },
  { nombre: 'activo', etiqueta: 'Activo', tipo: 'casilla', ancho: 90 },
]

const FILTROS: Filtro[] = [
  {
    nombre: 'tipo', etiqueta: 'Tipo',
    opciones: [
      { valor: 'PORCENTAJE', etiqueta: 'Porcentaje' },
      { valor: 'MONTO_FIJO', etiqueta: 'Monto fijo' },
    ],
  },
  {
    nombre: 'activo', etiqueta: 'Estado',
    opciones: [
      { valor: 'true', etiqueta: 'Activos' },
      { valor: 'false', etiqueta: 'Desactivados' },
    ],
  },
]

export default async function Descuentos() {
  const descuentos = await prisma.descuento.findMany({
    include: { _count: { select: { inscripciones: true } } },
    orderBy: [{ activo: 'desc' }, { nombre: 'asc' }],
  })

  const renglones = descuentos.map((d) => ({
    hash: d.hash,
    // Nunca se borra: una inscripción que lo lleva lo sigue nombrando, y sin
    // él un estado de cuenta viejo no podría explicar por qué se cobró menos.
    soloDesactivar: true,
    valores: {
      clave: d.clave,
      nombre: d.nombre,
      descripcion: d.descripcion ?? '',
      tipo: d.tipo,
      // En monto fijo se guarda en centavos y se captura en pesos.
      valor: d.tipo === 'PORCENTAJE' ? d.valor : Math.round(d.valor / 100),
      vigenciaDesde: enFormulario(d.vigenciaDesde),
      vigenciaHasta: enFormulario(d.vigenciaHasta),
      limiteUsos: d.limiteUsos ?? '',
      activo: d.activo,
    },
  }))

  const enUso = descuentos.filter((d) => d._count.inscripciones > 0).length

  return (
    <>
      <nav className="subbarra">
        <Link href="/panel/admin">← Panel de control</Link>
      </nav>

      <h1>Descuentos</h1>
      <p className="silencio">
        Lo que se le puede rebajar a una inscripción. Se escoge al dar de alta al
        alumno, y se aplica sobre el costo del curso.
      </p>

      <Catalogo
        campos={CAMPOS}
        renglones={renglones}
        filtros={FILTROS}
        guardar={guardarDescuento}
        eliminar={desactivarDescuento}
        tituloAlta="Agregar un descuento"
        botonAlta="Agregar"
        vacio="Todavía no hay ningún descuento."
      />

      <p className="silencio" style={{ fontSize: '.85rem' }}>
        En <strong>Porcentaje</strong> el valor va de 1 a 100 y se rebaja esa parte del
        costo; un 100 deja la mensualidad en cero. En <strong>Monto fijo</strong> el valor
        se captura en pesos enteros y se rebaja tal cual.
        Un descuento <strong>no se borra, solo se desactiva</strong>: las inscripciones
        que lo llevan lo siguen nombrando, y sin él un estado de cuenta viejo no podría
        explicar por qué se cobró de menos. Desactivado deja de ofrecerse al inscribir.
        {enUso > 0 && <> Hoy hay <strong>{enUso}</strong> en uso.</>}
      </p>
    </>
  )
}
