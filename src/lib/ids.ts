import { randomBytes } from 'node:crypto'

/**
 * El identificador que sí puede salir a la pantalla y a los endpoints.
 *
 * El problema que resuelve: si un formulario lleva el id de la base, basta
 * cambiar el 6 por el 5 para editar —o borrar— un renglón que no te tocaba.
 * Y como los ids van en orden, quien vea uno sabe que existen los de antes.
 *
 * Este no se adivina ni se recorre: son 18 bytes al azar, 144 bits. Se
 * guarda en su columna al crear el registro y ya no cambia nunca, así que
 * un enlace sigue sirviendo mañana.
 */

/** 18 bytes en base64url dan exactamente 24 caracteres, sin relleno. */
export const LARGO_HASH = 24

export function nuevoHash(): string {
  return randomBytes(18).toString('base64url')
}
