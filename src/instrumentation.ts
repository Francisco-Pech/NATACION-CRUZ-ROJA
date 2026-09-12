/** La zona de la delegación: Cancún, UTC-5 y sin horario de verano. */
const ZONA = 'America/Cancun'

/**
 * Se ejecuta una sola vez al arrancar el servidor, antes de la primera
 * petición, y fija la zona horaria para todo cálculo de fechas.
 *
 * Hace falta aquí y no solo en `.env`: Next lee el `.env` después de que
 * Node arrancó, y para entonces la zona ya quedó tomada del sistema. En un
 * servidor en UTC eso corre las fechas — el 5.º día hábil se contaría con
 * otro calendario, y de ahí sale a quién se le cobra recargo.
 *
 * Se impone, no se pregunta: el sistema es de una sola delegación y no hay
 * un caso legítimo en que deba correr en otra zona. Si alguien arranca el
 * proceso con otra, esta línea la corrige.
 */
export function register() {
  process.env.TZ = ZONA

  const efectiva = Intl.DateTimeFormat().resolvedOptions().timeZone
  if (efectiva !== ZONA) {
    console.warn(
      `[natacion] No se pudo fijar la zona horaria: quedó en ${efectiva} y debe ser ${ZONA}. ` +
        'Arranca el proceso con TZ=America/Cancun o las fechas límite saldrán mal.',
    )
  } else {
    console.log(`[natacion] Zona horaria: ${ZONA}`)
  }
}
