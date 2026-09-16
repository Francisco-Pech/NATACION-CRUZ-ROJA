'use client'

import { useState } from 'react'

/**
 * Comparte el enlace de la credencial por correo o copiándolo.
 *
 * No cuesta nada y no hay nada que contratar: `mailto:` abre el correo que
 * la persona ya usa, con el asunto y el texto escritos, y ella le da
 * enviar. Es lo que corresponde a una escuela que se sostiene de donativos
 * —nada que se caiga el mes que no se renueve un servicio.
 *
 * Mandarlo solo por WhatsApp, sin que nadie apriete enviar, pide la API de
 * negocios de WhatsApp, que se cobra por mensaje. Por eso no está.
 */
export default function Compartir({
  enlace,
  nombre,
  folio,
}: {
  enlace: string
  nombre: string
  folio: string
}) {
  const [copiado, setCopiado] = useState(false)

  const mensaje =
    `Hola ${nombre}: aquí está tu credencial de la Escuela de Natación de ` +
    `Cruz Roja Cancún. Tu folio es ${folio}. Con este enlace puedes ver tu ` +
    `código QR y tu estado de cuenta: ${enlace}`

  async function copiar() {
    try {
      await navigator.clipboard.writeText(enlace)
      setCopiado(true)
      setTimeout(() => setCopiado(false), 2500)
    } catch {
      // Sin permiso de portapapeles —pasa en páginas sin https— queda el
      // campo de abajo, que se puede seleccionar a mano.
      setCopiado(false)
    }
  }

  return (
    <div className="compartir no-imprimir">
      <p className="silencio" style={{ marginTop: 0, fontSize: '.85rem' }}>
        Este enlace es personal: quien lo tenga puede ver el estado de cuenta de{' '}
        <strong>{nombre}</strong>. Mándaselo solo a ella o a su familia.
      </p>

      <div className="fila">
        <a
          className="boton con-icono"
          href={`mailto:?subject=${encodeURIComponent(
            `Tu credencial · ${folio}`,
          )}&body=${encodeURIComponent(mensaje)}`}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <rect x="2" y="4" width="20" height="16" rx="2" />
            <path d="m3 6 9 7 9-7" />
          </svg>
          Enviar por correo
        </a>

        <button type="button" className="boton tenue con-icono" onClick={copiar}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <rect x="9" y="9" width="11" height="11" rx="2" />
            <path d="M5 15V5a2 2 0 0 1 2-2h10" />
          </svg>
          {copiado ? 'Copiado' : 'Copiar el enlace'}
        </button>
      </div>

      {/* De solo lectura y a la vista: si el portapapeles falla, el enlace
          se puede seleccionar a mano. */}
      <input
        readOnly value={enlace} onFocus={(e) => e.target.select()}
        aria-label="Enlace de la credencial" style={{ marginTop: '.7rem' }}
      />
    </div>
  )
}
