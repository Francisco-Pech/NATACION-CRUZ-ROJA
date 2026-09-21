'use client'

import { useActionState } from 'react'
import { darDeAltaSolicitud, descartarSolicitud } from './solicitudes-acciones'
import BotonConfirmar from '@/components/BotonConfirmar'
import type { Resultado } from '../admin/catalogo/tipos'

export type Solicitud = {
  hash: string
  nombreCompleto: string
  correo: string | null
  curso: string
  horario: string
  dias: string
  locker: number | null
  /** Cuándo llegó, ya escrito: "18 de septiembre". */
  cuando: string
  /** Si ya hay un alumno inscrito con ese mismo nombre. */
  yaExiste: boolean
}

/**
 * Lo que llegó por el formulario abierto, esperando que alguien lo revise.
 *
 * Cada renglón se atiende de una de dos maneras y ninguna se puede deshacer
 * desde aquí: se da de alta —y entonces nace el alumno, con folio y con sus
 * meses— o se descarta.
 *
 * El aviso de "ya hay un alumno con ese nombre" es lo que evita el
 * duplicado más común: alguien que ya está inscrito y vuelve a llenar el
 * formulario porque no sabe que ya quedó.
 */
export default function TablaSolicitudes({ solicitudes }: { solicitudes: Solicitud[] }) {
  if (solicitudes.length === 0) {
    return (
      <div className="tarjeta">
        <p style={{ margin: 0 }}>No hay solicitudes pendientes.</p>
        <p className="silencio" style={{ fontSize: '.86rem', marginBottom: 0 }}>
          Aquí aparece quien se registra en la página de inscripción.
        </p>
      </div>
    )
  }

  return (
    <div className="tarjeta">
      <div className="tabla-scroll">
        <table className="tabla">
          <thead>
            <tr>
              <th>Alumno</th>
              <th>Curso y horario</th>
              <th>Locker</th>
              <th>Llegó</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {solicitudes.map((s) => (
              <FilaSolicitud key={s.hash} solicitud={s} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function FilaSolicitud({ solicitud }: { solicitud: Solicitud }) {
  const [alta, darDeAlta, dando] = useActionState(darDeAltaSolicitud, null)
  const [descarte, descartar, descartando] = useActionState(descartarSolicitud, null)
  const resultado: Resultado = alta ?? descarte
  const trabajando = dando || descartando

  return (
    <>
      <tr>
        <td>
          <strong>{solicitud.nombreCompleto}</strong>
          {solicitud.correo && (
            <div className="silencio" style={{ fontSize: '.82rem' }}>{solicitud.correo}</div>
          )}
          {solicitud.yaExiste && (
            <div style={{ fontSize: '.8rem', color: '#b45309' }}>
              Ya hay un alumno con este nombre
            </div>
          )}
        </td>
        <td>
          {solicitud.curso}
          <div className="silencio" style={{ fontSize: '.82rem' }}>
            {solicitud.horario} · {solicitud.dias}
          </div>
        </td>
        <td>{solicitud.locker ? `Locker ${solicitud.locker}` : <span className="silencio">Sin locker</span>}</td>
        <td className="silencio" style={{ fontSize: '.85rem' }}>{solicitud.cuando}</td>
        <td>
          <div className="fila" style={{ justifyContent: 'flex-end', gap: '.4rem' }}>
            {/* Las dos preguntan antes: una crea un alumno con su folio y
                le manda un correo, la otra deja fuera a alguien que se
                registró. Ninguna se deshace desde aquí. */}
            <form action={darDeAlta}>
              <input type="hidden" name="hash" value={solicitud.hash} />
              <BotonConfirmar
                className="boton"
                deshabilitado={trabajando}
                titulo={`¿Dar de alta a ${solicitud.nombreCompleto}?`}
                confirmar="Sí, darlo de alta"
                detalle={
                  <>
                    Queda inscrito en <strong>{solicitud.curso}</strong> de{' '}
                    {solicitud.horario} ({solicitud.dias}), con su folio y sus meses por
                    cobrar.
                    {solicitud.locker && <> Se le aparta el locker {solicitud.locker}.</>}
                    {solicitud.correo
                      ? <> Se le avisa a <strong>{solicitud.correo}</strong>.</>
                      : <> No dejó correo: tendrás que dictarle su folio.</>}
                  </>
                }
              >
                {dando ? 'Dando de alta…' : 'Dar de alta'}
              </BotonConfirmar>
            </form>
            <form action={descartar}>
              <input type="hidden" name="hash" value={solicitud.hash} />
              <BotonConfirmar
                className="boton tenue"
                deshabilitado={trabajando}
                titulo={`¿Descartar la solicitud de ${solicitud.nombreCompleto}?`}
                confirmar="Sí, descartarla"
                detalle={
                  <>
                    No se crea ningún alumno y la solicitud sale de esta lista. No se le
                    avisa nada a quien la mandó.
                  </>
                }
              >
                {descartando ? 'Espera…' : 'Descartar'}
              </BotonConfirmar>
            </form>
          </div>
        </td>
      </tr>
      {resultado && (
        <tr>
          <td colSpan={5}>
            <div className={resultado.ok ? 'aviso' : 'error'}>{resultado.mensaje}</div>
          </td>
        </tr>
      )}
    </>
  )
}
