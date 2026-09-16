import { describe, it, expect } from 'vitest'
import { leTocaRecargo } from '@/lib/cargos'

const alta = (s: string) => new Date(`${s}T12:00:00`)

describe('leTocaRecargo — a quién se le suma por pagar tarde', () => {
  it('al que ya venía de antes', () => {
    // Se inscribió en agosto y no pagó septiembre a tiempo: ese sí.
    expect(leTocaRecargo({ altaDeLaInscripcion: alta('2026-08-14'), anio: 2026, mes: 9 })).toBe(true)
  })

  it('no al que se dio de alta ese mismo mes', () => {
    // Lo capturan el 28 de septiembre, cuando el 5.º día hábil quedó atrás.
    // Cobrarle recargo sería multarlo por haberse inscrito tarde.
    expect(leTocaRecargo({ altaDeLaInscripcion: alta('2026-09-28'), anio: 2026, mes: 9 })).toBe(false)
  })

  it('tampoco el día 1 del mes: sigue siendo su primer mes', () => {
    expect(leTocaRecargo({ altaDeLaInscripcion: alta('2026-09-01'), anio: 2026, mes: 9 })).toBe(false)
  })

  it('el último día del mes anterior ya cuenta como de antes', () => {
    expect(leTocaRecargo({ altaDeLaInscripcion: alta('2026-08-31'), anio: 2026, mes: 9 })).toBe(true)
  })

  it('no al de un mes que todavía no llega', () => {
    // Si alguien adelanta el cargo de noviembre, su alta de octubre no lo
    // vuelve moroso de un mes que aún no vence.
    expect(leTocaRecargo({ altaDeLaInscripcion: alta('2026-10-05'), anio: 2026, mes: 9 })).toBe(false)
  })

  it('el año cuenta: diciembre del año pasado no es este diciembre', () => {
    expect(leTocaRecargo({ altaDeLaInscripcion: alta('2025-12-20'), anio: 2026, mes: 12 })).toBe(true)
    expect(leTocaRecargo({ altaDeLaInscripcion: alta('2026-12-20'), anio: 2026, mes: 12 })).toBe(false)
  })
})
