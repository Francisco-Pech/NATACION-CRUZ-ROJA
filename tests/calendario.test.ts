import { describe, it, expect } from 'vitest'
import { semanasDelMes, NOMBRES_MES, LETRAS_DIA } from '@/lib/calendario'

describe('semanasDelMes', () => {
  it('empieza en lunes', () => {
    expect(LETRAS_DIA).toEqual(['L', 'M', 'X', 'J', 'V', 'S', 'D'])
  })

  it('pone cada día en su columna', () => {
    // El 1 de junio de 2026 cae en lunes: abre la primera casilla.
    const s = semanasDelMes(2026, 6)
    expect(s[0]).toEqual([1, 2, 3, 4, 5, 6, 7])
  })

  it('deja en blanco lo que va antes del día 1', () => {
    // El 1 de julio de 2026 es miércoles: dos huecos antes.
    const s = semanasDelMes(2026, 7)
    expect(s[0].slice(0, 3)).toEqual([null, null, 1])
  })

  it('deja en blanco lo que va después del último día', () => {
    const s = semanasDelMes(2026, 2)
    const ultima = s[s.length - 1]
    expect(ultima.filter((d) => d !== null).at(-1)).toBe(28)
    expect(ultima.at(-1)).toBeNull()
  })

  it('trae todos los días del mes, una sola vez', () => {
    for (const [anio, mes, cuantos] of [
      [2026, 1, 31], [2026, 2, 28], [2028, 2, 29], [2026, 4, 30], [2026, 12, 31],
    ] as const) {
      const dias = semanasDelMes(anio, mes).flat().filter((d): d is number => d !== null)
      expect(dias).toEqual(Array.from({ length: cuantos }, (_, i) => i + 1))
    }
  })

  it('todas las semanas miden siete', () => {
    for (let mes = 1; mes <= 12; mes++) {
      for (const s of semanasDelMes(2026, mes)) expect(s).toHaveLength(7)
    }
  })

  it('nunca sobra una semana entera en blanco', () => {
    for (let anio = 2024; anio <= 2032; anio++) {
      for (let mes = 1; mes <= 12; mes++) {
        for (const s of semanasDelMes(anio, mes)) {
          expect(s.some((d) => d !== null)).toBe(true)
        }
      }
    }
  })

  it('nombra los meses en español', () => {
    expect(NOMBRES_MES[0]).toBe('enero')
    expect(NOMBRES_MES[11]).toBe('diciembre')
    expect(NOMBRES_MES).toHaveLength(12)
  })
})
