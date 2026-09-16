import { describe, it, expect } from 'vitest'
import { tocaCobrar, alcanzoElTope, pasaElTope } from '@/lib/cobros'

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

describe('alcanzoElTope', () => {
  const cobrado = { cancelado: false }

  it('sin tope capturado nunca se detiene', () => {
    expect(alcanzoElTope([cobrado, cobrado, cobrado, cobrado], null)).toBe(false)
  })

  it('con tope de 3 y dos meses cobrados todavía falta uno', () => {
    expect(alcanzoElTope([cobrado, cobrado], 3)).toBe(false)
  })

  it('con tope de 3 y tres meses cobrados ya se acabó', () => {
    expect(alcanzoElTope([cobrado, cobrado, cobrado], 3)).toBe(true)
  })

  // Quien ya rebasó un tope que se puso después no vuelve a recibir cargos,
  // pero tampoco se le quita nada de lo que ya tenía.
  it('sigue tope cuando ya lo rebasó', () => {
    expect(alcanzoElTope([cobrado, cobrado, cobrado, cobrado], 3)).toBe(true)
  })

  // Un cargo cancelado no se cobró: contarlo le comería un mes de su curso.
  it('los cancelados no gastan mes', () => {
    expect(alcanzoElTope([cobrado, { cancelado: true }, cobrado], 3)).toBe(false)
  })

  // Un cero capturado a mano significaría "no cobrarle nunca a nadie", y la
  // cobranza se apagaría sin que nadie lo note. Se ignora.
  it('un tope menor a uno se ignora', () => {
    expect(alcanzoElTope([cobrado], 0)).toBe(false)
  })
})

describe('pasaElTope', () => {
  const mes = (clave: string) => ({ clave, cancelado: false })
  const TRES = [mes('2026-09'), mes('2026-10'), mes('2026-11')]

  it('sin tope capturado ningún mes sobra', () => {
    expect(pasaElTope(TRES, '2026-11', null)).toBe(false)
  })

  it('los meses que caben no pasan del tope', () => {
    expect(pasaElTope(TRES, '2026-09', 2)).toBe(false)
    expect(pasaElTope(TRES, '2026-10', 2)).toBe(false)
  })

  // Es el caso de la pantalla: con tope de 2, noviembre ya no se cobra.
  it('el mes de más sí pasa del tope', () => {
    expect(pasaElTope(TRES, '2026-11', 2)).toBe(true)
  })

  // El lugar se cuenta por fecha, no por el orden en que llegaron los
  // renglones: un cargo creado después puede ser de un mes anterior.
  it('cuenta por fecha aunque lleguen desordenados', () => {
    const revueltos = [mes('2026-11'), mes('2026-09'), mes('2026-10')]
    expect(pasaElTope(revueltos, '2026-09', 2)).toBe(false)
    expect(pasaElTope(revueltos, '2026-11', 2)).toBe(true)
  })

  // Un mes cancelado no se cobró: no debe gastarle el lugar al siguiente.
  it('los cancelados no ocupan lugar', () => {
    const conCancelado = [mes('2026-09'), { clave: '2026-10', cancelado: true }, mes('2026-11')]
    expect(pasaElTope(conCancelado, '2026-11', 2)).toBe(false)
  })

  it('cruza el año sin perderse', () => {
    const cruzando = [mes('2026-12'), mes('2027-01'), mes('2027-02')]
    expect(pasaElTope(cruzando, '2027-01', 2)).toBe(false)
    expect(pasaElTope(cruzando, '2027-02', 2)).toBe(true)
  })
})
