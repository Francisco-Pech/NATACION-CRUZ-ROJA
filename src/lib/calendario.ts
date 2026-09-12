/** Las columnas de la parrilla, empezando en lunes como se lee aquí. */
export const LETRAS_DIA = ['L', 'M', 'X', 'J', 'V', 'S', 'D'] as const

export const NOMBRES_MES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
] as const

/**
 * El mes repartido en semanas de siete, para pintarlo como parrilla.
 *
 * Los huecos de antes del día 1 y de después del último van en `null`. La
 * semana arranca en lunes: `Date.getDay()` cuenta desde el domingo, así que
 * se corre uno.
 */
export function semanasDelMes(anio: number, mes: number): Array<Array<number | null>> {
  const primero = new Date(anio, mes - 1, 1)
  const cuantos = new Date(anio, mes, 0).getDate()
  const huecoInicial = (primero.getDay() + 6) % 7

  const casillas: Array<number | null> = [
    ...Array<null>(huecoInicial).fill(null),
    ...Array.from({ length: cuantos }, (_, i) => i + 1),
  ]
  // Se completa la última semana para que todas midan siete.
  while (casillas.length % 7 !== 0) casillas.push(null)

  const semanas: Array<Array<number | null>> = []
  for (let i = 0; i < casillas.length; i += 7) semanas.push(casillas.slice(i, i + 7))
  return semanas
}
