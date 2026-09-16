import type { Pasarela, DatosIntento, Intento } from './tipos'

/**
 * Pasarela de demostración. No cobra nada: manda al alumno a una pantalla
 * local donde se puede simular que el pago salió bien o que falló, y desde
 * ahí se dispara exactamente el mismo código de confirmación que usa
 * Stripe. Sirve para mostrar el flujo completo sin cuenta ni tarjetas.
 */
export class PasarelaSimulada implements Pasarela {
  readonly nombre = 'simulada'

  async crearIntento(datos: DatosIntento): Promise<Intento> {
    // El destino de vuelta viaja en la liga: la simulada no tiene dónde
    // guardarlo, y sin él todo el mundo acabaría en la página del código QR
    // —incluido quien llegó con el folio, que no debería ver ese enlace.
    return {
      referencia: `sim_${datos.pagoId}`,
      siguiente: {
        tipo: 'DEMOSTRACION',
        url: `/pagar/${datos.pagoId}?volver=${encodeURIComponent(datos.urlRetorno)}`,
      },
    }
  }
}
