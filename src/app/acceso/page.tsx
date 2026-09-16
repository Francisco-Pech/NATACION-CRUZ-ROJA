import { redirect } from 'next/navigation'
import { enlacesDelPanel } from '@/lib/navegacion'
import { leerSesion } from '@/lib/sesion'
import FormularioAcceso from './formulario'

export default async function PaginaAcceso() {
  const usuario = await leerSesion()
  if (usuario) redirect(enlacesDelPanel(usuario)[0]?.href ?? '/acceso')

  return (
    <div className="contenedor angosto" style={{ paddingTop: '3rem' }}>
      <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
        <div style={{ fontSize: '2rem' }}>🏊</div>
        <h1>Escuela de Natación</h1>
        <p className="silencio">Cruz Roja Mexicana · Delegación Cancún</p>
      </div>
      <div className="tarjeta">
        <FormularioAcceso />
      </div>
      <p className="silencio" style={{ fontSize: '.85rem', textAlign: 'center' }}>
        ¿Eres alumno? No necesitas cuenta: escanea el código QR de tu credencial.
      </p>
    </div>
  )
}
