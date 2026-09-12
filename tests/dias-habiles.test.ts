import { describe, it, expect } from 'vitest'
import { esDiaHabil, calcularFechaLimite } from '@/lib/dias-habiles'

const f = (s: string) => new Date(`${s}T12:00:00`)

describe('esDiaHabil', () => {
  it('reconoce un lunes como hábil', () => {
    expect(esDiaHabil(f('2026-03-02'), [])).toBe(true)
  })
  it('descarta sábado y domingo', () => {
    expect(esDiaHabil(f('2026-03-07'), [])).toBe(false)
    expect(esDiaHabil(f('2026-03-08'), [])).toBe(false)
  })
  it('descarta un día festivo del catálogo', () => {
    expect(esDiaHabil(f('2026-03-16'), [f('2026-03-16')])).toBe(false)
  })
})

describe('calcularFechaLimite', () => {
  it('marzo 2026 sin festivos: 1=dom, hábiles 2,3,4,5,6 -> 6 de marzo', () => {
    const limite = calcularFechaLimite(2026, 3, 5, [])
    expect(limite.getFullYear()).toBe(2026)
    expect(limite.getMonth()).toBe(2)
    expect(limite.getDate()).toBe(6)
  })

  it('recorre la fecha cuando hay un festivo de por medio', () => {
    const limite = calcularFechaLimite(2026, 3, 5, [f('2026-03-04')])
    expect(limite.getDate()).toBe(9)
  })

  it('el límite termina al final del día', () => {
    const limite = calcularFechaLimite(2026, 3, 5, [])
    expect(limite.getHours()).toBe(23)
    expect(limite.getMinutes()).toBe(59)
  })

  it('enero 2026: 1=jue festivo, 2=vie, hábiles 2,5,6,7,8 -> 8 de enero', () => {
    const limite = calcularFechaLimite(2026, 1, 5, [f('2026-01-01')])
    expect(limite.getDate()).toBe(8)
  })
})
