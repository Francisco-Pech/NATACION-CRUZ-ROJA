import { describe, it, expect } from 'vitest'
import { ZONA, anioEnCurso, mesEnCurso, hoyEnCancun } from '@/lib/zona'

describe('anioEnCurso', () => {
  it('es la zona de la delegación', () => {
    expect(ZONA).toBe('America/Cancun')
  })

  it('da el año de Cancún, no el de UTC', () => {
    // 1 de enero de 2027, 02:00 UTC. En Cancún —UTC-5, sin horario de
    // verano— todavía son las 21:00 del 31 de diciembre de 2026. Quien
    // capture a esa hora sigue inscribiendo al ciclo 2026.
    expect(anioEnCurso(new Date('2027-01-01T02:00:00Z'))).toBe(2026)
  })

  it('cambia de año a la medianoche de Cancún', () => {
    // 05:00 UTC son las 00:00 en Cancún.
    expect(anioEnCurso(new Date('2027-01-01T04:59:00Z'))).toBe(2026)
    expect(anioEnCurso(new Date('2027-01-01T05:00:00Z'))).toBe(2027)
  })

  it('a media mañana coincide con el año de siempre', () => {
    expect(anioEnCurso(new Date('2026-06-15T18:00:00Z'))).toBe(2026)
  })
})

describe('mesEnCurso — el mes en Cancún, no el del proceso', () => {
  it('da el mes con base 1, como los periodos', () => {
    expect(mesEnCurso(new Date('2026-09-15T12:00:00-05:00'))).toBe(9)
    expect(mesEnCurso(new Date('2026-01-10T12:00:00-05:00'))).toBe(1)
    expect(mesEnCurso(new Date('2026-12-10T12:00:00-05:00'))).toBe(12)
  })

  it('el último día del mes a las 8 de la noche sigue siendo ese mes', () => {
    // En UTC ya es el día 1 del mes siguiente. Si el filtro de pagos se
    // calculara con la zona del proceso, a esa hora abriría en octubre y
    // quien cierra el mes en la ventanilla no vería su propio cobro.
    expect(mesEnCurso(new Date('2026-09-30T20:00:00-05:00'))).toBe(9)
  })

  it('el día 1 a la medianoche ya es el mes nuevo', () => {
    expect(mesEnCurso(new Date('2026-10-01T00:05:00-05:00'))).toBe(10)
  })
})

describe('hoyEnCancun — el día de hoy como lo escribe el campo de fecha', () => {
  it('da "AAAA-MM-DD" con la zona de la delegación', () => {
    // 15 de septiembre de 2026, 18:00 UTC: la una de la tarde en Cancún.
    expect(hoyEnCancun(new Date('2026-09-15T18:00:00Z'))).toBe('2026-09-15')
  })

  it('no se adelanta un día por la zona del proceso', () => {
    // 04:59 UTC del 16 todavía es el 15 en Cancún: a esa hora el profesor
    // sigue pasando la lista del día que acaba de dar.
    expect(hoyEnCancun(new Date('2026-09-16T04:59:00Z'))).toBe('2026-09-15')
    expect(hoyEnCancun(new Date('2026-09-16T05:00:00Z'))).toBe('2026-09-16')
  })
})
