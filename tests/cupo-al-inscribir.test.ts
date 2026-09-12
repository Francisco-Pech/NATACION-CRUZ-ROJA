import { describe, it, expect, beforeEach, afterAll } from 'vitest'
import { prisma } from '@/lib/db'
import { nuevoHash } from '@/lib/ids'
import { inscribirAlumno } from '@/lib/servicios/inscripciones'
import { Categoria } from '@prisma/client'

/**
 * El cupo, contado donde de verdad importa: al inscribir.
 *
 * La pantalla también lo mira, pero puede venir de un formulario viejo o de
 * alguien que se la saltó. Estas pruebas van por el servicio, que es la
 * única puerta que no se puede rodear.
 */

const ANIO = 2095
const CLAVE_CURSO = 'PRUEBA_CUPO'
// Propias de este archivo: las pruebas corren en paralelo y con la misma
// hora se estarían pisando la sesión unas a otras.
const HORA = '23:05'
const HORA_FIN = '23:35'

let cicloId = ''
let cursoId = ''

async function limpiar() {
  const ciclo = await prisma.cicloAnual.findUnique({ where: { anio: ANIO } })
  if (ciclo) {
    const insc = await prisma.inscripcion.findMany({
      where: { cicloAnualId: ciclo.id }, select: { alumnoId: true },
    })
    await prisma.cicloAnual.delete({ where: { id: ciclo.id } })
    await prisma.alumno.deleteMany({ where: { id: { in: insc.map((i) => i.alumnoId) } } })
  }
  await prisma.sesion.deleteMany({ where: { horario: { horaInicio: HORA } } })
  await prisma.horario.deleteMany({ where: { horaInicio: HORA } })
  await prisma.tipoCurso.deleteMany({ where: { clave: CLAVE_CURSO } })
}

/** Una sesión propia de la prueba, para llenarla sin tocar las reales. */
async function sesionDePrueba(cupoMaximo: number, extras: number) {
  const horario = await prisma.horario.upsert({
    where: { horaInicio_horaFin: { horaInicio: HORA, horaFin: HORA_FIN } },
    update: {},
    create: { horaInicio: HORA, horaFin: HORA_FIN, hash: nuevoHash() },
  })
  return prisma.sesion.upsert({
    where: {
      tipoCursoId_horarioId_diaSemana: { tipoCursoId: cursoId, horarioId: horario.id, diaSemana: 0 },
    },
    update: { cupoMaximo, extras, activo: true },
    create: {
      hash: nuevoHash(),
      tipoCursoId: cursoId, horarioId: horario.id, diaSemana: 0,
      cupoMaximo, extras,
    },
  })
}

/** Cuántos entraron antes de que el servicio dijera que no. */
async function cuantosEntran(sesionId: string, intentos: number): Promise<number> {
  let dentro = 0
  for (let i = 0; i < intentos; i++) {
    try {
      await inscribirAlumno(`Alumno ${i}`, cicloId, Categoria.GENERAL, [sesionId])
      dentro++
    } catch {
      break
    }
  }
  return dentro
}

beforeEach(async () => {
  await limpiar()
  const ciclo = await prisma.cicloAnual.create({ data: { anio: ANIO } })
  cicloId = ciclo.id
  // Curso propio de este archivo. Los archivos de prueba corren en
  // paralelo, y tocarle el cupo a un curso del seeder dejaría a las otras
  // pruebas midiendo un número que cambia debajo de ellas.
  const curso = await prisma.tipoCurso.upsert({
    where: { clave: CLAVE_CURSO },
    update: { activo: true },
    create: { hash: nuevoHash(), clave: CLAVE_CURSO, nombre: 'Curso de prueba, cupo' },
  })
  cursoId = curso.id
})

afterAll(async () => { await limpiar(); await prisma.$disconnect() })

describe('el cupo al inscribir', () => {
  it('una sesión sin cupo propio usa el del curso', async () => {
    const sesion = await sesionDePrueba(3, 0)
    expect(await cuantosEntran(sesion.id, 6)).toBe(3)
  })

  it('cada renglón lleva su propio cupo', async () => {
    const sesion = await sesionDePrueba(2, 0)
    expect(await cuantosEntran(sesion.id, 6)).toBe(2)
  })

  // Los extras son tolerancia: dejan entrar a alguien más allá del cupo en
  // vez de mandarlo a la calle.
  it('los extras dejan pasar más allá del cupo', async () => {
    const sesion = await sesionDePrueba(2, 2)
    expect(await cuantosEntran(sesion.id, 8)).toBe(4)
  })

  it('pasando los extras ya no entra nadie', async () => {
    const sesion = await sesionDePrueba(1, 1)
    expect(await cuantosEntran(sesion.id, 5)).toBe(2)
  })

  // Sin extras el cupo es una pared, que es como se comportaba antes de
  // que existiera la tolerancia.
  it('sin extras se llena justo en el cupo', async () => {
    const sesion = await sesionDePrueba(2, 0)
    expect(await cuantosEntran(sesion.id, 5)).toBe(2)
  })

  it('dice cuántos hay y cuántos caben cuando rechaza', async () => {
    const sesion = await sesionDePrueba(1, 0)
    await inscribirAlumno('El que sí', cicloId, Categoria.GENERAL, [sesion.id])
    await expect(
      inscribirAlumno('El que no', cicloId, Categoria.GENERAL, [sesion.id]),
    ).rejects.toThrow(/1 de 1/)
  })

  it('una sesión cerrada no admite a nadie, aunque sobre cupo', async () => {
    const sesion = await sesionDePrueba(50, 10)
    await prisma.sesion.update({ where: { id: sesion.id }, data: { activo: false } })
    await expect(
      inscribirAlumno('Nadie', cicloId, Categoria.GENERAL, [sesion.id]),
    ).rejects.toThrow(/cerrada/)
  })
})
