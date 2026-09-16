'use client'

import { useActionState, useCallback, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { obtenerMeses, marcarPagado, corregirPago, adelantarMes } from './pagos-acciones'
import Alerta from '@/components/Alerta'
import Selector from '@/components/Selector'
import { IconoCerrar } from '@/components/Iconos'
import { pesos, nombreMes, fechaLarga } from '@/lib/formato'

type Datos = Awaited<ReturnType<typeof obtenerMeses>>
type NoNulo = NonNullable<Datos>
type Mes = NoNulo['meses'][number]
type Cargo = Mes['cargos'][number]
type Pago = Cargo['pagos'][number]
type Metodo = NoNulo['metodos'][number]

/**
 * Los meses del alumno: lo que debe cada uno y lo que ya pagó.
 *
 * Desde el mes en que se inscribió hasta que se acaba el año. Se abre en el
 * mes que corre, que es por el que casi siempre preguntan, y los demás se
 * despliegan picándolos. Los que todavía no tienen cargo se pueden adelantar
 * desde aquí: quien quiere dejar pagados tres meses de una vez no debería
 * tener que volver cada mes.
 *
 * Se anota cualquier forma de pago, la de la pasarela incluida —un OXXO
 * pagado en la tienda tarda días en reflejarse—, pero lo que la pasarela ya
 * escribió se ve y no se toca: cambiarlo aquí dejaría al sistema diciendo
 * que alguien pagó cuando el banco dice que no.
 */
export default function ModalMesEnCurso({
  id,
  etiqueta,
  color,
  cuantos,
}: {
  id: string
  etiqueta: string
  color: string
  cuantos: number
}) {
  const [abierto, setAbierto] = useState(false)

  /**
   * En qué va la búsqueda.
   *
   * Se guarda la fase y no solo los datos: con `!datos` como señal de "hay
   * que pedirlos", una respuesta vacía —sin ciclo abierto, o una
   * inscripción borrada— volvía a disparar la petición para siempre, y la
   * ventana se quedaba en "Buscando…" llamando al servidor sin parar.
   */
  const [busca, setBusca] = useState<
    { fase: 'quieto' | 'buscando' | 'vacio' | 'falla' } | { fase: 'listo'; datos: NoNulo }
  >({ fase: 'quieto' })

  const traer = useCallback(() => {
    setBusca({ fase: 'buscando' })
    obtenerMeses(id)
      .then((d) => setBusca(d ? { fase: 'listo', datos: d } : { fase: 'vacio' }))
      .catch(() => setBusca({ fase: 'falla' }))
  }, [id])

  useEffect(() => {
    if (abierto && busca.fase === 'quieto') traer()
  }, [abierto, busca.fase, traer])

  useEffect(() => {
    if (!abierto) return
    const alTeclear = (e: KeyboardEvent) => { if (e.key === 'Escape') setAbierto(false) }
    document.addEventListener('keydown', alTeclear)
    return () => document.removeEventListener('keydown', alTeclear)
  }, [abierto])

  return (
    <>
      <button type="button" className="insignia-boton" onClick={() => setAbierto(true)}>
        <span className={`insignia ${color}`}>
          {etiqueta}
          {cuantos > 1 && ` (${cuantos})`}
        </span>
      </button>

      {abierto &&
        createPortal(
          <div className="telon-modal" onClick={() => setAbierto(false)}>
            <div
              className="modal modal-mes" role="dialog" aria-modal="true"
              aria-label="Mes en curso" onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button" className="modal-cerrar" onClick={() => setAbierto(false)}
                aria-label="Cerrar"
              >
                <IconoCerrar tamano={18} />
              </button>

              {busca.fase === 'falla' ? (
                <>
                  <h2>Mensualidades</h2>
                  <p className="error">No se pudieron traer. Vuelve a intentarlo.</p>
                  <div className="fila" style={{ justifyContent: 'flex-end' }}>
                    <button type="button" className="boton" onClick={traer}>Reintentar</button>
                  </div>
                </>
              ) : busca.fase === 'vacio' ? (
                <>
                  <h2>Mensualidades</h2>
                  <p className="aviso">
                    No hay nada que cobrar todavía: falta abrir el ciclo del año.
                  </p>
                </>
              ) : busca.fase !== 'listo' ? (
                <p className="silencio" style={{ textAlign: 'center', padding: '2rem 0' }}>
                  <span className="girando" /> Buscando…
                </p>
              ) : (
                <>
                  <h2 style={{ marginBottom: '.2rem' }}>Mensualidades {busca.datos.anio}</h2>
                  <p className="silencio" style={{ marginTop: 0 }}>
                    {busca.datos.alumno} ·{' '}
                    <span style={{ fontFamily: 'ui-monospace, monospace' }}>
                      {busca.datos.folio}
                    </span>
                  </p>

                  {busca.datos.descuento && <TarjetaDescuento d={busca.datos.descuento} />}

                  {busca.datos.meses.map((m) => (
                    <BloqueMes
                      key={m.mes}
                      mes={m}
                      inscripcionId={id}
                      metodos={busca.datos.metodos}
                      nombreDescuento={busca.datos.descuento?.nombre ?? null}
                      alCambiar={traer}
                    />
                  ))}
                </>
              )}
            </div>
          </div>,
          document.body,
        )}
    </>
  )
}

// ------------------------------------------------------- el descuento

/**
 * El descuento que lleva el alumno, con hasta cuándo le dura.
 *
 * Arriba de todo y no escondido en el desglose de un mes: quien atiende
 * necesita poder decir de un vistazo "sí, tiene INAPAM" sin abrir meses.
 */
function TarjetaDescuento({
  d,
}: {
  d: NonNullable<NoNulo['descuento']>
}) {
  const desde = d.desde ? fechaLarga(new Date(d.desde)) : null
  const hasta = d.hasta ? fechaLarga(new Date(d.hasta)) : null

  return (
    <div className="tarjeta-descuento">
      <span className="insignia VERDE">{d.etiqueta}</span>
      <span className="silencio">
        {!desde && !hasta
          ? 'Sin vencimiento: se le aplica todos los meses.'
          : desde && hasta
            ? `Del ${desde} al ${hasta}.`
            : hasta
              ? `Hasta el ${hasta}.`
              : `Desde el ${desde}.`}
      </span>
    </div>
  )
}

// ------------------------------------------------------------- un mes

function BloqueMes({
  mes,
  inscripcionId,
  metodos,
  nombreDescuento,
  alCambiar,
}: {
  mes: Mes
  inscripcionId: string
  metodos: Metodo[]
  nombreDescuento: string | null
  alCambiar: () => void
}) {
  // Abierto el del mes que corre: es por el que preguntan. Los demás se
  // despliegan picándolos, para que doce meses no den una lista imposible.
  const [abierto, setAbierto] = useState(mes.esElDeHoy)

  const total = mes.cargos.reduce((s, c) => s + c.montoNeto, 0)
  const pagado = mes.cargos.reduce((s, c) => s + c.pagado, 0)
  const falta = Math.max(0, total - pagado)

  return (
    <div className={`mes${mes.esElDeHoy ? ' mes-de-hoy' : ''}`}>
      <button type="button" className="mes-encabezado" onClick={() => setAbierto((a) => !a)}>
        <span className="mes-nombre">
          {nombreMes(mes.mes)}
          {mes.esElDeHoy && <span className="mes-marca">este mes</span>}
        </span>

        {mes.cargos.length === 0 ? (
          <span className="silencio">Sin cargo todavía</span>
        ) : falta === 0 ? (
          <span className="insignia VERDE">Al corriente</span>
        ) : (
          <span className="mes-falta">Falta {pesos(falta)}</span>
        )}

        <span className={`mes-flecha${abierto ? ' abierta' : ''}`} aria-hidden>
          <svg width="12" height="8" viewBox="0 0 12 8" fill="none" stroke="currentColor"
            strokeWidth="1.8" strokeLinecap="round">
            <path d="M1 1.5 6 6.5 11 1.5" />
          </svg>
        </span>
      </button>

      {abierto && (
        <div className="mes-cuerpo">
          {mes.cargos.length === 0 ? (
            <Adelantar
              inscripcionId={inscripcionId}
              mes={mes}
              conDescuento={mes.conDescuento}
              nombreDescuento={nombreDescuento}
              alCambiar={alCambiar}
            />
          ) : (
            mes.cargos.map((c) => (
              <BloqueCargo
                key={c.id} cargo={c} metodos={metodos}
                bloqueadoPor={mes.bloqueadoPor}
                nombreDescuento={nombreDescuento} alCambiar={alCambiar}
              />
            ))
          )}
        </div>
      )}
    </div>
  )
}

// --------------------------------------------------- pagar adelantado

/**
 * Un mes que todavía no tiene cargo.
 *
 * Se puede crear desde aquí para dejarlo pagado por adelantado. Es lo que
 * pide quien viene a pagar el año de un jalón, o quien se va de viaje y no
 * va a estar el mes que entra.
 */
function Adelantar({
  inscripcionId,
  mes,
  conDescuento,
  nombreDescuento,
  alCambiar,
}: {
  inscripcionId: string
  mes: Mes
  conDescuento: boolean
  nombreDescuento: string | null
  alCambiar: () => void
}) {
  const [aviso, accion, enviando] = useActionState(adelantarMes, null)

  useEffect(() => {
    if (aviso?.ok) alCambiar()
  }, [aviso, alCambiar])

  // Los meses se pagan en orden: no se adelanta diciembre debiendo octubre.
  if (mes.bloqueadoPor !== null) {
    return (
      <p className="en-espera">
        {nombreMes(mes.mes)} se abre cuando quede saldado{' '}
        <strong>{nombreMes(mes.bloqueadoPor)}</strong>. Los meses se pagan en orden.
      </p>
    )
  }

  return (
    <form action={accion} className="adelantar">
      <input type="hidden" name="inscripcionId" value={inscripcionId} />
      <input type="hidden" name="periodoId" value={mes.periodoId} />

      <p className="silencio" style={{ fontSize: '.85rem', margin: 0 }}>
        El cargo de {nombreMes(mes.mes)} nace solo cuando corre la cobranza del mes. Si va a
        pagarlo desde ahora, créalo aquí.
        {nombreDescuento && (
          conDescuento
            ? ` Se le aplica ${nombreDescuento}.`
            : ` Ese mes ya no alcanza su ${nombreDescuento}: se cobra completo.`
        )}
      </p>

      <div className="fila" style={{ justifyContent: 'flex-end', marginTop: '.6rem' }}>
        <button className="boton" type="submit" disabled={enviando}>
          {enviando ? 'Creando…' : `Cobrar ${nombreMes(mes.mes)} por adelantado`}
        </button>
      </div>

      <Alerta resultado={enviando ? null : aviso} />
    </form>
  )
}

// ----------------------------------------------------------- un cargo

function BloqueCargo({
  cargo,
  metodos,
  bloqueadoPor,
  nombreDescuento,
  alCambiar,
}: {
  cargo: Cargo
  metodos: Metodo[]
  /** El mes anterior que falta saldar, si es que hay uno. */
  bloqueadoPor: number | null
  nombreDescuento: string | null
  alCambiar: () => void
}) {
  const [cobrando, setCobrando] = useState(false)
  const falta = Math.max(0, cargo.montoNeto - cargo.pagado)

  return (
    <div className="bloque-cargo">
      <div className="fila" style={{ justifyContent: 'space-between', alignItems: 'baseline' }}>
        <strong>{cargo.curso}</strong>
        <span className={`insignia ${cargo.color}`}>{cargo.estado}</span>
      </div>

      <dl className="desglose">
        <div><dt>Mensualidad</dt><dd>{pesos(cargo.montoMensualidad)}</dd></div>
        {cargo.montoLockers > 0 && <div><dt>Locker</dt><dd>{pesos(cargo.montoLockers)}</dd></div>}
        {cargo.montoDescuento > 0 && (
          <div className="renglon-descuento">
            {/* Con el nombre y no solo "Descuento": el que pregunta por qué
                paga menos merece la respuesta en el mismo renglón. */}
            <dt>{nombreDescuento ?? 'Descuento'}</dt>
            <dd>−{pesos(cargo.montoDescuento)}</dd>
          </div>
        )}
        {cargo.montoRecargo > 0 && <div><dt>Recargo</dt><dd>{pesos(cargo.montoRecargo)}</dd></div>}
        <div className="total"><dt>Total</dt><dd>{pesos(cargo.montoNeto)}</dd></div>
        <div><dt>Pagado</dt><dd>{pesos(cargo.pagado)}</dd></div>
        <div className={falta > 0 ? 'falta' : undefined}>
          <dt>Falta</dt><dd>{pesos(falta)}</dd>
        </div>
      </dl>

      {/* Se enseña aunque falte, para que se sepa que se puede pedir. Con el
          cargo ya cubierto no estorba. */}
      {(cargo.comprobante || !cargo.cubierto) && <ComprobanteDelAlumno cargo={cargo} />}

      {cargo.pagos.length === 0 ? (
        <p className="silencio" style={{ fontSize: '.85rem' }}>Sin pagos todavía.</p>
      ) : (
        cargo.pagos.map((p) => (
          <RenglonPago key={p.id} pago={p} cargo={cargo} metodos={metodos} alCambiar={alCambiar} />
        ))
      )}

      {cobrando ? (
        <HojaDePago
          cargo={cargo}
          metodos={metodos}
          falta={falta}
          cancelar={() => setCobrando(false)}
          alCambiar={() => { setCobrando(false); alCambiar() }}
        />
      ) : cargo.cubierto ? null : bloqueadoPor !== null ? (
        /* No se cobra un mes saltándose otro: un alumno con huecos a media
           temporada se vuelve imposible de explicar en el mostrador. */
        <p className="en-espera">
          Primero hay que saldar <strong>{nombreMes(bloqueadoPor)}</strong>. Los meses se
          pagan en orden.
        </p>
      ) : (
        <div className="fila" style={{ justifyContent: 'flex-end' }}>
          <button
            type="button" className="boton" onClick={() => setCobrando(true)}
            style={{ padding: '.35rem .8rem' }}
          >
            Pagado
          </button>
        </div>
      )}
    </div>
  )
}

// ------------------------------------- el comprobante que subió él

/**
 * Lo que el alumno subió desde su página, o el hueco donde debería estar.
 *
 * Se enseña tenga archivo o no. No se exige para cobrar —quien paga en la
 * ventanilla entrega el dinero en la mano y no tiene nada que subir— pero
 * cuando está, es lo que deja comparar el ticket con lo que falta antes de
 * dar el cargo por pagado.
 *
 * La miniatura va de verdad y no un enlace seco: comparar el monto del
 * ticket con lo que falta es todo el trabajo, y abrir una pestaña para eso
 * sobra.
 */
function ComprobanteDelAlumno({ cargo }: { cargo: Cargo }) {
  if (!cargo.comprobante) {
    return (
      <div className="comprobante vacio">
        <span className="comprobante-hueco" aria-hidden>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 2H7a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7z" />
            <polyline points="14 2 14 7 19 7" />
          </svg>
        </span>
        <span className="comprobante-texto">
          <strong>Sin comprobante</strong>
          <span className="silencio">
            Si lo sube desde su código QR aparece aquí. No hace falta para cobrar.
          </span>
        </span>
      </div>
    )
  }

  const url = `/panel/alumnos/comprobante/${cargo.id}`
  const esImagen = cargo.comprobante.tipo?.startsWith('image/') ?? false

  return (
    <a className="comprobante" href={url} target="_blank" rel="noreferrer">
      {esImagen ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="Comprobante que subió el alumno" />
      ) : (
        <span className="comprobante-pdf">PDF</span>
      )}
      <span className="comprobante-texto">
        <strong>Comprobante del alumno</strong>
        {cargo.comprobante.subidoEn && (
          <span className="silencio">
            Lo subió el {fechaLarga(new Date(cargo.comprobante.subidoEn))}
          </span>
        )}
      </span>
      <span className="comprobante-ver" aria-hidden>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
          <polyline points="15 3 21 3 21 9" />
          <line x1="10" y1="14" x2="21" y2="3" />
        </svg>
      </span>
    </a>
  )
}

