'use client'

import { useActionState, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  apartarParaAlumno, apartarParaProfesor, liberar, crearLocker, quitarLocker,
} from './acciones'
import Selector from '@/components/Selector'
import Alerta from '@/components/Alerta'
import BotonConfirmar from '@/components/BotonConfirmar'
import { IconoCerrar, IconoGuardar } from '@/components/Iconos'

export type Casillero = {
  id: string
  numero: number
  activo: boolean
  /** Quién lo tiene. Libre cuando no lo tiene nadie. */
  ocupa:
    | { quien: 'alumno'; nombre: string; folio: string }
    | { quien: 'profesor'; nombre: string }
    | null
}

/**
 * Los lockers de la alberca, uno por tarjeta.
 *
 * En tarjetas y no en tabla porque así se ven como están en la pared: de un
 * vistazo se sabe cuántos quedan libres, que es la pregunta que llega al
 * mostrador. La tabla obligaba a recorrer sesenta renglones para contar.
 */
export default function TarjetasLockers({
  lockers,
  profesores,
  periodoId,
  precio,
}: {
  lockers: Casillero[]
  profesores: Array<{ id: string; nombre: string }>
  periodoId: string
  /** Lo que cuesta al mes, ya escrito. El del profesor no se cobra. */
  precio: string
}) {
  const [abierto, setAbierto] = useState<Casillero | null>(null)
  const [creando, setCreando] = useState(false)

  return (
    <>
      <div className="barra-tabla">
        <span className="silencio" style={{ fontSize: '.85rem', alignSelf: 'center' }}>
          Toca un locker para asignarlo o liberarlo.
        </span>
        {/* A la derecha, separado de la explicación: es lo único que se
            hace desde aquí y no desde una tarjeta. */}
        <button
          type="button" className="boton con-icono" onClick={() => setCreando(true)}
          style={{ marginLeft: 'auto' }}
        >
          <IconoGuardar />
          Agregar un locker
        </button>
      </div>

      <div className="rejilla-lockers">
        {lockers.map((l) => (
          <button
            key={l.id}
            type="button"
            className={`locker ${estadoDe(l)}`}
            onClick={() => setAbierto(l)}
            title={l.ocupa ? `${l.numero} · ${l.ocupa.nombre}` : `${l.numero} · libre`}
          >
            <span className="locker-numero">{l.numero}</span>
            <span className="locker-quien">
              {!l.activo ? 'fuera de uso' : !l.ocupa ? 'libre' : l.ocupa.nombre}
            </span>
          </button>
        ))}

        {lockers.length === 0 && (
          <p className="silencio">Todavía no hay ningún locker capturado.</p>
        )}
      </div>

      {abierto && (
        <VentanaLocker
          locker={abierto}
          profesores={profesores}
          periodoId={periodoId}
          precio={precio}
          cerrar={() => setAbierto(null)}
        />
      )}

      {creando && (
        <VentanaAlta
          profesores={profesores}
          periodoId={periodoId}
          cerrar={() => setCreando(false)}
        />
      )}
    </>
  )
}

const estadoDe = (l: Casillero) =>
  !l.activo ? 'apagado' : !l.ocupa ? 'libre' : l.ocupa.quien === 'profesor' ? 'profesor' : 'alumno'

// ------------------------------------------------------- asignar o soltar

