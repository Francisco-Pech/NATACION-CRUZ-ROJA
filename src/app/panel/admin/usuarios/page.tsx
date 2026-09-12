import Link from 'next/link'
import { prisma } from '@/lib/db'
import { leerSesion } from '@/lib/sesion'
import { esRoot, esCorreoDeRoot } from '@/lib/roles'
import { cambiarEstadoUsuario } from '../acciones'
import FormularioUsuario from './FormularioUsuario'
import FormularioClave from './FormularioClave'

const DESCRIPCION_ROL: Record<string, string> = {
  ADMINISTRADOR: 'Todo, incluida esta configuración',
  CAPTURISTA: 'Alumnos, cobros, lockers y credenciales',
  PROFESOR: 'Solo escanear el QR y pasar asistencia',
}

const PESTANAS = [
  { clave: 'usuarios', titulo: 'Usuarios' },
  { clave: 'roles', titulo: 'Roles' },
] as const

export default async function Usuarios({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>
}) {
  const pedido = await searchParams
  const cual = PESTANAS.some((p) => p.clave === pedido.tab) ? pedido.tab! : 'usuarios'
  const yo = await leerSesion()
  const soyRoot = esRoot(yo)
  const usuarios = await prisma.usuario.findMany({ orderBy: [{ activo: 'desc' }, { rol: 'asc' }] })

  return (
    <>
      <h1>Usuarios con acceso</h1>
      <p className="silencio">
        Los alumnos no aparecen aquí: ellos entran sin contraseña, con su código QR.
        Esta lista es solo del personal.
      </p>

      <nav className="pestanas no-imprimir">
        {PESTANAS.map((p) => (
          <Link
            key={p.clave}
            href={`/panel/admin/usuarios?tab=${p.clave}`}
            className={`pestana${cual === p.clave ? ' activa' : ''}`}
          >
            {p.titulo}
          </Link>
        ))}
      </nav>

      {cual === 'roles' && (
      <div className="tarjeta">
        <h2>Qué puede hacer cada rol</h2>
        <div className="tabla-ancha">
          <table>
            <tbody>
              {Object.entries(DESCRIPCION_ROL).map(([rol, que]) => (
                <tr key={rol}>
                  <td style={{ width: 160 }}><strong>{rol === 'ADMINISTRADOR' ? 'Administrador' : rol === 'CAPTURISTA' ? 'Capturista' : 'Profesor'}</strong></td>
                  <td className="silencio">{que}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="silencio" style={{ fontSize: '.85rem', marginBottom: 0 }}>
          El profesor nunca ve importes, teléfonos, domicilios ni datos fiscales.
          Solo <strong>Root</strong> puede cambiarle la contraseña a alguien más:
          hacerlo es poder entrar como esa persona, sin que quede rastro de que no
          fue ella.
        </p>
      </div>
      )}

      {cual === 'usuarios' && (
      <>
      <div className="tarjeta">
        <h2>Dar de alta</h2>
        <FormularioUsuario puedeCrearAdmin={soyRoot} />
      </div>

      <div className="tarjeta">
        <div className="tabla-ancha">
          <table>
            <thead>
              <tr>
                <th>Nombre</th><th>Correo</th><th>Rol</th><th>Estado</th>
                {soyRoot && <th>Contraseña</th>}
                <th></th>
              </tr>
            </thead>
            <tbody>
              {usuarios.map((u) => {
                // La cuenta de Root no se toca desde aquí, salvo por él mismo.
                const esLaDeRoot = esCorreoDeRoot(u.email)

                return (
                <tr key={u.id} style={{ opacity: u.activo ? 1 : 0.55 }}>
                  <td>
                    {u.nombre}
                    {u.id === yo?.id && <span className="silencio"> (tú)</span>}
                  </td>
                  <td className="silencio">{u.email}</td>
                  <td>
                    {esLaDeRoot
                      ? 'Root'
                      : u.rol === 'ADMINISTRADOR' ? 'Administrador' : u.rol === 'CAPTURISTA' ? 'Capturista' : 'Profesor'}
                  </td>
                  <td>
                    <span className={`insignia ${u.activo ? 'VERDE' : 'GRIS'}`}>
                      {u.activo ? 'activo' : 'sin acceso'}
                    </span>
                  </td>
                  {soyRoot && (
                    <td>
                      <FormularioClave id={u.id} nombre={u.nombre} />
                    </td>
                  )}
                  <td className="derecha">
                    {u.id === yo?.id || esLaDeRoot ? (
                      <span className="silencio" style={{ fontSize: '.8rem' }}>—</span>
                    ) : (
                      <form action={cambiarEstadoUsuario}>
                        <input type="hidden" name="id" value={u.id} />
                        <button className="boton tenue" type="submit" style={{ padding: '.3rem .7rem' }}>
                          {u.activo ? 'Quitar acceso' : 'Dar acceso'}
                        </button>
                      </form>
                    )}
                  </td>
                </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <p className="silencio" style={{ fontSize: '.85rem', marginBottom: 0 }}>
          Nadie puede quitarse el acceso a sí mismo: dejaría el sistema sin quien entre.
          {!soyRoot && ' Las contraseñas las cambia Root.'}
        </p>
      </div>
      </>
      )}
    </>
  )
}
