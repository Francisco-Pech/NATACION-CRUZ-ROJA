import { describe, it, expect } from 'vitest'
import { tocaCobrar } from '@/lib/cobros'

const UNICO = null

describe('tocaCobrar · pago único', () => {
  it('se cobra si nunca se ha cobrado', () => {
    expect(tocaCobrar(9, [], UNICO)).toBe(true)
  })

  // Un salvavidas paga su curso una vez. Que el mes avance no le genera
  // un cargo nuevo: es la diferencia entre curso y mensualidad.
  it('no se vuelve a cobrar jamás', () => {
    expect(tocaCobrar(9, [{ mes: 3 }], UNICO)).toBe(false)
  })
})

describe('tocaCobrar · mensual', () => {
  it('se cobra si no hay nada previo', () => {
    expect(tocaCobrar(9, [], 1)).toBe(true)
  })

  it('no se cobra dos veces el mismo mes', () => {
    expect(tocaCobrar(9, [{ mes: 9 }], 1)).toBe(false)
  })

  it('se cobra el mes siguiente', () => {
    expect(tocaCobrar(10, [{ mes: 9 }], 1)).toBe(true)
  })
})

describe('tocaCobrar · trimestral', () => {
  // Un cobro de enero cubre enero, febrero y marzo.
  it('el cobro de enero cubre febrero', () => {
    expect(tocaCobrar(2, [{ mes: 1 }], 3)).toBe(false)
  })

  it('el cobro de enero cubre marzo', () => {
    expect(tocaCobrar(3, [{ mes: 1 }], 3)).toBe(false)
  })

  it('en abril vuelve a tocar', () => {
    expect(tocaCobrar(4, [{ mes: 1 }], 3)).toBe(true)
  })
})

describe('tocaCobrar · semestral y anual', () => {
  it('el semestral de enero cubre junio', () => {
    expect(tocaCobrar(6, [{ mes: 1 }], 6)).toBe(false)
  })

  it('el semestral de enero ya no cubre julio', () => {
    expect(tocaCobrar(7, [{ mes: 1 }], 6)).toBe(true)
  })

  it('el anual de enero cubre diciembre', () => {
    expect(tocaCobrar(12, [{ mes: 1 }], 12)).toBe(false)
  })

  // Quien entra a media temporada paga el año completo y ya no se le
  // vuelve a cobrar en lo que resta del ciclo.
  it('el anual de marzo cubre lo que queda del año', () => {
    expect(tocaCobrar(12, [{ mes: 3 }], 12)).toBe(false)
  })
})

describe('tocaCobrar · casos que no deben romper', () => {
  it('toma el cobro más reciente, no el primero', () => {
    expect(tocaCobrar(10, [{ mes: 1 }, { mes: 9 }], 3)).toBe(false)
    expect(tocaCobrar(12, [{ mes: 1 }, { mes: 9 }], 3)).toBe(true)
  })

  // Una frecuencia mal sembrada no debe generar cargos infinitos ni
  // dividir entre cero: se trata como pago único, que es lo prudente.
  it('una frecuencia de cero meses se trata como pago único', () => {
    expect(tocaCobrar(9, [], 0)).toBe(true)
    expect(tocaCobrar(9, [{ mes: 1 }], 0)).toBe(false)
  })

  // Si los periodos se generan fuera de orden, un cargo de noviembre no paga
  // septiembre: la mensualidad de cada mes se sostiene sola.
  it('un cobro de un mes posterior no cubre un mes anterior', () => {
    expect(tocaCobrar(9, [{ mes: 11 }], 1)).toBe(true)
  })

  // El pago único sí: se cobró una vez y no importa en qué mes quedó.
  it('el pago único no se re-cobra aunque el cargo sea de un mes posterior', () => {
    expect(tocaCobrar(9, [{ mes: 11 }], null)).toBe(false)
  })
})
