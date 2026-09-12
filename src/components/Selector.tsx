'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

export type Opcion = { valor: string; etiqueta: string }

/**
 * Un selector que se abre en una lista con su propio buscador.
 *
 * El `<select>` de siempre sirve para cuatro opciones, pero con veinte
 * obliga a rascar con la rueda del ratón. Aquí se escribe y la lista se
 * recorta sola.
 *
 * El valor viaja en un `<input type="hidden">`, así que el formulario lo
 * manda igual que cualquier campo y sigue funcionando con la acción del
 * servidor sin cambiarle nada.
 *
 * La lista se dibuja fuera de la tabla, pegada al `<body>`, y se coloca a
 * mano sobre el botón. Tiene que ser así: la tabla vive dentro de una caja
 * con scroll horizontal, y un desplegable posicionado adentro se recorta
 * contra ese borde y no se ve.
 */
export default function Selector({
  nombre,
  opciones,
  valor,
  formulario,
  etiqueta,
  placeholder = 'Escoge…',
  deshabilitado = false,
  requerido = false,
  alCambiar,
}: {
  nombre: string
  opciones: Opcion[]
  valor?: string
  /** Id del `<form>` al que pertenece el campo, si vive fuera de él. */
  formulario?: string
  etiqueta: string
  placeholder?: string
  /** Solo marca la etiqueta: el valor viaja en un campo oculto, que el
   *  navegador no valida. Quien exige es la acción del servidor. */
  requerido?: boolean
  deshabilitado?: boolean
  /** Se avisa al escoger, para guardar sin un botón aparte. */
  alCambiar?: (valor: string) => void
}) {
  const [abierto, setAbierto] = useState(false)
  const [busqueda, setBusqueda] = useState('')
  const [elegido, setElegido] = useState(valor ?? opciones[0]?.valor ?? '')
  const [resaltada, setResaltada] = useState(0)
  const [sitio, setSitio] = useState<{ top: number; left: number; ancho: number } | null>(null)
  const caja = useRef<HTMLDivElement>(null)
  const lista = useRef<HTMLDivElement>(null)
  const campoBusqueda = useRef<HTMLInputElement>(null)

  const actual = opciones.find((o) => o.valor === elegido)

  const filtradas = useMemo(() => {
    const aguja = sinAcentos(busqueda)
    if (!aguja) return opciones
    return opciones.filter((o) => sinAcentos(o.etiqueta).includes(aguja))
  }, [busqueda, opciones])

  /** Coloca la lista bajo el botón, o encima si no cabe abajo. */
  const colocar = useCallback(() => {
    const r = caja.current?.getBoundingClientRect()
    if (!r) return
    const alto = lista.current?.offsetHeight ?? 260
    const cabeAbajo = window.innerHeight - r.bottom > alto + 12
    setSitio({
      top: cabeAbajo ? r.bottom + 4 : Math.max(8, r.top - alto - 4),
      left: Math.min(r.left, window.innerWidth - Math.max(r.width, 220) - 8),
      ancho: r.width,
    })
  }, [])

  // Al abrir, el cursor cae en el buscador: se puede escribir de inmediato.
  useEffect(() => {
    if (!abierto) return
    colocar()
    campoBusqueda.current?.focus()
  }, [abierto, colocar])

  // Si la página se mueve debajo, la lista se mueve con el botón.
  useEffect(() => {
    if (!abierto) return
    const seguir = () => colocar()
    window.addEventListener('scroll', seguir, true)
    window.addEventListener('resize', seguir)
    return () => {
      window.removeEventListener('scroll', seguir, true)
      window.removeEventListener('resize', seguir)
    }
  }, [abierto, colocar])

  // Clic afuera, o Escape: se cierra sin cambiar nada.
  useEffect(() => {
    if (!abierto) return
    const afuera = (e: MouseEvent) => {
      const donde = e.target as Node
      // La lista ya no está dentro de `caja`: hay que preguntarle también.
      if (caja.current?.contains(donde) || lista.current?.contains(donde)) return
      cerrar()
    }
    const tecla = (e: KeyboardEvent) => {
      if (e.key === 'Escape') cerrar()
    }
    document.addEventListener('mousedown', afuera)
    document.addEventListener('keydown', tecla)
    return () => {
      document.removeEventListener('mousedown', afuera)
      document.removeEventListener('keydown', tecla)
    }
  }, [abierto])

  function cerrar() {
    setAbierto(false)
    setBusqueda('')
    setResaltada(0)
    setSitio(null)
  }

  function escoger(o: Opcion) {
    setElegido(o.valor)
    cerrar()
    if (o.valor !== elegido) alCambiar?.(o.valor)
  }

  function enTeclado(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      if (filtradas.length === 0) return
      const paso = e.key === 'ArrowDown' ? 1 : -1
      setResaltada((n) => (n + paso + filtradas.length) % filtradas.length)
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const o = filtradas[resaltada]
      if (o) escoger(o)
    }
  }

  return (
    <div className={`selector${requerido ? ' obligatorio' : ''}`} ref={caja}>
      <input type="hidden" name={nombre} value={elegido} form={formulario} />

      <button
        type="button"
        className="selector-boton"
        onClick={() => setAbierto((a) => !a)}
        disabled={deshabilitado}
        aria-haspopup="listbox"
        aria-expanded={abierto}
        aria-label={etiqueta}
        /* Para que un filtro con algo escogido se distinga del que deja
           pasar todo. Vacío es "sin escoger" en los dos casos. */
        data-puesto={elegido ? 'si' : 'no'}
      >
        <span className={actual ? '' : 'silencio'}>{actual?.etiqueta ?? placeholder}</span>
        <svg width="10" height="7" viewBox="0 0 10 7" aria-hidden>
          <path d="M1 1l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      </button>

      {abierto && sitio && createPortal(
        <div
          ref={lista}
          className="selector-lista"
          role="listbox"
          aria-label={etiqueta}
          style={{ top: sitio.top, left: sitio.left, minWidth: Math.max(sitio.ancho, 200) }}
        >
          <input
            ref={campoBusqueda}
            type="search"
            className="selector-busqueda"
            value={busqueda}
            onChange={(e) => {
              setBusqueda(e.target.value)
              setResaltada(0)
            }}
            onKeyDown={enTeclado}
            placeholder="Buscar…"
            aria-label={`Buscar en ${etiqueta}`}
          />

          <ul>
            {filtradas.map((o, i) => (
              <li key={o.valor}>
                <button
                  type="button"
                  role="option"
                  aria-selected={o.valor === elegido}
                  className={`${i === resaltada ? 'resaltada' : ''} ${o.valor === elegido ? 'elegida' : ''}`}
                  onMouseEnter={() => setResaltada(i)}
                  onClick={() => escoger(o)}
                >
                  {o.etiqueta}
                </button>
              </li>
            ))}
            {filtradas.length === 0 && (
              <li className="selector-vacio silencio">Nada que coincida.</li>
            )}
          </ul>
        </div>,
        document.body,
      )}
    </div>
  )
}

/** Sin acentos y en minúsculas: así "ninos" encuentra "Curso Niños". */
const sinAcentos = (texto: string) =>
  texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLocaleLowerCase('es').trim()
