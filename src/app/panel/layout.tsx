import { redirect } from 'next/navigation'
import { leerSesion } from '@/lib/sesion'
import { salir } from '../acciones-acceso'
import { esAdministrativo, esRoot } from '@/lib/roles'
import BarraLateral from './BarraLateral'

const ROL_LEGIBLE: Record<string, string> = {
  ADMINISTRADOR: 'Administrador',
  CAPTURISTA: 'Capturista',
  PROFESOR: 'Profesor',
}

export default async function LayoutPanel({ children }: { children: React.ReactNode }) {
  const usuario = await leerSesion()
  if (!usuario) redirect('/acceso')
  // Root nunca se rebota: puede todo lo que puede cualquier otro.
  if (usuario.rol === 'PROFESOR' && !esRoot(usuario)) redirect('/profesor')

  const esAdmin = esAdministrativo(usuario)

  return (
    <div className="disposicion">
      <BarraLateral
        usuario={{
          nombre: usuario.nombre,
          rol: esRoot(usuario) ? 'Root' : ROL_LEGIBLE[usuario.rol],
        }}
        esAdmin={esAdmin}
        salir={salir}
      />

      <main className="principal">
        <div className="contenedor">{children}</div>
      </main>
    </div>
  )
}
