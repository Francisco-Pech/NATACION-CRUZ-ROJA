import type { MetodoPago } from '@prisma/client'

export type DatosIntento = {
  /** Id del Pago local; viaja a la pasarela para reconciliar al confirmar. */
  pagoId: string
  /** Lo que paga la persona, en centavos, con la comisión ya trasladada. */
  monto: number
  metodo: MetodoPago
  descripcion: string
  urlRetorno: string
}

export type Intento = {
  /** Id que devuelve la pasarela. Es la llave para confirmar después. */
  referencia: string
  /** A dónde se manda al alumno para pagar. */
  urlPago: string
}

/**
 * Una pasarela de cobro. Existen dos implementaciones —simulada y Stripe—
 * para que el resto del sistema no sepa cuál está activa: el flujo, los
 * estados y la confirmación son idénticos en ambas.
 */
export interface Pasarela {
  readonly nombre: string
  crearIntento(datos: DatosIntento): Promise<Intento>
}
