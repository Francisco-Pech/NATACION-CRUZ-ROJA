import { describe, it, expect } from 'vitest'
import { generarFolio, LARGO_AL_AZAR, generarTokenQR, normalizarFolio } from '@/lib/folio'

describe('generarFolio', () => {
  it('empieza con CR y el año', () => {
    expect(generarFolio(2026)).toMatch(/^CR2026/)
    expect(generarFolio(2027)).toMatch(/^CR2027/)
  })

  it('cierra con ocho caracteres al azar', () => {
    const folio = generarFolio(2026)
    expect(folio).toHaveLength('CR2026'.length + LARGO_AL_AZAR)
    expect(folio.slice('CR2026'.length)).toHaveLength(8)
  })

  it('no usa caracteres que se confundan al leerlos en papel', () => {
    // Se dicta y se teclea desde una credencial impresa: la I y el 1 son la
    // misma raya, y la O y el 0 el mismo óvalo.
    // Solo el sufijo: el año lleva sus propios ceros y unos.
    const sufijos = Array.from({ length: 200 }, () => generarFolio(2026).slice(6)).join('')
    expect(sufijos).not.toMatch(/[IO01]/)
  })

  it('usa solo mayúsculas y dígitos', () => {
    expect(generarFolio(2026)).toMatch(/^CR\d{4}[A-Z2-9]{8}$/)
  })

  it('no repite folios', () => {
    const folios = new Set(Array.from({ length: 500 }, () => generarFolio(2026)))
    expect(folios.size).toBe(500)
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

  it('no se puede deducir del folio', () => {
    // El estado de cuenta se abre sin contraseña con solo el token. Si el
    // token saliera del folio —que va impreso en la credencial y se dicta
    // por teléfono— cualquiera que lo oyera abriría el adeudo ajeno.
    const folio = generarFolio(2026)
    const token = generarTokenQR()
    expect(token).not.toContain(folio)
    expect(token).not.toContain(folio.slice(6))
  })
})

// --------------------------------------------------- lo que alguien teclea
//
// El folio va impreso en la credencial y se teclea a mano en la pantalla de
// pago. Quien lo copia pone espacios, guiones o minúsculas, y ninguno de
// esos es motivo para decirle que su folio no existe.

describe('normalizarFolio — lo que se teclea contra lo que se guardó', () => {
  it('sube a mayúsculas', () => {
    expect(normalizarFolio('cr2026l4hzwhl3')).toBe('CR2026L4HZWHL3')
  })

  it('quita espacios, aunque vayan en medio', () => {
    expect(normalizarFolio('  CR2026 L4HZ WHL3 ')).toBe('CR2026L4HZWHL3')
  })

  it('quita los guiones con que la gente separa', () => {
    expect(normalizarFolio('CR2026-L4HZ-WHL3')).toBe('CR2026L4HZWHL3')
  })

  it('tira cualquier otro símbolo en vez de buscarlo tal cual', () => {
    expect(normalizarFolio('CR2026/L4HZ.WHL3')).toBe('CR2026L4HZWHL3')
  })

  it('con nada devuelve nada', () => {
    expect(normalizarFolio('')).toBe('')
    expect(normalizarFolio('   ')).toBe('')
  })
})
