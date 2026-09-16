import { describe, it, expect } from 'vitest'
import { esCorreoDeRoot, esRoot } from '@/lib/roles'

const ROOT = 'root@ejemplo.test'

describe('esCorreoDeRoot', () => {
  it('reconoce el correo configurado', () => {
    expect(esCorreoDeRoot('root@ejemplo.test', ROOT)).toBe(true)
  })

  it('ignora mayúsculas y espacios de sobra', () => {
    expect(esCorreoDeRoot('  ROOT@Ejemplo.TEST ', ROOT)).toBe(true)
  })

  it('rechaza cualquier otro correo', () => {
    expect(esCorreoDeRoot('otro@gmail.com', ROOT)).toBe(false)
  })

  // Falla cerrado: si nadie configuró el correo, no hay root.
  // Lo contrario —tratar la ausencia como "todos pasan"— abre el sistema entero.
  // Se borra la variable de entorno en vez de pasar undefined: como el
  // parámetro tiene valor por omisión, pasar undefined lo dispara y volvería
  // a leer el .env. El escenario real es que la variable no exista.
  it('sin ROOT_EMAIL configurado, nadie es root', () => {
    const previo = process.env.ROOT_EMAIL
    delete process.env.ROOT_EMAIL
    try {
      expect(esCorreoDeRoot('root@ejemplo.test')).toBe(false)
    } finally {
      process.env.ROOT_EMAIL = previo
    }
  })

  it('con ROOT_EMAIL en blanco, nadie es root', () => {
    expect(esCorreoDeRoot('root@ejemplo.test', '   ')).toBe(false)
  })

  it('sin correo que comparar, no es root', () => {
    expect(esCorreoDeRoot(null, ROOT)).toBe(false)
  })
})

describe('esRoot', () => {
  it('es root quien trae el correo configurado', () => {
    expect(esRoot({ email: ROOT }, ROOT)).toBe(true)
  })

  it('no es root quien trae otro correo, aunque sea administrador', () => {
    expect(esRoot({ email: 'admin@cruzroja.org' }, ROOT)).toBe(false)
  })

  it('sin sesión no hay root', () => {
    expect(esRoot(null, ROOT)).toBe(false)
  })
})
