import type { Pasarela } from './tipos'
import { PasarelaSimulada } from './simulada'
import { PasarelaStripe } from './stripe'

export type { Pasarela, DatosIntento, Intento, Siguiente } from './tipos'

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

/**
 * A dónde vuelve alguien después de pagar.
 *
 * El destino viaja en la URL, así que lo puede escribir cualquiera. Sin este
 * filtro, un enlace preparado mandaría a la persona —recién salida de pagar
 * y con toda la disposición a creer lo que lea— a una página ajena que imite
 * a la nuestra y le pida "reintentar" con su tarjeta.
 *
 * Solo pasan las rutas de la propia aplicación: una barra y nada más.
 * `//sitio` y `/\sitio` no cuentan, que el navegador los resuelve como
 * direcciones externas aunque empiecen con barra.
 */
export function destinoSeguro(destino: string | undefined | null, porDefecto: string): string {
  if (!destino) return porDefecto
  if (!destino.startsWith('/')) return porDefecto
  if (destino.startsWith('//') || destino.startsWith('/\\')) return porDefecto
  return destino
}

/**
 * La ruta, con el sitio delante.
 *
 * Stripe Checkout exige direcciones completas para volver: con una ruta
 * suelta rechaza la sesión antes de crearla, y el error aparece cuando la
 * persona ya le dio a pagar. Por eso falla aquí y con nombre propio.
 */
export function urlAbsoluta(ruta: string, base = process.env.URL_PUBLICA): string {
  if (/^https?:\/\//.test(ruta)) return ruta
  if (!base) {
    throw new Error('Falta URL_PUBLICA en el .env: Stripe necesita la dirección completa del sitio.')
  }
  return `${base.replace(/\/+$/, '')}${ruta.startsWith('/') ? '' : '/'}${ruta}`
}

/**
 * El nombre que va impreso en el recibo de OXXO.
 *
 * Stripe exige nombre y apellido, cada uno de dos letras para arriba, y
 * rechaza el cobro entero si no los ve. Un alumno capturado como "Juan"
 * —cosa que pasa— se quedaría sin poder pagar en la tienda, y el error
 * saldría en inglés hablando de "first and last name".
 *
 * Así que se completa en vez de fallar: el recibo dice "Juan Alumno", que
 * en la caja de OXXO sirve igual.
 */
export function nombreParaRecibo(nombreCompleto: string): string {
  const limpio = nombreCompleto.trim().replace(/\s+/g, ' ')
  if (!limpio) return 'Alumno Natación'

  const partes = limpio.split(' ').filter((p) => p.length >= 2)
  if (partes.length >= 2) return limpio

  return `${limpio} Alumno`
}

/**
 * El número del intento de pago, sacado de la clave que usa el navegador.
 *
 * La clave del cliente es `pi_xxx_secret_yyy`: adelante del `_secret` va el
 * intento. Sirve para preguntarle a Stripe si el dinero entró en vez de
 * creerle al navegador, que puede decir lo que sea.
 *
 * Devuelve nada si eso no es un intento de pago. Preguntarle a Stripe por
 * una cadena inventada no tiene por qué llegar a intentarse.
 */
export function idDelIntento(claveDelCliente: string): string | null {
  const limpia = (claveDelCliente ?? '').trim()
  if (!limpia.startsWith('pi_')) return null

  const id = limpia.split('_secret')[0]
  // "pi_" a secas no nombra ningún intento.
  return id.length > 3 ? id : null
}
