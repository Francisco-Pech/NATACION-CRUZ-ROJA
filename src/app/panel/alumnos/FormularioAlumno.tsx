'use client'

import { useActionState, useEffect, useState } from 'react'
import { darDeAltaAlumno } from './acciones'
import SelectorCursoHorario, { type GrupoHorario } from './SelectorCursoHorario'
import CampoFecha from '@/components/CampoFecha'
import Selector from '@/components/Selector'
import Alerta from '@/components/Alerta'
import CampoArchivo from '@/components/CampoArchivo'
import { IconoGuardar } from '@/components/Iconos'
import { REGIMENES_FISCALES, USO_CFDI } from '@/lib/facturacion'

/** Con qué arranca el formulario, y a qué vuelve tras un alta buena. */
const VACIO = {
  nombreCompleto: '',
  rfc: '',
  razonSocial: '',
  codigoPostal: '',
 correoFactura: '',}

/**
 * El alta de un alumno.
 *
 * Los datos de facturación solo aparecen si se marca que factura: a la
 * mayoría no le hacen falta y tenerlos siempre a la vista alarga la
 * pantalla sin razón.
 */
export default function FormularioAlumno({
  grupos,
  descuentos,
  lockers,
  precioLocker,
}: {
  grupos: GrupoHorario[]
  descuentos: Array<{ hash: string; nombre: string }>
  /** Solo los que están libres este mes. */
  lockers: Array<{ id: string; numero: number }>
  /** Lo que cuesta al mes, ya escrito. */
  precioLocker: string
}) {
  const [aviso, accion, enviando] = useActionState(darDeAltaAlumno, null)
  const [factura, setFactura] = useState(false)

  /**
   * Lo tecleado vive en React y no en el DOM.
   *
   * Al terminar una acción, React vacía los campos del formulario. Si el
   * alta se rechaza —un RFC mal escrito, una sesión que se llenó— quien
   * captura perdía de golpe todo lo que había escrito y tenía que empezar
   * de nuevo por un solo dato.
   */
  const [datos, setDatos] = useState(VACIO)
  const cambiar = (campo: keyof typeof VACIO) => (e: { target: { value: string } }) =>
    setDatos((antes) => ({ ...antes, [campo]: e.target.value }))

  // Solo cuando de verdad quedó inscrito se limpia. La `ronda` remonta los
  // campos que guardan su propio estado —fechas, descuento, días y
  // horarios— que de otro modo se quedarían con lo del alumno anterior.
  const [ronda, setRonda] = useState(0)

  /**
   * Qué descuento quedó escogido.
   *
   * Se guarda para poder preguntar hasta cuándo le dura. Sin descuento no se
   * pregunta nada: dos campos de fecha vacíos en el renglón de todos los
   * días serían dos huecos que nadie llena.
   */
  const [descuentoElegido, setDescuentoElegido] = useState('')
  useEffect(() => {
    if (!aviso?.ok) return
    setDatos(VACIO)
    setFactura(false)
    setDescuentoElegido('')
    setRonda((n) => n + 1)
  }, [aviso])

  return (
    <>
      <form action={accion}>
        <div className="fila" style={{ alignItems: 'flex-end' }}>
          <div style={{ flex: '2 1 280px' }}>
            <label htmlFor="nombreCompleto">Nombre completo</label>
            <input
              id="nombreCompleto" name="nombreCompleto" required disabled={enviando}
              autoCapitalize="characters" style={{ textTransform: 'uppercase' }}
              placeholder="Ana Sofía Canul Pérez"
              value={datos.nombreCompleto} onChange={cambiar('nombreCompleto')}
            />
          </div>

          <div style={{ flex: '1 1 180px' }}>
            <label>Descuento</label>
            <Selector
              key={ronda}
              nombre="descuento"
              etiqueta="Descuento"
              placeholder="Sin descuento"
              valor=""
              deshabilitado={enviando}
              alCambiar={setDescuentoElegido}
              opciones={[
                { valor: '', etiqueta: 'Sin descuento' },
                ...descuentos.map((d) => ({ valor: d.hash, etiqueta: d.nombre })),
              ]}
            />
          </div>

          {/* Junto al descuento: los dos son opcionales, chicos, y se
              deciden en el mostrador mientras el alumno está ahí. */}
          <div style={{ flex: '1 1 180px' }}>
            {/* Lo que hace falta saber va en la etiqueta y no debajo: una
                nota bajo un solo campo estira ese hueco y descuadra el
                renglón entero. */}
            <label>
              Locker{' '}
              <span className="silencio" style={{ fontWeight: 400 }}>
                {lockers.length === 0
                  ? '(ninguno libre)'
                  : `(${lockers.length} libres${precioLocker ? ` · ${precioLocker} al mes` : ''})`}
              </span>
            </label>
            <Selector
              key={ronda}
              nombre="locker"
              etiqueta="Locker"
              placeholder="Sin locker"
              valor=""
              deshabilitado={enviando || lockers.length === 0}
              opciones={[
                { valor: '', etiqueta: 'Sin locker' },
                ...lockers.map((l) => ({ valor: l.id, etiqueta: `Locker ${l.numero}` })),
              ]}
            />
          </div>
        </div>

        {/* Solo cuando hay descuento: es donde se contesta "¿cuánto le
            dura?". Una cortesía se pone del día a ese mismo día; un INAPAM
            se deja en blanco y no vence. Se pregunta aquí y no en el
            catálogo porque es de esta persona, no del descuento. */}
        {descuentoElegido !== '' && (
          <div className="fila vigencia-descuento" style={{ alignItems: 'flex-end' }}>
            <div style={{ flex: '1 1 0', minWidth: 220 }}>
              <label>
                El descuento vale desde{' '}
                <span className="silencio" style={{ fontWeight: 400 }}>(en blanco: siempre)</span>
              </label>
              <CampoFecha
                key={ronda} nombre="descuentoDesde" etiqueta="El descuento vale desde"
                deshabilitado={enviando}
              />
            </div>
            <div style={{ flex: '1 1 0', minWidth: 220 }}>
              <label>
                y hasta{' '}
                <span className="silencio" style={{ fontWeight: 400 }}>(en blanco: no vence)</span>
              </label>
              <CampoFecha
                key={ronda} nombre="descuentoHasta" etiqueta="El descuento vale hasta"
                deshabilitado={enviando}
              />
            </div>
          </div>
        )}

        <SelectorCursoHorario key={ronda} grupos={grupos} deshabilitado={enviando} />

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
                <label htmlFor="rfc">RFC</label>
                <input
                  id="rfc" name="rfc" required disabled={enviando}
                  placeholder="PECF870115H23" style={{ textTransform: 'uppercase' }}
                  value={datos.rfc} onChange={cambiar('rfc')}
                />
              </div>
              <div style={{ flex: '2 1 240px' }}>
                <label htmlFor="razonSocial">Razón social</label>
                <input
                  id="razonSocial" name="razonSocial" required disabled={enviando}
                  placeholder="Como aparece en la constancia"
                  value={datos.razonSocial} onChange={cambiar('razonSocial')}
                />
              </div>
              <div style={{ flex: '1 1 120px' }}>
                <label htmlFor="codigoPostal">Código postal</label>
                <input
                  id="codigoPostal" name="codigoPostal" required disabled={enviando}
                  inputMode="numeric" maxLength={5} placeholder="77500"
                  value={datos.codigoPostal} onChange={cambiar('codigoPostal')}
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
                  valor=""
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
                {/* No se escoge: la delegación es donataria autorizada y
                    todo lo que factura sale como donativo. */}
                <input type="hidden" name="usoCfdi" value={USO_CFDI.clave} />
                <p className="valor-fijo">
                  {USO_CFDI.nombre} <span className="silencio">({USO_CFDI.clave})</span>
                </p>
              </div>
            </div>

            {/* El correo se pregunta aquí y no en la ficha de contacto: es el
                momento en que alguien decide que quiere factura, y ahí sabe
                a dónde la quiere. Dos pantallas después ya se fue. */}
            <div className="fila">
            <div style={{ flex: '1 1 260px' }}>
              <label htmlFor="correoFactura">
                Correo electrónico{' '}
                <span className="silencio" style={{ fontWeight: 400 }}>(a donde llega el CFDI)</span>
              </label>
              <input
                id="correoFactura" name="correoFactura" type="email" disabled={enviando}
                placeholder="ana@ejemplo.mx"
                value={datos.correoFactura} onChange={cambiar('correoFactura')}
              />
            </div>
            </div>

            <div>
              <label>Constancia de situación fiscal</label>
              <CampoArchivo
                nombre="constancia"
                acepta="application/pdf"
                ayuda="El PDF que descarga del SAT. Se puede agregar después."
                deshabilitado={enviando}
              />
            </div>
          </div>
        )}

        <div className="fila" style={{ justifyContent: 'flex-end', marginTop: '1rem' }}>
          <button className="boton con-icono" type="submit" disabled={enviando}>
            {enviando ? <span className="girando claro" /> : <IconoGuardar />}
            {enviando ? 'Dando de alta…' : 'Dar de alta'}
          </button>
        </div>
      </form>

      <Alerta resultado={enviando ? null : aviso} />
    </>
  )
}
