'use client'

import { useActionState } from 'react'
import { actualizarUsuario, cambiarEstadoUsuario } from '../acciones'
import { IconoGuardar, IconoDesactivar } from '@/components/Iconos'
import Alerta from '@/components/Alerta'
import FormularioClave from './FormularioClave'

/**
 * Un renglón de la tabla de usuarios, editable en su sitio.
 *
 * Toda la fila vive en un solo componente —los campos y sus botones— porque
 * el botón tiene que saber si su formulario está enviando. Partido en dos,
 * la rueda de carga no se enteraba y se podía picar dos veces.
 */
export default function FilaUsuario({
  id,
  nombre,
  email,
  rolHash,
  roles,
  activo,
  editable,
  esLaDeRoot = false,
  puedeQuitarAcceso,
  puedeCambiarClave,
}: {
  id: string
  nombre: string
  email: string
  rolHash: string
  roles: Array<{ hash: string; nombre: string }>
  activo: boolean
  editable: boolean
  /** La cuenta de Root: su rol no se escoge, puede todo. */
  esLaDeRoot?: boolean
  puedeQuitarAcceso: boolean
  puedeCambiarClave: boolean
}) {
  const [avisoGuardar, guardar, guardando] = useActionState(actualizarUsuario, null)
  const [avisoEstado, cambiarEstado, cambiando] = useActionState(cambiarEstadoUsuario, null)
  const ocupado = guardando || cambiando
  // Sale flotando y no bajo la fila: dentro de la tabla empujaba el renglón.
  const aviso = guardando || cambiando ? null : (avisoGuardar ?? avisoEstado)

  const nombreDelRol = roles.find((r) => r.hash === rolHash)?.nombre ?? '—'

  return (
    <>
      <td>
        {editable ? (
          <>
            <form id={`usuario-${id}`} action={guardar} />
            <input type="hidden" name="id" value={id} form={`usuario-${id}`} />
            <input
              name="nombre" defaultValue={nombre} required disabled={ocupado}
              form={`usuario-${id}`} aria-label={`Nombre de ${nombre}`}
            />
          </>
        ) : (
          nombre
        )}
      </td>

      <td>
        {editable ? (
          <input
            name="email" type="email" defaultValue={email} required disabled={ocupado}
            form={`usuario-${id}`} aria-label={`Correo de ${nombre}`}
          />
        ) : (
          <span className="silencio">{email}</span>
        )}
      </td>

      <td>
        {esLaDeRoot ? (
          <>
            {/* Root no tiene rol que escoger: puede todo, y no por lo que
                diga una columna. Se manda el que trae para no perderlo. */}
            {editable && (
              <input type="hidden" name="rol" value={rolHash} form={`usuario-${id}`} />
            )}
            <strong>Root</strong>
          </>
        ) : editable ? (
          <select
            name="rol" defaultValue={rolHash} required disabled={ocupado}
            form={`usuario-${id}`} aria-label={`Rol de ${nombre}`}
          >
            {roles.map((r) => (
              <option key={r.hash} value={r.hash}>{r.nombre}</option>
            ))}
          </select>
        ) : (
          nombreDelRol
        )}
      </td>

      <td>
        <span className={`insignia ${activo ? 'VERDE' : 'GRIS'}`}>
          {activo ? 'activo' : 'sin acceso'}
        </span>
      </td>

      {puedeCambiarClave && (
        <td>
          <FormularioClave id={id} nombre={nombre} />
        </td>
      )}

      <td>
        <div className="acciones-fila">
          {editable && (
            <button
              className="boton tenue con-icono" type="submit" form={`usuario-${id}`}
              disabled={ocupado} style={{ padding: '.35rem .8rem' }}
            >
              {guardando ? <span className="girando" /> : <IconoGuardar tamano={15} />}
              {guardando ? 'Guardando…' : 'Guardar'}
            </button>
          )}
          {puedeQuitarAcceso && (
            <form action={cambiarEstado}>
              <input type="hidden" name="id" value={id} />
              {/* Rojo solo al quitar: devolverle el acceso a alguien no es
                  destructivo y no debe alarmar. */}
              <button
                className={`boton con-icono ${activo ? 'peligro' : 'tenue'}`}
                type="submit" disabled={ocupado} style={{ padding: '.35rem .8rem' }}
              >
                {cambiando ? <span className="girando" /> : <IconoDesactivar tamano={15} />}
                {cambiando ? 'Guardando…' : activo ? 'Quitar acceso' : 'Dar acceso'}
              </button>
            </form>
          )}
        </div>
        <Alerta resultado={aviso} />
      </td>
    </>
  )
}
