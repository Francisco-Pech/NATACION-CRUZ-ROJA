import { PrismaClient } from '@prisma/client'

// Next recarga los módulos en desarrollo; sin este singleton se abrirían
// decenas de conexiones contra Postgres hasta agotar el pool.
const globalParaPrisma = globalThis as unknown as { prisma?: PrismaClient }

export const prisma = globalParaPrisma.prisma ?? new PrismaClient()

if (process.env.NODE_ENV !== 'production') globalParaPrisma.prisma = prisma
