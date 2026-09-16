'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { obtenerCredencial } from './acciones'
import Credencial from '@/components/Credencial'
import Compartir from '@/components/Compartir'
import { IconoCerrar } from '@/components/Iconos'

type Datos = Awaited<ReturnType<typeof obtenerCredencial>>

/**
 * La credencial de un alumno, en una ventana sobre la lista.
 *
 * En ventana y no en otra pantalla: quien la abre casi siempre está
 * revisando la lista —buscando a alguien, cotejando folios— y mandarlo a
 * otra página lo obliga a volver y a encontrar de nuevo dónde iba.
 *
 * El código QR se pide al abrirla, no viene con la tabla: son unos 8 KB por
 * alumno y traerlos todos de antemano para enseñar uno haría pesada la
 * lista entera.
 */
export default function ModalCredencial({
  id,
  folio,
  nombre,
}: {
  id: string
  folio: string
  nombre: string
}) {
  const [abierto, setAbierto] = useState(false)
  const [datos, setDatos] = useState<Datos>(null)
  const [fallo, setFallo] = useState(false)

  useEffect(() => {
    if (!abierto || datos) return
    let vigente = true
    obtenerCredencial(id)
      .then((d) => { if (vigente) setDatos(d) })
      .catch(() => { if (vigente) setFallo(true) })
    return () => { vigente = false }
  }, [abierto, datos, id])

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
        type="button"
        className="enlace-folio"
        onClick={() => setAbierto(true)}
        title={`Ver la credencial de ${nombre}`}
      >
        {folio}
      </button>

      {abierto &&
        createPortal(
          <div className="telon-modal" onClick={() => setAbierto(false)}>
            <div
              className="modal modal-credencial"
              role="dialog"
              aria-modal="true"
              aria-label={`Credencial de ${nombre}`}
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button" className="modal-cerrar no-imprimir"
                onClick={() => setAbierto(false)} aria-label="Cerrar"
              >
                <IconoCerrar tamano={18} />
              </button>

              <h2 className="no-imprimir">Credencial</h2>

              {fallo ? (
                <p className="error">No se pudo traer la credencial. Vuelve a intentarlo.</p>
              ) : !datos ? (
                <p className="silencio" style={{ textAlign: 'center', padding: '2rem 0' }}>
                  <span className="girando" /> Preparando el código…
                </p>
              ) : (
                <>
                  <Credencial {...datos} />

                  <p className="silencio no-imprimir"
                    style={{ textAlign: 'center', fontSize: '.82rem', margin: '.9rem 0 0' }}>
                    Para imprimirla: Cmd/Ctrl + P
                  </p>

                  <Compartir
                    enlace={datos.enlaceCredencial}
                    nombre={datos.nombre}
                    folio={datos.folio}
                  />
                </>
              )}
            </div>
          </div>,
          document.body,
        )}
    </>
  )
}
