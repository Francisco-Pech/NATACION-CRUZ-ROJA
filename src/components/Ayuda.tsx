'use client'

import { useRef, useState } from 'react'
import { createPortal } from 'react-dom'

/**
 * Un "?" que explica algo al pasar el mouse.
 *
 * Para un dato calculado que sirve saber pero no vale una columna: la tabla
 * ya es ancha y agregarle una la manda al scroll horizontal.
 *
 * El globo se dibuja pegado al `<body>` y colocado a mano. Tiene que ser
 * así: la tabla vive dentro de una caja con scroll, y un globo posicionado
 * adentro se recorta contra ese borde — se veía una sola línea de cinco.
 */
export default function Ayuda({ texto }: { texto: string }) {
  const [sitio, setSitio] = useState<{ top: number; left: number } | null>(null)
  const boton = useRef<HTMLSpanElement>(null)

  function abrir() {
    const caja = boton.current?.getBoundingClientRect()
    if (!caja) return
    // Arriba del "?" y alineado a su derecha. Si no cabe arriba, abajo:
    // en el primer renglón de la tabla no hay lugar por encima.
    const cabeArriba = caja.top > 180
    setSitio({
      top: cabeArriba ? caja.top - 8 : caja.bottom + 8,
      left: caja.right,
    })
  }

  return (
    <>
      <span
        ref={boton}
        className="ayuda"
        tabIndex={0}
        role="note"
        aria-label={texto}
        onMouseEnter={abrir}
        onMouseLeave={() => setSitio(null)}
        onFocus={abrir}
        onBlur={() => setSitio(null)}
      >
        ?
      </span>

      {sitio &&
        createPortal(
          <span
            className="ayuda-globo"
            style={{
              top: sitio.top,
              left: sitio.left,
              transform: sitio.top < 180 ? 'translateX(-100%)' : 'translate(-100%, -100%)',
            }}
          >
            {texto}
          </span>,
          document.body,
        )}
    </>
  )
}
