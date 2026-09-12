'use client'

import { useActionState, useState } from 'react'
import { guardarUsuario } from '../acciones'

export default function FormularioUsuario({ puedeCrearAdmin }: { puedeCrearAdmin: boolean }) {
  const [error, accion, enviando] = useActionState(guardarUsuario, null)
  const [verClave, setVerClave] = useState(false)

  return (
    <form action={accion}>
      <div className="fila" style={{ alignItems: 'flex-end' }}>
        <div style={{ flex: '2 1 180px' }}>
          <label htmlFor="nombre">Nombre</label>
          <input id="nombre" name="nombre" required />
        </div>
        <div style={{ flex: '2 1 200px' }}>
          <label htmlFor="email">Correo</label>
          <input id="email" name="email" type="email" required />
        </div>
        <div style={{ flex: '1 1 150px' }}>
          <label htmlFor="rol">Rol</label>
          <select id="rol" name="rol" defaultValue="CAPTURISTA" required>
            <option value="CAPTURISTA">Capturista</option>
            <option value="PROFESOR">Profesor</option>
            {puedeCrearAdmin && <option value="ADMINISTRADOR">Administrador</option>}
          </select>
        </div>
        <div style={{ flex: '2 1 200px' }}>
          <label htmlFor="clave">Contraseña</label>
          <div className="campo-con-boton">
            <input id="clave" name="clave" type={verClave ? 'text' : 'password'} minLength={8} required />
            <button
              type="button" className="ver-clave" onClick={() => setVerClave((v) => !v)}
              aria-pressed={verClave} aria-label={verClave ? 'Ocultar' : 'Mostrar'}
            >
              {verClave ? 'Ocultar' : 'Mostrar'}
            </button>
          </div>
        </div>
        <button className="boton" type="submit" disabled={enviando}>
          {enviando ? 'Guardando…' : 'Crear'}
        </button>
      </div>
      {error && <div className="error">{error}</div>}
      <p className="silencio" style={{ fontSize: '.82rem', marginBottom: 0 }}>
        Mínimo 8 caracteres. Anótala y entrégasela en persona: el sistema no manda correos.
      </p>
    </form>
  )
}
