'use client'

import { useMemo, useState } from 'react'
import Selector from '@/components/Selector'
import CampoFecha from '@/components/CampoFecha'
import { Columnas, Linea, BarrasAcostadas } from '@/components/Graficas'
import {
  porMes, acumulado, saturacion, type Movimiento, type Apuntado, type Grupo,
} from '@/lib/estadisticas'
import { pesos, nombreMes, MESES } from '@/lib/formato'

/** Un cargo con los pagos que recibió, para poder filtrarlos uno por uno. */
export type CargoDelTablero = Omit<Movimiento, 'pagado'> & {
  pagos: Array<{ dia: string; metodo: string; estado: string; monto: number }>
}

/**
 * El tablero: estadísticas para mirar, no un reporte para imprimir.
 *
 * Lleva los mismos seis filtros que Cobranza, y por eso las gráficas cuelgan
 * del pago y no del cargo: preguntar "¿cuánto entró por tarjeta?" solo tiene
 * sentido sobre el dinero que de verdad se movió.
 *
 * Las tres gráficas son de una sola serie a propósito. No es pereza: dos
 * series obligan a distinguir por color, y dos colores que alguien con
 * daltonismo no separa convierten la gráfica en un adorno.
 */
export default function Tablero({
  cargos,
  apuntados,
  grupos,
  catalogos,
  desdeHoy,
  hastaHoy,
}: {
  cargos: CargoDelTablero[]
  apuntados: Apuntado[]
  /** Todos los grupos abiertos, aunque no tengan a nadie. */
  grupos: Grupo[]
  catalogos: { cursos: string[]; horarios: string[]; metodos: string[]; estados: string[] }
  /** El primer y el último día del mes que corre, en Cancún. */
  desdeHoy: string
  hastaHoy: string
}) {
  const [desde, setDesde] = useState(desdeHoy)
  const [hasta, setHasta] = useState(hastaHoy)
  const [curso, setCurso] = useState('')
  const [horario, setHorario] = useState('')
  const [metodo, setMetodo] = useState('')
  const [estado, setEstado] = useState('')

  /**
   * Los cargos del filtro, con solo los pagos que lo pasan.
   *
   * Las fechas se comparan como texto "2026-09-15": están en el mismo
   * formato, así que el orden alfabético es el cronológico. Pasarlas por
   * `new Date` las leería en la zona del navegador y movería los bordes del
   * rango un día.
   */
  const movimientos: Movimiento[] = useMemo(
    () =>
      cargos
        .filter((c) => (curso === '' || c.curso === curso) && (horario === '' || c.horario === horario))
        .map((c) => ({
          anio: c.anio,
          mes: c.mes,
          inscripcionId: c.inscripcionId,
          curso: c.curso,
          horario: c.horario,
          montoNeto: c.montoNeto,
          pagado: c.pagos
            .filter(
              (p) =>
                (!desde || p.dia >= desde) &&
                (!hasta || p.dia <= hasta) &&
                (metodo === '' || p.metodo === metodo) &&
                (estado === '' || p.estado === estado),
            )
            .reduce((s, p) => s + p.monto, 0),
        })),
    [cargos, desde, hasta, curso, horario, metodo, estado],
  )

  // La saturación no depende del rango ni de la forma de pago: es cuánta
  // gente hay apuntada hoy en cada grupo abierto.
  const llenos = useMemo(
    () =>
      saturacion(
        apuntados.filter(
          (a) => (curso === '' || a.curso === curso) && (horario === '' || a.horario === horario),
        ),
        grupos.filter(
          (g) => (curso === '' || g.curso === curso) && (horario === '' || g.horario === horario),
        ),
      ),
    [apuntados, grupos, curso, horario],
  )

  const meses = useMemo(() => porMes(movimientos), [movimientos])
  const suma = useMemo(() => acumulado(meses), [meses])

  const cobrado = meses.reduce((s, m) => s + m.cobrado, 0)
  const quienesPagaron = new Set(
    movimientos.filter((m) => m.pagado > 0).map((m) => m.inscripcionId),
  ).size
  const inscritos = llenos.reduce((s, g) => s + g.alumnos, 0)

  return (
    <>
      {/* Los mismos seis de Cobranza, del mismo alto y del mismo ancho. */}
      <div className="barra-tabla parejos">
        <div className="filtro-tabla">
          <CampoFecha
            nombre="tablero-desde" etiqueta="Pagos desde" prefijo="Desde"
            valor={desde} alCambiar={setDesde}
          />
        </div>
        <div className="filtro-tabla">
          <CampoFecha
            nombre="tablero-hasta" etiqueta="Pagos hasta" prefijo="Hasta"
            valor={hasta} alCambiar={setHasta}
          />
        </div>
        <div className="filtro-tabla">
          <Selector
            nombre="tablero-curso" etiqueta="Tipo de curso" valor={curso} alCambiar={setCurso}
            opciones={[
              { valor: '', etiqueta: 'Tipo de curso: todos' },
              ...catalogos.cursos.map((c) => ({ valor: c, etiqueta: c })),
            ]}
          />
        </div>
        <div className="filtro-tabla">
          <Selector
            nombre="tablero-horario" etiqueta="Horario" valor={horario} alCambiar={setHorario}
            opciones={[
              { valor: '', etiqueta: 'Horario: todos' },
              ...catalogos.horarios.map((h) => ({ valor: h, etiqueta: h })),
            ]}
          />
        </div>
        <div className="filtro-tabla">
          <Selector
            nombre="tablero-metodo" etiqueta="Forma de pago" valor={metodo} alCambiar={setMetodo}
            opciones={[
              { valor: '', etiqueta: 'Forma de pago: todas' },
              ...catalogos.metodos.map((m) => ({ valor: m, etiqueta: m })),
            ]}
          />
        </div>
        <div className="filtro-tabla">
          <Selector
            nombre="tablero-estado" etiqueta="Estado" valor={estado} alCambiar={setEstado}
            opciones={[
              { valor: '', etiqueta: 'Estado: todos' },
              ...catalogos.estados.map((e) => ({ valor: e, etiqueta: e })),
            ]}
          />
        </div>
      </div>

      {/* Las cifras primero: son la respuesta a "¿cómo vamos?", y una gráfica
          obliga a leerla para contestarla. */}
      <div className="cifras">
        <div className="cifra">
          <div className="cifra-nombre">Cobrado</div>
          <div className="cifra-valor">{pesos(cobrado)}</div>
          <div className="cifra-pie">en el rango y con los filtros puestos</div>
        </div>
        <div className="cifra">
          <div className="cifra-nombre">Alumnos que pagaron</div>
          <div className="cifra-valor">{quienesPagaron}</div>
          <div className="cifra-pie">distintos, no cobros</div>
        </div>
        <div className="cifra">
          <div className="cifra-nombre">Alumnos inscritos</div>
          <div className="cifra-valor">{inscritos}</div>
          <div className="cifra-pie">
            en {llenos.filter((g) => g.alumnos > 0).length} de {llenos.length} grupo
            {llenos.length === 1 ? '' : 's'} abierto{llenos.length === 1 ? '' : 's'}
          </div>
        </div>
        <div className="cifra">
          <div className="cifra-nombre">Meses con movimiento</div>
          <div className="cifra-valor">{meses.filter((m) => m.cobrado > 0).length}</div>
          <div className="cifra-pie">
            {meses.length === 0 ? 'sin cargos' : `de ${meses.length} con cargo`}
          </div>
        </div>
      </div>

      <div className="tarjeta">
        <h2>Alumnos que pagaron, mes por mes</h2>
        <p className="silencio" style={{ marginTop: '-.3rem', fontSize: '.85rem' }}>
          Alumnos distintos, no cobros: quien lleva dos cursos y paga los dos cuenta una vez.
        </p>
        <Columnas
          datos={meses.map((m) => ({
            etiqueta: MESES[m.mes - 1].slice(0, 3),
            titulo: nombreMes(m.mes),
            valor: m.alumnos,
          }))}
          formato={(n) => `${n} alumno${n === 1 ? '' : 's'}`}
        />
      </div>

      <div className="tarjeta">
        <h2>Cobrado acumulado</h2>
        <p className="silencio" style={{ marginTop: '-.3rem', fontSize: '.85rem' }}>
          Cómo se va juntando el dinero. Si la línea se aplana, dejó de entrar.
        </p>
        <Linea
          datos={suma.map((s) => ({ etiqueta: MESES[s.mes - 1].slice(0, 3), valor: s.total }))}
          formato={pesos}
        />
      </div>

      <div className="tarjeta">
        <h2>Los grupos más llenos</h2>
        <p className="silencio" style={{ marginTop: '-.3rem', fontSize: '.85rem' }}>
          Todos los grupos abiertos, con y sin gente: los de abajo son donde hay lugar. No
          depende del rango de fechas ni de la forma de pago — es cuánta gente hay en la
          alberca.
        </p>
        {/* El curso primero: con treinta horarios en la lista, la hora sola
            no dice de cuál grupo se trata. */}
        <BarrasAcostadas
          datos={llenos.map((g) => ({ etiqueta: g.curso, detalle: g.horario, valor: g.alumnos }))}
        />
      </div>
    </>
  )
}
