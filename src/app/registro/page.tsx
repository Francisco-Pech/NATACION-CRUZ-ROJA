import Link from 'next/link'
import { pedirRegistro } from './acciones'
import { gruposAbiertos, lockersLibres } from '@/lib/servicios/registro'
import FormularioAlumno from '@/app/panel/alumnos/FormularioAlumno'
import { periodoActual } from '@/lib/periodo-actual'
import { pesos } from '@/lib/formato'

/**
 * La inscripción abierta: quien quiere entrar deja sus datos.
 *
 * Es el mismo formulario del mostrador, sin descuento —eso lo decide la
 * delegación, no quien se inscribe— y con otra acción: no crea alumno ni
 * folio, deja una solicitud que alguien revisa y da de alta.
 *
 * Es el mismo componente a propósito. Con dos formularios para lo mismo,
 * uno se arregla y el otro se queda atrás.
 */
/**
 * No se prerenderiza: los grupos abiertos y los lockers libres cambian, y
 * una página congelada en el momento del despliegue ofrecería horarios que
 * ya cerraron y lockers que ya tomaron.
 */
export const dynamic = 'force-dynamic'

export default async function Registro() {
  const [grupos, lockers, actual] = await Promise.all([
    gruposAbiertos(),
    lockersLibres(),
    periodoActual(),
  ])

  return (
    <div className="contenedor angosto">
      <div style={{ textAlign: 'center', margin: '1.5rem 0' }}>
        <div className="silencio" style={{ fontSize: '.8rem', letterSpacing: '.05em' }}>
          CRUZ ROJA MEXICANA · CANCÚN
        </div>
        <h1 style={{ margin: '.35rem 0 .15rem' }}>Escuela de Natación</h1>
        <p className="silencio" style={{ margin: 0 }}>
          Deja tus datos para pedir tu lugar.
        </p>
      </div>

      {/* Antes del formulario y no después: quien lo llena tiene que saber
          desde el principio que esto no lo inscribe, o va a creer que ya
          quedó y va a esperar su credencial en vano. */}
      <div className="aviso">
        <strong>Esto todavía no te inscribe.</strong> Lo que envías es una solicitud: la
        Cruz Roja la revisa y decide si hay lugar en ese curso y horario. Cuando te den
        el visto bueno, pasas a la delegación por tu folio y tu credencial, y hasta
        entonces eres alumno. No se te cobra nada por solicitarlo.
      </div>

      <div className="tarjeta">
        {grupos.length === 0 ? (
          <p style={{ margin: 0 }}>
            <strong>Por ahora no hay grupos abiertos.</strong> Vuelve más adelante o pasa a
            la delegación a preguntar.
          </p>
        ) : (
          <FormularioAlumno
            grupos={grupos}
            descuentos={[]}
            lockers={lockers}
            precioLocker={actual ? pesos(actual.periodo.precioLocker) : ''}
            accionPropia={pedirRegistro}
            textoBoton="Enviar mi solicitud"
            notaLocker="El locker que escojas no queda apartado: se revisa cuando la delegación acepte tu solicitud, y si para entonces ya lo tomaron se te asigna otro."
          />
        )}
      </div>

      <p className="silencio" style={{ fontSize: '.82rem', textAlign: 'center', marginTop: '1rem' }}>
        ¿Ya eres alumno y vienes a pagar? <Link href="/pago">Entra con tu folio</Link>.
      </p>
    </div>
  )
}
