export type Descuento = { tipo: 'PORCENTAJE' | 'MONTO_FIJO'; valor: number }

export type EntradaCargo = {
  tarifa: number
  lockers: number
  precioLocker: number
  descuento?: Descuento | null
  recargo?: number
}

export type ResultadoCargo = {
  montoMensualidad: number
  montoLockers: number
  montoDescuento: number
  montoRecargo: number
  montoNeto: number
}

/** Todos los montos van en centavos: el dinero nunca se calcula con flotantes. */
export function calcularCargo(entrada: EntradaCargo): ResultadoCargo {
  const montoMensualidad = entrada.tarifa
  const montoLockers = entrada.lockers * entrada.precioLocker
  const montoRecargo = entrada.recargo ?? 0

  let montoDescuento = 0
  if (entrada.descuento) {
    montoDescuento =
      entrada.descuento.tipo === 'PORCENTAJE'
        ? Math.round((montoMensualidad * entrada.descuento.valor) / 100)
        : entrada.descuento.valor
    // El descuento aplica solo a la mensualidad y nunca la vuelve negativa.
    montoDescuento = Math.min(montoDescuento, montoMensualidad)
  }

  return {
    montoMensualidad,
    montoLockers,
    montoDescuento,
    montoRecargo,
    montoNeto: montoMensualidad - montoDescuento + montoLockers + montoRecargo,
  }
}
