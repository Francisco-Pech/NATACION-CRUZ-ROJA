'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { confirmarPagoDeTarjeta } from './acciones'
import {
  CardCvcElement,
  CardExpiryElement,
  CardNumberElement,
  Elements,
  useElements,
  useStripe,
} from '@stripe/react-stripe-js'
import { loadStripe } from '@stripe/stripe-js'

/**
 * La tarjeta, dentro de nuestra ventana y con cuatro campos.
 *
 * Nombre del titular, número, vencimiento y CVV: lo que viene impreso en el
 * plástico y nada más. El formulario armado de Stripe pide además el país y
 * el código postal, y ofrece billeteras: en una mensualidad de natación eso
 * es una pantalla más larga sin ninguna ganancia.
 *
 * Los tres campos sensibles los dibuja Stripe, cada uno en su propio marco
 * aislado: el número de tarjeta no pasa por nuestro servidor ni un instante,
 * ni siquiera por nuestro JavaScript. Nosotros solo tenemos la clave del
 * intento, que no sirve para cobrar de más ni para ver la tarjeta.
 *
 * Con tarjeta el cobro se cierra en el momento: cuando Stripe responde
 * que pasó, el servidor le pregunta a Stripe si el dinero entró y marca el
 * mes. Este formulario no da nada por bueno; solo avisa que hay algo que
 * revisar.
 */
export default function PagoConTarjeta({
  folio,
  claveDelCliente,
  clavePublica,
  total,
  cerrarAqui,
  alTerminar,
}: {
  folio: string
  claveDelCliente: string
  clavePublica: string
  total: string
  /** A dónde vuelve si decide no pagar. */
  cerrarAqui: string
  alTerminar: (mensaje: string) => void
}) {
  const stripe = loadStripe(clavePublica)

  return (
    <Elements stripe={stripe} options={{ locale: 'es-419' }}>
      <Formulario
        folio={folio} claveDelCliente={claveDelCliente} total={total}
        cerrarAqui={cerrarAqui} alTerminar={alTerminar}
      />
    </Elements>
  )
}

/** Para que los campos de Stripe se vean como los nuestros. */
const PINTA = {
  style: {
    base: {
      fontSize: '16px',
      color: '#111827',
      fontFamily: 'inherit',
      '::placeholder': { color: '#9ca3af' },
    },
    invalid: { color: '#b91c1c' },
  },
}

function Formulario({
  folio,
  claveDelCliente,
  total,
  cerrarAqui,
  alTerminar,
}: {
  folio: string
  claveDelCliente: string
  total: string
  cerrarAqui: string
  alTerminar: (mensaje: string) => void
}) {
  const router = useRouter()
  const stripe = useStripe()
  const elements = useElements()
  const [titular, setTitular] = useState('')
  const [cobrando, setCobrando] = useState(false)
  const [fallo, setFallo] = useState<string | null>(null)

  async function cobrar(e: React.FormEvent) {
    e.preventDefault()
    if (!stripe || !elements) return

    const numero = elements.getElement(CardNumberElement)
    if (!numero) return

    if (!titular.trim()) {
      setFallo('Escribe el nombre del titular, como viene en la tarjeta.')
      return
    }

    setCobrando(true)
    setFallo(null)

    const { error, paymentIntent } = await stripe.confirmCardPayment(claveDelCliente, {
      payment_method: {
        card: numero,
        billing_details: { name: titular.trim() },
      },
    })

    if (error) {
      // El mensaje de Stripe ya viene en español y dice lo que de verdad
      // pasó —fondos, banco, tarjeta vencida—: escribir uno propio sería
      // decirle menos.
      setFallo(error.message ?? 'No se pudo cobrar la tarjeta.')
      setCobrando(false)
      return
    }

    if (paymentIntent?.status === 'succeeded') {
      // El servidor le pregunta a Stripe y marca el mes. No se le cree a
      // esta pantalla: aquí solo se avisa que hay algo que revisar.
      const { pagado } = await confirmarPagoDeTarjeta(folio, claveDelCliente)
      if (pagado) {
        // Sin ventana que cerrar: el cobro terminó, así que se vuelve a la
        // cuenta con el recado arriba y los meses ya releídos. Dejar un
        // modal con un botón "Cerrar" era pedirle un clic más a alguien
        // que ya terminó de pagar.
        router.push(`/pago/${folio}?bien=${encodeURIComponent('Listo, tu mes quedó pagado con tarjeta.')}`)
        router.refresh()
        return
      }

      // Stripe dijo que pasó pero el cobro todavía no queda marcado. No se
      // le promete nada a nadie: el aviso firmado lo va a cerrar solo.
      alTerminar('Tu pago se registró. En cuanto se confirme, tu mes queda cubierto.')
      return
    }

    alTerminar('Tu pago quedó en proceso. En cuanto se confirme, tu mes queda cubierto.')
  }

  return (
    <form onSubmit={cobrar}>
      <label htmlFor="titular">Nombre del titular</label>
      <input
        id="titular"
        value={titular}
        onChange={(e) => setTitular(e.target.value)}
        placeholder="Como viene en la tarjeta"
        autoComplete="cc-name"
        required
      />

      <label htmlFor="numero-tarjeta">Número de tarjeta</label>
      <div className="campo-stripe" id="numero-tarjeta">
        <CardNumberElement options={{ ...PINTA, showIcon: true }} />
      </div>

      <div className="fila" style={{ gap: '.6rem' }}>
        <div style={{ flex: 1 }}>
          <label htmlFor="vence-tarjeta">Vencimiento</label>
          <div className="campo-stripe" id="vence-tarjeta">
            <CardExpiryElement options={PINTA} />
          </div>
        </div>
        <div style={{ flex: 1 }}>
          <label htmlFor="cvv-tarjeta">CVV</label>
          <div className="campo-stripe" id="cvv-tarjeta">
            <CardCvcElement options={PINTA} />
          </div>
        </div>
      </div>

      {fallo && <p className="error" style={{ marginTop: '.7rem' }}>{fallo}</p>}

      {/* Quién cobra se dice una vez, abajo de la ventana: repetirlo aquí
          era decirlo dos veces seguidas. */}
      <p className="silencio" style={{ fontSize: '.8rem', margin: '.8rem 0 0' }}>
        Tus datos de tarjeta no pasan por la delegación ni se guardan aquí.
      </p>

      {/* Cerrar al lado de Pagar, a su derecha: los dos botones de esta
          ventana viven juntos. */}
      <div className="fila" style={{ justifyContent: 'flex-end', marginTop: '.6rem' }}>
        <button className="boton" type="submit" disabled={!stripe || cobrando}>
          {cobrando ? 'Cobrando…' : `Pagar ${total}`}
        </button>
        <a className="boton tenue" href={cerrarAqui}>Cerrar</a>
      </div>
    </form>
  )
}
