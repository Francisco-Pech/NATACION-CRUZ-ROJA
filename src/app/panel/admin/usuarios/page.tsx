import Link from 'next/link'
import { prisma } from '@/lib/db'
import { leerSesion } from '@/lib/sesion'
import { esRoot, esCorreoDeRoot } from '@/lib/roles'
import FormularioUsuario from './FormularioUsuario'
import FilaUsuario from './FilaUsuario'

export default async function Usuarios() {
  const yo = await leerSesion()
  const soyRoot = esRoot(yo)
  const [usuarios, roles] = await Promise.all([
    prisma.usuario.findMany({
      include: { rol: true },
      orderBy: [{ activo: 'desc' }, { rol: { nombre: 'asc' } }],
    }),
    prisma.rol.findMany({ where: { activo: true }, orderBy: { nombre: 'asc' } }),
  ])

  return (
    <>
      <nav className="subbarra">
        <Link href="/panel/admin">← Panel de control</Link>
      </nav>

      <h1>Usuarios con acceso</h1>
      <p className="silencio">
        Los alumnos no aparecen aquí: ellos entran sin contraseña, con su código QR.
        Esta lista es solo del personal.
      </p>

            <div className="tarjeta">
        <h2>Dar de alta</h2>
        <FormularioUsuario roles={roles.map((r) => ({ hash: r.hash, nombre: r.nombre }))} />
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
                // La cuenta de Root y las de otros Administradores no se
                // editan desde aquí, por lo mismo que no se les quita el
                // acceso. La acción lo vuelve a revisar.
                const editable =
                  (!esLaDeRoot || soyRoot) &&
                  (u.rol.clave !== 'ADMINISTRADOR' || soyRoot || u.id === yo?.id)

                return (
                <tr key={u.id} style={{ opacity: u.activo ? 1 : 0.55 }}>
                  <FilaUsuario
                    id={u.id}
                    nombre={u.nombre + (u.id === yo?.id ? ' (tú)' : '')}
                    email={u.email}
                    rolHash={u.rol.hash}
                    roles={roles.map((r) => ({ hash: r.hash, nombre: r.nombre }))}
                    activo={u.activo}
                    editable={editable}
                    esLaDeRoot={esLaDeRoot}
                    puedeCambiarClave={soyRoot}
                    puedeQuitarAcceso={
                      u.id !== yo?.id &&
                      !esLaDeRoot &&
                      (u.rol.clave !== 'ADMINISTRADOR' || soyRoot)
                    }
                  />
                </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <p className="silencio" style={{ fontSize: '.85rem', marginBottom: 0 }}>
          Nadie puede quitarse el acceso a sí mismo: dejaría el sistema sin quien entre.
          Un Administrador tampoco se lo quita a otro Administrador — eso es de Root.
          {!soyRoot && ' Las contraseñas las cambia Root.'}
        </p>
      </div>
    </>
  )
}
