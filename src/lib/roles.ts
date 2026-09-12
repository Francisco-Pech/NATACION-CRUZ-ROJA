import type { Rol } from '@prisma/client'

type ConCorreo = { email: string }
type ConRol = ConCorreo & { rol: Rol }

const normalizar = (valor: string | null | undefined) => (valor ?? '').trim().toLowerCase()

/**
 * Root no es un rol guardado en la base: se reconoce comparando el correo
 * contra ROOT_EMAIL. Por eso nadie puede otorgárselo desde la pantalla de
 * usuarios — no hay columna que editar.
 *
 * Falla cerrado: sin ROOT_EMAIL configurado, no hay root. Nunca al revés.
 */
export function esCorreoDeRoot(
  email: string | null | undefined,
  rootEmail = process.env.ROOT_EMAIL,
): boolean {
  const root = normalizar(rootEmail)
  if (!root) return false
  return normalizar(email) === root
}

/** Acepta la sesión completa: solo mira el correo, el rol le da igual. */
export function esRoot(
  usuario: ConCorreo | ConRol | null | undefined,
  rootEmail = process.env.ROOT_EMAIL,
): boolean {
  return esCorreoDeRoot(usuario?.email, rootEmail)
}

/** Quién entra a la configuración: el Administrador y Root. */
export function esAdministrativo(
  usuario: ConRol | null | undefined,
  rootEmail = process.env.ROOT_EMAIL,
): boolean {
  if (!usuario) return false
  return usuario.rol === 'ADMINISTRADOR' || esRoot(usuario, rootEmail)
}

/**
 * Quién puede dar de alta a quién. El Administrador levanta personal de piso
 * —capturistas y profesores—, pero crear a alguien de su mismo nivel es de
 * Root: si no, cualquier administrador se multiplicaría solo.
 */
export function puedeAsignarRol(
  actor: ConRol | null | undefined,
  rolDestino: Rol,
  rootEmail = process.env.ROOT_EMAIL,
): boolean {
  if (!esAdministrativo(actor, rootEmail)) return false
  if (rolDestino === 'ADMINISTRADOR') return esRoot(actor, rootEmail)
  return true
}
