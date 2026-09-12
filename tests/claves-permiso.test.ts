import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

/**
 * Cambiar la contraseña de otro es Root y nada más.
 *
 * La pantalla esconde el botón, pero esconder no es impedir: un formulario
 * viejo, o alguien que sepa la dirección, llega igual. Quien decide es la
 * acción del servidor.
 *
 * Esta prueba mira el código y no el comportamiento, porque la guarda
 * necesita una petición HTTP viva para correr. Es un candado modesto pero
 * concreto: si alguien afloja la guarda a `exigirAdministrador`, se entera
 * aquí y no cuando un Administrador tome la cuenta de otro.
 */
describe('restablecerClave exige Root', () => {
  const fuente = readFileSync('src/app/panel/admin/acciones.ts', 'utf8')
  const inicio = fuente.indexOf('export async function restablecerClave')
  const cuerpo = fuente.slice(
    inicio,
    fuente.indexOf('export async function', inicio + 10),
  )

  it('la acción existe', () => {
    expect(inicio).toBeGreaterThan(-1)
  })

  it('llama a exigirRoot', () => {
    expect(cuerpo).toContain('await exigirRoot()')
  })

  it('no se conforma con exigirAdministrador', () => {
    expect(cuerpo).not.toContain('exigirAdministrador')
  })

  // Sin confirmación, un dedazo deja a alguien afuera y nadie sabe con qué
  // quedó guardada la contraseña.
  it('valida la contraseña contra su confirmación', () => {
    expect(cuerpo).toContain('validarClaves')
  })
})
