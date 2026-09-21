'use client'

import { useMemo, useState } from 'react'
import Selector from '@/components/Selector'
import { IconoAnterior, IconoSiguiente } from '@/components/Iconos'
import { paginasVisibles, SALTO } from '@/lib/paginacion'
import ModalCredencial from './ModalCredencial'
import ModalMesEnCurso from './ModalMesEnCurso'
import ModalFactura from './ModalFactura'
import ModalEditar from './ModalEditar'

export type RenglonAlumno = {
  id: string
  folio: string
  nombre: string
  /** El ciclo al que pertenece la inscripción. */
  anio: number
  /** Qué cursos lleva. Vacío es "sin curso", y entonces no se le cobra. */
  cursos: string[]
  /** Las franjas en que va: "08:00–09:00". Es la columna y el filtro. */
  horas: string[]
  descuento: string | null
  /** El número de su locker este mes, si trae uno. */
  locker: number | null
  estado: { etiqueta: string; color: string } | null
  cuantosCargos: number
  /** Si pide factura. Abre la ventana con sus datos fiscales y sus pagos. */
  factura: boolean
}

/** Cuántos renglones por página se pueden escoger. El 0 es "todos". */
const TAMANOS = [10, 25, 50, 100, 0]

/** Sin acentos y en minúsculas: así "nino" encuentra "Niños". */
const sinAcentos = (texto: string) =>
  texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLocaleLowerCase('es').trim()

/**
 * La lista de inscritos, con su buscador, sus filtros y sus páginas.
 *
 * Se busca y se filtra aquí, sobre lo que ya se trajo, igual que en los
 * catálogos del panel: son las mismas teclas y los mismos botones en todas
 * las tablas del sistema.
 */
