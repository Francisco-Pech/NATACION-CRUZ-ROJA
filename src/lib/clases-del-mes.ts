/**
 * Qué días tiene clase un grupo en un mes.
 *
 * Es la columna de la lista del profesor: una fecha por clase, en orden de
 * calendario. No por día de la semana —"todos los lunes, luego todos los
 * miércoles"— porque quien pasa lista lo hace el día que le toca, y buscar
 * el 9 de septiembre entre dos bloques es trabajo de más.
 *
 * Los días inhábiles no salen. Dejarlos como huecos en blanco obligaría al
 * profesor a acordarse de por qué ese día no hubo clase, y a la larga
 * alguien los marcaría por error.
 *
 * Las fechas se arman al mediodía: a medianoche, un servidor en otra zona
 * las corre un día y la lista queda desfasada del calendario que él ve.
 */
export function clasesDelMes(
  anio: number,
  mes: number,
  /** Días de la semana en que corre el grupo. 1 es lunes, 7 domingo. */
  diasSemana: number[],
  inhabiles: Date[],
): Date[] {
  if (diasSemana.length === 0) return []

  const corre = new Set(diasSemana)
  const cerrados = new Set(inhabiles.map((f) => f.toDateString()))
  // El día 0 del mes siguiente es el último de este: escribir 28 para
  // febrero se rompe cada cuatro años.
  const ultimo = new Date(anio, mes, 0).getDate()

  const fechas: Date[] = []
  for (let dia = 1; dia <= ultimo; dia++) {
    const fecha = new Date(anio, mes - 1, dia, 12, 0, 0)
    // `getDay()` pone el domingo en 0; aquí el domingo es 7, como en la
    // rejilla, para que lunes siga siendo 1 en los dos lados.
    const diaSemana = fecha.getDay() === 0 ? 7 : fecha.getDay()
    if (!corre.has(diaSemana)) continue
    if (cerrados.has(fecha.toDateString())) continue
    fechas.push(fecha)
  }
  return fechas
}

/**
 * Lo mismo, pero entre dos fechas.
 *
 * La lista se pide por un tramo y no por un mes suelto: un mes suelto se
 * queda sin el año, y en enero ya no habría forma de abrir noviembre del
 * año pasado para revisarlo.
 *
 * Las fechas llegan como "2026-09-14" —lo que escribe el campo de fecha— y
 * se arman al mediodía, por la misma razón que arriba.
 */
export function clasesEnRango(
  desde: string,
  hasta: string,
  diasSemana: number[],
  inhabiles: Date[],
): Date[] {
  const inicio = new Date(`${desde}T12:00:00`)
  const fin = new Date(`${hasta}T12:00:00`)
  if (Number.isNaN(inicio.getTime()) || Number.isNaN(fin.getTime())) return []
  if (inicio > fin) return []

  const fechas: Date[] = []
  // Mes por mes: cada uno sabe cuántos días tiene y cuáles son inhábiles.
  const cursor = new Date(inicio.getFullYear(), inicio.getMonth(), 1, 12, 0, 0)
  while (cursor <= fin) {
    for (const f of clasesDelMes(
      cursor.getFullYear(), cursor.getMonth() + 1, diasSemana, inhabiles,
    )) {
      if (f >= inicio && f <= fin) fechas.push(f)
    }
    cursor.setMonth(cursor.getMonth() + 1)
  }
  return fechas
}
