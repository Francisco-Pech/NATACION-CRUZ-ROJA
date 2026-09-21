import { prisma } from '@/lib/db'
import { hoyEnCancun } from '@/lib/zona'
import { DIAS_SEMANA } from '@/lib/dias-semana'

/** Un curso a una hora, con todos sus días juntos. */
export type GrupoAbierto = {
  /** Lo que viaja en el formulario. No es ningún id de la base. */
  clave: string
  cursoHash: string
  cursoNombre: string
  horarioHash: string
  /** "08:00–09:00". */
  horario: string
  /** "Lun, Mié, Vie". */
  dias: string
}

/**
 * Los grupos a los que alguien se puede apuntar este año.
 *
 * Lo mismo que ve quien inscribe desde el panel, pero sin lo que no le
 * incumbe a un desconocido: ni cuántos van, ni los renglones de la rejilla.
 * Aquí entra gente sin contraseña, y lo que no se enseña no se filtra.
 */
export async function gruposAbiertos(): Promise<GrupoAbierto[]> {
  const anio = Number(hoyEnCancun().slice(0, 4))

  const sesiones = await prisma.sesion.findMany({
    where: {
      activo: true,
      tipoCurso: { activo: true },
      temporada: {
        desde: { gte: new Date(`${anio}-01-01T00:00:00`) },
        hasta: { lte: new Date(`${anio}-12-31T23:59:59`) },
      },
    },
    include: { tipoCurso: true, horario: true },
    orderBy: [
      { tipoCurso: { nombre: 'asc' } },
      { horario: { horaInicio: 'asc' } },
      { diaSemana: 'asc' },
    ],
  })

  const porGrupo = new Map<string, GrupoAbierto & { diasN: number[] }>()
  for (const s of sesiones) {
    const clave = `${s.tipoCurso.hash}|${s.horario.hash}`
    const grupo = porGrupo.get(clave) ?? {
      clave,
      cursoHash: s.tipoCurso.hash,
      cursoNombre: s.tipoCurso.nombre,
      horarioHash: s.horario.hash,
      horario: `${s.horario.horaInicio}–${s.horario.horaFin}`,
      dias: '',
      diasN: [],
    }
    grupo.diasN.push(s.diaSemana)
    porGrupo.set(clave, grupo)
  }

  return [...porGrupo.values()].map(({ diasN, ...g }) => ({
    ...g,
    dias: [...diasN]
      .sort((a, b) => a - b)
      .map((n) => DIAS_SEMANA.find((d) => d.n === n)?.corto ?? '?')
      .join(', '),
  }))
}

/**
 * Los lockers que nadie ocupa este mes.
 *
 * Se enseñan por número y nada más. Que un locker aparezca aquí no lo
 * aparta: quien lo pida en su solicitud puede encontrarlo tomado cuando le
 * den de alta, y entonces se le asigna otro en la ventanilla.
 */
export async function lockersLibres(): Promise<Array<{ hash: string; numero: number }>> {
  const hoy = hoyEnCancun()
  const periodo = await prisma.periodo.findUnique({ where: { clave: hoy.slice(0, 7) } })
  if (!periodo) return []

  const lockers = await prisma.locker.findMany({
    where: {
      activo: true,
      deProfesor: null,
      asignaciones: { none: { periodoId: periodo.id } },
    },
    orderBy: { numero: 'asc' },
    select: { id: true, numero: true },
  })

  // El id de la base no sale a ninguna pantalla: viaja el número, que es
  // lo que de verdad identifica al locker para quien lo pide.
  return lockers.map((l) => ({ hash: String(l.numero), numero: l.numero }))
}
