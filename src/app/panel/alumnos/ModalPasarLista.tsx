'use client'

import { useActionState, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import Alerta from '@/components/Alerta'
import { IconoCerrar } from '@/components/Iconos'
import { listaDelGrupo, marcarAsistencia, verificarCredencial } from './profesor-acciones'

type Lista = NonNullable<Awaited<ReturnType<typeof listaDelGrupo>>>
type Alumno = Lista['alumnos'][number]

/** "2026-09-14" → "lunes 14 de septiembre". En el modal sí cabe completo. */
const comoSeLee = (dia: string) =>
  new Date(`${dia}T12:00:00`).toLocaleDateString('es-MX', {
    weekday: 'long', day: 'numeric', month: 'long',
  })

const mesYAnio = (anio: number, mes: number) =>
  new Date(anio, mes - 1, 15).toLocaleDateString('es-MX', { month: 'long', year: 'numeric' })

/**
 * La ventana donde el profesor le pasa lista a un alumno.
 *
 * En ventana y no en la tabla: palomear una casilla de veinte columnas es
 * apuntarle a un cuadro de catorce píxeles con el dedo, y antes de marcar
 * hay que ver dos cosas que en la tabla no caben —si trae credencial y si
 * debe el mes—. Aquí se ven las tres juntas y se marca sin apuntar.
 *
 * La tabla queda como resumen: enseña de un vistazo quién viene y quién no.
 *
 * Cada palomita se guarda sola, en cuanto se pulsa. No hay "Guardar": así
 * cerrar la ventana nunca pierde nada, que es lo que pasaría si el profesor
 * marca media lista y le suena el silbato.
 */
export default function ModalPasarLista({
  alumno,
  fechas,
  credencial,
  alCambiar,
}: {
  alumno: Alumno
  fechas: Lista['fechas']
  credencial: Lista['credencial']
  alCambiar: () => void
}) {
  const [abierto, setAbierto] = useState(false)

  useEffect(() => {
    if (!abierto) return
    const alTeclear = (e: KeyboardEvent) => { if (e.key === 'Escape') setAbierto(false) }
    document.addEventListener('keydown', alTeclear)
    return () => document.removeEventListener('keydown', alTeclear)
  }, [abierto])

  return (
    <>
      <button
        type="button"
        className="enlace-folio"
        onClick={() => setAbierto(true)}
        title={`Pasarle lista a ${alumno.nombre}`}
      >
        {alumno.nombre}
      </button>

      {abierto &&
        createPortal(
          <div className="telon-modal" onClick={() => setAbierto(false)}>
            <div
              className="modal"
              role="dialog"
              aria-modal="true"
              aria-label={`Lista de ${alumno.nombre}`}
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button" className="modal-cerrar"
                onClick={() => setAbierto(false)} aria-label="Cerrar"
              >
                <IconoCerrar tamano={18} />
              </button>

              <h2 style={{ marginBottom: '.2rem' }}>{alumno.nombre}</h2>
              <p className="silencio mono" style={{ marginTop: 0, fontSize: '.82rem' }}>
                {alumno.folio}
              </p>

              <Adentro
                alumno={alumno} fechas={fechas} credencial={credencial}
                alCambiar={alCambiar}
              />

              <div className="fila" style={{ justifyContent: 'flex-end', marginTop: '1rem' }}>
                <button type="button" className="boton tenue" onClick={() => setAbierto(false)}>
                  Cerrar
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  )
}

// ------------------------------------------------------------ el contenido

function Adentro({
  alumno,
  fechas,
  credencial,
  alCambiar,
}: {
  alumno: Alumno
  fechas: Lista['fechas']
  credencial: Lista['credencial']
  alCambiar: () => void
}) {
  const mesCredencial = mesYAnio(credencial.anio, credencial.mes)

  return (
    <>
      {!alumno.credencialSePuede && (
        <div className="aviso grave">
          <strong>No tiene pagado {mesCredencial}.</strong> Sin el mes cubierto no se le valida
          la credencial ni se le pasa lista: mándalo a la ventanilla.
        </div>
      )}

      <div className="tarjeta" style={{ marginBottom: '.8rem' }}>
        <h3 style={{ margin: '0 0 .5rem', fontSize: '.95rem' }}>Credencial de {mesCredencial}</h3>
        <Credencial alumno={alumno} credencial={credencial} alCambiar={alCambiar} />
      </div>

      <h3 style={{ margin: '0 0 .5rem', fontSize: '.95rem' }}>Sus clases</h3>
      <div className="dias-del-alumno">
        {fechas.length === 0 ? (
          <p className="silencio">No hay clases en esas fechas.</p>
        ) : (
          fechas.map((f) => (
            <Dia
              key={f.dia} fecha={f} alumno={alumno}
              vino={alumno.asistio.includes(f.dia)} alCambiar={alCambiar}
            />
          ))
        )}
      </div>
    </>
  )
}

function Credencial({
  alumno,
  credencial,
  alCambiar,
}: {
  alumno: Alumno
  credencial: Lista['credencial']
  alCambiar: () => void
}) {
  const [aviso, verificar, verificando] = useActionState(verificarCredencial, null)
  const [escaneando, setEscaneando] = useState(false)
  const [falloCamara, setFalloCamara] = useState<string | null>(null)
  const lector = useRef<{ stop: () => Promise<void> } | null>(null)
  const porToken = useRef<HTMLFormElement>(null)
  const tokenLeido = useRef<HTMLInputElement>(null)

  useEffect(() => { if (aviso?.ok) alCambiar() }, [aviso, alCambiar])

  // La cámara se apaga al cerrar la ventana: si no, sigue encendida por
  // detrás y el teléfono se calienta sin que nadie sepa por qué.
  useEffect(() => () => { lector.current?.stop().catch(() => {}) }, [])

  /** El QR codifica la URL completa; de ahí se saca el token. */
  const tokenDesde = (texto: string) => {
    const corte = texto.lastIndexOf('/q/')
    return corte >= 0 ? texto.slice(corte + 3) : texto
  }

  async function escanear() {
    setFalloCamara(null)
    // El contenedor tiene que estar visible ANTES de arrancar: la librería
    // mide el hueco donde va a poner el vídeo, y en un div escondido mide
    // cero y no dibuja nada. Pulsar y que no pase nada es peor que un error.
    setEscaneando(true)
    await new Promise((r) => requestAnimationFrame(() => r(null)))
    try {
      const { Html5Qrcode } = await import('html5-qrcode')
      const instancia = new Html5Qrcode('lector-qr-lista')
      lector.current = instancia
      await instancia.start(
        { facingMode: 'environment' },
        // Sin recuadro: se lee el cuadro entero. Con un recuadro chico hay
        // que encuadrar la credencial justo ahí, y quien está con veinte
        // niños en la alberca no va a estar calibrando el encuadre.
        { fps: 10 },
        (texto: string) => {
          // Primero se registra y luego se apaga la cámara, nunca al revés:
          // `stop()` puede tardar o reventar, y con el orden invertido el
          // escaneo se pierde — la credencial se leyó y no quedó escrita.
          //
          // El escaneo vale más que el folio tecleado: prueba que el papel
          // estaba ahí. Se manda con su marca de ESCANEO.
          if (tokenLeido.current) tokenLeido.current.value = tokenDesde(texto)
          porToken.current?.requestSubmit()
          setEscaneando(false)
          instancia.stop().catch(() => {})
        },
        () => {},
      )
    } catch {
      setEscaneando(false)
      setFalloCamara(
        'No se pudo abrir la cámara. Revisa los permisos del navegador, o usa el folio.',
      )
    }
  }

  if (alumno.verificado) {
    return (
      <p style={{ margin: 0 }}>
        <span className="insignia VERDE">
          {alumno.verificado === 'ESCANEO' ? 'Escaneada' : 'Por folio'}
        </span>{' '}
        <span className="silencio" style={{ fontSize: '.82rem' }}>
          ya se la pidieron este mes.
        </span>
      </p>
    )
  }

  if (!credencial.sePuedePedir || !alumno.credencialSePuede) {
    return (
      <p className="silencio" style={{ margin: 0, fontSize: '.85rem' }}>
        {!alumno.credencialSePuede
          ? 'Sin el mes pagado no se le puede validar.'
          : 'Solo el profesor la registra, y mientras el mes corre.'}
      </p>
    )
  }

  return (
    <>
      {/* Siempre montado, nunca escondido: ver arriba. */}
      <div
        id="lector-qr-lista"
        style={{ width: '100%', marginBottom: escaneando ? '.6rem' : 0 }}
      />

      {falloCamara && <p className="error" style={{ margin: '0 0 .6rem' }}>{falloCamara}</p>}

      <div className="fila" style={{ gap: '.5rem' }}>
        <button type="button" className="boton" onClick={escanear} disabled={escaneando}>
          {escaneando ? 'Apunta al código…' : 'Escanear su QR'}
        </button>

        <form action={verificar}>
          <input type="hidden" name="credencial" value={alumno.folio} />
          <input type="hidden" name="anio" value={credencial.anio} />
          <input type="hidden" name="mes" value={credencial.mes} />
          <input type="hidden" name="como" value="FOLIO" />
          <button className="boton tenue" type="submit" disabled={verificando}>
            {verificando ? '…' : 'Registrar por folio'}
          </button>
        </form>
      </div>

      {/* El del escaneo va aparte: lo envía la cámara, no un clic. */}
      <form action={verificar} ref={porToken} hidden>
        <input type="hidden" name="credencial" ref={tokenLeido} defaultValue="" />
        <input type="hidden" name="anio" value={credencial.anio} />
        <input type="hidden" name="mes" value={credencial.mes} />
        <input type="hidden" name="como" value="ESCANEO" />
      </form>

      <Alerta resultado={verificando ? null : aviso} />
    </>
  )
}

function Dia({
  fecha,
  alumno,
  vino,
  alCambiar,
}: {
  fecha: Lista['fechas'][number]
  alumno: Alumno
  vino: boolean
  alCambiar: () => void
}) {
  const [aviso, marcar, guardando] = useActionState(marcarAsistencia, null)
  useEffect(() => { if (aviso?.ok) alCambiar() }, [aviso, alCambiar])

  // Debe ese mes: la clase existe, pero no es suya hasta que pague.
  const pagado = alumno.mesesCubiertos.includes(fecha.dia.slice(0, 7))
  const sePuede = fecha.editable && pagado

  const porQueNo = !pagado
    ? 'no tiene pagado ese mes'
    : fecha.futura
      ? 'esa clase todavía no se da'
      : 'ese mes ya cerró'

  return (
    <div className={`dia-del-alumno${vino ? ' vino' : ''}`}>
      {sePuede ? (
        <form action={marcar}>
          <input type="hidden" name="folio" value={alumno.folio} />
          <input type="hidden" name="fecha" value={fecha.dia} />
          <input type="hidden" name="asistio" value={vino ? 'no' : 'si'} />
          <button type="submit" className="dia-boton" disabled={guardando} aria-pressed={vino}>
            <span className={`casilla${vino ? ' puesta' : ''}`} aria-hidden>
              {vino ? '✓' : ''}
            </span>
            {comoSeLee(fecha.dia)}
          </button>
        </form>
      ) : (
        <span className="dia-boton apagado" title={porQueNo}>
          <span className={`casilla cerrada${vino ? ' puesta' : ''}`} aria-hidden>
            {vino ? '✓' : ''}
          </span>
          {comoSeLee(fecha.dia)}
          <em className="silencio"> · {porQueNo}</em>
        </span>
      )}
      <Alerta resultado={guardando ? null : aviso} />
    </div>
  )
}
