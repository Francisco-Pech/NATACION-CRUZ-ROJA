import 'dotenv/config'
import { PrismaClient, EstadoInscripcion } from '@prisma/client'
import { generarCargosDelPeriodo } from '../src/lib/servicios/periodos.ts'
import { mesesAlInscribir } from '../src/lib/cobros.ts'
import { hoyEnCancun } from '../src/lib/zona.ts'

const prisma = new PrismaClient()

/**
 * Los meses de quien se quedó sin ellos.
 *
 * Quien se dio de alta antes de que el alta los generara sola no tiene ni
 * un cargo: su pantalla dice "al corriente" con razón —no debe nada— y no
 * hay forma de cobrarle. Esto le genera los meses que le quedan del ciclo.
 *
 * No toca a nadie más: solo mira inscripciones activas sin ningún cargo, y
 * nunca vuelve a generar un mes que ya exista. Se puede correr las veces
 * que haga falta.
 */

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

  console.log(`Meses faltantes · ciclo ${anio}`)

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

  console.log('Listo.')
}

main()
  .catch((e) => {
    console.error(e)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
