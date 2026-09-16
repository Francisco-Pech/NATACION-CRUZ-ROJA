'use client'

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { guardarFactura, quitarFactura } from './acciones'
import CampoArchivo from '@/components/CampoArchivo'
import { IconoCerrar } from '@/components/Iconos'

type Datos = {
  factura: boolean
  rfc: string | null
  razonSocial: string | null
  codigoPostal: string | null
  regimenFiscal: string | null
  email: string | null
  /** Si ya trae cargada su constancia, y desde cuándo. */
  constancia: { nombre: string | null; desde: string } | null
}

/**
 * La factura, resuelta antes de pagar y no después.
 *
 * Va arriba a propósito: un CFDI se expide con los datos que había al
 * momento del cobro, y corregirlos después obliga a cancelarlo y volver a
 * expedirlo.
 *
 * El formulario está siempre a la vista dentro de la ventana, con los datos
 * ya puestos si los hay. Esconderlo tras un "corregir" obliga a un clic de
 * más para lo único que se viene a hacer aquí.
 */
export default function ModalFactura({
  folio,
  datos,
  regimenes,
}: {
  folio: string
  datos: Datos
  regimenes: Array<{ clave: string; nombre: string }>
}) {
  const [abierto, setAbierto] = useState(false)
  const [quitando, setQuitando] = useState(false)
  /**
   * Lo que va a quedar escrito, para que lo lea antes de guardarlo.
   *
   * Un CFDI se emite con esto tal cual: un RFC con un dígito cambiado no se
   * nota hasta que el SAT lo rechaza, y entonces hay que cancelar el
   * comprobante y volver a expedirlo. Leerlo una vez más cuesta un segundo.
   */
  const [porConfirmar, setPorConfirmar] = useState<Record<string, string> | null>(null)
  const formulario = useRef<HTMLFormElement>(null)

  function revisarAntesDeGuardar() {
    const f = formulario.current
    // Los `required` del navegador primero: no tiene caso confirmar lo que
    // está a medias.
    if (!f || !f.reportValidity()) return
    const d = new FormData(f)
    const archivo = d.get('constancia')
    setPorConfirmar({
      rfc: String(d.get('rfc') ?? '').toUpperCase(),
      razonSocial: String(d.get('razonSocial') ?? ''),
      codigoPostal: String(d.get('codigoPostal') ?? ''),
      regimenFiscal: String(d.get('regimenFiscal') ?? ''),
      correo: String(d.get('correoFactura') ?? ''),
      constancia:
        archivo instanceof File && archivo.size > 0
          ? archivo.name
          : datos.constancia
            ? 'la que ya tenías'
            : 'sin constancia',
    })
  }

  useEffect(() => {
    if (!abierto && !quitando) return
    const alTeclear = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      setQuitando(false)
      setAbierto(false)
      setPorConfirmar(null)
    }
    document.addEventListener('keydown', alTeclear)
    return () => document.removeEventListener('keydown', alTeclear)
  }, [abierto, quitando])

  return (
    <>
      <div className="tarjeta franja-factura">
        <div className="franja-factura-texto">
          <span className={`insignia ${datos.factura ? 'VERDE' : 'GRIS'}`}>
            {datos.factura ? 'Con factura' : 'Sin factura'}
          </span>
          <p>
            {datos.factura ? (
              <>
                Se expedirá a nombre de <strong>{datos.razonSocial}</strong>
                {datos.rfc && <> · <span className="mono">{datos.rfc}</span></>}
                {datos.email && <> · llega a {datos.email}</>}
              </>
            ) : (
              <>No se expedirá factura por este pago. Puedes pedirla antes de pagar.</>
            )}
          </p>
        </div>

        <div className="fila" style={{ gap: '.4rem', flexWrap: 'wrap' }}>
          <button type="button" className="boton tenue" onClick={() => setAbierto(true)}>
            {datos.factura ? 'Revisar' : 'Quiero factura'}
          </button>
          {/* El de quitar va de otro color: es el único de la pantalla que
              deshace algo, y se pulsa por error si se ve igual al de al lado. */}
          {datos.factura && (
            <button type="button" className="boton peligro" onClick={() => setQuitando(true)}>
              Quitar factura
            </button>
          )}
        </div>
      </div>

      {/* ------------------------------------------------ datos fiscales */}
      {abierto &&
        createPortal(
          <div className="telon-modal" onClick={() => setAbierto(false)}>
            <div
              className="modal"
              role="dialog"
              aria-modal="true"
              aria-label="Datos de factura"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button" className="modal-cerrar"
                onClick={() => setAbierto(false)} aria-label="Cerrar"
              >
                <IconoCerrar tamano={18} />
              </button>

              <h2>Datos de factura</h2>
              <p className="silencio" style={{ marginTop: 0, fontSize: '.86rem' }}>
                {datos.factura
                  ? 'Así se expedirá el CFDI. Revísalo antes de pagar: corregirlo después obliga a cancelarlo y volver a expedirlo.'
                  : 'Con estos datos se expedirá el CFDI. Revísalos bien: corregirlos después obliga a cancelarlo y volver a expedirlo.'}
              </p>

              <form action={guardarFactura} ref={formulario}>
                <input type="hidden" name="folio" value={folio} />
                <input type="hidden" name="factura" value="si" />

                {/* Los campos siguen montados mientras se confirma: si se
                    desmontaran, volver a editar borraría lo tecleado. */}
                <div hidden={porConfirmar !== null}>
                <label htmlFor="rfc">RFC</label>
                <input id="rfc" name="rfc" defaultValue={datos.rfc ?? ''} required className="mono" />

                <label htmlFor="razonSocial">Razón social</label>
                <input id="razonSocial" name="razonSocial" defaultValue={datos.razonSocial ?? ''} required />

                <label htmlFor="codigoPostal">Código postal</label>
                <input id="codigoPostal" name="codigoPostal" defaultValue={datos.codigoPostal ?? ''}
                  inputMode="numeric" required />

                <label htmlFor="regimenFiscal">Régimen fiscal</label>
                <select id="regimenFiscal" name="regimenFiscal"
                  defaultValue={datos.regimenFiscal ?? ''} required>
                  <option value="">Escoge…</option>
                  {regimenes.map((r) => (
                    <option key={r.clave} value={r.clave}>{r.clave} · {r.nombre}</option>
                  ))}
                </select>

                <label htmlFor="correoFactura">Correo electrónico</label>
                <input id="correoFactura" name="correoFactura" type="email"
                  defaultValue={datos.email ?? ''} required />
                <p className="silencio" style={{ fontSize: '.82rem', margin: '.3rem 0 .8rem' }}>
                  Ahí te llega el CFDI.
                </p>

                <label>Constancia de situación fiscal</label>
                {datos.constancia && (
                  <div className="constancia-actual">
                    <span className="silencio">
                      Cargada el {datos.constancia.desde}
                      {datos.constancia.nombre && <> · {datos.constancia.nombre}</>}. Si subes
                      otra, reemplaza a esa.
                    </span>
                    {/* Abrirla es como se comprueba que subió el archivo
                        correcto, y no el recibo de la luz. */}
                    <a
                      className="boton tenue"
                      href={`/pago/${folio}/constancia`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Ver la que tengo
                    </a>
                  </div>
                )}
                <CampoArchivo
                  nombre="constancia"
                  acepta="application/pdf"
                  ayuda="El PDF que descarga el SAT. Opcional: puedes traerlo después."
                />

                <div className="fila" style={{ justifyContent: 'flex-end', marginTop: '.9rem' }}>
                  <button className="boton" type="button" onClick={revisarAntesDeGuardar}>
                    Guardar
                  </button>
                  <button type="button" className="boton tenue" onClick={() => setAbierto(false)}>
                    Cerrar
                  </button>
                </div>
                </div>

                {porConfirmar && (
                  <>
                    <div className="aviso">
                      <strong>Revisa antes de guardar.</strong> El CFDI se emitirá exactamente
                      con estos datos. Corregirlos después obliga a cancelarlo y volver a
                      expedirlo.
                    </div>

                    <table className="datos-fiscales">
                      <tbody>
                        <tr><td>RFC</td><td className="derecha mono">{porConfirmar.rfc}</td></tr>
                        <tr><td>Razón social</td><td className="derecha">{porConfirmar.razonSocial}</td></tr>
                        <tr><td>Código postal</td><td className="derecha">{porConfirmar.codigoPostal}</td></tr>
                        <tr><td>Régimen</td><td className="derecha">
                          {regimenes.find((r) => r.clave === porConfirmar.regimenFiscal)?.nombre
                            ?? porConfirmar.regimenFiscal}
                        </td></tr>
                        <tr><td>Correo</td><td className="derecha">{porConfirmar.correo}</td></tr>
                        <tr><td>Constancia</td><td className="derecha">{porConfirmar.constancia}</td></tr>
                      </tbody>
                    </table>

                    <div className="fila" style={{ justifyContent: 'flex-end', marginTop: '.9rem' }}>
                      <button className="boton" type="submit">Sí, emitir así</button>
                      <button
                        type="button" className="boton tenue"
                        onClick={() => setPorConfirmar(null)}
                      >
                        Volver a editar
                      </button>
                    </div>
                  </>
                )}
              </form>
            </div>
          </div>,
          document.body,
        )}

      {/* --------------------------------------------- quitar la factura */}
      {quitando &&
        createPortal(
          <div className="telon-modal" onClick={() => setQuitando(false)}>
            <div
              className="modal modal-angosto"
              role="dialog"
              aria-modal="true"
              aria-label="Quitar la factura"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button" className="modal-cerrar"
                onClick={() => setQuitando(false)} aria-label="Cerrar"
              >
                <IconoCerrar tamano={18} />
              </button>

              <h2>¿Quitar la factura?</h2>
              <p style={{ marginTop: 0 }}>
                Ya no se te expedirá CFDI por lo que pagues de aquí en adelante. Tus datos
                fiscales <strong>no se borran</strong>: si vuelves a pedirla, ahí siguen.
              </p>

              <form action={quitarFactura}>
                <input type="hidden" name="folio" value={folio} />
                <div className="fila" style={{ justifyContent: 'flex-end' }}>
                  <button className="boton peligro" type="submit">Sí, quitarla</button>
                  <button type="button" className="boton tenue" onClick={() => setQuitando(false)}>
                    Cerrar
                  </button>
                </div>
              </form>
            </div>
          </div>,
          document.body,
        )}
    </>
  )
}
