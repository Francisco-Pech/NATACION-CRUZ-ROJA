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

/** Un cargo que ese alumno ya tuvo de ese curso. */
export type CargoDelCurso = { cancelado: boolean }

/**
 * ¿Ya se le cobraron al alumno todos los meses que dura el curso?
 *
 * El tope se captura en el curso —"Salvavidas se paga tres meses"— y se
 * cuenta sobre todos los cargos que esa persona ha tenido de ese curso, de
 * cualquier año: es la duración del curso, no una cuota anual.
 *
 * Un curso sin tope capturado no se detiene nunca: lo que nadie ha
 * definido no debe dejar de cobrarse de golpe.
 *
 * Un cargo cancelado no cuenta. No se cobró, así que gastarle un mes por
 * él le cobraría de menos el curso.
 */
export function alcanzoElTope(previos: CargoDelCurso[], maxMeses: number | null): boolean {
  // Un cero capturado a mano querría decir "no cobrarle nunca a nadie", y
  // la cobranza se apagaría en silencio. La pantalla no lo deja escribir, y
  // aquí tampoco se obedece.
  if (maxMeses === null || maxMeses < 1) return false
  return previos.filter((c) => !c.cancelado).length >= maxMeses
}

/** Un mes que ya se le cargó de ese curso. La clave es "AAAA-MM". */
export type MesDelCurso = { clave: string; cancelado: boolean }

/**
 * ¿Ese mes queda fuera del máximo de meses del curso?
 *
 * El tope se puede bajar cuando ya hay meses generados. Lo que ya se pagó
 * no se toca —el dinero entró— pero lo que sobra y sigue sin pagarse deja
 * de cobrarse: ahí es donde se esconde el botón de pagar.
 *
 * El lugar se cuenta por fecha y no por el orden en que se crearon los
 * cargos: uno generado hoy puede ser de un mes anterior, y entonces el que
 * sobra es otro.
 *
 * Los meses cancelados no ocupan lugar, igual que en `alcanzoElTope`.
 */
export function pasaElTope(
  meses: MesDelCurso[],
  clave: string,
  maxMeses: number | null,
): boolean {
  if (maxMeses === null || maxMeses < 1) return false

  const enOrden = meses
    .filter((m) => !m.cancelado)
    .map((m) => m.clave)
    .sort((a, b) => a.localeCompare(b))

  const lugar = enOrden.indexOf(clave)
  // Un mes que no está en la lista no sobra: no hay con qué contarlo.
  if (lugar === -1) return false
  return lugar + 1 > maxMeses
}
