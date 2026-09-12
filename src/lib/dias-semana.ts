/**
 * Los días de la semana con la numeración de `Date.getDay()` —domingo 0,
 * sábado 6— pero ordenados como los lee la gente: de lunes a domingo.
 */
export const DIAS_SEMANA = [
  { n: 1, corto: 'L', largo: 'Lunes' },
  { n: 2, corto: 'M', largo: 'Martes' },
  { n: 3, corto: 'X', largo: 'Miércoles' },
  { n: 4, corto: 'J', largo: 'Jueves' },
  { n: 5, corto: 'V', largo: 'Viernes' },
  { n: 6, corto: 'S', largo: 'Sábado' },
  { n: 0, corto: 'D', largo: 'Domingo' },
] as const

const posicion = (n: number) => DIAS_SEMANA.findIndex((d) => d.n === n)
const corto = (n: number) => DIAS_SEMANA[posicion(n)]?.corto ?? '?'

/**
 * Escribe una lista de días como la diría una persona: `L-V` para un tramo
 * corrido, `L, X, V` para días sueltos.
 *
 * Un par seguido se enumera en vez de colapsarse: "L, M" se lee mejor que
 * "L-M" y ocupa lo mismo.
 */
export function resumenDias(dias: number[]): string {
  const validos = [...new Set(dias)].filter((n) => posicion(n) >= 0)
  if (validos.length === 0) return '—'

  const ordenados = validos.sort((a, b) => posicion(a) - posicion(b))

  const tramos: number[][] = []
  for (const dia of ordenados) {
    const ultimo = tramos[tramos.length - 1]
    if (ultimo && posicion(dia) === posicion(ultimo[ultimo.length - 1]) + 1) {
      ultimo.push(dia)
    } else {
      tramos.push([dia])
    }
  }

  return tramos
    .map((t) => (t.length >= 3 ? `${corto(t[0])}-${corto(t[t.length - 1])}` : t.map(corto).join(', ')))
    .join(', ')
}
