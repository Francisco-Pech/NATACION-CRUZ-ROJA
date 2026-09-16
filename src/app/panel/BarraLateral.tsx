'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  IconoTablero, IconoAlumnos, IconoCobranza, IconoLockers, IconoAjustes,
  IconoMenu, IconoAnterior, IconoSiguiente,
} from '@/components/Iconos'

/** El dibujo de cada sección. Cuáles se ven lo decide `enlacesDelPanel`. */
const ICONOS: Record<string, typeof IconoTablero> = {
  '/panel': IconoTablero,
  '/panel/alumnos': IconoAlumnos,
  '/panel/pagos': IconoCobranza,
  '/panel/lockers': IconoLockers,
  '/panel/admin': IconoAjustes,
}

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
  enlaces: secciones,
  salir,
}: {
  usuario: { nombre: string; rol: string }
  /** Solo las secciones que esta persona puede abrir. */
  enlaces: Array<{ href: string; texto: string }>
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

  const enlaces = secciones.map((s) => ({ ...s, Icono: ICONOS[s.href] ?? IconoTablero }))

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
          {enlaces.map(({ href, texto, Icono }) => (
            <div key={href}>
              {/* El corte se decide por la sección, no por su posición: con
                  la lista armada de permisos, el índice cambia según quién
                  entre y el título caía en cualquier lado. */}
              {href === '/panel/admin' && <span className="lateral-titulo">Configuración</span>}
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
