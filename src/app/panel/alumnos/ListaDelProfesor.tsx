'use client'

import { useCallback, useEffect, useState } from 'react'
import Selector from '@/components/Selector'
import CampoFecha from '@/components/CampoFecha'
import ModalPasarLista from './ModalPasarLista'
import { listaDelGrupo } from './profesor-acciones'

type Lista = NonNullable<Awaited<ReturnType<typeof listaDelGrupo>>>
type Grupo = { clave: string; curso: string; horario: string }

/**
 * "2026-09-14" → "lun 14". La columna es angosta: no cabe más.
 *
 * Con el mes cuando el tramo cruza de uno a otro: si no, "lun 3" de agosto y
 * "lun 7" de septiembre se leen igual y se marca el día equivocado.
 */
function comoSeLee(dia: string, conMes = false): { corto: string; largo: string } {
  const f = new Date(`${dia}T12:00:00`)
  const LETRAS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb']
  const MESES_CORTOS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
  return {
    corto: `${LETRAS[f.getDay()]} ${f.getDate()}${conMes ? ` ${MESES_CORTOS[f.getMonth()]}` : ''}`,
    largo: f.toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' }),
  }
}

/** "2026-09-01" → "septiembre de 2026". Para nombrar el mes de la credencial. */
function mesYAnio(anio: number, mes: number): string {
  return new Date(anio, mes - 1, 15).toLocaleDateString('es-MX', { month: 'long', year: 'numeric' })
}

/**
 * La lista del profesor: sus grupos, sus alumnos y sus días de clase.
 *
 * No es la pantalla de Alumnos recortada — es otra cosa. El profesor no da
 * de alta a nadie ni cobra: pasa lista y pide credenciales. Enseñarle la
 * tabla de siempre con la mitad de los botones apagados sería enseñarle un
 * formulario roto.
 *
 * El tramo se escoge con dos fechas y no con un mes suelto: un mes suelto se
 * queda sin el año, y en enero ya no habría forma de abrir noviembre del año
 * pasado para revisarlo.
 *
 * La misma pantalla la abren Administrador y Root desde su pestaña de
 * Asistencia, con los grupos de todos en el selector. Lo que cambia no es el
 * dibujo sino quién puede tocar, y eso lo decide el servidor: llega marcado
 * día por día.
 */
export default function ListaDelProfesor({
  grupos,
  desdeHoy,
  hastaHoy,
  supervisando = false,
}: {
  grupos: Grupo[]
  /** El tramo con el que abre: el mes que corre, en hora de Cancún. */
  desdeHoy: string
  hastaHoy: string
  /** Quien mira las listas de todos, no las suyas: cambia cómo se le habla. */
  supervisando?: boolean
}) {
  const [clave, setClave] = useState(grupos[0]?.clave ?? '')
  const [desde, setDesde] = useState(desdeHoy)
  const [hasta, setHasta] = useState(hastaHoy)
  const [busca, setBusca] = useState<
    { fase: 'quieto' | 'buscando' | 'vacio' | 'falla' } | { fase: 'listo'; datos: Lista }
  >({ fase: 'quieto' })

  const traer = useCallback(() => {
    if (!clave || !desde || !hasta) return
    // Con lista en pantalla se refresca por detrás, sin pasar por "Buscando…":
    // ese estado desmonta la tarjeta, y con ella la ventana del alumno que
    // acaba de marcar. Marcar una asistencia no debe cerrarle la ventana.
    setBusca((b) => (b.fase === 'listo' ? b : { fase: 'buscando' }))
    listaDelGrupo(clave, desde, hasta)
      .then((d) => setBusca(d ? { fase: 'listo', datos: d } : { fase: 'vacio' }))
      .catch(() => setBusca({ fase: 'falla' }))
  }, [clave, desde, hasta])

  useEffect(() => { traer() }, [traer])

  if (grupos.length === 0) {
    return (
      <div className="tarjeta">
        <h2>{supervisando ? 'No hay grupos abiertos' : 'Todavía no tienes grupos'}</h2>
        <p className="silencio" style={{ marginBottom: 0 }}>
          {supervisando
            ? 'Las listas salen de la rejilla: en cuanto haya un curso con horario corriendo, aparece aquí.'
            : 'Quien administra la escuela te asigna los cursos y horarios que impartes. En cuanto lo haga, tu lista aparece aquí.'}
        </p>
      </div>
    )
  }

  const datos = busca.fase === 'listo' ? busca.datos : null

  return (
    <>
      {/* Las fechas llevan su palabra adentro —"Desde 1 de septiembre"—
          igual que el selector dice el grupo: ninguno necesita una etiqueta
          arriba que lo desalinee. */}
      <div className="barra-tabla parejos">
        <div className="filtro-tabla">
          <Selector
            nombre="grupo" etiqueta="Grupo" valor={clave} alCambiar={setClave}
            opciones={grupos.map((g) => ({
              valor: g.clave,
              etiqueta: `${g.curso} · ${g.horario}`,
            }))}
          />
        </div>
        <div className="filtro-tabla">
          <CampoFecha
            nombre="lista-desde" etiqueta="Clases desde" prefijo="Desde"
            valor={desde} alCambiar={setDesde}
          />
        </div>
        <div className="filtro-tabla">
          <CampoFecha
            nombre="lista-hasta" etiqueta="Clases hasta" prefijo="Hasta"
            valor={hasta} alCambiar={setHasta}
          />
        </div>
      </div>

      {busca.fase === 'falla' ? (
        <div className="tarjeta">
          <p className="error">No se pudo traer la lista. Vuelve a intentarlo.</p>
          <div className="fila" style={{ justifyContent: 'flex-end' }}>
            <button type="button" className="boton" onClick={traer}>Reintentar</button>
          </div>
        </div>
      ) : busca.fase === 'vacio' ? (
        <div className="tarjeta">
          <p className="aviso" style={{ marginBottom: 0 }}>
            {supervisando ? 'Ese grupo ya no existe.' : 'Ese grupo ya no es tuyo.'}
          </p>
        </div>
      ) : !datos ? (
        <div className="tarjeta">
          <p className="silencio" style={{ textAlign: 'center', padding: '2rem 0', margin: 0 }}>
            <span className="girando" /> Buscando…
          </p>
        </div>
      ) : (
        <Hoja datos={datos} alCambiar={traer} />
      )}
    </>
  )
}

