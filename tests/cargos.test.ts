import { describe, it, expect } from 'vitest'
import { calcularCargo, mesCubierto } from '@/lib/cargos'

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

// ------------------------------------------------- el mes cubierto y la lista
//
// La credencial vale si el mes está pagado. Sin eso, un alumno podría llevar
// medio año viniendo a clase con una credencial que nadie cobró: la lista
// diría que estuvo y la caja diría que no debe nada.

describe('mesCubierto — qué mes tiene derecho a clase', () => {
  it('un mes pagado está cubierto', () => {
    expect(mesCubierto([{ mes: '2026-09', estado: 'PAGADO' }], '2026-09')).toBe(true)
  })

  it('uno pendiente no', () => {
    expect(mesCubierto([{ mes: '2026-09', estado: 'PENDIENTE' }], '2026-09')).toBe(false)
  })

  it('uno vencido tampoco', () => {
    expect(mesCubierto([{ mes: '2026-09', estado: 'VENCIDO' }], '2026-09')).toBe(false)
  })

  // En revisión es "subió su comprobante y nadie lo ha mirado": todavía no
  // entró el dinero, así que todavía no da derecho a clase.
  it('en revisión todavía no', () => {
    expect(mesCubierto([{ mes: '2026-09', estado: 'EN_REVISION' }], '2026-09')).toBe(false)
  })

  // Falla cerrado: sin cobro generado no hay nada que se haya pagado.
  it('sin cargo de ese mes, no está cubierto', () => {
    expect(mesCubierto([{ mes: '2026-10', estado: 'PAGADO' }], '2026-09')).toBe(false)
    expect(mesCubierto([], '2026-09')).toBe(false)
  })

  // Quien lleva dos cursos debe dos cargos el mismo mes: pagar uno no le da
  // derecho a la clase del otro.
  it('con dos cargos del mes, los dos tienen que estar pagados', () => {
    const dos = [
      { mes: '2026-09', estado: 'PAGADO' },
      { mes: '2026-09', estado: 'PENDIENTE' },
    ]
    expect(mesCubierto(dos, '2026-09')).toBe(false)
  })

  // Un cargo cancelado no es una deuda: es un cobro que se deshizo. No
  // estorba al mes que sí se pagó.
  it('un cargo cancelado no cuenta ni a favor ni en contra', () => {
    expect(mesCubierto([
      { mes: '2026-09', estado: 'CANCELADO' },
      { mes: '2026-09', estado: 'PAGADO' },
    ], '2026-09')).toBe(true)
    expect(mesCubierto([{ mes: '2026-09', estado: 'CANCELADO' }], '2026-09')).toBe(false)
  })
})
