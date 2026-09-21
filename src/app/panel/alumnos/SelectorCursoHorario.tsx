'use client'

import { useMemo, useState } from 'react'
import Selector from '@/components/Selector'

/** Un curso a una hora, con todos los días en que corre. */
export type GrupoHorario = {
  /** Identifica al grupo en la pantalla. No es ningún id de la base. */
  clave: string
  cursoHash: string
  cursoNombre: string
  horarioHash: string
  /** Cómo se lee la franja: "08:00–09:00". */
  horario: string
  /** Los días en que corre, ya escritos: "Lun, Mié, Vie". */
  dias: string
  /** Cuántos alumnos van, sin contar dos veces a quien va varios días. */
  inscritos: number
  /** Los renglones de la rejilla a los que se le apunta. */
  sesiones: string[]
}

/**
 * A qué curso y a qué hora entra el alumno.
 *
 * Se escoge el curso y su horario, y queda apuntado a **todos** los días en
 * que ese curso corre a esa hora. Antes se marcaba día por día: quien va
 * lunes, miércoles y viernes había que marcarlo tres veces, y olvidar uno
 * dejaba al alumno a medias sin que nada lo avisara.
 *
 * Lo que se ofrece sale de "Días y horarios por curso": si un curso no
 * está armado para el año, no aparece.
 */
export default function SelectorCursoHorario({
  grupos,
  deshabilitado = false,
  claveInicial = '',
  alEscoger,
}: {
  grupos: GrupoHorario[]
  deshabilitado?: boolean
  /** Avisa qué grupo quedó puesto, para quien necesite saber si ya está. */
  alEscoger?: (clave: string) => void
  /**
   * Con qué grupo arranca. Al editar a alguien ya inscrito se abre en el
   * suyo: en blanco parecería que no lleva curso.
   */
  claveInicial?: string
}) {
  const inicial = grupos.find((g) => g.clave === claveInicial) ?? null
  const [curso, setCurso] = useState(inicial?.cursoHash ?? '')
  const [clave, setClave] = useState(inicial?.clave ?? '')

  const cursos = useMemo(
    () =>
      [...new Map(grupos.map((g) => [g.cursoHash, g.cursoNombre])).entries()]
        .sort((a, b) => a[1].localeCompare(b[1]))
        .map(([valor, etiqueta]) => ({ valor, etiqueta })),
    [grupos],
  )

  // Los horarios se recortan al curso escogido: ofrecer los de todos los
  // cursos deja escoger una hora en la que ese curso no se da.
  const horarios = useMemo(
    () =>
      grupos
        .filter((g) => g.cursoHash === curso)
        .sort((a, b) => a.horario.localeCompare(b.horario))
        .map((g) => ({ valor: g.clave, etiqueta: `${g.horario} · ${g.dias}` })),
    [grupos, curso],
  )

  const elegido = grupos.find((g) => g.clave === clave) ?? null

  return (
    <div className="fila" style={{ alignItems: 'flex-end' }}>
      <div style={{ flex: '1 1 0', minWidth: 220 }}>
        <label>Tipo de curso</label>
        <Selector
          nombre="curso-visible"
          etiqueta="Tipo de curso"
          placeholder="Escoge el curso…"
          valor={curso}
          requerido
          deshabilitado={deshabilitado || cursos.length === 0}
          alCambiar={(v) => {
            setCurso(v)
            // El horario de antes puede no existir en el curso nuevo.
            setClave('')
            alEscoger?.('')
          }}
          opciones={[{ valor: '', etiqueta: 'Escoge el curso…' }, ...cursos]}
        />
      </div>

      <div style={{ flex: '1 1 0', minWidth: 220 }}>
        <label>Horario</label>
        <Selector
          // Se remonta al cambiar de curso para que vuelva a decir "Escoge…"
          // en vez de quedarse con el horario del curso anterior.
          key={curso}
          nombre="horario-visible"
          etiqueta="Horario"
          placeholder={curso ? 'Escoge el horario…' : 'Primero el curso'}
          valor={clave}
          requerido
          deshabilitado={deshabilitado || !curso}
          alCambiar={(v) => {
            setClave(v)
            alEscoger?.(v)
          }}
          opciones={[
            { valor: '', etiqueta: curso ? 'Escoge el horario…' : 'Primero el curso' },
            ...horarios,
          ]}
        />
      </div>

      <div style={{ flex: '1 1 100%' }}>
        {elegido ? (
          <p className="resumen-horario">
            Queda apuntado a <strong>{elegido.dias}</strong> de{' '}
            <strong>{elegido.horario}</strong>
            {' · '}
            <span className="silencio">
              {elegido.inscritos === 0
                ? 'nadie inscrito todavía'
                : `${elegido.inscritos} ${elegido.inscritos === 1 ? 'alumno inscrito' : 'alumnos inscritos'}`}
            </span>
          </p>
        ) : (
          grupos.length === 0 && (
            <p className="silencio" style={{ fontSize: '.85rem', margin: '.4rem 0 0' }}>
              No hay ningún curso armado para este año. Ármalo en “Días y horarios
              por curso”.
            </p>
          )
        )}

        {/* Lo que de verdad viaja: los renglones de la rejilla, uno por día. */}
        {elegido?.sesiones.map((hash) => (
          <input key={hash} type="hidden" name="sesiones" value={hash} />
        ))}
      </div>
    </div>
  )
}
