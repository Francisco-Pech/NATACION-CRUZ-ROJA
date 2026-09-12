import { describe, it, expect } from 'vitest'
import { validarVigencia, validarLimite, TOPES_DESCUENTO } from '@/lib/descuentos'

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
