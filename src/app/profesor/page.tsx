import { redirect } from 'next/navigation'
import { leerSesion } from '@/lib/sesion'
import { salir } from '../acciones-acceso'
import Escaner from './escaner'

export default async function PaginaProfesor() {
  const usuario = await leerSesion()
  if (!usuario) redirect('/acceso')

  return (
    <>
      <nav className="barra">
        <span className="marca">🏊 Control de acceso</span>
        <span style={{ opacity: .8, fontSize: '.85rem' }}>{usuario.nombre}</span>
        <form action={salir}>
          <button type="submit" className="boton tenue" style={{ padding: '.3rem .7rem' }}>Salir</button>
        </form>
      </nav>
      <div className="contenedor angosto">
        <Escaner />
      </div>
    </>
  )
}
