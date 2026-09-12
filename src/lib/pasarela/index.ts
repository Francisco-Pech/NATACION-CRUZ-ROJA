import type { Pasarela } from './tipos'
import { PasarelaSimulada } from './simulada'
import { PasarelaStripe } from './stripe'

export type { Pasarela, DatosIntento, Intento } from './tipos'

/**
 * Devuelve la pasarela activa. Mientras no haya llaves de Stripe, corre la
 * simulada: así se puede ver y demostrar el flujo completo sin cuenta.
 * Para activar el cobro real basta poner STRIPE_SECRET_KEY en el .env.
 */
export function pasarelaActiva(): Pasarela {
  const clave = process.env.STRIPE_SECRET_KEY
  if (clave && clave.trim() !== '') return new PasarelaStripe(clave)
  return new PasarelaSimulada()
}

export function usandoStripe(): boolean {
  return pasarelaActiva().nombre === 'stripe'
}
