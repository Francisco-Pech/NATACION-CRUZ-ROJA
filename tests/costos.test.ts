import { describe, it, expect } from 'vitest'
import { vigenteEn, seEncimanRangos } from '@/lib/costos'

const f = (s: string) => new Date(`${s}T12:00:00`)
const r = (desde: string, hasta: string, monto: number) => ({
  desde: f(desde), hasta: f(hasta), monto,
})

const DOS_MIL_VEINTISEIS = r('2026-01-01', '2026-12-31', 77000)
const DOS_MIL_VEINTISIETE = r('2027-01-01', '2027-12-31', 82000)

describe('vigenteEn — qué monto vale en una fecha', () => {
  it('toma el que cubre la fecha', () => {
    const filas = [DOS_MIL_VEINTISEIS, DOS_MIL_VEINTISIETE]
    expect(vigenteEn(filas, f('2026-06-15'))?.monto).toBe(77000)
    expect(vigenteEn(filas, f('2027-06-15'))?.monto).toBe(82000)
  })

  // Los extremos cuentan: un precio que vale "hasta el 31 de diciembre"
  // tiene que valer el 31 de diciembre.
  it('incluye el primer y el último día', () => {
    expect(vigenteEn([DOS_MIL_VEINTISEIS], f('2026-01-01'))?.monto).toBe(77000)
    expect(vigenteEn([DOS_MIL_VEINTISEIS], f('2026-12-31'))?.monto).toBe(77000)
  })

  // Sin precio no se inventa uno: es preferible que un curso no se cobre a
  // que se cobre un número que nadie autorizó.
  it('devuelve nada cuando ninguna fila cubre la fecha', () => {
    expect(vigenteEn([DOS_MIL_VEINTISEIS], f('2027-03-01'))).toBeNull()
    expect(vigenteEn([], f('2026-03-01'))).toBeNull()
  })

  it('no se sale por un día', () => {
    expect(vigenteEn([DOS_MIL_VEINTISEIS], f('2025-12-31'))).toBeNull()
    expect(vigenteEn([DOS_MIL_VEINTISEIS], f('2027-01-01'))).toBeNull()
  })

  // Si dos filas cubren la misma fecha —no debería pasar, se valida al
  // guardar— manda la que empieza después: es la corrección más reciente.
  it('con dos que cubren, manda la que empieza después', () => {
    const filas = [DOS_MIL_VEINTISEIS, r('2026-07-01', '2026-12-31', 80000)]
    expect(vigenteEn(filas, f('2026-08-01'))?.monto).toBe(80000)
    expect(vigenteEn(filas, f('2026-03-01'))?.monto).toBe(77000)
  })
})

describe('seEncimanRangos — dos precios para la misma fecha', () => {
  it('deja pasar rangos que no se tocan', () => {
    expect(seEncimanRangos(DOS_MIL_VEINTISEIS, DOS_MIL_VEINTISIETE)).toBe(false)
  })

  it('detecta que uno cae dentro del otro', () => {
    expect(seEncimanRangos(DOS_MIL_VEINTISEIS, r('2026-06-01', '2026-08-31', 1))).toBe(true)
  })

  it('detecta que se traslapan por una punta', () => {
    expect(seEncimanRangos(DOS_MIL_VEINTISEIS, r('2026-12-31', '2027-06-30', 1))).toBe(true)
  })

  it('un día pegado al otro no se encima', () => {
    expect(seEncimanRangos(r('2026-01-01', '2026-06-30', 1), r('2026-07-01', '2026-12-31', 1))).toBe(false)
  })
})
