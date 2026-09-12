import { describe, it, expect } from 'vitest'
import { nuevoHash, LARGO_HASH } from '@/lib/ids'

describe('nuevoHash', () => {
  it('mide 24 caracteres', () => {
    expect(nuevoHash()).toHaveLength(LARGO_HASH)
    expect(LARGO_HASH).toBe(24)
  })

  it('viaja en una URL sin escaparse', () => {
    for (let i = 0; i < 200; i++) {
      const h = nuevoHash()
      expect(encodeURIComponent(h)).toBe(h)
    }
  })

  it('no se repite', () => {
    const muchos = new Set(Array.from({ length: 5000 }, nuevoHash))
    expect(muchos.size).toBe(5000)
  })

  it('no lleva orden ni pista de cuántos hay', () => {
    // Lo contrario del id 5, 6, 7: de un hash no se deduce el siguiente.
    const a = nuevoHash()
    const b = nuevoHash()
    expect(a).not.toBe(b)
    // Dos hashes seguidos no comparten un prefijo largo.
    let iguales = 0
    while (iguales < a.length && a[iguales] === b[iguales]) iguales++
    expect(iguales).toBeLessThan(8)
  })

  it('usa un alfabeto parejo, sin caracteres raros', () => {
    for (let i = 0; i < 200; i++) {
      expect(nuevoHash()).toMatch(/^[A-Za-z0-9_-]{24}$/)
    }
  })
})
