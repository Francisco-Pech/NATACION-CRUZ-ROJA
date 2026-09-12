import { describe, it, expect } from 'vitest'
import { esCorreoDeRoot, esRoot, esAdministrativo, puedeAsignarRol } from '@/lib/roles'

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
    expect(esRoot({ email: ROOT, rol: 'PROFESOR' }, ROOT)).toBe(true)
  })

  it('no es root quien trae otro correo, aunque sea administrador', () => {
    expect(esRoot({ email: 'admin@cruzroja.org', rol: 'ADMINISTRADOR' }, ROOT)).toBe(false)
  })

  it('sin sesión no hay root', () => {
    expect(esRoot(null, ROOT)).toBe(false)
  })
})

describe('esAdministrativo', () => {
  it('el administrador entra', () => {
    expect(esAdministrativo({ email: 'admin@cruzroja.org', rol: 'ADMINISTRADOR' }, ROOT)).toBe(true)
  })

  // Esta es la prueba que evita el error caro: root se reconoce por correo,
  // así que una comparación de igualdad contra ADMINISTRADOR lo dejaría
  // fuera de su propio panel.
  it('root entra aunque su rol guardado no sea administrador', () => {
    expect(esAdministrativo({ email: ROOT, rol: 'PROFESOR' }, ROOT)).toBe(true)
  })

  it('el capturista no entra', () => {
    expect(esAdministrativo({ email: 'cap@cruzroja.org', rol: 'CAPTURISTA' }, ROOT)).toBe(false)
  })

  it('el profesor no entra', () => {
    expect(esAdministrativo({ email: 'prof@cruzroja.org', rol: 'PROFESOR' }, ROOT)).toBe(false)
  })

  it('sin sesión no entra', () => {
    expect(esAdministrativo(null, ROOT)).toBe(false)
  })
})

describe('puedeAsignarRol', () => {
  const root = { email: ROOT, rol: 'ADMINISTRADOR' as const }
  const admin = { email: 'admin@cruzroja.org', rol: 'ADMINISTRADOR' as const }

  it('root puede crear administradores', () => {
    expect(puedeAsignarRol(root, 'ADMINISTRADOR', ROOT)).toBe(true)
  })

  // El administrador crea personal de piso, pero no gente de su mismo nivel:
  // si pudiera, cualquier administrador se multiplicaría solo.
  it('el administrador no puede crear otro administrador', () => {
    expect(puedeAsignarRol(admin, 'ADMINISTRADOR', ROOT)).toBe(false)
  })

  it('el administrador sí puede crear capturistas', () => {
    expect(puedeAsignarRol(admin, 'CAPTURISTA', ROOT)).toBe(true)
  })

  it('el administrador sí puede crear profesores', () => {
    expect(puedeAsignarRol(admin, 'PROFESOR', ROOT)).toBe(true)
  })

  it('el capturista no puede crear a nadie', () => {
    expect(puedeAsignarRol({ email: 'cap@cruzroja.org', rol: 'CAPTURISTA' }, 'PROFESOR', ROOT)).toBe(false)
  })

  it('sin sesión no se puede crear a nadie', () => {
    expect(puedeAsignarRol(null, 'PROFESOR', ROOT)).toBe(false)
  })
})