// ----------------------------------------------------------- un pago

/**
 * Un cobro ya registrado.
 *
 * No se borra: eso no está permitido. Y solo se corrige mientras al cargo le
 * falte dinero — uno ya cubierto está cerrado, y reabrirlo desde aquí
 * dejaría el corte del mes moviéndose después de cuadrado.
 */
function RenglonPago({
  pago,
  cargo,
  metodos,
  alCambiar,
}: {
  pago: Pago
  cargo: Cargo
  metodos: Metodo[]
  alCambiar: () => void
}) {
  const [editando, setEditando] = useState(false)

  if (editando) {
    return (
      <HojaDePago
        cargo={cargo}
        pago={pago}
        metodos={metodos}
        falta={Math.max(0, cargo.montoNeto - cargo.pagado)}
        cancelar={() => setEditando(false)}
        alCambiar={() => { setEditando(false); alCambiar() }}
      />
    )
  }

  return (
    <div className="renglon-pago">
      <div style={{ flex: 1, minWidth: 0 }}>
        <strong>{pesos(pago.montoCobrado)}</strong>{' '}
        <span className="silencio">· {pago.etiquetaMetodo}</span>
        <br />
        <span className="silencio" style={{ fontSize: '.78rem' }}>
          {fechaLarga(new Date(pago.fechaPago))}
          {pago.referencia && ` · ref. ${pago.referencia}`}
          {/* Quién responde por este cobro. Si no lo marcó nadie es porque
              entró solo por internet, y eso también hay que poder leerlo. */}
          {pago.registradoPor
            ? ` · lo marcó ${pago.registradoPor}`
            : pago.enLinea
              ? ' · pagado en línea'
              : ''}
          {pago.estado !== 'CONFIRMADO' && ` · ${pago.estado.toLowerCase().replace('_', ' ')}`}
        </span>
      </div>

      {pago.editable ? (
        <button
          type="button" className="boton tenue" onClick={() => setEditando(true)}
          style={{ padding: '.25rem .6rem', fontSize: '.8rem' }}
        >
          Editar
        </button>
      ) : (
        <span
          className="silencio candado"
          title={
            cargo.cubierto
              ? 'El cargo ya quedó cubierto'
              : 'Lo comprobó la pasarela y se corrige desde Stripe'
          }
        >
          {cargo.cubierto ? 'cerrado' : 'no se edita'}
        </span>
      )}
    </div>
  )
}

