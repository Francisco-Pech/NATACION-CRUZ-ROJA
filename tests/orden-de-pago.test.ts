import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { faltaUnMesAntes, faltaUnPeriodoAntes } from '@/lib/cargos'

/** Un mes con sus cargos, como los ve la ventana de mensualidades. */
const mes = (n: number, ...cubiertos: boolean[]) => ({
  mes: n,
  cargos: cubiertos.map((cubierto) => ({ cubierto })),
})

describe('faltaUnMesAntes — no se paga diciembre debiendo octubre', () => {
  it('el primero de la lista siempre se puede pagar', () => {
    const meses = [mes(9, false), mes(10, false), mes(11, false)]
    expect(faltaUnMesAntes(meses, 9)).toBeNull()
  })

  it('un mes de más adelante queda detenido, y dice cuál falta', () => {
    const meses = [mes(9, false), mes(10, false), mes(11, false)]
    expect(faltaUnMesAntes(meses, 11)).toBe(9)
  })

  it('al saldar uno se habilita el siguiente, no el de más allá', () => {
    const meses = [mes(9, true), mes(10, false), mes(11, false)]
    expect(faltaUnMesAntes(meses, 10)).toBeNull()
    expect(faltaUnMesAntes(meses, 11)).toBe(10)
  })

  it('con todo saldado, cualquiera se puede adelantar', () => {
    const meses = [mes(9, true), mes(10, true), mes(11, true)]
    expect(faltaUnMesAntes(meses, 12)).toBeNull()
  })

  it('nombra el más viejo que falta, no el más cercano', () => {
    // Si se saltaron dos, quien atiende tiene que empezar por el de arriba.
    const meses = [mes(9, false), mes(10, false), mes(11, true)]
    expect(faltaUnMesAntes(meses, 12)).toBe(9)
  })

  it('un mes sin cargos no detiene a nadie', () => {
    // Pasa cuando el curso está fuera de temporada, o cuando todavía no
    // corre la cobranza de ese mes: ahí no se debe nada, y trabar el resto
    // por un mes que nunca va a generar cargo dejaría al alumno sin poder
    // pagar lo que sí debe.
    const meses = [mes(9, true), { mes: 10, cargos: [] }, mes(11, false)]
    expect(faltaUnMesAntes(meses, 11)).toBeNull()
  })

  it('con dos cursos el mes solo queda saldado si los dos lo están', () => {
    const meses = [mes(9, true, false), mes(10, false)]
    expect(faltaUnMesAntes(meses, 10)).toBe(9)
  })

  it('un mes que no está en la lista no se puede cobrar', () => {
    const meses = [mes(9, true)]
    expect(faltaUnMesAntes(meses, 9)).toBeNull()
  })
})

describe('el orden se exige en el servidor, no solo en la pantalla', () => {
  const fuente = readFileSync('src/app/panel/alumnos/pagos-acciones.ts', 'utf8')

  // La ventana esconde el botón del mes adelantado, pero eso solo vive en el
  // navegador: el formulario puede llegar de cualquier lado, y si la acción
  // no vuelve a preguntar, el candado es decorativo.
  for (const accion of ['marcarPagado', 'adelantarMes']) {
    it(`${accion} vuelve a revisar el orden`, () => {
      const desde = fuente.indexOf(`export async function ${accion}`)
      expect(desde).toBeGreaterThan(-1)
      const cuerpo = fuente.slice(desde, fuente.indexOf('\n}', desde))
      expect(cuerpo).toContain('faltaUnMesAntes')
    })
  }
})

// ------------------------------------------------- el mismo orden, con años
//
// La pantalla de pago en línea enseña todos los meses de todos los años, así
// que el mes solo ya no alcanza: enero de 2027 va después de diciembre de
// 2026, no antes. Las claves "2026-12" se comparan como texto, que en ese
// orden es comparar calendario.

describe('faltaUnPeriodoAntes — el orden cruzando el año', () => {
  const p = (clave: string, cubierto: boolean) => ({ clave, cubierto })

  it('el primero que se debe siempre se puede pagar', () => {
    const meses = [p('2026-11', false), p('2026-12', false), p('2027-01', false)]
    expect(faltaUnPeriodoAntes(meses, '2026-11')).toBeNull()
  })

  it('enero del año que entra no se paga debiendo noviembre', () => {
    const meses = [p('2026-11', false), p('2026-12', false), p('2027-01', false)]
    expect(faltaUnPeriodoAntes(meses, '2027-01')).toBe('2026-11')
  })

  it('al saldar uno se abre el siguiente, no el de más allá', () => {
    const meses = [p('2026-11', true), p('2026-12', false), p('2027-01', false)]
    expect(faltaUnPeriodoAntes(meses, '2026-12')).toBeNull()
    expect(faltaUnPeriodoAntes(meses, '2027-01')).toBe('2026-12')
  })

  it('con todo saldado se puede adelantar lo que sea', () => {
    const meses = [p('2026-11', true), p('2026-12', true), p('2027-01', true)]
    expect(faltaUnPeriodoAntes(meses, '2027-02')).toBeNull()
  })

  it('una deuda vieja de otro año detiene todo lo de este', () => {
    const meses = [p('2025-08', false), p('2026-09', false)]
    expect(faltaUnPeriodoAntes(meses, '2026-09')).toBe('2025-08')
  })
})
