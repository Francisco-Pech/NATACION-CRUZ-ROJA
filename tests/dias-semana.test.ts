import { describe, it, expect } from 'vitest'
import { resumenDias, DIAS_SEMANA } from '@/lib/dias-semana'

describe('DIAS_SEMANA', () => {
  // La numeración es la de Date.getDay() para que no haya conversiones
  // en el código que consulta el calendario.
  it('usa la numeración de getDay: domingo es 0 y sábado 6', () => {
    expect(DIAS_SEMANA.find((d) => d.corto === 'D')?.n).toBe(0)
    expect(DIAS_SEMANA.find((d) => d.corto === 'S')?.n).toBe(6)
  })

  it('se muestra de lunes a domingo, no de domingo a sábado', () => {
    expect(DIAS_SEMANA.map((d) => d.corto)).toEqual(['L', 'M', 'X', 'J', 'V', 'S', 'D'])
  })
})

describe('resumenDias', () => {
  it('sin días no dice nada', () => {
    expect(resumenDias([])).toBe('—')
  })

  it('un solo día', () => {
    expect(resumenDias([6])).toBe('S')
  })

  it('colapsa un tramo corrido', () => {
    expect(resumenDias([1, 2, 3, 4, 5])).toBe('L-V')
  })

  it('enumera los sueltos', () => {
    expect(resumenDias([1, 3, 5])).toBe('L, X, V')
  })

  it('mezcla tramos y sueltos', () => {
    expect(resumenDias([1, 2, 3, 6])).toBe('L-X, S')
  })

  it('no colapsa dos días seguidos: se leen mejor enumerados', () => {
    expect(resumenDias([1, 2])).toBe('L, M')
  })

  it('ordena aunque lleguen revueltos', () => {
    expect(resumenDias([5, 1, 3])).toBe('L, X, V')
  })

  it('el domingo va al final, no al principio', () => {
    expect(resumenDias([0, 1])).toBe('L, D')
  })
})
