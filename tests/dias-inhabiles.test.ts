import { describe, it, expect } from 'vitest'
import {
  diasDelRango,
  festivosQueCuentan,
  fechaDeTexto,
  vacacionesDeFinDeAnio,
  coberturaDelAnio,
  avisoDeCalendario,
  MUEVE_LA_FECHA_LIMITE,
} from '@/lib/dias-inhabiles'

const f = (s: string) => new Date(`${s}T12:00:00`)
const ymd = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

describe('diasDelRango', () => {
  it('un solo día es un solo día', () => {
    expect(diasDelRango(f('2026-01-01'), f('2026-01-01')).map(ymd)).toEqual(['2026-01-01'])
  })

  it('abre el rango completo, con los dos extremos dentro', () => {
    expect(diasDelRango(f('2026-03-30'), f('2026-04-03')).map(ymd)).toEqual([
      '2026-03-30', '2026-03-31', '2026-04-01', '2026-04-02', '2026-04-03',
    ])
  })

  it('cruza el cambio de año', () => {
    expect(diasDelRango(f('2026-12-30'), f('2027-01-02')).map(ymd)).toEqual([
      '2026-12-30', '2026-12-31', '2027-01-01', '2027-01-02',
    ])
  })

  it('devuelve vacío si el final va antes que el inicio', () => {
    expect(diasDelRango(f('2026-05-10'), f('2026-05-01'))).toEqual([])
  })

  it('no se desborda con un rango absurdo', () => {
    // Un rango de años no debe colgar el servidor ni comerse la memoria.
    const muchos = diasDelRango(f('2026-01-01'), f('2050-01-01'))
    expect(muchos.length).toBeLessThanOrEqual(3660)
  })
})

describe('qué mueve la fecha límite de pago', () => {
  it('solo el día inhábil la mueve', () => {
    expect(MUEVE_LA_FECHA_LIMITE).toEqual(['DIA_INHABIL'])
  })

  it('toma los días de un festivo', () => {
    const dias = festivosQueCuentan(
      [{ tipo: 'DIA_INHABIL', desde: f('2026-01-01'), hasta: f('2026-01-01') }],
      2026,
    )
    expect(dias.map(ymd)).toEqual(['2026-01-01'])
  })

  it('ignora las vacaciones: la mensualidad se cobra completa', () => {
    const dias = festivosQueCuentan(
      [{ tipo: 'PERIODO_VACACIONAL', desde: f('2026-07-01'), hasta: f('2026-07-31') }],
      2026,
    )
    expect(dias).toEqual([])
  })

  it('ignora las excepciones', () => {
    const dias = festivosQueCuentan(
      [{ tipo: 'EXCEPCION', desde: f('2026-09-10'), hasta: f('2026-09-10') }],
      2026,
    )
    expect(dias).toEqual([])
  })

  it('abre los festivos que vienen en rango', () => {
    const dias = festivosQueCuentan(
      [
        { tipo: 'DIA_INHABIL', desde: f('2026-12-24'), hasta: f('2026-12-26') },
        { tipo: 'PERIODO_VACACIONAL', desde: f('2026-12-20'), hasta: f('2027-01-05') },
      ],
      2026,
    )
    expect(dias.map(ymd)).toEqual(['2026-12-24', '2026-12-25', '2026-12-26'])
  })
})

describe('fechaDeTexto', () => {
  it('lee una fecha normal y la deja al mediodía', () => {
    const d = fechaDeTexto('2026-06-15')
    expect(d && ymd(d)).toBe('2026-06-15')
    expect(d?.getHours()).toBe(12)
  })

  it('rechaza un día que no existe en ese mes', () => {
    // JavaScript no avisa: `new Date('2026-02-30T12:00:00')` devuelve el 2 de
    // marzo. Guardar eso como día inhábil correría la fecha límite de pago
    // al día equivocado, sin que nadie se entere.
    expect(fechaDeTexto('2026-02-30')).toBeNull()
    expect(fechaDeTexto('2026-04-31')).toBeNull()
    expect(fechaDeTexto('2026-02-29')).toBeNull()
  })

  it('acepta el 29 de febrero de un año bisiesto', () => {
    const d = fechaDeTexto('2028-02-29')
    expect(d && ymd(d)).toBe('2028-02-29')
  })

  it('rechaza un mes que no existe', () => {
    expect(fechaDeTexto('2026-13-01')).toBeNull()
    expect(fechaDeTexto('2026-00-10')).toBeNull()
  })

  it('rechaza lo que no tiene forma de fecha', () => {
    for (const basura of ['', '  ', '15/06/2026', '2026-6-15', 'mañana', '20260615']) {
      expect(fechaDeTexto(basura)).toBeNull()
    }
  })
})

