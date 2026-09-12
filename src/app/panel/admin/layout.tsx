import { redirect } from 'next/navigation'
import Link from 'next/link'
import { leerSesion } from '@/lib/sesion'
import { esAdministrativo } from '@/lib/roles'

export default async function LayoutAdmin({ children }: { children: React.ReactNode }) {
  const usuario = await leerSesion()
  if (!usuario) redirect('/acceso')
  // Capturista opera el día a día; la configuración es del Administrador y Root.
  if (!esAdministrativo(usuario)) redirect('/panel')

  return (
    <>
      {children}
    </>
  )
}
