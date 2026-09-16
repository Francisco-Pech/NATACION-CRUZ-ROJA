import { randomBytes } from 'node:crypto'

/** Cuántos caracteres al azar cierran el folio. */
export const LARGO_AL_AZAR = 8

/**
 * Sin `I`, `O`, `0` ni `1`.
 *
 * El folio va impreso en la credencial y se dicta por teléfono cuando
 * alguien llama a preguntar por su adeudo. Una I y un 1 son la misma raya,
 * y una O y un 0 el mismo óvalo: quien lo teclea mal cree que su folio no
 * existe.
 *
 * Quedan 32 símbolos, que es potencia de dos: cada byte reparte parejo con
 * `% 32` y no hace falta descartar nada.
 */
const ALFABETO = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

/**
 * El folio de una inscripción: `CR` + el año + ocho caracteres al azar.
 *
 * Se genera una sola vez, al dar de alta, y ya no cambia: es el número con
 * el que la delegación se refiere a esa inscripción en papel.
 *
 * Al azar y no consecutivo a propósito. Un `CRM-2026-0042` dice cuánta
 * gente hay inscrita y deja adivinar los folios de los demás con solo
 * sumarle uno.
 */
export function generarFolio(anio: number): string {
  const bytes = randomBytes(LARGO_AL_AZAR)
  let sufijo = ''
  for (const b of bytes) sufijo += ALFABETO[b % ALFABETO.length]
  return `CR${anio}${sufijo}`
}

/**
 * Token aleatorio, nunca derivado del folio: el folio va impreso en la
 * credencial y se dicta en voz alta, y con él cualquiera abriría el estado
 * de cuenta ajeno, que no pide contraseña.
 */
export function generarTokenQR(): string {
  return randomBytes(32).toString('base64url')
}

/**
 * Lo que alguien teclea, convertido en lo que se guardó.
 *
 * El folio se copia de una credencial de papel: llega con minúsculas, con
 * espacios cada cuatro letras o con guiones. Nada de eso es motivo para
 * contestarle que su folio no existe.
 *
 * No se adivinan confusiones —una `O` por un `0`— a propósito: el alfabeto
 * no tiene ninguna de las dos, así que cualquiera de ellas es un error de
 * lectura, y cambiar una por otra llevaría al folio de alguien más.
 */
export function normalizarFolio(tecleado: string): string {
  return tecleado.toUpperCase().replace(/[^A-Z0-9]/g, '')
}
