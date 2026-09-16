'use client'

import { useActionState, useMemo, useState } from 'react'
import {
  IconoGuardar,
  IconoDesactivar,
  IconoEliminar,
  IconoAnterior,
  IconoSiguiente,
} from '@/components/Iconos'
import Alerta from '@/components/Alerta'
import Selector from '@/components/Selector'
import Ayuda from '@/components/Ayuda'
import CampoFecha from '@/components/CampoFecha'
import { paginasVisibles, SALTO } from '@/lib/paginacion'
import type { Campo, Renglon, Filtro, AccionCatalogo, Resultado } from './tipos'

/**
 * La tabla de un catálogo: crear arriba, editar renglón por renglón abajo.
 *
 * Los cuatro catálogos —días, horarios, tipos de pago y recurrencias— son
 * la misma pantalla con otras columnas, así que viven en un solo componente:
 * arreglar el spinner o el aviso una vez los arregla en los cuatro.
 */
export default function Catalogo({
  campos,
  renglones,
  guardar,
  eliminar,
  vacio = 'Ninguno todavía.',
  tituloAlta = 'Agregar',
  botonAlta = 'Agregar',
  porPagina = 10,
  filtros = [],
}: {
  campos: Campo[]
  renglones: Renglon[]
  /** Arrancan sin nada escogido, y así dejan pasar todo. */
  filtros?: Filtro[]
  guardar: AccionCatalogo
  eliminar: AccionCatalogo
  vacio?: string
  tituloAlta?: string
  botonAlta?: string
  /** Con cuántos renglones por página se abre. Se puede cambiar desde la
   *  pantalla; esto es solo el valor de arranque. */
  porPagina?: number
}) {
  // Los ocultos viajan en el formulario pero no ocupan columna.
  const enTabla = campos.filter((c) => c.tipo !== 'oculto' && !c.soloAlta)

  const [busqueda, setBusqueda] = useState('')
  const [pagina, setPagina] = useState(0)
  const [cuantos, setCuantos] = useState(porPagina)
  // Vacío quiere decir "todos". Ninguno arranca escogido: un filtro ya
  // puesto esconde renglones sin que nadie se lo pida, y quien abre la
  // pantalla cree que no existen.
  const [escogidos, setEscogidos] = useState<Record<string, string>>({})

  // Se busca sobre lo que se ve: si el renglón dice "Semana Santa", eso es
  // lo que la gente va a teclear. Se ignoran acentos y mayúsculas porque
  // nadie escribe "Miércoles" con tilde cuando anda buscando rápido.
  const filtrados = useMemo(() => {
    const aguja = sinAcentos(busqueda)
    const puestos = Object.entries(escogidos).filter(([, v]) => v !== '')

    return renglones.filter((r) => {
      for (const [nombre, valor] of puestos) {
        if (valorDeFiltro(r, nombre) !== valor) return false
      }
      if (!aguja) return true
      return enTabla.some((c) => sinAcentos(String(r.valores[c.nombre] ?? '')).includes(aguja))
    })
  }, [busqueda, escogidos, renglones, enTabla])

  // `cuantos` en 0 es "todos": una sola página con todo dentro.
  const tamano = cuantos > 0 ? cuantos : Math.max(1, filtrados.length)
  const paginas = Math.max(1, Math.ceil(filtrados.length / tamano))
  // Si la búsqueda deja menos páginas de las que había, no hay que quedarse
  // parado en una página vacía.
  const actual = Math.min(pagina, paginas - 1)
  const visibles = filtrados.slice(actual * tamano, actual * tamano + tamano)
  // Con la lista vacía se enseña 0–0 y no un 1–0, que se lee como un error.
  const primero = filtrados.length === 0 ? 0 : actual * tamano + 1
  const ultimo = Math.min(filtrados.length, actual * tamano + tamano)
  // El buscador va en todas las listas. Con un solo renglón sobra, y con
  // ninguno no hay qué buscar.
  const valeBuscar = renglones.length >= 2
  // El "Ver N" solo aparece cuando el tamaño más chico partiría la lista:
  // ofrecer "ver 10" sobre una tabla de cuatro no hace nada. El renglón de
  // "Mostrando…" en cambio va siempre, para que todas las tablas terminen
  // igual y no parezca que a las chicas les falta algo.
  const valeElegirTamano = renglones.length > Math.min(...TAMANOS.filter((n) => n > 0))

  const buscar = (texto: string) => {
    setBusqueda(texto)
    setPagina(0)
  }

  const cambiarCuantos = (valor: number) => {
    setCuantos(valor)
    // Con más renglones por página, la página 4 puede dejar de existir.
    setPagina(0)
  }

  return (
    <>
      <div className="tarjeta">
        <h2>{tituloAlta}</h2>
        <FormularioAlta campos={campos} guardar={guardar} boton={botonAlta} />
      </div>

      <div className="tarjeta">
        {(valeBuscar || busqueda || filtros.length > 0) && (
          <>
            {/* Los filtros van en esta fila. El buscador se queda pegado a la
                derecha con `margin-left: auto`, así que los que se agreguen
                después entran por la izquierda sin moverlo. */}
            <div className="barra-tabla">
              {filtros.map((f) => (
                <div className="filtro-tabla" key={f.nombre}>
                  {/* Con su propio buscador: una lista de veinte horarios
                      obliga a rascar con la rueda para hallar uno. */}
                  <Selector
                    nombre={`filtro-${f.nombre}`}
                    etiqueta={f.etiqueta}
                    valor={escogidos[f.nombre] ?? ''}
                    opciones={[{ valor: '', etiqueta: `${f.etiqueta}: todos` }, ...f.opciones]}
                    alCambiar={(v) => {
                      setEscogidos((antes) => ({ ...antes, [f.nombre]: v }))
                      setPagina(0)
                    }}
                  />
                </div>
              ))}
              <input
                type="search"
                className="buscador"
                value={busqueda}
                onChange={(e) => buscar(e.target.value)}
                placeholder="Buscar…"
                aria-label="Buscar en la lista"
              />
            </div>
          </>
        )}

        <div className="tabla-ancha">
          <table>
            <thead>
              <tr>
                <th style={{ width: 46 }}>#</th>
                {enTabla.map((c) => (
                  <th
                    key={c.nombre}
                    className={c.tipo === 'casilla' ? 'celda-casilla' : undefined}
                    style={c.ancho ? { width: c.ancho } : undefined}
                  >
                    {c.etiqueta}
                  </th>
                ))}
                <th style={{ width: 240 }} />
              </tr>
            </thead>
            <tbody>
              {visibles.map((r) => (
                <Fila
                  key={r.hash}
                  indice={renglones.indexOf(r)}
                  campos={campos}
                  renglon={r}
                  guardar={guardar}
                  eliminar={eliminar}
                />
              ))}
              {filtrados.length === 0 && (
                <tr>
                  <td colSpan={enTabla.length + 2} className="silencio">
                    {busqueda ? `Nada que coincida con "${busqueda}".` : vacio}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {renglones.length > 0 && (
          <div className="pie-tabla">
            {/* El rango y el total: es lo único que no se ve en ningún otro
                lado. Qué página es se sabe por el número marcado en rojo,
                así que repetirlo aquí sobraría. */}
            <p className="rango-tabla">
              Mostrando <strong>{primero}–{ultimo}</strong> de{' '}
              <strong>{filtrados.length}</strong>
              {filtrados.length !== renglones.length && ` (de ${renglones.length})`}
            </p>

            <div className="controles-pie">
              {valeElegirTamano && (
              <select
                className="por-pagina"
                value={cuantos}
                onChange={(e) => cambiarCuantos(Number(e.target.value))}
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
    </>
  )
}

/** Cuántos renglones por página se pueden escoger. El 0 es "todos". */
const TAMANOS = [10, 25, 50, 100, 0]

/** Sin acentos y en minúsculas: así "miercoles" encuentra "Miércoles". */
const sinAcentos = (texto: string) =>
  texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es').trim()

// --------------------------------------------------------------- el alta

function FormularioAlta({
  campos,
  guardar,
  boton,
}: {
  campos: Campo[]
  guardar: AccionCatalogo
  boton: string
}) {
  const [aviso, accion, creando] = useActionState(guardar, null)

  // Al crear no se pregunta si está activo: nadie da de alta algo apagado.
  const deAlta = campos.filter((c) => c.tipo !== 'casilla' && c.tipo !== 'oculto')
  const ocultos = campos.filter((c) => c.tipo === 'oculto')

  return (
    <>
      <form action={accion} className="alta">
        {/* El alta se anuncia. Sin esta marca, la acción trata lo que llegue
            como una edición y exige un hash que exista: así, quitarle campos
            al formulario de un renglón no acaba creando otro por la puerta
            de atrás. */}
        <input type="hidden" name="alta" value="1" />
        {ocultos.map((c) => (
          <input key={c.nombre} type="hidden" name={c.nombre} value={c.valorFijo ?? ''} />
        ))}
        {deAlta.map((c) => (
          <div key={c.nombre} style={{ flexBasis: c.ancho ?? 150 }}>
            <label htmlFor={`alta-${c.nombre}`}>{c.etiqueta}</label>
            {c.tipo === 'lista' ? (
              <Selector
                nombre={c.nombre}
                opciones={c.opciones ?? []}
                etiqueta={c.etiqueta}
                requerido={!c.opcional}
                deshabilitado={creando}
              />
            ) : c.tipo === 'fecha' ? (
              <CampoFecha
                nombre={c.nombre}
                etiqueta={c.etiqueta}
                requerido={!c.opcional}
                deshabilitado={creando}
              />
            ) : (
              <input
                id={`alta-${c.nombre}`}
                name={c.nombre}
                type={tipoHtml(c)}
                min={c.min}
                max={c.max}
                step={pasoEntero(c)}
                defaultValue={c.predeterminado ?? ''}
                placeholder={c.placeholder}
                required={!c.opcional}
                disabled={creando}
              />
            )}
          </div>
        ))}
        <button className="boton con-icono" type="submit" disabled={creando}>
          {creando ? <span className="girando claro" /> : <IconoGuardar />}
          {creando ? 'Creando…' : boton}
        </button>
      </form>

      <Alerta resultado={creando ? null : aviso} />
    </>
  )
}

// ------------------------------------------------------------- el renglón

function Fila({
  indice,
  campos,
  renglon,
  guardar,
  eliminar,
}: {
  indice: number
  campos: Campo[]
  renglon: Renglon
  guardar: AccionCatalogo
  eliminar: AccionCatalogo
}) {
  const [guardado, accionGuardar, guardando] = useActionState(guardar, null)
  const [borrado, accionBorrar, borrando] = useActionState(eliminar, null)

  // Se muestra el último que respondió. Solo uno corre a la vez.
  const aviso = guardando || borrando ? null : (borrado ?? guardado)
  const ocupado = guardando || borrando
  const activo = renglon.valores.activo !== false

  // Los dos formularios viven en la primera celda y los campos de las demás
  // los referencian por id: así cada dato cae bajo su encabezado en vez de
  // amontonarse en una celda combinada.
  const fGuardar = `guardar-${indice}`
  const fBorrar = `borrar-${indice}`

  return (
    <tr style={{ opacity: activo ? 1 : 0.55 }}>
      {/* Un contador para saber de un vistazo cuántos hay. No es el id de
          la base ni tiene nada que ver con él: ese no sale nunca. */}
      <td className="silencio" style={{ fontVariantNumeric: 'tabular-nums' }}>{indice + 1}</td>

      {campos.filter((c) => c.tipo !== 'oculto' && !c.soloAlta).map((c, col) => (
        <td key={c.nombre} className={c.tipo === 'casilla' ? 'celda-casilla' : undefined}>
          {col === 0 && (
            <>
              <form id={fGuardar} action={accionGuardar} />
              <form id={fBorrar} action={accionBorrar} />
              {/* El id de la base nunca sale a la pantalla: viaja cifrado. */}
              <input form={fGuardar} type="hidden" name="hash" value={renglon.hash} />
              <input form={fBorrar} type="hidden" name="hash" value={renglon.hash} />
              {campos
                .filter((c) => c.tipo === 'oculto')
                .map((c) => (
                  <input
                    key={c.nombre} form={fGuardar} type="hidden" name={c.nombre}
                    value={String(renglon.valores[c.nombre] ?? '')}
                  />
                ))}
            </>
          )}
          <Celda campo={c} renglon={renglon} formulario={fGuardar} ocupado={ocupado} />
        </td>
      ))}

      <td>
        <div className="acciones-fila">
          {renglon.ayuda && <Ayuda texto={renglon.ayuda} />}
          <button
            form={fGuardar} type="submit" disabled={ocupado}
            className="boton tenue con-icono" style={{ padding: '.35rem .8rem' }}
          >
            {guardando ? <span className="girando" /> : <IconoGuardar />}
            {guardando ? 'Guardando…' : 'Guardar'}
          </button>

          <button
            form={fBorrar} type="submit" disabled={ocupado}
            className="boton peligro con-icono" style={{ padding: '.35rem .8rem' }}
          >
            {borrando ? (
              <span className="girando" />
            ) : renglon.soloDesactivar ? (
              <IconoDesactivar />
            ) : (
              <IconoEliminar />
            )}
            {borrando ? 'Espera…' : renglon.soloDesactivar ? 'Desactivar' : 'Eliminar'}
          </button>
        </div>
        <Alerta resultado={aviso} />
      </td>
    </tr>
  )
}

function Celda({
  campo,
  renglon,
  formulario,
  ocupado,
}: {
  campo: Campo
  renglon: Renglon
  formulario: string
  ocupado: boolean
}) {
  const valor = renglon.valores[campo.nombre]
  const etiqueta = `${campo.etiqueta} de ${renglon.valores[nombreVisible(renglon)] ?? ''}`

  if (campo.fijo) {
    return (
      <span style={{ fontFamily: 'ui-monospace, monospace', fontSize: '.85rem' }}>
        {String(valor ?? '')}
      </span>
    )
  }

  if (campo.tipo === 'lista') {
    return (
      <Selector
        nombre={campo.nombre}
        opciones={campo.opciones ?? []}
        valor={String(valor ?? '')}
        formulario={formulario}
        etiqueta={etiqueta}
        deshabilitado={ocupado}
      />
    )
  }

  if (campo.tipo === 'fecha') {
    return (
      <CampoFecha
        nombre={campo.nombre}
        valor={String(valor ?? '')}
        formulario={formulario}
        etiqueta={etiqueta}
        requerido={!campo.opcional}
        deshabilitado={ocupado}
      />
    )
  }

  if (campo.tipo === 'casilla') {
    return (
      <input
        form={formulario} type="checkbox" name={campo.nombre}
        defaultChecked={Boolean(valor)} disabled={ocupado}
        style={{ width: 'auto' }} aria-label={etiqueta}
      />
    )
  }

  return (
    <input
      form={formulario} name={campo.nombre} type={tipoHtml(campo)}
      defaultValue={String(valor ?? '')} min={campo.min} max={campo.max}
      step={pasoEntero(campo)}
      placeholder={campo.placeholder} required={!campo.opcional}
      disabled={ocupado} style={{ width: '100%' }} aria-label={etiqueta}
    />
  )
}

/**
 * Contra qué compara un filtro. Primero las claves de filtro del renglón
 —para filtrar por cosas que no son columna, como el día o la hora— y si no
 * las trae, el valor de la columna con ese nombre.
 */
const valorDeFiltro = (r: Renglon, nombre: string) =>
  r.filtros?.[nombre] ?? String(r.valores[nombre] ?? '')

const tipoHtml = (c: Campo) =>
  c.tipo === 'numero' ? 'number'
    : c.tipo === 'hora' ? 'time'
    : c.tipo === 'fecha' ? 'date'
    : 'text'

/**
 * Un `number` sin `step` acepta decimales: se puede escribir 3.5 alumnos.
 * Con paso de uno, el navegador rechaza el punto y las flechas suben de uno
 * en uno. El servidor lo vuelve a revisar —`validarEntero`— porque el
 * formulario se puede saltar.
 */
const pasoEntero = (c: Campo) => (c.tipo === 'numero' ? 1 : undefined)

/** Para las etiquetas de accesibilidad: el primer campo identifica al renglón. */
const nombreVisible = (r: Renglon) => Object.keys(r.valores)[0] ?? ''
