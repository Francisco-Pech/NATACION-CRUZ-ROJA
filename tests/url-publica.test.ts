import { describe, it, expect, vi } from 'vitest'
import { urlAbsoluta } from '@/lib/pasarela'

/**
 * Stripe Checkout exige direcciones completas para volver: una ruta como
 * "/pago/CR2026" hace que rechace la sesión antes de crearla, y el cobro
 * revienta cuando la persona ya le dio a pagar.
 */
describe('urlAbsoluta', () => {
  const BASE = 'http://localhost:3000'

  it('le pone el sitio delante a una ruta', () => {
    expect(urlAbsoluta('/pago/CR2026', BASE)).toBe('http://localhost:3000/pago/CR2026')
  })

  it('no duplica la barra cuando el sitio trae una al final', () => {
    expect(urlAbsoluta('/pago/CR2026', 'http://localhost:3000/')).toBe('http://localhost:3000/pago/CR2026')
  })

  it('conserva lo que va detrás de la ruta', () => {
    expect(urlAbsoluta('/pago/CR2026?bien=listo', BASE)).toBe('http://localhost:3000/pago/CR2026?bien=listo')
  })

  it('una dirección ya completa se deja como está', () => {
    expect(urlAbsoluta('https://cruzroja.test/pago', BASE)).toBe('https://cruzroja.test/pago')
  })

  // Falla temprano y con nombre: sin esto el error llega desde Stripe, en
  // inglés y con la persona ya esperando.
  it('sin sitio configurado lo dice, en vez de mandar una ruta suelta', () => {
    expect(() => urlAbsoluta('/pago/CR2026', '')).toThrow(/URL_PUBLICA/)
  })

  // Sin argumento lo toma del entorno: así lo llama la pasarela, que no
  // tiene de dónde sacarlo. Se apaga a mano para no depender del .env de
  // quien corra las pruebas.
  it('sin argumento mira el entorno, y avisa si está vacío', () => {
    vi.stubEnv('URL_PUBLICA', '')
    expect(() => urlAbsoluta('/pago/CR2026')).toThrow(/URL_PUBLICA/)
    vi.stubEnv('URL_PUBLICA', 'https://cruzroja.test')
    expect(urlAbsoluta('/pago/CR2026')).toBe('https://cruzroja.test/pago/CR2026')
    vi.unstubAllEnvs()
  })
})
