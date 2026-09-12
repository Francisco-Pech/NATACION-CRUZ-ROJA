import { describe, it, expect } from 'vitest'
import { hashPassword, verificarPassword } from '@/lib/auth'

describe('contraseñas', () => {
  it('no guarda la contraseña en claro', async () => {
    const hash = await hashPassword('secreta123')
    expect(hash).not.toContain('secreta123')
  })
  it('acepta la contraseña correcta', async () => {
    const hash = await hashPassword('secreta123')
    expect(await verificarPassword('secreta123', hash)).toBe(true)
  })
  it('rechaza la incorrecta', async () => {
    const hash = await hashPassword('secreta123')
    expect(await verificarPassword('otra', hash)).toBe(false)
  })
  it('dos hashes de la misma contraseña son distintos', async () => {
    expect(await hashPassword('igual')).not.toBe(await hashPassword('igual'))
  })
})
