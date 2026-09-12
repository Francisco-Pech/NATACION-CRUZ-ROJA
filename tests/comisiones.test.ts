import { describe, it, expect } from 'vitest'
import { calcularTotalConComision } from '@/lib/comisiones'

const TARJETA = { porcentaje: 0.036, montoFijo: 300, iva: 0.16 }
const SIN_COMISION = { porcentaje: 0, montoFijo: 0, iva: 0.16 }

describe('calcularTotalConComision', () => {
  it('cobra $808 para dejar $770 netos con tarjeta', () => {
    expect(calcularTotalConComision(77000, TARJETA).total).toBe(80800)
  })
  it('después de la comisión, a la delegación le queda al menos el neto', () => {
    const { total } = calcularTotalConComision(77000, TARJETA)
    const comisionReal = Math.round((total * TARJETA.porcentaje + TARJETA.montoFijo) * (1 + TARJETA.iva))
    expect(total - comisionReal).toBeGreaterThanOrEqual(77000)
  })
  it('sin comisión el total es igual al neto', () => {
    const { total, comision } = calcularTotalConComision(77000, SIN_COMISION)
    expect(total).toBe(77000)
    expect(comision).toBe(0)
  })
  it('redondea hacia arriba al peso completo', () => {
    expect(calcularTotalConComision(77000, TARJETA).total % 100).toBe(0)
  })
  it('un neto de cero no cobra nada', () => {
    expect(calcularTotalConComision(0, TARJETA).total).toBe(0)
  })
})
