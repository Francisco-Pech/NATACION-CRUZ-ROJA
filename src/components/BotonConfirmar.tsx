'use client'

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

/**
 * Un botón que pregunta antes de hacer lo suyo.
 *
 * Va dentro de un formulario y lo envía solo si la persona confirma. Sirve
 * para lo que no se puede deshacer: borrar un locker, dar de baja a
 * alguien. Un clic de más en el botón equivocado no debe bastar.
 *
 * La pregunta dice **qué** se va a hacer y **sobre qué**, con el nombre o
 * el número a la vista: "¿Eliminar el locker 60?" se contesta; "¿Estás
 * seguro?" no dice nada y se acepta sin leer.
 */
export default function BotonConfirmar({
  children,
  titulo,
  detalle,
  confirmar = 'Sí, eliminar',
  className = 'boton peligro',
  deshabilitado = false,
}: {
  children: React.ReactNode
  titulo: string
  detalle?: React.ReactNode
  confirmar?: string
  className?: string
  deshabilitado?: boolean
}) {
  const [preguntando, setPreguntando] = useState(false)
  const boton = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!preguntando) return
    const alTeclear = (e: KeyboardEvent) => { if (e.key === 'Escape') setPreguntando(false) }
    document.addEventListener('keydown', alTeclear)
    return () => document.removeEventListener('keydown', alTeclear)
  }, [preguntando])

  function aceptar() {
    setPreguntando(false)
    // Se envía el formulario al que pertenece este botón, con todo lo que
    // trae dentro: así la acción del servidor no se entera de nada.
    boton.current?.closest('form')?.requestSubmit()
  }

  return (
    <>
      <button
        ref={boton} type="button" className={className}
        onClick={() => setPreguntando(true)} disabled={deshabilitado}
      >
        {children}
      </button>

      {preguntando &&
        createPortal(
          <div className="telon-modal telon-confirmar" onClick={() => setPreguntando(false)}>
            <div
              className="confirmar" role="alertdialog" aria-modal="true" aria-label={titulo}
              onClick={(e) => e.stopPropagation()}
            >
              <span className="confirmar-icono" aria-hidden>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                  strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" />
                  <line x1="12" y1="9" x2="12" y2="13" />
                  <line x1="12" y1="17" x2="12" y2="17.01" />
                </svg>
              </span>

              <h3>{titulo}</h3>
              {detalle && <p className="silencio">{detalle}</p>}

              <div className="confirmar-botones">
                <button type="button" className="boton peligro" onClick={aceptar}>
                  {confirmar}
                </button>
                <button
                  type="button" className="boton tenue"
                  onClick={() => setPreguntando(false)}
                  /* El foco arranca en Cancelar: si alguien viene tecleando
                     rápido y aprieta Enter, no borra nada. */
                  autoFocus
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  )
}
