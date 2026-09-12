'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  IconoTablero, IconoAlumnos, IconoCobranza, IconoLockers, IconoAjustes,
  IconoMenu, IconoAnterior, IconoSiguiente,
} from '@/components/Iconos'

const OPERACION = [
  { href: '/panel', texto: 'Tablero', Icono: IconoTablero },
  { href: '/panel/alumnos', texto: 'Alumnos', Icono: IconoAlumnos },
  { href: '/panel/pagos', texto: 'Cobranza', Icono: IconoCobranza },
  { href: '/panel/lockers', texto: 'Lockers', Icono: IconoLockers },
]

const RECUERDO = 'lateral-encogida'

/**
 * La barra lateral, que se puede encoger para dejarle la pantalla a lo que
 * se está trabajando.
 *
 * Encogida se queda en un riel de íconos: sigue sirviendo para navegar, que
 * es lo que una barra escondida deja de hacer. En pantallas chicas no se
 * encoge, se sale del lado y vuelve como panel encima, porque ahí ni el
 * riel cabe.
 *
 * Se recuerda en el navegador: si alguien la encogió, no tiene que volver a
 * hacerlo en cada pantalla.
 */
export default function BarraLateral({
  usuario,
  esAdmin,
  salir,
}: {
  usuario: { nombre: string; rol: string }
  esAdmin: boolean
  salir: () => Promise<void>
}) {
  const [encogida, setEncogida] = useState(false)
  const [abiertaEnMovil, setAbiertaEnMovil] = useState(false)

  // Se lee después de montar: en el servidor no hay navegador que recuerde.
  useEffect(() => {
    try {
      setEncogida(localStorage.getItem(RECUERDO) === '1')
    } catch {
      // Navegador sin almacenamiento: se queda ancha, que es lo de siempre.
    }
  }, [])

  function alternar() {
    setEncogida((antes) => {
      const ahora = !antes
      try {
        localStorage.setItem(RECUERDO, ahora ? '1' : '0')
      } catch {
        // Si no se puede recordar, igual se encoge por esta vez.
      }
      return ahora
    })
  }

  const enlaces = [
    ...OPERACION,
    ...(esAdmin
      ? [{ href: '/panel/admin', texto: 'Panel de control', Icono: IconoAjustes }]
      : []),
  ]

  return (
    <>
      {/* Solo en pantallas chicas: abre la barra encima del contenido. */}
      <button
        type="button"
        className="abrir-lateral no-imprimir"
        onClick={() => setAbiertaEnMovil(true)}
        aria-label="Abrir el menú"
      >
        <IconoMenu />
      </button>

      {abiertaEnMovil && (
        <div
          className="telon no-imprimir"
          onClick={() => setAbiertaEnMovil(false)}
          aria-hidden
        />
      )}

      <aside
        className={`lateral no-imprimir ${encogida ? 'encogida' : ''} ${
          abiertaEnMovil ? 'abierta' : ''
        }`}
      >
        <div className="lateral-marca">
          <span className="lateral-logo" aria-hidden>🏊</span>
          <span className="lateral-nombre">
            <strong>Natación</strong>
            <small>Cruz Roja Cancún</small>
          </span>
          <button
            type="button"
            className="encoger"
            onClick={alternar}
            aria-label={encogida ? 'Ensanchar el menú' : 'Encoger el menú'}
            title={encogida ? 'Ensanchar' : 'Encoger'}
          >
            {encogida ? <IconoSiguiente tamano={13} /> : <IconoAnterior tamano={13} />}
          </button>
        </div>

        <nav className="lateral-nav">
          <span className="lateral-titulo">Operación</span>
          {enlaces.map(({ href, texto, Icono }, i) => (
            <div key={href}>
              {i === OPERACION.length && <span className="lateral-titulo">Configuración</span>}
              <Link href={href} title={texto} onClick={() => setAbiertaEnMovil(false)}>
                <Icono />
                <span>{texto}</span>
              </Link>
            </div>
          ))}
        </nav>

        <div className="lateral-pie">
          <div className="lateral-usuario">
            <strong>{usuario.nombre}</strong>
            <small>{usuario.rol}</small>
          </div>
          <form action={salir}>
            <button type="submit" className="boton tenue" title="Salir">
              <span>Salir</span>
            </button>
          </form>
        </div>
      </aside>
    </>
  )
}
