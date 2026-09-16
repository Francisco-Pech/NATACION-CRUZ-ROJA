'use client'

import { useMemo, useState } from 'react'
import Selector from '@/components/Selector'
import CampoFecha from '@/components/CampoFecha'
import { IconoAnterior, IconoSiguiente } from '@/components/Iconos'
import { paginasVisibles, SALTO } from '@/lib/paginacion'
import { pesos } from '@/lib/formato'

export type RenglonPago = {
  id: string
  /** Cuándo entró el dinero, ya escrito en hora de Cancún. */
  fecha: string
  /** El día en Cancún, "2026-09-15": con eso se compara el rango. */
  dia: string
  alumno: string
  folio: string
  curso: string
  horario: string
  metodo: string
  estado: string
  color: string
  monto: number
  /** Quién lo marcó, o nadie si lo cobró la pasarela. */
  quien: string | null
}

const TAMANOS = [25, 50, 100, 0]

const sinAcentos = (texto: string) =>
  texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLocaleLowerCase('es').trim()

/**
 * El historial de pagos, para verlo y nada más.
 *
 * No se cobra ni se corrige desde aquí: para eso está la ventana de
 * mensualidades del alumno, donde se ve qué mes se está tocando. Esta
 * pantalla contesta otra pregunta —"¿qué entró y cuándo?"— y mezclarle
 * botones de acción invitaría a cobrar sin mirar a quién.
 *
 * Abre en el mes que corre porque es por el que se pregunta casi siempre;
 * los demás están a un clic.
 */
