type ConCorreo = { email: string }

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
  usuario: ConCorreo | null | undefined,
  rootEmail = process.env.ROOT_EMAIL,
): boolean {
  return esCorreoDeRoot(usuario?.email, rootEmail)
}