// --------------------------------------------------------- la lista

function Hoja({ datos, alCambiar }: { datos: Lista; alCambiar: () => void }) {
  // Un día que no ha llegado no está "cerrado": no se cuenta con los otros,
  // o el aviso diría que cerró un mes que ni siquiera ha pasado. Que todavía
  // no se dé no se avisa: la casilla apagada ya lo dice, y quién debe
  // credencial se lee en su columna.
  const cerradas = datos.fechas.filter((f) => !f.editable && !f.futura).length
  const mesCredencial = mesYAnio(datos.credencial.anio, datos.credencial.mes)
  // ¿El tramo cruza de un mes a otro? Entonces el día solo no basta.
  const cruzaMeses = new Set(datos.fechas.map((f) => f.dia.slice(0, 7))).size > 1

  return (
    <>
      {datos.soloMira ? (
        <div className="aviso">
          <strong>Estás viendo la lista, no llevándola.</strong> Marcar y desmarcar es del
          profesor mientras el mes corre; corregir lo ya cerrado, solo de Root. Así
          &quot;quién marcó esto&quot; siempre tiene respuesta.
        </div>
      ) : cerradas > 0 && (
        <div className="aviso">
          <strong>
            {cerradas === datos.fechas.length
              ? 'Ese tramo ya cerró.'
              : `${cerradas} de esos días ya cerraron.`}
          </strong>{' '}
          Se pueden ver para tener guía, pero no cambiar: una asistencia que se mueve meses
          después ya no prueba nada.
        </div>
      )}

      <div className="tarjeta">
        <h2>{datos.curso} · {datos.horario}</h2>
        <p className="silencio" style={{ marginTop: '-.3rem', fontSize: '.85rem' }}>
          {datos.alumnos.length} alumno{datos.alumnos.length === 1 ? '' : 's'} ·{' '}
          {datos.fechas.length} clase{datos.fechas.length === 1 ? '' : 's'} en el tramo ·
          credencial de {mesCredencial}
        </p>

        {datos.fechas.length === 0 ? (
          <p className="silencio">Este grupo no tiene clases en esas fechas.</p>
        ) : datos.alumnos.length === 0 ? (
          <p className="silencio">Todavía no hay nadie inscrito a este grupo.</p>
        ) : (
          <div className="tabla-ancha">
            <table className="lista-asistencia">
              <thead>
                <tr>
                  <th>Alumno</th>
                  <th style={{ width: 110 }}>Credencial</th>
                  {datos.fechas.map((f) => {
                    const { corto, largo } = comoSeLee(f.dia, cruzaMeses)
                    return <th key={f.dia} className="dia" title={largo}>{corto}</th>
                  })}
                </tr>
              </thead>
              <tbody>
                {datos.alumnos.map((a) => (
                  <Renglon
                    key={a.folio} alumno={a} fechas={datos.fechas}
                    credencial={datos.credencial} alCambiar={alCambiar}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  )
}

function Renglon({
  alumno,
  fechas,
  credencial,
  alCambiar,
}: {
  alumno: Lista['alumnos'][number]
  fechas: Lista['fechas']
  credencial: Lista['credencial']
  alCambiar: () => void
}) {
  const puestas = new Set(alumno.asistio)

  return (
    <tr>
      <td>
        {/* El nombre abre su ventana: ahí se le pasa lista. */}
        <ModalPasarLista
          alumno={alumno} fechas={fechas} credencial={credencial} alCambiar={alCambiar}
        />
        <br />
        <span className="silencio pie-celda mono">{alumno.folio}</span>
      </td>

      <td>
        {alumno.verificado ? (
          <span className="insignia VERDE" title={`Verificada por ${alumno.verificado.toLowerCase()}`}>
            {alumno.verificado === 'ESCANEO' ? 'Escaneada' : 'Por folio'}
          </span>
        ) : !alumno.credencialSePuede ? (
          /* Debe el mes: sin eso no hay credencial que valga ni lista que
             pasar. Se marca aquí para que se vea sin abrir a nadie. */
          <span className="insignia ROJO" title="No tiene pagado el mes">Debe el mes</span>
        ) : (
          <span className="silencio pie-celda">sin pedir</span>
        )}
      </td>

      {/* La tabla es el resumen: enseña quién vino de un vistazo. Lo que se
          marca, se marca en la ventana del alumno. */}
      {fechas.map((f) => {
        const vino = puestas.has(f.dia)
        return (
          <td key={f.dia} className="dia">
            <span
              className={`casilla cerrada${vino ? ' puesta' : ''}`}
              title={`${comoSeLee(f.dia).largo}: ${vino ? 'vino' : 'no vino'}`}
            >
              {vino ? '✓' : ''}
            </span>
          </td>
        )
      })}
    </tr>
  )
}
