import { redirect } from 'next/navigation'
import { leerSesion } from '@/lib/sesion'

export default async function Inicio() {
  const usuario = await leerSesion()
  if (!usuario) redirect('/acceso')
  redirect(usuario.rol === 'PROFESOR' ? '/profesor' : '/panel')
}
