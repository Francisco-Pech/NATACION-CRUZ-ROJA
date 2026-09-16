import { describe, it, expect } from 'vitest'
import { destinoSeguro } from '@/lib/pasarela'

/**
 * A dónde vuelve alguien después de pagar.
 *
 * El destino viaja en la URL, así que lo puede escribir cualquiera. Sin
 * filtro, un enlace preparado mandaría a la persona —recién salida de pagar,
 * con toda la disposición a creer lo que lea— a una página ajena que imite
 * a la nuestra.
 */
describe('destinoSeguro', () => {
  const CASA = '/q/abc'

  it('deja pasar una ruta de la propia aplicación', () => {
    expect(destinoSeguro('/pago/CR2026L4HZWHL3', CASA)).toBe('/pago/CR2026L4HZWHL3')
  })

  it('conserva lo que trae la ruta detrás', () => {
    expect(destinoSeguro('/pago/CR2026?bien=listo', CASA)).toBe('/pago/CR2026?bien=listo')
  })

  it('no manda a otro sitio', () => {
    expect(destinoSeguro('https://otro-sitio.test/pago', CASA)).toBe(CASA)
    expect(destinoSeguro('http://otro-sitio.test', CASA)).toBe(CASA)
  })

  // "//sitio.test" es una URL sin protocolo: el navegador la resuelve como
  // externa aunque empiece con barra.
  it('tampoco con la barra doble', () => {
    expect(destinoSeguro('//otro-sitio.test/pago', CASA)).toBe(CASA)
    expect(destinoSeguro('/\\otro-sitio.test', CASA)).toBe(CASA)
  })

  it('ni con un protocolo raro', () => {
    expect(destinoSeguro('javascript:alert(1)', CASA)).toBe(CASA)
  })

  it('sin destino, a donde diga la aplicación', () => {
    expect(destinoSeguro('', CASA)).toBe(CASA)
    expect(destinoSeguro(undefined, CASA)).toBe(CASA)
  })
})
