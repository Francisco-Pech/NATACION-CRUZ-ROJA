'use client'

import { useCallback, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { obtenerFactura } from './factura-acciones'
import { IconoCerrar, IconoAbrir, IconoBajar } from '@/components/Iconos'
import { pesos, nombreMes, fechaLarga } from '@/lib/formato'

type Datos = NonNullable<Awaited<ReturnType<typeof obtenerFactura>>>

/**
 * Los datos de facturación de un alumno y con qué pagó.
 *
 * Es informativo: aquí no se expide nada ni se sabe si la factura se mandó.
 * Sirve para que quien va a timbrar tenga en una sola ventana las dos cosas
 * que el CFDI pide y que hoy viven separadas: los datos fiscales, que están
 * en el alumno, y la forma de pago real, que está en cada pago. No es lo
 * mismo timbrar un efectivo que una transferencia, y equivocarse obliga a
 * cancelar y reexpedir.
 */
export default function ModalFactura({ id, requiere }: { id: string; requiere: boolean }) {
  const [abierto, setAbierto] = useState(false)

  // La misma máquina de estados del modal de meses: guardar la fase y no
  // solo los datos evita que una respuesta vacía vuelva a pedirlos para
  // siempre.
  const [busca, setBusca] = useState<
    { fase: 'quieto' | 'buscando' | 'vacio' | 'falla' } | { fase: 'listo'; datos: Datos }
  >({ fase: 'quieto' })

  const traer = useCallback(() => {
    setBusca({ fase: 'buscando' })
    obtenerFactura(id)
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

  // Sin factura no hay nada que abrir: ni datos fiscales, ni constancia, ni
  // formas de pago que timbrar. Un botón que abre una ventana vacía enseña a
  // desconfiar de los botones.
  if (!requiere) {
    return <span className="insignia GRIS">No factura</span>
  }

  return (
    <>
      <button type="button" className="insignia-boton" onClick={() => setAbierto(true)}>
        <span className="insignia VERDE">Sí factura</span>
      </button>

      {abierto &&
        createPortal(
          <div className="telon-modal" onClick={() => setAbierto(false)}>
            <div
              className="modal modal-mes" role="dialog" aria-modal="true"
              aria-label="Datos de facturación" onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button" className="modal-cerrar" onClick={() => setAbierto(false)}
                aria-label="Cerrar"
              >
                <IconoCerrar tamano={18} />
              </button>

              {busca.fase === 'falla' ? (
                <>
                  <h2>Factura</h2>
                  <p className="error">No se pudieron traer. Vuelve a intentarlo.</p>
                  <div className="fila" style={{ justifyContent: 'flex-end' }}>
                    <button type="button" className="boton" onClick={traer}>Reintentar</button>
                  </div>
                </>
              ) : busca.fase === 'vacio' ? (
                <>
                  <h2>Factura</h2>
                  <p className="aviso">Esa inscripción ya no existe.</p>
                </>
              ) : busca.fase !== 'listo' ? (
                <p className="silencio" style={{ textAlign: 'center', padding: '2rem 0' }}>
                  <span className="girando" /> Buscando…
                </p>
              ) : (
                <Contenido datos={busca.datos} id={id} />
              )}
            </div>
          </div>,
          document.body,
        )}
    </>
  )
}

function Contenido({ datos, id }: { datos: Datos; id: string }) {
  const d = datos.datos
  const faltan = [
    !d.rfc && 'el RFC',
    !d.razonSocial && 'la razón social',
    !d.codigoPostal && 'el código postal',
    !d.regimenClave && 'el régimen fiscal',
  ].filter(Boolean) as string[]

  return (
    <>
      <h2 style={{ marginBottom: '.2rem' }}>Factura {datos.anio}</h2>
      <p className="silencio" style={{ marginTop: 0 }}>
        {datos.alumno} ·{' '}
        <span style={{ fontFamily: 'ui-monospace, monospace' }}>{datos.folio}</span>
      </p>

      {faltan.length > 0 && (
        <p className="error">
          No se le puede timbrar todavía: falta {faltan.join(', ').replace(/, ([^,]*)$/, ' y $1')}.
          Él mismo los completa desde su código QR, o se capturan al editarlo.
        </p>
      )}

      {/* Los datos fiscales tal como los pide el CFDI, no repartidos entre
          renglones sueltos: quien va a timbrar los copia de aquí. */}
      <h3 className="titulo-seccion">Datos fiscales</h3>
      <dl className="ficha">
        <div><dt>RFC</dt><dd className="mono">{d.rfc ?? '—'}</dd></div>
        <div><dt>Razón social</dt><dd>{d.razonSocial ?? '—'}</dd></div>
        <div><dt>Código postal</dt><dd className="mono">{d.codigoPostal ?? '—'}</dd></div>
        <div>
          <dt>Régimen fiscal</dt>
          <dd>{d.regimenClave ? `${d.regimenClave} · ${d.regimenNombre ?? ''}` : '—'}</dd>
        </div>
        <div><dt>Uso del CFDI</dt><dd>{d.usoCfdi}</dd></div>
        <div>
          <dt>Correo electrónico</dt>
          <dd>{d.correo ?? <span className="silencio">Sin capturar</span>}</dd>
        </div>
      </dl>

      {/* La constancia en su propio bloque y no como un enlace perdido en
          una lista: es el papel que se abre para cotejar el RFC antes de
          timbrar, y el que se guarda en la carpeta del mes. */}
      <h3 className="titulo-seccion">Constancia de situación fiscal</h3>
      {datos.constancia ? (
        <div className="constancia">
          <span className="constancia-icono" aria-hidden>PDF</span>
          <span className="constancia-datos">
            <strong>{datos.constancia.nombre ?? 'constancia.pdf'}</strong>
            {datos.constancia.subidaEn && (
              <span className="silencio">
                La subió el {fechaLarga(new Date(datos.constancia.subidaEn))}
              </span>
            )}
          </span>
          {/* Íconos y no palabras: son dos acciones que se repiten en cada
              alumno y el dibujo se reconoce antes de leerse. El nombre va en
              `aria-label` y en `title`, que es lo que oye un lector de
              pantalla y lo que sale al dejar el cursor encima. */}
          <span className="constancia-acciones">
            <a
              className="boton tenue solo-icono"
              href={`/panel/alumnos/${id}/constancia`}
              target="_blank" rel="noreferrer"
              aria-label="Ver la constancia" title="Ver la constancia"
            >
              <IconoAbrir tamano={17} />
            </a>
            <a
              className="boton tenue solo-icono"
              href={`/panel/alumnos/${id}/constancia?descargar`}
              aria-label="Bajar la constancia" title="Bajar la constancia"
            >
              <IconoBajar tamano={17} />
            </a>
          </span>
        </div>
      ) : (
        <div className="constancia vacia">
          <span className="constancia-icono" aria-hidden>PDF</span>
          <span className="constancia-datos">
            <strong>Todavía no la trae</strong>
            <span className="silencio">
              Es el PDF que descarga del SAT. Se agrega al editarlo, y no impide cobrarle.
            </span>
          </span>
        </div>
      )}

      {/* El dinero como de verdad entró. La factura es mensual, pero el
          cobro no siempre: tres meses adelantados son un solo movimiento, y
          eso es lo que se timbra. */}
      <h3 className="titulo-seccion">Cobros recibidos</h3>
      {datos.cobros.length === 0 ? (
        <p className="silencio" style={{ fontSize: '.87rem' }}>Todavía no se le ha cobrado nada.</p>
      ) : (
        datos.cobros.map((c, n) => <Cobro key={n} cobro={c} />)
      )}

      {datos.sinCobrar.length > 0 && (
        <p className="silencio" style={{ fontSize: '.85rem' }}>
          Sin cobrar todavía:{' '}
          {datos.sinCobrar.map((m) => nombreMes(m.mes)).join(', ')} ·{' '}
          {pesos(datos.sinCobrar.reduce((s, m) => s + m.montoNeto, 0))}. No se timbra lo que
          no ha entrado.
        </p>
      )}

      <p className="silencio" style={{ fontSize: '.8rem' }}>
        Solo salen los pagos confirmados: uno en revisión todavía puede rechazarse, y timbrar
        sobre dinero que no entró obliga a cancelar el CFDI después. Esta ventana no expide
        nada — junta lo que hace falta para hacerlo.
      </p>
    </>
  )
}

/**
 * Un cobro: el movimiento de dinero tal como ocurrió.
 *
 * Lo primero es la forma de pago y el total, que es lo que pide el CFDI.
 * Debajo, qué meses quedaron cubiertos y de qué se compone: la clase y la
 * renta del locker son dos conceptos distintos en la factura, y sumarlos en
 * un renglón obligaría a desglosarlos a mano después.
 */
function Cobro({ cobro }: { cobro: Datos['cobros'][number] }) {
  const meses = cobro.meses.map(nombreMes)
  const comoSeLee =
    meses.length === 1 ? meses[0] : `${meses.slice(0, -1).join(', ')} y ${meses.at(-1)}`

  return (
    <div className="cobro">
      <div className="cobro-encabezado">
        <strong>{cobro.etiquetaMetodo}</strong>
        <span className="cobro-total mono">{pesos(cobro.total)}</span>
      </div>

      <p className="silencio cobro-cuando">
        {fechaLarga(new Date(cobro.fechaPago))}
        {cobro.referencia && ` · ref. ${cobro.referencia}`}
      </p>

      <p className="cobro-meses">
        {meses.length === 1 ? 'Cubre ' : `Cubre ${meses.length} meses: `}
        <strong>{comoSeLee}</strong>
      </p>

      <dl className="desglose">
        <div><dt>Mensualidad</dt><dd>{pesos(cobro.mensualidad)}</dd></div>
        {cobro.lockers > 0 && <div><dt>Locker</dt><dd>{pesos(cobro.lockers)}</dd></div>}
        {cobro.descuento > 0 && (
          <div className="renglon-descuento"><dt>Descuento</dt><dd>−{pesos(cobro.descuento)}</dd></div>
        )}
        {cobro.recargo > 0 && <div><dt>Recargo</dt><dd>{pesos(cobro.recargo)}</dd></div>}
      </dl>
    </div>
  )
}
