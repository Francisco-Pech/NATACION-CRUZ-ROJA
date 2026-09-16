import type { MetodoPago } from '@prisma/client'

export type ConfigMetodo = {
  metodo: MetodoPago
  porcentaje: number
  montoFijo: number
  iva: number
  activo: boolean
  diasCorteAntesDeVencimiento: number
}

export type MetodoDisponible = {
  metodo: MetodoPago
  etiqueta: string
  enLinea: boolean
  config: ConfigMetodo
}

/** Los que se cobran por la pasarela; el resto se paga en persona. */
const EN_LINEA: MetodoPago[] = ['TARJETA', 'SPEI', 'OXXO'] as MetodoPago[]

export const ETIQUETA_METODO: Record<string, string> = {
  EFECTIVO: 'Efectivo en recepción',
  TRANSFERENCIA: 'Transferencia directa',
  TARJETA: 'Tarjeta de crédito o débito',
  SPEI: 'Transferencia en línea (SPEI)',
  OXXO: 'Pago en efectivo en OXXO',
}

const DIA_EN_MS = 24 * 60 * 60 * 1000

/**
 * Qué formas de pago se le pueden ofrecer al alumno en este momento.
 *
 * OXXO tarda en confirmarse, así que se retira durante los días previos al
 * vencimiento: pagarlo ahí el mismo día del límite no alcanzaría a reflejarse
 * y la persona quedaría marcada como morosa sin deberlo. Una vez vencido el
 * cargo vuelve a ofrecerse, porque ya no hay plazo que perder.
 */
export function metodosDisponibles(
  configuraciones: ConfigMetodo[],
  fechaLimite: Date,
  ahora: Date = new Date(),
): MetodoDisponible[] {
  return configuraciones
    .filter((config) => {
      if (!config.activo) return false

      const dias = config.diasCorteAntesDeVencimiento
      if (dias <= 0) return true

      const vencido = ahora > fechaLimite
      if (vencido) return true

      const corte = new Date(fechaLimite.getTime() - dias * DIA_EN_MS)
      return ahora <= corte
    })
    .map((config) => ({
      metodo: config.metodo,
      etiqueta: ETIQUETA_METODO[config.metodo] ?? config.metodo,
      enLinea: EN_LINEA.includes(config.metodo),
      config,
    }))
}

/**
 * Cuánto tarda en verse el pago, según por dónde entró.
 *
 * Se le dice antes de pagar, no después. Quien transfiere y ve su mes
 * todavía en rojo concluye que algo salió mal, y lo que hace entonces es
 * volver a pagar o llamar a la delegación: dos problemas que se evitan con
 * una línea de texto.
 *
 * `null` para lo que se cobra en la ventanilla: ahí el recibo se entrega en
 * el momento y no hay nada que esperar.
 */
export function cuandoSeRefleja(metodo: MetodoPago | string): string | null {
  if (metodo === 'TARJETA') return 'Se refleja al momento.'
  if (metodo === 'SPEI') {
    return 'Normalmente en una hora, y a más tardar en un día hábil.'
  }
  if (metodo === 'OXXO') return 'Tarda de 1 a 3 días hábiles.'
  return null
}

/**
 * ¿Todavía se puede pagar ese mes por la pantalla?
 *
 * Solo dentro de sus cinco días hábiles. Pasada la fecha límite el cobro en
 * línea se cierra y la persona tiene que pasar a la delegación: ahí se le
 * calcula el recargo y se le cobra en la ventanilla, con alguien enfrente
 * que puede explicarle por qué ahora debe más.
 *
 * La fecha límite viene al final del día, así que el quinto día hábil cuenta
 * completo: quien paga a las once de la noche llegó a tiempo.
 *
 * Adelantar sigue valiendo. El mes que entra tiene su límite por delante, y
 * esta regla no lo toca.
 */
export function sePuedePagarEnLinea(fechaLimite: Date, ahora: Date = new Date()): boolean {
  return ahora <= fechaLimite
}
