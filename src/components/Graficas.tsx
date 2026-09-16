'use client'

import { useId, useState } from 'react'

/**
 * Gráficas dibujadas a mano, en SVG y sin dependencias.
 *
 * Misma razón que los íconos: el proyecto es de CSS plano, y arrastrar una
 * librería de gráficas por tres pantallas costaría más de lo que resuelve.
 *
 * Todas son de una sola serie a propósito. Eso hace innecesaria la leyenda
 * —el título ya dice qué se está viendo— y evita el problema de fondo de las
 * gráficas de colores: dos series que alguien con daltonismo no distingue.
 * El color aquí no identifica nada, solo marca el dato.
 */

const TINTA = 'var(--dato)'

/** Redondea hacia arriba a un número limpio, para que el eje se lea. */
function techo(maximo: number): number {
  if (maximo <= 0) return 1
  const magnitud = 10 ** Math.floor(Math.log10(maximo))
  for (const paso of [1, 2, 2.5, 5, 10]) {
    const tope = paso * magnitud
    if (tope >= maximo) return tope
  }
  return 10 * magnitud
}

// ------------------------------------------------------- columnas

/**
 * Columnas: cuántos por cada mes.
 *
 * Se dibujan con elementos, no con SVG. Un lienzo estirado —`preserveAspect
 * Ratio="none"`— deforma todo lo que no sea el dato: una barra de "9
 * unidades" acaba midiendo cien píxeles, y el radio de las esquinas sale
 * ovalado. Con elementos, el grosor se topa en píxeles de verdad.
 *
 * La barra no llena su carril: se topa en 24px y el sobrante queda de aire.
 * La punta va redondeada y la base cuadrada, porque la base es el cero y
 * redondearla la despegaría de la línea.
 */
export function Columnas({
  datos,
  formato = (n) => String(n),
  alto = 200,
}: {
  datos: Array<{ etiqueta: string; valor: number; titulo?: string }>
  formato?: (valor: number) => string
  alto?: number
}) {
  const [encima, setEncima] = useState<number | null>(null)
  const idBase = useId()

  if (datos.length === 0) return <SinDatos />

  const tope = techo(Math.max(...datos.map((d) => d.valor)))

  return (
    <div className="grafica">
      <div className="grafica-lienzo columnas" style={{ height: alto }}>
        {[0, 0.5, 1].map((f) => (
          <span key={f} className="grafica-guia" style={{ bottom: `${f * 100}%` }} aria-hidden />
        ))}

        {datos.map((d, i) => (
          <button
            type="button"
            key={`${idBase}-${i}`}
            className="columna-carril"
            onMouseEnter={() => setEncima(i)}
            onMouseLeave={() => setEncima(null)}
            onFocus={() => setEncima(i)}
            onBlur={() => setEncima(null)}
            aria-label={`${d.titulo ?? d.etiqueta}: ${formato(d.valor)}`}
          >
            <span
              className="columna"
              style={{
                // Un valor en cero no dibuja nada: una rayita mínima se lee
                // como "poquito" cuando lo que hubo fue nada.
                height: d.valor > 0 ? `${Math.max((d.valor / tope) * 100, 1)}%` : 0,
                opacity: encima === null || encima === i ? 1 : 0.35,
              }}
            />
            {encima === i && (
              <span className="grafica-globo">
                <strong>{formato(d.valor)}</strong>
                <span className="silencio">{d.titulo ?? d.etiqueta}</span>
              </span>
            )}
          </button>
        ))}
      </div>

      <div className="grafica-eje">
        {datos.map((d, i) => (
          <span key={`${idBase}-e-${i}`}>{d.etiqueta}</span>
        ))}
      </div>
    </div>
  )
}

// --------------------------------------------------------- línea

/**
 * Línea con su relleno tenue: cómo se va juntando algo a lo largo del año.
 *
 * Solo se etiqueta el último punto. Un número sobre cada punto es ruido que
 * nadie lee, y el que importa en una acumulada es dónde terminó.
 */
