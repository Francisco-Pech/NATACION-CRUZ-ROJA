'use client'

import { useActionState, useCallback, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { obtenerAlumno, editarAlumno } from './acciones'
import Alerta from '@/components/Alerta'
import Selector from '@/components/Selector'
import CampoFecha from '@/components/CampoFecha'
import CampoArchivo from '@/components/CampoArchivo'
import { IconoCerrar } from '@/components/Iconos'
import { REGIMENES_FISCALES, USO_CFDI } from '@/lib/facturacion'

type Datos = NonNullable<Awaited<ReturnType<typeof obtenerAlumno>>>

/**
 * Editar a un alumno sin salir de la lista.
 *
 * Cambia su nombre, el descuento que lleva con su vigencia, y si factura y
 * con qué datos. Administrador y Root pueden además moverlo de curso y de
 * horario: eso rehace los meses que todavía debe con el precio nuevo, y por
 * eso no lo hace cualquiera. Lo que ya pagó no se toca nunca.
 *
 * El locker no se toca aquí: tiene su propia pantalla, donde además se ve
 * cuál está libre.
 *
 * Los datos se piden al abrir y no con la lista: son ocho campos por alumno
 * que casi nunca se miran, y traerlos para cien renglones sería cargar
 * noventa y nueve fichas que nadie abrió.
 */
export default function ModalEditar({
  id,
  descuentos,
  grupos,
}: {
  id: string
  descuentos: Array<{ hash: string; nombre: string }>
  /** Los cursos y horarios abiertos, para poder moverlo de grupo. */
  grupos: Array<{ clave: string; cursoNombre: string; horario: string; dias: string }>
}) {
  const [abierto, setAbierto] = useState(false)

  const [busca, setBusca] = useState<
    { fase: 'quieto' | 'buscando' | 'vacio' | 'falla' } | { fase: 'listo'; datos: Datos }
  >({ fase: 'quieto' })

  const traer = useCallback(() => {
    setBusca({ fase: 'buscando' })
    obtenerAlumno(id)
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
      <button
        type="button" className="boton tenue" style={{ padding: '.3rem .7rem' }}
        onClick={() => setAbierto(true)}
      >
        Editar
      </button>

      {abierto &&
        createPortal(
          <div className="telon-modal" onClick={() => setAbierto(false)}>
            <div
              className="modal modal-mes" role="dialog" aria-modal="true"
              aria-label="Editar al alumno" onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button" className="modal-cerrar" onClick={() => setAbierto(false)}
                aria-label="Cerrar"
              >
                <IconoCerrar tamano={18} />
              </button>

              {busca.fase === 'falla' ? (
                <>
                  <h2>Editar</h2>
                  <p className="error">No se pudieron traer sus datos. Vuelve a intentarlo.</p>
                  <div className="fila" style={{ justifyContent: 'flex-end' }}>
                    <button type="button" className="boton" onClick={traer}>Reintentar</button>
                  </div>
                </>
              ) : busca.fase === 'vacio' ? (
                <>
                  <h2>Editar</h2>
                  <p className="aviso">Esa inscripción ya no existe.</p>
                </>
              ) : busca.fase !== 'listo' ? (
                <p className="silencio" style={{ textAlign: 'center', padding: '2rem 0' }}>
                  <span className="girando" /> Buscando…
                </p>
              ) : (
                <Formulario
                  id={id}
                  datos={busca.datos}
                  descuentos={descuentos}
                  grupos={grupos}
                  cerrar={() => setAbierto(false)}
                />
              )}
            </div>
          </div>,
          document.body,
        )}
    </>
  )
}

function Formulario({
  id,
  datos,
  descuentos,
  grupos,
  cerrar,
}: {
  id: string
  datos: Datos
  descuentos: Array<{ hash: string; nombre: string }>
  grupos: Array<{ clave: string; cursoNombre: string; horario: string; dias: string }>
  cerrar: () => void
}) {
  const [aviso, accion, enviando] = useActionState(editarAlumno, null)

  const [nombre, setNombre] = useState(datos.nombreCompleto)
  const [descuento, setDescuento] = useState(datos.descuento)
  const [factura, setFactura] = useState(datos.factura)
  const [fiscales, setFiscales] = useState({
    rfc: datos.rfc,
    razonSocial: datos.razonSocial,
    codigoPostal: datos.codigoPostal,
    correoFactura: datos.correoFactura,
  })
  const cambiar = (campo: keyof typeof fiscales) => (e: { target: { value: string } }) =>
    setFiscales((antes) => ({ ...antes, [campo]: e.target.value }))

  // Al guardar bien se cierra sola: quien corrige un nombre quiere volver a
  // la lista, no quedarse mirando el formulario que acaba de guardar.
  useEffect(() => {
    if (aviso?.ok) cerrar()
  }, [aviso, cerrar])

  return (
    <>
      <h2 style={{ marginBottom: '.2rem' }}>Editar</h2>
      <p className="silencio" style={{ marginTop: 0 }}>
        <span style={{ fontFamily: 'ui-monospace, monospace' }}>{datos.folio}</span>
        {' · el folio no cambia nunca'}
      </p>

      <form action={accion}>
        <input type="hidden" name="inscripcionId" value={id} />

        <label htmlFor={`nombre-${id}`}>Nombre completo</label>
        <input
          id={`nombre-${id}`} name="nombreCompleto" required disabled={enviando}
          autoCapitalize="characters" style={{ textTransform: 'uppercase' }}
          value={nombre} onChange={(e) => setNombre(e.target.value)}
        />

        {datos.puedeMoverGrupo && (
          <>
            <label htmlFor={`grupo-${id}`} style={{ marginTop: '.8rem', display: 'block' }}>
              Curso y horario
            </label>
            <select
              id={`grupo-${id}`} name="grupo" defaultValue={datos.grupo} disabled={enviando}
            >
              {datos.grupo === '' && <option value="">Sin curso</option>}
              {grupos.map((g) => (
                <option key={g.clave} value={g.clave}>
                  {g.cursoNombre} · {g.horario} · {g.dias}
                </option>
              ))}
            </select>
            <p className="silencio" style={{ fontSize: '.8rem', marginTop: '.3rem' }}>
              Cambiarlo rehace los meses que todavía debe, con el precio del curso nuevo.
              Lo que ya pagó se queda como está.
            </p>
          </>
        )}

        <label style={{ marginTop: '.8rem', display: 'block' }}>Descuento</label>
        <Selector
          nombre="descuento"
          etiqueta="Descuento"
          placeholder="Sin descuento"
          valor={descuento}
          deshabilitado={enviando}
          alCambiar={setDescuento}
          opciones={[
            { valor: '', etiqueta: 'Sin descuento' },
            ...descuentos.map((d) => ({ valor: d.hash, etiqueta: d.nombre })),
          ]}
        />

        {descuento !== '' && (
          <div className="fila vigencia-descuento" style={{ alignItems: 'flex-end' }}>
            <div style={{ flex: '1 1 0', minWidth: 220 }}>
              <label>
                Vale desde{' '}
                <span className="silencio" style={{ fontWeight: 400 }}>(en blanco: siempre)</span>
              </label>
              <CampoFecha
                nombre="descuentoDesde" etiqueta="El descuento vale desde"
                valor={datos.descuentoDesde} deshabilitado={enviando}
              />
            </div>
            <div style={{ flex: '1 1 0', minWidth: 220 }}>
              <label>
                y hasta{' '}
                <span className="silencio" style={{ fontWeight: 400 }}>(en blanco: no vence)</span>
              </label>
              <CampoFecha
                nombre="descuentoHasta" etiqueta="El descuento vale hasta"
                valor={datos.descuentoHasta} deshabilitado={enviando}
              />
            </div>
          </div>
        )}

        <label className="casilla-suelta">
          <input
            type="checkbox" name="factura" checked={factura} disabled={enviando}
            onChange={(e) => setFactura(e.target.checked)}
          />
          ¿Requiere factura?
        </label>

        {factura && (
          <div className="grupo-factura">
            <div className="fila">
              <div style={{ flex: '1 1 170px' }}>
                <label htmlFor={`rfc-${id}`}>RFC</label>
                <input
                  id={`rfc-${id}`} name="rfc" required disabled={enviando}
                  style={{ textTransform: 'uppercase' }}
                  value={fiscales.rfc} onChange={cambiar('rfc')}
                />
              </div>
              <div style={{ flex: '2 1 240px' }}>
                <label htmlFor={`razon-${id}`}>Razón social</label>
                <input
                  id={`razon-${id}`} name="razonSocial" required disabled={enviando}
                  value={fiscales.razonSocial} onChange={cambiar('razonSocial')}
                />
              </div>
              <div style={{ flex: '1 1 120px' }}>
                <label htmlFor={`cp-${id}`}>Código postal</label>
                <input
                  id={`cp-${id}`} name="codigoPostal" required disabled={enviando}
                  inputMode="numeric" maxLength={5}
                  value={fiscales.codigoPostal} onChange={cambiar('codigoPostal')}
                />
              </div>
            </div>

            <div className="fila" style={{ alignItems: 'flex-end' }}>
              <div style={{ flex: '2 1 260px' }}>
                <label>Régimen fiscal</label>
                <Selector
                  nombre="regimenFiscal"
                  etiqueta="Régimen fiscal"
                  placeholder="Escoge…"
                  valor={datos.regimenFiscal}
                  requerido
                  deshabilitado={enviando}
                  opciones={[
                    { valor: '', etiqueta: 'Escoge…' },
                    ...REGIMENES_FISCALES.map((r) => ({
                      valor: r.clave, etiqueta: `${r.clave} · ${r.nombre}`,
                    })),
                  ]}
                />
              </div>

              <div style={{ flex: '1 1 200px' }}>
                <label>Uso del CFDI</label>
                {/* No se escoge: la delegación es donataria autorizada. */}
                <input type="hidden" name="usoCfdi" value={USO_CFDI.clave} />
                <p className="valor-fijo">
                  {USO_CFDI.nombre} <span className="silencio">({USO_CFDI.clave})</span>
                </p>
              </div>
            </div>

            <div className="fila">
              <div style={{ flex: '1 1 260px' }}>
                <label htmlFor={`correo-${id}`}>
                  Correo electrónico{' '}
                  <span className="silencio" style={{ fontWeight: 400 }}>
                    (a donde llega el CFDI)
                  </span>
                </label>
                <input
                  id={`correo-${id}`} name="correoFactura" type="email" disabled={enviando}
                  placeholder="ana@ejemplo.mx"
                  value={fiscales.correoFactura} onChange={cambiar('correoFactura')}
                />
              </div>
            </div>

            <div>
              <label>Constancia de situación fiscal</label>
              <CampoArchivo
                nombre="constancia"
                acepta="application/pdf"
                ayuda={
                  datos.tieneConstancia
                    ? `Ya tiene ${datos.constanciaNombre ?? 'una'}. Sube otra solo para reemplazarla.`
                    : 'El PDF que descarga del SAT. Se puede agregar después.'
                }
                deshabilitado={enviando}
              />
            </div>
          </div>
        )}

        {/* Guardar primero y Cerrar a su derecha, como en toda ventana del
            panel: quien viene a guardar no debería tener que buscar el botón
            en un lugar distinto según la pantalla. */}
        <div className="fila" style={{ justifyContent: 'flex-end', marginTop: '1rem' }}>
          <button className="boton" type="submit" disabled={enviando}>
            {enviando ? 'Guardando…' : 'Guardar'}
          </button>
          <button type="button" className="boton tenue" onClick={cerrar} disabled={enviando}>
            Cerrar
          </button>
        </div>
      </form>

      <Alerta resultado={enviando ? null : aviso} />
    </>
  )
}
