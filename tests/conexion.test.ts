import { describe, it, expect, afterAll } from 'vitest'
import { prisma } from '@/lib/db'

describe('conexión a la base', () => {
  afterAll(async () => {
    await prisma.$disconnect()
  })

  it('responde una consulta', async () => {
    const filas = await prisma.$queryRaw`SELECT 1 AS uno`
    expect(filas).toEqual([{ uno: 1 }])
  })

  it('crea un alumno con solo el nombre', async () => {
    const alumno = await prisma.alumno.create({
      data: { nombreCompleto: 'Prueba Conexión' },
    })
    expect(alumno.datosCompletos).toBe(false)
    expect(alumno.categoria).toBe('GENERAL')
    await prisma.alumno.delete({ where: { id: alumno.id } })
  })
})