function VentanaLocker({
  locker,
  profesores,
  periodoId,
  precio,
  cerrar,
}: {
  locker: Casillero
  profesores: Array<{ id: string; nombre: string }>
  periodoId: string
  precio: string
  cerrar: () => void
}) {
  const [avisoAlumno, darAlumno, dandoAlumno] = useActionState(apartarParaAlumno, null)
  const [avisoProfesor, darProfesor, dandoProfesor] = useActionState(apartarParaProfesor, null)
  const [avisoLibre, soltar, soltando] = useActionState(liberar, null)
  const [avisoQuitar, quitar, quitando] = useActionState(quitarLocker, null)

  const ocupado = dandoAlumno || dandoProfesor || soltando || quitando
  const aviso = ocupado ? null : (avisoAlumno ?? avisoProfesor ?? avisoLibre ?? avisoQuitar)

  // Al terminar bien, la pantalla ya se refrescó: se cierra sola.
  useEffect(() => {
    if (aviso?.ok) cerrar()
  }, [aviso, cerrar])

  return (
    <Ventana titulo={`Locker ${locker.numero}`} cerrar={cerrar}>
      {locker.ocupa ? (
        <>
          <p className="silencio" style={{ marginTop: 0 }}>
            Lo tiene <strong>{locker.ocupa.nombre}</strong>
            {locker.ocupa.quien === 'alumno'
              ? <> · alumno con folio {locker.ocupa.folio}, este mes</>
              : <> · profesor, sin costo y hasta que lo liberen</>}
          </p>

          <form action={soltar} className="fila" style={{ justifyContent: 'flex-end' }}>
            <input type="hidden" name="lockerId" value={locker.id} />
            <input type="hidden" name="periodoId" value={periodoId} />
            <BotonConfirmar
              titulo={`¿Liberar el locker ${locker.numero}?`}
              detalle={
                locker.ocupa.quien === 'alumno'
                  ? `Deja de ser de ${locker.ocupa.nombre} este mes y se le quita el cobro, salvo que ya lo haya pagado.`
                  : `Deja de estar apartado para ${locker.ocupa.nombre} y cualquiera puede ocuparlo.`
              }
              confirmar="Sí, liberar"
              deshabilitado={ocupado}
            >
              {soltando ? 'Liberando…' : 'Liberar'}
            </BotonConfirmar>

            <button type="button" className="boton tenue" onClick={cerrar} disabled={ocupado}>
              Cerrar
            </button>
          </form>
        </>
      ) : (
        <>
          <form action={darAlumno} className="fila" style={{ alignItems: 'flex-end' }}>
            <input type="hidden" name="lockerId" value={locker.id} />
            <input type="hidden" name="periodoId" value={periodoId} />
            <div style={{ flex: '1 1 190px' }}>
              <label htmlFor={`folio-${locker.id}`}>Folio del alumno</label>
              <input
                id={`folio-${locker.id}`} name="folio" required disabled={ocupado}
                placeholder="CR2026ABCD1234"
                style={{ textTransform: 'uppercase', fontFamily: 'ui-monospace, monospace' }}
              />
            </div>
            <button className="boton" type="submit" disabled={ocupado}>
              {dandoAlumno ? 'Asignando…' : 'Asignar'}
            </button>
          </form>
          <p className="silencio" style={{ fontSize: '.8rem', marginTop: '.35rem' }}>
            Se le cobra {precio} al mes, junto con su mensualidad.
          </p>

          <hr className="raya-o" data-texto="o" />

          <form action={darProfesor} className="fila" style={{ alignItems: 'flex-end' }}>
            <input type="hidden" name="lockerId" value={locker.id} />
            <input type="hidden" name="periodoId" value={periodoId} />
            <div style={{ flex: '1 1 190px' }}>
              <label>Profesor</label>
              <Selector
                nombre="usuarioId"
                etiqueta="Profesor"
                placeholder="Escoge…"
                valor=""
                deshabilitado={ocupado || profesores.length === 0}
                opciones={[
                  { valor: '', etiqueta: 'Escoge…' },
                  ...profesores.map((p) => ({ valor: p.id, etiqueta: p.nombre })),
                ]}
              />
            </div>
            <button className="boton tenue" type="submit" disabled={ocupado}>
              {dandoProfesor ? 'Apartando…' : 'Apartar'}
            </button>
          </form>
          <p className="silencio" style={{ fontSize: '.8rem', marginTop: '.35rem' }}>
            Sin costo, y se queda apartado hasta que lo liberen.
          </p>

          <hr className="raya-o" data-texto="o" />

          <form action={quitar} className="fila" style={{ justifyContent: 'flex-end' }}>
            <input type="hidden" name="lockerId" value={locker.id} />
            <BotonConfirmar
              titulo={`¿Eliminar el locker ${locker.numero}?`}
              detalle={
                <>
                  Desaparece de la lista y deja de ofrecerse. Si alguien ya lo ocupó
                  alguna vez, no se borra: queda fuera de uso y se conserva el
                  registro de quién lo tuvo y qué se le cobró.
                </>
              }
              deshabilitado={ocupado}
            >
              {quitando ? 'Eliminando…' : 'Eliminar el locker'}
            </BotonConfirmar>

            <button type="button" className="boton tenue" onClick={cerrar} disabled={ocupado}>
              Cerrar
            </button>
          </form>
        </>
      )}

      <Alerta resultado={aviso} />
    </Ventana>
  )
}

