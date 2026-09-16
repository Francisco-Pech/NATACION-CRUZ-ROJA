import { EstadoPago } from '@prisma/client'
import type { ColorSemaforo } from '@/lib/servicios/estado-cuenta'

/**
 * Cómo se lee el estado de un pago.
 *
 * No es el mismo que el del cargo: el cargo dice si el mes está saldado, el
 * pago dice si ese dinero en concreto ya se dio por bueno. Un cargo puede
 * estar vencido y tener un pago rechazado colgando.
 */
export const ETIQUETA_PAGO: Record<EstadoPago, string> = {
  INICIADO: 'Esperando a la pasarela',
  EN_REVISION: 'En revisión',
  CONFIRMADO: 'Confirmado',
  RECHAZADO: 'Rechazado',
}

export function colorDePago(estado: EstadoPago): ColorSemaforo {
  switch (estado) {
    case EstadoPago.CONFIRMADO: return 'VERDE'
    case EstadoPago.EN_REVISION: return 'AZUL'
    case EstadoPago.INICIADO: return 'AMARILLO'
    case EstadoPago.RECHAZADO: return 'ROJO'
  }
}
