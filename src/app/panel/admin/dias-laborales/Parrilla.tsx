'use client'

import { useActionState } from 'react'
import Alerta from '@/components/Alerta'
import type { Resultado } from '../catalogo/tipos'

type Dia = { hash: string; nombre: string; corto: string }
type Franja = { hash: string; horaInicio: string; horaFin: string }

/**
 * El marco de trabajo: qué día abre la alberca y en qué franja.
 *
 * Una celda por cruce. Se marca para abrir, se vuelve a marcar para cerrar.
 * Todos los cruces comparten una sola acción: mientras una responde, la
 * parrilla entera se bloquea para que nadie dispare dos cambios encimados.
 */
export default function Parrilla({
  dias,
  franjas,
  abiertas,
  alternar,
}: {
  dias: Dia[]
  franjas: Franja[]
  abiertas: Set<string>
  alternar: (previo: Resultado, datos: FormData) => Promise<Resultado>
}) {
  const [aviso, accion, ocupado] = useActionState(alternar, null)
  const abierta = (d: string, f: string) => abiertas.has(`${d}|${f}`)

  return (
    <>
      <div className="tarjeta">
        <div className="tabla-ancha">
          <table className="parrilla">
            <thead>
              <tr>
                <th>Horario</th>
                {dias.map((d) => (
                  <th key={d.hash} title={d.nombre}>{d.corto}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {franjas.map((f) => (
                <tr key={f.hash}>
                  <td>{f.horaInicio}—{f.horaFin}</td>
                  {dias.map((d) => {
                    const si = abierta(d.hash, f.hash)
                    return (
                      <td key={d.hash}>
                        <form action={accion}>
                          <input type="hidden" name="dia" value={d.hash} />
                          <input type="hidden" name="horario" value={f.hash} />
                          <button
                            className={`celda ${si ? 'prendida' : ''}`}
                            type="submit"
                            disabled={ocupado}
                            title={`${d.nombre} ${f.horaInicio}—${f.horaFin}: ${si ? 'abierto' : 'cerrado'}`}
                            aria-label={`${d.nombre} de ${f.horaInicio} a ${f.horaFin}`}
                            aria-pressed={si}
                          >
                            {si ? '✓' : ''}
                          </button>
                        </form>
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Alerta resultado={ocupado ? null : aviso} />
    </>
  )
}
