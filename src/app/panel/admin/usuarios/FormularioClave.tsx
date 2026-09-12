'use client'

import { useActionState, useState } from 'react'
import { restablecerClave } from '../acciones'

export default function FormularioClave({ id }: { id: string }) {
  const [error, accion, enviando] = useActionState(restablecerClave, null)
  const [abierto, setAbierto] = useState(false)

  if (!abierto) {
    return (
      <button className="boton tenue" onClick={() => setAbierto(true)} style={{ padding: '.3rem .7rem' }}>
        Cambiar
      </button>
    )
  }

  return (
    <form action={accion} className="fila" style={{ gap: '.35rem' }}>
      <input type="hidden" name="id" value={id} />
      <input name="clave" type="text" minLength={8} placeholder="Nueva contraseña" style={{ width: 165 }} required />
      <button className="boton" type="submit" disabled={enviando} style={{ padding: '.3rem .7rem' }}>
        {enviando ? '…' : 'Guardar'}
      </button>
      {error && <span className="silencio" style={{ fontSize: '.78rem', color: '#b91c1c' }}>{error}</span>}
    </form>
  )
}
