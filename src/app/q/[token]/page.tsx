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
import { MetodoPago } from '@prisma/client'

async function pagarEnLinea(datos: FormData) {
  'use server'
  const token = String(datos.get('token'))
  const metodo = String(datos.get('metodo')) as MetodoPago

  const { urlPago } = await iniciarCobro(token, metodo, `/q/${token}`)
  redirect(urlPago)
}

export default async function PaginaAlumno({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params

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
