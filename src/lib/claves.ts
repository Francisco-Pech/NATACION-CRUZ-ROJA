/**
 * Las contraseñas del personal.
 *
 * El sistema no manda correos: la contraseña se anota en un papel y se
 * entrega en persona. Eso manda sobre cómo se generan — tiene que poder
 * dictarse en voz alta sin que nadie se equivoque.
 */

export const LARGO_MINIMO = 8
const LARGO_POR_OMISION = 14

/**
 * Sin `l`, `I`, `1`, `O` ni `0`.
 *
 * Anotadas a mano, una ele y un uno son la misma raya, y una o mayúscula y
 * un cero no se distinguen. Quien la recibe se queda afuera sin entender
 * por qué, y acaba pidiendo otra.
 */
const LETRAS_MINUSCULAS = 'abcdefghijkmnopqrstuvwxyz'
const LETRAS_MAYUSCULAS = 'ABCDEFGHJKLMNPQRSTUVWXYZ'
const NUMEROS = '23456789'
const TODO = LETRAS_MINUSCULAS + LETRAS_MAYUSCULAS + NUMEROS

/**
 * Un entero al azar entre 0 y `tope`, sin sesgo.
 *
 * Usa `crypto.getRandomValues`, que existe igual en el navegador y en el
 * servidor: el botón de generar vive en la pantalla, y `node:crypto` ahí no
 * existe — el botón no hacía nada.
 *
 * Se descartan los valores de la cola que no reparten parejo entre las
 * opciones. Con `% tope` a secas, los primeros caracteres del alfabeto
 * saldrían un poco más seguido que los últimos.
 */
function enteroAlAzar(tope: number): number {
  const cupo = Math.floor(0xffffffff / tope) * tope
  const uno = new Uint32Array(1)
  let n = 0
  do {
    crypto.getRandomValues(uno)
    n = uno[0]
  } while (n >= cupo)
  return n % tope
}

/** Un carácter al azar. Nunca con `Math.random`: es previsible. */
const alAzar = (de: string) => de[enteroAlAzar(de.length)]

/**
 * Una contraseña al azar, lista para dictarse.
 *
 * Siempre trae de los tres tipos: sin eso, el azar puede entregar una de
 * puras minúsculas y no se vería como una contraseña.
 */
export function generarClave(largo = LARGO_POR_OMISION): string {
  const cuantos = Math.max(LARGO_MINIMO, largo)

  const obligados = [
    alAzar(LETRAS_MINUSCULAS),
    alAzar(LETRAS_MAYUSCULAS),
    alAzar(NUMEROS),
  ]
  const resto = Array.from({ length: cuantos - obligados.length }, () => alAzar(TODO))

  // Se barajan para que los tres obligados no queden siempre al principio.
  const todos = [...obligados, ...resto]
  for (let i = todos.length - 1; i > 0; i--) {
    const j = enteroAlAzar(i + 1)
    ;[todos[i], todos[j]] = [todos[j], todos[i]]
  }
  return todos.join('')
}

/**
 * ¿La contraseña y su confirmación están bien?
 *
 * Se comparan tal cual, sin recortar espacios: un espacio al final es parte
 * de la contraseña, y quitarlo guardaría una distinta de la que se tecleó.
 */
export function validarClaves(clave: string, confirmacion: string): string | null {
  if (clave === '') return 'Falta la contraseña.'
  if (confirmacion === '') return 'Confirma la contraseña.'
  if (clave !== confirmacion) return 'Las dos contraseñas no coinciden.'
  if (clave.length < LARGO_MINIMO) {
    return `La contraseña debe tener al menos ${LARGO_MINIMO} caracteres.`
  }
  return null
}
