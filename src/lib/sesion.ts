import { cookies } from 'next/headers'
import { createHmac, timingSafeEqual } from 'node:crypto'
import { prisma } from '@/lib/db'
import { tienePermiso, type Permiso } from '@/lib/permisos'

const COOKIE = 'sesion_natacion'
const DIAS = 8

const secreto = () => process.env.SESSION_SECRET ?? 'secreto-de-desarrollo'

const firmar = (valor: string) =>
  createHmac('sha256', secreto()).update(valor).digest('base64url')

/** La cookie guarda el id firmado: sin la firma no se puede suplantar a nadie. */
function empaquetar(usuarioId: string): string {
  return `${usuarioId}.${firmar(usuarioId)}`
}

function desempaquetar(valor: string): string | null {
  const corte = valor.lastIndexOf('.')
  if (corte < 1) return null

  const usuarioId = valor.slice(0, corte)
  const firmaRecibida = Buffer.from(valor.slice(corte + 1))
  const firmaEsperada = Buffer.from(firmar(usuarioId))

  if (firmaRecibida.length !== firmaEsperada.length) return null
  if (!timingSafeEqual(firmaRecibida, firmaEsperada)) return null

  return usuarioId
}

export async function crearSesion(usuarioId: string) {
  const almacen = await cookies()
  almacen.set(COOKIE, empaquetar(usuarioId), {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: DIAS * 24 * 60 * 60,
  })
}

export async function cerrarSesion() {
  const almacen = await cookies()
  almacen.delete(COOKIE)
}

/** El correo va en la sesión porque Root se reconoce por él, no por un rol. */
/** El rol viene con sus permisos: es lo que decide qué puede hacer. */
export type RolDeSesion = {
  clave: string
  nombre: string
  permisos: string[]
  activo: boolean
}

export type UsuarioSesion = {
  id: string
  nombre: string
  email: string
  rol: RolDeSesion
}

export async function leerSesion(): Promise<UsuarioSesion | null> {
  const almacen = await cookies()
  const cookie = almacen.get(COOKIE)?.value
  if (!cookie) return null

  const usuarioId = desempaquetar(cookie)
  if (!usuarioId) return null

  const usuario = await prisma.usuario.findUnique({
    where: { id: usuarioId },
    select: {
      id: true, nombre: true, email: true, activo: true,
      rol: { select: { clave: true, nombre: true, permisos: true, activo: true } },
    },
  })
  if (!usuario || !usuario.activo) return null

  return {
    id: usuario.id, nombre: usuario.nombre, email: usuario.email, rol: usuario.rol,
  }
}

/**
 * Lanza si no hay sesión o si le falta el permiso. Las páginas y las
 * acciones la usan para blindarse.
 *
 * Root pasa siempre, aunque su rol no tenga nada marcado: es la red de
 * seguridad. Sin eso, alguien puede editar un rol y dejar el sistema sin
 * nadie capaz de entrar a deshacerlo.
 */
export async function requierePermiso(permiso: Permiso): Promise<UsuarioSesion> {
  const usuario = await leerSesion()
  if (!usuario) throw new Error('Sesión requerida')
  if (!tienePermiso(usuario, permiso)) throw new Error('No autorizado')
  return usuario
}