describe('vacacionesDeFinDeAnio', () => {
  const dia = (d: Date) => d.getDay()
  const LUNES = 1
  const VIERNES = 5

  it('2026: del lunes 14 de diciembre al viernes 8 de enero', () => {
    const v = vacacionesDeFinDeAnio(2026)
    expect(ymd(v.desde)).toBe('2026-12-14')
    expect(ymd(v.hasta)).toBe('2027-01-08')
  })

  it('2027: del lunes 13 de diciembre al viernes 7 de enero', () => {
    const v = vacacionesDeFinDeAnio(2027)
    expect(ymd(v.desde)).toBe('2027-12-13')
    expect(ymd(v.hasta)).toBe('2028-01-07')
  })

  it('siempre empieza en lunes y termina en viernes', () => {
    for (let anio = 2026; anio <= 2040; anio++) {
      const v = vacacionesDeFinDeAnio(anio)
      expect(dia(v.desde)).toBe(LUNES)
      expect(dia(v.hasta)).toBe(VIERNES)
    }
  })

  it('empieza al menos una semana antes de Navidad', () => {
    for (let anio = 2026; anio <= 2040; anio++) {
      const v = vacacionesDeFinDeAnio(anio)
      const navidad = new Date(anio, 11, 25, 12)
      const diasAntes = (navidad.getTime() - v.desde.getTime()) / 86400000
      expect(diasAntes).toBeGreaterThanOrEqual(7)
      expect(diasAntes).toBeLessThan(14)
    }
  })

  it('termina después del 6 de enero, nunca antes', () => {
    for (let anio = 2026; anio <= 2040; anio++) {
      const v = vacacionesDeFinDeAnio(anio)
      expect(v.hasta > new Date(anio + 1, 0, 6, 23, 59)).toBe(true)
    }
  })

  it('siempre cruza el cambio de año', () => {
    const v = vacacionesDeFinDeAnio(2026)
    expect(v.desde.getFullYear()).toBe(2026)
    expect(v.hasta.getFullYear()).toBe(2027)
  })
})

describe('los que se repiten cada año', () => {
  const navidad = {
    tipo: 'DIA_INHABIL', cadaAnio: true,
    desde: f('2026-12-25'), hasta: f('2026-12-25'),
  }

  it('vale en el año en que se capturó', () => {
    expect(festivosQueCuentan([navidad], 2026).map(ymd)).toEqual(['2026-12-25'])
  })

  it('vale también en los años siguientes, sin capturarlo de nuevo', () => {
    expect(festivosQueCuentan([navidad], 2030).map(ymd)).toEqual(['2030-12-25'])
    expect(festivosQueCuentan([navidad], 2099).map(ymd)).toEqual(['2099-12-25'])
  })

  it('vale en años anteriores al capturado: la regla no nació ese día', () => {
    expect(festivosQueCuentan([navidad], 2020).map(ymd)).toEqual(['2020-12-25'])
  })

  it('el que NO se repite solo cuenta en su año', () => {
    const unaVez = {
      tipo: 'DIA_INHABIL', cadaAnio: false,
      desde: f('2026-05-04'), hasta: f('2026-05-04'),
    }
    expect(festivosQueCuentan([unaVez], 2026).map(ymd)).toEqual(['2026-05-04'])
    expect(festivosQueCuentan([unaVez], 2027)).toEqual([])
  })

  it('un rango que se repite se abre completo en el año que toque', () => {
    const puente = {
      tipo: 'DIA_INHABIL', cadaAnio: true,
      desde: f('2026-11-14'), hasta: f('2026-11-16'),
    }
    expect(festivosQueCuentan([puente], 2031).map(ymd)).toEqual([
      '2031-11-14', '2031-11-15', '2031-11-16',
    ])
  })

  it('devuelve solo los días del año que se pide, nunca de otro', () => {
    const finDeAnio = {
      tipo: 'DIA_INHABIL', cadaAnio: true,
      desde: f('2026-12-30'), hasta: f('2027-01-02'),
    }
    // En 2030 caen los dos de enero —cola del descanso que arrancó en
    // diciembre de 2029— y los dos de diciembre que arrancan el siguiente.
    // Ni un solo día de 2029 ni de 2031.
    const dias = festivosQueCuentan([finDeAnio], 2030)
    expect(dias.map(ymd).sort()).toEqual([
      '2030-01-01', '2030-01-02', '2030-12-30', '2030-12-31',
    ])
    expect(dias.every((d) => d.getFullYear() === 2030)).toBe(true)
  })

  it('agarra la cola de enero que viene del descanso del año pasado', () => {
    // Este es el que se rompe callado: al calcular la fecha límite de enero
    // de 2031 hay que contar el descanso que arrancó en diciembre de 2030.
    const finDeAnio = {
      tipo: 'DIA_INHABIL', cadaAnio: true,
      desde: f('2026-12-30'), hasta: f('2027-01-02'),
    }
    expect(festivosQueCuentan([finDeAnio], 2031).map(ymd).sort()).toEqual([
      '2031-01-01', '2031-01-02', '2031-12-30', '2031-12-31',
    ])
  })

  it('las vacaciones siguen sin correr la fecha límite, se repitan o no', () => {
    const vacaciones = {
      tipo: 'PERIODO_VACACIONAL', cadaAnio: true,
      desde: f('2026-07-01'), hasta: f('2026-07-31'),
    }
    expect(festivosQueCuentan([vacaciones], 2030)).toEqual([])
  })
})

