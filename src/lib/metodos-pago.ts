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
