import { describe, it, expect } from 'vitest'
import { enlacesDelPanel } from '@/lib/navegacion'

const con = (permisos: string[], email = 'quien@cruzroja.mx') => ({
  email,
  rol: { permisos, activo: true },
})
const ROOT = 'jefe@cruzroja.mx'

const rutas = (u: Parameters<typeof enlacesDelPanel>[0]) =>
  enlacesDelPanel(u, ROOT).map((e) => e.href)

describe('enlacesDelPanel — qué ve cada quien en la barra', () => {
  it('Root ve todo, aunque su rol no tenga nada marcado', () => {
    // Es la red de seguridad: sin ella, editar mal un rol dejaría el
    // sistema sin nadie capaz de entrar a deshacerlo.
    expect(rutas(con([], ROOT))).toEqual([
      '/panel', '/panel/alumnos', '/panel/pagos', '/panel/lockers', '/panel/admin',
    ])
  })

  it('el Administrador ve todo', () => {
    expect(rutas(con(['VER_PANEL', 'ALUMNOS', 'COBRAR', 'LOCKERS', 'ASISTENCIA', 'CONFIGURAR', 'USUARIOS']))).toEqual([
      '/panel', '/panel/alumnos', '/panel/pagos', '/panel/lockers', '/panel/admin',
    ])
  })

  it('el Capturista ve todo menos Tablero y Panel de control', () => {
    expect(rutas(con(['ALUMNOS', 'COBRAR', 'LOCKERS']))).toEqual([
      '/panel/alumnos', '/panel/pagos', '/panel/lockers',
    ])
  })

  it('el Profesor solo ve Alumnos', () => {
    // Entra por Asistencia, no por Alumnos: no da de alta a nadie, pasa
    // lista. La sección es la misma puerta, lo que ve adentro no.
    expect(rutas(con(['ASISTENCIA']))).toEqual(['/panel/alumnos'])
  })

  it('sin sesión no hay nada', () => {
    expect(rutas(null)).toEqual([])
  })

  it('un rol apagado no abre nada', () => {
    // Falla cerrado: a quien le desactivaron el rol no le queda ni una
    // sección, aunque su cookie siga viva y sus permisos sigan escritos.
    expect(
      rutas({ email: 'x@y.mx', rol: { permisos: ['ALUMNOS', 'COBRAR'], activo: false } }),
    ).toEqual([])
  })
})
