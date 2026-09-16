'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/db'
import { hashPassword } from '@/lib/auth'
import { esCorreoDeRoot, esRoot } from '@/lib/roles'
import { validarClaves } from '@/lib/claves'
import { puedeOtorgar } from '@/lib/permisos'
import { exigirAdministrador, exigirPermiso, exigirRoot, falla, texto, numero } from './guardas'
import type { Resultado } from './guardas'
import { calcularFechaLimite } from '@/lib/dias-habiles'
import { festivosQueCuentan } from '@/lib/dias-inhabiles'

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
  const actor = await exigirPermiso('USUARIOS')
  const nombre = texto(datos, 'nombre')
  const email = texto(datos, 'email').toLowerCase()
  const clave = String(datos.get('clave') ?? '')

  if (!nombre || !email) return 'Falta el nombre o el correo.'
  const malaClave = validarClaves(clave, String(datos.get('confirmacion') ?? ''))
  if (malaClave) return malaClave

  const rol = await prisma.rol.findUnique({ where: { hash: texto(datos, 'rol') } })
  if (!rol || !rol.activo) return 'Escoge un rol válido.'

  // Root se reconoce por su correo. Si alguien pudiera darse de alta con él,
  // se volvería Root sin que nadie se lo otorgara: es la única puerta que
  // deja abierta reconocer a Root fuera de la base, y aquí se cierra.
  if (esCorreoDeRoot(email)) return 'Ese correo está reservado.'

  // Nadie regala una llave que no tiene: si no, quien administra usuarios
  // se crearía una cuenta con más permisos que los suyos.
  if (!puedeOtorgar(actor, rol.permisos)) {
    return `No puedes crear usuarios con el rol ${rol.nombre}: tiene permisos que tú no tienes.`
  }

  const existe = await prisma.usuario.findUnique({ where: { email } })
  if (existe) return 'Ya hay un usuario con ese correo.'

  await prisma.usuario.create({
    data: { nombre, email, rolId: rol.id, passwordHash: await hashPassword(clave) },
  })
  revalidatePath('/panel/admin/usuarios')
  return null
}

/**
 * Cambia el nombre, el correo o el rol de alguien.
 *
 * El correo es la llave con la que entra: si se lo das a alguien que ya lo
 * tiene, el otro se queda sin poder entrar. Por eso se revisa que esté
 * libre, sin contar al propio usuario que se está editando.
 */
export async function actualizarUsuario(_previo: Resultado, datos: FormData): Promise<Resultado> {
  const actor = await exigirPermiso('USUARIOS')
  const id = texto(datos, 'id')
  const nombre = texto(datos, 'nombre')
  const email = texto(datos, 'email').toLowerCase()

  const no = (mensaje: string): Resultado => ({ ok: false, mensaje })

  if (!nombre || !email) return no('Falta el nombre o el correo.')

  const usuario = await prisma.usuario.findUnique({ where: { id }, include: { rol: true } })
  if (!usuario) return no('Ese usuario ya no existe.')

  // La cuenta de Root no se edita desde el panel.
  if (esCorreoDeRoot(usuario.email) && !esRoot(actor)) {
    return no('No puedes editar esa cuenta.')
  }
  // Un Administrador no le mueve los datos a otro Administrador, por lo
  // mismo que no puede quitarle el acceso.
  if (usuario.rol.clave === 'ADMINISTRADOR' && usuario.id !== actor.id && !esRoot(actor)) {
    return no('No puedes editar a otro Administrador.')
  }
  // Nadie se vuelve Root cambiándose el correo: Root se reconoce por ese
  // dato, así que sería otorgarse el poder completo desde esta pantalla.
  if (esCorreoDeRoot(email) && !esCorreoDeRoot(usuario.email)) {
    return no('Ese correo está reservado.')
  }

  const ocupado = await prisma.usuario.findFirst({
    where: { email, NOT: { id: usuario.id } },
  })
  if (ocupado) return no(`Ya hay un usuario con el correo ${email}.`)

  const rol = await prisma.rol.findUnique({ where: { hash: texto(datos, 'rol') } })
  if (!rol || !rol.activo) return no('Escoge un rol válido.')
  if (!puedeOtorgar(actor, rol.permisos)) {
    return no(`No puedes asignar el rol ${rol.nombre}: tiene permisos que tú no tienes.`)
  }

  await prisma.usuario.update({ where: { id: usuario.id }, data: { nombre, email, rolId: rol.id } })
  revalidatePath('/panel/admin/usuarios')
  return { ok: true, mensaje: `Se guardaron los datos de ${nombre}.` }
}

export async function cambiarEstadoUsuario(_previo: Resultado, datos: FormData): Promise<Resultado> {
  const admin = await exigirAdministrador()
  const id = texto(datos, 'id')
  const no = (mensaje: string): Resultado => ({ ok: false, mensaje })

  // Nadie puede desactivarse a sí mismo: dejaría el sistema sin quien entre.
  if (id === admin.id) return no('No puedes quitarte el acceso a ti mismo.')

  const usuario = await prisma.usuario.findUniqueOrThrow({
    where: { id },
    include: { rol: true },
  })
  // La cuenta de Root no se desactiva desde el panel: es la única con poderes
  // completos, y apagarla dejaría al sistema sin quien los ejerza.
  if (esCorreoDeRoot(usuario.email)) return no('Esa cuenta no se desactiva desde el panel.')

  // Un Administrador no le quita el acceso a otro Administrador. Entre pares
  // sería una pelea que gana quien pique primero, y el sistema se puede
  // quedar sin nadie que configure. Root sí puede: está por encima.
  if (usuario.rol.clave === 'ADMINISTRADOR' && !esRoot(admin)) {
    return no('No puedes quitarle el acceso a otro Administrador.')
  }

  await prisma.usuario.update({ where: { id }, data: { activo: !usuario.activo } })
  revalidatePath('/panel/admin/usuarios')
  // `usuario.activo` es como estaba antes del cambio.
  return {
    ok: true,
    mensaje: usuario.activo
      ? `${usuario.nombre} ya no tiene acceso.`
      : `${usuario.nombre} vuelve a tener acceso.`,
  }
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
