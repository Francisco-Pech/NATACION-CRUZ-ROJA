import { describe, it, expect, afterAll } from 'vitest'
import { prisma } from '@/lib/db'

describe('esquema', () => {
  it('conecta y consulta usuarios', async () => {
    await expect(prisma.usuario.count()).resolves.toBeTypeOf('number')
  })

  it('impide dos inscripciones con el mismo folio', async () => {
    const ciclo = await prisma.cicloAnual.upsert({
      where: { anio: 2099 }, update: {}, create: { anio: 2099 },
    })
    const alumnoA = await prisma.alumno.create({ data: { nombreCompleto: 'Prueba A' } })
    const alumnoB = await prisma.alumno.create({ data: { nombreCompleto: 'Prueba B' } })

    await prisma.inscripcion.create({
      data: { alumnoId: alumnoA.id, cicloAnualId: ciclo.id, folio: 'CRM-2099-0001', tokenQR: 'tok-a' },
    })
    await expect(
      prisma.inscripcion.create({
        data: { alumnoId: alumnoB.id, cicloAnualId: ciclo.id, folio: 'CRM-2099-0001', tokenQR: 'tok-b' },
      }),
    ).rejects.toThrow()

    await prisma.alumno.deleteMany({ where: { id: { in: [alumnoA.id, alumnoB.id] } } })
    await prisma.cicloAnual.delete({ where: { id: ciclo.id } })
  })

  it('impide asignar el mismo locker dos veces en un periodo', async () => {
    const ciclo = await prisma.cicloAnual.upsert({
      where: { anio: 2098 }, update: {}, create: { anio: 2098 },
    })
    const periodo = await prisma.periodo.create({
      data: { cicloAnualId: ciclo.id, mes: 1, clave: '2098-01', fechaLimite: new Date('2098-01-08') },
    })
    const locker = await prisma.locker.create({ data: { numero: 9998 } })
    const a1 = await prisma.alumno.create({ data: { nombreCompleto: 'Locker A' } })
    const a2 = await prisma.alumno.create({ data: { nombreCompleto: 'Locker B' } })
    const i1 = await prisma.inscripcion.create({
      data: { alumnoId: a1.id, cicloAnualId: ciclo.id, folio: 'CRM-2098-0001', tokenQR: 'tok-l1' },
    })
    const i2 = await prisma.inscripcion.create({
      data: { alumnoId: a2.id, cicloAnualId: ciclo.id, folio: 'CRM-2098-0002', tokenQR: 'tok-l2' },
    })

    await prisma.asignacionLocker.create({
      data: { lockerId: locker.id, inscripcionId: i1.id, periodoId: periodo.id },
    })
    await expect(
      prisma.asignacionLocker.create({
        data: { lockerId: locker.id, inscripcionId: i2.id, periodoId: periodo.id },
      }),
    ).rejects.toThrow()

    await prisma.alumno.deleteMany({ where: { id: { in: [a1.id, a2.id] } } })
    await prisma.locker.delete({ where: { id: locker.id } })
    await prisma.cicloAnual.delete({ where: { id: ciclo.id } })
  })

  afterAll(async () => { await prisma.$disconnect() })
})
