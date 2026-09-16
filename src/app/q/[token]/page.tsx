import { notFound, redirect } from 'next/navigation'
import { prisma } from '@/lib/db'
import { colorDeEstado, ETIQUETA_ESTADO } from '@/lib/servicios/estado-cuenta'
import { iniciarCobro } from '@/lib/servicios/cobro-en-linea'
import { metodosDisponibles } from '@/lib/metodos-pago'
import {
  calcularTotalConComision, comisionesDelEntorno, type MetodoConComision,
} from '@/lib/comisiones'
import { pesos, nombreMes, fechaLarga } from '@/lib/formato'
import { usandoStripe } from '@/lib/pasarela'
import { validarComprobante } from '@/lib/comprobante'
import CampoArchivo from '@/components/CampoArchivo'
import { MetodoPago } from '@prisma/client'

/**
 * Desde aquí el cobro se hace en la pantalla de pago, con el folio.
 *
 * Hay un solo lugar donde se cobra y no dos: ahí viven la ventana con el
 * desglose, el recibo de OXXO, la CLABE de la transferencia y el campo de
 * la tarjeta. Mantener una segunda copia de todo eso en esta página sería
 * garantizar que una de las dos se quede atrás.
 */
async function pagarEnLinea(datos: FormData) {
  'use server'
  const token = String(datos.get('token'))

  const inscripcion = await prisma.inscripcion.findUnique({
    where: { tokenQR: token },
    select: { folio: true },
  })
  if (!inscripcion) notFound()

  redirect(`/pago/${inscripcion.folio}`)
}

/**
 * Guarda el comprobante que sube el alumno.
 *
 * Lo sube él y no el mostrador, y esa es la idea: la persona pagó en OXXO o
 * hizo la transferencia, y el cobro tarda en reflejarse. Con su ticket aquí,
 * quien atiende ve que hay con qué respaldar el pago y lo anota; sin él
 * tendría que creerle de palabra o pedirle que vuelva.
 *
 * Se guarda en el cargo del mes, no en un pago: cuando el alumno lo sube
 * todavía no existe ningún pago, justamente porque nadie lo ha anotado.
 */
async function subirComprobante(datos: FormData) {
  'use server'

  const token = String(datos.get('token'))
  const cargoId = String(datos.get('cargoId'))

  const cargo = await prisma.cargo.findFirst({
    // Por el token y no solo por el id: sin esto, quien cambiara el cargoId
    // en el formulario le subiría comprobantes a la cuenta de otro.
    where: { id: cargoId, inscripcion: { tokenQR: token } },
    select: { id: true },
  })
  if (!cargo) notFound()

  const archivo = datos.get('comprobante')
  if (!(archivo instanceof File) || archivo.size === 0) {
    redirect(`/q/${token}?mal=${encodeURIComponent('Escoge el archivo antes de enviarlo.')}`)
  }

  const mal = validarComprobante({ tipo: archivo.type, tamano: archivo.size })
  if (mal) redirect(`/q/${token}?mal=${encodeURIComponent(mal)}`)

  await prisma.cargo.update({
    where: { id: cargo.id },
    data: {
      comprobanteImagen: new Uint8Array(await archivo.arrayBuffer()),
      comprobanteTipo: archivo.type,
      comprobanteNombre: archivo.name,
      comprobanteSubidoEn: new Date(),
    },
  })

  redirect(`/q/${token}?comprobante=listo`)
}

