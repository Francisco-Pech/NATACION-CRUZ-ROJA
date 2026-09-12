import { describe, it, expect } from 'vitest'
import { generarClave, validarClaves, LARGO_MINIMO } from '@/lib/claves'

describe('generarClave — una contraseña al azar', () => {
  it('mide lo que se le pida, y por omisión más que el mínimo', () => {
    expect(generarClave().length).toBeGreaterThanOrEqual(LARGO_MINIMO)
    expect(generarClave(20).length).toBe(20)
  })

  // Se dicta en voz alta y se anota a mano: una l y un 1 juntos en un papel
  // son la misma raya, y el usuario se queda afuera sin saber por qué.
  it('no usa caracteres que se confunden al leerlos', () => {
    const confusos = /[lI1O0]/
    for (let i = 0; i < 200; i++) {
      expect(generarClave()).not.toMatch(confusos)
    }
  })

  it('no repite la misma dos veces', () => {
    const muchas = new Set(Array.from({ length: 500 }, () => generarClave()))
    expect(muchas.size).toBe(500)
  })

  it('mezcla letras y números', () => {
    for (let i = 0; i < 50; i++) {
      const c = generarClave()
      expect(c).toMatch(/[0-9]/)
      expect(c).toMatch(/[a-z]/)
      expect(c).toMatch(/[A-Z]/)
    }
  })

  // Pedir menos del mínimo es un error de quien llama, no algo que deba
  // obedecerse: una contraseña de tres letras no protege nada.
  it('nunca entrega una más corta que el mínimo', () => {
    expect(generarClave(3).length).toBe(LARGO_MINIMO)
  })
})

describe('validarClaves — la contraseña y su confirmación', () => {
  it('acepta dos iguales y suficientemente largas', () => {
    expect(validarClaves('Alberca2026', 'Alberca2026')).toBeNull()
  })

  it('rechaza que no coincidan', () => {
    expect(validarClaves('Alberca2026', 'Alberca2027')).toMatch(/no coinciden/i)
  })

  // Se compara tal cual: un espacio al final es parte de la contraseña, y
  // recortarlo dejaría entrar una que no es la que se guardó.
  it('un espacio de más es una contraseña distinta', () => {
    expect(validarClaves('Alberca2026', 'Alberca2026 ')).toMatch(/no coinciden/i)
  })

  it('rechaza una más corta que el mínimo', () => {
    expect(validarClaves('corta1', 'corta1')).toMatch(new RegExp(String(LARGO_MINIMO)))
  })

  it('rechaza la confirmación vacía', () => {
    expect(validarClaves('Alberca2026', '')).toMatch(/confirma/i)
  })

  it('rechaza la contraseña vacía', () => {
    expect(validarClaves('', '')).toMatch(/falta/i)
  })
})
