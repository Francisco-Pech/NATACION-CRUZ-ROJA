import { describe, it, expect } from 'vitest'
import { porMes, acumulado, saturacion, type Movimiento } from '@/lib/estadisticas'

const mov = (
  mes: number, inscripcionId: string, montoNeto: number, pagado: number,
  extra: Partial<Movimiento> = {},
): Movimiento => ({
  mes, inscripcionId, montoNeto, pagado,
  anio: extra.anio ?? 2026,
  curso: extra.curso ?? 'Adultos',
  horario: extra.horario ?? '06:00–07:00',
})

describe('porMes — cuántos alumnos pagaron y cuánto entró cada mes', () => {
  it('cuenta alumnos, no cargos', () => {
    // Quien lleva dos cursos paga dos cargos el mismo mes: es un alumno que
    // pagó, no dos. Contar cargos inflaría la gráfica justo con los alumnos
    // que más dejan.
    const meses = porMes([
      mov(9, 'ana', 77000, 77000, { curso: 'Adultos' }),
      mov(9, 'ana', 50000, 50000, { curso: 'Salvavidas' }),
    ])
    expect(meses).toHaveLength(1)
    expect(meses[0].alumnos).toBe(1)
    expect(meses[0].cobrado).toBe(127000)
  })

  it('quien abonó a medias también pagó', () => {
    // La gráfica contesta "cuántos pagaron", no "cuántos quedaron al
    // corriente". Con un filtro por forma de pago puesto, alguien puede
    // haber cubierto su mes entre efectivo y transferencia, y dejarlo fuera
    // por eso diría que no pagó nadie.
    const meses = porMes([mov(9, 'ana', 77000, 40000)])
    expect(meses[0].alumnos).toBe(1)
    expect(meses[0].cobrado).toBe(40000)
  })

  it('quien no puso un peso no cuenta', () => {
    const meses = porMes([mov(9, 'ana', 77000, 0)])
    expect(meses[0].alumnos).toBe(0)
  })

  it('con dos cursos, basta con que haya pagado uno', () => {
    const meses = porMes([
      mov(9, 'ana', 77000, 77000, { curso: 'Adultos' }),
      mov(9, 'ana', 50000, 0, { curso: 'Salvavidas' }),
    ])
    expect(meses[0].alumnos).toBe(1)
  })

  it('sale un renglón por mes, en orden', () => {
    const meses = porMes([
      mov(11, 'ana', 100, 100),
      mov(9, 'ana', 100, 100),
      mov(10, 'beto', 100, 100),
    ])
    expect(meses.map((m) => m.mes)).toEqual([9, 10, 11])
  })

  it('un mes sin nada cobrado sigue saliendo, en cero', () => {
    // El hueco es el dato: un mes que no aparece se lee como "no hubo mes".
    const meses = porMes([mov(9, 'ana', 77000, 0)])
    expect(meses).toEqual([{ mes: 9, alumnos: 0, cobrado: 0, esperado: 77000 }])
  })

  it('sin movimientos no hay meses', () => {
    expect(porMes([])).toEqual([])
  })
})

describe('acumulado — cómo se va juntando el dinero', () => {
  it('cada mes carga con lo de los anteriores', () => {
    const suma = acumulado([
      { mes: 9, alumnos: 1, cobrado: 100, esperado: 100 },
      { mes: 10, alumnos: 2, cobrado: 200, esperado: 200 },
      { mes: 11, alumnos: 1, cobrado: 50, esperado: 50 },
    ])
    expect(suma.map((s) => s.total)).toEqual([100, 300, 350])
  })

  it('un mes en cero no baja la línea, la deja plana', () => {
    const suma = acumulado([
      { mes: 9, alumnos: 1, cobrado: 100, esperado: 100 },
      { mes: 10, alumnos: 0, cobrado: 0, esperado: 200 },
    ])
    expect(suma.map((s) => s.total)).toEqual([100, 100])
  })

  it('sin meses no hay línea', () => {
    expect(acumulado([])).toEqual([])
  })
})

