'use client'

import { useEffect, useState } from 'react'
import { IconoCopiar, IconoPalomita } from '@/components/Iconos'

/**
 * Un dato con su botón para copiarlo.
 *
 * Una CLABE son dieciocho dígitos y una referencia de OXXO son treinta y
 * dos: teclearlos a mano desde la banca del banco es como se transfiere al
 * lugar equivocado. Aquí se copian de un toque.
 *
 * Si el navegador no deja copiar —pasa fuera de https— el texto queda
 * seleccionado, que es lo más cerca que se puede estar de copiarlo.
 */
export default function ParaCopiar({
  valor,
  etiqueta,
}: {
  valor: string
  /** Para el aviso de voz: "CLABE copiada". */
  etiqueta: string
}) {
  const [copiado, setCopiado] = useState(false)

  useEffect(() => {
    if (!copiado) return
    const reloj = setTimeout(() => setCopiado(false), 2200)
    return () => clearTimeout(reloj)
  }, [copiado])

  async function copiar() {
    try {
      await navigator.clipboard.writeText(valor)
      setCopiado(true)
    } catch {
      // Sin permiso para copiar: al menos que quede seleccionado.
      const nodo = document.getElementById(`copiable-${etiqueta}`)
      if (nodo) {
        const rango = document.createRange()
        rango.selectNodeContents(nodo)
        const seleccion = window.getSelection()
        seleccion?.removeAllRanges()
        seleccion?.addRange(rango)
      }
    }
  }

  return (
    <span className="para-copiar">
      <span className="mono" id={`copiable-${etiqueta}`}>{valor}</span>
      {/* Un ícono y no la palabra: el renglón ya lleva el dato, y "Copiar"
          al lado de una CLABE de dieciocho dígitos aprieta la fila. Al
          copiar cambia a la palomita, que ocupa lo mismo y no mueve nada. */}
      <button
        type="button"
        className={`copiar-boton${copiado ? ' copiado' : ''}`}
        onClick={copiar}
        aria-label={copiado ? `${etiqueta} copiada` : `Copiar ${etiqueta}`}
        title={copiado ? 'Copiado' : `Copiar ${etiqueta}`}
      >
        {copiado ? <IconoPalomita /> : <IconoCopiar />}
      </button>
    </span>
  )
}
