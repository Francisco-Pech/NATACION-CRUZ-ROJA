import { describe, it, expect } from 'vitest'
import { calcularCargo } from '@/lib/cargos'

const MENSUALIDAD = 77000
const LOCKER = 10000

describe('calcularCargo', () => {
  it('sin lockers ni descuento cobra solo la mensualidad', () => {
    const r = calcularCargo({ tarifa: MENSUALIDAD, lockers: 0, precioLocker: LOCKER })
    expect(r.montoNeto).toBe(77000)
  })
  it('suma cada locker asignado', () => {
    const r = calcularCargo({ tarifa: MENSUALIDAD, lockers: 2, precioLocker: LOCKER })
    expect(r.montoLockers).toBe(20000)
    expect(r.montoNeto).toBe(97000)
  })
  it('aplica el descuento porcentual solo sobre la mensualidad', () => {
    const r = calcularCargo({
      tarifa: MENSUALIDAD, lockers: 1, precioLocker: LOCKER,
      descuento: { tipo: 'PORCENTAJE', valor: 10 },
    })
    expect(r.montoDescuento).toBe(7700)
    expect(r.montoNeto).toBe(77000 - 7700 + 10000)
  })
  it('aplica el descuento de monto fijo', () => {
    const r = calcularCargo({
      tarifa: MENSUALIDAD, lockers: 0, precioLocker: LOCKER,
      descuento: { tipo: 'MONTO_FIJO', valor: 5000 },
    })
    expect(r.montoNeto).toBe(72000)
  })
  it('nunca deja el descuento por encima de la mensualidad', () => {
    const r = calcularCargo({
      tarifa: MENSUALIDAD, lockers: 0, precioLocker: LOCKER,
      descuento: { tipo: 'MONTO_FIJO', valor: 999999 },
    })
    expect(r.montoDescuento).toBe(77000)
    expect(r.montoNeto).toBe(0)
  })
  it('suma el recargo por pago tardío', () => {
    const r = calcularCargo({ tarifa: MENSUALIDAD, lockers: 0, precioLocker: LOCKER, recargo: 5000 })
    expect(r.montoNeto).toBe(82000)
  })
  it('el recargo no se descuenta', () => {
    const r = calcularCargo({
      tarifa: MENSUALIDAD, lockers: 0, precioLocker: LOCKER, recargo: 5000,
      descuento: { tipo: 'PORCENTAJE', valor: 50 },
    })
    expect(r.montoNeto).toBe(77000 - 38500 + 5000)
  })
})
