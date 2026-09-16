/**
 * El recado de quien no pudo pagar.
 *
 * No es un formulario de contacto: existe para que la delegación devuelva
 * la llamada. Por eso lo que se exige es lo que permite contestar —nombre,
 * correo y celular— y lo que permite entender —qué pasó—. La foto es
 * opcional porque a veces la pantalla del error dice más que la persona.
 */

export type Reporte = {
  nombre: string
  correo: string
  lada: string
  telefono: string
  mensaje: string
}

/** Solo los dígitos: la gente escribe (998) 123-45-67 y todo eso es ruido. */
const soloDigitos = (valor: string) => valor.replace(/\D/g, '')

/**
 * Revisa el recado y devuelve qué le falta, o `null` si está completo.
 *
 * Devuelve un solo problema a la vez, el primero: una lista de seis
 * reproches de golpe se lee como un regaño.
 */
export function validarReporte(reporte: Reporte): string | null {
  if (!reporte.nombre.trim()) return 'Escribe tu nombre, para saber a quién buscar.'

  const correo = reporte.correo.trim()
  // Basta con que tenga forma: comprobarlo de verdad es mandarle un correo,
  // y aquí lo que urge es guardar el recado.
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) {
    return 'Escribe un correo electrónico válido.'
  }

  const lada = soloDigitos(reporte.lada)
  if (lada.length < 1 || lada.length > 3) return 'La lada va de uno a tres dígitos (52 en México).'

  const telefono = soloDigitos(reporte.telefono)
  if (!telefono) return 'Escribe tu celular, por si hay que llamarte.'
  if (telefono.length !== 10) return 'El celular son diez dígitos.'

  if (!reporte.mensaje.trim()) return 'Cuéntanos qué pasó.'

  return null
}

/** "52" + "(998) 123-4567" → "+52 9981234567". Como se marca. */
export function telefonoCompleto(lada: string, telefono: string): string {
  return `+${soloDigitos(lada)} ${soloDigitos(telefono)}`
}