describe('saturacion — qué tan lleno está cada grupo', () => {
  const grupo = (curso: string, horario: string) => ({ curso, horario })

  it('sale un renglón por grupo abierto, tenga o no alumnos', () => {
    // Un grupo vacío es el dato más útil de la gráfica: enseña dónde hay
    // lugar. Si solo salieran los que tienen gente, la pantalla contestaría
    // "todo lleno" justo cuando hay media alberca sin usar.
    const filas = saturacion(
      [{ inscripcionId: 'ana', curso: 'Adultos', horario: '06:00–07:00' }],
      [grupo('Adultos', '06:00–07:00'), grupo('Adultos', '07:00–08:00'), grupo('Niños', '17:00–18:00')],
    )
    expect(filas).toHaveLength(3)
    expect(filas.map((f) => f.alumnos)).toEqual([1, 0, 0])
  })

  it('cuenta alumnos distintos por curso y horario', () => {
    const filas = saturacion(
      [
        { inscripcionId: 'ana', curso: 'Adultos', horario: '06:00–07:00' },
        { inscripcionId: 'beto', curso: 'Adultos', horario: '06:00–07:00' },
        { inscripcionId: 'ana', curso: 'Niños', horario: '17:00–18:00' },
      ],
      [grupo('Adultos', '06:00–07:00'), grupo('Niños', '17:00–18:00')],
    )
    expect(filas).toEqual([
      { curso: 'Adultos', horario: '06:00–07:00', alumnos: 2 },
      { curso: 'Niños', horario: '17:00–18:00', alumnos: 1 },
    ])
  })

  it('el mismo alumno dos veces en el mismo grupo cuenta una', () => {
    // Puede pasar si va lunes y miércoles: son dos sesiones, un alumno.
    const filas = saturacion(
      [
        { inscripcionId: 'ana', curso: 'Adultos', horario: '06:00–07:00' },
        { inscripcionId: 'ana', curso: 'Adultos', horario: '06:00–07:00' },
      ],
      [grupo('Adultos', '06:00–07:00')],
    )
    expect(filas[0].alumnos).toBe(1)
  })

  it('un alumno de un grupo que ya cerró no se cuela', () => {
    // Si el horario se apagó, el grupo no está en la lista y su gente no
    // debe aparecer como si siguiera ocupando lugar.
    const filas = saturacion(
      [{ inscripcionId: 'ana', curso: 'Adultos', horario: '22:00–23:00' }],
      [grupo('Adultos', '06:00–07:00')],
    )
    expect(filas).toEqual([{ curso: 'Adultos', horario: '06:00–07:00', alumnos: 0 }])
  })

  it('sale del más lleno al más vacío', () => {
    const filas = saturacion(
      [
        { inscripcionId: 'a', curso: 'X', horario: '08:00–09:00' },
        { inscripcionId: 'b', curso: 'Y', horario: '09:00–10:00' },
        { inscripcionId: 'c', curso: 'Y', horario: '09:00–10:00' },
      ],
      [grupo('X', '08:00–09:00'), grupo('Y', '09:00–10:00')],
    )
    expect(filas.map((f) => f.alumnos)).toEqual([2, 1])
  })

  it('empatados, se ordenan por curso y luego por hora', () => {
    // Para que los grupos de un mismo curso queden juntos y la gráfica no
    // baile entre una recarga y otra.
    const filas = saturacion(
      [],
      [grupo('Niños', '07:00–08:00'), grupo('Adultos', '18:00–19:00'), grupo('Adultos', '07:00–08:00')],
    )
    expect(filas.map((f) => `${f.curso} ${f.horario}`)).toEqual([
      'Adultos 07:00–08:00',
      'Adultos 18:00–19:00',
      'Niños 07:00–08:00',
    ])
  })

  it('sin grupos abiertos no hay nada que enseñar', () => {
    expect(saturacion([{ inscripcionId: 'a', curso: 'X', horario: '08:00–09:00' }], [])).toEqual([])
  })
})
