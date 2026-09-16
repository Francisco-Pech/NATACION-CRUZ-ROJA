/** Los montos se guardan en centavos; aquí se vuelven pesos legibles. */
export function pesos(centavos: number): string {
  return (centavos / 100).toLocaleString('es-MX', {
    style: 'currency',
    currency: 'MXN',
  })
}

export const MESES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
]

export function nombreMes(mes: number): string {
  return MESES[mes - 1] ?? ''
}

export function fechaLarga(fecha: Date): string {
  return fecha.toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' })
}

/**
 * La primera letra en mayúscula.
 *
 * Los meses se guardan en minúscula porque casi siempre van dentro de una
 * frase —"se abre cuando pagues noviembre"—, pero encabezando una tarjeta
 * se leen como un descuido.
 */
export function conMayuscula(texto: string): string {
  return texto ? texto[0].toUpperCase() + texto.slice(1) : texto
}