export default function TablaAlumnos({
  renglones,
  descuentos,
  grupos,
}: {
  renglones: RenglonAlumno[]
  /** Para la ventana de editar: el mismo catálogo que ofrece el alta. */
  descuentos: Array<{ hash: string; nombre: string }>
  /** Los cursos y horarios abiertos, para que Root pueda mover de grupo. */
  grupos: Array<{ clave: string; cursoNombre: string; horario: string; dias: string }>
}) {
  const [busqueda, setBusqueda] = useState('')
  const [puestos, setPuestos] = useState<Record<string, string>>({})
  const [pagina, setPagina] = useState(0)
  const [cuantos, setCuantos] = useState(10)

  // Cada filtro se arma de lo que hay en la lista, no de un catálogo: si
  // ningún inscrito lleva cierto curso, ese curso no se ofrece, y así nadie
  // escoge algo que deja la tabla en blanco.
  const filtros = useMemo(
    () => [
      {
        nombre: 'anio', etiqueta: 'Año',
        opciones: valoresDe(renglones, (r) => [String(r.anio)]),
        contra: (r: RenglonAlumno) => [String(r.anio)],
      },
      {
        nombre: 'curso', etiqueta: 'Tipo de curso',
        opciones: valoresDe(renglones, (r) => r.cursos),
        contra: (r: RenglonAlumno) => r.cursos,
      },
      {
        nombre: 'horario', etiqueta: 'Horario',
        opciones: valoresDe(renglones, (r) => r.horas),
        contra: (r: RenglonAlumno) => r.horas,
      },
      {
        nombre: 'descuento', etiqueta: 'Descuento',
        opciones: valoresDe(renglones, (r) => [r.descuento ?? SIN_DESCUENTO]),
        contra: (r: RenglonAlumno) => [r.descuento ?? SIN_DESCUENTO],
      },
      {
        nombre: 'factura', etiqueta: 'Factura',
        opciones: valoresDe(renglones, (r) => [r.factura ? CON_FACTURA : SIN_FACTURA]),
        contra: (r: RenglonAlumno) => [r.factura ? CON_FACTURA : SIN_FACTURA],
      },
      {
        nombre: 'estado', etiqueta: 'Mes en curso',
        opciones: valoresDe(renglones, (r) => [r.estado?.etiqueta ?? SIN_CARGO]),
        contra: (r: RenglonAlumno) => [r.estado?.etiqueta ?? SIN_CARGO],
      },
    ],
    [renglones],
  )

  const filtrados = useMemo(() => {
    const aguja = sinAcentos(busqueda)
    const activos = filtros.filter((f) => (puestos[f.nombre] ?? '') !== '')

    return renglones.filter((r) => {
      for (const f of activos) {
        if (!f.contra(r).includes(puestos[f.nombre])) return false
      }
      if (!aguja) return true
      // Se busca por lo que la gente tiene a la mano cuando llega a
      // preguntar: su nombre o el folio de su credencial.
      return sinAcentos(`${r.nombre} ${r.folio}`).includes(aguja)
    })
  }, [renglones, busqueda, puestos, filtros])

  const tamano = cuantos > 0 ? cuantos : Math.max(1, filtrados.length)
  const paginas = Math.max(1, Math.ceil(filtrados.length / tamano))
  // Si el filtro deja menos páginas de las que había, no hay que quedarse
  // parado en una vacía.
  const actual = Math.min(pagina, paginas - 1)
  const visibles = filtrados.slice(actual * tamano, actual * tamano + tamano)
  const primero = filtrados.length === 0 ? 0 : actual * tamano + 1
  const ultimo = Math.min(filtrados.length, actual * tamano + tamano)

  const alFiltrar = (poner: () => void) => {
    poner()
    setPagina(0)
  }

  return (
    <div className="tarjeta">
      <div className="barra-tabla">
        {/* Los filtros van siempre, como en los catálogos del panel:
            esconderlos cuando hay pocos renglones hace que la pantalla se
            vea distinta según el día y que alguien los busque sin dar. */}
        {filtros.map((f) => (
          <div className="filtro-tabla" key={f.nombre}>
            <Selector
              nombre={`filtro-${f.nombre}`}
              etiqueta={f.etiqueta}
              valor={puestos[f.nombre] ?? ''}
              alCambiar={(v) => alFiltrar(() => setPuestos((a) => ({ ...a, [f.nombre]: v })))}
              opciones={[
                { valor: '', etiqueta: `${f.etiqueta}: todos` },
                ...f.opciones.map((o) => ({ valor: o, etiqueta: o })),
              ]}
            />
          </div>
        ))}

        <input
          type="search"
          className="buscador"
          value={busqueda}
          onChange={(e) => alFiltrar(() => setBusqueda(e.target.value))}
          placeholder="Buscar por nombre o folio…"
          aria-label="Buscar en la lista"
        />
      </div>

      <div className="tabla-ancha">
        <table>
          <thead>
            <tr>
              <th style={{ width: 150 }}>Folio</th>
              <th>Nombre</th>
              <th style={{ width: 70 }}>Año</th>
              <th style={{ width: 140 }}>Tipo de curso</th>
              <th style={{ width: 150 }}>Horario</th>
              <th style={{ width: 130 }}>Descuento</th>
              <th style={{ width: 90 }}>Locker</th>
              <th style={{ width: 180 }}>Mes en curso</th>
              <th style={{ width: 120 }}>Factura</th>
              <th style={{ width: 90 }} />
            </tr>
          </thead>
          <tbody>
            {visibles.map((r) => (
              <tr key={r.id}>
                <td>
                  {/* El folio abre su credencial sin salir de la lista: es
                      el papel con el código QR, que es justo lo que se busca
                      cuando alguien llega sin él o lo dicta por teléfono. */}
                  <ModalCredencial id={r.id} folio={r.folio} nombre={r.nombre} />
                </td>
                {/* Sin enlace: para abrir la ficha está el botón de la
                    derecha, y para el código QR el folio. Un nombre que
                    también lleva a otro lado son tres destinos en un
                    renglón y ninguno se adivina. */}
                <td>{r.nombre}</td>
                <td className="silencio">{r.anio}</td>

                <td className="silencio">
                  {r.cursos.length === 0
                    ? <span className="sobre-cupo">sin curso</span>
                    : r.cursos.join(', ')}
                </td>

                {/* Solo la franja: los días ya se sabían por el curso, y
                    repetir la hora cinco veces —"L 06:00, M 06:00…"— hacía
                    la columna ilegible. */}
                <td className="silencio">
                  {r.horas.length === 0 ? '—' : r.horas.join(', ')}
                </td>

                <td className="silencio">{r.descuento ?? '—'}</td>

                <td>
                  {r.locker === null
                    ? <span className="silencio">—</span>
                    : <span className="insignia AZUL">#{r.locker}</span>}
                </td>

                <td>
                  {/* Se abre sobre la lista: el estado del mes se consulta
                      mientras la persona está en el mostrador. */}
                  <ModalMesEnCurso
                    id={r.id}
                    etiqueta={r.estado?.etiqueta ?? SIN_CARGO}
                    color={r.estado?.color ?? 'GRIS'}
                    cuantos={r.cuantosCargos}
                  />
                </td>

                <td>
                  {/* Informativa: junta los datos fiscales con la forma de
                      pago de cada cobro, que es lo que pide el CFDI y hoy
                      vive en dos lados distintos. */}
                  <ModalFactura id={r.id} requiere={r.factura} />
                </td>

                <td className="derecha">
                  {/* Se edita sobre la lista: quien corrige un nombre mal
                      escrito no debería perder la página, los filtros y el
                      renglón en el que iba. */}
                  <ModalEditar id={r.id} descuentos={descuentos} grupos={grupos} />
                </td>
              </tr>
            ))}

            {filtrados.length === 0 && (
              <tr>
                <td colSpan={10} className="silencio">
                  {busqueda
                    ? `Nada que coincida con "${busqueda}".`
                    : 'Nadie coincide con lo que escogiste.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {renglones.length > 0 && (
        <div className="pie-tabla">
          <p className="rango-tabla">
            Mostrando <strong>{primero}–{ultimo}</strong> de <strong>{filtrados.length}</strong>
            {filtrados.length !== renglones.length && ` (de ${renglones.length})`}
          </p>

          <div className="controles-pie">
            {renglones.length > Math.min(...TAMANOS.filter((n) => n > 0)) && (
              <select
                className="por-pagina"
                value={cuantos}
                onChange={(e) => alFiltrar(() => setCuantos(Number(e.target.value)))}
                aria-label="Renglones por página"
                title="Renglones por página"
              >
                {TAMANOS.map((n) => (
                  <option key={n} value={n}>{n === 0 ? 'todos' : n}</option>
                ))}
              </select>
            )}

            {paginas > 1 && (
              <nav className="paginador" aria-label="Páginas">
                <button
                  type="button" disabled={actual === 0}
                  onClick={() => setPagina(actual - 1)} aria-label="Página anterior"
                >
                  <IconoAnterior />
                </button>

                {paginasVisibles(actual, paginas).map((n, i) =>
                  n === SALTO ? (
                    <span key={`salto-${i}`} className="puntos" aria-hidden>{SALTO}</span>
                  ) : (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setPagina(n)}
                      aria-current={n === actual ? 'page' : undefined}
                      aria-label={`Página ${n + 1}`}
                    >
                      {n + 1}
                    </button>
                  ),
                )}

                <button
                  type="button" disabled={actual >= paginas - 1}
                  onClick={() => setPagina(actual + 1)} aria-label="Página siguiente"
                >
                  <IconoSiguiente />
                </button>
              </nav>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

const SIN_CARGO = 'Sin cargo'
const SIN_DESCUENTO = 'Sin descuento'
const CON_FACTURA = 'Sí factura'
const SIN_FACTURA = 'No factura'

/** Los valores distintos de una columna, ordenados, para armar su filtro. */
const valoresDe = (filas: RenglonAlumno[], saca: (f: RenglonAlumno) => string[]) =>
  [...new Set(filas.flatMap(saca))].sort((a, b) => a.localeCompare(b, 'es', { numeric: true }))
