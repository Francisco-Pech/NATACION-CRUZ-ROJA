import { describe, it, expect } from 'vitest'
import { idDelIntento } from '@/lib/pasarela'

/**
 * La clave que el navegador usa para cobrar la tarjeta trae dentro el
 * número del intento. De ahí se saca para poder preguntarle a Stripe si el
 * dinero entró, sin creerle nada al navegador.
 */
describe('idDelIntento', () => {
  it('saca el intento de la clave del cliente', () => {
    expect(idDelIntento('pi_3QabcXYZ123_secret_ZmFrZXNlY3JldA')).toBe('pi_3QabcXYZ123')
  })

  // Si por lo que sea llega el id pelón, se devuelve tal cual: sirve igual
  // para preguntarle a Stripe.
  it('un id sin secreto se queda igual', () => {
    expect(idDelIntento('pi_3QabcXYZ123')).toBe('pi_3QabcXYZ123')
  })

  // Nada que no sea un intento de pago: preguntarle a Stripe por una
  // cadena inventada no debe siquiera intentarse.
  it('lo que no es un intento no vale', () => {
    expect(idDelIntento('')).toBe(null)
    expect(idDelIntento('cs_test_algo_secret_x')).toBe(null)
    expect(idDelIntento('   ')).toBe(null)
    expect(idDelIntento('pi_')).toBe(null)
  })

  it('no se traga espacios de sobra', () => {
    expect(idDelIntento('  pi_3Qabc_secret_x  ')).toBe('pi_3Qabc')
  })
})
