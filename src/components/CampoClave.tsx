'use client'

import { useEffect, useState } from 'react'
import { generarClave } from '@/lib/claves'
import { IconoGenerar, IconoVer, IconoOcultar } from '@/components/Iconos'

/**
 * Contraseña y confirmación, con un botón para generar una al azar.
 *
 * Las dos llevan su propio ojo: al capturar a mano hay que poder revisar la
 * que se tecleó y la que se repitió por separado, que es donde se cuela el
 * dedazo.
 *
 * La generada se muestra en claro a propósito: el sistema no manda correos,
 * así que hay que poder leerla para anotarla y entregarla en persona.
 */
export default function CampoClave({
  id = 'clave',
  deshabilitado = false,
  onListo,
}: {
  id?: string
  deshabilitado?: boolean
  /** Avisa si ya hay algo escrito en las dos, para habilitar el botón. */
  onListo?: (listo: boolean) => void
}) {
  const [valor, setValor] = useState('')
  const [confirmacion, setConfirmacion] = useState('')
  const [ver, setVer] = useState(false)

  function generar() {
    const nueva = generarClave()
    setValor(nueva)
    // Se llena también la confirmación: no tiene sentido pedirle a nadie
    // que vuelva a teclear a mano algo que no escogió.
    setConfirmacion(nueva)
    setVer(true)
  }

  const noCoinciden = confirmacion !== '' && valor !== confirmacion

  useEffect(() => {
    onListo?.(valor !== '' && confirmacion !== '')
  }, [valor, confirmacion, onListo])

  return (
    <>
      <div style={{ flex: '1 1 170px' }}>
        <label htmlFor={id}>Contraseña</label>
        <div className="campo-clave">
          <input
            id={id}
            name="clave"
            type={ver ? 'text' : 'password'}
            value={valor}
            onChange={(e) => setValor(e.target.value)}
            minLength={8}
            required
            disabled={deshabilitado}
            autoComplete="new-password"
          />
          <button
            type="button" className="icono-en-campo" onClick={() => setVer((v) => !v)}
            aria-pressed={ver} aria-label={ver ? 'Ocultar la contraseña' : 'Ver la contraseña'}
            data-globo={ver ? 'Ocultar' : 'Ver la contraseña'}
          >
            {ver ? <IconoOcultar tamano={15} /> : <IconoVer tamano={15} />}
          </button>
          <button
            type="button" className="icono-en-campo" onClick={generar} disabled={deshabilitado}
            aria-label="Generar una contraseña al azar"
            data-globo="Generar una al azar"
          >
            <IconoGenerar tamano={15} />
          </button>
        </div>
      </div>

      <div style={{ flex: '1 1 170px' }}>
        <label htmlFor={`${id}-confirmacion`}>Confirmar contraseña</label>
        <div className="campo-clave">
          <input
            id={`${id}-confirmacion`}
            name="confirmacion"
            type={ver ? 'text' : 'password'}
            value={confirmacion}
            onChange={(e) => setConfirmacion(e.target.value)}
            minLength={8}
            required
            disabled={deshabilitado}
            autoComplete="new-password"
            aria-invalid={noCoinciden}
          />
          <button
            type="button" className="icono-en-campo" onClick={() => setVer((v) => !v)}
            aria-pressed={ver} aria-label={ver ? 'Ocultar la contraseña' : 'Ver la contraseña'}
            data-globo={ver ? 'Ocultar' : 'Ver la contraseña'}
          >
            {ver ? <IconoOcultar tamano={15} /> : <IconoVer tamano={15} />}
          </button>
        </div>
        {noCoinciden && (
          <span className="sobre-cupo" style={{ fontSize: '.78rem' }}>No coinciden</span>
        )}
      </div>
    </>
  )
}
