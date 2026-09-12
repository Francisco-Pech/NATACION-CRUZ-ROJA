import { defineConfig } from 'vitest/config'
import path from 'node:path'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    // Las pruebas de fecha límite dependen de la zona horaria: en Cancún
    // no hay horario de verano, y el 5.º día hábil se calcula ahí.
    env: { TZ: 'America/Cancun' },
    setupFiles: ['tests/preparacion.ts'],
    // Las pruebas tocan la misma base; en paralelo se pisarían entre sí.
    fileParallelism: false,
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, 'src') },
    // Sin esto, el runtime de Prisma 7 se resuelve por su rama de
    // navegador y falla al cargar ("Cannot read properties of undefined").
    conditions: ['node', 'import', 'require', 'default'],
  },
})
