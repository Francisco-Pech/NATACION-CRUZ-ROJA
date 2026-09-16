/**
 * Las cuentas del tablero.
 *
 * Viven aparte de la pantalla porque son lo único que puede estar mal de
 * forma silenciosa: una gráfica bonita con un conteo equivocado se ve igual
 * de bien que una correcta.
 */

/** Un cargo con lo que se le pagó, ya aplanado para contar. */
export type Movimiento = {
  anio: number
  mes: number
  /** Para contar alumnos y no cargos: quien lleva dos cursos es uno. */
  inscripcionId: string
  curso: string
  horario: string
  montoNeto: number
  /** Lo confirmado. Lo que está en revisión todavía puede rechazarse. */
  pagado: number
}

export type MesDelTablero = {
  mes: number
  /** Cuántos alumnos distintos pagaron algo de ese mes. */
  alumnos: number
  cobrado: number
  esperado: number
}

/**
 * Qué pasó cada mes: cuántos alumnos pagaron y cuánto entró.
 *
 * Se cuentan **alumnos**, no cargos. Quien lleva dos cursos paga dos cargos
 * el mismo mes, y contarlos por separado inflaría la gráfica justo con los
 * alumnos que más dejan.
 *
 * Cuenta el que puso algo, no el que quedó al corriente. Con un filtro de
 * forma de pago puesto, alguien pudo cubrir su mes entre efectivo y
 * transferencia; exigir que lo cubriera todo con la forma filtrada diría
 * que ese mes no pagó nadie.
 */
export function porMes(movimientos: Movimiento[]): MesDelTablero[] {
  const meses = new Map<number, { cobrado: number; esperado: number; quienes: Set<string> }>()

  for (const m of movimientos) {
    const mes = meses.get(m.mes) ?? { cobrado: 0, esperado: 0, quienes: new Set<string>() }
    mes.cobrado += m.pagado
    mes.esperado += m.montoNeto
    if (m.pagado > 0) mes.quienes.add(m.inscripcionId)
    meses.set(m.mes, mes)
  }

  return [...meses.entries()]
    .map(([mes, { cobrado, esperado, quienes }]) => ({
      mes,
      alumnos: quienes.size,
      cobrado,
      esperado,
    }))
    .sort((a, b) => a.mes - b.mes)
}

/**
 * Cómo se va juntando el dinero a lo largo del año.
 *
 * Un mes flojo no baja la línea, la deja plana: lo acumulado no se devuelve.
 * Eso es justo lo que se quiere ver de un vistazo — si la curva se aplana,
 * dejó de entrar dinero.
 */
export function acumulado(meses: MesDelTablero[]): Array<{ mes: number; total: number }> {
  let suma = 0
  return meses.map((m) => {
    suma += m.cobrado
    return { mes: m.mes, total: suma }
  })
}

/** Un alumno apuntado a un curso en un horario. */
export type Apuntado = { inscripcionId: string; curso: string; horario: string }

/** Un grupo que está abierto: un curso a una hora. */
export type Grupo = { curso: string; horario: string }

/**
 * Qué tan lleno está cada grupo abierto.
 *
 * Los grupos salen de la rejilla, no de quién está apuntado. Esa es la
 * diferencia que importa: un grupo vacío es el dato más útil de la gráfica
 * —enseña dónde hay lugar—, y armar la lista con los alumnos lo escondería
 * justo cuando hay media alberca sin usar.
 *
 * Alumnos distintos, no renglones: quien va lunes y miércoles está en dos
 * sesiones del mismo grupo y es una persona en el agua, no dos.
 *
 * Del más lleno al más vacío. Los empatados se ordenan por curso y luego por
 * hora, para que los grupos de un mismo curso queden juntos y la gráfica no
 * baile entre una recarga y otra.
 */
export function saturacion(
  apuntados: Apuntado[],
  grupos: Grupo[],
): Array<{ curso: string; horario: string; alumnos: number }> {
  const quienes = new Map<string, Set<string>>()
  for (const a of apuntados) {
    const clave = `${a.curso}|${a.horario}`
    const gente = quienes.get(clave) ?? new Set<string>()
    gente.add(a.inscripcionId)
    quienes.set(clave, gente)
  }

  return grupos
    .map((g) => ({
      curso: g.curso,
      horario: g.horario,
      alumnos: quienes.get(`${g.curso}|${g.horario}`)?.size ?? 0,
    }))
    .sort(
      (a, b) =>
        b.alumnos - a.alumnos ||
        a.curso.localeCompare(b.curso, 'es') ||
        a.horario.localeCompare(b.horario),
    )
}
