/**
 * Lo que cobra la pasarela por cobrar en línea.
 *
 * Vive en el entorno y no en la base: cambia según el año y según lo que
 * pacte la delegación con Stripe, y no es algo que se capture desde el
 * panel — quien lo mueve es quien despliega, con el contrato en la mano.
 *
 * Las tarifas de lista de Stripe en México son 3.6 % + $3 por transacción
 * con tarjeta nacional. Una tarjeta extranjera lleva 1.5 % extra, y si hay
 * cambio de divisa, 2 % más. Confírmalas contra el contrato real.
 */

export type MetodoConComision =
  | 'EFECTIVO'
  | 'TRANSFERENCIA'
  | 'TARJETA'
  | 'SPEI'
  | 'OXXO'

export type ConfigComision = {
  porcentaje: number
  montoFijo: number
  iva: number
  diasCorteAntesDeVencimiento: number
  /** En falso deja de ofrecerse al pagar. */
  activo: boolean
}

/** El IVA sobre la comisión. En México, 16 %. */
const IVA_POR_OMISION = 0.16

export const POR_OMISION: Record<MetodoConComision, ConfigComision> = {
  // Los dos primeros no pasan por la pasarela: se cobran en la caja.
  EFECTIVO: { porcentaje: 0, montoFijo: 0, iva: 0, diasCorteAntesDeVencimiento: 0, activo: true },
  TRANSFERENCIA: { porcentaje: 0, montoFijo: 0, iva: 0, diasCorteAntesDeVencimiento: 0, activo: true },
  TARJETA: { porcentaje: 0.036, montoFijo: 300, iva: IVA_POR_OMISION, diasCorteAntesDeVencimiento: 0, activo: true },
  SPEI: { porcentaje: 0.036, montoFijo: 300, iva: IVA_POR_OMISION, diasCorteAntesDeVencimiento: 0, activo: true },
  // OXXO tarda en confirmarse: deja de ofrecerse unos días antes del
  // vencimiento para que a nadie le caiga el recargo por esa tardanza.
  OXXO: { porcentaje: 0.036, montoFijo: 1200, iva: IVA_POR_OMISION, diasCorteAntesDeVencimiento: 3, activo: true },
}

/** Los dos que se cobran en la caja: nunca llevan comisión. */
const SIN_PASARELA: MetodoConComision[] = ['EFECTIVO', 'TRANSFERENCIA']

/**
 * Lee un número del entorno. Lo que no sea un número dentro del rango se
 * ignora: un valor mal escrito no debe volverse `NaN` y arrastrarse hasta
 * un cobro real.
 */
function numeroDe(bruto: string | undefined, min: number, max: number): number | null {
  if (bruto === undefined || bruto.trim() === '') return null
  const n = Number(bruto)
  if (!Number.isFinite(n) || n < min || n > max) return null
  return n
}

/**
 * Arma la configuración de comisiones a partir del entorno.
 *
 * Cada método acepta `COMISION_<METODO>_PORCENTAJE` (en por ciento) y
 * `COMISION_<METODO>_FIJA` (en pesos). El IVA es uno solo para todos,
 * `COMISION_IVA`, también en por ciento.
 */
export function comisionesDelEntorno(
  entorno: Record<string, string | undefined> = process.env,
): Record<MetodoConComision, ConfigComision> {
  const iva = numeroDe(entorno.COMISION_IVA, 0, 100)
  const salida = {} as Record<MetodoConComision, ConfigComision>

  for (const metodo of Object.keys(POR_OMISION) as MetodoConComision[]) {
    const base = POR_OMISION[metodo]
    if (SIN_PASARELA.includes(metodo)) {
      // No se leen del entorno: configurarles una comisión por error
      // encarecería un pago que se recibe en la caja, sin intermediario.
      salida[metodo] = { ...base }
      continue
    }

    const porCiento = numeroDe(entorno[`COMISION_${metodo}_PORCENTAJE`], 0, 100)
    const pesos = numeroDe(entorno[`COMISION_${metodo}_FIJA`], 0, 10_000)
    const dias = numeroDe(entorno[`COMISION_${metodo}_DIAS_CORTE`], 0, 31)

    salida[metodo] = {
      porcentaje: porCiento === null ? base.porcentaje : porCiento / 100,
      montoFijo: pesos === null ? base.montoFijo : Math.round(pesos * 100),
      iva: iva === null ? base.iva : iva / 100,
      diasCorteAntesDeVencimiento: dias === null ? base.diasCorteAntesDeVencimiento : dias,
      // Solo un "false" explícito lo apaga: una variable vacía o mal
      // escrita no debe dejar a la escuela sin forma de cobrar.
      activo: (entorno[`COMISION_${metodo}_ACTIVO`] ?? '').trim().toLowerCase() !== 'false',
    }
  }
  return salida
}

/**
 * Resuelve el problema inverso: dado el neto que Cruz Roja debe recibir,
 * cuánto hay que cobrarle a la persona para que la comisión no salga del neto.
 *
 *   neto  = total - (total * p + f) * (1 + iva)
 *   total = (neto + f * (1 + iva)) / (1 - p * (1 + iva))
 *
 * El total se redondea hacia arriba al peso; la diferencia por redondeo
 * queda a favor de la delegación.
 */
export function calcularTotalConComision(
  neto: number,
  config: Pick<ConfigComision, 'porcentaje' | 'montoFijo' | 'iva'>,
): { total: number; comision: number } {
  if (neto <= 0) return { total: 0, comision: 0 }

  const factorIva = 1 + config.iva
  const divisor = 1 - config.porcentaje * factorIva
  if (divisor <= 0) {
    throw new Error('La comisión configurada consume el total del cobro')
  }

  const exacto = (neto + config.montoFijo * factorIva) / divisor
  const total = Math.ceil(exacto / 100) * 100

  return { total, comision: total - neto }
}
