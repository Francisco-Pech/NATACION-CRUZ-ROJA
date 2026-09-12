import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import { formatearFolio, generarTokenQR } from '../src/lib/folio.ts'
import { cabeUnoMas } from '../src/lib/cupos'

/**
 * Alumnos inventados para trabajar en local.
 *
 * **Esto nunca se corre en producción.** El catálogo que la delegación sí
 * necesita vive en `seed.ts`; aquí solo hay gente que no existe.
 */
const prisma = new PrismaClient()

const ANIO = 2026

// Nadie va a Guardavidas: el curso existe pero está apagado y no se ofrece.
// Un alumno de demostración inscrito ahí generaba cargos que después
// impedían borrar su precio, que es justo lo que no debe pasar.
const ALUMNOS_DEMO = [
  ['María Fernanda López Herrera', 'GENERAL', 'ADULTOS'],
  ['Juan Carlos Martínez Uc', 'GENERAL', 'ADULTOS'],
  ['Ana Sofía Canul Pérez', 'NINOS', 'NINOS'],
  ['Diego Alejandro Ruiz Moo', 'NINOS', 'NINOS'],
  ['Guadalupe Chan Balam', 'GENERAL', 'ADULTOS'],
  ['Roberto Iván Sánchez Dzul', 'GENERAL', 'ADULTOS'],
  ['Valeria Itzel Poot Chi', 'NINOS', 'NINOS'],
  ['José Manuel Aguilar Cen', 'GENERAL', 'ADULTOS'],
  ['Regina Alejandra Novelo Ake', 'NINOS', 'NINOS'],
  ['Luis Ángel Tun Cauich', 'GENERAL', 'PERSONALIZADO'],
  ['Fátima Guadalupe Ek Pech', 'GENERAL', 'ADULTOS'],
  ['Emiliano Cocom Tzuc', 'NINOS', 'NINOS'],
  ['Carmen Leticia Uicab May', 'GENERAL', 'ADULTOS'],
  ['Santiago Andrés Kumul Be', 'NINOS', 'NINOS'],
  ['Rosa María Chi Canché', 'GENERAL', 'ADULTOS'],
  ['Alejandro Puc Yam', 'GENERAL', 'PERSONALIZADO'],
  ['Ximena Guadalupe Couoh Dzib', 'NINOS', 'NINOS'],
  ['Martín Eduardo Hau Cimé', 'GENERAL', 'ADULTOS'],
  ['Paola Andrea Interián Ku', 'GENERAL', 'PERSONALIZADO'],
  ['Sebastián Noh Cahuich', 'NINOS', 'NINOS'],
] as const

async function main() {
  console.log('Sembrando alumnos de demostración…')

  const ciclo = await prisma.cicloAnual.findUnique({ where: { anio: ANIO } })
  if (!ciclo) {
    console.error(`No hay ciclo ${ANIO}. Corre primero: npm run db:seed`)
    process.exit(1)
  }

  let creados = 0
  let religados = 0
  let sinCupo = 0

  for (const [nombreCompleto, categoria, claveCurso] of ALUMNOS_DEMO) {
    const alumno =
      (await prisma.alumno.findFirst({ where: { nombreCompleto } })) ??
      (await prisma.alumno.create({ data: { nombreCompleto, categoria } }))

    const yaInscrito = await prisma.inscripcion.findUnique({
      where: { alumnoId_cicloAnualId: { alumnoId: alumno.id, cicloAnualId: ciclo.id } },
      include: { _count: { select: { sesiones: true } } },
    })

    // Ya inscrito y con sesiones: no hay nada que hacer. Ya inscrito pero
    // suelto —por ejemplo tras la migración que retiró los grupos viejos—
    // se le vuelven a colgar sus sesiones sin tocar folio ni token.
    if (yaInscrito && yaInscrito._count.sesiones > 0) continue

    // El consecutivo del folio sale del conteo real, no del índice del
    // arreglo: así el seed puede correrse de nuevo sin chocar.
    const consecutivo = (await prisma.inscripcion.count({ where: { cicloAnualId: ciclo.id } })) + 1

    const inscripcion =
      yaInscrito ??
      (await prisma.inscripcion.create({
        data: {
          alumnoId: alumno.id,
          cicloAnualId: ciclo.id,
          folio: formatearFolio(ANIO, consecutivo),
          tokenQR: generarTokenQR(),
        },
      }))

    // Se apunta a todas las sesiones activas de su curso: es demo, y así
    // las pantallas se ven con datos en varios días.
    const sesiones = await prisma.sesion.findMany({
      where: { activo: true, tipoCurso: { clave: claveCurso } },
      include: { _count: { select: { inscritos: true } } },
      orderBy: { diaSemana: 'asc' },
    })

    for (const sesion of sesiones) {
      if (cabeUnoMas(sesion._count.inscritos, sesion.cupoMaximo, sesion.extras) === 'lleno') {
        sinCupo++
        continue
      }
      await prisma.inscripcionSesion.create({
        data: { inscripcionId: inscripcion.id, sesionId: sesion.id },
      })
    }
    if (yaInscrito) religados++
    else creados++
  }

  // Rescate: inscripciones de corridas anteriores del seed, con otros
  // nombres, que quedaron sin sesiones al retirarse los grupos viejos. Sin
  // curso no se les genera cargo y se verían rotas en pantalla.
  const sueltas = await prisma.inscripcion.findMany({
    where: { cicloAnualId: ciclo.id, sesiones: { none: {} } },
    include: { alumno: { select: { categoria: true } } },
  })

  for (const inscripcion of sueltas) {
    const clave = inscripcion.alumno.categoria === 'NINOS' ? 'NINOS' : 'ADULTOS'
    const sesiones = await prisma.sesion.findMany({
      where: { activo: true, tipoCurso: { clave } },
      include: { _count: { select: { inscritos: true } } },
      orderBy: { diaSemana: 'asc' },
    })
    for (const sesion of sesiones) {
      if (cabeUnoMas(sesion._count.inscritos, sesion.cupoMaximo, sesion.extras) === 'lleno') {
        sinCupo++
        continue
      }
      await prisma.inscripcionSesion.create({
        data: { inscripcionId: inscripcion.id, sesionId: sesion.id },
      })
    }
  }

  console.log(`  ${creados} alumnos nuevos · ${religados} re-ligados a sus sesiones`)
  if (sueltas.length > 0) console.log(`  ${sueltas.length} inscripciones sueltas rescatadas`)
  if (sinCupo > 0) console.log(`  ${sinCupo} sesiones omitidas por cupo lleno`)
  console.log('Listo.')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
