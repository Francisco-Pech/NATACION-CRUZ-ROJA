import 'dotenv/config'
import { PrismaClient, EstadoInscripcion } from '@prisma/client'
import { inscribirAlumno } from '../src/lib/servicios/inscripciones.ts'
import { generarCargosDelPeriodo } from '../src/lib/servicios/periodos.ts'
import { mesesAlInscribir } from '../src/lib/cobros.ts'
import { hoyEnCancun } from '../src/lib/zona.ts'

const prisma = new PrismaClient()

/**
 * Dos alumnos para probar el cobro, y los meses de quien se quedó sin
 * ellos.
 *
 * Hace dos cosas, las dos sin pisar nada:
 *
 * 1. Repara. A toda inscripción activa que no tenga ni un cargo le genera
 *    los meses que le quedan del ciclo. Es para los que se dieron de alta
 *    antes de que el sistema los generara solo: aparecían "al corriente"
 *    porque no tenían nada que deber, y no había forma de pagarles.
 *
 * 2. Siembra. Si faltan, crea dos alumnos de prueba con curso y horario,
 *    que nacen ya con sus meses.
 *
 * Se puede correr las veces que haga falta: no duplica alumnos —los busca
 * por nombre— y no vuelve a generar un mes que ya exista.
 */
const NOMBRES = ['Alumno de Prueba Uno', 'Alumno de Prueba Dos']

/** Le genera a una inscripción los meses que le quedan de su ciclo. */
async function generarSusMeses(inscripcionId: string, ciclo: { id: string; anio: number }) {
  const meses = mesesAlInscribir(ciclo.anio, hoyEnCancun())
  if (meses.length === 0) return 0

  const periodos = await prisma.periodo.findMany({
    where: { cicloAnualId: ciclo.id, mes: { in: meses } },
    orderBy: { mes: 'asc' },
    select: { id: true },
  })

  let creados = 0
  for (const periodo of periodos) {
    const { creados: n } = await generarCargosDelPeriodo(periodo.id, inscripcionId)
    creados += n
  }
  return creados
}

async function main() {
  const anio = Number(hoyEnCancun().slice(0, 4))
  const ciclo = await prisma.cicloAnual.findUnique({ where: { anio } })
  if (!ciclo) {
    console.log(`  ⚠  No hay ciclo de ${anio}. Corre primero el seeder principal.`)
    return
  }

  console.log(`Alumnos de prueba y meses faltantes · ciclo ${anio}`)

  // ---- 1. Los que ya existen y se quedaron sin meses ------------------
  const sinMeses = await prisma.inscripcion.findMany({
    where: {
      cicloAnualId: ciclo.id,
      estado: EstadoInscripcion.ACTIVA,
      cargos: { none: {} },
    },
    include: { alumno: { select: { nombreCompleto: true } } },
  })

  for (const inscripcion of sinMeses) {
    const creados = await generarSusMeses(inscripcion.id, ciclo)
    console.log(
      `  ${inscripcion.alumno.nombreCompleto} (${inscripcion.folio}): ${creados} ${
        creados === 1 ? 'mes generado' : 'meses generados'
      }${creados === 0 ? ' — revisa que su curso tenga sesión, temporada y tarifa' : ''}`,
    )
  }
  if (sinMeses.length === 0) console.log('  Ninguna inscripción se quedó sin meses.')

  // ---- 2. Los dos de prueba -------------------------------------------
  // Una sesión por curso, para que los dos no caigan en el mismo si hay
  // de dónde escoger.
  const sesiones = await prisma.sesion.findMany({
    where: { activo: true, tipoCurso: { activo: true } },
    include: { tipoCurso: { select: { id: true, nombre: true, maxMeses: true } }, horario: true },
    orderBy: { tipoCursoId: 'asc' },
  })
  const porCurso = [...new Map(sesiones.map((s) => [s.tipoCurso.id, s])).values()]

  if (porCurso.length === 0) {
    console.log('  ⚠  No hay ninguna sesión activa en la rejilla: sin eso no hay curso que cobrar.')
    return
  }

  for (const [i, nombre] of NOMBRES.entries()) {
    const yaEsta = await prisma.alumno.findFirst({ where: { nombreCompleto: nombre } })
    if (yaEsta) {
      console.log(`  ${nombre}: ya existía, no se toca.`)
      continue
    }

    const sesion = porCurso[i % porCurso.length]
    const inscripcion = await inscribirAlumno({
      nombreCompleto: nombre,
      cicloAnualId: ciclo.id,
      sesionIds: [sesion.id],
    })

    const cargos = await prisma.cargo.findMany({
      where: { inscripcionId: inscripcion.id },
      include: { periodo: { select: { clave: true } } },
      orderBy: { periodo: { mes: 'asc' } },
    })

    console.log(
      `  ${nombre} · ${inscripcion.folio} · ${sesion.tipoCurso.nombre}` +
        ` ${sesion.horario.horaInicio}–${sesion.horario.horaFin}`,
    )
    console.log(
      `     meses: ${cargos.map((c) => c.periodo.clave).join(' · ') || '(ninguno)'}` +
        (sesion.tipoCurso.maxMeses ? ` · el curso dura ${sesion.tipoCurso.maxMeses} meses` : ''),
    )
  }

  console.log('Listo.')
}

main()
  .catch((e) => {
    console.error(e)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
