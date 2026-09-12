'use client'

import { useEffect, useState } from 'react'

export type Resultado = { ok: boolean; mensaje: string } | null

/**
 * Alerta flotante de resultado. Aparece en la esquina, se quita sola a los
 * pocos segundos y también se puede cerrar a mano.
 *
 * Flota en vez de vivir dentro de la tabla porque ahí quedaba apretada y
 * empujaba la fila. Los errores se quedan más tiempo que los aciertos: un
 * "guardado" se entiende de reojo, un error hay que leerlo.
 */
export default function Alerta({ resultado }: { resultado: Resultado }) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (!resultado) return
    setVisible(true)
    const ms = resultado.ok ? 3000 : 7000
    const reloj = setTimeout(() => setVisible(false), ms)
    return () => clearTimeout(reloj)
  }, [resultado])

  if (!resultado || !visible) return null

  return (
    <div
      className={`alerta ${resultado.ok ? 'bien' : 'mal'}`}
      role={resultado.ok ? 'status' : 'alert'}
      aria-live={resultado.ok ? 'polite' : 'assertive'}
    >
      <span className="alerta-icono" aria-hidden>
        {resultado.ok ? (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <polyline points="16 9 11 14.5 8 11.5" />
          </svg>
        ) : (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="7.5" x2="12" y2="13" />
            <line x1="12" y1="16.5" x2="12" y2="16.6" />
          </svg>
        )}
      </span>

      <p className="alerta-texto">{resultado.mensaje}</p>

      <button
        type="button"
        className="alerta-cerrar"
        onClick={() => setVisible(false)}
        aria-label="Cerrar aviso"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          strokeWidth="2.2" strokeLinecap="round" aria-hidden>
          <line x1="6" y1="6" x2="18" y2="18" />
          <line x1="18" y1="6" x2="6" y2="18" />
        </svg>
      </button>
    </div>
  )
}
