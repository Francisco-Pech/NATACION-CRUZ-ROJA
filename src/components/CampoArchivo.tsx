'use client'

import { useRef, useState } from 'react'

/**
 * Un campo para subir un archivo.
 *
 * El `<input type="file">` de siempre se ve distinto en cada navegador, dice
 * "Sin archivos seleccionados" en el idioma del sistema y no da manera de
 * quitar lo que ya se escogió. Aquí el input de verdad se esconde y en su
 * lugar va una caja que se puede picar o soltarle el archivo encima.
 *
 * El archivo sigue viajando en ese mismo input, así que el formulario y la
 * acción del servidor no cambian en nada.
 */
export default function CampoArchivo({
  nombre,
  acepta,
  ayuda,
  deshabilitado = false,
}: {
  nombre: string
  /** Qué tipos se ofrecen en el diálogo del sistema. */
  acepta?: string
  ayuda?: string
  deshabilitado?: boolean
}) {
  const campo = useRef<HTMLInputElement>(null)
  const [archivo, setArchivo] = useState<File | null>(null)
  const [encima, setEncima] = useState(false)

  function soltar(e: React.DragEvent) {
    e.preventDefault()
    setEncima(false)
    if (deshabilitado) return
    const uno = e.dataTransfer.files?.[0]
    if (!uno || !campo.current) return
    // Se le pasa al input de verdad: es de ahí de donde el formulario lo
    // toma al enviarse.
    const caja = new DataTransfer()
    caja.items.add(uno)
    campo.current.files = caja.files
    setArchivo(uno)
  }

  function quitar() {
    if (campo.current) campo.current.value = ''
    setArchivo(null)
  }

  return (
    <div>
      <input
        ref={campo}
        type="file"
        name={nombre}
        accept={acepta}
        disabled={deshabilitado}
        hidden
        onChange={(e) => setArchivo(e.target.files?.[0] ?? null)}
      />

      {archivo ? (
        <div className="archivo-puesto">
          <span className="archivo-icono" aria-hidden>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H7a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7z" />
              <polyline points="14 2 14 7 19 7" />
            </svg>
          </span>
          <span className="archivo-datos">
            <strong>{archivo.name}</strong>
            <span className="silencio">{pesa(archivo.size)}</span>
          </span>
          <button type="button" onClick={quitar} disabled={deshabilitado} aria-label="Quitar el archivo">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="2.4" strokeLinecap="round" aria-hidden>
              <line x1="6" y1="6" x2="18" y2="18" />
              <line x1="18" y1="6" x2="6" y2="18" />
            </svg>
          </button>
        </div>
      ) : (
        <button
          type="button"
          className={`archivo-caja${encima ? ' encima' : ''}`}
          onClick={() => campo.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setEncima(true) }}
          onDragLeave={() => setEncima(false)}
          onDrop={soltar}
          disabled={deshabilitado}
        >
          <span className="archivo-icono" aria-hidden>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 9 12 4 17 9" />
              <line x1="12" y1="4" x2="12" y2="16" />
            </svg>
          </span>
          <span className="archivo-datos">
            <strong>Escoge el archivo o suéltalo aquí</strong>
            {ayuda && <span className="silencio">{ayuda}</span>}
          </span>
        </button>
      )}
    </div>
  )
}

/** El tamaño como lo lee la gente, no en bytes sueltos. */
function pesa(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}
