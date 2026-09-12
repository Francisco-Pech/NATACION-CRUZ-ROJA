/** Lo que se pinta como "…" entre dos números de página. */
export const SALTO = '…' as const

export type Salto = typeof SALTO

/** Cuántas páginas se enseñan seguidas antes de empezar a cortar. */
const SIN_CORTAR = 7
/** Cuántas se dejan a cada lado de la actual cuando ya se corta. */
const VECINAS = 1

const rango = (desde: number, hasta: number) =>
  Array.from({ length: hasta - desde + 1 }, (_, i) => desde + i)

/**
 * Qué números de página pintar.
 *
 * Con pocas se enseñan todas. Con muchas se dejan siempre la primera, la
 * última y las vecinas de la actual, y el hueco se marca con un "…". Así
 * se puede saltar directo a la 3 sin pasar por la 2.
 *
 * Nunca se pone "…" para esconder una sola página: ocupa lo mismo que el
 * número y no deja hacer clic.
 */
export function paginasVisibles(actual: number, total: number): Array<number | Salto> {
  if (total <= SIN_CORTAR) return rango(0, total - 1)

  const primera = 0
  const ultima = total - 1
  const desde = Math.max(primera + 1, actual - VECINAS)
  const hasta = Math.min(ultima - 1, actual + VECINAS)

  const lista: Array<number | Salto> = [primera]

  // `desde - primera > 2` quiere decir que se esconde más de una página.
  if (desde - primera > 2) lista.push(SALTO)
  else lista.push(...rango(primera + 1, desde - 1))

  lista.push(...rango(desde, hasta))

  if (ultima - hasta > 2) lista.push(SALTO)
  else lista.push(...rango(hasta + 1, ultima - 1))

  lista.push(ultima)
  return lista
}
