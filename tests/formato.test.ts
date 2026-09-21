import { describe, it, expect } from 'vitest'
import { conMayuscula, nombreMes, nombreDeAlumno } from '@/lib/formato'

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

describe('nombreDeAlumno', () => {
  it('lo pone en mayúsculas', () => {
    expect(nombreDeAlumno('francisco pech')).toBe('FRANCISCO PECH')
  })

  // En español la mayúscula lleva su acento: JOSÉ, no JOSE. Es el nombre de
  // una persona y así va impreso en su credencial.
  it('respeta los acentos y la eñe', () => {
    expect(nombreDeAlumno('josé maría muñoz')).toBe('JOSÉ MARÍA MUÑOZ')
  })

  it('quita los espacios de sobra', () => {
    expect(nombreDeAlumno('  ana   sofía  ')).toBe('ANA SOFÍA')
  })

  it('lo que ya venía en mayúsculas se queda igual', () => {
    expect(nombreDeAlumno('LENNY')).toBe('LENNY')
  })

  it('vacío se queda vacío', () => {
    expect(nombreDeAlumno('   ')).toBe('')
  })
})
