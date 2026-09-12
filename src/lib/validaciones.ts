export const LARGO_NOMBRE = { min: 3, max: 60 }
export const LARGO_CLAVE = { min: 2, max: 30 }
export const LARGO_DESCRIPCION = { max: 200 }

/**
 * Deja la clave en el formato que el sistema acepta: MAYÚSCULAS_CON_GUION.
 *
 * Los acentos se transforman, no se borran: la delegación escribe en
 * español, y "Natación" tiene que quedar en NATACION, no en NATACIN.
 */
export function normalizarClave(bruto: string): string {
  return bruto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // quita las tildes, conserva la letra
    .replace(/ñ/gi, 'N')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

/**
 * Revisa lo que llega del formulario. Devuelve `null` si está bien, o el
 * mensaje para el usuario si no.
 *
 * Se valida aquí, en el servidor, y no solo con `required` en el HTML: el
 * formulario se puede saltar, y los campos son libres.
 *
 * `clave` se omite al editar, porque la clave no se toca nunca.
 *
 * Sirve para cualquier catálogo de clave + nombre: cursos, tipos de pago,
 * recurrencias, días. Todos tienen la misma forma y las mismas reglas.
 */
export function validarCatalogo(datos: {
  nombre: string
  clave?: string
  descripcion?: string
}): string | null {
  const nombre = datos.nombre.trim()

  if (!nombre) return 'Falta el nombre.'
  if (nombre.length < LARGO_NOMBRE.min) {
    return `El nombre es muy corto: mínimo ${LARGO_NOMBRE.min} letras.`
  }
  if (nombre.length > LARGO_NOMBRE.max) {
    return `El nombre es muy largo: máximo ${LARGO_NOMBRE.max} letras.`
  }

  // La descripción es una nota para el panel: puede no venir, y lo único
  // que se le exige es que quepa.
  if ((datos.descripcion ?? '').trim().length > LARGO_DESCRIPCION.max) {
    return `La descripción es muy larga: máximo ${LARGO_DESCRIPCION.max} letras.`
  }

  if (datos.clave === undefined) return null

  const clave = normalizarClave(datos.clave)
  if (!clave) return 'Falta la clave, o no tiene ninguna letra ni número.'
  if (clave.length < LARGO_CLAVE.min) {
    return `La clave es muy corta: mínimo ${LARGO_CLAVE.min} caracteres.`
  }
  if (clave.length > LARGO_CLAVE.max) {
    return `La clave es muy larga: máximo ${LARGO_CLAVE.max} caracteres.`
  }

  return null
}

/** El mismo cheque, con el nombre que usaba la pantalla de cursos. */
export const validarCurso = validarCatalogo

const HORA = /^([01]\d|2[0-3]):[0-5]\d$/
/**
 * La hora de fin admite además `24:00`: es el cierre del día, y sin ella no
 * existe la franja de las 23:00 a medianoche. Como texto, "24:00" también
 * ordena después de "23:00", así que las comparaciones siguen valiendo.
 */
const HORA_FIN = /^(([01]\d|2[0-3]):[0-5]\d|24:00)$/

/**
 * Revisa una franja horaria. Las horas llegan como "HH:MM", así que se
 * comparan como texto: en ese formato el orden alfabético es el del reloj.
 */
export function validarFranja(horaInicio: string, horaFin: string): string | null {
  const inicio = horaInicio.trim()
  const fin = horaFin.trim()

  if (!inicio || !fin) return 'Faltan la hora de inicio o la de fin.'
  if (!HORA.test(inicio)) return `La hora de inicio no se entiende: ${inicio}`
  if (!HORA_FIN.test(fin)) return `La hora de fin no se entiende: ${fin}`
  if (fin <= inicio) return 'La franja termina antes de empezar.'

  return null
}

/**
 * Revisa un número entero dentro de un rango, con el nombre del campo.
 *
 * `bruto` es lo que la persona escribió tal cual. Sirve para separar dos
 * errores que se confunden: el campo vacío y el campo con algo que no es un
 * número. Decir "falta el número" cuando alguien tecleó "lunes" lo manda a
 * buscar un hueco que no existe.
 */
export function validarEntero(
  valor: number,
  { min, max, campo, bruto }: { min: number; max: number; campo: string; bruto?: string },
): string | null {
  if (!Number.isFinite(valor)) {
    const escrito = (bruto ?? '').trim()
    return escrito
      ? `${campo}: "${escrito}" no es un número.`
      : `${campo}: falta el número.`
  }
  // Con dos puntos y no "Los meses tiene que…": así el mensaje concuerda
  // sea el campo singular o plural.
  if (!Number.isInteger(valor)) return `${campo}: tiene que ser un número entero.`
  if (valor < min) return `${campo}: el mínimo es ${min}.`
  if (valor > max) return `${campo}: el máximo es ${max}.`
  return null
}

/**
 * Lee un número de un campo de formulario.
 *
 * Existe porque `Number('')` es 0: un campo numérico en blanco se colaba
 * como un cero legítimo, y el aviso salía por el lado equivocado —"ya
 * existe el día 0"— en vez de decir que faltaba el dato. Vacío es NaN, y
 * la validación se encarga de avisarlo.
 */
export function aEntero(bruto: unknown): number {
  const texto = String(bruto ?? '').trim()
  return texto === '' ? Number.NaN : Number(texto)
}
