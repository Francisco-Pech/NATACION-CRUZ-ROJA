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

/**
 * El nombre de un alumno, como se guarda y como se imprime: en mayúsculas.
 *
 * Se decidió así para que la lista se lea pareja: capturado a mano, el
 * mismo nombre llega de cinco maneras —"ana sofía", "Ana Sofia", "ANA"— y
 * buscarlo después se vuelve adivinanza.
 *
 * Con acentos: en español la mayúscula los conserva, y esto es el nombre
 * de una persona, no un encabezado. JOSÉ, no JOSE.
 */
export function nombreDeAlumno(texto: string): string {
  return (texto ?? '').trim().replace(/\s+/g, ' ').toLocaleUpperCase('es')
}
