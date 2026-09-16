import { notFound, redirect } from 'next/navigation'
import { prisma } from '@/lib/db'
import { confirmarCobro, rechazarCobro } from '@/lib/servicios/cobro-en-linea'
import { ETIQUETA_METODO } from '@/lib/metodos-pago'
import { pesos } from '@/lib/formato'
import { usandoStripe, destinoSeguro } from '@/lib/pasarela'

async function resolver(datos: FormData) {
  'use server'
  const referencia = String(datos.get('referencia'))
  const exito = String(datos.get('resultado')) === 'exito'

  if (exito) await confirmarCobro(referencia)
  else await rechazarCobro(referencia)

  // A donde dijo quien mandó a pagar: la página del QR si vino de ahí, o la
  // del folio si vino de ahí. El destino se filtra porque viaja en la liga.
  const casa = destinoSeguro(String(datos.get('volver') || ''), `/q/${String(datos.get('token'))}`)
  // Con la misma marca que pone Stripe, para que la pantalla de vuelta se
  // comporte igual con la pasarela de verdad y con esta.
  redirect(`${casa}${casa.includes('?') ? '&' : '?'}pago=${exito ? 'listo' : 'cancelado'}`)
}

export default async function PantallaPago({
  params,
  searchParams,
}: {
  params: Promise<{ pagoId: string }>
  searchParams: Promise<{ volver?: string }>
}) {
  const { pagoId } = await params
  const { volver } = await searchParams

  const pago = await prisma.pago.findUnique({
    where: { id: pagoId },
    include: { cargo: { include: { inscripcion: { include: { alumno: true } }, periodo: true } } },
  })
  if (!pago || !pago.stripePaymentIntentId) notFound()

  // Esta pantalla solo existe mientras corre la pasarela simulada. Con las
  // llaves de Stripe puestas, al alumno lo recibe Stripe directamente.
  if (usandoStripe()) notFound()

  const { cargo } = pago
  const token = cargo.inscripcion.tokenQR
  const deVuelta = destinoSeguro(volver, `/q/${token}`)

  return (
    <div className="contenedor angosto" style={{ paddingTop: '2rem' }}>
      <div className="aviso">
        <strong>Pasarela de demostración.</strong> No se cobra dinero real. Esta pantalla
        reemplaza a Stripe mientras la delegación tramita su cuenta; al activarla, el alumno
        llegará directo a Stripe y el resto del sistema funcionará igual.
      </div>

      <div className="tarjeta" style={{ textAlign: 'center' }}>
        <div className="etiqueta">{ETIQUETA_METODO[pago.metodo] ?? pago.metodo}</div>
        <div className="total monto" style={{ margin: '.5rem 0' }}>{pesos(pago.montoCobrado)}</div>
        <div className="silencio">
          {cargo.inscripcion.alumno.nombreCompleto} · {cargo.inscripcion.folio}
        </div>
        <div className="silencio" style={{ fontSize: '.85rem', marginTop: '.75rem' }}>
          Mensualidad {pesos(pago.montoNeto)} + {pesos(pago.montoComision)} de comisión del
          cobro en línea. La delegación recibe {pesos(pago.montoNeto)} completos.
        </div>
      </div>

      <div className="tarjeta">
        <h2>¿Qué quieres simular?</h2>
        <form action={resolver} className="fila">
          <input type="hidden" name="referencia" value={pago.stripePaymentIntentId} />
          <input type="hidden" name="token" value={token} />
          <input type="hidden" name="volver" value={deVuelta} />
          <button className="boton" type="submit" name="resultado" value="exito" style={{ flex: 1 }}>
            El pago se completó
          </button>
          <button className="boton tenue" type="submit" name="resultado" value="fallo" style={{ flex: 1 }}>
            El pago falló
          </button>
        </form>
      </div>

      <p className="silencio" style={{ textAlign: 'center', fontSize: '.85rem' }}>
        <a href={deVuelta}>Volver sin pagar</a>
      </p>
    </div>
  )
}
