import { tienePermiso, type Permiso } from '@/lib/permisos'

/**
 * Qué secciones ve cada quien.
 *
 * La barra se arma de los permisos y no de una lista fija. Enseñar un enlace
 * que al abrirse contesta "no tienes permiso" es enseñar una puerta pintada
 * en la pared: quien la pica cree que algo se rompió.
 *
 * Esto NO es la seguridad. Cada página vuelve a exigir su permiso en el
 * servidor; aquí solo se decide qué se dibuja. Si alguien teclea la ruta a
 * mano, la que dice que no es la página.
 */
export type EnlaceDelPanel = {
  href: string
  texto: string
  /** El permiso que abre esa sección. */
  permiso: Permiso
}

export const SECCIONES: EnlaceDelPanel[] = [
  { href: '/panel', texto: 'Tablero', permiso: 'VER_PANEL' },
  // Alumnos se abre con cualquiera de los dos: quien da de alta y quien pasa
  // lista entran por la misma puerta, pero no ven lo mismo adentro.
  { href: '/panel/alumnos', texto: 'Alumnos', permiso: 'ALUMNOS' },
  { href: '/panel/pagos', texto: 'Cobranza', permiso: 'COBRAR' },
  { href: '/panel/lockers', texto: 'Lockers', permiso: 'LOCKERS' },
  { href: '/panel/admin', texto: 'Panel de control', permiso: 'CONFIGURAR' },
]

type Quien = { email: string; rol: { permisos: string[]; activo: boolean } | null } | null

export function enlacesDelPanel(usuario: Quien, rootEmail = process.env.ROOT_EMAIL) {
  if (!usuario) return []

  return SECCIONES.filter(({ href, permiso }) => {
    if (tienePermiso(usuario, permiso, rootEmail)) return true
    // El profesor no da de alta a nadie: entra a Alumnos a pasar lista.
    return href === '/panel/alumnos' && tienePermiso(usuario, 'ASISTENCIA', rootEmail)
  })
}
