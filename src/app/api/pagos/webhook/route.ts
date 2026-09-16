import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { confirmarCobro, rechazarCobro } from '@/lib/servicios/cobro-en-linea'

/**
 * Avisos de Stripe. Es la única vía por la que un pago en línea se da por
 * bueno: nunca se confía en que el navegador del alumno regrese a la página
 * de éxito, porque eso se puede falsificar escribiendo la URL a mano.
 *
 * La firma se verifica siempre. Sin STRIPE_WEBHOOK_SECRET no se procesa nada.
 */
export async function POST(peticion: Request) {
  const claveSecreta = process.env.STRIPE_SECRET_KEY
  const secretoWebhook = process.env.STRIPE_WEBHOOK_SECRET

  if (!claveSecreta || !secretoWebhook) {
    return NextResponse.json({ error: 'Stripe no está configurado' }, { status: 503 })
  }

  const firma = peticion.headers.get('stripe-signature')
  if (!firma) {
    return NextResponse.json({ error: 'Falta la firma' }, { status: 400 })
  }

  const cuerpo = await peticion.text()
  const stripe = new Stripe(claveSecreta)

  let evento: Stripe.Event
  try {
    evento = stripe.webhooks.constructEvent(cuerpo, firma, secretoWebhook)
  } catch {
    // Firma inválida: el aviso no viene de Stripe.
    return NextResponse.json({ error: 'Firma inválida' }, { status: 400 })
  }

  switch (evento.type) {
    // El cobro entró. Con OXXO y con transferencia esto llega horas o días
    // después de que la persona cerró la pantalla: es el único momento en
    // que el mes puede darse por pagado.
    case 'payment_intent.succeeded': {
      const intento = evento.data.object as Stripe.PaymentIntent
      await confirmarCobro(intento.id)
      break
    }

    // No entró: tarjeta rechazada, recibo de OXXO vencido sin pagar,
    // transferencia que nunca llegó. El cargo queda como estaba.
    case 'payment_intent.payment_failed':
    case 'payment_intent.canceled': {
      const intento = evento.data.object as Stripe.PaymentIntent
      await rechazarCobro(intento.id)
      break
    }

    // Los cobros hechos con Checkout: quedan de antes, y hay que seguir
    // atendiéndolos mientras exista alguno sin resolver.
    case 'checkout.session.completed':
    case 'checkout.session.async_payment_succeeded': {
      const sesion = evento.data.object as Stripe.Checkout.Session
      await confirmarCobro(sesion.id)
      break
    }
    case 'checkout.session.async_payment_failed':
    case 'checkout.session.expired': {
      const sesion = evento.data.object as Stripe.Checkout.Session
      await rechazarCobro(sesion.id)
      break
    }

    default:
      // El resto de eventos no nos interesan.
      break
  }

  return NextResponse.json({ recibido: true })
}
