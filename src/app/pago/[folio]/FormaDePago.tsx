'use client'

import { useActionState, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { iniciarPago, pagarEnLaPaginaDeStripe } from './acciones'
import { MarcaStripe } from '@/components/MarcaStripe'
import ParaCopiar from '@/components/ParaCopiar'
import PagoConTarjeta from './PagoConTarjeta'
import { IconoCerrar } from '@/components/Iconos'

export type Forma = {
  metodo: string
  etiqueta: string
  total: string
  comision: string
  porcentaje: number
  montoFijo: string
  iva: number
  cuando: string | null
}

/**
 * Escoger con qué pagar: una lista, no tres botones grandes.
 *
 * Tres botones rojos del ancho de la pantalla pesan más que el monto que
 * se va a pagar, y obligan a decidir antes de haber leído nada. Como lista
 * se ven los tres precios juntos —que es lo que la gente compara— y se
 * paga con un solo botón al final.
 *
 * El desglose del cobro queda a un toque: quien se pregunte por qué son
 * $808 si la mensualidad es $770 lo abre, y quien no, no lo ve.
 */
export default function FormaDePago({
  folio,
  cargoId,
  mes,
  neto,
  formas,
}: {
  folio: string
  cargoId: string
  mes: string
  neto: string
  formas: Forma[]
}) {
  const [elegido, setElegido] = useState(formas[0]?.metodo ?? '')
  const [viendo, setViendo] = useState(false)
  const [arranque, arrancar, arrancando] = useActionState(iniciarPago, null)
  const [listo, setListo] = useState<string | null>(null)

  // Mientras hay un cobro arrancado, la ventana se queda abierta: adentro
  // está el recibo de OXXO o la CLABE, que es justo lo que no se puede
  // perder de vista.
  const enProceso = arranque !== null || arrancando

  useEffect(() => {
    if (!viendo && !enProceso) return
    const alTeclear = (e: KeyboardEvent) => { if (e.key === 'Escape') setViendo(false) }
    document.addEventListener('keydown', alTeclear)
    return () => document.removeEventListener('keydown', alTeclear)
  }, [viendo, enProceso])

  const forma = formas.find((f) => f.metodo === elegido) ?? formas[0]
  if (!forma) return null

  // Cerrar recarga la cuenta: así el cobro arrancado deja de estar en
  // pantalla y los meses se releen ya con lo que haya pasado.
  const cerrarAqui = `/pago/${folio}`

  return (
    <form action={arrancar}>
      <input type="hidden" name="folio" value={folio} />
      <input type="hidden" name="cargoId" value={cargoId} />

      <ul className="formas-pago">
        {formas.map((f) => (
          <li key={f.metodo}>
            <label>
              <input
                type="radio"
                name="metodo"
                value={f.metodo}
                checked={f.metodo === elegido}
                onChange={() => setElegido(f.metodo)}
              />
              <span className="formas-pago-nombre">{f.etiqueta}</span>
              <span className="formas-pago-monto monto">{f.total}</span>
            </label>
          </li>
        ))}
      </ul>

      <p className="formas-pago-nota silencio">
        {forma.cuando}{' '}
        <button type="button" className="enlace-aviso" onClick={() => setViendo(true)}>
          ¿Por qué {forma.total}?
        </button>
      </p>

      <button className="boton" type="submit" style={{ width: '100%' }}>
        Pagar {forma.total}
      </button>

      {(enProceso || listo) &&
        createPortal(
          <div className="telon-modal">
            <div
              className="modal"
              role="dialog"
              aria-modal="true"
              aria-label={`Pagar con ${forma.etiqueta}`}
            >
              <a className="modal-cerrar" href={cerrarAqui} aria-label="Cerrar">
                <IconoCerrar tamano={18} />
              </a>

              <h2 style={{ marginBottom: '.1rem' }}>
                {listo ? 'Listo' : `Pagar con ${forma.etiqueta}`}
              </h2>
              <p className="silencio" style={{ marginTop: 0, fontSize: '.85rem' }}>
                {mes} · {forma.total}
              </p>

              {listo ? (
                <>
                  <div className="aviso">{listo}</div>
                  <div className="fila" style={{ justifyContent: 'flex-end' }}>
                    <a className="boton" href={window.location.pathname}>Cerrar</a>
                  </div>
                </>
              ) : arrancando ? (
                <p className="silencio" style={{ textAlign: 'center', padding: '1.5rem 0' }}>
                  <span className="girando" /> Preparando tu pago…
                </p>
              ) : arranque && !arranque.ok ? (
                <>
                  <p className="error">{arranque.mensaje}</p>
                  <div className="fila" style={{ justifyContent: 'flex-end' }}>
                    <a className="boton tenue" href={window.location.pathname}>Cerrar</a>
                  </div>
                </>
              ) : arranque && arranque.ok ? (
                <>
                  <Proceso
                    folio={folio}
                    siguiente={arranque.siguiente}
                    codigoDeBarras={arranque.codigoDeBarras}
                    total={forma.total}
                    cerrarAqui={cerrarAqui}
                    alTerminar={setListo}
                  />

                  <MarcaStripe>
                    El cobro lo procesa <strong>Stripe</strong> a nombre de la Cruz Roja
                    Mexicana, Delegación Cancún.
                  </MarcaStripe>

                  {/* La salida: hay quien no le teclea su tarjeta a una
                      pantalla que no conoce, y la de Stripe sí la conoce. */}
                  <form action={pagarEnLaPaginaDeStripe}>
                    <input type="hidden" name="folio" value={folio} />
                    <input type="hidden" name="cargoId" value={cargoId} />
                    <input type="hidden" name="metodo" value={elegido} />
                    <button type="submit" className="enlace-aviso" style={{ fontSize: '.82rem' }}>
                      Prefiero pagar en la página de Stripe
                    </button>
                  </form>

                  {/* Con tarjeta, el Cerrar va junto al Pagar, dentro del
                      formulario; aquí solo hace falta para los métodos que
                      no tienen botón de pagar. */}
                  {arranque.siguiente.tipo !== 'TARJETA' && (
                    <div className="fila" style={{ justifyContent: 'flex-end', marginTop: '.9rem' }}>
                      <a className="boton tenue" href={cerrarAqui}>Cerrar</a>
                    </div>
                  )}
                </>
              ) : null}
            </div>
          </div>,
          document.body,
        )}

      {viendo &&
        createPortal(
          <div className="telon-modal" onClick={() => setViendo(false)}>
            <div
              className="modal modal-angosto"
              role="dialog"
              aria-modal="true"
              aria-label={`Desglose de ${forma.etiqueta}`}
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button" className="modal-cerrar"
                onClick={() => setViendo(false)} aria-label="Cerrar"
              >
                <IconoCerrar tamano={18} />
              </button>

              <h2 style={{ marginBottom: '.1rem' }}>{forma.etiqueta}</h2>
              <p className="silencio" style={{ marginTop: 0, fontSize: '.85rem' }}>{mes}</p>

              <table className="desglose-cobro">
                <tbody>
                  <tr><td>Mensualidad</td><td className="derecha monto">{neto}</td></tr>
                  <tr>
                    <td>
                      Comisión de la pasarela
                      <br />
                      <span className="silencio pie-celda">
                        {(forma.porcentaje * 100).toFixed(1).replace('.0', '')} % del cobro
                        {forma.montoFijo !== '$0.00' && ` + ${forma.montoFijo}`}
                        {forma.iva > 0 && `, más ${(forma.iva * 100).toFixed(0)} % de IVA sobre esa comisión`}
                      </span>
                    </td>
                    <td className="derecha monto">{forma.comision}</td>
                  </tr>
                  <tr className="desglose-total">
                    <td><strong>Pagas</strong></td>
                    <td className="derecha monto"><strong>{forma.total}</strong></td>
                  </tr>
                </tbody>
              </table>

              <p className="silencio" style={{ fontSize: '.85rem' }}>
                La comisión no se queda en la delegación: es lo que cobra la pasarela por
                mover el dinero. A la escuela le llegan <strong>{neto}</strong> completos,
                pagues por donde pagues.
              </p>

              <div className="fila" style={{ justifyContent: 'flex-end' }}>
                <button type="button" className="boton tenue" onClick={() => setViendo(false)}>
                  Cerrar
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </form>
  )
}

// --------------------------------------------------- lo que sigue, por método

function Proceso({
  folio,
  siguiente,
  codigoDeBarras,
  total,
  cerrarAqui,
  alTerminar,
}: {
  folio: string
  siguiente: NonNullable<Awaited<ReturnType<typeof iniciarPago>> & { ok: true }>['siguiente']
  codigoDeBarras: string | null
  total: string
  cerrarAqui: string
  alTerminar: (mensaje: string) => void
}) {
  if (siguiente.tipo === 'TARJETA') {
    return (
      <PagoConTarjeta
        folio={folio}
        claveDelCliente={siguiente.claveDelCliente}
        clavePublica={siguiente.clavePublica}
        total={total}
        cerrarAqui={cerrarAqui}
        alTerminar={alTerminar}
      />
    )
  }

  if (siguiente.tipo === 'RECIBO') {
    return (
      <>
        <p style={{ marginTop: 0 }}>
          Enseña este código en la caja de cualquier OXXO. Se puede pasar desde la pantalla
          del teléfono, no hace falta imprimirlo.
        </p>

        {/* El código de barras es lo que lee el escáner de la tienda. Va
            arriba y en grande: es a lo que la persona viene. */}
        {codigoDeBarras && (
          <figure className="codigo-de-barras">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={codigoDeBarras} alt={`Código de barras ${siguiente.numero ?? ''}`} />
          </figure>
        )}

        {siguiente.numero && (
          <p className="referencia-grande">
            <ParaCopiar valor={siguiente.numero} etiqueta="referencia" />
          </p>
        )}

        {siguiente.url && (
          <a className="boton" href={siguiente.url} target="_blank" rel="noopener noreferrer"
            style={{ width: '100%', textAlign: 'center', textDecoration: 'none' }}>
            Abrir el recibo completo
          </a>
        )}

        {siguiente.vence && (
          <p className="silencio" style={{ fontSize: '.84rem', marginTop: '.6rem' }}>
            Tienes hasta el {new Date(siguiente.vence).toLocaleDateString('es-MX', {
              day: 'numeric', month: 'long', year: 'numeric',
            })} para pagarlo.
          </p>
        )}

        <div className="aviso">
          <strong>Tarda de 1 a 3 días hábiles</strong> en reflejarse. Guarda tu ticket: si algo
          no cuadra, es lo que lo respalda.
        </div>

      </>
    )
  }

  if (siguiente.tipo === 'TRANSFERENCIA') {
    return (
      <>
        <p style={{ marginTop: 0 }}>
          Haz la transferencia desde tu banca en línea a esta cuenta. Es una CLABE creada
          para este pago: con transferir ahí, se registra solo.
        </p>

        <table className="datos-fiscales">
          <tbody>
            {siguiente.banco && (
              <tr>
                <td>Banco</td>
                <td className="derecha">
                  <ParaCopiar valor={siguiente.banco} etiqueta="banco" />
                </td>
              </tr>
            )}
            {siguiente.clabe && (
              <tr>
                <td>CLABE</td>
                <td className="derecha">
                  <ParaCopiar valor={siguiente.clabe} etiqueta="CLABE" />
                </td>
              </tr>
            )}
            {siguiente.beneficiario && (
              <tr>
                <td>Beneficiario</td>
                <td className="derecha">
                  <ParaCopiar valor={siguiente.beneficiario} etiqueta="beneficiario" />
                </td>
              </tr>
            )}
            {siguiente.referencia && (
              <tr>
                <td>Referencia</td>
                <td className="derecha">
                  <ParaCopiar valor={siguiente.referencia} etiqueta="referencia" />
                </td>
              </tr>
            )}
            <tr>
              <td>Importe</td>
              <td className="derecha">
                {/* Sin el signo de pesos: se copia para pegarlo en la banca,
                    donde el monto va en cifras y nada más. */}
                <ParaCopiar valor={total.replace(/[^\d.]/g, '')} etiqueta="importe" />
              </td>
            </tr>
          </tbody>
        </table>

        <div className="aviso">
          <strong>Transfiere el importe exacto.</strong> Normalmente se refleja en una hora, y
          a más tardar en un día hábil.
        </div>

      </>
    )
  }

  return null
}
