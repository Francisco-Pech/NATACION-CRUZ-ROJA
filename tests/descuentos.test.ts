import { describe, it, expect } from 'vitest'
import {
  validarVigencia, validarLimite, TOPES_DESCUENTO, comoSeLeeDescuento, conValor,
  descuentoCubreElMes,
} from '@/lib/descuentos'

const f = (s: string) => new Date(`${s}T12:00:00`)

describe('validarVigencia — desde y hasta', () => {
  // Los cuatro descuentos de hoy no tienen vigencia: valen siempre. Que se
  // pueda poner no quiere decir que haya que ponerla.
  it('sin fechas está bien: quiere decir sin límite', () => {
    expect(validarVigencia(null, null)).toBeNull()
  })

  it('solo el inicio está bien: vale de esa fecha en adelante', () => {
    expect(validarVigencia(f('2026-01-01'), null)).toBeNull()
  })

  it('solo el fin está bien: vale hasta esa fecha', () => {
    expect(validarVigencia(null, f('2026-12-31'))).toBeNull()
  })

  it('acepta un rango en orden', () => {
    expect(validarVigencia(f('2026-01-01'), f('2026-03-31'))).toBeNull()
  })

  // Un solo día es un rango válido: un descuento de un día existe.
  it('acepta que empiece y termine el mismo día', () => {
    expect(validarVigencia(f('2026-06-15'), f('2026-06-15'))).toBeNull()
  })

  it('rechaza que termine antes de empezar', () => {
    expect(validarVigencia(f('2026-03-31'), f('2026-01-01'))).toMatch(/antes de empezar/i)
  })
})

describe('validarLimite — cuántas veces se puede dar', () => {
  it('sin límite está bien: es como están todos hoy', () => {
    expect(validarLimite(null, 0)).toBeNull()
  })

  it('acepta un límite por encima de lo que ya se dio', () => {
    expect(validarLimite(10, 3)).toBeNull()
  })

  it('acepta un límite igual a lo que ya se dio: se cierra ahí', () => {
    expect(validarLimite(3, 3)).toBeNull()
  })

  // Bajarlo por debajo de lo entregado no le quita el descuento a nadie: lo
  // que haría es dejar la cuenta en un estado imposible, con más entregados
  // que permitidos.
  it('rechaza un límite menor a lo que ya se dio', () => {
    expect(validarLimite(2, 3)).toMatch(/ya se dio 3/i)
  })

  it('rechaza cero: un descuento que no se puede dar se desactiva', () => {
    expect(validarLimite(0, 0)).toMatch(/al menos 1/i)
  })

  it('rechaza un número con punto', () => {
    expect(validarLimite(2.5, 0)).toMatch(/entero/i)
  })
})

describe('TOPES_DESCUENTO — el valor según el tipo', () => {
  // Más de 100 % no es un descuento mayor: sería devolverle dinero a quien
  // viene a pagar.
  it('el porcentaje no pasa de 100', () => {
    expect(TOPES_DESCUENTO.PORCENTAJE.max).toBe(100)
  })

  it('ni el porcentaje ni el monto pueden ser cero', () => {
    expect(TOPES_DESCUENTO.PORCENTAJE.min).toBe(1)
    expect(TOPES_DESCUENTO.MONTO_FIJO.min).toBe(1)
  })
})

describe('comoSeLeeDescuento', () => {
  it('el porcentaje va con su signo', () => {
    expect(comoSeLeeDescuento({ tipo: 'PORCENTAJE', valor: 50 })).toBe('50%')
    expect(comoSeLeeDescuento({ tipo: 'PORCENTAJE', valor: 100 })).toBe('100%')
  })

  it('el monto fijo se lee en pesos, no en centavos', () => {
    // En la base vive en centavos, como todo el dinero del sistema. Un
    // "10000" en la pantalla se leería como diez mil pesos de descuento.
    expect(comoSeLeeDescuento({ tipo: 'MONTO_FIJO', valor: 10000 })).toBe('$100.00')
    expect(comoSeLeeDescuento({ tipo: 'MONTO_FIJO', valor: 5050 })).toBe('$50.50')
  })

  it('acompaña al nombre sin repetirlo', () => {
    expect(conValor({ nombre: 'INAPAM', tipo: 'PORCENTAJE', valor: 50 })).toBe('INAPAM · 50%')
  })
})

describe('descuentoCubreElMes — hasta cuándo le dura al alumno', () => {
  // El cobro es mensual, así que lo que decide es si el descuento toca el
  // mes, no un día suelto. Una cortesía de un solo día cubre su mes y se
  // acaba: al siguiente el alumno paga completo.
  it('sin fechas vale siempre: es el caso de INAPAM', () => {
    expect(descuentoCubreElMes({ desde: null, hasta: null }, 2026, 9)).toBe(true)
    expect(descuentoCubreElMes({ desde: null, hasta: null }, 2027, 3)).toBe(true)
  })

  it('una cortesía de un solo día cubre ese mes', () => {
    const cortesia = { desde: f('2026-09-15'), hasta: f('2026-09-15') }
    expect(descuentoCubreElMes(cortesia, 2026, 9)).toBe(true)
  })

  it('y no cubre el mes siguiente', () => {
    const cortesia = { desde: f('2026-09-15'), hasta: f('2026-09-15') }
    expect(descuentoCubreElMes(cortesia, 2026, 10)).toBe(false)
  })

  it('ni el anterior', () => {
    const cortesia = { desde: f('2026-09-15'), hasta: f('2026-09-15') }
    expect(descuentoCubreElMes(cortesia, 2026, 8)).toBe(false)
  })

  it('solo con inicio vale de ahí en adelante', () => {
    const beca = { desde: f('2026-06-10'), hasta: null }
    expect(descuentoCubreElMes(beca, 2026, 5)).toBe(false)
    expect(descuentoCubreElMes(beca, 2026, 6)).toBe(true)
    expect(descuentoCubreElMes(beca, 2027, 1)).toBe(true)
  })

  it('solo con fin vale hasta ahí', () => {
    const beca = { desde: null, hasta: f('2026-06-10') }
    expect(descuentoCubreElMes(beca, 2026, 6)).toBe(true)
    expect(descuentoCubreElMes(beca, 2026, 7)).toBe(false)
  })

  it('un semestre cubre los meses de en medio', () => {
    const semestre = { desde: f('2026-02-20'), hasta: f('2026-07-03') }
    for (const mes of [2, 3, 4, 5, 6, 7]) {
      expect(descuentoCubreElMes(semestre, 2026, mes)).toBe(true)
    }
    expect(descuentoCubreElMes(semestre, 2026, 1)).toBe(false)
    expect(descuentoCubreElMes(semestre, 2026, 8)).toBe(false)
  })

  it('el fin del mes cuenta completo: un descuento que vence el día 1 cubre ese mes', () => {
    // Vence el 1.º de octubre. Octubre entero se cobra con descuento; no se
    // le parte la mensualidad a la mitad por un día.
    expect(descuentoCubreElMes({ desde: null, hasta: f('2026-10-01') }, 2026, 10)).toBe(true)
    expect(descuentoCubreElMes({ desde: null, hasta: f('2026-10-01') }, 2026, 11)).toBe(false)
  })
})
