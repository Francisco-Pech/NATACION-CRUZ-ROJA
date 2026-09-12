'use client'

import { useActionState, useState } from 'react'
import { entrar } from '../acciones-acceso'

export default function FormularioAcceso() {
  const [error, accion, enviando] = useActionState(entrar, null)
  const [correo, setCorreo] = useState('')
  const [clave, setClave] = useState('')
  const [verClave, setVerClave] = useState(false)

  // Entrar se habilita solo con ambos campos llenos: así nadie manda el
  // formulario a medias y se lleva un "correo o contraseña incorrectos"
  // que no explica nada.
  const listo = correo.trim() !== '' && clave !== ''

  return (
    <form action={accion}>
      <label htmlFor="email">Correo electrónico</label>
      <input
        id="email"
        name="email"
        type="email"
        autoComplete="username"
        autoFocus
        value={correo}
        onChange={(e) => setCorreo(e.target.value)}
      />

      <label htmlFor="clave">Contraseña</label>
      <div className="campo-con-boton">
        <input
          id="clave"
          name="clave"
          type={verClave ? 'text' : 'password'}
          autoComplete="current-password"
          value={clave}
          onChange={(e) => setClave(e.target.value)}
        />
        <button
          type="button"
          className="ver-clave"
          onClick={() => setVerClave((v) => !v)}
          aria-pressed={verClave}
          aria-label={verClave ? 'Ocultar la contraseña' : 'Mostrar la contraseña'}
          title={verClave ? 'Ocultar la contraseña' : 'Mostrar la contraseña'}
        >
          {verClave ? 'Ocultar' : 'Mostrar'}
        </button>
      </div>

      {error && <div className="error">{error}</div>}

      <button
        className="boton"
        type="submit"
        disabled={enviando || !listo}
        style={{ width: '100%', marginTop: '1rem' }}
      >
        {enviando ? 'Entrando…' : 'Entrar'}
      </button>

      {!listo && !error && (
        <p className="silencio" style={{ fontSize: '.82rem', textAlign: 'center', marginBottom: 0 }}>
          Escribe tu correo y tu contraseña para continuar.
        </p>
      )}
    </form>
  )
}
