import { describe, it, expect } from 'vitest'
import { cabeUnoMas } from '@/lib/cupos'

describe('cabeUnoMas — cupo, extras y lleno', () => {
  it('deja entrar sin aviso mientras haya lugar dentro del cupo', () => {
    expect(cabeUnoMas(0, 30, 10)).toBe('cabe')
    expect(cabeUnoMas(29, 30, 10)).toBe('cabe')
  })

  // El que ocupa el último lugar del cupo entra normal; el siguiente ya va
  // sobre el cupo.
  it('avisa cuando se empieza a usar los extras', () => {
    expect(cabeUnoMas(30, 30, 10)).toBe('con-extras')
    expect(cabeUnoMas(39, 30, 10)).toBe('con-extras')
  })

  it('no deja entrar pasando los extras', () => {
    expect(cabeUnoMas(40, 30, 10)).toBe('lleno')
    expect(cabeUnoMas(99, 30, 10)).toBe('lleno')
  })

  // Sin extras el cupo es una pared: es el comportamiento de hoy, y no debe
  // cambiar por agregar la tolerancia.
  it('sin extras se llena en el cupo', () => {
    expect(cabeUnoMas(29, 30, 0)).toBe('cabe')
    expect(cabeUnoMas(30, 30, 0)).toBe('lleno')
  })

  it('un cupo de cero está lleno desde el principio', () => {
    expect(cabeUnoMas(0, 0, 0)).toBe('lleno')
  })

  // Si alguien ya quedó por encima del tope —el cupo se bajó después de
  // inscribir— no se deja entrar a nadie más.
  it('sigue lleno si ya se pasó del tope', () => {
    expect(cabeUnoMas(45, 30, 10)).toBe('lleno')
  })
})