describe('coberturaDelAnio — qué le falta capturar a cada año', () => {
  const calendario = [
    { tipo: 'DIA_INHABIL', cadaAnio: true, desde: f('2026-12-25'), hasta: f('2026-12-25') },
    { tipo: 'DIA_INHABIL', cadaAnio: false, desde: f('2026-11-16'), hasta: f('2026-11-16') },
    { tipo: 'PERIODO_VACACIONAL', cadaAnio: false, desde: f('2026-12-14'), hasta: f('2027-01-08') },
  ]

  it('los de fecha fija cuentan para cualquier año', () => {
    expect(coberturaDelAnio(calendario, 2026).fijos).toBe(1)
    expect(coberturaDelAnio(calendario, 2099).fijos).toBe(1)
  })

  it('los que se mueven solo cuentan en su año', () => {
    expect(coberturaDelAnio(calendario, 2026).movibles).toBe(1)
    expect(coberturaDelAnio(calendario, 2027).movibles).toBe(0)
  })

  it('un periodo cuenta en los años que toca, aunque los cruce', () => {
    expect(coberturaDelAnio(calendario, 2026).periodos).toBe(1)
    expect(coberturaDelAnio(calendario, 2027).periodos).toBe(1)
    expect(coberturaDelAnio(calendario, 2028).periodos).toBe(0)
  })

  it('un año sin nada más que los fijos está incompleto', () => {
    const c = coberturaDelAnio(calendario, 2028)
    expect(c.completo).toBe(false)
    expect(c.fijos).toBe(1)
  })

  it('un año con las tres cosas está completo', () => {
    expect(coberturaDelAnio(calendario, 2026).completo).toBe(true)
  })
})

describe('avisoDeCalendario — cuándo hay que recordarlo', () => {
  const listo = { completo: true }
  const incompleto = { completo: false }
  const enero = new Date(2026, 0, 15)
  const julio = new Date(2026, 6, 15)
  const noviembre = new Date(2026, 10, 5)
  const diciembre = new Date(2026, 11, 5)

  it('en calma no molesta', () => {
    expect(avisoDeCalendario(julio, listo, listo)).toBeNull()
  })

  it('avisa dos meses antes de que se acabe el año', () => {
    const a = avisoDeCalendario(noviembre, listo, incompleto)
    expect(a?.nivel).toBe('aviso')
    expect(a?.texto).toContain('2027')
  })

  it('en diciembre ya aprieta', () => {
    expect(avisoDeCalendario(diciembre, listo, incompleto)?.nivel).toBe('urgente')
  })

  it('si el año que corre está incompleto, es urgente en cualquier mes', () => {
    expect(avisoDeCalendario(enero, incompleto, listo)?.nivel).toBe('urgente')
    expect(avisoDeCalendario(julio, incompleto, listo)?.nivel).toBe('urgente')
    expect(avisoDeCalendario(enero, incompleto, listo)?.texto).toContain('2026')
  })

  it('el año en curso manda sobre el que viene', () => {
    // Si faltan los dos, primero se avisa del que ya está corriendo: ese ya
    // está saliendo mal hoy.
    expect(avisoDeCalendario(diciembre, incompleto, incompleto)?.texto).toContain('2026')
  })

  it('en noviembre y diciembre no molesta si el año que viene ya está', () => {
    expect(avisoDeCalendario(noviembre, listo, listo)).toBeNull()
    expect(avisoDeCalendario(diciembre, listo, listo)).toBeNull()
  })
})
