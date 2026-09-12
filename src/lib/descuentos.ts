/**
 * Las reglas de un descuento: hasta cuándo vale y cuántas veces se puede dar.
 *
 * Las dos son opcionales. Los que hay hoy no tienen ninguna: valen siempre y
 * sin tope. Poder ponerlas no quiere decir que haya que ponerlas.
 */

export const TOPES_DESCUENTO = {
  // Más de 100 % no es un descuento mayor: sería devolverle dinero a quien
  // viene a pagar.
  PORCENTAJE: { min: 1, max: 100, campo: 'El porcentaje' },
  MONTO_FIJO: { min: 1, max: 100_000, campo: 'El monto' },
} as const

/**
 * ¿Tiene sentido el rango de vigencia?
 *
 * Cualquiera de las dos puede faltar: solo el inicio quiere decir "de esta
 * fecha en adelante", y solo el fin, "hasta esta fecha".
 */
export function validarVigencia(desde: Date | null, hasta: Date | null): string | null {
  if (!desde || !hasta) return null
  // El mismo día en las dos es válido: un descuento de un día existe.
  if (hasta < desde) return 'La vigencia termina antes de empezar.'
  return null
}

/**
 * ¿Tiene sentido el límite de usos?
 *
 * `entregados` es cuántas inscripciones ya lo llevan. Bajar el límite por
 * debajo de eso no se lo quita a nadie —ya está aplicado— pero dejaría la
 * cuenta en un estado imposible, con más entregados que permitidos.
 */
export function validarLimite(limite: number | null, entregados: number): string | null {
  if (limite === null) return null
  if (!Number.isFinite(limite)) return 'El límite no es un número.'
  if (!Number.isInteger(limite)) return 'El límite tiene que ser un número entero.'
  if (limite < 1) {
    return 'El límite tiene que ser de al menos 1. Para cerrarlo, desactiva el descuento.'
  }
  if (limite < entregados) {
    return `El límite no puede ser menor a lo que ya se dio: ya se dio ${entregados} ${
      entregados === 1 ? 'vez' : 'veces'
    }.`
  }
  return null
}
