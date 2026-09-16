'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { LETRAS_DIA, NOMBRES_MES, semanasDelMes } from '@/lib/calendario'
import { IconoAnterior, IconoSiguiente } from '@/components/Iconos'

/**
 * Un campo de fecha con su propio calendario.
 *
 * El `<input type="date">` del navegador se ve distinto en cada uno y
 * escribe el orden de día y mes según el idioma del navegador, no el de la
 * página: en una máquina en inglés muestra mes/día/año, que aquí se lee al
 * revés y se presta a capturar mal una fecha límite.
 *
 * Este muestra siempre "14 de diciembre de 2026" y guarda `2026-12-14` en
 * un campo oculto, que es lo que viaja al servidor.
 */
export default function CampoFecha({
  nombre,
  valor,
  formulario,
  etiqueta,
  requerido = false,
  deshabilitado = false,
  alCambiar,
  prefijo,
}: {
  nombre: string
  valor?: string
  formulario?: string
  etiqueta: string
  requerido?: boolean
  deshabilitado?: boolean
  /**
   * Una palabra antes de la fecha: "Desde 1 de septiembre".
   *
   * Sirve cuando el campo va en una barra de filtros, donde los demás se
   * leen solos —"Horario: todos"— y una fecha suelta no dice de qué es.
   */
  prefijo?: string
  /** Se avisa al escoger, para filtrar sin un botón aparte. */
  alCambiar?: (valor: string) => void
}) {
  const [elegida, poner] = useState(valor ?? '')

  /** Guarda y avisa. Las dos cosas siempre juntas: un camino que solo
   *  guarde deja el filtro mirando una fecha que ya nadie tiene. */
  const setElegida = (nueva: string) => {
    poner(nueva)
    alCambiar?.(nueva)
  }
  const [abierto, setAbierto] = useState(false)
  const [sitio, setSitio] = useState<{ top: number; left: number } | null>(null)
  const inicial = leer(valor ?? '') ?? new Date()
  const [mes, setMes] = useState(inicial.getMonth())
  const [anio, setAnio] = useState(inicial.getFullYear())

  /**
   * Los años que se ofrecen: una década para atrás y otra para adelante.
   *
   * Atrás porque hay fechas de nacimiento; adelante porque se capturan
   * precios y temporadas del año que entra. El año que ya trae el campo se
   * incluye siempre, aunque caiga fuera: si no, escoger el mes lo movería
   * solo a otro año sin que nadie se lo pidiera.
   */
  const anios = useMemo(() => {
    const hoy = new Date().getFullYear()
    const lista = new Set<number>()
    for (let a = hoy - 10; a <= hoy + 10; a++) lista.add(a)
    lista.add(anio)
    return [...lista].sort((a, b) => a - b)
  }, [anio])
  const caja = useRef<HTMLDivElement>(null)
  const globo = useRef<HTMLDivElement>(null)

  const colocar = useCallback(() => {
    const r = caja.current?.getBoundingClientRect()
    if (!r) return
    const alto = globo.current?.offsetHeight ?? 320
    const cabeAbajo = window.innerHeight - r.bottom > alto + 12
    setSitio({
      top: cabeAbajo ? r.bottom + 4 : Math.max(8, r.top - alto - 4),
      left: Math.min(r.left, window.innerWidth - 292),
    })
  }, [])

  useEffect(() => {
    if (!abierto) return
    colocar()
    const afuera = (e: MouseEvent) => {
      const d = e.target as Node
      if (caja.current?.contains(d) || globo.current?.contains(d)) return
      setAbierto(false)
    }
    const tecla = (e: KeyboardEvent) => e.key === 'Escape' && setAbierto(false)
    const seguir = () => colocar()
    document.addEventListener('mousedown', afuera)
    document.addEventListener('keydown', tecla)
    window.addEventListener('scroll', seguir, true)
    window.addEventListener('resize', seguir)
    return () => {
      document.removeEventListener('mousedown', afuera)
      document.removeEventListener('keydown', tecla)
      window.removeEventListener('scroll', seguir, true)
      window.removeEventListener('resize', seguir)
    }
  }, [abierto, colocar])

  function escoger(dia: number) {
    setElegida(`${anio}-${dos(mes + 1)}-${dos(dia)}`)
    setAbierto(false)
  }

  function mover(pasos: number) {
    const d = new Date(anio, mes + pasos, 1)
    setMes(d.getMonth())
    setAnio(d.getFullYear())
  }

  const hoy = new Date()
  const puesta = leer(elegida)

  return (
    <div className={`campo-fecha${requerido ? ' obligatorio' : ''}`} ref={caja}>
      <input type="hidden" name={nombre} value={elegida} form={formulario} required={requerido} />

      <button
        type="button"
        className="campo-fecha-boton"
        onClick={() => setAbierto((a) => !a)}
        disabled={deshabilitado}
        aria-label={etiqueta}
        aria-haspopup="dialog"
        aria-expanded={abierto}
      >
        <span className={puesta ? '' : 'silencio'}>
          {prefijo && `${prefijo} `}
          {puesta ? (prefijo ? enCorto(puesta) : enPalabras(puesta)) : 'sin fecha'}
        </span>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          strokeWidth="2" strokeLinecap="round" aria-hidden>
          <rect x="3" y="5" width="18" height="16" rx="2" />
          <line x1="3" y1="10" x2="21" y2="10" />
          <line x1="8" y1="3" x2="8" y2="7" />
          <line x1="16" y1="3" x2="16" y2="7" />
        </svg>
      </button>

      {abierto && sitio && createPortal(
        <div
          ref={globo}
          className="calendario"
          role="dialog"
          aria-label={etiqueta}
          style={{ top: sitio.top, left: sitio.left }}
        >
          <div className="calendario-barra">
            <button type="button" onClick={() => mover(-1)} aria-label="Mes anterior">
              <IconoAnterior tamano={13} />
            </button>

            {/* Mes y año se escogen de una lista, no a puros clics. Para
                llegar a diciembre de 2027 desde hoy harían falta quince
                clics en la flecha, y para una fecha de nacimiento, cientos. */}
            <div className="calendario-salto">
              <select
                value={mes}
                onChange={(e) => setMes(Number(e.target.value))}
                aria-label="Mes"
              >
                {NOMBRES_MES.map((nombre, i) => (
                  <option key={i} value={i}>{nombre}</option>
                ))}
              </select>
              <select
                value={anio}
                onChange={(e) => setAnio(Number(e.target.value))}
                aria-label="Año"
              >
                {anios.map((a) => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>

            <button type="button" onClick={() => mover(1)} aria-label="Mes siguiente">
              <IconoSiguiente tamano={13} />
            </button>
          </div>

          <table className="calendario-mes">
            <thead>
              <tr>{LETRAS_DIA.map((l, i) => <th key={i}>{l}</th>)}</tr>
            </thead>
            <tbody>
              {semanasDelMes(anio, mes + 1).map((semana, i) => (
                <tr key={i}>
                  {semana.map((dia, j) => (
                    <td key={j}>
                      {dia && (
                        <button
                          type="button"
                          onClick={() => escoger(dia)}
                          className={`${esMismoDia(puesta, anio, mes, dia) ? 'elegido' : ''} ${
                            esMismoDia(hoy, anio, mes, dia) ? 'hoy' : ''
                          }`}
                          aria-label={`${dia} de ${NOMBRES_MES[mes]} de ${anio}`}
                        >
                          {dia}
                        </button>
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>

          <div className="calendario-pie">
            <button type="button" onClick={() => {
              const h = new Date()
              setMes(h.getMonth()); setAnio(h.getFullYear())
              setElegida(`${h.getFullYear()}-${dos(h.getMonth() + 1)}-${dos(h.getDate())}`)
              setAbierto(false)
            }}>
              Hoy
            </button>
            {!requerido && (
              <button type="button" onClick={() => { setElegida(''); setAbierto(false) }}>
                Sin fecha
              </button>
            )}
          </div>
        </div>,
        document.body,
      )}
    </div>
  )
}

const dos = (n: number) => String(n).padStart(2, '0')

/** "2026-12-14" → Date, o `null` si no trae nada legible. */
function leer(texto: string): Date | null {
  const p = /^(\d{4})-(\d{2})-(\d{2})$/.exec(texto)
  if (!p) return null
  return new Date(Number(p[1]), Number(p[2]) - 1, Number(p[3]), 12)
}

const enPalabras = (d: Date) =>
  `${d.getDate()} de ${NOMBRES_MES[d.getMonth()]} de ${d.getFullYear()}`

/**
 * La fecha corta, para cuando el campo ya gastó espacio en su prefijo.
 *
 * "Desde 1 de septiembre de 2026" no cabe en un filtro del ancho de los
 * demás, y truncarlo deja "Desde 1 de septie…", que no dice ni el año. Con
 * el mes abreviado entra completa, que es lo que importa.
 */
const enCorto = (d: Date) =>
  `${d.getDate()} ${NOMBRES_MES[d.getMonth()].slice(0, 3)} ${d.getFullYear()}`

const esMismoDia = (d: Date | null, anio: number, mes: number, dia: number) =>
  !!d && d.getFullYear() === anio && d.getMonth() === mes && d.getDate() === dia
