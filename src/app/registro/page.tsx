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
          Deja tus datos para inscribirte. Te esperamos en la delegación para terminar.
        </p>
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
            notaLocker="Escogerlo no lo aparta: se revisa cuando confirmemos tu inscripción, y si ya lo tomaron te damos otro."
          />
        )}
      </div>

      <p className="silencio" style={{ fontSize: '.82rem', textAlign: 'center', marginTop: '1rem' }}>
        ¿Ya eres alumno y vienes a pagar? <Link href="/pago">Entra con tu folio</Link>.
      </p>
    </div>
  )
}
