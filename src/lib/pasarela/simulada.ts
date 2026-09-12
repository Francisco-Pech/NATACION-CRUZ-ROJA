import type { Pasarela, DatosIntento, Intento } from './tipos'

/**
 * Pasarela de demostración. No cobra nada: manda al alumno a una pantalla
 * local donde se puede simular que el pago salió bien o que falló, y desde
 * ahí se dispara exactamente el mismo código de confirmación que usará
 * Stripe. Sirve para mostrar el flujo completo sin cuenta ni tarjetas.
 */
export class PasarelaSimulada implements Pasarela {
  readonly nombre = 'simulada'

  async crearIntento(datos: DatosIntento): Promise<Intento> {
    return {
      referencia: `sim_${datos.pagoId}`,
      urlPago: `/pagar/${datos.pagoId}`,
    }
  }
}
