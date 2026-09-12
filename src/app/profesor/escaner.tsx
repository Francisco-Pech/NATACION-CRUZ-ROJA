'use client'

import { useEffect, useRef, useState } from 'react'

type Resultado = {
  nombre: string
  folio: string
  fotoUrl: string | null
  alCorriente: boolean
  mes: string
}

export default function Escaner() {
  const [resultado, setResultado] = useState<Resultado | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [escaneando, setEscaneando] = useState(false)
  const [manual, setManual] = useState('')
  const contenedor = useRef<HTMLDivElement>(null)
  const lector = useRef<{ stop: () => Promise<void> } | null>(null)

  async function consultar(token: string) {
    setError(null)
    const respuesta = await fetch(`/api/acceso/${encodeURIComponent(token)}`)
    if (!respuesta.ok) {
      setResultado(null)
      setError(respuesta.status === 404 ? 'No se encontró esa credencial.' : 'No se pudo consultar.')
      return
    }
    setResultado(await respuesta.json())
  }

  /** El QR codifica la URL completa; de ahí se extrae el token. */
  function tokenDesde(texto: string): string {
    const corte = texto.lastIndexOf('/q/')
    return corte >= 0 ? texto.slice(corte + 3) : texto
  }

  async function iniciar() {
    setError(null)
    try {
      const { Html5Qrcode } = await import('html5-qrcode')
      const instancia = new Html5Qrcode('lector-qr')
      lector.current = instancia
      await instancia.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 240, height: 240 } },
        async (texto: string) => {
          await instancia.stop()
          setEscaneando(false)
          await consultar(tokenDesde(texto))
        },
        () => {},
      )
      setEscaneando(true)
    } catch {
      setError('No se pudo abrir la cámara. Revisa los permisos del navegador.')
    }
  }

  useEffect(() => {
    return () => { lector.current?.stop().catch(() => {}) }
  }, [])

  return (
    <>
      <h1>¿Puede pasar?</h1>

      {resultado && (
        <div className={`semaforo ${resultado.alCorriente ? 'si' : 'no'}`}>
          <div className="icono">{resultado.alCorriente ? '✓' : '✕'}</div>
          <div className="nombre">{resultado.nombre}</div>
          <div style={{ fontWeight: 700, fontSize: '1.1rem' }}>
            {resultado.alCorriente ? 'AL CORRIENTE' : 'NO ESTÁ AL CORRIENTE'}
          </div>
          <div className="silencio" style={{ marginTop: '.4rem', fontFamily: 'ui-monospace, monospace' }}>
            {resultado.folio}
          </div>
        </div>
      )}

      {error && <div className="error">{error}</div>}

      <div className="tarjeta">
        <div id="lector-qr" ref={contenedor} style={{ width: '100%' }} />
        {!escaneando && (
          <button className="boton" onClick={iniciar} style={{ width: '100%' }}>
            {resultado ? 'Escanear otra credencial' : 'Abrir la cámara y escanear'}
          </button>
        )}
      </div>

      <div className="tarjeta">
        <h2>Si el código no lee</h2>
        <form
          className="fila"
          onSubmit={(e) => { e.preventDefault(); if (manual.trim()) consultar(manual.trim()) }}
        >
          <input
            value={manual}
            onChange={(e) => setManual(e.target.value)}
            placeholder="Pega aquí el enlace o el token"
            style={{ flex: 1 }}
          />
          <button className="boton tenue" type="submit">Consultar</button>
        </form>
      </div>
    </>
  )
}
