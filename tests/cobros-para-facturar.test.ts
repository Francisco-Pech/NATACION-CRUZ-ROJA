import { describe, it, expect } from 'vitest'
import { agruparCobros } from '@/lib/cobros-para-facturar'

/**
 * Un pago como sale de la base, con lo que cobra su mes.
 *
 * El desglose viaja con el pago y no se recalcula: el cargo guardó sus
 * montos al nacer, así que un cambio de precio o de descuento posterior no
 * debe mover lo que ya se timbró.
 */
const pago = (
  id: string, mes: number, metodo: string, monto: number, cuando: string,
  extra: Partial<{
    referencia: string | null
    montoMensualidad: number
    montoLockers: number
    montoDescuento: number
    montoRecargo: number
  }> = {},
) => ({
  id, mes, etiquetaMetodo: metodo, montoCobrado: monto,
  referencia: extra.referencia ?? null,
  fechaPago: new Date(cuando),
  montoMensualidad: extra.montoMensualidad ?? monto,
  montoLockers: extra.montoLockers ?? 0,
  montoDescuento: extra.montoDescuento ?? 0,
  montoRecargo: extra.montoRecargo ?? 0,
})

describe('agruparCobros — la factura es mensual, pero se paga por cobro', () => {
  it('un mes suelto es un cobro con un solo mes', () => {
    const cobros = agruparCobros([pago('a', 9, 'Efectivo', 77000, '2026-09-14T15:00:00-05:00')])
    expect(cobros).toHaveLength(1)
    expect(cobros[0].meses).toEqual([9])
    expect(cobros[0].total).toBe(77000)
    expect(cobros[0].etiquetaMetodo).toBe('Efectivo')
  })

  it('tres meses adelantados el mismo día son un solo cobro', () => {
    // Es lo que de verdad pasó en la ventanilla: una persona entregó el
    // dinero una vez. Timbrarlo como tres cobros contaría tres movimientos
    // donde hubo uno.
    const cobros = agruparCobros([
      pago('a', 10, 'Efectivo', 77000, '2026-09-15T10:00:00-05:00'),
      pago('b', 11, 'Efectivo', 77000, '2026-09-15T10:00:01-05:00'),
      pago('c', 12, 'Efectivo', 77000, '2026-09-15T10:00:02-05:00'),
    ])
    expect(cobros).toHaveLength(1)
    expect(cobros[0].meses).toEqual([10, 11, 12])
    expect(cobros[0].total).toBe(231000)
  })

  it('el locker viaja aparte de la mensualidad', () => {
    // En el CFDI son dos conceptos: la clase y la renta del locker. Sumarlos
    // en un solo renglón obligaría a desglosarlos a mano después.
    const cobros = agruparCobros([
      pago('a', 10, 'Efectivo', 87000, '2026-09-15T10:00:00-05:00',
        { montoMensualidad: 77000, montoLockers: 10000 }),
      pago('b', 11, 'Efectivo', 87000, '2026-09-15T10:00:01-05:00',
        { montoMensualidad: 77000, montoLockers: 10000 }),
    ])
    expect(cobros[0].mensualidad).toBe(154000)
    expect(cobros[0].lockers).toBe(20000)
    expect(cobros[0].total).toBe(174000)
  })

  it('el descuento y el recargo también se suman por cobro', () => {
    const cobros = agruparCobros([
      pago('a', 9, 'Efectivo', 43500, '2026-09-15T10:00:00-05:00',
        { montoMensualidad: 77000, montoDescuento: 38500, montoRecargo: 5000 }),
    ])
    expect(cobros[0].descuento).toBe(38500)
    expect(cobros[0].recargo).toBe(5000)
  })

  it('el mismo día con formas de pago distintas son dos cobros', () => {
    // El CFDI pide la forma de pago real: juntarlos obligaría a escoger una
    // de las dos y mentir en la otra.
    const cobros = agruparCobros([
      pago('a', 10, 'Efectivo', 77000, '2026-09-15T10:00:00-05:00'),
      pago('b', 11, 'Transferencia', 77000, '2026-09-15T11:00:00-05:00'),
    ])
    expect(cobros).toHaveLength(2)
    expect(cobros.map((c) => c.etiquetaMetodo).sort()).toEqual(['Efectivo', 'Transferencia'])
  })

  it('la misma forma en días distintos son dos cobros', () => {
    const cobros = agruparCobros([
      pago('a', 9, 'Efectivo', 77000, '2026-09-14T10:00:00-05:00'),
      pago('b', 10, 'Efectivo', 77000, '2026-09-15T10:00:00-05:00'),
    ])
    expect(cobros).toHaveLength(2)
  })

  it('referencias distintas son tickets distintos, aunque coincidan día y forma', () => {
    const cobros = agruparCobros([
      pago('a', 9, 'OXXO', 77000, '2026-09-15T10:00:00-05:00', { referencia: 'TICKET-1' }),
      pago('b', 10, 'OXXO', 77000, '2026-09-15T10:05:00-05:00', { referencia: 'TICKET-2' }),
    ])
    expect(cobros).toHaveLength(2)
  })

  it('los cobros salen del más nuevo al más viejo', () => {
    const cobros = agruparCobros([
      pago('a', 9, 'Efectivo', 77000, '2026-09-14T10:00:00-05:00'),
      pago('b', 10, 'Efectivo', 77000, '2026-09-16T10:00:00-05:00'),
      pago('c', 11, 'Efectivo', 77000, '2026-09-15T10:00:00-05:00'),
    ])
    expect(cobros.map((c) => c.meses[0])).toEqual([10, 11, 9])
  })

  it('los meses de un cobro salen en orden, no como se capturaron', () => {
    const cobros = agruparCobros([
      pago('a', 12, 'Efectivo', 77000, '2026-09-15T10:00:00-05:00'),
      pago('b', 10, 'Efectivo', 77000, '2026-09-15T10:00:01-05:00'),
      pago('c', 11, 'Efectivo', 77000, '2026-09-15T10:00:02-05:00'),
    ])
    expect(cobros[0].meses).toEqual([10, 11, 12])
  })

  it('dos cursos del mismo mes no repiten el mes', () => {
    // Quien lleva Adultos y Salvavidas paga dos cargos de septiembre; el
    // cobro cubre septiembre una vez, no dos.
    const cobros = agruparCobros([
      pago('a', 9, 'Efectivo', 77000, '2026-09-15T10:00:00-05:00'),
      pago('b', 9, 'Efectivo', 50000, '2026-09-15T10:00:01-05:00'),
    ])
    expect(cobros[0].meses).toEqual([9])
    expect(cobros[0].total).toBe(127000)
  })

  it('el día se cuenta en hora de Cancún, no en UTC', () => {
    // Un cobro de las 9 de la noche del 14 en Cancún son las 2 de la mañana
    // del 15 en UTC. Agrupar por UTC lo partiría en dos y la factura saldría
    // con una fecha que nadie reconoce.
    const cobros = agruparCobros([
      pago('a', 9, 'Efectivo', 77000, '2026-09-14T21:00:00-05:00'),
      pago('b', 10, 'Efectivo', 77000, '2026-09-14T22:00:00-05:00'),
    ])
    expect(cobros).toHaveLength(1)
  })

  it('sin pagos no hay cobros', () => {
    expect(agruparCobros([])).toEqual([])
  })
})
