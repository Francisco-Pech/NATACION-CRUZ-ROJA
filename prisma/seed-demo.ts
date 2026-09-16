import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import { generarFolio, generarTokenQR } from '../src/lib/folio.ts'
import { hashPassword } from '../src/lib/auth'

/**
 * Alumnos inventados para trabajar en local.
 *
 * **Esto nunca se corre en producción.** El catálogo que la delegación sí
 * necesita vive en `seed.ts`; aquí solo hay gente que no existe.
 */
const prisma = new PrismaClient()

const ANIO = 2026

/**
 * Un solo alumno, para probar las pantallas.
 *
 * Los alumnos de verdad van variando —entran y salen cada temporada— así
 * que el seeder no pretende poblar la lista: siembra uno con el que se
 * puede recorrer el alta, la credencial y el estado de cuenta, y ese se
 * borra cuando estorbe.
 *
 * Nadie va a Guardavidas: el curso existe pero está apagado y no se
 * ofrece. Un alumno inscrito ahí generaba cargos que después impedían
 * borrar su precio, que es justo lo que no debe pasar.
 */
const ALUMNO_DE_PRUEBA = {
  nombreCompleto: 'Prueba',
  curso: 'ADULTOS',
} as const

/**
 * Los tres usuarios de prueba, uno por rol.
 *
 * La contraseña sale de `DEMO_PASSWORD`, nunca del código: aunque estas
 * cuentas sean de mentira, una contraseña escrita aquí acaba funcionando en
 * algún despliegue real que corrió este seeder sin pensarlo.
 */
async function usuariosDePrueba(prisma: PrismaClient) {
  const clave = process.env.DEMO_PASSWORD ?? ''
  if (clave.length < 8) {
    console.log('  Sin usuarios de prueba: pon DEMO_PASSWORD en el .env (8+ caracteres).')
    return
  }
  const passwordHash = await hashPassword(clave)
  const gente = [
    { nombre: 'Administrador de prueba', email: 'admin@example.com', rol: 'ADMINISTRADOR' },
    { nombre: 'Capturista de prueba', email: 'capturista@example.com', rol: 'CAPTURISTA' },
    { nombre: 'Profesor de prueba', email: 'profesor@example.com', rol: 'PROFESOR' },
  ]
  for (const u of gente) {
    const rol = await prisma.rol.findUnique({ where: { clave: u.rol } })
    if (!rol) continue
    await prisma.usuario.upsert({
      where: { email: u.email },
      update: { nombre: u.nombre, rolId: rol.id, activo: true, passwordHash },
      create: { nombre: u.nombre, email: u.email, rolId: rol.id, passwordHash },
    })
  }
  console.log(`  ${gente.length} usuarios de prueba (admin, capturista y profesor @example.com)`)
}

/**
 * Le da al profesor de prueba los grupos donde de verdad hay alguien.
 *
 * Sin esto su pantalla abre vacía y no se puede probar nada: la lista del
 * profesor sale de los grupos que imparte, y si no imparte ninguno no hay
 * lista. Se le asignan los del alumno de prueba, que es el punto.
 */
async function gruposDelProfesor(prisma: PrismaClient) {
  const profesor = await prisma.usuario.findUnique({ where: { email: 'profesor@example.com' } })
  if (!profesor) return

  // Los grupos a los que está apuntado el alumno de prueba: curso y hora.
  const sesiones = await prisma.inscripcionSesion.findMany({
    include: { sesion: { select: { tipoCursoId: true, horarioId: true } } },
  })
  const grupos = [
    ...new Map(
      sesiones.map((s) => [
        `${s.sesion.tipoCursoId}|${s.sesion.horarioId}`,
        { tipoCursoId: s.sesion.tipoCursoId, horarioId: s.sesion.horarioId },
      ]),
    ).values(),
  ]

  // Se reemplazan, no se agregan: correr el seeder dos veces no debe dejarle
  // grupos de un alumno que ya se borró.
  await prisma.profesorDeGrupo.deleteMany({ where: { usuarioId: profesor.id } })
  for (const g of grupos) {
    await prisma.profesorDeGrupo.create({ data: { usuarioId: profesor.id, ...g } })
  }
  console.log(`  ${grupos.length} grupo(s) para el profesor de prueba`)
}

async function main() {
  await usuariosDePrueba(prisma)
  console.log('Sembrando alumnos de demostración…')

  const ciclo = await prisma.cicloAnual.findUnique({ where: { anio: ANIO } })
  if (!ciclo) {
    console.error(`No hay ciclo ${ANIO}. Corre primero: npm run db:seed`)
    process.exit(1)
  }

  const { nombreCompleto, curso } = ALUMNO_DE_PRUEBA

  const alumno =
    (await prisma.alumno.findFirst({ where: { nombreCompleto } })) ??
    (await prisma.alumno.create({ data: { nombreCompleto } }))

  const yaInscrito = await prisma.inscripcion.findUnique({
    where: { alumnoId_cicloAnualId: { alumnoId: alumno.id, cicloAnualId: ciclo.id } },
    include: { _count: { select: { sesiones: true } } },
  })

  // El folio y el token no se tocan si ya existe: son los que están
  // impresos en su credencial.
  const inscripcion =
    yaInscrito ??
    (await prisma.inscripcion.create({
      data: {
        alumnoId: alumno.id,
        cicloAnualId: ciclo.id,
        folio: generarFolio(ANIO),
        tokenQR: generarTokenQR(),
      },
    }))

  // Se le cuelga el curso completo a esa hora: todos los días en que
  // corre, que es como se inscribe desde la pantalla. Colgarle uno solo
  // dejaba un alumno que no se parece a ninguno real.
  if ((yaInscrito?._count.sesiones ?? 0) === 0) {
    const primera = await prisma.sesion.findFirst({
      where: {
        activo: true,
        tipoCurso: { clave: curso },
        temporada: {
          desde: { gte: new Date(`${ANIO}-01-01T00:00:00`) },
          hasta: { lte: new Date(`${ANIO}-12-31T23:59:59`) },
        },
      },
      orderBy: [{ horario: { horaInicio: 'asc' } }, { diaSemana: 'asc' }],
    })

    if (!primera) {
      console.log('  Sin días y horarios para ese curso: corre antes npm run db:seed')
    } else {
      // El mismo curso a la misma hora, en todos sus días.
      const delGrupo = await prisma.sesion.findMany({
        where: {
          activo: true,
          tipoCursoId: primera.tipoCursoId,
          horarioId: primera.horarioId,
          temporadaCursoId: primera.temporadaCursoId,
        },
        include: { horario: true },
        orderBy: { diaSemana: 'asc' },
      })
      for (const sesion of delGrupo) {
        await prisma.inscripcionSesion.create({
          data: { inscripcionId: inscripcion.id, sesionId: sesion.id },
        })
      }
      console.log(
        `  ${delGrupo.length} días de ${curso} a las ${delGrupo[0].horario.horaInicio}`,
      )
    }
  }

  console.log(`  1 alumno de prueba · folio ${inscripcion.folio}`)
  await gruposDelProfesor(prisma)

  console.log('Listo.')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
