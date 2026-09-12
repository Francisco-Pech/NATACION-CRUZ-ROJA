'use client'

import { useActionState, useState } from 'react'
import { restablecerClave } from '../acciones'
import CampoClave from '@/components/CampoClave'

/**
 * Cambiar la contraseña de alguien más. Solo Root.
 *
 * Cambiarle la contraseña a otro es poder entrar como él, sin que quede
 * rastro de que no fue esa persona. La pantalla lo esconde y la acción lo
 * exige por separado: quien llegue por otro camino tampoco puede.
 */
export default function FormularioClave({ id, nombre }: { id: string; nombre: string }) {
  const [error, accion, enviando] = useActionState(restablecerClave, null)
  const [abierto, setAbierto] = useState(false)

  if (!abierto) {
    return (
      <button
        className="boton tenue" onClick={() => setAbierto(true)}
        style={{ padding: '.3rem .7rem' }}
      >
        Cambiar
      </button>
    )
  }

  return (
    <form action={accion}>
      <input type="hidden" name="id" value={id} />
      <div className="fila" style={{ alignItems: 'flex-end', gap: '.5rem' }}>
        <CampoClave id={`clave-${id}`} deshabilitado={enviando} />
        <button className="boton" type="submit" disabled={enviando}>
          {enviando ? 'Guardando…' : 'Guardar'}
        </button>
        <button type="button" className="boton tenue" onClick={() => setAbierto(false)}>
          Cancelar
        </button>
      </div>
      {error && <div className="error">{error}</div>}
      <p className="silencio" style={{ fontSize: '.8rem', margin: '.4rem 0 0' }}>
        Anótala y entrégasela a <strong>{nombre}</strong> en persona: el sistema no manda
        correos.
      </p>
    </form>
  )
}
