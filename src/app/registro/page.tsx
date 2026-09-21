import Link from 'next/link'
import { pedirRegistro } from './acciones'
import { gruposAbiertos, lockersLibres } from '@/lib/servicios/registro'
import CampoNombre from './CampoNombre'

/**
 * La inscripción abierta: quien quiere entrar a la escuela deja sus datos.
 *
 * No pide contraseña, así que no crea alumnos: deja una solicitud que
 * alguien de la delegación revisa y da de alta. Hasta entonces no hay
 * folio, ni meses, ni nada que cobrar.
 *
 * Cuatro campos y ya. Cada campo de más en un formulario abierto es gente
 * que lo abandona a la mitad, y los datos que faltan se piden en la
 * ventanilla, que es donde de todos modos hay que presentarse.
 */
export default async function Registro({
  searchParams,
}: {
  searchParams: Promise<{ mal?: string; listo?: string }>
}) {
  const { mal, listo } = await searchParams
  const [grupos, lockers] = await Promise.all([gruposAbiertos(), lockersLibres()])

  if (listo) {
    return (
      <div className="contenedor angosto">
        <div style={{ textAlign: 'center', margin: '2rem 0 1.4rem' }}>
          <div className="silencio" style={{ fontSize: '.8rem', letterSpacing: '.05em' }}>
            CRUZ ROJA MEXICANA · CANCÚN
          </div>
          <h1 style={{ margin: '.35rem 0 .15rem' }}>Recibimos tu solicitud</h1>
        </div>

        <div className="tarjeta" style={{ textAlign: 'center' }}>
          <p style={{ marginTop: 0 }}>
            Gracias. Tu registro quedó en la lista de la delegación.
          </p>
          <p className="silencio" style={{ fontSize: '.9rem' }}>
            <strong>Falta un paso, y es en persona.</strong> Pasa a la delegación a
            confirmar tu inscripción: ahí te dan tu folio y tu credencial, y desde ese
            momento puedes pagar en línea.
          </p>
          <p className="silencio" style={{ fontSize: '.86rem', marginBottom: 0 }}>
            Todavía no se te ha cobrado nada.
          </p>
        </div>

        <p style={{ textAlign: 'center', marginTop: '1rem' }}>
          <Link href="/registro">Registrar a alguien más</Link>
        </p>
      </div>
    )
  }

  return (
    <div className="contenedor angosto">
      <div style={{ textAlign: 'center', margin: '1.5rem 0' }}>
        <div className="silencio" style={{ fontSize: '.8rem', letterSpacing: '.05em' }}>
          CRUZ ROJA MEXICANA · CANCÚN
        </div>
        <h1 style={{ margin: '.35rem 0 .15rem' }}>Escuela de Natación</h1>
        <p className="silencio" style={{ margin: 0 }}>
          Deja tus datos para inscribirte. Te esperamos en la delegación para terminar.
        </p>
      </div>

      {mal && <div className="error">{mal}</div>}

      {grupos.length === 0 ? (
        <div className="tarjeta">
          <p style={{ margin: 0 }}>
            <strong>Por ahora no hay grupos abiertos.</strong> Vuelve más adelante o pasa a
            la delegación a preguntar.
          </p>
        </div>
      ) : (
        <div className="tarjeta">
          <form action={pedirRegistro}>
            <CampoNombre />

            <label htmlFor="grupo" style={{ marginTop: '.9rem', display: 'block' }}>
              Curso y horario
            </label>
            <select id="grupo" name="grupo" required defaultValue="">
              <option value="" disabled>Escoge…</option>
              {grupos.map((g) => (
                <option key={g.clave} value={g.clave}>
                  {g.cursoNombre} · {g.horario} · {g.dias}
                </option>
              ))}
            </select>

            <label htmlFor="locker" style={{ marginTop: '.9rem', display: 'block' }}>
              Locker
            </label>
            <select id="locker" name="locker" defaultValue="">
              <option value="">Sin locker</option>
              {lockers.map((l) => (
                <option key={l.numero} value={l.numero}>Locker {l.numero}</option>
              ))}
            </select>
            <p className="silencio" style={{ fontSize: '.82rem', marginTop: '.3rem' }}>
              Se cobra aparte cada mes. Si no lo necesitas, déjalo en <em>Sin locker</em>.
            </p>

            <label htmlFor="telefono" style={{ marginTop: '.9rem', display: 'block' }}>
              Teléfono <span className="silencio">(opcional)</span>
            </label>
            <input
              id="telefono" name="telefono" type="tel" inputMode="tel"
              placeholder="998 123 4567" autoComplete="tel"
            />
            <p className="silencio" style={{ fontSize: '.82rem', marginTop: '.3rem' }}>
              Por si necesitamos confirmarte algo antes de que vengas.
            </p>

            <div className="fila" style={{ justifyContent: 'flex-end', marginTop: '1.1rem' }}>
              <button className="boton" type="submit">Enviar mi solicitud</button>
            </div>
          </form>
        </div>
      )}

      <p className="silencio" style={{ fontSize: '.82rem', textAlign: 'center', marginTop: '1rem' }}>
        ¿Ya eres alumno y vienes a pagar? <Link href="/pago">Entra con tu folio</Link>.
      </p>
    </div>
  )
}