export default function TablaPagos({
  renglones,
  catalogos,
  desdeHoy,
  hastaHoy,
}: {
  renglones: RenglonPago[]
  /**
   * Las opciones completas de cada filtro.
   *
   * Vienen del catálogo y no de los renglones a la vista. En la lista de
   * alumnos se arman de las filas —ofrecer un curso que nadie lleva deja la
   * tabla en blanco—, pero aquí la pregunta es otra: quien revisa el
   * historial quiere poder preguntar "¿entró algo con tarjeta este mes?" y
   * que el sistema conteste que no. Si la forma de pago no apareciera en la
   * lista por no haberse usado, esa pregunta no se podría ni hacer.
   */
  catalogos: {
    cursos: string[]
    horarios: string[]
    metodos: string[]
    estados: string[]
  }
  /** El primer y el último día del mes que corre, en Cancún. */
  desdeHoy: string
  hastaHoy: string
}) {
  const [busqueda, setBusqueda] = useState('')
  const [puestos, setPuestos] = useState<Record<string, string>>({})
  const [pagina, setPagina] = useState(0)
  const [cuantos, setCuantos] = useState(25)

  // El rango abre en el mes que corre, que es por el que se pregunta casi
  // siempre. Vaciar cualquiera de los dos lo deja abierto de ese lado: quien
  // busca "todo lo del año" borra el "Desde" y ya.
  const [desde, setDesde] = useState(desdeHoy)
  const [hasta, setHasta] = useState(hastaHoy)

  const filtros = useMemo(
    () => [
      {
        nombre: 'curso', etiqueta: 'Tipo de curso',
        opciones: catalogos.cursos,
        contra: (r: RenglonPago) => [r.curso],
      },
      {
        nombre: 'horario', etiqueta: 'Horario',
        opciones: catalogos.horarios,
        contra: (r: RenglonPago) => [r.horario],
      },
      {
        nombre: 'metodo', etiqueta: 'Forma de pago',
        opciones: catalogos.metodos,
        contra: (r: RenglonPago) => [r.metodo],
      },
      {
        nombre: 'estado', etiqueta: 'Estado',
        opciones: catalogos.estados,
        contra: (r: RenglonPago) => [r.estado],
      },
    ],
    [catalogos],
  )

  const filtrados = useMemo(() => {
    const aguja = sinAcentos(busqueda)
    const activos = filtros.filter((f) => (puestos[f.nombre] ?? '') !== '')

    return renglones.filter((r) => {
      // Las fechas se comparan como texto "2026-09-15": están en el mismo
      // formato, así que el orden alfabético es el cronológico. Pasarlas por
      // `new Date` las interpretaría en la zona del navegador y movería los
      // bordes del rango un día.
      if (desde && r.dia < desde) return false
      if (hasta && r.dia > hasta) return false

      for (const f of activos) {
        if (!f.contra(r).includes(puestos[f.nombre])) return false
      }
      if (!aguja) return true
      return sinAcentos(`${r.alumno} ${r.folio}`).includes(aguja)
    })
  }, [renglones, busqueda, puestos, filtros, desde, hasta])

  const tamano = cuantos > 0 ? cuantos : Math.max(1, filtrados.length)
  const paginas = Math.max(1, Math.ceil(filtrados.length / tamano))
  const actual = Math.min(pagina, paginas - 1)
  const visibles = filtrados.slice(actual * tamano, actual * tamano + tamano)
  const primero = filtrados.length === 0 ? 0 : actual * tamano + 1
  const ultimo = Math.min(filtrados.length, actual * tamano + tamano)
  const suma = filtrados.reduce((s, r) => s + r.monto, 0)

  const alFiltrar = (poner: () => void) => {
    poner()
    setPagina(0)
  }

  return (
    <div className="tarjeta">
      {/* Los seis del mismo alto y del mismo ancho: una barra donde cada
          control mide distinto se lee como un error antes que como un
          filtro. Las fechas llevan su palabra adentro —"Desde 1 de
          septiembre"— igual que los selectores dicen "Horario: todos", así
          ninguno necesita una etiqueta arriba que lo desalinee. */}
      <div className="barra-tabla parejos">
        <div className="filtro-tabla">
          <CampoFecha
            nombre="filtro-desde" etiqueta="Pagos desde" prefijo="Desde"
            valor={desde} alCambiar={(v) => alFiltrar(() => setDesde(v))}
          />
        </div>
        <div className="filtro-tabla">
          <CampoFecha
            nombre="filtro-hasta" etiqueta="Pagos hasta" prefijo="Hasta"
            valor={hasta} alCambiar={(v) => alFiltrar(() => setHasta(v))}
          />
        </div>

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
          aria-label="Buscar en el historial"
        />
      </div>

      <div className="tabla-ancha">
        <table>
          <thead>
            <tr>
              <th style={{ width: 170 }}>Fecha de pago</th>
              <th>Alumno</th>
              <th style={{ width: 140 }}>Tipo de curso</th>
              <th style={{ width: 130 }}>Horario</th>
              <th style={{ width: 190 }}>Forma de pago</th>
              <th style={{ width: 130 }}>Estado</th>
              <th style={{ width: 110 }} className="derecha">Monto</th>
            </tr>
          </thead>
          <tbody>
            {visibles.map((r) => (
              <tr key={r.id}>
                <td>
                  {r.fecha}
                  {r.quien && <><br /><span className="silencio pie-celda">lo marcó {r.quien}</span></>}
                  {!r.quien && <><br /><span className="silencio pie-celda">pagado en línea</span></>}
                </td>
                <td>
                  {r.alumno}
                  <br />
                  <span className="silencio pie-celda mono">{r.folio}</span>
                </td>
                <td className="silencio">{r.curso}</td>
                <td className="silencio">{r.horario}</td>
                <td className="silencio">{r.metodo}</td>
                <td><span className={`insignia ${r.color}`}>{r.estado}</span></td>
                <td className="derecha mono">{pesos(r.monto)}</td>
              </tr>
            ))}

            {filtrados.length === 0 && (
              <tr>
                <td colSpan={7} className="silencio">
                  {busqueda
                    ? `Nada que coincida con "${busqueda}".`
                    : 'No hay pagos con lo que escogiste.'}
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
            {' · '}
            {/* La suma es de lo filtrado, no de la página: quien filtra un mes
                quiere saber cuánto entró ese mes, no cuánto cabe en pantalla. */}
            suman <strong>{pesos(suma)}</strong>
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
