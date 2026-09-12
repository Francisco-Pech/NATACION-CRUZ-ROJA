import { describe, it, expect } from 'vitest'
import { paginasVisibles, SALTO } from '@/lib/paginacion'

describe('paginasVisibles', () => {
  it('con pocas páginas las muestra todas', () => {
    expect(paginasVisibles(0, 1)).toEqual([0])
    expect(paginasVisibles(2, 5)).toEqual([0, 1, 2, 3, 4])
    expect(paginasVisibles(0, 7)).toEqual([0, 1, 2, 3, 4, 5, 6])
  })

  it('con muchas, corta por en medio pero deja la primera y la última', () => {
    const v = paginasVisibles(0, 20)
    expect(v[0]).toBe(0)
    expect(v[v.length - 1]).toBe(19)
    expect(v).toContain(SALTO)
  })

  it('siempre deja ver a dónde saltar desde donde estás', () => {
    const v = paginasVisibles(9, 20)
    expect(v).toContain(8)
    expect(v).toContain(9)
    expect(v).toContain(10)
  })

  it('nunca repite una página', () => {
    for (let total = 1; total <= 30; total++) {
      for (let actual = 0; actual < total; actual++) {
        const numeros = paginasVisibles(actual, total).filter((x) => x !== SALTO)
        expect(new Set(numeros).size).toBe(numeros.length)
      }
    }
  })

  it('siempre van en orden y dentro del rango', () => {
    for (let total = 1; total <= 30; total++) {
      for (let actual = 0; actual < total; actual++) {
        const numeros = paginasVisibles(actual, total).filter((x): x is number => x !== SALTO)
        expect(numeros).toEqual([...numeros].sort((a, b) => a - b))
        expect(numeros.every((n) => n >= 0 && n < total)).toBe(true)
      }
    }
  })

  it('siempre incluye la página en la que estás', () => {
    for (let total = 1; total <= 30; total++) {
      for (let actual = 0; actual < total; actual++) {
        expect(paginasVisibles(actual, total)).toContain(actual)
      }
    }
  })

  it('no pone puntos suspensivos para saltarse una sola página', () => {
    // Un "…" que esconde nada más la página 2 es peor que enseñarla.
    for (let total = 1; total <= 30; total++) {
      for (let actual = 0; actual < total; actual++) {
        const v = paginasVisibles(actual, total)
        v.forEach((x, i) => {
          if (x !== SALTO) return
          const antes = v[i - 1] as number
          const despues = v[i + 1] as number
          expect(despues - antes).toBeGreaterThan(2)
        })
      }
    }
  })

  it('no crece sin límite', () => {
    expect(paginasVisibles(50, 100).length).toBeLessThanOrEqual(9)
  })
})
