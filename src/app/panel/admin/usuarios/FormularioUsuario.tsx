'use client'

import { useActionState } from 'react'
import { guardarUsuario } from '../acciones'
import CampoClave from '@/components/CampoClave'

export default function FormularioUsuario({ roles }: { roles: Array<{ hash: string; nombre: string }> }) {
  const [error, accion, enviando] = useActionState(guardarUsuario, null)

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
          <select id="rol" name="rol" required>
            {roles.map((r) => (
              <option key={r.hash} value={r.hash}>{r.nombre}</option>
            ))}
          </select>
        </div>
        <CampoClave deshabilitado={enviando} />
        <button className="boton" type="submit" disabled={enviando}>
          {enviando ? 'Guardando…' : 'Crear'}
        </button>
      </div>
      {error && <div className="error">{error}</div>}
      <p className="silencio" style={{ fontSize: '.82rem', marginBottom: 0 }}>
        Mínimo 8 caracteres. Anótala y entrégasela en persona: el sistema no manda correos. El botón de generar evita letras que se confundan al leerlas —ni ele, ni uno, ni o, ni cero.
      </p>
    </form>
  )
}
