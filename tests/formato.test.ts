import { describe, it, expect } from 'vitest'
import { conMayuscula, nombreMes } from '@/lib/formato'

/**
 * Los meses se guardan en minúscula porque casi siempre van dentro de una
 * frase —"pagar noviembre de 2026"—, pero cuando encabezan una tarjeta se
 * leen como un descuido.
 */
describe('conMayuscula', () => {
  it('sube la primera letra y deja el resto', () => {
    expect(conMayuscula('septiembre')).toBe('Septiembre')
    expect(conMayuscula(nombreMes(12))).toBe('Diciembre')
  })

  it('no toca lo que ya viene en mayúscula', () => {
    expect(conMayuscula('Enero')).toBe('Enero')
  })

  it('respeta los acentos', () => {
    expect(conMayuscula('énero')).toBe('Énero')
  })

  it('con nada devuelve nada', () => {
    expect(conMayuscula('')).toBe('')
  })
})
