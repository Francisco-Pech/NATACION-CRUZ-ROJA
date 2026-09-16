import { redirect } from 'next/navigation'
import Link from 'next/link'
import { leerSesion } from '@/lib/sesion'
import { esAdministrativo } from '@/lib/permisos'

export default async function LayoutAdmin({ children }: { children: React.ReactNode }) {
  const usuario = await leerSesion()
  if (!usuario) redirect('/acceso')
  // La configuración es de quien tenga permiso de configurar. Un rol nuevo
  // que lo tenga entra igual: para eso se pueden crear.
  if (!esAdministrativo(usuario)) redirect('/panel')

  return (
    <>
      {children}
    </>
  )
}
