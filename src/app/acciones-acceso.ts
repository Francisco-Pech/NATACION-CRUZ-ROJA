'use server'

import { redirect } from 'next/navigation'
import { prisma } from '@/lib/db'
import { verificarPassword } from '@/lib/auth'
import { crearSesion, cerrarSesion, leerSesion } from '@/lib/sesion'

export async function entrar(_previo: string | null, datos: FormData): Promise<string | null> {
  const email = String(datos.get('email') ?? '').trim().toLowerCase()
  const clave = String(datos.get('clave') ?? '')

  if (!email || !clave) return 'Escribe tu correo y tu contraseña.'

  const usuario = await prisma.usuario.findUnique({ where: { email } })
  // Mismo mensaje en ambos casos: decir "ese correo no existe" le confirma
  // a quien prueba contraseñas cuáles cuentas son reales.
  if (!usuario || !usuario.activo || !(await verificarPassword(clave, usuario.passwordHash))) {
    return 'Correo o contraseña incorrectos.'
  }

  await crearSesion(usuario.id)
  redirect(usuario.rol === 'PROFESOR' ? '/profesor' : '/panel')
}

export async function salir() {
  await cerrarSesion()
  redirect('/acceso')
}

export async function sesionActual() {
  return leerSesion()
}
