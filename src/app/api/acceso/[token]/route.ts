import { NextResponse } from 'next/server'
import { leerSesion } from '@/lib/sesion'
import { verificarAcceso } from '@/lib/servicios/estado-cuenta'

/**
 * Consulta de puerta. Exige sesión del personal y devuelve solo el
 * semáforo: nunca importes, teléfonos ni datos fiscales.
 */
export async function GET(_peticion: Request, { params }: { params: Promise<{ token: string }> }) {
  const usuario = await leerSesion()
  if (!usuario) {
    return NextResponse.json({ error: 'Sesión requerida' }, { status: 401 })
  }

  const { token } = await params
  const resultado = await verificarAcceso(token)
  if (!resultado) {
    return NextResponse.json({ error: 'Credencial no encontrada' }, { status: 404 })
  }

  return NextResponse.json(resultado)
}
