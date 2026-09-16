import { redirect } from 'next/navigation'
import { enlacesDelPanel } from '@/lib/navegacion'
import { leerSesion } from '@/lib/sesion'

export default async function Inicio() {
  const usuario = await leerSesion()
  if (!usuario) redirect('/acceso')
  redirect(enlacesDelPanel(usuario)[0]?.href ?? '/acceso')
}
