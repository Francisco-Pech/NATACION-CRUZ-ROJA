import type { TipoDescuento } from '@prisma/client'
import { pesos } from '@/lib/formato'

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

/**
 * Cuánto rebaja un descuento, escrito como se lee.
 *
 * El monto fijo vive en centavos, como todo el dinero del sistema: sacarlo
 * tal cual a la pantalla convertiría un descuento de cien pesos en uno de
 * diez mil.
 */
export function comoSeLeeDescuento(d: { tipo: TipoDescuento; valor: number }): string {
  return d.tipo === 'PORCENTAJE' ? `${d.valor}%` : pesos(d.valor)
}

/**
 * El nombre con lo que rebaja al lado.
 *
 * Quien captura no se sabe de memoria cuánto quita cada uno, y escoger
 * "Especial" sin saber si son veinte o cien por ciento es escoger a ciegas.
 */
export function conValor(d: { nombre: string; tipo: TipoDescuento; valor: number }): string {
  return `${d.nombre} · ${comoSeLeeDescuento(d)}`
}

/**
 * ¿Este descuento le toca al alumno en el mes que se está cobrando?
 *
 * Aquí se resuelve "¿cuánto le dura?". La vigencia se guarda en la
 * inscripción, no en el catálogo: el catálogo dice qué es INAPAM, la
 * inscripción dice desde y hasta cuándo se le reconoce a esta persona.
 *
 * Se pregunta por el mes entero y no por un día, porque el cobro es mensual:
 * una cortesía del 15 de septiembre cubre la mensualidad de septiembre y se
 * acaba ahí. Partirle el mes a la mitad daría una cantidad que nadie sabría
 * explicar en el mostrador.
 *
 * Las dos fechas pueden faltar. Sin ninguna vale siempre, que es el caso de
 * INAPAM: mientras tenga la credencial, la tiene.
 */
export function descuentoCubreElMes(
  vigencia: { desde: Date | null; hasta: Date | null },
  anio: number,
  mes: number,
): boolean {
  const primerDia = new Date(anio, mes - 1, 1, 0, 0, 0)
  // El día 0 del mes siguiente es el último del mes que se cobra, sin tener
  // que saberse cuántos trae febrero.
  const ultimoDia = new Date(anio, mes, 0, 23, 59, 59)

  if (vigencia.desde && vigencia.desde > ultimoDia) return false
  if (vigencia.hasta && vigencia.hasta < primerDia) return false
  return true
}
