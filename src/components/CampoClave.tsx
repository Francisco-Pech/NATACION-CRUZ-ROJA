'use client'

import { useState } from 'react'
import { generarClave } from '@/lib/claves'

/**
 * Contraseña y confirmación, con un botón para generar una al azar.
 *
 * La generada se muestra en claro a propósito: el sistema no manda correos,
 * así que hay que poder leerla para anotarla y entregarla en persona.
 * Esconderla obligaría a copiarla a ciegas.
 */
export default function CampoClave({
  id = 'clave',
  deshabilitado = false,
}: {
  id?: string
  deshabilitado?: boolean
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

  return (
    <>
      <div style={{ flex: '2 1 210px' }}>
        <label htmlFor={id}>Contraseña</label>
        <div className="campo-con-boton">
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
            type="button" className="ver-clave" onClick={() => setVer((v) => !v)}
            aria-pressed={ver} aria-label={ver ? 'Ocultar' : 'Mostrar'}
          >
            {ver ? 'Ocultar' : 'Mostrar'}
          </button>
        </div>
      </div>

      <div style={{ flex: '2 1 210px' }}>
        <label htmlFor={`${id}-confirmacion`}>Confirmar</label>
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
        {noCoinciden && (
          <span className="sobre-cupo" style={{ fontSize: '.78rem' }}>No coinciden</span>
        )}
      </div>

      <button
        type="button" className="boton tenue" onClick={generar} disabled={deshabilitado}
        title="Genera una contraseña al azar, sin letras que se confundan al leerlas"
      >
        Generar
      </button>
    </>
  )
}
