import Link from 'next/link'
import { prisma } from '@/lib/db'
import { leerSesion } from '@/lib/sesion'
import { esRoot } from '@/lib/roles'
import { pesos } from '@/lib/formato'
import {
  calcularTotalConComision, comisionesDelEntorno, type MetodoConComision,
} from '@/lib/comisiones'
import { ETIQUETA_METODO } from '@/lib/metodos-pago'
import Catalogo from '../catalogo/Catalogo'
import type { Campo, Filtro } from '../catalogo/tipos'
import { guardarTarifa, eliminarTarifa, guardarCosto, eliminarCosto } from './acciones'

/**
 * Los costos, en tres pestañas.
 *
 * Cada monto trae el tramo de fechas en el que rige: el curso que hoy cuesta
 * 770 el año que entra costará otra cosa, y las dos cifras tienen que poder
 * convivir. Cambiar un precio no altera lo ya cobrado — `Cargo` guarda los
 * montos calculados al generarse.
 */

const PESTANAS = [
  { clave: 'cursos', titulo: 'Costo de los cursos' },
  { clave: 'otros', titulo: 'Locker y recargo' },
] as const

/**
 * Qué acabaría pagando el alumno por cada método, sobre ese monto.
 *
 * Va en un globo y no en columnas: son tres cifras más por renglón y la
 * tabla ya es ancha. Se calcula al revés —de lo que la delegación debe
 * recibir hacia lo que hay que cobrar— para que la comisión no salga del
 * neto de la escuela.
 */
function conComision(neto: number): string {
  const porMetodo = comisionesDelEntorno()
  const enLinea: MetodoConComision[] = ['TARJETA', 'SPEI', 'OXXO']

  const lineas = enLinea
    .filter((m) => porMetodo[m].activo)
    .map((m) => {
      const { total, comision } = calcularTotalConComision(neto, porMetodo[m])
      return `${ETIQUETA_METODO[m] ?? m}: ${pesos(total)}  (+${pesos(comision)})`
    })

  return [
    `En caja se cobran ${pesos(neto)}.`,
    'Cobrando en línea, para que la escuela reciba eso mismo:',
    ...lineas,
    '',
    'Calculado con la comisión que rige hoy. Si cambia el contrato con la',
    'pasarela, estas cifras cambian — pero lo ya cobrado no se toca: cada',
    'pago guarda sus montos del día en que se hizo.',
  ].join('\n')
}

const enFormulario = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

