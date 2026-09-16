import { describe, it, expect } from 'vitest'
import { clasesDelMes, clasesEnRango } from '@/lib/clases-del-mes'

const d = (s: string) => new Date(`${s}T12:00:00`)
const dias = (fechas: Date[]) => fechas.map((f) => f.toISOString().slice(0, 10))

describe('clasesDelMes — qué días tiene clase un grupo', () => {
  it('saca los días de la semana en que corre el grupo', () => {
    // Septiembre de 2026: los lunes caen 7, 14, 21 y 28.
    expect(dias(clasesDelMes(2026, 9, [1], []))).toEqual([
      '2026-09-07', '2026-09-14', '2026-09-21', '2026-09-28',
    ])
  })

  it('con varios días los devuelve en orden de calendario, no por día de la semana', () => {
    // Lunes y miércoles: 2, 7, 9, 14… El profesor pasa lista por fecha, no
    // por columnas de "todos los lunes".
    expect(dias(clasesDelMes(2026, 9, [3, 1], [])).slice(0, 4)).toEqual([
      '2026-09-02', '2026-09-07', '2026-09-09', '2026-09-14',
    ])
  })

  it('un día inhábil no tiene clase', () => {
    // El 14 de septiembre no se abre: ese día no debe salir en la lista, o
    // el profesor tendría que dejar un hueco sin saber por qué.
    expect(dias(clasesDelMes(2026, 9, [1], [d('2026-09-14')]))).toEqual([
      '2026-09-07', '2026-09-21', '2026-09-28',
    ])
  })

  it('un inhábil de otro mes no estorba', () => {
    expect(dias(clasesDelMes(2026, 9, [1], [d('2026-10-05')]))).toHaveLength(4)
  })

  it('un grupo sin días no tiene clases', () => {
    expect(clasesDelMes(2026, 9, [], [])).toEqual([])
  })

  it('febrero de un año bisiesto llega hasta el 29', () => {
    // El día 0 del mes siguiente es el último de este; escribir 28 a mano
    // se rompe cada cuatro años.
    const sabados = dias(clasesDelMes(2028, 2, [6], []))
    expect(sabados.at(-1)).toBe('2028-02-26')
    expect(dias(clasesDelMes(2028, 2, [2], [])).at(-1)).toBe('2028-02-29')
  })

  it('las fechas salen al mediodía, no a medianoche', () => {
    // A medianoche, un servidor en otra zona las corre un día y la lista
    // quedaría desfasada respecto al calendario que ve el profesor.
    expect(clasesDelMes(2026, 9, [1], [])[0].getHours()).toBe(12)
  })
})

// ----------------------------------------------------- el rango de fechas
//
// La lista se pide por un tramo de fechas y no por un mes suelto. Un mes
// suelto se queda sin el año: en enero de 2027, "noviembre" ya no alcanza
// noviembre de 2026, que es justo lo que alguien querría revisar.

describe('clasesEnRango — los días de clase entre dos fechas', () => {
  it('recorta el mes por los dos extremos', () => {
    // Los lunes de septiembre de 2026 son 7, 14, 21 y 28.
    expect(dias(clasesEnRango('2026-09-10', '2026-09-22', [1], []))).toEqual([
      '2026-09-14', '2026-09-21',
    ])
  })

  it('incluye los dos extremos', () => {
    expect(dias(clasesEnRango('2026-09-07', '2026-09-14', [1], []))).toEqual([
      '2026-09-07', '2026-09-14',
    ])
  })

  it('cruza de un mes a otro en orden de calendario', () => {
    expect(dias(clasesEnRango('2026-09-25', '2026-10-06', [1], []))).toEqual([
      '2026-09-28', '2026-10-05',
    ])
  })

  // El caso que rompía el filtro por mes: en enero ya no hay forma de
  // alcanzar diciembre del año pasado.
  it('cruza de un año a otro', () => {
    expect(dias(clasesEnRango('2026-12-25', '2027-01-06', [1], []))).toEqual([
      '2026-12-28', '2027-01-04',
    ])
  })

  it('un día inhábil sigue sin tener clase', () => {
    expect(dias(clasesEnRango('2026-09-01', '2026-09-30', [1], [d('2026-09-14')]))).toEqual([
      '2026-09-07', '2026-09-21', '2026-09-28',
    ])
  })

  it('un rango al revés no tiene días', () => {
    expect(clasesEnRango('2026-09-30', '2026-09-01', [1], [])).toEqual([])
  })

  it('sin días de la semana no hay clases', () => {
    expect(clasesEnRango('2026-09-01', '2026-09-30', [], [])).toEqual([])
  })

  it('una fecha que no existe no revienta: devuelve nada', () => {
    expect(clasesEnRango('', '2026-09-30', [1], [])).toEqual([])
  })
})
