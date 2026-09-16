'use client'

import { useActionState, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { restablecerClave } from '../acciones'
import CampoClave from '@/components/CampoClave'
import { IconoCerrar } from '@/components/Iconos'

/**
 * Cambiar la contraseña de alguien más. Solo Root.
 *
 * Va en una ventana aparte y no en la fila: son dos campos y un botón, y
 * metidos en un renglón de tabla desarman la lista entera.
 *
 * Cambiarle la contraseña a otro es poder entrar como él, sin que quede
 * rastro de que no fue esa persona. La pantalla lo esconde para quien no es
 * Root y la acción lo exige por separado: quien llegue por otro camino
 * tampoco puede.
 */
export default function FormularioClave({ id, nombre }: { id: string; nombre: string }) {
  const [error, accion, enviando] = useActionState(restablecerClave, null)
  const [abierto, setAbierto] = useState(false)
  // Guardar se apaga hasta que hay algo escrito en las dos casillas: no
  // tiene caso mandar a medias algo que el servidor va a rechazar.
  const [listo, setListo] = useState(false)

  // Escape cierra, como cualquier ventana.
  useEffect(() => {
    if (!abierto) return
    const alTeclear = (e: KeyboardEvent) => { if (e.key === 'Escape') setAbierto(false) }
    document.addEventListener('keydown', alTeclear)
    return () => document.removeEventListener('keydown', alTeclear)
  }, [abierto])

  return (
    <>
      <button
        className="boton tenue" onClick={() => setAbierto(true)}
        style={{ padding: '.3rem .7rem' }}
      >
        Restaurar
      </button>

      {abierto &&
        createPortal(
          <div className="telon-modal" onClick={() => setAbierto(false)}>
            <div
              className="modal"
              role="dialog"
              aria-modal="true"
              aria-label={`Cambiar la contraseña de ${nombre}`}
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button" className="modal-cerrar" onClick={() => setAbierto(false)}
                disabled={enviando} aria-label="Cerrar"
              >
                <IconoCerrar tamano={18} />
              </button>

              <h2>Cambiar la contraseña</h2>
              <p className="silencio" style={{ marginTop: 0 }}>
                De <strong>{nombre}</strong>. Anótala y entrégasela en persona: el
                sistema no manda correos.
              </p>

              <form action={accion}>
                <input type="hidden" name="id" value={id} />
                <div className="fila" style={{ alignItems: 'flex-end' }}>
                  <CampoClave id={`clave-${id}`} deshabilitado={enviando} onListo={setListo} />
                </div>
                {error && <div className="error">{error}</div>}
                <div className="fila" style={{ justifyContent: 'flex-end', marginTop: '1rem' }}>
                  <button className="boton" type="submit" disabled={enviando || !listo}>
                    {enviando ? 'Guardando…' : 'Guardar'}
                  </button>
                  <button
                    type="button" className="boton tenue" onClick={() => setAbierto(false)}
                    disabled={enviando}
                  >
                    Cerrar
                  </button>
                </div>
              </form>
            </div>
          </div>,
          document.body,
        )}
    </>
  )
}
