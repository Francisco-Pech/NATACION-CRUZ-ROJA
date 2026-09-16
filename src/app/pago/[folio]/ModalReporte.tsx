'use client'

import { useActionState, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { reportarProblema } from './acciones'
import CampoArchivo from '@/components/CampoArchivo'
import { IconoCerrar } from '@/components/Iconos'

/**
 * "No me dejó pagar": el recado para que la delegación llame.
 *
 * Aparece cuando algo falló, no siempre: una pantalla de cobro llena de
 * formularios de queja invita a desconfiar antes de haber intentado nada.
 *
 * Pide teléfono y correo porque el objetivo no es registrar la queja sino
 * poder devolver la llamada. La imagen es opcional: la captura del error
 * suele decir más que la descripción de quien lo sufrió.
 */
export default function ModalReporte({
  folio,
  destacado = false,
}: {
  folio: string
  /** Tras un error se ofrece como botón; el resto del tiempo, como liga. */
  destacado?: boolean
}) {
  const [abierto, setAbierto] = useState(false)
  const [aviso, reportar, enviando] = useActionState(reportarProblema, null)

  useEffect(() => {
    if (!abierto) return
    const alTeclear = (e: KeyboardEvent) => { if (e.key === 'Escape') setAbierto(false) }
    document.addEventListener('keydown', alTeclear)
    return () => document.removeEventListener('keydown', alTeclear)
  }, [abierto])

  return (
    <>
      {destacado ? (
        <button type="button" className="boton" onClick={() => setAbierto(true)}>
          Avísanos qué pasó
        </button>
      ) : (
        <button type="button" className="enlace-aviso" onClick={() => setAbierto(true)}>
          ¿Algo no funcionó? Avísanos
        </button>
      )}

      {abierto &&
        createPortal(
          <div className="telon-modal" onClick={() => setAbierto(false)}>
            <div
              className="modal"
              role="dialog"
              aria-modal="true"
              aria-label="Avisar de un problema al pagar"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button" className="modal-cerrar"
                onClick={() => setAbierto(false)} aria-label="Cerrar"
              >
                <IconoCerrar tamano={18} />
              </button>

              <h2>¿Qué pasó?</h2>

              {aviso?.ok ? (
                <>
                  <div className="aviso">{aviso.mensaje}</div>
                  <div className="fila" style={{ justifyContent: 'flex-end' }}>
                    <button type="button" className="boton tenue" onClick={() => setAbierto(false)}>
                      Cerrar
                    </button>
                  </div>
                </>
              ) : (
                <form action={reportar}>
                  <input type="hidden" name="folio" value={folio} />

                  {aviso && !aviso.ok && <div className="error">{aviso.mensaje}</div>}

                  <p className="silencio" style={{ marginTop: 0, fontSize: '.88rem' }}>
                    Déjanos cómo localizarte y qué te apareció. De la delegación te buscan
                    para resolverlo — y si el banco ya te cobró, dilo aquí.
                  </p>

                  <label htmlFor="rep-nombre">Tu nombre</label>
                  <input id="rep-nombre" name="nombre" required />

                  <label htmlFor="rep-correo">Correo electrónico</label>
                  <input id="rep-correo" name="correo" type="email" required />

                  <div className="fila" style={{ gap: '.5rem', alignItems: 'flex-end' }}>
                    <div style={{ width: '5.5rem' }}>
                      <label htmlFor="rep-lada">Lada</label>
                      <input id="rep-lada" name="lada" defaultValue="52" inputMode="numeric" />
                    </div>
                    <div style={{ flex: 1 }}>
                      <label htmlFor="rep-tel">Celular</label>
                      <input
                        id="rep-tel" name="telefono" inputMode="tel"
                        placeholder="998 123 45 67" required
                      />
                    </div>
                  </div>

                  <label htmlFor="rep-mensaje">¿Qué pasó?</label>
                  <textarea id="rep-mensaje" name="mensaje" rows={4} required />

                  <CampoArchivo
                    nombre="imagen"
                    acepta="image/*,application/pdf"
                    ayuda="Opcional: una captura de lo que te apareció."
                  />

                  {/* Guardar a la izquierda, Cerrar a la derecha. */}
                  <div className="fila" style={{ justifyContent: 'flex-end', marginTop: '.8rem' }}>
                    <button className="boton" type="submit" disabled={enviando}>
                      {enviando ? 'Enviando…' : 'Enviar'}
                    </button>
                    <button
                      type="button" className="boton tenue"
                      onClick={() => setAbierto(false)} disabled={enviando}
                    >
                      Cerrar
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>,
          document.body,
        )}
    </>
  )
}
