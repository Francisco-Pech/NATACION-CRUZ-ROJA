import { redirect } from 'next/navigation'
import { leerSesion } from '@/lib/sesion'
import { salir } from '../acciones-acceso'
import { esRoot } from '@/lib/roles'
import { esAdministrativo } from '@/lib/permisos'
import { enlacesDelPanel } from '@/lib/navegacion'
import BarraLateral from './BarraLateral'

export default async function LayoutPanel({ children }: { children: React.ReactNode }) {
  const usuario = await leerSesion()
  if (!usuario) redirect('/acceso')

  // Entra quien tenga al menos una sección. Antes se exigía VER_PANEL, que
  // dejaba fuera al Capturista —que no ve el Tablero pero sí todo lo demás—
  // y al Profesor, que entra a pasar lista.
  const enlaces = enlacesDelPanel(usuario)
  if (enlaces.length === 0) redirect('/acceso')

  const esAdmin = esAdministrativo(usuario)

  return (
    <div className="disposicion">
      <BarraLateral
        usuario={{
          nombre: usuario.nombre,
          rol: esRoot(usuario) ? 'Root' : usuario.rol.nombre,
        }}
        enlaces={enlaces.map(({ href, texto }) => ({ href, texto }))}
        salir={salir}
      />

      <main className="principal">
        <div className="contenedor">{children}</div>
      </main>
    </div>
  )
}
