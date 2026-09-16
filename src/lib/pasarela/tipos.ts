import type { MetodoPago } from '@prisma/client'

export type DatosIntento = {
  /** Id del Pago local; viaja a la pasarela para reconciliar al confirmar. */
  pagoId: string
  /** Lo que paga la persona, en centavos, con la comisión ya trasladada. */
  monto: number
  metodo: MetodoPago
  descripcion: string
  urlRetorno: string
  /**
   * Quién paga. Lo usa la transferencia SPEI, que necesita un cliente a
   * nombre de quien emitir la CLABE, y el recibo de OXXO, que sale con el
   * nombre de quien va a la tienda.
   */
  pagador?: { nombre: string; correo: string | null }
}

/**
 * Cómo se termina de pagar, según el método.
 *
 * Cada forma de pago acaba en otra cosa: la tarjeta pide los datos de la
 * tarjeta, OXXO entrega un recibo con código de barras y la transferencia
 * entrega una CLABE. Antes todo era una redirección a la página de Stripe;
 * ahora cada una devuelve lo suyo para poder enseñarlo sin sacar a la
 * persona de la pantalla.
 */
export type Siguiente =
  /** La tarjeta se captura en un campo de Stripe montado en nuestra ventana. */
  | { tipo: 'TARJETA'; claveDelCliente: string; clavePublica: string }
  /** OXXO: el recibo con el código de barras que lee la caja. */
  | { tipo: 'RECIBO'; url: string | null; numero: string | null; vence: string | null }
  /** SPEI: a qué cuenta transferir. */
  | {
      tipo: 'TRANSFERENCIA'
      banco: string | null
      clabe: string | null
      beneficiario: string | null
      referencia: string | null
    }
  /** La pasarela de demostración, que no cobra: su pantalla de siempre. */
  | { tipo: 'DEMOSTRACION'; url: string }

export type Intento = {
  /** Id que devuelve la pasarela. Es la llave para confirmar después. */
  referencia: string
  siguiente: Siguiente
}

/**
 * Una pasarela de cobro. Existen dos implementaciones —simulada y Stripe—
 * para que el resto del sistema no sepa cuál está activa: el flujo, los
 * estados y la confirmación son idénticos en ambas.
 */
export interface Pasarela {
  readonly nombre: string
  crearIntento(datos: DatosIntento): Promise<Intento>
  /**
   * La página de cobro de la pasarela, para quien prefiera pagar allá.
   *
   * Existe como salida: hay gente que no le teclea su tarjeta a una página
   * que no conoce, y con razón. La de Stripe la reconocen, y ahí se puede
   * pagar lo mismo. La pasarela de demostración no la tiene.
   */
  crearPaginaDePago?(datos: DatosIntento): Promise<{ referencia: string; url: string }>
  /**
   * Cómo va un cobro, preguntándoselo a la pasarela.
   *
   * Es lo que deja cerrar la tarjeta en el acto: el navegador dice "ya
   * terminé" y el servidor viene aquí a preguntar si el dinero entró de
   * verdad. Nunca se le cree al navegador, que puede decir cualquier cosa.
   *
   * OXXO y transferencia no lo usan: ahí no hay nada que preguntar
   * todavía, y quien avisa es el webhook firmado, horas o días después.
   */
  estadoDelCobro?(referencia: string): Promise<'PAGADO' | 'EN_PROCESO' | 'FALLIDO'>
}
