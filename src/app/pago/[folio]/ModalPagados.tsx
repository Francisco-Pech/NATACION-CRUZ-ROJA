'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { IconoCerrar, IconoPagado, IconoBloqueado } from '@/components/Iconos'

export type MesHecho = {
  clave: string
  mes: string
  monto: string
  /** "Pago en efectivo en OXXO · 14 de septiembre de 2026", o por qué no. */
  detalle: string
  pagado: boolean
  /** A dónde abrir el comprobante que subió, si subió alguno. */
  comprobante: string | null
}

/**
 * Los meses que ya pasaron, en una ventana.
 *
 * Fuera de la pantalla principal a propósito: quien entra viene a pagar un
 * mes, y una lista de doce renglones arriba del botón lo hace desplazarse
 * para llegar a lo que vino a hacer. Pero la lista tiene que existir —es
 * donde se comprueba que un pago entró, con qué y cuándo—, así que queda a
 * un toque.
 */
export default function ModalPagados({
  pagados,
  pendientes,
}: {
  pagados: MesHecho[]
  pendientes: MesHecho[]
}) {
  const [abierto, setAbierto] = useState(false)

  useEffect(() => {
    if (!abierto) return
    const alTeclear = (e: KeyboardEvent) => { if (e.key === 'Escape') setAbierto(false) }
    document.addEventListener('keydown', alTeclear)
    return () => document.removeEventListener('keydown', alTeclear)
  }, [abierto])

  if (pagados.length === 0 && pendientes.length === 0) return null

  return (
    <>
      <p style={{ textAlign: 'center', margin: '1rem 0' }}>
        <button type="button" className="enlace-aviso" onClick={() => setAbierto(true)}>
          Ver mis meses {pagados.length > 0 && `· ${pagados.length} pagado${pagados.length === 1 ? '' : 's'}`}
        </button>
      </p>

      {abierto &&
        createPortal(
          <div className="telon-modal" onClick={() => setAbierto(false)}>
            <div
              className="modal"
              role="dialog"
              aria-modal="true"
              aria-label="Mis meses"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button" className="modal-cerrar"
                onClick={() => setAbierto(false)} aria-label="Cerrar"
              >
                <IconoCerrar tamano={18} />
              </button>

              <h2>Mis meses</h2>

              {pagados.length > 0 && (
                <>
                  <h3 className="etiqueta">Pagados</h3>
                  <ul className="meses-pagados">
                    {pagados.map((m) => (
                      <li key={m.clave}>
                        <span className="mes-icono" aria-hidden><IconoPagado /></span>
                        <span className="mes-nombre">
                          <b>{m.mes}</b>
                          <span className="silencio pie-celda">{m.detalle}</span>
                          {/* Su propio comprobante: lo subió él, y abrirlo
                              es cómo comprueba que mandó el correcto. */}
                          {m.comprobante && (
                            <a
                              className="enlace-aviso"
                              href={m.comprobante}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{ fontSize: '.8rem' }}
                            >
                              Ver mi comprobante
                            </a>
                          )}
                        </span>
                        <span className="monto">{m.monto}</span>
                      </li>
                    ))}
                  </ul>
                </>
              )}

              {pendientes.length > 0 && (
                <>
                  <h3 className="etiqueta" style={{ marginTop: '1rem' }}>Después</h3>
                  <ul className="meses-pagados">
                    {pendientes.map((m) => (
                      <li key={m.clave} className="pendiente">
                        <span className="mes-icono" aria-hidden><IconoBloqueado /></span>
                        <span className="mes-nombre">
                          <b>{m.mes}</b>
                          <span className="silencio pie-celda">{m.detalle}</span>
                          {/* Su propio comprobante: lo subió él, y abrirlo
                              es cómo comprueba que mandó el correcto. */}
                          {m.comprobante && (
                            <a
                              className="enlace-aviso"
                              href={m.comprobante}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{ fontSize: '.8rem' }}
                            >
                              Ver mi comprobante
                            </a>
                          )}
                        </span>
                        <span className="monto">{m.monto}</span>
                      </li>
                    ))}
                  </ul>
                </>
              )}

              <div className="fila" style={{ justifyContent: 'flex-end', marginTop: '1rem' }}>
                <button type="button" className="boton tenue" onClick={() => setAbierto(false)}>
                  Cerrar
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  )
}