// --------------------------------------------------------- agregar uno

function VentanaAlta({
  profesores,
  periodoId,
  cerrar,
}: {
  profesores: Array<{ id: string; nombre: string }>
  periodoId: string
  cerrar: () => void
}) {
  const [aviso, accion, enviando] = useActionState(crearLocker, null)

  useEffect(() => {
    if (aviso?.ok) cerrar()
  }, [aviso, cerrar])

  return (
    <Ventana titulo="Agregar un locker" cerrar={cerrar}>
      <form action={accion}>
        <input type="hidden" name="periodoId" value={periodoId} />

        <div style={{ maxWidth: '9rem' }}>
          <label htmlFor="numero-locker">Número</label>
          <input
            id="numero-locker" name="numero" type="number" min={1} step={1}
            required disabled={enviando} placeholder="61"
          />
        </div>
        <p className="silencio" style={{ fontSize: '.8rem', marginTop: '.35rem' }}>
          Si ese número existió y lo quitaron, vuelve a la lista con su historial.
        </p>

        {/* Quién lo va a usar: opcional en los dos casos. Casi siempre se
            dan de alta vacíos, pero cuando alguien ya está esperando ese
            locker, obligarlo a crearlo y después buscarlo entre sesenta
            tarjetas es una vuelta de más. */}
        <hr className="raya-o" data-texto="¿quién lo va a usar? (opcional)" />

        <div className="fila" style={{ alignItems: 'flex-end' }}>
          <div style={{ flex: '1 1 190px' }}>
            <label htmlFor="folio-nuevo">Folio del alumno</label>
            <input
              id="folio-nuevo" name="folio" disabled={enviando}
              placeholder="CR2026ABCD1234"
              style={{ textTransform: 'uppercase', fontFamily: 'ui-monospace, monospace' }}
            />
          </div>

          <div style={{ flex: '1 1 190px' }}>
            <label>Profesor</label>
            <Selector
              nombre="usuarioId"
              etiqueta="Profesor"
              placeholder="Ninguno"
              valor=""
              deshabilitado={enviando || profesores.length === 0}
              opciones={[
                { valor: '', etiqueta: 'Ninguno' },
                ...profesores.map((p) => ({ valor: p.id, etiqueta: p.nombre })),
              ]}
            />
          </div>
        </div>
        <p className="silencio" style={{ fontSize: '.8rem', marginTop: '.35rem' }}>
          Uno de los dos, no los dos. Al alumno se le cobra; al profesor no.
        </p>

        <div className="fila" style={{ justifyContent: 'flex-end', marginTop: '1.1rem' }}>
          <button className="boton" type="submit" disabled={enviando}>
            {enviando ? 'Agregando…' : 'Agregar'}
          </button>
          <button type="button" className="boton tenue" onClick={cerrar} disabled={enviando}>
            Cerrar
          </button>
        </div>
      </form>

      <Alerta resultado={enviando ? null : aviso} />
    </Ventana>
  )
}

// ------------------------------------------------------------ la ventana

function Ventana({
  titulo,
  cerrar,
  children,
}: {
  titulo: string
  cerrar: () => void
  children: React.ReactNode
}) {
  useEffect(() => {
    const alTeclear = (e: KeyboardEvent) => { if (e.key === 'Escape') cerrar() }
    document.addEventListener('keydown', alTeclear)
    return () => document.removeEventListener('keydown', alTeclear)
  }, [cerrar])

  return createPortal(
    <div className="telon-modal" onClick={cerrar}>
      <div
        className="modal modal-locker" role="dialog" aria-modal="true" aria-label={titulo}
        onClick={(e) => e.stopPropagation()}
      >
        <button type="button" className="modal-cerrar" onClick={cerrar} aria-label="Cerrar">
          <IconoCerrar tamano={18} />
        </button>
        <h2>{titulo}</h2>
        {children}
      </div>
    </div>,
    document.body,
  )
}