// ------------------------------------------------------ cobrar el mes

/**
 * Dar por pagado un cargo, o corregir con qué se pagó.
 *
 * No pregunta cuánto: se cobra lo que falta, que ya está impreso arriba.
 * Teclear una cantidad que el sistema ya sabe solo abre la puerta a que un
 * dedo torcido deje un cargo saldado con un peso, y eso no se nota hasta el
 * corte del mes.
 *
 * Lo único obligatorio es la forma de pago: de ahí sale el dato que pide el
 * CFDI. La referencia aparece solo donde hay un folio que copiar —el ticket
 * de la ventanilla y el del OXXO— y el comprobante es del alumno, opcional.
 */
function HojaDePago({
  cargo,
  pago,
  metodos,
  falta,
  cancelar,
  alCambiar,
}: {
  cargo: Cargo
  pago?: Pago
  metodos: Metodo[]
  falta: number
  cancelar: () => void
  alCambiar: () => void
}) {
  const [aviso, accion, enviando] = useActionState(pago ? corregirPago : marcarPagado, null)
  const [metodo, setMetodo] = useState<string>(pago?.metodo ?? metodos[0]?.valor ?? '')
  const marca = pago?.id ?? cargo.id

  const escogido = metodos.find((m) => m.valor === metodo)

  useEffect(() => {
    if (aviso?.ok) alCambiar()
  }, [aviso, alCambiar])

  return (
    <form action={accion} className="hoja-pago">
      <div className="hoja-pago-encabezado">
        <span>{pago ? 'Corregir la forma de pago' : 'Marcar como pagado'}</span>
        <button
          type="button" className="hoja-pago-cerrar" onClick={cancelar}
          disabled={enviando} aria-label="Cancelar"
        >
          <IconoCerrar tamano={14} />
        </button>
      </div>

      {pago
        ? <input type="hidden" name="pagoId" value={pago.id} />
        : <input type="hidden" name="cargoId" value={cargo.id} />}

      <div className="hoja-pago-cuerpo">
        {!pago && (
          /* La cantidad se enseña, no se teclea: es la que el alumno tiene
             que entregar, ni un peso más ni uno menos. */
          <div className="monto-fijo">
            <span className="silencio">Se registra el total que falta</span>
            <strong>{pesos(falta)}</strong>
          </div>
        )}

        <div className="campo">
          {/* El asterisco lo dibuja solo la regla de `.obligatorio`: una
              marca escrita a mano se queda pegada el día que el campo deje
              de serlo, y entonces miente. */}
          <label>Forma de pago</label>
          <Selector
            nombre="metodo"
            etiqueta="Forma de pago"
            opciones={metodos.map((m) => ({ valor: m.valor, etiqueta: m.etiqueta }))}
            valor={metodo}
            requerido
            deshabilitado={enviando}
            alCambiar={setMetodo}
          />
        </div>

        {escogido?.pideReferencia && (
          <div className="campo" style={{ marginTop: '.7rem' }}>
            <label htmlFor={`ref-${marca}`}>
              Referencia{' '}
              <span className="silencio" style={{ fontWeight: 400 }}>(opcional)</span>
            </label>
            <input
              id={`ref-${marca}`} name="referencia" disabled={enviando}
              defaultValue={pago?.referencia ?? ''}
              placeholder="Folio del ticket"
            />
          </div>
        )}

      </div>

      <div className="hoja-pago-pie">
        <button className="boton" type="submit" disabled={enviando}>
          {enviando
            ? 'Guardando…'
            : pago
              ? 'Guardar el cambio'
              : `Marcar pagado · ${pesos(falta)}`}
        </button>
        <button type="button" className="boton tenue" onClick={cancelar} disabled={enviando}>
          Cerrar
        </button>
      </div>

      <Alerta resultado={enviando ? null : aviso} />
    </form>
  )
}