export default async function PaginaAlumno({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>
  searchParams: Promise<{ comprobante?: string; mal?: string }>
}) {
  const { token } = await params
  const { comprobante: avisoComprobante, mal: avisoMal } = await searchParams

  const inscripcion = await prisma.inscripcion.findUnique({
    where: { tokenQR: token },
    include: {
      alumno: true,
      ciclo: true,
      cargos: { include: { periodo: true, tipoCurso: true }, orderBy: { periodo: { mes: "asc" } } },
    },
  })
  // No se distingue entre token inválido y token inexistente: revelarlo
  // permitiría confirmar folios a base de tanteo.
  if (!inscripcion) notFound()

  const mes = new Date().getMonth() + 1
  // Quien lleva dos cursos debe dos cargos este mes. Se cobra uno a la vez,
  // pero los demás se listan: esconderlos haría que pagara de menos sin
  // enterarse, y el semáforo de la puerta seguiría en rojo.
  const cargosDelMes = inscripcion.cargos.filter((c) => c.periodo.mes === mes)
  const cargo = cargosDelMes[0] ?? null
  const otrosCargos = cargosDelMes.slice(1)

  // Las comisiones viven en el entorno, no en la base: cambian según el año
  // y según lo que pacte la delegación con Stripe.
  const porMetodo = comisionesDelEntorno()
  const configuraciones = (Object.keys(porMetodo) as MetodoConComision[]).map((metodo) => ({
    metodo,
    ...porMetodo[metodo],
  }))
  const disponibles = cargo
    ? metodosDisponibles(configuraciones, cargo.periodo.fechaLimite)
    : []

  const conPrecio = disponibles.map((m) => ({
    ...m,
    total: calcularTotalConComision(cargo!.montoNeto, m.config).total,
  }))
  const enPersona = conPrecio.filter((m) => !m.enLinea)
  const enLinea = conPrecio.filter((m) => m.enLinea)
  const oxxoRetirado = cargo && !disponibles.some((m) => m.metodo === 'OXXO')

  return (
    <div className="contenedor angosto">
      <div style={{ textAlign: 'center', margin: '1rem 0 1.5rem' }}>
        <div className="silencio" style={{ fontSize: '.8rem', letterSpacing: '.05em' }}>
          CRUZ ROJA MEXICANA · CANCÚN
        </div>
        <h1 style={{ margin: '.35rem 0 .15rem' }}>{inscripcion.alumno.nombreCompleto}</h1>
        <div style={{ fontFamily: 'ui-monospace, monospace' }} className="silencio">
          {inscripcion.folio}
        </div>
      </div>

      {avisoComprobante === 'listo' && (
        <div className="aviso">
          <strong>Recibimos tu comprobante.</strong> En recepción lo revisan y registran tu pago.
          Si algo falta, te buscan.
        </div>
      )}
      {avisoMal && <div className="error">{avisoMal}</div>}

      {!inscripcion.alumno.datosCompletos && (
        <div className="aviso">
          <strong>Falta completar tu información.</strong>{' '}
          <a href={`/q/${token}/datos`}>Complétala aquí</a> — nos sirve para poder avisar a
          alguien en caso de emergencia.
        </div>
      )}

      {cargo ? (
        <>
          {otrosCargos.length > 0 && (
            <div className="aviso">
              <strong>Tienes más de un curso este mes.</strong> Abajo se cobra{' '}
              {cargo.tipoCurso.nombre}. Te falta además:{' '}
              {otrosCargos.map((c) => `${c.tipoCurso.nombre} ${pesos(c.montoNeto)}`).join(' · ')}.
              Cada curso se paga por separado; pregunta en recepción.
            </div>
          )}

          <div className="tarjeta" style={{ textAlign: 'center' }}>
            <div className="etiqueta">
              {nombreMes(cargo.periodo.mes)}
              {cargosDelMes.length > 1 && ` · ${cargo.tipoCurso.nombre}`}
            </div>
            <span
              className={`insignia ${colorDeEstado(cargo.estado)}`}
              style={{ fontSize: '1rem', padding: '.35rem 1rem' }}
            >
              {ETIQUETA_ESTADO[cargo.estado]}
            </span>
            <div className="total monto" style={{ marginTop: '.75rem' }}>{pesos(cargo.montoNeto)}</div>
            <div className="silencio" style={{ fontSize: '.85rem' }}>
              Fecha límite: {fechaLarga(cargo.periodo.fechaLimite)}
            </div>
          </div>

          <div className="tarjeta">
            <h2>Desglose</h2>
            <table>
              <tbody>
                <tr><td>Mensualidad</td><td className="derecha monto">{pesos(cargo.montoMensualidad)}</td></tr>
                {cargo.montoLockers > 0 && (
                  <tr><td>Lockers</td><td className="derecha monto">{pesos(cargo.montoLockers)}</td></tr>
                )}
                {cargo.montoDescuento > 0 && (
                  <tr><td>Descuento</td><td className="derecha monto" style={{ color: 'var(--verde)' }}>−{pesos(cargo.montoDescuento)}</td></tr>
                )}
                {cargo.montoRecargo > 0 && (
                  <tr><td>Recargo por pago tardío</td><td className="derecha monto" style={{ color: '#b91c1c' }}>{pesos(cargo.montoRecargo)}</td></tr>
                )}
                <tr>
                  <td><strong>Total</strong></td>
                  <td className="derecha monto"><strong>{pesos(cargo.montoNeto)}</strong></td>
                </tr>
              </tbody>
            </table>
          </div>

          {cargo.estado !== 'PAGADO' && (
            <>
              <div className="tarjeta">
                <h2>Pagar en línea</h2>
                <p className="silencio" style={{ marginTop: 0, fontSize: '.9rem' }}>
                  El cobro por internet tiene un costo que la delegación no puede absorber,
                  así que el precio cambia según la forma de pago.
                </p>

                {enLinea.map((m) => (
                  <form action={pagarEnLinea} key={m.metodo} style={{ marginBottom: '.5rem' }}>
                    <input type="hidden" name="token" value={token} />
                    <input type="hidden" name="metodo" value={m.metodo} />
                    <button
                      className="boton"
                      type="submit"
                      style={{ width: '100%', display: 'flex', justifyContent: 'space-between' }}
                    >
                      <span>{m.etiqueta}</span>
                      <span className="monto">{pesos(m.total)}</span>
                    </button>
                  </form>
                ))}

                {oxxoRetirado && (
                  <p className="silencio" style={{ fontSize: '.85rem', marginBottom: 0 }}>
                    El pago en OXXO no aparece porque tarda hasta tres días en confirmarse y ya
                    no alcanzaría antes de la fecha límite.
                  </p>
                )}

                {!usandoStripe() && (
                  <div className="aviso" style={{ marginBottom: 0 }}>
                    Modo demostración: no se cobra dinero real.
                  </div>
                )}
              </div>

              <div className="tarjeta">
                <h2>O paga sin comisión</h2>
                <table>
                  <tbody>
                    {enPersona.map((m) => (
                      <tr key={m.metodo}>
                        <td>{m.etiqueta}</td>
                        <td className="derecha monto"><strong>{pesos(m.total)}</strong></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="silencio" style={{ fontSize: '.85rem', marginBottom: 0 }}>
                  Presenta tu comprobante en recepción para que registren el pago.
                </p>
              </div>

              {/* Sube el comprobante el alumno, no el mostrador: es quien lo
                  tiene en el teléfono al salir del OXXO. Así el pago se
                  registra sin que tenga que dar otra vuelta. */}
              <div className="tarjeta">
                <h2>¿Ya pagaste?</h2>
                <p className="silencio" style={{ marginTop: 0, fontSize: '.9rem' }}>
                  {cargo.comprobanteSubidoEn ? (
                    <>
                      Subiste tu comprobante el{' '}
                      {fechaLarga(cargo.comprobanteSubidoEn)}. En recepción lo revisan y
                      registran el pago. Si te equivocaste de archivo, sube otro y reemplaza al
                      anterior.
                    </>
                  ) : (
                    <>
                      Si pagaste en OXXO o por transferencia, sube aquí tu ticket. El cobro tarda
                      en reflejarse y con tu comprobante lo registran sin que tengas que venir.
                    </>
                  )}
                </p>

                <form action={subirComprobante}>
                  <input type="hidden" name="token" value={token} />
                  <input type="hidden" name="cargoId" value={cargo.id} />
                  <CampoArchivo
                    nombre="comprobante"
                    acepta="image/*,application/pdf"
                    ayuda="Una foto del ticket o el PDF del banco."
                  />
                  <button className="boton" type="submit" style={{ width: '100%', marginTop: '.7rem' }}>
                    {cargo.comprobanteSubidoEn ? 'Reemplazar mi comprobante' : 'Enviar mi comprobante'}
                  </button>
                </form>
              </div>
            </>
          )}
        </>
      ) : (
        <div className="tarjeta">
          <p className="silencio" style={{ margin: 0 }}>
            Todavía no hay un cargo generado para este mes.
          </p>
        </div>
      )}

      {/* La factura, preguntada y no supuesta. Los datos fiscales cambian
          —alguien se muda, una empresa cambia de régimen— y enterarse
          cuando el SAT rechaza el CFDI es enterarse tarde. */}
      <div className="tarjeta">
        <h2>Factura</h2>
        <p className="silencio" style={{ marginTop: 0, fontSize: '.9rem' }}>
          {inscripcion.alumno.factura ? (
            <>
              Se te factura a nombre de{' '}
              <strong>{inscripcion.alumno.razonSocial ?? 'quien registraste'}</strong>
              {inscripcion.alumno.rfc && (
                <> · <span style={{ fontFamily: 'ui-monospace, monospace' }}>{inscripcion.alumno.rfc}</span></>
              )}
              . Revisa que siga bien antes de que termine el mes.
            </>
          ) : (
            <>Hoy no se te expide factura. Si la necesitas, dinos aquí a nombre de quién.</>
          )}
        </p>
        <a className="boton" href={`/q/${token}/factura`} style={{ display: 'inline-block' }}>
          {inscripcion.alumno.factura ? 'Revisar mis datos de factura' : 'Quiero factura'}
        </a>
      </div>

      {inscripcion.cargos.length > 0 && (
        <div className="tarjeta">
          <h2>Historial {inscripcion.ciclo.anio}</h2>
          <table>
            <tbody>
              {inscripcion.cargos.map((c) => (
                <tr key={c.id}>
                  <td>{nombreMes(c.periodo.mes)}</td>
                  <td><span className={`insignia ${colorDeEstado(c.estado)}`}>{ETIQUETA_ESTADO[c.estado]}</span></td>
                  <td className="derecha monto">{pesos(c.montoNeto)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="silencio" style={{ fontSize: '.78rem', textAlign: 'center' }}>
        Esta página es personal. No compartas el enlace ni tu código QR.
      </p>
    </div>
  )
}
