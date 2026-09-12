/**
 * Cuándo corre cada curso a lo largo del año.
 *
 * Un curso puede correr los doce meses, abrirse una sola vez, o abrirse
 * varias veces al año. Lo que decide es la temporada: un rango de fechas
 * que, según el modo del curso, se repite cada año o no.
 *
 * Esto es lo que después mira el motor de cobro: a un curso fuera de
 * temporada no se le genera cargo ese mes.
 */

export type Temporada = { desde: Date; hasta: Date }

/** Los tres modos que se escogen en la pantalla. */
export const MODOS = ['RECURRENTE', 'UNICO', 'MIXTO'] as const
export type ModoFecha = (typeof MODOS)[number]

/** Solo el modo Único se queda en su año; los otros dos se repiten. */
export const seRepiteCadaAnio = (modo: ModoFecha) => modo !== 'UNICO'

/** El primer instante del mes y el último, para cruzarlos con la temporada. */
function limitesDelMes(anio: number, mes: number): [Date, Date] {
  return [new Date(anio, mes - 1, 1, 0, 0, 0), new Date(anio, mes, 0, 23, 59, 59, 999)]
}

/** Corre la temporada al año que se pida, conservando día y mes. */
function enElAnio(t: Temporada, anio: number): Temporada {
  const desde = new Date(anio, t.desde.getMonth(), t.desde.getDate(), 0, 0, 0)
  const cruzaElAnio = t.hasta < t.desde || t.hasta.getFullYear() > t.desde.getFullYear()
  const hasta = new Date(
    cruzaElAnio ? anio + 1 : anio,
    t.hasta.getMonth(),
    t.hasta.getDate(),
    23, 59, 59, 999,
  )
  return { desde, hasta }
}

const seCruzan = (a: Temporada, desde: Date, hasta: Date) => a.desde <= hasta && a.hasta >= desde

/**
 * ¿El mes cae dentro de la temporada?
 *
 * Basta que se toquen: una temporada del 30 de junio al 2 de julio cuenta
 * para los dos meses, porque en los dos hubo clase.
 */
export function mesEnTemporada(
  anio: number,
  mes: number,
  temporada: Temporada,
  cadaAnio: boolean,
): boolean {
  const [inicioMes, finMes] = limitesDelMes(anio, mes)
  if (!cadaAnio) return seCruzan(temporada, inicioMes, finMes)

  // Se prueba contra este año y el anterior: una temporada de diciembre a
  // enero empieza un año y termina en el siguiente.
  return (
    seCruzan(enElAnio(temporada, anio), inicioMes, finMes) ||
    seCruzan(enElAnio(temporada, anio - 1), inicioMes, finMes)
  )
}

/**
 * ¿Corre el curso ese mes? Basta que caiga en alguna de sus temporadas.
 *
 * Un curso sin temporadas capturadas corre siempre: lo que nadie ha
 * definido no debe dejar de cobrarse de golpe.
 */
export function cursoCorreEnElMes(
  anio: number,
  mes: number,
  temporadas: Temporada[],
  modo: ModoFecha,
): boolean {
  if (temporadas.length === 0) return true
  const cadaAnio = seRepiteCadaAnio(modo)
  return temporadas.some((t) => mesEnTemporada(anio, mes, t, cadaAnio))
}

/**
 * En qué meses del año corre el curso, según lo que tenga capturado.
 *
 * Un curso sin temporadas devuelve la lista vacía, y eso quiere decir "sin
 * definir", no "todo el año". Es distinto de `cursoCorreEnElMes`, que sí lo
 * da por corriendo siempre: para cobrar, lo que nadie definió no debe
 * dejar de cobrarse; para comparar dos cursos entre sí, todavía no hay con
 * qué compararlos.
 */
export function mesesQueCorre(
  anio: number,
  temporadas: Temporada[],
  modo: ModoFecha,
): number[] {
  if (temporadas.length === 0) return []
  const cadaAnio = seRepiteCadaAnio(modo)
  const meses: number[] = []
  for (let mes = 1; mes <= 12; mes++) {
    if (temporadas.some((t) => mesEnTemporada(anio, mes, t, cadaAnio))) meses.push(mes)
  }
  return meses
}

/**
 * ¿Se pisan dos cursos en el calendario?
 *
 * Sirve para dejar que dos cursos lleven el mismo nombre siempre que no
 * corran al mismo tiempo: uno de enero a marzo y otro de abril a diciembre
 * conviven sin confundir a nadie, pero dos que comparten febrero sí.
 *
 * Si a alguno le faltan fechas no se estorban todavía: no hay nada que
 * comparar hasta que se capturen.
 */
export function seEnciman(
  anio: number,
  temporadasA: Temporada[],
  modoA: ModoFecha,
  temporadasB: Temporada[],
  modoB: ModoFecha,
): boolean {
  const a = mesesQueCorre(anio, temporadasA, modoA)
  const b = new Set(mesesQueCorre(anio, temporadasB, modoB))
  if (a.length === 0 || b.size === 0) return false
  return a.some((mes) => b.has(mes))
}
