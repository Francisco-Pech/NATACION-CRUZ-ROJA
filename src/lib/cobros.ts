export type CargoPrevio = { mes: number }

/**
 * ¿Toca generar el cargo de este curso en este mes?
 *
 * El motor no pregunta "¿es trimestral?", pregunta cuántos meses cubre un
 * cobro. Así, agregar una frecuencia nueva es sembrar una fila, no tocar
 * código.
 *
 * @param mes           mes del periodo que se está generando (1–12)
 * @param cobrosPrevios cargos ya emitidos de ese curso, con su mes
 * @param meses         cuántos meses cubre un cobro; null para pago único
 */
export function tocaCobrar(
  mes: number,
  cobrosPrevios: CargoPrevio[],
  meses: number | null,
): boolean {
  // Un cobro de un mes futuro no dice nada sobre si hoy toca: se ignora.
  const previos = cobrosPrevios.filter((c) => c.mes <= mes)

  // Pago único, o una frecuencia mal sembrada: se cobra una sola vez.
  // Tratar un cero como "cada cero meses" daría cargos infinitos.
  if (meses === null || meses < 1) return cobrosPrevios.length === 0

  if (previos.length === 0) return true

  const ultimo = Math.max(...previos.map((c) => c.mes))
  // Un cobro hecho en `ultimo` cubre desde ese mes y `meses` meses en total.
  return mes >= ultimo + meses
}
