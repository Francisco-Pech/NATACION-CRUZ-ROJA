const mismoDia = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate()

export function esDiaHabil(fecha: Date, festivos: Date[]): boolean {
  const dia = fecha.getDay()
  if (dia === 0 || dia === 6) return false
  return !festivos.some((festivo) => mismoDia(festivo, fecha))
}

/**
 * Devuelve el último instante del n-ésimo día hábil del mes.
 * Es la regla que define quién es moroso, así que se calcula sobre el
 * calendario real: descuenta fines de semana y el catálogo de festivos.
 */
export function calcularFechaLimite(
  anio: number,
  mes: number,
  diasHabiles: number,
  festivos: Date[],
): Date {
  let contados = 0
  const cursor = new Date(anio, mes - 1, 1, 23, 59, 59, 999)

  while (true) {
    if (esDiaHabil(cursor, festivos)) {
      contados++
      if (contados === diasHabiles) return cursor
    }
    cursor.setDate(cursor.getDate() + 1)
  }
}
