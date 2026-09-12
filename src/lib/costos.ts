/**
 * Cuánto cuesta algo, y desde cuándo.
 *
 * Un precio no vale para siempre: el curso que hoy cuesta 770 el año que
 * entra costará otra cosa. Por eso cada monto trae el tramo de fechas en el
 * que rige, y al cobrar se busca el que cubre el mes que se está generando.
 *
 * Lo que ya se cobró no cambia: `Cargo` guarda los montos calculados al
 * generarse, así que corregir un precio no reescribe la historia.
 */

export type Vigente = { desde: Date; hasta: Date }

const cubre = (r: Vigente, fecha: Date) => r.desde <= fecha && r.hasta >= fecha

/**
 * El que rige en esa fecha, o nada.
 *
 * Nada quiere decir nada: sin precio capturado no se inventa uno. Es
 * preferible que un curso no se cobre —y que se note— a que se cobre un
 * número que nadie autorizó.
 *
 * Si dos tramos cubren la misma fecha manda el que empieza después. No
 * debería pasar, porque se valida al guardar, pero si pasa conviene que
 * gane la corrección más reciente y no la más vieja.
 */
export function vigenteEn<T extends Vigente>(filas: T[], fecha: Date): T | null {
  const candidatas = filas.filter((f) => cubre(f, fecha))
  if (candidatas.length === 0) return null
  return candidatas.reduce((a, b) => (b.desde > a.desde ? b : a))
}

/**
 * ¿Dos tramos cubren algún día en común?
 *
 * Sirve para no dejar capturar dos precios del mismo concepto para la misma
 * fecha: ahí no habría manera de saber cuál cobrar. Pegados —uno termina el
 * 30 de junio y el otro empieza el 1 de julio— no se enciman.
 */
export function seEncimanRangos(a: Vigente, b: Vigente): boolean {
  return a.desde <= b.hasta && b.desde <= a.hasta
}
