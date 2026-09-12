import { prisma } from '@/lib/db'

export function claveDelMes(fecha: Date = new Date()): string {
  return `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}`
}

/**
 * El periodo del mes en curso junto con su ciclo anual, o null si nadie
 * lo ha dado de alta todavía.
 */
export async function periodoActual(fecha: Date = new Date()) {
  const periodo = await prisma.periodo.findUnique({
    where: { clave: claveDelMes(fecha) },
    include: { ciclo: true },
  })
  return periodo ? { periodo, ciclo: periodo.ciclo } : null
}
