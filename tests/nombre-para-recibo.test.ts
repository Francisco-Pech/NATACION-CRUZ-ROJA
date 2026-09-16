import { describe, it, expect } from 'vitest'
import { nombreParaRecibo } from '@/lib/pasarela'

/**
 * El nombre que va impreso en el recibo de OXXO.
 *
 * Stripe exige nombre y apellido, cada uno de dos letras para arriba, y
 * rechaza el cobro entero si no los ve. Un alumno capturado como "Juan"
 * —cosa que pasa— dejaría de poder pagar en la tienda, y el error saldría
 * en inglés y hablando de "first and last name".
 */
describe('nombreParaRecibo', () => {
  it('un nombre completo pasa tal cual', () => {
    expect(nombreParaRecibo('Francisco Eduardo Pech Chim')).toBe('Francisco Eduardo Pech Chim')
  })

  it('con nombre y apellido basta', () => {
    expect(nombreParaRecibo('Ana López')).toBe('Ana López')
  })

  it('a uno de una sola palabra se le agrega qué es', () => {
    expect(nombreParaRecibo('Juan')).toBe('Juan Alumno')
    expect(nombreParaRecibo('Prueba')).toBe('Prueba Alumno')
  })

  // "Ana G" no le sirve a Stripe: la segunda parte tiene una letra.
  it('una inicial suelta no cuenta como apellido', () => {
    expect(nombreParaRecibo('Ana G')).toBe('Ana G Alumno')
  })

  it('los espacios de más no engañan a nadie', () => {
    expect(nombreParaRecibo('  Juan   ')).toBe('Juan Alumno')
  })

  it('sin nombre, algo que se pueda imprimir', () => {
    expect(nombreParaRecibo('')).toBe('Alumno Natación')
    expect(nombreParaRecibo('  ')).toBe('Alumno Natación')
  })
})
