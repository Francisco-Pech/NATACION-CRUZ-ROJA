/** La zona de la delegación: Cancún, UTC-5 y sin horario de verano. */
export const ZONA = 'America/Cancun'

const SOLO_EL_ANIO = new Intl.DateTimeFormat('en-CA', { timeZone: ZONA, year: 'numeric' })

/**
 * En qué año estamos, en Cancún.
 *
 * No es `new Date().getFullYear()`. Eso contesta según la zona del proceso,
 * y aunque el arranque la fije en Cancún, basta un despliegue que no pase
 * por ahí —o un servidor en UTC— para que el 31 de diciembre a las 20:00
 * de Cancún el sistema ya crea que es enero. A esa hora todavía se inscribe
 * al ciclo que corre, no al que entra.
 *
 * Se calcula con la zona nombrada, así que contesta igual corra donde corra.
 */
export function anioEnCurso(ahora: Date = new Date()): number {
  return Number(SOLO_EL_ANIO.format(ahora))
}

const SOLO_EL_MES = new Intl.DateTimeFormat('en-CA', { timeZone: ZONA, month: 'numeric' })

/**
 * En qué mes estamos, en Cancún. Con base 1, como los periodos.
 *
 * Misma razón que el año: el 30 de septiembre a las 8 de la noche en Cancún
 * ya es 1 de octubre en UTC. Si el filtro de pagos se calculara con la zona
 * del proceso, a esa hora abriría en octubre y quien está cerrando el mes en
 * la ventanilla no vería su propio cobro.
 */
export function mesEnCurso(ahora: Date = new Date()): number {
  return Number(SOLO_EL_MES.format(ahora))
}

const EL_DIA = new Intl.DateTimeFormat('en-CA', {
  timeZone: ZONA, year: 'numeric', month: '2-digit', day: '2-digit',
})

/**
 * Hoy, en Cancún, escrito "2026-09-15".
 *
 * Es el mismo formato que guarda el campo de fecha, así que las dos se
 * comparan como cadenas y no hay que armar objetos `Date` para saber si un
 * día ya pasó. `en-CA` da justo ese orden.
 */
export function hoyEnCancun(ahora: Date = new Date()): string {
  return EL_DIA.format(ahora)
}
