'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/db'
import { hashPassword } from '@/lib/auth'
import { esCorreoDeRoot, puedeAsignarRol } from '@/lib/roles'
import { validarClaves } from '@/lib/claves'
import { exigirAdministrador, exigirRoot, falla, texto, numero } from './guardas'
import type { Resultado } from './guardas'
import { calcularFechaLimite } from '@/lib/dias-habiles'
import { festivosQueCuentan } from '@/lib/dias-inhabiles'
import { Rol } from '@prisma/client'

// ------------------------------------------------------------ calendario

/**
 * Vuelve a calcular la fecha límite de los meses que aún no cierran.
 *
 * Cambiar el calendario mueve el 5.º día hábil. Los periodos ya cerrados no
 * se tocan: su fecha límite es historia.
 */
export async function recalcularFechasLimite() {
  const calendario = await prisma.diaInhabil.findMany()
  const periodos = await prisma.periodo.findMany({
    where: { estado: 'ABIERTO' },
    include: { ciclo: true },
  })
  for (const periodo of periodos) {
    // Los festivos se resuelven por año: los que se repiten caen distinto
    // en cada uno.
    const festivos = festivosQueCuentan(calendario, periodo.ciclo.anio)
    const nueva = calcularFechaLimite(periodo.ciclo.anio, periodo.mes, 5, festivos)
    if (nueva.getTime() !== periodo.fechaLimite.getTime()) {
      await prisma.periodo.update({ where: { id: periodo.id }, data: { fechaLimite: nueva } })
    }
  }
  revalidatePath('/panel')
}

// -------------------------------------------------------------- usuarios

export async function guardarUsuario(_previo: string | null, datos: FormData): Promise<string | null> {
  const actor = await exigirAdministrador()
  const nombre = texto(datos, 'nombre')
  const email = texto(datos, 'email').toLowerCase()
  const clave = String(datos.get('clave') ?? '')
  const rol = texto(datos, 'rol') as Rol

  if (!nombre || !email) return 'Falta el nombre o el correo.'
  const malaClave = validarClaves(clave, String(datos.get('confirmacion') ?? ''))
  if (malaClave) return malaClave
  if (!Object.values(Rol).includes(rol)) return 'Rol no válido.'

  // Root se reconoce por su correo. Si alguien pudiera darse de alta con él,
  // se volvería Root sin que nadie se lo otorgara: es la única puerta que
  // deja abierta reconocer a Root fuera de la base, y aquí se cierra.
  if (esCorreoDeRoot(email)) return 'Ese correo está reservado.'
  if (!puedeAsignarRol(actor, rol)) return 'No puedes crear usuarios con ese rol.'

  const existe = await prisma.usuario.findUnique({ where: { email } })
  if (existe) return 'Ya hay un usuario con ese correo.'

  await prisma.usuario.create({ data: { nombre, email, rol, passwordHash: await hashPassword(clave) } })
  revalidatePath('/panel/admin/usuarios')
  return null
}

export async function cambiarEstadoUsuario(datos: FormData) {
  const admin = await exigirAdministrador()
  const id = texto(datos, 'id')
  // Nadie puede desactivarse a sí mismo: dejaría el sistema sin quien entre.
  if (id === admin.id) return

  const usuario = await prisma.usuario.findUniqueOrThrow({ where: { id } })
  // La cuenta de Root no se desactiva desde el panel: es la única con poderes
  // completos, y apagarla dejaría al sistema sin quien los ejerza.
  if (esCorreoDeRoot(usuario.email)) return

  await prisma.usuario.update({ where: { id }, data: { activo: !usuario.activo } })
  revalidatePath('/panel/admin/usuarios')
}

/**
 * Cambia la contraseña de alguien. Solo Root.
 *
 * Cambiarle la contraseña a otro es poder entrar como él: un Administrador
 * podía tomar la cuenta de otro Administrador, o la de cualquiera, sin que
 * quedara rastro de que no fue esa persona quien entró. Quien la necesita
 * de vuelta se la pide a Root.
 */
export async function restablecerClave(_previo: string | null, datos: FormData): Promise<string | null> {
  await exigirRoot()
  const id = texto(datos, 'id')
  const clave = String(datos.get('clave') ?? '')
  const mala = validarClaves(clave, String(datos.get('confirmacion') ?? ''))
  if (mala) return mala

  const destino = await prisma.usuario.findUniqueOrThrow({ where: { id } })
  await prisma.usuario.update({ where: { id }, data: { passwordHash: await hashPassword(clave) } })
  revalidatePath('/panel/admin/usuarios')
  return null
}

// ------------------------------------------------------------- comisiones
