import { MetodoPago } from '@prisma/client'

/**
 * Todas las formas de pago se pueden escoger al cobrar.
 *
 * Sin distinción de rol. Quien está en la ventanilla necesita poder anotar
 * lo que de verdad pasó: alguien pagó en OXXO y el cobro tarda tres días en
 * reflejarse, o mandó la transferencia por correo. Esconderle opciones lo
 * empujaría a anotar "efectivo" para salir del paso, y entonces la factura
 * saldría diciendo algo que no ocurrió.
 *
 * Lo que da cuentas no es la lista corta: es que cada pago diga quién lo
 * marcó. Eso vive en `registradoPor`, y en un cobro de la pasarela va vacío
 * justamente porque no lo marcó nadie.
 */
export const METODOS_PARA_ANOTAR: MetodoPago[] = Object.values(MetodoPago)

/**
 * ¿Tiene sentido pedir una referencia?
 *
 * Solo donde hay un folio impreso que copiar: el ticket de la ventanilla y
 * el del OXXO. En una transferencia o un cobro con tarjeta el dato que
 * importa ya viene en el comprobante, y un campo de texto libre al lado solo
 * invita a escribir cualquier cosa.
 */
export function pideReferencia(metodo: MetodoPago): boolean {
  return metodo === MetodoPago.EFECTIVO || metodo === MetodoPago.OXXO
}

/**
 * ¿Este renglón lo escribió la pasarela?
 *
 * Lo dice el folio de Stripe, no la forma de pago. Un OXXO capturado a mano
 * lo escribió una persona —y una persona pudo equivocarse—, así que se
 * corrige. Uno que trae folio de Stripe dice lo que Stripe reportó cuando el
 * dinero se movió de verdad.
 */
export function loEscribioLaPasarela(pago: { stripePaymentIntentId: string | null }): boolean {
  return pago.stripePaymentIntentId !== null
}

/**
 * ¿Se puede corregir este pago?
 *
 * Lo que la pasarela ya comprobó, no: cambiarlo a mano pondría al sistema
 * diciendo que un alumno pagó cuando el banco dice que no, y esa diferencia
 * no se nota hasta el corte del mes. Si un cobro de la pasarela está mal, se
 * arregla en la pasarela y el sistema se entera por ahí.
 */
export function sePuedeCorregir(pago: { stripePaymentIntentId: string | null }): boolean {
  return !loEscribioLaPasarela(pago)
}
