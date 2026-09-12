import { describe, it, expect } from 'vitest'
import { formatearFolio, generarTokenQR } from '@/lib/folio'

describe('formatearFolio', () => {
  it('rellena el consecutivo a cuatro dígitos', () => {
    expect(formatearFolio(2026, 42)).toBe('CRM-2026-0042')
    expect(formatearFolio(2026, 1)).toBe('CRM-2026-0001')
  })
  it('no trunca consecutivos de más de cuatro dígitos', () => {
    expect(formatearFolio(2026, 12345)).toBe('CRM-2026-12345')
  })
})

describe('generarTokenQR', () => {
  it('produce un token largo', () => {
    expect(generarTokenQR().length).toBeGreaterThanOrEqual(43)
  })
  it('no repite tokens', () => {
    const tokens = new Set(Array.from({ length: 500 }, generarTokenQR))
    expect(tokens.size).toBe(500)
  })
  it('usa solo caracteres seguros para una URL', () => {
    expect(generarTokenQR()).toMatch(/^[A-Za-z0-9_-]+$/)
  })
})