export default async function Costos({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>
}) {
  const pedido = await searchParams
  const cual = PESTANAS.some((p) => p.clave === pedido.tab) ? pedido.tab! : 'cursos'

  const soyRoot = esRoot(await leerSesion())

  const [cursos, tiposPago, frecuencias, tarifas, costos] = await Promise.all([
    prisma.tipoCurso.findMany({ where: { activo: true }, orderBy: { nombre: 'asc' } }),
    prisma.tipoPago.findMany({ where: { activo: true }, orderBy: { clave: 'asc' } }),
    prisma.frecuenciaPago.findMany({ where: { activo: true }, orderBy: { meses: 'asc' } }),
    prisma.tarifa.findMany({
      include: { tipoCurso: true, tipoPago: true, frecuencia: true },
      orderBy: [{ vigenciaDesde: 'desc' }, { tipoCurso: { nombre: 'asc' } }],
    }),
    prisma.costo.findMany({ orderBy: [{ concepto: 'asc' }, { vigenciaDesde: 'desc' }] }),
  ])

  const CAMPOS_CURSO: Campo[] = [
    {
      nombre: 'curso', etiqueta: 'Curso', tipo: 'lista', ancho: 190,
      opciones: cursos.map((c) => ({ valor: c.hash, etiqueta: c.nombre })),
    },
    {
      nombre: 'tipoPago', etiqueta: 'Forma de cobro', tipo: 'lista', ancho: 170,
      opciones: tiposPago.map((t) => ({ valor: t.hash, etiqueta: t.nombre })),
    },
    {
      nombre: 'frecuencia', etiqueta: 'Cada cuánto', tipo: 'lista', ancho: 160,
      opcional: true,
      opciones: [
        { valor: '', etiqueta: '— solo pago único' },
        ...frecuencias.map((f) => ({ valor: f.hash, etiqueta: f.nombre })),
      ],
    },
    { nombre: 'vigenciaDesde', etiqueta: 'Rige desde', tipo: 'fecha', ancho: 170 },
    { nombre: 'vigenciaHasta', etiqueta: 'Rige hasta', tipo: 'fecha', ancho: 170 },
    {
      nombre: 'monto', etiqueta: 'Precio', tipo: 'numero', ancho: 120,
      min: 1, max: 5000, predeterminado: 770,
    },
  ]

  const CAMPOS_COSTO: Campo[] = [
    {
      nombre: 'concepto', etiqueta: 'Concepto', tipo: 'lista', ancho: 220,
      opciones: [
        { valor: 'LOCKER', etiqueta: 'Locker (por mes)' },
        { valor: 'RECARGO', etiqueta: 'Recargo por pagar tarde' },
      ],
    },
    { nombre: 'vigenciaDesde', etiqueta: 'Rige desde', tipo: 'fecha', ancho: 170 },
    { nombre: 'vigenciaHasta', etiqueta: 'Rige hasta', tipo: 'fecha', ancho: 170 },
    {
      nombre: 'monto', etiqueta: 'Monto', tipo: 'numero', ancho: 120,
      min: 1, max: 5000, predeterminado: 100,
    },
  ]

  const FILTROS_CURSO: Filtro[] = [
    {
      nombre: 'curso', etiqueta: 'Curso',
      opciones: cursos.map((c) => ({ valor: c.hash, etiqueta: c.nombre })),
    },
    {
      nombre: 'anio', etiqueta: 'Año',
      opciones: [...new Set(tarifas.map((t) => t.vigenciaDesde.getFullYear()))]
        .sort((a, b) => b - a)
        .map((a) => ({ valor: String(a), etiqueta: String(a) })),
    },
  ]

  return (
    <>
      <nav className="subbarra">
        <Link href="/panel/admin">← Panel de control</Link>
      </nav>

      <h1>Costos y comisiones</h1>
      <p className="silencio">
        Cuánto cuesta cada cosa y desde cuándo. Cambiar un precio{' '}
        <strong>no altera lo ya cobrado</strong>: cada cargo guarda los montos con los que
        se generó. Los descuentos viven en{' '}
        <Link href="/panel/admin/descuentos">su propia pantalla</Link>.
      </p>

      {!soyRoot && (
        <div className="aviso">
          Solo <strong>Root</strong> puede mover precios. Aquí puedes verlos.
        </div>
      )}

      <nav className="pestanas no-imprimir">
        {PESTANAS.map((p) => (
          <Link
            key={p.clave}
            href={`/panel/admin/tarifas?tab=${p.clave}`}
            className={`pestana${cual === p.clave ? ' activa' : ''}`}
          >
            {p.titulo}
          </Link>
        ))}
      </nav>

      {cual === 'cursos' && (
        <>
          <Catalogo
            campos={CAMPOS_CURSO}
            filtros={FILTROS_CURSO}
            renglones={tarifas.map((t) => ({
              hash: t.hash,
              soloDesactivar: false,
              valores: {
                curso: t.tipoCurso.hash,
                tipoPago: t.tipoPago.hash,
                frecuencia: t.frecuencia?.hash ?? '',
                vigenciaDesde: enFormulario(t.vigenciaDesde),
                vigenciaHasta: enFormulario(t.vigenciaHasta),
                monto: Math.round(t.monto / 100),
              },
              ayuda: conComision(t.monto),
              filtros: {
                curso: t.tipoCurso.hash,
                anio: String(t.vigenciaDesde.getFullYear()),
              },
            }))}
            guardar={guardarTarifa}
            eliminar={eliminarTarifa}
            tituloAlta="Agregar un precio"
            botonAlta="Agregar"
            vacio="Todavía no hay ningún precio capturado."
          />
          <p className="silencio" style={{ fontSize: '.85rem' }}>
            El precio se captura en <strong>pesos enteros</strong>. Un curso sin precio
            vigente <strong>no se cobra</strong>: es preferible que se note a que se cobre
            un número que nadie autorizó. Dos precios del mismo curso pueden convivir si
            sus tramos no se enciman —uno de 2026 y otro de 2027—, y rige el que cubre el
            mes que se está cobrando.
          </p>
        </>
      )}

      {cual === 'otros' && (
        <>
          <Catalogo
            campos={CAMPOS_COSTO}
            renglones={costos.map((c) => ({
              hash: c.hash,
              soloDesactivar: false,
              valores: {
                concepto: c.concepto,
                vigenciaDesde: enFormulario(c.vigenciaDesde),
                vigenciaHasta: enFormulario(c.vigenciaHasta),
                monto: Math.round(c.monto / 100),
              },
              ayuda: conComision(c.monto),
            }))}
            guardar={guardarCosto}
            eliminar={eliminarCosto}
            tituloAlta="Agregar un monto"
            botonAlta="Agregar"
            vacio="Todavía no hay montos capturados."
          />
          <p className="silencio" style={{ fontSize: '.85rem' }}>
            El <strong>locker</strong> se cobra por mes y por locker ocupado. El{' '}
            <strong>recargo</strong> se cobra una sola vez por cargo de curso que pasó su
            fecha límite sin pagarse, y <strong>no se cobra sobre el locker</strong>.
            Antes los dos colgaban de cada mes: eran doce renglones con el mismo número.
          </p>
        </>
      )}

    </>
  )
}
