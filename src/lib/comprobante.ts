/**
 * El comprobante de un pago: la foto del ticket o el PDF del banco.
 *
 * Hace falta sobre todo para OXXO, que tarda hasta tres días en reflejarse.
 * La persona llega con su ticket en el teléfono, el mostrador lo guarda junto
 * al pago, y el día que alguien pregunte "¿de verdad pagó?" la respuesta está
 * en el renglón y no en la memoria de quien lo anotó.
 */

/** Cinco megas: una foto de teléfono cabe de sobra y no llena la base. */
export const MAXIMO_COMPROBANTE = 5 * 1024 * 1024

/**
 * Lo que se acepta.
 *
 * Solo imágenes y PDF, y esto no es cosmético: el archivo se sirve de vuelta
 * al navegador desde el panel. Aceptar cualquier tipo dejaría guardar un HTML
 * con script y abrirlo después desde una sesión con permisos.
 */
export const TIPOS_COMPROBANTE = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'application/pdf',
] as const

export function validarComprobante(
  archivo: { tipo: string; tamano: number } | null,
): string | null {
  // Subirlo es opcional: un efectivo recibido en la mano no tiene ticket.
  if (!archivo) return null

  if (archivo.tamano === 0) return 'Ese archivo está vacío.'

  if (!TIPOS_COMPROBANTE.includes(archivo.tipo as (typeof TIPOS_COMPROBANTE)[number])) {
    return 'El comprobante tiene que ser una foto o un PDF.'
  }

  if (archivo.tamano > MAXIMO_COMPROBANTE) {
    const mb = Math.round(MAXIMO_COMPROBANTE / 1024 / 1024)
    return `Ese archivo pesa de más: el tope son ${mb} MB.`
  }

  return null
}
