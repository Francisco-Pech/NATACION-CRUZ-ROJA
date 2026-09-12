import Stripe from 'stripe'
import type { Pasarela, DatosIntento, Intento } from './tipos'
import type { MetodoPago } from '@prisma/client'

/** Cada método nuestro se traduce al identificador que Stripe espera. */
const METODOS_STRIPE: Record<string, Stripe.Checkout.SessionCreateParams.PaymentMethodType[]> = {
  TARJETA: ['card'],
  SPEI: ['customer_balance'],
  OXXO: ['oxxo'],
}

export class PasarelaStripe implements Pasarela {
  readonly nombre = 'stripe'
  private readonly stripe: Stripe

  constructor(claveSecreta: string) {
    this.stripe = new Stripe(claveSecreta)
  }

  async crearIntento(datos: DatosIntento): Promise<Intento> {
    const tipos = METODOS_STRIPE[datos.metodo as MetodoPago]
    if (!tipos) throw new Error(`Stripe no cobra el método ${datos.metodo}`)

    const sesion = await this.stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: tipos,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: 'mxn',
            unit_amount: datos.monto,
            product_data: { name: datos.descripcion },
          },
        },
      ],
      // El webhook usa esto para saber qué Pago local confirmar.
      metadata: { pagoId: datos.pagoId },
      success_url: datos.urlRetorno,
      cancel_url: datos.urlRetorno,
    })

    if (!sesion.url) throw new Error('Stripe no devolvió una URL de pago')

    return { referencia: sesion.id, urlPago: sesion.url }
  }
}
