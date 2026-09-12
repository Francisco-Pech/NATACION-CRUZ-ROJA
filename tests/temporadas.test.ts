import { describe, it, expect } from 'vitest'
import {
  mesEnTemporada,
  cursoCorreEnElMes,
  mesesQueCorre,
  seEnciman,
} from '@/lib/temporadas'

const f = (s: string) => new Date(`${s}T12:00:00`)
const t = (desde: string, hasta: string) => ({ desde: f(desde), hasta: f(hasta) })

describe('mesEnTemporada — la temporada se repite cada año', () => {
  const verano = t('2026-07-01', '2026-08-31')

  it('cae dentro en los meses de la temporada', () => {
    expect(mesEnTemporada(2026, 7, verano, true)).toBe(true)
    expect(mesEnTemporada(2026, 8, verano, true)).toBe(true)
  })

  it('queda fuera en los demás meses', () => {
    for (const mes of [1, 2, 3, 4, 5, 6, 9, 10, 11, 12]) {
      expect(mesEnTemporada(2026, mes, verano, true)).toBe(false)
    }
  })

  it('vale igual en los años siguientes: por eso es recurrente', () => {
    expect(mesEnTemporada(2030, 7, verano, true)).toBe(true)
    expect(mesEnTemporada(2030, 1, verano, true)).toBe(false)
  })

  it('el año entero cubre los doce meses', () => {
    const todoElAnio = t('2026-01-01', '2026-12-31')
    for (let mes = 1; mes <= 12; mes++) {
      expect(mesEnTemporada(2027, mes, todoElAnio, true)).toBe(true)
    }
  })

  it('una temporada que cruza el año agarra diciembre y enero', () => {
    const invierno = t('2026-12-15', '2027-01-15')
    expect(mesEnTemporada(2027, 12, invierno, true)).toBe(true)
    expect(mesEnTemporada(2027, 1, invierno, true)).toBe(true)
    expect(mesEnTemporada(2027, 6, invierno, true)).toBe(false)
  })

  it('un mes que solo toca la temporada de refilón sí cuenta', () => {
    // Del 30 de junio al 2 de julio: junio y julio están en temporada.
    const puente = t('2026-06-30', '2026-07-02')
    expect(mesEnTemporada(2026, 6, puente, true)).toBe(true)
    expect(mesEnTemporada(2026, 7, puente, true)).toBe(true)
    expect(mesEnTemporada(2026, 5, puente, true)).toBe(false)
  })
})

describe('mesEnTemporada — la temporada ocurre una sola vez', () => {
  const unaVez = t('2026-07-01', '2026-08-31')

  it('cae dentro solo en su año', () => {
    expect(mesEnTemporada(2026, 7, unaVez, false)).toBe(true)
    expect(mesEnTemporada(2027, 7, unaVez, false)).toBe(false)
    expect(mesEnTemporada(2025, 7, unaVez, false)).toBe(false)
  })
})

describe('cursoCorreEnElMes', () => {
  it('sin temporadas capturadas el curso corre siempre', () => {
    // Lo que no se ha definido no debe dejar de cobrarse de golpe.
    expect(cursoCorreEnElMes(2026, 3, [], 'RECURRENTE')).toBe(true)
  })

  it('con una temporada de todo el año, corre los doce meses', () => {
    const todo = [t('2026-01-01', '2026-12-31')]
    for (let mes = 1; mes <= 12; mes++) {
      expect(cursoCorreEnElMes(2028, mes, todo, 'RECURRENTE')).toBe(true)
    }
  })

  it('mixto: basta que caiga en alguna de sus temporadas', () => {
    const dos = [t('2026-01-15', '2026-02-28'), t('2026-07-01', '2026-08-31')]
    expect(cursoCorreEnElMes(2026, 1, dos, 'MIXTO')).toBe(true)
    expect(cursoCorreEnElMes(2026, 2, dos, 'MIXTO')).toBe(true)
    expect(cursoCorreEnElMes(2026, 7, dos, 'MIXTO')).toBe(true)
    expect(cursoCorreEnElMes(2026, 4, dos, 'MIXTO')).toBe(false)
    // Y como es mixto, se repite al año siguiente.
    expect(cursoCorreEnElMes(2029, 7, dos, 'MIXTO')).toBe(true)
  })

  it('único: solo ese año, nunca más', () => {
    const unica = [t('2026-07-01', '2026-08-31')]
    expect(cursoCorreEnElMes(2026, 7, unica, 'UNICO')).toBe(true)
    expect(cursoCorreEnElMes(2027, 7, unica, 'UNICO')).toBe(false)
  })
})

describe('mesesQueCorre', () => {
  it('sin temporadas no dice nada: está sin definir', () => {
    // Distinto de "corre todo el año". Para cobrar sí corre siempre; para
    // saber si se enciman dos cursos, todavía no hay con qué compararlo.
    expect(mesesQueCorre(2026, [], 'RECURRENTE')).toEqual([])
  })

  it('de enero a marzo son tres meses', () => {
    expect(mesesQueCorre(2026, [t('2026-01-01', '2026-03-31')], 'RECURRENTE'))
      .toEqual([1, 2, 3])
  })

  it('de abril a diciembre son nueve', () => {
    expect(mesesQueCorre(2026, [t('2026-04-01', '2026-12-31')], 'RECURRENTE'))
      .toEqual([4, 5, 6, 7, 8, 9, 10, 11, 12])
  })

  it('junta los meses de todas sus temporadas', () => {
    const dos = [t('2026-01-15', '2026-02-10'), t('2026-07-01', '2026-08-31')]
    expect(mesesQueCorre(2026, dos, 'MIXTO')).toEqual([1, 2, 7, 8])
  })
})

describe('seEnciman — dos cursos con el mismo nombre', () => {
  const eneroAMarzo = [t('2026-01-01', '2026-03-31')]
  const abrilADiciembre = [t('2026-04-01', '2026-12-31')]
  const febreroADiciembre = [t('2026-02-01', '2026-12-31')]

  it('enero-marzo y abril-diciembre pueden convivir', () => {
    expect(seEnciman(2026, eneroAMarzo, 'RECURRENTE', abrilADiciembre, 'RECURRENTE')).toBe(false)
  })

  it('enero-marzo y febrero-diciembre no: comparten febrero y marzo', () => {
    expect(seEnciman(2026, eneroAMarzo, 'RECURRENTE', febreroADiciembre, 'RECURRENTE')).toBe(true)
  })

  it('se enciman aunque sea por un solo mes', () => {
    const marzoAMayo = [t('2026-03-01', '2026-05-31')]
    expect(seEnciman(2026, eneroAMarzo, 'RECURRENTE', marzoAMayo, 'RECURRENTE')).toBe(true)
  })

  it('si a alguno le faltan fechas, todavía no hay nada que comparar', () => {
    expect(seEnciman(2026, eneroAMarzo, 'RECURRENTE', [], 'RECURRENTE')).toBe(false)
    expect(seEnciman(2026, [], 'RECURRENTE', [], 'RECURRENTE')).toBe(false)
  })

  it('un curso de una sola vez no estorba al del año siguiente', () => {
    const soloEn2026 = [t('2026-05-01', '2026-06-30')]
    expect(seEnciman(2027, soloEn2026, 'UNICO', [t('2027-05-01', '2027-06-30')], 'UNICO')).toBe(false)
  })
})