export function Linea({
  datos,
  formato = (n) => String(n),
  alto = 200,
}: {
  datos: Array<{ etiqueta: string; valor: number }>
  formato?: (valor: number) => string
  alto?: number
}) {
  const [encima, setEncima] = useState<number | null>(null)
  const idBase = useId()

  if (datos.length === 0) return <SinDatos />

  const tope = techo(Math.max(...datos.map((d) => d.valor)))
  const x = (i: number) => (datos.length === 1 ? 50 : (i / (datos.length - 1)) * 100)
  const y = (v: number) => 100 - (v / tope) * 100
  const camino = datos.map((d, i) => `${i === 0 ? 'M' : 'L'} ${x(i)} ${y(d.valor)}`).join(' ')

  return (
    <div className="grafica">
      <div className="grafica-lienzo" style={{ height: alto }}>
        {[0, 0.5, 1].map((f) => (
          <span key={f} className="grafica-guia" style={{ bottom: `${f * 100}%` }} aria-hidden />
        ))}
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
          <path d={`${camino} L 100 100 L 0 100 Z`} fill={TINTA} opacity="0.1" />
          <path
            d={camino} fill="none" stroke={TINTA} strokeWidth="2"
            strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke"
          />
        </svg>

        {/* Los puntos van fuera del SVG estirado: adentro se deformarían en
            óvalos, porque el lienzo no conserva la proporción. */}
        {datos.map((d, i) => (
          <span
            key={`${idBase}-p-${i}`}
            className={`grafica-punto${i === datos.length - 1 ? ' final' : ''}`}
            style={{ left: `${x(i)}%`, top: `${y(d.valor)}%` }}
            aria-hidden
          />
        ))}

        <div className="grafica-carriles">
          {datos.map((d, i) => (
            <button
              type="button"
              key={`${idBase}-c-${i}`}
              className="grafica-carril"
              onMouseEnter={() => setEncima(i)}
              onMouseLeave={() => setEncima(null)}
              onFocus={() => setEncima(i)}
              onBlur={() => setEncima(null)}
              aria-label={`${d.etiqueta}: ${formato(d.valor)}`}
            >
              {encima === i && (
                <span className="grafica-globo">
                  <strong>{formato(d.valor)}</strong>
                  <span className="silencio">{d.etiqueta}</span>
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="grafica-eje">
        {datos.map((d, i) => (
          <span key={`${idBase}-e-${i}`}>{d.etiqueta}</span>
        ))}
      </div>
    </div>
  )
}

// --------------------------------------------- barras horizontales

/**
 * Barras acostadas: se usan cuando la etiqueta es larga —"Curso Adultos
 * 06:00–07:00" no cabe bajo una columna— y cuando el orden importa más que
 * el tiempo.
 *
 * El valor va al final de cada barra, fuera de ella: adentro se recortaría
 * en las cortas, y un número a medio cortar es peor que ningún número.
 */
export function BarrasAcostadas({
  datos,
  formato = (n) => String(n),
}: {
  datos: Array<{ etiqueta: string; detalle?: string; valor: number }>
  formato?: (valor: number) => string
}) {
  const idBase = useId()
  if (datos.length === 0) return <SinDatos />

  const tope = techo(Math.max(...datos.map((d) => d.valor)))

  return (
    <div className="grupos">
      {datos.map((d, i) => (
        <div className="grupo" key={`${idBase}-${i}`}>
          <span className="grupo-nombre">
            {d.etiqueta}
            {d.detalle && <span className="silencio"> · {d.detalle}</span>}
          </span>
          <span className="grupo-canal">
            <span
              className="grupo-relleno"
              style={{ width: `${Math.max((d.valor / tope) * 100, d.valor > 0 ? 1.5 : 0)}%` }}
            />
          </span>
          <span className="grupo-valor mono">{formato(d.valor)}</span>
        </div>
      ))}
    </div>
  )
}

function SinDatos() {
  return (
    <p className="silencio" style={{ fontSize: '.87rem', margin: '1rem 0' }}>
      No hay nada que graficar con lo que escogiste.
    </p>
  )
}
