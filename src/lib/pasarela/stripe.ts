import Stripe from 'stripe'
import type { Pasarela, DatosIntento, Intento, Siguiente } from './tipos'
import { nombreParaRecibo, urlAbsoluta } from './index'

/** La dirección de vuelta, completa y con cómo terminó el cobro. */
function deVuelta(urlRetorno: string, estado: 'listo' | 'cancelado'): string {
  const url = new URL(urlAbsoluta(urlRetorno))
  url.searchParams.set('pago', estado)
  return url.toString()
}

/**
 * Stripe, cobrando sin sacar a nadie de la pantalla.
 *
 * Con intentos de pago y no con Checkout: Checkout se lleva a la persona a
 * otro sitio y devuelve una redirección, y aquí hace falta lo contrario —lo
 * que cada método necesita para terminar el pago, para poder enseñarlo en
 * una ventana nuestra:
 *
 * - Tarjeta: la clave del intento, para montar el campo de Stripe. El
 *   número de tarjeta nunca pasa por nuestro servidor.
 * - OXXO: el recibo con el código de barras que lee la caja de la tienda.
 * - SPEI: la CLABE, el banco y la referencia a los que transferir.
 *
 * En los tres casos, el pago se da por bueno cuando lo avisa el webhook, no
 * cuando la pantalla dice que sí.
 */
const METODOS_STRIPE: Record<string, Stripe.PaymentIntentCreateParams.PaymentMethodData.Type> = {
  TARJETA: 'card',
  SPEI: 'customer_balance',
  OXXO: 'oxxo',
}

export class PasarelaStripe implements Pasarela {
  readonly nombre = 'stripe'
  private readonly stripe: Stripe

  constructor(claveSecreta: string) {
    this.stripe = new Stripe(claveSecreta)
  }

  /**
   * El cliente a cuyo nombre se emite la CLABE.
   *
   * Solo para SPEI: Stripe exige un cliente para cobrar con saldo por
   * transferencia. Se crea con el nombre del alumno, que es lo que la
   * persona verá en su banca al hacer el traspaso.
   */
  private async clienteParaTransferencia(datos: DatosIntento): Promise<string> {
    const cliente = await this.stripe.customers.create({
      name: datos.pagador?.nombre ?? datos.descripcion,
      email: datos.pagador?.correo ?? undefined,
      metadata: { pagoId: datos.pagoId },
    })
    return cliente.id
  }

  /**
   * La página de Stripe, para quien prefiera pagar allá.
   *
   * Es Checkout: la misma pantalla que la gente ya ha visto en otras
   * tiendas. Cobra lo mismo y avisa por el mismo webhook.
   */
  async crearPaginaDePago(datos: DatosIntento): Promise<{ referencia: string; url: string }> {
    const tipo = METODOS_STRIPE[datos.metodo]
    if (!tipo) throw new Error(`Stripe no cobra el método ${datos.metodo}`)

    const sesion = await this.stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: [tipo as Stripe.Checkout.SessionCreateParams.PaymentMethodType],
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
      metadata: { pagoId: datos.pagoId },
      ...(datos.metodo === 'SPEI'
        ? {
            customer: await this.clienteParaTransferencia(datos),
            payment_method_options: {
              customer_balance: {
                funding_type: 'bank_transfer' as const,
                bank_transfer: { type: 'mx_bank_transfer' as const },
              },
            },
          }
        : {}),
      success_url: deVuelta(datos.urlRetorno, 'listo'),
      cancel_url: deVuelta(datos.urlRetorno, 'cancelado'),
    })

    if (!sesion.url) throw new Error('Stripe no devolvió una URL de pago')
    return { referencia: sesion.id, url: sesion.url }
  }

  async crearIntento(datos: DatosIntento): Promise<Intento> {
    const tipo = METODOS_STRIPE[datos.metodo]
    if (!tipo) throw new Error(`Stripe no cobra el método ${datos.metodo}`)

    const comun: Stripe.PaymentIntentCreateParams = {
      amount: datos.monto,
      currency: 'mxn',
      description: datos.descripcion,
      payment_method_types: [tipo],
      // El webhook usa esto para saber qué Pago local confirmar.
      metadata: { pagoId: datos.pagoId },
    }

    if (datos.metodo === 'TARJETA') {
      const intento = await this.stripe.paymentIntents.create(comun)
      if (!intento.client_secret) throw new Error('Stripe no devolvió la clave del intento')
      const clavePublica = process.env.STRIPE_PUBLISHABLE_KEY?.trim()
      if (!clavePublica) {
        throw new Error('Falta STRIPE_PUBLISHABLE_KEY en el .env: sin ella no se puede pedir la tarjeta.')
      }
      return {
        referencia: intento.id,
        siguiente: { tipo: 'TARJETA', claveDelCliente: intento.client_secret, clavePublica },
      }
    }

    if (datos.metodo === 'OXXO') {
      // Se confirma de una vez: el recibo con el código de barras aparece
      // en la respuesta, y es lo único que la persona necesita.
      const intento = await this.stripe.paymentIntents.create({
        ...comun,
        confirm: true,
        payment_method_data: {
          type: 'oxxo',
          billing_details: {
            name: nombreParaRecibo(datos.pagador?.nombre ?? ''),
            email: datos.pagador?.correo ?? 'sin-correo@ejemplo.test',
          },
        },
      })
      const recibo = intento.next_action?.oxxo_display_details
      return {
        referencia: intento.id,
        siguiente: {
          tipo: 'RECIBO',
          url: recibo?.hosted_voucher_url ?? null,
          numero: recibo?.number ?? null,
          vence: recibo?.expires_after
            ? new Date(recibo.expires_after * 1000).toISOString()
            : null,
        },
      }
    }

    // SPEI: la transferencia se hace a una CLABE que Stripe emite para este
    // cobro. Necesita un cliente al cual asignársela.
    const intento = await this.stripe.paymentIntents.create({
      ...comun,
      customer: await this.clienteParaTransferencia(datos),
      confirm: true,
      payment_method_data: { type: 'customer_balance' },
      payment_method_options: {
        customer_balance: {
          funding_type: 'bank_transfer',
          bank_transfer: { type: 'mx_bank_transfer' },
        },
      },
    })

    const instrucciones = intento.next_action?.display_bank_transfer_instructions
    const cuenta = instrucciones?.financial_addresses?.[0]?.spei

    return {
      referencia: intento.id,
      siguiente: {
        tipo: 'TRANSFERENCIA',
        banco: cuenta?.bank_name ?? null,
        clabe: cuenta?.clabe ?? null,
        beneficiario: datos.pagador?.nombre ?? null,
        referencia: instrucciones?.reference ?? null,
      },
    }
  }

  /**
   * Cómo va ese intento, según Stripe.
   *
   * `succeeded` es dinero adentro; `processing` todavía no se sabe, y es
   * lo normal en OXXO y en transferencia. Cualquier otra cosa —cancelado,
   * rechazado, esperando una acción que nadie hizo— no es un pago.
   */
  async estadoDelCobro(referencia: string): Promise<'PAGADO' | 'EN_PROCESO' | 'FALLIDO'> {
    const intento = await this.stripe.paymentIntents.retrieve(referencia)
    if (intento.status === 'succeeded') return 'PAGADO'
    if (intento.status === 'processing') return 'EN_PROCESO'
    return 'FALLIDO'
  }

}
