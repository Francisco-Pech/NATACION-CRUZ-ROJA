import { describe, it, expect } from 'vitest'

describe('andamiaje', () => {
  it('corre en zona horaria de Cancún', () => {
    expect(process.env.TZ).toBe('America/Cancun')
  })
})
